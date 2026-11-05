import type * as THREE from "three";
import type RAPIER from "@dimforge/rapier3d-compat";
import type { Rapier } from "../physics/world";
import { Director, type DifficultyKey } from "./director";
import { NavGrid, type NavBounds } from "./nav-grid";
import { DIFFICULTIES } from "../core/settings";
import type { VoxelVolume } from "../voxel/chunk";
import { EMPTY } from "../voxel/materials";
import aiData from "../../data/ai.json";

// One level's AI scaffolding (ENG-08 stage 3b): the attack-token director
// and the walkable grid, made together so every page builds them the same
// way. The grid is baked over the level's bounds at load and re-baked where
// a carve or a broken piece changed the ground.

/** The difficulty key the settings store's preset asks the director for. */
export function directorKey(difficulty: string): DifficultyKey {
  const preset = DIFFICULTIES[difficulty];
  const key = preset?.director ?? aiData.default;
  return (key in aiData.difficulties ? key : aiData.default) as DifficultyKey;
}

export interface LevelAI {
  director: Director;
  grid: NavGrid;
  /** Re-bake the cells a carve changed. Call after every carve. */
  carveChanged(minX: number, minZ: number, maxX: number, maxZ: number): void;
  /** Re-bake round a piece that came to rest (it may now block a cell). */
  pieceRested(centre: THREE.Vector3, radius: number): void;
  /** Re-bake once the level's voxel pieces have their colliders (BUG-03):
   *  the pages call it a few frames in, when the meshers come back. */
  piecesReady(): void;
}

/** A world point's solid test for a level's voxel volume (BUG-03): true
 *  while the point is inside a material voxel. `origin` is the volume's
 *  world origin (the voxel mesh's), which turns world metres into voxels. */
function solidAt(
  volume: VoxelVolume,
  origin: { x: number; y: number; z: number },
): (x: number, y: number, z: number) => boolean {
  const s = volume.voxelSize;
  return (x, y, z) =>
    volume.get(
      Math.floor((x - origin.x) / s),
      Math.floor((y - origin.y) / s),
      Math.floor((z - origin.z) / s),
    ) !== EMPTY;
}

export function makeLevelAI(
  rapier: Rapier,
  world: RAPIER.World,
  bounds: NavBounds,
  difficulty: string,
  /** The level's voxel pieces (the range and gym maths have none). The grid
   *  bakes their interiors as unwalkable through this and `origin`. */
  voxels?: VoxelVolume,
  origin?: { x: number; y: number; z: number },
): LevelAI {
  const grid = new NavGrid(rapier, world, bounds);
  if (voxels && origin) grid.setSolidAt(solidAt(voxels, origin));
  // Rapier's query pipeline updates on step(), and both pages build this
  // before their first frame: one step now, so the bake sees the level.
  world.step();
  grid.bake();
  return {
    director: new Director(directorKey(difficulty)),
    grid,
    carveChanged: (minX, minZ, maxX, maxZ) => grid.rebake(minX, minZ, maxX, maxZ),
    pieceRested: (centre, radius) =>
      grid.rebake(centre.x - radius, centre.z - radius, centre.x + radius, centre.z + radius),
    piecesReady: () => grid.rebake(bounds.minX, bounds.minZ, bounds.maxX, bounds.maxZ),
  };
}
