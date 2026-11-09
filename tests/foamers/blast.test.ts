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
import { ExplosionSystem } from "../../src/weapons/explosion";
import explosionTuning from "../../data/explosion.json";

// PT-05 stage 1: a blast is a sphere, walls block it, and a survivor is
// shoved over time instead of teleported.

const DT = 1 / 60;
const P = explosionTuning.profiles.launcher;

function fakeMesher(): Mesher {
  const colors = linearColorTable();
  return { mesh: (padded) => Promise.resolve(greedyMesh(padded, colors)) };
}

async function settle(mesh: { update(): void; busy: boolean }, world: RAPIER.World) {
  while (true) {
    mesh.update();
    if (!mesh.busy) break;
    await new Promise((r) => setTimeout(r, 0));
  }
  world.step();
}

function rig() {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.createCollider(RAPIER.ColliderDesc.cuboid(40, 0.5, 40).setTranslation(0, -0.5, 0));
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  const ignore = world.createCollider(
    RAPIER.ColliderDesc.capsule(0.5, 0.3).setTranslation(0, 0, 200),
    body,
  );
  const scene = new THREE.Scene();
  const darts = new DartSystem(scene, world, RAPIER, ignore);
  const debris = new DebrisSystem(RAPIER, world);
  const targets: VoxelTarget[] = [];
  const foamers = new FoamerSystem(RAPIER, world, fakeMesher(), debris, darts, targets);
  new DartImpacts(darts, debris, targets);
  const explosion = new ExplosionSystem(world, debris, targets);
  explosion.foamers = foamers;
  world.step();
  return { world, darts, debris, foamers, targets, explosion };
}

const eye = new THREE.Vector3(0, 1.6, 30);

function tick(r: ReturnType<typeof rig>, dt = DT) {
  r.darts.update(dt);
  r.foamers.update(dt, eye);
  r.world.step();
}

async function spawn(r: ReturnType<typeof rig>, type = "F05", at = new THREE.Vector3(0, 0, 0)) {
  const f = r.foamers.spawn(at, eye, type)!;
  for (const part of f.parts.values()) await settle(part.mesh, r.world);
  return f;
}

/** A fixed wall. The world steps once so the ray query sees it: Rapier's
 *  query pipeline is refreshed by a step, not by adding a collider. */
function wall(r: ReturnType<typeof rig>, at: THREE.Vector3, half: THREE.Vector3) {
  const b = r.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(at.x, at.y, at.z));
  r.world.createCollider(RAPIER.ColliderDesc.cuboid(half.x, half.y, half.z), b);
  r.world.step();
  return b;
}

beforeAll(async () => {
  await RAPIER.init();
});

describe("PT-05: the blast is a sphere, walls block it", () => {
  it("1. a wall between the point and the Foamer stops the damage", async () => {
    const open = rig();
    const a = await spawn(open, "F05", new THREE.Vector3(0, 0, 0));
    const hpA = a.health;
    // The point is 1.6 m to the side of the body's middle, at 1 m up, well
    // inside the launcher's range.
    open.explosion.explode(new THREE.Vector3(1.6, 1, 0), "launcher");
    expect(a.health).toBeLessThan(hpA);

    const shut = rig();
    const b = await spawn(shut, "F05", new THREE.Vector3(0, 0, 0));
    const hpB = b.health;
    wall(shut, new THREE.Vector3(0.8, 1, 0), new THREE.Vector3(0.05, 2, 2));
    shut.explosion.explode(new THREE.Vector3(1.6, 1, 0), "launcher");
    expect(b.health).toBe(hpB); // the wall took it
    expect(shut.explosion.stats.damage).toBe(0);
  });

  it("2. an arm in range takes it even when the feet are not", async () => {
    const r = rig();
    const f = await spawn(r, "F05", new THREE.Vector3(0, 0, 0));
    // A point past the feet at exactly rangeMetres plus a little: only a
    // part that reaches further out can be in the sphere.
    const body = f.parts.get("body")!;
    const sz = body.spec.size;
    const c = body.voxelToWorld(
      new THREE.Vector3(sz[0] / 2, sz[1] / 2, sz[2] / 2),
    );
    expect(Math.abs(c.x)).toBeLessThan(0.5); // the rig stands on its feet
    // The head is the part highest above the feet: a point beside it at
    // just inside range is further than range from the feet below it.
    let top = c;
    for (const part of f.parts.values()) {
      const sz = part.spec.size;
      const pc = part.voxelToWorld(
        new THREE.Vector3(sz[0] / 2, sz[1] / 2, sz[2] / 2),
      );
      if (pc.y > top.y) top = pc;
    }
    const point = new THREE.Vector3(
      top.x + P.rangeMetres - 0.05, top.y, top.z,
    );
    const feetDist = f.centre.distanceTo(point);
    const partDist = r.foamers.blastDistance(f, point);
    expect(feetDist).toBeGreaterThan(P.rangeMetres);
    expect(partDist).toBeLessThanOrEqual(P.rangeMetres);
    const hp = f.health;
    r.explosion.explode(point, "launcher");
    expect(f.health).toBeLessThan(hp);
  });

  it("3. a survivor steps no further than its knock speed allows, and is pushed away", async () => {
    const r = rig();
    const f = await spawn(r, "F05", new THREE.Vector3(0, 0, 0));
    // Enough health to survive: the blast still shoves it.
    f.health = 1000;
    const point = new THREE.Vector3(-1.4, 1.0, 0);
    const before = f.centre.clone();
    r.explosion.explode(point, "launcher");
    const speed = f.maxHealth > 0 ? P.knockSpeed : 0;
    expect(speed).toBeGreaterThan(0);
    let prev = f.centre.clone();
    let worst = 0;
    let moved = 0;
    for (let i = 0; i < 120; i++) {
      tick(r);
      const step = prev.distanceTo(f.centre);
      // The walk is the Foamer's own; the shove may not add more than its
      // own speed allows on top of one step of ordinary movement.
      worst = Math.max(worst, step);
      moved = Math.hypot(f.centre.x - before.x, f.centre.z - before.z);
      prev.copy(f.centre);
    }
    // 1 m away from a 3.5 m blast: no teleport, and a real push away from
    // the point (the point is at -x, so the push is toward +x).
    expect(worst).toBeLessThanOrEqual(speed * DT + 3 * DT + 1e-3);
    expect(moved).toBeGreaterThan(0.2);
    expect(f.centre.x).toBeGreaterThan(before.x);
  });

  it("4. a wall in the shove's path stops it", async () => {
    const r = rig();
    const f = await spawn(r, "F05", new THREE.Vector3(0, 0, 0));
    f.health = 1000;
    // One blast point on the -x side, and a wall 0.6 m along +x.
    wall(r, new THREE.Vector3(0.75, 1, 0), new THREE.Vector3(0.05, 1.5, 1.5));
    const before = f.centre.x;
    r.explosion.explode(new THREE.Vector3(-1.4, 1.0, 0), "launcher");
    for (let i = 0; i < 120; i++) tick(r);
    // It moved up to the wall and no further.
    expect(f.centre.x).toBeGreaterThan(before);
    expect(f.centre.x).toBeLessThan(0.8);
  });

  it("5. the data holds the new numbers per profile", () => {
    // PT-05 stage 3 gives the dart profile its own shove; stage 1 keeps it
    // at 0 so B05's and B06's old blasts behave exactly as they did.
    for (const name of ["launcher", "cluster"] as const) {
      const p = explosionTuning.profiles[name];
      expect(p.knockSpeed).toBeGreaterThan(0);
      expect(p.knockDecay).toBeGreaterThan(0);
      expect(p.liftSpeed).toBeGreaterThanOrEqual(0);
    }
    expect(explosionTuning.pushLift).toBeLessThan(0.5);
  });
});
