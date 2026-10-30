import { describe, expect, it } from "vitest";
import { EMPTY } from "../../src/voxel/materials";
import { VoxelVolume } from "../../src/voxel/chunk";
import { materialId } from "../../src/voxel/materials";
import { findIslands, boxCover } from "../../src/voxel/islands";

const FOAM = materialId("foam-orange");
const BEDROCK = materialId("bedrock");

// Empty a list of voxels in the volume (what a carve has done) and return
// the same list, ready to pass as `removed`.
function empty(v: VoxelVolume, voxels: { x: number; y: number; z: number }[]) {
  for (const p of voxels) v.set(p.x, p.y, p.z, EMPTY);
  return voxels;
}

function grid(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) {
  const out: { x: number; y: number; z: number }[] = [];
  for (let y = y0; y <= y1; y++)
    for (let z = z0; z <= z1; z++)
      for (let x = x0; x <= x1; x++) out.push({ x, y, z });
  return out;
}

describe("findIslands", () => {
  it("1: finds the piece cut loose above a blown-out layer", () => {
    const v = new VoxelVolume(0.1);
    v.fillBox(0, 0, 0, 3, 19, 3, FOAM);
    v.fillBox(0, 0, 0, 3, 0, 3, BEDROCK);
    const removed = empty(v, grid(0, 3, 10, 10, 0, 3));
    const islands = findIslands(v, removed, 10000);
    expect(islands).toHaveLength(1);
    const island = islands[0]!;
    expect(island.voxels).toHaveLength(4 * 9 * 4);
    expect(island.min).toEqual([0, 11, 0]);
    expect(island.max).toEqual([3, 19, 3]);
    for (const p of island.voxels) {
      expect(p.y).toBeGreaterThanOrEqual(11);
      expect(p.y).toBeLessThanOrEqual(19);
    }
    // The volume still contains those voxels afterwards: findIslands does
    // not change the volume.
    for (const p of island.voxels) expect(v.get(p.x, p.y, p.z)).toBe(FOAM);
  });

  it("2: finds nothing when one voxel of the layer survived", () => {
    const v = new VoxelVolume(0.1);
    v.fillBox(0, 0, 0, 3, 19, 3, FOAM);
    v.fillBox(0, 0, 0, 3, 0, 3, BEDROCK);
    const removed = empty(v,
      grid(0, 3, 10, 10, 0, 3).filter((p) => !(p.x === 1 && p.z === 1)),
    );
    expect(findIslands(v, removed, 10000)).toEqual([]);
  });

  it("3: finds both cut-off arms of a T", () => {
    const v = new VoxelVolume(0.1);
    v.fillBox(8, 0, 0, 11, 19, 3, FOAM);
    v.fillBox(8, 0, 0, 11, 0, 3, BEDROCK);
    v.fillBox(0, 20, 0, 19, 23, 3, FOAM);
    const removed = empty(v, [...grid(4, 7, 20, 23, 0, 3), ...grid(12, 15, 20, 23, 0, 3)]);
    const islands = findIslands(v, removed, 10000);
    expect(islands).toHaveLength(2);
    const arms = islands
      .map((i) => i.min[0])
      .sort((a, b) => a - b);
    expect(arms).toEqual([0, 16]);
    for (const island of islands) {
      expect(island.voxels).toHaveLength(64);
      expect(island.min[1]).toBe(20);
      expect(island.max[1]).toBe(23);
      expect(island.min[2]).toBe(0);
      expect(island.max[2]).toBe(3);
    }
  });

  it("4: never breaks a volume without bedrock apart (search budget)", () => {
    const v = new VoxelVolume(0.1);
    v.fillBox(5, 5, 5, 24, 24, 24, FOAM);
    const removed = empty(v, [{ x: 5, y: 5, z: 5 }]);
    expect(findIslands(v, removed, 1000)).toEqual([]);
    // The corner voxel is gone (the carve emptied it) and findIslands
    // changed nothing else.
    expect(v.get(5, 5, 5)).toBe(EMPTY);
    expect(v.get(6, 5, 5)).toBe(FOAM);
  });

  it("4b: a seed that meets a stopped fill's voxels is attached, not an island", () => {
    // A 1-wide column on bedrock with a hook at the top: (1, 11) hangs off
    // (0, 11). Removing (1, 10) seeds (0, 10) first; that fill marks
    // (0, 11) visited, heads down and stops at the bedrock. The hook's own
    // fill then meets (0, 11) and must count as attached.
    const v = new VoxelVolume(0.1);
    v.fillBox(0, 0, 0, 0, 12, 0, FOAM);
    v.set(0, 0, 0, BEDROCK);
    v.set(1, 11, 0, FOAM);
    v.set(1, 10, 0, FOAM);
    const removed = empty(v, [{ x: 1, y: 10, z: 0 }]);
    expect(findIslands(v, removed, 1000)).toEqual([]);
  });
});

describe("boxCover", () => {
  function coveredOnce(boxes: ReturnType<typeof boxCover>, voxels: { x: number; y: number; z: number }[]) {
    const count = new Map<string, number>();
    for (const b of boxes)
      for (let y = b.y0; y <= b.y1; y++)
        for (let z = b.z0; z <= b.z1; z++)
          for (let x = b.x0; x <= b.x1; x++) {
            const k = `${x},${y},${z}`;
            count.set(k, (count.get(k) ?? 0) + 1);
          }
    expect(count.size).toBe(voxels.length);
    for (const [k, n] of count) {
      expect(n).toBe(1);
      expect(voxels.some((p) => `${p.x},${p.y},${p.z}` === k)).toBe(true);
    }
  }

  it("5: a solid 4 x 5 x 6 block gives exactly one box", () => {
    const voxels = grid(0, 3, 0, 4, 0, 5);
    const boxes = boxCover(voxels);
    expect(boxes).toEqual([{ x0: 0, y0: 0, z0: 0, x1: 3, y1: 4, z1: 5 }]);
  });

  it("5: an L of two boxes gives at most three and covers exactly once", () => {
    const voxels = [...grid(0, 3, 0, 1, 0, 1), ...grid(0, 1, 2, 5, 0, 1)];
    const boxes = boxCover(voxels);
    expect(boxes.length).toBeGreaterThanOrEqual(1);
    expect(boxes.length).toBeLessThanOrEqual(3);
    coveredOnce(boxes, voxels);
  });
});
