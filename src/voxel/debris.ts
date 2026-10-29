import * as THREE from "three";
import type RAPIER from "@dimforge/rapier3d-compat";
import { DEBRIS_GROUPS, type Rapier } from "../physics/world";
import { linearColorTable } from "./materials";
import type { RemovedVoxel } from "./carve";
import tuning from "../../data/destruction.json";

// Foam chunks thrown out by carving. A fixed ring of slots: when it is full,
// the oldest chunk is reused, so the count never exceeds debris.max.
// Chunks live for `lifetime` seconds, shrink away over `fadeTime`, then free.

const T = tuning.debris;

interface Slot {
  body: RAPIER.RigidBody | null;
  age: number;
  size: number;
}

export class DebrisSystem {
  readonly mesh: THREE.InstancedMesh;
  private slots: Slot[];
  private next = 0;
  private colors = linearColorTable();
  private color = new THREE.Color();
  private m4 = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private p = new THREE.Vector3();
  private s = new THREE.Vector3();

  constructor(private rapier: Rapier, private world: RAPIER.World) {
    this.slots = Array.from({ length: T.max }, () => ({ body: null, age: 0, size: 0 }));
    this.mesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ roughness: 1 }),
      T.max,
    );
    this.mesh.castShadow = true;
    this.mesh.frustumCulled = false;
    this.m4.makeScale(0, 0, 0);
    for (let i = 0; i < T.max; i++) {
      this.mesh.setMatrixAt(i, this.m4);
      this.mesh.setColorAt(i, this.color.setRGB(1, 1, 1));
    }
  }

  get live() {
    let n = 0;
    for (const s of this.slots) if (s.body) n++;
    return n;
  }

  /**
   * Spawn chunks for a carve. Positions are in the volume's voxel space;
   * toWorld maps a voxel-space point to world space.
   */
  spawn(
    removed: RemovedVoxel[],
    centre: THREE.Vector3,
    voxelSize: number,
    toWorld: (v: THREE.Vector3) => THREE.Vector3,
  ) {
    if (removed.length === 0) return;
    const count = Math.min(T.perCarveMax, Math.max(1, Math.round(removed.length / T.voxelsPerPiece ** 2)));
    const size = voxelSize * T.voxelsPerPiece * 0.6;
    const c = toWorld(centre.clone());
    for (let n = 0; n < count; n++) {
      const v = removed[Math.floor((n / count) * removed.length)];
      const pos = toWorld(new THREE.Vector3(v.x + 0.5, v.y + 0.5, v.z + 0.5));
      const dir = pos.clone().sub(c);
      if (dir.lengthSq() < 1e-6) dir.set(Math.random() - 0.5, 1, Math.random() - 0.5);
      dir.normalize();
      const speed = T.minSpeed + Math.random() * (T.maxSpeed - T.minSpeed);
      this.add(pos, dir.multiplyScalar(speed).setY(dir.y + T.upBoost), size, v.material);
    }
  }

  /** Fixed step: age chunks and free the expired ones. */
  update(dt: number) {
    for (const s of this.slots) {
      if (!s.body) continue;
      s.age += dt;
      if (s.age >= T.lifetime) this.free(s);
    }
  }

  /** Render frame: copy body transforms into the instanced mesh. */
  syncRender() {
    for (let i = 0; i < this.slots.length; i++) {
      const s = this.slots[i];
      if (!s.body) continue;
      const t = s.body.translation();
      const r = s.body.rotation();
      const k = s.size * Math.min(1, (T.lifetime - s.age) / T.fadeTime);
      this.m4.compose(this.p.set(t.x, t.y, t.z), this.q.set(r.x, r.y, r.z, r.w), this.s.setScalar(k));
      this.mesh.setMatrixAt(i, this.m4);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  private add(pos: THREE.Vector3, vel: THREE.Vector3, size: number, mat: number) {
    const i = this.next;
    this.next = (this.next + 1) % this.slots.length;
    const s = this.slots[i];
    if (s.body) this.free(s);
    s.body = this.world.createRigidBody(
      this.rapier.RigidBodyDesc.dynamic()
        .setTranslation(pos.x, pos.y, pos.z)
        .setLinvel(vel.x, vel.y, vel.z)
        .setAngvel({ x: (Math.random() - 0.5) * 12, y: (Math.random() - 0.5) * 12, z: (Math.random() - 0.5) * 12 }),
    );
    this.world.createCollider(
      this.rapier.ColliderDesc.cuboid(size / 2, size / 2, size / 2)
        .setDensity(T.density)
        .setRestitution(T.restitution)
        .setFriction(T.friction)
        .setCollisionGroups(DEBRIS_GROUPS),
      s.body,
    );
    s.age = 0;
    s.size = size;
    this.color.setRGB(this.colors[mat * 3], this.colors[mat * 3 + 1], this.colors[mat * 3 + 2]);
    this.mesh.setColorAt(i, this.color);
    this.mesh.instanceColor!.needsUpdate = true;
  }

  private free(s: Slot) {
    this.world.removeRigidBody(s.body!);
    s.body = null;
    const i = this.slots.indexOf(s);
    this.mesh.setMatrixAt(i, this.m4.makeScale(0, 0, 0));
  }
}
