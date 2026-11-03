# GAME-05: the shield charge

Written 2026-11-03. PLAN 3.2: "Shield charge: dash to any targeted
enemy. DART version: Bumper charge: lock on, dash, knock back. Great for
closing distance." CONTENT-PLAN: taught in level 1-4 with the F05 charger;
upgrades later raise charge distance.

```
ID:          GAME-05
Title:       With the shield up, press dash at a Foamer under the
             crosshair: lock on, charge to it, knock it back and stagger it
Owner:       Pi (Qwen 3.8-27B, Linux AI machine)
Reviewer:    Claude Opus 5.5
Depends on:  GAME-04 stage 1, GAME-07 (done)
Branch:      game-05, in its own worktree
```

## Read first

1. `CLAUDE.md` (every rule applies to you)
2. PLAN.md 3.1 (movement) and 3.2, `design/CONTENT-PLAN.md` (search
   "charge")
3. `src/player/shield.ts` and `data/shield.json` (block, throw, the
   watch helpers), `src/player/controller.ts` (dash, `speedScale`,
   `teleport`), `data/player.json`
4. `src/game/game.ts` (the shared step and watch helpers),
   `src/foamers/foamers.ts` (`startStagger(f, long, seconds)`, the
   character controller move, `list`), `src/game/finisher.ts` (how the
   finisher holds the player)

## What to build

- Numbers in a `charge` block in `data/shield.json`; nothing tuned in
  code.
- **Target:** while the shield is raised, the Foamer nearest the
  crosshair within a small cone and range (start at 14 m, in sight) is
  the charge target; a small lock marker shows on it (HUD, not in the
  world).
- **Charge:** pressing `dash` with a target starts the charge instead of
  the normal dash: the player is driven at the target (start at 24 m/s,
  max 0.7 s), through the character controller so walls still stop it.
  On contact the Foamer is knocked back (start at 3 m along the charge,
  through its own character controller, never through walls), staggered
  with `startStagger`, and takes a small damage. The player stops just
  short of it. A short view kick and sound. Cooldown before the next
  charge (start at 2 s). With no target, dash is the normal dash.
- The charge cannot start during a finisher, and a finisher cannot start
  mid-charge. The shield stays raised through the charge and blocks as
  normal.
- Watch helpers in the shared set: `charge()` (presses dash for one
  step) and `chargeTarget` plus the charge state in `state()`.
- Sounds: placeholder IDs in `data/sounds.json` and `design/SOUNDS.md`
  (lock, charge whoosh, impact).

## Done when

- Tests in `tests/shield/`: the target is the Foamer nearest the
  crosshair inside the cone and range, and none behind a wall; dash with
  a target charges, without one dashes; the charge stops at a wall; the
  hit knocks back, staggers and damages; the cooldown holds.
- `npx tsc --noEmit`, `npx vitest run`, `npm run build` pass; no em or
  en dashes.
- PLAN.md: the GAME-05 row points to this card; decisions in section
  14. HANDOFF: a dated entry at the top of the Log.

## Not in this task

Upgrades, charging through destructible cover, the F05's own charge
(GAME-10b).
