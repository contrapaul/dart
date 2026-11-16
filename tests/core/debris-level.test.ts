import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import {
  DEBRIS_LEVELS, DEFAULTS, SettingsStore, STORAGE_KEY, debrisBudget,
} from "../../src/core/settings";
import { DebrisSystem } from "../../src/voxel/debris";
import destruction from "../../data/destruction.json";
import renderJson from "../../data/render.json";

// The Debris setting (Paul, 2026-11-16): a player on a stronger machine
// picks more foam chunks that stay for longer. Normal is exactly what the
// quality preset gives; the other levels scale its cap and the life.

class FakeStorage {
  private map = new Map<string, string>();
  getItem(k: string) {
    return this.map.has(k) ? this.map.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.map.set(k, v);
  }
}

const DT = 1 / 60;
const HIGH = renderJson.quality.presets.high.debrisMax;

describe("the Debris setting", () => {
  let storage: FakeStorage;
  beforeEach(() => {
    storage = new FakeStorage();
    (globalThis as Record<string, unknown>).window = { localStorage: storage };
  });

  it("defaults to normal, which is a level in the data", () => {
    expect(DEFAULTS.debris).toBe("normal");
    expect(DEBRIS_LEVELS.normal).toBeDefined();
    expect(new SettingsStore().value.debris).toBe("normal");
  });

  it("a picked level round-trips", () => {
    new SettingsStore().set("debris", "extra");
    expect(new SettingsStore().value.debris).toBe("extra");
  });

  it("a saved level the data does not have falls back to normal", () => {
    storage.setItem(STORAGE_KEY, JSON.stringify({ debris: "silly" }));
    expect(new SettingsStore().value.debris).toBe("normal");
  });
});

describe("debrisBudget", () => {
  it("normal on the high preset is today's cap and life", () => {
    expect(debrisBudget("normal", HIGH)).toEqual({
      max: destruction.debris.max, lifetime: destruction.debris.lifetime,
    });
  });

  it("each level up holds more chunks for longer", () => {
    const keys = Object.keys(DEBRIS_LEVELS);
    expect(keys.length).toBeGreaterThanOrEqual(3);
    for (let i = 1; i < keys.length; i++) {
      const a = debrisBudget(keys[i - 1]!, HIGH), b = debrisBudget(keys[i]!, HIGH);
      expect(b.max, keys[i]).toBeGreaterThan(a.max);
      expect(b.lifetime, keys[i]).toBeGreaterThan(a.lifetime);
    }
  });

  it("scales the quality preset's cap, to a whole number of at least 1", () => {
    const low = renderJson.quality.presets.low.debrisMax;
    for (const key of Object.keys(DEBRIS_LEVELS)) {
      const b = debrisBudget(key, low);
      expect(b.max).toBe(Math.max(1, Math.round(low * DEBRIS_LEVELS[key]!.countScale)));
      expect(Number.isInteger(b.max)).toBe(true);
    }
    expect(debrisBudget("low", 1).max).toBe(1);
  });

  it("an unknown level is normal", () => {
    expect(debrisBudget("silly", HIGH)).toEqual(debrisBudget("normal", HIGH));
  });

  it("the top level has a hard cap in the data", () => {
    const top = Object.keys(DEBRIS_LEVELS).at(-1)!;
    expect(debrisBudget(top, HIGH).max).toBeLessThanOrEqual(destruction.debris.hardMax);
    expect(debrisBudget(top, 100000).max).toBe(destruction.debris.hardMax);
  });
});

describe("DebrisSystem takes the budget", () => {
  beforeAll(async () => {
    await RAPIER.init();
  });

  it("holds the budget's cap and keeps a chunk for the budget's life", () => {
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    const debris = new DebrisSystem(RAPIER, world, 20, 1);
    debris.burst(new THREE.Vector3(0, 1, 0), 30, 0.1, 0);
    expect(debris.live).toBe(20);
    for (let i = 0; i < 59; i++) debris.update(DT);
    expect(debris.live, "still there just under a second").toBe(20);
    for (let i = 0; i < 2; i++) debris.update(DT);
    expect(debris.live, "gone after its life").toBe(0);
  });

  it("a life changed later (the setting moved) is the life of new chunks", () => {
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    const debris = new DebrisSystem(RAPIER, world, 20, 1);
    debris.lifetime = 2;
    debris.burst(new THREE.Vector3(0, 1, 0), 5, 0.1, 0);
    for (let i = 0; i < 90; i++) debris.update(DT);
    expect(debris.live).toBe(5);
    for (let i = 0; i < 32; i++) debris.update(DT);
    expect(debris.live).toBe(0);
  });
});
