import * as THREE from "three";
import type RAPIER from "@dimforge/rapier3d-compat";
import { carveSphere, type RemovedVoxel } from "../voxel/carve";
import type { VoxelVolume } from "../voxel/chunk";
import { materialId } from "../voxel/materials";
import { DEBRIS_GROUPS } from "../physics/world";
import type { DebrisSystem } from "../voxel/debris";
import tuning from "../../data/explosion.json";

/** One blast profile (data/explosion.json profiles). GAME-09f: today's
 *  numbers are the `dart` profile (B05 and B06 keep them); `launcher` is
 *  B07's round and shoves Foamers; `cluster` is a cluster blast. */
export type BlastProfileName = keyof typeof tuning.profiles;
export type BlastProfile = (typeof tuning.profiles)[BlastProfileName];

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

/** PT-05: one blast's falloff at a Foamer, as the Foamer system needs it.
 *  point is the blast's centre in world space, fall is 1 at the centre and
 *  0 at rangeMetres. */
export interface BlastContact {
  readonly point: THREE.Vector3;
  readonly fall: number;
}

/** What the system calls on the Foamer system (a structural subset, so a
 *  test can pass a fake). blastDamage is the non-dart damage path (see
 *  Foamers.blastDamage); list is every live Foamer. CutCapable is the
 *  PT-05 carve hook: a Foamer that can say how close the point comes to any
 *  part (blastDistance, Infinity when none) and carve its parts (blastCarve),
 *  so a blast marks a Foamer the way a dart does. PT-05: knock is the
 *  timed shove (Foamers.blastKnock): it sets the Foamer's own knock speed,
 *  which its movement controller spends over the next steps, so no step
 *  moves it further than that speed allows and a wall stops it. The player
 *  is not in the Foamer list, so the blast never reaches them. */
export interface BlastDamageTargets {
  readonly list: readonly { centre: THREE.Vector3 }[];
  blastDamage(
    f: { centre: THREE.Vector3 }, amount: number,
    blast?: { point: THREE.Vector3; carveRadius: number; strength: number },
  ): void;
  blastDistance?(f: { centre: THREE.Vector3 }, point: THREE.Vector3): number;
  blastCarve?(f: { centre: THREE.Vector3 }, point: THREE.Vector3, radiusMetres: number): number;
  blastKnock?(
    f: { centre: THREE.Vector3 }, point: THREE.Vector3, fall: number, profile: BlastProfile,
  ): void;
}

// Shared scratch: explode allocates nothing per blast after construction.
const _c = new THREE.Vector3();
const _push = new THREE.Vector3();
const _side = new THREE.Vector3();

export class ExplosionSystem {
  /** Called after each carve that removed voxels, with the removed ones,
   *  exactly like DartImpacts.onCarve (the pages drop the islands there). */
  onCarve: (target: ExplosionTarget, removed: RemovedVoxel[]) => void = () => {};
  /** Called once per blast that ran, with the world point and the
   *  profile's visual radius. The page plays FX-explode and spawns the
   *  blast here. */
  onExplode: (point: THREE.Vector3, fxRadius: number) => void = () => {};
  /** ED-06: called at the start of every blast, with the profile it ran in,
   *  so a page can take the same blast off its own breakables. Every blast
   *  comes through here, a cluster's follow-ups and a barrel's included. */
  onBlast: (point: THREE.Vector3, profile: BlastProfileName) => void = () => {};
  /** The Foamer system, set by the page once it exists (DartImpacts is
   *  built first). Null: a blast still carves, pushes and bursts. */
  foamers: BlastDamageTargets | null = null;

  /** Simulation seconds, advanced by tick. */
  time = 0;
  readonly stats = { blasts: 0, dropped: 0, damage: 0 };
  /** GAME-09f: blasts pending in simulation time (a cluster's follow-ups). */
  private pending: { point: THREE.Vector3; profile: BlastProfileName; at: number }[] = [];
  private bucket = -1;
  private bucketCount = 0;
  private _ignore: RAPIER.Collider | null = null;

  constructor(
    private world: RAPIER.World,
    private debris: DebrisSystem,
    private targets: ExplosionTarget[],
  ) {}

  /** Advance the cap's clock and fire due pending blasts. Chained onto the
   *  dart system's update by DartImpacts, so it ticks whenever the game
   *  steps. No wall clock anywhere: a test run under load behaves like the
   *  game. */
  tick(dt: number): void {
    this.time += dt;
    for (let i = this.pending.length - 1; i >= 0; i--) {
      const p = this.pending[i];
      if (p.at > this.time) continue;
      this.pending.splice(i, 1);
      this.explode(p.point, p.profile);
    }
  }

  /** GAME-09f mod 2: queue a blast at a future simulation time (the
   *  cluster's four small blasts after their delay). */
  private schedule(point: THREE.Vector3, profile: BlastProfileName, at: number): void {
    this.pending.push({ point: point.clone(), profile, at });
  }

  /** Ignore this collider's body in the outward push (the player's own
   *  capsule sits inside their body: pages that push bodies by group pass
   *  it, as DartSystem's ignore does). */
  ignore(collider: RAPIER.Collider): void {
    this._ignore = collider;
  }

  /** The blast at a world point, in a profile (default: the dart's, so
   *  B05's and B06's blasts are unchanged). Over the per-second cap (shared
   *  across profiles) it does nothing. clustered: also queue the four
   *  small cluster blasts (GAME-09f mod 2). */
  explode(point: THREE.Vector3, profile: BlastProfileName = "dart", clustered = false): void {
    const second = Math.floor(this.time);
    if (second !== this.bucket) {
      this.bucket = second;
      this.bucketCount = 0;
    }
    if (this.bucketCount >= tuning.maxPerSecond) {
      this.stats.dropped++;
      return;
    }
    this.bucketCount++;
    this.stats.blasts++;
    const T = tuning.profiles[profile];
    this.onBlast(point, profile);

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

    // 2. Damage every Foamer the sphere reaches, linearly to 0 at the edge,
    // through the non-dart path (it can go down or pop).
    // PT-05: the test is the sphere, not the feet centre: a Foamer whose arm
    // is in range takes it too. The Foamer system measures the nearest part
    // (blastDistance) and casts from the point to that part, so a wall in
    // between stops the damage. A fake with no blastDistance falls back to
    // its centre, the way the old blast worked.
    if (this.foamers) {
      for (const f of this.foamers.list) {
        const dist = this.foamers.blastDistance
          ? this.foamers.blastDistance(f, point)
          : f.centre.distanceTo(point);
        if (!(dist <= T.rangeMetres)) continue;
        const fall = 1 - dist / T.rangeMetres;
        const amount = T.damageCentre * fall;
        if (amount <= 0) continue;
        this.stats.damage++;
        // PT-05 stage 2: the profile's Foamer carve radius goes with the
        // damage, so a survivor gets its hole and a kill is judged on it.
        this.foamers.blastDamage(f, amount, {
          point,
          carveRadius: T.foamerCarveRadius ?? 0,
          // The damage this Foamer took at its distance, not the centre's
          // (review fix: one at the edge was judged as if hit dead on).
          strength: amount,
        });
        // PT-05: the shove is a speed the Foamer spends over the next
        // steps (blastKnock), not one moved position, so no step jumps and
        // a wall stops it inside the movement controller. A fake with no
        // blastKnock keeps the old one-step shove.
        if (T.knockSpeed > 0) this.foamers.blastKnock?.(f, point, fall, T);
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
      // PT-05: straight out from the point in 3D, not mainly up: a sphere
      // throws a body along the ray it stands on, with only the data's
      // small lift on top (Paul: "the launcher ball blasts straight up").
      _push.set(dx / d, dy / d + tuning.pushLift, dz / d).normalize().multiplyScalar(k);
      b.applyImpulse({ x: _push.x, y: _push.y, z: _push.z }, true);
    });

    // 4. A foam burst of chunks at the point. The debris system's ring is
    // the cap on chunks (destruction.json debris.max), as everywhere else.
    // The debris system's own burst: its spray and the ring cap are its
    // look and its limit (src/voxel/debris.ts is not this card's file).
    this.debris.burst(point, T.burstChunks, T.burstSize, materialId(T.burstMaterial));

    // 5. GAME-09f mod 2 (Paul): a clustered blast throws four small blasts
    // of the data's cluster profile around it, distanceMetres out at the
    // four sides (world axes), after delaySeconds. They run through the
    // same system and the same per-second cap as everything else.
    if (clustered) {
      const c = tuning.cluster;
      const at = this.time + c.delaySeconds;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        _side.set(dx * c.distanceMetres, 0, dz * c.distanceMetres);
        this.schedule(_c.copy(point).add(_side), c.profile as BlastProfileName, at);
      }
    }

    this.onExplode(point, T.fxRadius);
  }
}
