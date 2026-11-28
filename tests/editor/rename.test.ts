import { describe, expect, it } from "vitest";
import { applyRename, renameProblem } from "../../src/editor/rename";
import { newLevel } from "../../src/editor/doc";
import { validateLevel } from "../../src/level/validate";
import type { Level } from "../../src/level/format";

function levelWith(patch: Partial<Level>): Level {
  return { ...newLevel(), ...patch };
}

describe("R3-09 rename", () => {
  it("refuses an empty id", () => {
    const level = levelWith({ zones: [{ id: "zone-1", pos: [0, 0, 0], size: [2, 2, 2] }] });
    expect(renameProblem(level, "zone-1", "  ")).toMatch(/empty/);
  });

  it("refuses an id with characters that do not belong", () => {
    const level = levelWith({ zones: [{ id: "zone-1", pos: [0, 0, 0], size: [2, 2, 2] }] });
    expect(renameProblem(level, "zone-1", "not an id")).toMatch(/letters, numbers/);
    expect(renameProblem(level, "zone-1", "-leading-dash")).toMatch(/letters, numbers/);
    expect(renameProblem(level, "zone-1", "box_9")).toBeNull();
  });

  it("refuses an id already used by anything", () => {
    const level = levelWith({
      zones: [{ id: "zone-1", pos: [0, 0, 0], size: [2, 2, 2] }, { id: "zone-2", pos: [1, 0, 1], size: [2, 2, 2] }],
    });
    expect(renameProblem(level, "zone-1", "zone-2")).toMatch(/already used/);
    expect(renameProblem(level, "zone-1", "floor-1")).toMatch(/already used/);
  });

  it("allows the target id, and says the name is unchanged", () => {
    const level = levelWith({ zones: [{ id: "zone-1", pos: [0, 0, 0], size: [2, 2, 2] }] });
    expect(renameProblem(level, "zone-1", "zone-9")).toBeNull();
    expect(renameProblem(level, "zone-1", "zone-1")).toMatch(/already the id/);
  });

  it("renames the entry and every trigger clause", () => {
    const level = levelWith({
      zones: [{ id: "zone-1", pos: [0, 0, 0], size: [2, 2, 2] }],
      pickups: [{ id: "pick-1", type: "health", amount: 25, pos: [1, 0, 1] }],
      buttons: [{ id: "button-1", pos: [0, 1, 0], facing: [0, 1, 0] }],
      triggers: [{
        id: "trigger-1",
        when: { kind: "enter", zone: "zone-1" },
        do: [{ kind: "wake", ids: ["foamer-1"] }],
      }, {
        id: "trigger-2",
        when: { kind: "killed", ids: ["foamer-1"] },
        do: [{ kind: "move", ids: ["box-floor-1"], by: [1, 0, 0], seconds: 1 }],
      }, {
        id: "trigger-3",
        when: { kind: "pressed", button: "button-1" },
        do: [{ kind: "open", door: "door-1" }],
      }],
      foamers: [{ id: "foamer-1", foamer: "F01", pos: [0, 0, 5], yaw: 0 }],
      doors: [{ id: "door-1", pos: [0, 1, 0], size: [2, 2, 0.5], lock: "none" }],
    });
    const next = applyRename(level, "foamer-1", "foamer-9");
    expect(next.foamers!.map((f) => f.id)).toEqual(["foamer-9"]);
    expect(next.triggers![0]!.do[0]).toEqual({ kind: "wake", ids: ["foamer-9"] });
    expect(next.triggers![1]!.when).toEqual({ kind: "killed", ids: ["foamer-9"] });
    expect(next.triggers![0]!.id).toBe("trigger-1");
    // The rest of the level is untouched.
    expect(next.triggers![2]!.when).toEqual({ kind: "pressed", button: "button-1" });
  });

  it("renames the when's zone, button, pickup and after-trigger", () => {
    const level = levelWith({
      zones: [{ id: "zone-1", pos: [0, 0, 0], size: [2, 2, 2] }],
      buttons: [{ id: "button-1", pos: [0, 1, 0], facing: [0, 1, 0] }],
      pickups: [{ id: "pick-1", type: "health", amount: 25, pos: [1, 0, 1] }],
      triggers: [{ id: "trigger-a", when: { kind: "enter", zone: "zone-1" }, do: [] },
        { id: "trigger-b", when: { kind: "pressed", button: "button-1" }, do: [] },
        { id: "trigger-c", when: { kind: "taken", pickup: "pick-1" }, do: [] },
        { id: "trigger-d", when: { kind: "after", trigger: "trigger-a", seconds: 1 }, do: [] }],
    });
    const next = applyRename(level, "zone-1", "zone-2");
    expect(next.triggers![0]!.when).toEqual({ kind: "enter", zone: "zone-2" });
    const nextB = applyRename(level, "button-1", "button-2");
    expect(nextB.triggers![1]!.when).toEqual({ kind: "pressed", button: "button-2" });
    const nextC = applyRename(level, "pick-1", "pick-2");
    expect(nextC.triggers![2]!.when).toEqual({ kind: "taken", pickup: "pick-2" });
    const nextD = applyRename(level, "trigger-a", "trigger-x");
    expect(nextD.triggers![0]!.id).toBe("trigger-x");
    expect(nextD.triggers![3]!.when).toEqual({ kind: "after", trigger: "trigger-x", seconds: 1 });
    // The doc never edits the level passed in.
    expect(level.triggers![0]!.when).toEqual({ kind: "enter", zone: "zone-1" });
  });

  it("renames a spawn point and repoints the at lists that name it", () => {
    const level = levelWith({
      spawnPoints: [{ id: "spawn-1", pos: [0, 0, 0], facing: [0, 1, 0] }],
      triggers: [{
        id: "trigger-1",
        when: { kind: "start" },
        do: [{ kind: "spawn", id: "spawn-tag", foamer: "F01", count: 2, at: ["spawn-1"] }],
      }],
      foamers: [{ id: "foamer-1", foamer: "F01", pos: [0, 0, 5], yaw: 0 }],
    });
    const next = applyRename(level, "spawn-1", "spawn-pt");
    // The spawn row's own tag is the row's name and is left alone.
    expect(next.triggers![0]!.do[0]).toEqual({ kind: "spawn", id: "spawn-tag", foamer: "F01", count: 2, at: ["spawn-pt"] });
    expect(next.spawnPoints!.map((s) => s.id)).toEqual(["spawn-pt"]);
  });

  it("rewrites the button's on and its action", () => {
    const level = levelWith({
      prims: [{ id: "box-9", shape: "box", pos: [0, 1, 0], size: [2, 2, 2], colour: "#ff7a1a", behaviour: "solid" }],
      doors: [{ id: "door-1", pos: [0, 1, 0], size: [2, 2, 0.5], lock: "none" }],
      buttons: [{ id: "button-1", pos: [0, 1, 0], facing: [0, 1, 0], on: "box-9", action: { open: "door-1" } }],
    });
    const on = applyRename(level, "box-9", "box-10");
    expect(on.buttons![0]!.on).toBe("box-10");
    const action = applyRename(level, "door-1", "door-2");
    expect(action.buttons![0]!.action).toEqual({ open: "door-2" });
  });

  it("rewrites an arena's unlockOnClear and escape seal", () => {
    const level = levelWith({
      doors: [{ id: "door-1", pos: [0, 1, 0], size: [2, 2, 0.5], lock: "none" }],
      arenas: [{
        id: "arena-1",
        archetype: "test",
        trigger: { pos: [0, 0, 0], size: [4, 4, 4] },
        doors: [],
        rifts: [],
        waves: [],
        unlockOnClear: ["door-1"],
        escape: { box: { pos: [0, 0, 5], size: [2, 2, 2] }, sealDoors: ["door-1"] },
      }],
    });
    const next = applyRename(level, "door-1", "door-2");
    expect(next.arenas![0]!.unlockOnClear).toEqual(["door-2"]);
    expect(next.arenas![0]!.escape!.sealDoors).toEqual(["door-2"]);
  });

  it("renames a model asset and repoints the placed models", () => {
    const level = levelWith({
      modelAssets: [{ id: "asset-1", name: "test", data: "data:model/gltf-binary;base64,xx" }],
      models: [{ id: "model-1", asset: "asset-1", pos: [0, 0, 0], behaviour: "solid" }],
    });
    const next = applyRename(level, "asset-1", "asset-2");
    expect(next.modelAssets!.map((a) => a.id)).toEqual(["asset-2"]);
    expect(next.models![0]!.asset).toBe("asset-2");
  });

  it("passes validation after every reference has been rewritten", () => {
    const level = levelWith({
      zones: [{ id: "zone-1", pos: [0, 0, 0], size: [2, 2, 2] }],
      spawnPoints: [{ id: "spawn-1", pos: [0, 0, 0], facing: [0, 1, 0] }],
      foamers: [{ id: "foamer-1", foamer: "F01", pos: [0, 0, 5], yaw: 0 }],
      pickups: [{ id: "pick-1", type: "health", amount: 25, pos: [1, 0, 1] }],
      triggers: [{
        id: "trigger-1",
        when: { kind: "enter", zone: "zone-1" },
        do: [
          { kind: "spawn", id: "spawn-1", foamer: "F01", count: 1, at: ["spawn-1"] },
          { kind: "show", ids: ["foamer-1"] },
        ],
      }, {
        id: "trigger-2",
        when: { kind: "killed", ids: ["foamer-1"] },
        do: [{ kind: "show", ids: ["foamer-1"] }],
      }],
    });
    // All renames at once (each pure, each leaving the next's inputs intact).
    let next = level;
    for (const [oldId, newId] of [["zone-1", "zone-2"], ["spawn-1", "spawn-2"], ["foamer-1", "foamer-2"], ["trigger-1", "trigger-2b"]] as const) {
      next = applyRename(next, oldId, newId);
    }
    const { errors } = validateLevel(next);
    expect(errors).toEqual([]);
  });
});
