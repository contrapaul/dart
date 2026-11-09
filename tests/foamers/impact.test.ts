import { describe, expect, it } from "vitest";
import foamersData from "../../data/foamers.json";
import blastersData from "../../data/blasters.json";
import {
  CatastrophicSpec,
  chunkDebrisExtra,
  downPushOf,
  growthOf,
  impactChunkRadius,
  impactOf,
  judgeImpact,
  nearOf,
  overkillOf,
  popBurstBoost,
} from "../../src/foamers/impact";

// PT-03 stage 1: the impact rule in pure, the card's worked cases and the
// edges it names. overkill, near, impact and the three outcomes, with the
// debris cap staying hard; an explosion's kill reads near 1.

const spec = foamersData.test.catastrophic as unknown as CatastrophicSpec;
const b03 = (blastersData as unknown as {
  impact: { fullMetres: number; zeroMetres: number };
  B03: { impact: { fullMetres: number; zeroMetres: number } };
}).B03.impact;
const shared = (blastersData as unknown as { impact: { fullMetres: number; zeroMetres: number } }).impact;

describe("PT-03: overkill and near", () => {
  it("1. overkill is the killing shot's damage minus the health left, never below 0", () => {
    expect(overkillOf(24, 6)).toBe(18); // one B03 barrel (8 x 3) on an F01
    expect(overkillOf(48, 30)).toBe(18); // both barrels on a fresh F05
    expect(overkillOf(4, 6)).toBe(0); // a short shot is no overkill
  });
  it("2. near is 1 within fullMetres, 0 at zeroMetres, straight between", () => {
    expect(nearOf(2, b03)).toBe(1); // inside 3 m
    expect(nearOf(3, b03)).toBe(1); // at the edge it still counts
    expect(nearOf(12, b03)).toBe(0); // at 12 m it is spent
    expect(nearOf(15, b03)).toBe(0); // and past it stays 0
    expect(nearOf(6, b03)).toBeCloseTo(0.6667, 4); // (12-6)/(12-3)
    // The shared block is there for every other blaster.
    expect(nearOf(2, shared)).toBe(1);
    expect(nearOf(10, shared)).toBe(0);
    expect(nearOf(6, shared)).toBeCloseTo(0.5, 4);
  });
});

describe("PT-03: the three outcomes", () => {
  it("3. the card's F01 case: point blank one barrel is impact 3, a big pop", () => {
    const v = judgeImpact(spec, b03, 24, 6, 6, 2);
    expect(v.overkill).toBe(18);
    expect(v.near).toBe(1);
    expect(v.impact).toBeCloseTo(3, 5);
    expect(v.outcome).toBe("pop");
  });
  it("4. the card's F05 case: point blank both barrels is impact 0.6, a chunk", () => {
    const v = judgeImpact(spec, b03, 48, 30, 30, 2);
    expect(v.overkill).toBe(18);
    expect(v.impact).toBeCloseTo(0.6, 5);
    expect(v.outcome).toBe("chunk");
  });
  it("5. at 15 m the same damage is neither a pop nor a chunk, and the fall is straight", () => {
    const v = judgeImpact(spec, b03, 24, 6, 6, 15);
    expect(v.overkill).toBe(18);
    expect(v.near).toBe(0);
    expect(v.impact).toBe(0);
    expect(v.outcome).toBe("down");
    // The same kill on the way out: pop until 6 m, a chunk at 9, down at 12.
    expect(judgeImpact(spec, b03, 24, 6, 6, 6).impact).toBeCloseTo(2, 5);
    expect(judgeImpact(spec, b03, 24, 6, 6, 6).outcome).toBe("pop");
    expect(judgeImpact(spec, b03, 24, 6, 6, 9).impact).toBeCloseTo(1, 5);
    expect(judgeImpact(spec, b03, 24, 6, 6, 9).outcome).toBe("chunk");
    expect(judgeImpact(spec, b03, 24, 6, 6, 12).outcome).toBe("down");
  });
  it("6. the thresholds: below chunkAt it downs, at chunkAt it chunks, at popAt it pops", () => {
    // A short kill at point blank: overkill 1 on an F01 (1/6, well under
    // chunkAt 0.5), then exactly chunkAt, then exactly popAt (overkill 9/6).
    expect(judgeImpact(spec, b03, 6, 5, 6, 2).impact).toBeCloseTo(0.1667, 4);
    expect(judgeImpact(spec, b03, 6, 5, 6, 2).outcome).toBe("down");
    expect(judgeImpact(spec, b03, 8, 5, 6, 2).impact).toBeCloseTo(0.5, 5);
    expect(judgeImpact(spec, b03, 8, 5, 6, 2).outcome).toBe("chunk");
    expect(judgeImpact(spec, b03, 14, 5, 6, 2).impact).toBeCloseTo(1.5, 5);
    expect(judgeImpact(spec, b03, 14, 5, 6, 2).outcome).toBe("pop");
  });
  it("7. an explosion's kill uses near 1: the same damage as a far shot still pops", () => {
    // range null is the no-blaster case (a blast, or a dart no shot tagged).
    const v = judgeImpact(spec, null, 24, 6, 6, 15);
    expect(v.near).toBe(1);
    expect(v.impact).toBeCloseTo(3, 5);
    expect(v.outcome).toBe("pop");
  });
});

describe("PT-03: the impact grows the kill, to a hard cap", () => {
  it("8. the down's push grows with the impact, from 1 at none to 2 at popAt", () => {
    expect(downPushOf(spec, 0)).toBe(1);
    expect(downPushOf(spec, 0.75)).toBeCloseTo(1.5, 5);
    expect(downPushOf(spec, 1.5)).toBeCloseTo(2, 5);
  });
  it("9. the chunk finish grows from the base hole to the max, at popAt", () => {
    const base = spec.chunk.carveRadius;
    expect(impactChunkRadius(spec, base, 0)).toBe(base);
    expect(impactChunkRadius(spec, base, 1.5)).toBeCloseTo(spec.chunk.chunkGrowMaxMetres, 5);
    expect(impactChunkRadius(spec, base, 9)).toBeCloseTo(spec.chunk.chunkGrowMaxMetres, 5);
    expect(chunkDebrisExtra(spec, 0)).toBe(0);
    expect(chunkDebrisExtra(spec, 1.5)).toBe(spec.chunk.debrisGrowMax);
  });
  it("10. the pop's extra chunks and push are capped at popAt and above", () => {
    const at = popBurstBoost(spec, 1.5);
    const over = popBurstBoost(spec, 9);
    expect(at.extraChunks).toBe(spec.popDebrisMax);
    expect(at.pushShare).toBeCloseTo(1 + spec.popPushShare, 5);
    expect(over.extraChunks).toBe(at.extraChunks); // the cap stays hard
    expect(over.pushShare).toBeCloseTo(at.pushShare, 5);
    expect(popBurstBoost(spec, 0).extraChunks).toBe(0);
    expect(growthOf(spec, 3)).toBe(1);
    expect(growthOf(spec, 0)).toBe(0);
    expect(impactOf(18, 6, 1)).toBeCloseTo(3, 5);
    expect(impactOf(0, 6, 1)).toBe(0);
    expect(impactOf(18, 0, 1)).toBe(0); // no health, no impact
  });
});
