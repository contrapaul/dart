import { describe, expect, it } from "vitest";
import foamerData from "../../data/foamers.json";
import { decideF02, makeF02Context } from "../../src/ai/f02-brain";
import type { F01State } from "../../src/ai/f01-brain";

// GAME-10g stage 2/3: the Crawler fights on the keep-distance brain with
// its OWN numbers (PLAN.md 14: decideF02 fits the Crawler as it is; the
// only thing the system adds is closing the ring while the turret is
// gone, which is a spec read, not a brain change). This drives the pure
// brain with the F09 spec's distances and shows it keeps the ring the
// card asks for, at the Crawler's distance and not the Roamer's.

const SPEC = foamerData.types.F09 as unknown as {
  throwRangeMetres: number;
  preferredDistanceMetres: number;
  retreatDistanceMetres: number;
  attacks: { id: string; token: string; range?: number }[];
};

function step(state: F01State, distance: number, hasToken: boolean, id = 0) {
  const ctx = makeF02Context(id);
  ctx.input.throwRange = SPEC.throwRangeMetres;
  ctx.input.preferredDistance = SPEC.preferredDistanceMetres;
  ctx.input.retreatDistance = SPEC.retreatDistanceMetres;
  ctx.input.holdRange = SPEC.preferredDistanceMetres;
  ctx.input.distance = distance;
  ctx.input.lineOfSight = true;
  ctx.input.hasToken = hasToken;
  ctx.input.flightClear = true;
  ctx.input.blockedSeconds = 0;
  return decideF02(state, 1, ctx.input, id, ctx.decision);
}

describe("the F09 Crawler on the keep-distance brain (GAME-10g)", () => {
  it("14. its type's own numbers drive the brain", () => {
    const stream = SPEC.attacks.find((a) => a.id === "stream")!;
    expect(stream.token).toBe("ranged");
    expect(SPEC.preferredDistanceMetres, "it keeps about 14 m").toBeCloseTo(14, 0);
    // It reads its own spec, not the Roamer's: the Roamer keeps the base
    // spec's 8 m, the Crawler keeps its own 14 m.
    const base = foamerData.test as unknown as { preferredDistanceMetres: number };
    expect(base.preferredDistanceMetres, "the Roamer's ring (the base spec)").toBe(8);
    expect(SPEC.preferredDistanceMetres).not.toBe(base.preferredDistanceMetres);
    const far = step("approach", 22, false);
    expect(far.state, "out of its throw range it closes").toBe("approach");
    const ring = step("approach", SPEC.preferredDistanceMetres, false);
    expect(ring.state, "on its ring it holds").toBe("hold");
    expect(ring.move, "and sidles there").not.toBe("followPath");
    const close = step("hold", SPEC.retreatDistanceMetres - 1, false);
    expect(close.move, "the player closing inside its retreat distance pushes it back")
      .toBe("backOff");
    // The stream's pinned range (its firing distance) sits outside the
    // ring, the way the Floater's does, so mayAttack can be satisfied
    // while the brain parks on the ring.
    expect(stream.range, "the stream fires from outside the ring it keeps")
      .toBeGreaterThan(SPEC.preferredDistanceMetres);
    expect(stream.range).toBeLessThanOrEqual(SPEC.throwRangeMetres);
  });

  it("15. the stomp has no range pin: it is fought at the base melee range", () => {
    const stomp = SPEC.attacks.find((a) => a.id === "stomp")!;
    expect(stomp.token).toBe("melee");
    expect(stomp.range, "a melee attack uses the spec's attackRange").toBeUndefined();
  });
});
