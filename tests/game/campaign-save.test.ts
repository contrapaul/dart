import { beforeEach, describe, expect, it } from "vitest";
import {
  CAMPAIGN_ORDER, SAVE_KEY, SAVE_VERSION, applyState, campaignUrl, captureState, carryTo,
  clearSave, entryState, filledBlaster, firstLevel, formatTime, newGame, nextLevel, readSave,
  writeSave,
  type CampaignState, type LiveCarry,
} from "../../src/game/campaign";

// LVL-05 stage 2: the carried state and its save. Pure: no DOM, no THREE.
// The save lives in one localStorage key, `dart.save.v1`, and every way it
// can fail (blocked storage, broken JSON, an older version) means a new
// game rather than a half-read one.

class FakeStorage {
  private map = new Map<string, string>();
  getItem(k: string) {
    return this.map.has(k) ? this.map.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.map.set(k, v);
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
  get raw(): string | undefined {
    return this.map.get(SAVE_KEY);
  }
}

function withStorage(storage: FakeStorage | null) {
  (globalThis as Record<string, unknown>).window =
    storage === null ? {} : { localStorage: storage };
}

describe("the carried state (LVL-05)", () => {
  beforeEach(() => withStorage(new FakeStorage()));

  it("a new game starts on the first level with the start set, full ammo", () => {
    const s = newGame();
    expect(s.version).toBe(SAVE_VERSION);
    expect(s.level).toBe(firstLevel());
    expect(firstLevel()).toBe(CAMPAIGN_ORDER[0]);
    // Paul's rule: B02 Musketeer alone, its magazine full.
    expect(s.blasters).toEqual([{ id: "B02", mag: 6, reserve: 1 }]);
    expect(s.health).toBe(100);
  });

  it("a level with no save begins with the blasters the order gives it, full", () => {
    const s = entryState("1-3", null);
    expect(s.level).toBe("1-3");
    expect(s.blasters.map((b) => b.id)).toEqual(["B02", "B01", "B04"]);
    for (const b of s.blasters) {
      const full = filledBlaster(b.id);
      expect(b, b.id).toEqual(full);
    }
    expect(s.health).toBe(100);
  });

  it("finishing 1-2 with 37 health and 12 of 50 reserve in the B04 carries into 1-3", () => {
    const carried = [
      { id: "B02", mag: 4, reserve: 1 },
      { id: "B01", mag: 3, reserve: 17 },
      { id: "B04", mag: 12, reserve: 50 },
    ];
    const next = carryTo("1-2", carried, 37);
    expect(next.level).toBe("1-3");
    expect(next.health).toBe(37);

    // The save holds it, and the level begins with exactly that.
    expect(writeSave(next)).toBe(true);
    const entry = entryState("1-3", readSave());
    expect(entry.health).toBe(37);
    expect(entry.blasters).toEqual(carried);
  });

  it("the save round trips as JSON under one key", () => {
    const storage = new FakeStorage();
    withStorage(storage);
    const state = carryTo("1-3", [{ id: "B03", mag: 2, reserve: 9 }], 61);
    expect(writeSave(state)).toBe(true);
    // It is JSON with a version under the one key.
    const raw = JSON.parse(storage.raw!) as Record<string, unknown>;
    expect(raw.version).toBe(SAVE_VERSION);
    expect(raw.level).toBe("1-4");
    expect(readSave()).toEqual(state);
  });

  it("a level already in the save begins with the saved state (a restart, a Continue)", () => {
    const save: CampaignState = {
      version: SAVE_VERSION,
      level: "1-2",
      blasters: [{ id: "B02", mag: 2, reserve: 1 }],
      health: 44,
    };
    expect(entryState("1-2", save)).toBe(save);
    // A different level does not read it: it begins from the order.
    expect(entryState("1-4", save).level).toBe("1-4");
  });

  it("the order ends after 1-4: there is no next level", () => {
    const last = CAMPAIGN_ORDER[CAMPAIGN_ORDER.length - 1]!;
    expect(last).toBe("1-4");
    expect(nextLevel(last)).toBeNull();
    // Every earlier one has a next; the chain ends exactly there.
    let at: string | null = firstLevel();
    const seen: string[] = [];
    while (at) {
      seen.push(at);
      at = nextLevel(at);
    }
    expect(seen).toEqual([...CAMPAIGN_ORDER]);
  });

  it("captures the level's finish and puts it back on the next level's blasters", () => {
    // The card's own case: 1-2 finished with 37 health, the B04 at 12 of 30
    // in the magazine and 50 in reserve.
    const live: LiveCarry = {
      blasters: [
        { id: "B02", mag: 2, reserve: 1 },
        { id: "B01", mag: 5, reserve: 22 },
        { id: "B04", mag: 12, reserve: 50 },
      ],
      health: { hp: 37 },
    };
    const state = captureState("1-2", live);
    expect(state.level).toBe("1-3");
    expect(state.health).toBe(37);

    // 1-3 starts with exactly that, on the same blasters.
    const next: LiveCarry = {
      blasters: [
        { id: "B02", mag: 6, reserve: 1 },
        { id: "B01", mag: 8, reserve: 40 },
        { id: "B04", mag: 35, reserve: 105 },
        { id: "B03", mag: 2, reserve: 12 },
      ],
      health: { hp: 100 },
    };
    applyState(state, next);
    expect(next.health.hp).toBe(37);
    expect(next.blasters[2]).toMatchObject({ id: "B04", mag: 12, reserve: 50 });
    expect(next.blasters[0]).toMatchObject({ id: "B02", mag: 2, reserve: 1 });
    // A blaster the state does not name is untouched: it was not carried in.
    expect(next.blasters[3]).toMatchObject({ id: "B03", mag: 2, reserve: 12 });
  });

  it("a restart inside a level goes back to the entry state, ownership included", () => {
    // The level began with B02 and B01, both full, at 100 health.
    const entry = entryState("1-2", null);
    let ownedIds = entry.blasters.map((b) => b.id);
    const live: LiveCarry = {
      blasters: [
        { id: "B02", mag: 6, reserve: 1 },
        { id: "B01", mag: 8, reserve: 40 },
        { id: "B04", mag: 35, reserve: 105 },
      ],
      health: { hp: 100 },
      setOwned: (ids) => { ownedIds = [...ids]; },
    };
    // Played a while: found the B04, spent darts, took hits.
    live.blasters[0]!.mag = 1;
    live.blasters[1]!.reserve = 6;
    live.blasters[2]!.mag = 4;
    live.health.hp = 19;

    // The restart.
    applyState(entry, live);
    expect(live.health.hp).toBe(100);
    expect(live.blasters[0]).toMatchObject({ mag: 6, reserve: 1 });
    expect(live.blasters[1]).toMatchObject({ mag: 8, reserve: 40 });
    // The blaster found in this attempt is not owned by the retry.
    expect(ownedIds).toEqual(["B02", "B01"]);
  });

  it("a break action's barrels follow the magazine it restores", () => {
    const live: LiveCarry = { blasters: [{ id: "B03", mag: 0, reserve: 0, loaded: [true, true] }], health: { hp: 100 } };
    // Saved with one shell in the magazine, one barrel spent.
    applyState({ version: SAVE_VERSION, level: "1-4", blasters: [{ id: "B03", mag: 1, reserve: 7 }], health: 90 }, live);
    expect(live.blasters[0]!.loaded).toEqual([true, false]);
    expect(live.blasters[0]!.reserve).toBe(7);
  });

  it("the health put back is never 0 and never above its maximum", () => {
    const live: LiveCarry = { blasters: [], health: { hp: 50 } };
    applyState({ version: SAVE_VERSION, level: "1-2", blasters: [], health: 0 }, live);
    expect(live.health.hp).toBe(1);
    applyState({ version: SAVE_VERSION, level: "1-2", blasters: [], health: 999 }, live);
    expect(live.health.hp).toBe(100);
  });

  it("formatTime counts whole seconds as m:ss", () => {
    expect(formatTime(0)).toBe("0:00");
    expect(formatTime(9.7)).toBe("0:09");
    expect(formatTime(65)).toBe("1:05");
    expect(formatTime(600)).toBe("10:00");
    expect(formatTime(-3)).toBe("0:00");
  });

  it("campaignUrl names the level and asks for campaign play", () => {
    expect(campaignUrl("1-2")).toBe("/arena.html?level=1-2&campaign");
  });
});

describe("the save's failures all mean a new game (LVL-05)", () => {
  it("no storage (blocked) reads null and writing reports false", () => {
    withStorage(null);
    expect(readSave()).toBeNull();
    expect(writeSave(newGame())).toBe(false);
    expect(() => clearSave()).not.toThrow();
  });

  it("storage that throws on every call is survived", () => {
    const boom = {
      getItem() { throw new Error("blocked"); },
      setItem() { throw new Error("full"); },
      removeItem() { throw new Error("blocked"); },
    };
    (globalThis as Record<string, unknown>).window = { localStorage: boom };
    expect(readSave()).toBeNull();
    expect(writeSave(newGame())).toBe(false);
    expect(() => clearSave()).not.toThrow();
  });

  it("no save at all reads null", () => {
    withStorage(new FakeStorage());
    expect(readSave()).toBeNull();
  });

  it("broken JSON reads null", () => {
    const storage = new FakeStorage();
    withStorage(storage);
    storage.setItem(SAVE_KEY, "{not json");
    expect(readSave()).toBeNull();
  });

  it("an older version reads null, so the game starts again", () => {
    const storage = new FakeStorage();
    withStorage(storage);
    storage.setItem(SAVE_KEY, JSON.stringify({ ...newGame(), version: SAVE_VERSION - 1 }));
    expect(readSave()).toBeNull();
  });

  it("a save naming a level that is not in the order reads null", () => {
    const storage = new FakeStorage();
    withStorage(storage);
    storage.setItem(SAVE_KEY, JSON.stringify({ ...newGame(), level: "9-9" }));
    expect(readSave()).toBeNull();
  });

  it("a save with no blasters, or an unknown one, reads null", () => {
    const storage = new FakeStorage();
    withStorage(storage);
    storage.setItem(SAVE_KEY, JSON.stringify({ ...newGame(), blasters: [] }));
    expect(readSave()).toBeNull();
    storage.setItem(SAVE_KEY, JSON.stringify({
      ...newGame(),
      blasters: [{ id: "B99", mag: 1, reserve: 1 }],
    }));
    expect(readSave()).toBeNull();
  });

  it("a save with no health reads null", () => {
    const storage = new FakeStorage();
    withStorage(storage);
    storage.setItem(SAVE_KEY, JSON.stringify({ ...newGame(), health: "full" }));
    expect(readSave()).toBeNull();
  });

  it("clearSave forgets it and reads null after", () => {
    const storage = new FakeStorage();
    withStorage(storage);
    expect(writeSave(newGame())).toBe(true);
    expect(readSave()).not.toBeNull();
    clearSave();
    expect(storage.raw).toBeUndefined();
    expect(readSave()).toBeNull();
  });
});
