# GAME-10m: the F12 Ambusher, hides in foam growths and pounces

Written 2026-11-08. Paul's order of work: every enemy and weapon first.
CONTENT-PLAN F12 (Paul): "Elite. Hides in foam growths, leaps out.
Attack: pounce. Teaches clearing growths, awareness. Weak point: none.
Health 25. First seen 3-3. Name: Ambusher. Look: a lean bipedal foamer
that leaps out [...]. Deep purple body, orange spines, lime eyes." (The
cut part names two other games as a feel reference; copy nothing from
them.) Section 3.1: losing its legs means no more pouncing.

**Paul's row wins over the older greybox line.** CONTENT-PLAN 3.3 still
describes F12 as "a long low stalker, spined back, jointed legs, tail,
gaping head", and the current rig in `data/foamer-rigs.json` is that
stalker. Paul's own row asks for a lean biped. Rebuild the rig as a lean
biped (as the F11 was rebuilt); keep the spined back, drop the tail. Note
the clash in HANDOFF for Paul.

```
ID:          GAME-10m
Title:       The F12 Ambusher: a lean biped in Paul's palette, a pounce
             with a telegraph, claws up close, and an ambush from inside a
             foam growth that wakes when the player comes near or carves it
Owner:       Pi (Qwen 3.8-27B, qwen-machine, thinking medium; Paul: local
             models overnight)
Reviewer:    Claude Opus 5.5
Depends on:  GAME-10l (merged)
Branch:      game-10m, in its own worktree
```

**Running at the same time:** GAME-09g (dgx-spark, B08) in
`src/weapons/`, `src/player/controller.ts`, `src/game/game.ts`,
`src/range/main.ts`, `data/blasters.json`, `data/darts.json`. Stay out of
those. Your files: the F12 rig in `data/foamer-rigs.json`, an F12 entry
in `data/foamers.json` (not the shared `damage` block), `src/foamers/`,
`src/ai/`, `src/level/` (format, validator, builder) and
`src/arena/extras.ts` for the ambush, one new test level
`data/levels/env-05.json`, `data/sounds.json` and `design/SOUNDS.md` for
F12 only, new tests in `tests/foamers/`, `tests/ai/` and `tests/level/`,
`design/foamers/F12-*`.

**Edit the JSON files by hand, line by line.** Never rewrite a data file
through a JSON dump: each must keep its existing layout, with only your
lines changed.

## Read first

Read each once; write yourself a short note. First edit by your sixth
reply.

1. `CLAUDE.md` (foam only, no horror: menacing is fine, no teeth; orange
   means weak point and pink parryable only, so the orange spines are
   decoration on a Foamer with no weak point: keep them small)
2. `design/CONTENT-PLAN.md`: the F12 rows (sections 3, 3.1, 3.3)
3. `tasks/GAME-10l.md` and the F07 and F13 entries in `data/foamers.json`
   (the latest Foamer cards; F07's `leap` is the nearest thing to a
   pounce)
4. `src/foamers/foamers.ts` (the F07 crouch and leap states),
   `src/ai/` (the brains)
5. `src/level/format.ts` (`Piece`, kind `growth`), the level validator
   and builder, `src/arena/extras.ts` (how stations and presses are
   wired)
6. The F12 rig in `data/foamer-rigs.json`

## What to build

All numbers in data, proposals for Paul to tune. Four stages, each
committed on its own and each leaving the game working.

**Stage 1: look and type.**
- **Look (Paul):** a lean biped, a little taller than the player, long
  arms ending in foam claws (blunt, no points), a narrow head with lime
  eyes, a row of small orange spines down the back. Body `foam-purple`
  as dark as the palette allows (or a new deep purple foam material if
  the palette has none, said in HANDOFF). Render with
  `npx tsx tools/render-rig.ts F12` into `design/foamers/`. You cannot see
  images: check by script that the eyes face forward, the spines are on
  the back and both feet are on the ground, and say the look was not seen.
- **Type:** an `F12` entry (rig F12, health 25), no weak point.

**Stage 2: the pounce.**
- Between `pounce.minMetres` (start 3) and `pounce.maxMetres` (start 9)
  from the player, in sight, off cooldown (start 4 s): it crouches (the
  telegraph, start 0.45 s), then leaps in an arc to where the player
  stood when the crouch began. Landing within `pounce.hitMetres` (start
  1.2) of the player hits once (start damage 15) through the ordinary
  hit path, so a raised shield takes its share. Not parryable (no pink).
- Up close it claws (base melee, start damage 8).
- **Legs gone:** no pounce; it crawls in and claws.

**Stage 3: the ambush.**
- A level may list `ambushes`: `{ id, foamer, growth }`, where `growth`
  names a piece of kind `growth`. At load, the Foamer is placed inside
  that growth, hidden (not drawn, no colliders, no brain).
- It wakes when the player comes within `ambush.wakeMetres` (start 6) of
  the growth, or when the growth loses any voxels (the player clearing
  growths, Paul's "teaches"). Waking, it bursts out with a pounce at the
  player straight away (no cooldown).
- The validator rejects an ambush whose growth does not exist or is not a
  `growth`. An F12 from a wave (a rift) just hunts and pounces.
- **Test level** `data/levels/env-05.json`: env-01's room with two
  growths, an F12 hidden in one; the `[Paul]` meta fields as env-03's.

**Stage 4: sounds and docs.**
- **Sounds,** placeholder IDs: `F12-crouch` (a low hiss), `F12-pounce`,
  `F12-burst` (bursting out of a growth).
- Docs: below.

## Done when

- Tests in new files: the F12 reads its own spec; it pounces only inside
  its band, in sight and off cooldown, after the crouch; a landing near
  the player hits once and a raised shield takes the block share; it is
  not parryable; legs gone means no pounce; an ambusher is hidden and
  inert until the player comes near, then pounces at once; carving its
  growth wakes it; the validator rejects a bad ambush; every other type's
  tests unchanged.
- `npx tsc --noEmit`, `npx vitest run`, `npm run build` pass; no dashes.
- PLAN.md: a GAME-10m row under GAME-10l; decisions in section 14.
  HANDOFF: a dated entry at the top of the Log (directly under
  `## Log`), Status updated, what was not checked by eye, and the
  look clash for Paul.

## Not in this task

Level 3-3, the promoted look, growths that regrow, any other Foamer.
