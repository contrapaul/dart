import { beforeAll, describe, expect, it } from "vitest";
import RAPIER from "@dimforge/rapier3d-compat";
import envJson from "../../data/levels/env-01.json";
import { buildLevel } from "../../src/level/build";
import { validateLevel } from "../../src/level/validate";
import { createPhysics } from "../../src/physics/world";
import { greedyMesh, type MeshData } from "../../src/voxel/mesher";
import { linearColorTable, material, materialId } from "../../src/voxel/materials";
import { carveSphere } from "../../src/voxel/carve";
import { ARENA_LEVELS, chosenLevel } from "../../src/arena/levels";
import { LevelRunner, type LevelEvents } from "../../src/level/level-runner";
import type { Level } from "../../src/level/format";

// ENV-01 stage 1: the test room and its foam cladding (E01). The room is
// plain shell; the only destructible is the coat on the column, so the coat
// has to behave in both directions: it stops a shot while it is there, and
// carving it off one side leaves the shell column behind, still solid.

const level = envJson as unknown as Level;
const FAKE = {
  mesh(padded: Uint8Array): Promise<MeshData> {
    return Promise.resolve(greedyMesh(padded, linearColorTable()));
  },
};
/** KIT 5: no more than 6 destructible zones in one arena. */
const ZONE_CAP = 6;
/** The column's shell box and its coat, from the file. */
const SHELL_X = -3;
const SHELL_HALF = 0.4;
const COAT_OUT = 0.7;

beforeAll(async () => {
  await RAPIER.init();
});

/** A ray straight along +x at (y, z), from x = -7: what does it meet? */
function rayEast(world: RAPIER.World, y: number, z: number) {
  return world.castRay(new RAPIER.Ray({ x: -7, y, z }, { x: 1, y: 0, z: 0 }), 8, true);
}

/** World metres to voxel coordinates, the way the page carves. */
function voxels(built: ReturnType<typeof buildLevel>, x: number, y: number, z: number) {
  const o = built.voxelMesh.group.position;
  const s = built.voxels.voxelSize;
  return [(x - o.x) / s, (y - o.y) / s, (z - o.z) / s] as const;
}

describe("the env-01 test room", () => {
  it("loads as a registered level with no errors", () => {
    expect(ARENA_LEVELS["env-01"]).toBe(level);
    expect(chosenLevel("?level=env-01").level.meta.id).toBe("env-01");
    const report = validateLevel(level);
    expect(report.errors).toEqual([]);
    // No arenas, so no lock and no zone count in the report; the warning
    // list is empty because the room has nothing an arena would flag.
    expect(report.warnings).toEqual([]);
  });

  it("has no arena lock: the page's runner is complete from the first frame", () => {
    // `arenas: []` is the whole mechanism. With no arena to play, the level
    // runner reports `complete` at once, and the arena page's exit test
    // (src/arena/extras.ts) only needs the pad, so the room ends on touch.
    const noop: LevelEvents = {
      setDoor() {}, spawn() { return false; }, onLocked() {}, onWaveStart() {},
      onCleared() {}, onArenaStart() {}, onLevelCleared() {},
    };
    const runner = new LevelRunner(level.arenas ?? [], noop);
    expect(level.arenas).toEqual([]);
    expect(runner.state.phase).toBe("complete");
    expect(runner.state.arenasCleared).toBe(0);
  });

  it("keeps its destructible pieces inside the KIT zone cap", () => {
    // The coat is the stage 1 piece. Stage 2 added the two crate stacks,
    // whose zone count is in tests/level/env-01-crates.test.ts (a stack is
    // many volumes but one 3.2 m zone). The coat is judged on its own: one
    // piece, so it breaks as one coat, of four sides.
    const coat = level.pieces!.find((p) => p.id === "col-coat")!;
    expect(coat.volumes.length).toBe(4);
    expect(coat.volumes.length).toBeLessThanOrEqual(ZONE_CAP);
  });

  it("has floor under the player start and under the exit pad", async () => {
    const { rapier, world } = await createPhysics();
    buildLevel(level, rapier, world, FAKE);
    world.step();
    for (const [x, z] of [[0, 6], [3, -6]] as const) {
      const hit = world.castRay(new RAPIER.Ray({ x, y: 3, z }, { x: 0, y: -1, z: 0 }), 4, true);
      expect(hit, `floor under ${x}, ${z}`).toBeTruthy();
    }
  });

  it("puts the coat outside the shell column, not inside it", () => {
    for (const v of level.pieces!.find((p) => p.id === "col-coat")!.volumes) {
      const min = [v.pos[0] - v.size[0] / 2, v.pos[1] - v.size[1] / 2, v.pos[2] - v.size[2] / 2];
      const max = [v.pos[0] + v.size[0] / 2, v.pos[1] + v.size[1] / 2, v.pos[2] + v.size[2] / 2];
      // The shell column's own box, from the file.
      const shellMin = [-3.4, 0, -0.4];
      const shellMax = [-2.6, 3, 0.4];
      const overlap = [0, 1, 2].every((i) => min[i]! < shellMax[i]! && max[i]! > shellMin[i]!);
      expect(overlap, `volume at ${v.pos.join(",")} shares space with the shell`).toBe(false);
    }
  });
});

describe("the foam coat on the column", () => {
  it("stops a shot from the side while it is on", async () => {
    const { rapier, world } = await createPhysics();
    buildLevel(level, rapier, world, FAKE);
    await new Promise((r) => setTimeout(r, 0));
    world.step();
    const hit = rayEast(world, 1.5, 0);
    expect(hit).toBeTruthy();
    expect(hit!.timeOfImpact).toBeCloseTo(7 + SHELL_X - COAT_OUT, 1);
  });

  it("carves off one side and leaves the shell column standing", async () => {
    const { rapier, world } = await createPhysics();
    const built = buildLevel(level, rapier, world, FAKE);
    await new Promise((r) => setTimeout(r, 0));
    world.step();

    // The west face of the coat: x -3.7 to -3.4, all 3 m of height, z -0.7
    // to 0.7. Carve it away in overlapping spheres, as a stream of darts
    // would. The bottom voxel row is bedrock (the piece's anchor), so it
    // stays and the rest of the coat stays tied to it.
    for (let y = 0.15; y < 3; y += 0.3) {
      for (let z = -0.65; z < 0.7; z += 0.3) {
        const [cx, cy, cz] = voxels(built, SHELL_X - 0.55, y, z);
        carveSphere(built.voxels, cx, cy, cz, 4);
      }
    }
    built.voxelMesh.update();
    await new Promise((r) => setTimeout(r, 0));
    world.step();

    // Every foam voxel of the west face is gone.
    const o = built.voxelMesh.group.position;
    const s = built.voxels.voxelSize;
    let left = 0;
    for (let x = -3.7; x < -3.4 - 1e-9; x += s) {
      for (let y = s; y < 3 - 1e-9; y += s) {
        for (let z = -0.7; z < 0.7; z += s) {
          const m = built.voxels.get(
            Math.round((x + s / 2 - o.x) / s),
            Math.round((y + s / 2 - o.y) / s),
            Math.round((z + s / 2 - o.z) / s),
          );
          if (material(m)?.name === "foam-yellow") left++;
        }
      }
    }
    expect(left, "west face foam voxels left after the carve").toBe(0);
    // The anchor row under the coat is still bedrock, so the other three
    // sides have something to hang from instead of falling as an island.
    const anchor = built.voxels.get(
      Math.floor((SHELL_X - 0.55 - o.x) / s),
      Math.floor((0.05 - o.y) / s),
      Math.floor((0 - o.z) / s),
    );
    expect(material(anchor)?.name).toBe("bedrock");

    // The shell column is still there, and a shot from the west now meets
    // it rather than a coat.
    const hit = rayEast(world, 1.5, 0);
    expect(hit).toBeTruthy();
    expect(hit!.timeOfImpact).toBeCloseTo(7 + SHELL_X - SHELL_HALF, 1);

    // The other three sides of the coat are still up: a shot along -z from
    // the south meets the coat, not the column behind it.
    const south = world.castRay(
      new RAPIER.Ray({ x: SHELL_X, y: 1.5, z: 6 }, { x: 0, y: 0, z: -1 }), 8, true,
    );
    expect(south).toBeTruthy();
    expect(south!.timeOfImpact).toBeCloseTo(6 - COAT_OUT, 1);
    // And its voxels are still there, so the piece did not fall apart.
    const m = built.voxels.get(
      Math.round((SHELL_X - o.x) / s),
      Math.round((1.5 - o.y) / s),
      Math.round((-0.55 - o.z) / s),
    );
    expect(material(m)?.name).toBe("foam-yellow");
    expect(m).not.toBe(materialId("bedrock"));
  });
});
