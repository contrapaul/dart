import { describe, expect, it } from "vitest";
import { applyStart } from "../../src/level/start";

// ED-01: a level's own start block, against a stand-in loadout. The real
// Loadout's setOwned and select have the same shape.

const IDS = ["B01", "B02", "B03", "B04"];

function game(active = 0) {
  const owned = new Set(IDS);
  const t = {
    loadout: {
      ids: IDS,
      activeIndex: active,
      setOwned(ids: readonly string[]) {
        owned.clear();
        for (const id of ids) owned.add(id);
        if (owned.size === 0) owned.add(IDS[0]!);
      },
      select(i: number) { if (owned.has(IDS[i]!) ) t.loadout.activeIndex = i; },
    },
    health: { max: 100, hp: 100 },
    melee: {
      weaponId: "M01",
      armed: true,
      setArmed(on: boolean) { t.melee.armed = on; },
    },
    owned,
  };
  return t;
}

describe("applyStart", () => {
  it("leaves the game alone when the level has no start block", () => {
    const g = game();
    applyStart(undefined, g);
    expect([...g.owned]).toEqual(IDS);
    expect(g.health.hp).toBe(100);
  });

  it("owns only the blasters it names, and holds the first", () => {
    const g = game();
    applyStart({ blasters: ["B03", "B01"] }, g);
    expect([...g.owned]).toEqual(["B03", "B01"]);
    expect(g.loadout.activeIndex).toBe(2);
  });

  it("sets the hand weapon and the health", () => {
    const g = game();
    applyStart({ blasters: ["B01"], melee: [], health: 25 }, g);
    expect(g.melee.armed).toBe(false);
    expect(g.health.hp).toBe(25);
    const held = game();
    applyStart({ blasters: ["B01"], melee: ["M01"] }, held);
    expect(held.melee.armed).toBe(true);
    // No health named: the bar keeps what it had.
    expect(held.health.hp).toBe(100);
  });

  it("holds the first named one even when it is already active", () => {
    const g = game(1);
    applyStart({ blasters: ["B02", "B04"] }, g);
    expect(g.loadout.activeIndex).toBe(1);
    expect([...g.owned]).toEqual(["B02", "B04"]);
  });

  it("ignores ids the game has, and keeps the loadout playable", () => {
    const g = game();
    applyStart({ blasters: ["B09"] }, g);
    // Nothing it names exists: the game is left as it was.
    expect([...g.owned]).toEqual(IDS);
    const partly = game();
    applyStart({ blasters: ["B09", "B04"] }, partly);
    expect([...partly.owned]).toEqual(["B04"]);
    expect(partly.loadout.activeIndex).toBe(3);
  });

  it("never sets health above the bar or to nothing", () => {
    const high = game();
    applyStart({ blasters: ["B01"], health: 500 }, high);
    expect(high.health.hp).toBe(100);
    const none = game();
    applyStart({ blasters: ["B01"], health: 0 }, none);
    expect(none.health.hp).toBe(1);
  });
});
