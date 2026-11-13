import { describe, expect, it, vi } from "vitest";
import type { Level } from "../../src/level/format";
import {
  EMPTY_TEXT,
  SAVE_ERROR,
  editLevelUrl,
  levelsView,
  parseLevelFile,
  playLevelUrl,
  storeLevelFile,
} from "../../src/game/my-levels";

// No DOM library: the panel's list, file and URL logic is in plain functions,
// and only the save call is stubbed here.
vi.mock("../../src/editor/store", () => ({
  LOCAL_PREFIX: "local:",
  listLevels: async () => [],
  putLevel: async () => "lvl-default",
  deleteLevel: async () => undefined,
}));

type Stored = { key: string; saved: number; level: Level };

function level(id: string, name: string): Level {
  return {
    meta: { id, name, act: 1, targetSeconds: 90, accent: "#ff7a1a" },
    shell: [
      { id: "floor", shape: "box", material: "greybox", pos: [0, -0.5, 0], size: [20, 1, 20] },
    ],
    playerStart: { pos: [0, 0.01, 0], yaw: 0 },
    exit: { pos: [0, 0.01, -5], size: [2, 0.2, 2] },
  };
}

describe("My levels panel logic", () => {
  it("lists stored levels newest first and builds the arena and editor URLs", () => {
    const stored: Stored[] = [
      { key: "old", saved: 100, level: level("old", "Older") },
      { key: "new", saved: 300, level: level("new", "Newer") },
    ];
    const view = levelsView(stored);

    expect(view.empty).toBeNull();
    expect(view.rows).toHaveLength(2);
    expect(view.rows[0].name).toBe("Newer");
    expect(view.rows[1].name).toBe("Older");
    expect(view.rows[1].playUrl).toBe("arena.html?level=local%3Aold");
    expect(view.rows[0].editUrl).toBe("editor.html?open=new");
    expect(playLevelUrl("new")).toBe("arena.html?level=local%3Anew");
    expect(editLevelUrl("new")).toBe("editor.html?open=new");
  });

  it("shows the empty message when there are no levels", () => {
    expect(levelsView([])).toEqual({ rows: [], empty: EMPTY_TEXT });
  });

  it("refuses a bad file with the validator's first three errors and stores nothing", async () => {
    const puts: Level[] = [];
    const result = await storeLevelFile(
      JSON.stringify({}),
      (saved) => {
        puts.push(saved);
        return Promise.resolve("lvl-new");
      },
    );

    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.length).toBeLessThanOrEqual(3);
    expect(result.errors[0]).toBe("meta.id is missing");
    expect(puts).toHaveLength(0);
  });

  it("refuses text that is not JSON", () => {
    expect(parseLevelFile("not a level")).toEqual({
      level: null,
      errors: ["Not a level file: it is not JSON."],
    });
  });

  it("stores a good file and gives its play URL", async () => {
    const puts: Level[] = [];
    const result = await storeLevelFile(
      JSON.stringify(level("mine", "My level")),
      (saved) => {
        puts.push(saved);
        return Promise.resolve("lvl-new");
      },
    );

    expect(result.ok).toBe(true);
    expect(result.key).toBe("lvl-new");
    expect(result.url).toBe("arena.html?level=local%3Alvl-new");
    expect(puts).toHaveLength(1);
    expect(puts[0].meta.name).toBe("My level");
  });

  it("says the browser will not save when the store refuses", async () => {
    const result = await storeLevelFile(
      JSON.stringify(level("mine", "My level")),
      () => Promise.reject(new Error("store refused")),
    );

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual([SAVE_ERROR]);
  });
});
