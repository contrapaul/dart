import { beforeAll, describe, expect, it } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { linearColorTable } from "../../src/voxel/materials";
import { greedyMesh } from "../../src/voxel/mesher";
import { DebrisSystem } from "../../src/voxel/debris";
import { DartSystem } from "../../src/weapons/darts";
import { DartImpacts, type VoxelTarget } from "../../src/weapons/impacts";
import { FoamerSystem } from "../../src/foamers/foamers";
import { ProjectileSystem, type LiveBall } from "../../src/foamers/projectiles";
import { Shield } from "../../src/player/shield";
import { timeToImpact, playerCapsuleCentre } from "../../src/foamers/ball-time";
import type { PlayerController } from "../../src/player/controller";
import type { Loadout } from "../../src/weapons/loadout";
import playerJson from "../../data/player.json";
import shieldJson from "../../data/shield.json";

// BUG-02 stage 1: the watch helper's timing, end to end. The range's rig,
// the page's own flight, the page's own shield read, and the helper's own
// walk (step the chosen wait, hold the disc, let the ball finish). The walk
// uses the shared flight time (ball-time.ts), not distance over speed.
//
// (a) With the new timing the walk lands the raise inside the window, so a
//     mid-range lob is parried (it bounces).
// (b) The old distance over speed, read off the same loft, would hold the
//     wait short enough that the raise lands OUTSIDE the window (it would
//     block). The gap is asserted directly, without stepping the sim.

const DT = 1 / 60;
const EYE = playerJson.eyeHeight;
const T = shieldJson as unknown as { parry: { window: number } };
const HELD = {
  fireHeld: false, firePressed: false, shieldHeld: false, shieldPressed: false,
  reloadPressed: false,
};

beforeAll(async () => { await RAPIER.init(); });

/** The range's rig (the page's own flight, the page's own shield) with a
 *  real thrower on the axis ahead. The player capsule sits where the flight
 *  reads; the shield reads the same capsule, so the arc and the window both
 *  see what the sim sees. */
function makeRig(thrower: [number, number]) {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.createCollider(RAPIER.ColliderDesc.cuboid(40, 0.5, 40).setTranslation(0, -0.5, 0));
  const playerBody = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, 1, 8));
  const playerCollider = world.createCollider(
    RAPIER.ColliderDesc.capsule(0.55, 0.35).setTranslation(0, 0, 0), playerBody,
  );
  const ignored = world.createCollider(RAPIER.ColliderDesc.capsule(0.5, 0.3)
    .setTranslation(0, 0, 200), world.createRigidBody(RAPIER.RigidBodyDesc.fixed()));
  const darts = new DartSystem(new THREE.Scene(), world, RAPIER, ignored);
  const debris = new DebrisSystem(RAPIER, world);
  const targets: VoxelTarget[] = [];
  const mesher = { mesh: (p: Uint8Array) => Promise.resolve(greedyMesh(p, linearColorTable())) };
  const foamers = new FoamerSystem(RAPIER, world, mesher, debris, darts, targets);
  new DartImpacts(darts, debris, targets);
  const projectiles = new ProjectileSystem(RAPIER, world, debris, playerCollider, foamers);
  const f = foamers.spawn(new THREE.Vector3(thrower[0], 0, thrower[1]), undefined, "F02")!;
  f.state = "idle"; // hold it where it was thrown from: the test runs the loop
  const yaw = Math.atan2(-thrower[0], -(thrower[1] - 8)); // face the thrower
  const player = {
    vel: new THREE.Vector3(), pitch: 0, yaw, speedScale: 1,
    allowSprint: true, collider: {},
  } as unknown as PlayerController;
  const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 100);
  camera.rotation.order = "YXZ";
  camera.position.set(0, EYE, 8);
  const shield = new Shield(
    RAPIER, world, new THREE.Scene(), camera, player,
    { switching: false } as unknown as Loadout, foamers, debris, [],
  );
  return { world, darts, debris, foamers, projectiles, f, camera, shield,
    settle: async () => {
      for (const p of f.parts.values()) {
        p.mesh.update();
        await new Promise((r) => setTimeout(r, 0));
        world.step();
      }
    },
  };
}

type Rig = ReturnType<typeof makeRig>;

/** One full sim step, the game page's own order (slow, player, shield,
 *  world). */
function step(r: Rig, controls = HELD) {
  const before = r.shield.slowed(DT);
  r.darts.update(before);
  r.foamers.update(before, r.camera.position);
  r.projectiles.update(before);
  r.camera.updateMatrixWorld();
  r.shield.update(DT, controls);
  r.world.step();
}

/** The helper's own walk, but with the chosen flight wait: step the
 *  wait (the ball keeps coming), then hold the disc up on that step and let
 *  it finish. Returns the count of steps the wait consumed. */
function walkThenHold(r: Rig, waitSec: number): number {
  const n = Math.round(Math.max(0, waitSec - r.shield.parryLead) / DT);
  for (let i = 0; i < n && r.projectiles.list.length; i++) step(r);
  r.shield.forcedHold = true;
  for (let i = 0; i < 60 * 6 && r.projectiles.list.length; i++) step(r);
  return n;
}

/** The page's own decision on a hit, wired the way the range does it. */
function pageDecision(r: Rig) {
  r.projectiles.onHitPlayer = (b: LiveBall) => {
    const spd = b.vel.length();
    const from = new THREE.Vector3(
      b.pos.x - (b.vel.x / spd) * 0.5, b.pos.y, b.pos.z - (b.vel.z / spd) * 0.5,
    );
    if (r.shield.blocksAttackFrom(from) && r.shield.canParry()) {
      r.shield.noteParry();
      r.projectiles.bounce(b);
    }
  };
}

describe("the watch helper's timing (BUG-02)", () => {
  it("the new flight time lands the raise inside the window: a parry", async () => {
    for (const thrower of [[0, 0], [0, -4]] as [number, number][]) {
      const r = makeRig(thrower);
      await r.settle();
      pageDecision(r);
      r.projectiles.launch(r.f, r.camera.position.clone());
      const centre = new THREE.Vector3();
      playerCapsuleCentre(r.camera.position, centre);
      const b = r.projectiles.list[0]!;
      // The helper's own read: the shared flight time, to the capsule.
      const wait = timeToImpact(b.pos, b.vel, DT, centre);
      walkThenHold(r, wait);
      expect(r.projectiles.stats.bounced, `thrower ${thrower}: it was parried, not blocked`)
        .toBeGreaterThanOrEqual(1);
      expect(r.shield.parries).toBeGreaterThanOrEqual(1);
    }
  });

  it("the old distance over speed would land out of the window on a loft", () => {
    // One deep loft (20 m out), read off the one launched ball, no sim:
    // the old wait is short enough that the raise lands past the window.
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    world.createCollider(RAPIER.ColliderDesc.cuboid(40, 0.5, 40).setTranslation(0, -0.5, 0));
    const pbody = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, 1, 8));
    const pcoll = world.createCollider(RAPIER.ColliderDesc.capsule(0.55, 0.35), pbody);
    const ign = world.createCollider(RAPIER.ColliderDesc.capsule(0.5, 0.3).setTranslation(0, 0, 200),
      world.createRigidBody(RAPIER.RigidBodyDesc.fixed()));
    const darts = new DartSystem(new THREE.Scene(), world, RAPIER, ign);
    const debris = new DebrisSystem(RAPIER, world);
    const mesher = { mesh: (p: Uint8Array) => Promise.resolve(greedyMesh(p, linearColorTable())) };
    const foamers = new FoamerSystem(RAPIER, world, mesher, debris, darts, []);
    const projectiles = new ProjectileSystem(RAPIER, world, debris, pcoll, foamers);
    const f = foamers.spawn(new THREE.Vector3(0, 0, -12), undefined, "F02")!;
    f.state = "idle";
    const eye = new THREE.Vector3(0, EYE, 8);
    projectiles.launch(f, eye);
    const b = projectiles.list[0]!;
    const centre = new THREE.Vector3(0, 1, 8);
    const tNew = timeToImpact(b.pos, b.vel, DT, centre);
    const tOld = b.pos.distanceTo(centre) / Math.max(0.5, b.vel.length());
    // The old wait is the flight time minus the arc time; a loft's arc
    // outruns the straight line by more than the window, so the old raise
    // lands out of the window and the ball would block, not parry.
    expect(tNew, "the flight is real").toBeGreaterThan(T.parry.window);
    expect(tNew - tOld,
      `the loft's arc outruns the old line by more than a window (gap ${(tNew - tOld).toFixed(3)})`)
      .toBeGreaterThan(T.parry.window);
  });
});
