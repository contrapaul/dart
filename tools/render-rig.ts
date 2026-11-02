// Node is a CLI runtime dependency, not part of the browser type configuration.
// @ts-expect-error Node module types are intentionally not installed.
import { mkdirSync, writeFileSync } from "node:fs";
// @ts-expect-error Node module types are intentionally not installed.
import { deflateSync } from "node:zlib";
import * as THREE from "three";
import rigData from "../data/foamer-rigs.json";
import { buildPartVolume, restMotion, solvePose, type RigSpec } from "../src/foamers/rig";
import { VoxelVolume } from "../src/voxel/chunk";
import { material, materialId } from "../src/voxel/materials";

declare const process: { argv: string[] };

export const VIEW_SIZE = 512;
export const VIEWS = ["front", "side", "back", "three-quarter"] as const;
type View = (typeof VIEWS)[number];
type RGB = [number, number, number];
type Face = { points: THREE.Vector3[]; depth: number; color: RGB };
type Image = { width: number; height: number; pixels: Uint8Array };

const YAWS: Record<View, number> = { front: 0, side: Math.PI / 2, back: Math.PI, "three-quarter": Math.PI / 4 };
const CORNERS = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0], [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]];
const FACE_DATA = [
  { n: [1, 0, 0], c: [1, 5, 6, 2], shade: 0.78 }, { n: [-1, 0, 0], c: [4, 0, 3, 7], shade: 0.66 },
  { n: [0, 1, 0], c: [3, 2, 6, 7], shade: 1.12 }, { n: [0, -1, 0], c: [4, 5, 1, 0], shade: 0.55 },
  { n: [0, 0, 1], c: [5, 4, 7, 6], shade: 0.94 }, { n: [0, 0, -1], c: [0, 1, 2, 3], shade: 0.72 },
] as const;
const NORMAL_MATRIX = new THREE.Matrix3();

function rigFaces(rig: RigSpec, view: View): { faces: Face[]; bounds: number[] } {
  const pose = solvePose(rig, new THREE.Vector3(), 0, restMotion(), new Map());
  const yaw = YAWS[view], elevation = 0.16;
  const camera = new THREE.Vector3(Math.sin(yaw) * Math.cos(elevation), Math.sin(elevation), Math.cos(yaw) * Math.cos(elevation));
  const faces: Face[] = [], bounds = [Infinity, Infinity, -Infinity, -Infinity];
  for (const part of rig.parts) {
    const volume = new VoxelVolume(rig.voxelSize);
    buildPartVolume(volume, part, rig.material);
    const matrix = pose.get(part.id)!;
    NORMAL_MATRIX.getNormalMatrix(matrix);
    for (let y = 0; y < part.size[1]; y++) for (let z = 0; z < part.size[2]; z++) for (let x = 0; x < part.size[0]; x++) {
      const id = volume.get(x, y, z);
      if (!id) continue;
      const hex = material(id)!.color;
      const base: RGB = [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
      for (const face of FACE_DATA) {
        const [nx, ny, nz] = face.n;
        if (volume.get(x + nx, y + ny, z + nz)) continue;
        const normal = new THREE.Vector3(nx, ny, nz).applyMatrix3(NORMAL_MATRIX).normalize();
        if (normal.dot(camera) <= 0) continue;
        const points = face.c.map((i) => {
          const c = CORNERS[i];
          return new THREE.Vector3(x + c[0], y + c[1], z + c[2]).multiplyScalar(rig.voxelSize).applyMatrix4(matrix);
        });
        const center = points.reduce((sum, p) => sum.add(p), new THREE.Vector3()).multiplyScalar(0.25);
        faces.push({ points, depth: center.dot(camera), color: base.map((v) => Math.min(255, Math.round(v * face.shade))) as RGB });
        for (const p of points) updateBounds(project(p, yaw, elevation), bounds);
      }
    }
  }
  faces.sort((a, b) => a.depth - b.depth);
  return { faces, bounds };
}

function project(p: THREE.Vector3, yaw: number, elevation: number): [number, number] {
  return [p.x * Math.cos(yaw) - p.z * Math.sin(yaw),
    p.y * Math.cos(elevation) - (p.x * Math.sin(yaw) + p.z * Math.cos(yaw)) * Math.sin(elevation)];
}
function updateBounds(p: [number, number], b: number[]): void {
  b[0] = Math.min(b[0], p[0]); b[1] = Math.min(b[1], p[1]);
  b[2] = Math.max(b[2], p[0]); b[3] = Math.max(b[3], p[1]);
}

function image(width: number, height: number, color: RGB): Image {
  const pixels = new Uint8Array(width * height * 4);
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = color[0]; pixels[i + 1] = color[1]; pixels[i + 2] = color[2]; pixels[i + 3] = 255;
  }
  return { width, height, pixels };
}
function pixel(im: Image, x: number, y: number, color: RGB): void {
  if (x < 0 || y < 0 || x >= im.width || y >= im.height) return;
  const i = (y * im.width + x) * 4;
  im.pixels[i] = color[0]; im.pixels[i + 1] = color[1]; im.pixels[i + 2] = color[2];
}
function fillPolygon(im: Image, points: [number, number][], color: RGB): void {
  const minY = Math.max(0, Math.ceil(Math.min(...points.map((p) => p[1]))));
  const maxY = Math.min(im.height - 1, Math.floor(Math.max(...points.map((p) => p[1]))));
  for (let y = minY; y <= maxY; y++) {
    const crossings: number[] = [], py = y + 0.5;
    for (let i = 0; i < points.length; i++) {
      const a = points[i], b = points[(i + 1) % points.length];
      if ((py >= a[1] && py < b[1]) || (py >= b[1] && py < a[1]))
        crossings.push(a[0] + ((py - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
    }
    crossings.sort((a, b) => a - b);
    for (let i = 0; i + 1 < crossings.length; i += 2)
      for (let x = Math.max(0, Math.ceil(crossings[i])); x <= Math.min(im.width - 1, Math.floor(crossings[i + 1])); x++) pixel(im, x, y, color);
  }
}

export function renderView(rig: RigSpec, view: View): Image {
  const { faces, bounds } = rigFaces(rig, view);
  const im = image(VIEW_SIZE, VIEW_SIZE, [232, 230, 236]);
  const margin = 42, yaw = YAWS[view], elevation = 0.16;
  const scale = Math.min((VIEW_SIZE - margin * 2) / (bounds[2] - bounds[0]), (VIEW_SIZE - margin * 2) / (bounds[3] - bounds[1]));
  const ox = VIEW_SIZE / 2 - ((bounds[0] + bounds[2]) / 2) * scale;
  const oy = VIEW_SIZE / 2 + ((bounds[1] + bounds[3]) / 2) * scale;
  const screen = (p: THREE.Vector3): [number, number] => {
    const q = project(p, yaw, elevation); return [ox + q[0] * scale, oy - q[1] * scale];
  };
  const groundY = Math.round(screen(new THREE.Vector3())[1]);
  for (let x = 25; x < VIEW_SIZE - 25; x++) pixel(im, x, groundY, [151, 146, 159]);
  for (const face of faces) fillPolygon(im, face.points.map(screen), face.color);
  return im;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(kind: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(data.length + 12), name = new TextEncoder().encode(kind);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length); out.set(name, 4); out.set(data, 8);
  view.setUint32(data.length + 8, crc32(out.subarray(4, data.length + 8)));
  return out;
}
export function encodePng(im: Image): Uint8Array {
  const ihdr = new Uint8Array(13), view = new DataView(ihdr.buffer);
  view.setUint32(0, im.width); view.setUint32(4, im.height);
  ihdr.set([8, 6, 0, 0, 0], 8);
  const raw = new Uint8Array(im.height * (im.width * 4 + 1));
  for (let y = 0; y < im.height; y++) raw.set(im.pixels.subarray(y * im.width * 4, (y + 1) * im.width * 4), y * (im.width * 4 + 1) + 1);
  const parts = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", new Uint8Array())];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0; for (const part of parts) { out.set(part, at); at += part.length; }
  return out;
}

const FONT: Record<string, string[]> = {
  "0": ["111", "101", "101", "101", "111"], "1": ["010", "110", "010", "010", "111"],
  "2": ["111", "001", "111", "100", "111"], "5": ["111", "100", "111", "001", "111"],
  "F": ["111", "100", "110", "100", "100"], "S": ["111", "100", "111", "001", "111"],
  "L": ["100", "100", "100", "100", "111"], "O": ["111", "101", "101", "101", "111"],
  "W": ["101", "101", "101", "111", "101"], "M": ["101", "111", "111", "101", "101"],
  "E": ["111", "100", "110", "100", "111"], "R": ["110", "101", "110", "101", "101"],
  "A": ["010", "101", "111", "101", "101"], "D": ["110", "101", "101", "101", "110"],
  "T": ["111", "010", "010", "010", "010"], " ": ["0", "0", "0", "0", "0"],
};
function sheetLabel(im: Image, text: string): void {
  const scale = 4, advance = 20, width = text.length * advance - 4;
  const startX = Math.floor((im.width - width) / 2), startY = VIEW_SIZE + 18;
  for (let i = 0; i < text.length; i++) {
    const glyph = FONT[text[i]];
    if (!glyph) continue;
    for (let y = 0; y < glyph.length; y++) for (let x = 0; x < glyph[y].length; x++)
      if (glyph[y][x] === "1") for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++)
        pixel(im, startX + i * advance + x * scale + dx, startY + y * scale + dy, [42, 35, 64]);
  }
}
export function renderSheet(rig: RigSpec, views: Record<View, Image>): Image {
  const im = image(VIEW_SIZE * 4, VIEW_SIZE + 58, [232, 230, 236]);
  for (let i = 0; i < VIEWS.length; i++) {
    const view = views[VIEWS[i]];
    for (let y = 0; y < VIEW_SIZE; y++) im.pixels.set(view.pixels.subarray(y * VIEW_SIZE * 4, (y + 1) * VIEW_SIZE * 4), ((y * im.width) + i * VIEW_SIZE) * 4);
  }
  sheetLabel(im, `${rig.id} ${rig.label.toUpperCase()}`);
  return im;
}
export function renderRigViews(rig: RigSpec): Record<View, Image> {
  return Object.fromEntries(VIEWS.map((view) => [view, renderView(rig, view)])) as Record<View, Image>;
}
export function writeRigRenders(rig: RigSpec, directory = "design/foamers"): void {
  mkdirSync(directory, { recursive: true });
  const views = renderRigViews(rig);
  for (const view of VIEWS) writeFileSync(`${directory}/${rig.id}-${view}.png`, encodePng(views[view]));
  writeFileSync(`${directory}/${rig.id}-sheet.png`, encodePng(renderSheet(rig, views)));
}

if (process.argv[1]?.endsWith("render-rig.ts")) {
  const id = process.argv[2] ?? "F01";
  const rig = (rigData.rigs as unknown as RigSpec[]).find((entry) => entry.id === id);
  if (!rig) throw new Error(`Unknown rig ${id}`);
  for (const part of rig.parts) materialId(part.material ?? rig.material);
  writeRigRenders(rig);
  console.log(`Rendered ${id} to design/foamers/`);
}
