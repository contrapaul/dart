import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  FOLDED_KEY, foldedGroups, isFolded, reloadFolded, setFolded, toggleFolded, unfoldGroup,
} from "../../src/editor/outliner-fold";

// ED-30 item 1: folding state lives in a module Set and in localStorage,
// and survives a redraw of the outliner (a rebuild is just a fresh read of
// the same state).

describe("ED-30 folding state", () => {
  const store = new Map<string, string>();
  const fakeStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => store.clear(),
    key: () => null,
    get length() { return store.size; },
  };

  beforeEach(() => {
    (globalThis as Record<string, unknown>).localStorage = fakeStorage;
    reloadFolded();
  });

  afterEach(() => {
    (globalThis as Record<string, unknown>).localStorage = undefined;
    reloadFolded();
  });

  it("starts unfolded and folds and unfolds by title", () => {
    expect(foldedGroups()).toEqual([]);
    expect(toggleFolded("solid")).toBe(true);
    expect(isFolded("solid")).toBe(true);
    expect(toggleFolded("solid")).toBe(false);
    expect(isFolded("solid")).toBe(false);
  });

  it("survives a rebuild: the folded title is read back after a reload", () => {
    setFolded("solid", true);
    setFolded("Foamers", true);
    expect(isFolded("solid")).toBe(true);
    reloadFolded();
    expect(isFolded("solid")).toBe(true);
    expect(isFolded("Foamers")).toBe(true);
    expect(isFolded("Pickups")).toBe(false);
  });

  it("persists to localStorage under the card's key", () => {
    setFolded("solid", true);
    expect(store.has(FOLDED_KEY)).toBe(true);
    expect(JSON.parse(store.get(FOLDED_KEY)!)).toContain("solid");
  });

  it("unfoldGroup clears one group and leaves the others", () => {
    setFolded("solid", true);
    setFolded("Logic", true);
    unfoldGroup("solid");
    expect(isFolded("solid")).toBe(false);
    expect(isFolded("Logic")).toBe(true);
  });

  it("survives a broken storage value", () => {
    store.set(FOLDED_KEY, "not json");
    reloadFolded();
    expect(foldedGroups()).toEqual([]);
  });
});
