import { beforeAll, describe, expect, it } from "vitest";
import RAPIER from "@dimforge/rapier3d-compat";
import ringJson from "../../data/levels/1-4-ring.json";
import { buildLevel } from "../../src/level/build";
import { validateLevel } from "../../src/level/validate";
import { makeLevelAI } from "../../src/ai/level";
import { makePath } from "../../src/ai/nav-grid";
import { createPhysics } from "../../src/physics/world";
import { greedyMesh, type MeshData } from "../../src/voxel/mesher";
import { linearColorTable } from "../../src/voxel/materials";
import type { Level } from "../../src/level/format";
import { ARENA_LEVELS, chosenLevel } from "../../src/arena/levels";

// GAME-10b: the Ring (the KIT A2 Ring) as the arena page loads it with
// `?level=1-4-ring`. Clean validation, floor under the start and the exit,
// the shut exit door blocking, a nav bake over the ring corridor, and the
// level choice falling back to the Pit for an unknown name.

const ring = ringJson as unknown as Level;
const FAKE = {
  mesh(padded: Uint8Array): Promise<MeshData> {
    return Promise.resolve(greedyMesh(padded, linearColorTable()));
  },
};

beforeAll(async () => {
  await RAPIER.init();
});

describe("the Ring loads (GAME-10b)", () => {
  it("1. validates with no errors, and is one 30 m A2 ring with a wave of 2 F05", () => {
    const report = validateLevel(ring);
    expect(report.errors).toEqual([]);
    const arena = ring.arenas![0]!;
    expect(arena.archetype).toBe("A2");
    const spawns = arena.waves.flatMap((w) => w.spawns);
    expect(spawns).toEqual([{ foamer: "F05", count: 2 }]);
    const floor = ring.shell.find((b) => b.id === "ring-floor")!;
    expect(floor.size[0]).toBe(30);
    expect(floor.size[2]).toBeGreaterThan(28);
  });

  it("2. has floor under the player start and under the exit pad", async () => {
    const { rapier, world } = await createPhysics();
    buildLevel(ring, rapier, world, FAKE);
    world.step();
    const start = world.castRay(new RAPIER.Ray(
      { x: ring.playerStart.pos[0], y: 4.5, z: ring.playerStart.pos[2] }, { x: 0, y: -1, z: 0 },
    ), 6, true);
    expect(start).toBeTruthy();
    const exit = world.castRay(new RAPIER.Ray(
      { x: ring.exit.pos[0], y: 4.5, z: ring.exit.pos[2] }, { x: 0, y: -1, z: 0 },
    ), 6, true);
    expect(exit).toBeTruthy();
  });

  it("3. shuts the exit until the arena opens it", async () => {
    const { rapier, world } = await createPhysics();
    const built = buildLevel(ring, rapier, world, FAKE);
    world.step();
    const ray = new RAPIER.Ray({ x: 6, y: 2, z: 10 }, { x: 0, y: 0, z: 1 });
    const hit = world.castRay(ray, 10, true);
    expect(hit).toBeTruthy();
    expect(hit!.timeOfImpact).toBeLessThan(5);
    built.doors.get("ring-out")!.setState("open");
    world.step();
    const hit2 = world.castRay(ray, 10, true);
    expect(hit2 === null || hit2.timeOfImpact > 5).toBe(true);
  });

  it("4. bakes the ring corridor: a Foamer paths round the centre block", async () => {
    const { rapier, world } = await createPhysics();
    const built = buildLevel(ring, rapier, world, FAKE);
    const ai = makeLevelAI(rapier, world, built.navBounds, "normal");
    const path = makePath();
    // From the west rift, round the block, to the far side of the ring.
    const n = ai.grid.findPath({ x: -11, z: -6 }, { x: 11, z: 11 }, path);
    expect(n).toBeGreaterThan(0);
    expect(ai.grid.walkableAt(0, -12), "the ring corridor is walkable").toBe(true);
    // The centre block's top is walkable ground (an agent could stand on it),
    // but nothing walks up 3.5 m: the path round it is longer than the
    // straight line between the two points.
    let length = 0;
    for (let i = 1; i < n; i++) {
      length += Math.hypot(path.xs[i]! - path.xs[i - 1]!, path.zs[i]! - path.zs[i - 1]!);
    }
    const straight = Math.hypot(11 - -11, 11 - -6);
    expect(length).toBeGreaterThan(straight * 1.05);
  });

  it("5. the level choice plays the Ring by name and the Pit otherwise", () => {
    // LVL-04a adds 1-4, the Darter's level up to the bridge. The Ring's test
    // file still keeps its own id, a 90 s test space.
    // ENV-01 adds env-01, the cladding test room. ENV-02 adds env-02, the
    // button test level. ENV-03 adds env-03, the stations test room. ENV-04
    // adds env-04, the crushing toy press test corridor. GAME-10m adds
    // env-05, the ambush test room. ED-01 adds ed-01, the editor's parts
    // test level.
    expect(Object.keys(ARENA_LEVELS).sort()).toEqual(["1-1-pit", "1-2", "1-3", "1-4", "1-4-ring", "ed-01", "env-01", "env-02", "env-03", "env-04", "env-05"]);
    expect(chosenLevel("?level=1-4-ring").level.meta.id).toBe("1-4");
    expect(chosenLevel("").level.meta.id).toBe("1-1");
    expect(chosenLevel("?level=9-9-nope").level.meta.id).toBe("1-1");
    expect(chosenLevel("?level=9-9-nope").unknownLevel).toBe("9-9-nope");
  });
});
