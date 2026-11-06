import type { FoamerSpec } from "./foamer";
import type { BallKind } from "./projectiles";
import { BALL_MATERIAL, BLOB_MATERIAL } from "./projectiles";
import { materialId } from "../voxel/materials";

// GAME-10c: the Floater's blob numbers. A type that spits blobs carries
// them in its spec (data/foamers.json, `blob`); every other type has none,
// so its ranged attacks keep throwing the shared ball. The two kinds a
// launch takes are built here from the spec, so the numbers stay in data.

export interface BlobSpec {
  /** Small blobs per spit. */
  count: number;
  /** Degrees the fan spreads across. */
  spreadDeg: number;
  /** Every fourth attack (counting the spits it fires) is the big one. */
  everyFourth: number;
  /** Bounces off geometry before a small blob bursts. */
  bounces: number;
  /** Hard cap on live blobs. */
  maxLive: number;
  speed: number;
  gravity: number;
  radius: number;
  lifetime: number;
  chunks: number;
  big: { speed: number; gravity: number; radius: number; lifetime: number; chunks: number };
}

/** The blob numbers of a type, or null when it does not spit blobs. */
export function blobOf(spec: FoamerSpec): BlobSpec | null {
  return (spec as { blob?: BlobSpec }).blob ?? null;
}

/** The weak-point rule of the mouth (GAME-10c): which part is the mouth,
 *  and what a dart on it takes while the jaw is open. */
export interface MouthSpec {
  part: string;
  damage: number;
}

export function mouthOf(spec: FoamerSpec): MouthSpec | null {
  return (spec as { mouth?: MouthSpec }).mouth ?? null;
}

/** The small blob: lime (not BALL_MATERIAL, so the pages do not parry
 *  it), bouncing off geometry. */
export function smallBlobKind(blob: BlobSpec): BallKind {
  return {
    attack: "spit", speed: blob.speed, gravity: blob.gravity, radius: blob.radius,
    lifetime: blob.lifetime, chunks: blob.chunks, material: materialId("foam-lime"),
    mesh: BLOB_MATERIAL, bounces: blob.bounces, maxLive: blob.maxLive,
  };
}

/** The big pink blob: slower, bigger, drawn with the Roamer's own
 *  material, so the pages parry it like the Roamer's ball. */
export function bigBlobKind(blob: BlobSpec): BallKind {
  return {
    attack: "bigBlob", speed: blob.big.speed, gravity: blob.big.gravity,
    radius: blob.big.radius, lifetime: blob.big.lifetime, chunks: blob.big.chunks,
    material: materialId("foam-pink"), mesh: BALL_MATERIAL, bounces: 0, maxLive: blob.maxLive,
  };
}
