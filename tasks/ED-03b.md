# ED-03b: Foamers walk round hazards

Written 2026-11-13. ED-03 (merged) put hazard prims in the game: a lava
pool or a toxic lake hurts and slows whoever stands in it. Foamers path on
the nav grid (`src/ai/nav-grid.ts`), which is baked from the physics
world; a hazard has no collider, so the grid sees open floor and Foamers
walk straight in. design/EDITOR.md section 7: "Foamers walk round
hazards; one knocked into one takes its damage." A short card.

```
ID:          ED-03b
Owner:       Pi (strata-dsv41 on dgx-spark, thinking medium)
Reviewer:    Claude Opus 5.5
Branch:      ed-03b, in its own worktree
```

**Your files:** `src/ai/level.ts`, `src/ai/nav-grid.ts` (only if the hook
needs it), `src/level/hazards.ts`, new tests in `tests/ai/` or
`tests/level/`. Do NOT touch anything else; the reviewer wires the page.

## Read first

`src/ai/nav-grid.ts` (the bake, `setSolidAt`, `rebake`), `src/ai/level.ts`
(`makeLevelAI` and `solidAt`), `src/level/hazards.ts`,
`src/level/prim-geometry.ts` (`primContains`).

## What to build

1. `Hazards.blocksAt(x, y, z): boolean`: true when the point is inside a
   shown hazard with `dps > 0` that hurts Foamers (`hurtsFoamers` not
   false). A slow-only goo with no damage does not block. No allocation.
2. `makeLevelAI` takes an optional extra test (say `blockedAt`) and the
   grid's solid test becomes "voxel solid OR blocked", so a cell over a
   hazard bakes with no walkable layer. Keep the voxel-only behaviour the
   same when no extra test is given.
3. `Hazards.setShown` reports the shown hazard's world rectangle (its
   bounds after rotation) through an optional callback set by the page
   (say `onChanged(minX, minZ, maxX, maxZ)`), so the page can call
   `carveChanged` to rebake that rectangle.

## Done when

- Tests: a grid baked over a floor with a lava box in the middle has no
  walkable cells inside the box and walkable cells round it; a goo with
  dps 0 blocks nothing; a hidden hazard blocks nothing and, once shown,
  `onChanged` gives its rectangle; with no extra test the bake is as
  before (an existing nav test still passes unchanged).
- `npm run check` passes.
- PLAN.md: an ED-03b row in section 12. HANDOFF.md: a dated entry
  directly under `## Log`.

## Rules

No em dashes anywhere (`node tools/check-no-em-dash.mjs`). Numbers in
`data/`. Commit on `ed-03b` (include `tasks/ED-03b.md`); do not push.
