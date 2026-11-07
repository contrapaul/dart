import * as THREE from "three";
import type { FoamerSpec } from "./foamer";
import type { Foamer } from "./foamer";
import type { BallKind } from "./projectiles";
import { materialId, linearColorTable } from "../voxel/materials";

// GAME-10g: the Crawler's pellet stream numbers. A type that streams
// pellets carries them in its spec (data/foamers.json, `pellets`); every
// other type has none, so its ranged attacks keep throwing the shared
// ball. The kind a launch takes is built here from the spec, so the
// numbers stay in data (the pattern of blob.ts).
//
// A pellet is fast, nearly flat, small, and bursts on any geometry, so
// cover and voxel walls stop the stream. It is drawn with its own
// material, deliberately not BALL_MATERIAL, so the pages do not parry it.

export interface PelletSpec {
  /** Pellets in one burst. */
  count: number;
  /** Seconds between pellets in the burst. */
  intervalSeconds: number;
  /** Degrees of random spread each pellet's aim takes (plus or minus). */
  spreadDeg: number;
  speed: number;
  gravity: number;
  radius: number;
  lifetime: number;
  /** Foam chunks at the burst. */
  chunks: number;
  /** Hard cap on live pellets. */
  maxLive: number;
  /** The seed the spread's PRNG starts from (never Math.random()). */
  seed: number;
}

/** The pellet numbers of a type, or null when it does not stream. */
export function pelletOf(spec: FoamerSpec): PelletSpec | null {
  return (spec as { pellets?: PelletSpec }).pellets ?? null;
}

/** The weak points of a type (CONTENT-PLAN 3.1: the Crawler's gun, the
 *  F10's jets): which parts take the multiplier, and what they take. */
export interface WeakpointSpec {
  parts: string[];
  damage: number;
}

export function weakpointOf(spec: FoamerSpec): WeakpointSpec | null {
  return (spec as { weakpoint?: WeakpointSpec }).weakpoint ?? null;
}

/** Whether this Foamer can still stream: the gun, and at least one
 *  barrel. With the gun or both barrels gone it cannot fire (it walks up
 *  and stomps; chooseAttack falls through to the stomp by itself). */
export function canStream(spec: FoamerSpec, f: Foamer): boolean {
  return pelletOf(spec) !== null && f.parts.has("gun")
    && (f.parts.has("barrelL") || f.parts.has("barrelR"));
}

/** The pellet's own material: lime, and not BALL_MATERIAL, so the pages
 *  do not parry a pellet (the pattern of BLOB_MATERIAL). */
export const PELLET_MATERIAL = new THREE.MeshStandardMaterial({
  color: new THREE.Color().fromArray(linearColorTable(), materialId("foam-lime") * 3),
  roughness: 0.6,
});

/** The pellet: the stream attack's numbers, bursting on the first touch. */
export function pelletKind(pellets: PelletSpec): BallKind {
  return {
    attack: "stream", speed: pellets.speed, gravity: pellets.gravity,
    radius: pellets.radius, lifetime: pellets.lifetime, chunks: pellets.chunks,
    material: materialId("foam-lime"), mesh: PELLET_MATERIAL,
    bounces: 0, maxLive: pellets.maxLive,
  };
}
