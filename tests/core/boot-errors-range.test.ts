// PT-10: the range page has a status element now (range.html), so a failed
// boot there shows why instead of only in the console. The module binds to
// window and document, so this test gives it a window and a document shaped
// like the range page's: one #status inside the panel, nothing else.
//
// Node types are not installed, so ts-checking is off here only, as in
// tests/core/boot-errors.test.ts.
// @ts-nocheck
import { afterAll, describe, expect, it } from "vitest";

const listeners: Record<string, (e: unknown) => void> = {};
(globalThis as any).window = {
  addEventListener: (type: string, fn: (e: unknown) => void) => { listeners[type] = fn; },
};
// The range page's element: #status, in the pause panel.
const status = { textContent: "Loading" };
(globalThis as any).document = {
  querySelector: (sel: string) => (sel === "#status" ? status : null),
};
const realError = console.error;
console.error = () => {};
afterAll(() => { console.error = realError; });

await import("../../src/core/boot-errors");

describe("a boot error shows on the range's status line", () => {
  it("names the failure in #status, where the player can see it", () => {
    status.textContent = "Loading blasters 3 / 8";
    listeners.unhandledrejection({
      reason: new Error('fetch for "/models/blasters/B05.glb" responded with 404'),
    });
    expect(status.textContent).toBe(
      'Could not start: fetch for "/models/blasters/B05.glb" responded with 404. Reload the page to try again.');
  });
});
