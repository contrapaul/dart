import { beforeAll, describe, expect, it } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { linearColorTable } from "../../src/voxel/materials";
import { greedyMesh } from "../../src/voxel/mesher";
import { DebrisSystem } from "../../src/voxel/debris";
import { DartSystem } from "../../src/weapons/darts";
import { DartImpacts, type VoxelTarget } from "../../src/weapons/impacts";
import { FoamerSystem } from "../../src/foamers/foamers";
import { ProjectileSystem, BALL_MATERIAL } from "../../src/foamers/projectiles";
import foamerData from "../../data/foamers.json";

// GAME-10a: the F02 Roamer's foam ball. The rig is the one from
// tests/foamers/foamers.test.ts plus the projectile system.

const DT = 1 / 60;
const BALL = foamerData.test.ball;

function fakeMesher() {
  const colors = linearColorTable();
  return { mesh: (padded: Uint8Array) => Promise.resolve(greedyMesh(padded, colors)) };
}

function rig() {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.createCollider(RAPIER.ColliderDesc.cuboid(40, 0.5, 40).setTranslation(0, -0.5, 0));
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  // A player capsule at (0, 1, 8), like the real controller's.
  const playerBody = world.createRigidBody(
    RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, 1, 8),
  );
  const playerCollider = world.createCollider(
    RAPIER.ColliderDesc.capsule(0.55, 0.35).setTranslation(0, 0, 0),
    playerBody,
  );
  const ignore = world.createCollider(
    RAPIER.ColliderDesc.capsule(0.5, 0.3).setTranslation(0, 0, 200),
    body,
  );
  const darts = new DartSystem(new THREE.Scene(), world, RAPIER, ignore);
  const debris = new DebrisSystem(RAPIER, world);
  const targets: VoxelTarget[] = [];
  const foamers = new FoamerSystem(RAPIER, world, fakeMesher(), debris, darts, targets);
  new DartImpacts(darts, debris, targets);
  const projectiles = new ProjectileSystem(RAPIER, world, debris, playerCollider, foamers);
  foamers.projectiles = projectiles;
  return { world, darts, debris, foamers, projectiles, playerCollider };
}

function tick(r: ReturnType<typeof rig>, player: THREE.Vector3) {
  r.darts.update(DT);
  r.foamers.update(DT, player);
  r.projectiles.update(DT);
  r.world.step();
  r.darts.syncRender();
}

beforeAll(async () => {
  await RAPIER.init();
});

describe("the foam ball (GAME-10a)", () => {
  it("flies from the hand and bursts on the floor", () => {
    const r = rig();
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 0))!;
    const eye = new THREE.Vector3(0, 1.6, 8);
    r.projectiles.launch(f, eye);
    expect(r.projectiles.list.length).toBe(1);
    const before = r.debris.live;
    for (let i = 0; i < 60 * 4 && r.projectiles.list.length; i++) tick(r, eye);
    expect(r.projectiles.stats.burst, "it burst").toBe(1);
    expect(r.debris.live, "the burst threw chunks").toBeGreaterThan(before);
  });

  it("hurts the player once, through its capsule", () => {
    const r = rig();
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 4))!;
    let hits = 0;
    r.projectiles.onHitPlayer = () => hits++;
    const eye = new THREE.Vector3(0, 1, 8); // the capsule's centre height
    r.projectiles.launch(f, eye);
    for (let i = 0; i < 60 * 3 && r.projectiles.list.length; i++) tick(r, eye);
    expect(hits, "one hit").toBe(1);
    expect(r.projectiles.list.length, "and it is gone").toBe(0);
  });

  it("caps the live count and keeps all the meshes in its group", () => {
    const r = rig();
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 0))!;
    const eye = new THREE.Vector3(0, 1.6, 30);
    for (let i = 0; i < BALL.maxLive + 4; i++) r.projectiles.launch(f, eye);
    expect(r.projectiles.list.length, "the hard cap").toBe(BALL.maxLive);
    expect(r.projectiles.group.children.length,
      "every live ball has its mesh, and no dead ones").toBe(BALL.maxLive);
    expect(r.projectiles.stats.thrown, "each launch counted").toBe(BALL.maxLive + 4);
  });

  it("flies at the data's speed and every ball shares one material", () => {
    const r = rig();
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 0))!;
    r.projectiles.launch(f, new THREE.Vector3(0, 1.6, 30));
    const b = r.projectiles.list[0]!;
    const flat = Math.hypot(b.vel.x, b.vel.z);
    expect(flat, "horizontal speed is the data's").toBeCloseTo(BALL.speed, 1);
    expect(b.mesh.material, "the shared material the parry looks up").toBe(BALL_MATERIAL);
  });

  it("an F02's strike launches a ball; a bonk launches none", () => {
    const r = rig();
    const eye = new THREE.Vector3(0, 1.6, 8);
    const thrower = r.foamers.spawn(new THREE.Vector3(0, 0, 4), undefined, "F02")!;
    void thrower;
    for (let i = 0; i < 60 * 20; i++) tick(r, eye);
    expect(r.projectiles.stats.thrown, "the thrower threw").toBeGreaterThan(0);
    expect(r.foamers.stats.bonks, "and bonked once (the bonk attack)").toBe(0);
  });
});
