import * as THREE from "three";
import type RAPIER from "@dimforge/rapier3d-compat";
import type { Rapier } from "../physics/world";
import { SURFACES } from "../render/surfaces";
import type { Terrain, Vec3 } from "./format";

// ED-34 (design/EDITOR-V2.md): the level's heightfield ground. One grid of
// square cells: `heights` holds (nx + 1) * (nz + 1) values, vertex (i, j)
// at index j * (nx + 1) + i, i along +x and j along +z from `origin`.
// `paint` holds a weight 0 to 255 per layer per vertex.
//
// The brushes are plain functions on the arrays, so the editor's strokes are
// tested headless. The mesh and the Rapier collider are built from the same
// arrays; the collider is a heightfield, the shape Rapier collides with
// fastest, and the nav grid bakes from colliders, so Foamers walk on it with
// nothing new.

export type BrushMode = "raise" | "lower" | "flatten" | "smooth" | "noise" | "paint";

export interface Brush {
  mode: BrushMode;
  /** Metres. */
  radius: number;
  /** Metres a second at the centre for raise and lower and noise; a share
   *  per second (0 to 1 is gentle, 10 is near instant) for flatten, smooth
   *  and paint. */
  strength: number;
  /** flatten: the height to pull toward (world y). */
  target?: number;
  /** paint: the layer to paint in. */
  layer?: number;
  /** noise: a stroke's seed, so a stroke is repeatable. */
  seed?: number;
}

export function vertexCount(t: Terrain): number {
  return (t.nx + 1) * (t.nz + 1);
}

/** A flat terrain at `y`, covering `sizeX` by `sizeZ` metres centred on
 *  `centre`, in cells of `cell` metres. */
export function flatTerrain(
  centre: [number, number], y: number, sizeX: number, sizeZ: number, cell: number,
  layers: Terrain["layers"],
): Terrain {
  const nx = Math.max(1, Math.round(sizeX / cell));
  const nz = Math.max(1, Math.round(sizeZ / cell));
  const origin: Vec3 = [centre[0] - (nx * cell) / 2, y, centre[1] - (nz * cell) / 2];
  return { origin, cell, nx, nz, heights: new Array((nx + 1) * (nz + 1)).fill(0), layers };
}

/** The terrain's world extent on x and z. */
export function terrainBounds(t: Terrain): { minX: number; maxX: number; minZ: number; maxZ: number } {
  return {
    minX: t.origin[0], maxX: t.origin[0] + t.nx * t.cell,
    minZ: t.origin[2], maxZ: t.origin[2] + t.nz * t.cell,
  };
}

/** World height of a vertex. */
export function vertexHeight(t: Terrain, i: number, j: number): number {
  return t.origin[1] + t.heights[j * (t.nx + 1) + i]!;
}

/** World height at (x, z), on the same two triangles per cell the mesh draws
 *  (split from the cell's -x -z corner to its +x +z corner), or null off the
 *  terrain. */
export function heightAt(t: Terrain, x: number, z: number): number | null {
  const fx = (x - t.origin[0]) / t.cell;
  const fz = (z - t.origin[2]) / t.cell;
  if (fx < 0 || fz < 0 || fx > t.nx || fz > t.nz) return null;
  const i = Math.min(t.nx - 1, Math.floor(fx));
  const j = Math.min(t.nz - 1, Math.floor(fz));
  const u = fx - i;
  const v = fz - j;
  const h00 = vertexHeight(t, i, j);
  const h10 = vertexHeight(t, i + 1, j);
  const h01 = vertexHeight(t, i, j + 1);
  const h11 = vertexHeight(t, i + 1, j + 1);
  // Triangle (00, 11, 10) when u >= v, else (00, 01, 11).
  return u >= v ? h00 + u * (h10 - h00) + v * (h11 - h10) : h00 + v * (h01 - h00) + u * (h11 - h01);
}

/** The brush's weight at a distance: 1 at the centre, 0 at the rim, smooth. */
export function falloff(d: number, radius: number): number {
  if (d >= radius) return 0;
  const k = 1 - (d / radius) * (d / radius);
  return k * k;
}

/** A repeatable value in [-1, 1) for a vertex and a seed. */
function hashNoise(index: number, seed: number): number {
  let h = (index * 374761393 + seed * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return ((h >>> 0) / 4294967296) * 2 - 1;
}

/** Every layer weight, layer 0 full where there is no paint yet. */
export function ensurePaint(t: Terrain): number[] {
  if (!t.paint) {
    const n = vertexCount(t);
    const L = t.layers.length;
    t.paint = new Array(n * L).fill(0);
    for (let v = 0; v < n; v++) t.paint[v * L] = 255;
  }
  return t.paint;
}

/**
 * One brush step at (x, z) lasting `dt` seconds, in place on `t`. Returns
 * the vertex range it touched (for a partial mesh update), or null when it
 * touched nothing.
 */
export function applyBrush(
  t: Terrain, x: number, z: number, brush: Brush, dt: number,
): { i0: number; i1: number; j0: number; j1: number } | null {
  const r = brush.radius;
  const i0 = Math.max(0, Math.floor((x - r - t.origin[0]) / t.cell));
  const i1 = Math.min(t.nx, Math.ceil((x + r - t.origin[0]) / t.cell));
  const j0 = Math.max(0, Math.floor((z - r - t.origin[2]) / t.cell));
  const j1 = Math.min(t.nz, Math.ceil((z + r - t.origin[2]) / t.cell));
  if (i0 > i1 || j0 > j1) return null;
  const W = t.nx + 1;
  const H = t.heights;
  // Smooth reads the heights as they were before this step, so the result
  // does not depend on the order the vertices are visited.
  const before = brush.mode === "smooth" ? H.slice() : null;
  const share = (f: number) => Math.min(1, brush.strength * dt * f);
  let touched = false;
  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) {
      const vx = t.origin[0] + i * t.cell;
      const vz = t.origin[2] + j * t.cell;
      const f = falloff(Math.hypot(vx - x, vz - z), r);
      if (f <= 0) continue;
      touched = true;
      const k = j * W + i;
      switch (brush.mode) {
        case "raise": H[k] = H[k]! + brush.strength * dt * f; break;
        case "lower": H[k] = H[k]! - brush.strength * dt * f; break;
        case "flatten": {
          const goal = (brush.target ?? t.origin[1]) - t.origin[1];
          H[k] = H[k]! + (goal - H[k]!) * share(f);
          break;
        }
        case "smooth": {
          const b = before!;
          let sum = 0;
          let n = 0;
          if (i > 0) { sum += b[k - 1]!; n++; }
          if (i < t.nx) { sum += b[k + 1]!; n++; }
          if (j > 0) { sum += b[k - W]!; n++; }
          if (j < t.nz) { sum += b[k + W]!; n++; }
          H[k] = b[k]! + (sum / n - b[k]!) * share(f);
          break;
        }
        case "noise": H[k] = H[k]! + hashNoise(k, brush.seed ?? 1) * brush.strength * dt * f; break;
        case "paint": paintVertex(t, k, brush.layer ?? 0, share(f)); break;
      }
    }
  }
  return touched ? { i0, i1, j0, j1 } : null;
}

/** Moves a share of the vertex's weight onto one layer, keeping the sum at
 *  255. */
function paintVertex(t: Terrain, v: number, layer: number, share: number) {
  const L = t.layers.length;
  if (layer < 0 || layer >= L) return;
  const p = ensurePaint(t);
  const base = v * L;
  for (let l = 0; l < L; l++) {
    const w = p[base + l]!;
    p[base + l] = l === layer ? w + (255 - w) * share : w * (1 - share);
  }
}

/** Rounds heights to 1 cm and weights to whole numbers, so a saved level
 *  stays small. The editor calls it at the end of a stroke. */
export function tidyTerrain(t: Terrain): Terrain {
  const out: Terrain = { ...t, heights: t.heights.map((h) => Math.round(h * 100) / 100) };
  if (t.paint) {
    const L = t.layers.length;
    const p = t.paint.map((w) => Math.round(w));
    // Rounding can leave a vertex a step off 255; give the rest to its
    // heaviest layer.
    for (let b = 0; b < p.length; b += L) {
      let sum = 0;
      let top = b;
      for (let l = 0; l < L; l++) {
        sum += p[b + l]!;
        if (p[b + l]! > p[top]!) top = b + l;
      }
      p[top] = p[top]! + (255 - sum);
    }
    out.paint = p;
  }
  return out;
}

const _c = new THREE.Color();
const _l = new THREE.Color();

/** The mesh's colour at a vertex: the layers' colours by their weights. */
function blendColour(t: Terrain, v: number, layerColours: THREE.Color[], out: THREE.Color): THREE.Color {
  const L = t.layers.length;
  if (!t.paint) return out.copy(layerColours[0]!);
  out.setRGB(0, 0, 0);
  for (let l = 0; l < L; l++) {
    const w = t.paint[v * L + l]! / 255;
    if (w > 0) out.add(_l.copy(layerColours[l]!).multiplyScalar(w));
  }
  return out;
}

/** The terrain's mesh: positions in world space, vertex colours from the
 *  paint, and uvs in metres over the first layer's surface scale. */
export function terrainGeometry(t: Terrain): THREE.BufferGeometry {
  const n = vertexCount(t);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  geo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  geo.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  const index: number[] = [];
  const W = t.nx + 1;
  for (let j = 0; j < t.nz; j++) {
    for (let i = 0; i < t.nx; i++) {
      const a = j * W + i;
      const b = a + 1;
      const c = a + W;
      const d = c + 1;
      // Split 00 to 11, as heightAt; wound so the faces look up (+y).
      index.push(a, d, b, a, c, d);
    }
  }
  geo.setIndex(index);
  updateTerrainGeometry(geo, t);
  return geo;
}

/** Writes heights, colours and uvs into the mesh made by terrainGeometry,
 *  and its normals. The editor calls it after a brush step. */
export function updateTerrainGeometry(geo: THREE.BufferGeometry, t: Terrain): void {
  const pos = geo.getAttribute("position") as THREE.BufferAttribute;
  const col = geo.getAttribute("color") as THREE.BufferAttribute;
  const uv = geo.getAttribute("uv") as THREE.BufferAttribute;
  const W = t.nx + 1;
  const colours = t.layers.map((l) => new THREE.Color(l.colour));
  const scale = SURFACES[t.layers[0]?.surface ?? "plain"]?.scale ?? 1;
  for (let j = 0; j <= t.nz; j++) {
    for (let i = 0; i <= t.nx; i++) {
      const v = j * W + i;
      const x = t.origin[0] + i * t.cell;
      const z = t.origin[2] + j * t.cell;
      pos.setXYZ(v, x, t.origin[1] + t.heights[v]!, z);
      blendColour(t, v, colours, _c);
      col.setXYZ(v, _c.r, _c.g, _c.b);
      uv.setXY(v, x / scale, z / scale);
    }
  }
  pos.needsUpdate = col.needsUpdate = uv.needsUpdate = true;
  geo.computeVertexNormals();
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
}

/** The terrain's material: vertex colours, matte foam. */
export function terrainMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });
}

/** The Rapier heightfield for the terrain, placed at its middle. Rapier
 *  stores the heights column-major with rows along z: entry (row r,
 *  column c) at c * rows + r is the vertex at z step r and x step c, and the
 *  shape spans `scale` centred on its own origin. */
export function terrainCollider(rapier: Rapier, t: Terrain): RAPIER.ColliderDesc {
  const rows = t.nz + 1;
  const cols = t.nx + 1;
  const h = new Float32Array(rows * cols);
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) h[c * rows + r] = t.heights[r * cols + c]!;
  }
  const sx = t.nx * t.cell;
  const sz = t.nz * t.cell;
  return rapier.ColliderDesc.heightfield(t.nz, t.nx, h, { x: sx, y: 1, z: sz })
    .setTranslation(t.origin[0] + sx / 2, t.origin[1], t.origin[2] + sz / 2);
}

/** The game's terrain: the mesh added to `group` and the collider on a
 *  fixed body. */
export function buildTerrain(
  t: Terrain, rapier: Rapier, world: RAPIER.World, group: THREE.Group,
): { mesh: THREE.Mesh; collider: RAPIER.Collider } {
  const mesh = new THREE.Mesh(terrainGeometry(t), terrainMaterial());
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  mesh.name = "terrain";
  group.add(mesh);
  const body = world.createRigidBody(rapier.RigidBodyDesc.fixed());
  const collider = world.createCollider(terrainCollider(rapier, t), body);
  return { mesh, collider };
}
