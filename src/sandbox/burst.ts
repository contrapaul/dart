import * as THREE from "three";

// Foam bits for the sandbox's damage preview: chunks from a catastrophic
// pop and the fizz of foam from wounds and downed Foamers. One instanced
// mesh of cubes, a hard cap, simple gravity and floor bounces.

export interface BitSpec {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  color: THREE.Color;
  /** Edge length, metres. */
  size: number;
  /** m/s², down is positive. Above 2 it is a chunk: it spins and bounces;
   *  below, a fizz bubble that drifts and fades. */
  gravity: number;
  /** Seconds before it shrinks away (over the last 0.6 s). */
  life: number;
}

interface Bit extends BitSpec {
  age: number;
  rot: THREE.Quaternion;
  spin: THREE.Vector3;
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _e = new THREE.Euler();

export class Burst {
  readonly mesh: THREE.InstancedMesh;
  private bits: Bit[] = [];

  constructor(scene: THREE.Scene, readonly cap = 1500) {
    this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.9 }), cap);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.castShadow = true;
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
  }

  /** Add a bit; returns false when the cap is reached. */
  add(spec: BitSpec): boolean {
    if (this.bits.length >= this.cap) return false;
    this.bits.push({
      ...spec,
      age: 0,
      rot: new THREE.Quaternion().setFromEuler(_e.set(Math.random() * 6, Math.random() * 6, Math.random() * 6)),
      spin: new THREE.Vector3().randomDirection().multiplyScalar(spec.gravity > 2 ? 6 + Math.random() * 6 : 1),
    });
    return true;
  }

  clear() {
    this.bits = [];
    this.mesh.count = 0;
  }

  update(dt: number) {
    let n = 0;
    for (const b of this.bits) {
      b.age += dt;
      if (b.age >= b.life) continue;
      b.vel.y -= b.gravity * dt;
      b.pos.addScaledVector(b.vel, dt);
      const r = b.size / 2;
      if (b.gravity > 2 && b.pos.y < r) {
        // Bounce on the floor, losing most of the speed, and stop spinning.
        b.pos.y = r;
        b.vel.y = Math.abs(b.vel.y) * 0.3;
        b.vel.x *= 0.6;
        b.vel.z *= 0.6;
        b.spin.multiplyScalar(0.5);
      }
      if (b.spin.lengthSq() > 1e-4) b.rot.multiply(_q.setFromEuler(_e.set(b.spin.x * dt, b.spin.y * dt, b.spin.z * dt)));
      const shrink = Math.min(1, (b.life - b.age) / 0.6);
      _m.compose(b.pos, b.rot, _s.setScalar(b.size * shrink));
      this.mesh.setMatrixAt(n, _m);
      this.mesh.setColorAt(n, b.color);
      this.bits[n++] = b;
    }
    this.bits.length = n;
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}
