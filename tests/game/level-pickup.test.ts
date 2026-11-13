import { beforeAll, describe, expect, it } from "vitest";
import RAPIER from "@dimforge/rapier3d-compat";
import { ARENA_LEVELS } from "../../src/arena/levels";
import { CAMPAIGN_ORDER, foundAt } from "../../src/game/campaign";
import { validateLevel } from "../../src/level/validate";
import { buildLevel } from "../../src/level/build";
import { createPhysics } from "../../src/physics/world";
import { greedyMesh, type MeshData } from "../../src/voxel/mesher";
import { linearColorTable } from "../../src/voxel/materials";
import type { Level } from "../../src/level/format";

// LVL-05 stage 1: every level in the campaign's order places the blaster
// the campaign says it gives, once, close enough to the start to be seen on
// the way in, and over floor. The positions are start values Paul will move.

const level = (id: string): Level => ARENA_LEVELS[id]!;
const FAKE = {
  mesh(padded: Uint8Array): Promise<MeshData> {
    return Promise.resolve(greedyMesh(padded, linearColorTable()));
  },
};

beforeAll(async () => {
  await RAPIER.init();
});

describe("each Act 1 level places its blaster pickup (LVL-05)", () => {
  it("one blaster pickup per level, and it is the one data/campaign.json gives", () => {
    for (const id of CAMPAIGN_ORDER) {
      const given = (level(id).pickups ?? []).filter((p) => p.type === "blaster");
      expect(given, id).toHaveLength(1);
      expect(given[0]!.blaster, id).toBe(foundAt(id));
      expect(given[0]!.pos, id).toHaveLength(3);
      // It is not an ammo box: no dart count.
      expect(given[0]!.count, id).toBeUndefined();
      expect(validateLevel(level(id)).errors, id).toEqual([]);
    }
  });

  it("each one stands within 6 m of its level's start, on the way in", () => {
    for (const id of CAMPAIGN_ORDER) {
      const lv = level(id);
      const p = lv.pickups!.find((q) => q.type === "blaster")!;
      const s = lv.playerStart.pos;
      const d = Math.hypot(p.pos[0] - s[0], p.pos[1] - s[1], p.pos[2] - s[2]);
      expect(d, `${id}: ${d.toFixed(1)} m from the start`).toBeLessThan(6);
      // And on the start's own floor level (a step of 0.5 m at most).
      expect(Math.abs(p.pos[1] - s[1]), id).toBeLessThan(0.5);
    }
  });

  it("each one rests on floor, not in the air or inside a wall", async () => {
    for (const id of CAMPAIGN_ORDER) {
      const lv = level(id);
      const p = lv.pickups!.find((q) => q.type === "blaster")!;
      const { rapier, world } = await createPhysics();
      const built = buildLevel(lv, rapier, world, FAKE);
      for (let i = 0; i < 200 && built.voxelMesh.busy; i++) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
      world.step();
      const hit = world.castRay(
        new RAPIER.Ray({ x: p.pos[0], y: p.pos[1] + 1, z: p.pos[2] }, { x: 0, y: -1, z: 0 }),
        1.5, true,
      );
      expect(hit, `${id}: floor under the pickup`).toBeTruthy();
      // The pickup's own ball starts just above the floor, so the ray lands
      // within 0.2 m of it rather than on a slab far below.
      expect(hit!.timeOfImpact, `${id}: floor right under it`).toBeLessThan(1.2);
    }
  }, 60000);

  it("no other level places a blaster pickup", () => {
    for (const [name, lv] of Object.entries(ARENA_LEVELS)) {
      if (CAMPAIGN_ORDER.includes(name)) continue;
      expect((lv.pickups ?? []).filter((p) => p.type === "blaster"), name).toEqual([]);
    }
  });

  it("a blaster pickup with no id is a validation error", () => {
    const broken = {
      ...level("1-1-pit"),
      pickups: [{ id: "bad", type: "blaster", pos: [0, 0, 0] }],
    } as unknown as Level;
    expect(validateLevel(broken).errors.join(" ")).toContain("is not a blaster");
  });
});
