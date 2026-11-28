# Plan: editor round 3, items 1 to 7 (lights and paint)

Plan for wishlist items 1 to 7 (`docs/plan/WISHLIST.md`). The other half
(items 8 to 14) is planned by another agent at the same time. Everything is in
`src/`, `data/` and `tests/`; nothing is fetched from another host. This is a
plan, not the work.

Read order for a builder: this file, then the files named in the card.

## 1. The light spread bug

Paul: "Lights: the spread of a light seems to matter little or not at all."

### What it means here

- `src/level/lights.ts`, `buildOne` (line ~65): a spot gets
  `min(89, (def.angle ?? 45) / 2) * DEG` as the half angle and `def.range` as
  the distance, decay 2 (three.js physical units). A point gets `def.range`
  as distance, decay 2. The level stores the spot's cone as the full angle.
- `src/editor/lights-editor.ts`, `LIGHT_DEFAULTS` (line 9): intensity 20,
  range 8, angle 45, softness 0.3. Its comment says these come from
  `data/editor.json`; they are hardcoded in the file.
- `src/editor/markers.ts`, `lightMarker` (line ~233): cone radius uses
  `min(89, l.angle ?? 45) / 2` as the half angle.
- `src/render/scene.ts`: no tone mapping; the scene is lit by hemisphere 1.2
  plus sun 2, the same values `view.ts` resets to every redraw. No level in
  `data/levels/` has lights yet.

### Cause

1. Physical falloff: three.js fades as `1 / d^2` (decay 2), and the range
   only bites in the last ~15% of the nominal distance
   (`pow2(saturate(1 - pow4(d / range)))`). By the nominal range a 20
   candela light is under 1% of peak. The range knob barely changes the
   picture.
2. The scene is already lit and is not tone-mapped: an added light is an
   additive nudge over ambient 1.2 + sun 2.
3. Small inconsistency: the marker uses `min(89, angle) / 2` as the half
   angle while the light uses `min(89, angle / 2)`. They agree up to 89
   degrees full angle, then the marker draws a narrower cone than the real
   light.

### Fix (recommended)

- Move the defaults into `data/editor.json` (`lights.defaultIntensity`,
  `defaultRange`, `defaultAngle`, `defaultSoftness`) and read them in
  `lights-editor.ts`. Raise the default intensity (Paul picks the number;
  40 is a sane start against the sun at 2).
- Scale the light's intensity by `(range / defaultRange)^2` in `buildOne`,
  so the range knob is visible: a light reaching 16 m reads brighter than
  one reaching 8 m at the same inspector value. (The falloff itself is
  not changed.)
- Fix the marker's cone to match the light's half angle for every angle.
- The tone mapping fix lives in the GI card below.

Alternative (cheaper): leave the physical model alone, raise the default
intensity, and document that intensity is the reach control.

Open question for Paul: does "spread" mean the range or the cone angle? The
cone half-angle already works (the test asserts it); the range is the knob
that does nothing visible.

### Data format

```json
"lights": {
  "maxShadows": 4,
  "defaultIntensity": 20, "defaultRange": 8,
  "defaultAngle": 45, "defaultSoftness": 0.3
}
```

```ts
// src/level/lights.ts
export function effectiveIntensity(
  intensity: number, range: number, defaultRange: number,
): number {
  return intensity * Math.pow(range / defaultRange, 2);
}
```

Card: R3-01.

## 2. The Paint tool's own brush

Paul: "The Paint tool's brush size is the terrain brush's. Paint needs its
own brush size and strength."

### What it means here

- `src/editor/main.ts` (line ~1258): a drag on the terrain to paint it
  builds its brush from the Terrain tool's live brush
  (`radius: terrainTool.brush.radius`, `strength:
  EDITOR.terrain.brush.paintToolStrength`).
- `src/editor/paint-tool.ts`, `PaintSettings`: `{ surface, colour }` only.
- The Paint tool also paints prims on click/drag (`paintPrim`), which takes
  no brush (each prim is painted whole).

### Design

- Add `radius` and `strength` to `PaintSettings` and to the swatch panel
  (two range inputs beside the surfaces, like the Terrain panel's).
  Defaults from `data/editor.json` (`paint: { radius, strength,
  minRadius, maxRadius, maxStrength }`).
- The terrain paint drag uses the paint brush, not the Terrain tool's.
  The Terrain tool keeps its own brush.
- Prims stay click-to-paint, no brush.

Alternative: the brush numbers inline in `paint-tool.ts` (simpler, but
tuning numbers live in code; this repo puts them in `data/editor.json`).

### Data format

```json
"paint": { "radius": 2.5, "strength": 8, "minRadius": 0.5, "maxRadius": 20, "maxStrength": 10 }
```

```ts
// src/editor/paint-tool.ts
export interface PaintSettings {
  surface: string;
  colour: string | null;
  radius: number;
  strength: number;
}
```

Card: R3-02.

## 3. A paint bucket

Paul: "A paint bucket."

### What it means here

- The Paint tool (`src/editor/paint-tool.ts`, `paintPrim`, the
  `kind: "paint"` press in `src/editor/main.ts`) sets a prim's surface and
  colour from a live swatch choice. There is no "pick up a look from one
  thing, then paint with it" step.
- The clipboard (`src/editor/clipboard.ts`) is the opposite pattern: it
  repastes a selection, not a look.

### Design

Recommended: a "Pick" button in the Paint tool's panel, beside the swatches.
Pressed once, a click on a prim or a physics object loads that thing's
current look into `paintSettings`: `surface` becomes that surface, `colour`
becomes that prim's explicit colour (so it paints on every hit, as
`paintPrim` already does), the panel reflects it, and the paint tool stays
armed. The status line says what was picked ("picked brick / #ff7a1a").
Terrain painting stays a brush drag.

Alternative: a separate always-armed "Bucket" tool, like the Paint tool,
that only ever picks and stays in pick mode until Esc. Simpler to reason
about, but it duplicates the panel and the press logic.

### Data format

No new file data. The look lives in `paintSettings` (memory). One pure
helper in `paint-tool.ts`:

```ts
export function lookFrom(thing: { surface?: string; colour: string }):
  { surface: string; colour: string };
```

Card: R3-03. Depends on R3-02 (same panel).

## 4. Uploaded and generated textures

Paul: "Upload new textures and tilesets (the drawn ones are a good start,
but too many do not match well). Generate more of them too."

### What it means here

- `src/render/surfaces.ts` draws every surface in code (`drawSurface`, one
  canvas per surface, greys for tinting). `data/surfaces.json` holds the
  list with `label` and `scale`. The validator (`src/level/validate.ts`,
  the prim check) refuses unknown surfaces. Swatches, the terrain layer
  select, the prims' surface select and the terrain's blend all read
  `SURFACES`.
- A sky image is the closest working pattern for uploads:
  `src/editor/files.ts` `skyImageDataUrl` scales an uploaded image to the
  `data/editor.json` cap and keeps it in the level as a data: URL
  (`Level.sky`); nothing is fetched.
- "Tilesets": the drawn surfaces already repeat (RepeatWrapping, world-space
  UVs in `worldUVs`); an uploaded image is a tileable one the same way.
  Named sets of matching surfaces (a "grass and stone" set) would be a new
  concept and are left as a follow-up, not needed for the upload.

### Design

Recommended (two cards):

(a) Upload. A new `Level.textures?: TextureAsset[]`, kept in the level
file, like the sky image:

```ts
// src/level/format.ts
export interface TextureAsset {
  id: string;
  name: string;      // display name, [Paul]
  image: string;     // "data:image/png;base64,..."
  scale: number;     // metres one repeat of the texture covers
}
// Level gains: textures?: TextureAsset[];
```

```json
"textures": { "maxCount": 8, "maxImageBytes": 400000, "maxWidth": 1024, "maxHeight": 1024 }
```

The editor gains a "Textures" panel in the level inspector next to the sky
(upload button, scale slider, delete). Uploaded textures join the swatch
list and the terrain layer select as `tex:<id>`. The game resolves them
from the active level's `textures` (a module-level registry, set once per
level build), so `surfaceTexture`, `surfaceMaterial` and the terrain blend
all read uploads like built-ins.

(b) Generated. Add more code-drawn surfaces (canvas, stone, parchment,
[Paul] names), same pattern as the nine existing painters, listed in
`data/surfaces.json` with labels and scales. [Paul] owns the names.

Alternative: store uploads in the browser (IndexedDB, like saved assets)
with the level file referencing them by key. Simpler for the store, but
it breaks "the level file carries everything" and makes an export useless.

Cards: R3-04a (format, validator, registry, tests), R3-04b (panel, upload wiring, game resolution), R3-05 (generated surfaces).

## 5. Global illumination options

Paul: "Global illumination options."

### What it means here

- `src/render/scene.ts` `createRenderer`: no tone mapping; hemisphere 1.2,
  sun 2. The editor view (`src/editor/view.ts`) builds its own renderer the
  same way. The quality preset is `src/render/quality.ts` (`pickQuality`,
  presets in `data/render.json`).
- Voxel AO is already a global option: `data/render.json` `ao.levels`, used
  by the mesher (`greedyMesh`).
- Per level, `Level.lighting` already covers ambient and sun (colours,
  intensity, yaw, pitch); the editor exposes them in `buildLightingSection`.

### Design

Recommended (global renderer options):

```json
"look": { "toneMapping": "aces", "exposure": 1.0 }
```

`toneMapping` is one of `none | aces | reinhard | linear`. Apply it in
`createRenderer` and in the editor view's own renderer. One pure helper in
`src/render/scene.ts`:

```ts
export function toneMappingFor(look: Look): number; // three.js enum value
```

The inspector adds nothing here (ambient and sun already exist); the AO
levels stay global.

Alternative (bigger): per-level `look` stored in the level file, so each
map wears its own look. More files, more validator. Not recommended now.

Card: R3-06.

## 6. Pre-built arena templates

Paul: "Pre-built arena templates."

### What it means here

- The Arena button (`src/editor/main.ts`, `arenaDialog`, then
  `buildArena` in `src/editor/arena-build.ts`) asks zone, blockers, spawn
  points, waves and doors, then writes 3 or more triggers.
- A template is a named recipe: the waves and the pacing. Zone, blockers,
  spawn points and doors are level-specific and stay as Paul answers them.

### Design

Recommended: a new `data/arena-templates.json`, one entry per template:

```json
{ "templates": [
  { "name": "Double wave", "note": "[Paul]", "waves": [
    { "foamer": "F01", "count": 3 }, { "foamer": "F02", "count": 2 } ] }
] }
```

A new `src/editor/arena-templates.ts`:

```ts
export interface ArenaTemplate {
  name: string;
  note: string;
  waves: { foamer: string; count: number }[];
}
export const TEMPLATE_LIST: ArenaTemplate[];
export function findTemplate(name: string): ArenaTemplate | null;
```

The dialog gains a "Template" select: picking one fills the wave rows
(foamer and count), as the template is a start only. Zone, blockers, spawn
points and doors stay as today.

Alternative: templates as one JSON file per template in `data/arena-templates/`.
More files to load and validate, no better UX. Not recommended.

Card: R3-07.

## 7. Saved arena formulas

Paul: "Write and save arena 'formulas' (a reusable recipe for an arena fight)."

### What it means here

- Saved assets (`src/editor/assets.ts`, ED-23) are the working pattern:
  IndexedDB (`dart.assets`), one JSON file with a `dart` marker and a
  version, caps in `data/editor.json`, `readAssetsFile` refusing broken
  files.
- A formula is a reusable fight recipe: the waves. Zone, spawn points,
  blockers and doors are level-specific and must not be carried.

### Design

Recommended: mirror the assets pattern.

```ts
// src/editor/arena-formulas.ts
export interface ArenaFormula {
  name: string;
  waves: { foamer: string; count: number }[];
}
export interface FormulaFile {
  dart: "dart-arena-formulas";
  version: 1;
  formulas: ArenaFormula[];
}
export const FORMULA_LIMITS = { max: 20, nameLength: 60 } as const;
export function formulaFileText(formulas: ArenaFormula[]): string;
export function readFormulasFile(text: string): { formulas: ArenaFormula[]; error: string | null };
```

The dialog gains: a "Formula" select (unsaved default + every saved
formula), a "Save as formula" (asks for a name, stores it, refreshes the
list) and a "Delete formula". The selected formula fills the waves, like a
template. Storage in IndexedDB keyed by name, capped by
`data/editor.json` (`arenaFormulas: { max: 20 }`). Display names and the
default formulas are [Paul].

Alternative: formulas as more built-in template entries. That is item 6,
not item 7.

Card: R3-08. Depends on R3-07 (same dialog).

## Cards

Every card owns disjoint files. Cards are 30 to 90 minutes each.

### R3-01: Light spread (bug)

**Files:** `src/level/lights.ts`, `data/editor.json` (`lights` block: new
defaults), `tests/level/lights.test.ts`.
**Hook edits:** `src/editor/lights-editor.ts` (read the defaults from
`data/editor.json` instead of hardcoding), `src/editor/markers.ts` (cone
radius matches the light's half angle), `src/level/validate.ts` (note on
the angle).
**Steps:** move the defaults to the data file; add `effectiveIntensity` and
use it in `buildOne`; fix the marker radius; update the inspector comment
and the validator note.
**Tests:** `effectiveIntensity` is 1 at the reference range and grows past
it; the marker cone matches the light half angle at 100 degrees; the data
file carries the defaults; the default intensity comes through.
**Deps:** none.

### R3-02: Paint tool's own brush

**Files:** `src/editor/paint-tool.ts`, `data/editor.json` (`paint` block),
`tests/editor/paint-brush.test.ts` (new).
**Hook edits:** `src/editor/main.ts` (the terrain paint drag uses the paint
brush instead of the Terrain tool's).
**Steps:** add `radius` and `strength` to `PaintSettings` and to
`buildPaintPanel` (range inputs, like the Terrain panel's); add the `paint`
block to `data/editor.json`; read it in main.ts; keep the Terrain tool's
brush untouched.
**Tests:** the defaults come through; the panel's values are used by the
paint drag (pure helper, no DOM: `paintBrushFor(doc, paintSettings)`).
**Deps:** none.

### R3-03: Paint bucket

**Files:** `tests/editor/paint-bucket.test.ts` (new).
**Hook edits:** `src/editor/paint-tool.ts` ("Pick" button + the
`lookFrom` helper), `src/editor/main.ts` (pick handler, status line).
**Steps:** add `lookFrom`; the Pick button arms a pick mode in the paint
panel; a press on a prim/physics object loads the look into
`paintSettings` and arms the paint tool; the status line says what was
picked.
**Tests:** `lookFrom` picks the right look from a prim (defaults to
`plain` when there is no surface).
**Deps:** R3-02.

### R3-04a: Uploaded textures, format and resolution

**Files:** `src/level/format.ts`, `src/level/validate.ts`,
`src/level/textures.ts` (new), `data/editor.json` (`textures` block),
`tests/level/textures.test.ts` (new).
**Hook edits:** `src/render/surfaces.ts` (resolve `tex:<id>` ids through
the registry), `src/level/terrain.ts` (the blend/scale lookup).
**Steps:** add `TextureAsset` and `Level.textures?` to `format.ts`; add the
validator (ids unique, bytes and px capped, image is a data URL); add the
registry (`setTextures`, `resolveTexture(id)`) in `textures.ts`; wire
`surfaceTexture`, `surfaceMaterial` and the terrain blend to it.
**Tests:** the validator refuses over-cap uploads; `resolveTexture`
returns the right texture for a built-in and an uploaded id; uploads do
not leak between levels (the registry is reset by `setTextures`).
**Deps:** none.

### R3-04b: Uploaded textures, editor panel and game wiring

**Files:** `src/editor/texture-panel.ts` (new), `src/arena/extras.ts`,
`src/editor/main.ts`.
**Steps:** the level inspector panel (upload button, scale slider, delete);
the upload path (file reader, cap, data URL, panel); the game sets the
registry once per arena build (`setTextures(level.textures ?? [])`), like
`buildLights`.
**Tests:** the upload path keeps a cap shape (pure helper: `capTexture(file,
caps)`).
**Deps:** R3-04a.

### R3-05: Generated surfaces

**Files:** `src/render/surfaces.ts`, `data/surfaces.json`,
`tests/render/surfaces.test.ts`.
**Steps:** add 3 to 5 new painters (canvas, stone, parchment, [Paul]
names); add them to the JSON with labels and scales. [Paul] picks the art.
**Tests:** every listed surface draws without throwing and is not flat
(existing test); the new ones are in the list.
**Deps:** none.

### R3-06: Global illumination options

**Files:** `data/render.json`, `src/render/scene.ts`, `src/editor/view.ts`,
`tests/render/look.test.ts` (new).
**Steps:** add `look: { toneMapping, exposure }` to `data/render.json`;
`toneMappingFor` resolves it; the renderer and the editor view apply it;
`data/render.json` documents the allowed strings.
**Tests:** `toneMappingFor` maps each named look to its three.js enum;
the preset still picks pixel ratio, antialias and shadows; an unknown
look falls back to `none`.
**Deps:** none.

### R3-07: Arena templates

**Files:** `data/arena-templates.json` (new), `src/editor/arena-templates.ts`
(new), `tests/editor/arena-templates.test.ts` (new).
**Hook edits:** `src/editor/main.ts` (the dialog's Template select).
**Steps:** the JSON (2 to 3 templates: double wave, open arena, [Paul]
names); the `findTemplate` helper; the dialog select fills the wave rows.
**Tests:** the templates load; `findTemplate` matches and misses; a
template's waves are valid foamer ids and counts.
**Deps:** none.

### R3-08: Saved arena formulas

**Files:** `src/editor/arena-formulas.ts` (new), `data/editor.json`
(`arenaFormulas` block), `tests/editor/arena-formulas.test.ts` (new).
**Hook edits:** `src/editor/main.ts` (the dialog's formula select, Save
and Delete buttons).
**Steps:** mirror the assets pattern (IndexedDB, JSON file with a `dart`
marker, caps); the dialog wiring; undo through the doc like a build.
**Tests:** the file round-trips; the validator refuses over-cap files;
the store is capped.
**Deps:** R3-07.

### Dependency graph

```
R3-01  R3-02  R3-04a  R3-05  R3-06  R3-07
          │        │                     ▲
          ▼        ▼                     │
        R3-03*   R3-04b                R3-08
```

*R3-03 also ticks the terrain path in main.ts, so R3-03 finishes after
R3-02. All other cards are independent.

## Risks and open questions for Paul

1. What does "spread" mean? (Range vs cone angle.) See item 1.
2. Uploaded textures are per-level data URLs like the sky image. That
   grows the level file (max 8 textures, each under 400 KB). Is that the
   right trade, or do you want them in the browser's storage instead?
3. The spread fix scales a light's intensity by `(range / defaultRange)^2`.
   That is a feel judgement call, not a physics rule. OK?
4. The GI card is global (one tone mapping per page), not per level. OK?
5. No level file in `data/levels/` has lights or textures yet, so nothing
   in this round has been seen in play. The editor and the game need a
   human once the cards land.
6. Two cards touch `data/editor.json` and `src/editor/main.ts`: R3-01
   (lights section), R3-02/R3-03 (paint section), R3-04a (textures block),
   R3-04b/R3-08 (main.ts), R3-06 (render.json, not editor.json), R3-07/R3-08
   (main.ts). The keys are distinct, so no conflict in practice; the lead
   should merge in the order above.
7. Art and names for the new generated textures, templates and default
   formulas are [Paul]'s.

## What needs the browser (not a test)

- A level with 2 to 3 lights: the cone edges and the range ramp.
- A terrain with paint: the brush size and strength.
- An uploaded texture: swatch list, terrain blend, and the game's tint.
- ACES tone mapping and exposure: the whole scene.
- A template-filled arena, then a formula saved and re-opened.
