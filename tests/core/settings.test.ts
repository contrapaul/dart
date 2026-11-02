import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULTS, SettingsStore, STORAGE_KEY, DIFFICULTIES } from "../../src/core/settings";

// A tiny fake localStorage: the store must work with it present, empty,
// broken, or absent (blocked storage).
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
}

function withStorage(storage: FakeStorage | null) {
  (globalThis as Record<string, unknown>).window =
    storage === null ? {} : { localStorage: storage };
}

describe("SettingsStore (UI-01 stage 2)", () => {
  let store: FakeStorage;

  beforeEach(() => {
    store = new FakeStorage();
    withStorage(store);
  });

  it("empty storage gives the defaults", () => {
    const s = new SettingsStore();
    expect(s.value).toEqual(DEFAULTS);
    expect(s.value.difficulty).toBe("normal");
    expect(s.value.fov).toBe(75);
  });

  it("broken storage (blocked or bad JSON) still plays: the defaults", () => {
    withStorage(null); // blocked: window.localStorage absent
    expect(new SettingsStore().value).toEqual(DEFAULTS);
    withStorage(store);
    store.setItem(STORAGE_KEY, "{not json");
    expect(new SettingsStore().value).toEqual(DEFAULTS);
  });

  it("a saved value round-trips", () => {
    const a = new SettingsStore();
    a.set("fov", 90);
    a.set("invertY", true);
    const b = new SettingsStore();
    expect(b.value.fov).toBe(90);
    expect(b.value.invertY).toBe(true);
  });

  it("picking a preset sets its damage taken", () => {
    const s = new SettingsStore();
    for (const key of Object.keys(DIFFICULTIES)) {
      s.setDifficulty(key);
      expect(s.value.difficulty).toBe(key);
      expect(s.value.damageTaken).toBe(DIFFICULTIES[key].damageTaken);
    }
    expect(DIFFICULTIES.story.damageTaken).toBe(0.5);
    expect(DIFFICULTIES.normal.damageTaken).toBe(1);
    expect(DIFFICULTIES.hard.damageTaken).toBe(1.5);
    expect(DIFFICULTIES.fury.damageTaken).toBe(2);
  });

  it("moving the damage taken slider marks the difficulty Custom", () => {
    const s = new SettingsStore();
    s.setDifficulty("hard");
    expect(s.value.difficulty).toBe("hard");
    s.set("damageTaken", 1.2);
    expect(s.value.difficulty).toBe("custom");
    expect(s.value.damageTaken).toBe(1.2);
    // Other settings do not make it Custom.
    s.setDifficulty("normal");
    s.set("fov", 80);
    expect(s.value.difficulty).toBe("normal");
  });

  it("an older saved version gains new keys with their defaults", () => {
    // A save from before reduceHeadBob existed, with an old version number.
    store.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 0, fov: 60, difficulty: "fury", damageTaken: 2 }),
    );
    const s = new SettingsStore();
    expect(s.value.fov).toBe(60); // kept
    expect(s.value.difficulty).toBe("fury"); // kept
    expect(s.value.reduceHeadBob).toBe(DEFAULTS.reduceHeadBob); // gained
    expect(s.value.reduceShake).toBe(DEFAULTS.reduceShake); // gained
    expect(s.value.volume).toBe(DEFAULTS.volume); // gained
  });
});
