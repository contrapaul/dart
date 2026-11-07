# ART-05a: the slide, bolt and cocking-handle motions for B02, B05 and B06

Written 2026-11-08. The approved models have moving nodes the viewmodel
never moves: B02's `slide`, B05's `bolt` and B06's `bolt` (its cocking
handle). Each blaster's design brief has a "Motion (for ART-05)" section;
this card does those three motions and nothing else. The B07 drum and the
B01 pump already move (`src/weapons/viewmodel.ts`), so copy their pattern.

```
ID:          ART-05a
Title:       Viewmodel motion for B02's slide, B05's bolt and B06's
             cocking handle
Owner:       Pi (Qwen 3.8 Flash Next, dgx-spark, thinking medium)
Reviewer:    Claude Opus 5.5
Depends on:  GAME-09c, GAME-09d, GAME-09e (merged)
Branch:      art-05a, in its own worktree
```

**Running at the same time:** GAME-10l (qwen-machine: the F13 Foamer in
`src/foamers/` and `data/foamers.json`). Do not touch those. Your files:
`src/weapons/viewmodel.ts`, the `motion` blocks of B02, B05 and B06 in
`data/blasters.json` (edit those lines by hand: never rewrite the file
through a JSON dump, it must keep its compact one-line layout), the
`MotionSpec` interface in `src/weapons/blaster.ts` for the new fields, and
one new test file `tests/weapons/art-05a.test.ts`.

## Read first

Read each once; write yourself a short note. First edit by your sixth
reply.

1. `CLAUDE.md`
2. The "Motion (for ART-05)" sections of `design/blasters/B02.md`,
   `design/blasters/B05.md` and `design/blasters/B06.md`
3. `src/weapons/viewmodel.ts`: `hookShot`, the pump branch of the
   per-frame motion (the pump offset and the B07 drum), `applyMagDrop`
4. `tests/weapons/b07.test.ts` test 10 (how a viewmodel motion is tested
   on a tree of named nodes without loading a glb)

## Facts you need

- None of the three nodes has a rest rotation in its glb, so back
  (toward the grip) is local +Z for each, as for B01's pump. Positions
  are read from `restP`, rotations from `restQ`.
- B02 is mode `semi` (its `burst` mod is mode `burst`). B05 is mode
  `pump`, `primeTime` 0.9: its priming is the bolt cycle. B06 is mode
  `auto`; its reload is 2.4 s.
- B05 has no `pump` node, so its `pumpTravel` moves nothing today.

## What to build

All numbers in `motion` in data, start values for Paul to tune.

- **B02 slide:** on each shot (`hookShot`) the `slide` node snaps back
  `slideTravel` (start 0.025 m) along local +Z and returns within
  `slideReturn` seconds (start 0.1). Each shot of a burst kicks it again.
- **B05 bolt:** across the priming (`blaster.progress` 0 to 1) the `bolt`
  node lifts `boltLiftDeg` (start 60) about its local Z, slides back
  `boltTravel` (start 0.05 m) along local +Z, comes forward and drops
  again: lift over 0 to 0.2, back over 0.2 to 0.5, forward over 0.5 to
  0.8, down over 0.8 to 1.0. Outside priming it sits at rest. The same
  bolt cycle plays at the end of a reload if the blaster primes then.
- **B06 cocking handle:** during the reload (`blaster.progress` 0 to 1)
  the `bolt` node goes back `boltTravel` (start 0.04 m) along local +Z
  over 0 to 0.15, holds, and returns over 0.85 to 1.0. Outside the reload
  it sits at rest.
- A blaster without the node, or without the field in `motion`, is
  untouched (B01, B03, B04, B07 must not change).

## Done when

- Tests in `tests/weapons/art-05a.test.ts`: the B02 slide is back by
  about `slideTravel` just after a shot and at rest after `slideReturn`;
  the B05 bolt is lifted at progress 0.1, back by `boltTravel` at 0.5 and
  at rest after priming; the B06 handle is back during a reload and at
  rest after it; B01's pump and B07's drum tests unchanged.
- `npx tsc --noEmit`, `npx vitest run`, `npm run build` pass; no dashes.
- PLAN.md: an ART-05a row after the ART-05 row. HANDOFF: a dated entry at
  the top of the Log (directly under `## Log`), with what was not checked
  by eye.

## Not in this task

Any other blaster's motion, the heavy mod's slower slide, reload tilts,
sounds, models, levels.
