import { beforeAll, describe, expect, it } from "vitest";
import RAPIER from "@dimforge/rapier3d-compat";
import pitJson from "../../data/levels/1-1-pit.json";
import { buildLevel } from "../../src/level/build";
import { validateLevel } from "../../src/level/validate";
import { makeLevelAI } from "../../src/ai/level";
import { makePath } from "../../src/ai/nav-grid";
import { createPhysics } from "../../src/physics/world";
import { greedyMesh, type MeshData } from "../../src/voxel/mesher";
import { linearColorTable } from "../../src/voxel/materials";
import type { Level } from "../../src/level/format";

// The Pit as the arena page loads it: clean validation, a shell that holds
// the player, a shut exit door that really blocks, and a nav bake over the
// whole level (the page pays that cost once, at load).

const pit = pitJson as unknown as Level;
const FAKE = {
  mesh(padded: Uint8Array): Promise<MeshData> {
    return Promise.resolve(greedyMesh(padded, linearColorTable()));
  },
};

beforeAll(async () => {
  await RAPIER.init();
});

describe("the Pit loads", () => {
  it("validates with no errors and only the KIT warning", () => {
    const report = validateLevel(pit);
    expect(report.errors).toEqual([]);
    expect(report.warnings.length).toBe(1);
  });

  it("has floor under the player start and under the exit pad", async () => {
    const { rapier, world } = await createPhysics();
    buildLevel(pit, rapier, world, FAKE);
    world.step();
    const start = world.castRay(new RAPIER.Ray(
      { x: 0, y: 4.5, z: -29 }, { x: 0, y: -1, z: 0 },
    ), 5, true);
    expect(start).toBeTruthy();
    const exit = world.castRay(new RAPIER.Ray(
      { x: 0, y: 4.5, z: 17 }, { x: 0, y: -1, z: 0 },
    ), 5, true);
    expect(exit).toBeTruthy();
  });

  it("shuts the exit until the arena opens it", async () => {
    const { rapier, world } = await createPhysics();
    const built = buildLevel(pit, rapier, world, FAKE);
    world.step();
    // A shot from the ring to the exit room meets the door.
    const ray = new RAPIER.Ray({ x: 0, y: 5, z: 10 }, { x: 0, y: 0, z: 1 });
    const hit = world.castRay(ray, 10, true);
    expect(hit).toBeTruthy();
    expect(hit!.timeOfImpact).toBeLessThan(4);
    built.doors.get("pit-out")!.setState("open");
    // Rapier applies a collider's enabled flag on the next step, so the
    // page's open door takes effect on the step after the runner opens it.
    world.step();
    const hit2 = world.castRay(ray, 10, true);
    expect(hit2 === null || hit2.timeOfImpact > 4).toBe(true);
  });

  it("bakes the whole Pit's nav grid", async () => {
    const { rapier, world } = await createPhysics();
    const built = buildLevel(pit, rapier, world, FAKE);
    const t0 = performance.now();
    const ai = makeLevelAI(rapier, world, built.navBounds, "normal");
    const ms = performance.now() - t0;
    // The page pays this once at load; keep it well under a second so the
    // pit's tile does not stall the first frame.
    expect(ms).toBeLessThan(1000);
    // A Foamer can path along the corridor from the ring to the start room.
    const path = makePath();
    const n = ai.grid.findPath({ x: 0, z: -9 }, { x: 0, z: -29 }, path);
    expect(n).toBeGreaterThan(0);
    // The exit room floor is inside the bake, and the ramps are walkable.
    expect(ai.grid.walkableAt(0, 17)).toBe(true);
    expect(ai.grid.walkableAt(13, 5)).toBe(true);
  });
});
