# ENV-03: the mod station (E13)

Written 2026-11-07. Paul (Q17): mods live at stations, ammo stays on
the ground. Today a blaster mod can only be switched on in the range
(`src/range/main.ts` calls `Loadout.setMod`); this station is the first
way to get one in a level.

```
ID:          ENV-03
Title:       E13 mod station: an arcade cabinet shaped machine styled
             like an early 1990s office computer, placed in level data,
             that grants one blaster mod once when the player holds use
             in front of it
Owner:       Pi (Qwen 3.8-27B, qwen-machine, thinking medium)
Reviewer:    Claude Opus 5.5
Depends on:  ENV-01 (done: the test level pattern)
Branch:      env-03, in its own worktree
```

**Running at the same time:** ENV-02 (DeepSeek: the toy button, `Level.buttons`, doors, a new `data/levels/env-02.json`). You both add one optional field to `Level` in `src/level/format.ts`, one line to `src/arena/levels.ts` and the key list in `tests/level/ring-load.test.ts`, and sound IDs to `data/sounds.json` and `design/SOUNDS.md`: keep those edits small and in their own lines so the merge is easy. Stay out of each other's files.

**Lesson from ENV-01:** its crate rule passed every unit test and never ran in play, because `buildArena` in `src/arena/extras.ts` did not hand the crates to the game. Whatever you add to the level must reach the arena page: trace it from `buildLevel` through `buildArena` to `createGame` (`src/game/game.ts`), and write in HANDOFF the path it takes.

## Read first

Read each once; write yourself a short note. First edit by your sixth
reply.

1. `CLAUDE.md` (no trademarks: copy no real machine's design, name or
   logo)
2. `design/levels/ENVIRONMENT.md` sections 0 and E13
3. `src/weapons/loadout.ts` (`setMod`, `modsOf`), `data/blasters.json`
   (the mods: B01 slug and double, B03 both and quad, B04 suppress and
   bounce)
4. `src/pickups/pickups.ts` (how a thing in the world is collected),
   `src/game/vacuum.ts` (how the `use` key is shared)

## What to build

**Stage 1: the station.**
- **Format:** `Level.stations?: Station[]`, each with an `id`, a `pos`,
  a `facing`, a `blaster` id and a `mod` name from that blaster's mods.
- **Grant:** standing within reach (start 1.2 m) and facing it, holding
  `use` for a moment (start 0.6 s) turns the mod on for that blaster with
  `Loadout.setMod`. Once per station per run; a restart resets it. If the
  player does not carry the blaster, the station says so and grants
  nothing. Mods stay for the run, as the shield does.
- **Look (Paul):** the shape of an old upright arcade cabinet, styled
  like an early 1990s office computer. A starting proposal for Paul to
  tune: a beige or warm grey case, a
  dark screen with a glowing green or amber line of text, a slot or
  grille, square edges. Built from boxes in code. The screen shows the
  mod's name from data; a spent station's screen goes dark. Sizes and
  colours in `data/`.

**Stage 2: a test level** `data/levels/env-03.json` (registered as
`"env-03"`) with three stations, one per blaster that has mods, and the
three blasters in the loadout. HUD: the use prompt the finisher and
vacuum already use. Sounds: placeholder IDs `ENV-station-grant`,
`ENV-station-spent`.

## Done when

- Tests: holding use in reach grants the mod; out of reach or not facing
  does nothing; a second hold does nothing; a missing blaster grants
  nothing; a restart resets the station; a level with no stations loads
  as before; the vacuum and the finisher still take `use` first when
  they have a target.
- `npx tsc --noEmit`, `npx vitest run`, `npm run build` pass; no dashes.
- PLAN.md row under ENV-02, section 14 decisions, HANDOFF entry.

## Not in this task

Ammo stations (dropped), which mods each real level offers, the mods'
own balance.
