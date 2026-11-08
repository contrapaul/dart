// PT-01: the range's systems, built in one place so the tests build exactly
// what the page builds. Found in the playtest: the page made its DartImpacts
// with no ExplosionSystem, so a launcher round, B05's explosive mod and B06's
// every fifth shot all landed as plain darts. The game pages pass one
// (src/game/game.ts), and this does the same, so a blast on the range carves,
// damages, pushes and bursts as it does in the game.
//
// No DOM here: the same factory runs in a headless test.
import type RAPIER from "@dimforge/rapier3d-compat";
import type { Rapier } from "../physics/world";
import { DebrisSystem } from "../voxel/debris";
import { DartImpacts, type VoxelTarget } from "../weapons/impacts";
import { ExplosionSystem, type ExplosionTarget } from "../weapons/explosion";
import { FoamerSystem } from "../foamers/foamers";
import { ProjectileSystem } from "../foamers/projectiles";
import type { Mesher } from "../voxel/pieces";
import type { DartSystem } from "../weapons/darts";
import type { Loadout } from "../weapons/loadout";

export interface RangeSystems {
  debris: DebrisSystem;
  explosion: ExplosionSystem;
  impacts: DartImpacts;
  foamers: FoamerSystem;
  projectiles: ProjectileSystem;
  voxelTargets: VoxelTarget[];
}

/** Debris, the shared explosion, the dart impacts, the Foamer system and the
 *  foam balls, wired the way `src/game/game.ts` wires them: the explosion is
 *  built before the impacts (which chain the dart system's update onto its
 *  per-second cap clock), ignores the player's capsule, and takes the Foamer
 *  system as its damage target once that exists.
 *
 *  `voxelTargets` is the list darts carve (the Foamer parts go in and out of
 *  it as Foamers spawn and go). The range has no voxel wall or floor, so
 *  `explosionTargets` is normally empty: a blast there still damages, pushes
 *  and bursts, it just has no volume to carve. */
export function createRangeSystems(
  rapier: Rapier,
  world: RAPIER.World,
  darts: DartSystem,
  mesher: Mesher,
  playerCollider: RAPIER.Collider,
  voxelTargets: VoxelTarget[] = [],
  explosionTargets: ExplosionTarget[] = [],
): RangeSystems {
  const debris = new DebrisSystem(rapier, world);
  const explosion = new ExplosionSystem(world, debris, explosionTargets);
  explosion.ignore(playerCollider);
  const impacts = new DartImpacts(darts, debris, voxelTargets, explosion);
  const foamers = new FoamerSystem(rapier, world, mesher, debris, darts, voxelTargets);
  explosion.foamers = foamers;
  const projectiles = new ProjectileSystem(rapier, world, debris, playerCollider, foamers);
  foamers.projectiles = projectiles;
  return { debris, explosion, impacts, foamers, projectiles, voxelTargets };
}

/** The range's ammo rule: the reserve never runs out. Called once per step,
 *  it tops every blaster's reserve back to its own maximum and leaves the
 *  magazine alone, so a magazine still empties, a reload still takes its
 *  time, and a time to kill includes the reloads. The pages' infinite-ammo
 *  switch refilled the magazine instead, which hides the reload. */
export function fillReserves(loadout: Loadout): void {
  for (const b of loadout.blasters) {
    if (b.reserve < b.spec.reserveMax) b.reserve = b.spec.reserveMax;
  }
}
