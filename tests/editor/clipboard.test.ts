import { describe, expect, it } from "vitest";
import editorData from "../../data/editor.json";
import {
  capProblem, clipText, groupMembers, idsInRect, makeClip, pasteClip, readClip,
} from "../../src/editor/clipboard";
import { LevelDoc, newLevel } from "../../src/editor/doc";
import type { Level, Pickup, PlacedFoamer, Prim, Trigger, Zone } from "../../src/level/format";
import { validateLevel } from "../../src/level/validate";

// ED-13: box select, copy and paste, groups. The pointer and key wiring is
// checked in the browser; the rules are here.

const box = (id: string, x: number, group?: string): Prim => ({
  id, shape: "box", pos: [x, 1, 0], size: [2, 2, 2], colour: "#ff7a1a", behaviour: "solid",
  ...(group ? { group } : {}),
});

function level(): Level {
  const made = newLevel();
  made.prims!.push(box("wall-1", 4), box("wall-2", 8));
  made.foamers = [{ id: "foamer-1", foamer: "F01", pos: [6, 0, 2], yaw: 0 } as PlacedFoamer];
  made.zones = [{ id: "zone-1", pos: [6, 1, 0], size: [8, 2, 8] } as Zone];
  made.pickups = [{ id: "pickup-1", type: "health", amount: 25, pos: [5, 0, 5] } as Pickup];
  made.triggers = [{
    id: "trigger-1",
    when: { kind: "enter", zone: "zone-1" },
    do: [{ kind: "show", ids: ["wall-1", "wall-2", "floor-1"] }, { kind: "wake", ids: ["foamer-1"] }],
  } as Trigger];
  return made;
}

const ids = (doc: LevelDoc) => ({
  next: (prefix: string) => doc.nextId(prefix),
  nextGroup: (taken: Iterable<string>) => doc.nextGroup(taken),
});

describe("ED-13 box select", () => {
  const points = [
    { id: "a", x: 10, y: 10 }, { id: "b", x: 50, y: 40 }, { id: "c", x: 90, y: 90 },
  ];

  it("picks the things whose centre is inside the rectangle", () => {
    expect(idsInRect(points, { x0: 0, y0: 0, x1: 60, y1: 60 })).toEqual(["a", "b"]);
  });

  it("works whichever corner the drag began at", () => {
    expect(idsInRect(points, { x0: 100, y0: 100, x1: 40, y1: 30 })).toEqual(["b", "c"]);
  });

  it("picks nothing from an empty patch", () => {
    expect(idsInRect(points, { x0: 60, y0: 0, x1: 80, y1: 20 })).toEqual([]);
  });
});

describe("ED-13 copy and paste", () => {
  it("round trips through text, and other text is not a clip", () => {
    const clip = makeClip(level(), ["wall-1", "foamer-1"]);
    expect(readClip(clipText(clip))).toEqual(clip);
    expect(readClip("hello")).toBeNull();
    expect(readClip('{"some":"json"}')).toBeNull();
    expect(readClip('{"dart":"dart-clip","version":99,"entries":{}}')).toBeNull();
    expect(readClip("")).toBeNull();
  });

  it("copies nothing for the start, the exit or an id that is not there", () => {
    const clip = makeClip(level(), ["@start", "@exit", "nope"]);
    expect(Object.values(clip.entries).flat()).toEqual([]);
  });

  it("makes new ids and keeps the things' places relative to each other", () => {
    const doc = new LevelDoc(level());
    const clip = makeClip(doc.level, ["wall-1", "wall-2", "foamer-1"]);
    const made = pasteClip(clip, ids(doc), [20, 0, 30], editorData.grid);
    const all = made.map((m) => m.entry.id);
    expect(new Set(all).size).toBe(3);
    for (const id of all) expect(doc.kindOf(id)).toBeNull();
    const [w1, w2] = made.filter((m) => m.kind === "prims").map((m) => m.entry.pos!);
    const f = made.find((m) => m.kind === "foamers")!.entry.pos!;
    expect(w2![0] - w1![0]).toBe(4);
    expect(f[0] - w1![0]).toBe(2);
    expect(f[2] - w1![2]).toBe(2);
    // The middle of the set lands on the point, standing on it: the walls
    // are 2 m tall and centred, so their middle is 1 m up.
    expect((w1![0] + w2![0]) / 2).toBe(20);
    expect(w1![1]).toBe(1);
    expect(f[1]).toBe(0);
    // The originals are not touched.
    expect(doc.prim("wall-1")!.pos).toEqual([4, 1, 0]);
  });

  it("steps the copies aside when there is no point to paste at", () => {
    const doc = new LevelDoc(level());
    const made = pasteClip(makeClip(doc.level, ["wall-1"]), ids(doc), null, 0.5);
    expect(made[0]!.entry.pos).toEqual([4.5, 1, 0.5]);
  });

  it("points a copied trigger at the copies made with it, and leaves the rest", () => {
    const doc = new LevelDoc(level());
    const clip = makeClip(doc.level, ["wall-1", "zone-1", "foamer-1", "trigger-1"]);
    const made = pasteClip(clip, ids(doc), null, 0.5);
    const idOf = (kind: string) => made.find((m) => m.kind === kind)!.entry.id;
    const trigger = made.find((m) => m.kind === "triggers")!.entry as unknown as Trigger;
    expect(trigger.id).not.toBe("trigger-1");
    expect(trigger.when).toEqual({ kind: "enter", zone: idOf("zones") });
    // wall-1 was copied, wall-2 and floor-1 were not: they keep their names.
    expect(trigger.do[0]).toEqual({ kind: "show", ids: [idOf("prims"), "wall-2", "floor-1"] });
    expect(trigger.do[1]).toEqual({ kind: "wake", ids: [idOf("foamers")] });
  });

  it("pastes into another level as a level that still validates", () => {
    const clip = readClip(clipText(makeClip(level(), ["wall-1", "wall-2", "pickup-1"])))!;
    const other = new LevelDoc(newLevel());
    const made = pasteClip(clip, ids(other), [0, 0, 0], 0.5);
    other.addMixed(made, "paste");
    expect(other.level.prims!.length).toBe(3);
    expect(validateLevel(other.level).errors).toEqual([]);
    other.undo();
    expect(other.level.prims!.length).toBe(1);
    expect(other.level.pickups ?? []).toEqual([]);
  });

  it("refuses a paste that would pass a cap, with the reason", () => {
    const doc = new LevelDoc(level());
    const clip = makeClip(doc.level, ["wall-1"]);
    expect(capProblem(doc.level, clip)).toBeNull();
    const full = level();
    full.prims = Array.from({ length: editorData.limits.prims }, (_, i) => box(`b-${i}`, i));
    expect(capProblem(full, clip)).toContain(String(editorData.limits.prims));
  });

  it("refuses a paste that would pass the props cap", () => {
    const crate = (id: string, x: number) => ({ id, kind: "crate", pos: [x, 0, 0] as [number, number, number] });
    const clip = makeClip({ ...level(), props: [crate("prop-1", 0)] }, ["prop-1"]);
    const full = { ...level(), props: Array.from({ length: editorData.limits.props }, (_, i) => crate(`p-${i}`, i)) };
    expect(capProblem(level(), clip)).toBeNull();
    expect(capProblem(full, clip)).toContain(String(editorData.limits.props));
  });
});

describe("ED-13 groups", () => {
  it("groups and ungroups in one undo step each", () => {
    const doc = new LevelDoc(level());
    const group = doc.nextGroup();
    doc.setGroup(["wall-1", "foamer-1", "zone-1"], group);
    expect(groupMembers(doc.level, "wall-1").sort()).toEqual(["foamer-1", "wall-1", "zone-1"]);
    expect(groupMembers(doc.level, "wall-2")).toEqual(["wall-2"]);
    doc.setGroup(["wall-1", "foamer-1", "zone-1"], null);
    expect(groupMembers(doc.level, "wall-1")).toEqual(["wall-1"]);
    expect("group" in doc.prim("wall-1")!).toBe(false);
    doc.undo();
    expect(groupMembers(doc.level, "foamer-1").length).toBe(3);
    doc.undo();
    expect(groupMembers(doc.level, "foamer-1")).toEqual(["foamer-1"]);
  });

  it("gives a new group a name no group has", () => {
    const doc = new LevelDoc(level());
    const first = doc.nextGroup();
    doc.setGroup(["wall-1"], first);
    expect(doc.nextGroup()).not.toBe(first);
  });

  it("gives pasted copies of a group their own group", () => {
    const doc = new LevelDoc(level());
    const group = doc.nextGroup();
    doc.setGroup(["wall-1", "foamer-1"], group);
    const made = pasteClip(makeClip(doc.level, ["wall-1", "foamer-1"]), ids(doc), null, 0.5);
    const groups = made.map((m) => (m.entry as { group?: string }).group);
    expect(groups[0]).toBeTruthy();
    expect(groups[0]).not.toBe(group);
    expect(groups[1]).toBe(groups[0]);
  });

  it("keeps two groups apart when both are copied at once", () => {
    const doc = new LevelDoc(level());
    doc.setGroup(["wall-1"], doc.nextGroup());
    doc.setGroup(["wall-2"], doc.nextGroup());
    const pasted = pasteClip(makeClip(doc.level, ["wall-1", "wall-2"]), ids(doc), null, 0.5);
    const names = pasted.map((m) => (m.entry as { group?: string }).group);
    expect(names[0]).not.toBe(names[1]);
    const copies = doc.duplicate("prims", ["wall-1", "wall-2"]);
    const dup = copies.map((id) => (doc.prim(id) as Prim & { group?: string }).group);
    expect(dup[0]).not.toBe(dup[1]);
    expect(new Set([...dup, "group-1", "group-2"]).size).toBe(4);
  });

  it("gives duplicates of a group their own group, shared across kinds", () => {
    const doc = new LevelDoc(level());
    const group = doc.nextGroup();
    doc.setGroup(["wall-1", "foamer-1"], group);
    const groups = new Map<string, string>();
    const [wall] = doc.duplicate("prims", ["wall-1"], undefined, groups);
    const [foamer] = doc.duplicate("foamers", ["foamer-1"], undefined, groups);
    const made = (doc.prim(wall!) as Prim & { group?: string }).group;
    expect(made).toBeTruthy();
    expect(made).not.toBe(group);
    expect((doc.find("foamers", foamer!) as { group?: string }).group).toBe(made);
  });

  it("a level with groups validates, and a group must be a name", () => {
    const made = level();
    made.prims![1]!.group = "group-1";
    expect(validateLevel(made).errors).toEqual([]);
    (made.prims![1] as { group?: unknown }).group = "";
    expect(validateLevel(made).errors.join(" ")).toContain("group");
  });
});
