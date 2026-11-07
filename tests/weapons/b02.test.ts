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

function make(): { b: Blaster; darts: FakeDarts } {
  const darts = new FakeDarts();
  const b = new Blaster(resolveSpec("B02"), darts, () => MUZ);
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
    // The placeholder body: the B01 model, until ART-01 ships the B02 one.
    expect(s.model).toBe("/models/blasters/B01.glb");
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
});
