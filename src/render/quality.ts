// OPS-04: three picture presets, picked by a URL value. The picker is pure
// so it can be tested headless; the pages read the one resolved choice.
import renderJson from "../../data/render.json";

export interface QualityPreset {
  pixelRatioMax: number;
  antialias: boolean;
  shadows: boolean;
  shadowMapMax: number;
  debrisMax: number;
  breakoffMaxPieces: number;
}

export interface QualityData {
  quality: {
    default: string;
    presets: Record<string, QualityPreset>;
  };
}

export interface QualityChoice {
  name: string;
  preset: QualityPreset;
}

/** `?quality=low` gives low; a missing or unknown value gives the default. */
export function pickQuality(search: string, data: QualityData): QualityChoice {
  const requested = new URLSearchParams(search).get("quality");
  const name = requested && data.quality.presets[requested] ? requested : data.quality.default;
  return { name, preset: data.quality.presets[name]! };
}

/** The page's choice, resolved once from location.search. */
export const QUALITY = pickQuality(
  typeof location === "undefined" ? "" : location.search,
  renderJson as QualityData,
);
