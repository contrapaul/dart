import * as THREE from "three";
import type { ShotChunk } from "../weapons/darts";

// GAME-09b: the chunk finish's carve parts, kept pure so a test can try the
// cases without a world. PT-03: the gates (tiers, minShare, range) are gone;
// one impact number (src/foamers/impact.ts) now decides down, chunk or pop.
// The numbers are data: catastrophic.chunk in data/foamers.json, and the
// chunk block on B03 and on B01's slug mod in data/blasters.json.

/** The Foamer base's chunk block: the carve itself. */
export interface ChunkSpec {
  carveRadius: number;
  debrisMax: number;
  push: number;
  /** At popAt the hole has grown from carveRadius to this many metres. */
  chunkGrowMaxMetres: number;
  /** At popAt the hole's own burst carries this many extra chunks. */
  debrisGrowMax: number;
}

/** One dart's damage on a Foamer, tagged with the shot it left on.
 *  healthBefore: the Foamer's health as it was before this shot's first
 *  dart (the impact rule's overkill needs the health the killing shot
 *  found, PT-03). */
export interface ShotDamage {
  id: number;
  time: number;
  amount: number;
  point: THREE.Vector3;
  healthBefore: number;
}

/** Entries kept per Foamer; the oldest goes first. One shot's darts land in
 *  the same step or the next, so this covers many shots at once. */
export const SHOT_DAMAGE_MAX = 64;

/** Record one dart's damage on the shot it left on. healthBefore is the
 *  Foamer's health before this dart; the shot's first dart's value is kept
 *  as the shot's own (the health the killing shot found). */
export function addShotDamage(
  list: ShotDamage[],
  id: number,
  time: number,
  amount: number,
  point: THREE.Vector3,
  healthBefore: number,
): void {
  const first = list.find((d) => d.id === id);
  const before = first ? first.healthBefore : healthBefore;
  list.push({ id, time, amount, point: point.clone(), healthBefore: before });
  if (list.length > SHOT_DAMAGE_MAX) list.shift();
}

/** One shot's darts on this Foamer inside the window: their total damage,
 *  their mean hit point, and the health the shot found. Null when the shot
 *  has none there. */
export function shotSummary(
  list: ShotDamage[],
  id: number,
  time: number,
  window: number,
): { total: number; mean: THREE.Vector3; healthBefore: number } | null {
  const cutoff = time - window;
  let total = 0;
  let n = 0;
  let healthBefore = 0;
  const mean = new THREE.Vector3();
  for (const d of list) {
    if (d.id !== id || d.time < cutoff) continue;
    total += d.amount;
    mean.add(d.point);
    healthBefore = d.healthBefore;
    n++;
  }
  if (n === 0) return null;
  return { total, mean: mean.divideScalar(n), healthBefore };
}

/** GAME-09b: the hole's carve radius in metres, before the impact grows it
 *  (impactChunkRadius in impact.ts). The Foamer base's carveRadius is the
 *  chunk, and the blaster's own is the blast's; the larger wins, so a slug
 *  in the Leviathan (not a loadout, but a data combination that would work)
 *  still carves its own hole. */
export function chunkRadius(spec: ChunkSpec, shot: ShotChunk): number {
  return Math.max(spec.carveRadius, shot.carveRadius);
}
