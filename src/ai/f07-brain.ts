import type { LeapSpec } from "../foamers/leap";

// F07 Brawler's decision layer (GAME-10f). It fights with the F01 melee
// brain (its one attack token is `melee`, so the system's brain pick already
// gives it `f01`): it walks in and punches in reach like a Roamer. What is
// the Brawler's own is the leap, and the one question the brain side asks
// is whether a leap may start. The arc, the landing point and the ring are
// the Foamer side, in src/foamers/leap.ts, the way the Darter's charge line
// is in src/foamers/charge.ts and only `decideCharge` lives here.
//
// The two states it adds (crouch, leaping) are run by the Foamer system's
// state machine, as the Darter's three are.

/** What one step tells the leap logic (the Foamer side fills it in). */
export interface LeapInput {
  /** Metres to the player, ground plane. */
  distance: number;
  /** Seconds until it may leap again (the crouch starts it). */
  cooldownLeft: number;
  /** It is on its feet: a legless Brawler crawls, it cannot leap. */
  onFeet: boolean;
}

/** May it start the crouch that leads to a leap? Only with the cooldown
 *  spent, on its feet, and with the player between the minimum (too close
 *  to be worth a leap) and the maximum (too far to reach). Like the
 *  charger's `decideCharge`, it is up to the caller to be in a state that
 *  may start one. */
export function decideLeap(input: LeapInput, spec: LeapSpec): boolean {
  if (!input.onFeet || input.cooldownLeft > 0) return false;
  return input.distance >= spec.minMetres && input.distance <= spec.maxMetres;
}
