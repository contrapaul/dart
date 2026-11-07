import * as THREE from "three";
import type { VoxelVolume } from "./chunk";
import { EMPTY, material } from "./materials";
import type { RemovedVoxel } from "./carve";
import type { DebrisSystem } from "./debris";
import tuning from "../../data/destruction.json";

// ENV-01 stage 3: a crate is the set of piece volumes tagged with the same
// `crate` id. In play a dart cuts a crater, never a full ring, so a hollow
// crate could be chewed through forever and the crate above it never fell
// (HANDOFF, ENV-01 review). The rule: once a crate has lost
// `crate.breakShare` of its voxels, the rest of it goes at once. The voxels
// are reported as removed, so the island search then runs on everything
// that went and the crate above it breaks off as before.
//
// Only destructible voxels count, so the hidden bedrock plinth under a
// stack is never part of a crate.

const T = tuning.crate;

/** One tagged volume's voxel box, from `fillPieces`. */
export interface CrateBox {
  id: string;
  /** Inclusive voxel bounds, in the level volume's coordinates. */
  min: [number, number, number];
  max: [number, number, number];
}

/** One crate that went whole this carve, with the voxels it took. */
export interface CrateBreak {
  id: string;
  voxels: RemovedVoxel[];
}

export interface CarveResult {
  /** The carve's own voxels plus every worn crate that broke. */
  removed: RemovedVoxel[];
  breaks: CrateBreak[];
}

interface Crate {
  id: string;
  /** The crate's whole 0.6 m box, the union of its tagged volumes. A
   *  crate's volumes all sit inside it, so counting the box once cannot
   *  count a voxel twice the way the panels and bars overlap. */
  min: [number, number, number];
  max: [number, number, number];
  /** Voxels left, and how many it filled with. */
  left: number;
  start: number;
  broken: boolean;
}

export class Crates {
  private list: Crate[] = [];

  constructor(private volume: VoxelVolume, boxes: CrateBox[]) {
    const byId = new Map<string, CrateBox[]>();
    for (const b of boxes) {
      const own = byId.get(b.id);
      if (own) own.push(b);
      else byId.set(b.id, [b]);
    }
    for (const [id, own] of byId) {
      const crate: Crate = {
        id,
        min: [
          Math.min(...own.map((b) => b.min[0])),
          Math.min(...own.map((b) => b.min[1])),
          Math.min(...own.map((b) => b.min[2])),
        ],
        max: [
          Math.max(...own.map((b) => b.max[0])),
          Math.max(...own.map((b) => b.max[1])),
          Math.max(...own.map((b) => b.max[2])),
        ],
        left: 0,
        start: 0,
        broken: false,
      };
      this.list.push(crate);
    }
    // Count after every box is known, so a voxel where two crates meet is
    // counted once, for the first crate that claims it.
    for (const crate of this.list) {
      this.each(crate, (x, y, z) => {
        if (this.ownerAt(x, y, z) === crate) crate.start++;
      });
      crate.left = crate.start;
    }
  }

  /** How many crates the level has. */
  get count() {
    return this.list.length;
  }

  /** Voxels this crate still has (for tests and the watch). */
  remaining(id: string) {
    const c = this.list.find((q) => q.id === id);
    return c ? c.left : 0;
  }

  /** Visit every destructible voxel in a crate's box. */
  private each(
    c: Crate,
    fn: (x: number, y: number, z: number) => void,
  ) {
    for (let y = c.min[1]; y <= c.max[1]; y++)
      for (let z = c.min[2]; z <= c.max[2]; z++)
        for (let x = c.min[0]; x <= c.max[0]; x++) {
          const m = this.volume.get(x, y, z);
          if (m === EMPTY || material(m)?.indestructible) continue;
          fn(x, y, z);
        }
  }

  /** The crate a voxel belongs to. A level holds a few crates at most, so
   *  a bounds check per crate is cheaper than a map of every crate voxel. */
  private ownerAt(x: number, y: number, z: number) {
    for (const c of this.list) {
      if (
        x >= c.min[0] && x <= c.max[0]
        && y >= c.min[1] && y <= c.max[1]
        && z >= c.min[2] && z <= c.max[2]
      ) return c;
    }
    return null;
  }

  /**
   * Tally a carve's removed voxels, then empty any crate worn past its
   * share. Returns the same list plus the broken crates' voxels, which is
   * what the island search must see.
   */
  take(removed: RemovedVoxel[]): CarveResult {
    const breaks: CrateBreak[] = [];
    for (const v of removed) {
      const c = this.ownerAt(v.x, v.y, v.z);
      if (c && !c.broken) c.left--;
    }
    for (const c of this.list) {
      if (c.broken || c.start === 0) continue;
      if (c.left > c.start * (1 - T.breakShare)) continue;
      const voxels: RemovedVoxel[] = [];
      this.each(c, (x, y, z) => {
        // A neighbour's box can touch this one: only take what is ours.
        if (this.ownerAt(x, y, z) !== c) return;
        const m = this.volume.get(x, y, z);
        this.volume.set(x, y, z, EMPTY);
        voxels.push({ x, y, z, material: m });
      });
      c.broken = true;
      c.left = 0;
      if (voxels.length === 0) continue;
      breaks.push({ id: c.id, voxels });
      for (const v of voxels) removed.push(v);
    }
    return { removed, breaks };
  }
}

/** Throw a broken crate's foam out through the debris system's own caps: a
 *  pop of chunks, never more than debris.max or debris.perCarveMax. */
export function burstCrate(
  debris: DebrisSystem,
  voxels: RemovedVoxel[],
  voxelSize: number,
  toWorld: (v: THREE.Vector3) => THREE.Vector3,
) {
  if (voxels.length === 0) return;
  const c = new THREE.Vector3();
  for (const v of voxels) {
    c.x += v.x + 0.5;
    c.y += v.y + 0.5;
    c.z += v.z + 0.5;
  }
  c.divideScalar(voxels.length);
  debris.spawn(voxels, c, voxelSize, toWorld);
}
