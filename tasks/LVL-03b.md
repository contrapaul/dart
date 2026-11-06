# LVL-03b: Level 1-3 beats 6 to 9 (the hall chase, the drop, breather 2, the Ring, the exit)

Written 2026-11-06. LVL-03a built beats 1 to 5 of Level 1-3 in
`data/levels/1-3.json` with a temporary exit pad past the Yard's north
gate. This card finishes the level from its concept,
`design/levels/LEVEL-1-3.md` section 2 beats 6 to 9 and section 4 (the
set piece and the gauntlet).

```
ID:          LVL-03b
Title:       Level 1-3 beats 6 to 9: the A4 hall chase into a 6 m drop that
             seals behind, breather 2, the A2 Ring gauntlet and the lit
             north exit, replacing the temporary exit
Owner:       Pi (DeepSeek V4.1 Flash, openrouter, thinking high)
Reviewer:    Claude Opus 5.5
Depends on:  LVL-03a (done)
Branch:      lvl-03b, in its own worktree
```

**Running at the same time:** GAME-10f (the Spark: `src/foamers/`,
`src/ai/`, `data/foamers.json`) and BUG-09 (local Qwen:
`tests/foamers/finisher.test.ts`). Your files: `data/levels/1-3.json`,
`src/level/`, `tests/level/`. Do not edit `src/ai/`, `src/foamers/`,
`src/player/`, `data/ai.json` or `data/foamers.json`.

## Read first

1. `CLAUDE.md` (place names, the level name and the setting are [Paul])
2. `design/levels/LEVEL-1-3.md` sections 2, 4 (set piece, gauntlet), 5, 6
   and 7; `design/levels/KIT.md` (A2 Ring, A4 Hall, section 6 caps)
3. `tasks/LVL-03a.md`, its HANDOFF Log entries (yours and the review's)
   and its PLAN.md section 14 rows
4. `data/levels/1-3.json` as it is now, `src/level/` (`level-runner.ts`,
   `validate.ts`, `build.ts`, `format.ts`)
5. `tests/level/level-1-3.test.ts` (extend it; keep test 4d green)

## What to build

All in `data/levels/1-3.json` unless the format truly cannot say it. Write
the JSON with short python scripts, never as one big reply.

- **Remove the temporary exit** and continue north from the Yard's north
  gate.
- **Beat 6, the hall (A4, 18 x 44 m, six columns, 7 m ceiling):** three
  columns voxel (1 zone each), three shell. The last 6 m of floor is
  missing: a 6 m drop into breather 2. **No lock:** 12 Swarmers spawn
  behind the player at the hall's mouth when they enter, staggered (the
  concept's 4 s gaps), and chase them down the lane. The player may run.
- **The drop seals** 3 s after the player lands at the bottom. Find out
  what the runner can say today (door states are `open`, `locked`,
  `sealed`; how the 1-2 parry corridor runs a one-wave arena). If a
  lock-free wave that spawns on entry, or a door that seals on a trigger
  after a delay, needs a change, make the smallest one in `src/level/`
  and say what you found in section 14. Swarmers that did not follow
  must not be left alive blocking anything later: say what happens to
  them.
- **Beat 7, breather 2 (10 x 8 m) at the bottom of the drop:** ammo A3 per
  the concept's section 6 table (it lists A3 twice: use a new id, say
  which in a `_note`). The U2 station and the S3 ledge are [Paul]: marked
  empty spots, as LVL-03a did for U1 and S2.
- **Beat 8, the Ring (A2, 30 x 30 m, a 10 x 8 m centre block 3.5 m high,
  6 m ring):** four rifts, one per side; four 1.6 x 1.6 x 2.8 m voxel
  pillars in the ring. Wave 1: 10 Swarmers. Wave 2: 12 Swarmers plus 4
  Roamers (F02), the Roamers last. Ammo A5 (60, north-west corner) and A6
  (20, on top of the block, reachable by the mantle chain on the east
  side: check `data/player.json`).
- **Beat 9, the exit:** a 3 m north door, lit, visible from the ring's
  east side, that opens when the Ring clears; the exit pad behind it.
- **Caps:** never more than `swarm.maxAlive` (12) Swarmers alive and
  within the KIT section 6 caps; stagger spawns with the gaps in the
  file. Every rift on walkable ground (test 4d covers it).
- Scale spaces down only if the validator needs it; say what in
  section 14. Names, setting and accent colour stay [Paul].

## Done when

- Tests in `tests/level/level-1-3.test.ts`: the file validates with all
  five arenas or events in order; floor under the whole walk from the
  start through the hall to the drop's lip, and from the drop's foot to
  the exit; the Ring's ring and the block's top walkable on the nav grid
  and the ring a loop; the drop cannot be climbed back (no nav path from
  breather 2 up to the hall); the seal closes 3 s after landing; no wave
  puts more than 12 Swarmers alive; the exit does nothing until the Ring
  clears.
- Every other test still passes, none loosened.
- `npx tsc --noEmit`, `npx vitest run`, `npm run build` pass; no em or en
  dashes.
- PLAN.md: an LVL-03b row after LVL-03a; decisions in section 14.
  HANDOFF: a dated entry at the top of the Log, Status updated, and what
  was not checked by eye.

## Not in this task

Secrets' contents, stations, health pickups, a new blaster, the level's
name and setting.
