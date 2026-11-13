import { describe, expect, it } from "vitest";
import { LevelDoc, newLevel } from "../../src/editor/doc";
import { triggerSummary } from "../../src/editor/trigger-text";
import type { Trigger } from "../../src/level/format";

// ED-08 stage 1: a trigger is one of the document's kinds, so every command
// the editor has works on it. It is the one kind with no position, which is
// why `IdEntry.pos` is optional.

function doc(): LevelDoc {
  return new LevelDoc(newLevel());
}

const lock: Trigger = {
  id: "lock",
  when: { kind: "enter", zone: "zone-1" },
  do: [
    { kind: "show", ids: ["box-1", "box-2"] },
    { kind: "spawn", id: "wave-1", foamer: "F01", count: 3, at: ["spawn-1"] },
  ],
};

describe("ED-08 the document holds triggers", () => {
  it("adds a trigger and undoes and redoes the add", () => {
    const d = doc();
    d.add("triggers", lock);
    expect(d.find<Trigger>("triggers", "lock")).toEqual(lock);
    expect(d.kindOf("lock")).toBe("triggers");
    expect(d.entries("triggers")).toHaveLength(1);
    d.undo();
    expect(d.find("triggers", "lock")).toBeUndefined();
    d.redo();
    expect(d.find<Trigger>("triggers", "lock")?.do).toHaveLength(2);
  });

  it("changes the when and the do list, and undoes each", () => {
    const d = doc();
    d.add("triggers", lock);
    d.change("triggers", [{ id: "lock", patch: { when: { kind: "start" } } }], "when start");
    expect(d.find<Trigger>("triggers", "lock")?.when).toEqual({ kind: "start" });
    const longer = [...lock.do, { kind: "message", text: "[Paul]", seconds: 2 } as const];
    d.change("triggers", [{ id: "lock", patch: { do: longer } }], "add message");
    expect(d.find<Trigger>("triggers", "lock")?.do).toHaveLength(3);
    d.undo();
    expect(d.find<Trigger>("triggers", "lock")?.do).toHaveLength(2);
    d.undo();
    expect(d.find<Trigger>("triggers", "lock")?.when).toEqual(lock.when);
    d.redo();
    d.redo();
    expect(d.find<Trigger>("triggers", "lock")?.do).toHaveLength(3);
  });

  it("duplicates a trigger with a fresh id and no position", () => {
    const d = doc();
    d.add("triggers", lock);
    const [copy] = d.duplicate("triggers", ["lock"]);
    expect(copy).toBeDefined();
    expect(copy).not.toBe("lock");
    expect(d.find<Trigger>("triggers", copy!)?.when).toEqual(lock.when);
    expect(d.entry(copy!)?.pos).toBeUndefined();
    d.undo();
    expect(d.find("triggers", copy!)).toBeUndefined();
    expect(d.find("triggers", "lock")).toBeDefined();
  });

  it("removes a trigger, and the ones that name it keep the name", () => {
    const d = doc();
    d.add("triggers", lock);
    const after: Trigger = { id: "after-1", when: { kind: "after", trigger: "lock", seconds: 2 }, do: [{ kind: "show", ids: ["box-1"] }] };
    d.add("triggers", after);
    d.remove("lock");
    expect(d.find("triggers", "lock")).toBeUndefined();
    expect(d.find<Trigger>("triggers", "after-1")?.when).toEqual({ kind: "after", trigger: "lock", seconds: 2 });
    d.undo();
    expect(d.find<Trigger>("triggers", "lock")).toEqual(lock);
  });

  it("adds several triggers as one undo step", () => {
    const d = doc();
    const second: Trigger = { id: "clear", when: { kind: "killed", ids: ["wave-1"] }, do: [{ kind: "hide", ids: ["box-1"] }] };
    d.addMany("triggers", [lock, second], "add the arena triggers");
    expect(d.entries("triggers")).toHaveLength(2);
    d.undo();
    expect(d.entries("triggers")).toHaveLength(0);
    d.redo();
    expect(d.entries("triggers")).toHaveLength(2);
  });

  it("gives a new trigger an id nothing else uses", () => {
    const d = doc();
    const id = d.nextId("trigger");
    d.add("triggers", { ...lock, id });
    expect(d.kindOf(id)).toBe("triggers");
    expect(d.nextId("trigger")).not.toBe(id);
  });
});

describe("ED-08 the summary line", () => {
  it("reads as the card asks: the when, then the do rows", () => {
    expect(triggerSummary(lock)).toBe("enter zone-1: show 2, spawn 3 F01");
  });

  it("names the other whens and dos", () => {
    expect(triggerSummary({ id: "a", when: { kind: "start" }, do: [{ kind: "open", door: "door-1" }] }))
      .toBe("start: open door-1");
    expect(triggerSummary({ id: "b", when: { kind: "killed", ids: ["wave-1", "wave-2"], count: 5 }, do: [{ kind: "hide", ids: ["box-1"] }] }))
      .toBe("killed 5 of wave-1, wave-2: hide 1");
    expect(triggerSummary({
      id: "c",
      when: { kind: "pressed", button: "button-1" },
      do: [{ kind: "checkpoint", pos: [0, 0, 0], yaw: 0 }],
      repeat: true,
    })).toBe("pressed button-1: checkpoint (repeats)");
    expect(triggerSummary({ id: "d", when: { kind: "after", trigger: "lock", seconds: 3 }, do: [{ kind: "wake", ids: ["foamer-1"] }] }))
      .toBe("after lock 3s: wake foamer-1");
  });
});
