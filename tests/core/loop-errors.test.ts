import { describe, expect, it, vi } from "vitest";
import { loopErrors, startLoop } from "../../src/core/loop";

// Firefox (Paul, 2026-11-12): the range drew, then took no keys and no
// mouse once unpaused. A hook that throws used to skip the loop's next
// requestAnimationFrame, so one error froze the game for good. The loop
// now keeps going and records what threw, for the ?diag readout.

type Raf = (t: number) => void;

describe("a hook that throws does not stop the loop", () => {
  it("keeps stepping after an error and records it", () => {
    let q: Raf[] = [];
    vi.stubGlobal("requestAnimationFrame", (cb: Raf) => (q.push(cb), 1));
    vi.stubGlobal("performance", { now: () => 0 });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    let updates = 0;
    let thrown = false;
    startLoop({
      frame() {},
      update() {
        updates++;
        if (!thrown) { thrown = true; throw new Error("boom in update"); }
      },
      render() {},
    });
    for (let i = 0; i < 6; i++) {
      const cur = q; q = [];
      cur.forEach((cb) => cb(i * (1000 / 60)));
    }
    expect(updates).toBeGreaterThan(2);
    expect(loopErrors().count).toBe(1);
    expect(loopErrors().last).toContain("boom in update");
    expect(errorSpy).toHaveBeenCalledTimes(1);
    errorSpy.mockRestore();
    vi.unstubAllGlobals();
  });
});
