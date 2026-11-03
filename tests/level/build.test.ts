import { beforeAll, describe, expect, it } from "vitest";
import RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import pitJson from "../../data/levels/1-1-pit.json";
import { buildLevel } from "../../src/level/build";
import { createPhysics } from "../../src/physics/world";
import { greedyMesh, type MeshData } from "../../src/voxel/mesher";
import { linearColorTable, materialId } from "../../src/voxel/materials";
import type { Level } from "../../src/level/format";

// Node has no Web Workers; the greedy mesher runs inline.
const FAKE = {
  mesh(padded: Uint8Array): Promise<MeshData> {
    return Promise.resolve(greedyMesh(padded, linearColorTable()));
  },
};

const pit = pitJson as unknown as Level;
const VOXEL = 0.1;

beforeAll(async () => {
  await RAPIER.init();
});

describe("buildLevel", () => {
  it("builds one fixed collider per shell box and one per door", async () => {
    const { rapier, world } = await createPhysics();
    const doors = pit.arenas![0].doors.length;
    buildLevel(pit, rapier, world, FAKE);
    expect(world.colliders.len()).toBe(pit.shell.length + doors);
  });

  it("puts the piece volumes in voxels, at the file's positions", async () => {
    const { rapier, world } = await createPhysics();
    const built = buildLevel(pit, rapier, world, FAKE);
    let expected = 0;
    for (const piece of pit.pieces!) {
      for (const v of piece.volumes) expected += v.size[0] * v.size[1] * v.size[2] / VOXEL ** 3;
    }
    let count = 0;
    for (const chunk of built.voxels.chunks.values()) count += chunk.count;
    expect(count).toBe(expected);

    // The centre block's middle volume is foam-orange, its bottom row bedrock.
    const p = built.voxelMesh.worldToVoxel(new THREE.Vector3(0, 1.6, 4));
    expect(built.voxels.get(Math.round(p.x), Math.round(p.y), Math.round(p.z)))
      .toBe(materialId("foam-orange"));
    const bottom = built.voxelMesh.worldToVoxel(new THREE.Vector3(0, 0.02, 4));
    expect(built.voxels.get(Math.round(bottom.x), Math.round(bottom.y), Math.round(bottom.z)))
      .toBe(materialId("bedrock"));
  });

  it("gives the voxels collision once the mesher answers", async () => {
    const { rapier, world } = await createPhysics();
    const before = world.colliders.len();
    const built = buildLevel(pit, rapier, world, FAKE);
    built.voxelMesh.update();
    await Promise.resolve();
    await Promise.resolve();
    expect(world.colliders.len()).toBeGreaterThan(before + pit.shell.length);
  });

  it("covers the shell with nav bounds and leaves the walls out", async () => {
    const { rapier, world } = await createPhysics();
    const built = buildLevel(pit, rapier, world, FAKE);
    const b = built.navBounds;
    // Outer faces of the shell: x +-18, z -35 to 21, inset by half a metre.
    expect(b.minX).toBeCloseTo(-17.5, 5);
    expect(b.maxX).toBeCloseTo(17.5, 5);
    expect(b.minZ).toBeCloseTo(-34.5, 5);
    expect(b.maxZ).toBeCloseTo(20.5, 5);
  });

  it("hides and disables a door when it opens, and restores it", async () => {
    const { rapier, world } = await createPhysics();
    const built = buildLevel(pit, rapier, world, FAKE);
    const door = built.doors.get("pit-out")!;
    expect(door.state).toBe("locked");
    door.setState("open");
    expect(door.state).toBe("open");
    door.setState("locked");
    expect(built.doors.get("pit-in")!.state).toBe("open");
  });

  it("gives a ramp a walkable slope", async () => {
    const { rapier, world } = await createPhysics();
    buildLevel(pit, rapier, world, FAKE);
    world.step();
    const ray = new rapier.Ray({ x: 13, y: 10, z: 3 }, { x: 0, y: -1, z: 0 });
    const low = world.castRay(ray, 20, true)!;
    ray.origin = { x: 13, y: 10, z: 7 };
    const high = world.castRay(ray, 20, true)!;
    // ramp-n rises 4 m over its 8 m of run, so 4 m along z is 2 m of rise.
    expect((10 - high.timeOfImpact) - (10 - low.timeOfImpact)).toBeCloseTo(2, 1);
  });

  it("makes no voxel chunks for an empty piece list", async () => {
    const { rapier, world } = await createPhysics();
    const built = buildLevel({ ...pit, pieces: [] }, rapier, world, FAKE);
    expect(built.voxels.chunks.size).toBe(0);
    expect(built.voxelMesh.volume).toBe(built.voxels);
  });
});
