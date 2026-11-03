import { describe, expect, it } from "vitest";
import aiData from "../../data/ai.json";
import { Director } from "../../src/ai/director";
import { tokenScore, type F01State } from "../../src/ai/f01-brain";
import {
  decideF02,
  makeF02Brain,
  makeF02Context,
  type F02Context,
} from "../../src/ai/f02-brain";

// The F02 Roamer's brain (GAME-10a): the ranged variant of the F01 tests in
// brain.test.ts. The distances are the F02 spec's (data/foamers.json):
// throw at 12 m, keep 8 m, back off inside 5 m.

const DT = 1 / 60;
const THROW_RANGE = 12;
const PREFERRED = 8;
const RETREAT = 5;
const RANGED_CAP = aiData.difficulties.normal.ranged;

/** A context for a simulated F02 with its spec's three distances. */
function ctxFor(id: number): F02Context {
  const ctx = makeF02Context(id);
  ctx.input.throwRange = THROW_RANGE;
  ctx.input.preferredDistance = PREFERRED;
  ctx.input.retreatDistance = RETREAT;
  ctx.input.holdRange = PREFERRED;
  return ctx;
}

/** One step of the pure brain on a filled input. */
function step(state: F01State, distance: number, hasToken: boolean, id = 0) {
  const ctx = ctxFor(id);
  ctx.input.distance = distance;
  ctx.input.lineOfSight = true;
  ctx.input.hasToken = hasToken;
  return decideF02(state, 1, ctx.input, id, ctx.decision);
}

describe("F02 brain: distances", () => {
  it("walks in from far off and keeps the ring once inside the throw range", () => {
    const far = step("approach", 18, false);
    expect(far.state).toBe("approach");
    expect(far.move).toBe("followPath");
    const ring = step("approach", THROW_RANGE - 0.5, false);
    expect(ring.state).toBe("hold");
    // On the ring, outside the retreat distance: it sidles.
    expect(ring.move).toBe("circleLeft");
  });

  it("stands at the preferred distance while it still approaches", () => {
    const d = step("approach", PREFERRED - 0.5, false);
    expect(d.state).toBe("hold");
    // Outside the throw range it walks in; inside it, without a token, it
    // settles on the ring instead (the hold state), at any distance.
    const chase = step("approach", THROW_RANGE + 2, false);
    expect(chase.state).toBe("approach");
    expect(chase.move).toBe("followPath");
    const close = step("approach", PREFERRED - 0.5, true);
    expect(close.move).toBe("stand");
  });

  it("backs off when the player closes inside the retreat distance", () => {
    const hold = step("hold", RETREAT - 0.5, false);
    expect(hold.state).toBe("hold");
    expect(hold.move).toBe("backOff");
    // While chasing with a token it backs off too, not strafes.
    const chase = step("approach", RETREAT - 0.5, true);
    expect(chase.state).toBe("approach");
    expect(chase.move).toBe("backOff");
  });

  it("goes back to approach when the player walks out past the throw range", () => {
    const back = step("hold", THROW_RANGE + aiData.brain.holdExitMarginMetres + 0.1, false);
    expect(back.state).toBe("approach");
    expect(back.move).toBe("followPath");
    // Inside the margin it stays on the ring (no flapping).
    const stay = step("hold", THROW_RANGE + aiData.brain.holdExitMarginMetres - 0.1, false);
    expect(stay.state).toBe("hold");
  });

  it("returns to approach with its token so the state machine can throw", () => {
    const got = step("hold", PREFERRED, true);
    expect(got.state).toBe("approach");
    expect(got.move).toBe("stand");
    // It keeps bidding while it waits for one, not once it holds it.
    expect(got.wantsToken).toBe(false);
    const waiting = step("hold", PREFERRED, false);
    expect(waiting.wantsToken).toBe(true);
  });

  it("passes idle through alert on sight like the F01", () => {
    const seen = step("idle", THROW_RANGE + 4, false);
    expect(seen.state).toBe("alert");
    const blind = ctxFor(0);
    blind.input.distance = 3;
    blind.input.lineOfSight = false;
    expect(decideF02("idle", 0, blind.input, 0, blind.decision).state).toBe("idle");
  });
});

describe("F02 brain on a director", () => {
  it("caps throwers with tokens at the ranged pool", () => {
    const director = new Director("normal");
    const brains: { id: number; brain: ReturnType<typeof makeF02Brain>; ctx: F02Context }[] =
      [];
    for (let i = 0; i < RANGED_CAP + 2; i++) {
      const ctx = ctxFor(i);
      ctx.input.distance = PREFERRED;
      ctx.input.lineOfSight = true;
      brains.push({ id: i, brain: makeF02Brain("hold", 8), ctx });
    }
    for (const b of brains) {
      b.ctx.input.hasToken = director.request(b.id, "ranged", tokenScore(PREFERRED, true, 0));
      b.brain.update(DT, b.ctx);
    }
    director.update(DT);
    let holding = 0;
    for (const b of brains) {
      b.ctx.input.hasToken = director.request(b.id, "ranged", tokenScore(PREFERRED, true, 0));
      if (b.ctx.input.hasToken) holding++;
    }
    expect(holding).toBe(RANGED_CAP);
  });

  it("does not bid from idle or alert", () => {
    const director = new Director("normal");
    const ctx = ctxFor(0);
    ctx.input.distance = 30;
    ctx.input.lineOfSight = false;
    const brain = makeF02Brain("idle", 8);
    brain.update(DT, ctx);
    ctx.input.hasToken = director.request(0, "ranged", tokenScore(30, false, 0));
    expect(ctx.input.hasToken).toBe(false);
    expect(brain.state).toBe("idle");
  });
});
