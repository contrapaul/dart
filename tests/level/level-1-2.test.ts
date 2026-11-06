import { beforeAll, describe, expect, it } from "vitest";
import RAPIER from "@dimforge/rapier3d-compat";
import type { World } from "@dimforge/rapier3d-compat";
import levelJson from "../../data/levels/1-2.json";
import { buildLevel } from "../../src/level/build";
import { validateLevel } from "../../src/level/validate";
import { makeLevelAI } from "../../src/ai/level";
import { makePath } from "../../src/ai/nav-grid";
import { LevelRunner, type LevelEvents } from "../../src/level/level-runner";
import { FallingPieces } from "../../src/voxel/pieces";
import { DebrisSystem } from "../../src/voxel/debris";
import * as THREE from "three";
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
    expect(arenas.map((a) => a.id)).toEqual([
      "parry-corridor", "ring", "tower-low", "tower-high", "crossroads", "gauntlet",
    ]);
    expect(arenas.map((a) => a.archetype)).toEqual(["A6", "A2", "A5", "A5", "A7", "A3"]);
    // LVL-02d, beat 5: the tower's two fights, no lock-in, so no door at all:
    // the runner's lock() has nothing to shut and the player may walk out.
    expect(arenas[2]!.doors).toEqual([]);
    expect(arenas[3]!.doors).toEqual([]);
    expect(arenas[2]!.waves[0]!.spawns).toEqual([{ foamer: "F02", count: 2 }]);
    expect(arenas[3]!.waves[0]!.spawns).toEqual([
      { foamer: "F02", count: 2 }, { foamer: "F01", count: 1 },
    ]);
    // Beat 2: one Roamer alone, its own one wave arena.
    expect(arenas[0]!.waves).toHaveLength(1);
    expect(arenas[0]!.waves[0]!.spawns).toEqual([{ foamer: "F02", count: 1 }]);
    // Beat 3: the Ring, two waves of Roamers (4, then 6).
    expect(arenas[1]!.waves.map((w) => w.spawns[0]!.count)).toEqual([4, 6]);
    // Beat 6: the Crossroads (LVL-02c), 6 from three spokes, then 7 plus a
    // Slowmer from the pillar's floor seam.
    expect(arenas[4]!.waves.map((w) => w.spawns.reduce((n, s) => n + s.count, 0))).toEqual([6, 8]);
    expect(arenas[4]!.waves[1]!.spawns.map((s) => s.foamer)).toEqual(["F02", "F01"]);
    // Beat 8: the Gauntlet bowl (LVL-02c), 8 Roamers from two upper rifts,
    // then 10 with the floor rift in the bottom tier's centre.
    expect(arenas[5]!.waves.map((w) => w.spawns[0]!.count)).toEqual([8, 10]);
    expect(arenas[5]!.waves[1]!.rifts).toContain("bowl-r3");
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
      [5, -33], // up the connecting corridor beside the tower
      [5, -29], // level with the tower's ground doorway
      [0, -29], // in through the doorway (beat 5, the tower's ground floor)
      [-10, -29], // across the tower's ground floor
      [-10, -37.2], // out through the north neck into the bay's spur
      [-6, -40], // across the spur
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
    // LVL-02d: the connector's north end is shut now, so the tower's ground
    // floor is the way on to the Crossroads. If this ever opens again the
    // tower's two fights can be skipped and the exit pad never unlocks.
    const north = world.castRay(
      new RAPIER.Ray({ x: 5, y: 1.75, z: -34 }, { x: 0, y: 0, z: -1 }), 3.5, true,
    );
    expect(north, "the connector's north end blocks").toBeTruthy();
    expect(north!.timeOfImpact).toBeLessThan(3.2);
  });

  it("3. has floor under every rift, pickup and checkpoint", async () => {
    const { rapier, world } = await createPhysics();
    buildLevel(level, rapier, world, FAKE);
    world.step();
    const spots: [number, number, number][] = [];
    for (const arena of level.arenas!) {
      for (const rift of arena.rifts) spots.push([rift.pos[0], rift.pos[2], rift.pos[1]]);
      if (arena.checkpointPos) {
        spots.push([arena.checkpointPos[0], arena.checkpointPos[2], arena.checkpointPos[1]]);
      }
    }
    for (const pickup of level.pickups!) spots.push([pickup.pos[0], pickup.pos[2], 0]);
    // From just above the spot itself, so the tower's floor 2 and 3 rifts are
    // checked against their own slab and not floor 1 under it.
    for (const [x, z, y] of spots) {
      const hit = world.castRay(new RAPIER.Ray({ x, y: y + 1, z }, { x: 0, y: -1, z: 0 }), 2, true);
      expect(hit, `floor at ${x}, ${y}, ${z}`).toBeTruthy();
    }
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
    // for the Gauntlet, the sixth and last arena (LVL-02d added the tower's
    // two).
    const events: LevelEvents = {
      setDoor() {}, spawn() { return true; }, onLocked() {}, onWaveStart() {}, onCleared() {},
      onArenaStart() {}, onLevelCleared() {},
    };
    const runner = new LevelRunner(level.arenas!, events);
    const DT = 1 / 60;
    // Steps at `standing` (the arena's trigger) until the runner stops being
    // in that arena, with two minutes of game time to fail after (waves
    // stagger, so it is slow). The tower's two arenas overlap in plan and
    // differ in height: floor 1's trigger is at 0 to 4 m, floor 3's at 10 to
    // 13 m, so a stander at floor 1 never trips floor 3's.
    const clear = (standing: [number, number, number]) => {
      const from = runner.state.arenaIndex;
      for (let i = 0; i < 120 / DT; i++) {
        runner.update(DT, { playerPos: standing, aliveCount: 0 });
        if (runner.state.arenaIndex !== from || runner.state.phase === "complete") return;
      }
      throw new Error(`arena ${from} did not clear`);
    };
    for (const standing of [
      [-4, 0, 40], [-4, 0, 10], [-9, 0, -29], [-9, 12, -29], [-6, 0, -53.5],
    ] as [number, number, number][]) {
      clear(standing); // lock, spawn, and clear with nothing alive
      expect(runner.state.phase).not.toBe("complete");
    }
    // Five arenas down: the pad still does nothing.
    expect(runner.state.arenasCleared).toBe(5);
    expect(runner.state.phase).not.toBe("complete");
    clear([-4.5, 0, -88]);
    expect(runner.state.phase).toBe("complete");
    expect(runner.state.arenasCleared).toBe(6);
  });

  // LVL-02d: the tower's four floors are on the nav grid, a Foamer can walk
  // from the bottom to the top, and the higher topMetres the layers needed
  // puts no roof or ceiling top within a step of a floor.
  it("8. the tower's floors are walkable and nothing walks onto a roof", async () => {
    const { rapier, world } = await createPhysics();
    const built = buildLevel(level, rapier, world, FAKE);
    const grid = makeLevelAI(rapier, world, built.navBounds, "normal").grid;
    for (const [y, label] of [[0, "floor 1"], [5, "floor 2"], [10, "floor 3"], [15, "floor 4"]] as const) {
      expect(grid.walkableAt(-8, -29, y), `${label} is walkable`).toBe(true);
    }
    const path = makePath();
    expect(grid.findPath({ x: -2, z: -29 }, { x: -3, z: -29 }, path, 0, 15), "bottom to top").toBeGreaterThan(1);
    // The side effect of nav.topMetres 17: the bake meets the tops of the
    // ceilings (y 10) and the tower's roof (y 20) as flat faces. They are
    // layers, but a step onto one has to clear maxStepMetres, so no cell
    // above 9 m may sit within a step of a layer below 6 m in a cell beside
    // it. That is what would let a Foamer on a floor walk out over a roof.
    const maxStep = 0.45;
    let bridged = 0;
    for (let r = 0; r < grid.rows; r++) {
      for (let c = 0; c < grid.cols; c++) {
        const i = r * grid.cols + c;
        for (let k = 0; k < grid.layers[i]!; k++) {
          const high = grid.layerY[i * grid.maxLayers + k]!;
          if (high < 9) continue;
          for (const [dc, dr] of [[1, 0], [0, 1]] as const) {
            if (c + dc >= grid.cols || r + dr >= grid.rows) continue;
            const j = (r + dr) * grid.cols + c + dc;
            for (let m = 0; m < grid.layers[j]!; m++) {
              const low = grid.layerY[j * grid.maxLayers + m]!;
              if (low < 6 && high - low < maxStep) bridged++;
            }
          }
        }
      }
    }
    expect(bridged, "a high layer within a step of a floor layer").toBe(0);
  });

  // LVL-02d, beat 5's ceiling plug: the piece hangs under floor 3's slab with
  // no bedrock row (a ceiling anchor gets none), so one dart's island search
  // takes all of it and it drops onto floor 2 as one slab, doing no damage.
  it("9. the tower's ceiling plug drops as one slab", async () => {
    const { rapier, world } = await createPhysics();
    const built = buildLevel(level, rapier, world, FAKE);
    built.voxelMesh.update();
    // A voxel inside the slab, under floor 3's own slab.
    const at = built.voxelMesh.worldToVoxel(new THREE.Vector3(-6, 9.2, -29));
    expect(built.voxels.get(Math.round(at.x), Math.round(at.y), Math.round(at.z)))
      .not.toBe(undefined);
    let islands = 0;
    const pieces = new FallingPieces(rapier, world, FAKE as never,
      new DebrisSystem(rapier, world));
    const removed: { x: number; y: number; z: number; material: number }[] = [];
    // Carve one voxel out of the plug's underside and see what breaks off.
    const v = { x: Math.round(at.x), y: Math.round(at.y), z: Math.round(at.z) };
    removed.push({ ...v, material: built.voxels.get(v.x, v.y, v.z)! });
    built.voxels.set(v.x, v.y, v.z, 0);
    islands = pieces.afterCarve(built.voxelMesh as never, removed);
    expect(islands, "the whole plug is one island").toBe(1);
    expect(pieces.stats.pieces + pieces.stats.toDebris).toBe(1);
    // 3.0 x 0.6 x 3.0 m at 0.1 m is 5400 voxels: over minPieceVoxels, under
    // maxSearchVoxels, so it becomes a falling piece rather than debris.
    expect(pieces.stats.pieces).toBe(1);
    // And it is a second-storey plug, hanging under a floor 3 slab.
    expect(level.pieces!.find((p) => p.id === "tower-plug")!.volumes[0]!.pos[1])
      .toBeCloseTo(9.2, 3);
  });

  it("6. the level choice plays 1-2 by name", () => {
    expect(chosenLevel("?level=1-2").level.meta.id).toBe("1-2");
    expect(chosenLevel("?level=1-2").unknownLevel).toBe(null);
    expect(chosenLevel("").level.meta.id).toBe("1-1");
  });
});
