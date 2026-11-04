import type { FoamerSpec } from "./foamer";

// GAME-10b: the charger numbers. A type that charges carries them in its
// spec (data/foamers.json, `charge`); every other type has none, so the
// Foamer system runs its ordinary attack path for it.

export interface ChargeSpec {
  /** Metres per second on the run. */
  speed: number;
  /** The longest straight run, metres. */
  metres: number;
  /** Where a charge may start, metres. */
  rangeMetres: number;
  /** The scrape before the run, seconds. */
  telegraphSeconds: number;
  /** The stagger after hitting a wall, seconds: its back is open. */
  wallStunSeconds: number;
  /** How long the player it runs into cannot move, seconds. */
  playerStunSeconds: number;
  /** Dust chunks thrown at the scrape, and their size, metres. */
  dustCount: number;
  dustSize: number;
  /** A shield charge into its front plates bounces off. */
  plateStopsShield: boolean;
  /** The front arc the plates cover, degrees. */
  plateArcDeg: number;
}

/** The charge numbers of a type, or null when it does not charge. */
export function chargeOf(spec: FoamerSpec): ChargeSpec | null {
  return (spec as { charge?: ChargeSpec }).charge ?? null;
}
