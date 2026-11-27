import spawnData from "../../data/spawn.json";

// SPAWN-01: a Foamer from a wave or a trigger teleports in. This module is
// the timeline, plain numbers only (no Three.js, no DOM), so it is tested
// headless. The spawn-core card fills it in; until then a Foamer arrives at
// full size at once, as before.

export interface SpawnInSpec {
  seconds: number;
  portalShare: number;
  growFrom: number;
  overshoot: number;
  maxLive: number;
  look: {
    ringColour: string;
    foamColour: string;
    ringRadius: number;
    columnHeight: number;
    chunks: number;
    chunkSpeed: number;
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
  void t;
  void spec;
  return { scale: 1, active: true };
}
