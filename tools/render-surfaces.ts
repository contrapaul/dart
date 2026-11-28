// R3-05: contact sheet for every surface. Each surface is drawn 2 by 2 (so
// a seam shows) in three palette colours, tinted by the thing's colour, with
// its name on the left. Writes design/surfaces/sheet.png. Run:
//   npx tsx tools/render-surfaces.ts
// Node is a CLI runtime dependency, not part of the browser type configuration.
// @ts-expect-error Node module types are intentionally not installed.
import { mkdirSync, writeFileSync } from "node:fs";
// @ts-expect-error Node module types are intentionally not installed.
import { drawSurface, SURFACE_NAMES, SURFACES } from "../src/render/surfaces";
import type { CanvasImage } from "../src/render/surfaces";
import { encodePng } from "./render-rig";

declare const process: { argv: string[] };

// The palette the sheets are tinted with, from data/materials.json (the foam
// palette): orange, blue and lime. Three tints is enough to see the texture.
const TINTS: { name: string; hex: string }[] = [
  { name: "orange", hex: "#ff7a1a" },
  { name: "blue", hex: "#2ec4ff" },
  { name: "lime", hex: "#b6ff3b" },
];
const TILE = 128; // one texture repeat in px
const COLS = 3, ROWS_2 = 2;
const CELL = TILE * ROWS_2;
const LABEL_W = 176;
const GAP = 10;
const BG = [232, 230, 236] as const;

type Image = { width: number; height: number; pixels: Uint8Array };

function image(width: number, height: number, color: readonly number[]): Image {
  const pixels = new Uint8Array(width * height * 4);
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = color[0]; pixels[i + 1] = color[1]; pixels[i + 2] = color[2]; pixels[i + 3] = 255;
  }
  return { width, height, pixels };
}
function pixel(im: Image, x: number, y: number, color: readonly number[]): void {
  if (x < 0 || y < 0 || x >= im.width || y >= im.height) return;
  const i = (y * im.width + x) * 4;
  im.pixels[i] = color[0]!; im.pixels[i + 1] = color[1]!; im.pixels[i + 2] = color[2]!;
}

function hexToRgb(hex: string): [number, number, number] {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

function tintImage(img: CanvasImage | null, hex: string): CanvasImage {
  const [r, g, b] = hexToRgb(hex);
  const out = { width: img ? img.width : 1, height: img ? img.height : 1, data: new Uint8ClampedArray(img ? img.data.length : 4) };
  if (!img) { out.data.set([r, g, b, 255]); return out; } // plain: the flat tint
  for (let i = 0; i < img.data.length; i += 4) {
    const v = img.data[i]!;
    out.data[i] = Math.round((v * r) / 255);
    out.data[i + 1] = Math.round((v * g) / 255);
    out.data[i + 2] = Math.round((v * b) / 255);
    out.data[i + 3] = 255;
  }
  return out;
}

function drawCell(im: Image, img: CanvasImage | null, tintHex: string, ox: number, oy: number): void {
  const cell = tintImage(img, tintHex);
  const w = cell.width, h = cell.height;
  const src = cell.data;
  for (let y = 0; y < CELL; y++) {
    for (let x = 0; x < CELL; x++) {
      const si = ((y % h) * w + (x % w)) * 4;
      const di = ((oy + y) * im.width + (ox + x)) * 4;
      im.pixels[di] = src[si]!; im.pixels[di + 1] = src[si + 1]!; im.pixels[di + 2] = src[si + 2]!; im.pixels[di + 3] = 255;
    }
  }
}

const FONT: Record<string, string[]> = {
  "A": ["010", "101", "111", "101", "101"],
  "B": ["110", "101", "110", "101", "110"],
  "C": ["011", "100", "100", "100", "011"],
  "D": ["110", "101", "101", "101", "110"],
  "E": ["111", "100", "110", "100", "111"],
  "F": ["111", "100", "110", "100", "100"],
  "G": ["011", "100", "101", "101", "011"],
  "H": ["101", "101", "111", "101", "101"],
  "I": ["111", "010", "010", "010", "111"],
  "J": ["001", "001", "001", "101", "010"],
  "K": ["101", "101", "110", "101", "101"],
  "L": ["100", "100", "100", "100", "111"],
  "M": ["101", "111", "111", "101", "101"],
  "N": ["110", "101", "101", "101", "101"],
  "O": ["010", "101", "101", "101", "010"],
  "P": ["111", "101", "111", "100", "100"],
  "Q": ["010", "101", "101", "010", "001"],
  "R": ["110", "101", "110", "101", "101"],
  "S": ["011", "100", "010", "001", "110"],
  "T": ["111", "010", "010", "010", "010"],
  "U": ["101", "101", "101", "101", "111"],
  "V": ["101", "101", "101", "101", "010"],
  "W": ["101", "101", "101", "111", "101"],
  "X": ["101", "101", "010", "101", "101"],
  "Y": ["101", "101", "010", "010", "010"],
  "Z": ["111", "001", "010", "100", "111"],
  "-": ["000", "000", "111", "000", "000"],
  " ": ["0", "0", "0", "0", "0"],
};
function drawText(im: Image, text: string, cx: number, cy: number, scale = 4): void {
  const advance = 3 * scale + 4, width = text.length * advance - 4;
  let startX = Math.floor(cx - width / 2);
  const startY = Math.floor(cy - (5 * scale) / 2);
  for (let i = 0; i < text.length; i++) {
    const glyph = FONT[text[i]!] ?? FONT[" "];
    for (let y = 0; y < glyph.length; y++) for (let x = 0; x < glyph[y]!.length; x++) {
      if (glyph[y]![x] !== "1") continue;
      for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) {
        pixel(im, startX + i * advance + x * scale + dx, startY + y * scale + dy, [42, 35, 64]);
      }
    }
  }
}

export function renderSheet(): Image {
  const names = SURFACE_NAMES;
  const rows = names.length;
  const width = LABEL_W + COLS * CELL + (COLS + 0) * GAP + GAP;
  const height = rows * (CELL + GAP) + GAP;
  const im = image(width, height, BG);
  names.forEach((name, row) => {
    const label = SURFACES[name]?.label ?? name;
    const oy = GAP + row * (CELL + GAP);
    // The surface, drawn 2 by 2 in each tint.
    const img = name === "plain" ? null : drawSurface(name, TILE);
    for (let c = 0; c < COLS; c++) {
      const ox = LABEL_W + GAP + c * (CELL + GAP);
      drawCell(im, img, TINTS[c]!.hex, ox, oy);
      // A hairline around each cell so the tiles read as 2 by 2.
      for (let x = 0; x < CELL; x++) { pixel(im, ox + x, oy, [42, 35, 64]); pixel(im, ox + x, oy + CELL - 1, [42, 35, 64]); }
      for (let y = 0; y < CELL; y++) { pixel(im, ox, oy + y, [42, 35, 64]); pixel(im, ox + CELL - 1, oy + y, [42, 35, 64]); }
    }
    // Label on the left, centred.
    drawText(im, label.toUpperCase(), LABEL_W / 2, oy + CELL / 2);
  });
  return im;
}

if (process.argv[1]?.endsWith("render-surfaces.ts")) {
  const im = renderSheet();
  mkdirSync("design/surfaces", { recursive: true });
  writeFileSync("design/surfaces/sheet.png", encodePng(im));
  console.log(`Wrote design/surfaces/sheet.png (${im.width}x${im.height})`);
}
