import { describe, expect, it } from "vitest";
import {
  chargeSeconds,
  decideCharge,
  makeChargerBrain,
  type ChargerState,
  type ChargeInput,
} from "../../src/ai/f05-brain";
import { makeF01Context } from "../../src/ai/f01-brain";
import type { F02Context } from "../../src/ai/f02-brain";
import aiData from "../../data/ai.json";
import foamerData from "../../data/foamers.json";

const BRAIN = aiData.brain;
const CHARGE = foamerData.types.F05.charge;
const DT = 1 / 60;

function input(over: Partial<ChargeInput> = {}): ChargeInput {
  return {
    distance: 10,
    lineOfSight: true,
    hasToken: true,
    range: CHARGE.rangeMetres,
    canCharge: true,
    ...over,
  };
}

function ctx(): F02Context {
  return makeF01Context(0) as F02Context;
}

describe("F05 charge decision (GAME-10b stage 2)", () => {
  it("1. charges from approach only, in range, with the token and a sight line", () => {
    expect(decideCharge("approach", input())).toBe(true);
    expect(decideCharge("hold", input()), "not from hold").toBe(false);
    expect(decideCharge("idle", input())).toBe(false);
    expect(decideCharge("approach", input({ hasToken: false })), "no token").toBe(false);
    expect(decideCharge("approach", input({ lineOfSight: false })), "no sight").toBe(false);
    expect(decideCharge("approach", input({ canCharge: false })), "no legs").toBe(false);
    expect(decideCharge("approach", input({ distance: CHARGE.rangeMetres + 0.1 })), "too far").toBe(false);
    expect(decideCharge("approach", input({ distance: CHARGE.rangeMetres })), "at the edge").toBe(true);
  });

  it("2. the run is the shorter of its length and the distance, never zero", () => {
    expect(chargeSeconds(CHARGE.metres, 4, CHARGE.speed)).toBeCloseTo(4 / CHARGE.speed, 5);
    expect(chargeSeconds(CHARGE.metres, 100, CHARGE.speed)).toBeCloseTo(CHARGE.metres / CHARGE.speed, 5);
    expect(chargeSeconds(CHARGE.metres, 0, CHARGE.speed)).toBeCloseTo(0.05, 5);
    expect(chargeSeconds(CHARGE.metres, 4, 0)).toBe(0);
  });
});

describe("the charger's brain (GAME-10b stage 2)", () => {
  it("3. idles, wakes, walks in and keeps its token on the way in", () => {
    const b = makeChargerBrain("idle", 32);
    const c = ctx();
    c.input.distance = 20;
    c.input.lineOfSight = true;
    b.update(DT, c);
    expect(b.state, "saw the player").toBe("alert");
    c.input.distance = 10;
    for (let i = 0; i < 120 && b.state === "alert"; i++) b.update(DT, c);
    expect(b.state).toBe("approach");
    c.input.hasToken = true;
    b.update(DT, c);
    expect(c.decision.move, "walking in with the token").toBe("followPath");
    expect(b.state, "still approach: the system starts the scrape").toBe("approach");
  });

  it("4. without a token it settles on the hold ring and asks for one", () => {
    const b = makeChargerBrain("approach", 32);
    const c = ctx();
    c.input.distance = BRAIN.holdRangeMetres - 0.2;
    c.input.lineOfSight = true;
    c.input.hasToken = false;
    b.update(DT, c);
    expect(b.state).toBe("hold");
    expect(c.decision.wantsToken, "asking").toBe(true);
    expect(c.decision.move === "circleLeft" || c.decision.move === "circleRight").toBe(true);
  });

  it("5. the charger states are the brain's own and it logs them", () => {
    const b = makeChargerBrain("telegraph", 32);
    const c = ctx();
    const seen: ChargerState[] = [];
    b.update(DT, c);
    seen.push(b.state);
    b.go("charge", c);
    b.update(DT, c);
    seen.push(b.state);
    b.go("wallStun", c);
    seen.push(b.state);
    expect(seen).toEqual(["telegraph", "charge", "wallStun"]);
    expect(b.log().map((t) => `${t.from}>${t.to}`)).toEqual([
      "telegraph>charge", "charge>wallStun",
    ]);
  });
});
