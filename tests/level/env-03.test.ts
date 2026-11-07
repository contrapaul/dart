import { describe, expect, it } from "vitest";
import envThreeJson from "../../data/levels/env-03.json";
import { validateLevel } from "../../src/level/validate";
import { ARENA_LEVELS, chosenLevel } from "../../src/arena/levels";
import blastersJson from "../../data/blasters.json";
import type { Level } from "../../src/level/format";

// ENV-03 stage 2: env-03, the stations' test level. The same room as
// env-01, no columns or crates, three stations. The stations' behaviour
// lives in tests/arena/stations.test.ts; this checks the file itself,
// the way env-01's does.
const level = envThreeJson as unknown as Level;
/** data/blasters.json is flat: the blaster ids are its keys, in `order`. */
const byId = blastersJson as unknown as Record<string, { mods: Record<string, unknown> }>;
const blasterIds = blastersJson.order;

describe("the env-03 test level", () => {
  it("loads as a registered level with no errors", () => {
    expect(ARENA_LEVELS["env-03"]).toBe(level);
    expect(chosenLevel("?level=env-03").level.meta.id).toBe("env-03");
    const report = validateLevel(level);
    expect(report.errors).toEqual([]);
    expect(report.warnings).toEqual([]);
  });

  it("offers one station per blaster that has mods", () => {
    for (const id of blasterIds) expect(Object.keys(byId[id].mods).length).toBeGreaterThan(0);
    const stations = level.stations!;
    expect(stations.map((s) => s.blaster).sort()).toEqual([...blasterIds].sort());
    for (const s of stations)
      expect(Object.keys(byId[s.blaster].mods)).toContain(s.mod);
  });

  it("has no arenas, so the exit works from the first frame", () => {
    expect(level.arenas).toEqual([]);
  });
});
