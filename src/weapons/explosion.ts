import * as THREE from "three";
import type RAPIER from "@dimforge/rapier3d-compat";
import { carveSphere, type RemovedVoxel } from "../voxel/carve";
import type { VoxelVolume } from "../voxel/chunk";
import { materialId } from "../voxel/materials";
import { DEBRIS_GROUPS } from "../physics/world";
import type { DebrisSystem } from "../voxel/debris";
import tuning from "../../data/explosion.json";

// GAME-09d: the shared explosion (CONTENT-PLAN 4: B05, B06 and B07 all gain
// explosive options, and explosions carve). One system serves every
// explosive dart, so a blast looks and hits the same whoever threw it.
// At a world point it: carves a sphere through the voxel carve path, damages
// every Foamer whose centre is inside range with a linear falloff, pushes
// loose debris and broken pieces outward, bursts foam chunks, and calls the
// onExplode hook (the page plays FX-explode there).
//
// It never damages the player (Paul, 2026-11-07: the player's own
// explosions never hurt the player). The damage goes through the
// Foamer system's blastDamage, the non-dart path parryDamage uses, so a
// blast can go a Foamer down or pop it.
//
// A hard cap (maxPerSecond) counts blasts per second of simulation time:
// extra requests in the same second do nothing at all. The clock comes from
// DartImpacts chaining the dart system's update (no wall clock, so a test
// run under load behaves like the game).

/** The blast-carvable shape a target must have (the same one DartImpacts
 *  carves; kept structural so explosion.ts does not import impacts.ts). */
export interface ExplosionTarget {
  volume: VoxelVolume;
  worldToVoxel(v: THREE.Vector3): THREE.Vector3;
  voxelToWorld(v: THREE.Vector3): THREE.Vector3;
  /** Multiplies the carve radius, as VoxelTarget's does. */
  carveScale?: number;
}

/** What the system calls on the Foamer system (a structural subset, so a
 *  test can pass a fake). blastDamage is the non-dart damage path (see
 *  Foamers.blastDamage); list is every live Foamer. */
export interface BlastDamageTargets {
  readonly list: readonly { centre: THREE.Vector3 }[];
  blastDamage(f: { centre: THREE.Vector3 }, amount: number): void;
}

const T = tuning;

// Shared scratch: explode allocates nothing per blast after construction.
const _c = new THREE.Vector3();
const _push = new THREE.Vector3();

export class ExplosionSystem {
  /** Called after each carve that removed voxels, with the removed ones,
   *  exactly like DartImpacts.onCarve (the pages drop the islands there). */
  onCarve: (target: ExplosionTarget, removed: RemovedVoxel[]) => void = () => {};
  /** Called once per blast that ran, with the world point. The page plays
   *  FX-explode here (game.ts). */
  onExplode: (point: THREE.Vector3) => void = () => {};
  /** The Foamer system, set by the page once it exists (DartImpacts is
   *  built first). Null: a blast still carves, pushes and bursts. */
  foamers: BlastDamageTargets | null = null;

  /** Simulation seconds, advanced by tick. */
  time = 0;
  readonly stats = { blasts: 0, dropped: 0, damage: 0 };
  private bucket = -1;
  private bucketCount = 0;
  private _ignore: RAPIER.Collider | null = null;

  constructor(
    private world: RAPIER.World,
    private debris: DebrisSystem,
    private targets: ExplosionTarget[],
  ) {}

  /** Advance the cap's clock. Chained onto the dart system's update by
   *  DartImpacts, so it ticks whenever the game steps. */
  tick(dt: number): void {
    this.time += dt;
  }

  /** Ignore this collider's body in the outward push (the player's own
   *  capsule sits inside their body: pages that push bodies by group pass
   *  it, as DartSystem's ignore does). */
  ignore(collider: RAPIER.Collider): void {
    this._ignore = collider;
  }

  /** The blast at a world point. Over the per-second cap it does nothing. */
  explode(point: THREE.Vector3): void {
    const second = Math.floor(this.time);
    if (second !== this.bucket) {
      this.bucket = second;
      this.bucketCount = 0;
    }
    if (this.bucketCount >= T.maxPerSecond) {
      this.stats.dropped++;
      return;
    }
    this.bucketCount++;
    this.stats.blasts++;

    // 1. Carve a sphere from every volume the point reaches. The carve is
    // the same call a dart carve makes; islands cut loose by it drop
    // through onCarve, the pages' existing island path.
    for (const target of this.targets) {
      const size = target.volume.voxelSize;
      _c.copy(point);
      target.worldToVoxel(_c);
      const r = T.carveRadius * (target.carveScale ?? 1);
      const removed = carveSphere(target.volume, _c.x, _c.y, _c.z, r / size);
      if (removed.length === 0) continue;
      this.onCarve(target, removed);
    }

    // 2. Damage every Foamer whose centre is in range, linearly to 0 at the
    // edge, through the non-dart path (it can go down or pop).
    if (this.foamers) {
      const range2 = T.rangeMetres * T.rangeMetres;
      for (const f of this.foamers.list) {
        const d2 = f.centre.distanceToSquared(point);
        if (d2 > range2) continue;
        const fall = 1 - Math.sqrt(d2) / T.rangeMetres;
        const amount = T.damageCentre * fall;
        if (amount <= 0) continue;
        this.stats.damage++;
        this.foamers.blastDamage(f, amount);
      }
    }

    // 3. Push loose debris and broken pieces outward. Both are dynamic
    // bodies in the debris collision group; the player's capsule and every
    // fixed body are not, so the push never touches the player.
    const ignoreBody = this._ignore ? this._ignore.parent() : null;
    const push = T.pushSpeed;
    this.world.bodies.forEach((b) => {
      if (!b.isDynamic() || b === ignoreBody) return;
      const coll = b.collider(0);
      if (!coll || coll.collisionGroups() !== DEBRIS_GROUPS) return;
      const t = b.translation();
      const dx = t.x - point.x, dy = t.y - point.y, dz = t.z - point.z;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 > T.rangeMetres * T.rangeMetres) return;
      const d = Math.sqrt(d2) || 1e-3;
      const fall = 1 - d / T.rangeMetres;
      const k = Math.min(b.mass() * push * fall, b.mass() * T.pushSpeed);
      _push.set(dx / d, dy / d + 0.5, dz / d).normalize().multiplyScalar(k);
      b.applyImpulse({ x: _push.x, y: _push.y, z: _push.z }, true);
    });

    // 4. A foam burst of chunks at the point. The debris system's ring is
    // the cap on chunks (destruction.json debris.max), as everywhere else.
    this.debris.burst(point, T.burstChunks, T.burstSize, materialId(T.burstMaterial));

    this.onExplode(point);
  }
}
