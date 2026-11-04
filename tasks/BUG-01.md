# BUG-01: Foamers freeze in the Pit

Written 2026-11-04 from the GAME-04 stage 2 review. Seen on
`arena.html?watch` (the Pit, `data/levels/1-1-pit.json`), wave 2.

```
ID:          BUG-01
Title:       Foamers stall in approach in the Pit: under the ring overhang,
             and against the side of the south ramp
Owner:       Pi (to assign)
Reviewer:    Claude Opus 5.5
Depends on:  ENG-08, LVL-01, GAME-10a, GAME-10b (done)
Branch:      bug-01, in its own worktree
```

## What was seen

1. **Overhang.** The nav grid (`src/ai/nav-grid.ts`) keeps one ground
   height per cell. The Pit's ring (`ring-s`, `ring-n`) is a box 3 to 4 m
   above the pit floor, so the floor under it bakes as the ring top. A
   player standing under the overhang (z between -13 and -9) is pathed to
   as if 4 m up: Foamers head for the ramps and stand still.
2. **Ramp side.** With the player on open floor at (0, 0, -4), all four
   wave 2 Foamers (2 F01, 2 F02) stood still in `approach` for over 30 s
   at x about -9.2 to -9.8, z about -1.5 to -2.6, against the side of
   `ramp-s` (x -16 to -10, z -9 to -1). Their paths had 2 or 3 points
   and they did not move over 120 steps. The F02s, inside 12 m and in
   sight with ranged tokens, never threw.
3. Spark's note from GAME-10a: an F01 walking straight down the exact
   x = 0 grid line can stall. May be the same family.

## What to do

- Reproduce each with a test on the real Pit file (bake the grid, place
  the player, spawn Foamers where they stalled, step, assert they reach
  the player or their hold ring).
- Fix the cause, not the symptom. Likely candidates: a grid cell's height
  read from the top of a box that has open space under it (bake the
  lowest walkable surface the player could stand on, or the one nearest
  the previous cell's height); path points on a step edge the character
  controller cannot climb (the ramp's side is a wall, not a slope); the
  steering pushing into a wall with no slide.
- A stuck Foamer must never stand still for more than a second or two:
  if its progress along the path stalls, re-path or sidestep.
- Watch helpers: nothing new needed; `state()` and the dev hook
  (`__arena.foamers`) show it.

## Done when

- Tests for 1 and 2 fail before and pass after; the existing nav and AI
  tests pass.
- In `arena.html?watch`, standing under the ring and standing at
  (0, 0, -4), Foamers reach the player and the Roamers throw.
- `npx tsc --noEmit`, `npx vitest run`, `npm run build` pass; no em or en
  dashes. PLAN and HANDOFF updated.
