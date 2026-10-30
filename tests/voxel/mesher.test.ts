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

describe("buildPadded border", () => {
  it("fills padded edges and corners from the volume", () => {
    const v = new VoxelVolume(1);
    v.set(2, 2, 2, 1); // keeps chunk (0,0,0) in the sparse map
    v.set(-1, -1, 5, 1);
    v.set(-1, -1, -1, 1);
    const chunk = v.chunks.get(chunkKey(0, 0, 0))!;
    const padded = buildPadded(v, 0, 0, 0, chunk);
    expect(padded[paddedIndex(-1, -1, 5)]).toBe(1);
    expect(padded[paddedIndex(-1, -1, -1)]).toBe(1);
    expect(padded[paddedIndex(0, 0, 0)]).toBe(0);
  });
});

describe("greedyMesh ambient occlusion", () => {
  it("leaves a lone voxel at full brightness and six quads", () => {
    const v = new VoxelVolume(1);
    v.set(4, 4, 4, 1);
    const m = meshOf(v);
    expect(quads(m)).toBe(6);
    for (let i = 0; i < m.colors.length; i++) {
      expect(m.colors[i]).toBeCloseTo(colors[3 + (i % 3)], 5);
    }
  });

  it("keeps a 4 x 1 x 4 slab's top face as one quad", () => {
    const v = new VoxelVolume(1);
    v.fillBox(14, 0, 14, 17, 0, 17, 1);
    const m = meshOf(v);
    expect(quads(m)).toBe(6);
    let topTris = 0;
    for (let t = 0; t < m.indices.length; t += 3) {
      const a = m.indices[t] * 3;
      if (m.normals[a + 1] === 1) topTris++;
    }
    expect(topTris).toBe(2);
  });

  it("darkens a slab top under a standing voxel, not at outer corners", () => {
    const v = new VoxelVolume(1);
    v.fillBox(14, 0, 14, 17, 0, 17, 1); // 4 x 1 x 4 slab
    v.set(15, 1, 15, 1); // a voxel standing on it, in the middle
    const m = meshOf(v);
    let touchedVertex = false, outerVertex = false;
    for (let i = 0; i < m.positions.length; i += 3) {
      if (m.normals[i + 1] !== 1) continue; // top face only
      const px = m.positions[i], py = m.positions[i + 1], pz = m.positions[i + 2];
      if (Math.abs(py - 1) > 1e-6) continue;
      expect(m.colors[i]).toBeLessThanOrEqual(colors[3] + 1e-6);
      expect(m.colors[i + 1]).toBeLessThanOrEqual(colors[4] + 1e-6);
      expect(m.colors[i + 2]).toBeLessThanOrEqual(colors[5] + 1e-6);
      // Vertices that touch the standing voxel (it spans 15 to 16 on x and z).
      if (px > 14 && px < 17 && pz > 14 && pz < 17) {
        touchedVertex = true;
        expect(m.colors[i]).toBeLessThan(colors[3]);
      }
      // Outer corners of the slab stay fully open.
      if ((px <= 14 || px >= 18) && (pz <= 14 || pz >= 18)) {
        outerVertex = true;
        expect(m.colors[i]).toBeCloseTo(colors[3], 5);
      }
    }
    expect(touchedVertex).toBe(true);
    expect(outerVertex).toBe(true);
  });

  it("sets per-corner AO levels on an inside corner", () => {
    const levels = [0.1, 0.2, 0.3, 1];
    const v = new VoxelVolume(1);
    v.set(0, 0, 0, 1);
    v.set(1, 1, 0, 1);
    v.set(0, 1, 1, 1);
    const chunk = v.chunks.get(chunkKey(0, 0, 0))!;
    const m = greedyMesh(buildPadded(v, 0, 0, 0, chunk), colors, levels);
    // The top face of (0,0,0) is one quad at y = 1, x and z in 0..1.
    // Vertex (1,1) has both side cells solid: aoLevels[0]. (1,0) and (0,1)
    // have one side solid: aoLevels[2]. (0,0) has none: aoLevels[3].
    const want: Record<string, number> = { "1,1": 0, "1,0": 2, "0,1": 2, "0,0": 3 };
    let found = 0;
    for (let i = 0; i < m.positions.length; i += 3) {
      if (m.normals[i + 1] !== 1 || Math.abs(m.positions[i + 1] - 1) > 1e-6) continue;
      const key = `${Math.round(m.positions[i])},${Math.round(m.positions[i + 2])}`;
      const lvl = want[key];
      if (lvl === undefined) continue;
      found++;
      for (let c = 0; c < 3; c++) {
        expect(m.colors[i + c]).toBeCloseTo(colors[3 + c] * levels[lvl], 5);
      }
    }
    expect(found).toBe(4);
  });

  it("keeps winding outward on quads whose diagonal flips", () => {
    const v = new VoxelVolume(1);
    v.set(0, 0, 0, 1);
    v.set(1, 1, 0, 1);
    v.set(0, 1, 1, 1);
    const chunk = v.chunks.get(chunkKey(0, 0, 0))!;
    const m2 = greedyMesh(buildPadded(v, 0, 0, 0, chunk), colors, [0.1, 0.2, 0.3, 1]);
    expect(windingMatchesNormals(m2)).toBe(true);
  });
});
