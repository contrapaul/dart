import { describe, expect, it } from "vitest";
import edOneJson from "../../data/levels/ed-01.json";
import { isVoxelBreakable, validateLevel } from "../../src/level/validate";
import { chosenLevel, loadLocalLevel, useLocalLevel } from "../../src/arena/levels";
import type { Level } from "../../src/level/format";

const level = edOneJson as unknown as Level;

describe("the ED-01 test level", () => {
  it("validates with no errors", () => {
    const report = validateLevel(level);
    expect(report.errors).toEqual([]);
  });

  it("has every new part once", () => {
    const shapes = new Set(level.prims!.map((p) => p.shape));
    expect([...shapes].sort()).toEqual(["box", "cylinder", "ramp", "stairs", "wedge"]);
    expect(level.prims!.filter((p) => p.behaviour === "decor").length).toBe(3);
    expect(level.prims!.filter((p) => p.hidden).map((p) => p.id)).toEqual(["blocker"]);
    expect(level.prims!.filter((p) => p.hazard !== undefined).length).toBe(0);
    expect(level.foamers!.map((f) => f.wake ?? "sight")).toEqual(["sight", "trigger"]);
    expect(level.doors!.map((d) => d.lock)).toEqual(["none", "trigger"]);
    expect(level.sky!.kind).toBe("gradient");
    expect(level.start).toEqual({ blasters: ["B01", "B04"], melee: ["M01"], health: 60 });
  });

  it("ED-06: has one breakable of each kind", () => {
    const breakables = level.prims!.filter((p) => p.behaviour === "breakable");
    expect(breakables.map((p) => p.id)).toEqual(["foam-wall", "turned-block", "foam-column"]);
    // The upright box is voxel foam: no hit points needed, and the rule in
    // validate.ts is the one that decides it.
    const wall = breakables.find((p) => p.id === "foam-wall")!;
    expect(wall.shape).toBe("box");
    expect(wall.rot).toBeUndefined();
    expect(isVoxelBreakable(wall)).toBe(true);
    // A box turned off the 90 degree steps breaks by hit points.
    const turned = breakables.find((p) => p.id === "turned-block")!;
    expect(turned.rot).toEqual([0, 45, 0]);
    expect(isVoxelBreakable(turned)).toBe(false);
    expect(turned.hitPoints).toBe(60);
    // So does a cylinder.
    const column = breakables.find((p) => p.id === "foam-column")!;
    expect(column.shape).toBe("cylinder");
    expect(isVoxelBreakable(column)).toBe(false);
    expect(column.hitPoints).toBe(40);
  });

  it("is one of the page's levels by name", () => {
    expect(chosenLevel("?level=ed-01").level.meta.id).toBe("ed-01");
    expect(chosenLevel("?level=ed-01").unknownLevel).toBeNull();
  });
});

describe("?level=local:<key> (ED-01)", () => {
  it("does nothing when the name is not a stored level", async () => {
    expect(await loadLocalLevel("")).toBeNull();
    expect(await loadLocalLevel("?level=1-1-pit")).toBeNull();
  });

  it("plays the level the store hands over", () => {
    useLocalLevel("local:abc", level);
    const chosen = chosenLevel("?level=local:abc");
    expect(chosen.level).toBe(level);
    expect(chosen.unknownLevel).toBeNull();
    // A name that is not the one the store handed over still falls back.
    expect(chosenLevel("?level=local:other").unknownLevel).toBe("local:other");
  });

  it("says so when the store will not open (Node has no database)", async () => {
    expect(await loadLocalLevel("?level=local:abc")).toMatch(/store/);
    expect(await loadLocalLevel("?level=local:")).toMatch(/names no stored level/);
  });
});
