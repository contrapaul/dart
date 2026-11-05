# GAME-08: the foam vacuum (ammo for kills)

Written 2026-11-05, queued until Paul says the local machines can start.
PLAN 3.1: "a foam vacuum or reclaimer that sucks a Foamer up and spits out
darts". Paul's D09 (`design/CONTENT-PLAN.md`): "emulate Doom's stunned
effect on enemies that have been weakened, then press E to animation lock
onto them and extract the darts". CONTENT-PLAN upgrades: "Faster recharge,
works on heavies", so the base tool recharges and skips heavies.

```
ID:          GAME-08
Title:       The vacuum: E on a stunned (weakened) Foamer locks on, sucks
             it up and refills the blasters' reserves; one charge that
             recharges
Owner:       Pi (Qwen 3.8-27B, qwen-machine, 1cat config, thinking low)
Reviewer:    Claude Opus 5.5
Depends on:  GAME-07, GAME-09 (done); LVL-02a (the ammo credit, merged
             first); BUG-01, GAME-04b, ANIM-01 merged first so the branch
             starts from a settled main
Branch:      game-08, in its own worktree, cut from main after those merges
```

## Read first

1. `CLAUDE.md` (every rule applies; foam only, no gore, toy looks)
2. PLAN.md 3.1 and 3.4, `design/CONTENT-PLAN.md` D09 and the upgrade
   table line for the ammo-for-kills tool
3. `tasks/GAME-07.md` and `src/game/finisher.ts`: the vacuum is the
   finisher's sibling (same target, same lock, different reward). Copy its
   shape, not its code: share what can be shared.
4. `src/game/game.ts` (the shared step: the melee and finisher block, the
   watch helpers), `src/course/extras.ts` (the course's `use` key throws foam
   blocks), `src/arena/extras.ts`
5. `src/pickups/pickups.ts` (how an ammo box credits reserves),
   `src/weapons/loadout.ts`, `src/weapons/blaster.ts` (`reserve`,
   `reserveMax`)
6. `src/foamers/foamers.ts` (`finishWeakened`, the stagger, `pop`, removal),
   `data/foamers.json`, `src/ui/hud.ts`, `data/sounds.json`,
   `design/SOUNDS.md`

## What to build

All numbers in data: a `vacuum` block in a new `data/vacuum.json`, and a
per-type `vacuum` entry in `data/foamers.json` (`allowed`, `ammoShare`).

- **Target:** the same Foamer a finisher could take: weakened and in its
  stagger (the stun glow GAME-07 added). Reach (start 3 m, eye to chest) and
  a view cone (start cos 0.97). Only types with `vacuum.allowed`: F01, F02
  and F05 yes. A type with no entry is not allowed (heavies come later).
- **Key:** `use` (E). With a target and a charge, the vacuum takes the press
  (`consumePress`, as the finisher does with melee). With no target, the
  page keeps its old `use` (the course's block throw). With a target but no
  charge: an empty sound, and the press is still consumed.
- **The lock:** the player is held for at most 1.0 s (start 0.9 s), the view
  turns onto the Foamer, a placeholder vacuum (code-built: a toy-coloured
  tube and wide nozzle, no art files) rises in the lower right as the
  blaster dips, and the Foamer stretches toward the nozzle and shrinks to
  nothing (a scale and position ease on its group, no physics). It is then
  removed with no pop chunks; a small capped foam puff at the nozzle. What
  the player can and cannot take during the lock copies the finisher
  exactly, whatever that is on main: do not decide it here (Paul has it as
  an open question for the finisher).
- **The reward:** darts straight into reserves, never past `reserveMax`.
  The active blaster gets the type's `ammoShare.active` of its own
  `reserveMax` (start 0.5), every other blaster in the loadout
  `ammoShare.other` (start 0.25), rounded up. No pickups are spawned (D08:
  Paul wants ammo boxes placed, not dropped). Reuse the ammo box's credit
  path if it fits, so both go through one function.
- **Charge:** one charge (`charges` 1), recharges in `rechargeSeconds`
  (start 15). The charge is full at the start of a level and on retry.
- **HUD:** the finisher-style prompt by the crosshair when a vacuum target
  is in reach (the bound key name from the input map), a recharge meter
  (one pip that fills), and the existing ammo HUD updates.
- **Sounds:** placeholder IDs in `data/sounds.json` and `design/SOUNDS.md`:
  `VC-start`, `VC-suck` (loop for the lock), `VC-done`, `VC-empty`,
  `VC-ready` (recharged).
- **Watch helpers** in the shared set: `vacuum()` (presses use for one step),
  and in `state()` the vacuum's charge and recharge, and each Foamer's
  vacuumable flag.

## Done when

- Tests in `tests/game/` (or `tests/foamers/`, beside the finisher's): a
  target is found in reach and cone and not beyond; a type without
  `allowed` is never a target; the lock removes the Foamer with no pop; the
  reserves rise by the shares and stop at `reserveMax`; no charge means no
  lock and the empty sound; the charge returns after `rechargeSeconds`; with
  no target `use` is not consumed.
- `npx tsc --noEmit`, `npx vitest run`, `npm run build` pass; no em or en
  dashes.
- PLAN.md: the GAME-08 row points to this card; decisions in section 14
  (the share rule, why no pickups). HANDOFF: a dated entry at the top of
  the Log, the Status section updated, and a list of what was not checked
  by eye (the lock's look, the nozzle, the shrink, the sounds).

## Not in this task

The tool's name and look ([Paul]: use "vacuum" in code and "[Paul]" in any
player-facing name), upgrades (faster recharge, heavies), dart spray
visuals, a vacuum on the range panel beyond a "Fill vacuum" button if one
is trivial.

## Start (Claude, when Paul says go)

Worktree: `git worktree add -q ../dart-game-08 -b game-08 && ln -s
../dart/node_modules ../dart-game-08/node_modules`. Brief:
`tools/pi/brief-template.txt` with branch game-08, ID GAME-08, model
"Qwen 3.8-27B", including the Qwen 27b line. Run:
`tools/pi/run-pi.sh ../dart-game-08 qwen-machine qwen3.8-27b-1cat low
<brief> <log>`. Suggested stages: (1) data, target and charge with tests;
(2) the lock, reward and sounds; (3) HUD, watch helpers, docs.
