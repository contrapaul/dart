import * as THREE from "three";
import type RAPIER from "@dimforge/rapier3d-compat";
import type { Rapier } from "../physics/world";
import { SURFACES, surfaceTexture } from "../render/surfaces";
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
  // Each layer's paint weight, 0 to 1, for the material's texture blend.
  geo.setAttribute("aTerrainW", new THREE.BufferAttribute(new Float32Array(n * 4), 4));
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
  const weights = geo.getAttribute("aTerrainW") as THREE.BufferAttribute | undefined;
  const L = t.layers.length;
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
      if (weights) {
        for (let l = 0; l < 4; l++) {
          const w = l >= L ? 0 : t.paint ? t.paint[v * L + l]! / 255 : l === 0 ? 1 : 0;
          weights.setComponent(v, l, w);
        }
      }
    }
  }
  pos.needsUpdate = col.needsUpdate = uv.needsUpdate = true;
  if (weights) weights.needsUpdate = true;
  geo.computeVertexNormals();
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
}

const WHITE = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
WHITE.needsUpdate = true;

/** The terrain's material: the layer colours blended per vertex (the
 *  vertex colours), times each layer's surface pattern blended by the same
 *  weights, so painting brick onto grass shows bricks (Paul, 2026-11-27).
 *  The patterns tile in world metres at each surface's scale. */
export function terrainMaterial(layers: Terrain["layers"] = []): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });
  const uniforms = {
    tTex0: { value: WHITE as THREE.Texture }, tTex1: { value: WHITE as THREE.Texture },
    tTex2: { value: WHITE as THREE.Texture }, tTex3: { value: WHITE as THREE.Texture },
    tScale: { value: new THREE.Vector4(1, 1, 1, 1) },
    tHas: { value: new THREE.Vector4(0, 0, 0, 0) },
  };
  m.userData.terrainUniforms = uniforms;
  setTerrainLayers(m, layers);
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute vec4 aTerrainW;\nvarying vec4 vTerrainW;\nvarying vec2 vTerrainXZ;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvTerrainW = aTerrainW;\nvTerrainXZ = (modelMatrix * vec4(transformed, 1.0)).xz;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", [
        "#include <common>",
        "uniform sampler2D tTex0; uniform sampler2D tTex1; uniform sampler2D tTex2; uniform sampler2D tTex3;",
        "uniform vec4 tScale; uniform vec4 tHas;",
        "varying vec4 vTerrainW; varying vec2 vTerrainXZ;",
      ].join("\n"))
      .replace("#include <map_fragment>", [
        "#include <map_fragment>",
        "{",
        "  vec4 p = vec4(",
        "    mix(1.0, texture2D(tTex0, vTerrainXZ / tScale.x).r, tHas.x),",
        "    mix(1.0, texture2D(tTex1, vTerrainXZ / tScale.y).r, tHas.y),",
        "    mix(1.0, texture2D(tTex2, vTerrainXZ / tScale.z).r, tHas.z),",
        "    mix(1.0, texture2D(tTex3, vTerrainXZ / tScale.w).r, tHas.w));",
        "  float total = dot(vTerrainW, vec4(1.0));",
        "  diffuseColor.rgb *= dot(vTerrainW, p) + max(0.0, 1.0 - total);",
        "}",
      ].join("\n"));
  };
  return m;
}

/** Points the material at the layers' surfaces: their patterns and scales.
 *  The editor calls it when a layer's surface changes. */
export function setTerrainLayers(m: THREE.MeshStandardMaterial, layers: Terrain["layers"]): void {
  const u = m.userData.terrainUniforms as {
    tTex0: { value: THREE.Texture }; tTex1: { value: THREE.Texture };
    tTex2: { value: THREE.Texture }; tTex3: { value: THREE.Texture };
    tScale: { value: THREE.Vector4 }; tHas: { value: THREE.Vector4 };
  } | undefined;
  if (!u) return;
  const texs = [u.tTex0, u.tTex1, u.tTex2, u.tTex3];
  for (let l = 0; l < 4; l++) {
    const layer = layers[l];
    const tex = layer ? surfaceTexture(layer.surface) : null;
    texs[l]!.value = tex ?? WHITE;
    u.tHas.value.setComponent(l, tex ? 1 : 0);
    u.tScale.value.setComponent(l, (layer && SURFACES[layer.surface]?.scale) || 1);
  }
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
  const mesh = new THREE.Mesh(terrainGeometry(t), terrainMaterial(t.layers));
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  mesh.name = "terrain";
  group.add(mesh);
  const body = world.createRigidBody(rapier.RigidBodyDesc.fixed());
  const collider = world.createCollider(terrainCollider(rapier, t), body);
  return { mesh, collider };
}

/**
 * The layer a paint of (surface, colour) goes into: one that already wears
 * that surface (and that colour, when one is given), or else the least
 * painted layer, which is given the new look. Returns the layers to use
 * (unchanged when one matched) and the index to paint. Paul, 2026-11-27:
 * the Paint tool paints the ground as it paints a wall.
 */
export function layerForPaint(
  t: Terrain, surface: string, colour: string | null,
): { layers: Terrain["layers"]; index: number } {
  const match = t.layers.findIndex((l) => l.surface === surface && (colour === null || l.colour === colour));
  if (match >= 0) return { layers: t.layers, index: match };
  const L = t.layers.length;
  const totals = new Array(L).fill(0);
  if (t.paint) for (let k = 0; k < t.paint.length; k++) totals[k % L] += t.paint[k]!;
  else totals[0] = 1;
  let least = 0;
  for (let l = 1; l < L; l++) if (totals[l]! < totals[least]!) least = l;
  const layers = t.layers.map((l, i) => (i === least ? { surface, colour: colour ?? l.colour } : l));
  return { layers, index: least };
}
