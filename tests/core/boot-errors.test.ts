// The pages' overlay must never sit on "Loading" after a failed boot. The
// module binds to window, so this test gives it a window of its own and
// fires the two events a dying module chain produces.
//
// Node types are not installed, so ts-checking is off here only, as in
// tests/weapons/models.test.ts, the other tests that reach outside src.
// @ts-nocheck
import { afterAll, describe, expect, it } from "vitest";

const listeners: Record<string, (e: unknown) => void> = {};
(globalThis as any).window = {
  addEventListener: (type: string, fn: (e: unknown) => void) => { listeners[type] = fn; },
};
const status = { textContent: "" };
(globalThis as any).document = { querySelector: () => status };
const logged: unknown[][] = [];
const realError = console.error;
console.error = (...args: unknown[]) => { logged.push(args); };
afterAll(() => { console.error = realError; });

await import("../../src/core/boot-errors");

describe("boot errors reach the overlay", () => {
  it("binds both events a dying module chain produces", () => {
    expect(typeof listeners.error).toBe("function");
    expect(typeof listeners.unhandledrejection).toBe("function");
  });

  it("an uncaught error says why, and is logged", () => {
    status.textContent = "Loading";
    listeners.error({ error: new Error("fetch for \"/models/blasters/B08.glb\" responded with 404") });
    expect(status.textContent).toBe(
      "Could not start: fetch for \"/models/blasters/B08.glb\" responded with 404. Reload the page to try again.");
    expect(String(logged[0][0])).toBe("DART: uncaught error");
  });

  it("a rejected top level await says why too", () => {
    status.textContent = "Loading";
    listeners.unhandledrejection({ reason: new Error("no WebGL") });
    expect(status.textContent).toBe("Could not start: no WebGL. Reload the page to try again.");
  });

  it("a value that is not an Error still reads", () => {
    listeners.unhandledrejection({ reason: "string reason" });
    expect(status.textContent).toBe("Could not start: string reason. Reload the page to try again.");
  });
});
