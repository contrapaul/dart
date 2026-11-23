import type { SlamSpec } from "../foamers/leap";

// GAME-10n: the F14's floor slam, decided the way the Brawler's leap
// (src/ai/f07-brain.ts) and the Ambusher's pounce (src/ai/f12-brain.ts)
// are. It fights with the maul on the F01 melee brain; what is its own is
// the slam, and the one question the brain side asks is whether a slam may
// start. The ring itself is the Foamer side (src/foamers/leap.ts and the
// windup branch in src/foamers/foamers.ts). Like decideLeap it is up to the
// caller to be in a state that may start one.

export interface SlamInput {
  /** Metres to the player, ground plane. */
  distance: number;
  /** Seconds until it may slam again (the rear starts it). */
  cooldownLeft: number;
  /** It has legs to stand on: a legless F14 crawls, and the card gives it
   *  no slam (it is the ground it needs, not the swing). */
  onFeet: boolean;
  /** The maul head is still on the handle. With it broken off there is
   *  nothing to bring down. */
  hasMaul: boolean;
  /** The player is in line of sight (the card: the slam needs sight). */
  inSight: boolean;
}

/** May it start the rear that leads to a slam? Only with the cooldown
 *  spent, on its feet, in sight, with the maul head, and with the player between the
 *  minimum (the maul itself covers that) and the maximum (past it the ring
 *  fades out before it arrives). */
export function decideSlam(input: SlamInput, spec: SlamSpec): boolean {
  if (!input.onFeet || !input.hasMaul || !input.inSight || input.cooldownLeft > 0) return false;
  return input.distance >= spec.minMetres && input.distance <= spec.maxMetres;
}
