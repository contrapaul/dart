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

export type FoamerState = "approach" | "windup" | "strike" | "recover" | "stagger" | "down";
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

export class Foamer {
  readonly spec: FoamerSpec;
  readonly rig: GameRig;
  /** The movement capsule; parts have bodies of their own. */
  readonly root: RAPIER.RigidBody;
  readonly capsule: RAPIER.Collider;
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

  private poseBlend: number;
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
    // Movement capsule: radius capsuleShare times half the NARROWER of the
    // body part's x and z size (it must sit inside the body's voxels, so
    // darts hit the parts, not the capsule), height the rig's height, on
    // the body centre line (the body voxel is centred on the root's origin).
    const radius = spec.capsuleShare * (Math.min(body.size[0], body.size[2]) * vs) / 2;
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
    else if (this.state === "approach" && moving) walkMotion(this.rig, this.gait, 1, t);
    else restInto(t);
    // Missing legs: roll the body 0.15 rad toward each missing side.
    const start = this.startLegs();
    for (const id of start) if (!this.parts.has(id)) t.roll += id.endsWith("L") ? -0.15 : 0.15;
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
    // All legs gone, or down: the attached parts' lowest corner (box
    // corners move with the roll) must sit on the floor (a downed body
    // shifted down by its sinkDrop): bring the whole rig to the ground.
    if (this.legs().length === 0 || this.state === "down") {
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
