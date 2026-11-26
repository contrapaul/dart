import * as THREE from "three";
import surfaceData from "../../data/surfaces.json";

// ED-36 (design/EDITOR-V2.md): the surfaces things can wear. Textures are
// drawn in code, one canvas per surface, greys so the thing's colour tints
// them (material.color multiplies). The drawing is a pure function over an
// ImageData-like array, so it is testable headless; the canvas wrapper is
// tiny. One texture per surface, one material per (surface, colour) pair.

export interface SurfaceSpec {
  label: string;
  /** Metres one repeat of the texture covers. */
  scale: number;
}

export const SURFACES = (surfaceData as { surfaces: Record<string, SurfaceSpec> }).surfaces;
export const SURFACE_NAMES = Object.keys(SURFACES);

export function isSurface(name: string): boolean {
  return Object.hasOwn(SURFACES, name);
}

export const SURFACE_SIZE = 256;

/** An ImageData-like array: width, height and RGBA bytes. */
export interface CanvasImage {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

/** A tiny seeded PRNG (mulberry32). No Math.random anywhere here. */
export function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashName(name: string): number {
  let h = 2166136261;
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function newImage(w: number, h: number): CanvasImage {
  return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) };
}

function setPx(img: CanvasImage, x: number, y: number, v: number) {
  const i = (y * img.width + x) * 4;
  img.data[i] = v;
  img.data[i + 1] = v;
  img.data[i + 2] = v;
  img.data[i + 3] = 255;
}

function fill(img: CanvasImage, v: number) {
  for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) setPx(img, x, y, v);
}

function noise(rng: () => number, img: CanvasImage, amount: number) {
  // Speckle over the pattern: perturbs each pixel a little, keeping the
  // base pattern (mortar lines, seams).
  const base = img.data.slice();
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      const i = (y * img.width + x) * 4;
      const v = Math.round(base[i]! + (rng() - 0.5) * 2 * amount);
      img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.max(0, Math.min(255, v));
      img.data[i + 3] = 255;
    }
  }
}

// -- the pattern painters, each in greys (0 dark, 255 light).

function paintBrick(img: CanvasImage, rng: () => number) {
  // Mortar everywhere, bricks inset so the mortar reads as lines.
  fill(img, 120);
  const bh = 32, bw = 64;
  for (let row = 0; row < img.height / bh; row++) {
    const offset = row % 2 === 0 ? 0 : bw / 2;
    for (let bx = -bw + offset; bx < img.width; bx += bw) {
      const v = 185 + Math.round(rng() * 45);
      for (let y = row * bh + 2; y < (row + 1) * bh - 2; y++) {
        for (let x = bx + 2; x < bx + bw - 2; x++) {
          if (x >= 0 && x < img.width && y < img.height) setPx(img, x, y, v);
        }
      }
    }
  }
  noise(rng, img, 14);
}

function paintTiles(img: CanvasImage, rng: () => number) {
  fill(img, 150);
  const t = 64;
  for (let ty = 0; ty < img.height / t; ty++) {
    for (let tx = 0; tx < img.width / t; tx++) {
      const v = 185 + Math.round(rng() * 45);
      for (let y = ty * t + 2; y < (ty + 1) * t - 2; y++) {
        for (let x = tx * t + 2; x < (tx + 1) * t - 2; x++) setPx(img, x, y, v);
      }
      // A faint bevel: darker at the corner.
      for (let x = tx * t + 2; x < (tx + 1) * t - 2; x++) {
        setPx(img, x, ty * t + 2, Math.min(img.data[((ty * t + 2) * img.width + x) * 4]!, 150));
      }
    }
  }
  noise(rng, img, 12);
}

function paintPlanks(img: CanvasImage, rng: () => number) {
  fill(img, 185);
  const ph = 32;
  for (let row = 0; row < img.height / ph; row++) {
    const v = 165 + Math.round(rng() * 60);
    for (let y = row * ph + 2; y < (row + 1) * ph - 2; y++) {
      for (let x = 0; x < img.width; x++) {
        const grain = Math.round(Math.sin((x + row * 37) / 9) * 12 + (rng() - 0.5) * 22);
        setPx(img, x, y, Math.max(0, Math.min(255, v + grain)));
      }
    }
    // Dark gap between planks.
    for (let x = 0; x < img.width; x++) {
      setPx(img, x, row * ph, 110);
      setPx(img, x, row * ph + 1, 120);
    }
    // A nail near each end.
    const nail = row % 2 === 0 ? 18 : img.width - 18;
    setPx(img, nail, row * ph + Math.round(ph / 2), 90);
  }
}

function paintMetal(img: CanvasImage, rng: () => number) {
  fill(img, 175);
  const p = 128;
  for (let py = 0; py < img.height / p; py++) {
    for (let px = 0; px < img.width / p; px++) {
      const v = 165 + Math.round(rng() * 25);
      for (let y = py * p + 1; y < (py + 1) * p - 1; y++) {
        for (let x = px * p + 1; x < (px + 1) * p - 1; x++) setPx(img, x, y, v);
      }
      // Seam.
      for (let x = px * p; x <= px * p + p; x++) {
        setPx(img, x, py * p, 105);
        setPx(img, x, (py + 1) * p - 1, 105);
      }
      for (let y = py * p; y <= py * p + p; y++) {
        setPx(img, px * p, y, 105);
        setPx(img, (px + 1) * p - 1, y, 105);
      }
      // Rivets in the corners.
      for (const [cx, cy] of [[px * p + 14, py * p + 14], [px * p + p - 14, py * p + 14],
                             [px * p + 14, py * p + p - 14], [px * p + p - 14, py * p + p - 14]] as const) {
        for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
          const d = dx * dx + dy * dy;
          if (d <= 16) {
            const v = d <= 4 ? 70 : d <= 10 ? 140 : 235;
            const xx = cx + dx, yy = cy + dy;
            if (xx >= 0 && xx < img.width && yy >= 0 && yy < img.height) setPx(img, xx, yy, v);
          }
        }
      }
    }
  }
  noise(rng, img, 10);
}

function paintConcrete(img: CanvasImage, rng: () => number) {
  fill(img, 185);
  noise(rng, img, 9);
  // A few darker blotches.
  for (let i = 0; i < 14; i++) {
    const cx = Math.floor(rng() * img.width), cy = Math.floor(rng() * img.height), r = 6 + Math.floor(rng() * 22);
    for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) {
      const d2 = (x - cx) * (x - cx) + (y - cy) * (y - cy);
      if (d2 <= r * r) {
        const i2 = (y * img.width + x) * 4;
        img.data[i2] = img.data[i2 + 1] = img.data[i2 + 2] = Math.round(img.data[i2]! * 0.82);
      }
    }
  }
}

function paintGrass(img: CanvasImage, rng: () => number) {
  fill(img, 170);
  for (let i = 0; i < 2600; i++) {
    const x = Math.floor(rng() * img.width), y = Math.floor(rng() * img.height);
    const len = 3 + Math.floor(rng() * 8);
    const lean = rng() > 0.5 ? 1 : -1;
    const v = 130 + Math.floor(rng() * 110);
    for (let j = 0; j < len; j++) {
      const yy = y - j, xx = x + Math.round((lean * j) / 2);
      if (xx >= 0 && xx < img.width && yy >= 0 && yy < img.height) setPx(img, xx, yy, v);
    }
  }
  noise(rng, img, 16);
}

function paintSand(img: CanvasImage, rng: () => number) {
  fill(img, 212);
  noise(rng, img, 10);
  // Sparse dark flecks and a few dune streaks.
  for (let i = 0; i < 500; i++) {
    setPx(img, Math.floor(rng() * img.width), Math.floor(rng() * img.height), 165 + Math.floor(rng() * 30));
  }
  for (let i = 0; i < 6; i++) {
    const cy = Math.floor(rng() * img.height), amp = 4 + rng() * 6, period = 40 + rng() * 60;
    for (let x = 0; x < img.width; x++) {
      const y = Math.round(cy + Math.sin(x / period) * amp);
      if (y >= 0 && y < img.height) setPx(img, x, y, 190);
    }
  }
}

function paintRock(img: CanvasImage, rng: () => number) {
  fill(img, 150);
  for (let i = 0; i < 40; i++) {
    const cx = Math.floor(rng() * img.width), cy = Math.floor(rng() * img.height), r = 8 + Math.floor(rng() * 26);
    const v = 120 + Math.floor(rng() * 70);
    for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) {
      const d2 = (x - cx) * (x - cx) + (y - cy) * (y - cy);
      if (d2 <= r * r) setPx(img, x, y, v);
    }
  }
  noise(rng, img, 14);
}

function paintStripes(img: CanvasImage, rng: () => number) {
  // Diagonal hazard stripes, greys: dark and light. Not tied to the seed.
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      const t = ((x + y) % 64) < 32;
      setPx(img, x, y, t ? 95 : 215);
    }
  }
  // A light wear speckle so it is not a flat ramp.
  noise(rng, img, 10);
}

const PAINTERS: Record<string, (img: CanvasImage, rng: () => number) => void> = {
  brick: paintBrick,
  tiles: paintTiles,
  planks: paintPlanks,
  metal: paintMetal,
  concrete: paintConcrete,
  grass: paintGrass,
  sand: paintSand,
  rock: paintRock,
  stripes: paintStripes,
};

/** Draws one surface's texture into an ImageData-like array. `plain` has no
 *  texture: it returns null. Same surface and size always give the same
 *  bytes (the PRNG seed is a hash of the surface name). */
export function drawSurface(name: string, size = SURFACE_SIZE): CanvasImage | null {
  const paint = PAINTERS[name];
  if (!paint) return null;
  const img = newImage(size, size);
  paint(img, prng(hashName(name)));
  return img;
}

/** Canvas wrapper: the only three.js-facing part of the drawing. */
const texCache = new Map<string, THREE.CanvasTexture>();

/** The texture for a surface, or null for plain / unknown. */
export function surfaceTexture(name: string, size = SURFACE_SIZE): THREE.CanvasTexture | null {
  if (!PAINTERS[name]) return null;
  const key = `${name}|${size}`;
  let tex = texCache.get(key);
  if (tex) return tex;
  const img = drawSurface(name, size);
  if (!img) return null;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const image = ctx.createImageData(size, size);
  image.data.set(img.data);
  ctx.putImageData(image, 0, 0);
  tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  texCache.set(key, tex);
  return tex;
}

const cache = new Map<string, THREE.MeshStandardMaterial>();

/** A material for a surface tinted by a colour. The geometry must carry
 *  world-scaled UVs (`worldUVs`) for the texture to tile at its scale. */
export function surfaceMaterial(surface: string | undefined, colour: string): THREE.MeshStandardMaterial {
  const key = `${surface ?? "plain"}|${colour}`;
  let m = cache.get(key);
  if (!m) {
    const spec = surface ? SURFACES[surface] : undefined;
    const map = surface && spec ? surfaceTexture(surface) : null;
    m = new THREE.MeshStandardMaterial({
      color: colour,
      roughness: 0.9,
      ...(map ? { map } : {}),
    });
    cache.set(key, m);
  }
  return m;
}

/** World-space UVs: box-projects every triangle on its dominant normal
 *  axis, divided by the surface's scale, so textures are the same size on a
 *  small box and a long wall and line up across neighbours. */
export function worldUVs(geometry: THREE.BufferGeometry, matrixWorld: THREE.Matrix4, scale = 1): THREE.BufferGeometry {
  const geo = geometry.index ? geometry.toNonIndexed() : geometry;
  const pos = geo.getAttribute("position");
  const norm = geo.getAttribute("normal");
  const normalMatrix = new THREE.Matrix3().getNormalMatrix(matrixWorld);
  const worldPos = new Float32Array(pos.count * 3);
  const worldNormal = new Float32Array(pos.count * 3);
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i).applyMatrix4(matrixWorld);
    worldPos[i * 3] = p.x; worldPos[i * 3 + 1] = p.y; worldPos[i * 3 + 2] = p.z;
    if (norm) {
      n.fromBufferAttribute(norm, i).applyMatrix3(normalMatrix).normalize();
      worldNormal[i * 3] = n.x; worldNormal[i * 3 + 1] = n.y; worldNormal[i * 3 + 2] = n.z;
    } else {
      worldNormal[i * 3] = 0; worldNormal[i * 3 + 1] = 1; worldNormal[i * 3 + 2] = 0;
    }
  }
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i += 3) {
    // The triangle's dominant normal: the largest absolute axis of the
    // average vertex normal.
    const ax = Math.abs(worldNormal[i * 3]! + worldNormal[(i + 1) * 3]! + worldNormal[(i + 2) * 3]!) / 3;
    const ay = Math.abs(worldNormal[i * 3 + 1]! + worldNormal[(i + 1) * 3 + 1]! + worldNormal[(i + 2) * 3 + 1]!) / 3;
    const az = Math.abs(worldNormal[i * 3 + 2]! + worldNormal[(i + 1) * 3 + 2]! + worldNormal[(i + 2) * 3 + 2]!) / 3;
    let i0 = 0, i1 = 1;
    if (ax >= ay && ax >= az) { i0 = 1; i1 = 2; }
    else if (ay >= az) { i0 = 0; i1 = 2; }
    else { i0 = 0; i1 = 1; }
    for (let k = 0; k < 3; k++) {
      const v = (i + k) * 3;
      uv[(i + k) * 2] = worldPos[v + i0]! / scale;
      uv[(i + k) * 2 + 1] = worldPos[v + i1]! / scale;
    }
  }
  geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  return geo;
}
