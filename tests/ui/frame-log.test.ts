import { describe, expect, it } from "vitest";
import { FrameLog, GRAPH } from "../../src/ui/frame-graph";
import type { FrameStats } from "../../src/core/loop";

const MS = 1000 / 60; // real 60 Hz interval in ms

/** One frame record; the heap value is passed to push separately. */
function f(raw: number, work: number, steps: number): FrameStats {
  return { raw, dt: raw, steps, work, updateWork: work * 0.5 };
}

describe("FrameLog (ENG-11)", () => {
  it("steady 60 Hz with one 50 ms frame: one hitch, median near 16.67", () => {
    const log = new FrameLog();
    for (let i = 0; i < 500; i++) log.push(f(MS, 5, 1));
    log.push(f(50, 5, 1));
    for (let i = 0; i < 50; i++) log.push(f(MS, 5, 1));
    expect(log.refreshMs()).toBeGreaterThan(16.67 - 0.1);
    expect(log.refreshMs()).toBeLessThan(16.67 + 0.1);
    const s = log.summary();
    expect(s.hitches.total).toBe(1);
    expect(s.hitches.total).toBe(s.hitches.long + s.hitches.pacing);
  });

  it("a 50 ms frame with 40 ms work is long; one with work 2 ms and 2 steps is pacing", () => {
    const log = new FrameLog();
    for (let i = 0; i < 598; i++) log.push(f(MS, 5, 1));
    log.push(f(50, 40, 1)); // raw > 1.5x median and 40 > 0.75 * 16.67: long
    log.push(f(MS, 2, 2)); // steady raw but 2 steps while not paused: pacing
    const s = log.summary();
    expect(s.hitches.total).toBe(2);
    expect(s.hitches.long).toBe(1);
    expect(s.hitches.pacing).toBe(1);
  });

  it("a heap fall of 5 MB is one drop; a hitch two frames later is near it", () => {
    const log = new FrameLog();
    for (let i = 0; i < 30; i++) log.push(f(MS, 5, 1), 100);
    log.push(f(MS, 5, 1), 95); // 5 MB fall: the GC drop
    log.push(f(50, 5, 1), 95); // hitch, within 2 frames of the drop
    const s = log.summary();
    expect(s.heapDrops).toBe(1);
    expect(s.recentHitches.length).toBe(1);
    expect(s.recentHitches[0]!.gcNear).toBe(true);
  });

  it("the ring only counts the last graph.frames frames; push reuses the buffers", () => {
    const log = new FrameLog();
    const before = {
      raw: log.raw.buffer, dt: log.dt.buffer, steps: log.steps.buffer,
      work: log.work.buffer, updateWork: log.updateWork.buffer,
      heap: log.heap.buffer, paused: log.paused.buffer,
    };
    const total = GRAPH.frames + 30;
    for (let i = 0; i < total; i++) log.push(f(MS, 5, 1), 100);
    const s = log.summary();
    expect(s.frames).toBe(GRAPH.frames);
    // The buffers are the very same objects: push allocated nothing.
    const after = {
      raw: log.raw.buffer, dt: log.dt.buffer, steps: log.steps.buffer,
      work: log.work.buffer, updateWork: log.updateWork.buffer,
      heap: log.heap.buffer, paused: log.paused.buffer,
    };
    expect(after).toEqual(before);
  });
});
