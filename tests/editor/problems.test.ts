import { describe, expect, it } from "vitest";
import { namedId, problemsFor, problemsLabel } from "../../src/editor/problems";
import { newLevel } from "../../src/editor/doc";
import type { Level, LevelDoor, Pickup } from "../../src/level/format";

// ED-05 stage 5: the Problems panel runs the game's own validator and turns
// each message into a row, with the id it names so a click can select it.

const START = "@start";
const EXIT = "@exit";

function levelWith(door: LevelDoor | null, key: Pickup | null): Level {
  const base = newLevel();
  return {
    ...base,
    doors: door ? [door] : [],
    pickups: key ? [key] : [],
  };
}

const redDoor: LevelDoor = { id: "door-1", pos: [0, 1.5, -4], size: [2, 3, 0.4], lock: "red" };
const redKey: Pickup = { id: "key-1", type: "key", key: "red", pos: [3, 0, 3] };

describe("ED-05 the Problems list", () => {
  it("is empty for a plain new level", () => {
    const problems = problemsFor(newLevel(), ["floor-1"], START, EXIT);
    expect(problems.filter((p) => p.severity === "error")).toEqual([]);
  });

  it("names the door a key is missing for, and selects it by click", () => {
    const level = levelWith(redDoor, null);
    const problems = problemsFor(level, ["floor-1", "door-1"], START, EXIT);
    const missing = problems.find((p) => p.text.includes("door-1"));
    expect(missing).toBeDefined();
    expect(missing!.severity).toBe("error");
    expect(missing!.id).toBe("door-1");
  });

  it("has nothing to say when the key is there", () => {
    const level = levelWith(redDoor, redKey);
    const problems = problemsFor(level, ["floor-1", "door-1", "key-1"], START, EXIT);
    expect(problems.some((p) => p.text.includes("door-1"))).toBe(false);
  });

  it("counts errors, warnings and the label", () => {
    const level = levelWith(redDoor, null);
    const problems = problemsFor(level, ["floor-1", "door-1"], START, EXIT);
    const errors = problems.filter((p) => p.severity === "error").length;
    const label = problemsLabel(problems);
    expect(label.startsWith("Problems")).toBe(true);
    expect(label).toContain(String(errors));
    expect(problemsLabel([])).toBe("Problems");
  });

  it("picks the longest id, and never a prefix of a longer one", () => {
    const ids = ["key-1", "key-12"];
    expect(namedId("pickup key-12: something", ids)).toBe("key-12");
    expect(namedId("pickup key-1: something", ids)).toBe("key-1");
    expect(namedId("nothing here", ids)).toBeNull();
  });

  it("maps a message about the start or the exit to its pseudo id", () => {
    const broken: Level = { ...newLevel(), playerStart: undefined as never };
    const problems = problemsFor(broken, ["floor-1"], START, EXIT);
    const start = problems.find((p) => p.text.includes("playerStart"));
    expect(start?.id).toBe(START);
  });
});
