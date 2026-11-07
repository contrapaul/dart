# ENV-01: foam cladding and toy crate stacks (E01, E02)

Written 2026-11-07. ENV-00 proposed 13 environment elements
(`design/levels/ENVIRONMENT.md`); Paul answered its questions the same
day (section 0 of that file, PLAN.md section 14). This card builds the
first two: E01 foam cladding and E02 the toy crate stack. Both are
destructible pieces the voxel code already supports, so the work is
mostly data, a look and proof that they behave.

```
ID:          ENV-01
Title:       E01 foam cladding over a shell column, and E02 a stack of toy
             crates (a box with a thickened frame on every edge) that
             topples when its bottom crate is shot out, in a test level
Owner:       Pi (DeepSeek V4.1 Flash, openrouter, thinking high)
Reviewer:    Claude Opus 5.5
Depends on:  ENV-00 (done)
Branch:      env-01, in its own worktree
```

**Running at the same time:** GAME-10j (qwen-machine: the F10 Turbo in
`src/foamers/`, `src/ai/`, `data/foamers.json`, `data/foamer-rigs.json`).
Do not touch those. Your files: a new `data/levels/env-01.json`, one
line in `src/arena/levels.ts`, `src/voxel/` and `src/level/` only if a
test proves a change is needed, new tests in `tests/voxel/` or
`tests/level/`, `data/destruction.json` or `data/materials.json` for a
new number or colour.

## Read first

Read each once; write yourself a short note instead of rereading. Make
your first edit by your sixth reply.

1. `CLAUDE.md` (foam only, toy look, Paul writes names and looks)
2. `design/levels/ENVIRONMENT.md` sections 0, 1, E01 and E02
3. `design/levels/KIT.md` section 5 (destructibles, the 6 zone cap)
4. `src/level/format.ts` (`Piece`, `PieceVolume`, `Anchor`),
   `src/voxel/pieces.ts`, `src/voxel/islands.ts`
5. `data/levels/1-4.json`: the hall's three voxel foam columns are the
   nearest thing to cladding that exists; copy its shape of a piece

## What to build

Two stages, each committed on its own and each leaving the game working.

**Stage 1: the test level and E01 cladding.**
- `data/levels/env-01.json`: one plain lit room, about 16 x 16 m, a
  player start, an exit box, no arena lock. Register it in
  `src/arena/levels.ts` as `"env-01"` so `arena.html?level=env-01`
  loads it.
- **Cladding:** one shell column (indestructible, a `shell` box) 0.8 x
  3 x 0.8 m, with a foam coat 0.3 m thick on all four sides as voxel
  pieces, `kind: "cover"`. The coat is a different, softer colour than
  the shell. Shooting the coat away leaves the shell column standing.
  Count the zones against the KIT 5 cap and say the count in HANDOFF.

**Stage 2: E02 the crate stack.**
- **Look (Paul):** a crate is a box with a thickened frame on all edges.
  Build it as voxel volumes: a 0.6 m box with the 12 edges as bars
  0.08 m proud of the faces, in a second colour. Find out whether one
  crate is one piece made of several volumes or several pieces, and pick
  the one where a shot crate breaks as one crate.
- **Stack:** three crates, two on the floor side by side and one on top,
  about 1.2 m high (KIT 5: low enough to mantle). Shooting out a bottom
  crate makes the top one fall as a loose foam piece (the islands path).
  If the top crate does not fall, stop and write down why in HANDOFF;
  do not build a new physics path.
- Two stacks in the room, one near the column.

## Done when

- Tests in new files: the level loads and its pieces fit the zone cap;
  carving the full coat off one side leaves the shell column's collider
  in place; removing a bottom crate leaves the top crate with no anchor
  (an island); every other level's tests unchanged.
- `npx tsc --noEmit`, `npx vitest run`, `npm run build` pass; no em or en
  dashes (check with perl).
- PLAN.md: an ENV-01 row under the ENV-00 row; decisions in section 14.
  HANDOFF: a dated entry at the top of the Log (directly under `## Log`),
  Status updated, and what you could not check by eye (you cannot see
  the page: say so).
- Every commit message ends with a blank line, then:
  `Co-Authored-By: DeepSeek V4.1 Flash <noreply@deepseek.com>`

## Not in this task

Placing cladding or crates in real levels, a crate print, sounds, the
button, stations, hazards.
