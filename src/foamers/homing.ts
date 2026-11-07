import type { FoamerSpec } from "./foamer";

// GAME-10j: the homing shot numbers. The F10's ball is pink (parryable,
// the shared BALL_MATERIAL), slower than a thrown one, with little gravity,
// and it steers toward the player's chest for homing seconds at a limited
// turn rate before flying straight. Every number is in data (type F10,
// `homing` in data/foamers.json); a type without the block has no homing
// shot yet.

export interface HomingSpec {
  /** The ball's own speed, m/s. */
  speed: number;
  /** The ball's own gravity, m/s^2. */
  gravity: number;
  radius: number;
  lifetime: number;
  chunks: number;
  /** The live cap: never more than this many homing balls in the air. */
  maxLive: number;
  /** How long the ball steers to the player's chest, seconds. */
  seconds: number;
  /** The limiter the steering per step never passes, degrees a second. */
  turnDegPerSecond: number;
}

/** The homing numbers of a type, or null when it has none. */
export function homingOf(spec: FoamerSpec): HomingSpec | null {
  return (spec as { homing?: HomingSpec }).homing ?? null;
}
