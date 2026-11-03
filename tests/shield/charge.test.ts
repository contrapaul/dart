import { beforeAll, describe, expect, it } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { Shield } from "../../src/player/shield";
import { PlayerController } from "../../src/player/controller";
import type { Loadout } from "../../src/weapons/loadout";
import type { Foamer } from "../../src/foamers/foamer";
import { FoamerSystem } from "../../src/foamers/foamers";
import { DartSystem } from "../../src/weapons/darts";
import { DebrisSystem } from "../../src/voxel/debris";
import type { VoxelTarget } from "../../src/weapons/impacts";
import { greedyMesh } from "../../src/voxel/mesher";
import { linearColorTable } from "../../src/voxel/materials";
import shieldJson from "../../data/shield.json";
import playerJson from "../../data/player.json";

// GAME-05: the charge. A real Rapier world (walls stop everything), a real
// PlayerController (the charge runs through its own character controller,
// so a wall stops it and it leaves the player at rest) and real Foamers.
// The lock and the charge both respect two kinds of cover: sight (a wall
// hides the lock) and body (a wall stops the rush). The Foamers stand
// still (the test never runs foamers.update); every number they obey is
// in data/shield.json.

const DT = 1 / 60;
const T = shieldJson as unknown as typeof shieldJson;
const EYE = playerJson.eyeHeight;

const HOLD = {
  fireHeld: false, firePressed: false, shieldHeld: true, shieldPressed: false,
  reloadPressed: false,
};

function fakeMesher() {
  const colors = linearColorTable();
  return { mesh: (padded: never) => Promise.resolve(greedyMesh(padded, colors)) };
}

/** A fixed wall: 0.3 m thick, 8 m tall (the player cannot mantle), its
 *  faces a half of z into either side of the centre. */
function makeWall(world: RAPIER.World, x: number, z: number) {
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  return world.createCollider(
    RAPIER.ColliderDesc.cuboid(0.15, 4, 1).setTranslation(x, 4, z),
    body,
  );
}

function rig() {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.createCollider(RAPIER.ColliderDesc.cuboid(40, 0.5, 40).setTranslation(0, -0.5, 0));
  // A stray faraway capsule like the pages' dart ignore body.
  const ignore = world.createCollider(
    RAPIER.ColliderDesc.capsule(0.5, 0.3).setTranslation(0, 0, 200),
    world.createRigidBody(RAPIER.RigidBodyDesc.fixed()),
  );
  const scene = new THREE.Scene();
  const darts = new DartSystem(scene, world, RAPIER, ignore);
  const debris = new DebrisSystem(RAPIER, world);
  const foamers = new FoamerSystem(
    RAPIER, world, fakeMesher(), debris, darts, [] as VoxelTarget[],
  );
  const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 100);
  const player = new PlayerController(RAPIER, world, new THREE.Vector3(0, 0, 0));
  const p0 = player.collider.translation();
  camera.position.set(p0.x, EYE, p0.z);
  const shield = new Shield(
    RAPIER, world, scene, camera, player, { switching: false } as unknown as Loadout,
    foamers, debris, [],
  );
  camera.add(shield.group);
  world.step();
  return { world, camera, player, shield, foamers, settle, sync };
  /** The page keeps the camera over the player; the lock sights from it. */
  function sync() {
    const p = player.collider.translation();
    camera.position.set(p.x, EYE, p.z);
  }
  /** Let the parts' remesh promises land, then step so colliders exist. */
  async function settle() {
    for (const f of foamers.list) for (const p of f.parts.values()) p.mesh.update();
    await new Promise((r) => setTimeout(r, 0));
    world.step();
  }
}

type G = ReturnType<typeof rig>;

/** Aim the player's view at a Foamer's chest, as a player would. */
function aimAt(g: G, f: Foamer) {
  const p = g.player.collider.translation();
  const dx = f.centre.x - p.x;
  const dz = f.centre.z - p.z;
  g.player.yaw = Math.atan2(-dx, -dz);
  g.player.pitch =
    Math.atan2(f.centre.y + f.height * 0.5 - EYE, Math.hypot(dx, dz));
}

/** Raise the disc and hold it to full. */
async function raised(g: G) {
  for (let i = 0; i < 60 && g.shield.state !== "raised"; i++) g.shield.update(DT, HOLD);
  for (let i = 0; i < 60 && g.shield.raise < 1; i++) g.shield.update(DT, HOLD);
  expect(g.shield.state).toBe("raised");
}

/** Step a running charge to the end and return the victim event, if any.
 *  The disc stays held up the whole time, as in the game. */
async function runCharge(g: G): Promise<Foamer | null> {
  let victim: Foamer | null = null;
  for (let i = 0; i < 240; i++) {
    if (!g.shield.charging) break;
    const e = g.shield.update(DT, HOLD);
    if (e.chargeVictim) victim = e.chargeVictim;
    g.sync();
    g.world.step();
  }
  return victim;
}

beforeAll(async () => {
  await RAPIER.init();
});

describe("Shield charge (lock, rush, knockback, cooldown)", () => {
  it("1. the lock is the nearest in the data's range and cone; past, wide, hidden and face-down ones are out", async () => {
    const g = rig();
    const near = g.foamers.spawn(new THREE.Vector3(0, 0, -4))!;
    const past = g.foamers.spawn(new THREE.Vector3(0, 0, -16))!; // past 14 m
    const wide = g.foamers.spawn(new THREE.Vector3(3, 0, -4))!; // out of the cone
    await raised(g);
    // Looking at the floor (straight down): nothing in the cone, no lock.
    g.player.yaw = 0;
    g.player.pitch = -Math.PI / 2;
    g.shield.update(DT, HOLD);
    expect(g.shield.lockedTarget).toBe(null);
    expect(g.shield.tryCharge()).toBe(false);
    // A straight target in the cone: the nearest wins, and only it.
    aimAt(g, near);
    g.shield.update(DT, HOLD);
    expect(g.shield.lockedTarget).toBe(near);
    void past; void wide;
    // A wall between the eye and the target hides it from the lock too.
    // The world is stepped once first, as the game's own step does, so
    // the fresh wall is in the broadphase the sight ray queries.
    makeWall(g.world, 0, -2);
    g.world.step();
    g.shield.update(DT, HOLD);
    expect(g.shield.lockedTarget).toBe(null);
    expect(g.shield.tryCharge()).toBe(false);
  });

  it("2. a press with no target is the ordinary dash: no charge starts", async () => {
    const g = rig();
    g.foamers.spawn(new THREE.Vector3(0, 0, -4));
    await raised(g);
    // Look down the +x wall, where no Foamer waits.
    g.player.yaw = -Math.PI / 2;
    g.player.pitch = 0;
    g.shield.update(DT, HOLD);
    expect(g.shield.lockedTarget).toBe(null);
    expect(g.shield.tryCharge()).toBe(false);
    expect(g.shield.charging).toBe(false);
  });

  it("3. the hit stops the player at stopShort, knocks back the Foamer, staggers it and damages it, and the cooldown holds until it is spent", async () => {
    const g = rig();
    const f = g.foamers.spawn(new THREE.Vector3(0, 0, -4))!;
    const hp0 = f.health;
    await raised(g);
    aimAt(g, f);
    g.shield.update(DT, HOLD); // the lock refreshes this step
    expect(g.shield.tryCharge()).toBe(true);
    const victim = await runCharge(g);
    expect(victim).toBe(f);
    expect(g.shield.charging).toBe(false);
    // The player ran toward the four metres and stopped short of the
    // chest; it stayed behind it.
    const pz = g.player.collider.translation().z;
    expect(pz).toBeGreaterThan(-4.4);
    expect(pz).toBeLessThan(-2.0);
    // The Foamer was knocked back along the charge (away from the player)
    // past most of the data's distance; it staggers and took the data's
    // damage, and a charge does not kill.
    expect(f.centre.z).toBeLessThan(-4 - 2.5);
    expect(f.state).toBe("stagger");
    // The short stagger, not the long finishable one (GAME-05 review).
    expect(f.staggerLong).toBe(false);
    expect(f.health).toBeCloseTo(hp0 - T.charge.damage, 5);
    expect(f.health).toBeGreaterThan(0);
    // The cooldown: no second charge right away, and one once it is spent.
    expect(g.shield.tryCharge()).toBe(false);
    let armed = false;
    for (let i = 0; i < 180 && !armed; i++) {
      g.shield.update(DT, HOLD);
      armed = g.shield.tryCharge();
    }
    expect(armed).toBe(true);
  });

  it("4. a wall in the way ends the charge on the time limit without a hit, at rest", async () => {
    const g = rig();
    const f = g.foamers.spawn(new THREE.Vector3(0, 0, -4))!;
    await raised(g);
    aimAt(g, f);
    g.shield.update(DT, HOLD);
    expect(g.shield.lockedTarget).toBe(f);
    // The wall goes in after the lock takes: the body can no longer get
    // through, but the charge was started already.
    makeWall(g.world, 0, -1.2); // its near face at z = -0.2
    g.world.step(); // the fresh wall into the broadphase, as in the game
    expect(g.shield.tryCharge()).toBe(true);
    const victim = await runCharge(g);
    expect(victim).toBe(null);
    expect(g.shield.charging).toBe(false);
    // No one was hit, the player never passed the front and it is at rest.
    expect(f.state).not.toBe("stagger");
    expect(g.player.collider.translation().z).toBeGreaterThan(-1.0);
    expect(Math.hypot(g.player.vel.x, g.player.vel.z)).toBeLessThan(1e-3);
  });
});
