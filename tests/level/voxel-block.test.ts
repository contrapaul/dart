import { describe, expect, it } from "vitest";
import { buildLevel } from "../../src/level/build";
import { makeLevelAI } from "../../src/ai/level";
import { createPhysics } from "../../src/physics/world";
import { greedyMesh, type MeshData } from "../../src/voxel/mesher";
import { linearColorTable } from "../../src/voxel/materials";
import { carveSphere } from "../../src/voxel/carve";
import type { Level } from "../../src/level/format";
import pitJson from "../../data/levels/1-1-pit.json";

// BUG-03: the nav grid and the level's voxel pieces. A solid voxel block
// on a floor is not floor an agent can stand inside, the block's top is
// stand-able, a carve that opens it back up is seen, and the Pit's central
// block is not walkable the way the page builds its grid.

const FAKE = {
  mesh(padded: Uint8Array): Promise<MeshData> {
    return Promise.resolve(greedyMesh(padded, linearColorTable()));
  },
};

const level = {
  meta: { id: "voxel-block-test", name: "bug03", difficulty: "normal" as const },
  shell: [
    { id: "floor", shape: "box" as const, pos: [0, -0.5, 0], size: [30, 1, 30], material: "greybox" as const },
    { id: "wall-n", shape: "box" as const, pos: [0, 2, -15], size: [30, 4, 1], material: "greybox" as const },
    { id: "wall-s", shape: "box" as const, pos: [0, 2, 15], size: [30, 4, 1], material: "greybox" as const },
    { id: "wall-w", shape: "box" as const, pos: [-15, 2, 0], size: [1, 4, 30], material: "greybox" as const },
    { id: "wall-e", shape: "box" as const, pos: [15, 2, 0], size: [1, 4, 30], material: "greybox" as const },
  ],
  pieces: [
    {
      id: "block",
      kind: "cover" as const,
      anchor: "floor" as const,
      volumes: [{ pos: [0, 1.5, 4], size: [3, 3, 3], material: "foam-orange" }], // y 0 to 3
    },
  ],
  playerStart: { pos: [0, 4, -10] as [number, number, number], yaw: Math.PI },
  exit: { pos: [0, 0, 16], size: [4, 0.2, 4] },
} as unknown as Level;

// Build the level the page's frame does: build, step, bake, mesh the chunks
// (FAKE resolves in a microtask), then the pieces-ready re-bake.
async function makeGrid(l: Level) {
  const { rapier, world } = await createPhysics();
  const built = buildLevel(l, rapier, world, FAKE);
  const ai = makeLevelAI(
    rapier, world, built.navBounds, "normal", built.voxels, built.voxelMesh.group.position,
  );
  world.step();
  await new Promise((r) => setTimeout(r, 0)); // the FAKE's microtasks, then a step
  world.step();
  ai.piecesReady();
  return { world, ai, built };
}

describe("a solid voxel block on a floor", () => {
  it("is not walkable inside the block, is walkable on top of it, and the floor round it is", async () => {
    const { ai } = await makeGrid(level);
    const g = ai.grid;
    // The floor round the block (the block spans x -1.5 to 1.5, z 2.5 to 5.5).
    expect(g.canStandAt(4, 4, 0), "floor round the block").toBe(true);
    expect(g.groundAt(4, 4), "floor height round the block").toBeCloseTo(0, 2);
    // A cell inside the block is no floor. The shape cast alone (old code)
    // met only the trimesh's surfaces and read the block's centre as floor.
    // With the solid hook the floor layer is rejected (the agent's body
    // would be inside the block), so the cell's ground is left at the block's
    // top and the floor under it is gone.
    expect(g.canStandAt(0, 4, 0), "inside the block at floor height").toBe(false);
    expect(g.groundAt(0, 4), "the floor under the block is gone; the top is the ground").toBeCloseTo(3, 2);
    // The block's top is a floor an agent fits on.
    expect(g.canStandAt(0, 4, 3), "on the block's top").toBe(true);
  });

  it("a carve that opens the block back up makes the floor walkable again", async () => {
    const { world, ai, built } = await makeGrid(level);
    expect(ai.grid.canStandAt(0, 4, 0)).toBe(false);
    // A tunnel through the block at (0, 1, 4): centre in voxel units, 1.2 m
    // radius, so the floor under the hole is clear a whole head up.
    const o = built.voxelMesh.group.position;
    const s = built.voxels.voxelSize;
    carveSphere(built.voxels, (0 - o.x) / s, (1 - o.y) / s, (4 - o.z) / s, 12);
    built.voxelMesh.update(); // the chunk's collider comes back in a microtask
    await new Promise((r) => setTimeout(r, 0));
    world.step();
    ai.carveChanged(-6, 1, 6, 9);
    expect(ai.grid.canStandAt(0, 4, 0), "the tunnel is floor again").toBe(true);
    expect(ai.grid.groundAt(0, 4)).toBeCloseTo(0, 2);
  });
});

describe("the Pit's central block", () => {
  it("is not walkable at floor height on the page's grid", async () => {
    const { rapier, world } = await createPhysics();
    const pit = pitJson as unknown as Level;
    const built = buildLevel(pit, rapier, world, FAKE);
    const ai = makeLevelAI(
      rapier, world, built.navBounds, "normal", built.voxels, built.voxelMesh.group.position,
    );
    world.step();
    await new Promise((r) => setTimeout(r, 0));
    world.step();
    ai.piecesReady();
    // The centre of pit-block at floor height (the pre-fix read, probed on
    // the page's build: groundAt 0, canStandAt true, so a pack member could
    // stand inside; the block's hollow colliders never met the shape cast).
    expect(ai.grid.groundAt(0, 4), "the floor under the block is gone").toBeCloseTo(3.2, 2);
    expect(ai.grid.canStandAt(0, 4, 0)).toBe(false);
    expect(ai.grid.canStandAt(0, 4, 3.2), "the top is stand-able").toBe(true);
    // The rest of the pit's floor is unchanged.
    expect(ai.grid.walkableAt(0, -11, 0), "floor under the ring").toBe(true);
    expect(ai.grid.walkableAt(0, 17, 0), "the exit room").toBe(true);
  });
});
