import { describe, expect, it } from "vitest";
import type { Level, Prop } from "../../src/level/format";
import { LEAKING_BARREL, PROP_KINDS, leakingBarrels, levelPropPrims, propPrims, propSolid } from "../../src/level/props";
import { validateLevel } from "../../src/level/validate";
import ed01 from "../fixtures/levels/ed-01.json";

// Props: barrels, crates, rubble and tanks, built as prims (data/props.json)
// and the Range's leaking barrel, run by its own system.

const prop = (kind: string, extra: Partial<Prop> = {}): Prop => ({ id: "p1", kind, pos: [2, 0, -3], ...extra });

describe("props", () => {
  it("every kind is a valid set of prims standing on the floor", () => {
    for (const kind of Object.keys(PROP_KINDS)) {
      if (kind === LEAKING_BARREL) continue;
      const prims = propPrims(prop(kind));
      expect(prims.length, kind).toBeGreaterThan(0);
      for (const p of prims) {
        expect(p.size.every((n) => n > 0), `${kind} size`).toBe(true);
        expect(p.colour, `${kind} colour`).toMatch(/^#[0-9a-f]{6}$/);
        expect(p.pos[1], `${kind} above the floor`).toBeGreaterThan(-0.01);
      }
    }
  });

  it("a turned prop moves its parts round its foot", () => {
    const [straight] = propPrims(prop("tank"));
    const pipe = propPrims(prop("tank", { rotY: 90 }))[4]!;
    const unturned = propPrims(prop("tank"))[4]!;
    expect(straight!.pos).toEqual([2, 0.075, -3]);
    // The pipe stub sits +0.85 m along x; a quarter turn puts it along -z.
    expect(unturned.pos[0]).toBeCloseTo(2.85, 5);
    expect(pipe.pos[0]).toBeCloseTo(2, 5);
    expect(pipe.pos[2]).toBeCloseTo(-3.85, 5);
  });

  it("solid follows the tick box, else the kind", () => {
    expect(propSolid(prop("crate"))).toBe(true);
    expect(propSolid(prop("rubble"))).toBe(false);
    expect(propSolid(prop("crate", { solid: false }))).toBe(false);
    expect(propPrims(prop("rubble"))[0]!.behaviour).toBe("decor");
    expect(propSolid(prop(LEAKING_BARREL, { solid: false }))).toBe(true);
  });

  it("the leaking barrel is run by the barrel system, not built as prims", () => {
    const level = { props: [prop(LEAKING_BARREL), { ...prop("crate"), id: "p2" }] } as Level;
    expect(levelPropPrims(level).every((p) => p.id.startsWith("p2#"))).toBe(true);
    expect(leakingBarrels(level)).toEqual([{ pos: [2, 0, -3] }]);
  });

  it("the validator takes props and refuses an unknown kind", () => {
    const base = ed01 as unknown as Level;
    const ok = validateLevel({ ...base, props: [prop("crate"), { ...prop(LEAKING_BARREL), id: "p2" }] });
    expect(ok.errors).toEqual([]);
    const bad = validateLevel({ ...base, props: [prop("piano")] });
    expect(bad.errors.some((e) => e.includes("unknown kind piano"))).toBe(true);
  });
});
