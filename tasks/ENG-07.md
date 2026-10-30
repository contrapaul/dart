# ENG-07: Foam shader v1 and voxel ambient occlusion

```
ID:          ENG-07
Title:       Foam material (pores, soft glow, rim light) on every foam
             surface, and per-vertex ambient occlusion in the greedy mesher
Owner:       Pi (Qwen 3.8-27b)
Reviewer:    Claude Opus 5.5
Depends on:  ENG-04, ENG-06, GAME-03 (all done)
Branch:      eng-07, in its own worktree (see "Setup")
```

## Read first

1. `CLAUDE.md` (rules for this repo; every rule applies to you)
2. `PLAN.md` section 7.4 (rendering and look)
3. `HANDOFF.md` (current state, especially ENG-04, ENG-06 and GAME-03)
4. `src/voxel/mesher.ts`, `src/voxel/mesher.worker.ts`,
   `src/voxel/volume-mesh.ts`, `src/voxel/pieces.ts`, `src/voxel/debris.ts`,
   `src/render/scene.ts`, `src/main.ts` (the foam blocks), and
   `tests/voxel/mesher.test.ts`

## How to work (important)

Keep each reply's thinking short and act through tools. Build in stages:
write one file, run `npx tsc --noEmit` and the tests, then the next file.
Never write more than about 200 lines in one tool call. Suggested order:
`data/render.json`, `buildPadded` and its test, ambient occlusion in the
mesher and its tests, `foam-material.ts` and its tests, then wiring it in.

## Goal

Right now every voxel is a flat-coloured `MeshStandardMaterial`, so the
wall and the Foamer look like plastic blocks. Two changes make them read
as foam:

1. **Ambient occlusion (AO)** baked into the vertex colours by the mesher:
   inside corners, crater floors and the seam where a Foamer meets the
   ground get softly darker. This is what makes a carved crater look deep.
2. **A foam material**: a `MeshStandardMaterial` patched with
   `onBeforeCompile` to add soft pore speckle, a faint tint variation, a
   little glow (foam lets light through, so shadows are never black) and a
   rim light on edges facing away from the camera.

The colours stay the palette colours; this is a look pass, not a recolour.
Paul judges the final look in the browser, so every number is in data.

## Setup

```bash
cd /Users/paul/Documents/GitHub/dart
git worktree add ../dart-eng-07 -b eng-07
cd ../dart-eng-07
npm install
```

Run the dev server with `npm run dev -- --port 5174` so it does not clash
with port 5173.

## Files

Create:

- `data/render.json`
- `src/render/foam-material.ts`
- `tests/render/foam-material.test.ts`

Edit (only these, only as described):

- `src/voxel/mesher.ts`: `buildPadded` fills the whole border; AO in
  `greedyMesh`.
- `src/voxel/mesher.worker.ts`: nothing should need to change; if it does,
  say why in HANDOFF.
- `src/voxel/volume-mesh.ts`, `src/voxel/pieces.ts`: use the foam material
  instead of their own `MeshStandardMaterial`.
- `src/voxel/debris.ts`: use the foam material for the instanced chunks.
- `src/main.ts`: the thrown foam blocks use the foam material. The course
  boxes, floor, blaster and darts are not foam: leave them alone.
- `tests/voxel/mesher.test.ts`: add the new tests; existing tests must
  still pass unchanged.

## Data: `data/render.json`

```json
{
  "_note": "Look of foam surfaces (ENG-07). Colours stay in materials.json. Pore cells are per voxel, so smaller voxels get finer pores.",
  "foam": {
    "poreCellsPerVoxel": 3,
    "poreCoverage": 0.35,
    "poreDepth": 0.14,
    "tintVariation": 0.04,
    "roughness": 0.95,
    "roughnessVariation": 0.06,
    "glow": 0.06,
    "rim": 0.22,
    "rimPower": 3
  },
  "ao": {
    "levels": [0.5, 0.68, 0.84, 1.0]
  }
}
```

- `poreCellsPerVoxel` must be an integer (see "Seams" below).
- `poreCoverage`: the fraction of the surface that reads as pores (0 to 1).
- `poreDepth`: how much a pore darkens the colour (0.14 = 14 percent).
- `tintVariation`: slow, large-scale brightness wobble, plus or minus.
- `glow`: added emissive, as a fraction of the surface colour.
- `rim`, `rimPower`: rim light strength (fraction of the surface colour)
  and falloff exponent.
- `ao.levels`: brightness multiplier for 0, 1, 2 and 3 open sides at a
  vertex (3 = fully open, no darkening).

## Part 1: `buildPadded` fills the whole border

AO at a chunk's edge needs the diagonal neighbours across the chunk
boundary (edges and corners of the padded cube), and `buildPadded` only
copies the six face neighbours today. Change it so every padded cell with
any coordinate equal to -1 or `S` is read with `volume.get` at its real
position. Keep the fast `subarray` copy for the interior. The output size
and `paddedIndex` do not change.

## Part 2: AO in `greedyMesh`

Standard voxel corner AO, computed per face per voxel before merging.

For a face of voxel `p` with normal `q` (one of the six axis directions),
look at the layer in front of the face, `p + q`. For each of the face's
four corners, with in-plane directions `su` and `sv` pointing towards that
corner (each +1 or -1 along the face's `u` and `v` axes):

```
side1  = solid(p + q + su)
side2  = solid(p + q + sv)
corner = solid(p + q + su + sv)
ao     = (side1 && side2) ? 0 : 3 - (side1 + side2 + corner)
```

`solid` reads the padded array (non-zero is solid). All of these cells are
inside the padded cube because `p` is inside the chunk.

Merging: today the mask holds the material id. Make the mask a
`Uint16Array` (or `Uint32Array`) holding a key of the material id plus the
four corner AO values (2 bits each), and merge only runs with an equal key.
A flat face with no occluders keeps merging exactly as before.

Output: multiply each vertex's colour by `ao.levels[ao]` for that corner.
No new vertex attribute. The corner order must match the quad corners the
mesher writes today (`base`, `base + du`, `base + du + dv`, `base + dv`).

Diagonal: when `ao0 + ao2 < ao1 + ao3` (corner 0 and 2 darker than 1 and
3), split the quad along the other diagonal so the shading does not show
a crease. The winding (outward normal) must stay correct both ways; the
existing winding test pattern shows how to check it.

`greedyMesh` reads the levels from `data/render.json` by default. Give it
an optional third parameter `aoLevels: number[]` so tests can pass their
own; the worker passes nothing.

## Part 3: the foam material (`src/render/foam-material.ts`)

```ts
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

/** A new MeshStandardMaterial with the foam patch. */
export function createFoamMaterial(opts: FoamMaterialOptions): THREE.MeshStandardMaterial;

/** The shared material for voxel chunk meshes (VolumeMesh and falling
 *  pieces): vertexColors, cellsPerUnit = poreCellsPerVoxel, wrapCells =
 *  CHUNK_SIZE * poreCellsPerVoxel. Created once, then reused. */
export function voxelFoamMaterial(): THREE.MeshStandardMaterial;

/** The text patch, exported for the tests: takes the stock vertex and
 *  fragment shader strings and returns the patched ones. Throws an Error
 *  naming the anchor if any anchor below is missing (so a Three.js
 *  upgrade that renames a chunk fails loudly, not silently). */
export function patchFoamShader(vertexShader: string, fragmentShader: string): {
  vertexShader: string;
  fragmentShader: string;
};
```

`createFoamMaterial` sets `roughness` from data, and its `onBeforeCompile`
adds the uniforms (below) to `shader.uniforms` and replaces the shader text
with `patchFoamShader`. Set `customProgramCacheKey` to return `"foam"` so
every foam material shares one compiled program.

Uniforms (all `{ value: ... }`): `uCellsPerUnit`, `uWrapCells`,
`uPoreCoverage`, `uPoreDepth`, `uTint`, `uRoughVar`, `uGlow`, `uRim`,
`uRimPower`. Values from data and the options. Each material has its own
uniform objects (different `cellsPerUnit`), the program is shared.

Shader patch, by anchor (these are the Three.js 0.186.1 chunk names; check
them in `node_modules/three/src/renderers/shaders/ShaderLib/meshphysical.glsl.js`):

- Vertex, after `#include <common>`: declare `varying vec3 vFoamPos;`.
- Vertex, after `#include <begin_vertex>`: `vFoamPos = position;` (the
  local, untransformed position: it moves with the mesh, a falling piece
  or a walking Foamer, so pores never swim).
- Fragment, after `#include <common>`: declare the varying, the uniforms
  and the noise functions.
- Fragment, after `#include <color_fragment>` (vertex and instance colours
  are applied by then): compute the pores and tint and multiply
  `diffuseColor.rgb`.
- Fragment, after `#include <roughnessmap_fragment>`: add the roughness
  variation to `roughnessFactor`.
- Fragment, after `#include <emissivemap_fragment>`: add glow and rim to
  `totalEmissiveRadiance`:
  `diffuseColor.rgb * (uGlow + uRim * pow(1.0 - saturate(dot(normal, normalize(vViewPosition))), uRimPower))`.

Noise: 3D value noise on an integer lattice, with a small hash on the
integer cell coordinates (no `sin` of large numbers: wrap first). If
`uWrapCells > 0`, wrap the lattice coordinates with `mod(cell, uWrapCells)`
before hashing, so the pattern tiles exactly every `uWrapCells` cells.

- Pores: one octave at `vFoamPos * uCellsPerUnit` plus a second at twice
  the frequency (it wraps at `2 * uWrapCells`), mixed 0.65 / 0.35. A pore
  is where that noise is below `uPoreCoverage`, with a soft edge
  (`smoothstep`), darkening by up to `uPoreDepth`.
- Tint: one octave at an eighth of the pore frequency (wraps at
  `uWrapCells / 8`, which is why `CHUNK_SIZE * poreCellsPerVoxel` must be
  divisible by 8: 32 * 3 = 96 is), scaling brightness by
  `1 + uTint * (n * 2 - 1)`.

### Seams

Chunk meshes have positions relative to their own chunk corner, so
`vFoamPos` jumps by 32 voxels at every chunk boundary. Wrapping the
lattice every `32 * poreCellsPerVoxel` cells makes the jump invisible.
This is why `poreCellsPerVoxel` must be an integer. Do not try to pass
per-mesh offsets.

### Where it goes

- `VolumeMesh` and `pieces.ts`: replace their module-level
  `MeshStandardMaterial` with `voxelFoamMaterial()`.
- `debris.ts`: `createFoamMaterial({ cellsPerUnit: poreCellsPerVoxel,
  wrapCells: 0 })`. The box geometry is 1 unit, about one voxel.
- `main.ts` foam blocks: one `createFoamMaterial({ cellsPerUnit:
  poreCellsPerVoxel / VOXEL, wrapCells: 0, color })` per colour, replacing
  the existing per-colour materials.

## Tests

`tests/voxel/mesher.test.ts` (add):

1. `buildPadded` fills edges and corners: in a volume, set a voxel in the
   chunk diagonally below-left of chunk (0,0,0), at world (-1, -1, 5), and
   one at the corner (-1, -1, -1). `buildPadded` for chunk (0,0,0) has them
   at `paddedIndex(-1, -1, 5)` and `paddedIndex(-1, -1, -1)`.
2. A lone voxel: every vertex colour equals the material colour (AO 3 at
   every corner, level 1.0).
3. A 4 x 1 x 4 slab with nothing on top: the top face is still one quad,
   and the box test (six quads) still passes.
4. A voxel standing on a 3 x 1 x 3 slab, in the middle: the slab's top
   face vertices that touch the standing voxel are darker than the
   material colour; vertices at the slab's outer corners are not; no vertex
   colour exceeds its material colour.
5. Inside corner: voxels at (0,0,0), (1,1,0) and (0,1,1), with your own
   `aoLevels` (for example `[0.1, 0.2, 0.3, 1]`) so the levels are easy to
   tell apart. On the top face of (0,0,0), the vertex at (1,1,1) has both
   sides solid and gets `aoLevels[0]`; the vertex at (0,1,0) has neither
   side nor the corner solid and gets `aoLevels[3]`; the vertices at
   (1,1,0) and (0,1,1) have one side solid and get `aoLevels[2]`.
6. Winding stays outward for flipped quads: for the mesh of test 4, every
   triangle's geometric normal (cross product of its edges) points the
   same way as its vertex normal.

`tests/render/foam-material.test.ts` (new):

7. `patchFoamShader` on `THREE.ShaderLib.standard.vertexShader` and
   `.fragmentShader` returns text that contains `vFoamPos` in both,
   `uPoreDepth` and `totalEmissiveRadiance +=` in the fragment, and still
   contains every original `#include` line.
8. `patchFoamShader` throws, naming the anchor, when an anchor is missing
   (pass a fragment shader with `#include <emissivemap_fragment>` removed).
9. `createFoamMaterial` returns a `MeshStandardMaterial` with roughness
   from data; calling its `onBeforeCompile` with a fake shader object
   (`{ uniforms: {}, vertexShader, fragmentShader }` from ShaderLib) adds
   all nine uniforms with the right values; `customProgramCacheKey()` is
   `"foam"`.
10. `voxelFoamMaterial()` returns the same object every call, with
    `vertexColors` true and `uWrapCells` 96 after `onBeforeCompile`.

## Done when

- [ ] `npm test` passes: the existing 62 tests and your 10 new ones.
- [ ] `npm run build` passes.
- [ ] In the browser (dev server on 5174), no console errors or shader
      warnings, and: the wall, the T tower, falling pieces, debris chunks,
      thrown foam blocks and the test Foamer all show pores and soft rim
      light; craters and the inside corners of the course read darker;
      no visible line where two wall chunks meet (look along x = 3.2 m,
      the first chunk seam of the 0.1 m wall); the Foamer's eyes still
      read white and ink.
- [ ] Remesh cost: report the mesher pool's average job time for the wall
      before and after (use `performance.now()` around a full wall remesh,
      or the pool's own timing if it has one). AO may cost more; say how
      much. Frame rate with 10 Foamers stays at or above 60 fps (report
      average and worst frame time, and say if the pane was hidden).
- [ ] Describe in HANDOFF how a crater in the wall looks before and
      after (depth, pores, seams). Do not commit images.
- [ ] No em dash or en dash characters anywhere you wrote, including the
      commit message. macOS grep has no `-P`; check with
      `perl -CSD -ne 'print "$ARGV:$.\n" if /\x{2014}|\x{2013}/' $(git ls-files)`.
- [ ] Nothing fetched from another host.
- [ ] A dated `HANDOFF.md` log entry (date with `date +%F`): what was
      built, decisions and why, what is unverified. Update the status
      section. Do not delete or rewrite other log entries or headings.
- [ ] Committed on branch `eng-07` with a message starting `ENG-07:` and
      ending with `Co-Authored-By: Qwen3.8-27B via Pi <noreply@local>`.
      **Do not merge into main and do not push.**

## Known limits (do not fix in this task)

- Foamers stay blocky until smoothed meshing (ENG-09).
- No outline pass, bloom or colour grading (later render tasks).
- The course boxes, floor, blaster and darts keep their current materials.
- Pore size follows voxel size: the Foamer (0.05 m voxels) has finer pores
  than the wall (0.1 m). Accepted for v1.

## If something is unclear

Stop and write the question at the top of your HANDOFF entry rather than
guessing. Do not change the public API above without saying so.
