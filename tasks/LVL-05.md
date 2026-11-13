# LVL-05: Act 1 as one campaign

Written 2026-11-13 from Paul's answers (PLAN.md section 14, 2026-11-13).
Today each level is its own page (`/arena?level=1-2`), every level starts
with all eight blasters, and the exit shows "Level complete" with a
restart. Paul wants the levels played in order, in the style of the
classic shooters: finish a level, then Next level or Main menu.

```
ID:          LVL-05
Title:       The campaign: a start loadout of B02, blasters found in
             levels, health and ammo carried, Next level / Main menu,
             progress saved
Owner:       Pi (DeepSeek V4.1 Flash 1017, OpenRouter, thinking medium)
Reviewer:    Claude Opus 5.5
Branch:      lvl-05, in its own worktree
Stages:      two, one run each; commit at the end of each
```

**Your files:** a new `data/campaign.json`, `data/pickups.json` and
`src/pickups/pickups.ts` (a blaster pickup), `src/weapons/loadout.ts`
(owned blasters), `src/game/game.ts` and `src/arena/*.ts` (campaign mode,
the complete screen, carry-over), `arena.html` and `index.html` (buttons),
`data/levels/1-1-pit.json`, `1-2.json`, `1-3.json`, `1-4.json` (one
blaster pickup each), a new pure `src/game/campaign.ts`, new tests in
`tests/game/`. Leave the range alone: it keeps all eight blasters.

## Paul's rules (do not change them)

- The player starts with **B02 Musketeer only**.
- Blasters are found in levels: **B01** in 1-1, **B04** in 1-2, **B03** in
  1-3, **B05** in 1-4. (Later levels: B06 in 2-1, B07 in 2-3, B08 in 3-1.
  Put all seven in `data/campaign.json` as the plan; only Act 1 has
  levels today.)
- **Health and ammo carry** from one level to the next.
- A finished level ends on a screen with **Next level** and **Main menu**.
- **Progress is saved.**
- Hand weapons are found in levels too, later. Not in this task.

## What is there today (read these first)

- `src/arena/levels.ts`: `ARENA_LEVELS` and `chosenLevel()` pick the level
  from `?level=`, defaulting to the Pit.
- `src/arena/extras.ts`: the exit pad, `showComplete()` (pauses, shows
  `#complete` in `arena.html`), restart and reset.
- `src/weapons/loadout.ts`: `Loadout.load` builds all eight in data order;
  `select(i)`, `next()`, `prev()`. `src/game/game.ts` maps the keys
  `weapon1` to `weapon8` to `loadout.select(i)`, so key 1 is B01 and so on
  (Paul, 2026-11-12: keep that mapping).
- Pickups: `src/pickups/pickups.ts` and `data/pickups.json` have `ammo`
  and `health`; level files place them in `pickups` (LVL-02a).
- 1-4's file has a note that B03 is in hand from the start: that is
  replaced by Paul's rules.
- `index.html` is the test course page: a title, Settings and a link to
  the Pit. There is no other main menu yet.

## Stage 1: owned blasters and blaster pickups

1. **`data/campaign.json`**: `order` (`["1-1-pit", "1-2", "1-3", "1-4"]`;
   1-1 is only the Pit until the rest of 1-1 is built), `startBlasters`
   (`["B02"]`), `found` (level id to blaster id, all seven above), a
   `_note` with the date and that the rules are Paul's.
2. **Owned blasters.** `Loadout` keeps building all eight (so nothing
   loads mid-level) but gains an owned set: `own(id)`, `owns(id)`.
   `select(i)` does nothing for an unowned blaster; `next()` and `prev()`
   skip unowned ones; the first owned blaster is active at start. With
   everything owned (the default) it behaves exactly as today.
3. **Campaign mode.** `arena.html?level=1-2&campaign` plays the level in
   the campaign: the loadout owns only what the campaign state says.
   Without `&campaign` the page is the test page it is today: every
   blaster owned. Put the rules (what is owned at a level's start, what
   the next level is, what the save holds) in the pure
   `src/game/campaign.ts`: no DOM, no THREE, tested headless.
4. **A blaster pickup.** A `blaster` pickup kind in level files:
   `{ "id": "...", "type": "blaster", "blaster": "B01", "pos": [x, y, z] }`.
   It shows that blaster's own model at world size, turning slowly and
   bobbing like the ammo box, and is taken by walking within 1 m (the ammo
   box's rule). Taking it owns the blaster, switches to it, gives it a
   full magazine and its `reserveStart`, flashes its name on the HUD, and
   plays the existing pickup sound. In test mode (everything owned) it
   still shows and only tops up ammo.
5. **Placement.** One blaster pickup per Act 1 level, from `found`: on the
   critical path before the level's first arena, in plain sight, lit, and
   never behind a door that needs it. In the Pit, near the player start.
   Each one's `pos` is a start value Paul will move; say where you put it
   in HANDOFF.

Stage 1 tests: the campaign rules (start owns B02 only; level 1-2 in a
fresh campaign owns B02 and B01; `found` covers seven distinct blasters);
`Loadout` owned set (select, next and prev skip unowned; key for an
unowned blaster does nothing; default owns all); the blaster pickup is
taken within 1 m and not at 1.5 m. Commit stage 1.

## Stage 2: carry-over, the end screen, saving

1. **What carries.** When the exit is reached in campaign mode, record:
   the level just finished, the owned blasters, each blaster's magazine
   and reserve, the player's health (and whatever else UI-01's health
   carries, such as armour or shield charge, if it exists). The next level
   starts with exactly these. A restart or death inside a level goes back
   to what the player had when the level began, not to a fresh start.
2. **Save.** One `localStorage` key, `dart.save.v1`, holding the campaign
   state as JSON with a `version`. Every read and write in try/catch; a
   missing, broken or old save means a new game. Saved at each level's
   start (the state on entry) and at the exit.
3. **The end screen.** In campaign mode `#complete` shows the level's name
   (the `meta.name`, which may still be `[Paul]`), the time taken, and two
   buttons: **Next level** (loads the next level in `order` in campaign
   mode) and **Main menu** (goes to `/`). After the last level in `order`
   there is no Next level; the screen says the act ends here for now.
   Keyboard works: Enter is Next level, Esc is Main menu. Outside
   campaign mode the screen is as it is today.
4. **The main menu.** `index.html` gains **New game** (clears the save,
   starts the first level in campaign mode) and **Continue** (only shown
   when a save exists; starts the saved level in campaign mode). The
   title and logo stay `[Paul]`'s; keep the test course link.

Stage 2 tests: carry (finish 1-2 with 37 health and B04 at 12 of 30 plus
50 reserve: 1-3 starts with the same); restart within a level restores the
entry state; the save round trips; a broken or old-version save gives a
new game; the order ends after 1-4. Commit stage 2.

## Done when

- Both stages' tests pass, `npm run check` and `npm run smoke` pass.
- PLAN.md: an LVL-05 row in section 12; HANDOFF.md: a dated entry directly
  under `## Log` with where each blaster pickup was put, how to play the
  campaign (`/` then New game) and what was not seen by eye.

## Not in this task

- The rest of level 1-1 (its own card), Act 2 and 3 levels, hand weapons
  and melee, a level select, a title screen with Paul's logo, cloud saves.

## Rules

No em dashes anywhere (`node tools/check-no-em-dash.mjs`). Nothing fetched
from another host. Tuning numbers live in `data/` JSON. Edit JSON by hand,
never by dumping it from a script. Never `Math.random` in simulation code.
Paul writes names and story: leave `[Paul]` where a name is needed.
Commit on `lvl-05` with Conventional Commit messages; do not push.
