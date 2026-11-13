import { describe, expect, it } from "vitest";
import type { Level, Prim } from "../../src/level/format";
import { isVoxelBreakable, validateLevel } from "../../src/level/validate";

const floor: Prim = { id: "floor", shape: "box", pos: [0, -0.5, 0], size: [32, 1, 32], colour: "#6f6788", behaviour: "solid" };
const wall: Prim = { id: "roof", shape: "box", pos: [0, 6, 0], size: [32, 1, 32], colour: "#6f6788", behaviour: "solid" };

function level(extra: Partial<Level> = {}): Level {
  return {
    meta: { id: "t", name: "[Paul]", act: 0, targetSeconds: 60, accent: "#ffffff" },
    shell: [],
    prims: [floor, wall],
    playerStart: { pos: [0, 0, 10], yaw: 0 },
    exit: { pos: [0, 0.5, -10], size: [2, 1, 2] },
    ...extra,
  };
}
const errs = (l: Level) => validateLevel(l).errors;

describe("ED-00 validator", () => {
  it("accepts a level built from prims alone", () => {
    expect(errs(level())).toEqual([]);
  });

  it("refuses a level with no shell and no prims", () => {
    expect(errs(level({ prims: [] }))).toContain("the level needs shell boxes or prims");
  });

  it("checks shapes, colours, stairs, hazards and breakables", () => {
    const bad: Prim[] = [
      { ...floor, id: "a", shape: "sphere" as Prim["shape"] },
      { ...floor, id: "b", colour: "red" },
      { ...floor, id: "c", shape: "stairs", steps: 1 },
      { ...floor, id: "d", behaviour: "hazard" },
      { ...floor, id: "e", behaviour: "hazard", hazard: { dps: 10, look: "custard" } },
      { ...floor, id: "f", shape: "cylinder", behaviour: "breakable" },
      { ...floor, id: "floor" },
    ];
    const e = errs(level({ prims: [floor, wall, ...bad] }));
    expect(e).toEqual(expect.arrayContaining([
      "prim a: unknown shape sphere",
      "prim b: colour must be #rrggbb",
      "prim c: stairs need 2 to 64 steps",
      "prim d: a hazard needs a hazard block",
      "prim e: unknown hazard look custard",
      "prim f: a breakable cylinder that is not an upright box needs hitPoints",
      "prim floor: id floor is used twice",
    ]));
  });

  it("a breakable box in 90 degree turns is voxel foam, any other turn is not", () => {
    expect(isVoxelBreakable({ ...floor, behaviour: "breakable", rot: [0, 90, 0] })).toBe(true);
    expect(isVoxelBreakable({ ...floor, behaviour: "breakable", rot: [0, 45, 0] })).toBe(false);
  });

  it("a key door needs its key in the level", () => {
    const door = { id: "d1", pos: [0, 1, 0] as [number, number, number], size: [2, 2, 0.2] as [number, number, number], lock: "red" as const };
    expect(errs(level({ doors: [door] }))).toContain("door d1: no red key in the level opens it");
    expect(errs(level({ doors: [door], pickups: [{ id: "k", type: "key", key: "red", pos: [0, 0.5, 5] }] }))).toEqual([]);
  });

  it("triggers name things that exist", () => {
    const l = level({
      zones: [{ id: "z", pos: [0, 1, 0], size: [4, 2, 4] }],
      spawnPoints: [{ id: "s1", pos: [5, 0, 0], facing: [0, 1, 0] }],
      prims: [floor, wall, { ...floor, id: "block", pos: [0, 1, -5], size: [4, 2, 0.5], hidden: true }],
      triggers: [
        { id: "t1", when: { kind: "enter", zone: "z" }, do: [{ kind: "show", ids: ["block"] }, { kind: "spawn", id: "w1", foamer: "F01", count: 3, at: ["s1"] }] },
        { id: "t2", when: { kind: "killed", ids: ["w1"] }, do: [{ kind: "hide", ids: ["block"] }] },
      ],
    });
    expect(errs(l)).toEqual([]);
    l.triggers!.push({ id: "t3", when: { kind: "enter", zone: "nope" }, do: [{ kind: "open", door: "gone" }, { kind: "spawn", id: "w2", foamer: "F01", count: 1, at: ["s9"] }] });
    expect(errs(l)).toEqual(expect.arrayContaining([
      "trigger t3: unknown zone nope",
      "trigger t3: open names unknown door gone",
      "trigger t3: spawn w2: unknown spawn point s9",
    ]));
  });

  it("checks the sky, the start loadout and placed Foamers", () => {
    const e = errs(level({
      sky: { kind: "image", image: "https://example.com/sky.jpg" },
      start: { blasters: ["B99"] },
      foamers: [{ id: "f1", foamer: "F99", pos: [0, 0, 0], yaw: 0 }],
    }));
    expect(e).toEqual(expect.arrayContaining([
      "sky: an image sky must be a data:image URL (nothing is fetched)",
      "start: B99 is not a blaster",
      "foamer f1: unknown foamer F99",
    ]));
  });

  it("holds the level size limit", () => {
    expect(errs(level({ prims: [floor, wall, { ...floor, id: "far", pos: [600, 0, 0] }] })).some((e) => e.includes("over the limit of 512"))).toBe(true);
  });
});
