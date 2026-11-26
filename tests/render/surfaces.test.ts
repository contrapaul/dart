import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { drawSurface, worldUVs, SURFACES, SURFACE_NAMES } from "../../src/render/surfaces";

describe("drawSurface", () => {
  it("draws every listed surface without throwing, and is not flat", () => {
    expect(Object.keys(SURFACES)).toContain("plain");
    for (const name of SURFACE_NAMES) {
      if (name === "plain") continue;
      const img = drawSurface(name);
      expect(img).toBeTruthy();
      expect(img!.width).toBe(256);
      const values = new Set<number>();
      for (let i = 0; i < img!.data.length; i += 4) values.add(img!.data[i]!);
      // Not one flat value: at least a handful of distinct greys, and
      // some dark and some light.
      expect(values.size).toBeGreaterThan(4);
      let mn = 255, mx = 0;
      for (const v of values) { mn = Math.min(mn, v); mx = Math.max(mx, v); }
      expect(mx - mn).toBeGreaterThan(40);
    }
  });

  it("returns null for plain and unknown names", () => {
    expect(drawSurface("plain")).toBeNull();
    expect(drawSurface("nope")).toBeNull();
  });

  it("gives the same pixels for the same surface", () => {
    for (const name of SURFACE_NAMES) {
      if (name === "plain") continue;
      const a = drawSurface(name)!;
      const b = drawSurface(name)!;
      expect(a.data).toEqual(b.data);
    }
  });
});

describe("worldUVs", () => {
  it("gives 1 and 4 repeats for a 1 m and a 4 m box at scale 1", () => {
    const box = (m: number) => {
      const geo = new THREE.BoxGeometry(m, m, m);
      const mat = new THREE.Matrix4().makeTranslation(0, 0, 0);
      const flat = geo.index ? geo.toNonIndexed() : geo;
      return worldUVs(flat, mat, 1);
    };
    const one = box(1).getAttribute("uv");
    const four = box(4).getAttribute("uv");
    const ranges = (attr: THREE.BufferAttribute | THREE.InterleavedBufferAttribute) => {
      let mn = Infinity, mx = -Infinity;
      for (let i = 0; i < attr.count; i++) {
        mn = Math.min(mn, attr.getX(i)); mx = Math.max(mx, attr.getX(i));
      }
      return mx - mn;
    };
    expect(ranges(one)).toBeCloseTo(1, 3);
    expect(ranges(four)).toBeCloseTo(4, 3);
  });
});
