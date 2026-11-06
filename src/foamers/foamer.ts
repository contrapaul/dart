import * as THREE from "three";
import type RAPIER from "@dimforge/rapier3d-compat";
import { CAPSULE_GROUPS, type Rapier } from "../physics/world";
import type { Mesher } from "../voxel/pieces";
import foamerData from "../../data/foamers.json";
import { restMotion, rigHeight, solvePose, type RigMotion, type RigSpec } from "./rig";
import {
  restInto, walkMotion, windupMotion, strikeMotion, staggerMotion, crawlMotion, finishMotion,
  scrapeMotion, chargeMotion, wallStunMotion, floatMotion,
  crouchMotion, leapMotion,
} from "./rig-states";
import { FoamerPart } from "./foamer-part";
import { armourOf } from "./armour";
import { floatOf } from "./float";
import { makeShockwave } from "./leap";
import { materialId, linearColorTable } from "../voxel/materials";
import type { ShotDamage } from "./chunk";
import type { DartHit } from "../weapons/darts";
import type { AgentInput, FoamerAgent } from "../ai/agent";

// One test Foamer (ENG-10): a root kinematic body that carries only the
// movement capsule, plus one FoamerPart per part of the rig it was spawned
// from. The feet centre (`centre`) and `yaw` are the real state; every step
// the rig is re-posed from solvePose and each part body is moved to the
// translation and rotation of its part matrix.

export type FoamerState =
  | "idle" | "alert" | "approach" | "hold"
  | "windup" | "strike" | "recover" | "stagger" | "fall" | "crawl" | "down" | "finish"
  // GAME-10b, the charger: the scrape before a charge, the straight run, and
  // the long stagger after it hits a wall (its back open).
  | "telegraph" | "charge" | "wallStun"
  // GAME-10f, the Brawler: the crouch before the leap (the telegraph) and
  // the arc through the air. The landing itself goes to "recover", where
  // the shockwave grows.
  | "crouch" | "leaping";
export type FoamerSpec = typeof foamerData.test;
/** Rigs in the data file carry `health`; the base rig type does not. */
export type GameRig = RigSpec & { health: number };

// Scratch, shared by every Foamer; only written during the system's
// sequential update or render.
const _poses = new Map<string, THREE.Matrix4>();
const _target = restMotion();
const _attack = restMotion(); // a prone attack's own motion, laid over the crawl
const _quat = new THREE.Quaternion();
const _fitV = new THREE.Vector3();
const _pL = new THREE.Vector3();
const _pL2 = new THREE.Vector3();
const _qL = new THREE.Quaternion();
const _qL2 = new THREE.Quaternion();
const _gP = new THREE.Vector3(); // GAME-07: glow position scratch
const _gS = new THREE.Vector3(); // GAME-07: glow scale scratch
const GLOW_GEO = new THREE.SphereGeometry(0.6, 12, 8); // GAME-07: one geometry for every glow
/** The lying capsule's rotation: its own y axis along the rig's +z. */
const LYING_Q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
/** Where the lying capsule's centre sits ahead of the feet (GAME-11). Its
 *  rear cap must clear the legs' own space: a leg that breaks on the step
 *  the fall starts would spawn inside the cap and be shoved instead of
 *  flung. 0.45 m is clear of the feet and of the hips. */
const LYING_Z = 0.45;

export class Foamer {
  readonly spec: FoamerSpec;
  readonly rig: GameRig;
  /** The movement capsule; parts have bodies of their own. */
  readonly root: RAPIER.RigidBody;
  /** The movement capsule: upright, then lying from the fall on (GAME-11). */
  capsule: RAPIER.Collider;
  /** Attached parts, by part id. */
  readonly parts = new Map<string, FoamerPart>();
  /** A render group under the system's group; it draws every part group. */
  readonly group = new THREE.Group();
  /** Feet centre in world space. */
  readonly centre = new THREE.Vector3();
  /** centre and yaw before the last step, for render interpolation. */
  readonly prevCentre = new THREE.Vector3();
  prevYaw = 0;
  yaw = 0;
  health: number;
  readonly maxHealth: number;
  state: FoamerState = "approach";
  /** Seconds spent in the current state. */
  stateTime = 0;
  /** How long a short stagger lasts, seconds: set by startStagger (the
   *  data's stagger.time, or the thrown shield's stun, GAME-04). */
  staggerTime = foamerData.test.stagger.time;
  /** The brain and its token bid (ENG-08 stage 3b). Null when the system has
   *  no director: then the Foamer attacks on approach range as it did before
   *  the director, which is what the older tests and tools expect. */
  agent: FoamerAgent | null = null;
  /** The one input struct its agent reads, filled each step. */
  agentInput: AgentInput | null = null;
  /** It went idle to alert on this step, so neighbours this close go alert
   *  too (alertRadiusMetres). */
  justAlerted = false;
  /** It took a dart hit since the last AI step, so being shot wakes it. */
  damageSinceStep = false;
  /** BUG-07: its ball's flight to the player was clear at its last throw's
   *  start or release. Filled by the system (a shape cast, so not every
   *  step) and read by its brain, which will not start a throw while it is
   *  false. True without a projectile system, the pre-check behaviour. */
  throwClear = true;
  /** BUG-07: seconds until its next flight check while it waits for a clear
   *  one. A shape cast is not a per-step cost, so the check has its own
   *  clock (data/ai.json brain.flightCheckSeconds). */
  throwCheckIn = 0;
  /** BUG-08: seconds it has gone without a clear flight while it holds, so
   *  its brain can walk out of a ring that has no clear spot at all. Reset
   *  to zero the moment a check comes back clear. */
  blockedSeconds = 0;
  /** GAME-10d: seconds since its last nibble landed, Infinity until it has
   *  bitten once. Only a Swarmer's brain reads it (the ring wait after a
   *  nibble); the system restarts it when the windup lands. */
  sinceNibble = Infinity;
  /** Vertical speed (m/s); the system adds gravity and walks it. */
  vy = 0;
  /** Going down (ENG-10 stage 3): the body sits sinkDrop (m) below the
   *  floor; sinkDepth is the drop that takes it to fully below the floor
   *  (computed at the first sink step, from its lying pose); sinkingNow is
   *  the immediate over-cap sink (down.max). */
  sinkDrop = 0;
  sinkDepth = -1;
  sinkingNow = false;
  /** The ragdoll's hinges (ENG-12), cleared when the sink starts. */
  readonly ragdoll: { joint: RAPIER.ImpulseJoint; parent: RAPIER.RigidBody; child: RAPIER.RigidBody; anchorLocal: THREE.Vector3; pivotLocal: THREE.Vector3; kind: string; neutralQ: THREE.Quaternion; neutralAxisWorld: THREE.Vector3 }[] = [];
  /** Body pose at the start of each step for the downed Foamer (render
   *  interpolation), part id as key. */
  readonly ragdollPrev = new Map<string, { t: THREE.Vector3; q: THREE.Quaternion }>();
  /** The rig's height (m): the top corner must sink below the floor by this
   *  much before the body is disposed. */
  height = 0;
  /** Walk phase; the system advances it with distance walked. */
  gait = 0;
  /** The head's box centre in world space, from the last solved pose
   *  (GAME-11: a prone Foamer strikes and reaches from its head, which is
   *  ahead of its feet). */
  readonly headPos = new THREE.Vector3();
  /** The eased motion, one step toward its state's target. */
  readonly motion: RigMotion = restMotion();
  /** Times and amounts of recent damage, for the catastrophic window. */
  readonly recentDamage: { time: number; amount: number }[] = [];
  /** GAME-09b: dart damage tagged with the shot that dealt it, for the
   *  chunk finish's rule and its carve centre. */
  readonly shotDamage: ShotDamage[] = [];
  /** GAME-11: the fall, an inverted pendulum about the foot it still stands
   *  on. a is the tilt in radians from upright, integrated per fixed step
   *  (semi-implicit Euler); -1 means no fall has started. w is the angular
   *  speed. side is the roll sign: the left leg lost rolls the body toward
   *  its own left (-x), which is a positive roll. bounced is set at the
   *  landing; settle counts the seconds it then lies at rest. */
  fallA = -1;
  fallW = 0;
  fallSide = 1;
  fallBounced = false;
  fallSettle = 0;
  /** GAME-11: it is on the ground from the fall on, so its attacks and its
   *  crawl are posed prone. */
  prone = false;
  /** GAME-10b: the charge line locked at the end of the telegraph (unit,
   *  ground plane), and the metres still to run. Written by the system
   *  when the telegraph ends. */
  chargeDirX = 0;
  chargeDirZ = 1;
  chargeLeft = 0;
  /** GAME-10b: it has already hit the player on this charge, so one run
   *  hits once. */
  chargeHit = false;
  /** GAME-10f: seconds until it may leap again, counted down every step
   *  (the cooldown runs from the start of the crouch). */
  leapCooldown = 0;
  /** GAME-10f: the leap line locked at the end of the crouch (unit, ground
   *  plane), the metres along it to the landing point, and the flight's
   *  length and initial vertical speed, from leapFlight. */
  leapDirX = 0;
  leapDirZ = 1;
  leapLeft = 0;
  leapSeconds = 0;
  leapVy = 0;
  /** GAME-10f: the shockwave this Brawler last landed (leap.ts). One ring
   *  at a time, reused per leap. */
  readonly wave = makeShockwave();
  /** GAME-10f: the ring's mesh: one torus lying flat on the floor (a
   *  closed, capped solid), rebuilt when a wave starts (once per leap),
   *  parked invisible when there is no ring. Owned by the FoamerSystem's
   *  group, like the glow group. */
  readonly waveMesh = new THREE.Mesh(
    new THREE.TorusGeometry(1, 0.1, 8, 48).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({
      color: new THREE.Color().fromArray(linearColorTable(), materialId("foam-lime") * 3),
      roughness: 0.6, transparent: true, opacity: 0.85, depthWrite: false,
    }),
  );
  /** The body's centre height over the ground at rest: the pendulum's pivot
   *  length, filled once at spawn (GAME-11). */
  pivotHeight = 0;
  /** GAME-07: health has fallen to the finisher's weakenShare, once. While
   *  finishWeakened the Foamer glows and wobbles while it staggers, and a
   *  melee inside the finisher's reach ends it with the finisher. */
  finishWeakened = false;
  /** GAME-09b: the dart that brought it to 0 health, while the rest of its
   *  shot may still land. It is dying: it does not walk, attack or stagger,
   *  and its parts keep their colliders so the shot's other darts hit it.
   *  The kill resolves once, on the next update or on another shot's hit. */
  dyingHit: DartHit | null = null;
  /** The system step the held kill happened on. */
  dyingStep = 0;
  /** GAME-07: true while the current stagger is the long, finishable one
   *  (weakenShare) rather than the short part-break one. Cleared each
   *  time a stagger starts. Exposed for the HUD prompt. */
  staggerLong = false;
  /** GAME-07: the finishable glow shell: an additive soft shell over the
   *  body. A child of the glowGroup (the part groups are world matrices,
   *  so it cannot live under `this.group`). One shared geometry; the
   *  scale is set per syncRender. */
  readonly glow = new THREE.Mesh(GLOW_GEO, new THREE.MeshBasicMaterial({
    color: 0xb6ff3b, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending,
  }));

  private poseBlend: number;
  /** The upright capsule's radius, kept for the lying capsule (GAME-11). */
  private readonly capsuleR: number;
  private readonly rapier: Rapier;
  /** The attack chosen for the current windup/strike cycle, or null. */
  private attackId: string | null = null;
  /** GAME-10c: attacks this Floater has fired (the big blob's every-Nth
   *  counter). Turns at the release, where the attack really happens. */
  blobTurn = 0;
  attack() {
    return this.attackId ? this.spec.attacks.find((a) => a.id === this.attackId) ?? null : null;
  }
  /** Choose the attack for a windup: the first whose needs are met. */
  setAttack(id: string | null) {
    this.attackId = id;
  }
  /** Record damage at time t (system clock) for the catastrophic window. */
  addDamage(time: number, amount: number) {
    this.recentDamage.push({ time, amount });
  }
  private system?: { onBonk: (f: Foamer, attack: string) => void; stats: { bonks: number } };
  /** Attach the system that owns this Foamer (set after construction). */
  setSystem(s: { onBonk: (f: Foamer, attack: string) => void; stats: { bonks: number } }): void {
    this.system = s;
  }

  /** Crawl speed in m/s (GAME-11): rig.speed * handicaps.crawlSpeed. */
  crawlSpeed() {
    return this.rig.speed * this.spec.handicaps.crawlSpeed;
  }

  /** Ground speed in m/s, with leg handicaps (some legs: 0.5, none: 0.25). */
  speed() {
    const legs = this.legs();
    if (legs.length === 0) return this.rig.speed * this.spec.handicaps.noLegsSpeed;
    if (legs.length < this.startLegs().length) return this.rig.speed * this.spec.handicaps.someLegsSpeed;
    return this.rig.speed;
  }

  /** Turn rate in rad/s, with the no-head handicap. */
  turnRate() {
    return this.hasHead() ? this.spec.turnRate : this.spec.turnRate * this.spec.handicaps.noHeadTurnRate;
  }

  constructor(
    rapier: Rapier,
    world: RAPIER.World,
    mesher: Mesher,
    spec: FoamerSpec,
    rig: GameRig,
    feet: THREE.Vector3,
  ) {
    this.spec = spec;
    this.rig = rig;
    this.centre.copy(feet);
    this.prevCentre.copy(feet);
    this.maxHealth = rig.health;
    this.health = rig.health;
    this.height = rigHeight(rig);
    this.poseBlend = spec.poseBlend;

    const body = rig.parts.find((p) => p.parent === null)!;
    const vs = rig.voxelSize;
    this.rapier = rapier;
    // The fall's pivot (GAME-11): the body's box centre over the ground at
    // rest, which is the length of the inverted pendulum. solvePose already
    // puts the feet on the ground, so the centre's own y is the height.
    {
      const rest = solvePose(rig, new THREE.Vector3(), 0, restMotion(), new Map());
      const c = new THREE.Vector3(
        (body.size[0] * vs) / 2, (body.size[1] * vs) / 2, (body.size[2] * vs) / 2,
      ).applyMatrix4(rest.get(body.id)!);
      this.pivotHeight = Math.max(0.1, c.y);
    }
    // Movement capsule: radius capsuleShare times half the NARROWER of the
    // body part's x and z size (it must sit inside the body's voxels, so
    // darts hit the parts, not the capsule), height the rig's height, on
    // the body centre line (the body voxel is centred on the root's origin).
    const radius = spec.capsuleShare * (Math.min(body.size[0], body.size[2]) * vs) / 2;
    this.capsuleR = radius;
    const height = rigHeight(rig);
    this.root = world.createRigidBody(rapier.RigidBodyDesc.kinematicPositionBased());
    this.capsule = world.createCollider(
      rapier.ColliderDesc.capsule(height / 2 - radius, radius)
        .setTranslation(0, height / 2, 0)
        .setCollisionGroups(CAPSULE_GROUPS),
      this.root,
    );

    // One part per rig part. A part's health is a share of the Foamer's,
    // at least minHp; the body's share is 0.
    for (const p of rig.parts) {
      const kind = spec.partDamage.kinds[p.kind];
      const hp = Math.max(spec.partDamage.minHp, Math.round(rig.health * kind.hpShare));
      const part = new FoamerPart(rapier, world, mesher, p, vs, rig.material, hp);
      const armour = armourOf(spec, p.id);
      if (armour) part.carveScale = armour.carve;
      this.parts.set(p.id, part);
      this.group.add(part.group);
    }

    // Place the root and every part body for spawn (no world.step has
    // run yet, so set them in place).
    _quat.set(0, Math.sin(this.yaw / 2), 0, Math.cos(this.yaw / 2));
    this.root.setTranslation(this.centre, true);
    this.root.setRotation({ x: _quat.x, y: _quat.y, z: _quat.z, w: _quat.w }, true);
    solvePose(rig, this.centre, this.yaw, this.motion, _poses);
    for (const [id, part] of this.parts) part.setInPlace(_poses.get(id)!);
  }

  /** GAME-11: swap the upright capsule for the lying one a prone body needs.
   *  Its axis lies along the Foamer's forward, the radius is the upright
   *  one, the length is the rig's height times crawlLength, and it rests on
   *  the ground (bottom at the root's origin, the feet). So the character
   *  controller moves the prone shape from the fall on. */
  setCapsuleLying(world: RAPIER.World) {
    world.removeCollider(this.capsule, false);
    const r = this.capsuleR;
    const len = this.height * this.spec.handicaps.crawlLength;
    this.capsule = world.createCollider(
      this.rapier.ColliderDesc.capsule(Math.max(0.01, len / 2 - r), r)
        .setTranslation(0, r, LYING_Z)
        .setRotation(LYING_Q)
        .setCollisionGroups(CAPSULE_GROUPS),
      this.root,
    );
  }

  /** GAME-11: one step of the fall's pendulum. Returns true once it has
   *  settled at prone and the Foamer may crawl. */
  stepFall(dt: number, gravity: number): boolean {
    const h = this.spec.handicaps.fall;
    if (this.fallA < 0) {
      this.fallA = h.startTilt;
      this.fallW = 0;
      return false;
    }
    // Semi-implicit Euler on a'' = (gravity / pivotHeight) sin(a): the tip
    // speeds up as it goes over, so the fall is not a linear ease.
    this.fallW += (gravity / this.pivotHeight) * Math.sin(this.fallA) * dt;
    this.fallA += this.fallW * dt;
    if (this.fallA < h.proneTilt) return false;
    this.fallA = h.proneTilt;
    if (!this.fallBounced) {
      // The landing: the angular speed reverses at fall.bounce of itself,
      // once, so it rocks back a little and gravity brings it down again.
      this.fallBounced = true;
      this.fallW = -h.bounce * this.fallW;
      return false;
    }
    // Down again: the floor holds it, and it lies still for settle seconds.
    this.fallW = 0;
    this.fallSettle += dt;
    return this.fallSettle >= h.settle;
  }

  /** True while the part with this id is still attached. */
  has(id: string) {
    return this.parts.has(id);
  }

  /** Attached legs (kind leg whose parent is the root part), by id. */
  legs(): string[] {
    const bodyId = this.rig.parts.find((p) => p.parent === null)!.id;
    return this.rig.parts
      .filter((p) => p.kind === "leg" && p.parent === bodyId && this.parts.has(p.id))
      .map((p) => p.id);
  }

  /** Legs before any could break, by id. */
  startLegs(): string[] {
    const bodyId = this.rig.parts.find((p) => p.parent === null)!.id;
    return this.rig.parts
      .filter((p) => p.kind === "leg" && p.parent === bodyId)
      .map((p) => p.id);
  }

  hasHead() {
    return this.has("head");
  }

  /** Report a bonk that connects, and count it. */
  bonk(attack: string) {
    this.system?.onBonk(this, attack);
    if (this.system) this.system.stats.bonks++;
  }

  /** One full step of the root body, in place: the feet centre, turned by
   *  yaw. */
  applyPose() {
    _quat.set(0, Math.sin(this.yaw / 2), 0, Math.cos(this.yaw / 2));
    this.root.setNextKinematicTranslation(this.centre);
    this.root.setNextKinematicRotation(_quat);
  }

  /** Once per step, after movement: build the target motion for the state,
   *  ease the motion toward it, solve the pose and re-pose every attached
   *  part. moving: whether it walked this step. flying (GAME-10c): a
   *  Floater with a fin left, which bobs instead of walking and must not
   *  be pulled to the floor. */
  poseParts(dt: number, moving: boolean, flying = false) {
    const t = _target;
    if (this.state === "telegraph") scrapeMotion(this.rig, this.stateTime / (this.spec as { charge?: { telegraphSeconds: number } }).charge!.telegraphSeconds, t);
    else if (this.state === "charge") chargeMotion(this.rig, this.gait * 2, t);
    else if (this.state === "wallStun") wallStunMotion(this.rig, this.stateTime, (this.spec as { charge?: { wallStunSeconds: number } }).charge!.wallStunSeconds, t);
    // GAME-10f: the fold before the leap, and the pose in the air.
    else if (this.state === "crouch") crouchMotion(this.rig, this.stateTime / (this.spec as { leap?: { crouchSeconds: number } }).leap!.crouchSeconds, t);
    else if (this.state === "leaping") leapMotion(this.rig, this.stateTime / Math.max(0.001, this.leapSeconds), t);
    else if (this.state === "windup" && this.attack()) windupMotion(this.rig, this.attack()!.id, this.stateTime / this.attack()!.windup, t);
    else if (this.state === "strike" && this.attack()) strikeMotion(this.rig, this.attack()!.id, this.stateTime / this.attack()!.strike, t);
    else if (this.state === "stagger") staggerMotion(this.stateTime, this.staggerDuration(), t);
    else if (this.state === "finish") finishMotion(this.stateTime / this.spec.finisher.total, t);
    else if (this.state === "down") restInto(t); // ENG-12: physics carries it now
    else if (this.state === "fall") this.proneMotion(t, this.fallTilt());
    else if (this.prone) {
      // On the ground: the crawl's base pose, with the attack's own swing
      // laid over it (a prone Foamer attacks from where it lies, it does
      // not stand up to do it).
      this.proneMotion(t, this.spec.handicaps.fall.proneTilt);
      if (this.state === "crawl") crawlMotion(this.rig, this.gait, t);
      const atk = this.attack();
      if ((this.state === "windup" || this.state === "strike") && atk) {
        const u = _attack;
        if (this.state === "windup") windupMotion(this.rig, atk.id, this.stateTime / atk.windup, u);
        else strikeMotion(this.rig, atk.id, this.stateTime / atk.strike, u);
        for (const [id, r] of u.rot) t.rot.set(id, r);
      }
    }
    else if (flying) floatMotion(this.rig, this.stateTime, this.gait, t,
      floatOf(this.spec)?.bobMetres ?? 0.12);
    else if (this.state === "approach" && moving) walkMotion(this.rig, this.gait, 1, t);
    else restInto(t);
    const k = 1 - Math.exp(-dt / this.poseBlend);
    const m = this.motion;
    m.y += (t.y - m.y) * k;
    m.pitch += (t.pitch - m.pitch) * k;
    m.roll += (t.roll - m.roll) * k;
    m.turn = (m.turn ?? 0) + ((t.turn ?? 0) - (m.turn ?? 0)) * k;
    m.squash += (t.squash - m.squash) * k;
    for (const [id, r] of t.rot) {
      const cur = m.rot.get(id) ?? [0, 0, 0];
      m.rot.set(id, [
        cur[0] + (r[0] - cur[0]) * k,
        cur[1] + (r[1] - cur[1]) * k,
        cur[2] + (r[2] - cur[2]) * k,
      ]);
    }
    for (const id of [...m.rot.keys()]) if (!t.rot.has(id)) m.rot.delete(id);
    solvePose(this.rig, this.centre, this.yaw, m, _poses);
    // All legs gone (or a Floater on the floor with none left), down, or on
    // the ground in a fall or crawl: the attached parts' lowest corner (box
    // corners move with the roll) must sit on the floor (a downed body
    // shifted down by its sinkDrop): bring the whole rig to the ground. A
    // Floater that is flying is held at its hover by the system instead.
    if ((this.legs().length === 0 && !flying) || this.state === "down" || this.prone) {
      let low = Infinity;
      for (const [pid, pm] of _poses) {
        if (!this.parts.has(pid)) continue;
        const ps = this.rig.parts.find((p) => p.id === pid)!;
        for (const cx of [0, 1]) for (const cy of [0, 1]) for (const cz of [0, 1]) {
          _fitV.set(cx * ps.size[0], cy * ps.size[1], cz * ps.size[2])
            .multiplyScalar(this.rig.voxelSize).applyMatrix4(pm);
          low = Math.min(low, _fitV.y);
        }
      }
      this.centre.y -= low + (this.state === "down" ? this.sinkDrop : 0); // a gap posts: get lower; buried: get higher
      solvePose(this.rig, this.centre, this.yaw, m, _poses);
    }
    for (const [id, part] of this.parts) part.setPose(_poses.get(id)!);
    // The head's box centre, for the reach of a prone attack (GAME-11).
    const headM = _poses.get("head");
    if (headM && this.parts.has("head")) {
      const hs = this.rig.parts.find((p) => p.id === "head")!.size;
      this.headPos.set(hs[0] / 2, hs[1] / 2, hs[2] / 2)
        .multiplyScalar(this.rig.voxelSize).applyMatrix4(headM);
    } else {
      this.headPos.copy(this.centre).setY(this.centre.y + this.height * 0.7);
    }
  }

  /** The tilt the fall has reached, radians from upright (0 before it
   *  starts). */
  fallTilt() {
    return this.fallA < 0 ? 0 : this.fallA;
  }

  /** GAME-07: the current stagger's whole length, seconds. The long,
   *  finishable one lingers so a finisher can be aimed; a part break's
   *  stagger stays the short one. */
  staggerDuration() {
    return this.staggerLong ? this.spec.finisher.weakenStaggerTime : this.staggerTime;
  }

  /** GAME-07: it glows and wobbles while it staggers and is finishable.
   *  True during a long stagger and through the finisher itself. */
  get glowActive() {
    return this.finishWeakened && (this.state === "stagger" || this.state === "finish");
  }

  /** Target motion for a fall at tilt a, and for the crawl at prone
   *  (GAME-11). sideShare of the tilt is roll toward the lost leg and the
   *  rest is forward pitch, so the body goes down mostly forward and a
   *  little to the side of the leg it lost. The arms swing forward to meet
   *  the ground as it lands. y is not set here: poseParts fits the body to
   *  the floor, which is right whether it is tipping or prone. */
  private proneMotion(t: RigMotion, a: number) {
    restInto(t);
    const h = this.spec.handicaps.fall;
    t.pitch = a * (1 - h.sideShare);
    t.roll = a * h.sideShare * this.fallSide;
    // The arms reach the ground: the reach scales in as it rolls over, so
    // the joints never jump at the start of the fall.
    const reach = h.proneTilt > h.startTilt
      ? Math.min(1, Math.max(0, (a - h.startTilt) / (h.proneTilt - h.startTilt)))
      : 1;
    const arm = -1.4 * reach;
    const fore = -0.6 * reach;
    for (const id of ["armL", "armR"])
      if (this.parts.has(id)) t.rot.set(id, [arm, 0, 0]);
    for (const id of ["foreArmL", "foreArmR"])
      if (this.parts.has(id)) t.rot.set(id, [fore, 0, 0]);
  }

  /** Render frame. Approach, attacks and staggers: every part draws
   *  alpha of the way from its prev pose to its current one. Downed
   *  (ENG-12): the parts ride their ragdoll bodies, the body pose alpha
   *  of the way from the step's start to where physics left it. */
  syncRender(alpha: number) {
    // GAME-07: a downed one never glows; its finishable window is over.
    if (this.state === "down") {
      this.glowGroup.visible = false;
      for (const p of this.parts.values()) {
        const prev = this.ragdollPrev.get(p.spec.id);
        if (!prev) { p.syncRender(alpha); continue; }
        const b = p.body;
        const t = b.translation();
        const r = b.rotation();
        _pL.lerpVectors(prev.t, _pL2.set(t.x, t.y, t.z), alpha);
        _qL.slerpQuaternions(prev.q, _qL2.set(r.x, r.y, r.z, r.w), alpha);
        p.drawFrom(_pL, _qL);
      }
      return;
    }
    for (const p of this.parts.values()) p.syncRender(alpha);
    this.syncGlow(alpha);
  }

  /** GAME-07: the finishable glow: a soft shell over the body, pulsing
   *  and wobbling while the Foamer is finishable and staggering, steady
   *  while the finisher runs. The foam material is one shared material
   *  across every voxel mesh, so it cannot be pulsed per Foamer; this is
   *  a child of the glowGroup, which FoamerSystem parks off-screen when
   *  the glow is off. */
  syncGlow(alpha: number) {
    const on = this.glowActive;
    this.glowGroup.visible = on;
    if (!on) {
      (this.glow.material as THREE.MeshBasicMaterial).opacity = 0;
      return;
    }
    const body = this.parts.get("body");
    if (body) {
      const vs = this.rig.voxelSize;
      const wob = 1 + (this.state === "stagger" ? Math.sin(this.stateTime * 22) * 0.03 : 0);
      _gS.set(
        body.spec.size[0] * vs / 1.2 * wob,
        body.spec.size[1] * vs / 1.2,
        body.spec.size[2] * vs / 1.2 * wob,
      );
      this.glowGroup.scale.copy(_gS);
    } else {
      _gS.set(this.height * 0.3, this.height * 0.4, this.height * 0.3);
      this.glowGroup.scale.copy(_gS);
    }
    _gP.lerpVectors(this.prevCentre, this.centre, alpha);
    this.glowGroup.position.set(_gP.x, _gP.y + this.pivotHeight, _gP.z);
    if (this.state === "down") this.glowGroup.position.y -= this.sinkDrop;
    const ramp = this.state === "finish" ? 1
      : THREE.MathUtils.clamp(Math.min(this.stateTime / 0.15, (this.staggerDuration() - this.stateTime) / 0.4), 0, 1);
    (this.glow.material as THREE.MeshBasicMaterial).opacity = ramp * (0.22 + 0.08 * Math.sin(this.stateTime * 6));
  }

  /** GAME-07: the glow's draw group, a world-space matrix placed by
   *  syncRender (the part groups are world matrices, so the glow cannot live
   *  under `this.group`; the system adds it to its own group at spawn). */
  readonly glowGroup = new THREE.Group();

  /** Remove the parts, the root capsule and the bodies. */
  dispose(world: RAPIER.World) {
    for (const p of this.parts.values()) p.dispose(world);
    this.group.removeFromParent();
    this.glowGroup.removeFromParent();
    this.waveMesh.removeFromParent();
    world.removeRigidBody(this.root);
  }
}
