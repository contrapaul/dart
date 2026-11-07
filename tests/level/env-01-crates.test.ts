import { beforeAll, describe, expect, it } from "vitest";
import RAPIER from "@dimforge/rapier3d-compat";
import envJson from "../../data/levels/env-01.json";
import { buildLevel } from "../../src/level/build";
import { validateLevel } from "../../src/level/validate";
import { createPhysics } from "../../src/physics/world";
import { greedyMesh, type MeshData } from "../../src/voxel/mesher";
import { linearColorTable, material } from "../../src/voxel/materials";
import { EMPTY } from "../../src/voxel/materials";
import { boxCover, findIslands } from "../../src/voxel/islands";
import tuning from "../../data/destruction.json";
import type { Level, Piece } from "../../src/level/format";

// ENV-01 stage 2: E02, the toy crate stacks. A stack is one floor anchored
// piece, so fillPieces makes only its lowest voxel row (the hidden plinth)
// bedrock and the crates above it hang from that row through their own
// voxels. The test that matters is the topple: carve a bottom crate out and
// the crate above it must be an island, with no path to bedrock, while a
// crate standing on its own plinth stays anchored.

const level = envJson as unknown as Level;
const FAKE = {
  mesh(padded: Uint8Array): Promise<MeshData> {
    return Promise.resolve(greedyMesh(padded, linearColorTable()));
  },
};
/** KIT 5: a zone is a 32 x 32 x 32 chunk of 0.1 m voxels (3.2 m). */
const ZONE_CAP = 6;
const CRATE = 0.6;
const MAX_COLLIDERS = tuning.islands.maxCollidersPerPiece;
const MIN_PIECE_VOXELS = tuning.islands.minPieceVoxels;

beforeAll(async () => {
  await RAPIER.init();
});

function piece(id: string): Piece {
  const p = (level.pieces ?? []).find((q) => q.id === id);
  if (!p) throw new Error(`no piece ${id}`);
  return p;
}

/** The 32-voxel chunks the built volume allocated: the KIT 5 zone count. */
function zoneCount(built: ReturnType<typeof buildLevel>) {
  const cells = new Set<string>();
  for (const [key] of built.voxels.chunks) {
    // chunkKey packs (x, y, z) with a 512 bias on each axis.
    const cx = (key % 1024) - 512;
    const cy = (Math.floor(key / 1024) % 1024) - 512;
    const cz = (Math.floor(key / 1048576) % 1024) - 512;
    cells.add(`${cx},${cy},${cz}`);
  }
  return cells.size;
}

/** The volumes of one crate: a frame of twelve bars around a cardboard body,
 *  every one of them inside the crate's own 0.6 m cube. */
function crateVolumes(id: string, cx: number, cy: number, cz: number) {
  return piece(id).volumes.filter((v) =>
    Math.abs(v.pos[0] - cx) <= 0.3 + 1e-9
    && Math.abs(v.pos[1] - cy) <= 0.3 + 1e-9
    && Math.abs(v.pos[2] - cz) <= 0.3 + 1e-9
    && v.pos[1] - v.size[1] / 2 > cy - 0.3 - 1e-9
    && v.pos[1] + v.size[1] / 2 < cy + 0.3 + 1e-9);
}

/** Carve every destructible voxel inside a world-space box away, then hand
 *  the removed voxels to the island search exactly as
 *  FallingPieces.afterCarve does. A stream of standard darts would take
 *  several hits to eat a crate, so the test removes the whole crate at once
 *  and asks the same question the game asks after each hit. */
function carveBox(
  built: ReturnType<typeof buildLevel>,
  box: { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number },
) {
  const o = built.voxelMesh.group.position;
  const s = built.voxels.voxelSize;
  const removed: { x: number; y: number; z: number; material: number }[] = [];
  const x0 = Math.round((box.x0 - o.x) / s), x1 = Math.round((box.x1 - o.x) / s) - 1;
  const y0 = Math.round((box.y0 - o.y) / s), y1 = Math.round((box.y1 - o.y) / s) - 1;
  const z0 = Math.round((box.z0 - o.z) / s), z1 = Math.round((box.z1 - o.z) / s) - 1;
  for (let y = y0; y <= y1; y++)
    for (let z = z0; z <= z1; z++)
      for (let x = x0; x <= x1; x++) {
        const m = built.voxels.get(x, y, z);
        if (m === EMPTY) continue;
        built.voxels.set(x, y, z, EMPTY);
        removed.push({ x, y, z, material: m });
      }
  return findIslands(built.voxels, removed, tuning.islands.maxSearchVoxels);
}

async function built() {
  const { rapier, world } = await createPhysics();
  const b = buildLevel(level, rapier, world, FAKE);
  await new Promise((r) => setTimeout(r, 0));
  world.step();
  return b;
}

describe("the env-01 crate stacks", () => {
  it("load as a valid level next to the stage 1 coat", () => {
    const report = validateLevel(level);
    expect(report.errors).toEqual([]);
    expect(level.pieces!.map((p) => p.id)).toEqual(["col-coat", "stack-a", "stack-b"]);
  });

  it("keeps the coat and both stacks inside the KIT 5 zone cap", async () => {
    // KIT 5 counts zones: 32 x 32 x 32 voxel chunks, 3.2 m cubes. A crate is
    // thirteen boxes but they all sit inside one chunk, and a stack inside
    // one chunk too, so the question is how many chunks hold piece voxels.
    // The coat straddles a chunk boundary in x, so it is 2; each stack is 1.
    expect(zoneCount(await built())).toBe(3);
    expect(zoneCount(await built())).toBeLessThanOrEqual(ZONE_CAP);
  });

  it("builds each crate as a 0.6 m box with a frame proud of the panels", () => {
    for (const [id, centres] of [
      ["stack-a", [[-5.3, 0.4, 1.4], [-4.7, 0.4, 1.4], [-5.6, 1.0, 1.4]]],
      ["stack-b", [[2.5, 0.4, 1.0], [2.5, 1.0, 1.0]]],
    ] as const) {
      for (const [cx, cy, cz] of centres) {
        const vols = crateVolumes(id, cx, cy, cz);
        // Eighteen volumes: six hollow panels and the twelve edges (review:
        // a solid crate could not be shot through in play).
        expect(vols.length).toBe(18);
        const span = (axis: number) => {
          const lo = Math.min(...vols.map((v) => v.pos[axis]! - v.size[axis]! / 2));
          const hi = Math.max(...vols.map((v) => v.pos[axis]! + v.size[axis]! / 2));
          return hi - lo;
        };
        expect(span(0)).toBeCloseTo(CRATE, 6);
        expect(span(1)).toBeCloseTo(CRATE, 6);
        expect(span(2)).toBeCloseTo(CRATE, 6);
        // The frame is a second colour, and the panels between the bars are
        // recessed: they sit 0.2 m from the centre against the crate's 0.3,
        // so a bar stands 0.1 m proud of the face it frames. The panels are
        // 0.1 m thick and the inside is empty.
        const body = vols.filter((v) => v.material === "cardboard");
        const bars = vols.filter((v) => v.material === "foam-ink");
        expect(body.length).toBe(6);
        expect(bars.length).toBe(12);
        for (const v of body) expect([...v.size].sort()).toEqual([0.1, 0.4, 0.4]);
      }
    }
  });

  it("is a step the player can mantle, not a wall", () => {
    for (const id of ["stack-a", "stack-b"]) {
      const top = Math.max(...piece(id).volumes.map((v) => v.pos[1] + v.size[1] / 2));
      // Two crates on a 0.1 m plinth: 1.3 m, under the 1.5 m mantle.
      expect(top).toBeCloseTo(1.3, 6);
    }
  });

  it("puts only the hidden plinth on each stack's lowest row", () => {
    // fillPieces makes the lowest voxel row bedrock. If a crate sat on that
    // row it would be indestructible and the stack could not topple, so the
    // bottom row is a plinth the crate stands on and hides.
    for (const [id, plinths] of [["stack-a", 2], ["stack-b", 1]] as const) {
      const vols = piece(id).volumes;
      const bottom = Math.min(...vols.map((v) => v.pos[1] - v.size[1] / 2));
      const onBottom = vols.filter((v) => Math.abs(v.pos[1] - v.size[1] / 2 - bottom) < 1e-6);
      expect(onBottom.length).toBe(plinths);
      for (const v of onBottom) expect(v.size[1]).toBeCloseTo(0.1, 6);
      // No crate frame or panel reaches the floor.
      for (const v of vols) {
        if (v.material === "cardboard" || v.material === "foam-ink") {
          expect(v.pos[1] - v.size[1] / 2).toBeGreaterThanOrEqual(0.1 - 1e-9);
        }
      }
    }
  });

  it("drops the top crate of the two crate column when the bottom goes", async () => {
    const b = await built();
    // stack-b is a column at x 2.5, z 1.0: the bottom crate is 0.1 to 0.7 m.
    const islands = carveBox(b, { x0: 2.2, x1: 2.8, y0: 0.1, y1: 0.7, z0: 0.7, z1: 1.3 });
    expect(islands.length).toBe(1);
    const isle = islands[0]!;
    const o = b.voxelMesh.group.position;
    const s = b.voxels.voxelSize;
    // The island is the whole top crate, 0.6 m to 1.3 m up, in both of its
    // colours: the frame and the panel break off together, as one crate.
    expect(o.y + isle.min[1] * s).toBeCloseTo(0.7, 6);
    expect(o.y + (isle.max[1] + 1) * s).toBeCloseTo(1.3, 6);
    const mats = new Set(isle.voxels.map((v) => material(v.material)?.name));
    expect(mats).toEqual(new Set(["cardboard", "foam-ink"]));
    // Heavy enough to be a falling piece rather than debris, and cheap
    // enough to collide as a handful of boxes.
    expect(isle.voxels.length).toBeGreaterThanOrEqual(MIN_PIECE_VOXELS);
    const local = isle.voxels.map((v) => ({
      x: v.x - isle.min[0], y: v.y - isle.min[1], z: v.z - isle.min[2],
    }));
    expect(boxCover(local).length).toBeLessThanOrEqual(MAX_COLLIDERS);
  });

  it("drops the offset top crate and leaves the right crate standing", async () => {
    const b = await built();
    // stack-a: the left bottom crate goes. The top crate sits over the left
    // one only, so it has nothing left to hang from.
    const islands = carveBox(b, { x0: -5.6, x1: -5.0, y0: 0.1, y1: 0.7, z0: 1.1, z1: 1.7 });
    expect(islands.length).toBe(1);
    const isle = islands[0]!;
    const o = b.voxelMesh.group.position;
    const s = b.voxels.voxelSize;
    expect(o.y + isle.min[1] * s).toBeCloseTo(0.7, 6);
    // The right crate is still up and still anchored: its panel voxels are
    // in place, tied to its own plinth.
    const right = b.voxels;
    // The crate is hollow, so look in its east panel, not its middle.
    const gx = Math.floor((-4.55 - o.x) / s + 1e-6);
    const gy = Math.floor((0.35 - o.y) / s + 1e-6);
    const gz = Math.round((1.4 - o.z) / s);
    expect(material(right.get(gx, gy, gz))?.name).toBe("cardboard");
  });
});
