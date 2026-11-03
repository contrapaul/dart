# ENG-13: one shared game module for the playable pages

Written 2026-11-03 after the LVL-01 review: `src/arena/main.ts` (537
lines) is mostly a copy of `src/main.ts` (501 lines). Only the attack
damage lookup and the carve bounds moved to `src/game/`. A fix made to one
page can now miss the other, and LVL-02 will add more level pages.

```
ID:          ENG-13
Title:       Move the game wiring both pages share into src/game/, so a
             page is its level plus a few lines
Owner:       Pi (DeepSeek V4.1 Flash)
Reviewer:    Claude Opus 5.5
Depends on:  LVL-01 (done)
Branch:      eng-13, in its own worktree
```

## Read first

1. `CLAUDE.md` (every rule applies to you)
2. `src/main.ts` and `src/arena/main.ts` side by side, and
   `src/game/attack.ts`, `src/game/shared.ts`
3. `src/range/main.ts` (it stays separate; see below)
4. HANDOFF.md, the LVL-01 entries (what is unverified, the watch mode)
5. PLAN.md 7.5 (code layout)

## What to build

- A `src/game/` module (split into a few files by concern, not one giant
  file) that sets up what both pages share: renderer and scene, physics,
  input, player controller, health, settings store and panels, HUD,
  pause menu and the popped screen, loadout, darts, impacts, debris,
  mesher pool, falling pieces, Foamers with the level AI, sounds, the
  fixed step, render and loop hooks, and `?watch` mode with its console
  helpers (one shared set: `state`, `moveTo`, `look`, `aimNearest`,
  `fire`, `step`, `pause`, plus page extras such as the arena's state).
- Each page passes in only what differs: its geometry (the test course's
  boxes and voxel wall, or the level file's build), its spawn rules (the
  course's Foamer spawner, or the arena runner), and hooks for what only
  it does (the arena's banner, rifts, exit pad and checkpoint restart).
  Use plain functions and an options object, not a class hierarchy.
- Target: `src/main.ts` and `src/arena/main.ts` each under about 150
  lines. If a piece only one page uses would need a hook just to move it,
  leave it in that page.
- `index.html?watch` gains the same watch mode as the arena.
- `src/range/main.ts` stays as it is unless a shared piece drops in with
  no change in behaviour. Do not rework the range panel.
- No behaviour change on any page: the same controls, HUD, menus,
  settings, sounds, difficulty, restart and Try again. The arena keeps
  its checkpoint ammo reset (LVL-01 review).

## Done when

- `npx tsc --noEmit`, `npx vitest run` and `npm run build` pass, and no
  em or en dashes are added.
- Both pages run in `?watch` mode with the shared helpers: on the
  arena, walking into the pit, clearing both waves and reaching the pad
  works as before; on the test course, a Foamer spawns, walks in and can
  be shot down.
- The line counts above, or a HANDOFF note saying why not.
- PLAN.md: an ENG-13 row in the Phase 2 table pointing to this card.
  HANDOFF: a dated entry at the top of the Log (what moved where, what is
  unverified).

## Not in this task

New features, the range page panel, level content, tuning.
