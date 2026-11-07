# BUG-12: wall and ceiling anchors hold nothing, and a released piece can sleep in the air

Written 2026-11-07 from two findings in the ENV-01 review (HANDOFF,
2026-11-07, "ENV-01 review" and "ENV-01 stage 3 review").

```
ID:          BUG-12
Title:       Make a wall or ceiling anchored piece anchored, and wake a
             falling piece whose source finished remeshing after it was
             let go
Owner:       Pi (Qwen 3.8 Flash Next, dgx-spark, thinking medium)
Reviewer:    Claude Opus 5.5
Depends on:  ENV-01 (done)
Branch:      bug-12, in its own worktree
```

**Running at the same time:** ENV-03 (qwen-machine: the mod station in
`src/arena/`, `src/level/format.ts`, `src/level/validate.ts`,
`src/weapons/`). Your files: `src/level/build.ts` (`fillPieces` only),
`src/voxel/pieces.ts`, `src/voxel/islands.ts` if a test proves it needs
it, new tests in `tests/voxel/` or `tests/level/`, and the three level
files below only if stage 1 says so.

## Read first

Read each once; write yourself a short note. First edit by your sixth
reply.

1. `CLAUDE.md`
2. `src/level/build.ts` `fillPieces`, `src/voxel/islands.ts`,
   `src/voxel/pieces.ts` (the hold and release in `update`),
   `data/destruction.json` (`islands`)
3. `design/levels/KIT.md` section 5 (destructibles, anchors)

## The two bugs

**1. Wall and ceiling anchors.** `fillPieces` writes a bedrock row only
for `anchor: "floor"`. A piece anchored to a wall or a ceiling has no
indestructible voxel, so `findIslands` cannot find an anchor: a piece
under `islands.maxSearchVoxels` (6000) drops whole on its first carve,
and a bigger one stays up only because the search runs out of budget.
Three pieces in real levels are affected, each under 6000 voxels:
`store-window` (cover, wall, 1-2), `tower-plug` (plug, ceiling, 1-2) and
`pit-island` (island, wall, 1-4).

**2. A released piece sleeping on old colliders.** A new falling piece is
held still until its source volume has remeshed, or for at most
`islands.maxHoldTime` (0.5 s). If the remesh takes longer, the piece is
let go while the old chunk colliders are still under it: it settles on
them, Rapier puts it to sleep, and nothing wakes it when they go. It
floats. (Seen in the ENV-01 review with the render frame stopped; on a
slow machine a long remesh would do the same in play.)

## What to build

**Stage 1: anchors.** A wall anchor makes bedrock of the piece's voxel
layer that touches a shell box; a ceiling anchor makes bedrock of the
piece's top row (the mirror of the floor row). Keep the floor rule as it
is. Then, for each of the three pieces, read its level card
(`tasks/LVL-02*.md`, `tasks/LVL-04*.md`) and its `_note`, and write in
HANDOFF what the level meant it to do and whether it now does. If a
level meant a piece to drop whole on the first hit (a plug you shoot
open, say), do not keep that by accident: say so in HANDOFF and leave
the file alone for the reviewer.

**Stage 2: the sleeping piece.** When a held piece is released while its
source is still busy, wake its body once the source finishes remeshing
(for example a flag set at release, checked each update). No other
change to the hold.

## Done when

- Tests: a small wall anchored piece keeps its uncarved part after a
  carve that leaves it touching the wall; the same for a ceiling piece;
  a part cut off from the wall still falls; a floor piece behaves as
  before; a piece released while the source is busy falls once the
  source finishes; every other test unchanged.
- `npx tsc --noEmit`, `npx vitest run`, `npm run build` pass; no dashes.
- PLAN.md: a BUG-12 row after BUG-11; decisions in section 14. HANDOFF:
  a dated entry at the top of the Log (directly under `## Log`).

## Not in this task

New anchor kinds, the island search budget, level layouts.
