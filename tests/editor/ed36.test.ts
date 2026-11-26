import { describe, expect, it } from "vitest";
import surfaceData from "../../data/surfaces.json";
import { SURFACE_NAMES, SURFACES, isSurface, drawSurface } from "../../src/render/surfaces";
import { LevelDoc } from "../../src/editor/doc";
import { newLevel } from "../../src/editor/doc";

// ED-36 (the editor card): the paint path around the shared pieces. The
// swatch canvas and the drag are DOM tests for a browser; the levels and
// patches are the parts that can be tested headless.

const NAMES = ["plain", "brick", "tiles", "planks", "metal", "concrete", "grass", "sand", "rock", "stripes"];

describe("data/surfaces.json", () => {
  it("keeps the card's names, in the card's order", () => {
    expect(Object.keys(surfaceData.surfaces)).toEqual(NAMES);
    expect(SURFACE_NAMES).toEqual(NAMES);
    for (const [name, spec] of Object.entries(surfaceData.surfaces)) {
      expect(spec.label).toBeTruthy();
      expect(spec.scale).toBeGreaterThan(0);
      expect(isSurface(name)).toBe(true);
    }
  });

  it("has a drawn texture for every non-plain surface", () => {
    for (const name of SURFACE_NAMES) {
      if (name === "plain") {
        expect(drawSurface(name)).toBeNull();
        continue;
      }
      const img = drawSurface(name);
      expect(img).toBeTruthy();
      expect(img!.width).toBe(256);
    }
    // The scale a surface is painted with comes from the file, not from code.
    expect(SURFACES.brick?.scale).toBe(1);
    expect(SURFACES.planks?.scale).toBe(2);
  });
});

describe("painting via the doc", () => {
  it("paints a prim in one undo step, and undoes it", () => {
    const doc = new LevelDoc(newLevel());
    const target = { id: "paint-me", shape: "box" as const, pos: [0, 0, 0] as [number, number, number], size: [2, 2, 2] as [number, number, number], colour: "#ff8800", behaviour: "solid" as const };
    doc.add("prims", { ...target });
    doc.change("prims", [{ id: "paint-me", patch: { surface: "tiles", colour: "#2255ff" } }], "paint 1 prim");
    const after = doc.prim("paint-me")!;
    expect(after.surface).toBe("tiles");
    expect(after.colour).toBe("#2255ff");
    doc.undo();
    const before = doc.prim("paint-me")!;
    expect(before.surface).toBeUndefined();
    expect(before.colour).toBe("#ff8800");
    doc.redo();
    expect(doc.prim("paint-me")!.surface).toBe("tiles");
  });
});
