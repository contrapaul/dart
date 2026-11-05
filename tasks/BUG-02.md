# BUG-02: the parry watch helper lands parries; packs spawn on walkable floor

Written 2026-11-06 (overnight). Two small faults found in reviews.

1. `parryNext()`, the watch helper in `src/game/game.ts`, does not land a
   parry. HANDOFF (GAME-06 and GAME-04b reviews): six tries against a lone
   F02 gave 0 parries; the balls burst on the disc as blocks. The parry's
   own unit tests pass, so the shield is fine and the helper's timing is
   off. It estimates the time to impact as straight-line distance over
   speed, but a Roamer's ball is a lob under gravity
   (`src/foamers/projectiles.ts`, `BALL.gravity`), so the estimate is
   wrong by the arc, and it never checks when the ball actually reaches
   the disc.
2. `spawnPack()` in `src/foamers/foamers.ts` puts each Swarmer round a
   ring without asking whether the spot can be stood on. In the Pit a pack
   spawned near the central block put members inside it, where they stayed
   stuck (GAME-10d review).

```
ID:          BUG-02
Title:       parryNext() raises the disc on the step that lands a parry
             against a lobbed ball; spawnPack() only uses walkable spots
Owner:       Pi (Qwen 3.8-27B, qwen-machine, 1cat config, thinking low)
Reviewer:    Claude Opus 5.5
Depends on:  GAME-04b, GAME-10d, OPS-02 (done)
Branch:      bug-02, in its own worktree
```

**Running at the same time:** GAME-09b (the Foamer hit and kill path in
`src/foamers/foamers.ts`, `data/blasters.json`, `data/foamers.json`) and
LVL-02c (`src/level/`, `src/arena/`, `data/levels/`). In `foamers.ts`
touch only `spawnPack`. In `game.ts` touch only the `parryNext` watch
helper. Do not change the shield's parry rules or numbers.

## Read first

1. `CLAUDE.md`
2. `src/player/shield.ts` (the parry window: `parryLead`,
   `parryNextLead`, `forcedHold`, how a raise turns into a parry or a
   block), `data/shield.json` (`parry`)
3. `src/foamers/projectiles.ts` (how a ball moves: `update`, gravity, the
   lob's launch), `data/foamers.json` (the ball numbers)
4. `src/game/game.ts`: `parryNext` and `fixedStep`; `src/range/main.ts`
   `parryNext` (the range's version)
5. `tests/shield/parry.test.ts`, `tests/foamers/projectiles.test.ts`, and the pack tests in `tests/foamers/`
6. `src/foamers/foamers.ts` `spawnPack`; `src/ai/nav-grid.ts`
   (`walkableAt`, `groundAt`); how `foamers.navGrid` is set

## What to build

- **The time to impact:** a small pure function (in `projectiles.ts` or
  a new `src/foamers/ball-time.ts`) that steps a copy of the ball's
  position and velocity forward with the same gravity and step as
  `update`, and returns the time until it first comes within the disc's
  reach of the player (use the shield's own distance for a block or a
  parry, whatever the shield checks), or Infinity if it never does within
  a few seconds. Unit tests: a straight ball and a lobbed ball, against
  the time the real `update` loop takes.
- **The helper:** `parryNext()` uses that time for the nearest incoming
  ball, steps until the ball is exactly the shield's parry lead away (the
  raise must land inside the parry window, not before it and not after),
  then holds the disc. Keep its return value. If the range's `parryNext`
  has the same fault, fix it the same way with the same function.
- **A test for the helper's timing** without a browser: a test that sets
  up the shield and a ball as the existing parry tests do, waits the way
  the helper does using the new function, raises, and asserts a parry
  (not a block). It must fail with the old distance over speed estimate
  for a lobbed ball (say so in HANDOFF if you could show it failing).
- **spawnPack:** with a nav grid, a member's ring spot is used only if
  `walkableAt` says so at the pack's height; otherwise try the same angle
  nearer the centre (a few steps in), then skip that member. Without a nav
  grid (the range, tests without one), behave as now. A skipped member is
  not spawned and not counted. Tests with a small grid that has a blocked
  area: no member lands in it; members still spawn round it.

## Done when

- The new tests pass; the existing shield, projectile and pack tests pass
  unchanged.
- `npx tsc --noEmit`, `npx vitest run`, `npm run build` pass; no em or en
  dashes.
- PLAN.md: a BUG-02 row in the bug list beside BUG-01; decisions in
  section 14. HANDOFF: a dated entry at the top of the Log, Status
  updated, and what was not checked by eye (that `parryNext()` lands
  parries in the browser: the reviewer will check).

## Not in this task

The parry window's length, the shield's feel, a Foamer spawn that is not
a pack, the Swarmer brain.
