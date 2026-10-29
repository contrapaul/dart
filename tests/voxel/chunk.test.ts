import { describe, expect, it } from "vitest";
import { Chunk, CHUNK_SIZE, chunkCoords, chunkKey, VoxelVolume } from "../../src/voxel/chunk";

describe("Chunk", () => {
  it("stores and counts voxels", () => {
    const c = new Chunk();
    expect(c.set(1, 2, 3, 5)).toBe(true);
    expect(c.set(1, 2, 3, 5)).toBe(false);
    expect(c.get(1, 2, 3)).toBe(5);
    expect(c.count).toBe(1);
    c.set(1, 2, 3, 7);
    expect(c.count).toBe(1);
    c.set(1, 2, 3, 0);
    expect(c.count).toBe(0);
  });

  it("gives every voxel a distinct index", () => {
    const seen = new Set<number>();
    for (let y = 0; y < CHUNK_SIZE; y++)
      for (let z = 0; z < CHUNK_SIZE; z++)
        for (let x = 0; x < CHUNK_SIZE; x++) seen.add(Chunk.index(x, y, z));
    expect(seen.size).toBe(CHUNK_SIZE ** 3);
    expect(Math.max(...seen)).toBe(CHUNK_SIZE ** 3 - 1);
  });
});

describe("chunk keys", () => {
  it("round-trip across the full range", () => {
    const cases: [number, number, number][] = [[0, 0, 0], [-1, 5, -7], [-512, -512, -512], [511, 511, 511], [3, -400, 200]];
    for (const [x, y, z] of cases) {
      expect(chunkCoords(chunkKey(x, y, z))).toEqual([x, y, z]);
    }
  });
});

describe("VoxelVolume", () => {
  it("reads empty where nothing was set", () => {
    const v = new VoxelVolume(0.1);
    expect(v.get(0, 0, 0)).toBe(0);
    expect(v.get(-1000, 50, 9999)).toBe(0);
  });

  it("stores voxels at negative coordinates and across chunk edges", () => {
    const v = new VoxelVolume(0.1);
    for (const [x, y, z] of [[-1, -1, -1], [31, 0, 0], [32, 0, 0], [-33, 64, -65]]) {
      v.set(x, y, z, 3);
      expect(v.get(x, y, z)).toBe(3);
    }
    expect(v.get(30, 0, 0)).toBe(0);
    expect(v.chunks.size).toBe(4);
  });

  it("frees a chunk when its last voxel is removed", () => {
    const v = new VoxelVolume(0.1);
    v.set(5, 5, 5, 1);
    v.set(5, 5, 5, 0);
    expect(v.chunks.size).toBe(0);
    expect(v.set(5, 5, 5, 0)).toBe(false);
  });

  it("marks neighbours dirty for edge edits only", () => {
    const v = new VoxelVolume(0.1);
    v.set(10, 10, 10, 1);
    expect(v.takeDirty()).toEqual([chunkKey(0, 0, 0)]);
    expect(v.takeDirty()).toEqual([]);

    v.set(31, 0, 10, 1);
    expect(new Set(v.takeDirty())).toEqual(
      new Set([chunkKey(0, 0, 0), chunkKey(1, 0, 0), chunkKey(0, -1, 0)]),
    );
  });

  it("does not mark anything dirty for a no-op set", () => {
    const v = new VoxelVolume(0.1);
    v.set(1, 1, 1, 2);
    v.takeDirty();
    v.set(1, 1, 1, 2);
    expect(v.takeDirty()).toEqual([]);
  });

  it("fills an inclusive box", () => {
    const v = new VoxelVolume(0.25);
    v.fillBox(-2, 0, -2, 33, 3, 1, 4);
    let n = 0;
    for (const c of v.chunks.values()) n += c.count;
    expect(n).toBe(36 * 4 * 4);
    expect(v.get(33, 3, 1)).toBe(4);
    expect(v.get(34, 3, 1)).toBe(0);
  });
});
