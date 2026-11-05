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

## Round 2 (review 2026-11-05, Claude)

Round 1 is on the branch (3 commits). Keep the clump fix (the walk ignores
other Foamers' bodies) and the stall guard. Tests, tsc and build pass. The
nav bake change is not mergeable as it is:

**R1. The ring's top is gone from the grid.** `ring-s` and `ring-n` are
34 x 1 x 4 m slabs at y 3 to 4 with open floor under their whole length, so
"lowest surface wins" bakes every ring cell as pit floor (`groundAt(0, -11)`
is 0 on the branch, 4 on main). The ring is where the player enters the
Pit. A player standing on the ring at (0, 4, -11) now draws an F01 from
(0, 0, 0) to stand under the slab at (0, 0, -9.7) and go into `strike` 4 m
below the player (the `dy < 2` check stops the damage). That is the
original bug turned upside down.

Fix: keep every candidate the round 1 filter accepts (walkable slope, not
swallowed by a surface within maxStep above, capsule clear), up to
`nav.maxLayers` per cell (2, in `data/ai.json`). The previous two-level
attempt broke 12 tests because it tried a spacing rule; the round 1 filter
already tells a step (swallowed) and a wall (capsule blocked) from an
overhang, so reuse it. Then:
- A* nodes are (cell, layer). A neighbour links to the layer whose height is
  within maxStep of the current layer (at most one, the nearest).
- Lookups take a height: `groundAt(x, z, y?)` and `walkableAt(x, z, y?)` pick
  the layer nearest y (no y: the lowest, so existing callers and tests keep
  working). `findPath` takes the agent's and the goal's feet height (the
  player's feet, not the eye) and starts and ends on the nearest layer.
  `lineClear` and the string pull walk the layer they start on.
- `rebake` keeps working per region; the nav timing test must still pass.
- Keep the bake allocation-free in the loop (the hits array pushes a new
  object per hit; reuse preallocated slots).

**R2. The ramp-side stall is not fixed, only hidden.** On main, an F01 sent
from (0, 0, 0) to a player on the ring at (0, 4, -11) walks to (-9.8, 0,
-2.1), beside the east side of `ramp-s` near its foot, and stands in
`approach` from second 15 on: the card's spot 2. Round 1's ramp-side test
passes because its player is on open floor, so no path goes up the ramp.
Find the cause (likely: the string pull or `lineClear` lets a segment cross
the ramp's side edge, where the ramp is already taller than maxStep between
two samples, or the A* step check is per cell while the controller meets the
side as a wall). Fix it in the grid, not with the sidestep.

**R3. Stall guard details** (`src/foamers/foamers.ts`):
- Delete a Foamer's `progress` entry when it is not walking a path, so a
  Foamer that held still on its ring does not sidestep the moment it walks
  again; and delete it in `removeFoamer` (the map holds dead Foamers now).
- Build the set of every Foamer body once per `update`, not the `others` set
  once per Foamer (that is n squared times parts per frame); the walk filter
  is "not own and not in the all set" or equivalent.

### Round 2 done when

- New test in `tests/ai/pit-foamers.test.ts`: the player's feet on ring-s
  at (0, 4, -11), an F01 from (0, 0, 0), within 25 s it is within 1.6 m of
  the player in 3D (or in attack on the ring). Fails on round 1 and on main.
- New test: `groundAt(0, -11, 4)` is 4 and `groundAt(0, -11, 0)` is 0, both
  walkable.
- The round 1 tests, nav, AI, step, ledge, slope and wall tests all pass
  unchanged. The ramp-side test also passes with the player on the ring.
- `npx tsc --noEmit`, `npx vitest run`, `npm run build` pass; no em or en
  dashes. PLAN row, PLAN section 14 decision (replace round 1's bake
  decision) and a HANDOFF entry updated.
