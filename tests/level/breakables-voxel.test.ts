import { beforeAll, describe, expect, it } from "vitest";
import RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { buildLevel, voxelPrimPieces, voxelPrimVolumes } from "../../src/level/build";
import { createPhysics } from "../../src/physics/world";
import { greedyMesh, type MeshData } from "../../src/voxel/mesher";
import { EMPTY, linearColorTable, materialId } from "../../src/voxel/materials";
import type { Level, Prim } from "../../src/level/format";

// Node has no Web Workers; the greedy mesher runs inline.
const FAKE = {
  mesh(padded: Uint8Array): Promise<MeshData> {
    return Promise.resolve(greedyMesh(padded, linearColorTable()));
  },
};

function level(prims: Prim[], shell: Level["shell"] = []): Level {
  return {
    meta: { id: "t", name: "t", act: 1, targetSeconds: 60, accent: "#ffffff", setting: "t" },
    shell,
    prims,
    playerStart: { pos: [0, 0, 0], yaw: 0 },
    exit: { pos: [0, 0, 0], size: [1, 1, 1] },
  } as unknown as Level;
}

const wall = (over: Partial<Prim> = {}): Prim => ({
  id: "wall", shape: "box", pos: [0, 1.5, 0], size: [2, 3, 0.4],
  colour: "#b6ff3b", behaviour: "breakable", ...over,
});

beforeAll(async () => {
  await RAPIER.init();
});

describe("a voxel breakable prim", () => {
  it("builds no mesh and no collider of its own", async () => {
    const { rapier, world } = await createPhysics();
    const built = buildLevel(level([wall()]), rapier, world, FAKE);
    // The only colliders are the ones the voxel mesh makes; with none yet
    // (the mesher answers later) there is nothing at all.
    expect(world.colliders.len()).toBe(0);
    const meshes = built.group.children.filter((c) => (c as THREE.Mesh).isMesh);
    // The voxel mesh group is the one child that is a group.
    expect(meshes.length).toBe(0);
  });

  it("fills voxels the size of its box, in its own material", async () => {
    const { rapier, world } = await createPhysics();
    const built = buildLevel(level([wall()]), rapier, world, FAKE);
    let count = 0;
    for (const chunk of built.voxels.chunks.values()) count += chunk.count;
    const VOXEL = built.voxels.voxelSize;
    expect(count).toBe((2 * 3 * 0.4) / VOXEL ** 3);
    const p = built.voxelMesh.worldToVoxel(new THREE.Vector3(0, 1.5, 0));
    expect(built.voxels.get(Math.round(p.x), Math.round(p.y), Math.round(p.z)))
      .toBe(materialId("foam-lime"));
    // Nothing above the box.
    const above = built.voxelMesh.worldToVoxel(new THREE.Vector3(0, 3.5, 0));
    expect(built.voxels.get(Math.round(above.x), Math.round(above.y), Math.round(above.z)))
      .toBe(EMPTY);
  });

  it("cuts a 7 m box into 3 volumes along that axis", () => {
    const volumes = voxelPrimVolumes(wall({ size: [7, 3, 0.4] }));
    expect(volumes.length).toBe(3);
    for (const v of volumes) expect(v.size[0]).toBeLessThanOrEqual(3.2 + 1e-9);
    // The blocks tile the box: their sizes add up to it, and the middle one
    // is on the box's centre line.
    const total = volumes.reduce((n, v) => n + v.size[0], 0);
    expect(total).toBeCloseTo(7);
    expect(volumes[1]!.pos[0]).toBeCloseTo(0);
  });

  it("swaps x and z for a 90 degree turn about Y", () => {
    const flat = voxelPrimVolumes(wall({ size: [7, 3, 0.4] }));
    const turned = voxelPrimVolumes(wall({ size: [7, 3, 0.4], rot: [0, 90, 0] }));
    // Turned, the long side runs along z, so the cuts come along z.
    expect(turned.length).toBe(3);
    for (const v of turned) {
      expect(v.size[2]).toBeLessThanOrEqual(3.2 + 1e-9);
      expect(v.size[0]).toBeCloseTo(0.4);
    }
    // The same count, and the same total, whichever way it is cut.
    expect(turned.reduce((n, v) => n + v.size[2], 0)).toBeCloseTo(7);
    expect(flat.reduce((n, v) => n + v.size[0], 0)).toBeCloseTo(7);
    // A 180 degree turn swaps nothing.
    const back = voxelPrimVolumes(wall({ size: [7, 3, 0.4], rot: [0, 180, 0] }));
    expect(back.length).toBe(3);
    expect(back[0]!.size[0]).toBeCloseTo(flat[0]!.size[0]);
  });

  it("anchors to the floor when its bottom touches a solid top", () => {
    const floor = { id: "f", shape: "box" as const, pos: [0, -0.5, 0] as [number, number, number], size: [10, 1, 10] as [number, number, number], material: "greybox" };
    const pieces = voxelPrimPieces(level([wall({ pos: [0, 1.5, 0] })], [floor]));
    expect(pieces[0]!.anchor).toBe("floor");
    // Lifted clear of the floor, it hangs from nothing.
    const lifted = voxelPrimPieces(level([wall({ pos: [0, 3, 0] })], [floor]));
    expect(lifted[0]!.anchor).toBe("none");
  });

  it("anchors to a solid prim under it", () => {
    const under = wall({ id: "under", behaviour: "solid", size: [3, 1, 3], pos: [0, 0.5, 0] });
    const above = wall({ id: "above", pos: [0, 2.5, 0] });
    const pieces = voxelPrimPieces(level([under, above]));
    expect(pieces.map((p) => p.id)).toEqual(["above"]);
    expect(pieces[0]!.anchor).toBe("floor");
  });

  it("leaves a hidden voxel breakable as a mesh, for the hit point rule", () => {
    // Not supported as voxels yet (the card): it is built like any other
    // prim, mesh and colliders included, and breakables.ts breaks it.
    expect(voxelPrimPieces(level([wall({ hidden: true })]))).toEqual([]);
  });

  it("takes a colour the palette does not have to the nearest foam", () => {
    const pieces = voxelPrimPieces(level([wall({ colour: "#fffc00" })]));
    // ff d2 3f is the palette's yellow: the nearest foam to a bright yellow.
    expect(pieces[0]!.volumes[0]!.material).toBe("foam-yellow");
  });
});
