// R3-06: the global illumination look. Tone mapping and exposure live on the
// renderer; skyLight makes the level's sky throw light at every surface;
// bounce is the hemisphere light's ground colour. Pure data, plus a small
// three.js part for the environment map; tested headless.
import * as THREE from "three";
import type { LevelLighting } from "../level/format";
import renderJson from "../../data/render.json";

export type ToneMappingName = "none" | "aces" | "agx" | "neutral";

export const TONE_MAPPING_NAMES: readonly ToneMappingName[] = ["none", "aces", "agx", "neutral"];

export interface LookOptions {
  toneMapping: ToneMappingName;
  exposure: number;
  skyLight: number;
  bounce: string;
}

export type Gi = NonNullable<LevelLighting["gi"]>;

interface LookData {
  look: LookOptions;
}

/** The data/render.json defaults, used for every field a level omits. */
export function lookDefaults(): LookOptions {
  const look = (renderJson as LookData).look;
  return {
    toneMapping: look.toneMapping,
    exposure: look.exposure,
    skyLight: look.skyLight,
    bounce: look.bounce,
  };
}

/** three.js tone mapping enum for a name. Unknown names fall back to none. */
export function toneMappingFor(name: string): THREE.ToneMapping {
  switch (name) {
    case "aces": return THREE.ACESFilmicToneMapping;
    case "agx": return THREE.AgXToneMapping;
    case "neutral": return THREE.NeutralToneMapping;
    default: return THREE.NoToneMapping;
  }
}

/** The level's look with every field filled in. When the low quality preset
 *  is active, skyLight is forced to 0. */
export function resolveLook(
  gi: Gi | undefined,
  defaults: LookOptions = lookDefaults(),
  skyLightOff = false,
): LookOptions {
  const merged = {
    toneMapping: gi?.toneMapping ?? defaults.toneMapping,
    exposure: gi?.exposure ?? defaults.exposure,
    skyLight: gi?.skyLight ?? defaults.skyLight,
    bounce: gi?.bounce ?? defaults.bounce,
  };
  if (skyLightOff) merged.skyLight = 0;
  return merged;
}

/** Tone mapping and exposure on the renderer this look drives. */
export function applyLookToRenderer(renderer: THREE.WebGLRenderer, look: LookOptions) {
  renderer.toneMapping = toneMappingFor(look.toneMapping);
  renderer.toneMappingExposure = look.exposure;
}

/** A hex colour, the format colour pickers produce. */
export function isColour(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
}
