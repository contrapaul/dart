# GAME-10n: the F14 elite, a slow heavy with a floor slam, a parryable smash and legs as its weak point

Written 2026-11-23. Paul: "add F14 to the game", from Inkling-2-Mini's
BENCH-01 proposal, now in `design/foamers/F14-concept/` (`CARD.md` is the
design, `renders/` the concept look, `concept.py` the Blender sketch).
The name is `[Paul]`: the proposal calls it "the Warden", which is the
model's word, not Paul's, so do not use it anywhere in the game.

```
ID:          GAME-10n
Title:       The F14 elite: palette look from the concept, a standing
             floor slam ring at middle range, a close combo ending in a
             pink parryable smash, orange legs as the weak point, and a
             stagger when a leg breaks
Owner:       Pi (DeepSeek V4.1 Flash 1017, OpenRouter)
Reviewer:    Claude Opus 5.5
Depends on:  GAME-10f (F07's shockwave ring), GAME-10k (F11's combo,
             pink tell and melee parry)
Branch:      game-10n, worktree /Users/paul/Documents/GitHub/dart-game-10n
```

**Running at the same time:** Claude is replacing the B02 blaster model on
`main` (`public/models/blasters/B02.glb`, `art/blasters/B02/`,
`data/arms.json`, `data/blasters.json`). Do not touch those files.
Your files: the F14 rig in `data/foamer-rigs.json`, an F14 entry in
`data/foamers.json`, `src/foamers/`, `src/ai/` if the brain needs it,
`src/audio/foamer-sounds.ts` and `data/sounds.json` for F14 only, new
tests, `design/foamers/F14-*`, `design/CONTENT-PLAN.md` (the F14 rows),
PLAN.md and HANDOFF.md.

## Read first

Read each once; write yourself a short note. First edit by your sixth
reply.

1. `CLAUDE.md` (pink means parryable and only parryable; orange is a weak
   point; no gore; foam only)
2. `design/foamers/F14-concept/CARD.md`, and `design/CONTENT-PLAN.md`
   sections 3, 3.1 and 3.3 (the F11 and F13 rows, for the columns)
3. The F11 entries in `data/foamer-rigs.json` and `data/foamers.json`,
   `src/foamers/combo.ts`, and how `meleeParry` is handled (grep for it)
4. The F07 entry in `data/foamers.json` (`leap`, `shockwave`) and
   `src/foamers/leap.ts` (`startShockwave`, `stepShockwave`), and where
   the F07 landing starts its ring (grep `startShockwave`)
5. How a `weakpoint` part is set up (the F04 and F13 entries) and what
   happens when both legs are gone (grep `legs` in
   `src/foamers/foamers.ts`)
6. `tests/range/lineup.test.ts` (every type in the data is lined up on
   the range, so F14 will be too)

## What to build

All numbers in data, proposals for Paul to tune. Four stages, each
committed on its own and each leaving the game working.

**Stage 1: look and type.**
- **Rig `F14`** in `data/foamer-rigs.json`, label `F14`, tier `Elite`,
  speed 1.3, health 70. The look from the concept renders: a broad,
  low-slung biped about 2.8 m tall, wider than F11. Deep purple body
  (`foam-purple-deep`), a flat-topped head with an ink visor band across
  the eyes and two cream eyes in it (no teeth, no mouth), wide lime
  shoulder blocks and lime arms, a lime chest plate on the front and a
  lime back plate, short thick orange legs and orange feet (the weak
  point), and a lime foam maul (a handle and a big blocky head) in the
  right hand. Rounded boxes, as the other rigs. Use the materials the
  palette already has; say in HANDOFF if one is missing.
- Render it with `npx tsx tools/render-rig.ts F14` into `design/foamers/`
  as the other rigs are. You cannot see images: check by script that the
  eyes face forward (+z or whatever the other rigs use), the chest plate
  is on the front, the back plate on the back, and both feet are on the
  ground. Say the look was not seen by eye.
- **Type** `F14` in `data/foamers.json`: rig F14, the melee brain as
  F11 uses, `attackRange` about 2.2, `turnRate` about 2. Both legs carry
  the weak point (the F13 and F04 `weakpoint` damage and carve numbers,
  or a `legs` entry with the same shape if a weak point must be one
  part). The body and chest plate take normal damage.

**Stage 2: the close combo and the parryable smash.**
- As F11: a `combo` of `sweep` (start damage 12, windup 0.5), `sweep`
  again, then `smash` (start damage 30, windup 0.8, parryable, the maul
  head shows the pink tell during its windup).
- `meleeParry`: a parry of the smash staggers it for `staggerSeconds`
  (start 2.0). Use F11's code path; if it needs a part to break, use the
  maul head with `parriesToBreak` 2, so two parries knock the maul head
  off and it falls back to a fist bonk (start damage 10).
- A melee finisher during the stagger pops it, as for every Foamer.

**Stage 3: the floor slam.**
- When the player is between `slam.minMetres` (start 3) and
  `slam.maxMetres` (start 6), in sight, off cooldown (start 5 s), it stops,
  raises the maul for `slam.windupSeconds` (start 0.9, the telegraph,
  not pink: the slam is not parryable) and slams the floor where it
  stands. That starts a shockwave ring at its own feet, using F07's
  shockwave code and a `shockwave` block of its own in the F14 entry
  (start speed 7, radius 7, thickness 0.6, damage 14). The player jumps
  or dashes through it, as for F07's ring.
- No maul head: no slam. Both legs gone: no slam; it crawls in as other
  Foamers do.

**Stage 4: the leg break stagger, sounds and docs.**
- When a leg breaks off it staggers for `legBreak.staggerSeconds` (start
  2.0), once per leg, the same stagger state the parry uses, so the
  player can finish it.
- **Sounds,** reuse existing IDs only (no new audio files): the slam
  plays F07's landing sound, the smash and sweeps play F11's. Say which
  in HANDOFF.
- `design/CONTENT-PLAN.md`: add the F14 roster row from
  `design/foamers/F14-concept/CARD.md` in section 3 (name `[Paul]`),
  plus rows in 3.1 (parts: legs, arms, head, maul; most useful: legs)
  and 3.3 (the look). Keep the note that the old F14 and F15 rows were
  cut, and say this F14 is a new elite.

## Done when

- Tests in new files: F14 reads its own spec and rig; it is on the range
  lineup; the combo runs sweep, sweep, smash and only the smash is
  parryable; a parry staggers it for the data's seconds; two parries
  knock the maul head off and it then bonks with its fist; it slams only
  inside its band, in sight and off cooldown, after the windup, and the
  ring starts at its own feet; no maul head or no legs means no slam; a
  leg breaking staggers it once per leg; a leg hit does weak point
  damage; every other type's tests unchanged.
- `npx tsc --noEmit`, `npx vitest run`, `npm run build` pass; no dashes.
- PLAN.md: a GAME-10n row under GAME-10m; the decision in section 14
  (newest row at the top, under the header). HANDOFF: a dated entry at the
  top of the Log (directly under `## Log`), what was not checked by eye.

## Not in this task

The catastrophic death in the concept card (chest plate peeling off,
buckling to the knees): a later card. Placing F14 in any level (Paul
places Foamers). A name. New audio. Any other Foamer.
