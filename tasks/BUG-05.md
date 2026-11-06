# BUG-05: Swarmers end up outside the arena and stand still

Written 2026-11-06 (overnight), from the BUG-03 review. In the Pit, a
Swarmer pack placed by hand beside the central block (`spawnPack` at
(0, 0, 7.5)) while the player walked to the trigger: within about two
seconds four of the five Swarmers stood on the ring level at z -13.9,
just outside the `pit-in` door (z -13.5, which locks when the arena
locks), in `approach`, with an empty agent path, and stayed there for
10 s while the player stood inside the arena at (0, 1.2). The nav grid
has paths from there down into the pit (checked with `findPath`), so the
grid is not why. How they got there that fast (about 21 m in 2 s, at a
run speed of 4.5 m/s) is not known.

```
ID:          BUG-05
Title:       Find how a Swarmer pack reaches the outside of a locked arena
             door so fast and why it then stands with no path; fix both
Owner:       Pi (DeepSeek V4.1 Flash, openrouter deepseek/deepseek-v4.1-flash-1017)
Reviewer:    Claude Opus 5.5
Depends on:  GAME-10d, BUG-02, BUG-03 (done)
Branch:      bug-05, in its own worktree
```

**Running at the same time:** BUG-04 (Qwen 27B: `src/foamers/ball-time.ts`
and the `parryNext` helpers) and LVL-02d (the Spark: `src/ai/nav-grid.ts`,
`data/ai.json` `nav`, `data/levels/`, `src/level/`). Your files are
`src/ai/f03-brain.ts`, `src/ai/agent.ts`, the Swarmer and pack parts of
`src/foamers/foamers.ts`, and tests. Do not edit the nav grid or levels.

## Read first

1. `CLAUDE.md`; the BUG-03 review entry in HANDOFF; `tasks/GAME-10d.md`
2. `src/ai/f03-brain.ts`, `src/ai/agent.ts` (how a path is asked for and
   followed, `repathIn`, what happens when a path comes back empty)
3. `src/foamers/foamers.ts` (`spawnPack`, how a Swarmer is moved: its
   speed, the circle on the ring, any push or teleport), `data/ai.json`
   `pack`, `data/foamers.json` F03
4. `tests/level/` (how the Pit is built headless, as BUG-03's tests do)

Read each file once, with short ranges; start editing by your sixth reply.

## What to build

- **Reproduce headless:** the Pit built the way the page builds it
  (BUG-03's tests show how), a pack spawned at (0, 0, 7.5), the player
  moved to the trigger (0, 0, -6) for one second and then to (0, 0, 1.2).
  Record each Swarmer's position, state and path every 0.25 s for 12 s.
- **Find the cause** of the fast trip and of the standing still, and
  write it in HANDOFF (for example: the ring circle's target is outside
  the walls, a collider push, a path to the wrong layer, an empty path
  never retried).
- **Fix** so that in the same run no Swarmer leaves the pit through the
  door and every one reaches the player within 12 s. F01, F02, F04, F05
  tests unchanged.

## Done when

- The reproduction is a test that passes after the fix (and say what it
  gave before).
- `npx tsc --noEmit`, `npx vitest run`, `npm run build` pass; no em or en
  dashes.
- PLAN.md: a BUG-05 row beside BUG-04; the cause in section 14. HANDOFF:
  a dated entry at the top of the Log, Status updated, and what was not
  checked by eye.

## Not in this task

The nav grid, the level, the Swarmer's look or numbers beyond what the
fix needs.
