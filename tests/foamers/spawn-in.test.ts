import { describe, expect, it } from "vitest";
import { spawnInPose, SPAWN_IN, type SpawnInSpec } from "../../src/foamers/spawn-in";

const SPEC: SpawnInSpec = SPAWN_IN;

describe("spawnInPose", () => {
  it("is hidden at the start", () => {
    const p = spawnInPose(0, SPEC);
    expect(p.active).toBe(false);
    expect(p.scale).toBe(SPEC.growFrom);
  });
  it("is growing in the middle", () => {
    const p = spawnInPose(SPEC.seconds * 0.5, SPEC);
    expect(p.active).toBe(false);
    expect(p.scale).toBeGreaterThan(SPEC.growFrom);
    expect(p.scale).toBeLessThanOrEqual(SPEC.overshoot);
  });
  it("reaches the overshoot before settling", () => {
    const portal = SPEC.portalShare * SPEC.seconds;
    const growEnd = portal + (SPEC.seconds - portal) * 0.55;
    const p = spawnInPose(growEnd, SPEC);
    expect(p.active).toBe(false);
    expect(p.scale).toBeCloseTo(SPEC.overshoot, 5);
  });
  it("is exactly 1 and active at the end and after", () => {
    expect(spawnInPose(SPEC.seconds, SPEC)).toEqual({ scale: 1, active: true });
    expect(spawnInPose(SPEC.seconds + 5, SPEC)).toEqual({ scale: 1, active: true });
  });
});
