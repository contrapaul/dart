import { beforeAll, describe, expect, it } from "vitest";
import RAPIER from "@dimforge/rapier3d-compat";
import pitJson from "../../data/levels/1-1-pit.json";
import level12 from "../../data/levels/1-2.json";
import level13 from "../../data/levels/1-3.json";
import level14 from "../../data/levels/1-4.json";
import { buildLevel } from "../../src/level/build";
import { validateLevel } from "../../src/level/validate";
import { createPhysics } from "../../src/physics/world";
import { greedyMesh, type MeshData } from "../../src/voxel/mesher";
import { linearColorTable } from "../../src/voxel/materials";
import type { Level, Pickup } from "../../src/level/format";
import pickupData from "../../data/pickups.json";

// HP-01: the health packs placed in levels 1-2, 1-3 and 1-4. The positions
// are start values Paul will move, so these tests check the rules the card
// gives rather than the exact spots: two or three packs per level, on the
// floor, outside every arena (a pack inside a locked arena cannot be
// reached), and never in 1-4's breather 2 (the LVL-04b rule that room keeps
// its own test). The Pit (1-1) has none.

const P = pickupData.healthPack;
const FAKE = {
  mesh(padded: Uint8Array): Promise<MeshData> {
    return Promise.resolve(greedyMesh(padded, linearColorTable()));
  },
};

const LEVELS: [string, Level][] = [
  ["1-2", level12 as unknown as Level],
  ["1-3", level13 as unknown as Level],
  ["1-4", level14 as unknown as Level],
];

function packs(level: Level): Pickup[] {
  return (level.pickups ?? []).filter((p) => p.type === "health");
}

/** Is the point inside an arena's trigger box (with a metre of margin)? */
function inArena(level: Level, x: number, y: number, z: number): string | null {
  for (const arena of level.arenas ?? []) {
    const t = arena.trigger;
    const m = 1;
    if (
      Math.abs(x - t.pos[0]) <= t.size[0] / 2 + m
      && Math.abs(y - t.pos[1]) <= t.size[1] / 2 + m
      && Math.abs(z - t.pos[2]) <= t.size[2] / 2 + m
    ) return arena.id;
  }
  return null;
}

beforeAll(async () => {
  await RAPIER.init();
});

describe("HP-01: where the health packs sit", () => {
  it("the Pit has none", () => {
    // 1-1-pit.json is the one level the card says gets no packs.
    expect(packs(pitJson as unknown as Level)).toEqual([]);
  });

  it.each(LEVELS)("%s places two or three packs of the data size", (id, level) => {
    const list = packs(level);
    expect(list.length, id).toBeGreaterThanOrEqual(2);
    expect(list.length, id).toBeLessThanOrEqual(3);
    for (const p of list) {
      expect(p.amount, `${id} ${p.id}`).toBe(25);
      expect(p.id, `${id} ${p.id}`).toMatch(/health/);
    }
    expect(P.size).toBeGreaterThan(0);
  });

  it.each(LEVELS)("%s has floor under every pack, and no pack in an arena", async (id, level) => {
    const { rapier, world } = await createPhysics();
    const built = buildLevel(level, rapier, world, FAKE);
    // Voxel colliders arrive from the mesher as promises; wait, or the ray
    // finds no floor at all.
    for (let i = 0; i < 200 && built.voxelMesh.busy; i++) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    world.step();
    for (const p of packs(level)) {
      const [x, y, z] = p.pos;
      // From just above the pack's own spot, so a pack on a lower floor is
      // checked against that floor and not the one above it.
      const hit = world.castRay(new RAPIER.Ray({ x, y: y + 1, z }, { x: 0, y: -1, z: 0 }), 2.5, true);
      expect(hit, `${id} ${p.id} has floor`).toBeTruthy();
      // The floor is right under the pack, not a storey below: the ray from
      // y + 1 meets it within 0.6 m of the pack's own y.
      expect(hit!.timeOfImpact, `${id} ${p.id} sits on its floor`).toBeLessThan(1.6);
      expect(inArena(level, x, y, z), `${id} ${p.id} is outside every arena`).toBe(null);
    }
  });

  it("1-4 keeps its breather 2 free of every pickup", () => {
    const level = level14 as unknown as Level;
    const near = (level.pickups ?? []).filter((p) => p.pos[2] > -211 && p.pos[2] < -202);
    expect(near).toEqual([]);
  });

  it("every file still validates", () => {
    for (const [id, level] of LEVELS) {
      expect(validateLevel(level).errors, id).toEqual([]);
    }
  });
});
