import { describe, expect, it } from "vitest";
import { paintHint } from "../../src/editor/paint-tool";

describe("paintHint", () => {
  it("says what a click does in Bucket mode", () => {
    const hint = paintHint("bucket");
    expect(hint).toContain("Bucket:");
    expect(hint).toContain("every touching prim of the same look");
    expect(hint).toContain("terrain to fill it all");
    expect(hint).toContain("Alt+click picks up a look");
  });

  it("says what a drag does in Brush mode", () => {
    const hint = paintHint("brush");
    expect(hint).toContain("Paint:");
    expect(hint).toContain("drag on the terrain");
    expect(hint).toContain("Shift keeps the tool");
  });

  it("differs between modes", () => {
    expect(paintHint("bucket")).not.toBe(paintHint("brush"));
  });
});

describe("layoutRing", () => {
  it("lays the rim on the ground under the cursor", async () => {
    const THREE = await import("three");
    const { layoutRing } = await import("../../src/editor/terrain-editor");
    const { flatTerrain, heightAt } = await import("../../src/level/terrain");
    const t = flatTerrain([0, 0], 0, 10, 10, 1, [{ surface: "grass", colour: "#7ec850" }]);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(64 * 3), 3));
    const ring = new THREE.LineLoop(geo, new THREE.LineBasicMaterial({ color: "#ffd23f" }));
    layoutRing(ring, t, 1, 2, 0.5);
    const pos = ring.geometry.getAttribute("position") as { count: number; getX(i: number): number; getY(i: number): number; getZ(i: number): number };
    expect(pos.count).toBe(64);
    const x = pos.getX(0);
    const z = pos.getZ(0);
    expect(x).toBeCloseTo(1.5, 5);
    expect(z).toBeCloseTo(2, 5);
    expect(pos.getY(0)).toBeCloseTo((heightAt(t, 1.5, 2) ?? t.origin[1]) + 0.05, 5);
  });
});
