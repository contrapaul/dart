import { describe, expect, it } from "vitest";
import { VoxelVolume, chunkKey } from "../../src/voxel/chunk";
import { buildPadded, greedyMesh, PAD, paddedIndex } from "../../src/voxel/mesher";
import { linearColorTable } from "../../src/voxel/materials";

const colors = linearColorTable();
const quads = (m: { indices: Uint32Array }) => m.indices.length / 6;

function meshOf(volume: VoxelVolume, cx = 0, cy = 0, cz = 0) {
  const chunk = volume.chunks.get(chunkKey(cx, cy, cz))!;
  return greedyMesh(buildPadded(volume, cx, cy, cz, chunk), colors);
}

// Every triangle's winding must agree with its stored normal.
function windingMatchesNormals(m: ReturnType<typeof greedyMesh>) {
  const p = m.positions;
  for (let t = 0; t < m.indices.length; t += 3) {
    const [a, b, c] = [m.indices[t], m.indices[t + 1], m.indices[t + 2]];
    const e1 = [p[b * 3] - p[a * 3], p[b * 3 + 1] - p[a * 3 + 1], p[b * 3 + 2] - p[a * 3 + 2]];
    const e2 = [p[c * 3] - p[a * 3], p[c * 3 + 1] - p[a * 3 + 1], p[c * 3 + 2] - p[a * 3 + 2]];
    const cross = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const dot = cross[0] * m.normals[a * 3] + cross[1] * m.normals[a * 3 + 1] + cross[2] * m.normals[a * 3 + 2];
    if (dot <= 0) return false;
  }
  return true;
}

describe("greedyMesh", () => {
  it("meshes one voxel as six outward quads", () => {
    const v = new VoxelVolume(1);
    v.set(3, 4, 5, 1);
    const m = meshOf(v);
    expect(quads(m)).toBe(6);
    expect(windingMatchesNormals(m)).toBe(true);
    const xs = [...m.positions].filter((_, i) => i % 3 === 0);
    expect(Math.min(...xs)).toBe(3);
    expect(Math.max(...xs)).toBe(4);
  });

  it("merges a solid box of one material into six quads", () => {
    const v = new VoxelVolume(1);
    v.fillBox(2, 2, 2, 20, 10, 15, 1);
    const m = meshOf(v);
    expect(quads(m)).toBe(6);
    expect(windingMatchesNormals(m)).toBe(true);
  });

  it("does not merge across different materials", () => {
    const v = new VoxelVolume(1);
    v.fillBox(0, 0, 0, 3, 0, 0, 1);
    v.fillBox(4, 0, 0, 7, 0, 0, 2);
    // Each half: 4 long faces + 1 end face (the shared faces are hidden).
    expect(quads(meshOf(v))).toBe(10);
  });

  it("hides faces against a neighbouring chunk", () => {
    const v = new VoxelVolume(1);
    v.fillBox(0, 0, 0, 63, 0, 0, 1); // a rod across two chunks
    const left = meshOf(v, 0);
    // No +x end cap at x = 32: the neighbour chunk continues the rod.
    const xs = [...left.positions].filter((_, i) => i % 3 === 0);
    expect(quads(left)).toBe(5);
    expect(Math.max(...xs)).toBe(32);
  });

  it("colours vertices from the palette", () => {
    const v = new VoxelVolume(1);
    v.set(0, 0, 0, 2);
    const m = meshOf(v);
    expect([...m.colors.slice(0, 3)]).toEqual([...colors.slice(6, 9)]);
  });

  it("returns an empty mesh for padding-only input", () => {
    const m = greedyMesh(new Uint8Array(PAD ** 3), colors);
    expect(m.indices.length).toBe(0);
    expect(paddedIndex(-1, -1, -1)).toBe(0);
  });
});
