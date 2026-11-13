import { describe, expect, it } from "vitest";
import { exportFileName, readLevelFile } from "../../src/editor/files";
import { newLevel } from "../../src/editor/doc";
import type { Level } from "../../src/level/format";

// ED-02 stage 4: the file the editor writes and the file it reads back.

const level = (patch: Partial<Level> = {}): Level => ({ ...newLevel(), ...patch });

describe("exportFileName", () => {
  it("slugs the level's name", () => {
    expect(exportFileName(level({ meta: { ...newLevel().meta, name: "The Pit, take 2" } }))).toBe("the-pit-take-2.dart.json");
  });

  it("falls back to level when the name has no letters or digits", () => {
    expect(exportFileName(level({ meta: { ...newLevel().meta, name: "   " } }))).toBe("level.dart.json");
    expect(exportFileName(level({ meta: { ...newLevel().meta, name: "!!!" } }))).toBe("level.dart.json");
  });

  it("keeps one set of dashes where words touch punctuation", () => {
    expect(exportFileName(level({ meta: { ...newLevel().meta, name: "Foam:  room 3!" } }))).toBe("foam-room-3.dart.json");
  });
});

describe("readLevelFile", () => {
  it("reads a level the editor wrote", () => {
    const text = JSON.stringify(newLevel());
    const result = readLevelFile(text);
    expect(result.errors).toEqual([]);
    expect(result.level?.prims?.[0]?.id).toBe("floor-1");
    expect(result.level?.meta.name).toBe("[Paul]");
  });

  it("says why a broken file will not load", () => {
    const broken = JSON.stringify({ ...newLevel(), prims: [] });
    const result = readLevelFile(broken);
    expect(result.level).toBeUndefined();
    expect(result.errors.join(" ")).toContain("prims");
  });

  it("refuses text that is not JSON", () => {
    const result = readLevelFile("{ not json");
    expect(result.level).toBeUndefined();
    expect(result.errors[0]).toContain("not a level file");
  });

  it("refuses an array or a null", () => {
    expect(readLevelFile("[]").errors.length).toBeGreaterThan(0);
    expect(readLevelFile("null").errors.length).toBeGreaterThan(0);
  });

  it("lists every validator error, not just the first", () => {
    const text = JSON.stringify({ ...newLevel(), prims: [{ ...newLevel().prims![0]!, size: [0, 0, 0] }] });
    const result = readLevelFile(text);
    expect(result.errors.length).toBeGreaterThan(1);
  });
});
