# BUG-06: a ball meets the player's capsule from behind, so a parry reads as a hit

Written 2026-11-06, from BUG-04. BUG-04 (Qwen 27B) built a headless Pit
repro of the watch helper (`tests/shield/parry-pit.test.ts`, on branch
`bug-04`) and fixed the helper's aim (it now faces the timed ball's
thrower and lowers the disc after), but the Pit still gives 2 parries in
10. Its instrumented run gave a lead, not confirmed: ball 14 first comes
within a hit of the capsule 0.39 m in front of it, above the top, yet the
hit is judged with the ball at (0, 1.4, -8.6), behind the capsule centre
(z -8.0), with `from` at (0, 1.5, -8.1): 138 degrees off the view, so
`shield.blocksAttackFrom` says "from behind" and the player is hurt.

`ProjectileSystem.step` (`src/foamers/projectiles.ts`) moves the ball to
the ray's time of impact and `onHitPlayer` (`src/game/game.ts`) takes
`from` as 0.5 m back along the velocity, which is right on paper. So the
question is why the front of the capsule is not met. Candidates, none
checked: the ray passes over or through the capsule's front (its cast
starts inside the capsule, or the ball's radius is not in the ray); the
capsule collider lags a step behind the player (`setNextKinematicTranslation`
in `src/player/controller.ts` only moves it at the world step, so the
ray tests last step's capsule); the view (`shield.eye`) and the capsule
are not where each other assumes; a steep falling ball lands on the cap.

```
ID:          BUG-06
Title:       Find why a ball in the Pit meets the player's capsule from
             behind and fix it, so BUG-04's Pit test parries 9 in 10
Owner:       Pi (DeepSeek V4.1 Flash, openrouter deepseek/deepseek-v4.1-flash-1017)
Reviewer:    Claude Opus 5.5
Depends on:  BUG-04 (branch, work in progress)
Branch:      bug-06, from bug-04, in its own worktree
```

**Running at the same time:** LVL-02d (DeepSeek: `src/ai/nav-grid.ts`,
`data/ai.json` `nav`, `data/levels/`, `src/level/`, `src/arena/`). Your
files are `src/foamers/projectiles.ts`, `src/foamers/ball-time.ts`, the
`onHitPlayer` and `parryNext` parts of `src/game/game.ts` and
`src/range/main.ts`, the player capsule's sync in
`src/player/controller.ts` if that is the cause, and tests. Do not change
the shield's parry rules or numbers (`src/player/shield.ts`,
`data/shield.json`): if the cause is there, stop and write it up.

## Read first

1. `CLAUDE.md`; the BUG-04 entry at the top of the HANDOFF Log; this card
2. `tests/shield/parry-pit.test.ts` (the repro and its logging)
3. `src/foamers/projectiles.ts` lines 165 to 260 (the step and its ray),
   `src/game/game.ts` `onHitPlayer` (about line 420) and `fixedStep`
   (about line 500: the order of player, projectiles, world step)
4. `src/player/controller.ts` (how the capsule body moves),
   `src/player/shield.ts` `blocksAttackFrom` (about line 397)

## What to build

- **Find the cause:** log for each ball in the Pit test the capsule's
  collider position against the player's own position at the ray, the
  ray's origin and hit point, and `from` against the eye. Write the cause
  in HANDOFF with the numbers.
- **Fix it** where it is, the smallest change. The Pit test's stage 2
  then gives 9 or more parries in 10. The BUG-02 test
  (`tests/shield/parry-next.test.ts`) and every other test pass.
- If the fix is in the game's hit judging (not only the helper), say in
  HANDOFF what it changes for a player by hand (the parry and the block
  may get easier from the side).

## Done when

- `npx tsc --noEmit`, `npx vitest run`, `npm run build` pass; no em or en
  dashes.
- PLAN.md: a BUG-06 row under BUG-05; the cause in section 14. HANDOFF:
  a dated entry at the top of the Log, before and after counts, Status,
  and what was not checked by eye.

## Not in this task

The parry window's length or feel, the shield's numbers, the Roamer's
throw.
