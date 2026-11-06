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

describe("F02 brain: a blocked ring (BUG-08)", () => {
  /** A holding context with no clear flight, blocked for `seconds`. */
  function blocked(distance: number, seconds: number): F02Context {
    const ctx = ctxFor(0);
    ctx.input.distance = distance;
    ctx.input.lineOfSight = true;
    ctx.input.flightClear = false;
    ctx.input.blockedSeconds = seconds;
    return ctx;
  }

  it("sidles its ring while it has been blocked less than the repath time", () => {
    const ctx = blocked(PREFERRED, aiData.brain.blockedRepathSeconds - 0.1);
    const d = decideF02("hold", 1, ctx.input, 0, ctx.decision);
    expect(d.state).toBe("hold");
    expect(d.move).toBe("circleLeft");
    // It keeps asking for nothing: a blocked thrower gives the token back.
    expect(d.wantsToken).toBe(false);
  });

  it("walks its path to the player once it has been blocked past it", () => {
    const ctx = blocked(PREFERRED, aiData.brain.blockedRepathSeconds);
    const d = decideF02("hold", 1, ctx.input, 0, ctx.decision);
    // No new state: it is still holding the ring, but walking its path.
    expect(d.state).toBe("hold");
    expect(d.move).toBe("followPath");
    expect(d.wantsToken).toBe(false);
  });

  it("backs off instead of walking in inside its retreat distance", () => {
    const ctx = blocked(RETREAT - 0.5, aiData.brain.blockedRepathSeconds + 1);
    const d = decideF02("hold", 1, ctx.input, 0, ctx.decision);
    expect(d.move).toBe("backOff");
  });

  it("is back on the ring the step a clear flight resets the timer", () => {
    const ctx = blocked(PREFERRED, aiData.brain.blockedRepathSeconds + 1);
    expect(decideF02("hold", 1, ctx.input, 0, ctx.decision).move).toBe("followPath");
    ctx.input.flightClear = true;
    const d = decideF02("hold", 1, ctx.input, 0, ctx.decision);
    expect(d.move).toBe("circleLeft");
    expect(d.wantsToken).toBe(true);
  });

  it("leaves approach alone: it reads the timer from the step it holds", () => {
    // The timer is read in hold, which is the state that sidles for good.
    // Approach still walks in and settles on the ring; the next step's hold
    // is what leaves it.
    const ctx = ctxFor(0);
    ctx.input.distance = PREFERRED;
    ctx.input.lineOfSight = true;
    ctx.input.flightClear = false;
    ctx.input.blockedSeconds = aiData.brain.blockedRepathSeconds + 1;
    const d = decideF02("approach", 1, ctx.input, 0, ctx.decision);
    expect(d.state).toBe("hold");
    expect(d.move).toBe("circleLeft");
    const next = decideF02("hold", 0, ctx.input, 0, ctx.decision);
    expect(next.move).toBe("followPath");
  });
});
