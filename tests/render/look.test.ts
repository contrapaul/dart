import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  applyLookEnvironment,
  isColour,
  lookDefaults,
  resolveLook,
  toneMappingFor,
  TONE_MAPPING_NAMES,
  type LookOptions,
} from "../../src/render/look";
import renderJson from "../../data/render.json";
import { validateLevel } from "../../src/level/validate";
import type { Level } from "../../src/level/format";

const BASE: LookOptions = {
  toneMapping: "aces",
  exposure: 1.0,
  skyLight: 0.4,
  bounce: "#3a2a60",
};

describe("toneMappingFor", () => {
  it("maps the four names to the three.js enums", () => {
    expect(toneMappingFor("none")).toBe(THREE.NoToneMapping);
    expect(toneMappingFor("aces")).toBe(THREE.ACESFilmicToneMapping);
    expect(toneMappingFor("agx")).toBe(THREE.AgXToneMapping);
    expect(toneMappingFor("neutral")).toBe(THREE.NeutralToneMapping);
  });

  it("falls back to none for an unknown name", () => {
    expect(toneMappingFor("reinhard")).toBe(THREE.NoToneMapping);
    expect(toneMappingFor("")).toBe(THREE.NoToneMapping);
  });
});

describe("lookDefaults", () => {
  it("reads the look section of data/render.json", () => {
    const d = lookDefaults();
    expect(d).toEqual({
      toneMapping: renderJson.look.toneMapping,
      exposure: renderJson.look.exposure,
      skyLight: renderJson.look.skyLight,
      bounce: renderJson.look.bounce,
    });
    expect(TONE_MAPPING_NAMES).toContain(d.toneMapping);
  });
});

describe("resolveLook", () => {
  it("fills every field from the defaults when gi is omitted", () => {
    expect(resolveLook(undefined, BASE)).toEqual(BASE);
  });

  it("overrides only the fields gi names", () => {
    const out = resolveLook({ exposure: 1.8, skyLight: 0.2 }, BASE);
    expect(out).toEqual({ ...BASE, exposure: 1.8, skyLight: 0.2 });
  });

  it("forces skyLight to 0 when the low preset is on", () => {
    const out = resolveLook({ skyLight: 0.9 }, BASE, true);
    expect(out.skyLight).toBe(0);
    expect(out.exposure).toBe(BASE.exposure);
  });
});

describe("applyLookEnvironment", () => {
  it("leaves no environment with no sky", () => {
    const s = new THREE.Scene();
    applyLookEnvironment(null as never, s, undefined, { ...BASE, skyLight: 0.5 });
    expect(s.environment).toBeNull();
    expect(s.environmentIntensity).toBe(1);
  });

  it("leaves no environment with skyLight 0", () => {
    const s = new THREE.Scene();
    applyLookEnvironment(null as never, s, { kind: "gradient", top: "#000000", horizon: "#111111", bottom: "#222222" }, { ...BASE, skyLight: 0 });
    expect(s.environment).toBeNull();
  });
});

describe("isColour", () => {
  it("accepts #rrggbb and rejects anything else", () => {
    expect(isColour("#3a2a60")).toBe(true);
    expect(isColour("#FFF")).toBe(false);
    expect(isColour("red")).toBe(false);
    expect(isColour(123)).toBe(false);
  });
});

function bareLevel(gi?: Record<string, unknown>): Level {
  return {
    meta: { id: "1-1", name: "Test", act: 1, targetSeconds: 60, accent: "#ffffff" },
    shell: [{ id: "floor", shape: "box", pos: [0, -0.5, 0], size: [10, 1, 10], material: "wood" }],
    playerStart: { pos: [0, 0, 0], yaw: 0 },
    exit: { pos: [0, 0, 4], size: [2, 2, 2] },
    lighting: {
      ambient: "#ffffff", ambientIntensity: 1, sun: "#ffffff", sunIntensity: 1,
      sunYaw: 0, sunPitch: 45,
      ...(gi ? { gi } : {}),
    } as Level["lighting"],
  } as Level;
}

describe("validateLevel: lighting gi", () => {
  it("accepts a good gi and a missing gi", () => {
    expect(validateLevel(bareLevel()).errors).toEqual([]);
    expect(validateLevel(bareLevel({ toneMapping: "agx", exposure: 2, skyLight: 0.5, bounce: "#123456" })).errors).toEqual([]);
  });

  it("rejects an unknown toneMapping, a bad exposure, skyLight and bounce", () => {
    const errors = validateLevel(bareLevel({
      toneMapping: "reinhard", exposure: -1, skyLight: -0.5, bounce: "blue",
    })).errors;
    expect(errors.some((e) => e.includes("toneMapping"))).toBe(true);
    expect(errors.some((e) => e.includes("exposure"))).toBe(true);
    expect(errors.some((e) => e.includes("skyLight"))).toBe(true);
    expect(errors.some((e) => e.includes("bounce"))).toBe(true);
  });
});
