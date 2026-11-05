import { beforeAll, describe, expect, it } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { timeToImpact, playerCapsuleCentre, BALL_RADIUS, CAPSULE_RADIUS, EYE_ABOVE_CENTRE } from "../../src/foamers/ball-time";
import { linearColorTable } from "../../src/voxel/materials";
import { greedyMesh } from "../../src/voxel/mesher";
import { DebrisSystem } from "../../src/voxel/debris";
import { DartSystem } from "../../src/weapons/darts";
import { DartImpacts } from "../../src/weapons/impacts";
import { FoamerSystem } from "../../src/foamers/foamers";
import { ProjectileSystem } from "../../src/foamers/projectiles";
import foamerData from "../../data/foamers.json";

// BUG-02: the watch's time to impact (ball-time.ts). A straight flight reads
// like distance over speed (the check the old helper did), a lob does not,
// and the read of a real launch lands within two of the sim's own steps
// of the step the real update loop hits the capsule on.

const DT = 1 / 60;
const BALL = foamerData.test.ball;
const CENTRE = new THREE.Vector3(0, 1, 0);
const REACH = CAPSULE_RADIUS + BALL_RADIUS;

function fakeMesher() {
  const colors = linearColorTable();
  return { mesh: (padded: Uint8Array) => Promise.resolve(greedyMesh(padded, colors)) };
}

function rig(x: number) {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.createCollider(RAPIER.ColliderDesc.cuboid(40, 0.5, 40).setTranslation(0, -0.5, 0));
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  // A player capsule at the data's own size, its centre the same height the
  // sim's own reach reads (the flight's reach is the data's too).
  const playerBody = world.createRigidBody(
    RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(CENTRE.x, CENTRE.y, CENTRE.z),
  );
  const playerCollider = world.createCollider(
    RAPIER.ColliderDesc.capsule(0.55, CAPSULE_RADIUS).setTranslation(0, 0, 0), playerBody,
  );
  const ignore = world.createCollider(
    RAPIER.ColliderDesc.capsule(0.5, 0.3).setTranslation(0, 0, 200), body,
  );
  const darts = new DartSystem(new THREE.Scene(), world, RAPIER, ignore);
  const debris = new DebrisSystem(RAPIER, world);
  const foamers = new FoamerSystem(RAPIER, world, fakeMesher(), debris, darts, []);
  new DartImpacts(darts, debris, []);
  const projectiles = new ProjectileSystem(RAPIER, world, debris, playerCollider, foamers);
  foamers.projectiles = projectiles;
  const f = foamers.spawn(new THREE.Vector3(x, 0, 0), undefined, "F02")!;
  f.state = "idle";
  return { world, projectiles, f,
    settle: async () => {
      for (const p of f.parts.values()) {
        p.mesh.update();
        await new Promise((r) => setTimeout(r, 0));
        world.step();
      }
    },
  };
}

beforeAll(async () => {
  await RAPIER.init();
});

describe("the watch's time to impact (BUG-02)", () => {
  it("a straight flight reads like distance over the flat speed", () => {
    // No gravity, a horizontal ray: the old estimate, but to the reach, not
    // the centre.
    const pos = new THREE.Vector3(8, 1, 0);
    const vel = new THREE.Vector3(-BALL.speed, 0, 0);
    const t = timeToImpact(pos, vel, DT, CENTRE, 0);
    const straight = (8 - REACH) / BALL.speed;
    expect(t, "the ray's own step to the reach").toBeGreaterThanOrEqual(straight);
    expect(t, "and no more than two of the sim's beyond it").toBeLessThanOrEqual(straight + 2 * DT);
  });

  it("a lobbed flight reads away from distance over speed", () => {
    // The same hand, a rising throw, on the data's gravity: the arc.
    const pos = new THREE.Vector3(8, 0, 0);
    const vel = new THREE.Vector3(-BALL.speed, 3, 0);
    const t = timeToImpact(pos, vel, DT, CENTRE);
    const straight = 8 / Math.hypot(BALL.speed, 3);
    expect(Math.abs(t - straight), "the arc is more than a step of the line")
      .toBeGreaterThan(1 * DT);
    expect(Number.isFinite(t)).toBe(true);
  });

  it("a real launch: within two sim steps of the update loop's own hit", async () => {
    for (const x of [4, 8]) {
      const r = rig(x);
      await r.settle();
      const f = r.f;
      const eye = new THREE.Vector3(0, 1.6, 0); // the launch aims at this
      r.projectiles.launch(f, eye);
      const b = r.projectiles.list[0]!;
      const tNew = timeToImpact(b.pos, b.vel, DT, CENTRE);
      const tOld = b.pos.distanceTo(CENTRE) / Math.max(0.5, b.vel.length());
      // The real loop's own time to the capsule.
      let hitAt = -1;
      let steps = 0;
      while (r.projectiles.list.length && hitAt < 0 && steps < 60 * 8) {
        r.projectiles.update(DT);
        r.world.step();
        steps++;
        if (r.projectiles.stats.hitPlayer > 0) hitAt = steps;
      }
      const tTrue = hitAt * DT;
      expect(hitAt > 0, `x=${x}: the ball reached the player`).toBe(true);
      expect(Math.abs(tNew - tTrue),
        `x=${x}: the flight's read (tNew ${tNew.toFixed(3)}) is two steps of its own hit (${tTrue.toFixed(3)}) at most`)
        .toBeLessThanOrEqual(2 * DT);
      expect(Math.abs(tOld - tTrue),
        `x=${x}: the old line (tOld ${tOld.toFixed(3)}) was a step off its own hit (${tTrue.toFixed(3)})`)
        .toBeGreaterThan(1 * DT);
    }
  });

  it("the capsule centre reads straight down from the eye, by the data", () => {
    // player.json: the centre is a full half height (0.7) under the eye.
    const out = new THREE.Vector3();
    const c = playerCapsuleCentre(new THREE.Vector3(2, 1.6, -3), out);
    expect(EYE_ABOVE_CENTRE).toBeCloseTo(0.7, 5);
    expect(c.x).toBe(2);
    expect(c.y).toBeCloseTo(0.9, 5);
    expect(c.z).toBe(-3);
  });
});
