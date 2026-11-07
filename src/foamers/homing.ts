import type { FoamerSpec } from "./foamer";
import type { BallKind } from "./projectiles";
import { BALL_MATERIAL } from "./projectiles";
import { materialId } from "../voxel/materials";

// GAME-10j: the homing shot numbers. The F10's ball is pink (parryable,
// the shared BALL_MATERIAL, so the player's shield works on it), slower
// than a thrown ball, with little gravity, and it steers toward the
// player's chest for seconds while it lives at turnDegPerSecond before
// it flies straight. Every number is in data (type F10, `homing` in
// data/foamers.json); a type without the block has no homing shot.

export interface HomingSpec {
  /** The ball's own speed, m/s. */
  speed: number;
  /** The ball's own gravity, m/s^2. */
  gravity: number;
  /** The ball's radius in metres (its mesh scale). */
  radius: number;
  /** The ball's own lifetime in seconds. */
  lifetime: number;
  /** The chunks it bursts into. */
  chunks: number;
  /** The live cap: never more than this many homing balls in the air. */
  maxLive: number;
  /** How long the ball steers to the player's chest, seconds. */
  seconds: number;
  /** The turn the step never applies more of: degrees per second. */
  turnDegPerSecond: number;
}

/** The homing numbers of a type, or null when it has none. */
export function homingOf(spec: FoamerSpec): HomingSpec | null {
  return (spec as { homing?: HomingSpec }).homing ?? null;
}

/** The F10's shot as a kind: pink and parryable, its own numbers. */
export function homingShotKind(h: HomingSpec): BallKind {
  return {
    attack: "homingShot",
    speed: h.speed,
    gravity: h.gravity,
    radius: h.radius,
    lifetime: h.lifetime,
    chunks: h.chunks,
    material: materialId("foam-pink"),
    mesh: BALL_MATERIAL,
    bounces: 0,
    maxLive: h.maxLive,
    homing: { seconds: h.seconds, turnDegPerSecond: h.turnDegPerSecond },
  };
}
