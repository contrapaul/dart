import * as THREE from "three";
import type { FoamerSpec } from "./foamer";
import type { Foamer } from "./foamer";
import type { BallKind } from "./projectiles";
import { materialId, linearColorTable } from "../voxel/materials";

// GAME-10h: the Trawler's wall of foam balls. A type that fires walls carries
// the numbers in its spec (data/foamers.json, `wall`); every other type has
// none, so its ranged attacks keep the shared ball. The kind a launch takes
// is built here from the spec, so the numbers stay in data (the pattern of
// pellet.ts).
//
// A wall is a flat row of balls across the aim line at the player's chest,
// slow enough to read, with a gap of gapBalls side by side balls left out at
// a seeded position so a player who reads it can step through. The balls are
// drawn with their own material, deliberately not BALL_MATERIAL, so the
// pages do not parry them (CONTENT-PLAN gives F08's attack no P).

export interface WallSpec {
  /** Balls each launcher fires: the row is twice this across. */
  ballsPerLauncher: number;
  /** Metres between the row's slots. */
  spacingMetres: number;
  /** Side-by-side balls left out of the row, never at its ends. */
  gapBalls: number;
  /** Metres the row sits ahead of the Foamer's centre when it fires. */
  muzzleMetres: number;
  /** The row's height below the player's eye (its chest). */
  chestBelowEyeMetres: number;
  speed: number;
  gravity: number;
  radius: number;
  lifetime: number;
  /** Foam chunks at each burst. */
  chunks: number;
  /** Hard cap on live balls of this kind. */
  maxLive: number;
  /** The seed the gap's PRNG starts from (never Math.random()). */
  seed: number;
  /** The launcher parts, left then right. Each owns its half of the row and
   *  is a weak point; with both gone the wall cannot fire. */
  launchers: string[];
  /** What a dart on a launcher takes (CONTENT-PLAN 3.1: the launchers are
   *  the weak points). */
  weakpointMultiplier: number;
}

/** The wall numbers of a type, or null when it does not fire walls. */
export function wallOf(spec: FoamerSpec): WallSpec | null {
  return (spec as { wall?: WallSpec }).wall ?? null;
}

/** Whether this Foamer can still fire a wall: at least one launcher. With
 *  both gone it cannot (chooseAttack falls through to the stomp by itself). */
export function canFireWall(spec: FoamerSpec, f: Foamer): boolean {
  const wall = wallOf(spec);
  return wall !== null && wall.launchers.some((id) => f.parts.has(id));
}

/** The launcher parts whose halves survive. */
export function liveLaunchers(spec: FoamerSpec, f: Foamer): string[] {
  const wall = wallOf(spec);
  return wall ? wall.launchers.filter((id) => f.parts.has(id)) : [];
}

/** The damage multiplier a dart on one of the launchers takes. */
export function wallWeakMultiplier(spec: FoamerSpec, partId: string): number {
  const wall = wallOf(spec);
  return wall && wall.launchers.includes(partId) ? wall.weakpointMultiplier : 1;
}

/** The wall's own material: orange, and not BALL_MATERIAL, so the pages do
 *  not parry a wall ball (the pattern of PELLET_MATERIAL). */
export const WALL_MATERIAL = new THREE.MeshStandardMaterial({
  color: new THREE.Color().fromArray(linearColorTable(), materialId("foam-orange") * 3),
  roughness: 0.6,
});

/** The wall ball: slow, flat, and bursting on the first touch. */
export function wallKind(wall: WallSpec): BallKind {
  return {
    attack: "wall", speed: wall.speed, gravity: wall.gravity,
    radius: wall.radius, lifetime: wall.lifetime, chunks: wall.chunks,
    material: materialId("foam-orange"), mesh: WALL_MATERIAL,
    bounces: 0, maxLive: wall.maxLive,
  };
}

/** The row's slots that survive, as indices 0..2*ballsPerLauncher-1 across
 *  the aim line: the halves of the launchers still attached, less a run of
 *  gapBalls side-by-side slots dropped at a seeded position, never at the
 *  row's ends. rng returns [0,1); the caller seeds it from the data seed and
 *  the wall's number, so the same seed gives the same gap. */
export function wallSlots(wall: WallSpec, live: string[], rng: () => number): number[] {
  const per = Math.max(1, Math.floor(wall.ballsPerLauncher));
  const row: number[] = [];
  wall.launchers.forEach((id, side) => {
    if (!live.includes(id)) return;
    for (let i = 0; i < per; i++) row.push(side * per + i);
  });
  // The gap runs over what is left, so a one-launcher wall has a gap in its
  // half too. room: the start positions that keep the gap off both ends.
  const room = row.length - wall.gapBalls - 1;
  if (room < 1) return row;
  const start = 1 + Math.min(room - 1, Math.max(0, Math.floor(rng() * room)));
  return row.filter((_, i) => i < start || i >= start + wall.gapBalls);
}
