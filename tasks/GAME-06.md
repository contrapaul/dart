# GAME-06: melee weapon 1 and its charges

Written 2026-11-05, queued until Paul says the local machines can start.
PLAN 3.2: "Melee weapons with limited charges ... Foam melee weapons:
[Paul] for example a noodle flail, a bumper gauntlet, a big foam hammer.
Recharged by parries." CONTENT-PLAN: melee weapon 1 arrives in level 2-1,
"fast, light, combo hits", upgrade "more charges". This card builds the
system and weapon 1 with a placeholder look; weapons 2 and 3 come later
from the same data.

```
ID:          GAME-06
Title:       The melee key swings melee weapon 1: a fast three-hit combo
             that spends charges; no charge is a weak shield bash; parries
             and time refill the charges
Owner:       Pi (Qwen 3.8 Flash Next, dgx-spark, thinking medium)
Reviewer:    Claude Opus 5.5
Depends on:  GAME-04b (parry, gives the recharge hook), GAME-07 (the
             finisher keeps the melee key first); BUG-01, ANIM-01 and LVL-02a
             merged first so the branch starts from a settled main
Branch:      game-06, in its own worktree, cut from main after those merges
```

## Read first

1. `CLAUDE.md` (every rule applies; toy looks, foam only)
2. PLAN.md 3.2 and 3.4, `design/CONTENT-PLAN.md` (search "Melee")
3. `src/game/game.ts`: the melee block in the shared step (finisher first,
   then the page's own melee), the shield charge order, the watch helpers
4. `src/player/shield.ts` (`parries`, the disc states, `knockStep` use in
   the charge), `data/shield.json`
5. `src/foamers/foamers.ts`: `handleHit`, part damage, the stagger,
   `knockStep`; `src/weapons/impacts.ts` and the carve in
   `src/game/shared.ts`
6. `src/course/extras.ts` and `src/main.ts` (the course's debug blast on
   melee), `src/ui/hud.ts`, `data/sounds.json`, `design/SOUNDS.md`

## What to build

All numbers in a new `data/melee.json`, with a `weapons` map keyed by an id
(`M01` for this one) so weapons 2 and 3 are data plus small code later.

- **Key order on `melee`:** a finisher target first (unchanged); then the
  weapon. The course's old debug blast moves to its own binding
  (`debugBlast` in `data/input.json`, start KeyB) on the course page only.
- **Charged swing (M01):** a three-hit combo. A press within `comboWindow`
  (start 0.6 s) of the last swing steps to the next hit, else it starts
  again at hit 1. Each hit spends one charge, has its own damage, reach
  (start 2.2 m) and arc (start 70 degrees), and hits every Foamer in that
  arc in sight once (cap `maxTargets`, start 3). Hit 3 staggers a short
  time (the existing stagger) and knocks back through the Foamer's own
  `knockStep`. Each hit carves a small foam sphere at the contact point
  (on Foamers and on foam walls, through the existing carve path, capped as
  darts are). Swing time is short (start 0.25 s) and the blaster cannot fire
  during it.
- **No charge:** the press is a shield bash: weak damage, a small push, no
  stagger, a longer cooldown. Never nothing.
- **Charges:** `charges` 3 (start). Each parry (`shield.parries` going up)
  gives one back; time gives one back every `rechargeSeconds` (start 8).
  Full at level start and on retry.
- **Rules with the shield:** no swing while the disc is raised or during a
  shield charge or a finisher; a swing with the disc thrown is fine. Record
  the rule in PLAN section 14 as a starting point for Paul's play test.
- **Placeholder look:** a code-built foam baton (toy colours, no art files)
  that sweeps across the view for each hit (left to right, right to left,
  overhead), the blaster dipping out of the way. The shield bash nudges the
  disc forward instead. Name and look are [Paul]: "M01" in code, "[Paul]"
  in anything a player reads.
- **HUD:** three charge pips near the shield area; a pip pulses when a
  parry refills it.
- **Sounds:** placeholder IDs in `data/sounds.json` and `design/SOUNDS.md`:
  `ML-swing`, `ML-hit`, `ML-bash`, `ML-empty`, `ML-charge` (refilled).
- **Watch helpers:** `swing()` (presses melee for one step) and in `state()`
  the charges, combo step and swing time.

## Done when

- Tests in `tests/player/` or `tests/game/`: the combo steps inside the
  window and resets after it; each charged hit spends one charge and hits
  only Foamers in reach, arc and sight, at most `maxTargets`; hit 3
  staggers; no charge gives a bash with no stagger; a parry and the timer
  each refill one, never past max; a finisher target still takes the melee
  press first; no swing with the disc raised.
- `npx tsc --noEmit`, `npx vitest run`, `npm run build` pass; no em or en
  dashes.
- PLAN.md: the GAME-06 row points to this card; decisions in section 14.
  HANDOFF: a dated entry at the top of the Log, the Status section updated,
  and what was not checked by eye (the swing look, the feel, the sounds).

## Not in this task

Weapons 2 and 3 (slow area weapon, charged slam), upgrades, melee on the
range panel beyond a "Refill charges" button if trivial, parry timing
changes.

## Start (Claude, when Paul says go)

Check `dgx-spark` answers first (it travels with Paul). Worktree: `git
worktree add -q ../dart-game-06 -b game-06 && ln -s ../dart/node_modules
../dart-game-06/node_modules`. Brief: `tools/pi/brief-template.txt` with
branch game-06, ID GAME-06, model "Qwen 3.8 Flash Next". Run:
`tools/pi/run-pi.sh ../dart-game-06 dgx-spark qwen3.8-flash-next medium
<brief> <log>`. Suggested stages: (1) data, charges and the hit query with
tests; (2) the combo, bash, carve and key order; (3) look, HUD, sounds,
watch helpers, docs.
