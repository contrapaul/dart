import { beforeAll, describe, expect, it } from "vitest";
import RAPIER from "@dimforge/rapier3d-compat";
import type { World } from "@dimforge/rapier3d-compat";
import levelJson from "../../data/levels/1-2.json";
import { buildLevel } from "../../src/level/build";
import { validateLevel } from "../../src/level/validate";
import { makeLevelAI } from "../../src/ai/level";
import { createPhysics } from "../../src/physics/world";
import { greedyMesh, type MeshData } from "../../src/voxel/mesher";
import { linearColorTable } from "../../src/voxel/materials";
import type { Level } from "../../src/level/format";
import { chosenLevel } from "../../src/arena/levels";

// LVL-02b: Level 1-2 beats 1 to 4 (open corridor, parry corridor, the Ring
// arena, breather store) as the arena page loads it with `?level=1-2`. It is
// the first level with two arenas, so on top of the load checks the card asks
// for: both arenas validate in file order, the walk from the start to the
// exit is on floor the whole way, and each arena's trigger can be reached
// without walking through the arena before it.

const level = levelJson as unknown as Level;
const FAKE = {
  mesh(padded: Uint8Array): Promise<MeshData> {
    return Promise.resolve(greedyMesh(padded, linearColorTable()));
  },
};

beforeAll(async () => {
  await RAPIER.init();
});

/** Cast straight down from 4.5 m: is there floor within 6 m? */
function hasFloor(world: World, x: number, z: number) {
  return world.castRay(new RAPIER.Ray({ x, y: 4.5, z }, { x: 0, y: -1, z: 0 }), 6, true) !== null;
}

/** Every point on the walk, sampled every metre. */
function walk(...points: [number, number][]) {
  const out: [number, number][] = [];
  for (let i = 1; i < points.length; i++) {
    const [x0, z0] = points[i - 1]!;
    const [x1, z1] = points[i]!;
    const steps = Math.ceil(Math.hypot(x1 - x0, z1 - z0));
    for (let k = 0; k <= steps; k++) {
      out.push([x0 + ((x1 - x0) * k) / steps, z0 + ((z1 - z0) * k) / steps]);
    }
  }
  return out;
}

describe("Level 1-2 loads (LVL-02b)", () => {
  it("1. validates: two arenas in a reachable order", () => {
    const report = validateLevel(level);
    expect(report.errors).toEqual([]);
    const arenas = level.arenas!;
    expect(arenas.map((a) => a.id)).toEqual(["parry-corridor", "ring"]);
    expect(arenas.map((a) => a.archetype)).toEqual(["A6", "A2"]);
    // Beat 2: one Roamer alone, its own one wave arena.
    expect(arenas[0]!.waves).toHaveLength(1);
    expect(arenas[0]!.waves[0]!.spawns).toEqual([{ foamer: "F02", count: 1 }]);
    // Beat 3: the Ring, two waves of Roamers (4, then 6).
    expect(arenas[1]!.waves.map((w) => w.spawns[0]!.count)).toEqual([4, 6]);
  });

  it("2. has floor under the walk from the start to the exit", async () => {
    const { rapier, world } = await createPhysics();
    buildLevel(level, rapier, world, FAKE);
    world.step();
    const route = walk(
      [-4, 60], // the open service corridor (beat 1)
      [-4, 48], // into the parry corridor
      [-4, 26], // out of it at the far end (beat 2)
      [-4, 18.5], // across the yard into the Ring (beat 3)
      [-4, 0], // round the centre block, west side
      [-10, -12], // to the north exit
      [2, -13], // through the reveal
      [6.5, -16.5], // into the breather store (beat 4)
    );
    for (const [x, z] of route) {
      expect(hasFloor(world, x, z), `floor at ${x}, ${z}`).toBe(true);
    }
    expect(hasFloor(world, level.exit.pos[0], level.exit.pos[2]), "floor under the exit").toBe(true);
  });

  it("3. has floor under every rift, pickup and checkpoint", async () => {
    const { rapier, world } = await createPhysics();
    buildLevel(level, rapier, world, FAKE);
    world.step();
    const spots: [number, number][] = [];
    for (const arena of level.arenas!) {
      for (const rift of arena.rifts) spots.push([rift.pos[0], rift.pos[2]]);
      if (arena.checkpointPos) spots.push([arena.checkpointPos[0], arena.checkpointPos[2]]);
    }
    for (const pickup of level.pickups!) spots.push([pickup.pos[0], pickup.pos[2]]);
    for (const [x, z] of spots) expect(hasFloor(world, x, z), `floor at ${x}, ${z}`).toBe(true);
  });

  it("4. shuts the arena doors until the runner opens them", async () => {
    const { rapier, world } = await createPhysics();
    const built = buildLevel(level, rapier, world, FAKE);
    world.step();
    // The parry corridor's exit, then the Ring's north exit, both block.
    for (const [id, from, dist] of [
      ["parry-out", [-4, 1.75, 24], 3] as const,
      ["ring-out", [3, 1.75, -11], 3] as const,
    ]) {
      const dir = from[2] < 0 ? [0, 0, -1] : [0, 0, 1];
      const ray = new RAPIER.Ray({ x: from[0], y: from[1], z: from[2] }, { x: dir[0], y: dir[1], z: dir[2] });
      const hit = world.castRay(ray, dist + 2, true);
      expect(hit, `${id} blocks`).toBeTruthy();
      expect(hit!.timeOfImpact).toBeLessThan(dist);
      built.doors.get(id)!.setState("open");
      world.step();
      const clear = world.castRay(ray, dist + 2, true);
      expect(clear === null || clear.timeOfImpact > dist).toBe(true);
    }
  });

  it("5. each arena's trigger is reachable on the nav grid", async () => {
    const { rapier, world } = await createPhysics();
    const built = buildLevel(level, rapier, world, FAKE);
    const ai = makeLevelAI(rapier, world, built.navBounds, "normal");
    // The parry trigger from the player start, and the Ring's from outside.
    expect(ai.grid.walkableAt(0, -4, 40), "the parry trigger").toBe(true);
    expect(ai.grid.walkableAt(0, -4, 10), "the Ring trigger").toBe(true);
    expect(ai.grid.walkableAt(0, level.exit.pos[0], level.exit.pos[2]), "the store").toBe(true);
  });

  it("6. the level choice plays 1-2 by name", () => {
    expect(chosenLevel("?level=1-2").level.meta.id).toBe("1-2");
    expect(chosenLevel("?level=1-2").unknownLevel).toBe(null);
    expect(chosenLevel("").level.meta.id).toBe("1-1");
  });
});
