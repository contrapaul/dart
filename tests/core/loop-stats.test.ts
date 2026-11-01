import { describe, expect, it, vi } from "vitest";
import { startLoop } from "../../src/core/loop";
import type { FrameStats, LoopHooks } from "../../src/core/loop";

// A display at `hz` reporting whole-millisecond timestamps, nudged up to
// jitterMs as Firefox does.
function hzTimes(hz: number, count: number, jitterMs: number, seed = 1) {
  let s = seed;
  const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647) * 2 - 1;
  return Array.from({ length: count }, (_, i) => Math.round((i * 1000) / hz + 500 + rand() * jitterMs));
}

// Fake rAF: one callback queued at a time. flush runs the queued rAF
// callback with t, then whatever it queued, so the frame's own callbacks
// see it before the next timestamp.
type Raf = (t: number) => void;
function fakeRaf(): { flush: (t: number) => void; done: () => void } {
  let q: Raf[] = [];
  vi.stubGlobal("requestAnimationFrame", (cb: Raf) => (q.push(cb), 1));
  vi.stubGlobal("performance", { now: () => 0 });
  return {
    flush: (t: number) => {
      const cur = q;
      q = [];
      cur.forEach((cb) => cb(t));
    },
    done: () => vi.unstubAllGlobals(),
  };
}

/** Run a loop over the timestamps. records holds a copy of the stats at
 *  each call (the hook object is shared and mutates), refs the raw
 *  references, so identity is checkable too. */
function drive(raf: { flush: (t: number) => void }, times: number[], hooks: LoopHooks) {
  const records: { raw: number; dt: number; steps: number }[] = [];
  const refs: FrameStats[] = [];
  startLoop({
    ...hooks,
    stats(s) {
      hooks.stats?.(s);
      records.push({ raw: s.raw, dt: s.dt, steps: s.steps });
      refs.push(s);
    },
  });
  for (const t of times) raf.flush(t);
  return { records, refs };
}

describe("loop stats hook (ENG-11)", () => {
  it("stats once per frame; raw is the unsnapped ms gap; steps count the updates", () => {
    const times = hzTimes(60, 60, 0.4);
    const raf = fakeRaf();
    let updates = 0;
    const { records } = drive(raf, times, {
      frame() {},
      update() { updates++; },
      render() {},
    });
    raf.done();
    expect(records.length).toBe(times.length);
    expect(records[0]!.raw).toBe(0); // first frame cannot be measured
    expect(records[0]!.dt).toBe(0);
    for (let i = 1; i < times.length; i++)
      expect(records[i]!.raw).toBeCloseTo(times[i]! - times[i - 1]!, 5);
    expect(records.reduce((a, r) => a + r.steps, 0)).toBe(updates);
  });

  it("reuses the same FrameStats object every frame (no allocation)", () => {
    const times = hzTimes(60, 20, 0.4);
    const raf = fakeRaf();
    const { refs } = drive(raf, times, { frame() {}, update() {}, render() {} });
    raf.done();
    expect(refs.length).toBe(times.length);
    for (const s of refs) expect(s).toBe(refs[0]);
  });

  it("setSnap(false) returns the raw interval; snap on keeps exactly 1/60 s", () => {
    const times = hzTimes(60, 240, 0);
    const raf = fakeRaf();
    const offRecords: { raw: number; dt: number }[] = [];
    const api = startLoop({
      frame() {}, update() {}, render() {},
      stats(s) { offRecords.push({ raw: s.raw, dt: s.dt }); },
    });
    api.setSnap(false);
    for (const t of times) raf.flush(t);
    raf.done();
    expect(offRecords.length).toBe(times.length);
    for (let i = 1; i < times.length; i++) {
      const gap = times[i]! - times[i - 1]!;
      expect(offRecords[i]!.raw).toBeCloseTo(gap, 5);
      expect(offRecords[i]!.dt).toBeCloseTo(gap, 5);
    }
    const raf2 = fakeRaf();
    const { records: onRecords } = drive(raf2, times, { frame() {}, update() {}, render() {} });
    raf2.done();
    const warm = onRecords.slice(30); // past the learning phase
    expect(warm.length).toBeGreaterThan(0);
    for (const r of warm) expect(r.dt).toBeCloseTo(1000 / 60, 6);
  });
});
