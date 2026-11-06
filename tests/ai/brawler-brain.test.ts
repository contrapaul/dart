import { describe, expect, it } from "vitest";
import foamerData from "../../data/foamers.json";
import { decideLeap, leapOf, type LeapInput } from "../../src/foamers/leap";

const LEAP = leapOf(foamerData.types.F07 as never)!;

function input(over: Partial<LeapInput> = {}): LeapInput {
  return { distance: 8, cooldownLeft: 0, onFeet: true, ...over };
}

describe("the F07 leap decision (GAME-10f stage 2)", () => {
  it("1. only the F07 has leap numbers, and they are the data's", () => {
    expect(LEAP).toEqual(foamerData.types.F07.leap as never);
    for (const [id, spec] of Object.entries(foamerData.types)) {
      expect(leapOf(spec as never), `${id} leaps only if the data says so`).toBe(
        id === "F07" ? foamerData.types.F07.leap : null,
      );
    }
  });

  it("2. it leaps only between the minimum and the maximum", () => {
    expect(decideLeap(input({ distance: LEAP.minMetres }), LEAP), "at the minimum").toBe(true);
    expect(decideLeap(input({ distance: LEAP.maxMetres }), LEAP), "at the maximum").toBe(true);
    expect(decideLeap(input({ distance: LEAP.minMetres - 0.1 }), LEAP), "too close").toBe(false);
    expect(decideLeap(input({ distance: LEAP.maxMetres + 0.1 }), LEAP), "too far").toBe(false);
  });

  it("3. the cooldown and the legs hold it back", () => {
    expect(decideLeap(input({ cooldownLeft: 0.01 }), LEAP), "still cooling down").toBe(false);
    expect(decideLeap(input({ cooldownLeft: 0 }), LEAP), "spent").toBe(true);
    expect(decideLeap(input({ onFeet: false }), LEAP), "no legs: it crawls").toBe(false);
  });
});
