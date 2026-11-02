// AUD-01 test 3: the VoicePool steals and frees as the card specifies.
import { describe, expect, it } from "vitest";
import { VoicePool, pickTake, makeTakePicker } from "../../src/audio/voices";
import { makeRng } from "../../src/audio/synth";

describe("VoicePool", () => {
  it("steals the oldest of the same id once maxForId is reached", () => {
    const pool = new VoicePool(4);
    const a = pool.start("a", 2, 0.0);
    const b = pool.start("a", 2, 0.1);
    const c = pool.start("a", 2, 0.2);
    expect(a).toBeTruthy();
    expect(b).toBeTruthy();
    expect(c).toBeTruthy();
    // The third a has maxForId 2 already playing, it steals the oldest a.
    expect(c!.stop).toBe(a!.voice);
    expect(pool.slots[c!.voice].id).toBe("a");
    expect(pool.playingCount()).toBe(2);
    // Giving up one of the others frees it.
    pool.end(b!.voice);
    expect(pool.slots[b!.voice].busy).toBe(false);
  });

  it("a new id steals the oldest one-shot when the pool is full", () => {
    const pool = new VoicePool(4);
    pool.start("x", 4, 0.0);
    pool.start("y", 4, 0.1);
    pool.start("z", 4, 0.2);
    pool.start("p", 4, 0.3);
    expect(pool.playingCount()).toBe(4);
    const d = pool.start("w", 4, 0.4);   // pool is full, no w playing
    expect(d).not.toBeNull();
    // The oldest one-shot overall was x (started at 0.0).
    expect(d!.stop).toBe(0);
    expect(pool.slots[0].id).toBe("w");
    // x is gone, the other three one-shots still play.
    for (let i = 0; i < 4; i++) {
      if (pool.slots[i].id === "x") throw new Error("x should have been stolen");
    }
    expect(pool.playingCount()).toBe(4);
  });

  it("a one-shot of a looping sound's id never takes over the loop", () => {
    const pool = new VoicePool(4);
    const loop = pool.start("amb", 1, 0.0, true)!;
    const shot = pool.start("amb", 1, 0.1);
    expect(shot).not.toBeNull();
    expect(shot!.voice).not.toBe(loop.voice);
    expect(shot!.stop).toBeNull();
    expect(pool.slots[loop.voice].isLoop).toBe(true);
  });

  it("loops are never stolen", () => {
    const pool = new VoicePool(4);
    const loop = pool.start("amb", 1, 0.0, true);
    expect(loop).not.toBeNull();
    const a = pool.start("a", 4, 0.1);
    const b = pool.start("b", 4, 0.2);
    const c = pool.start("c", 4, 0.3);
    const d = pool.start("d", 4, 0.4);   // steal the oldest one-shot
    for (const r of [a, b, c, d]) {
      expect(r).not.toBeNull();
      expect(r!.stop).not.toBe(loop!.voice);
    }
    // The loop is still playing under its id.
    expect(pool.slots[loop!.voice].id).toBe("amb");
    // Now fill with loops only, a start must be rejected.
    const pool2 = new VoicePool(2);
    pool2.start("l1", 1, 0.0, true);
    pool2.start("l2", 1, 0.1, true);
    expect(pool2.start("x", 1, 0.2, false)).toBeNull();
  });

  it("end frees a voice and the slot can be reused", () => {
    const pool = new VoicePool(2);
    const a = pool.start("a", 1, 0.0);
    const b = pool.start("b", 1, 0.1);
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    pool.end(a!.voice);
    const c = pool.start("c", 1, 0.2);
    expect(c!.voice).toBe(a!.voice);
    expect(c!.stop).toBeNull();
  });
});

describe("take picking", () => {
  it("with three takes, 100 picks never repeat the previous take", () => {
    const rng = makeRng(7);
    let last = -1;
    for (let i = 0; i < 100; i++) {
      const p = pickTake(3, last, rng);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThan(3);
      expect(p).not.toBe(last);
      last = p;
    }
  });

  it("with one take it is always take 0", () => {
    const rng = makeRng(1);
    for (let i = 0; i < 20; i++) expect(pickTake(1, -1, rng)).toBe(0);
    expect(pickTake(1, 0, rng)).toBe(0);
  });

  it("makeTakePicker keeps the rule across calls", () => {
    const p = makeTakePicker(3, 5);
    let last = -1;
    for (let i = 0; i < 50; i++) {
      const n = p.pick();
      expect(n).not.toBe(last);
      last = n;
    }
  });
});
