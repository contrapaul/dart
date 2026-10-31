import { beforeAll, describe, expect, it } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { linearColorTable } from "../../src/voxel/materials";
import { greedyMesh } from "../../src/voxel/mesher";
import type { Mesher } from "../../src/voxel/pieces";
import { DebrisSystem } from "../../src/voxel/debris";
import { DartSystem } from "../../src/weapons/darts";
import { DartImpacts, type VoxelTarget } from "../../src/weapons/impacts";
import { FoamerSystem } from "../../src/foamers/foamers";
import foamerData from "../../data/foamers.json";
import destructionData from "../../data/destruction.json";

const DT = 1 / 60;
const SPEC = foamerData.test;
const ATTACK = SPEC.attacks[0]!;
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

beforeAll(async () => {
  await RAPIER.init();
});

describe("test Foamer (ENG-10, rig F01)", () => {
  it.skip("1. buildTestFoamer: single-volume model test moved to the per-part tests in parts.test.ts (stage 1)", () => {});

  it("2. spawn: the root plus one body per F01 part exist, every part is a target, and the max caps the spawn", async () => {
    const r = rig();
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 0));
    expect(f).not.toBeNull();
    expect(r.foamers.live).toBe(1);
    expect(f!.parts.size).toBe(9); // F01 has nine parts
    r.world.step();
    for (const part of f!.parts.values()) {
      expect(r.targets, part.spec.id).toContain(part);
      expect(r.world.getRigidBody(part.body.handle), part.spec.id).not.toBeNull();
    }
    expect(r.world.getRigidBody(f!.root.handle)).not.toBeNull();
    await settle(f!.parts.get("body")!.mesh, r.world);
    expect(shapesOf(r.world, f!.parts.get("body")!.body.handle).trimesh).toBeGreaterThan(0);
    expect(shapesOf(r.world, f!.root.handle).other).toBe(1); // only the capsule
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
    // F01's rig speed is 1.0 m/s; two seconds of it.
    expect(f.centre.z).toBeGreaterThan(1.5);
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

  it("5. bonks once at the end of the windup, and not again until a full cycle has passed", () => {
    const r = rig();
    const player = new THREE.Vector3(0, 1.6, 1);
    r.foamers.onBonk = () => {};
    r.foamers.spawn(new THREE.Vector3(0, 0, 0));
    // The Foamer spawns in attack range, so it winds up straight away.
    const t1 = Math.ceil((ATTACK.windup + 0.1) / DT); // first bonk must be in by here
    for (let i = 0; i < t1; i++) tick(r, player);
    expect(r.foamers.stats.bonks, "no bonk by windup end").toBe(1);
    // A full cycle: windup, strike, recover and the next windup. The
    // second bonk is not yet due here.
    const t2 = Math.ceil((ATTACK.windup + ATTACK.strike + SPEC.recover + ATTACK.windup) / DT);
    for (let i = t1; i < t2; i++) tick(r, player);
    expect(r.foamers.stats.bonks, "second bonk before a full cycle").toBe(1);
  });

  it("6. a standard dart lowers the health, counts a hit and carves voxels", async () => {
    const r = rig();
    const player = new THREE.Vector3(0, 1.6, 5);
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 0))!;
    // Aim at the centre of the body part (the capsule sits inside the body's
    // voxels, so a centre dart always finds the body).
    const body = f.parts.get("body")!;
    const before = body.voxelCount;
    await settle(body.mesh, r.world);
    const aim = body.voxelToWorld(new THREE.Vector3(
      body.spec.size[0] / 2, body.spec.size[1] / 2, body.spec.size[2] / 2 + 0.5));
    r.darts.fire(new THREE.Vector3(aim.x, aim.y, aim.z + 5), new THREE.Vector3(0, 0, -1), "standard");
    for (let i = 0; i < 120 && r.foamers.stats.hits === 0; i++) tick(r, player);
    expect(r.foamers.stats.hits).toBe(1);
    expect(f.health).toBeCloseTo(f.maxHealth - SPEC.damage.standard, 5);
    expect(body.voxelCount).toBeLessThan(before);
  });

  it("7. darts down to zero pop it: out of the lists, bodies gone, foam chunks flying", async () => {
    const r = rig();
    // The player stands one metre from the Foamer, in reach of its bonk,
    // so it holds still through the fight.
    const player = new THREE.Vector3(0, 1.6, 1);
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 0))!;
    const rootHandle = f.root.handle;
    const partHandles = [...f.parts.values()].map((p) => p.body.handle);
    // The body part must be meshed, so its trimesh collider exists: the
    // darts carve the part, not the root capsule.
    await settle(f.parts.get("body")!.mesh, r.world);
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
    for (const part of f.parts.values()) expect(r.targets).not.toContain(part);
    expect(r.world.getRigidBody(rootHandle)).toBeNull();
    for (const h of partHandles) expect(r.world.getRigidBody(h)).toBeNull();
    expect(r.debris.live).toBeGreaterThan(0);
    expect(r.debris.live).toBeLessThanOrEqual(DEBRIS_CAP);
  });

  it("8. a stuck suction dart rides a walking Foamer, and drops when it pops", async () => {
    const r = rig();
    const player = new THREE.Vector3(0, 1.6, 10);
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 0))!;
    const rootHandle = f.root.handle;
    await settle(f.parts.get("body")!.mesh, r.world);
    r.darts.fire(new THREE.Vector3(0, 0.8, 8), new THREE.Vector3(0, 0, -1), "suction");
    for (let i = 0; i < 120 && r.darts.stats().stuck < 1; i++) tick(r, player);
    expect(r.darts.stats().stuck).toBe(1);
    const mesh = (r.darts as unknown as { meshes: Record<string, THREE.InstancedMesh> }).meshes.suction;
    const m0 = new THREE.Matrix4();
    mesh.getMatrixAt(0, m0);
    const dart0 = new THREE.Vector3();
    dart0.setFromMatrixPosition(m0);
    const start = f.centre.clone();
    for (let i = 0; i < 60; i++) tick(r, player);
    const mv = new THREE.Matrix4();
    mesh.getMatrixAt(0, mv);
    const dart1 = new THREE.Vector3();
    dart1.setFromMatrixPosition(mv);
    const moved = f.centre.clone().sub(start);
    expect(dart1.distanceTo(dart0.add(moved))).toBeLessThan(0.05);
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
    expect(r.world.getRigidBody(rootHandle)).toBeNull();
    for (let i = 0; i < 30; i++) tick(r, player);
    expect(r.darts.stats().stuck).toBe(0);
  });

  it("8b. a suction dart that lands the popping hit falls clear instead of sticking to the removed body", async () => {
    const r = rig();
    const player = new THREE.Vector3(0, 1.6, 1);
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 0))!;
    await settle(f.parts.get("body")!.mesh, r.world);
    f.health = SPEC.damage.suction;
    r.darts.fire(new THREE.Vector3(0, 0.8, 3), new THREE.Vector3(0, 0, -1), "suction");
    for (let i = 0; i < 120 && r.foamers.stats.popped === 0; i++) tick(r, player);
    expect(r.foamers.stats.popped).toBe(1);
    for (let i = 0; i < 30; i++) tick(r, player);
    expect(r.darts.stats().stuck).toBe(0);
  });

  it.skip("3b. single-mesh alignment for a turned Foamer replaced by per-part tests in parts.test.ts (stage 1)", () => {});

  it("3c. syncRender(alpha) draws each part between its last two steps", () => {
    const r = rig();
    const player = new THREE.Vector3(0, 1.6, 10);
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 0))!;
    r.world.step();
    f.poseParts(DT, true);
    for (let i = 0; i < 10; i++) tick(r, player);
    const part = f.parts.get("body")!;
    const pPrev = new THREE.Vector3().setFromMatrixPosition(part.prevPose);
    const pNow = new THREE.Vector3().setFromMatrixPosition(part.pose);
    expect(pNow.distanceTo(pPrev)).toBeGreaterThan(0.01); // it is walking at 1 m/s
    f.syncRender(0);
    expect(part.group.matrix.elements[12]).toBeCloseTo(pPrev.x, 6);
    expect(part.group.matrix.elements[13]).toBeCloseTo(pPrev.y, 6);
    f.syncRender(0.5);
    part.group.updateWorldMatrix(false, false);
    const mid = pPrev.clone().lerp(pNow, 0.5);
    expect(part.group.matrix.elements[12] - mid.x).toBeCloseTo(0, 5);
    expect(part.group.matrix.elements[13] - mid.y).toBeCloseTo(0, 5);
    f.syncRender(1);
    expect(part.group.matrix.elements[12]).toBeCloseTo(pNow.x, 6);
    expect(part.group.matrix.elements[13]).toBeCloseTo(pNow.y, 6);
  });
});
