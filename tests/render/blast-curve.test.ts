import { describe, expect, it } from "vitest";
import { sampleCurve, type CurveSample } from "../../src/render/blast-curve";
import fxJson from "../../data/explosion.json";

const FX = fxJson.fx;
const out: CurveSample = { scale: 0, opacity: 0 };

describe("sampleCurve", () => {
  it("starts small and visible, and ends invisible at its duration", () => {
    const flash = sampleCurve(FX.flash, 0, 2, out);
    expect(flash.scale).toBe(2 * FX.flash.scaleStart);
    expect(flash.scale).toBeLessThan(2);
    expect(flash.opacity).toBe(FX.flash.opacityStart);
    expect(flash.opacity).toBeGreaterThan(0);

    const ended = sampleCurve(FX.flash, FX.flash.durationSeconds, 2, out);
    expect(ended.opacity).toBe(0);
    expect(ended.scale).toBe(2 * FX.flash.scaleEnd);

    const puff = sampleCurve(FX.puff, 0, 2, out);
    expect(puff.scale).toBe(2 * FX.puff.scaleStart);
    expect(puff.opacity).toBeGreaterThan(0);
    expect(sampleCurve(FX.puff, FX.puff.durationSeconds, 2, out).opacity).toBe(0);
  });

  it("a bigger radius gives a bigger scale at the same age", () => {
    const small = sampleCurve(FX.flash, 0.06, 1, out).scale;
    const big = sampleCurve(FX.flash, 0.06, 4, out).scale;
    expect(big).toBeCloseTo(small * 4);
    expect(big).toBeGreaterThan(small);
  });

  it("fades and grows through the layer's life", () => {
    const d = FX.flash.durationSeconds;
    const aScale = sampleCurve(FX.flash, d * 0.3, 2, out).scale;
    const aOpacity = sampleCurve(FX.flash, d * 0.3, 2, out).opacity;
    const bScale = sampleCurve(FX.flash, d * 0.8, 2, out).scale;
    const bOpacity = sampleCurve(FX.flash, d * 0.8, 2, out).opacity;
    expect(bScale).toBeGreaterThan(aScale);
    expect(bOpacity).toBeLessThan(aOpacity);
    expect(bOpacity).toBeGreaterThan(0);
  });
});
