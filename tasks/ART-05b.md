# ART-05b: reload tilts, B07's reload drum and the B02 heavy mod's motion

Written 2026-11-08. The rest of the "Motion (for ART-05)" sections in the
approved blaster briefs that the viewmodel does not do yet, after ART-05a
(B02 slide, B05 bolt, B06 handle) and GAME-09f (B07's drum per shot).

```
ID:          ART-05b
Title:       Reload tilts for B02 and B04, B07's drum turning as it
             reloads, and a mod's own motion numbers (B02 heavy)
Owner:       Pi (Qwen 3.8 Flash Next, dgx-spark, thinking medium)
Reviewer:    Claude Opus 5.5
Depends on:  ART-05a (merged)
Branch:      art-05b, in its own worktree
```

**Running at the same time:** GAME-10l (qwen-machine: the F13 Foamer in
`src/foamers/` and `data/foamers.json`). Do not touch those. Your files:
`src/weapons/viewmodel.ts`, `src/weapons/blaster.ts` (`MotionSpec`,
`RawMod` and `resolveSpec` only), the `motion` blocks and the B02 `heavy`
mod line in `data/blasters.json` (edit those lines by hand: never rewrite
the file through a JSON dump, it must keep its compact one-line layout),
and one new test file `tests/weapons/art-05b.test.ts`.

## Read first

Read each once; write yourself a short note. First edit by your sixth
reply.

1. `CLAUDE.md`
2. The "Motion (for ART-05)" sections of `design/blasters/B02.md`,
   `design/blasters/B04.md` and `design/blasters/B07.md`
3. `src/weapons/viewmodel.ts`: the root placement (kick, tilt, dip), the
   pump branch (B07's drum), `applySlide`, `applyMagDrop`
4. `src/weapons/blaster.ts`: `resolveSpec` (how a mod's `recoil` block
   merges key by key), the reload (what `progress` is while reloading)
5. `tests/weapons/art-05a.test.ts` (how a viewmodel motion is tested on a
   tree of named nodes without loading a glb)

## What to build

All numbers in `motion` in data, start values for Paul to tune.

- **Reload tilt:** a new `reloadRollDeg` field. While the blaster is
  reloading, the whole viewmodel rolls about its forward axis by
  `reloadRollDeg * sin(progress * pi)`, so it eases over and back. B02
  rolls right (start 8), B04 left (start 8, the other sign). Positive is
  to the right as the player sees it; check the sign with a test on the
  root's rotation and say in HANDOFF which way you found it.
- **B07's reload drum:** while B07 reloads, its `drum` node turns one
  chamber (`drumStepDeg`) for each round that goes in, spread evenly
  across the reload, so the drum ends on a chamber, never between. The
  per-shot turn (GAME-09f) is unchanged.
- **A mod's own motion:** a mod may carry a `motion` block whose keys
  override the blaster's, key by key, as `recoil` already does. B02's
  `heavy` mod gets a bigger kick (start 0.035) and a slower slide return
  (start 0.18).
- A blaster without the field is untouched (B01, B03, B05, B06 must not
  change).

## Done when

- Tests in `tests/weapons/art-05b.test.ts`: B02 and B04 roll opposite
  ways at mid reload and are back at rest after it; B07's drum has turned
  one chamber per round loaded when the reload ends and sits on a chamber
  part way through; `resolveSpec("B02", ["heavy"])` reads the heavy
  motion and plain B02 does not; B01, B03, B05, B06 viewmodel motion and
  the ART-05a and GAME-09f tests unchanged.
- `npx tsc --noEmit`, `npx vitest run`, `npm run build` pass; no dashes.
- PLAN.md: an ART-05b row after ART-05a. HANDOFF: a dated entry at the
  top of the Log (directly under `## Log`), with what was not checked by
  eye.

## Not in this task

Shell ejection, sounds, models, levels, any blaster's fire numbers.
