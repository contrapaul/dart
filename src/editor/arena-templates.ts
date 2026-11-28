import { readAssetsFile, type AssetBody } from "./assets";
import type { Clip } from "./clipboard";

// R3-07: pre-built arena templates. A template is a whole arena (a floor,
// walls, cover, a zone over the floor, spawn points and the fight triggers
// buildArena would write for a two wave fight of F01 and F02), kept as an
// asset file under data/arena-templates/ so it is read by the same asset
// reader and placed the same way a saved asset is.

export interface ArenaTemplate {
  /** A display label; a shape, not a story name. Paul may rename them. */
  name: string;
  clip: Clip;
  /** "" when the file carries none (templates have no pictures). */
  picture: string;
}

/** Every file, read and checked with the asset reader. A broken file is
 *  left out of TEMPLATES and listed in TEMPLATE_ERRORS instead of being
 *  drawn as a tile that cannot place. */
const FILES = import.meta.glob<{ default: unknown }>("../../data/arena-templates/*.json", { eager: true });

export const TEMPLATE_ERRORS: { file: string; error: string }[] = [];

export const TEMPLATES: ArenaTemplate[] = Object.entries(FILES)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([file, mod]) => {
    const read = readAssetsFile(JSON.stringify(mod.default));
    if (read.error) {
      TEMPLATE_ERRORS.push({ file, error: read.error });
      return null;
    }
    if (read.assets.length !== 1) {
      TEMPLATE_ERRORS.push({ file, error: `expected one template, found ${read.assets.length}` });
      return null;
    }
    const body: AssetBody = read.assets[0]!;
    return { name: body.name, clip: body.clip, picture: body.picture };
  })
  .filter((t): t is ArenaTemplate => t !== null);
