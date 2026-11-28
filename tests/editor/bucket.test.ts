import { describe, expect, it } from "vitest";
import { LevelDoc, newLevel } from "../../src/editor/doc";
import { flatTerrain, vertexCount } from "../../src/level/terrain";
import type { Prim, Terrain } from "../../src/level/format";
import { connectedSameLook, fillTerrain, lookOf } from "../../src/editor/bucket";

function prim(id: string, pos: [number, number, number], opts: Partial<Prim> = {}): Prim {
  return { id, shape: "box", pos, size: [2, 2, 2], colour: "#ff8800", behaviour: "solid", surface: "brick", ...opts };
}

function docWith(prims: Prim[]): LevelDoc {
  const d = new LevelDoc(newLevel());
  for (const p of prims) d.add("prims", p);
  return d;
}

describe("connectedSameLook", () => {
  it("returns the start and every touching prim with the same look", () => {
    const d = docWith([
      prim("a", [0, 0, 0]),
      prim("b", [2.01, 0, 0]),       // 0.01 m gap: touches
      prim("c", [5, 0, 0]),          // too far
      prim("d", [2.01, 0, 2.5], { colour: "#2ec4ff" }), // different colour
    ]);
    const ids = connectedSameLook(d.level, "a").map((p) => p.id);
    expect(ids).toContain("a");
    expect(ids).toContain("b");
    expect(ids).not.toContain("c");
    expect(ids).not.toContain("d");
  });

  it("walks through a chain of touching prims", () => {
    const d = docWith([
      prim("a", [0, 0, 0]),
      prim("b", [2.01, 0, 0]),
      prim("c", [4.02, 0, 0]),
      prim("far", [30, 0, 0]),
    ]);
    const ids = connectedSameLook(d.level, "a").map((p) => p.id);
    expect(ids.sort()).toEqual(["a", "b", "c"]);
  });

  it("treats an unseen surface as plain", () => {
    const d = docWith([
      prim("a", [0, 0, 0], { surface: undefined }),
      prim("b", [2.01, 0, 0], { surface: undefined }),
    ]);
    expect(connectedSameLook(d.level, "a").map((p) => p.id).sort()).toEqual(["a", "b"]);
  });

  it("uses rotated bounds, not the unrotated box", () => {
    // 45 degrees about Y: the box's corners reach 1.41 m from the middle,
    // so a neighbour 2.5 m away is inside the bounds.
    const d = docWith([
      prim("a", [0, 0, 0], { rot: [0, 45, 0] }),
      prim("b", [2.3, 0, 0]),
    ]);
    const ids = connectedSameLook(d.level, "a").map((p) => p.id);
    expect(ids).toContain("b");
  });

  it("caps the result at the cap", () => {
    const prims = [prim("a", [0, 0, 0])];
    // A straight line of touching prims 2.01 apart, 600 of them.
    for (let i = 1; i < 600; i++) prims.push(prim(`p${i}`, [i * 2.01, 0, 0]));
    const d = docWith(prims);
    expect(connectedSameLook(d.level, "a").length).toBe(500);
  });

  it("returns just the start for an unknown id", () => {
    const d = docWith([prim("a", [0, 0, 0])]);
    expect(connectedSameLook(d.level, "nope").map((p) => p.id)).toEqual([]);
  });
});

describe("lookOf", () => {
  it("is the surface and colour of a prim", () => {
    expect(lookOf(prim("a", [0, 0, 0]))).toEqual({ surface: "brick", colour: "#ff8800" });
    expect(lookOf(prim("a", [0, 0, 0], { surface: undefined }))).toEqual({ surface: "plain", colour: "#ff8800" });
  });
});

describe("fillTerrain", () => {
  function terrain(): Terrain {
    return flatTerrain([0, 0], 0, 4, 4, 1, [
      { surface: "grass", colour: "#2ec4ff" },
      { surface: "sand", colour: "#ffd23a" },
    ]);
  }

  it("fills every vertex with one layer", () => {
    const t = terrain();
    fillTerrain(t, 1);
    const n = vertexCount(t);
    expect(t.paint).toHaveLength(n * 2);
    for (let v = 0; v < n; v++) {
      expect(t.paint![v * 2]).toBe(0);
      expect(t.paint![v * 2 + 1]).toBe(255);
    }
  });

  it("replaces an existing paint", () => {
    const t = terrain();
    fillTerrain(t, 0);
    t.paint![0] = 128; // one stray weight
    fillTerrain(t, 1);
    expect(t.paint![0]).toBe(0);
    expect(t.paint![1]).toBe(255);
  });
});
