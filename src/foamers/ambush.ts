import type { FoamerSpec } from "./foamer";

// GAME-10m stage 3: the ambush from a growth. A type that lies in wait
// inside a growth piece carries the numbers in its spec
// (data/foamers.json, `ambush`); every other type has none, so a level
// naming it in its ambushes list is rejected by the validator. The system
// that hides and wakes the Foamer is src/level/ambush.ts; the pounce the
// wake starts is the stage 2 one (pounce.ts).

export interface AmbushSpec {
  /** Metres from the growth's box at which the player wakes it. Losing
   *  any voxel of the growth wakes it too, from any distance. */
  wakeMetres: number;
  /** Radius (voxel metres over the volume grid) of the hole carved out
   *  of the growth as it bursts (src/level/ambush.ts). */
  burstRadiusMetres: number;
  /** Seconds between walks of a hidden growth's voxels (the loss test;
   *  the distance test runs every step). */
  recheckSeconds: number;
}

/** The ambush numbers of a type, or null when it does not ambush. */
export function ambushOf(spec: FoamerSpec): AmbushSpec | null {
  return (spec as { ambush?: AmbushSpec }).ambush ?? null;
}
