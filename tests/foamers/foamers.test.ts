import { beforeAll, describe, expect, it } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { VoxelVolume } from "../../src/voxel/chunk";
import { linearColorTable } from "../../src/voxel/materials";
import { greedyMesh } from "../../src/voxel/mesher";
import type { Mesher } from "../../src/voxel/pieces";
import { DebrisSystem } from "../../src/voxel/debris";
import { DartSystem } from "../../src/weapons/darts";
import { DartImpacts, type VoxelTarget } from "../../src/weapons/impacts";
import { buildTestFoamer } from "../../src/foamers/foamer-model";
import { FoamerSystem } from "../../src/foamers/foamers";
import foamerData from "../../data/foamers.json";
import destructionData from "../../data/destruction.json";

const DT = 1 / 60;
const SPEC = foamerData.test;
const SIZE = [SPEC.size[0], SPEC.size[1], SPEC.size[2]] as [number, number, number];
const DEBRIS_CAP = destructionData.debris.max;

/** Node has no Worker: mesh synchronously on the main thread, as the
 *  worker does. */
function fakeMesher(): Mesher {
  const colors = linearColorTable();
  return { mesh: (padded) => Promise.resolve(greedyMesh(padded, colors)) };
}

/** Let pending remesh promises resolve, then step once more so the
 *  colliders built from them exist in the world. */
async function settle(mesh: { update(): void }, world: RAPIER.World) {
  mesh.update();
  await new Promise((r) => setTimeout(r, 0));
  world.step();
}

/** World, floor, debris, darts (ignore collider 200 m away), impacts, the
 *  Foamer system and the shared target list. */
function rig() {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.createCollider(RAPIER.ColliderDesc.cuboid(40, 0.5, 40).setTranslation(0, -0.5, 0));
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  const ignore = world.createCollider(
    RAPIER.ColliderDesc.capsule(0.5, 0.3).setTranslation(0, 0, 200),
    body,
  );
  const darts = new DartSystem(new THREE.Scene(), world, RAPIER, ignore);
  const debris = new DebrisSystem(RAPIER, world);
  const targets: VoxelTarget[] = [];
  const foamers = new FoamerSystem(RAPIER, world, fakeMesher(), debris, darts, targets);
  new DartImpacts(darts, debris, targets);
  world.step();
  return { world, darts, debris, targets, foamers };
}

/** One game step: darts, Foamers, world, then refresh the dart instances. */
function tick(r: ReturnType<typeof rig>, player: THREE.Vector3, dt = DT) {
  r.darts.update(dt);
  r.foamers.update(dt, player);
  r.world.step();
  r.darts.syncRender();
}

/** Dart position through the instance matrix, as the darts tests read them. */
function dartPos(r: ReturnType<typeof rig>, type: "standard" | "suction") {
  const mesh = (r.darts as unknown as { meshes: Record<string, THREE.InstancedMesh> }).meshes[type];
  const m = new THREE.Matrix4();
  mesh.getMatrixAt(0, m);
  const p = new THREE.Vector3();
  m.decompose(p, new THREE.Quaternion(), new THREE.Vector3());
  return p;
}

/** Shape counts of the live colliders on one body. */
function shapesOf(world: RAPIER.World, handle: number) {
  const shapes: number[] = [];
  world.forEachCollider((c) => {
    const parent = c.parent();
    if (parent && parent.handle === handle) shapes.push(c.shape.type);
  });
  return {
    trimesh: shapes.filter((s) => s === RAPIER.ShapeType.TriMesh).length,
    other: shapes.filter((s) => s !== RAPIER.ShapeType.TriMesh).length,
  };
}

function countVoxels(volume: VoxelVolume) {
  return [...volume.chunks.values()].reduce((n, c) => n + c.count, 0);
}

beforeAll(async () => {
  await RAPIER.init();
});

describe("test Foamer (GAME-03)", () => {
  it("1. buildTestFoamer: inside the box, one chunk, x-mirror-symmetric, front-half foam-white and ink eyes", () => {
    const volume = new VoxelVolume(SPEC.voxelSize);
    buildTestFoamer(volume, SIZE);
    expect(volume.chunks.size).toBe(1);
    const [sx, sy, sz] = SIZE;
    const chunk = [...volume.chunks.values()][0]!;
    let white = 0;
    let ink = 0;
    for (let y = 0; y < sy; y++)
      for (let z = 0; z < sz; z++)
        for (let x = 0; x < sx; x++) {
          const m = chunk.get(x, y, z);
          if (m === 0) continue;
          expect(chunk.get(sx - 1 - x, y, z)).toBe(m);
          if (m === 7 || m === 8) {
            expect(z).toBeGreaterThanOrEqual(Math.floor(sz / 2));
          }
          if (m === 7) white++;
          if (m === 8) ink++;
        }
    expect(white).toBeGreaterThan(0);
    expect(ink).toBeGreaterThan(0);
  });

  it("2. spawn feeds the targets, meshing grows a capsule plus a trimesh, and the max caps the spawn", async () => {
    const r = rig();
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 0));
    expect(f).not.toBeNull();
    expect(r.foamers.live).toBe(1);
    expect(r.targets).toContain(f);
    expect(r.foamers.stats.spawned).toBe(1);
    await settle(f!.mesh, r.world);
    expect(shapesOf(r.world, f!.body.handle).trimesh).toBeGreaterThan(0);
    expect(shapesOf(r.world, f!.body.handle).other).toBeGreaterThan(0);
    for (let i = 1; i < foamerData.spawner.max; i++) {
      expect(r.foamers.spawn(new THREE.Vector3(i, 0, 5))).not.toBeNull();
    }
    expect(r.foamers.spawn(new THREE.Vector3(20, 0, 5))).toBeNull();
    expect(r.foamers.live).toBe(foamerData.spawner.max);
  });

  it("3. walks toward the player, keeps its footing, and stays oriented on the player", () => {
    const r = rig();
    const player = new THREE.Vector3(0, 1.6, 10);
    r.foamers.spawn(new THREE.Vector3(0, 0, 0));
    for (let i = 0; i < 120; i++) tick(r, player);
    const f = r.foamers.list[0]!;
    expect(f.centre.z).toBeGreaterThan(3);
    expect(f.centre.y).toBeCloseTo(0, 1);
    const facing = new THREE.Vector3(Math.sin(f.yaw), 0, Math.cos(f.yaw));
    const toPlayer = player.clone().sub(f.centre).setY(0).normalize();
    expect(facing.dot(toPlayer)).toBeGreaterThan(Math.cos(0.1));
  });

  it("4. does not pass through a box in its path", () => {
    const r = rig();
    // A 4 x 2 x 0.5 m fixed box centred at (0, 1, 3).
    r.world.createCollider(RAPIER.ColliderDesc.cuboid(2, 1, 0.25).setTranslation(0, 1, 3));
    const player = new THREE.Vector3(0, 1.6, 10);
    r.foamers.spawn(new THREE.Vector3(0, 0, 0));
    for (let i = 0; i < 240; i++) tick(r, player);
    expect(r.foamers.list[0]!.centre.z).toBeLessThan(3);
  });

  it("5. bonks exactly once by windup + 0.1 s, and not again early", () => {
    const r = rig();
    const player = new THREE.Vector3(0, 1.6, 1);
    r.foamers.onBonk = () => {};
    r.foamers.spawn(new THREE.Vector3(0, 0, 0));
    const t1 = Math.ceil((SPEC.windup + 0.1) / DT); // first bonk must be in by here
    const t2 = Math.ceil((SPEC.windup + SPEC.recover + SPEC.windup) / DT); // second bonk only after this
    for (let i = 0; i < t1; i++) tick(r, player);
    expect(r.foamers.stats.bonks, "no bonk by windup + 0.1 s").toBe(1);
    for (let i = 0; i < t2 - t1; i++) tick(r, player);
    expect(r.foamers.stats.bonks, "second bonk before windup + recover + windup").toBe(1);
  });

  it("6. a standard dart lowers the health, counts a hit and carves voxels", async () => {
    const r = rig();
    const player = new THREE.Vector3(0, 1.6, 5);
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 0))!;
    const before = countVoxels(f.volume);
    await settle(f.mesh, r.world);
    r.darts.fire(new THREE.Vector3(0, 0.8, 5), new THREE.Vector3(0, 0, -1), "standard");
    for (let i = 0; i < 120 && r.foamers.stats.hits === 0; i++) tick(r, player);
    expect(r.foamers.stats.hits).toBe(1);
    expect(f.health).toBeCloseTo(SPEC.health - SPEC.damage.standard, 5);
    expect(countVoxels(f.volume)).toBeLessThan(before);
  });

  it("7. darts down to zero pop it: out of the lists, body gone, foam chunks flying", () => {
    const r = rig();
    // The player stands one metre from the Foamer, in reach of its bonk,
    // so it holds still through the fight.
    const player = new THREE.Vector3(0, 1.6, 1);
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 0))!;
    const handle = f.body.handle;
    while (r.foamers.stats.popped === 0) {
      r.darts.fire(new THREE.Vector3(0, 0.8, 3), new THREE.Vector3(0, 0, -1), "standard");
      for (let i = 0; i < 120 && r.foamers.stats.popped === 0 && f.health > 0; i++) {
        tick(r, player);
      }
    }
    expect(r.foamers.stats.popped).toBe(1);
    expect(f.health).toBeLessThanOrEqual(0);
    expect(r.foamers.stats.hits).toBeGreaterThan(0);
    expect(r.foamers.live).toBe(0);
    expect(r.targets).not.toContain(f);
    expect(r.world.getRigidBody(handle)).toBeNull();
    expect(r.debris.live).toBeGreaterThan(0);
    expect(r.debris.live).toBeLessThanOrEqual(DEBRIS_CAP);
    // Any remesh promise that arrives afterwards must not throw.
    f.mesh.update();
    r.world.step();
  });

  it("8. a stuck suction dart rides a walking Foamer, and drops when it pops", async () => {
    const r = rig();
    const player = new THREE.Vector3(0, 1.6, 10);
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 0))!;
    const handle = f.body.handle;
    await settle(f.mesh, r.world);
    r.darts.fire(new THREE.Vector3(0, 0.8, 8), new THREE.Vector3(0, 0, -1), "suction");
    for (let i = 0; i < 120 && r.darts.stats().stuck < 1; i++) tick(r, player);
    expect(r.darts.stats().stuck).toBe(1);
    const start = f.centre.clone();
    const dart0 = dartPos(r, "suction").clone();
    for (let i = 0; i < 60; i++) tick(r, player);
    const moved = f.centre.clone().sub(start);
    const dartMoved = dartPos(r, "suction").clone().sub(dart0);
    expect(dartMoved.distanceTo(moved)).toBeLessThan(0.05);
    expect(r.darts.stats().stuck).toBe(1);
    while (r.foamers.stats.popped === 0) {
      const aim = f.centre.clone().setY(1.18);
      const dir = aim.clone().sub(new THREE.Vector3(0, 0.4, 3)).normalize();
      r.darts.fire(new THREE.Vector3(0, 0.4, 3), dir, "standard");
      for (let i = 0; i < 120 && r.foamers.stats.popped === 0 && f.health > 0; i++) {
        tick(r, player);
      }
    }
    expect(r.foamers.stats.popped).toBe(1);
    expect(r.world.getRigidBody(handle)).toBeNull();
    for (let i = 0; i < 30; i++) tick(r, player);
    expect(r.darts.stats().stuck).toBe(0);
  });

  it("8b. a suction dart that lands the popping hit falls clear instead of sticking to the removed body", async () => {
    const r = rig();
    const player = new THREE.Vector3(0, 1.6, 1);
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 0))!;
    await settle(f.mesh, r.world);
    f.health = SPEC.damage.suction;
    r.darts.fire(new THREE.Vector3(0, 0.8, 3), new THREE.Vector3(0, 0, -1), "suction");
    for (let i = 0; i < 120 && r.foamers.stats.popped === 0; i++) tick(r, player);
    expect(r.foamers.stats.popped).toBe(1);
    for (let i = 0; i < 30; i++) tick(r, player);
    expect(r.darts.stats().stuck).toBe(0);
  });

  it("3b. the drawn mesh lines up with the body for a turned Foamer", () => {
    const r = rig();
    const f = r.foamers.spawn(new THREE.Vector3(2, 0, -1))!;
    f.yaw = 1.1;
    f.applyPose();
    r.world.step();
    f.syncRender();
    f.group.updateWorldMatrix(true, true);
    for (const v of [[0, 0, 0], [SIZE[0], SIZE[1], SIZE[2]], [3, 20, 11]]) {
      const drawn = new THREE.Vector3(v[0], v[1], v[2])
        .multiplyScalar(SPEC.voxelSize)
        .applyMatrix4(f.mesh.group.matrixWorld);
      const body = f.voxelToWorld(new THREE.Vector3(v[0], v[1], v[2]));
      expect(drawn.distanceTo(body)).toBeLessThan(1e-4);
    }
  });

  it("3c. syncRender(alpha) draws the Foamer between its last two steps", () => {
    const r = rig();
    const player = new THREE.Vector3(0, 1.6, 10);
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 0))!;
    for (let i = 0; i < 10; i++) tick(r, player);
    f.syncRender(0);
    expect(f.group.position.distanceTo(f.prevCentre)).toBeLessThan(1e-6);
    f.syncRender(0.5);
    const mid = f.prevCentre.clone().lerp(f.centre, 0.5);
    expect(f.group.position.distanceTo(mid)).toBeLessThan(1e-6);
    expect(f.centre.distanceTo(f.prevCentre)).toBeGreaterThan(0.02); // it is walking
    f.syncRender(1);
    expect(f.group.position.distanceTo(f.centre)).toBeLessThan(1e-6);
  });
});
