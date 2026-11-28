// R3-14: the fields a blaster has, as data (the pure half of the Tune panel).
import { afterEach, describe, expect, it } from "vitest";
import {
  FIELDS, committedValue, fieldsFor, isChanged, patchFor, valueInForce,
} from "../../src/range/blaster-fields";
import { tuneBlaster, resetTuning, setLocalTuningForTest } from "../../src/core/tuning";

afterEach(() => setLocalTuningForTest({ version: 1, foamers: {}, blasters: {} }));

describe("R3-14 fields", () => {
  it("lists the Fire, Ammo and Movement fields, in order, with min/max/step", () => {
    expect(fieldsFor("B01")).toEqual(FIELDS);
    const groups = [...new Set(FIELDS.map((f) => f.group))];
    expect(groups).toEqual(["Fire", "Ammo", "Movement"]);
    for (const f of FIELDS) {
      expect(f.min).toBeLessThanOrEqual(f.max);
      expect(f.step).toBeGreaterThan(0);
      expect(f.path.length).toBeGreaterThan(0);
      expect(f.label.length).toBeGreaterThan(0);
    }
  });

  it("there is no per-blaster damage field (damage lives in data/darts.json)", () => {
    expect(FIELDS.some((f) => f.path.join(".").toLowerCase().includes("damage"))).toBe(false);
  });

  it("the in-force value matches the resolved spec for the base blaster", () => {
    const b01 = FIELDS.find((f) => f.key === "magSize")!;
    expect(valueInForce("B01", b01)).toBe(8);
  });

  it("a tuned field shows its override as changed, and the reset target is the committed value", () => {
    const b01 = FIELDS.find((f) => f.key === "magSize")!;
    const base = committedValue("B01", b01);
    expect(isChanged("B01", b01)).toBe(false);
    tuneBlaster("B01", patchFor(b01, base + 4));
    expect(isChanged("B01", b01)).toBe(true);
    expect(valueInForce("B01", b01)).toBe(base + 4);
    tuneBlaster("B01", patchFor(b01, base));
    expect(isChanged("B01", b01)).toBe(false);
  });

  it("a nested recoil field patches and reads through the nested path", () => {
    const recoil = FIELDS.find((f) => f.key === "recoilSpreadPerShot")!;
    tuneBlaster("B01", patchFor(recoil, 4));
    expect(valueInForce("B01", recoil)).toBe(4);
    expect(isChanged("B01", recoil)).toBe(true);
    resetTuning();
    expect(isChanged("B01", recoil)).toBe(false);
  });

  it("a nested patchFor builds the nested object, not a flat key", () => {
    const recoil = FIELDS.find((f) => f.key === "recoilSpreadPerShot")!;
    expect(patchFor(recoil, 3)).toEqual({ recoil: { spreadPerShot: 3 } });
  });
});
