// R3-04: the Textures section of the level inspector (nothing selected).
// Uploads are scaled down to the data/editor.json cap with a canvas, cut
// into tiles when a tileset is asked for, and kept inside the level file
// as data: URLs (no fetching). Each texture keeps its own name and scale.

import { EDITOR } from "./doc";
import type { Level, TextureAsset } from "../level/format";

export interface TexturesContext {
  /** Replace the level's textures in one undo step. */
  setTextures(list: TextureAsset[], text: string): void;
  /** Scales the file down to the cap, cuts it into tiles, and appends the
   *  result; the page owns the canvas work. */
  uploadTextures(file: File, name: string, scale: number, tilesAcross: number, tilesDown: number): void;
  redraw(): void;
  warn(text: string): void;
}

const CAP = EDITOR.textures;

/** The width and height a cap-scaled image takes. */
export function capScale(naturalWidth: number, naturalHeight: number): { width: number; height: number } {
  const scale = Math.min(1, CAP.maxSize / naturalWidth, CAP.maxSize / naturalHeight);
  return {
    width: Math.max(1, Math.round(naturalWidth * scale)),
    height: Math.max(1, Math.round(naturalHeight * scale)),
  };
}

/** A canvas holding the image drawn at the cap's size. */
export function scaledCanvas(image: HTMLImageElement): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const { width, height } = capScale(image.naturalWidth, image.naturalHeight);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no 2d canvas");
  ctx.drawImage(image, 0, 0, width, height);
  return { canvas, ctx };
}

/** One cell of a tileset cut, as a canvas. */
export function tileCanvas(source: HTMLCanvasElement, across: number, down: number, i: number, j: number): HTMLCanvasElement {
  const cellW = Math.floor(source.width / across);
  const cellH = Math.floor(source.height / down);
  const canvas = document.createElement("canvas");
  canvas.width = cellW;
  canvas.height = cellH;
  const ctx = canvas.getContext("2d");
  if (ctx) ctx.drawImage(source, i * cellW, j * cellH, cellW, cellH, 0, 0, cellW, cellH);
  return canvas;
}

/** A jpeg data: URL under maxBytes, trying lower quality until it is. */
export function jpegDataUrl(canvas: HTMLCanvasElement, maxBytes: number): string {
  for (const quality of [0.85, 0.7, 0.5, 0.35]) {
    const data = canvas.toDataURL("image/jpeg", quality);
    if (data.length * 0.75 <= maxBytes) return data;
  }
  return canvas.toDataURL("image/jpeg", 0.25);
}

/** The id a texture takes: lower case words from the name, a number on the
 *  end when taken, so two uploads do not collide. */
export function textureIdFromName(name: string, taken: Iterable<string> = []): string {
  const used = new Set(taken);
  const stem = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const base = stem || "texture";
  let id = base;
  for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
  return id;
}

/** Why a file cannot be imported, or null when it can. */
export function textureFileProblem(name: string, bytes: number): string | null {
  if (!/\.(png|jpe?g)$/i.test(name)) return `${name}: only png or jpg textures are imported.`;
  if (bytes > CAP.maxBytes) {
    return `${name}: ${(bytes / 1000).toFixed(0)} KB, over the ${(CAP.maxBytes / 1000).toFixed(0)} KB limit per texture.`;
  }
  return null;
}

function numberInput(value: number, min: number, max: number, step: number, onCommit: (n: number) => void): HTMLInputElement {
  const input = document.createElement("input");
  input.type = "number";
  input.step = String(step);
  input.min = String(min);
  input.max = String(max);
  input.value = String(Math.round(value * 1000) / 1000);
  input.addEventListener("change", () => {
    const n = Number(input.value);
    if (Number.isFinite(n)) onCommit(Math.min(max, Math.max(min, n)));
  });
  return input;
}

function textureEntry(host: HTMLElement, level: Level, asset: TextureAsset, ctx: TexturesContext) {
  const row = document.createElement("div");
  row.className = "texture-row";
  const thumb = document.createElement("img");
  thumb.className = "texture-thumb";
  thumb.src = asset.image;
  thumb.alt = asset.name;
  row.append(thumb);
  const name = document.createElement("input");
  name.type = "text";
  name.value = asset.name;
  name.addEventListener("change", () => {
    const value = name.value.trim();
    if (value && value !== asset.name) {
      ctx.setTextures(
        (level.textures ?? []).map((t) => (t.id === asset.id ? { ...t, name: value } : t)),
        `rename ${value}`,
      );
    }
  });
  row.append(name);
  const scale = numberInput(asset.scale, 0.1, 50, 0.25, (n) => {
    ctx.setTextures(
      (level.textures ?? []).map((t) => (t.id === asset.id ? { ...t, scale: n } : t)),
      `scale ${asset.name}`,
    );
  });
  scale.title = "metres a repeat covers";
  row.append(scale);
  const remove = document.createElement("button");
  remove.type = "button";
  remove.textContent = "Delete";
  remove.addEventListener("click", () => {
    ctx.setTextures(
      (level.textures ?? []).filter((t) => t.id !== asset.id),
      `delete ${asset.name}`,
    );
  });
  row.append(remove);
  host.append(row);
}

/** The Textures section: a file input, a name and scale for the upload, a
 *  tiles-across x down pair (1 and 1 is one texture), and each texture's
 *  name, scale (metres a repeat) and delete. */
export function buildTexturesSection(
  host: HTMLElement,
  level: Level,
  ctx: TexturesContext,
): void {
  const heading = document.createElement("h2");
  heading.textContent = "Textures";
  host.append(heading);

  const upload = document.createElement("div");
  upload.className = "texture-upload";
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/png,image/jpeg";
  const name = document.createElement("input");
  name.type = "text";
  name.placeholder = "name";
  const scale = numberInput(1, 0.1, 50, 0.25, () => {});
  scale.title = "metres a repeat covers";
  const across = numberInput(1, 1, 16, 1, () => {});
  const down = numberInput(1, 1, 16, 1, () => {});
  const uploadBtn = document.createElement("button");
  uploadBtn.type = "button";
  uploadBtn.textContent = "Upload";
  uploadBtn.addEventListener("click", () => {
    const file = input.files?.[0];
    if (!file) {
      ctx.warn("Pick a file, then Upload.");
      return;
    }
    const tilesA = Math.max(1, Math.round(Number(across.value) || 1));
    const tilesD = Math.max(1, Math.round(Number(down.value) || 1));
    ctx.uploadTextures(file, name.value.trim() || file.name.replace(/\.[^.]+$/, ""), Number(scale.value) || 1, tilesA, tilesD);
    input.value = "";
    name.value = "";
    scale.value = "1";
    across.value = "1";
    down.value = "1";
  });
  const fileLabel = document.createElement("label");
  fileLabel.textContent = "file";
  fileLabel.append(input);
  const nameLabel = document.createElement("label");
  nameLabel.textContent = "name";
  nameLabel.append(name);
  const scaleLabel = document.createElement("label");
  scaleLabel.textContent = "scale (m)";
  scaleLabel.append(scale);
  const tiles = document.createElement("label");
  tiles.textContent = "tiles x";
  tiles.append(across, document.createTextNode(" x "), down);
  upload.append(fileLabel, nameLabel, scaleLabel, tiles, uploadBtn);
  host.append(upload);

  for (const asset of level.textures ?? []) textureEntry(host, level, asset, ctx);

  const note = document.createElement("p");
  note.className = "hint";
  note.textContent = `${(level.textures ?? []).length} of ${CAP.maxCount} textures. Uploaded images are scaled to ${CAP.maxSize} px a side and kept in the level file.`;
  host.append(note);
}
