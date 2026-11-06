import { describe, expect, it } from "vitest";
import foamerData from "../../data/foamers.json";
import {
  bandReaches, landingPoint, leapFlight, leapOf, makeShockwave, shockwaveOf,
  startShockwave, stepShockwave,
} from "../../src/foamers/leap";

const LEAP = foamerData.types.F07.leap;
const WAVE = foamerData.types.F07.shockwave;
const DT = 1 / 60;

/** Grow a ring to the radius its edge has reached, stepping it. */
function grow(radius: number) {
  const w = makeShockwave();
  startShockwave(w, WAVE, 0, 0);
  while (w.radius < radius) stepShockwave(w, DT, WAVE);
  return w;
}

describe("the leap maths (GAME-10f stage 2)", () => {
  it("1. only a type with the blocks has leap numbers", () => {
    expect(leapOf(foamerData.types.F07 as never), "the Brawler leaps").not.toBeNull();
    expect(shockwaveOf(foamerData.types.F07 as never), "and lands a ring").not.toBeNull();
    expect(leapOf(foamerData.types.F01 as never), "the Roamer does not").toBeNull();
    expect(shockwaveOf(foamerData.types.F05 as never), "nor the Darter").toBeNull();
  });

  it("2. the landing point is pulled back short of the target, never past it", () => {
    const p = landingPoint(0, 0, 0, 10, LEAP.landShortMetres);
    expect(p.x).toBeCloseTo(0, 6);
    expect(p.z, "short of the player").toBeCloseTo(10 - LEAP.landShortMetres, 6);
    // Diagonally, the same pull back along the way to the target.
    const d = landingPoint(0, 0, 6, 8, LEAP.landShortMetres);
    expect(Math.hypot(d.x, d.z)).toBeCloseTo(10 - LEAP.landShortMetres, 6);
    // Standing on the spot: it does not overshoot backwards.
    const s = landingPoint(0, 0, 0.5, 0, LEAP.landShortMetres);
    expect(s.z).toBeGreaterThanOrEqual(0);
    const same = landingPoint(2, 3, 2, 3, LEAP.landShortMetres);
    expect([same.x, same.z]).toEqual([2, 3]);
  });

  it("3. the flight hangs long enough to reach its point and to rise to the arc", () => {
    const f = leapFlight(7, LEAP.speed, LEAP.arcMetres, 22);
    expect(f.seconds).toBeGreaterThanOrEqual(7 / LEAP.speed - 1e-6);
    // Apex of a parabola that leaves and lands on its own ground: vy^2/2g.
    expect((f.vy * f.vy) / (2 * 22)).toBeGreaterThanOrEqual(LEAP.arcMetres - 1e-6);
    // And it is back on the ground when the flight ends: 2*vy/g = seconds.
    expect((2 * f.vy) / 22).toBeCloseTo(f.seconds, 6);
    expect(leapFlight(0, LEAP.speed, LEAP.arcMetres, 22).seconds, "a hop still reads").toBeGreaterThan(0);
    expect(leapFlight(5, 0, LEAP.arcMetres, 22)).toEqual({ seconds: 0, vy: 0 });
  });

  it("4. the ring grows at its speed to its radius and then fades", () => {
    const w = makeShockwave();
    startShockwave(w, WAVE, 4, -2);
    expect([w.x, w.z]).toEqual([4, -2]);
    stepShockwave(w, 0.5, WAVE);
    expect(w.radius).toBeCloseTo(WAVE.speed * 0.5, 6);
    let alive = true;
    while (alive) alive = stepShockwave(w, DT, WAVE);
    expect(w.radius, "it stops at the radius").toBeCloseTo(WAVE.radius, 5);
    expect(stepShockwave(w, DT, WAVE), "and reports itself gone").toBe(false);
  });

  it("5. the band catches a player it passes over once, at the edge", () => {
    // A player 5 m out: the edge has to arrive, and the inner edge must not
    // have gone past them yet.
    const w = grow(5);
    expect(bandReaches(w, 5, WAVE), "the edge has arrived").toBe(true);
    expect(bandReaches(w, 5, WAVE), "once").toBe(false);
  });

  it("6. it misses a player the whole band has passed", () => {
    // 2 m out, the band 0.6 m thick: once the edge is 3 m out the band is
    // behind them and this ring can never touch them again.
    const w = grow(3);
    expect(bandReaches(w, 2, WAVE), "the band has gone past").toBe(false);
    expect(w.passed).toBe(true);
    // Even standing where the band would have been, later: no hit.
    expect(bandReaches(w, 2.3, WAVE)).toBe(false);
  });

  it("7. a player inside the hole while it grows is missed, like a jump", () => {
    // The band reaches 3 m; the player spends all that time at 1 m (in the
    // air), and only lands afterwards.
    const w = grow(3);
    expect(bandReaches(w, 1, WAVE), "under it the whole time").toBe(false);
    expect(bandReaches(w, 1, WAVE), "and after").toBe(false);
  });

  it("8. an inactive ring hits nobody", () => {
    const w = makeShockwave();
    expect(bandReaches(w, 1, WAVE)).toBe(false);
    expect(stepShockwave(w, DT, WAVE)).toBe(false);
  });
});
