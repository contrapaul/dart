import { describe, expect, it } from "vitest";
import {
  decideF03,
  makeF03Brain,
  makeF03Context,
  PACK,
  type F03Context,
} from "../../src/ai/f03-brain";
import { BRAIN, makeF01Context } from "../../src/ai/f01-brain";
import aiData from "../../data/ai.json";
import foamerData from "../../data/foamers.json";

const DT = 1 / 60;
const F03 = foamerData.types.F03;

function ctx(): F03Context {
  const c = makeF03Context(0);
  c.input.attackRange = F03.attackRange;
  c.input.holdRange = F03.holdRangeMetres;
  return c;
}

describe("the Swarmer's brain (GAME-10d stage 2)", () => {
  it("1. wakes on sight, then walks in and asks for a nibble in reach", () => {
    const b = makeF03Brain("idle", 32);
    const c = ctx();
    c.input.distance = 20;
    c.input.lineOfSight = true;
    b.update(DT, c);
    expect(b.state, "saw the player").toBe("alert");
    for (let i = 0; i < 120 && b.state === "alert"; i++) b.update(DT, c);
    expect(b.state).toBe("approach");
    c.input.distance = 3;
    b.update(DT, c);
    expect(c.decision.move, "not in reach yet").toBe("followPath");
    expect(c.decision.wantsToken, "not in reach yet").toBe(false);
    c.input.distance = F03.attackRange;
    b.update(DT, c);
    expect(c.decision.move, "in reach").toBe("stand");
    expect(c.decision.wantsToken, "asking for a nibble").toBe(true);
  });

  it("2. after a nibble it backs out to the ring and waits the gap", () => {
    const b = makeF03Brain("approach", 32);
    const c = ctx();
    c.input.lineOfSight = true;
    c.input.distance = F03.attackRange;
    c.input.hasToken = true;
    // The nibble lands: the Foamer restarts the clock, so the brain rings.
    c.input.sinceNibble = 0;
    b.update(DT, c);
    expect(b.state, "out to the ring").toBe("hold");
    expect(c.decision.wantsToken, "no nibble on the way out").toBe(false);
    // Inside the ring it backs off, and outside it sidles along the ring.
    c.input.distance = PACK.ringMetres - 0.5;
    b.update(DT, c);
    expect(c.decision.move).toBe("backOff");
    c.input.distance = PACK.ringMetres + 1;
    b.update(DT, c);
    expect(c.decision.move === "circleLeft" || c.decision.move === "circleRight").toBe(true);
    expect(b.state, "still waiting").toBe("hold");
    // The gap runs out: back in it comes.
    c.input.sinceNibble = PACK.nibbleGapSeconds;
    b.update(DT, c);
    expect(b.state).toBe("approach");
    expect(c.decision.move).toBe("followPath");
  });

  it("3. the ring wait is the type's ring, not the shared bonker ring", () => {
    expect(F03.holdRangeMetres).toBeGreaterThan(BRAIN.holdRangeMetres);
    const c = ctx();
    c.input.sinceNibble = 0;
    const out = decideF03("approach", 0, c.input, 0, c.decision);
    expect(out.state).toBe("hold");
    // A player who stays inside the type's ring is backed away from, which
    // the shared ring would not do at this distance.
    c.input.distance = (F03.holdRangeMetres + BRAIN.holdRangeMetres) / 2;
    decideF03("hold", 0, c.input, 0, c.decision);
    expect(c.decision.move).toBe("backOff");
  });

  it("4. one alert wakes the whole pack: a neighbour picks the alarm up", () => {
    // nearbyAlert is the shared field: any member that hears it goes alert.
    const pack = [0, 1, 2, 3, 4].map(() => makeF03Brain("idle", 32));
    const cs = pack.map((_, i) => {
      const c = ctx();
      c.input.distance = 30; // out of sight, so only the alarm can wake it
      c.agentId = i;
      return c;
    });
    // The one that saw the player.
    cs[0]!.input.distance = 5;
    cs[0]!.input.lineOfSight = true;
    pack[0]!.update(DT, cs[0]!);
    expect(pack[0]!.state).toBe("alert");
    // Its neighbours hear it on their next step, all at once.
    for (let i = 1; i < pack.length; i++) cs[i]!.input.nearbyAlert = true;
    for (let i = 1; i < pack.length; i++) pack[i]!.update(DT, cs[i]!);
    for (let i = 0; i < pack.length; i++) expect(pack[i]!.state, `member ${i}`).toBe("alert");
  });

  it("5. the pack numbers are data, and the swarm pool is its own", () => {
    expect(PACK.maxAlive).toBeGreaterThanOrEqual(10);
    expect(aiData.difficulties.normal.swarm).toBeGreaterThan(0);
    expect(aiData.difficulties.normal.swarm).not.toBe(aiData.difficulties.normal.melee);
    expect(foamerData.types.F03.attacks[0]!.token).toBe("swarm");
    expect(makeF01Context(0).input.sinceNibble, "the others start with no nibble").toBe(Infinity);
  });
});
