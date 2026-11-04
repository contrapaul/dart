import { describe, expect, it } from "vitest";
import foamerData from "../../data/foamers.json";
import { damageOf } from "../../src/game/attack";

type Attacks = { attacks: { id: string; damage: number }[] };

describe("damageOf", () => {
  // Found in the GAME-10a review: the damage map was keyed by attack id
  // alone, so the F02's own "bonk" (10) replaced the F01's (12) for every
  // Foamer. A bonk costs what the Foamer that made it says.
  it("reads the attacking Foamer's own attack, so two types can share an id", () => {
    const f01 = foamerData.test as unknown as Attacks;
    const f02 = { attacks: [...(foamerData.types.F02 as unknown as Attacks).attacks] };
    expect(damageOf("bonk", f01)).toBe(f01.attacks.find((a) => a.id === "bonk")!.damage);
    expect(damageOf("bonk", f02)).toBe(f02.attacks.find((a) => a.id === "bonk")!.damage);
    expect(damageOf("bonk", f01)).not.toBe(damageOf("bonk", f02));
  });

  it("falls back to the base spec when no Foamer is given", () => {
    const f01 = foamerData.test as unknown as Attacks;
    expect(damageOf("bonk")).toBe(f01.attacks.find((a) => a.id === "bonk")!.damage);
  });
});
