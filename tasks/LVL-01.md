# LVL-01: the first arena, built from a level file

Written 2026-11-03 after LVL-00 (Paul approved the concepts in
`design/levels/`). Paul's direction: "Levels will be semi-open but follow
a linear path as in the modern Doom games."

```
ID:          LVL-01
Title:       A level loader for the blockout format, arena lock-ins with
             waves from rifts, and the 1-1 Pit as the first arena
Owner:       Pi (DeepSeek V4.1 Flash)
Reviewer:    Claude Opus 5.5
Depends on:  LVL-00 (done), ENG-06, ENG-08, UI-01 (all done)
Branch:      lvl-01, in its own worktree
```

## Read first

1. `CLAUDE.md` (every rule applies to you)
2. `design/levels/BLOCKOUT.md` (the format), `design/levels/LEVEL-1-1.md`
   section 4 "Arena 1: Pit" and its worked example in BLOCKOUT.md 4,
   `design/levels/README.md` 2 and 4 (pillars, wayfinding),
   `design/levels/KIT.md` (A1 Pit, budgets)
3. `src/main.ts` (how the test course builds boxes, the voxel volume,
   debris, pieces, darts, Foamers, the level AI, health, restart, the
   loop), `src/range/main.ts` (`?watch` mode and `window.dartRange`)
4. `src/foamers/foamers.ts` (`spawn`, `spawnCount`, `clear`, `list`,
   `downed`, `onSound`), `src/ai/level.ts` (`makeLevelAI`, re-bakes)
5. `src/voxel/` (`VoxelVolume`, `VolumeMesh`, `FallingPieces`, carve and
   islands), `data/materials.json`

## What to build

### Stage 1: format, validator, builder (no page yet)

- `src/level/format.ts`: TypeScript types for the subset of the
  BLOCKOUT.md format this task uses: `meta`, `shell` (boxes and ramps),
  `pieces` (voxel volumes with material and an anchor), `arenas`
  (trigger, doors, rifts, waves, `unlockOnClear`), `pickups` (types only,
  not spawned yet), `playerStart`, `exit`. Leave out stations and
  secrets beyond the types.
- `src/level/validate.ts`: the checks in BLOCKOUT.md 5 that apply to
  these fields (1, 2, 3, 4, 5, 6, 9, 11, 12), returning a list of
  readable errors and warnings. A level with errors does not load: the
  page shows the list.
- `src/level/build.ts`: builds the shell (meshes plus fixed colliders, the
  same way `addBox` does in main.ts, ramps rotated), one `VoxelVolume`
  for all pieces with a bedrock layer under each anchored piece, doors as
  boxes whose collider and mesh can be switched on and off, and returns
  the bounds for the nav grid. No Three.js work in the validator, so it
  runs in Node tests.
- `data/levels/1-1-pit.json`: the Pit from LEVEL-1-1 4 and BLOCKOUT.md 4.
  A short start room (about 12 x 10 m) and a 12 m corridor lead to the
  entry ring; the pit is 34 x 26 m, its floor 4 m below the ring, two
  ramps, the centre block (3 volumes) and two pillars, three rifts, the
  lock trigger 8 m in, the entry door and side shutters that close, a
  locked exit door, and a lit exit pad behind it. Every walking surface
  is shell. Tuning numbers (wave gaps, lock delay) go in the level file
  or `data/`, not in code.
- Tests in `tests/level/`: the pit file validates clean; each validator
  rule catches a broken copy; the builder's shell and piece counts and
  bounds match the file (Rapier only, no renderer).

### Stage 2: arenas, lock-in and waves

- `src/level/arena.ts`: one state machine per arena, pure logic fed by
  the page: `waiting` (player not yet in the trigger), `locked` (doors
  close, rifts glow, a short delay), `wave n` (spawn the wave at its
  rifts, spread over `holdSeconds` if given), next wave when the current
  one is cleared (down or popped counts as cleared), `cleared` (doors in
  `unlockOnClear` open). Events out for sound and HUD: `locked`,
  `waveStart`, `cleared`.
- Foamers come from `FoamerSystem.spawn` at the rift positions with
  `spawnCount = 0`, so the old spawner never runs on this page. Spawns
  start `alert` (they come out of a rift into a fight).
- A player who pops while locked in restarts at the arena's entry with
  the arena reset to `waiting` (checkpoint), Foamers cleared, voxels left
  as they are.
- Tests: the state machine runs through waiting, locked, both waves and
  cleared on a fake Foamer count; a restart mid-wave resets it; the exit
  door is shut until clear and open after.

### Stage 3: the page

- `arena.html` and `src/arena/main.ts`: loads `data/levels/1-1-pit.json`
  and plays it with everything main.ts has (blasters, darts, carving,
  debris, falling pieces, Foamers with the level AI, health, HUD, pause
  menu, settings, sounds). Do not copy main.ts wholesale: move the shared
  wiring into a module both pages use (for example `src/game/`), and keep
  the test course on `index.html` behaving exactly as before. If that
  split grows past what is safe, say so in HANDOFF and keep the copy
  small.
- HUD: a short banner on lock ("Clear the arena"), the wave number, and
  "Arena clear" on unlock. Sounds for the door closing and opening and a
  rift opening (placeholder sound IDs added to `data/sounds.json` and
  `design/SOUNDS.md`).
- Rifts are visible before the lock (a dim seam) and glow when open.
  The way on is the brightest thing in the room (README 4).
- Reaching the exit pad shows "Level complete" with a Play again button.
- A link to the arena from the index page overlay, and `arena` added to
  the Vite build inputs so it deploys.
- `arena.html?watch`, like the range: starts without pointer lock, and
  `window.dartArena` has `state()` (arena state, wave, alive Foamers,
  player position, doors), `moveTo(x, y, z)`, `look(yaw, pitch)`,
  `pause(on)`, `fire()` and `step(n)` (n fixed steps, for a hidden
  browser pane with no animation frames).
- Frame budget: watch the frame graph numbers with the range's benchmark
  habit in mind; if the pit costs more than the test course, say how much
  in HANDOFF.

## Done when

- `npx tsc --noEmit`, `npx vitest run` and `npm run build` pass, and no
  em or en dashes are added.
- In `arena.html?watch`, stepping into the pit closes the doors, wave 1
  (3 Slowmers) then wave 2 (5) come out of the rifts and walk at the
  player round the centre block, the exit opens once all are down, and
  walking to the pad shows Level complete.
- `index.html` plays exactly as before.
- PLAN.md: LVL-01 row points to this card; decisions in section 14.
  HANDOFF: a dated entry at the top of the Log, status updated.

## Not in this task

Pickups and ammo, stations, secrets, the rest of level 1-1, a level
editor, setting art. Names, setting and accent colour stay [Paul].
