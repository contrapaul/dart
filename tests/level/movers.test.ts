import { describe, expect, it } from "vitest";
import { Movers, ease, turnAbout } from "../../src/level/movers";
import type { Vec3 } from "../../src/level/format";

// ED-31: the move action's maths. Pure: the page hands in an apply callback
// and the mover eases an offset and a turn about Y between them.

describe("movers", () => {
  it("eases in and out over the seconds", () => {
    expect(ease(0)).toBe(0);
    expect(ease(0.5)).toBeCloseTo(0.5, 6);
    expect(ease(1)).toBe(1);
    expect(ease(-1)).toBe(0);
    expect(ease(2)).toBe(1);

    const seen: number[] = [];
    const movers = new Movers();
    movers.register("box-1", (x) => seen.push(x));
    movers.start(["box-1"], [4, 0, 0], 0, 2);
    movers.update(0.5); // quarter way: smoothstep 0.15625
    expect(seen.at(-1)).toBeCloseTo(4 * 0.15625, 6);
    movers.update(0.5); // half way
    expect(seen.at(-1)).toBeCloseTo(2, 6);
    movers.update(1); // the end
    expect(seen.at(-1)).toBeCloseTo(4, 6);
    expect(movers.isMoving("box-1")).toBe(false);
  });

  it("turns a mounted point about the thing's own centre", () => {
    // A point 1 m along +x from the centre, turned a quarter about +y.
    const out: Vec3 = [0, 0, 0];
    turnAbout(out, [0, 0, 0], [1, 0, 0], Math.PI / 2);
    expect(out[0]).toBeCloseTo(0, 6);
    expect(out[1]).toBeCloseTo(0, 6);
    expect(out[2]).toBeCloseTo(-1, 6);
    // A centre other than the origin: the button rides on the parent's turn.
    turnAbout(out, [5, 1, 5], [6, 1, 5], Math.PI / 2);
    expect(out).toEqual([5, 1, 4]);
  });

  it("turns about the centre it is given, not the world origin", () => {
    const applied: { at: Vec3; turn: number }[] = [];
    const movers = new Movers();
    movers.register("door-1", (x, y, z, turn) => {
      const at: Vec3 = [x, y, z];
      applied.push({ at, turn });
    });
    movers.start(["door-1"], [0, 0, 0], 90, 1);
    movers.update(1);
    expect(applied.at(-1)!.turn).toBeCloseTo(Math.PI / 2, 6);
  });

  it("a move on a moving thing starts from where it is", () => {
    const movers = new Movers();
    let at: Vec3 = [0, 0, 0];
    movers.register("box-1", (x, y, z) => { at = [x, y, z]; });
    movers.start(["box-1"], [4, 0, 0], 0, 4);
    movers.update(2); // half way: 2 m
    expect(at[0]).toBeCloseTo(2, 6);
    // Restart mid move with another 4 m: this one ends at 6 m, and its own
    // midpoint is 4 m (2 m from where it was).
    movers.start(["box-1"], [4, 0, 0], 0, 4);
    movers.update(2);
    expect(at[0]).toBeCloseTo(4, 6);
    movers.update(2);
    expect(at[0]).toBeCloseTo(6, 6);
  });

  it("a thing it does not know is ignored, and reset puts it back", () => {
    const movers = new Movers();
    let at: Vec3 = [1, 2, 3];
    movers.register("box-1", (x, y, z) => { at = [x, y, z]; });
    movers.start(["nope"], [1, 0, 0], 0, 1); // no throw, nothing to move
    movers.start(["box-1"], [0, 3, 0], 0, 1);
    movers.update(1);
    expect(at[1]).toBeCloseTo(3, 6);
    movers.reset();
    expect(at).toEqual([0, 0, 0]);
  });
});
