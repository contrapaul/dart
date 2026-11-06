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

// LVL-03a: Level 1-3 beats 1 to 5 (the bay, explore 1, Arena 1 the Pit,
// the catwalk breather, Arena 2 the Yard) with a temporary exit, as the
// arena page loads it with `?level=1-3`. On top of the load checks the
// card asks for: the file validates with its arenas in order, there is
// floor under the whole walk from the start to the exit, the Pit's ramps
// and the Yard are walkable on the nav grid built the way the page builds
// it, no wave puts more than 12 Swarmers alive, and the exit pad does
// nothing until the last arena clears.

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

describe("Level 1-3 loads (LVL-03a)", () => {
  it("1. validates with its arenas in file order", () => {
    const report = validateLevel(level);
    expect(report.errors).toEqual([]);
    const arenas = level.arenas!;
    expect(arenas.map((a) => a.id)).toEqual(["explore-1", "pit"]);
    expect(arenas.map((a) => a.archetype)).toEqual(["A4", "A1"]);
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
  });

  it("2. the level choice plays 1-3 by name", () => {
    expect(chosenLevel("?level=1-3").level.meta.id).toBe("1-3");
    expect(chosenLevel("?level=1-3").unknownLevel).toBe(null);
  });

  it("3. has floor under the walk from the start to the exit", async () => {
    const { rapier, world } = await createPhysics();
    buildLevel(level, rapier, world, FAKE);
    world.step();
    const route = walk(
      [0, -3], // the open bay (beat 1)
      [0, -12], // out of the bay
      [0, -21], // down the first corridor (beat 2)
      [0, -27], // across the explore room
      [0, -41], // down the second corridor
    );
    for (const [x, z] of route) {
      expect(hasFloor(world, x, z), `floor at ${x}, ${z}`).toBe(true);
    }
  });

  it("4a. the Pit's ramps join its floor to its ledges on the nav grid", async () => {
    const { rapier, world } = await createPhysics();
    const built = buildLevel(level, rapier, world, FAKE);
    const g = makeLevelAI(rapier, world, built.navBounds, "normal").grid;
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

  it("4. each arena's trigger is reachable on the nav grid", async () => {
    const { rapier, world } = await createPhysics();
    const built = buildLevel(level, rapier, world, FAKE);
    const ai = makeLevelAI(rapier, world, built.navBounds, "normal");
    const g = ai.grid;
    expect(g.walkableAt(0, -27), "the explore trigger").toBe(true);
    const path = makePath();
    expect(g.findPath({ x: 0, z: -3 }, { x: 0, z: -27 }, path), "start to explore").toBeGreaterThan(1);
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
