import type { FoamerSpec, Foamer } from "./foamer";

// GAME-10l stage 3: the Biomechanic's short damaging spray. A type that
// sprays carries its numbers in its spec (data/foamers.json, `spray`);
// every other type has none. With no ally to heal and the player within
// the range, the Biomechanic winds up (the windup is the telegraph and
// the player's window to raise the shield) and sprays for its own time,
// one small hit at a time through the page's ordinary hit path (the
// raised shield blocks its share, the parry turns nothing: the card
// says not parryable). The pattern of pellets: the numbers stay in data,
// the code only reads them.

export interface SpraySpec {
  /** The range the player must be within for the windup to start, metres. */
  range: number;
  /** The windup before the spray, seconds: the raise-and-aim telegraph. */
  windup: number;
  /** How long it sprays, seconds. */
  seconds: number;
  /** Damage per second of spray, taken in small hits (the tick's below). */
  perSecond: number;
  /**
   * Seconds between the small hits. Past the player's post-hit grace
   * (data/player.json health.hitGrace) by design, so a spray pours every
   * second of its `seconds` through; a shorter tick would lose the hits
   * the grace eats.
   */
  tick: number;
}

/** The spray numbers of a type, or null when it does not spray. */
export function sprayOf(spec: FoamerSpec): SpraySpec | null {
  return (spec as { spray?: SpraySpec }).spray ?? null;
}

/** Whether this Foamer can still spray: the wand is the nozzle and the
 *  tank the tank it is loaded from (the card's stage 3: the F13's spray
 *  needs both, while the healing stream and the walk need only the
 *  tank, per stage 2's read). */
export function canSpray(spec: FoamerSpec, f: Foamer): boolean {
  return sprayOf(spec) !== null && f.parts.has("wand") && f.parts.has("tank");
}
