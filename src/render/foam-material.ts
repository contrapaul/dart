import * as THREE from "three";
import { CHUNK_SIZE } from "../voxel/chunk";
import renderJson from "../../data/render.json";

// Foam look for voxel and block surfaces (ENG-07, PLAN.md 7.4): pore
// speckle, a slow tint wobble, a little glow so shadows are never black,
// and a rim light on edges facing away from the camera. All numbers in
// data/render.json. A MeshStandardMaterial with an onBeforeCompile patch;
// every foam material shares one program ("foam"), each keeps its own
// uniforms.

const F = renderJson.foam;

export interface FoamMaterialOptions {
  /** Pore cells per local unit of the geometry. Voxel meshes are in voxel
   *  units, so this is poreCellsPerVoxel; geometry in metres uses
   *  poreCellsPerVoxel / 0.1. */
  cellsPerUnit: number;
  /** Wrap the pore lattice every this many cells (0 = no wrap). Voxel
   *  chunk meshes pass CHUNK_SIZE * poreCellsPerVoxel so the pattern
   *  matches across chunk seams. */
  wrapCells: number;
  /** Use vertex colours (voxel meshes). Instanced colours (debris) work
   *  without it, as with a plain MeshStandardMaterial. */
  vertexColors?: boolean;
  /** Base colour for non-vertex-coloured geometry (the foam blocks). */
  color?: THREE.ColorRepresentation;
}

/** Insert code after an anchor line; throw naming the anchor if missing. */
function after(src: string, anchor: string, code: string) {
  const i = src.indexOf(anchor);
  if (i < 0) throw new Error(`foam material: shader anchor missing: ${anchor}`);
  const e = i + anchor.length;
  return `${src.slice(0, e)}\n${code}\n${src.slice(e)}`;
}

// Value noise on the integer lattice, wrapped per hash call so a lattice
// that tiles every `wrap` cells tiles exactly (wrap 0 = no wrap). No sin
// of large numbers: the hash only ever sees the wrapped cell index, which
// stays small, so it is stable at mediump precision.
const NOISE = `
varying vec3 vFoamPos;
uniform float uCellsPerUnit;
uniform float uWrapCells;
uniform float uPoreCoverage;
uniform float uPoreDepth;
uniform float uTint;
uniform float uRoughVar;
uniform float uGlow;
uniform float uRim;
uniform float uRimPower;

float foamCell( vec3 i, float wrap ) {
  i = floor( i ) + vec3( 157.0, 113.0, 271.0 );
  if ( wrap > 0.0 ) i = mod( i, vec3( wrap ) );
  // A scrambling hash (a linear one makes diagonal stripes on the lattice).
  vec3 h = fract( i * vec3( 0.1031, 0.1030, 0.0973 ) );
  h += dot( h, h.yzx + 33.33 );
  return fract( ( h.x + h.y ) * h.z );
}

float foamNoise( vec3 p, float wrap ) {
  vec3 i = floor( p );
  vec3 f = fract( p );
  f = f * f * ( 3.0 - 2.0 * f );
  return mix(
      mix( mix( foamCell( i, wrap ), foamCell( i + vec3( 1.0, 0.0, 0.0 ), wrap ), f.x ),
           mix( foamCell( i + vec3( 0.0, 1.0, 0.0 ), wrap ), foamCell( i + vec3( 1.0, 1.0, 0.0 ), wrap ), f.x ), f.y ),
      mix( mix( foamCell( i + vec3( 0.0, 0.0, 1.0 ), wrap ), foamCell( i + vec3( 1.0, 0.0, 1.0 ), wrap ), f.x ),
           mix( foamCell( i + vec3( 0.0, 1.0, 1.0 ), wrap ), foamCell( i + vec3( 1.0, 1.0, 1.0 ), wrap ), f.x ), f.y ),
      f.z );
}`;

/** The text patch, exported for the tests: takes the stock vertex and
 *  fragment shader strings and returns the patched ones. Throws an Error
 *  naming the anchor if any anchor below is missing (so a Three.js
 *  upgrade that renames a chunk fails loudly, not silently). */
export function patchFoamShader(
  vertexShader: string,
  fragmentShader: string,
): { vertexShader: string; fragmentShader: string } {
  let v = after(vertexShader, "#include <common>", "varying vec3 vFoamPos;");
  // The local, untransformed position: it moves with the mesh, a falling
  // piece or a walking Foamer, so pores never swim.
  v = after(v, "#include <begin_vertex>", "vFoamPos = position;");
  let f = after(fragmentShader, "#include <common>", NOISE);
  // Vertex and instance colours are applied by then.
  f = after(
    f,
    "#include <color_fragment>",
    `
vec3 foamPos = vFoamPos * uCellsPerUnit;
float foamPore = foamNoise( foamPos, uWrapCells ) * 0.65
  + foamNoise( foamPos * 2.0, uWrapCells * 2.0 ) * 0.35;
float foamTintN = foamNoise( foamPos * 0.125, uWrapCells / 8.0 ) * 2.0 - 1.0;
float foamPoreMask = 1.0 - smoothstep( uPoreCoverage - 0.15, uPoreCoverage + 0.15, foamPore );
diffuseColor.rgb *= ( 1.0 - uPoreDepth * foamPoreMask ) * ( 1.0 + uTint * foamTintN );`,
  );
  f = after(f, "#include <roughnessmap_fragment>", "roughnessFactor += uRoughVar * foamTintN;");
  f = after(
    f,
    "#include <emissivemap_fragment>",
    `
totalEmissiveRadiance += diffuseColor.rgb * ( uGlow + uRim * pow( 1.0 - saturate( dot( normal, normalize( vViewPosition ) ) ), uRimPower ) );`,
  );
  return { vertexShader: v, fragmentShader: f };
}

/** A new MeshStandardMaterial with the foam patch. */
export function createFoamMaterial(opts: FoamMaterialOptions): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    vertexColors: opts.vertexColors === true,
    roughness: F.roughness,
  });
  if (opts.color !== undefined) material.color.set(opts.color);
  // Wrapping a frequency: the second pore octave wraps at double the base,
  // the tint at an eighth.
  const values = {
    uCellsPerUnit: opts.cellsPerUnit,
    uWrapCells: opts.wrapCells,
    uPoreCoverage: F.poreCoverage,
    uPoreDepth: F.poreDepth,
    uTint: F.tintVariation,
    uRoughVar: F.roughnessVariation,
    uGlow: F.glow,
    uRim: F.rim,
    uRimPower: F.rimPower,
  };
  material.onBeforeCompile = (shader) => {
    for (const [name, value] of Object.entries(values)) shader.uniforms[name] = { value };
    Object.assign(shader, patchFoamShader(shader.vertexShader, shader.fragmentShader));
  };
  // Every foam material shares one compiled program.
  material.customProgramCacheKey = () => "foam";
  return material;
}

let shared: THREE.MeshStandardMaterial | null = null;
/** The shared material for voxel chunk meshes (VolumeMesh and falling
 *  pieces): vertexColors, cellsPerUnit = poreCellsPerVoxel, wrapCells =
 *  CHUNK_SIZE * poreCellsPerVoxel. Created once, then reused. */
export function voxelFoamMaterial(): THREE.MeshStandardMaterial {
  return (shared ??= createFoamMaterial({
    vertexColors: true,
    cellsPerUnit: F.poreCellsPerVoxel,
    wrapCells: CHUNK_SIZE * F.poreCellsPerVoxel,
  }));
}
