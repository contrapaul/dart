# LVL-04b: Level 1-4 beats 6 to 10 (the Pit, breather 2, the mini-boss Ring, the Yard, the lift)

Written 2026-11-07. LVL-04a built beats 1 to 5 of Level 1-4 in
`data/levels/1-4.json`: the forecourt, the explore room, the A4 hall, the
alcove and the A8 bridge, ending on a temporary exit pad on the ring
under the bridge. This card finishes the level from its LVL-00 concept.

```
ID:          LVL-04b
Title:       Level 1-4 beats 6 to 10: Arena 2 the Pit (A1), breather 2,
             the mini-boss Ring (A2) with two promoted Darters, the Yard
             gauntlet (A6) and the lit lift exit
Owner:       Pi (DeepSeek V4.1 Flash, openrouter, thinking high)
Reviewer:    Claude Opus 5.5
Depends on:  LVL-04a (done)
Branch:      lvl-04b, in its own worktree
```

**Running at the same time:** GAME-10h (the Spark: `src/foamers/`,
`src/ai/`, the F08 entry in `data/foamers.json`, `tests/foamers/`). Your
files are `data/levels/1-4.json`, `src/level/`, `src/arena/`,
`tests/level/`, and in `data/foamers.json` only a new top-level
`promoted` block (stage 2). Do not edit `src/ai/`, `src/foamers/`,
`src/player/`, `data/ai.json`, or any type entry in `data/foamers.json`.

## Read first

1. `CLAUDE.md` (place names, the level name and the setting are [Paul])
2. `design/levels/LEVEL-1-4.md` sections 2, 3, 4 (Arena 2, the
   mini-boss arena, the gauntlet), 5, 6 and 7; `design/levels/KIT.md`
   (A1 Pit, A2 Ring, A6 Yard, section 6 caps)
3. `tasks/LVL-04a.md`, its HANDOFF Log entries and PLAN.md section 14
   rows
4. `data/levels/1-4.json` (the end of it: the ring under the bridge and
   the temporary pad), `data/levels/1-3.json`'s Pit and Ring (copy their
   shapes, do not reread them)
5. `src/level/format.ts` (`WaveSpawn.promoted`), `src/level/arena.ts`,
   `src/arena/extras.ts` (the page's `spawn`, which ignores `promoted`)

## What to build

Three stages; each leaves the game working and is committed on its own.
Write the JSON with short python scripts, never as one big reply.

**Stage 1: the Pit and breather 2.**
- Remove the temporary exit pad. From the ring under the bridge, the way
  on leads to **Arena 2, the Pit (A1, 34 x 26 m, 4 m deep, two 6 m
  ramps, 12 m ceiling)**. Lock trigger on the pit floor, 8 m in. Wave 1:
  2 Darters (north-east and north-west rifts) and 6 Swarmers (floor).
  Wave 2: 3 Darters and 6 Roamers. The centre block (3 zones) and two
  ring pillars (1 zone each) are voxel foam pieces. The concept's floor
  island on the west ramp's top (3.2 x 0.4 x 3.2 m, a voxel piece over a
  hole) goes in if the nav grid and validator allow it; if not, say why
  in section 14. Ammo A3 (8) on the ring.
- **Breather 2 (10 x 8 m, above the pit):** ammo is not here (the
  concept's section 6 puts A3 on the Pit's ring). The U2 station and the
  S3 ledge are [Paul]: marked empty spots.

**Stage 2: the mini-boss Ring and promoted Foamers.**
- **Promoted Foamers:** the page's `spawn` ignores `promoted`. Make a
  promoted spawn have more health, from a new top-level `promoted` block
  in `data/foamers.json` (`healthMultiplier`, start 1.5, so a Darter has
  45). If setting the health needs a change in `src/foamers/`, stop and
  say so in HANDOFF instead of making it. **The look (Paul,
  2026-11-07):** a promoted Darter has orange plates (its `chest` and
  `brow` parts, lime on the plain one). Swapping part materials needs
  `src/foamers/`, which GAME-10h owns, so it is a later step after
  GAME-10h merges: write the swap into the `promoted` block as data
  (`F05: { chest: "foam-orange", brow: "foam-orange" }`) and leave the
  code for that step.
- **The Ring (A2, 30 x 30 m, 10 x 8 m centre block 3.5 m tall, 6 m ring,
  8 m ceiling, all four shutters):** wave 1: 2 promoted Darters from
  opposite rifts. Wave 2: 6 Swarmers from two floor rifts, started when
  the pair is down to 50% of their total health. If the runner cannot
  start a wave on health with a small change in `src/level/` (and the
  page telling it the health), start it 20 s after wave 1 and say so in
  section 14. No third wave. Four 1.6 x 1.6 x 2.8 m voxel pillars. Ammo
  A4 (10) in the ring, A5 (6) on the block.

**Stage 3: the Yard and the lift.**
- **The Yard (A6, 44 x 36 m, 9 m ceiling, six islands of 1 to 2 zones
  each):** wave 1: 2 Darters (short ends) and 8 Swarmers. Wave 2: 3
  Darters, 6 Roamers and 4 Swarmers. That is 13: stagger the spawns so
  no more than the KIT cap is ever alive, with the gaps in the file.
  Ammo A6 and A7 (12 each) at the long ends.
- **The lift exit (3 x 3 m):** the level's exit pad, lit, visible from
  the Yard's centre about 30 m away. It does nothing until the Yard
  clears.

## Done when

- Tests in `tests/level/level-1-4.test.ts`: the file validates with all
  its arenas in order; a floor under the whole walk from the start to
  the lift; the Pit's ramps, the Ring and the Yard are walkable on the
  nav grid (built the way the arena page builds it) and join their
  entries; a promoted spawn has `healthMultiplier` times the health and
  an ordinary one does not; the Ring's wave 2 starts by its rule; no
  wave puts more than the KIT cap alive; the lift does nothing until the
  last arena clears. Every LVL-04a test still passes, none loosened.
- `npx tsc --noEmit`, `npx vitest run`, `npm run build` pass; no em or en
  dashes.
- PLAN.md: an LVL-04b row after the LVL-04a row; decisions in section 14.
  HANDOFF: a dated entry at the top of the Log (directly under
  `## Log`), Status updated, and what was not checked by eye.

## Not in this task

The promoted look in code (a later step), stations, secrets, health pickups, a blaster pickup,
the act boss, the level's name and setting.
