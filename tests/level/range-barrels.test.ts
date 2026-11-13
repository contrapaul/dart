import { describe, expect, it } from "vitest";
import rangeJson from "../../data/range.json";
import barrelJson from "../../data/barrel.json";

// ENV-05 (E15): the range's two barrels, as the data file places them. The
// page builds them from this list (src/range/main.ts) and the T key puts
// them back with the line, so the data must stay well formed: on the floor,
// inside the range, and not buried in one of the cover boxes.

const R = rangeJson.range;
const half = R.size / 2;

describe("ENV-05 the barrels on the range", () => {
  it("places two barrels", () => {
    expect(R.barrels.positions.length).toBe(2);
  });

  it("each stands on the floor and inside the range walls", () => {
    for (const p of R.barrels.positions) {
      expect(p[1]).toBe(0);
      expect(Math.abs(p[0])).toBeLessThan(half - 4);
      expect(Math.abs(p[2])).toBeLessThan(half - 4);
    }
  });

  it("neither sits inside a cover box", () => {
    const r = barrelJson.look.diameterMetres / 2;
    for (const p of R.barrels.positions) {
      for (const c of R.cover) {
        // The boxes come as centre xyz then size xyz.
        const overlapX = Math.abs(p[0] - c[0]) < c[3] / 2 + r;
        const overlapZ = Math.abs(p[2] - c[2]) < c[5] / 2 + r;
        expect(overlapX && overlapZ).toBe(false);
      }
    }
  });

  it("both are near enough to see at once from the start", () => {
    const s = R.playerSpawn;
    for (const p of R.barrels.positions) {
      expect(Math.hypot(p[0] - s[0], p[2] - s[2])).toBeLessThan(30);
    }
  });
});
