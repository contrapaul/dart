import * as THREE from "three";
import type RAPIER from "@dimforge/rapier3d-compat";
import type { Rapier } from "../physics/world";
import { VoxelVolume } from "../voxel/chunk";
import { VolumeMesh } from "../voxel/volume-mesh";
import type { Mesher } from "../voxel/pieces";
import type { VoxelTarget } from "../weapons/impacts";
import { buildPartVolume, type PartSpec } from "./rig";

// One rig part of a game Foamer (ENG-10): its own voxel volume, its own
// kinematic body and a VolumeMesh on that body. solvePose runs on the
// Foamer's root; this part only holds the result, poses its body from it,
// and draws the part between its last two steps.

const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _sPrev = new THREE.Vector3();
const _sNow = new THREE.Vector3();
const _qPrev = new THREE.Quaternion();
const _qNow = new THREE.Quaternion();
const _pPrev = new THREE.Vector3();
const _pNow = new THREE.Vector3();

export class FoamerPart implements VoxelTarget {
  readonly spec: PartSpec;
  readonly volume: VoxelVolume;
  /** Its own kinematic body. Its origin is the volume's (0,0,0) corner,
   *  as the Foamer's root body is, so the mesh's colliders (built in the
   *  body's frame) line up with the voxels. */
  readonly body: RAPIER.RigidBody;
  readonly mesh: VolumeMesh;
  /** The part's drawn group: the part's matrix, scaled to metres. */
  readonly group: THREE.Group;
  hp: number;
  readonly maxHp: number;
  readonly startVoxels: number;
  /** World matrix of the volume's (0,0,0) corner in metres, this step and
   *  the one before (render interpolation). */
  readonly pose: THREE.Matrix4 = new THREE.Matrix4();
  readonly prevPose: THREE.Matrix4 = new THREE.Matrix4();

  constructor(
    rapier: Rapier,
    world: RAPIER.World,
    mesher: Mesher,
    spec: PartSpec,
    voxelSize: number,
    rigMaterial: string,
    hp: number,
  ) {
    this.spec = spec;
    this.volume = new VoxelVolume(voxelSize);
    buildPartVolume(this.volume, spec, rigMaterial);
    this.startVoxels = this.voxelCount;
    this.maxHp = hp;
    this.hp = hp;

    this.body = world.createRigidBody(rapier.RigidBodyDesc.kinematicPositionBased());
    this.mesh = new VolumeMesh(this.volume, mesher, rapier, world, new THREE.Vector3(), this.body);
    this.group = new THREE.Group();
    this.group.matrixAutoUpdate = false;
    this.group.add(this.mesh.group);
  }

  owns(collider: RAPIER.Collider) {
    return collider.parent()?.handle === this.body.handle;
  }

  /** World position to voxel coordinates (in place), through the body's
   *  current translation and rotation. */
  worldToVoxel(v: THREE.Vector3) {
    const t = this.body.translation();
    const r = this.body.rotation();
    _q.set(r.x, r.y, r.z, r.w).invert();
    return v
      .set(v.x - t.x, v.y - t.y, v.z - t.z)
      .applyQuaternion(_q)
      .divideScalar(this.volume.voxelSize);
  }

  /** Voxel coordinates to world position (in place), through the body's
   *  current translation and rotation. */
  voxelToWorld(v: THREE.Vector3) {
    const t = this.body.translation();
    const r = this.body.rotation();
    _q.set(r.x, r.y, r.z, r.w);
    return v.multiplyScalar(this.volume.voxelSize).applyQuaternion(_q).add(t);
  }

  /** Set this step's pose from solvePose's matrix (keep the old one as
   *  prev) and move the body with setNextKinematicTranslation/Rotation. */
  setPose(m: THREE.Matrix4) {
    this.prevPose.copy(this.pose);
    this.pose.copy(m);
    this.setBodyToPose(m);
  }

  /** As setPose, but set the body in place (no world.step has run yet). */
  setInPlace(m: THREE.Matrix4) {
    this.prevPose.copy(this.pose);
    this.pose.copy(m);
    this.setBodyToPose(m, true);
  }

  /** Move the body to the translation and rotation of m, decomposed (not
   *  the squash scale, a draw-only effect on the group). */
  private setBodyToPose(m: THREE.Matrix4, inPlace = false) {
    m.decompose(_p, _q, _s);
    if (inPlace) {
      this.body.setTranslation({ x: _p.x, y: _p.y, z: _p.z }, true);
      this.body.setRotation({ x: _q.x, y: _q.y, z: _q.z, w: _q.w }, true);
    } else {
      this.body.setNextKinematicTranslation({ x: _p.x, y: _p.y, z: _p.z });
      this.body.setNextKinematicRotation({ x: _q.x, y: _q.y, z: _q.z, w: _q.w });
    }
  }

  /** Draw the part alpha (0 to 1) of the way from its prev pose to its
   *  current one: decompose both, lerp/slerp, compose. */
  syncRender(alpha: number) {
    this.prevPose.decompose(_pPrev, _qPrev, _sPrev);
    this.pose.decompose(_pNow, _qNow, _sNow);
    _p.lerpVectors(_pPrev, _pNow, alpha);
    _q.slerpQuaternions(_qPrev, _qNow, alpha);
    _s.lerpVectors(_sPrev, _sNow, alpha);
    this.group.matrix.compose(_p, _q, _s);
  }

  get voxelCount(): number {
    let n = 0;
    for (const c of this.volume.chunks.values()) n += c.count;
    return n;
  }

  /** Remove the mesh and its colliders and the body. */
  dispose(world: RAPIER.World) {
    this.mesh.dispose();
    this.group.removeFromParent();
    world.removeRigidBody(this.body);
  }
}
