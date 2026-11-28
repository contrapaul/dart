import type { CanvasImage } from "./surfaces";

// R3-05: more surfaces drawn in code. Each painter draws greys into a square
// image (the thing's colour tints them) and must tile: its left edge meets
// its right, its top its bottom, so the 2 by 2 sheet shows no seam. Every
// randomness comes from the seeded rng surfaces.ts hands in; the per-pixel
// speckle below is a hash of the pixel and is therefore periodic too.
// Every name here also needs an entry in data/surfaces.json (label and scale).

type Rng = () => number;

function fill(img: CanvasImage, v: number) {
  for (let i = 0; i < img.data.length; i += 4) {
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255;
  }
}

function setPx(img: CanvasImage, x: number, y: number, v: number) {
  if (x < 0 || y < 0 || x >= img.width || y >= img.height) return;
  const i = (y * img.width + x) * 4;
  img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255;
}

function clamp(v: number): number {
  return Math.max(0, Math.min(255, v));
}

function hash2(x: number, y: number, seed: number): number {
  let h = seed >>> 0;
  h ^= (x + 0x9e3779b9) >>> 0; h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h ^= (y + 0xc2b2ae35) >>> 0; h = Math.imul(h ^ (h >>> 13), 0x27d4eb2f);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

/** Per-pixel speckle, periodic with the image, so it never draws a seam. */
function speckle(img: CanvasImage, amount: number, seed: number): void {
  const w = img.width, h = img.height;
  const base = img.data.slice();
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = Math.round(base[(y * w + x) * 4]! + (hash2(x, y, seed) - 0.5) * 2 * amount);
    setPx(img, x, y, clamp(v));
  }
}

/** A filled circle that wraps: drawn at every offset that lands inside. */
function wrapCircle(img: CanvasImage, cx: number, cy: number, r: number, v: number): void {
  const w = img.width, h = img.height, r2 = r * r;
  for (let ox = -w; ox <= w; ox += w) for (let oy = -h; oy <= h; oy += h) {
    const bx = cx + ox, by = cy + oy;
    const x0 = Math.max(0, Math.floor(bx - r)), x1 = Math.min(w - 1, Math.ceil(bx + r));
    const y0 = Math.max(0, Math.floor(by - r)), y1 = Math.min(h - 1, Math.ceil(by + r));
    if (x0 > x1 || y0 > y1) continue;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if ((x - bx) * (x - bx) + (y - by) * (y - by) <= r2) setPx(img, x, y, v);
    }
  }
}

/** A filled diamond (|dx|+|dy| <= r) that wraps. */
function wrapDiamond(img: CanvasImage, cx: number, cy: number, r: number, v: number): void {
  const w = img.width, h = img.height;
  for (let ox = -w; ox <= w; ox += w) for (let oy = -h; oy <= h; oy += h) {
    const bx = cx + ox, by = cy + oy;
    const x0 = Math.max(0, Math.floor(bx - r)), x1 = Math.min(w - 1, Math.ceil(bx + r));
    const y0 = Math.max(0, Math.floor(by - r)), y1 = Math.min(h - 1, Math.ceil(by + r));
    if (x0 > x1 || y0 > y1) continue;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (Math.abs(x - bx) + Math.abs(y - by) <= r) setPx(img, x, y, v);
    }
  }
}

// -- painters.

function paintCobbles(img: CanvasImage, rng: Rng) {
  fill(img, 118);
  const n = 4, cell = img.width / n;
  for (let row = 0; row < n; row++) for (let col = 0; col < n; col++) {
    const jx = (rng() - 0.5) * cell * 0.3, jy = (rng() - 0.5) * cell * 0.3;
    const cx = col * cell + cell / 2 + jx, cy = row * cell + cell / 2 + jy;
    const v = 160 + Math.round(rng() * 45);
    const r = cell * (0.32 + rng() * 0.12);
    wrapCircle(img, cx, cy, r, v);
    // A slight highlight inset up-left, a soft shadow down-right.
    wrapCircle(img, cx - r * 0.22, cy - r * 0.22, r * 0.5, clamp(v + 26));
  }
  speckle(img, 9, 101);
}

function paintDirt(img: CanvasImage, rng: Rng) {
  fill(img, 172);
  for (let i = 0; i < 42; i++) {
    const cx = rng() * img.width, cy = rng() * img.height;
    const r = 6 + rng() * 22;
    const dark = rng() > 0.5;
    const v = dark ? 138 + Math.round(rng() * 22) : 190 + Math.round(rng() * 25);
    wrapCircle(img, cx, cy, r, v);
  }
  speckle(img, 11, 102);
}

function paintWoodFloor(img: CanvasImage, rng: Rng) {
  fill(img, 152);
  const rows = 8, rh = img.height / rows;
  for (let row = 0; row < rows; row++) {
    const v = 168 + Math.round(rng() * 42);
    const phase = rng() * Math.PI * 2;
    const cycles = 3 + Math.floor(rng() * 3);
    for (let y = row * rh; y < (row + 1) * rh; y++) {
      for (let x = 0; x < img.width; x++) {
        const grain = Math.sin((x / img.width) * Math.PI * 2 * cycles + phase) * 10;
        setPx(img, x, y, clamp(v + grain + (hash2(x, row, 103) - 0.5) * 9));
      }
    }
    // The dark gap along the plank's top edge.
    for (let x = 0; x < img.width; x++) {
      setPx(img, x, row * rh, 104);
      if ((row * rh + 1) < img.height) setPx(img, x, row * rh + 1, 112);
    }
  }
  speckle(img, 7, 104);
}

function paintFoamTiles(img: CanvasImage, rng: Rng) {
  fill(img, 122);
  const n = 4, cell = img.width / n;
  for (let row = 0; row < n; row++) for (let col = 0; col < n; col++) {
    const v = 182 + Math.round(rng() * 38);
    const inset = 3;
    for (let y = row * cell + inset; y < (row + 1) * cell - inset; y++) {
      for (let x = col * cell + inset; x < (col + 1) * cell - inset; x++) {
        // A soft cushion: brighter in the middle, darker at the corners.
        const dx = Math.abs(x - (col * cell + cell / 2)) / (cell / 2);
        const dy = Math.abs(y - (row * cell + cell / 2)) / (cell / 2);
        const d = Math.max(dx, dy);
        setPx(img, x, y, clamp(v + 22 - d * 34));
      }
    }
  }
  speckle(img, 8, 105);
}

function paintGrate(img: CanvasImage, rng: Rng) {
  fill(img, 66);
  const n = 8, cell = img.height / n;
  for (let row = 0; row < n; row++) {
    const bar = Math.round(cell * 0.52);
    const y0 = Math.round(row * cell + (cell - bar) / 2);
    const v = 182 + Math.round(rng() * 28);
    for (let y = y0; y < y0 + bar; y++) {
      for (let x = 0; x < img.width; x++) {
        setPx(img, x, y, clamp(v + (hash2(x, row, 106) - 0.5) * 10));
      }
    }
    // The dark lip under each bar catches the shadow.
    const lipY = Math.round(y0 + bar) + 1;
    if (lipY < img.height) for (let x = 0; x < img.width; x++) setPx(img, x, lipY, 88);
  }
  speckle(img, 6, 107);
}

function paintCarpet(img: CanvasImage, rng: Rng) {
  fill(img, 118);
  const n = 4, cell = img.width / n;
  for (let row = 0; row < n; row++) for (let col = 0; col < n; col++) {
    const cx = col * cell + cell / 2, cy = row * cell + cell / 2;
    const v = 158 + Math.round(rng() * 24);
    wrapDiamond(img, cx, cy, cell * 0.42, v);
    wrapCircle(img, cx, cy, cell * 0.1, 228);
    // Corner ticks, so the motif reads as a star around the centre.
    wrapCircle(img, cx - cell * 0.36, cy - cell * 0.36, 3, v + 14);
    wrapCircle(img, cx + cell * 0.36, cy + cell * 0.36, 3, v + 14);
  }
  speckle(img, 12, 108);
}

function paintGravel(img: CanvasImage, rng: Rng) {
  fill(img, 168);
  const n = Math.round((img.width * img.height) / 900);
  for (let i = 0; i < n; i++) {
    const cx = rng() * img.width, cy = rng() * img.height;
    const r = 3 + rng() * 8;
    const v = 128 + Math.round(rng() * 92);
    wrapCircle(img, cx, cy, r, v);
    wrapCircle(img, cx - r * 0.3, cy - r * 0.3, r * 0.45, clamp(v + 18));
  }
  speckle(img, 8, 109);
}

function paintPadding(img: CanvasImage, rng: Rng) {
  fill(img, 108);
  const n = 4, cell = img.width / n;
  for (let row = 0; row < n; row++) for (let col = 0; col < n; col++) {
    const v = 176 + Math.round(rng() * 30);
    const inset = 2;
    const cx = col * cell + cell / 2, cy = row * cell + cell / 2;
    for (let y = row * cell + inset; y < (row + 1) * cell - inset; y++) {
      for (let x = col * cell + inset; x < (col + 1) * cell - inset; x++) {
        const d = Math.hypot(x - cx, y - cy) / (cell / 2);
        setPx(img, x, y, clamp(v + 30 - d * d * 52));
      }
    }
  }
  speckle(img, 6, 110);
}

export const MORE_PAINTERS: Record<string, (img: CanvasImage, rng: Rng) => void> = {
  cobbles: paintCobbles,
  dirt: paintDirt,
  "wood-floor": paintWoodFloor,
  "foam-tiles": paintFoamTiles,
  grate: paintGrate,
  carpet: paintCarpet,
  gravel: paintGravel,
  padding: paintPadding,
};
