import type { ImpactRange } from "../weapons/darts";
import blastersJson from "../../data/blasters.json";

// PT-03: one impact number decides how a killed Foamer dies. It replaces the
// pop rule's popTypes and share and the chunk rule's tiers, minShare and
// finishWeakened gates (tasks/PT-03.md, Paul 2026-11-08: "base the
// explosiveness on the amount of overkill + distance to target, so if no
// drop off and massive overkill we get a massive impact").
//
// Kept pure, like chunk.ts, so a test can try the cases without a world.
// The numbers are data: catastrophic in data/foamers.json, the impact block
// in data/blasters.json (its shared `impact` block holds the defaults).

/** The Foamer base's catastrophic block, as far as the impact rule reads it.
 *  window is kept: overkill sums one shot's darts inside it. */
export interface CatastrophicSpec {
  window: number;
  /** Below this the Foamer goes down, from it to popAt it chunks, at or
   *  above it pops. */
  chunkAt: number;
  popAt: number;
  /** The down's kill push is 1 + downPushShare x impact. */
  downPushShare: number;
  /** The pop's own burst at popAt and above: popDebrisMax extra foam chunks,
   *  thrown popPushShare times as hard as the base speed. The debris
   *  system's ring cap (destruction.json debris.max) stays hard above all. */
  popDebrisMax: number;
  popPushShare: number;
  /** The chunk finish's block (chunk.ts owns carveRadius and debrisMax). */
  chunk: {
    carveRadius: number;
    debrisMax: number;
    push: number;
    /** At popAt the hole has grown from carveRadius to chunkGrowMaxMetres. */
    chunkGrowMaxMetres: number;
    /** At popAt the hole's own burst carries this many extra chunks. */
    debrisGrowMax: number;
  };
}

export type ImpactOutcome = "down" | "chunk" | "pop";

/** The shared distance block in data/blasters.json: every blaster without
 *  its own impact block falls back to this (PT-03). */
export const DEFAULT_IMPACT: ImpactRange =
  (blastersJson as unknown as { impact: ImpactRange }).impact;

/** The killing shot's damage on this Foamer inside the window, minus the
 *  health it had left before the shot. Never below 0. */
export function overkillOf(shotDamage: number, healthBefore: number): number {
  return Math.max(0, shotDamage - healthBefore);
}

/** 1 within fullMetres of the muzzle, falling in a straight line to 0 at
 *  zeroMetres. */
export function nearOf(distanceMetres: number, range: ImpactRange): number {
  if (distanceMetres <= range.fullMetres) return 1;
  if (distanceMetres >= range.zeroMetres) return 0;
  const span = range.zeroMetres - range.fullMetres;
  if (span <= 0) return 0;
  return 1 - (distanceMetres - range.fullMetres) / span;
}

/** The one number: (overkill / max health) x near. */
export function impactOf(overkill: number, maxHealth: number, near: number): number {
  if (maxHealth <= 0) return 0;
  return (overkill / maxHealth) * Math.max(0, Math.min(1, near));
}

/** Share (0..1) of the way from no impact to popAt: how big this kill is.
 *  Everything that "grows with impact" (the down's push, the hole's radius
 *  and its debris count, the pop's burst) scales by this, so a kill right at
 *  popAt gets the full values in the data. */
export function growthOf(spec: CatastrophicSpec, impact: number): number {
  if (spec.popAt <= 0) return impact > 0 ? 1 : 0;
  return Math.max(0, Math.min(1, impact / spec.popAt));
}

/** The whole rule in one call. distanceMetres is the muzzle to the shot's
 *  mean hit point; an explosion's kill passes range null, which means
 *  near 1 (its damage already falls off with distance). */
export function judgeImpact(
  spec: CatastrophicSpec,
  range: ImpactRange | null,
  shotDamage: number,
  healthBefore: number,
  maxHealth: number,
  distanceMetres: number,
): { overkill: number; near: number; impact: number; outcome: ImpactOutcome } {
  const overkill = overkillOf(shotDamage, healthBefore);
  const near = range === null ? 1 : nearOf(distanceMetres, range);
  const impact = impactOf(overkill, maxHealth, near);
  const outcome = impact >= spec.popAt ? "pop" : impact >= spec.chunkAt ? "chunk" : "down";
  return { overkill, near, impact, outcome };
}

/** The hole's radius in metres at this impact: the chunk rule's base, grown
 *  toward chunkGrowMaxMetres as the impact climbs toward popAt. */
export function impactChunkRadius(spec: CatastrophicSpec, base: number, impact: number): number {
  const grow = spec.chunk.chunkGrowMaxMetres;
  if (grow <= base) return Math.max(base, 0);
  return base + (grow - base) * growthOf(spec, impact);
}

/** Extra chunks in the hole's own burst over the carve's own count. */
export function chunkDebrisExtra(spec: CatastrophicSpec, impact: number): number {
  return Math.round(growthOf(spec, impact) * spec.chunk.debrisGrowMax);
}

/** The pop's extra foam chunks and its burst push share, both growing with
 *  the impact. */
export function popBurstBoost(spec: CatastrophicSpec, impact: number): {
  extraChunks: number;
  pushShare: number;
} {
  const g = growthOf(spec, impact);
  return {
    extraChunks: Math.round(g * spec.popDebrisMax),
    pushShare: 1 + g * spec.popPushShare,
  };
}

/** The down's kill push multiplier: harder the bigger the impact. */
export function downPushOf(spec: CatastrophicSpec, impact: number): number {
  return 1 + growthOf(spec, impact) * spec.downPushShare;
}
