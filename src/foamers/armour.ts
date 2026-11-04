import type { FoamerSpec } from "./foamer";

// GAME-10b: armour plates. A type's spec may name parts in `armour`
// (data/foamers.json), each with a damage multiplier and a carve
// multiplier: the Darter's lime chest and brow shrug a dart off and chip
// slowly, its orange back takes extra. Parts not named are ordinary.

export interface ArmourPart {
  damage: number;
  carve: number;
}

/** The armour on one part id, or null when the part is not armoured. */
export function armourOf(spec: FoamerSpec, partId: string): ArmourPart | null {
  const table = (spec as { armour?: Record<string, Partial<ArmourPart>> }).armour;
  const a = table?.[partId];
  if (!a) return null;
  return { damage: a.damage ?? 1, carve: a.carve ?? 1 };
}
