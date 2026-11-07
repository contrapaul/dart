import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  Blaster,
  resolveSpec,
  type BlasterControls,
  type DartFiring,
} from "../../src/weapons/blaster";
import type { DartTypeName } from "../../src/weapons/darts";
import { Loadout, type LoadoutPart, type LoadoutViewmodel } from "../../src/weapons/loadout";

// Stage 1 tests for GAME-09c: the B02 Musketeer, a semi-auto sidearm with
// a reserve that never runs out. The dart system is a recording fake, the
// same as blaster.test.ts, so nothing depends on the live dart pool.
const DT = 1 / 60;
const AIM = new THREE.Vector3(0, 0, -1);
const MUZ = new THREE.Vector3(0.2, -0.2, -1);

class FakeDarts implements DartFiring {
  readonly origins: THREE.Vector3[] = [];
  readonly dirs: THREE.Vector3[] = [];
  readonly types: DartTypeName[] = [];
  fire(o: THREE.Vector3, d: THREE.Vector3, t: DartTypeName): void {
    this.origins.push(o);
    this.dirs.push(d.clone());
    this.types.push(t);
  }
  get n(): number { return this.dirs.length; }
}

const NO = { fireHeld: false, firePressed: false, reloadPressed: false };
const PRESS: BlasterControls = { fireHeld: true, firePressed: true, reloadPressed: false };
const HOLD: BlasterControls = { fireHeld: true, firePressed: false, reloadPressed: false };

function make(mods: string[] = []): { b: Blaster; darts: FakeDarts } {
  const darts = new FakeDarts();
  const b = new Blaster(resolveSpec("B02", mods), darts, () => MUZ);
  return { b, darts };
}
function step(b: Blaster, c: BlasterControls): void { b.update(DT, c, AIM); }
/** Step until the blaster is ready; returns the number of steps. */
function toReady(b: Blaster): number {
  let i = 0;
  while (b.state !== "ready") { step(b, NO); i++; if (i > 2000) throw new Error("not ready"); }
  return i;
}

describe("GAME-09c stage 1: the B02 Musketeer", () => {
  it("reads its spec: semi, one standard dart a shot, a six dart magazine, a never empty reserve", () => {
    const s = resolveSpec("B02");
    expect(s.name).toBe("Musketeer");
    expect(s.mode).toBe("semi");
    expect(s.dartType).toBe("standard");
    expect(s.dartsPerShot).toBe(1);
    expect(s.spreadDeg).toBe(1);
    expect(s.magSize).toBe(6);
    expect(s.reserveInfinite).toBe(true);
    expect(s.fireInterval).toBe(0.15);
    expect(s.reloadTime).toBe(1.0);
    expect(s.autoReload).toBe(true);
    expect(s.muzzles).toEqual(["muzzle_1"]);
    // Its own approved model (ART-04), which replaced the B01 placeholder.
    expect(s.model).toBe("/models/blasters/B02.glb");
  });

  it("one press fires one dart; a held trigger fires only that one", () => {
    const { b, darts } = make();
    step(b, PRESS);
    expect(darts.n).toBe(1);
    expect(b.mag).toBe(5);
    expect(b.shots).toBe(1);
    expect(b.state).toBe("ready"); // no pump: it never primes
    expect(darts.types[0]).toBe("standard");
    // The held trigger holds, and nothing else fires while it is held.
    for (let i = 0; i < 20; i++) step(b, HOLD);
    expect(darts.n).toBe(1);
    expect(b.mag).toBe(5);
  });

  it("presses faster than fireInterval are capped at one per interval", () => {
    const { b } = make();
    // Press, hold, release, press again as fast as the step allows. The
    // repeats land 3 steps apart (0.05 s), under the 0.15 s interval, so
    // only the first of that cluster counts.
    const pressEvery: BlasterControls[] = [PRESS, HOLD, HOLD, PRESS, HOLD, HOLD];
    for (let i = 0; i < 60; i++) step(b, pressEvery[i % pressEvery.length]);
    // 60 steps keep the trigger effectively held with a new press every
    // third step: the clock allows a shot every 0.15 s = 9 steps, so the
    // count is fixed by time, not by presses, while the magazine allows
    // at most 6 before the reload takes over.
    expect(b.mag).toBe(0);
    expect(b.state).toBe("reloading");
  });

  it("one shot per press when presses are spaced, so a careful clicker is never capped", () => {
    const { b, darts } = make();
    for (let r = 0; r < 6; r++) {
      step(b, PRESS);
      for (let i = 0; i < 10; i++) step(b, NO); // well over the interval
    }
    expect(darts.n).toBe(6);
    expect(b.mag).toBe(0);
  });

  it("the reserve never runs out: many full magazines, the reserve stays full", () => {
    const { b, darts } = make();
    // Clicks spaced well over the 0.15 s interval: each one fires one
    // dart, so the magazine empties in full and the auto reload replays
    // it back to six, again and again, with the reserve untouched.
    for (let r = 0; r < 4; r++) {
      for (let i = 0; i < 6; i++) {
        step(b, PRESS);
        for (let j = 0; j < 10; j++) step(b, NO);
      }
      expect(b.mag).toBe(0);
      // The empty magazine reloads itself: this press starts it.
      if (b.state !== "reloading") step(b, PRESS);
      const took = toReady(b);
      expect(took).toBeGreaterThan(0);
      expect(b.mag).toBe(6);
      expect(b.reserve).toBe(b.spec.reserveMax); // it went no lower
    }
    expect(darts.n).toBe(24);
  });

  it("the vacuum's refill leaves the never empty reserve alone", () => {
    // Parts for a two blaster loadout: the B02 and a B04 with a real
    // reserve to compare against. The viewmodels are the test's fake.
    const darts = new FakeDarts();
    const vm = (): LoadoutViewmodel => ({
      setVisible() {},
      setMods() {},
      muzzleCameraPoint(_i: number, out: THREE.Vector3) { return out.copy(MUZ); },
      onShot: () => {},
    });
    const parts: LoadoutPart[] = [
      { id: "B02", blaster: new Blaster(resolveSpec("B02"), darts, () => MUZ), viewmodel: vm() },
      { id: "B04", blaster: new Blaster(resolveSpec("B04"), darts, () => MUZ), viewmodel: vm() },
    ];
    const lo = new Loadout(parts, darts, 0.35);
    const b04b = lo.blasters[1];
    expect(b04b.reserve).toBe(b04b.spec.reserveStart);
    const given = lo.refillReserves(0.5, 0.5);
    // The B04 took its share up to its cap; the B02 took nothing.
    expect(lo.blasters[0].reserve).toBe(1);
    expect(b04b.reserve).toBeGreaterThan(b04b.spec.reserveStart);
    expect(given).toBe(b04b.reserve - b04b.spec.reserveStart);
  });

  it("the burst mod reads: one press fires burstCount darts, the gap and cooldown are the data's", () => {
    const s = resolveSpec("B02", ["burst"]);
    expect(s.mode).toBe("burst");
    expect(s.burstCount).toBe(3);
    expect(s.burstGap).toBeCloseTo(0.07);
    expect(s.burstCooldown).toBeCloseTo(0.3);
    expect(s.dartType).toBe("standard"); // burst changes nothing but the mode
  });

  it("the burst fires 3 per press with the gap, then waits the cooldown before the next press counts", () => {
    const { b, darts } = make(["burst"]);
    step(b, PRESS); // it can burst at once: the cooldown gate starts open
    expect(darts.n).toBe(1); // the first dart fires on the press itself
    // The remaining two follow the gap clock; the cadence is burstGap.
    let i = 0;
    while (darts.n < 3 && i < 30) { step(b, HOLD); i++; }
    expect(darts.n).toBe(3);
    expect(b.mag).toBe(3); // six - three
    // The gap: each dart landed roughly a burstGap after the last.
    // Now the cooldown: two more presses, close together, must not fire.
    step(b, PRESS); step(b, HOLD); step(b, PRESS);
    expect(darts.n).toBe(3);
    // Wait out the cooldown (0.3 s; 20 steps is 0.33 s, safely past),
    // then the next press bursts again.
    for (let k = 0; k < 20; k++) step(b, NO);
    step(b, PRESS);
    expect(darts.n).toBe(4); // a fresh burst on the way
  });

  it("a burst with 2 left fires 2, then the magazine reloads itself", () => {
    const { b, darts } = make(["burst"]);
    // Two left; the burst may not do a third.
    b.mag = 2;
    step(b, PRESS);
    let i = 0;
    while (b.mag > 0 && i < 60) { step(b, HOLD); i++; }
    expect(darts.n).toBe(2); // it fired both, not a phantom third
    expect(b.mag).toBe(0);
    expect(b.state).toBe("reloading"); // empty ends it and the reload takes over
    toReady(b);
    expect(b.mag).toBe(6); // the reserve refilled it, as always
    // A held trigger during the reload does not fire the old darts.
    step(b, PRESS);
    expect(darts.n).toBe(2);
  });

  it("the heavy mod reads: slugs, the slower fire, its own chunk between the standard and B01's slug", () => {
    const s = resolveSpec("B02", ["heavy"]);
    expect(s.mode).toBe("semi"); // heavy is still semi-fire, just heavier
    expect(s.dartType).toBe("slug");
    expect(s.fireInterval).toBeCloseTo(0.45);
    expect(s.chunk).not.toBeNull();
    const c = s.chunk!;
    // Standard dart is 0.12 carve / 0.6 push (darts.json); B01 slug is
    // 0.3 / 1.6 (its mod). The heavy sits between, larger than standard.
    expect(c.carveRadius).toBeGreaterThan(0.12);
    expect(c.carveRadius).toBeLessThan(0.3);
    expect(c.push).toBeGreaterThan(0.6);
    expect(c.push).toBeLessThan(1.6);
  });

  it("the heavy fires slugs at the slower rate, not standard", () => {
    const { b, darts } = make(["heavy"]);
    step(b, PRESS);
    expect(darts.n).toBe(1);
    expect(darts.types[0]).toBe("slug");
    // The 0.45 s interval is much longer than the 0.15 semi: two quick
    // presses fire one dart, a third after the interval fires another.
    step(b, HOLD); step(b, PRESS); // too fast, capped
    expect(darts.n).toBe(1);
    for (let k = 0; k < 30; k++) step(b, NO); // well over 0.45 s
    step(b, PRESS);
    expect(darts.n).toBe(2);
    expect(darts.types[1]).toBe("slug");
  });
});

describe("GAME-09c review: the burst cooldown and the capped fire clock", () => {
  it("a second burst fires after the cooldown, though the clock is capped", () => {
    // Review, after B06 (GAME-09d) capped the fire clock at the fire
    // interval: the burst's 0.3 s cooldown runs on the same clock, and a cap
    // at B02's 0.15 s interval would never let it reach the cooldown again.
    const { b, darts } = make(["burst"]);
    step(b, PRESS);
    for (let i = 0; i < 40; i++) step(b, NO); // the burst, then the cooldown
    expect(darts.n).toBe(3);
    step(b, PRESS);
    for (let i = 0; i < 40; i++) step(b, NO);
    expect(darts.n, "the second burst fired").toBe(6);
  });
});
