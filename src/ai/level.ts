import type * as THREE from "three";
import type RAPIER from "@dimforge/rapier3d-compat";
import type { Rapier } from "../physics/world";
import { Director, type DifficultyKey } from "./director";
import { NavGrid, type NavBounds } from "./nav-grid";
import { DIFFICULTIES } from "../core/settings";
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
}

export function makeLevelAI(
  rapier: Rapier,
  world: RAPIER.World,
  bounds: NavBounds,
  difficulty: string,
): LevelAI {
  const grid = new NavGrid(rapier, world, bounds);
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
  };
}
