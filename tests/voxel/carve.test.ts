import { beforeAll, describe, expect, it } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { VoxelVolume } from "../../src/voxel/chunk";
import { carveSphere } from "../../src/voxel/carve";
import { materialId } from "../../src/voxel/materials";
import { DebrisSystem } from "../../src/voxel/debris";
import tuning from "../../data/destruction.json";

function block(name: string) {
  const v = new VoxelVolume(0.1);
  v.fillBox(0, 0, 0, 19, 19, 19, materialId(name));
  return v;
}

describe("carveSphere", () => {
  it("removes a ball of foam and reports what it removed", () => {
    const v = block("foam-orange");
    const removed = carveSphere(v, 10, 10, 10, 3);
    // Voxel centres within 3 of (10,10,10): a little over (4/3)pi 3^3 = 113.
    expect(removed.length).toBeGreaterThan(90);
    expect(removed.length).toBeLessThan(140);
    for (const r of removed) {
      expect(v.get(r.x, r.y, r.z)).toBe(0);
      expect(r.material).toBe(materialId("foam-orange"));
    }
    expect(v.get(10, 10, 10)).toBe(0);
    expect(v.get(10, 10, 15)).not.toBe(0);
  });

  it("carves harder materials less", () => {
    const foam = carveSphere(block("foam-blue"), 10, 10, 10, 4).length;
    const wood = carveSphere(block("wood"), 10, 10, 10, 4).length;
    expect(wood).toBeGreaterThan(0);
    expect(wood).toBeLessThan(foam / 4);
  });

  it("only scuffs when the hit is too weak for the material", () => {
    // concrete hardness 6: radius 2 gives 0.33, under minEffectiveRadius
    expect(carveSphere(block("concrete"), 10, 10, 10, 2)).toEqual([]);
  });

  it("never removes indestructible voxels", () => {
    const v = block("bedrock");
    expect(carveSphere(v, 10, 10, 10, 50)).toEqual([]);
  });

  it("does nothing in empty space", () => {
    expect(carveSphere(new VoxelVolume(0.1), 0, 0, 0, 5)).toEqual([]);
  });
});

describe("DebrisSystem", () => {
  beforeAll(async () => {
    await RAPIER.init();
  });

  it("never exceeds the cap and frees chunks after their lifetime", () => {
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    const debris = new DebrisSystem(RAPIER, world);
    const v = block("foam-pink");
    for (let i = 0; i < 30; i++) {
      const removed = carveSphere(v, 3 + (i % 15), 10, 3 + Math.floor(i / 15) * 12, 3);
      debris.spawn(removed, new THREE.Vector3(10, 10, 10), 0.1, (p) => p.multiplyScalar(0.1));
      expect(debris.live).toBeLessThanOrEqual(tuning.debris.max);
    }
    expect(debris.live).toBeGreaterThan(0);
    expect(world.bodies.len()).toBe(debris.live);

    const steps = Math.ceil(tuning.debris.lifetime * 60) + 1;
    for (let i = 0; i < steps; i++) {
      debris.update(1 / 60);
      world.step();
    }
    expect(debris.live).toBe(0);
    expect(world.bodies.len()).toBe(0);
  });
});
