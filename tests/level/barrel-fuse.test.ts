import { describe, expect, it } from "vitest";
import {
  advance, blastReaches, CHAIN_DELAY, classifyHit, FUSE_SECONDS, puncture, shareLeft,
  startFuse,
} from "../../src/level/barrel-fuse";
import barrel from "../../data/barrel.json";
import explosionJson from "../../data/explosion.json";
import destruction from "../../data/destruction.json";

// ENV-05 (E15): the leaking barrel's fuse, as rules with no world. Paul's
// ask: one standard dart starts a 10 s fuse, a second halves what is left,
// a third sets it off; any other round sets it off at once.

const DT = 1 / 60;

function run(fuse: ReturnType<typeof startFuse>, seconds: number): boolean {
  let fired = false;
  const steps = Math.round(seconds / DT);
  for (let i = 0; i < steps; i++) if (advance(fuse, DT)) fired = true;
  return fired;
}

describe("ENV-05 the barrel's fuse", () => {
  it("one puncture gives the data's fuse and does not set it off", () => {
    const f = startFuse();
    expect(puncture(f)).toBe(false);
    expect(f.punctures).toBe(1);
    expect(f.remaining).toBeCloseTo(FUSE_SECONDS, 10);
    expect(f.setOff).toBe(false);
    expect(barrel.fuseSeconds).toBe(10);
  });

  it("a second puncture at t = 4 s leaves 3 s", () => {
    const f = startFuse();
    puncture(f);
    expect(run(f, 4)).toBe(false);
    // 6 s left, so the second puncture halves it to 3.
    expect(puncture(f)).toBe(false);
    expect(f.remaining).toBeCloseTo(3, 6);
    // Two seconds more is not enough; one more goes off exactly once.
    expect(run(f, 2)).toBe(false);
    expect(f.remaining).toBeGreaterThan(0);
    expect(run(f, 1.4)).toBe(true);
    expect(f.setOff).toBe(true);
  });

  it("a third puncture sets it off at once", () => {
    const f = startFuse();
    puncture(f);
    puncture(f);
    expect(puncture(f)).toBe(true);
    expect(f.remaining).toBe(0);
    expect(f.setOff).toBe(true);
  });

  it("three punctures in one step go off at once (B01's cluster)", () => {
    const f = startFuse();
    // The same step, no time between them: the third is the blast.
    expect(puncture(f)).toBe(false);
    expect(puncture(f)).toBe(false);
    expect(puncture(f)).toBe(true);
    expect(f.setOff).toBe(true);
    expect(f.punctures).toBe(3);
  });

  it("nothing happens after it has gone off", () => {
    const f = startFuse();
    puncture(f);
    puncture(f);
    puncture(f);
    expect(puncture(f)).toBe(false);
    expect(run(f, 5)).toBe(false);
    expect(f.setOff).toBe(true);
    expect(f.remaining).toBe(0);
  });

  it("a fuse that never ran out reports nothing and keeps counting 0 left", () => {
    const f = startFuse();
    expect(advance(f, 1)).toBe(false);
    expect(f.punctures).toBe(0);
    expect(shareLeft(f)).toBe(0);
    puncture(f);
    expect(shareLeft(f)).toBeCloseTo(1, 10);
    run(f, FUSE_SECONDS / 2);
    expect(shareLeft(f)).toBeCloseTo(0.5, 2);
  });

  it("a standard dart punctures; every other round sets it off", () => {
    expect(classifyHit("standard")).toBe("puncture");
    // The card names these: a mega dart, a ball and a precision dart.
    for (const type of ["mega", "ball", "precision"]) {
      expect(classifyHit(type)).toBe("setOff");
    }
    // Every dart type in the data that is not the puncture round sets it off.
    for (const type of ["suction", "launcher", "slug", "buck", "b01slug", "precisionHeavy"]) {
      expect(classifyHit(type)).toBe("setOff");
    }
  });

  it("a blast reaches a barrel inside its radius plus the barrel's", () => {
    const radius = barrel.look.diameterMetres / 2;
    expect(blastReaches(0, 4.5, radius)).toBe(true);
    expect(blastReaches(4.5 + radius, 4.5, radius)).toBe(true);
    expect(blastReaches(4.5 + radius + 0.01, 4.5, radius)).toBe(false);
  });

  it("the chain delay is a short wait from the data", () => {
    expect(CHAIN_DELAY).toBeCloseTo(0.15, 10);
    expect(barrel.chainDelay).toBe(0.15);
  });

  it("the barrel profile exists in the explosion data, bigger than the launcher's", () => {
    const p = explosionJson.profiles.barrel;
    const launcher = explosionJson.profiles.launcher;
    expect(p).toBeDefined();
    expect(p.carveRadius).toBeGreaterThan(launcher.carveRadius);
    expect(p.damageCentre).toBeGreaterThan(launcher.damageCentre);
    expect(p.rangeMetres).toBeGreaterThan(launcher.rangeMetres);
    expect(p.fxRadius).toBeGreaterThan(launcher.fxRadius);
    // The card's start values.
    expect(p.carveRadius).toBe(1.2);
    expect(p.damageCentre).toBe(30);
    expect(p.rangeMetres).toBe(4.5);
    expect(p.fxRadius).toBe(3.6);
    // A blast never spawns more chunks than the debris ring holds.
    expect(p.burstChunks).toBeLessThanOrEqual(destruction.debris.max);
  });
});
