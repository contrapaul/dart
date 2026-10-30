import { EMPTY } from "./materials";

// Voxel storage. A volume is a sparse set of 32 x 32 x 32 chunks of material
// bytes. Voxel coordinates are integers in the volume's own space; the
// volume's voxelSize turns them into metres (PLAN.md 7.3).

export const CHUNK_BITS = 5;
export const CHUNK_SIZE = 1 << CHUNK_BITS; // 32
const MASK = CHUNK_SIZE - 1;

export class Chunk {
  /** Material per voxel, index = x + z * 32 + y * 1024. */
  readonly data = new Uint8Array(CHUNK_SIZE ** 3);
  /** Number of non-empty voxels. */
  count = 0;

  static index(x: number, y: number, z: number) {
    return x | (z << CHUNK_BITS) | (y << (2 * CHUNK_BITS));
  }

  get(x: number, y: number, z: number) {
    return this.data[Chunk.index(x, y, z)];
  }

  /** Returns true if the voxel changed. */
  set(x: number, y: number, z: number, m: number) {
    const i = Chunk.index(x, y, z);
    const old = this.data[i];
    if (old === m) return false;
    this.data[i] = m;
    this.count += (m !== EMPTY ? 1 : 0) - (old !== EMPTY ? 1 : 0);
    return true;
  }
}

// Chunk coordinates from -512 to 511 on each axis, packed into one number.
const KEY_BIAS = 512;
export function chunkKey(cx: number, cy: number, cz: number) {
  return (cx + KEY_BIAS) + (cy + KEY_BIAS) * 1024 + (cz + KEY_BIAS) * 1048576;
}
export function chunkCoords(key: number): [number, number, number] {
  return [(key % 1024) - KEY_BIAS, (Math.floor(key / 1024) % 1024) - KEY_BIAS, Math.floor(key / 1048576) - KEY_BIAS];
}

export class VoxelVolume {
  readonly chunks = new Map<number, Chunk>();
  /** Chunks whose mesh is out of date, including neighbours of edge edits. */
  private dirty = new Set<number>();

  constructor(readonly voxelSize: number) {}

  get(x: number, y: number, z: number) {
    const c = this.chunks.get(chunkKey(x >> CHUNK_BITS, y >> CHUNK_BITS, z >> CHUNK_BITS));
    return c ? c.get(x & MASK, y & MASK, z & MASK) : EMPTY;
  }

  /** Returns true if the voxel changed. */
  set(x: number, y: number, z: number, m: number) {
    const cx = x >> CHUNK_BITS, cy = y >> CHUNK_BITS, cz = z >> CHUNK_BITS;
    const key = chunkKey(cx, cy, cz);
    let c = this.chunks.get(key);
    if (!c) {
      if (m === EMPTY) return false;
      c = new Chunk();
      this.chunks.set(key, c);
    }
    const lx = x & MASK, ly = y & MASK, lz = z & MASK;
    if (!c.set(lx, ly, lz, m)) return false;
    if (c.count === 0) this.chunks.delete(key);

    this.dirty.add(key);
    // A face on a chunk edge belongs to the neighbour's mesh too.
    if (lx === 0) this.dirty.add(chunkKey(cx - 1, cy, cz));
    if (lx === MASK) this.dirty.add(chunkKey(cx + 1, cy, cz));
    if (ly === 0) this.dirty.add(chunkKey(cx, cy - 1, cz));
    if (ly === MASK) this.dirty.add(chunkKey(cx, cy + 1, cz));
    if (lz === 0) this.dirty.add(chunkKey(cx, cy, cz - 1));
    if (lz === MASK) this.dirty.add(chunkKey(cx, cy, cz + 1));
    return true;
  }

  /** Fill an inclusive box of voxel coordinates with one material. */
  fillBox(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, m: number) {
    for (let y = y0; y <= y1; y++)
      for (let z = z0; z <= z1; z++)
        for (let x = x0; x <= x1; x++) this.set(x, y, z, m);
  }

  /** Number of chunks whose mesh is out of date. */
  get dirtyCount(): number {
    return this.dirty.size;
  }

  /** Dirty chunk keys since the last call. Keys of chunks that no longer
   *  exist are included, so their meshes can be removed. */
  takeDirty() {
    const keys = [...this.dirty];
    this.dirty.clear();
    return keys;
  }
}
