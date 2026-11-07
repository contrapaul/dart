import * as THREE from "three";
import type RAPIER from "@dimforge/rapier3d-compat";
import { DartSystem, type DartHit, type DartTypeName } from "./darts";
import dartTuning from "../../data/darts.json";
import { carveSphere, type RemovedVoxel } from "../voxel/carve";
import { material } from "../voxel/materials";
import { DebrisSystem } from "../voxel/debris";
import type { VoxelVolume } from "../voxel/chunk";
import type { ExplosionSystem, BlastProfileName } from "./explosion";

// Wires dart hits on voxel volumes into carving and foam debris. A
// VoxelTarget is anything with a voxel volume and its own colliders; a
// VolumeMesh matches the interface directly, so it can be passed as one.

export interface VoxelTarget {
  volume: VoxelVolume;
  owns(collider: RAPIER.Collider): boolean;
  worldToVoxel(v: THREE.Vector3): THREE.Vector3;
  voxelToWorld(v: THREE.Vector3): THREE.Vector3;
  /** Multiplies the carve radius (GAME-10b: armour plates chip slowly). */
  carveScale?: number;
}

const centreScratch = new THREE.Vector3();

/** GAME-09f: which blast profile a dart type blasts with. The launcher's
 *  round uses the launcher profile (its own carve, range, damage, push);
 *  every other type keeps the dart profile, which holds B05's and B06's
 *  original numbers. */
function profileFor(type: DartTypeName): BlastProfileName {
  return type === "launcher" ? "launcher" : "dart";
}

export class DartImpacts {
  readonly stats = { hits: 0, carves: 0, voxelsRemoved: 0 };
  /** Called after each carve that removed voxels, with the removed ones.
   *  main uses it to drop the islands (ENG-06). */
  onCarve: (target: VoxelTarget, removed: RemovedVoxel[]) => void = () => {};
  /** Called once per carve that removed voxels, with the dart's hit
   *  point in the world. AUD-01's DT-carve sound listens here: onCarve
   *  carries no position. Reads the hit's own point vector at call time. */
  onCarveAt: (point: THREE.Vector3) => void = () => {};
  private darts: DartSystem;

  constructor(
    darts: DartSystem,
    private debris: DebrisSystem,
    private targets: VoxelTarget[],
    /** GAME-09d: the shared explosion. With one, an explosive dart's first
     *  hit blasts at its point, and the explosion system's cap clock ticks
     *  with the dart system's update. */
    private explosion: ExplosionSystem | null = null,
  ) {
    this.darts = darts;
    const previous = darts.onHit;
    darts.onHit = (hit) => {
      previous(hit);
      this.handleHit(hit);
    };
    if (this.explosion) {
      darts.onUpdate = (dt: number) => this.explosion!.tick(dt);
      // GAME-09f: a launcher round blasts in the launcher profile, every
      // other explosive dart (B06's) keeps the dart profile it always had.
      darts.onExplosiveHit = (hit) =>
        this.explosion!.explode(hit.point, profileFor(hit.type));
      // GAME-09f mod 1: a remote round's detonation (a fire press, or the
      // cap popping the oldest) blasts where the round stopped.
      darts.onDetonate = (point, type, clustered) =>
        this.explosion!.explode(point, profileFor(type), clustered);
    }
  }

  private handleHit(hit: DartHit): void {
    this.stats.hits++;
    const target = this.targets.find((t) => t.owns(hit.collider));
    if (!target) return; // hit something that is not a voxel volume

    // Radius scales with impact speed relative to the dart type's top speed,
    // never below 0.3 of the type's carveRadius.
    const scale = THREE.MathUtils.clamp(hit.speed / dartTuning.types[hit.type].speed, 0.3, 1);
    const radiusMetres = dartTuning.types[hit.type].carveRadius * scale * (target.carveScale ?? 1);
    const size = target.volume.voxelSize;
    // Centre the carve slightly inside the surface, in voxel space.
    centreScratch.copy(hit.point).addScaledVector(hit.direction, size * 0.5);
    target.worldToVoxel(centreScratch);
    // Name the material under the tip for the dart sound of the hit:
    // the surface of the carve is that material. A Foamer part gets
    // relabelled "foamer" by the Foamer system, which runs after this.
    hit.material =
      material(target.volume.get(
        Math.floor(centreScratch.x), Math.floor(centreScratch.y), Math.floor(centreScratch.z),
      ))?.name ?? null;
    const removed = carveSphere(
      target.volume,
      centreScratch.x, centreScratch.y, centreScratch.z,
      radiusMetres / size,
    );
    if (removed.length === 0) return; // scuff only
    this.stats.carves++;
    this.stats.voxelsRemoved += removed.length;
    // Throw foam chunks out of the crater, the same call as main's debug blast.
    this.debris.spawn(removed, centreScratch, size, (v) => target.voxelToWorld(v));
    // Darts stuck to foam that is now gone fall off as loose darts.
    this.darts.releaseInSphere(hit.point, radiusMetres + size);
    this.onCarve(target, removed);
    this.onCarveAt(hit.point);
  }
}
