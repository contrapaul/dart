import * as THREE from "three";
import type { ShotChunk } from "../weapons/darts";

// GAME-09b: the chunk finish's rule, kept pure so a test can try the cases
// without a world. The numbers are data: catastrophic.chunk in
// data/foamers.json, and the chunk block on B03 and on B01's slug mod in
// data/blasters.json.

/** The Foamer base's chunk block. */
export interface ChunkSpec {
  minShare: number;
  tiers: string[];
  carveRadius: number;
  debrisMax: number;
  push: number;
}

/** One dart's damage on a Foamer, tagged with the shot it left on.
 *  preWeakened: the Foamer was already finishable when the shot's first dart
 *  landed, so a Fodder tier can be chunked. A volley that weakens a Foamer
 *  and then kills it does not count: it was not weakened before the shot. */
export interface ShotDamage {
  id: number;
  time: number;
  amount: number;
  point: THREE.Vector3;
  preWeakened: boolean;
}

/** Entries kept per Foamer; the oldest goes first. One shot's darts land in
 *  the same step or the next, so this covers many shots at once. */
export const SHOT_DAMAGE_MAX = 64;

/** Record one dart's damage on the shot it left on. */
export function addShotDamage(
  list: ShotDamage[],
  id: number,
  time: number,
  amount: number,
  point: THREE.Vector3,
  finishWeakened: boolean,
): void {
  // The shot's first dart decides: a volley that weakens a Foamer and then
  // kills it does not make it a chunk.
  const first = list.find((d) => d.id === id);
  const preWeakened = first ? first.preWeakened : finishWeakened;
  list.push({ id, time, amount, point: point.clone(), preWeakened });
  if (list.length > SHOT_DAMAGE_MAX) list.shift();
}

/** One shot's darts on this Foamer inside the window: their total damage,
 *  their mean hit point, and whether the Foamer was already finishable when
 *  the shot began. Null when the shot has none there. */
export function shotSummary(
  list: ShotDamage[],
  id: number,
  time: number,
  window: number,
): { total: number; mean: THREE.Vector3; preWeakened: boolean } | null {
  const cutoff = time - window;
  let total = 0;
  let n = 0;
  let preWeakened = false;
  const mean = new THREE.Vector3();
  for (const d of list) {
    if (d.id !== id || d.time < cutoff) continue;
    total += d.amount;
    mean.add(d.point);
    if (d.preWeakened) preWeakened = true;
    n++;
  }
  if (n === 0) return null;
  return { total, mean: mean.divideScalar(n), preWeakened };
}

/** GAME-09b: is this killing hit a chunk finish? It needs a blaster or mod
 *  with a chunk block, a Foamer of a listed rig tier or one already
 *  finishable, a shot whose mean hit point is inside the blaster's range
 *  from its muzzle, and damage from that shot alone of at least minShare of
 *  the Foamer's max health. */
export function judgeChunk(
  spec: ChunkSpec,
  shot: ShotChunk | null,
  muzzle: THREE.Vector3 | null,
  tier: string,
  finishWeakened: boolean,
  maxHealth: number,
  shotDamage: number,
  mean: THREE.Vector3,
): boolean {
  if (!shot) return false;
  if (!spec.tiers.includes(tier) && !finishWeakened) return false;
  if (shotDamage < spec.minShare * maxHealth) return false;
  if (muzzle && muzzle.distanceTo(mean) > shot.rangeMetres) return false;
  return true;
}

/** GAME-09b: the hole's carve radius in metres. The Foamer base's
 *  carveRadius is the chunk, and the blaster's own is the blast's; the
 *  larger wins, so a slug in the Leviathan (not a loadout, but a data
 *  combination that would work) still carves its own hole. */
export function chunkRadius(spec: ChunkSpec, shot: ShotChunk): number {
  return Math.max(spec.carveRadius, shot.carveRadius);
}
