import { describe, expect, it } from "vitest";
import { pictureDue, PICTURE_EVERY } from "../../src/editor/store";
describe("picture due", () => {
  it("is due when never taken", () => {
    expect(pictureDue(null, 1000)).toBe(true);
  });
  it("is not due within the window", () => {
    expect(pictureDue(10_000, 10_000 + PICTURE_EVERY - 1)).toBe(false);
  });
  it("is due once the window passes", () => {
    expect(pictureDue(10_000, 10_000 + PICTURE_EVERY)).toBe(true);
  });
});
import { mapsView, filterRows, builtInName } from "../../src/editor/maps-screen";
import type { Level } from "../../src/level/format";
import type { StoredLevel } from "../../src/editor/store";

const lvl = (name: string) => ({ meta: { name } }) as unknown as Level;
const stored = (key: string, saved: number, name = key, picture?: string): StoredLevel => ({
  key, saved, level: lvl(name), picture,
});

describe("builtInName", () => {
  it("drops the folder and the extension", () => {
    expect(builtInName("../../data/levels/1-1-pit.json")).toBe("1-1-pit");
  });
});

describe("mapsView", () => {
  it("lists saved levels newest first, then built-ins", () => {
    const rows = mapsView([stored("new", 20, "New"), stored("old", 10, "Old")], [{ path: "data/levels/b.json" }], null);
    expect(rows.map((r) => r.name)).toEqual(["New", "Old", "b"]);
  });

  it("marks the open level once", () => {
    const rows = mapsView([stored("a", 20), stored("b", 10)], [], "b");
    expect(rows.map((r) => r.current)).toEqual([false, true]);
  });

  it("carries the picture and drops the name default", () => {
    const rows = mapsView([stored("a", 20, "", "data:image/jpeg;base64,x")], [], null);
    expect(rows[0].picture).toBe("data:image/jpeg;base64,x");
    expect(rows[0].name).toBe("[Paul]");
  });

  it("gives built-ins no key, picture or date", () => {
    const rows = mapsView([], [{ path: "data/levels/b.json" }], null);
    expect(rows[0]).toMatchObject({ kind: "builtIn", key: null, picture: null, when: null, current: false });
  });
});

describe("filterRows", () => {
  const rows = mapsView([stored("a", 20, "Arena"), stored("b", 10, "Pit")], [{ path: "data/levels/Arena.json" }], null);
  it("returns all rows for an empty query", () => {
    expect(filterRows(rows, "").length).toBe(3);
    expect(filterRows(rows, "  ").length).toBe(3);
  });
  it("filters by name, case-insensitive", () => {
    expect(filterRows(rows, "arena").map((r) => r.name)).toEqual(["Arena", "Arena"]);
  });
  it("returns nothing when nothing matches", () => {
    expect(filterRows(rows, "zz")).toEqual([]);
  });
});
