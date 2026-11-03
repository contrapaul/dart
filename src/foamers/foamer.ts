import * as THREE from "three";
import type RAPIER from "@dimforge/rapier3d-compat";
import type { Rapier } from "../physics/world";
import type { Mesher } from "../voxel/pieces";
import foamerData from "../../data/foamers.json";
import { restMotion, rigHeight, solvePose, type RigMotion, type RigSpec } from "./rig";
import { restInto, walkMotion, windupMotion, strikeMotion, staggerMotion } from "./rig-states";
import { FoamerPart } from "./foamer-part";

// One test Foamer (ENG-10): a root kinematic body that carries only the
// movement capsule, plus one FoamerPart per part of the rig it was spawned
// from. The feet centre (`centre`) and `yaw` are the real state; every step
// the rig is re-posed from solvePose and each part body is moved to the
// translation and rotation of its part matrix.

export type FoamerState = "approach" | "windup" | "strike" | "recover" | "stagger" | "fall" | "crawl" | "down";
export type FoamerSpec = typeof foamerData.test;
/** Rigs in the data file carry `health`; the base rig type does not. */
export type GameRig = RigSpec & { health: number };

// Scratch, shared by every Foamer; only written during the system's
// sequential update or render.
const _poses = new Map<string, THREE.Matrix4>();
const _target = restMotion();
const _quat = new THREE.Quaternion();
const _fitV = new THREE.Vector3();
const _pL = new THREE.Vector3();
const _pL2 = new THREE.Vector3();
const _qL = new THREE.Quaternion();
const _qL2 = new THREE.Quaternion();
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
  /** The eased motion, one step toward its state's target. */
  readonly motion: RigMotion = restMotion();
  /** Times and amounts of recent damage, for the catastrophic window. */
  readonly recentDamage: { time: number; amount: number }[] = [];
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
  /** The body's centre height over the ground at rest: the pendulum's pivot
   *  length, filled once at spawn (GAME-11). */
  pivotHeight = 0;

  private poseBlend: number;
  /** The upright capsule's radius, kept for the lying capsule (GAME-11). */
  private readonly capsuleR: number;
  private readonly rapier: Rapier;
  /** The attack chosen for the current windup/strike cycle, or null. */
  private attackId: string | null = null;
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
        .setTranslation(0, height / 2, 0),
      this.root,
    );

    // One part per rig part. A part's health is a share of the Foamer's,
    // at least minHp; the body's share is 0.
    for (const p of rig.parts) {
      const kind = spec.partDamage.kinds[p.kind];
      const hp = Math.max(spec.partDamage.minHp, Math.round(rig.health * kind.hpShare));
      const part = new FoamerPart(rapier, world, mesher, p, vs, rig.material, hp);
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
        .setRotation(LYING_Q),
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
   *  part. moving: whether it walked this step. */
  poseParts(dt: number, moving: boolean) {
    const t = _target;
    if (this.state === "windup" && this.attack()) windupMotion(this.rig, this.attack()!.id, this.stateTime / this.attack()!.windup, t);
    else if (this.state === "strike" && this.attack()) strikeMotion(this.rig, this.attack()!.id, this.stateTime / this.attack()!.strike, t);
    else if (this.state === "stagger") staggerMotion(this.stateTime, t);
    else if (this.state === "down") restInto(t); // ENG-12: physics carries it now
    else if (this.state === "fall" || this.state === "crawl") this.proneMotion(t, this.state === "fall" ? this.fallTilt() : this.spec.handicaps.fall.proneTilt);
    else if (this.state === "approach" && moving) walkMotion(this.rig, this.gait, 1, t);
    else restInto(t);
    const k = 1 - Math.exp(-dt / this.poseBlend);
    const m = this.motion;
    m.y += (t.y - m.y) * k;
    m.pitch += (t.pitch - m.pitch) * k;
    m.roll += (t.roll - m.roll) * k;
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
    // All legs gone, down, or on the ground in a fall or crawl: the
    // attached parts' lowest corner (box corners move with the roll) must
    // sit on the floor (a downed body shifted down by its sinkDrop): bring
    // the whole rig to the ground.
    if (this.legs().length === 0 || this.state === "down" ||
        this.state === "fall" || this.state === "crawl") {
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
  }

  /** The tilt the fall has reached, radians from upright (0 before it
   *  starts). */
  fallTilt() {
    return this.fallA < 0 ? 0 : this.fallA;
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
    if (this.state === "down") {
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
  }

  /** Remove the parts, the root capsule and the bodies. */
  dispose(world: RAPIER.World) {
    for (const p of this.parts.values()) p.dispose(world);
    this.group.removeFromParent();
    world.removeRigidBody(this.root);
  }
}
