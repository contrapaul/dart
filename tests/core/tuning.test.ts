import { afterEach, describe, expect, it } from "vitest";
import {
  deepMerge, exportTuning, localTuning, removeLeaves, resetTuning, setLocalTuningForTest, tuneBlaster, tuneFoamer, tuning,
  untuneBlaster, untuneFoamer,
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

describe("R3 tuning after the GPU1 review", () => {
  it("a list of things with ids merges item by item by id", () => {
    const base = { attacks: [{ id: "bonk", damage: 12, windup: 0.6 }, { id: "headbutt", damage: 8, windup: 0.9 }] };
    expect(deepMerge(base, { attacks: [{ id: "bonk", damage: 20 }] })).toEqual({
      attacks: [{ id: "bonk", damage: 20, windup: 0.6 }, { id: "headbutt", damage: 8, windup: 0.9 }],
    });
  });

  it("an attack tuned for the type still reaches a placed Foamer with its own tuning", () => {
    tuneFoamer("F01", { spec: { attacks: [{ id: "bonk", damage: 20 }] } });
    const own = tunedOne("F01", { spec: { attacks: [{ id: "bonk", windup: 0.9 }] } }, false);
    const bonk = own.spec.attacks.find((a) => a.id === "bonk")!;
    expect(bonk.damage).toBe(20);
    expect(bonk.windup).toBe(0.9);
    resetTuning({ foamer: "F01" });
    const after = tunedOne("F01", { spec: { attacks: [{ id: "bonk", windup: 0.9 }] } }, false);
    expect(after.spec.attacks.find((a) => a.id === "bonk")!.damage).not.toBe(20);
  });

  it("a per-field reset forgets the change, leaving no empty entry", () => {
    tuneFoamer("F02", { rig: { health: 12, speed: 3 } });
    untuneFoamer("F02", { rig: { health: 0 } });
    expect(localTuning().foamers.F02).toEqual({ rig: { speed: 3 } });
    untuneFoamer("F02", { rig: { speed: 0 } });
    expect(localTuning().foamers.F02).toBeUndefined();
    tuneBlaster("B01", { recoil: { spreadPerShot: 1 } });
    untuneBlaster("B01", { recoil: { spreadPerShot: 0 } });
    expect(localTuning().blasters).toEqual({});
    expect(removeLeaves({ attacks: [{ id: "bonk", damage: 20 }] }, { attacks: [{ id: "bonk", damage: 0 }] })).toBeUndefined();
  });
});
