import { beforeAll, describe, expect, it } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { linearColorTable } from "../../src/voxel/materials";
import { greedyMesh } from "../../src/voxel/mesher";
import type { Mesher } from "../../src/voxel/pieces";
import { DartSystem } from "../../src/weapons/darts";
import { createRangeSystems } from "../../src/range/setup";
import explosionTuning from "../../data/explosion.json";

// PT-05 stage 3: the small explosive blasts (B05's explosive mod and B06's
// every fifth shot, both the dart profile) do much more than a plain dart
// and shove the Foamers around them.

const DT = 1 / 60;
const DART = explosionTuning.profiles.dart;

function fakeMesher(): Mesher {
  const colors = linearColorTable();
  return { mesh: (padded) => Promise.resolve(greedyMesh(padded, colors)) };
}

/** The range's own systems, so the blast goes through the real dart path
 *  (DartImpacts -> ExplosionSystem -> FoamerSystem) as it does in the game. */
function rig() {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.createCollider(RAPIER.ColliderDesc.cuboid(40, 0.5, 40).setTranslation(0, -0.5, 0));
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  const ignore = world.createCollider(
    RAPIER.ColliderDesc.capsule(0.5, 0.3).setTranslation(0, 0, 200),
    body,
  );
  const darts = new DartSystem(new THREE.Scene(), world, RAPIER, ignore);
  const sys = createRangeSystems(RAPIER, world, darts, fakeMesher(), ignore);
  world.step();
  return { world, darts, ...sys };
}

const eye = new THREE.Vector3(0, 1.6, 30);

function tick(r: ReturnType<typeof rig>, n = 1) {
  for (let i = 0; i < n; i++) {
    r.darts.update(DT);
    r.foamers.update(DT, eye);
    r.world.step();
  }
}

async function spawn(r: ReturnType<typeof rig>, type: string, at: THREE.Vector3) {
  const f = r.foamers.spawn(at, eye, type)!;
  for (const part of f.parts.values()) {
    while (part.mesh.busy) {
      part.mesh.update();
      await new Promise((res) => setTimeout(res, 0));
    }
  }
  r.world.step();
  return f;
}

beforeAll(async () => {
  await RAPIER.init();
});

describe("PT-05 stage 3: the small explosive blasts", () => {
  it("1. a dart blast on an F05 does at least twice a plain mega dart's damage", async () => {
    // Plain mega dart: no explosion, so only the dart's own damage lands.
    const plain = rig();
    const a = await spawn(plain, "F05", new THREE.Vector3(0, 0, 0));
    const hp = a.health;
    plain.darts.fire(
      new THREE.Vector3(0, 1.0, 3), new THREE.Vector3(0, 0, -1), "mega",
      { id: 1, muzzle: new THREE.Vector3(0, 1.0, 3), chunk: null, explodes: false },
    );
    tick(plain, 60);
    const plainLoss = hp - a.health;
    expect(plainLoss).toBeGreaterThan(0);

    // The same shot tagged explosive: the blast lands on the hit point.
    const blast = rig();
    const b = await spawn(blast, "F05", new THREE.Vector3(0, 0, 0));
    const hp2 = b.health;
    blast.darts.fire(
      new THREE.Vector3(0, 1.0, 3), new THREE.Vector3(0, 0, -1), "mega",
      { id: 1, muzzle: new THREE.Vector3(0, 1.0, 3), chunk: null, explodes: true },
    );
    tick(blast, 60);
    expect(blast.explosion.stats.blasts).toBe(1);
    const blastLoss = hp2 - b.health;
    expect(blastLoss).toBeGreaterThanOrEqual(2 * plainLoss);
    expect(DART.damageCentre).toBeGreaterThanOrEqual(20);
  });

  it("2. the blast shoves a neighbouring F01 away from it", async () => {
    const r = rig();
    const target = await spawn(r, "F05", new THREE.Vector3(0, 0, 0));
    target.health = 1000;
    const neighbour = await spawn(r, "F01", new THREE.Vector3(1.5, 0, 0));
    neighbour.health = 1000;
    const before = neighbour.centre.clone();
    r.darts.fire(
      new THREE.Vector3(0, 1.0, 3), new THREE.Vector3(0, 0, -1), "mega",
      { id: 1, muzzle: new THREE.Vector3(0, 1.0, 3), chunk: null, explodes: true },
    );
    tick(r, 60);
    expect(r.explosion.stats.damage).toBe(2); // both took the blast
    expect(neighbour.centre.x).toBeGreaterThan(before.x);
    expect(DART.knockSpeed).toBeGreaterThan(0);
  });
});
