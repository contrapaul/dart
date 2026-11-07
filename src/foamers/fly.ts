import type { FoamerSpec } from "./foamer";

// GAME-10j: the jet flight numbers. Reuses the float's path (PLAN section
// 14): a type that flies carries its numbers in its spec (data/foamers.json,
// `fly`); every other type has none, so the Foamer system runs its ordinary
// gravity and floor fit for it. Its legs carry the floor walk once every jet
// is gone.

export interface FlySpec {
  /** Feet metres over the floor under it while it flies. */
  hoverMetres: number;
  /** The visual bob on top of the hover, metres. */
  bobMetres: number;
  /** The hover once a jet is lost, metres. */
  damagedHoverMetres: number;
  /** The speed share once a jet is lost. */
  damagedSpeedShare: number;
  /** The parts that hold it up (its jets). With none of them left it is
   *  on the floor. The wings are decoration, so they are not listed.
   *  Same field as the float's fins: the flight runs the float's path
   *  unchanged (PLAN section 14). */
  fins: string[];
}

/** The flight numbers of a type, or null when it does not fly. */
export function flyOf(spec: FoamerSpec): FlySpec | null {
  return (spec as { fly?: FlySpec }).fly ?? null;
}
