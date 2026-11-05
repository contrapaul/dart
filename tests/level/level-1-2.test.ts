import { beforeAll, describe, expect, it } from "vitest";
import RAPIER from "@dimforge/rapier3d-compat";
import type { World } from "@dimforge/rapier3d-compat";
import levelJson from "../../data/levels/1-2.json";
import { buildLevel } from "../../src/level/build";
import { validateLevel } from "../../src/level/validate";
import { makeLevelAI } from "../../src/ai/level";
import { makePath } from "../../src/ai/nav-grid";
import { LevelRunner, type LevelEvents } from "../../src/level/level-runner";
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
    expect(arenas.map((a) => a.id)).toEqual(["parry-corridor", "ring", "crossroads", "gauntlet"]);
    expect(arenas.map((a) => a.archetype)).toEqual(["A6", "A2", "A7", "A3"]);
    // Beat 2: one Roamer alone, its own one wave arena.
    expect(arenas[0]!.waves).toHaveLength(1);
    expect(arenas[0]!.waves[0]!.spawns).toEqual([{ foamer: "F02", count: 1 }]);
    // Beat 3: the Ring, two waves of Roamers (4, then 6).
    expect(arenas[1]!.waves.map((w) => w.spawns[0]!.count)).toEqual([4, 6]);
    // Beat 6: the Crossroads (LVL-02c), 6 from three spokes, then 7 plus a
    // Slowmer from the pillar's floor seam.
    expect(arenas[2]!.waves.map((w) => w.spawns.reduce((n, s) => n + s.count, 0))).toEqual([6, 8]);
    expect(arenas[2]!.waves[1]!.spawns.map((s) => s.foamer)).toEqual(["F02", "F01"]);
    // Beat 8: the Gauntlet bowl (LVL-02c), 8 Roamers from two upper rifts,
    // then 10 with the floor rift in the bottom tier's centre.
    expect(arenas[3]!.waves.map((w) => w.spawns[0]!.count)).toEqual([8, 10]);
    expect(arenas[3]!.waves[1]!.rifts).toContain("bowl-r3");
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
      [5, -21], // out of the store, north (LVL-02c)
      [5, -33], // up the connecting corridor past the tower bay (beat 5 gap)
      [4, -38], // round the end of the connector wall into the tower bay
      [-6, -40], // across the empty bay (the beat 5 gap)
      [-6, -44], // through the bend into the south spoke
      [-6, -50], // into the Crossroads hub (beat 6)
      [-6, -64], // through the hub and the north spoke's gate line
      [-6, -72], // up the north spoke
      [-6, -78], // breather 2 (beat 7)
      [-6, -84], // into the bowl (beat 8)
      [-4.5, -95], // across the bottom tier past the centre rift
      [-4, -107], // under the far tier to the exit door
      [-4, -110], // through the lit door (beat 9)
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
    // The parry corridor's exit, the Ring's north exit, and the bowl's far
    // door, all block.
    for (const [id, from, dist] of [
      ["parry-out", [-4, 1.75, 24], 3] as const,
      ["ring-out", [3, 1.75, -11], 3] as const,
      ["bowl-out", [-4, 1.75, -106.5], 3] as const,
    ]) {
      const dir = id === "bowl-out" || from[2] < 0 ? [0, 0, -1] : [0, 0, 1];
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
    const g = ai.grid;
    // The parry trigger from the player start, and the Ring's from outside.
    expect(g.walkableAt(-4, 40), "the parry trigger").toBe(true);
    expect(g.walkableAt(-4, 10), "the Ring trigger").toBe(true);
    // LVL-02c: the Crossroads hub trigger and the bowl's, and the new exit.
    expect(g.walkableAt(-6, -53.5), "the Crossroads trigger").toBe(true);
    expect(g.walkableAt(-4.5, -88), "the Gauntlet trigger").toBe(true);
    expect(g.walkableAt(level.exit.pos[0], level.exit.pos[2]), "the exit").toBe(true);
    // The player can walk the whole way from the start to the new exit.
    const path = makePath();
    expect(g.findPath({ x: -4, z: 60 }, { x: -4, z: -110 }, path), "start to exit").toBeGreaterThan(1);
  });

  it("6. the bowl's tiers are walkable up the ramps on the nav grid", async () => {
    const { rapier, world } = await createPhysics();
    const built = buildLevel(level, rapier, world, FAKE);
    const ai = makeLevelAI(rapier, world, built.navBounds, "normal");
    const g = ai.grid;
    // Tier 1 along both walls at 1.2 m, tier 2 at 2.4 m with the rifts.
    expect(g.walkableAt(-18, -95, 1.2), "tier 1 west").toBe(true);
    expect(g.walkableAt(9, -95, 1.2), "tier 1 east").toBe(true);
    expect(g.walkableAt(-10, -106, 2.4), "tier 2 over rift 1").toBe(true);
    expect(g.walkableAt(2, -106, 2.4), "tier 2 over rift 2").toBe(true);
    expect(g.walkableAt(-4.5, -95, 0), "the bottom tier's centre").toBe(true);
    // A Foamer at a rift can be reached from the bottom, and a Foamer on
    // tier 2 can walk down to the player: both ramps carry the nav grid.
    const path = makePath();
    expect(g.findPath({ x: -4.5, z: -88 }, { x: -10, z: -106 }, path, 0, 2.4), "up to rift 1").toBeGreaterThan(1);
    expect(g.findPath({ x: 2, z: -106 }, { x: -4.5, z: -95 }, path, 2.4, 0), "down from rift 2").toBeGreaterThan(1);
  });

  it("7. the exit pad does nothing until the last arena clears", () => {
    // The pad itself is the page's box test (src/arena/extras.ts); what the
    // level file drives is the runner's `complete` phase, and it must wait
    // for the Gauntlet, the fourth arena.
    const events: LevelEvents = {
      setDoor() {}, spawn() { return true; }, onLocked() {}, onWaveStart() {}, onCleared() {},
      onArenaStart() {}, onLevelCleared() {},
    };
    const runner = new LevelRunner(level.arenas!, events);
    const DT = 1 / 60;
    // Steps at `pos` until the runner stops being in that arena, with two
    // minutes of game time to fail after (waves stagger, so it is slow).
    const clear = (pos: [number, number, number]) => {
      const from = runner.state.arenaIndex;
      for (let i = 0; i < 120 / DT; i++) {
        runner.update(DT, { playerPos: pos, aliveCount: 0 });
        if (runner.state.arenaIndex !== from || runner.state.phase === "complete") return;
      }
      throw new Error(`arena ${from} did not clear`);
    };
    for (const [x, z] of [[-4, 40], [-4, 10], [-6, -53.5]] as [number, number][]) {
      clear([x, 0, z]); // lock, spawn, and clear with nothing alive
      expect(runner.state.phase).not.toBe("complete");
    }
    // Three arenas down: the pad still does nothing.
    expect(runner.state.arenasCleared).toBe(3);
    expect(runner.state.phase).not.toBe("complete");
    clear([-4.5, 0, -88]);
    expect(runner.state.phase).toBe("complete");
    expect(runner.state.arenasCleared).toBe(4);
  });

  it("6. the level choice plays 1-2 by name", () => {
    expect(chosenLevel("?level=1-2").level.meta.id).toBe("1-2");
    expect(chosenLevel("?level=1-2").unknownLevel).toBe(null);
    expect(chosenLevel("").level.meta.id).toBe("1-1");
  });
});
