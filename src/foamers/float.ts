import type { FoamerSpec } from "./foamer";

// GAME-10c: the float numbers. A type that floats carries them in its spec
// (data/foamers.json, `float`); every other type has none, so the Foamer
// system runs its ordinary gravity and floor fit for it.

export interface FloatSpec {
  /** Feet metres over the floor under it while it floats. */
  hoverMetres: number;
  /** The visual bob on top of the hover, metres. */
  bobMetres: number;
  /** The hover once a fin is lost, metres. */
  damagedHoverMetres: number;
  /** The speed share once a fin is lost. */
  damagedSpeedShare: number;
  /** The parts that hold it up. With none of them left it sits on the
   *  floor. The tendrils are decoration, so they are not listed. */
  fins: string[];
}

/** The float numbers of a type, or null when it does not float. */
export function floatOf(spec: FoamerSpec): FloatSpec | null {
  return (spec as { float?: FloatSpec }).float ?? null;
}
