# MEL-01: the sword, found in level 2-1

Written 2026-11-13. Paul (PLAN.md section 14, 2026-11-13): hand weapons
are found in levels, and the first is "a sword, to be precise", found in
2-1 just before Arena 1. The game already has melee weapon 1 (M01,
GAME-06: a three-hit combo, charges, a bash when none are left) drawn as
a placeholder baton. M01 becomes the sword.

```
ID:          MEL-01
Title:       M01 is a foam sword (code-built placeholder look), a hand
             weapon pickup, and the campaign owns hand weapons the way it
             owns blasters
Owner:       Pi (DeepSeek V4.1 Flash 1017, OpenRouter, thinking medium)
Reviewer:    Claude Opus 5.5
Branch:      mel-01, in its own worktree
```

**Your files:** `src/game/meleeView.ts`, `data/melee.json` (the look),
`src/game/melee.ts` and `src/game/game.ts` only for owning a hand weapon,
`data/campaign.json` and `src/game/campaign.ts` (hand weapons owned,
found and saved), `src/pickups/pickups.ts` and `data/pickups.json` (a
`melee` pickup kind), `src/level/format.ts` and `src/level/validate.ts`
(the entry), new tests in `tests/game/`. Another model is adding health
pickups at the same time (`tasks/HP-01.md`) in `pickups.ts`,
`pickups.json`, `melee.ts` and `game.ts`: keep your changes there small
and in their own functions or blocks.

## What is there today (read these first)

- `data/melee.json`: `active` "M01", `weapons.M01` (name `[Paul]`, the
  combo `hits`), `charges`, `look` (the baton: handle and ball, camera
  placement, dip), `bash` (the press with no charge left).
- `src/game/meleeView.ts`: the code-built baton and its three strokes.
- `src/game/campaign.ts` and `data/campaign.json` (LVL-05): the order,
  the start blasters, `found` (level to blaster), and the save
  (`dart.save.v1`, `version` 1) with `entryState`, `carryTo`,
  `captureState`, `applyState`.
- The blaster pickup (LVL-05) in `src/pickups/pickups.ts`: shows a model,
  turns and bobs, taken within 1 m. Copy its pattern.

## What to build

1. **The sword look.** Replace the baton in `meleeView.ts` with a
   code-built foam sword, still a placeholder until Paul draws it: a flat
   foam blade (rounded tip, no edge, it is a toy), a cross guard and a
   grip with a pommel. Every size and colour in `data/melee.json` `look`
   (start: blade 0.7 m long, 0.07 wide, 0.025 thick, lime `#b6ff3b`; guard
   and pommel orange `#ff8a3d`; grip purple). Keep the three strokes and
   the dip; tune the camera placement so the whole blade reads in the swing
   and the grip sits in the lower right at rest. Name stays `[Paul]`.
2. **Hand weapons owned.** The campaign owns hand weapons as it owns
   blasters: `data/campaign.json` gains `startMelee` (`[]`) and
   `foundMelee` (`{ "2-1": "M01" }`). The save gains `melee` (the owned
   ids); bump `SAVE_VERSION` to 2, and a version 1 save still loads, with
   no hand weapon owned (do not throw away a player's Act 1 progress).
   In campaign play with no hand weapon owned, the melee key does the
   bash only (the existing no-charge press); the sword view never shows.
   Outside campaign play (test pages, the range) M01 is owned as today.
3. **A melee pickup.** A level entry
   `{ "id": "...", "type": "melee", "melee": "M01", "pos": [x, y, z] }`
   shows the sword at world size, turning and bobbing like the blaster
   pickup, taken within 1 m. Taking it owns the weapon, fills its charges
   and flashes its name on the HUD (the blaster pickup's flash). On the
   test pages it shows and does nothing more. Level 2-1 is not built yet:
   put one in `data/levels/env-03.json` (the mod station test room) near
   the player start so it can be tried, and say so in HANDOFF.

## Done when

- Tests: a fresh campaign owns no hand weapon and the melee key bashes;
  after the pickup it swings the combo; a version 1 save loads with no
  hand weapon and keeps its blasters, health and level; a version 2 save
  round trips the owned hand weapons; the test page owns M01; the
  validator accepts the melee entry and rejects an unknown weapon id.
- `npm run check` and `npm run smoke` pass.
- PLAN.md: an MEL-01 row in section 12 near LVL-05; HANDOFF.md: a dated
  entry directly under `## Log` with how to see the sword and the pickup,
  and what was not seen by eye.

## Not in this task

Building level 2-1, melee weapons 2 and 3, Paul's own sword look, the
F07's sword (a Foamer's, separate).

## Rules

No em dashes anywhere (`node tools/check-no-em-dash.mjs`). Nothing fetched
from another host. Tuning numbers live in `data/` JSON. Edit JSON by hand,
never by dumping it from a script. Never `Math.random` in simulation code.
Foam and toy looks only (PLAN.md section 2): the sword is a soft toy, no
edge, no shine of metal. Commit on `mel-01` with a Conventional Commit
message (include `tasks/MEL-01.md`); do not push.
