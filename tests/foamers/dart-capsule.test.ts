import { beforeAll, describe, expect, it } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { linearColorTable } from "../../src/voxel/materials";
import { greedyMesh } from "../../src/voxel/mesher";
import { DebrisSystem } from "../../src/voxel/debris";
import { DartSystem } from "../../src/weapons/darts";
import { DartImpacts, type VoxelTarget } from "../../src/weapons/impacts";
import { FoamerSystem } from "../../src/foamers/foamers";

const DT = 1 / 60;

/** Node has no Worker: mesh synchronously, as the worker does. */
function fakeMesher() {
  const colors = linearColorTable();
  return { mesh: (padded: Uint8Array) => Promise.resolve(greedyMesh(padded, colors)) };
}

beforeAll(async () => {
  await RAPIER.init();
});

describe("darts and the Foamer's movement capsule", () => {
  // Found in the ENG-13 review: shots at a walking Slowmer stopped on its
  // movement capsule, which nothing draws, and did no damage. The capsule
  // is for movement only; a dart must pass it and meet a part or nothing.
  it("a dart never stops on the capsule, and the same volley hits parts", async () => {
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
    foamers.spawnCount = 0;
    const f = foamers.spawn(new THREE.Vector3(0, 0, 0))!;
    // Let every part's mesh and collider land, as foamers.test.ts settles.
    for (const p of f.parts.values()) {
      p.mesh.update();
      await new Promise((r) => setTimeout(r, 0));
      p.mesh.update();
    }
    world.step();

    let capsule = 0;
    let parts = 0;
    const previous = darts.onHit;
    darts.onHit = (hit) => {
      previous(hit);
      if (hit.collider.handle === f.capsule.handle) capsule++;
      else if ([...f.parts.values()].some((p) => p.owns(hit.collider))) parts++;
    };
    // A fan of darts from 6 m, across the Foamer's width and up its
    // height, straight at it: the gaps between the legs and arms are where
    // the capsule shows.
    const player = new THREE.Vector3(0, 1.6, 30);
    for (let y = 0.2; y <= 1.6; y += 0.2)
      for (let x = -0.3; x <= 0.3; x += 0.1) {
        const from = new THREE.Vector3(f.centre.x + x, y, f.centre.z - 6);
        darts.fire(from, new THREE.Vector3(0, 0, 1), "standard");
        for (let i = 0; i < 30; i++) {
          darts.update(DT);
          foamers.update(DT, player);
          world.step();
        }
      }
    expect(capsule, "darts that stopped on the capsule").toBe(0);
    expect(parts, "darts that hit a part").toBeGreaterThan(0);
  });
});
