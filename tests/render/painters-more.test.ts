import { describe, expect, it } from "vitest";
import { drawSurface, SURFACE_NAMES } from "../../src/render/surfaces";
import { MORE_PAINTERS } from "../../src/render/painters-more";

// The generated surfaces, R3-05. Every painter here draws greys into a square
// image (the thing's colour tints it) and must tile: the 2 by 2 sheet in
// design/surfaces/sheet.png is the visual check. The palette entries in
// data/surfaces.json are owned by the ed36 role (request in
// docs/requests/r3-05.md), so the presence of the surfaces here is not
// asserted against the json.

describe("generated painters", () => {
  it("draws every generated surface through drawSurface", () => {
    for (const name of Object.keys(MORE_PAINTERS)) {
      const img = drawSurface(name);
      expect(img, name).toBeTruthy();
      expect(img!.width).toBe(256);
      expect(img!.height).toBe(256);
    }
  });

  it("the painter set and the json palette are separate name spaces", () => {
    // Guard against a name colliding with a plain entry that has no painter.
    for (const name of Object.keys(MORE_PAINTERS)) {
      expect(name).not.toBe("plain");
      expect(name).not.toMatch(/^\s|\s$/);
    }
    // The json palette has plain plus the nine built-in painters; the
    // generated names are drawn whether or not the palette has them yet.
    for (const name of SURFACE_NAMES) {
      expect(typeof name).toBe("string");
    }
  });

  it("draws only greys, and alpha 255", () => {
    for (const name of Object.keys(MORE_PAINTERS)) {
      const img = drawSurface(name)!;
      for (let i = 0; i < img.data.length; i += 4) {
        expect(img.data[i], `${name} pixel ${i / 4} channel 0`).toBe(img.data[i + 1]);
        expect(img.data[i], `${name} pixel ${i / 4} channel 1`).toBe(img.data[i + 2]);
        expect(img.data[i + 3]).toBe(255);
      }
    }
  });

  it("is not flat and is repeatable", () => {
    for (const name of Object.keys(MORE_PAINTERS)) {
      const a = drawSurface(name)!;
      const b = drawSurface(name)!;
      expect(a.data, name).toEqual(b.data);
      const values = new Set<number>();
      for (let i = 0; i < a.data.length; i += 4) values.add(a.data[i]!);
      expect(values.size, name).toBeGreaterThan(4);
      let mn = 255, mx = 0;
      for (const v of values) { mn = Math.min(mn, v); mx = Math.max(mx, v); }
      expect(mx - mn, name).toBeGreaterThan(30);
    }
  });

  it("is not flat at the sheet's own tile size", () => {
    // The sheet draws at 128 px (see tools/render-surfaces.ts); so must the tests.
    for (const name of Object.keys(MORE_PAINTERS)) {
      const img = drawSurface(name, 128);
      expect(img).toBeTruthy();
      expect(img!.width).toBe(128);
      const values = new Set<number>();
      for (let i = 0; i < img!.data.length; i += 4) values.add(img!.data[i]!);
      expect(values.size, name).toBeGreaterThan(4);
    }
  });
});
