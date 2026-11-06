# LVL-04a: Level 1-4 beats 1 to 5 (open, explore, the hall, the alcove, the bridge)

Written 2026-11-07. Level 1-3 is built (`data/levels/1-3.json`, LVL-03a,
LVL-03b). This card starts Level 1-4 from its LVL-00 concept, which Paul
approved: the Darter's level, where a charge needs a line, the back is
soft and the shield charge answers a charge. The second half (the Pit,
breather 2, the mini-boss Ring, the Yard gauntlet, the lift) is a later
card. `data/levels/1-4-ring.json` is GAME-10b's test Ring: leave it and
its `?level=1-4-ring` entry as they are.

```
ID:          LVL-04a
Title:       Level 1-4 beats 1 to 5: the forecourt, the explore room with
             the first Darter, Arena 1 the long hall (A4), the mid-hall
             alcove and the bridge set piece (A8) with its drop, with a
             temporary exit on the ring below
Owner:       Pi (DeepSeek V4.1 Flash, openrouter, thinking high)
Reviewer:    Claude Opus 5.5
Depends on:  LVL-03b (done), GAME-10b (the F05 Darter, done)
Branch:      lvl-04a, in its own worktree
```

**Running at the same time:** GAME-10h (the Spark: `src/foamers/`,
`src/ai/`, `data/foamers.json`, new tests in `tests/foamers/`) and BUG-11
(local Qwen: `tests/foamers/parts.test.ts`). Your files are a new
`data/levels/1-4.json`, `src/level/`, `src/arena/` (only to list the new
level) and `tests/level/`. Do not edit `src/ai/`, `src/foamers/`,
`src/player/`, `data/ai.json` or `data/foamers.json`.

## Read first

1. `CLAUDE.md` (place names, the level name and the setting are [Paul])
2. `design/levels/README.md`, `design/levels/BLOCKOUT.md`,
   `design/levels/KIT.md` (A4 Hall, A8 Bridge, section 6 caps),
   `design/levels/LEVEL-1-4.md` sections 1, 2, 3, 4 (Arena 1 and the
   bridge only), 6 and 7
3. `tasks/LVL-03b.md`, its HANDOFF Log entries and PLAN.md section 14
   rows (`noLock`, `escape`, the drop through a hole in the floor)
4. `data/levels/1-3.json` (copy its shape, do not reread it),
   `src/level/` (`level-runner.ts`, `validate.ts`, `build.ts`),
   `src/arena/levels.ts`
5. `tests/level/level-1-3.test.ts`
6. The F05 `charge` block in `data/foamers.json` (read only: how long a
   run-in its charge needs)

## What to build

All in `data/levels/1-4.json` unless the format truly cannot say it.
Write the JSON with short python scripts, never as one big reply.

- **Beat 1, the forecourt (20 x 14 m):** player start. No foam dummy
  exists: put four small voxel foam pieces at 4, 6, 10 and 15 m to shoot
  and say so in a `_note`. One ammo box (A1, 24) beside the way on.
- **The new blaster:** the concept puts B03 on a stand. Find out how the
  arena page sets the loadout. If a level cannot hand out a blaster,
  start the level with B03 in the loadout (the order in
  `data/blasters.json` already has it) and say so in section 14; do not
  build a blaster pickup.
- **Beat 2, explore 1:** a 14 m corridor and a 16 x 12 m room with two
  1.6 m cover pillars. One Darter (F05) at about 30 m from the room's
  door, as a one-wave arena, locked or not, whichever the runner allows
  with the least change. The S1 broken wall is [Paul]: a marked empty
  spot.
- **Beat 3, Arena 1, the long hall (A4, 18 x 44 m, 7 m ceiling):** six
  1.2 x 1.2 x 4 m columns, staggered, 8 m apart; three are voxel foam
  pieces, three are solid. Lock trigger at the fourth column, 18 m in.
  Wave 1: 1 Darter from the north wall, 4 Swarmers from the floor at
  30 m. Wave 2: 2 Darters (north and east) and 4 Roamers (west wall).
  Ammo A2 (8) at column 3. The Darter needs about 14 m to reach full
  charge: check the hall gives it that along the columns.
- **Beat 4, the alcove (8 x 8 m, off the hall):** the U1 station is
  [Paul], a marked empty spot. No ammo here: A2 is at column 3, as the
  concept's section 6 says.
- **Beat 5, the bridge (A8):** two 16 x 16 m yards joined by a 4 x 24 m
  bridge, 9 m above an 8 m wide ring floor. One Darter in each yard,
  no lock (`noLock`), so the player may fight across or drop. The two
  3.2 x 3.2 x 0.5 m blast walls in the near yard are voxel foam pieces;
  one hides the way down, the other is the S2 spot ([Paul], marked
  empty). The ring below is where the level goes on. There is no fall
  damage in the game (check `data/player.json`); say so in a `_note`.
- **A temporary exit:** a plain exit pad on the ring below the bridge,
  with a `_note` that the Pit, breather 2, the mini-boss Ring, the Yard
  and the lift come in a later card.
- **The page:** `arena.html?level=1-4` loads it (`src/arena/levels.ts`).
- Spaces can be scaled down as earlier levels did if the validator's
  rules need it; say what was scaled in section 14. Names, setting and
  accent colour stay [Paul]. Never exceed the KIT 6 caps.

## Done when

- Tests in `tests/level/level-1-4.test.ts`: `1-4.json` validates with
  its arenas in order; a floor under the whole walk from the start to
  the exit; the hall and both bridge yards are walkable on the nav grid
  (built the way the arena page builds it) and the bridge joins the two
  yards; a straight line of at least 14 m runs along the hall between
  the columns; the drop from the bridge lands on the ring floor; the
  exit pad does nothing until the last arena ends.
- Every other test still passes, none loosened.
- `npx tsc --noEmit`, `npx vitest run`, `npm run build` pass; no em or en
  dashes.
- PLAN.md: an LVL-04a row after the LVL-03b row; decisions in section
  14. HANDOFF: a dated entry at the top of the Log (directly under
  `## Log`), Status updated, and what was not checked by eye (the
  spaces, the charges along the hall, the shield charge on the bridge,
  the drop).

## Not in this task

Beats 6 to 10 (the Pit, breather 2, the mini-boss Ring with promoted
Darters, the Yard gauntlet, the lift), stations, secrets, health
pickups, a blaster pickup, the level's name and setting.
