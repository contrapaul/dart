import type { Level } from "../level/format";
import { validateLevel } from "../level/validate";

// ED-02 stage 4: the level file as it leaves and comes back. Export writes
// `<name>.dart.json`; import reads one back and refuses it with the
// validator's own errors. Kept apart from the page so it can be tested
// headless.

/** A file name from the level's name: lower case words joined by hyphens,
 *  so "The Pit, take 2" is "the-pit-take-2.dart.json". A name with no
 *  letters or digits at all (every level starts as "[Paul]") falls back to
 *  "level". */
export function exportFileName(level: Level): string {
  const slug = (level.meta.name ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${slug || "level"}.dart.json`;
}

export interface ReadResult {
  /** The level, or undefined when errors says why not. */
  level?: Level;
  errors: string[];
}

/** Reads an imported file's text. Errors from `validateLevel` are returned
 *  as they are, so the dialog can list them; bad JSON is one error. */
export function readLevelFile(text: string): ReadResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (e) {
    return { errors: [`not a level file: ${(e as Error).message}`] };
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { errors: ["not a level file: it is not an object"] };
  }
  const level = data as Level;
  const result = validateLevel(level);
  if (result.errors.length) return { errors: result.errors };
  return { level, errors: [] };
}

/** Scales an uploaded sky image down to fit the editor's cap, on a canvas,
 *  and returns it as a JPEG data: URL to sit in `level.sky`. The level file
 *  carries the picture, so it travels with an export. */
export function skyImageDataUrl(image: HTMLImageElement, maxWidth: number, maxHeight: number): string {
  const scale = Math.min(1, maxWidth / image.naturalWidth, maxHeight / image.naturalHeight);
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no 2d canvas");
  ctx.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", 0.82);
}
