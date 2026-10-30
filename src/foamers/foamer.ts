import * as THREE from "three";
import type RAPIER from "@dimforge/rapier3d-compat";
import type { Rapier } from "../physics/world";
import { VoxelVolume } from "../voxel/chunk";
import { VolumeMesh } from "../voxel/volume-mesh";
import type { Mesher } from "../voxel/pieces";
import type { VoxelTarget } from "../weapons/impacts";
import foamerData from "../../data/foamers.json";
import { buildTestFoamer } from "./foamer-model";

// One test Foamer: a voxel blob on a kinematic body. The feet centre
// (`centre`) and `yaw` are the real state, turning about the centre, not
// the voxel corner. The body's origin is the voxel (0,0,0) corner, so the
// mesh's colliders (built in the body's frame) line up with the voxels.

export type FoamerState = "approach" | "windup" | "recover";
export type FoamerSpec = typeof foamerData.test;

// Scratch, shared by every Foamer; only written during the system's
// sequential update or render.
const _q = new THREE.Quaternion();

/** The body's corner offset in world space: the negative half box turned
 *  by yaw about the +y axis, into out (out is also where the yaw
 *  quaternion lands, so callers of syncRender and friends can use _q). */
function cornerOffset(hx: number, hz: number, yaw: number, out: THREE.Vector3) {
  _q.set(0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2));
  return out.set(-hx, 0, -hz).applyQuaternion(_q);
}

export class Foamer implements VoxelTarget {
  readonly volume: VoxelVolume;
  readonly body: RAPIER.RigidBody;
  /** The movement capsule (also on `body`). */
  readonly capsule: RAPIER.Collider;
  readonly mesh: VolumeMesh;
  /** Feet centre in world space. */
  readonly centre = new THREE.Vector3();
  /** A render group under the system's group; it draws the mesh and the
   *  windup squash. The body's own colliders are never squashed. */
  readonly group = new THREE.Group();
  yaw = 0;
  health: number;
  state: FoamerState = "approach";
  /** Seconds spent in the current state. */
  stateTime = 0;
  /** Vertical speed (m/s); the system adds gravity and walks it. */
  vy = 0;
  /** y scale for the windup squash; 1 is unsquashed. */
  squashY = 1;
  private hx: number;
  private hz: number;
  private halfH: number;

  constructor(rapier: Rapier, world: RAPIER.World, mesher: Mesher, spec: FoamerSpec, feet: THREE.Vector3) {
    this.centre.copy(feet);
    this.health = spec.health;
    this.hx = (spec.size[0] * spec.voxelSize) / 2;
    this.hz = (spec.size[2] * spec.voxelSize) / 2;
    this.halfH = (spec.size[1] * spec.voxelSize) / 2;

    this.volume = new VoxelVolume(spec.voxelSize);
    buildTestFoamer(this.volume, spec.size as [number, number, number]);

    this.body = world.createRigidBody(rapier.RigidBodyDesc.kinematicPositionBased());
    // Movement capsule: full model height on the feet, at the box's centre
    // in x and z in the body frame. Smaller than the blob, so darts usually
    // hit the voxel colliders first.
    this.capsule = world.createCollider(
      rapier.ColliderDesc.capsule(this.halfH - spec.capsuleRadius, spec.capsuleRadius)
        .setTranslation(this.hx, this.halfH, this.hz),
      this.body,
    );

    this.mesh = new VolumeMesh(this.volume, mesher, rapier, world, new THREE.Vector3(), this.body);
    this.group.add(this.mesh.group);
    // Place the body once for spawn: setTranslation and setRotation in place.
    const corner = cornerOffset(this.hx, this.hz, this.yaw, new THREE.Vector3());
    this.body.setTranslation({ x: this.centre.x + corner.x, y: this.centre.y + corner.y, z: this.centre.z + corner.z }, true);
    this.body.setRotation({ x: _q.x, y: _q.y, z: _q.z, w: _q.w }, true);
    this.syncRender();
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
    return v.set(v.x - t.x, v.y - t.y, v.z - t.z).applyQuaternion(_q).divideScalar(this.volume.voxelSize);
  }

  /** Voxel coordinates to world position (in place), through the body's
   *  current translation and rotation. */
  voxelToWorld(v: THREE.Vector3) {
    const t = this.body.translation();
    const r = this.body.rotation();
    _q.set(r.x, r.y, r.z, r.w);
    return v.multiplyScalar(this.volume.voxelSize).applyQuaternion(_q).add(t);
  }

  /** One full step of the body pose, in place: centre shifted to the voxel
   *  corner, rotated yaw about the centre. */
  applyPose() {
    const corner = cornerOffset(this.hx, this.hz, this.yaw, new THREE.Vector3());
    this.body.setNextKinematicTranslation({
      x: this.centre.x + corner.x,
      y: this.centre.y + corner.y,
      z: this.centre.z + corner.z,
    });
    this.body.setNextKinematicRotation({ x: _q.x, y: _q.y, z: _q.z, w: _q.w });
  }

  /** Render frame: copy the pose and the windup squash to the groups. The
   *  outer group sits on the feet centre, unturned, so the squash scales
   *  about the feet; the mesh inside carries the corner offset and the yaw,
   *  matching the body. */
  syncRender() {
    const corner = cornerOffset(this.hx, this.hz, this.yaw, new THREE.Vector3());
    this.group.position.copy(this.centre);
    const inv = 1 / Math.sqrt(this.squashY);
    this.group.scale.set(inv, this.squashY, inv);
    this.mesh.group.position.copy(corner);
    this.mesh.group.quaternion.set(_q.x, _q.y, _q.z, _q.w);
  }

  /** Remove the mesh, colliders and body. */
  dispose(world: RAPIER.World) {
    this.mesh.dispose();
    this.group.removeFromParent();
    // The capsule and every voxel collider are gone with the body.
    world.removeRigidBody(this.body);
  }
}
