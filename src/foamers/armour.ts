import type { FoamerSpec } from "./foamer";

// GAME-10b: armour plates. A type's spec may name parts in `armour`
// (data/foamers.json), each with a damage multiplier and a carve
// multiplier: the Darter's lime chest and brow shrug a dart off and chip
// slowly, its orange back takes extra. Parts not named are ordinary.
//
// GAME-10e: a plate may also name an arc (`arcDeg`), which is how much of
// the front it covers. The Blocker's shield only works across the front: a
// dart out of that arc, or a shield that is down (a staggered Blocker),
// takes full damage. A plate with no arc covers every side, as the
// Darter's do.

export interface ArmourPart {
  damage: number;
  carve: number;
  /** GAME-10e: degrees of the front that the plate covers; unset means all. */
  arcDeg?: number;
  /** PT-07: the share of a turned dart's damage taken off the plate's own
   *  hp (the F11's shield wears down under darts and breaks off). Only
   *  meaningful on an arc plate, where a covered dart does no damage. */
  wear?: number;
}

/** The armour on one part id, or null when the part is not armoured. */
export function armourOf(spec: FoamerSpec, partId: string): ArmourPart | null {
  const table = (spec as { armour?: Record<string, Partial<ArmourPart>> }).armour;
  const a = table?.[partId];
  if (!a || partId.startsWith("_")) return null;
  return { damage: a.damage ?? 1, carve: a.carve ?? 1, arcDeg: a.arcDeg, wear: a.wear };
}

/**
 * GAME-10e: is a hit on `partId` inside the plate's arc? `facing` is the
 * Foamer's forward on the ground plane, `from` the direction the hit came
 * from (from the hit point back toward the shooter, unit). Always true for
 * a plate with no arc. A shield that is down (the Blocker is staggered)
 * does not cover anything.
 */
export function plateFaces(
  spec: FoamerSpec,
  partId: string,
  facingX: number,
  facingZ: number,
  fromX: number,
  fromZ: number,
  shieldDown: boolean,
): boolean {
  const a = armourOf(spec, partId);
  if (!a) return false;
  if (a.arcDeg === undefined) return true;
  if (shieldDown) return false;
  const len = Math.hypot(fromX, fromZ);
  if (len < 1e-6) return false;
  const cos = (facingX * fromX + facingZ * fromZ) / len;
  return cos >= Math.cos((a.arcDeg / 2) * (Math.PI / 180));
}
