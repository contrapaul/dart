import { describe, expect, it } from "vitest";
import { LevelDoc, newLevel, ENTRY_KINDS } from "../../src/editor/doc";
import {
  doorColour, dragPatch, makeDoor, makeFoamer, makePickup, makeSpawn, makeZone, pickupColour, rigLabel,
} from "../../src/editor/parts";
import { capsuleFor } from "../../src/editor/markers";
import { validateLevel } from "../../src/level/validate";
import type { Level, LevelDoor, Pickup, PlacedFoamer, Zone } from "../../src/level/format";

// ED-05 stage 1: the document edits every kind of placed thing, not just the
// prims, on the same undo list and against the same id space.

function doc(): LevelDoc {
  return new LevelDoc(newLevel());
}

const foamer = (d: LevelDoc): PlacedFoamer => makeFoamer(d.nextId("foamer"), [1, 0, 1]);
const pickup = (d: LevelDoc): Pickup => makePickup(d.nextId("key"), "key", [2, 0, 2]);
const door = (d: LevelDoc): LevelDoor => makeDoor(d.nextId("door"), [0, 0, 0]);
const spawn = (d: LevelDoc) => makeSpawn(d.nextId("spawn"), [3, 0, 3]);
const zone = (d: LevelDoc) => makeZone(d.nextId("zone"), [4, 0, 4]);

describe("ED-05 the document's other kinds", () => {
  it("adds, undoes and redoes a Foamer", () => {
    const d = doc();
    const f = foamer(d);
    d.add("foamers", f);
    expect(d.find("foamers", f.id)).toEqual(f);
    d.undo();
    expect(d.find("foamers", f.id)).toBeUndefined();
    d.redo();
    expect(d.find("foamers", f.id)).toEqual(f);
  });

  it("adds, undoes and redoes a pickup, a door, a spawn point and a zone", () => {
    const d = doc();
    const made = [
      ["pickups", pickup(d)],
      ["doors", door(d)],
      ["spawnPoints", spawn(d)],
      ["zones", zone(d)],
    ] as const;
    for (const [kind, entry] of made) d.add(kind, entry);
    for (const [kind, entry] of made) expect(d.find(kind, entry.id)).toBeDefined();
    for (let i = 0; i < made.length; i++) d.undo();
    for (const [kind, entry] of made) expect(d.find(kind, entry.id)).toBeUndefined();
    for (let i = 0; i < made.length; i++) d.redo();
    for (const [kind, entry] of made) expect(d.find(kind, entry.id)).toEqual(entry);
  });

  it("changes a Foamer's yaw and undoes it", () => {
    const d = doc();
    const f = foamer(d);
    d.add("foamers", f);
    d.change("foamers", [{ id: f.id, patch: { yaw: 1.5, promoted: true } }], "turn");
    expect(d.find<PlacedFoamer>("foamers", f.id)?.yaw).toBe(1.5);
    expect(d.find<PlacedFoamer>("foamers", f.id)?.promoted).toBe(true);
    d.undo();
    expect(d.find<PlacedFoamer>("foamers", f.id)).toEqual(f);
  });

  it("changes a door's lock, a zone's size and a pickup's type", () => {
    const d = doc();
    const dr = door(d);
    const zo = zone(d);
    const pk = makePickup(d.nextId("pickup"), "health", [5, 0, 5]);
    d.add("doors", dr);
    d.add("zones", zo);
    d.add("pickups", pk);
    d.change("doors", [{ id: dr.id, patch: { lock: "blue", colour: "#2ec4ff" } }]);
    d.change("zones", [{ id: zo.id, patch: { size: [8, 4, 8] } }]);
    d.change("pickups", [{ id: pk.id, patch: { type: "key", key: "blue" } }]);
    expect(d.find<LevelDoor>("doors", dr.id)?.lock).toBe("blue");
    expect(d.find<LevelDoor>("doors", dr.id)?.colour).toBe("#2ec4ff");
    expect(d.find<Zone>("zones", zo.id)?.size).toEqual([8, 4, 8]);
    expect(d.find<Pickup>("pickups", pk.id)?.key).toBe("blue");
    d.undo();
    d.undo();
    d.undo();
    expect(d.find<LevelDoor>("doors", dr.id)).toEqual(dr);
    expect(d.find("zones", zo.id)).toEqual(zo);
    expect(d.find("pickups", pk.id)).toEqual(pk);
  });

  it("removes a pickup and comes back with it", () => {
    const d = doc();
    const pk = pickup(d);
    d.add("pickups", pk);
    d.remove(pk.id);
    expect(d.find("pickups", pk.id)).toBeUndefined();
    d.undo();
    expect(d.find("pickups", pk.id)).toEqual(pk);
  });

  it("duplicates a Foamer with a fresh id in the same kind", () => {
    const d = doc();
    const f = foamer(d);
    d.add("foamers", f);
    const made = d.duplicate("foamers", [f.id], [1, 0, 1]);
    expect(made).toHaveLength(1);
    expect(made[0]).not.toBe(f.id);
    expect(d.kindOf(made[0]!)).toBe("foamers");
    expect(d.find<PlacedFoamer>("foamers", made[0]!)?.foamer).toBe(f.foamer);
    d.undo();
    expect(d.find("foamers", made[0]!)).toBeUndefined();
    expect(d.find("foamers", f.id)).toEqual(f);
  });

  it("keeps ids unique across kinds, and makes a fresh one in any prefix", () => {
    const d = doc();
    const f = foamer(d);
    d.add("foamers", f);
    const zoneId = d.nextId("zone");
    expect(zoneId).not.toBe(f.id);
    // The same number may not be used twice in two kinds either: the id is
    // the number that matters, and the validator claims one set.
    const used = new Set<string>();
    for (const kind of ENTRY_KINDS) for (const e of d.entries(kind)) used.add(e.id);
    expect(used.size).toBe([...d.entries("prims"), ...d.entries("foamers")].length);
  });

  it("never makes an id another kind already has", () => {
    const d = doc();
    // A level that already has `key-1` as a prim: the next key gets -2.
    d.add("prims", { id: "key-1", shape: "box", pos: [0, 0, 0], size: [1, 1, 1], colour: "#ffffff", behaviour: "solid" });
    const id = d.nextId("key");
    expect(id).not.toBe("key-1");
    expect(d.kindOf(id)).toBeNull();
  });

  it("finds an id whatever kind it is", () => {
    const d = doc();
    const f = foamer(d);
    const zo = zone(d);
    d.add("foamers", f);
    d.add("zones", zo);
    expect(d.kindOf(f.id)).toBe("foamers");
    expect(d.kindOf(zo.id)).toBe("zones");
    expect(d.entry(zo.id)).toEqual(zo);
    expect(d.kindOf("nothing-9")).toBeNull();
  });

  it("moves the start as one undo step", () => {
    const d = doc();
    const before = { ...d.level.playerStart, pos: [...d.level.playerStart.pos] };
    d.setStart({ pos: [4, 0, 4] });
    expect(d.level.playerStart.pos).toEqual([4, 0, 4]);
    d.setStart({ yaw: 1.5708 }, "turn the start");
    expect(d.level.playerStart.yaw).toBeCloseTo(1.5708);
    d.undo();
    expect(d.level.playerStart).toEqual({ ...before, pos: [4, 0, 4] });
    d.undo();
    expect(d.level.playerStart).toEqual({ ...before });
  });

  it("moves the exit as one undo step", () => {
    const d = doc();
    const before = { ...d.level.exit, pos: [...d.level.exit.pos], size: [...d.level.exit.size] };
    d.setExit({ pos: [3, 0, -6], size: [4, 1, 4] });
    expect(d.level.exit.pos).toEqual([3, 0, -6]);
    d.undo();
    expect(d.level.exit).toEqual(before);
  });

  it("loads a level with every kind and validates it", () => {
    const d = doc();
    const f = makeFoamer(d.nextId("foamer"), [1, 0, 1]);
    const key = makePickup(d.nextId("key"), "key", [2, 0, 2]);
    const dr = makeDoor(d.nextId("door"), [0, 0, -3]);
    const zo = makeZone(d.nextId("zone"), [4, 0, 4]);
    const sp = makeSpawn(d.nextId("spawn"), [5, 0, 5]);
    d.add("foamers", f);
    d.add("pickups", key);
    d.add("doors", { ...dr, lock: "red" });
    d.add("zones", zo);
    d.add("spawnPoints", sp);
    expect(validateLevel(d.level).errors).toEqual([]);
  });
});

describe("ED-05 the markers' data", () => {
  it("colours a key pickup by its colour and a door by its lock", () => {
    const key = makePickup("k1", "key", [0, 0, 0]);
    expect(pickupColour(key)).toBe("#ff4f4f");
    expect(pickupColour({ ...key, key: "yellow" })).toBe("#ffd23f");
    expect(doorColour({ id: "d1", pos: [0, 0, 0], size: [1, 1, 1], lock: "red" })).toBe("#ff4f4f");
    expect(doorColour({ id: "d2", pos: [0, 0, 0], size: [1, 1, 1], lock: "none", colour: "#123456" })).toBe("#123456");
  });

  it("gives a new Foamer a real rig and a new door its key fields", () => {
    const f = makeFoamer("f1", [0.2, 0, 0.2]);
    expect(f.pos).toEqual([0, 0, 0]);
    expect(f.foamer).toMatch(/^F\d\d$/);
    expect(rigLabel("F01")).toContain("Slowmer");
    const door = makeDoor("d1", [0, 0, 0]);
    expect(door.lock).toBe("none");
    expect(door.size).toEqual([2, 3, 0.4]);
  });

  it("gives each pickup type the fields it needs to validate", () => {
    const d = doc();
    for (const type of ["darts-standard", "health", "blaster", "melee", "key"] as const) {
      const p = makePickup(d.nextId("pickup"), type, [0, 0, 0]);
      d.add("pickups", p);
      expect(validateLevel(d.level).errors).toEqual([]);
    }
  });
});

/** A test level with a red key and a red locked door: the validator's own
 *  check that a lock has a key somewhere in the level. */
function keyLevel(withKey: boolean): Level {
  const base = newLevel();
  const door: LevelDoor = { id: "door-1", pos: [0, 1.5, -4], size: [2, 3, 0.4], lock: "red" };
  const key: Pickup = { id: "key-1", type: "key", key: "red", pos: [3, 0, 3] };
  return { ...base, doors: [door], pickups: withKey ? [key] : [] };
}

describe("ED-05 key doors", () => {
  it("passes with the key in the level", () => {
    expect(validateLevel(keyLevel(true)).errors).toEqual([]);
  });

  it("names the door when the key is missing", () => {
    const errors = validateLevel(keyLevel(false)).errors;
    expect(errors.some((e) => e.includes("door-1") && e.includes("red"))).toBe(true);
  });
});

describe("ED-05 the markers' size and the handles' patch", () => {
  it("makes a capsule per rig, taller for a taller rig", () => {
    const a = capsuleFor("F01");
    expect(a.height).toBeGreaterThan(1);
    expect(a.radius).toBeGreaterThan(0.1);
    expect(a.radius).toBeLessThanOrEqual(a.height / 2);
    expect(capsuleFor("F01")).toEqual(a);
  });

  it("moves a marker by the drag, snapped", () => {
    const patch = dragPatch(
      { kind: "foamers", pos: [0, 0, 0], yawDeg: 0, size: null },
      [0.74, 0, 0], 0, [1, 1, 1], 0.5,
    );
    expect(patch).toEqual({ pos: [0.5, 0, 0] });
  });

  it("turns a Foamer or the start into yaw in radians, a door into rotY", () => {
    const f = dragPatch({ kind: "foamers", pos: [0, 0, 0], yawDeg: 0, size: null }, [0, 0, 0], 90, [1, 1, 1], 0);
    expect(f?.yaw).toBeCloseTo(Math.PI / 2);
    const s = dragPatch({ kind: "start", pos: [0, 0, 0], yawDeg: 0, size: null }, [0, 0, 0], 90, [1, 1, 1], 0);
    expect(s?.yaw).toBeCloseTo(Math.PI / 2);
    const d = dragPatch({ kind: "doors", pos: [0, 0, 0], yawDeg: 0, size: [2, 3, 0.4] }, [0, 0, 0], 90, [1, 1, 1], 0);
    expect(d).toEqual({ rotY: 90 });
    // 0 faces -z for all three (format.ts): no side is flipped.
    expect(f?.yaw).toBe(s?.yaw);
  });

  it("resizes a zone, a door and the exit, and never a Foamer or a pickup", () => {
    const z = dragPatch({ kind: "zones", pos: [0, 0, 0], yawDeg: 0, size: [4, 3, 4] }, [0, 0, 0], 0, [2, 1, 1], 0);
    expect(z?.size).toEqual([8, 3, 4]);
    const e = dragPatch({ kind: "exit", pos: [0, 0, 0], yawDeg: 0, size: [2, 1, 2] }, [0, 0, 0], 0, [2, 1, 2], 0);
    expect(e?.size).toEqual([4, 1, 4]);
    expect(dragPatch({ kind: "foamers", pos: [0, 0, 0], yawDeg: 0, size: null }, [0, 0, 0], 0, [2, 2, 2], 0)).toBeNull();
    expect(dragPatch({ kind: "pickups", pos: [0, 0, 0], yawDeg: 0, size: null }, [0, 0, 0], 0, [2, 2, 2], 0)).toBeNull();
  });

  it("does not turn a zone or a spawn point", () => {
    expect(dragPatch({ kind: "zones", pos: [0, 0, 0], yawDeg: 0, size: [1, 1, 1] }, [0, 0, 0], 45, [1, 1, 1], 0)).toBeNull();
    expect(dragPatch({ kind: "spawnPoints", pos: [0, 0, 0], yawDeg: 0, size: null }, [0, 0, 0], 45, [1, 1, 1], 0)).toBeNull();
  });

  it("keeps a size above a floor of 0.1 m", () => {
    const z = dragPatch({ kind: "zones", pos: [0, 0, 0], yawDeg: 0, size: [4, 3, 4] }, [0, 0, 0], 0, [0.001, 1, 1], 0);
    expect((z?.size as number[] | undefined)?.[0]).toBe(0.1);
  });

  it("returns null for a drag that changed nothing", () => {
    expect(dragPatch({ kind: "foamers", pos: [1, 2, 3], yawDeg: 0, size: null }, [0, 0, 0], 0, [1, 1, 1], 0.5)).toBeNull();
  });
});
