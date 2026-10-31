import * as THREE from "three";
import type RAPIER from "@dimforge/rapier3d-compat";
import type { Rapier } from "../physics/world";
import type { Mesher } from "../voxel/pieces";
import foamerData from "../../data/foamers.json";
import { restMotion, rigHeight, solvePose, type RigMotion, type RigSpec } from "./rig";
import { restInto, walkMotion } from "./rig-states";
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

export class Foamer {
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
  /** Walk phase; the system advances it with distance walked. */
  gait = 0;
  /** The eased motion, one step toward its state's target. */
  readonly motion: RigMotion = restMotion();
  /** Times and amounts of recent damage, for the catastrophic window. */
  readonly recentDamage: { time: number; amount: number }[] = [];

  private poseBlend: number;
  private system?: { onBonk: (f: Foamer) => void; stats: { bonks: number } };
  /** Attach the system that owns this Foamer (set after construction). */
  setSystem(s: { onBonk: (f: Foamer) => void; stats: { bonks: number } }): void {
    this.system = s;
  }

  /** Ground speed in m/s. Leg handicaps apply from stage 2. */
  speed() {
    return this.rig.speed;
  }

  constructor(
    rapier: Rapier,
    world: RAPIER.World,
    mesher: Mesher,
    spec: FoamerSpec,
    rig: GameRig,
    feet: THREE.Vector3,
  ) {
    this.rig = rig;
    this.centre.copy(feet);
    this.prevCentre.copy(feet);
    this.maxHealth = rig.health;
    this.health = rig.health;
    this.poseBlend = spec.poseBlend;

    const body = rig.parts.find((p) => p.parent === null)!;
    const vs = rig.voxelSize;
    // Movement capsule: radius half the wider of the body part's x and z
    // size, height the rig's height at rest, around the body centre line
    // (the body voxel is centred on the root's origin).
    const radius = (Math.max(body.size[0], body.size[2]) * vs) / 2;
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
  bonk() {
    this.system?.onBonk(this);
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
    if (this.state === "approach" && moving) walkMotion(this.rig, this.gait, 1, t);
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
    for (const [id, part] of this.parts) part.setPose(_poses.get(id)!);
  }

  /** Render frame: every part draws alpha of the way from its prev pose to
   *  its current one. */
  syncRender(alpha: number) {
    for (const p of this.parts.values()) p.syncRender(alpha);
  }

  /** Remove the parts, the root capsule and the bodies. */
  dispose(world: RAPIER.World) {
    for (const p of this.parts.values()) p.dispose(world);
    this.group.removeFromParent();
    world.removeRigidBody(this.root);
  }
}
