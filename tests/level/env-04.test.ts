import { describe, expect, it } from "vitest";
import envJson from "../../data/levels/env-04.json";
import { validateLevel } from "../../src/level/validate";
import { ARENA_LEVELS } from "../../src/arena/levels";
import type { Level } from "../../src/level/format";

// ENV-04 review: the press tests build their own level, so nothing checked
// that the real test corridor loads. The page refused it (walls and the
// exit pad overlapping), and a pad half the corridor wide could be walked
// round while its head was down.

const level = envJson as unknown as Level;

describe("the env-04 press corridor", () => {
  it("is registered and loads with no errors", () => {
    expect(ARENA_LEVELS["env-04"]).toBe(level);
    expect(validateLevel(level).errors).toEqual([]);
  });

  it("each pad spans the corridor, so the only way on is under a raised head", () => {
    const w = level.shell.find((b) => b.id === "wall-w")!;
    const e = level.shell.find((b) => b.id === "wall-e")!;
    const inside = (e.pos[0] - e.size[0] / 2) - (w.pos[0] + w.size[0] / 2);
    for (const p of level.presses!) expect(p.size[0]).toBeGreaterThanOrEqual(inside - 1e-6);
  });

  it("the presses sit between the start and the exit", () => {
    const start = level.playerStart.pos[2];
    const exit = level.exit.pos[2];
    for (const p of level.presses!) {
      expect(p.pos[2]).toBeLessThan(start);
      expect(p.pos[2] - p.size[1] / 2).toBeGreaterThan(exit + level.exit.size[2] / 2);
    }
  });
});
