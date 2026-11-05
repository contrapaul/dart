import { describe, expect, it } from "vitest";
import foamerData from "../../data/foamers.json";
import { Director } from "../../src/ai/director";
import { tokenScore, type F01State } from "../../src/ai/f01-brain";
import {
  decideF04,
  makeF04Brain,
  makeF04Context,
  SLOT_LEAVE,
  SLOT_REACHED,
  type F04Context,
} from "../../src/ai/f04-brain";

// The F04 Blocker's brain (GAME-10e): the shield wall. Distances and
// timings are the F04 spec's (data/foamers.json): volley at 16 m, hold at
// 9 m, slots 1.2 m apart, retreat inside 6 m.

const DT = 1 / 60;
const THROW_RANGE = 16;
const HOLD = 9;
const SLOT = { x: 0, z: HOLD };

/** A context for a simulated F04 with its spec's distances. */
function ctxFor(id: number): F04Context {
  const ctx = makeF04Context(id);
  ctx.input.distance = HOLD;
  ctx.input.lineOfSight = true;
  ctx.input.throwRange = THROW_RANGE;
  ctx.input.preferredDistance = HOLD;
  ctx.input.retreatDistance = 6;
  ctx.input.holdRange = HOLD;
  ctx.input.slotX = SLOT.x;
  ctx.input.slotZ = SLOT.z;
  return ctx;
}

/** One step of the pure brain, with the slot distance driven directly. */
function step(
  state: F01State,
  slotDistance: number,
  options: { hasToken?: boolean; shieldBroken?: boolean; distance?: number } = {},
  id = 0,
) {
  const ctx = ctxFor(id);
  ctx.input.slotDistance = slotDistance;
  ctx.input.hasToken = options.hasToken ?? false;
  ctx.input.shieldBroken = options.shieldBroken ?? false;
  ctx.input.distance = options.distance ?? HOLD;
  return decideF04(state, 1, ctx.input, id, ctx.decision);
}

describe("F04 brain: the wall", () => {
  it("wakes on sight and holds the wall while it walks to its slot", () => {
    const idle = step("idle", 4, { distance: 18 });
    expect(idle.state).toBe("alert");
    const walk = step("approach", 4);
    expect(walk.move).toBe("toSlot");
    expect(walk.wantsToken).toBe(false);
  });

  it("stands on its slot and asks for the ranged token", () => {
    const arrived = step("approach", SLOT_REACHED - 0.05);
    expect(arrived.state).toBe("hold");
    expect(arrived.wantsToken).toBe(true);
    expect(arrived.move).toBe("stand");
    // With the token in hand it steps out of hold to fire: approach is
    // where the state machine starts an attack, and it fires from its slot.
    const firing = step("hold", 0, { hasToken: true });
    expect(firing.state).toBe("approach");
    expect(firing.move).toBe("stand");
  });

  it("walks back to its slot once the wall moves past the leave margin", () => {
    const nudged = step("hold", SLOT_REACHED + 0.1);
    expect(nudged.state).toBe("hold");
    expect(nudged.move).toBe("stand");
    const wandered = step("hold", SLOT_LEAVE + 0.2);
    expect(wandered.state).toBe("approach");
    expect(wandered.move).toBe("toSlot");
  });

  it("stops holding the wall once the shield is gone", () => {
    // A broken shield is not a wall: the Blocker never walks to a slot
    // again, and keeps the Roamer's ring distance instead.
    const offSlot = step("approach", 6, { shieldBroken: true, distance: 9 });
    // Inside the throw range without a token: the Roamer ring, not a slot.
    expect(offSlot.state).toBe("hold");
    expect(offSlot.move).toBe("circleLeft");
    expect(offSlot.wantsToken).toBe(true);
    const far = step("approach", 6, { shieldBroken: true, distance: 25 });
    expect(far.move).toBe("followPath");
    const close = step("hold", 0, { shieldBroken: true, distance: 3 });
    expect(close.move).toBe("backOff");
  });

  it("walks the whole way to its slot before it asks for a token", () => {
    const ctx = ctxFor(0);
    ctx.input.slotDistance = 5;
    const brain = makeF04Brain("approach");
    brain.update(DT, ctx);
    // Still walking: the step says toSlot and does not want the token.
    expect(ctx.decision.move).toBe("toSlot");
    expect(ctx.decision.wantsToken).toBe(false);
    // Arrived: the very next step holds and asks for it.
    ctx.input.slotDistance = 0;
    brain.update(DT, ctx);
    expect(brain.state).toBe("hold");
    expect(ctx.decision.wantsToken).toBe(true);
  });
});

describe("F04 brain: the volley token", () => {
  it("draws on the ranged pool, and a nearer Blocker outbids a farther one", () => {
    // The Blocker's volley uses the ranged token, so the pool, the cap and
    // the bid rule are the Roamer's. The nearer agent's bid is larger.
    const near = tokenScore(HOLD, true, 0);
    const far = tokenScore(15, true, 0);
    expect(near).toBeGreaterThan(far);
    const director = new Director("story");
    expect(director.request(0, "ranged", near)).toBe(false);
    expect(director.request(1, "ranged", far)).toBe(false);
    expect(director.request(2, "ranged", far / 2)).toBe(false);
    director.update(1);
    // Story has one ranged token, and the bid rule gives it to the nearest.
    expect(director.request(0, "ranged", near)).toBe(true);
    expect(director.request(1, "ranged", far)).toBe(false);
    expect(director.request(2, "ranged", far / 2)).toBe(false);
  });

  it("fires only with the token: without one it still holds the wall", () => {
    const held = step("hold", 0, { hasToken: false });
    expect(held.wantsToken).toBe(true);
    expect(held.state).toBe("hold");
    expect(held.move).toBe("stand");
  });
});


describe("F04 stagger times", () => {
  it("stays down longer for the player's shield charge than for a dart", () => {
    // data/foamers.json: stagger.time is a dart's stagger, and the charge
    // time (1.2 s) is the window the charge opens in the wall.
    const st = foamerData.types.F04.stagger as { time: number; shieldChargeTime?: number };
    expect(st.shieldChargeTime).toBe(1.2);
    expect(st.shieldChargeTime!).toBeGreaterThan(st.time);
  });
});
