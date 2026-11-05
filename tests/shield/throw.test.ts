import { beforeAll, describe, expect, it } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { Shield } from "../../src/player/shield";
import type { PlayerController } from "../../src/player/controller";
import type { Loadout } from "../../src/weapons/loadout";
import type { Foamer } from "../../src/foamers/foamer";
import { FoamerSystem } from "../../src/foamers/foamers";
import { DartSystem } from "../../src/weapons/darts";
import { DebrisSystem } from "../../src/voxel/debris";
import type { VoxelTarget } from "../../src/weapons/impacts";
import { VoxelVolume } from "../../src/voxel/chunk";
import { greedyMesh } from "../../src/voxel/mesher";
import { linearColorTable } from "../../src/voxel/materials";
import shieldJson from "../../data/shield.json";
import playerJson from "../../data/player.json";

// GAME-04 stage 1: the throw. A real Rapier world with the floor, four
// voxel walls (one as a sight blocker and one as the carve target), real
// spawned Foamers (their parts are the surfaces the disc meets), and the
// same fake player and loadout as block.test.ts. The disc flies from the
// left hand along the view; every number it obeys is in data/shield.json.

const DT = 1 / 60;
const T = shieldJson as unknown as typeof shieldJson;
const EYE = playerJson.eyeHeight;
const VS = 0.1; // the wall volume's voxel size
const FOAM = 3; // the foam material id used by the wall

const LOWERED = {
  fireHeld: false, firePressed: false, shieldHeld: false, shieldPressed: false,
  reloadPressed: false,
};
const HELD = { ...LOWERED, shieldHeld: true };
const THROW = { ...LOWERED, shieldHeld: true, fireHeld: true, firePressed: true };

function fakeMesher() {
  const colors = linearColorTable();
  return { mesh: (padded: never) => Promise.resolve(greedyMesh(padded, colors)) };
}

/** A 1 m x 3 m x 3 m voxel wall with a matching fixed collider. The centre
 *  sits at (x, 1.5, z), its faces 0.5 m in x on either side. */
function makeWall(world: RAPIER.World, x: number, z: number) {
  const volume = new VoxelVolume(VS);
  volume.fillBox(0, 0, 0, 9, 29, 29, FOAM);
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  const collider = world.createCollider(
    RAPIER.ColliderDesc.cuboid(0.5, 1.5, 1.5).setTranslation(x, 1.5, z),
    body,
  );
  const target: VoxelTarget = {
    volume,
    owns: (c) => c === collider,
    worldToVoxel: (v) => v.set(v.x - (x - 0.5), v.y, v.z - (z - 1.5)).divideScalar(VS),
    voxelToWorld: (v) => v.multiplyScalar(VS).set(v.x + x - 0.5, v.y, v.z + z - 1.5),
  };
  return { target, collider };
}

/** World with a floor, a carve wall straight ahead at z = -10, and the
 *  rig's spawner, darts and debris (as the Foamer tests build theirs). */
function rig() {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.createCollider(RAPIER.ColliderDesc.cuboid(40, 0.5, 40).setTranslation(0, -0.5, 0));
  const pb = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  const ignore = world.createCollider(
    RAPIER.ColliderDesc.capsule(0.5, 0.3).setTranslation(0, 0, 200),
    pb,
  );
  const scene = new THREE.Scene();
  const darts = new DartSystem(scene, world, RAPIER, ignore);
  const debris = new DebrisSystem(RAPIER, world);
  const targets: VoxelTarget[] = [];
  const foamers = new FoamerSystem(RAPIER, world, fakeMesher(), debris, darts, targets);
  const carveWall = makeWall(world, 0, -10);
  targets.push(carveWall.target);
  const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 100);
  camera.rotation.order = "YXZ";
  camera.position.set(0, EYE, 0);
  // The player's capsule is real (the flying disc's rays exclude it by
  // identity, as they exclude the real capsule in the game).
  const playerCollider = world.createCollider(
    RAPIER.ColliderDesc.capsule(0.6, 0.3).setTranslation(0, 0.9, 0),
  );
  const player = {
    vel: new THREE.Vector3(), pitch: 0, yaw: 0, speedScale: 1, allowSprint: true,
    collider: playerCollider,
  } as unknown as PlayerController;
  const shield = new Shield(
    RAPIER, world, scene, camera, player, { switching: false } as unknown as Loadout,
    foamers, debris, targets,
  );
  camera.add(shield.group);
  world.step();
  return { world, scene, camera, player, shield, foamers, targets, carveWall, settle };
  /** Let the parts' remesh promises land, then step so colliders exist. */
  async function settle() {
    for (const f of foamers.list) for (const p of f.parts.values()) p.mesh.update();
    await new Promise((r) => setTimeout(r, 0));
    world.step();
  }
}

/** Tilt the view at the Foamer's chest (a player aims; the disc flies
 *  along the view). */
function aimAt(g: ReturnType<typeof rig>, f: Foamer) {
  const dx = f.centre.x - g.camera.position.x;
  const dz = f.centre.z - g.camera.position.z;
  g.player.yaw = Math.atan2(-dx, -dz);
  g.player.pitch = Math.atan2(f.centre.y + f.height * 0.5 - EYE, Math.hypot(dx, dz));
  g.camera.rotation.set(g.player.pitch, g.player.yaw, 0);
}

/** Raise the disc and hold it there. */
async function raised(g: ReturnType<typeof rig>) {
  for (let i = 0; i < 60 && g.shield.state !== "raised"; i++) g.shield.update(DT, HELD);
  for (let i = 0; i < 60 && g.shield.raise < 1; i++) g.shield.update(DT, HELD);
  expect(g.shield.state).toBe("raised");
}

/** One step of everything the disc flies through. */
function tick(g: ReturnType<typeof rig>, dt = DT) {
  g.foamers.update(dt, new THREE.Vector3(0, 0, 0));
  g.world.step();
}

/** Throw (the disc must be raised, and the view aimed) and run until it is
 *  caught or the budget runs out, recording the Foamers struck in order (a
 *  strike's point is the victim's feet centre, so each point names it). */
function throwAndCatch(g: ReturnType<typeof rig>, aim?: Foamer, cap = 600) {
  if (aim) aimAt(g, aim);
  const e = g.shield.update(DT, THROW);
  expect(e.thrown).toBe(true);
  expect(g.shield.state).toBe("thrown");
  const struck: Foamer[] = [];
  for (let i = 0; g.shield.state !== "lowered"; i++) {
    if (i >= cap) throw new Error(`the disc never came home (state ${g.shield.state})`);
    const ev = g.shield.update(DT, LOWERED);
    for (const p of ev.hits) {
      const f = g.foamers.list.find((o) => Math.abs(o.centre.distanceToSquared(p)) < 1e-9);
      expect(f, "a hit point names a live Foamer").toBeDefined();
        struck.push(f!);
    }
    tick(g);
  }
  expect(g.shield.state).toBe("lowered");
  return struck;
}

beforeAll(async () => {
  await RAPIER.init();
});

describe("Shield throw (ricochet, return, block again)", () => {
  it("1. the disc strikes at most 1 + bounces Foamers, nearest first, never the same one twice in a row", async () => {
    const g = rig();
    // Three in a fan ahead, one just outside the ricochet range of the
    // others, and a wall straight ahead that must not cut the flight short.
    const near = g.foamers.spawn(new THREE.Vector3(0, 0, -4))!;
    const left = g.foamers.spawn(new THREE.Vector3(-1.6, 0, -5.5))!;
    const right = g.foamers.spawn(new THREE.Vector3(2.6, 0, -6))!;
    await raised(g);
    const struck = throwAndCatch(g, near);
    // The ricochet takes the nearest Foamer in sight each time, so after
    // left it comes back to the nearer near: never the same one twice in
    // a row, but a Foamer may be struck again with another between.
    expect(struck.length).toBe(1 + T.throw.bounces);
    expect(struck[0]).toBe(near); // the first in the path is the nearest
    expect(struck[1]).toBe(left); // left is nearer than right from near
    expect(struck[2]).toBe(near); // near is nearer than right from left
    expect(struck[1]).not.toBe(struck[0]);
    expect(struck[2]).not.toBe(struck[1]);
    void right;
  });

  it("2. each struck Foamer staggers for the data's time and takes its damage", async () => {
    const g = rig();
    const f = g.foamers.spawn(new THREE.Vector3(0, 0, -4))!;
    const hp0 = f.health;
    await raised(g);
    const struck = throwAndCatch(g, f);
    expect(struck[0]).toBe(f);
    // After the catch the stagger has long ended (the flight home is
    // seconds), so check the wobble state during it in test 4's terms.
    // GAME-04c: the disc now lodges and grinds the Foamer before the
    // ricochet, so the total cost is the throw's damage plus the grind's
    // ticks; the saw's own tests (tests/player/saw.test.ts) pin that.
    expect(f.health).toBeLessThan(hp0 - T.throw.damage + 1e-6);
  });

  it("3. the disc returns and blocking works again after the catch", async () => {
    const g = rig();
    g.foamers.spawn(new THREE.Vector3(0, 0, -4));
    await raised(g);
    throwAndCatch(g);
    // Back on the arm: the viewmodel is visible again, and the disc mesh
    // is hidden.
    expect(g.shield.group.visible).toBe(true);
    expect(g.shield.discMesh.visible).toBe(false);
    // It can go up and block again at once (the cooldown is for throws).
    for (let i = 0; i < 60 && g.shield.state !== "raised"; i++) g.shield.update(DT, HELD);
    for (let i = 0; i < 60 && g.shield.raise < 1; i++) g.shield.update(DT, HELD);
    expect(g.shield.blocksAttackFrom(new THREE.Vector3(0, EYE, -2))).toBe(true);
  });

  it("4. after a catch the next throw waits for the cooldown", async () => {
    const g = rig();
    g.foamers.spawn(new THREE.Vector3(0, 0, -4));
    await raised(g);
    throwAndCatch(g);
    // Still raised the instant it is caught: a press inside the cooldown
    // does not throw.
    for (let i = 0; i < 60 && g.shield.state !== "raised"; i++) g.shield.update(DT, HELD);
    for (let i = 0; i < 60 && g.shield.raise < 1; i++) g.shield.update(DT, HELD);
    const e = g.shield.update(DT, THROW);
    expect(e.thrown).toBe(false);
    // Past the cooldown it throws again.
    for (let i = 0; i < Math.ceil(T.cooldown / DT) + 2; i++) g.shield.update(DT, HELD);
    const e2 = g.shield.update(DT, THROW);
    expect(e2.thrown).toBe(true);
  });

  it("5. a wall cuts the flight: the disc turns for home and carves the wall", async () => {
    const g = rig();
    // Nothing in the way: the disc hits the carve wall at z = -9.5.
    const before = countFilled(g.carveWall.target.volume);
    await raised(g);
    throwAndCatch(g);
    expect(countFilled(g.carveWall.target.volume)).toBeLessThan(before);
  });

  it("6. past the range with nothing to hit it comes straight back", async () => {
    const g = rig();
    // Remove the wall so the range limit is what turns it around.
    g.targets.length = 0;
    g.world.removeCollider(g.carveWall.collider, false);
    await raised(g);
    throwAndCatch(g);
    expect(g.shield.state).toBe("lowered");
  });

  it("7. the ricochet picks the nearest Foamer in sight, not one behind cover", async () => {
    const g = rig();
    const near = g.foamers.spawn(new THREE.Vector3(0, 0, -4))!;
    const blocked = g.foamers.spawn(new THREE.Vector3(0.2, 0, -8))!;
    const clear = g.foamers.spawn(new THREE.Vector3(1.2, 0, -5))!;
    // Put a sight wall between the disc's line and `blocked`: its face
    // spans x -0.4 to 0.6, and the line to blocked crosses z = -6.6 at
    // x = 0.13, inside it.
    const sight = makeWall(g.world, 0.1, -6.6);
    g.targets.push(sight.target);
    await raised(g);
    const struck = throwAndCatch(g, near);
    expect(struck[0]).toBe(near);
    expect(struck).toContain(clear);
    expect(struck).not.toContain(blocked);
  });
});

function countFilled(volume: VoxelVolume): number {
  let n = 0;
  for (const chunk of volume.chunks.values())
    for (let y = 0; y < 32; y++)
      for (let z = 0; z < 32; z++)
        for (let x = 0; x < 32; x++) if (chunk.get(x, y, z) !== 0) n++;
  return n;
}
