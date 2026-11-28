import type { CanvasImage } from "./surfaces";

// R3-05: more surfaces drawn in code, added by the generated-surfaces card.
// Each painter draws greys into a square image (the thing's colour tints
// them) and must tile: its left edge meets its right, its top its bottom.
// `rng` is the seeded PRNG surfaces.ts hands it. Every name here also needs
// an entry in data/surfaces.json (label and scale).

export const MORE_PAINTERS: Record<string, (img: CanvasImage, rng: () => number) => void> = {};
