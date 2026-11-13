# OPS-04: graphics quality presets for older machines

Written 2026-11-13. Paul picked this as the next card (PLAN row OPS-04:
"needed, not yet"). Older or weaker machines need a cheaper picture. For
now the preset is only chosen by URL, so Paul can measure one: no menu yet.

```
ID:          OPS-04
Title:       Three quality presets in data/render.json, picked with
             ?quality=low|medium|high; high is exactly today's picture
Owner:       Pi (strata-dsv41 on dgx-spark, thinking medium)
Reviewer:    Claude Opus 5.5
Branch:      ops-04, in its own worktree
```

**Your files:** `data/render.json`, a new `src/render/quality.ts`,
`src/render/scene.ts`, `src/voxel/debris.ts` and `src/voxel/pieces.ts`
only to take a cap from the preset, the places that build them
(`src/game/game.ts`, `src/range/setup.ts`, `src/range/main.ts`,
`src/sandbox/main.ts`), `src/core/boot-report.ts` (one diag line), new
tests in `tests/render/`.

## What is there today

- `src/render/scene.ts` `createRenderer`: antialias on, pixel ratio
  `min(devicePixelRatio, 2)`, shadows on, a 1024 shadow map (levels pass
  their own `shadowMap` and `shadowRadius` through `SceneOptions`; the
  arena asks for 2048). The range panel already has a shadows toggle
  (`src/range/main.ts`, `renderer.shadowMap.enabled = on`): start it in
  the preset's state.
- `data/destruction.json` `debris.max` 150 (foam chunks live at once,
  read in `DebrisSystem`'s constructor) and `breakoff.maxPieces` 16
  (break-off pieces, `src/voxel/pieces.ts`).
- The range's Foamer line comes from `data/range.json`.

## What to build

1. **Presets in data.** `data/render.json` gets a `quality` block:
   `default` ("high") and `presets` `low`, `medium`, `high`. Each preset
   has `pixelRatioMax`, `antialias`, `shadows` (on or off), `shadowMapMax`
   (a level's own shadowMap is capped at this), `debrisMax`,
   `breakoffMaxPieces`. `high` is today's values exactly (2, true, true,
   2048 (the arena asks for 2048), 150, 16), so nothing changes
   without the switch. Suggested starting values, tuned by Paul later:
   medium 1.5, true, true, 1024, 100, 12; low 1, false, false, 512, 60, 8.
2. **A pure picker.** `src/render/quality.ts` exports
   `pickQuality(search: string, data)` returning the preset name and
   values: `?quality=low` gives low, a missing or unknown value gives the
   default. No DOM, no `window`, so it is tested headless. One exported
   `QUALITY` resolved from `location.search` for the pages.
3. **Use it.** `createRenderer` takes the preset: pixel ratio capped,
   antialias, shadows off means `shadowMap.enabled = false` and the sun
   does not cast. `DebrisSystem` and the break-off pieces take their cap
   from the preset instead of `destruction.json` (keep `destruction.json`
   as is; the preset value is the one used). Keep the tests that build
   these without a preset working (they get the high values).
4. **Diag.** With `?diag`, the readout gains `Quality: <name>` with the
   values.

## Not in this task

- No in-game menu or saved setting.
- **Foamer count is not touched.** Levels place their Foamers by design,
  and fewer of them changes the fight, not only the picture. That is
  Paul's call; leave a note in HANDOFF.
- Nothing else changes in high.

## Done when

- Tests in `tests/render/`: `pickQuality` gives low, medium, high, and the
  default for none or junk; high equals today's values; debris built with
  a preset never holds more than its `debrisMax` chunks.
- `npm run check` and `npm run smoke` pass.
- PLAN.md: the OPS-04 row says what was built; HANDOFF.md: a dated entry
  directly under `## Log` saying how Paul compares presets
  (`/range?quality=low&diag`, `/range?quality=low&bench`).

## Rules

No em dashes anywhere (`node tools/check-no-em-dash.mjs`). Nothing fetched
from another host. Tuning numbers live in `data/` JSON. Edit JSON by hand,
never by dumping it from a script. Commit on the `ops-04` branch with a
Conventional Commit message when the checks pass; do not push.
