import { describe, expect, it } from "vitest";
import { openChoice, openKey } from "../../src/editor/open";
import { builtInCopy } from "../../src/editor/builtin";
import { newLevel } from "../../src/editor/doc";
import { validateLevel } from "../../src/level/validate";
import type { Level } from "../../src/level/format";
import type { StoredLevel } from "../../src/editor/store";
import pitJson from "../../data/levels/1-1-pit.json";

// ED-09 stages 2 and 3: which level the editor opens, and a built in level
// opened as a copy.

const stored = (key: string, saved: number): StoredLevel => ({ key, saved, level: newLevel() });

describe("ED-09 stage 2: the level the editor opens", () => {
  it("reads the key ?open= names", () => {
    expect(openKey("?open=lvl-abc")).toBe("lvl-abc");
    expect(openKey("?open=")).toBeNull();
    expect(openKey("")).toBeNull();
  });

  it("opens the level ?open= names", () => {
    const list = [stored("lvl-new", 20), stored("lvl-old", 10)];
    expect(openChoice("?open=lvl-old", list)).toEqual({ key: "lvl-old", missing: null });
  });

  it("opens the latest when there is no ?open=", () => {
    const list = [stored("lvl-new", 20), stored("lvl-old", 10)];
    expect(openChoice("", list)).toEqual({ key: "lvl-new", missing: null });
  });

  it("opens a new level when the store is empty", () => {
    expect(openChoice("", [])).toEqual({ key: null, missing: null });
  });

  it("says so and opens the latest when ?open= names nothing", () => {
    const list = [stored("lvl-new", 20)];
    expect(openChoice("?open=lvl-gone", list)).toEqual({ key: "lvl-new", missing: "lvl-gone" });
    expect(openChoice("?open=lvl-gone", [])).toEqual({ key: null, missing: "lvl-gone" });
  });
});

describe("ED-09 stage 3: a built in level as a copy", () => {
  it("has no arenas and passes the validator", () => {
    const copy = builtInCopy(pitJson as unknown as Level);
    expect(copy.level.arenas ?? []).toEqual([]);
    expect(validateLevel(copy.level).errors).toEqual([]);
    expect(copy.level.triggers?.length).toBeGreaterThan(0);
    expect(copy.level.zones?.length).toBeGreaterThan(0);
  });

  it("does not change the level it was given", () => {
    const original = structuredClone(pitJson) as unknown as Level;
    builtInCopy(original);
    expect(original.arenas?.length).toBeGreaterThan(0);
  });

  it("keeps the level's own name and start", () => {
    const copy = builtInCopy(pitJson as unknown as Level);
    expect(copy.level.meta.name).toBe((pitJson as unknown as Level).meta.name);
    expect(copy.level.playerStart).toEqual((pitJson as unknown as Level).playerStart);
  });
});
