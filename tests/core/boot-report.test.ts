import { afterEach, describe, expect, it } from "vitest";
import { BootReport, countMesherFallbacks, diagText, mesherMode } from "../../src/core/boot-report";
import { Input } from "../../src/core/input";

// PT-10: a page records its boot in named steps with the time each took,
// writes the step it is waiting on into the status line ("Loading blasters
// 3 / 8"), logs one line per step, and with ?diag keeps a readout up.

type Listener = (e: Event) => void;
class Emitter {
  readonly listeners = new Map<string, Listener[]>();
  addEventListener(type: string, fn: Listener) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), fn]);
  }
  dispatch(type: string, e: Event = new Event(type)) {
    for (const fn of this.listeners.get(type) ?? []) fn(e);
  }
}

interface LockCall { options: unknown; inClick: boolean }
class FakeCanvas extends Emitter {
  calls: LockCall[] = [];
  clicking = false;
  behaviour: (options: unknown) => unknown = () => undefined;
  requestPointerLock(options?: unknown) {
    this.calls.push({ options, inClick: this.clicking });
    return this.behaviour(options);
  }
  async click() {
    this.clicking = true;
    this.dispatch("click");
    await Promise.resolve();
    this.clicking = false;
  }
}

/** A status element and a console, both counters the test can read. */
function harness() {
  const status = { textContent: "Loading" };
  const logged: unknown[][] = [];
  const real = console.log;
  const realWarn = console.warn;
  console.log = (...args: unknown[]) => { logged.push(args); };
  console.warn = (...args: unknown[]) => { logged.push(args); };
  return {
    status,
    logged,
    restore() {
      console.log = real;
      console.warn = realWarn;
    },
  };
}

let h: ReturnType<typeof harness> | null = null;
afterEach(() => {
  h?.restore();
  h = null;
});

/** A clock the test moves by hand, in milliseconds. */
function clockAt(start = 1000) {
  let now = start;
  return { now: () => now, advance: (ms: number) => { now += ms; } };
}

describe("boot report (PT-10)", () => {
  it("records steps in order, with non-negative times since the last one", () => {
    h = harness();
    const clock = clockAt();
    const boot = new BootReport(h.status, clock.now);
    clock.advance(120);
    boot.step("Rapier ready");
    clock.advance(40);
    boot.step("Level built");
    clock.advance(2);
    boot.step("First frame");
    expect(boot.steps.map((s) => s.name)).toEqual(["Rapier ready", "Level built", "First frame"]);
    expect(boot.steps.map((s) => s.ms)).toEqual([120, 40, 2]);
    for (const s of boot.steps) expect(s.ms).toBeGreaterThanOrEqual(0);
  });

  it("logs one DART boot line per step, with the step and its whole ms", () => {
    h = harness();
    const clock = clockAt();
    const boot = new BootReport(h.status, clock.now);
    clock.advance(1234.6);
    boot.step("Rapier ready");
    expect(h.logged[0]).toEqual(["DART boot: Rapier ready 1235"]);
  });

  it("writes the waiting step and its count into the status line", () => {
    h = harness();
    const boot = new BootReport(h.status, clockAt().now);
    boot.progress("Loading blasters", 3, 8);
    expect(h.status.textContent).toBe("Loading blasters 3 / 8");
    expect(boot.waitingText).toBe("Loading blasters 3 / 8");
    boot.progress("Building Foamers", 9, 16);
    expect(h.status.textContent).toBe("Building Foamers 9 / 16");
    // A wait with no count reads as its name alone.
    boot.progress("Loading physics");
    expect(h.status.textContent).toBe("Loading physics");
  });

  it("a step clears the waiting text, and the ready line ends the boot", () => {
    h = harness();
    const boot = new BootReport(h.status, clockAt().now);
    boot.progress("Loading physics");
    boot.step("Rapier ready");
    expect(boot.waitingText).toBe("Loading");
    boot.finish("Click to play. Esc to pause.");
    expect(h.status.textContent).toBe("Click to play. Esc to pause.");
  });

  it("a step that lands after the ready line leaves the status line alone", () => {
    h = harness();
    const boot = new BootReport(h.status, clockAt().now);
    boot.finish("Click to play. Esc to pause.");
    // A Foamer mesh still arriving is named and its step logged, but the
    // player's ready line stays where the page put it.
    boot.progress("Building Foamers", 12, 16);
    boot.step("Foamers meshed");
    expect(h.status.textContent).toBe("Click to play. Esc to pause.");
    expect(boot.steps.map((s) => s.name)).toEqual(["Foamers meshed"]);
  });

  it("a page without a status element still records and logs", () => {
    h = harness();
    const boot = new BootReport(null, clockAt().now);
    boot.progress("Loading blasters", 1, 3);
    boot.step("Loadout ready");
    boot.finish("done");
    expect(boot.steps.map((s) => s.name)).toEqual(["Loadout ready"]);
    expect(h.logged[0]).toEqual(["DART boot: Loadout ready 0"]);
  });

  it("the diag readout names the browser, the mesher's mode and every step", () => {
    h = harness();
    const nav = globalThis as { navigator?: unknown };
    const priorNav = nav.navigator;
    Object.defineProperty(nav, "navigator", {
      value: { userAgent: "Firefox test" }, configurable: true,
    });
    const boot = new BootReport(h.status, clockAt().now);
    boot.step("Rapier ready");
    const text = diagText(boot, { slots: [{}, {}], noWorkers: false }, 3);
    expect(text).toContain("Browser: Firefox test");
    expect(text).toContain("Mesher: 2 workers, 3 on the main thread");
    expect(text).toContain("Rapier ready: ");
    // A pool with no workers, or none left, reports the main thread.
    expect(mesherMode({ slots: [], noWorkers: false })).toBe("main thread");
    expect(mesherMode({ slots: [{}], noWorkers: true })).toBe("main thread");
    expect(mesherMode({ slots: [{}], noWorkers: false })).toBe("1 worker");
    Object.defineProperty(nav, "navigator", { value: priorNav, configurable: true });
  });

  it("counts PT-09's main-thread mesh warnings, and passes them on", () => {
    h = harness();
    const count = countMesherFallbacks();
    console.warn("mesher: worker error, meshing the part on the main thread");
    console.warn("mesher: postMessage failed, meshing the part on the main thread");
    console.warn("something else");
    expect(count()).toBe(2);
    // The warnings are still logged for the console.
    expect(h.logged.length).toBe(3);
  });
});

describe("the diag readout follows a late boot (review)", () => {
  it("a Foamer step after the first frame reaches the readout, with its time since the start", () => {
    let t = 0;
    const boot = new BootReport(null, () => t);
    t = 100; boot.step("Loadout ready");
    t = 400; boot.step("First frame");
    boot.finish("Click to play");
    let redraws = 0;
    boot.onChange = () => { redraws++; };
    boot.progress("Building Foamers", 9, 16);
    expect(diagText(boot, null, 0)).toContain("Waiting: Building Foamers 9 / 16");
    t = 2400; boot.step("Foamers meshed");
    expect(redraws).toBe(2);
    const text = diagText(boot, null, 0);
    expect(text).toContain("Foamers meshed: 2000 ms (at 2400 ms)");
    expect(text).not.toContain("Waiting:");
  });
});

describe("no pointer lock before the game runs (PT-10)", () => {
  function setup() {
    const canvas = new FakeCanvas();
    const doc = new Emitter();
    const win = new Emitter();
    const g = globalThis as Record<string, unknown>;
    const prior = { document: g.document, window: g.window, navigator: g.navigator };
    g.document = doc;
    g.window = win;
    Object.defineProperty(g, "navigator", { value: { getGamepads: () => [] }, configurable: true });
    const input = new Input(canvas as unknown as HTMLCanvasElement);
    return {
      canvas,
      doc,
      input,
      restore() {
        g.document = prior.document;
        g.window = prior.window;
        Object.defineProperty(g, "navigator", { value: prior.navigator, configurable: true });
      },
    };
  }

  it("a click before ready does not ask for a lock, and one after ready does", async () => {
    const ctx = setup();
    try {
      await ctx.canvas.click();
      expect(ctx.canvas.calls).toEqual([]);
      ctx.input.setReady();
      await ctx.canvas.click();
      expect(ctx.canvas.calls.map((c) => c.options)).toEqual([{ unadjustedMovement: true }]);
      expect(ctx.canvas.calls[0].inClick).toBe(true);
    } finally {
      ctx.restore();
    }
  });

  it("a page button that asks directly is refused until the game runs", () => {
    const ctx = setup();
    try {
      ctx.input.requestLock();
      expect(ctx.canvas.calls).toEqual([]);
      ctx.input.setReady();
      ctx.input.requestLock();
      expect(ctx.canvas.calls.length).toBe(1);
    } finally {
      ctx.restore();
    }
  });

  it("the PT-09 Firefox path is unchanged once ready", async () => {
    const ctx = setup();
    try {
      ctx.input.setReady();
      ctx.canvas.behaviour = (options) => (options ? Promise.reject(new Error("nope")) : undefined);
      await ctx.canvas.click();
      expect(ctx.canvas.calls.map((c) => c.options)).toEqual([{ unadjustedMovement: true }, undefined]);
      expect(ctx.canvas.calls.every((c) => c.inClick)).toBe(true);
    } finally {
      ctx.restore();
    }
  });
});
