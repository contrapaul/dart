import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { buildLights, targetDirection } from "../../src/level/lights";
import type { Level, LevelLight } from "../../src/level/format";
import type { QualityPreset } from "../../src/render/quality";
import editorData from "../../data/editor.json";
import ed01 from "../../data/levels/ed-01.json";
import { validateLevel } from "../../src/level/validate";

const HIGH: QualityPreset = { pixelRatioMax: 2, antialias: true, shadows: true, shadowMapMax: 2048, debrisMax: 150, breakoffMaxPieces: 16 };
const LOW: QualityPreset = { ...HIGH, shadows: false };

function level(lights: LevelLight[], lighting?: Level["lighting"]): Level {
  return { lights, lighting } as Level;
}

const point = (id: string, extra: Partial<LevelLight> = {}): LevelLight =>
  ({ id, kind: "point", pos: [0, 2, 0], colour: "#ff0000", intensity: 10, range: 8, ...extra });

const spot = (id: string, extra: Partial<LevelLight> = {}): LevelLight =>
  ({ id, kind: "spot", pos: [1, 3, 2], colour: "#ffffff", intensity: 20, range: 10, angle: 45, softness: 0.3, ...extra });

describe("ED-32 spot aim", () => {
  it("aims down -Y when rot is zero", () => {
    const d = targetDirection([0, 0, 0]);
    expect(d.y).toBeCloseTo(-1, 5);
    expect(d.x).toBeCloseTo(0, 5);
    expect(d.z).toBeCloseTo(0, 5);
  });

  it("turns -Y by the rot triple (XYZ)", () => {
    const d = targetDirection([90, 0, 0]);
    expect(d.y).toBeCloseTo(0, 5);
    expect(d.z).toBeCloseTo(-1, 5);
    // A turn about Y leaves -Y alone.
    const d2 = targetDirection([0, 90, 0]);
    expect(d2.y).toBeCloseTo(-1, 5);
    // A turn about Z swings it toward +x.
    const d3 = targetDirection([0, 0, 90]);
    expect(d3.x).toBeCloseTo(1, 5);
    expect(d3.y).toBeCloseTo(0, 5);
  });
});

describe("ED-32 buildLights", () => {
  it("builds a point and a spot with the fields from the file", () => {
    const scene = new THREE.Scene();
    const built = buildLights(scene, level([point("p"), spot("s")]), HIGH);
    const p = built.handles.get("p")!.light as THREE.PointLight;
    const s = built.handles.get("s")!.light as THREE.SpotLight;
    expect(p.distance).toBe(8);
    expect(p.decay).toBe(2);
    expect(p.intensity).toBe(10);
    expect((p.color as THREE.Color).getHexString()).toBe("ff0000");
    expect(s.distance).toBe(10);
    expect(s.angle).toBeCloseTo(45 / 2 * Math.PI / 180, 5);
    expect(s.penumbra).toBeCloseTo(0.3, 5);
    expect(s.target.position.x).toBeCloseTo(1, 5);
    expect(s.target.position.y).toBeCloseTo(-10 + 3, 5); // pos + (0,-1,0)*range
    expect(scene.children).toContain(s);
  });

  it("caps shadow casters at the cap in data/editor.json", () => {
    const scene = new THREE.Scene();
    const lights = Array.from({ length: editorData.lights.maxShadows + 2 }, (_, i) =>
      point(`l${i}`, { castShadow: true }));
    const built = buildLights(scene, level(lights), HIGH);
    const withShadow = [...built.handles.values()].filter((h) => h.light.castShadow);
    expect(withShadow.length).toBe(editorData.lights.maxShadows);
  });

  it("turns shadows off on the low preset", () => {
    const scene = new THREE.Scene();
    const built = buildLights(scene, level([point("p", { castShadow: true })]), LOW);
    expect(built.handles.get("p")!.light.castShadow).toBe(false);
  });

  it("starts a hidden light off and a trigger can turn it on", () => {
    const scene = new THREE.Scene();
    const built = buildLights(scene, level([point("p", { hidden: true })]), HIGH);
    const handle = built.handles.get("p")!;
    expect(handle.light.visible).toBe(false);
    handle.setVisible(true);
    expect(handle.light.visible).toBe(true);
    handle.setVisible(false);
    expect(handle.light.visible).toBe(false);
  });

  it("replaces the arena's ambient and sun when lighting is set", () => {
    const scene = new THREE.Scene();
    const hemi = new THREE.HemisphereLight(0xffffff, 0x000000, 1);
    const sun = new THREE.DirectionalLight(0xffffff, 1);
    scene.add(hemi, sun);
    buildLights(scene, level([], {
      ambient: "#123456", ambientIntensity: 0.7,
      sun: "#fedcba", sunIntensity: 3, sunYaw: 45, sunPitch: 30,
    }), HIGH);
    expect((hemi.color as THREE.Color).getHexString()).toBe("123456");
    expect(hemi.intensity).toBe(0.7);
    expect((sun.color as THREE.Color).getHexString()).toBe("fedcba");
    expect(sun.intensity).toBe(3);
    const len = sun.position.length();
    expect(len).toBeCloseTo(20, 5);
    expect(sun.position.y).toBeCloseTo(20 * Math.sin(Math.PI / 6), 5);
  });

  it("leaves the scene alone when nothing is set", () => {
    const scene = new THREE.Scene();
    const hemi = new THREE.HemisphereLight(0xffffff, 0x000000, 1);
    scene.add(hemi);
    buildLights(scene, level([]), HIGH);
    expect((hemi.color as THREE.Color).getHexString()).toBe("ffffff");
  });
});

describe("the validator takes a placed light", () => {
  it("accepts a placed light and refuses a bad one", () => {
    const base = ed01 as unknown as Level;
    const ok = validateLevel({ ...base, lights: [
      { id: "light-1", kind: "point", pos: [0, 2, 0], colour: "#ffffff", intensity: 20, range: 8 },
      { id: "light-2", kind: "spot", pos: [0, 2, 0], colour: "#ffffff", intensity: 20, range: 8, angle: 45, softness: 0.3, castShadow: true },
    ] });
    expect(ok.errors).toEqual([]);
    const bad = validateLevel({ ...base, lights: [{ id: "light-1", kind: "spot", pos: [0, 2, 0], colour: "#ffffff", intensity: 20, range: 0 }] });
    expect(bad.errors.some((e) => e.includes("range must be positive"))).toBe(true);
    const over = validateLevel({ ...base, lights: Array.from({ length: 5 }, (_, i) => ({
      id: `l${i}`, kind: "point", pos: [i, 2, 0], colour: "#ffffff", intensity: 1, range: 8, castShadow: true,
    })) });
    expect(over.errors.some((e) => e.includes("cast shadows"))).toBe(true);
  });
});
