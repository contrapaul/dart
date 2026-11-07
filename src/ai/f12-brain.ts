import type { PounceSpec } from "../foamers/pounce";

// GAME-10m: the Ambusher's pounce, decided the way the Brawler's leap is
// (src/ai/f07-brain.ts) plus its own two gates: it must see the player
// (the card: "in sight"), and it lands on them, so the decision is worth
// the telegraph only inside its band. Like decideLeap it is up to the
// caller to be in a state that may start one.

export interface PounceInput {
  /** Metres from the player. */
  distance: number;
  /** Seconds until the cooldown is spent. */
  cooldownLeft: number;
  /** It has legs to launch from. */
  onFeet: boolean;
  /** The player is in line of sight. */
  inSight: boolean;
}

/** May it start the crouch that leads to a pounce? Only with the cooldown
 *  spent, on its feet, in sight of the player, and with the player between
 *  the minimum (too close: the claw does that job) and the maximum (too
 *  far to reach). */
export function decidePounce(input: PounceInput, spec: PounceSpec): boolean {
  if (!input.onFeet || !input.inSight || input.cooldownLeft > 0) return false;
  return input.distance >= spec.minMetres && input.distance <= spec.maxMetres;
}
