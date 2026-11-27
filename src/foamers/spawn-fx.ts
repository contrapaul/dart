import * as THREE from "three";
import { SPAWN_IN, type SpawnInSpec } from "./spawn-in";

// SPAWN-01: the teleport's look at a Foamer's feet: a foam ring that opens
// on the floor, a rising column of foam and a puff of foam chunks. Foam
// only: no fire, no smoke, nothing demonic. Pooled, with a hard cap
// (`maxLive`). The spawn-fx card fills it in; the FoamerSystem owns one and
// calls `start` when a Foamer teleports in, `update` every step.

// Small seeded PRNG (mulberry32) so an arrival's chunk directions repeat.
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(feet: THREE.Vector3, height: number, colour: number): number {
  const s = `${feet.x.toFixed(3)}|${feet.y.toFixed(3)}|${feet.z.toFixed(3)}|${height.toFixed(3)}|${colour}`;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const GRAVITY = 9.8; // metres per second squared, [Paul] to tune

interface Chunk {
  mesh: THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>;
  vel: THREE.Vector3; // world-space direction * speed (up and out from the feet)
  size: number;
}

interface Arrival {
  group: THREE.Group;
  ring: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>;
  column: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshBasicMaterial>;
  chunks: Chunk[];
  t: number;
  active: boolean;
  feet: THREE.Vector3;
}

export class SpawnFx {
  /** Added to the scene by whoever owns the FoamerSystem's group. */
  readonly group = new THREE.Group();
  private slots: Arrival[] = [];
  private readonly spec: SpawnInSpec;

  constructor(spec: SpawnInSpec = SPAWN_IN) {
    this.spec = spec;
    const look = spec.look;
    const ringGeo = new THREE.CircleGeometry(1, 40);
    const columnGeo = new THREE.CylinderGeometry(1, 1, 1, 20, 1, true);
    const chunkGeo = new THREE.BoxGeometry(1, 1, 1);
    for (let i = 0; i < spec.maxLive; i++) {
      const arrival = this.makeArrival(look, ringGeo, columnGeo, chunkGeo);
      arrival.group.visible = false;
      this.group.add(arrival.group);
      this.slots.push(arrival);
    }
  }

  private makeArrival(
    look: SpawnInSpec["look"],
    ringGeo: THREE.CircleGeometry,
    columnGeo: THREE.CylinderGeometry,
    chunkGeo: THREE.BoxGeometry,
  ): Arrival {
    const group = new THREE.Group();
    const ringMat = new THREE.MeshBasicMaterial({
      color: look.ringColour,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.02;
    group.add(ring);

    const columnMat = new THREE.MeshBasicMaterial({
      color: look.foamColour,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const column = new THREE.Mesh(columnGeo, columnMat);
    column.position.y = 0;
    group.add(column);

    const chunks: Chunk[] = [];
    const chunkSize = Math.max(0.08, look.ringRadius * 0.13); // small foam cubes
    for (let i = 0; i < look.chunks; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: look.foamColour, transparent: true, opacity: 1 });
      const mesh = new THREE.Mesh(chunkGeo, mat);
      mesh.scale.setScalar(chunkSize);
      mesh.visible = false;
      group.add(mesh);
      chunks.push({ mesh, vel: new THREE.Vector3(), size: chunkSize });
    }
    return { group, ring, column, chunks, t: 0, active: false, feet: new THREE.Vector3() };
  }

  /** Starts an arrival at `feet`, for a Foamer `height` metres tall whose
   *  main colour is `colour` (0xrrggbb). Returns false at the cap. */
  start(feet: THREE.Vector3, height: number, colour: number): boolean {
    const slot = this.slots.find((s) => !s.active);
    if (!slot) return false;
    const look = this.spec.look;
    slot.feet.copy(feet);
    slot.group.position.set(feet.x, feet.y, feet.z);
    slot.t = 0;
    slot.active = true;
    slot.group.visible = true;

    const seed = hashSeed(feet, height, colour);
    const rng = mulberry32(seed);
    const columnTarget = Math.max(look.columnHeight, height);
    for (let i = 0; i < slot.chunks.length; i++) {
      const c = slot.chunks[i];
      const angle = rng() * Math.PI * 2;
      const up = 0.6 + rng() * 0.9;
      const out = 0.6 + rng() * 0.8;
      const speed = look.chunkSpeed;
      c.vel.set(Math.cos(angle) * out, up, Math.sin(angle) * out).normalize().multiplyScalar(speed);
      c.mesh.material.color.set(i % 2 === 0 ? colour : look.foamColour);
      c.mesh.material.opacity = 1;
      c.mesh.visible = true;
      c.mesh.position.set(0, 0.05, 0);
      c.mesh.scale.setScalar(c.size);
    }
    // Column radius: a soft foam shaft, ~half the ring radius.
    slot.column.scale.set(look.ringRadius * 0.45, 0.001, look.ringRadius * 0.45);
    slot.column.position.y = 0.001;
    slot.column.userData.targetHeight = columnTarget;

    slot.ring.material.opacity = 0.95;
    slot.ring.scale.setScalar(0.001);
    slot.column.material.opacity = 0.55;
    return true;
  }

  /** Advances every arrival; finished ones go back to the pool, hidden. */
  update(dt: number): void {
    const spec = this.spec;
    const look = spec.look;
    const portalTime = spec.portalShare * spec.seconds;
    const seconds = spec.seconds;
    for (const slot of this.slots) {
      if (!slot.active) continue;
      slot.t += dt;
      const t = slot.t;
      if (t >= seconds) {
        slot.active = false;
        slot.group.visible = false;
        continue;
      }
      const open = Math.min(1, t / portalTime);
      // Ring: open over the portal share, then shrink and fade out.
      const shrink = t <= portalTime ? 1 : Math.max(0, 1 - (t - portalTime) / (seconds - portalTime));
      const ringScale = Math.max(0.001, look.ringRadius * open * shrink);
      slot.ring.scale.setScalar(ringScale);
      slot.ring.material.opacity = 0.95 * (t <= portalTime ? 1 : shrink);

      // Column: rises over the portal time, fades as the body grows.
      const targetH = slot.column.userData.targetHeight as number;
      const h = Math.max(0.001, targetH * open);
      slot.column.scale.y = h;
      slot.column.position.y = h / 2;
      slot.column.material.opacity = 0.55 * (1 - t / seconds);

      // Chunks: thrown up and out, fall under gravity, shrink away.
      const fade = 1 - t / seconds;
      for (const c of slot.chunks) {
        const x = c.vel.x * t;
        const z = c.vel.z * t;
        const y = 0.05 + c.vel.y * t - 0.5 * GRAVITY * t * t;
        c.mesh.position.set(x, Math.max(0.02, y), z);
        c.mesh.scale.setScalar(Math.max(0.001, c.size * fade));
        c.mesh.material.opacity = fade;
      }
    }
  }

  /** Arrivals being drawn now. */
  get live(): number {
    let n = 0;
    for (const s of this.slots) if (s.active) n++;
    return n;
  }

  /** Hides every arrival (a restart). */
  clear(): void {
    for (const s of this.slots) {
      s.active = false;
      s.group.visible = false;
    }
  }
}
