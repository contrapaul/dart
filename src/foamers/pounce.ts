import type { FoamerSpec } from "./foamer";

// GAME-10m: the Ambusher's pounce, and where it lands. A type that pounces
// carries the numbers in its spec (data/foamers.json, `pounce`); every
// other type has none, so the Foamer system never enters the pounce path
// for it. Unlike the Brawler's leap (leap.ts) the pounce lands on the spot
// it saw: no shockwave ring, and a landing inside hitMetres of the player
// is the hit, through the ordinary hit path.

export interface PounceSpec {
  /** It pounces when the player is between these distances (metres). */
  minMetres: number;
  maxMetres: number;
  /** Seconds before it may pounce again (from the start of the crouch). */
  cooldownSeconds: number;
  /** The crouch before the leap, seconds: the telegraph. */
  crouchSeconds: number;
  /** Metres per second along the ground during the flight. */
  speed: number;
  /** The apex of the arc over the ground it leaves, metres. */
  arcMetres: number;
  /** The hit radius at the landing (metres): the landing is the one
   *  moment the pounce can hit. */
  hitMetres: number;
}

/** The pounce numbers of a type, or null when it does not pounce. */
export function pounceOf(spec: FoamerSpec): PounceSpec | null {
  return (spec as { pounce?: PounceSpec }).pounce ?? null;
}
