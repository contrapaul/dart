import { afterEach, describe, expect, it } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { linearColorTable } from "../../src/voxel/materials";
import { greedyMesh } from "../../src/voxel/mesher";
import type { Mesher } from "../../src/voxel/pieces";
import { DebrisSystem } from "../../src/voxel/debris";
import { DartSystem } from "../../src/weapons/darts";
import { FoamerSystem } from "../../src/foamers/foamers";
import { mergeTune } from "../../src/editor/tuning-panel";
import { localTuning, setLocalTuningForTest, tuneFoamer } from "../../src/core/tuning";

afterEach(() => setLocalTuningForTest({ version: 1, foamers: {}, blasters: {} }));

function fakeMesher(): Mesher {
  const colors = linearColorTable();
  return { mesh: (padded) => Promise.resolve(greedyMesh(padded, colors)) };
}

describe("tuning panel", () => {
  it("mergeTune merges a patch into the placed Foamer's own tuning", () => {
    expect(mergeTune(undefined, { rig: { speed: 4 } })).toEqual({ rig: { speed: 4 } });
    const merged = mergeTune({ rig: { speed: 4 } }, { spec: { attackRange: 2 } });
    expect(merged).toEqual({ rig: { speed: 4 }, spec: { attackRange: 2 } });
  });

  it("mergeTune replaces attack arrays rather than merging them", () => {
    const merged = mergeTune(
      { spec: { attacks: [{ id: "bonk", damage: 12 }] } },
      { spec: { attacks: [{ id: "bonk", damage: 20 }] } },
    );
    expect(merged).toEqual({ spec: { attacks: [{ id: "bonk", damage: 20 }] } });
  });

  it("an every-type edit writes the shared override (localTuning), not the level", () => {
    tuneFoamer("F01", { rig: { health: 99 } });
    expect(localTuning().foamers.F01!.rig!.health).toBe(99);
  });
});

describe("size works in play", () => {
  it("a changed voxelSize scales the capsule, the parts and the feet at spawn", async () => {
    await RAPIER.init();
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    const debris = new DebrisSystem(RAPIER, world);
    const ignore = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    const sensor = world.createCollider(RAPIER.ColliderDesc.ball(0.1).setTranslation(0, 0, 200), ignore);
    const darts = new DartSystem(new THREE.Scene(), world, RAPIER, sensor);
    const foamers = new FoamerSystem(RAPIER, world, fakeMesher(), debris, darts, []);

    const plain = foamers.spawn(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 1), "F01")!;
    expect(plain).toBeTruthy();
    const smallHeight = plain.height;
    plain.applyPose();

    const big = foamers.spawn(new THREE.Vector3(6, 0, 0), new THREE.Vector3(0, 0, 1), "F01", false, false, { rig: { voxelSize: plain.rig.voxelSize * 2 } })!;
    expect(big).toBeTruthy();
    expect(big.height).toBeGreaterThan(smallHeight * 1.9);
    expect(big.height).toBeLessThan(smallHeight * 2.1);
    for (const part of big.parts.values()) {
      expect(part.volume.voxelSize).toBeCloseTo(plain.rig.voxelSize * 2, 5);
    }
    // The capsule follows the rig's height.
    expect(big.root.translation().y).toBeGreaterThanOrEqual(0);
    big.applyPose();
    // The feet sit on the floor: the lowest part corner is at the floor.
    const v = new THREE.Vector3();
    let low = Infinity;
    for (const part of big.parts.values()) {
      const size = part.spec.size;
      for (const cx of [0, 1]) for (const cy of [0, 1]) for (const cz of [0, 1]) {
        v.set(cx * size[0], cy * size[1], cz * size[2])
          .multiplyScalar(part.volume.voxelSize).applyMatrix4(part.pose);
        low = Math.min(low, v.y);
      }
    }
    expect(low).toBeCloseTo(0, 2);
    // The capsule follows the scaled rig: a taller body than the plain one.
    expect(big.root.translation().y).toBeCloseTo(0, 2);
    // The capsule collider follows the scaled rig too (radius and half height).
    const shape = (f: typeof big) => f.capsule.shape as unknown as { halfHeight: number; radius: number };
    expect(shape(big).halfHeight).toBeCloseTo(shape(plain).halfHeight * 2, 2);
    expect(shape(big).radius).toBeCloseTo(shape(plain).radius * 2, 2);
  });
});
