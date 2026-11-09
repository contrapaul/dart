// PT-01: the range's systems, built in one place so the tests build exactly
// what the page builds. Found in the playtest: the page made its DartImpacts
// with no ExplosionSystem, so a launcher round, B05's explosive mod and B06's
// every fifth shot all landed as plain darts. The game pages pass one
// (src/game/game.ts), and this does the same, so a blast on the range carves,
// damages, pushes and bursts as it does in the game.
//
// No DOM here: the same factory runs in a headless test.
import * as THREE from "three";
import type RAPIER from "@dimforge/rapier3d-compat";
import type { Rapier } from "../physics/world";
import { DebrisSystem } from "../voxel/debris";
import { DartImpacts, type VoxelTarget } from "../weapons/impacts";
import { ExplosionSystem, type ExplosionTarget } from "../weapons/explosion";
import { FoamerSystem } from "../foamers/foamers";
import { ProjectileSystem } from "../foamers/projectiles";
import type { Mesher } from "../voxel/pieces";
import type { Foamer } from "../foamers/foamer";
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

/** PT-01 stage 2: one of every Foamer type, in a line across the range, held
 *  so it stands still. The types come from `data/foamers.json` (`types`), in
 *  its own order, never hard-coded here.
 *
 *  The line is centred on the player's start, `distanceMetres` in front of it
 *  along -z, `spacingMetres` apart, each turned to face the player. Returns
 *  the Foamers made, in data order, with the type each one is: the page puts
 *  a label above each. */
export function createLineup(
  foamers: FoamerSystem,
  playerStart: THREE.Vector3,
  types: string[],
  distanceMetres: number,
  spacingMetres: number,
): { type: string; foamer: Foamer }[] {
  const out: { type: string; foamer: Foamer }[] = [];
  const n = types.length;
  // One of every type must fit, so the cap takes at least the line's size.
  if (foamers.spawnCap < n) foamers.spawnCap = n;
  for (let i = 0; i < n; i++) {
    // An arc round the player's start, so every Foamer is the same distance
    // away and a time to kill compares across types (review fix: a straight
    // row put the ends nearly twice as far). spacingMetres along the arc.
    const a = (i - (n - 1) / 2) * spacingMetres / distanceMetres;
    const f = foamers.spawn(
      new THREE.Vector3(
        playerStart.x + Math.sin(a) * distanceMetres, 0,
        playerStart.z - Math.cos(a) * distanceMetres,
      ),
      playerStart,
      types[i]!,
    );
    if (!f) break; // the spawner's hard cap (SPAWNER.max) is in the way
    // Stand still, and stay in the pose it spawned in.
    f.state = "idle";
    f.stateTime = 0;
    f.agent = null;
    f.agentInput = null;
    f.setAttack(null);
    foamers.held.add(f);
    out.push({ type: types[i]!, foamer: f });
  }
  return out;
}

/** PT-03 stage 3: the punch test's row: three F01s straight ahead, one
 *  behind another, each `spacingMetres` further. All of them stand nearer
 *  than the arc, so it keeps the arc clear, but a straight shot from the
 *  player passes all three. They are held like the line. Returns the Foamers
 *  made, near first. */
export function createPierceRow(
  foamers: FoamerSystem,
  playerStart: THREE.Vector3,
  type: string,
  distanceMetres: number,
  spacingMetres: number,
  count: number,
): Foamer[] {
  const out: Foamer[] = [];
  // The row and the line share the cap, so it takes at least the sum of
  // what is already in the world and the row's size.
  if (foamers.spawnCap < foamers.list.length + count) foamers.spawnCap = foamers.list.length + count;
  for (let i = 0; i < count; i++) {
    const f = foamers.spawn(
      new THREE.Vector3(playerStart.x, 0, playerStart.z - distanceMetres - i * spacingMetres),
      playerStart,
      type,
    );
    if (!f) break; // the spawner's hard cap is in the way
    // Stand still, and stay in the pose it spawned in, like the line.
    f.state = "idle";
    f.stateTime = 0;
    f.agent = null;
    f.agentInput = null;
    f.setAttack(null);
    foamers.held.add(f);
    out.push(f);
  }
  return out;
}

/** PT-01 stage 2: Respawn (the menu's button, and key T: R is reload). Take
 *  the whole line out and put it back fresh, in the same order, at full
 *  health. Returns the new line, in data order, so the page can put its
 *  labels on it. */
export function respawnLineup(
  foamers: FoamerSystem,
  playerStart: THREE.Vector3,
  types: string[],
  distanceMetres: number,
  spacingMetres: number,
  pierceRow?: { type: string; distanceMetres: number; spacingMetres: number; count: number },
): { type: string; foamer: Foamer }[] {
  foamers.clear();
  const line = createLineup(foamers, playerStart, types, distanceMetres, spacingMetres);
  if (pierceRow) createPierceRow(foamers, playerStart, pierceRow.type, pierceRow.distanceMetres, pierceRow.spacingMetres, pierceRow.count);
  return line;
}
