/** ENG-08 stage 2: steering. Seek, arrive, and separation, on plain numbers
 *  with no Rapier world: two overlapping agents are pushed apart. */
import { describe, expect, it } from "vitest";
import { steer } from "../../src/ai/steer";
import { makePath } from "../../src/ai/nav-grid";
import aiData from "../../data/ai.json";

const S = aiData.steer;

/** A straight path from (x, z) to (x + dx, z + dz). */
function path(toX: number, toZ: number, fromX = 0, fromZ = 0) {
  const p = makePath();
  p.xs[0] = fromX;
  p.zs[0] = fromZ;
  p.xs[1] = toX;
  p.zs[1] = toZ;
  p.count = 2;
  return p;
}

describe("steer", () => {
  it("seeks the next waypoint at the agent's speed", () => {
    const out = { x: 0, z: 0 };
    steer({ x: 0, z: 0, speed: 3 }, path(10, 0), [], out);
    expect(out.x).toBeCloseTo(3, 5);
    expect(out.z).toBeCloseTo(0, 5);
  });

  it("heads for the goal along a diagonal at the agent's speed", () => {
    const out = { x: 0, z: 0 };
    steer({ x: 0, z: 0, speed: 2 }, path(10, 10), [], out);
    expect(Math.hypot(out.x, out.z)).toBeCloseTo(2, 5);
    expect(out.x).toBeCloseTo(out.z, 5);
  });

  it("eases to a stop inside the arrive radius", () => {
    const p = path(10, 0);
    const full = { x: 0, z: 0 };
    steer({ x: 9, z: 0, speed: 4 }, p, [], full);
    // 1 m out, radius 0.6: no easing yet, so full speed.
    expect(Math.hypot(full.x, full.z)).toBeCloseTo(4, 5);
    const half = { x: 0, z: 0 };
    steer({ x: 10 - S.arriveRadiusMetres / 2, z: 0, speed: 4 }, p, [], half);
    expect(Math.hypot(half.x, half.z)).toBeCloseTo(2, 1);
    const done = { x: 0, z: 0 };
    steer({ x: 10, z: 0, speed: 4 }, p, [], done);
    expect(Math.hypot(done.x, done.z)).toBeCloseTo(0, 5);
  });

  it("holds still with no path", () => {
    const out = { x: 5, z: 5 };
    steer({ x: 1, z: 2, speed: 3 }, makePath(), [], out);
    expect(out.x).toBe(0);
    expect(out.z).toBe(0);
  });

  it("separates two overlapping agents", () => {
    // Agent a at the origin, b a fifth of a metre away.
    const a = { x: 0, z: 0, speed: 0 };
    const b = { x: 0.2, z: 0 };
    const out = { x: 0, z: 0 };
    steer(a, makePath(), [b], out);
    // b sits at +x, so a is pushed the other way.
    expect(out.x, "pushed away from b").toBeLessThan(0);
    expect(out.z).toBeCloseTo(0, 6);
    // The push grows as the overlap deepens.
    const near = { x: 0, z: 0 };
    steer(a, makePath(), [{ x: 0.1, z: 0 }], near);
    expect(Math.abs(near.x)).toBeGreaterThan(Math.abs(out.x));
  });

  it("does not separate agents that are far enough apart", () => {
    const out = { x: 1, z: 1 };
    steer({ x: 0, z: 0, speed: 0 }, makePath(), [{ x: S.separationMetres, z: 0 }], out);
    expect(out.x).toBe(0);
    expect(out.z).toBe(0);
  });

  it("pushes coincident agents apart rather than leaving them stacked", () => {
    const out = { x: 0, z: 0 };
    steer({ x: 0, z: 0, speed: 0 }, makePath(), [{ x: 0, z: 0 }], out);
    expect(Math.hypot(out.x, out.z)).toBeGreaterThan(0);
  });

  it("separates while still seeking the waypoint", () => {
    const out = { x: 0, z: 0 };
    steer({ x: 0, z: 0, speed: 2 }, path(10, 0), [{ x: -0.2, z: 0 }], out);
    // Seeking is +x and a neighbour at -x pushes +x too, so both add up.
    expect(out.x).toBeGreaterThan(2);
    expect(out.z).toBeCloseTo(0, 6);
    // A neighbour in the way still leaves the agent closing on the waypoint.
    const blocked = { x: 0, z: 0 };
    steer({ x: 0, z: 0, speed: 2 }, path(10, 0), [{ x: 0.2, z: 0 }], blocked);
    expect(blocked.x).toBeLessThan(2);
  });
});
