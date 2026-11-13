import { describe, expect, it } from "vitest";
import { LevelDoc, newLevel } from "../../src/editor/doc";
import { triggerSummary } from "../../src/editor/trigger-text";
import {
  DO_KINDS, WHEN_KINDS, applyLink, emptyDo, emptyWhen, fieldIds, firstLinkKey, newTrigger,
  spawnActionIds, triggerIds,
} from "../../src/editor/trigger-parts";
import levelJson from "../../data/levels/ed-07.json";
import type { Level, Trigger } from "../../src/level/format";

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

describe("ED-08 what a new trigger starts as", () => {
  it("has a when the validator accepts and an empty do", () => {
    const made = newTrigger("trigger-1");
    expect(made.when).toEqual({ kind: "start" });
    expect(made.id).toBe("trigger-1");
    expect(made.repeat).toBeUndefined();
    // No message text: that is Paul's to write.
    expect(JSON.stringify(made)).not.toContain("message");
  });

  it("makes an empty when and do of each kind with the fields the validator reads", () => {
    for (const { kind } of WHEN_KINDS) expect(emptyWhen(kind).kind).toBe(kind);
    expect(emptyWhen("after")).toEqual({ kind: "after", trigger: "", seconds: 1 });
    for (const { kind } of DO_KINDS) expect(emptyDo(kind).kind).toBe(kind);
    expect(emptyDo("spawn")).toEqual({ kind: "spawn", id: "", foamer: "F01", count: 1, at: [] });
    expect(emptyDo("checkpoint")).toEqual({ kind: "checkpoint", pos: [0, 0, 0], yaw: 0 });
  });

  it("offers the ids of the right kind for each field", () => {
    const level = levelJson as unknown as Level;
    expect(fieldIds(level, { kind: "enter" })).toEqual(["arena-zone"]);
    expect(fieldIds(level, { kind: "killed" })).toEqual(["wave-1", "wave-2-spawn"]);
    expect(fieldIds(level, { kind: "show" })).toContain("blocker");
    expect(fieldIds(level, { kind: "open" })).toEqual(["side-door", "exit-door"]);
    expect(fieldIds(level, { kind: "message" })).toBeNull();
    expect(spawnActionIds(level)).toEqual(["wave-1", "wave-2-spawn"]);
  });
});

describe("ED-08 stage 3: linking a click to a field", () => {
  const base: Trigger = {
    id: "t1",
    when: { kind: "enter", zone: "" },
    do: [
      { kind: "show", ids: [] },
      { kind: "open", door: "" },
      { kind: "message", text: "[Paul]" },
    ],
  };

  it("puts a clicked zone into enter and a Foamer into killed", () => {
    expect(applyLink(base, "enter", "zone-1", "zones")?.when).toEqual({ kind: "enter", zone: "zone-1" });
    const killed: Trigger = { id: "t2", when: { kind: "killed", ids: [] }, do: [{ kind: "show", ids: [] }] };
    expect(applyLink(killed, "killed", "foamer-1", "foamers")?.when).toEqual({ kind: "killed", ids: ["foamer-1"] });
  });

  it("adds to a show row, and replaces the door of an open row", () => {
    const shown = applyLink(base, "do:0", "box-1", "prims");
    expect(shown?.do[0]).toEqual({ kind: "show", ids: ["box-1"] });
    expect(applyLink(base, "do:1", "door-1", "doors")?.do[1]).toEqual({ kind: "open", door: "door-1" });
  });

  it("refuses the wrong kind, a name already there, and a row that takes none", () => {
    expect(applyLink(base, "enter", "box-1", "prims")).toBeNull();
    expect(applyLink(base, "do:0", "door-1", "doors")).toBeNull();
    expect(applyLink(base, "do:2", "box-1", "prims")).toBeNull();
    const twice = applyLink(base, "do:0", "box-1", "prims")!;
    expect(applyLink(twice, "do:0", "box-1", "prims")).toBeNull();
  });

  it("names the field L links first, and every thing a trigger names", () => {
    expect(firstLinkKey(base)).toBe("enter");
    expect(firstLinkKey({ id: "t3", when: { kind: "start" }, do: [{ kind: "message", text: "[Paul]" }, { kind: "hide", ids: ["box-1"] }] }))
      .toBe("do:1");
    expect(firstLinkKey({ id: "t4", when: { kind: "start" }, do: [{ kind: "message", text: "[Paul]" }] })).toBeNull();
    const named = triggerIds({
      id: "t5",
      when: { kind: "killed", ids: ["wave-1"] },
      do: [
        { kind: "show", ids: ["box-1", "foamer-1"] },
        { kind: "spawn", id: "wave-2", foamer: "F01", count: 2, at: ["spawn-1"] },
        { kind: "open", door: "door-1" },
        { kind: "checkpoint", pos: [0, 0, 0], yaw: 0 },
      ],
    });
    expect(named).toEqual(["wave-1", "box-1", "foamer-1", "spawn-1", "door-1"]);
  });
});
