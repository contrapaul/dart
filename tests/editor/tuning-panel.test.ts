import { afterEach, describe, expect, it } from "vitest";
import { mergeTune } from "../../src/editor/tuning-panel";
import { localTuning, setLocalTuningForTest } from "../../src/core/tuning";
import { tuneFoamer } from "../../src/core/tuning";

afterEach(() => setLocalTuningForTest({ version: 1, foamers: {}, blasters: {} }));

describe("tuning panel", () => {
  it("mergeTune merges a patch into the placed Foamer's own tuning", () => {
    expect(mergeTune(undefined, { rig: { speed: 4 } })).toEqual({ rig: { speed: 4 } });
    const merged = mergeTune({ rig: { speed: 4 } }, { spec: { attackRange: 2 } });
    expect(merged).toEqual({ rig: { speed: 4 }, spec: { attackRange: 2 } });
  });

  it("mergeTune replaces attack arrays rather than merging them", () => {
    const merged = mergeTune(
      { spec: { attacks: [{ id: "bonk", damage: 12 }] } },
      { spec: { attacks: [{ id: "bonk", damage: 20 }] } },
    );
    expect(merged).toEqual({ spec: { attacks: [{ id: "bonk", damage: 20 }] } });
  });

  it("an every-type edit writes the shared override (localTuning), not the level", () => {
    tuneFoamer("F01", { rig: { health: 99 } });
    expect(localTuning().foamers.F01!.rig!.health).toBe(99);
  });
});
