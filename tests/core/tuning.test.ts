import { afterEach, describe, expect, it } from "vitest";
import {
  deepMerge, exportTuning, localTuning, resetTuning, setLocalTuningForTest, tuneBlaster, tuneFoamer, tuning,
} from "../../src/core/tuning";
import { specFor, tunedOne } from "../../src/foamers/foamers";
import { resolveSpec } from "../../src/weapons/blaster";
import foamerData from "../../data/foamers.json";
import rigData from "../../data/foamer-rigs.json";
import blasterData from "../../data/blasters.json";

// R3: one set of tuning numbers for every workspace.

afterEach(() => setLocalTuningForTest({ version: 1, foamers: {}, blasters: {} }));

const rigOf = (id: string) => (rigData.rigs as { id: string; speed: number; health: number }[]).find((r) => r.id === id)!;

describe("R3 tuning", () => {
  it("merges objects deep and replaces arrays and values", () => {
    const base = { a: 1, b: { c: 2, d: [1, 2] }, e: "x" };
    expect(deepMerge(base, { b: { c: 5, d: [9] } })).toEqual({ a: 1, b: { c: 5, d: [9] }, e: "x" });
    expect(base.b.c).toBe(2);
  });

  it("a Foamer type's tuning reaches its spec and its rig, and reset takes it away", () => {
    const before = specFor("F01").attackRange;
    tuneFoamer("F01", { spec: { attackRange: before + 1 }, rig: { speed: 9, health: 99 } });
    expect(specFor("F01").attackRange).toBe(before + 1);
    expect(tunedOne("F01", undefined, false).rig.speed).toBe(9);
    expect(tunedOne("F01", undefined, false).rig.health).toBe(99);
    // The data files themselves are never changed.
    expect(rigOf("F01").speed).not.toBe(9);
    resetTuning({ foamer: "F01" });
    expect(specFor("F01").attackRange).toBe(before);
    expect(tunedOne("F01", undefined, false).rig.speed).toBe(rigOf("F01").speed);
  });

  it("one placed Foamer's own tuning sits over its type's and changes no other", () => {
    tuneFoamer("F01", { rig: { speed: 3 } });
    const own = tunedOne("F01", { rig: { health: 50 } }, false);
    expect(own.rig.speed).toBe(3);
    expect(own.rig.health).toBe(50);
    expect(tunedOne("F01", undefined, false).rig.health).toBe(rigOf("F01").health);
  });

  it("a blaster's tuning reaches its resolved spec", () => {
    const raw = (blasterData as unknown as Record<string, { magSize: number }>).B01!;
    tuneBlaster("B01", { magSize: raw.magSize + 4 });
    expect(resolveSpec("B01").magSize).toBe(raw.magSize + 4);
    resetTuning();
    expect(resolveSpec("B01").magSize).toBe(raw.magSize);
    expect(localTuning()).toEqual({ version: 1, foamers: {}, blasters: {} });
  });

  it("exports the tuning in force as the file to commit", () => {
    tuneFoamer("F02", { rig: { health: 12 } });
    const file = JSON.parse(exportTuning());
    expect(file.version).toBe(1);
    expect(file.foamers.F02.rig.health).toBe(12);
    expect(tuning().foamers.F02?.rig?.health).toBe(12);
    void foamerData;
  });
});
