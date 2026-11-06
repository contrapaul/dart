import { beforeAll, describe, expect, it } from "vitest";
import RAPIER from "@dimforge/rapier3d-compat";
import type { World } from "@dimforge/rapier3d-compat";
import levelJson from "../../data/levels/1-3.json";
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

// LVL-03a and LVL-03b: Level 1-3 beats 1 to 9 (the bay, explore 1, the
// Pit, the catwalk breather, the Yard, the hall chase into a 6 m drop that
// seals, breather 2, the Ring gauntlet and the lit north exit), as the
// arena page loads it with `?level=1-3`. On top of the load checks the
// cards ask for: the file validates with its arenas in order, there is
// floor under the whole walk from the start to the exit, the Pit's ramps,
// the Yard and the Ring are walkable on the nav grid built the way the
// page builds it, the drop cannot be climbed back, the seal closes 3 s
// after the landing, no wave puts more than 12 Swarmers alive, and the
// exit pad does nothing until the Ring clears.

const level = levelJson as unknown as Level;
const FAKE = {
  mesh(padded: Uint8Array): Promise<MeshData> {
    return Promise.resolve(greedyMesh(padded, linearColorTable()));
  },
};

beforeAll(async () => {
  await RAPIER.init();
});

/** Voxel colliders arrive from the mesher as promises; wait for them before
 *  ray casts or the nav bake, or the pieces are missing from the world. */
async function settle(built: ReturnType<typeof buildLevel>) {
  for (let i = 0; i < 200 && built.voxelMesh.busy; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

/** Cast straight down from `from`: is there floor within `depth`? The Pit
 *  floor is 4 m down and the drop's room 6 m more, so the two walks start
 *  from different heights. */
function floorBelow(world: World, x: number, z: number, from = 4.5, depth = 9) {
  return world.castRay(new RAPIER.Ray({ x, y: from, z }, { x: 0, y: -1, z: 0 }), depth, true) !== null;
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

describe("Level 1-3 loads (LVL-03a)", () => {
  it("1. validates with its arenas in file order", () => {
    const report = validateLevel(level);
    expect(report.errors).toEqual([]);
    const arenas = level.arenas!;
    expect(arenas.map((a) => a.id)).toEqual([
      "explore-1", "pit", "yard", "hall", "ring",
    ]);
    expect(arenas.map((a) => a.archetype)).toEqual(["A4", "A1", "A6", "A4", "A2"]);
    // Beat 2: one Slowmer and one Swarmer, apart, in one wave.
    expect(arenas[0]!.waves).toHaveLength(1);
    expect(arenas[0]!.waves[0]!.spawns).toEqual([
      { foamer: "F01", count: 1 }, { foamer: "F03", count: 1 },
    ]);
    // Beat 3: six Swarmers, then eight more, then two Slammers late.
    expect(arenas[1]!.waves.map((w) => w.spawns)).toEqual([
      [{ foamer: "F03", count: 6 }],
      [{ foamer: "F03", count: 8 }],
      [{ foamer: "F01", count: 2 }],
    ]);
    // Beat 5: eight Swarmers from the two ends, then ten plus three
    // Slowmers from the north wall.
    expect(arenas[2]!.waves.map((w) => w.spawns)).toEqual([
      [{ foamer: "F03", count: 8 }],
      [{ foamer: "F03", count: 10 }],
      [{ foamer: "F01", count: 3 }],
    ]);
    // Beat 6: the hall is a chase, not a lock: 12 Swarmers, no door shut.
    const hall = arenas[3]!;
    expect(hall.noLock).toBe(true);
    expect(hall.waves.flatMap((w) => w.spawns)).toEqual([{ foamer: "F03", count: 12 }]);
    expect(hall.escape).toBeDefined();
    expect(hall.escape!.sealDoors).toEqual(["drop-hatch"]);
    expect(hall.escape!.sealDelaySeconds).toBe(3);
    // Beat 8: 10 Swarmers, then 12, then the Roamers last.
    const ring = arenas[4]!;
    expect(ring.waves.map((w) => w.spawns)).toEqual([
      [{ foamer: "F03", count: 10 }],
      [{ foamer: "F03", count: 12 }],
      [{ foamer: "F02", count: 4 }],
    ]);
    expect(ring.unlockOnClear).toEqual(["ring-in", "ring-out"]);
    // Four rifts, one per side, and four pillars.
    expect(ring.rifts).toHaveLength(4);
    expect(level.pieces!.filter((p) => p.id.startsWith("ring-pillar"))).toHaveLength(4);
    // The exit is behind the Ring's north door.
    expect(level.exit.pos[2]).toBeLessThan(-188);
  });

  it("2. the level choice plays 1-3 by name", () => {
    expect(chosenLevel("?level=1-3").level.meta.id).toBe("1-3");
    expect(chosenLevel("?level=1-3").unknownLevel).toBe(null);
  });

  it("3. has floor under the walk from the start to the exit", async () => {
    const { rapier, world } = await createPhysics();
    const built = buildLevel(level, rapier, world, FAKE);
    await settle(built);
    world.step();
    // Beats 1 to 6: start to the drop's lip, down the hall's lane. Cast
    // from 2 m there, under the hall's 7 m ceiling.
    const upper = walk(
      [0, -3], // the open bay (beat 1)
      [0, -12], // out of the bay
      [0, -21], // down the first corridor (beat 2)
      [0, -27], // across the explore room
      [0, -41], // down the second corridor (beat 3)
      [0, -50], // across the Pit floor, up the east ramp is not on this line
      [0, -68], // out of the Pit
      [0, -71], // the catwalk breather (beat 4)
      [0, -90], // across the Yard (beat 5)
      [0, -108], // the Yard's north gate
      [0, -120], // into the hall (beat 6)
      [0, -146], // down the lane, past the columns
      [0, -148], // the drop's lip: past here the floor is gone
    );
    for (const [x, z] of upper) {
      const from = z < -111 ? 2 : 4.5;
      expect(floorBelow(world, x, z, from, z < -111 ? 7 : 9), `floor at ${x}, ${z}`).toBe(true);
    }
    // Beat 6: the drop is a hole, 6 m of nothing under the lane's end. The
    // hatch over it starts open.
    for (const z of [-150, -152, -154]) {
      expect(floorBelow(world, 0, z, 2, 7.5), `no floor at 0, ${z}`).toBe(false);
    }
    // Beats 7 to 9: the drop's foot, breather 2, the Ring's ring, its north
    // door and the exit pad, sampled from the room's own height.
    const lower = walk(
      [0, -152], // landing, bottom of the drop (beat 7)
      [0, -153], // the room's middle
      [0, -155], // under its lid
      [0, -156.5], // through the doorway into the Ring
      [0, -161], // south of the block (beat 8)
      [-12, -161], // out to the west side of the ring
      [-12, -180], // north along it
      [0, -180], // round the block's north end
      [6, -182],
      [6, -186.5], // the north door
      [6, -190], // the exit pad (beat 9)
    );
    for (const [x, z] of lower) {
      expect(floorBelow(world, x, z, -8.5, 4), `floor at ${x}, ${z} (lower)`).toBe(true);
    }
  });

  it("4a. the Pit's ramps join its floor to its ledges on the nav grid", async () => {
    const { rapier, world } = await createPhysics();
    const built = buildLevel(level, rapier, world, FAKE);
    await settle(built);
    const g = makeLevelAI(rapier, world, built.navBounds, "normal", built.voxels, built.voxelMesh.group.position).grid;
    // Floor, both ramp feet, both ramp heads and both ledges: the path a
    // Swarmer takes up to the player is one continuous walkable surface.
    expect(g.walkableAt(14, -54, -4), "east ramp foot").toBe(true);
    expect(g.walkableAt(-9, -53, -4), "north ramp foot").toBe(true);
    expect(g.walkableAt(14, -47, 0), "east ramp head").toBe(true);
    expect(g.walkableAt(-14, -53, 0), "north ramp head").toBe(true);
    expect(g.walkableAt(0, -44, 0), "south ledge").toBe(true);
    expect(g.walkableAt(-15, -55, 0), "west ledge").toBe(true);
    const path = makePath();
    expect(g.findPath({ x: 14, z: -58 }, { x: 14, z: -44 }, path, -4, 0), "floor to south ledge")
      .toBeGreaterThan(1);
    expect(g.findPath({ x: -9, z: -60 }, { x: -15, z: -55 }, path, -4, 0), "floor to west ledge")
      .toBeGreaterThan(1);
  });

  it("4c. the Yard's islands are reachable and trap nobody", async () => {
    const { rapier, world } = await createPhysics();
    const built = buildLevel(level, rapier, world, FAKE);
    await settle(built);
    const g = makeLevelAI(rapier, world, built.navBounds, "normal", built.voxels, built.voxelMesh.group.position).grid;
    const path = makePath();
    const TOP = -1.5;
    expect(g.walkableAt(0, -92, -4), "the Yard floor").toBe(true);
    for (const z of [-82, -91, -100]) {
      for (const x of [-15, 15]) {
        expect(g.walkableAt(x, z, TOP), `island top at ${x}, ${z}`).toBe(true);
        // Up, and back down: every island ramp joins floor to island, so a
        // Swarmer that chases the player up can always come back down.
        expect(g.findPath({ x: 0, z }, { x, z }, path, -4, TOP), `up to ${x}, ${z}`)
          .toBeGreaterThan(1);
        expect(g.findPath({ x, z }, { x: 0, z }, path, TOP, -4), `down from ${x}, ${z}`)
          .toBeGreaterThan(1);
      }
    }
  });

  // Review fix: a rift on the floor under a ramp's slab put its Swarmer in
  // the pocket below the slab, where it stood in approach for good.
  it("4d. every rift stands on walkable ground, not under a ramp", async () => {
    const { rapier, world } = await createPhysics();
    const built = buildLevel(level, rapier, world, FAKE);
    await settle(built);
    const g = makeLevelAI(rapier, world, built.navBounds, "normal", built.voxels, built.voxelMesh.group.position).grid;
    for (const arena of level.arenas ?? []) {
      for (const r of arena.rifts) {
        expect(g.canStandAt(r.pos[0], r.pos[2], r.pos[1]), `${arena.id} ${r.id}`).toBe(true);
      }
    }
  });

  it("4e. the Ring's ring is a loop and its block top is walkable", async () => {
    const { rapier, world } = await createPhysics();
    const built = buildLevel(level, rapier, world, FAKE);
    await settle(built);
    const g = makeLevelAI(rapier, world, built.navBounds, "normal", built.voxels, built.voxelMesh.group.position).grid;
    const path = makePath();
    const F = -10;
    // The 6 m ring round the 10 x 8 m block: both sides, both ends.
    expect(g.walkableAt(-12, -172), "west side").toBe(true);
    expect(g.walkableAt(12, -172), "east side").toBe(true);
    expect(g.walkableAt(0, -161), "south end").toBe(true);
    expect(g.walkableAt(0, -183), "north end").toBe(true);
    // A loop: the east side to the west side, which the block sits between,
    // so the walk has to go round one end and comes out with waypoints
    // rather than a straight line across the block.
    expect(g.findPath({ x: 12, z: -172 }, { x: -12, z: -172 }, path, F, F), "east to west")
      .toBeGreaterThan(3);
    expect(g.findPath({ x: -12, z: -172 }, { x: 0, z: -183 }, path, F, F), "west to north")
      .toBeGreaterThan(1);
    // The block's top, and the mantle chain up its east face: 1.5 m step,
    // 1.3 m step, then a 0.7 m jump to 3.5 m, under the player's 1.5 m
    // mantle. The top is walkable and joins the ring through the chain.
    const TOP = F + 3.5;
    expect(g.walkableAt(0, -172, TOP), "block top").toBe(true);
    expect(g.walkableAt(7.8, -172, F + 1.5), "first step").toBe(true);
    expect(g.walkableAt(5.8, -172, F + 2.8), "second step").toBe(true);
    expect(g.findPath({ x: 12, z: -172 }, { x: 0, z: -172 }, path, F, TOP), "ring to block top")
      .toBeGreaterThan(1);
  });

  it("4f. the drop cannot be climbed back", async () => {
    const { rapier, world } = await createPhysics();
    const built = buildLevel(level, rapier, world, FAKE);
    await settle(built);
    const g = makeLevelAI(rapier, world, built.navBounds, "normal", built.voxels, built.voxelMesh.group.position).grid;
    // No path may end on the hall's floor: the drop's walls are sheer, so a
    // walk from the room up gets no closer than the room's own top layer,
    // and its last waypoint stays 6 m below the lane.
    const lastY = (from: { x: number; z: number }, to: { x: number; z: number }) => {
      const path = makePath();
      const n = g.findPath(from, to, path, -10, -4);
      if (n === 0) return -Infinity;
      // The path's world heights come from the grid's layers along it; the
      // simplest read is the ground it stops on, at its last waypoint.
      return g.groundAt(path.xs[n - 1]!, path.zs[n - 1]!, -4) ?? NaN;
    };
    expect(g.walkableAt(0, -153, -10), "the room's floor").toBe(true);
    expect(g.walkableAt(0, -148, -4), "the hall's floor").toBe(true);
    for (const [from, to] of [
      [{ x: 0, z: -153 }, { x: 0, z: -148 }],
      [{ x: 0, z: -152 }, { x: 0, z: -140 }],
      [{ x: -3, z: -155 }, { x: 3, z: -146 }],
    ] as const) {
      const y = lastY(from, to);
      expect(y, `from ${from.x},${from.z} to ${to.x},${to.z}`).toBeLessThan(-5);
    }
  });

  it("4. each arena's trigger is reachable on the nav grid", async () => {
    const { rapier, world } = await createPhysics();
    const built = buildLevel(level, rapier, world, FAKE);
    await settle(built);
    const ai = makeLevelAI(
      rapier, world, built.navBounds, "normal", built.voxels, built.voxelMesh.group.position,
    );
    const g = ai.grid;
    expect(g.walkableAt(0, -27), "the explore trigger").toBe(true);
    const path = makePath();
    expect(g.findPath({ x: 0, z: -3 }, { x: 0, z: -27 }, path), "start to explore").toBeGreaterThan(1);
  });

  // LVL-03b: the hall chase, on the level file itself. The runner's own
  // escape and seal are covered in level-runner.test.ts; this proves the file
  // wires them: 12 Swarmers on entry with no door shut, the drop ends the
  // arena, and the hatch seals 3 s after the landing.
  it("4g. the hall chases, ends at the drop, and the hatch seals 3 s later", () => {
    const doors = new Map<string, string>();
    let spawned = 0;
    let locked = 0;
    let escaped = 0;
    let cleared = 0;
    const events: LevelEvents = {
      setDoor(id, state) { doors.set(id, state); },
      spawn() { spawned++; return true; },
      onLocked() { locked++; },
      onWaveStart() {}, onCleared() { cleared++; },
      onEscaped() { escaped++; },
      onArenaStart() {}, onLevelCleared() {},
    };
    const runner = new LevelRunner(level.arenas!, events);
    const DT = 1 / 60;
    const stand = (pos: [number, number, number], frames: number) => {
      for (let i = 0; i < frames; i++) runner.update(DT, { playerPos: pos, aliveCount: 3 });
    };
    // Get to the hall: every arena before it has to clear first.
    for (let i = 0; i < 3; i++) {
      const arena = level.arenas![i]!;
      stand([arena.trigger.pos[0], arena.trigger.pos[1] - 0.5, arena.trigger.pos[2]], 60);
      for (let k = 0; k < 200 / DT && runner.state.arenaIndex === i; k++) {
        runner.update(DT, { playerPos: [arena.trigger.pos[0], arena.trigger.pos[1] - 0.5, arena.trigger.pos[2]], aliveCount: 0 });
      }
    }
    expect(runner.state.arenaId).toBe("hall");
    // In the hall, with Foamers up the whole time: no door shut, no lock.
    locked = 0;
    spawned = 0;
    cleared = 0;
    stand([0, -2, -118], 60);
    expect(spawned).toBeGreaterThan(0);
    expect(locked).toBe(0);
    expect(doors.get("drop-hatch")).toBe("open");
    // The landing: the arena is over with its Foamers still up.
    stand([0, -9.7, -152], 1);
    expect(escaped).toBe(1);
    expect(cleared).toBe(0);
    expect(runner.state.arenaId).toBe("ring");
    expect(doors.get("drop-hatch")).toBe("open");
    // Two seconds on the room's floor: still open. Three: sealed.
    stand([0, -9.7, -152], Math.round(2.5 / DT));
    expect(doors.get("drop-hatch")).toBe("open");
    stand([0, -9.7, -152], Math.round(0.6 / DT));
    expect(doors.get("drop-hatch")).toBe("sealed");
  });

  it("4b. no wave puts more than 12 Swarmers alive at once", () => {
    const SWARM = 12;
    for (const arena of level.arenas!) {
      let alive = 0;
      let peak = 0;
      let expected = 0;
      let seen = 0;
      const events: LevelEvents = {
        setDoor() {},
        spawn() { alive += 1; seen += 1; peak = Math.max(peak, alive); return true; },
        onLocked() {}, onLevelCleared() {},
        onArenaStart() {},
        onWaveStart(_wave, _index, count) {
          // Count what the wave spawns, then let the wave empty so the next
          // one starts: this measures the count, not the player's aim.
          expected = count;
        },
        onCleared() {},
      };
      const runner = new LevelRunner(level.arenas!, events);
      const DT = 1 / 60;
      const at = arena.trigger.pos;
      for (let i = 0; i < 200 / DT; i++) {
        runner.update(DT, { playerPos: [at[0], at[1] - 0.5, at[2]], aliveCount: 0 });
        if (seen >= expected && alive > 0) { alive = 0; seen = 0; }
        if (runner.state.phase === "complete") break;
      }
      expect(peak, `arena ${arena.id}`).toBeLessThanOrEqual(SWARM);
    }
    // And the file itself: no single wave lists more than 12 Swarmers.
    for (const arena of level.arenas!) {
      for (const wave of arena.waves) {
        const swarm = wave.spawns
          .filter((s) => s.foamer === "F03")
          .reduce((n, s) => n + s.count, 0);
        expect(swarm, `${arena.id} ${wave.id}`).toBeLessThanOrEqual(SWARM);
      }
    }
  });

  it("5. the exit pad does nothing until the last arena clears", () => {
    const events: LevelEvents = {
      setDoor() {}, spawn() { return true; }, onLocked() {}, onWaveStart() {}, onCleared() {},
      onArenaStart() {}, onLevelCleared() {},
    };
    const runner = new LevelRunner(level.arenas!, events);
    const DT = 1 / 60;
    const clear = (standing: [number, number, number]) => {
      const from = runner.state.arenaIndex;
      for (let i = 0; i < 120 / DT; i++) {
        runner.update(DT, { playerPos: standing, aliveCount: 0 });
        if (runner.state.arenaIndex !== from || runner.state.phase === "complete") return;
      }
      throw new Error(`arena ${from} did not clear`);
    };
    // Every arena but the last leaves the pad dead; the last one arms it.
    for (let i = 0; i < level.arenas!.length - 1; i++) {
      const arena = level.arenas![i]!;
      clear([arena.trigger.pos[0], arena.trigger.pos[1] - 0.5, arena.trigger.pos[2]]);
      expect(runner.state.phase, `after ${arena.id}`).not.toBe("complete");
      expect(runner.state.arenasCleared).toBe(i + 1);
    }
    const last = level.arenas![level.arenas!.length - 1]!;
    clear([last.trigger.pos[0], last.trigger.pos[1] - 0.5, last.trigger.pos[2]]);
    expect(runner.state.phase).toBe("complete");
    expect(runner.state.arenasCleared).toBe(level.arenas!.length);
  });
});
