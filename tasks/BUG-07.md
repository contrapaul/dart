# BUG-07: a Roamer throws when its ball cannot reach the player

Written 2026-11-06, from the BUG-06 and LVL-02d reviews. A Roamer (F02)
throws whenever its brain has a ranged token and the player is within
range. Its sight check (`FoamerSystem.lineOfSight`, `src/foamers/foamers.ts`
about line 1114) is one straight ray from its chest to the player's eye,
but the ball leaves from its ball hand on an arc
(`ProjectileSystem.launch`, `src/foamers/projectiles.ts` about line 124:
aimed at the eye with a loft under `BALL.gravity`). Seen in the browser:

- **The Pit, wave 2:** a Roamer at (-6.5, 0, 5.8), player at (0, 0, 1.2):
  8 of 10 balls burst on the level trimesh 1.7 m from its hand at y 2.6,
  and never reached the player. Its chest ray was clear.
- **Level 1-2 tower:** two Roamers on floor 2 (y 5) keep their windup and
  strike cycle while the player stands on the ground floor under the
  slab; nothing lands. (Check whether these throws launch at all: the
  release has a `dy < 2` gate.)

A thrown ball that cannot arrive wastes the fight: the player sees a
Foamer throwing at a wall, and the ranged token sits with it.

```
ID:          BUG-07
Title:       A Roamer throws only when its ball's flight to the player is
             clear; when it is not, it moves to where it is
Owner:       Pi (DeepSeek V4.1 Flash, openrouter deepseek/deepseek-v4.1-flash-1017)
Reviewer:    Claude Opus 5.5
Depends on:  BUG-06, LVL-02d (done)
Branch:      bug-07, in its own worktree
```

Your files: `src/foamers/foamers.ts` (sight, the throw's start and
release), `src/foamers/projectiles.ts` (a helper for the ball's flight;
do not change how a ball flies or hits), `src/ai/f02-brain.ts`,
`src/ai/agent.ts` if the token must be given back, `data/foamers.json`
and `data/ai.json` for any new numbers, and tests. Do not change the
shield, the parry, the nav grid or the levels. F04's volley uses the
same release: it must still throw over its shield wall (its own tests
pass unchanged).

## Read first

1. `CLAUDE.md`; this card; the BUG-06 and LVL-02d review entries in
   HANDOFF
2. `src/foamers/projectiles.ts` `launch` (about lines 120 to 165) and the
   step's ray (about lines 165 to 215)
3. `src/foamers/foamers.ts` `lineOfSight` (about 1114), the windup and
   release (about 700 to 770), where the F02 input is filled (about 950
   to 990)
4. `src/ai/f02-brain.ts` (the four states), `tests/ai/` F02 tests,
   `tests/level/` (how the Pit and Level 1-2 are built headless)

## What to build

- **Reproduce headless:** the Pit as the page builds it, a Roamer at
  (-6.5, 0, 5.8) and the player at (0, 0, 1.2), counting balls thrown,
  balls that reach the capsule, and balls that burst elsewhere. Record
  the counts before the fix (expect most to burst).
- **A clear-flight check:** sample the ball's arc from the hand to the
  player (the launch's own velocity and gravity, a few segments, the
  ball's radius) against the world, with the same filters the ball's own
  ray uses. Cheap: it runs at most once per windup start or release, not
  every step for every Foamer (say the cost in HANDOFF).
- **Use it:** a Roamer with a token and no clear flight does not start a
  throw. It gives the token back and moves (sidle along its ring, or
  path closer) until it has one; it must not freeze. Decide whether the
  check goes at the windup's start, at the release, or both, and say why
  in PLAN section 14.
- **After the fix:** in the same Pit setup, at least 8 of 10 thrown balls
  reach the player's capsule (blocked, parried or hit all count), and
  the Roamer still throws at least 6 times in 30 s. In Level 1-2's tower
  first fight with the player on the ground floor, no throws into the
  slab; with the player on floor 2 they still hit (both headless).

## Done when

- The tests above pass; every existing test passes unchanged (F04's
  volley included); `npx tsc --noEmit`, `npx vitest run`,
  `npm run build` pass; no em or en dashes.
- PLAN.md: a BUG-07 row under BUG-06; decisions in section 14. HANDOFF:
  a dated entry at the top of the Log with the before and after counts,
  Status updated, and what was not checked by eye.

## Not in this task

The ball's flight, damage or speed; the parry; F04's wall slots; level
geometry.
