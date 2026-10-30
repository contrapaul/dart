import { beforeAll, describe, expect, it } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { DartSystem } from "../../src/weapons/darts";
import { DartImpacts, type VoxelTarget } from "../../src/weapons/impacts";
import { VoxelVolume } from "../../src/voxel/chunk";
import { materialId, EMPTY } from "../../src/voxel/materials";
import { DebrisSystem } from "../../src/voxel/debris";

// The compat build runs in Node with a plain Scene and a real Rapier world.
// The wall is a real VoxelVolume behind a matching fixed cuboid collider.

const DT = 1 / 60;
const SIZE = 0.1; // voxel size in metres

/** A 3 m x 0.5 m x 0.5 m slab at the origin, front face at z = 0. */
function makeWall(m: number) {
  const volume = new VoxelVolume(SIZE);
  volume.fillBox(0, 0, 0, 29, 4, 4, m);
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  const collider = world.createCollider(
    RAPIER.ColliderDesc.cuboid(1.5, 0.25, 0.25).setTranslation(1.5, 0.25, 0.25),
    body,
  );
  const target: VoxelTarget = {
    volume,
    owns: (c) => c === collider,
    worldToVoxel: (v) => v.divideScalar(SIZE),
    voxelToWorld: (v) => v.multiplyScalar(SIZE),
  };
  return { target, collider, world, body };
}

function makeDarts(world: RAPIER.World) {
  const scene = new THREE.Scene();
  const pb = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  const ignore = world.createCollider(RAPIER.ColliderDesc.capsule(0.3, 0.3), pb);
  return new DartSystem(scene, world, RAPIER, ignore);
}

/** Voxel coordinates that are filled before and gone after the hit. */
function removedVoxels(volume: VoxelVolume, before: Map<string, number>) {
  const gone: { x: number; y: number; z: number }[] = [];
  for (const [key, m] of before) {
    if (m === EMPTY) continue;
    const [x, y, z] = key.split(",").map(Number);
    if (volume.get(x, y, z) === EMPTY) gone.push({ x, y, z });
  }
  return gone;
}

function snapshot(volume: VoxelVolume) {
  const before = new Map<string, number>();
  for (const key of volume.chunks.keys()) {
    const cx = (key % 1024) - 512;
    const cy = (Math.floor(key / 1024) % 1024) - 512;
    const cz = Math.floor(key / 1048576) - 512;
    const chunk = volume.chunks.get(key)!;
    for (let y = 0; y < 32; y++)
      for (let z = 0; z < 32; z++)
        for (let x = 0; x < 32; x++) {
          const m = chunk.get(x, y, z);
          if (m !== EMPTY) before.set(`${cx * 32 + x},${cy * 32 + y},${cz * 32 + z}`, m);
        }
  }
  return before;
}

/** Steps until a condition holds (or the budget dies). */
function until(cond: () => boolean, darts: DartSystem, world: RAPIER.World, max = 300) {
  for (let i = 0; i < max && !cond(); i++) {
    darts.update(DT);
    world.step();
  }
  expect(cond()).toBe(true);
}

beforeAll(async () => {
  await RAPIER.init();
});

describe("DartImpacts", () => {
  it("5. a standard dart fired at foam removes voxels near the hit, all within carveRadius + 2*voxelSize, and stats.carves is 1", () => {
    const m = materialId("foam-orange");
    const { target, world } = makeWall(m);
    const darts = makeDarts(world);
    let hitPoint: THREE.Vector3 | null = null;
    darts.onHit = (h) => { hitPoint = h.point.clone(); };
    const debris = new DebrisSystem(RAPIER, world);
    const impacts = new DartImpacts(darts, debris, [target]);
    const before = snapshot(target.volume);
    darts.fire(new THREE.Vector3(0.5, 0.25, 1), new THREE.Vector3(0, 0, -1), "standard");
    until(() => hitPoint !== null, darts, world);
    expect(impacts.stats.hits).toBe(1);
    expect(impacts.stats.carves).toBe(1);
    expect(impacts.stats.voxelsRemoved).toBeGreaterThan(0);
    const gone = removedVoxels(target.volume, before);
    expect(gone.length).toBe(impacts.stats.voxelsRemoved);
    const limit = 0.12 + 2 * SIZE; // carveRadius + 2*voxelSize, in metres
    for (const v of gone) {
      const c = new THREE.Vector3((v.x + 0.5) * SIZE, (v.y + 0.5) * SIZE, (v.z + 0.5) * SIZE);
      expect(c.distanceTo(hitPoint!), `voxel ${v} too far`).toBeLessThanOrEqual(limit);
    }
  });

  it("6. a dart fired at a concrete block removes nothing (it only scuffs)", () => {
    const { target, world } = makeWall(materialId("concrete"));
    const darts = makeDarts(world);
    const debris = new DebrisSystem(RAPIER, world);
    const impacts = new DartImpacts(darts, debris, [target]);
    darts.fire(new THREE.Vector3(0.5, 0.25, 1), new THREE.Vector3(0, 0, -1), "standard");
    until(() => impacts.stats.hits === 1, darts, world);
    expect(impacts.stats.carves).toBe(0);
    expect(impacts.stats.voxelsRemoved).toBe(0);
  });

  it("7. a suction dart stuck to the block is released when a standard dart carves near it, and a stuck dart 1 m away is not", () => {
    const { target, world } = makeWall(materialId("foam-orange"));
    const darts = makeDarts(world);
    const debris = new DebrisSystem(RAPIER, world);
    const impacts = new DartImpacts(darts, debris, [target]);
    // Stick one dart at x 0.5 and one a metre away at x 1.5.
    darts.fire(new THREE.Vector3(0.5, 0.25, 1), new THREE.Vector3(0, 0, -1), "suction");
    darts.fire(new THREE.Vector3(1.5, 0.25, 1), new THREE.Vector3(0, 0, -1), "suction");
    until(() => darts.stats().stuck === 2, darts, world);
    // A standard dart carves at x 0.5. The two suction sticks already carved
    // a little on impact, so wait for the third hit, not for any carve.
    darts.fire(new THREE.Vector3(0.5, 0.25, 1.5), new THREE.Vector3(0, 0, -1), "standard");
    until(() => impacts.stats.hits >= 3, darts, world);
    // The near dart (sunk 0.048 m into the surface, inside the release
    // radius of 0.12 + 0.1 m) has dropped off; the far one still rides.
    expect(darts.stats().stuck).toBe(1);
  });

  it("8. a dart stuck to a fixed collider stays stuck after that collider is removed and recreated in its place (a remesh)", () => {
    const { world, collider } = makeWall(materialId("foam-orange"));
    const darts = makeDarts(world);
    darts.fire(new THREE.Vector3(0.5, 0.25, 1), new THREE.Vector3(0, 0, -1), "suction");
    until(() => darts.stats().stuck === 1, darts, world);
    // Remesh: remove the collider and put an identical one back on the same
    // fixed body. With the stick() fix for fixed bodies, the dart holds.
    world.removeCollider(collider, false);
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(1.5, 0.25, 0.25).setTranslation(1.5, 0.25, 0.25),
    );
    darts.update(DT);
    world.step();
    expect(darts.stats().stuck).toBe(1);
  });
});
