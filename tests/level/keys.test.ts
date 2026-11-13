// ED-07a: the key rules. A key pickup has a colour; a door locked to that
// colour opens when the player reaches it holding the key. No Three.js, no
// DOM: the ring is just the held set, the door rule just a lookup.

import { describe, expect, it } from "vitest";
import { KeyRing, doorOpensFor } from "../../src/level/keys";
import type { LevelDoor } from "../../src/level/format";

function door(lock: LevelDoor["lock"]): LevelDoor {
  return { id: "d", pos: [0, 1, 0], size: [2, 2, 1], lock };
}

describe("KeyRing", () => {
  it("holds the keys it is given", () => {
    const ring = new KeyRing();
    expect(ring.has("red")).toBe(false);
    ring.add("red");
    expect(ring.has("red")).toBe(true);
    ring.add("blue");
    expect(ring.has("blue")).toBe(true);
  });

  it("held() lists the keys in the order red, blue, yellow", () => {
    const ring = new KeyRing();
    ring.add("yellow");
    ring.add("blue");
    ring.add("red");
    expect(ring.held()).toEqual(["red", "blue", "yellow"]);
    ring.clear();
    expect(ring.held()).toEqual([]);
    expect(ring.has("yellow")).toBe(false);
  });

  it("add of a key already held changes nothing", () => {
    const ring = new KeyRing();
    ring.add("red");
    ring.add("red");
    expect(ring.held()).toEqual(["red"]);
  });
});

describe("doorOpensFor", () => {
  it("a `none` lock always opens, with or without keys", () => {
    const d = door("none");
    expect(doorOpensFor(d, new KeyRing())).toBe(true);
  });

  it("a `trigger` lock never opens by key", () => {
    const d = door("trigger");
    for (const c of ["red", "blue", "yellow"] as const) {
      const ring = new KeyRing();
      ring.add(c);
      expect(doorOpensFor(d, ring)).toBe(false);
    }
    expect(doorOpensFor(d, new KeyRing())).toBe(false);
  });

  it("a colour lock opens only when that colour is held", () => {
    const ring = new KeyRing();
    expect(doorOpensFor(door("red"), ring)).toBe(false);
    ring.add("blue");
    expect(doorOpensFor(door("red"), ring)).toBe(false);
    ring.add("red");
    expect(doorOpensFor(door("red"), ring)).toBe(true);
    expect(doorOpensFor(door("yellow"), ring)).toBe(false);
  });
});
