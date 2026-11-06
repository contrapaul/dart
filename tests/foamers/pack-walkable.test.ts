import { beforeAll, describe, expect, it } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import foamerData from "../../data/foamers.json";
import { linearColorTable } from "../../src/voxel/materials";
import { greedyMesh } from "../../src/voxel/mesher";
import type { Mesher } from "../../src/voxel/pieces";
import { DebrisSystem } from "../../src/voxel/debris";
import { DartSystem } from "../../src/weapons/darts";
import type { VoxelTarget } from "../../src/weapons/impacts";
import { FoamerSystem } from "../../src/foamers/foamers";
import { Director } from "../../src/ai/director";
import { NavGrid } from "../../src/ai/nav-grid";

// BUG-02: spawnPack only uses spots an agent of the grid's size can stand
// on. A member whose ring spot a block takes is stepped a few in along the
// same angle, and with nothing standable it is skipped, not spawned and not
// counted. Without a grid placement is unchanged (swarmer.test.ts covers
// that, unchanged).

const HALF = 20;
const F03 = foamerData.types.F03;
// The grid's own stand rule: a standable face is an autostep up, a full step
// down. Copying the data keeps the test honest when the numbers move.
const UP = 0.2; // ai.json nav.stepAutostepMetres
const DOWN = 0.45; // ai.json nav.maxStepMetres

function fakeMesher(): Mesher {
  const colors = linearColorTable();
  return { mesh: (padded) => Promise.resolve(greedyMesh(padded, colors)) };
}

/** The swarmer test's rig, plus a fixed column on the grid (a block: its
 *  cells are unwalkable to a stand, its top is not a floor). `block` is the
 *  centre and half size, or null for an open grid. */
function rig(block: { x: number; z: number; half: number } | null) {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.createCollider(RAPIER.ColliderDesc.cuboid(40, 0.5, 40).setTranslation(0, -0.5, 0));
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  const ignore = world.createCollider(
    RAPIER.ColliderDesc.capsule(0.5, 0.3).setTranslation(0, 0, 200),
    body,
  );
  if (block) {
    // A column: cuboid arguments are half extents, so the block's ground
    // follows the column's own width, its top is at +2.
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(block.half, 1, block.half)
        .setTranslation(block.x, 1, block.z),
      body,
    );
  }
  const darts = new DartSystem(new THREE.Scene(), world, RAPIER, ignore);
  const debris = new DebrisSystem(RAPIER, world);
  const targets: VoxelTarget[] = [];
  const foamers = new FoamerSystem(RAPIER, world, fakeMesher(), debris, darts, targets);
  const director = new Director("normal");
  const grid = new NavGrid(RAPIER, world, { minX: -HALF, maxX: HALF, minZ: -HALF, maxZ: HALF });
  foamers.director = director;
  foamers.navGrid = grid;
  foamers.spawnState = "alert";
  world.step();
  grid.bake();
  return { world, darts, foamers, grid, block };
}

function stands(grid: NavGrid, x: number, z: number, y = 0): boolean {
  const g = grid.groundAt(x, z);
  return Number.isFinite(g) && g - y <= UP && y - g <= DOWN;
}

beforeAll(async () => {
  await RAPIER.init();
});

describe("spawnPack and the nav grid (BUG-02)", () => {
  it("a block under the pack centre: every member is skipped, none counted", () => {
    const r = rig({ x: 0, z: 0, half: 1.6 });
    expect(r.grid.walkableAt(0, 0), "the bake reads the centre cell").toBe(true);
    expect(stands(r.grid, 0, 0), "the stand rule says the block's top is no floor")
      .toBe(false);
    const feet = new THREE.Vector3(0, 0, 0);
    const pack = r.foamers.spawnPack(feet, undefined, F03.pack);
    expect(pack.length, "no member sits on the block").toBe(0);
    expect(r.foamers.list.length, "nobody was spawned").toBe(0);
    // A skipped member is not counted as live: a second pack does not fill
    // up against a ghost.
    const again = r.foamers.spawnPack(feet, undefined, F03.pack);
    expect(again.length).toBe(0);
  });

  it("a block off to one side: stepped in past it, none stands on it", () => {
    const r = rig({ x: -1.5, z: 0, half: 1 });
    const b = r.block!;
    const feet = new THREE.Vector3(0, 0, 0);
    const pack = r.foamers.spawnPack(feet, undefined, F03.pack);
    expect(pack.length, "the whole pack still arrives").toBe(F03.pack);
    for (const f of pack) {
      const x = f.centre.x, z = f.centre.z, y = f.centre.y;
      expect(stands(r.grid, x, z, y),
        `member at (${x.toFixed(2)}, ${z.toFixed(2)}) stands on floor`).toBe(true);
      const onBlock = Math.abs(x - b.x) < b.half - 0.1 && Math.abs(z - b.z) < b.half - 0.1;
      expect(onBlock,
        `member at (${x.toFixed(2)}, ${z.toFixed(2)}) is not on the block`).toBe(false);
    }
  });
});
