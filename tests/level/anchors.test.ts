import { beforeAll, describe, expect, it } from "vitest";
import RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { buildLevel } from "../../src/level/build";
import { createPhysics } from "../../src/physics/world";
import { greedyMesh, type MeshData } from "../../src/voxel/mesher";
import { EMPTY, linearColorTable, materialId } from "../../src/voxel/materials";
import { findIslands } from "../../src/voxel/islands";
import type { VoxelVolume } from "../../src/voxel/chunk";
import type { Level, Piece } from "../../src/level/format";

// BUG-12 stage 1: a wall anchor makes bedrock of the piece's voxel layer
// that touches a shell box, and a ceiling anchor makes bedrock of the
// piece's top row (the mirror of the floor row). Without them findIslands
// finds no anchor: a small wall or ceiling piece drops whole on its first
// carve.

const FAKE = {
  mesh(padded: Uint8Array): Promise<MeshData> {
    return Promise.resolve(greedyMesh(padded, linearColorTable()));
  },
};

const FOAM = materialId("foam-orange");
const BEDROCK = materialId("bedrock");

// One wall piece per test, so the voxel origin is known: it is the piece's
// min corner snapped to the grid.
function levelWith(piece: Piece): Level {
  return {
    meta: { id: "anchors-test", name: "bug12", difficulty: "normal" as const },
    shell: [
      // The ground: y -1 to 0.
      { id: "floor", shape: "box" as const, pos: [0, -0.5, 0], size: [30, 1, 30], material: "greybox" as const },
      // A standalone wall: x -1 to 1, y 0 to 4, z -1 to 1. The wall piece
      // (x 1 to 2) touches its +x face.
      { id: "wall", shape: "box" as const, pos: [0, 2, 0], size: [2, 4, 2], material: "greybox" as const },
      // The ceiling slab the plug hangs from: y 6 to 7, over the wall.
      { id: "ceiling", shape: "box" as const, pos: [0, 6.5, 0], size: [10, 1, 10], material: "greybox" as const },
      // A ramp and a rotated box near the floor piece: the wall rule must
      // not treat these as axis-aligned boxes.
      { id: "ramp", shape: "ramp" as const, pos: [5, 0.5, 5], size: [2, 1, 2], material: "greybox" as const, rise: 1 },
      { id: "turned", shape: "box" as const, pos: [5, 1.5, 6.4], size: [2, 2, 0.2], material: "greybox" as const, rotY: 45 },
    ],
    pieces: [piece],
    playerStart: { pos: [0, 4, -10] as [number, number, number], yaw: Math.PI },
    exit: { pos: [0, 0, 12], size: [4, 0.2, 4] },
  } as unknown as Level;
}

// The wall piece: x 1 to 2, y 1 to 2, z 0 to 1... its volumes are 1 m cubes,
// so voxels are indices 0..9 on each axis from its min corner (1, 1, 0.5)...
// z 0.5 to 1.5. The voxel origin is that corner: (1, 1, 0.5).
const wallPiece = {
  id: "wall-block",
  kind: "cover" as const,
  anchor: "wall" as const,
  volumes: [{ pos: [1.5, 1.5, 1], size: [1, 1, 1], material: "foam-orange" }],
} as unknown as Piece

// The ceiling piece: x -0.5 to 0.5, y 4 to 6, z -0.5 to 0.5, under the
// ceiling slab (its top row touches y = 6). Origin (-0.5, 4, -0.5).
const ceilingPiece = {
  id: "ceil-block",
  kind: "ceiling" as const,
  anchor: "ceiling" as const,
  volumes: [{ pos: [0, 5, 0], size: [1, 2, 1], material: "foam-orange" }],
} as unknown as Piece

// The floor piece: x 5 to 6... at (5..6, 1..2, 5..6)... away from the shell
// boxes except the ground: the bottom row is bedrock by the floor rule.
// Volumes at x 4.5..5.5 would touch the turned box, so keep it clear.
const floorPiece = {
  id: "floor-block",
  kind: "cover" as const,
  anchor: "floor" as const,
  volumes: [{ pos: [5, 1.5, 8], size: [1, 1, 1], material: "foam-orange" }],
} as unknown as Piece

async function build(piece: Piece) {
  const { rapier, world } = await createPhysics();
  const built = buildLevel(levelWith(piece), rapier, world, FAKE);
  const v = built.voxels;
  const at = (x: number, y: number, z: number) => {
    const p = built.voxelMesh.worldToVoxel(new THREE.Vector3(x, y, z));
    return v.get(Math.round(p.x), Math.round(p.y), Math.round(p.z));
  };
  return { v, at };
}

// Empty every voxel in the inclusive index box a..b and return the removed
// list (what carveSphere hands to findIslands).
function carveBox(
  v: VoxelVolume, a: [number, number, number], b: [number, number, number],
) {
  const removed: { x: number; y: number; z: number; material: number }[] = [];
  for (let y = a[1]; y <= b[1]; y++)
    for (let z = a[2]; z <= b[2]; z++)
      for (let x = a[0]; x <= b[0]; x++) {
        const mtl = v.get(x, y, z);
        if (mtl === EMPTY) continue;
        v.set(x, y, z, EMPTY);
        removed.push({ x, y, z, material: mtl });
      }
  return removed;
}

beforeAll(async () => {
  await RAPIER.init();
});

describe("BUG-12 stage 1: anchors make bedrock", () => {
  it("a wall anchor beds the voxel layer touching the shell box", async () => {
    const { at } = await build(wallPiece);
    // The piece spans x 1 to 2: the x 1 to 1.1 layer is bedrock, the rest foam.
    expect(at(1.04, 1.5, 1)).toBe(BEDROCK);
    expect(at(1.14, 1.5, 1)).toBe(FOAM);
    expect(at(1.94, 1.5, 1)).toBe(FOAM);
    // Nothing else became bedrock: the rows facing the open sides stay foam.
    expect(at(1.5, 1.04, 1)).toBe(FOAM);
    expect(at(1.5, 1.94, 1)).toBe(FOAM);
    expect(at(1.5, 1.5, 1.44)).toBe(FOAM);
  });

  it("a wall piece keeps its uncarved part after a carve that leaves it touching the wall", async () => {
    const { v } = await build(wallPiece);
    // Blow out a chunk off the far side and the front: everything left is
    // still joined to the bedrock layer, so nothing breaks off.
    const removed = carveBox(v, [5, 0, 0], [9, 9, 4]);
    expect(removed.length).toBe(5 * 10 * 5);
    expect(findIslands(v, removed, 10000)).toEqual([]);
  });

  it("a wall piece cut off from the wall still falls", async () => {
    const { v } = await build(wallPiece);
    // Cut a whole slice through the middle: the part beyond the cut is an
    // island and must be found.
    const removed = carveBox(v, [4, 0, 0], [5, 9, 9]);
    expect(removed.length).toBe(2 * 10 * 10);
    const islands = findIslands(v, removed, 10000);
    expect(islands).toHaveLength(1);
    expect(islands[0]!.min[0]).toBe(6);
  });

  it("a ceiling anchor beds the piece's top row", async () => {
    const { at } = await build(ceilingPiece);
    // The piece spans y 4 to 6: only the top row y 5.9 to 6 is bedrock.
    expect(at(0, 5.94, 0)).toBe(BEDROCK);
    expect(at(0, 5.84, 0)).toBe(FOAM);
    expect(at(0, 4.04, 0)).toBe(FOAM);
    expect(at(0.44, 5.5, 0)).toBe(FOAM);
    expect(at(-0.44, 5.5, 0)).toBe(FOAM);
  });

  it("a ceiling piece keeps its uncarved part after a carve that leaves it touching the ceiling", async () => {
    const { v } = await build(ceilingPiece);
    // Blow out the lower half of the x < 0 side: all that is left still
    // hangs from the bedrock top row, so nothing breaks off.
    const removed = carveBox(v, [0, 0, 0], [4, 9, 9]);
    expect(removed.length).toBe(5 * 10 * 10);
    expect(findIslands(v, removed, 10000)).toEqual([]);
  });

  it("a ceiling piece cut off from the ceiling still falls", async () => {
    const { v } = await build(ceilingPiece);
    // Cut a whole layer across the middle: the block below it is an island.
    const removed = carveBox(v, [0, 9, 0], [9, 9, 9]);
    expect(removed.length).toBe(10 * 10);
    const islands = findIslands(v, removed, 10000);
    expect(islands).toHaveLength(1);
    expect(islands[0]!.max[1]).toBe(8);
  });

  it("a floor anchor still beds only the bottom row", async () => {
    const { at } = await build(floorPiece);
    // The piece spans y 1 to 2 at x 5, z 8 (away from every shell box).
    expect(at(5, 1.04, 8)).toBe(BEDROCK);
    expect(at(5, 1.14, 8)).toBe(FOAM);
    expect(at(5, 1.94, 8)).toBe(FOAM);
    expect(at(4.54, 1.5, 8)).toBe(FOAM);
    expect(at(5.44, 1.5, 8)).toBe(FOAM);
  });
});
