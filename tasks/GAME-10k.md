# GAME-10k: the F11 Seawall, a shielded knight whose shield only a parry breaks

Written 2026-11-07. Paul chose the Seawall next (order of work: every
enemy and weapon first, PLAN.md section 14). CONTENT-PLAN F11 (Paul):
"Elite. Shield that only a parry breaks. Attack: combo, then a parryable
finisher (P). Teaches parry mastery. Weak point: shield. Health 60. First
seen 3-3. Name: Seawall." Look, section 3.3 (rebuilt for Paul, who found
the first one "janky"): a 3.4 m armoured knight, horned helm with slit
eyes, spiked pauldrons, belt, bent legs with boots, a cape; a spiked
tower shield on the left, a spiked foam mace on the right. "Combo:
overhead slam, sweep, then a slow high wind-up (the parry window) and a
full-body slam." Palette (section 3): deep lime armour, purple weapon,
orange shield. Section 3.1: parts shield (only by parry), arms, legs.

The greybox rig is in `data/foamer-rigs.json` (`F11`, `movement:
combo`, speed 1.4, health 60, parts body, hips, head, helm, horns,
pauldrons, arms, legs, feet, `shield` with `shieldBoss`, `handle` and
`maceHead`, `cape`).

```
ID:          GAME-10k
Title:       The F11 Seawall: palette look, a frontal shield no dart gets
             through, a three-hit combo whose last hit is a pink,
             parryable slam, and a melee parry that breaks the shield
Owner:       Pi (Qwen 3.8 Flash Next, dgx-spark, thinking medium)
Reviewer:    Claude Opus 5.5
Depends on:  GAME-04 (the shield and the ball parry), GAME-10e (the
             Blocker's arc armour), GAME-10f (the Brawler's melee brain)
Branch:      game-10k, in its own worktree
```

**Running at the same time:** ENV-04 (qwen-machine: the crushing press,
`src/level/`, `src/arena/extras.ts`, a new `data/press.json`). Your
files: the F11 rig in `data/foamer-rigs.json`, an F11 entry in
`data/foamers.json`, `src/foamers/`, `src/ai/`, the melee parry in
`src/game/game.ts` (`foamers.onBonk`) and `src/player/shield.ts` if it
needs a getter, `data/shield.json` for parry numbers, `data/sounds.json`
and `design/SOUNDS.md` for F11 only, new tests, `design/foamers/F11-*`.

## Read first

Read each once; write yourself a short note. First edit by your sixth
reply.

1. `CLAUDE.md` (pink means parryable and only parryable; orange is a
   weak point; no gore)
2. `design/CONTENT-PLAN.md`: the F11 rows (sections 3, 3.1, 3.3)
3. `src/foamers/armour.ts` and the F04 entry in `data/foamers.json` (the
   Blocker's shield as arc armour), `tasks/GAME-10f.md` and the F07 entry
   (a melee Foamer's brain and its attacks)
4. `src/player/shield.ts` (`canParry`, `blocksAttackFrom`) and
   `src/game/game.ts` `foamers.onBonk` (a blocked melee hit today)
5. The F11 rig in `data/foamer-rigs.json`

## What to build

All numbers in data. Starting numbers are proposals for Paul to tune.
Three stages, each committed on its own and each leaving the game
working.

**Stage 1: look, type and shield.**
- **Look:** armour (body, helm, pauldrons, hips, feet) `foam-lime-deep`,
  the mace (`handle`, `maceHead`) `foam-purple`, the shield
  `foam-orange` (it is the weak point), the rest purple. Render the
  turnaround with `npx tsx tools/render-rig.ts F11` into
  `design/foamers/`. You cannot see images: check by script that the
  shield is on the left forearm and the mace in the right hand, and say
  so in HANDOFF.
- **Type:** an `F11` entry (rig F11, health 60) on the melee brain the
  F07 uses, closing to its reach; slow (the rig's 1.4 m/s).
- **Shield:** arc armour on `shield` (and `shieldBoss`) across the front
  (start `arcDeg` 120): a dart in the arc does no damage and carves
  nothing (damage 0, carve 0). Darts from the side or back hit as usual.
  The shield is never broken by darts.

**Stage 2: the combo and the parry.**
- **Combo** (data, three attacks in order): `overhead` (windup 0.7,
  damage 15), `sweep` (windup 0.5, damage 12, a wide arc), then
  `finisher` (windup 1.2, the slow high wind-up, damage 35). Poses in
  `src/foamers/rig-states.ts`. Blocking the first two works as any block
  does today.
- **Pink tell:** during the finisher's windup the `maceHead` shows the
  pink parry colour (the material the parryable balls use), and goes back
  to purple after.
- **Melee parry:** an attack marked `parryable: true` in data (only the
  finisher) that meets a raised shield inside the parry window
  (`shield.canParry()`) is parried: the player takes nothing, the Seawall
  staggers (start 1.5 s), its shield takes one parry, and the parry sound
  and hit-stop play as for a ball. After `parriesToBreak` parries (start
  2) the shield part breaks off as a foam piece and the arc armour is
  gone. Blocked but not parried, the finisher costs its block share as
  any attack does. This lives in the shared `onBonk` path, so any later
  Foamer can mark an attack parryable.
- **Sounds,** placeholder IDs: `F11-swing`, `F11-windup` (the finisher's
  tell), `F11-shield-break`.

**Stage 3: docs** (below).

## Done when

- Tests in new files: the F11 reads its own spec; a dart in the shield's
  arc does no damage and carves nothing, a dart from behind hurts; the
  combo runs overhead, sweep, finisher in order; the mace is pink only
  during the finisher's windup; a finisher met inside the parry window
  does no damage, staggers it and counts one parry; outside the window it
  is a block; two parries break the shield off and then a front dart
  hurts; an attack not marked parryable is never parried; every other
  type's tests unchanged.
- `npx tsc --noEmit`, `npx vitest run`, `npm run build` pass; no dashes.
- PLAN.md: a GAME-10k row under GAME-10j; decisions in section 14.
  HANDOFF: a dated entry at the top of the Log (directly under `## Log`),
  Status updated, and what was not checked by eye.

## Not in this task

Level 3-3, the Seawall in any level file, a shield bash attack, the
promoted look, making other Foamers' attacks parryable.
