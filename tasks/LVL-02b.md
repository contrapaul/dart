# LVL-02b: levels with more than one arena, and the first half of 1-2

Written 2026-11-05 (overnight). LVL-01 built the level format, the
validator, the builder and an arena runner that plays one arena per level
(the Pit). Real levels chain several (`design/levels/LEVEL-1-2.md`: three
arenas, a set piece and a gauntlet). This card makes the runner play a
level's arenas in order and builds beats 1 to 4 of Level 1-2 from the
LVL-00 concept, which Paul approved.

```
ID:          LVL-02b
Title:       The arena runner plays every arena of a level in order, each
             with its own trigger, doors, waves and checkpoint; data file
             for Level 1-2 beats 1 to 4 (open, the parry corridor, the Ring
             arena, the breather)
Owner:       Pi (Qwen 3.8 Flash Next, dgx-spark, thinking medium)
Reviewer:    Claude Opus 5.5
Depends on:  LVL-01, LVL-02a, GAME-10a (done)
Branch:      lvl-02b, in its own worktree
```

**Running at the same time:** GAME-08 (vacuum) and the next DeepSeek card.
Do not edit `src/player/`, `src/pickups/`, `src/foamers/`, `src/ai/`, or
the melee and use blocks of `src/game/game.ts`. Your files are
`src/level/`, `src/arena/`, `data/levels/` and their tests.

## Read first

1. `CLAUDE.md` (place names, the level name and the setting are [Paul])
2. `design/levels/README.md`, `design/levels/BLOCKOUT.md` (the format and
   the validator rules), `design/levels/KIT.md` (A2 Ring),
   `design/levels/LEVEL-1-2.md` sections 1, 2, 3, 4 (Arena 1) and 6
3. `src/level/format.ts`, `validate.ts`, `build.ts`, `arena.ts`;
   `src/arena/main.ts`, `extras.ts`, `levels.ts`, `rifts.ts`
4. `data/levels/1-1-pit.json`, `data/levels/1-4-ring.json` (an A2 Ring
   already built: reuse its geometry where it fits)
5. `tests/level/`

## What to build

- **Runner:** a level's `arenas` play in file order. Each arena locks on
  its own trigger, runs its waves, opens its own doors on clear, and saves
  its own checkpoint; Try again restarts the current arena from its
  checkpoint with the earlier arenas still cleared. The level completes
  when the last arena clears and the player reaches the exit. One arena
  levels (the Pit, the Ring) play exactly as before; their tests pass
  unchanged. The watch's `state()` gains the current arena index and id.
- **Validator:** arena ids unique, each arena's trigger inside the shell,
  arenas in an order the player can reach (an arena's trigger is not
  inside an earlier arena's locked space).
- **Level 1-2, beats 1 to 4** (`data/levels/1-2.json`, playable as
  `arena.html?level=1-2`):
  1. Open: the service corridor (16 x 6 m) with a voxel foam wall to test
     a blaster on. The B02 rack is [Paul] (B02 is not built): leave a
     marked empty plinth.
  2. The parry corridor: 22 m long with a 4 m alcove, one Roamer alone at
     the far end, as a one-wave arena of its own (lock on entering the
     corridor, no rift: the Roamer is placed), then a small yard.
  3. Arena 1, the Ring (A2) from section 4: two waves of Roamers (4, then
     6 with the third rift hidden behind the block), two foam pillars in
     the ring, ammo in the south-west corner, the north exit as a reveal.
  4. The breather store (10 x 8 m) with one ammo box and a window onto
     the ring; the level's exit pad here for now.
  Names, setting and accent colour stay [Paul]. Tuning numbers (wave
  gaps, holds) in the file.

## Done when

- Tests in `tests/level/`: a two-arena level plays both in order; the
  second arena's trigger does nothing until the first clears; Try again in
  arena 2 keeps arena 1 cleared; one-arena levels unchanged; the validator
  rejects duplicate ids and an unreachable order; `1-2.json` validates.
- `npx tsc --noEmit`, `npx vitest run`, `npm run build` pass; no em or en
  dashes.
- PLAN.md: an LVL-02b row under LVL-02a; decisions in section 14. HANDOFF:
  a dated entry at the top of the Log, Status updated, and what was not
  checked by eye (the spaces, the reveal, the pacing).

## Not in this task

Beats 5 to 9 (the tower, Arena 2, the gauntlet: a later card), the B02
blaster, stations and secrets, the level's name and setting.
