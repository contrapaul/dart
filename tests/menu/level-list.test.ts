import { describe, expect, it } from "vitest";
import { NO_AUTHOR, levelEntries } from "../../src/menu/level-list";
import type { Level } from "../../src/level/format";
import type { StoredLevel } from "../../src/editor/store";
import { newLevel } from "../../src/editor/doc";

// MENU-01: the Levels page lists shipped levels first, then the ones made
// here newest first, each with its author, picture and details.
function level(name: string, author?: string): Level {
  const l = newLevel();
  l.meta = { ...l.meta, name, author };
  return l;
}
const stored = (key: string, saved: number, l: Level, picture?: string): StoredLevel => ({ key, saved, level: l, picture });

describe("the Levels page list (MENU-01)", () => {
  it("puts shipped levels first, then the stored ones newest first", () => {
    const rows = levelEntries(
      { "b-file": level("Bee"), "a-file": level("Ay") },
      [stored("old", 10, level("Old")), stored("new", 20, level("New"))],
    );
    expect(rows.map((r) => r.id)).toEqual(["shipped:a-file", "shipped:b-file", "local:new", "local:old"]);
    expect(rows[0]!.playUrl).toBe("arena.html?level=a-file");
    expect(rows[0]!.editUrl).toBeNull();
    expect(rows[2]!.playUrl).toBe("arena.html?level=local%3Anew");
    expect(rows[2]!.editUrl).toBe("editor.html?open=new");
  });

  it("shows the author, and [Paul] for a level that names none", () => {
    const [a, b] = levelEntries({}, [stored("a", 2, level("A", "Sam")), stored("b", 1, level("B"))]);
    expect(a!.author).toBe("Sam");
    expect(b!.author).toBe(NO_AUTHOR);
  });

  it("carries the stored picture, and none for a shipped level", () => {
    const [shipped, local] = levelEntries({ s: level("S") }, [stored("k", 1, level("K"), "data:image/jpeg;base64,AA")]);
    expect(shipped!.picture).toBeNull();
    expect(local!.picture).toBe("data:image/jpeg;base64,AA");
  });

  it("lists the details, with the save time for a level made here", () => {
    const [row] = levelEntries({}, [stored("k", 1, level("K"))]);
    expect(row!.facts.map(([label]) => label)).toEqual(["Foamers placed", "Pickups", "Target time", "Saved"]);
    expect(row!.facts.find(([l]) => l === "Target time")![1]).toBe("5:00");
  });

  it("names the validator's errors, so the page can refuse to play it", () => {
    const broken = level("Broken");
    (broken as { shell?: unknown }).shell = undefined;
    const [row] = levelEntries({}, [stored("k", 1, broken)]);
    expect(row!.errors.length).toBeGreaterThan(0);
  });
});
