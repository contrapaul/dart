import { beforeAll, describe, expect, it } from "vitest";
import RAPIER from "@dimforge/rapier3d-compat";
import type { World } from "@dimforge/rapier3d-compat";
import levelJson from "../../data/levels/1-4.json";
import { buildLevel } from "../../src/level/build";
import { validateLevel } from "../../src/level/validate";
import { LevelRunner, type LevelEvents } from "../../src/level/level-runner";
import { makeLevelAI } from "../../src/ai/level";
import { makePath } from "../../src/ai/nav-grid";
import { createPhysics } from "../../src/physics/world";
import { greedyMesh, type MeshData } from "../../src/voxel/mesher";
import { linearColorTable } from "../../src/voxel/materials";
import type { Level } from "../../src/level/format";
import { chosenLevel } from "../../src/arena/levels";

// LVL-04a: Level 1-4 beats 1 to 5 (the forecourt, explore 1 with the first
// Darter, the A4 hall, the mid-hall alcove and the A8 bridge over the ring,
// where a temporary exit pad stands), as the arena page loads it with
// `?level=1-4`. Beat 6 onwards (the Pit, breather 2, the Ring, the Yard and
// the lift) is a later card. On top of the load checks the card asks for:
// the file validates with its arenas in order, there is floor under the
// whole walk from the start to the exit, the hall and both bridge yards are
// walkable on the nav grid built the way the arena page builds it, the
// bridge joins the two yards, a straight line of at least 14 m runs along
// the hall between the columns, the drop from the bridge lands on the ring
// floor, and the exit pad does nothing until the last arena ends.

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

/** Cast straight down from `from`: is there floor within `depth`? The ring
 *  is 9 m under the deck, so the two walks start from different heights. */
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

describe("Level 1-4 loads (LVL-04a)", () => {
  it("1. validates with its arenas in order", () => {
    const report = validateLevel(level);
    expect(report.errors).toEqual([]);
    const arenas = level.arenas!;
    expect(arenas.map((a) => a.id)).toEqual(["explore-1", "hall", "bridge"]);
    expect(arenas.map((a) => a.archetype)).toEqual(["A4", "A4", "A8"]);
    // Beat 2: one Darter, alone, in one wave: the room teaches one charge.
    expect(arenas[0]!.waves).toHaveLength(1);
    expect(arenas[0]!.waves[0]!.spawns).toEqual([{ foamer: "F05", count: 1 }]);
    expect(arenas[0]!.checkpoint).toBe(true);
    // Beat 3: five at once, then six, the concept's two waves.
    const hall = arenas[1]!;
    expect(hall.waves.map((w) => w.spawns)).toEqual([
      [{ foamer: "F03", count: 4 }, { foamer: "F05", count: 1 }],
      [{ foamer: "F02", count: 4 }, { foamer: "F05", count: 2 }],
    ]);
    expect(hall.unlockOnClear).toEqual(["hall-in", "hall-out"]);
    // Beat 5: two Darters, one per yard, and no lock: the drop is the way on.
    const bridge = arenas[2]!;
    expect(bridge.waves[0]!.spawns).toEqual([{ foamer: "F05", count: 2 }]);
    expect(bridge.noLock).toBe(true);
    expect(bridge.doors).toEqual([]);
    expect(bridge.escape).toBeDefined();
    // Beat 1: one ammo box; beat 3: A2 at the third column.
    expect(level.pickups!.map((p) => [p.id, p.count])).toEqual([["a1-ammo", 24], ["a2-ammo", 8]]);
    // The exit pad is on the ring below the bridge, not behind a door.
    expect(level.exit.pos[1]).toBeLessThan(-5);
    expect(Math.abs(level.exit.pos[0])).toBeLessThan(2);
  });

  it("2. the level choice plays 1-4 by name", () => {
    expect(chosenLevel("?level=1-4").level.meta.id).toBe("1-4");
    expect(chosenLevel("?level=1-4").unknownLevel).toBe(null);
    // GAME-10b's test Ring keeps its own entry, a 90 s test space.
    expect(chosenLevel("?level=1-4-ring").level.meta.targetSeconds).toBe(90);
  });

  it("3. has floor under the walk from the start to the exit", async () => {
    const { rapier, world } = await createPhysics();
    const built = buildLevel(level, rapier, world, FAKE);
    await settle(built);
    world.step();
    // Beats 1 to 5, on the centre line: the forecourt, its corridor, the
    // room, the corridor on to the hall, the hall's lane, the corridor past
    // it, the near yard, the deck and the far yard.
    const upper = walk(
      [0, -3], // the forecourt (beat 1)
      [0, -21], // out of its north door
      [0, -28], // down the 14 m corridor (beat 2)
      [0, -44], // across the room, between its pillars
      [0, -55], // out of the room's north door
      [0, -62], // into the hall (beat 3), 18 m to the lock
      [0, -85], // down the lane, past the columns
      [0, -107], // the hall's north door
      [0, -112], // the corridor past it, with the alcove on the right (beat 4)
      [0, -124], // the near yard (beat 5)
      [0, -135], // the deck's south end
      [0, -150], // across the bridge
      [0, -165], // the far yard
      [0, -174],
    );
    for (const [x, z] of upper) {
      const from = z < -108 ? 2 : 4.5;
      expect(floorBelow(world, x, z, from, 6), `floor at ${x}, ${z}`).toBe(true);
      if (z < -136 && z > -158) {
        // The bridge has no floor under it but the ring, 9 m down.
        expect(floorBelow(world, x, z, 0, 3), `no deck-only floor at ${x}, ${z}`).toBe(true);
      }
    }
  });

  it("4. the hall and both yards are walkable, and the bridge joins them", async () => {
    const { rapier, world } = await createPhysics();
    const built = buildLevel(level, rapier, world, FAKE);
    await settle(built);
    const g = makeLevelAI(rapier, world, built.navBounds, "normal", built.voxels, built.voxelMesh.group.position).grid;
    const path = makePath();
    // The hall's lane, both column lines' sidesteps, and the whole hall.
    expect(g.walkableAt(0, -63, 0), "hall south door").toBe(true);
    expect(g.walkableAt(0, -107, 0), "hall north wall").toBe(true);
    for (const z of [-66, -74, -82, -90, -98, -104]) {
      expect(g.walkableAt(0, z, 0), `lane at ${z}`).toBe(true);
      expect(g.walkableAt(-4, z, 0), `west lane at ${z}`).toBe(true);
      expect(g.walkableAt(4, z, 0), `east lane at ${z}`).toBe(true);
    }
    expect(g.findPath({ x: 0, z: -63 }, { x: 0, z: -106 }, path, 0, 0), "the hall end to end")
      .toBeGreaterThan(1);
    // Both bridge yards, and the deck between them as one walkable strip.
    const NEAR = { x: -4, z: -125 };
    const FAR = { x: 0, z: -165 };
    expect(g.walkableAt(NEAR.x, NEAR.z, 0), "near yard").toBe(true);
    expect(g.walkableAt(FAR.x, FAR.z, 0), "far yard").toBe(true);
    for (const z of [-140, -145, -150, -155]) {
      expect(g.walkableAt(0, z, 0), `deck at ${z}`).toBe(true);
    }
    expect(g.findPath(NEAR, FAR, path, 0, 0), "near yard to far yard").toBeGreaterThan(1);
    // Both yard floors, off the deck's line.
    for (const [x, z] of [[-6, -130], [6, -122], [-6, -170], [6, -168]] as const) {
      expect(g.walkableAt(x, z, 0), `yard floor at ${x}, ${z}`).toBe(true);
    }
    // The alcove, off the corridor past the hall.
    expect(g.walkableAt(7, -113, 0), "the alcove").toBe(true);
    expect(g.findPath({ x: 0, z: -112 }, { x: 8, z: -112 }, path, 0, 0), "corridor to alcove")
      .toBeGreaterThan(1);
  });

  it("5. the hall gives the Darter 14 m of straight charge line", async () => {
    const { rapier, world } = await createPhysics();
    buildLevel(level, rapier, world, FAKE);
    world.step();
    // The hall runs z -107 (north wall) to -63 (south wall, with the door).
    // The centre lane, 40 m, is clear: well past the 14 m the F05 needs, and
    // the columns sit 12 m apart in x, so the charge passes between them.
    const to = { x: 0, y: 0, z: 1 };
    expect(world.castRay(new RAPIER.Ray({ x: 0, y: 1, z: -105 }, to), 40, true), "the lane is clear")
      .toBe(null);
    // And each column's own z, with the cast clipped to the walls so the
    // south door and corridor are not what it finds.
    for (const z of [-104, -97, -89, -81, -73, -65]) {
      const south = z - (-63) - 1;
      const north = -105 - z;
      expect(world.castRay(new RAPIER.Ray({ x: 0, y: 1, z }, to), south, true), `south at ${z}`)
        .toBe(null);
      expect(world.castRay(new RAPIER.Ray({ x: 0, y: 1, z }, { x: 0, y: 0, z: -1 }), north, true),
        `north at ${z}`).toBe(null);
    }
  });

  it("6. the drop from the bridge lands on the ring floor", async () => {
    const { rapier, world } = await createPhysics();
    const built = buildLevel(level, rapier, world, FAKE);
    await settle(built);
    world.step();
    // Off the deck's side, from its own height: 9 m of nothing but the ring.
    for (const [x, z] of [[2.2, -145], [-2.2, -150], [2.2, -155], [-2.2, -140]] as const) {
      const hit = world.castRay(new RAPIER.Ray({ x, y: 0, z }, { x: 0, y: -1, z: 0 }), 12, true);
      expect(hit, `the drop at ${x}, ${z}`).not.toBe(null);
      const y = -hit!.timeOfImpact;
      expect(y, `the ring's floor at ${x}, ${z}`).toBeCloseTo(-9, 1);
    }
    // And the ring runs under the whole deck, so a fall anywhere lands.
    for (const z of [-136, -142, -148, -154, -158]) {
      expect(floorBelow(world, 0, z, 0, 12), `ring at ${z}`).toBe(true);
    }
    // The 3.2 m hole in the near yard drops the same 9 m to the ring.
    const hole = world.castRay(new RAPIER.Ray({ x: 2.8, y: 0, z: -129.4 }, { x: 0, y: -1, z: 0 }), 12, true);
    expect(hole).not.toBe(null);
    expect(-hole!.timeOfImpact).toBeCloseTo(-9, 1);
  });

  it("7. each arena's rifts stand on walkable ground", async () => {
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

  it("8. the bridge ends on the drop, not on a clear", () => {
    const doors = new Map<string, string>();
    let escaped = 0;
    let cleared = 0;
    let locked = 0;
    const events: LevelEvents = {
      setDoor(id, state) { doors.set(id, state); },
      spawn() { return true; },
      onLocked() { locked++; },
      onWaveStart() {}, onCleared() { cleared++; },
      onEscaped() { escaped++; },
      onArenaStart() {}, onLevelCleared() {},
    };
    const runner = new LevelRunner(level.arenas!, events);
    const DT = 1 / 60;
    // Clear the two arenas before the bridge the way the player would.
    for (let i = 0; i < 2; i++) {
      const arena = level.arenas![i]!;
      const at: [number, number, number] = [arena.trigger.pos[0], arena.trigger.pos[1] - 0.5, arena.trigger.pos[2]];
      for (let n = 0; n < 300 / DT && runner.state.arenaIndex === i; n++) {
        runner.update(DT, { playerPos: at, aliveCount: 0 });
      }
    }
    expect(runner.state.arenaId).toBe("bridge");
    // Into the near yard: the fight starts, and no door shuts.
    locked = 0;
    cleared = 0;
    escaped = 0;
    doors.clear();
    for (let n = 0; n < 60; n++) runner.update(DT, { playerPos: [0, 0, -124], aliveCount: 3 });
    expect(locked).toBe(0);
    expect(doors.size).toBe(0);
    // The ring: the arena is over with its Darters still up.
    runner.update(DT, { playerPos: [0, -9, -147], aliveCount: 2 });
    expect(escaped).toBe(1);
    expect(cleared).toBe(0);
    expect(runner.state.phase).toBe("complete");
  });

  it("9. the exit pad does nothing until the last arena ends", () => {
    const events: LevelEvents = {
      setDoor() {}, spawn() { return true; }, onLocked() {}, onWaveStart() {}, onCleared() {},
      onArenaStart() {}, onLevelCleared() {},
    };
    const runner = new LevelRunner(level.arenas!, events);
    const DT = 1 / 60;
    const clear = (standing: [number, number, number]) => {
      const from = runner.state.arenaIndex;
      for (let i = 0; i < 300 / DT; i++) {
        runner.update(DT, { playerPos: standing, aliveCount: 0 });
        if (runner.state.arenaIndex !== from || runner.state.phase === "complete") return;
      }
      throw new Error(`arena ${from} did not clear`);
    };
    for (let i = 0; i < level.arenas!.length - 1; i++) {
      const arena = level.arenas![i]!;
      clear([arena.trigger.pos[0], arena.trigger.pos[1] - 0.5, arena.trigger.pos[2]]);
      expect(runner.state.phase, `after ${arena.id}`).not.toBe("complete");
      expect(runner.state.arenasCleared).toBe(i + 1);
    }
    expect(runner.state.phase).toBe("waiting");
    expect(runner.state.arenaId).toBe("bridge");
    const last = level.arenas![level.arenas!.length - 1]!;
    clear([last.trigger.pos[0], last.trigger.pos[1] - 0.5, last.trigger.pos[2]]);
    expect(runner.state.phase).toBe("complete");
    expect(runner.state.arenasCleared).toBe(level.arenas!.length);
  });

  it("10. no wave puts more than 12 Foamers alive at once", () => {
    for (const arena of level.arenas!) {
      for (const wave of arena.waves) {
        const alive = wave.spawns.reduce((n, s) => n + s.count, 0);
        expect(alive, `${arena.id} ${wave.id}`).toBeLessThanOrEqual(12);
      }
    }
  });
});
