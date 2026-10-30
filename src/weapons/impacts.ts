import * as THREE from "three";
import type RAPIER from "@dimforge/rapier3d-compat";
import { DartSystem, type DartHit } from "./darts";
import dartTuning from "../../data/darts.json";
import { carveSphere, type RemovedVoxel } from "../voxel/carve";
import { DebrisSystem } from "../voxel/debris";
import type { VoxelVolume } from "../voxel/chunk";

// Wires dart hits on voxel volumes into carving and foam debris. A
// VoxelTarget is anything with a voxel volume and its own colliders; a
// VolumeMesh matches the interface directly, so it can be passed as one.

export interface VoxelTarget {
  volume: VoxelVolume;
  owns(collider: RAPIER.Collider): boolean;
  worldToVoxel(v: THREE.Vector3): THREE.Vector3;
  voxelToWorld(v: THREE.Vector3): THREE.Vector3;
}

const centreScratch = new THREE.Vector3();

export class DartImpacts {
  readonly stats = { hits: 0, carves: 0, voxelsRemoved: 0 };
  /** Called after each carve that removed voxels, with the removed ones.
   *  main uses it to drop the islands (ENG-06). */
  onCarve: (target: VoxelTarget, removed: RemovedVoxel[]) => void = () => {};
  private darts: DartSystem;

  constructor(darts: DartSystem, private debris: DebrisSystem, private targets: VoxelTarget[]) {
    this.darts = darts;
    const previous = darts.onHit;
    darts.onHit = (hit) => {
      previous(hit);
      this.handleHit(hit);
    };
  }

  private handleHit(hit: DartHit): void {
    this.stats.hits++;
    const target = this.targets.find((t) => t.owns(hit.collider));
    if (!target) return; // hit something that is not a voxel volume

    // Radius scales with impact speed relative to the dart type's top speed,
    // never below 0.3 of the type's carveRadius.
    const scale = THREE.MathUtils.clamp(hit.speed / dartTuning.types[hit.type].speed, 0.3, 1);
    const radiusMetres = dartTuning.types[hit.type].carveRadius * scale;
    const size = target.volume.voxelSize;
    // Centre the carve slightly inside the surface, in voxel space.
    centreScratch.copy(hit.point).addScaledVector(hit.direction, size * 0.5);
    target.worldToVoxel(centreScratch);
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
  }
}
