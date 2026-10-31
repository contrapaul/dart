import { describe, expect, it } from "vitest";
import { createFrameClock, STEP } from "../../src/core/loop";

/** Timestamps of a display at `hz`, rounded to whole milliseconds and
 *  nudged by up to `jitterMs`, as Firefox reports them. */
function frames(hz: number, count: number, jitterMs: number, seed = 1) {
  let s = seed;
  const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647) * 2 - 1;
  return Array.from({ length: count }, (_, i) => Math.round((i * 1000) / hz + 500 + rand() * jitterMs));
}

/** Steps run in each frame, through the same accumulator as startLoop. */
function stepsPerFrame(times: number[]) {
  const clock = createFrameClock();
  let acc = 0;
  return times.map((t) => {
    acc += clock.tick(t);
    let n = 0;
    while (acc >= STEP) {
      acc -= STEP;
      n++;
    }
    return n;
  });
}

describe("frame clock", () => {
  it("a 60 Hz display with timestamps rounded to 1 ms runs exactly one step every frame after warm-up", () => {
    const steps = stepsPerFrame(frames(60, 600, 0.6)).slice(30);
    expect(steps.every((n) => n === 1)).toBe(true);
  });

  it("a 120 Hz display alternates one step and none, never two", () => {
    const steps = stepsPerFrame(frames(120, 1200, 0.6)).slice(60);
    expect(Math.max(...steps)).toBe(1);
    const total = steps.reduce((a, b) => a + b, 0);
    expect(Math.abs(total - steps.length / 2)).toBeLessThanOrEqual(1);
  });

  it("keeps real time over a long run at 144 Hz (no snapping drift)", () => {
    const times = frames(144, 1440, 0.6);
    const clock = createFrameClock();
    let sim = 0;
    for (const t of times) sim += clock.tick(t);
    const real = (times[times.length - 1] - times[0]) / 1000;
    expect(Math.abs(sim - real)).toBeLessThan(0.05);
  });

  it("a dropped frame counts as two intervals", () => {
    const clock = createFrameClock();
    for (let i = 0; i < 60; i++) clock.tick(i * (1000 / 60));
    expect(clock.tick(61 * (1000 / 60))).toBeCloseTo(2 / 60, 6);
  });
});
