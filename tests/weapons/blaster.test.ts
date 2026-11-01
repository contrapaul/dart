import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  Blaster,
  resolveSpec,
  type BlasterControls,
  type DartFiring,
} from "../../src/weapons/blaster";
import type { DartTypeName } from "../../src/weapons/darts";

// Tests 1 to 12 for GAME-09: the pump, auto and break fire modes and the
// mods, run against a fake dart system that records each fire and six fixed
// muzzle points, so nothing depends on the live dart pool.
const DT = 1 / 60;
const AIM = new THREE.Vector3(0, 0, -1);
const MUZ = [
  new THREE.Vector3(0, 0, -1),
  new THREE.Vector3(0.1, 0, -1),
  new THREE.Vector3(-0.1, 0, -1),
  new THREE.Vector3(0, 0.1, 0),
  new THREE.Vector3(0.2, 0, -1),
  new THREE.Vector3(-0.2, 0, -1),
];

function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

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

function make(blasterId: string, mods: string[] = [], seed = 1): { b: Blaster; darts: FakeDarts } {
  const darts = new FakeDarts();
  const b = new Blaster(resolveSpec(blasterId, mods), darts, (i) => MUZ[i], lcg(seed));
  return { b, darts };
}
function step(b: Blaster, c: BlasterControls): void { b.update(DT, c, AIM); }
const HOLD: BlasterControls = { fireHeld: true, firePressed: true, reloadPressed: false };
const NO: BlasterControls = { fireHeld: false, firePressed: false, reloadPressed: false };
const PRESS: BlasterControls = { fireHeld: true, firePressed: true, reloadPressed: false };
/** Step until the blaster reaches `want`; returns the number of steps. */
function until(b: Blaster, want: "ready" | "reloading" | "priming"): number {
  let i = 0;
  while (b.state !== want) { step(b, NO); i++; if (i > 20000) throw new Error(`never reached ${want}`); }
  return i;
}
/** Step `steps` times with the given controls. */
function run(b: Blaster, steps: number, c: BlasterControls): void {
  for (let i = 0; i < steps; i++) step(b, c);
}
function devDeg(d: THREE.Vector3): number {
  return THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(d.dot(AIM), -1, 1)));
}
describe("GAME-09 fire modes, mods, reload rules", () => {
  const S = () => resolveSpec("B01");

  it("1. pump: one press fires dartsPerShot darts, the mag drops by 1, then primes; a press during priming is ignored; after primeTime the next press fires again", () => {
    const { b, darts } = make("B01");
    const s = S();
    expect(b.state).toBe("ready");
    step(b, PRESS);
    expect(darts.n).toBe(s.dartsPerShot);
    expect(b.mag).toBe(s.magSize - 1);
    expect(b.state).toBe("priming");
    step(b, PRESS);
    expect(darts.n).toBe(s.dartsPerShot);
    expect(b.mag).toBe(s.magSize - 1);
    const n = until(b, "ready");
    expect(n * DT).toBeGreaterThanOrEqual(s.primeTime - DT);
    expect(n * DT).toBeLessThan(s.primeTime + DT * 2);
    step(b, PRESS);
    expect(darts.n).toBe(s.dartsPerShot * 2);
    expect(b.mag).toBe(s.magSize - 2);
    expect(b.state).toBe("priming");
  });

  it("2. pump: over a full worth of ammo (two drains plus auto-reloads) every dart direction is within spreadDeg of the aim", () => {
    const { b, darts } = make("B01");
    const s = S();
    const total = (s.magSize + s.reserveStart) * s.dartsPerShot;
    run(b, 20000, HOLD);
    expect(darts.n).toBe(total);
    for (const d of darts.dirs)
      expect(devDeg(d)).toBeLessThanOrEqual(s.spreadDeg + 1e-6);
  });

  it("3. pump: an emptied mag with autoReload reloads after the last priming; with a reserve of 3 the refill is only 3", () => {
    {
      const { b } = make("B01");
      const s = S();
      for (let shot = 0; shot < s.magSize; shot++) { if (shot > 0) until(b, "ready"); step(b, PRESS); }
      expect(b.mag).toBe(0);
      expect(b.state).toBe("priming");
      until(b, "reloading");
      const i = until(b, "ready");
      expect(i * DT).toBeGreaterThanOrEqual(s.reloadTime - DT);
      expect(b.mag).toBe(s.magSize);
      expect(b.reserve).toBe(s.reserveStart - s.magSize);
    }
    {
      const { b } = make("B01");
      b.mag = 0;
      b.reserve = 3;
      step(b, PRESS);
      expect(b.state).toBe("reloading");
      until(b, "ready");
      expect(b.mag).toBe(3);
      expect(b.reserve).toBe(0);
    }
  });

  it("4. pump: reloadPressed does nothing with a full mag, an empty reserve, or while priming", () => {
    {
      const { b } = make("B01");
      const s = S();
      step(b, { fireHeld: false, firePressed: false, reloadPressed: true });
      expect(b.state).toBe("ready");
      expect(b.mag).toBe(s.magSize);
    }
    {
      const { b } = make("B01");
      b.reserve = 0; b.mag = 0;
      step(b, { fireHeld: false, firePressed: false, reloadPressed: true });
      expect(b.state).toBe("ready");
    }
    {
      const { b } = make("B01");
      const s = S();
      step(b, PRESS);
      expect(b.state).toBe("priming");
      step(b, { fireHeld: false, firePressed: false, reloadPressed: true });
      expect(b.state).toBe("priming");
      expect(b.mag).toBe(s.magSize - 1);
    }
  });

  it("5. pump: the darts come from muzzles 1 to 3 in turn", () => {
    const { b, darts } = make("B01");
    const s = S();
    expect(s.muzzles).toEqual(["muzzle_1", "muzzle_2", "muzzle_3"]);
    for (let shot = 0; shot < 5; shot++) {
      if (shot > 0) until(b, "ready");
      step(b, PRESS);
      for (let k = 0; k < s.dartsPerShot; k++) {
        const want = (shot * s.dartsPerShot + k) % s.muzzles.length;
        expect(darts.origins[shot * s.dartsPerShot + k]).toBe(MUZ[want]);
      }
    }
  });

  it("6. auto: held, no dart before spinUp; then one every fireInterval (within 1 of the count over 2 s)", () => {
    const { b, darts } = make("B04");
    const s = b.spec;
    // The wheels come up after spinUp steps; the first dart may be fired on
    // that same step, never earlier. So it is at the very moment of spinUp.
    let i = 0;
    while (b.wheelSpeed < 1) { step(b, HOLD); i++; }
    expect(i * DT).toBeGreaterThanOrEqual(s.spinUp - DT * 2);
    expect(i * DT).toBeLessThan(s.spinUp + DT * 3);
    expect(darts.n).toBe(1); // the one fired on the spinUp step itself
    // Take the 2 s count from there: about 2 / fireInterval darts.
    run(b, Math.round(2 / DT), HOLD);
    const est = Math.floor(2 / s.fireInterval);
    expect(darts.n - 1).toBeGreaterThanOrEqual(est - 1);
    expect(darts.n - 1).toBeLessThanOrEqual(est + 1);
  });

  it("7. auto: after 10 shots the spread is base + 10*perShot (under the cap) and the climb 10*perShot deg; back to 0 within 0.4 s of release; every dart within its own spread up to the progression", () => {
    const { b, darts } = make("B04");
    const s = b.spec;
    const r = s.recoil;
    // Let the flywheels come up and then take ten shots.
    let i = 0;
    while (b.wheelSpeed < 1) { step(b, HOLD); i++; }
    while (darts.n < 10) { step(b, { ...HOLD, firePressed: false }); i++; if (i > 4000) throw new Error("stuck"); }
    expect(darts.n).toBe(10);
    expect(b.spreadNow).toBeCloseTo(10 * r.spreadPerShot, 9);
    expect(b.climbDegNow).toBeCloseTo(10 * r.climbDegPerShot, 9);
    // Every dart fired in one of the first ten shots is within its own
    // spread (base + accumulated per shot at fire time) offset by the aim
    // climb at that moment. The gun climbs from 0 to k * perShotDeg as
    // shot k is fired, so we bound each dart by the spread plus the max
    // possible climb (the last shot's climb), which is what the test card
    // says: "within the current spread plus climb of the aim".
    const maxClimb = 10 * r.climbDegPerShot;
    for (let k = 0; k < 10; k++) {
      const spreadAt = s.spreadDeg + (k + 1) * r.spreadPerShot;
      const bound = spreadAt + maxClimb;
      expect(devDeg(darts.dirs[k])).toBeLessThanOrEqual(bound + 1e-6);
    }
    // Release and measure how long recovery takes.
    i = 0;
    while (b.spreadNow > 0 || b.climbDegNow > 0) { step(b, NO); i++; if (i > 2000) throw new Error("never recovered"); }
    expect(i * DT).toBeLessThanOrEqual(0.4 + DT * 2);
    expect(b.spreadNow).toBe(0);
    expect(b.climbDegNow).toBe(0);
  });

  it("8. break: press, press: 8 darts from muzzle 1, then 8 from muzzle 2; the third press with both fired starts a reload that loads 2 shells and takes 2 from the reserve", () => {
    const { b, darts } = make("B03");
    const s = b.spec;
    expect(b.loaded).toEqual([true, true]);
    step(b, PRESS);
    expect(darts.n).toBe(s.dartsPerShot);
    for (const o of darts.origins) expect(o).toBe(MUZ[0]);
    expect(b.loaded).toEqual([false, true]);
    for (let i = 0; i < Math.ceil(s.fireInterval / DT) + 2; i++) step(b, NO);
    step(b, PRESS);
    expect(darts.n).toBe(s.dartsPerShot * 2);
    for (const o of darts.origins.slice(s.dartsPerShot)) expect(o).toBe(MUZ[1]);
    expect(b.loaded).toEqual([false, false]);
    // Third press: wait past the interval, then press.
    for (let i = 0; i < Math.ceil(s.fireInterval / DT) + 2; i++) step(b, NO);
    step(b, PRESS);
    expect(darts.n).toBe(s.dartsPerShot * 2); // nothing to fire, no new darts
    expect(b.state).toBe("reloading");
    until(b, "ready");
    expect(b.loaded).toEqual([true, true]);
    expect(b.reserve).toBe(s.reserveStart - 2);
  });

  it("8b. break: after one shot, R reloads just the empty barrel (one shell from the reserve); mag counts the loaded shells", () => {
    const { b } = make("B03");
    const s = b.spec;
    step(b, PRESS);
    expect(b.mag).toBe(1);
    expect(b.loaded).toEqual([false, true]);
    step(b, { ...NO, reloadPressed: true });
    expect(b.state).toBe("reloading");
    until(b, "ready");
    expect(b.loaded).toEqual([true, true]);
    expect(b.mag).toBe(2);
    expect(b.reserve).toBe(s.reserveStart - 1);
  });

  it("9. break: two presses 0.1 s apart fire one shell; the second press is ignored until the interval passes", () => {
    const { b, darts } = make("B03");
    const s = b.spec;
    step(b, PRESS);
    expect(darts.n).toBe(s.dartsPerShot);
    for (let i = 0; i < Math.round(0.1 / DT); i++) step(b, NO);
    step(b, PRESS);
    expect(darts.n).toBe(s.dartsPerShot);
    for (let i = 0; i < Math.ceil(s.fireInterval / DT) + 2; i++) step(b, NO);
    step(b, PRESS);
    expect(darts.n).toBe(s.dartsPerShot * 2);
  });

  it("10. mods: B01 double gives 6 darts per shot from muzzles 1 to 6 and magSize 12; B01 slug fires one slug dart", () => {
    {
      const { b, darts } = make("B01", ["double"]);
      const s = b.spec;
      expect(s.dartsPerShot).toBe(6);
      expect(s.magSize).toBe(12);
      expect(b.mag).toBe(12);
      expect(s.muzzles).toHaveLength(6);
      step(b, PRESS);
      expect(darts.n).toBe(6);
      for (let i = 0; i < 6; i++) expect(darts.origins[i]).toBe(MUZ[i]);
      for (const t of darts.types) expect(t).toBe("standard");
    }
    {
      const { b, darts } = make("B01", ["slug"]);
      const s = b.spec;
      expect(s.dartType).toBe("slug");
      expect(s.dartsPerShot).toBe(1);
      expect(s.spreadDeg).toBe(0);
      expect(b.mag).toBe(s.magSize);
      step(b, PRESS);
      expect(darts.n).toBe(1);
      expect(darts.types[0]).toBe("slug");
    }
  });

  it("11. mod suppress: after 10 shots B04's spread and climb are 10 x the suppressed per-shot growth; the climb is less than 0.5 of the unsuppressed climb", () => {
    const { b, darts } = make("B04", ["suppress"]);
    const s = b.spec;
    expect(s.recoil.spreadPerShot).toBeCloseTo(0.12, 10);
    expect(s.recoil.climbDegPerShot).toBeCloseTo(0.08, 10);
    let i = 0;
    while (b.wheelSpeed < 1) { step(b, HOLD); i++; }
    while (darts.n < 10 && i < 4000) { step(b, { ...HOLD, firePressed: false }); i++; }
    expect(darts.n).toBe(10);
    expect(b.spreadNow).toBeCloseTo(10 * 0.12, 9);
    expect(b.climbDegNow).toBeCloseTo(10 * 0.08, 9);
    const unsupClimb = 10 * 0.25; // test 7: 10 shots x 0.25 per shot
    expect(b.climbDegNow / unsupClimb).toBeLessThan(0.5);
    expect(b.climbDegNow / unsupClimb).toBeGreaterThan(0.25);
  });

  it("12. mods: B03 both fires 16 darts on one press (8 per muzzle); B03 quad gives magSize 4, four muzzles and four shells loaded", () => {
    {
      const { b, darts } = make("B03", ["both"]);
      const s = b.spec;
      expect(s.bothBarrels).toBe(true);
      step(b, PRESS);
      expect(darts.n).toBe(16);
      expect(darts.origins.filter((o) => o === MUZ[0]).length).toBe(8);
      expect(darts.origins.filter((o) => o === MUZ[1]).length).toBe(8);
      expect(b.loaded).toEqual([false, false]);
    }
    {
      const { b, darts } = make("B03", ["quad"]);
      const s = b.spec;
      expect(s.magSize).toBe(4);
      expect(s.muzzles).toHaveLength(4);
      expect(b.loaded).toEqual([true, true, true, true]);
      expect(b.mag).toBe(4);
      // Four presses, one shell each, in barrel order.
      for (let p = 0; p < 4; p++) {
        step(b, PRESS);
        for (let i = 0; i < Math.ceil(s.fireInterval / DT) + 2; i++) step(b, NO);
      }
      expect(b.loaded).toEqual([false, false, false, false]);
      expect(darts.n).toBe(4 * s.dartsPerShot);
      expect(darts.origins.filter((o) => o === MUZ[0]).length).toBe(s.dartsPerShot);
      expect(darts.origins.filter((o) => o === MUZ[3]).length).toBe(s.dartsPerShot);
    }
  });
});
