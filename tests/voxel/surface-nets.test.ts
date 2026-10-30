import { describe, expect, it } from "vitest";
import { VoxelVolume } from "../../src/voxel/chunk";
import { buildPadded, PAD, type MeshData } from "../../src/voxel/mesher";
import { surfaceNets } from "../../src/voxel/surface-nets";
import { linearColorTable, materialId } from "../../src/voxel/materials";

const colors = linearColorTable();
const LIME = materialId("foam-lime");
const INK = materialId("foam-ink");

function meshOf(volume: VoxelVolume, iterations?: number): MeshData {
  const chunk = volume.chunks.get([...volume.chunks.keys()][0])!;
  return surfaceNets(buildPadded(volume, 0, 0, 0, chunk), colors, iterations);
}

/** Every edge is shared by exactly two triangles, in opposite directions. */
function isClosed(m: MeshData) {
  const edges = new Map<string, number>();
  for (let t = 0; t < m.indices.length; t += 3)
    for (let k = 0; k < 3; k++) {
      const a = m.indices[t + k], b = m.indices[t + ((k + 1) % 3)];
      edges.set(`${a},${b}`, (edges.get(`${a},${b}`) ?? 0) + 1);
    }
  for (const [key, n] of edges) {
    const [a, b] = key.split(",");
    if (n !== 1 || edges.get(`${b},${a}`) !== 1) return false;
  }
  return edges.size > 0;
}

/** Fraction of triangles whose winding normal points away from c. */
function outwardFraction(m: MeshData, c: [number, number, number]) {
  const P = m.positions;
  let out = 0;
  const n = m.indices.length / 3;
  for (let t = 0; t < m.indices.length; t += 3) {
    const [i0, i1, i2] = [m.indices[t] * 3, m.indices[t + 1] * 3, m.indices[t + 2] * 3];
    const ax = P[i1] - P[i0], ay = P[i1 + 1] - P[i0 + 1], az = P[i1 + 2] - P[i0 + 2];
    const bx = P[i2] - P[i0], by = P[i2 + 1] - P[i0 + 1], bz = P[i2 + 2] - P[i0 + 2];
    const nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
    const mx = (P[i0] + P[i1] + P[i2]) / 3 - c[0];
    const my = (P[i0 + 1] + P[i1 + 1] + P[i2 + 1]) / 3 - c[1];
    const mz = (P[i0 + 2] + P[i1 + 2] + P[i2 + 2]) / 3 - c[2];
    if (nx * mx + ny * my + nz * mz > 0) out++;
  }
  return out / n;
}

describe("surfaceNets", () => {
  it("meshes one voxel as a closed, outward-facing blob inside its neighbours' cells", () => {
    const v = new VoxelVolume(1);
    v.set(4, 4, 4, LIME);
    const m = meshOf(v);
    expect(m.positions.length / 3).toBe(8);
    expect(isClosed(m)).toBe(true);
    expect(outwardFraction(m, [4.5, 4.5, 4.5])).toBe(1);
    for (let i = 0; i < m.positions.length; i++) {
      expect(m.positions[i]).toBeGreaterThanOrEqual(4);
      expect(m.positions[i]).toBeLessThanOrEqual(5);
    }
  });

  it("keeps the middle of a box face flat on the voxel face and rounds the corners in", () => {
    const v = new VoxelVolume(1);
    v.fillBox(2, 2, 2, 17, 17, 17, LIME); // 16 voxels a side, faces at 2 and 18
    const m = meshOf(v);
    expect(isClosed(m)).toBe(true);
    expect(outwardFraction(m, [10, 10, 10])).toBe(1);
    let maxR = 0;
    let flatOnTop = 0;
    for (let i = 0; i < m.positions.length; i += 3) {
      const [x, y, z] = [m.positions[i], m.positions[i + 1], m.positions[i + 2]];
      maxR = Math.max(maxR, Math.hypot(x - 10, y - 10, z - 10));
      // Far enough from the edges that relaxation does not reach.
      if (x > 8 && x < 12 && z > 8 && z < 12 && y > 17) {
        expect(y).toBeCloseTo(18, 5);
        flatOnTop++;
      }
    }
    expect(flatOnTop).toBeGreaterThan(0);
    // A sharp cube corner would be at sqrt(3) * 8 = 13.86 from the centre.
    expect(maxR).toBeLessThan(13.5);
  });

  it("smooths more with more iterations, and none matches blocks", () => {
    const v = new VoxelVolume(1);
    v.fillBox(2, 2, 2, 9, 9, 9, LIME);
    const corner = (m: MeshData) => {
      let r = 0;
      for (let i = 0; i < m.positions.length; i += 3)
        r = Math.max(r, Math.hypot(m.positions[i] - 6, m.positions[i + 1] - 6, m.positions[i + 2] - 6));
      return r;
    };
    expect(corner(meshOf(v, 8))).toBeLessThan(corner(meshOf(v, 0)));
  });

  it("colours vertices from the materials around them, and normals are unit length", () => {
    const v = new VoxelVolume(1);
    v.fillBox(2, 2, 2, 9, 9, 9, LIME);
    v.fillBox(2, 2, 9, 9, 9, 9, INK); // the +z face layer is ink
    const m = meshOf(v);
    let lime = 0, ink = 0;
    for (let i = 0; i < m.colors.length; i += 3) {
      if (m.colors[i] === colors[LIME * 3] && m.colors[i + 1] === colors[LIME * 3 + 1]) lime++;
      if (m.colors[i] === colors[INK * 3] && m.colors[i + 1] === colors[INK * 3 + 1]) ink++;
    }
    expect(lime).toBeGreaterThan(0);
    expect(ink).toBeGreaterThan(0);
    for (let i = 0; i < m.normals.length; i += 3)
      expect(Math.hypot(m.normals[i], m.normals[i + 1], m.normals[i + 2])).toBeCloseTo(1, 5);
  });

  it("returns an empty mesh for padding-only input", () => {
    const m = surfaceNets(new Uint8Array(PAD ** 3), colors);
    expect(m.indices.length).toBe(0);
    expect(m.positions.length).toBe(0);
  });
});
