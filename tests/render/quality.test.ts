import { beforeAll, describe, expect, it } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { pickQuality } from "../../src/render/quality";
import { DebrisSystem } from "../../src/voxel/debris";
import renderJson from "../../data/render.json";
import destructionJson from "../../data/destruction.json";

const LOW = {
  pixelRatioMax: 1,
  antialias: false,
  shadows: false,
  shadowMapMax: 512,
  debrisMax: 60,
  breakoffMaxPieces: 8,
};
const MEDIUM = {
  pixelRatioMax: 1.5,
  antialias: true,
  shadows: true,
  shadowMapMax: 1024,
  debrisMax: 100,
  breakoffMaxPieces: 12,
};
const HIGH = {
  pixelRatioMax: 2,
  antialias: true,
  shadows: true,
  shadowMapMax: 2048,
  debrisMax: 150,
  breakoffMaxPieces: 16,
};

describe("pickQuality", () => {
  it("gives low, medium and high by name and values", () => {
    expect(pickQuality("?quality=low", renderJson)).toEqual({ name: "low", preset: LOW });
    expect(pickQuality("?quality=medium", renderJson)).toEqual({ name: "medium", preset: MEDIUM });
    expect(pickQuality("?quality=high", renderJson)).toEqual({ name: "high", preset: HIGH });
  });

  it("gives the default for none or junk", () => {
    expect(pickQuality("", renderJson)).toEqual({ name: "high", preset: HIGH });
    expect(pickQuality("?quality=", renderJson)).toEqual({ name: "high", preset: HIGH });
    expect(pickQuality("?quality=ultra", renderJson)).toEqual({ name: "high", preset: HIGH });
    expect(pickQuality("?other=low", renderJson)).toEqual({ name: "high", preset: HIGH });
  });

  it("high equals today's values", () => {
    expect(pickQuality("?quality=high", renderJson).preset).toEqual({
      pixelRatioMax: 2,
      antialias: true,
      shadows: true,
      shadowMapMax: 2048,
      debrisMax: 150,
      breakoffMaxPieces: 16,
    });
    expect(renderJson.quality.presets.high).toEqual(HIGH);
    // Today's caps live in destruction.json; high must not drift from them.
    expect(HIGH.debrisMax).toBe(destructionJson.debris.max);
    expect(HIGH.breakoffMaxPieces).toBe(destructionJson.islands.maxPieces);
    expect(renderJson.quality.default).toBe("high");
  });
});

describe("preset caps", () => {
  beforeAll(async () => {
    await RAPIER.init();
  });

  it("debris built with a preset never holds more than its debrisMax chunks", () => {
    const preset = pickQuality("?quality=low", renderJson).preset;
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    const debris = new DebrisSystem(RAPIER, world, preset.debrisMax);
    debris.burst(new THREE.Vector3(0, 0, 0), preset.debrisMax + 20, 0.1, 0);
    expect(debris.live).toBe(preset.debrisMax);
    expect(debris.mesh.count).toBe(preset.debrisMax);
  });

  it("debris built without a preset keeps today's high cap", () => {
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    const debris = new DebrisSystem(RAPIER, world);
    expect(debris.mesh.count).toBe(HIGH.debrisMax);
  });
});
