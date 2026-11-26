import * as THREE from "three";
import surfaceData from "../../data/surfaces.json";

// ED-36 (design/EDITOR-V2.md): the surfaces things can wear. This is the
// contract the other cards call; ED-36 fills in the textures. Until then
// every surface is a plain tinted material, so callers can use it today.
//
// One material per (surface, colour) pair, cached, so a level with 500
// brick walls in three colours makes three materials.

export interface SurfaceSpec {
  label: string;
  /** Metres one repeat of the texture covers. */
  scale: number;
}

export const SURFACES = (surfaceData as { surfaces: Record<string, SurfaceSpec> }).surfaces;
export const SURFACE_NAMES = Object.keys(SURFACES);

export function isSurface(name: string): boolean {
  return Object.hasOwn(SURFACES, name);
}

const cache = new Map<string, THREE.MeshStandardMaterial>();

/** A material for a surface tinted by a colour. The geometry must carry
 *  world-scaled UVs (`worldUVs`) for the texture to tile at its scale. */
export function surfaceMaterial(surface: string | undefined, colour: string): THREE.MeshStandardMaterial {
  const key = `${surface ?? "plain"}|${colour}`;
  let m = cache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color: colour, roughness: 0.9 });
    cache.set(key, m);
  }
  return m;
}
