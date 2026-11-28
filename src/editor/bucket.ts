// R3-03: the paint bucket. Pure: no DOM, no view. Given a level and a prim,
// `connectedSameLook` collects that prim and every prim reachable through
// touching or overlapping boxes (axis-aligned bounds of the rotated box,
// grown by 0.01 m) that wear the same surface and colour. `fillTerrain`
// puts every vertex of a terrain onto one layer.

import * as THREE from "three";
import type { Level, Prim, Terrain, Vec3 } from "../level/format";
import { ensurePaint, vertexCount } from "../level/terrain";
import { EDITOR } from "./doc";

const DEG = Math.PI / 180;
const PAD = 0.01;

/** The surface and colour a prim or physics object wears. Unseen surface:
 *  "plain". */
export interface Look {
  surface: string;
  colour: string;
}

export function lookOf(thing: { surface?: string; colour: string }): Look {
  return { surface: thing.surface ?? "plain", colour: thing.colour };
}

interface Box3 {
  minX: number; minY: number; minZ: number;
  maxX: number; maxY: number; maxZ: number;
}

/** The world-axis-aligned bounds of a rotated box, grown by PAD on each side. */
function boundsOf(pos: Vec3, size: Vec3, rot?: Vec3): Box3 {
  const r = rot ?? [0, 0, 0];
  const euler = new THREE.Euler(r[0] * DEG, r[1] * DEG, r[2] * DEG, "XYZ");
  const half = new THREE.Vector3(size[0] / 2, size[1] / 2, size[2] / 2);
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    const v = new THREE.Vector3(half.x * sx, half.y * sy, half.z * sz).applyEuler(euler);
    const x = pos[0] + v.x, y = pos[1] + v.y, z = pos[2] + v.z;
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
  }
  return { minX: minX - PAD, minY: minY - PAD, minZ: minZ - PAD, maxX: maxX + PAD, maxY: maxY + PAD, maxZ: maxZ + PAD };
}

function touching(a: Box3, b: Box3): boolean {
  return a.minX <= b.maxX && b.minX <= a.maxX
    && a.minY <= b.maxY && b.minY <= a.maxY
    && a.minZ <= b.maxZ && b.minZ <= a.maxZ;
}

/** The cap on a fill, from data/editor.json (`paint.bucketMax`). */
function cap(): number {
  return (EDITOR.paint as { bucketMax?: number }).bucketMax ?? 500;
}

/** The start prim and every prim reachable from it through touching or
 *  overlapping boxes that wear the same surface and colour. Capped at
 *  `paint.bucketMax` prims. Empty when the start id is not a prim. */
export function connectedSameLook(level: Level, startId: string): Prim[] {
  const prims = level.prims ?? [];
  const start = prims.find((p) => p.id === startId);
  if (!start) return [];
  const look = lookOf(start);
  const matches = (p: Prim) => (p.surface ?? "plain") === look.surface && p.colour === look.colour;
  const bounds = new Map<string, Box3>(prims.map((p) => [p.id, boundsOf(p.pos, p.size, p.rot)]));
  const out: Prim[] = [start];
  const seen = new Set([start.id]);
  const queue = [start];
  const limit = cap();
  while (queue.length && out.length < limit) {
    const cur = queue.shift()!;
    const cb = bounds.get(cur.id)!;
    for (const p of prims) {
      if (seen.has(p.id) || !matches(p)) continue;
      if (touching(cb, bounds.get(p.id)!)) {
        seen.add(p.id);
        out.push(p);
        queue.push(p);
        if (out.length >= limit) break;
      }
    }
  }
  return out;
}

/** Every vertex of the terrain, all onto `layerIndex`. */
export function fillTerrain(t: Terrain, layerIndex: number): void {
  const L = t.layers.length;
  const n = vertexCount(t);
  const p = ensurePaint(t);
  for (let v = 0; v < n; v++) {
    for (let l = 0; l < L; l++) p[v * L + l] = l === layerIndex ? 255 : 0;
  }
}
