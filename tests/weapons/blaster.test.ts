import { beforeAll, describe, expect, it } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { DartSystem } from "../../src/weapons/darts";
import type { DartTypeName } from "../../src/weapons/darts";
import { Blaster, type BlasterSpec } from "../../src/weapons/blaster";
import type { BlasterControls } from "../../src/weapons/blaster";
import spec from "../../data/blasters.json";

// The compat build runs in Node with a plain Scene and a real Rapier world.
const DT = 1 / 60;
const S = spec.placeholder as BlasterSpec;
const ORIGIN = new THREE.Vector3(0, 2, 4);
const AIM = new THREE.Vector3(0, 0, -1);

// Deterministic rng: a tiny LCG, one stream per test run.
function lcg(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

function makeBlaster(seed: number) {
  const scene = new THREE.Scene();
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  const ignore = world.createCollider(RAPIER.ColliderDesc.capsule(0.5, 0.3), body);
  const darts = new DartSystem(scene, world, RAPIER, ignore);
  const b = new Blaster(S, darts, lcg(seed));
  return { b, darts };
}

function step(b: Blaster, controls: BlasterControls) {
  b.update(DT, controls, ORIGIN, AIM);
}

const HOLD_FIRE: BlasterControls = { firePressed: true, reloadPressed: false };
const NO_PRESS: BlasterControls = { firePressed: false, reloadPressed: false };

/** Steps until the blaster reaches `want`, counting the steps taken. */
function until(b: Blaster, want: "ready" | "reloading"): number {
  let i = 0;
  while (b.state !== want) {
    step(b, NO_PRESS);
    i++;
    if (i > 2000) throw new Error(`never reached ${want}`);
  }
  return i;
}

beforeAll(async () => {
  await RAPIER.init();
});

describe("Blaster placeholder (data/blasters.json)", () => {
  it("1. one press fires dartsPerShot darts, drops the mag by 1, primes; a press during priming is ignored; after primeTime the next press fires again", () => {
    const { b, darts } = makeBlaster(1);
    expect(b.state).toBe("ready");
    step(b, HOLD_FIRE);
    expect(darts.stats().flying).toBe(S.dartsPerShot);
    expect(b.mag).toBe(S.magSize - 1);
    expect(b.state).toBe("priming");
    // A press during priming fires nothing.
    step(b, HOLD_FIRE);
    expect(darts.stats().flying).toBe(S.dartsPerShot);
    expect(b.mag).toBe(S.magSize - 1);
    // Priming takes primeTime, within one step.
    const stepsUntilReady = until(b, "ready");
    expect(stepsUntilReady * DT).toBeGreaterThanOrEqual(S.primeTime - DT);
    expect(stepsUntilReady * DT).toBeLessThan(S.primeTime + DT * 2);
    // The next press fires again.
    step(b, HOLD_FIRE);
    expect(darts.stats().flying).toBe(S.dartsPerShot * 2);
    expect(b.mag).toBe(S.magSize - 2);
    expect(b.state).toBe("priming");
  });

  it("2. 48 shots (a full worth of ammo: two drains plus an auto-reload, capped at 48): every dart direction is within spreadDeg of the aim", () => {
    const { b, darts } = makeBlaster(2);
    const dirs: THREE.Vector3[] = [];
    const real = darts.fire.bind(darts);
    darts.fire = (o: THREE.Vector3, d: THREE.Vector3, t: DartTypeName) => {
      dirs.push(d.clone());
      return real(o, d, t);
    };
    // Hold fire: each shot, then its priming; empty mags auto-reload. The
    // blaster holds magSize + reserveStart = 48 rounds, so cap at 48.
    const shots = S.magSize + S.reserveStart;
    let i = 0;
    while (dirs.length < shots * S.dartsPerShot && i < 20000) {
      step(b, HOLD_FIRE);
      i++;
    }
    expect(dirs.length).toBe(shots * S.dartsPerShot);
    const worst = Math.min(
      ...dirs.map((d) => d.dot(AIM)),
    );
    const worstDeg = THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(worst, -1, 1)));
    expect(worstDeg).toBeLessThanOrEqual(S.spreadDeg + 1e-6);
  });

  it("3. an emptied mag with autoReload reloads after the last priming; with a reserve of 3 the refill is only 3", () => {
    {
      // Drain the mag: each shot needs its priming to finish first.
      const { b } = makeBlaster(3);
      for (let shot = 0; shot < S.magSize; shot++) {
        if (shot > 0) until(b, "ready");
        step(b, HOLD_FIRE);
      }
      expect(b.mag).toBe(0);
      expect(b.state).toBe("priming");
      // Auto-reload starts as soon as that priming is over.
      until(b, "reloading");
      let i = 0;
      while (b.state !== "ready") { step(b, NO_PRESS); i++; if (i > 2000) throw new Error("stuck"); }
      expect(i * DT).toBeGreaterThanOrEqual(S.reloadTime - DT);
      expect(b.mag).toBe(S.magSize);
      expect(b.reserve).toBe(S.reserveStart - S.magSize);
    }
    {
      // An empty mag and a reserve of 3 refills by 3 only.
      const { b } = makeBlaster(31);
      b.mag = 0;
      b.reserve = 3;
      step(b, HOLD_FIRE); // press with an empty mag: autoReload kicks in
      expect(b.state).toBe("reloading");
      until(b, "ready");
      expect(b.mag).toBe(3);
      expect(b.reserve).toBe(0);
    }
  });

  it("4. reloadPressed does nothing with a full mag, with an empty reserve, or while priming", () => {
    {
      const { b } = makeBlaster(4);
      step(b, { firePressed: false, reloadPressed: true });
      expect(b.state).toBe("ready");
      expect(b.mag).toBe(S.magSize);
    }
    {
      const { b } = makeBlaster(41);
      b.reserve = 0;
      b.mag = 0; // reloadable in principle, but nothing to move
      step(b, { firePressed: false, reloadPressed: true });
      expect(b.state).toBe("ready");
    }
    {
      const { b } = makeBlaster(42);
      step(b, HOLD_FIRE);
      expect(b.state).toBe("priming");
      step(b, { firePressed: false, reloadPressed: true });
      expect(b.state).toBe("priming");
      expect(b.mag).toBe(S.magSize - 1);
    }
  });
});
