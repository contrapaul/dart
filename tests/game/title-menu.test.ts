import { beforeEach, describe, expect, it } from "vitest";
import { SAVE_KEY, carryTo, newGame, writeSave } from "../../src/game/campaign";

// LVL-05 stage 2: the title's two buttons. Continue only shows when there is
// a save, and both go to the arena page in campaign mode (New game at the
// first level, Continue at the saved one, with the save forgotten).

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

/** Just the two elements the page's wiring touches. */
function page() {
  const listeners = new Map<string, () => void>();
  const newGame = {
    addEventListener: (_type: string, fn: () => void) => { listeners.set("new", fn); },
  };
  const cont = {
    hidden: false,
    addEventListener: (_type: string, fn: () => void) => { listeners.set("continue", fn); },
  };
  const root = {
    querySelector: (sel: string) => {
      if (sel === "#newGame") return newGame;
      if (sel === "#continueGame") return cont;
      return null;
    },
  } as unknown as ParentNode;
  return { root, listeners, cont };
}

describe("the title menu (LVL-05)", () => {
  let storage: FakeStorage;
  let href = "";

  beforeEach(() => {
    storage = new FakeStorage();
    (globalThis as Record<string, unknown>).window = { localStorage: storage };
    // jsdom is not in use here: give the wiring somewhere to navigate to.
    (globalThis as Record<string, unknown>).location = {
      get href() { return href; },
      set href(v: string) { href = v; },
    };
    href = "";
  });

  it("Continue is hidden with no save, and shown with one", async () => {
    const { wireTitleMenu } = await import("../../src/game/title");
    let p = page();
    wireTitleMenu(p.root);
    expect(p.cont.hidden).toBe(true);

    writeSave(newGame());
    p = page();
    wireTitleMenu(p.root);
    expect(p.cont.hidden).toBe(false);
  });

  it("New game clears the save and starts the first level in campaign mode", async () => {
    writeSave(carryTo("1-2", [{ id: "B02", mag: 3, reserve: 1 }], 55));
    const { wireTitleMenu } = await import("../../src/game/title");
    const p = page();
    wireTitleMenu(p.root);
    p.listeners.get("new")!();
    expect(storage.getItem(SAVE_KEY)).toBeNull();
    expect(href).toBe("/arena.html?level=1-1-pit&campaign");
  });

  it("Continue starts the saved level in campaign mode", async () => {
    writeSave(carryTo("1-3", [{ id: "B04", mag: 12, reserve: 50 }], 37));
    const { wireTitleMenu } = await import("../../src/game/title");
    const p = page();
    wireTitleMenu(p.root);
    p.listeners.get("continue")!();
    expect(href).toBe("/arena.html?level=1-4&campaign");
  });

  it("Continue without a save (another tab cleared it) starts the first level", async () => {
    const { wireTitleMenu } = await import("../../src/game/title");
    const p = page();
    wireTitleMenu(p.root);
    p.listeners.get("continue")!();
    expect(href).toBe("/arena.html?level=1-1-pit&campaign");
  });
});
