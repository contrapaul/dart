# PLAN-GPU0: editor basics and tuning (round 3)

Scope: Paul's wishlist items 8 to 14 in `docs/plan/WISHLIST.md`. Items 1 to 7
(light, paint, arena templates and formulas) are planned elsewhere; this
document does not plan them. Nothing here changes the game's AI, physics or
render code except the two small build-time merges named in item 14.

What the game reads today: tuning numbers are `data/*.json`, imported at
build time by Vite; a browser cannot write the repo, so "tuned in the
browser" reaches the live game through a file Paul exports and commits. The
level file is self-contained, so a per-thing tuned value lives inside the
level file and travels with it. `data/editor.json` is the editor's own
numbers, not the game's tuning store.

Non-goals: no new physics, no new Foamer kinds, no arena templates, no texture import. Names stay `[Paul]`.

## Item 8: rename elements

What it means today.

The inspector renames one thing, and only for some kinds:

- Prims (`src/editor/inspector.ts` lines 111-120, one prim only), placed
  parts (`src/editor/inspector-parts.ts` line 175), triggers
  (`src/editor/inspector-trigger.ts` lines 187 and 273) and saved assets
  (`src/editor/asset-panel.ts` lines 124-149, name only).
- Physics, lights, models and buttons have no rename field at all.

Everything that names an id does so by raw string: triggers in `when` and
`do` (`src/editor/trigger-parts.ts`, lines ~104 and ~130) and a button's
`on` (`src/level/format.ts` line ~247). `LevelDoc.change()` records one
undo step per edit but does not know about any of this.

Design (recommended).

A `LevelDoc.rename(kind, id, newId)` in `src/editor/doc.ts` that refuses
duplicates with a status message, rewrites the entry and every reference
(triggers: enter, killed, pressed, taken, after, wake, show, hide, move,
open, close; buttons: `on`), records one undo step, and rebuilds the
outliner, inspector and view the way `doc.change` does. The id space is
one set across the level (`validateLevel`), so uniqueness is checked
everywhere.

Every single-selection inspector gets the id field at the top, disabled for
multi-selection and for the player start and the exit (single-instance
things, rename meaningless).

Alternative (not recommended). Per-kind rename fixes that leave the
references alone; the Problems list complains after the fact. That misses
the bug.

Data format: no change. `src/editor/rename.ts` holds two pure functions:

```ts
function referenceTargets(level: Level, oldId: string):
  { kind: EntryKind; id: string; path: string[]; value: string }[]
function applyRename(level: Level, kind: EntryKind, oldId: string, newId: string): Level
```

`applyRename` rewrites the entry and every reference; `referenceTargets`
drives the outliner outline and the tests.

## Item 9: a save and load screen that shows the maps being worked on

What it means today.

There is no save/load screen. `src/editor/main.ts` has:

- Auto-save: `scheduleSave()` (line ~2274), debounced 500 ms, then
  `saveNow()` (line ~2281), which calls `putLevel(doc.level, savedKey ??
  undefined)` (`src/editor/store.ts` line ~45) and shows "Saved".
- An Open button (line ~2499): a dialog listing stored levels (Open and
  Delete per row, via `listLevels()`) then built-ins as copies
  (`BUILT_IN` glob, `builtInCopy`).
- Boot choice via `openChoice()` (`src/editor/open.ts` line ~24): the
  `?open=` key if it names a stored level, else the newest, else new.

The store is `dart.levels` (IndexedDB). Nothing displays what you are
working on: no list, no current marker, no save state.

Design (recommended).

One "Maps" screen, a dialog opened from a top-bar button (new id
`mapsBtn`), moved out of the Open handler into its own module
(`src/editor/save-screen.ts`). It lists every map being worked on:

- Each stored level: name, saved time, a "current" marker, and Open /
  Export / Delete actions (Delete keeps the Open dialog's current-level
  guard). The built-ins follow, as copies.
- The current level first and marked, a Save button in the top bar beside
  it (forces `saveNow()`, shows "Saved" or the error), and a dirty marker
  in the status line ("Unsaved changes" vs "Saved"). No format change,
  auto-save stays on.

Alternative (not recommended). Keep the Open dialog and add a "Maps"
section to the outliner. It buries the list inside a panel that is not
always visible, and it duplicates what the Open dialog already does.

Data format: no new format. The screen is a pure view over existing data:

```ts
// src/editor/save-screen.ts (new), plain types, no DOM:
interface MapRow { kind: "saved" | "builtIn"; key: string | null; name: string;
  when: number | null; current: boolean }
function mapsView(stored: StoredLevel[], builtIns: { path: string }[],
  currentKey: string | null): { rows: MapRow[]; currentKey: string | null }
```

`mapsView` is what the tests assert on; the dialog renders it.

## Item 10: a "reset camera" button

What it means today.

The camera opens on `view.openOn(level.playerStart)` (`src/editor/main.ts`
line 2332), which places the camera behind and above the player start
(`src/editor/view.ts` line 730, ED-12) and comes in short of a wall when
one is between. Nothing resets to it after a level opens.

Design (recommended).

A "Reset view" button in the top bar (new id `resetViewBtn`, next to Play)
that calls `view.openOn(doc.level.playerStart)` and sets the status line
to "View reset". It also gives the keyboard the same action: the key is
taken (F frames the selection), so no key is added in this round; Paul can
ask for one later.

Alternative (not recommended). Bind reset to the existing `Esc`-adjacent
or a new key and skip the button. A button is visible and discoverable for
the students using this (ages 10+), which is the point of the wishlist item.

Data format: no format change. One line of code in `main.ts` plus one
button in `editor.html` plus one row in `help.ts`.

## Item 11: Foamer behaviour options (editor)

What it means today.

The Foamer inspector (`buildFoamerFields` in `src/editor/inspector-parts.ts`
lines 105 to 118) shows a select of rigs, position, yaw, promoted, wake and
starts hidden. No tunable numbers at all.

The numbers live in two files:

- `data/foamers.json`: a base spec (`test`, ~110 keys) and a per-type
  override layer (`types`, e.g. F01's `vacuum` block, F03's `pack`, F04's
  shield block). Read in `src/foamers/foamers.ts`: `specFor` (line 83, shallow
  spread), `rigFor` (line 99) and `rigForSpawn` (line 115, the promoted
  health multiplier and part material swap).
- `data/foamer-rigs.json`: the rig per type: speed, health, voxelSize,
  material, parts.

Nested blocks (`damage`, `ball`, `catastrophic`, `wound`, `stagger`,
`finisher`, `down`, `brokenParts`, `handicaps`, `attacks`) are read in
`foamer.ts` and `foamers.ts`.

Design (recommended). Two scopes, one panel:

- Global (every Foamer of the type): a toggle at the top of the panel,
  "Every F01" vs "This Foamer". The global scope writes to the shared
  tuning file (`data/tuning.json`, item 14) through `src/core/tuning.ts`.
- Per-thing (one placed Foamer in the level): the same fields write a
  `tuning` object onto that PlacedFoamer in the level file. The game merges
  it at spawn (src/level/placed.ts, one line in spawnOne; the merge in
  src/foamers/foamers.ts, the spawn call). It travels with the level file,
  so students' maps carry their own tuning.

The panel exposes the numbers that exist today, grouped: movement (rig
speed, voxelSize, minDamageSpeed, turnRate, gravity, distances, crawl
shares), health (rig health, wound, stagger), damage (damage.*,
partDamage, catastrophic, attacks[] damage, armour arc), attack speed
(attacks[].windup, attacks[].strike, recover). "Size" is not a real
setting today (see risks): the panel shows the rig's voxelSize and speed,
and a real overall scale is an open question.

Alternative (not recommended). One global scope only, no per-thing level
file value. Simpler, but it throws away the per-map tuning students made,
which is the actual wishlist request ("set for one Foamer or for every
Foamer of that type").

Data format.

`data/tuning.json` (new, committed):

```ts
// version 1. Everything below is a deep-merge patch; the game merges it
// over the resolved spec, last value wins.
interface TuningFile {
  version: number;
  foamers: Record<string, { spec?: Record<string, unknown>; rig?: Record<string, unknown> }>;
  blasters: Record<string, Record<string, unknown>>;
}
```

Per-thing (level file, `PlacedFoamer`):

```ts
interface PlacedFoamer {
  // existing fields...
  /** Deep-merge patch applied over the resolved type spec (and rig). */
  tuning?: { spec?: Record<string, unknown>; rig?: Record<string, unknown> };
}
```

Unknown keys in a patch are dropped by the merge with a warning in the
Problems list, the way the validator treats unknown manifest fields.
Arrays (`attacks`) are replaced, not merged.

## Item 12: player weapon details

What it means today.

The range is the weapon tuning page, and it does not tune: `src/range/menu.ts`
selects blasters and toggles mods (line 45), and the test panel in
`src/range/main.ts` (the `blasterSelect`, `modToggles`, `dartTypes` rows in
`range.html`) switches blaster and mods only. Nothing edits the numbers.

The numbers live in `data/blasters.json` (per blaster: mode, dartType,
dartsPerShot, spreadDeg, magSize, reserveMax, reserveStart, reloadTime,
primeTime, autoReload, fireInterval, recoil, viewmodel, motion, muzzles,
plus per-mod overrides) and `data/melee.json`. They are read in
`src/weapons/blaster.ts` (`resolveSpec`, line 226) and
`src/weapons/loadout.ts`.

Design (recommended). A "Tune" section in the range's test panel: blaster
select (reuse the existing `blasterSelect`), then the numbers, with the
same two scopes as the Foamer panel:

- Global (every map): writes the `blasters` block of `data/tuning.json`.
- Per-level: deferred (see risks).

The panel must write to the same shared store as the Foamer panel
(`src/core/tuning.ts`), so the editor, range, arena and play all see one
set of numbers (item 13). The numbers the panel shows are the existing
per-blaster keys plus the mods that exist; every mod's overridable keys are
a fixed documented list, not a free-form JSON editor.

Alternative (not recommended). No UI: keep Paul's hand-editing of
`data/blasters.json`. The wishlist item exists because the hand path drifts
from what the rest of the toolset does; and a tuned file cannot be shared
through the editor's export either way.

Data format: same `data/tuning.json` as item 11 (the `blasters` block).

## Item 13: settings carry over across workspaces

What it means today.

The look/audio/health settings are one `SettingsStore` (localStorage key
`dart.settings`, `src/core/settings.ts` line ~95), shared by the arena,
the test course and the range (both read it, `src/game/game.ts` line 228,
`src/range/main.ts` line 166). The editor reads neither the tuning nor the
settings: it carries only its own localStorage keys (`dart-editor-folded`,
`dart-editor-rotate-snap`) and the level store. So a number tuned in the
range is invisible to the arena and to the editor.

Design (recommended). One new module, `src/core/tuning.ts`:

```ts
interface Tuning { version: number; foamers: FoamerTuningMap; blasters: BlasterTuningMap; }
```

- Defaults: the committed `data/tuning.json` (build time, Vite import).
- Overrides: localStorage key `dart.tuning`, in memory, on the store's
  `onChange`.
- Merge: `mergeSpec` and `mergeBlaster`, deep merge of records, last value
  wins, arrays replaced, unknown keys dropped.
- Reset: `resetTuning()` clears the override and reloads. The reset button
  is in the editor top bar, the range test panel and the pause menu, all
  calling it. Paul resets the committed file by deleting it.
- Every workspace imports the module: the editor and the range (the
  tuning panels), the arena and play (the game merge).

Alternative (not recommended). Extend the existing `SettingsStore` with
the tuning. One store, fewer modules, but it mixes look/audio settings with
data-level tuning, and versioning two kinds of data through one versioned
localStorage record makes the reset and export semantics muddy.

Data format: `src/core/tuning.ts` owns the interface and the shape shown
in item 11; the committed file is `data/tuning.json`.

## Item 14: export the tuned settings

What it means today.

Nothing exports settings. The live game reads `data/*.json` at build time
(Vite imports), so a tuning change in the editor is not visible to the live
game until the file is committed.

Design (recommended).

- An "Export tuning" button in the editor top bar and in the range test
  panel. It downloads the tuned settings as a JSON file shaped like the
  committed file (same `{ version, foamers, blasters }`), with a
  `exportedAt` and `exportedFrom` line.
- The game merges the file at build time (shared merge in
  `src/core/tuning.ts`). Call sites: `specFor` (line 83) merges the
  `foamers` block over the resolved spec; `rigFor`/`rigForSpawn` (line
  99/115) merge the rig block; `resolveSpec` (line 226) merges the
  `blasters` block over the resolved spec (after mods, so a mod still
  wins inside its own block).
- The per-thing level file tuning (item 11) needs no export: it travels
  inside the level file.

Alternative (not recommended). A `tools/apply-tuning.mjs` that bakes the
file into `data/foamers.json` and `data/blasters.json` in place. Keeps the
data files the only source of truth, but the diffs become noisy and the
merge is applied at build time in three places instead of one, and the
mistake surface grows (a baked value can never be undone by deleting the
file). Recommend the additive file.

Data format: exact shape in item 11 (`TuningFile`). The export is that
shape, plus `exportedAt` and `exportedFrom` lines. Paul reviews the file
and commits it; that is the live game's path.

## Bugs in this scope

One real bug, the one item 8 exists for.

### Bug: a rename breaks what names the thing

Cause. The rename paths patch only the renamed entry via `doc.change()`
(`src/editor/inspector.ts` lines 111-120, `src/editor/inspector-parts.ts`
line 175, `src/editor/inspector-trigger.ts` line 273), which records one
undo step and nothing else. Every other place that names an id holds it as
a raw string: triggers in `when` and `do` (`enter`, `killed`, `pressed`,
`taken`, `after`, `wake`, `show`, `hide`, `move`, `open`, `close`,
`src/editor/trigger-parts.ts` lines ~104 and ~130), a button's `on`
(`src/level/format.ts` line ~247) and the view's linked outline
(`selectInView`, `src/editor/main.ts` line ~944). A rename silently breaks
those links; the Problems list only reports it after the fact. Renames are
not checked for collisions either: `LevelDoc.nextId` avoids collisions for
fresh ids, not for renames (`src/editor/doc.ts` line ~268), so a rename onto
an existing id leaves two things with one id.

Fix (item 8). `LevelDoc.rename(kind, id, newId)` walks the level, refuses
duplicates with a status message, rewrites the entry and every reference,
and records one undo step. `src/editor/rename.ts` holds the pure helpers.

No other bug in items 9 to 14 is known. Item 9 is a new feature, not a
broken one: the Open dialog already lists the saved levels and the built
ins, it is just the wrong surface (and has no save button, no dirty marker
and no "current" marker).


## Risks and open questions

