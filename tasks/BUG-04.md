# BUG-04: parryNext() lands nearly every parry in the Pit

Written 2026-11-06 (overnight), from the BUG-02 review. BUG-02 timed the
watch helper by the ball's real arc, and its own test (one ball, one
thrower, the range's rig) parries. In the Pit it does not hold up:
against wave 2's Roamers, facing the nearest thrower, the disc lowered
with `block(false)` and 30 steps between tries, `parryNext()` gave 2
parries in 10 (6 blocks, 2 hits). The old helper gave 0.

The window is generous: `parry.window` 0.25 s, `parryNextLead` 0.1 s,
`block.raiseTime` 0.12 s, and `canParry()` wants `raise >= 0.5` and
`raiseAge <= window`. A timing error of a few hundredths of a second
cannot explain 2 in 10, so the cause is not known yet. Candidates, none
checked: the ball that arrives is not the one the helper timed (several
Roamers throw); the hit is judged on another collider (the disc, the
ring geometry) before the capsule; `raiseAge` counts from a different
moment than the helper assumes; the hit-stop or the shield's `slowed`
step changes the ball's time; the player's own movement (pushed by an
F01) moves the capsule after the time was taken.

```
ID:          BUG-04
Title:       Find why parryNext() parries 2 balls in 10 in the Pit and fix
             the helper so it parries at least 9 in 10 there; it also
             lowers the disc after its try
Owner:       Pi (Qwen 3.8-27B, qwen-machine, 1cat config, thinking low)
Reviewer:    Claude Opus 5.5
Depends on:  BUG-02, BUG-03 (done)
Branch:      bug-04, in its own worktree
```

**Running at the same time:** GAME-10e (DeepSeek: the F04 Blocker, in
`src/foamers/`, `src/ai/`, `data/foamers.json`) and LVL-02d (the Spark:
`src/ai/nav-grid.ts`, `data/levels/`, `src/level/`). Your files are
`src/foamers/ball-time.ts`, the `parryNext` helpers in
`src/game/game.ts` and `src/range/main.ts`, and tests. Do not change the
shield's parry rules or numbers (`src/player/shield.ts`, `data/shield.json`):
if the cause is there, stop and write it up in HANDOFF instead.

## Read first

1. `CLAUDE.md`; `tasks/BUG-02.md` and both BUG-02 entries in HANDOFF
2. `src/foamers/ball-time.ts`, `tests/shield/parry-next.test.ts`
3. `src/player/shield.ts` (`canParry`, `raise`, `raiseAge`, `forcedHold`,
   `slowed`, `blocksAttackFrom`), `src/foamers/projectiles.ts` (how a
   ball hits the player and what the page's `onHitPlayer` does),
   `src/game/game.ts` (`fixedStep`, the projectile and shield order,
   `parryNext`)
4. `tests/level/` (how the Pit is built headless, as BUG-03's tests do)

## What to build

- **Reproduce first, headless:** a test that builds the Pit the way the
  page does, puts the player where a Roamer can throw at it, spawns two
  F02s, and runs the helper's sequence (face the thrower, `parryNext`,
  step, lower, step) for 10 balls, counting parries, blocks and hits.
  Record what it gives on the current code (expect few parries).
- **Find the cause:** instrument the run (which ball was timed, which ball
  arrived, its time against the estimate, `raise` and `raiseAge` at the
  hit, which collider it met). Write the cause in HANDOFF.
- **Fix the helper** so the same test parries at least 9 in 10. Keep the
  return value. After its try the helper lowers the disc again
  (`forcedHold` off once the timed ball has been parried, blocked or has
  missed), so a caller does not have to.
- The range's `parryNext` gets the same fix if the cause applies there.

## Done when

- The Pit test parries 9 or more in 10; the BUG-02 tests pass unchanged.
- `npx tsc --noEmit`, `npx vitest run`, `npm run build` pass; no em or en
  dashes.
- PLAN.md: a BUG-04 row beside BUG-03; the cause in section 14. HANDOFF:
  a dated entry at the top of the Log with the before and after counts,
  Status updated, and what was not checked by eye (the reviewer will run
  it in the browser).

## Not in this task

The parry window's length or feel, the shield, the Roamer's throw.
