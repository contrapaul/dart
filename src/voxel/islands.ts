import type { VoxelVolume } from "./chunk";
import { EMPTY, material } from "./materials";
import type { RemovedVoxel } from "./carve";

// Find the groups of voxels a carve cut loose from the rest of the volume.
// A voxel is anchored if it reaches an indestructible voxel through face
// neighbours (6-connectivity). Anything that cannot is an island.

export interface Island {
  /** Every voxel of the island with its material. */
  voxels: RemovedVoxel[];
  /** Inclusive bounds in the volume's voxel coordinates. */
  min: [number, number, number];
  max: [number, number, number];
}

// Voxel keys pack coordinates into one number; -2048 to 2047 fits in 12 bits
// per axis. The top channel needs bits 24 to 35, so this uses float
// multiply instead of <<, the same trick as chunkKey in chunk.ts.
const SHIFT = 12;
const BASE = 1 << SHIFT; // 4096: codes for -2048 to 2047
const OFFSET = BASE >> 1;
function vkey(x: number, y: number, z: number) {
  return (x + OFFSET) + (y + OFFSET) * BASE + (z + OFFSET) * BASE * BASE;
}
function decode(key: number, out: [number, number, number]) {
  out[0] = (key % BASE) - OFFSET;
  out[1] = (Math.floor(key / BASE) % BASE) - OFFSET;
  out[2] = (Math.floor(key / (BASE * BASE)) % BASE) - OFFSET;
}

// The five face neighbours that are not -y. The -y neighbour is handled
// separately and pushed last, so it is popped first: the search heads down
// toward the bedrock and usually finds an anchor in a few dozen steps.
const OTHERS: [number, number, number][] = [
  [-1, 0, 0], [1, 0, 0], [0, 0, -1], [0, 0, 1], [0, 1, 0],
];

/**
 * Find voxel groups cut loose by a carve. `removed` is what carveSphere
 * returned. Does not change the volume.
 */
export function findIslands(
  volume: VoxelVolume,
  removed: { x: number; y: number; z: number }[],
  maxSearch: number,
): Island[] {
  const islands: Island[] = [];
  const visited = new Set<number>();
  const stack: number[] = [];
  const touched: number[] = [];
  const p: [number, number, number] = [0, 0, 0];

  // Seeds: the six face neighbours of every removed voxel that are not empty.
  const seeds: number[] = [];
  for (const r of removed) {
    for (const [dx, dy, dz] of OTHERS) {
      if (volume.get(r.x + dx, r.y + dy, r.z + dz) === EMPTY) continue;
      const nk = vkey(r.x + dx, r.y + dy, r.z + dz);
      if (!visited.has(nk) && !seeds.includes(nk)) seeds.push(nk);
    }
    if (volume.get(r.x, r.y - 1, r.z) !== EMPTY) {
      const nk = vkey(r.x, r.y - 1, r.z);
      if (!visited.has(nk) && !seeds.includes(nk)) seeds.push(nk);
    }
  }

  for (const start of seeds) {
    if (visited.has(start)) continue;

    // Flood fill through non-empty face neighbours with an explicit stack.
    // Stop as soon as an indestructible voxel is reached, or when the fill
    // has visited maxSearch voxels (treated as anchored).
    // A cell whose face neighbour an earlier fill already consumed means
    // this seed sits past the snake of cells a stopped fill left unvisited:
    // it belongs to a component that was anchored (or over budget), not to
    // a new island. Without this, the early stop on an anchor splits a
    // large component into false islands.
    let anchored = false;
    let overBudget = false;
    let attached = false;
    const marked = new Set<number>();
    touched.length = 0;
    stack.length = 0;
    visited.add(start);
    marked.add(start);
    stack.push(start);
    while (stack.length > 0) {
      const key = stack.pop()!;
      decode(key, p);
      const [x, y, z] = p;
      touched.push(key);
      if (material(volume.get(x, y, z))?.indestructible ?? false) {
        anchored = true;
        break;
      }
      if (touched.length >= maxSearch) {
        overBudget = true;
        break;
      }
      for (const [dx, dy, dz] of OTHERS) {
        const nx = x + dx, ny = y + dy, nz = z + dz;
        if (volume.get(nx, ny, nz) === EMPTY) continue;
        const nk = vkey(nx, ny, nz);
        if (visited.has(nk)) {
          if (!marked.has(nk)) attached = true;
          continue;
        }
        visited.add(nk);
        marked.add(nk);
        stack.push(nk);
      }
      // The -y neighbour last, so it is popped first.
      if (volume.get(x, y - 1, z) !== EMPTY) {
        const nk = vkey(x, y - 1, z);
        if (visited.has(nk)) {
          if (!marked.has(nk)) attached = true;
        } else {
          visited.add(nk);
          marked.add(nk);
          stack.push(nk);
        }
      }
    }
    if (anchored || overBudget || attached) continue;

    // The stack ran dry with no anchor: this is an island.
    const voxels: RemovedVoxel[] = [];
    let minx = Infinity, miny = Infinity, minz = Infinity;
    let maxx = -Infinity, maxy = -Infinity, maxz = -Infinity;
    for (const key of touched) {
      decode(key, p);
      const [x, y, z] = p;
      voxels.push({ x, y, z, material: volume.get(x, y, z) });
      minx = Math.min(minx, x); maxx = Math.max(maxx, x);
      miny = Math.min(miny, y); maxy = Math.max(maxy, y);
      minz = Math.min(minz, z); maxz = Math.max(maxz, z);
    }
    islands.push({ voxels, min: [minx, miny, minz], max: [maxx, maxy, maxz] });
  }
  return islands;
}

// Cover a set of voxels with a few non-overlapping solid boxes.

/** An inclusive box of voxel coordinates. */
export interface Box { x0: number; y0: number; z0: number; x1: number; y1: number; z1: number }

/** Cover exactly these voxels with non-overlapping boxes, few of them. */
export function boxCover(voxels: { x: number; y: number; z: number }[]): Box[] {
  const boxes: Box[] = [];
  if (voxels.length === 0) return boxes;
  const has = new Set(voxels.map((v) => vkey(v.x, v.y, v.z)));
  // y, then z, then x order: x fastest, y slowest.
  const keys = [...has].sort((a, b) => {
    const ay = Math.floor(a / BASE) % BASE, by = Math.floor(b / BASE) % BASE;
    if (ay !== by) return ay - by;
    const az = Math.floor(a / (BASE * BASE)) % BASE, bz = Math.floor(b / (BASE * BASE)) % BASE;
    if (az !== bz) return az - bz;
    return a - b;
  });
  const live = (x: number, y: number, z: number) => has.has(vkey(x, y, z));
  const p: [number, number, number] = [0, 0, 0];

  for (const k of keys) {
    if (!has.has(k)) continue;
    decode(k, p);
    const [x0, y0, z0] = p;
    // Grow +x while voxels exist and are not covered.
    let x1 = x0;
    while (live(x1 + 1, y0, z0)) x1++;
    // Then +z while the whole row exists.
    let z1 = z0;
    row: while (true) {
      for (let x = x0; x <= x1; x++) if (!live(x, y0, z1 + 1)) break row;
      z1++;
    }
    // Then +y while the whole slab exists.
    let y1 = y0;
    slab: while (true) {
      for (let z = z0; z <= z1; z++)
        for (let x = x0; x <= x1; x++) if (!live(x, y1 + 1, z)) break slab;
      y1++;
    }
    boxes.push({ x0, y0, z0, x1, y1, z1 });
    for (let y = y0; y <= y1; y++)
      for (let z = z0; z <= z1; z++)
        for (let x = x0; x <= x1; x++) has.delete(vkey(x, y, z));
  }
  return boxes;
}
