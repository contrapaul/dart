# GAME-04 stage 1: the shield, block and throw

Written 2026-11-03. PLAN 3.2: "The Shield (decided): a foam disc buckler.
A big round foam-and-plastic disc worn on the arm. Blocks attacks, thrown
like a frisbee to stun and ricochet between Foamers, returns to the arm.
[Paul: name and look]". Parry needs parryable projectiles, which come with
the first ranged Foamer (F02, GAME-10), so it is stage 2. Charge is
GAME-05.

```
ID:          GAME-04 (stage 1)
Title:       The shield: hold to block from the front, throw to stun and
             ricochet between Foamers, return to the arm
Owner:       Pi (Qwen 3.8 Flash Next, DGX Spark)
Reviewer:    Claude Opus 5.5
Depends on:  ENG-13 (done), UI-01 (done)
Branch:      game-04, in its own worktree
```

## Read first

1. `CLAUDE.md` (every rule applies to you)
2. PLAN.md 3.2 (Dark Ages elements), 3.4, 10 (accessibility),
   `design/CONTENT-PLAN.md` the Shield rows (upgrades: parry window,
   throw damage, charge distance)
3. `src/game/game.ts` (the shared step, render, loop and watch helpers),
   `src/main.ts`, `src/arena/main.ts`
4. `src/player/controller.ts`, `src/player/health.ts`, `src/core/input.ts`
   and `data/input.json` (the `shield` action is already bound: right
   mouse, gamepad buttons 2 and 6)
5. `src/weapons/viewmodel*.ts` and `src/weapons/loadout.ts` (how the
   blaster viewmodel hangs off the camera), `src/foamers/foamers.ts`
   (`onBonk`, the stagger state and how a part hit staggers a Foamer)

## What to build

- `data/shield.json` for every number below; nothing tuned in code.
- **Look:** a placeholder disc on the left forearm in the factory palette
  (about 0.55 m across, foam rim, plastic boss), drawn with the blaster as
  a first person viewmodel, low left when lowered and raised across the
  view when blocking. Code-made, no model file. Name and final look are
  [Paul].
- **Block:** hold `shield`. The disc rises in about 0.12 s. While raised,
  a Foamer attack from within a front arc (about 120 degrees) does a
  share of its damage (start at 15%); outside the arc it hits as normal.
  Walk speed drops while raised (start at 0.6 times), no sprint, the
  blaster cannot fire. A sound on a block, a small view kick, and the HUD
  hit flash does not play for a blocked hit.
- **Throw:** press `fire` while the shield is raised. The disc flies
  straight from the left hand at about 25 m/s. On the first Foamer it
  meets it does a small damage, staggers it (the existing stagger state,
  for its own time from the data), then ricochets to the nearest other
  Foamer in sight within about 8 m, up to 2 more times, then flies back to
  the arm. On a wall or after its range (about 20 m) it comes straight
  back. While it is out the player cannot block. It carves a little foam
  where it hits voxel cover, with a capped number of debris.
- Both pages get it through `src/game/`, not a copy. The range gets a
  Shield section in its panel only if it is a few lines; otherwise skip.
- Watch helpers: `block(on)` and `throwShield()` in the shared set, and
  shield state (`lowered`, `raised`, `thrown`, `returning`) in `state()`.
- Sounds: placeholder IDs in `data/sounds.json` and `design/SOUNDS.md`
  (raise, block hit, throw, ricochet, catch).
- Accessibility: the Settings panel gets a "Shield: hold or toggle"
  choice, saved like the other settings.

## Done when

- Tests in `tests/shield/`: a hit from the front is reduced and one from
  behind is not; the throw picks the nearest Foamer in sight for each
  ricochet, never the same one twice in a row, at most 3 hits; the disc
  returns and blocking works again after the catch; walk speed while
  raised.
- `npx tsc --noEmit`, `npx vitest run`, `npm run build` pass; no em or
  en dashes.
- PLAN.md: the GAME-04 row points to this card (stage 1 done, parry
  stage 2 waits for GAME-10); decisions in section 14. HANDOFF: a dated
  entry at the top of the Log, status updated.

## Not in this task

Parry and bounce-back (stage 2), the shield charge (GAME-05), upgrades,
the final look and name.
