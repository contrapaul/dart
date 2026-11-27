import spawnData from "../../data/spawn.json";

// SPAWN-01: a Foamer from a wave or a trigger teleports in. This module is
// the timeline, plain numbers only (no Three.js, no DOM), so it is tested
// headless. The spawn-core card fills it in; until then a Foamer arrives at
// full size at once, as before.

export interface SpawnInSpec {
  seconds: number;
  portalShare: number;
  growFrom: number;
  /** The share of the time after the portal spent growing to the
   *  overshoot; the rest settles back to 1. */
  growShare: number;
  overshoot: number;
  maxLive: number;
  look: {
    ringColour: string;
    foamColour: string;
    ringRadius: number;
    columnHeight: number;
    chunks: number;
    chunkSpeed: number;
    /** Metres a second squared pulling the chunks down. */
    gravity: number;
  };
}

export const SPAWN_IN = spawnData as SpawnInSpec;

/** What a Foamer looks like and may do `t` seconds into its arrival. */
export interface SpawnInPose {
  /** Uniform scale of the Foamer's drawn body, about its feet. */
  scale: number;
  /** True once the arrival is over: it may move, attack and be hit. */
  active: boolean;
}

/** The pose `t` seconds after the teleport began. */
export function spawnInPose(t: number, spec: SpawnInSpec = SPAWN_IN): SpawnInPose {
  const portal = spec.portalShare * spec.seconds;
  if (t < portal) return { scale: spec.growFrom, active: false };
  const growEnd = portal + (spec.seconds - portal) * spec.growShare;
  if (t < growEnd) {
    // The grow: eased out, from growFrom to the overshoot.
    const u = (t - portal) / (growEnd - portal);
    const e = 1 - Math.pow(1 - u, 3);
    return { scale: spec.growFrom + (spec.overshoot - spec.growFrom) * e, active: false };
  }
  if (t < spec.seconds) {
    // The settle: eased back from the overshoot to 1.
    const u = (t - growEnd) / (spec.seconds - growEnd);
    const e = 1 - Math.pow(1 - u, 2);
    return { scale: spec.overshoot + (1 - spec.overshoot) * e, active: false };
  }
  return { scale: 1, active: true };
}
