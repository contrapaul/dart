# LVL-03a: Level 1-3 beats 1 to 5 (open, explore, the Pit, breather, the Yard)

Written 2026-11-06. Level 1-2 is built (`data/levels/1-2.json`, LVL-02b,
LVL-02c, LVL-02d). This card starts Level 1-3 from its LVL-00 concept,
which Paul approved: the Swarmer's level, where finishers are the health.
The second half (the hall chase with the drop, breather 2, the Ring
gauntlet, the exit) is a later card.

```
ID:          LVL-03a
Title:       Level 1-3 beats 1 to 5: the loading bay, the explore corridors,
             Arena 1 the Pit (A1), the catwalk breather and Arena 2 the Yard
             (A6), with a temporary exit after the Yard
Owner:       Pi (DeepSeek V4.1 Flash, openrouter, thinking high; the Spark run hit its output limit with nothing written)
Reviewer:    Claude Opus 5.5
Depends on:  LVL-02b, LVL-02c (done), GAME-10d (the F03 Swarmer, done)
Branch:      lvl-03a, in its own worktree
```

**Running at the same time:** BUG-08 (the Roamer's brain and
`src/foamers/foamers.ts`, `data/ai.json`). Your files are a new
`data/levels/1-3.json`, `src/level/`, `src/arena/` (only to list the new
level) and `tests/level/`. Do not edit `src/ai/`, `src/foamers/`,
`src/player/`, `data/ai.json` or `data/foamers.json`.

## Read first

1. `CLAUDE.md` (place names, the level name and the setting are [Paul])
2. `design/levels/README.md`, `design/levels/BLOCKOUT.md`,
   `design/levels/KIT.md` (A1 Pit, A6 Yard, section 6 caps),
   `design/levels/LEVEL-1-3.md` sections 1 to 4 (Arena 1, Arena 2), 6, 7
3. `tasks/LVL-02b.md` and `tasks/LVL-02c.md`, their HANDOFF Log entries
   and PLAN.md section 14 rows (the shared floor slab and perimeter, why
   spaces were scaled)
4. `data/levels/1-2.json` (copy its shape, do not reread it), `src/level/`
   (`level-runner.ts`, `validate.ts`, `build.ts`), `src/arena/levels.ts`
5. `tests/level/level-1-2.test.ts`

## What to build

All in `data/levels/1-3.json` unless the format truly cannot say it. Write
the JSON with short python scripts, never as one big reply.

- **Beat 1, the open bay (18 x 12 m):** player start, three foam dummies
  are not built (no dummy exists): use three small voxel foam pieces to
  shoot instead and say so in a `_note`. One ammo box (A1, 40) beside the
  door.
- **Beat 2, explore 1:** two 10 m corridors and a 12 x 10 m room. One
  Slowmer (F01) and one Swarmer (F03), apart, as a one wave lock-free or
  locked arena, whichever the runner allows with the least change (the
  parry corridor in 1-2 is a one wave arena). The S1 vent is [Paul]: a
  marked empty spot.
- **Beat 3, Arena 1, the Pit (A1, 34 x 26 m):** pit 4 m deep, a ledge on
  the south and west, two 6 m ramps at the north and east (walkable by
  the player and by Foamers: check `data/ai.json` `nav` and
  `data/player.json`). Entry from the ledge. Lock trigger on the pit
  floor; the south shutters close. Wave 1: 6 Swarmers, four from the
  north ramp rift, two from the east. Wave 2: 8 Swarmers from the ramps
  and a floor rift, then 2 Slowmers from the floor rift 10 s later. The
  centre block (6 x 4 x 3.5 m) and two pillars (1.6 x 1.6 x 2.8 m) are
  voxel foam pieces. Ammo A2 (30) on the ledge.
- **Beat 4, the breather:** an 8 x 6 m catwalk room. No health pickup.
  The U1 station is [Paul]: a marked empty spot.
- **Beat 5, Arena 2, the Yard (A6, 44 x 36 m):** six islands 4 to 6 m
  wide at 2.5 m (reachable or not as the concept says; Foamers must not
  be trapped on them), four gates, lock trigger in the centre. Wave 1:
  8 Swarmers from rifts at both short ends, 20 s apart. Wave 2: 10
  Swarmers from the ends plus 3 Slowmers from the north wall. The
  islands are voxel pieces (1 to 2 zones each). Ammo A3 and A4 (35 each)
  at the long ends. The S2 growth is [Paul].
- **A temporary exit:** a plain exit pad past the Yard's north gate,
  with a `_note` that the hall, the drop and the Ring come in a later
  card.
- **Swarmers in waves:** find out how a wave's F03 spawns behave (one by
  one at a rift, or as a pack). If the runner needs a change so a wave's
  Swarmers use the pack path (`FoamerSystem.spawnPack`) and the swarm
  token pool, make it in `src/level/` only, and say what you found in
  section 14. Never exceed `swarm.maxAlive` (12) alive or the KIT 6 caps:
  stagger the spawns (the concept says 4 s), with the gaps in the file.
- **The page:** `arena.html?level=1-3` loads it (`src/arena/levels.ts`).
- **Loadout:** the same as Level 1-2. No new blaster (the D04 question in
  the concept's section 8 is Paul's).
- Spaces can be scaled down as LVL-02b did for the Ring if the
  validator's rules need it; say what was scaled in section 14. Names,
  setting and accent colour stay [Paul].

## Done when

- Tests in `tests/level/level-1-3.test.ts`: `1-3.json` validates with its
  arenas in order; a floor under the whole walk from the start to the
  exit; the Pit's ramps and the Yard are walkable on the nav grid (built
  the way the arena page builds it) and the ramps join the floor and the
  ledge; no wave puts more than 12 Swarmers alive; the exit pad does
  nothing until the last arena clears.
- Every other test still passes, none loosened.
- `npx tsc --noEmit`, `npx vitest run`, `npm run build` pass; no em or en
  dashes.
- PLAN.md: an LVL-03a row after the LVL-02d row; decisions in section 14.
  HANDOFF: a dated entry at the top of the Log, Status updated, and what
  was not checked by eye (the spaces, the pacing, the swarm streams on
  the ramps, the frame time with 10 Swarmers).

## Not in this task

Beats 6 to 9 (the hall, the drop that seals, breather 2, the Ring
gauntlet, the lit exit), stations, secrets, health pickups, any new
blaster, the level's name and setting.
