import { afterEach, describe, expect, it } from "vitest";
import { Input } from "../../src/core/input";

// Pointer Lock: Firefox has no raw mouse input and may answer a request only
// with a pointerlockerror event (or return undefined), so the plain form must
// be asked for inside the click and remembered for the next click.

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

interface LockCall {
  options: unknown;
  /** True while the click handler (or the microtasks it queued) is running. */
  inClick: boolean;
}

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
    // A promise rejection is handled in a microtask, still inside the click's
    // task and well inside the user activation window, so hold the flag for
    // a microtask turn.
    await Promise.resolve();
    this.clicking = false;
  }
}

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

let ctx: ReturnType<typeof setup> | null = null;
afterEach(() => {
  ctx?.restore();
  ctx = null;
});

describe("pointer lock (PT-09)", () => {
  it("raw input in a browser that takes it: one call, with the option", async () => {
    ctx = setup();
    await ctx.canvas.click();
    expect(ctx.canvas.calls).toEqual([{ options: { unadjustedMovement: true }, inClick: true }]);
  });

  it("a browser that returns undefined and fires pointerlockerror gets the plain lock on the next click, inside it", async () => {
    ctx = setup();
    await ctx.canvas.click();
    ctx.doc.dispatch("pointerlockerror");
    await ctx.canvas.click();
    expect(ctx.canvas.calls.map((c) => c.options)).toEqual([{ unadjustedMovement: true }, undefined]);
    expect(ctx.canvas.calls[1].inClick).toBe(true);
    // And it stays plain: no more raw attempts to wait on.
    await ctx.canvas.click();
    expect(ctx.canvas.calls.map((c) => c.options)).toEqual([{ unadjustedMovement: true }, undefined, undefined]);
  });

  it("a rejected raw request falls back to the plain lock inside the same click", async () => {
    ctx = setup();
    ctx.canvas.behaviour = (options) =>
      options ? Promise.reject(new Error("NotSupportedError")) : undefined;
    await ctx.canvas.click();
    expect(ctx.canvas.calls.map((c) => c.options)).toEqual([{ unadjustedMovement: true }, undefined]);
    expect(ctx.canvas.calls.every((c) => c.inClick)).toBe(true);
  });

  it("a raw request refused synchronously still asks for the plain lock in the click", async () => {
    ctx = setup();
    ctx.canvas.behaviour = (options) => {
      if (options) throw new TypeError("unadjustedMovement not supported");
      return undefined;
    };
    await ctx.canvas.click();
    expect(ctx.canvas.calls.map((c) => c.options)).toEqual([{ unadjustedMovement: true }, undefined]);
    expect(ctx.canvas.calls[1].inClick).toBe(true);
  });

  it("a second pointerlockerror after a successful raw lock is ignored (the fast re-lock after Esc keeps raw input)", async () => {
    ctx = setup();
    ctx.canvas.behaviour = (options) => options && Promise.reject(new Error("nope"));
    await ctx.canvas.click(); // raw refused, plain asked
    ctx.canvas.calls = [];
    ctx.doc.dispatch("pointerlockerror"); // the Esc refusal, not a raw refusal
    await ctx.canvas.click();
    expect(ctx.canvas.calls.map((c) => c.options)).toEqual([undefined]);
  });
});
