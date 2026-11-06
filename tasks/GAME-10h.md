# GAME-10h: the F08 Trawler, a slow tank that fires walls of foam balls with a gap

Written 2026-11-07. GAME-10a to 10g added the F02 to F07 and F09 types.
The F08 rig is a greybox in `data/foamer-rigs.json` (`movement: tank`,
speed 0.9; parts body, head, drum, armL with launcherL, armR with
launcherR, legs). CONTENT-PLAN F08 (Paul): "Heavy. Slow tank. Attack:
walls of foam balls with gaps. Teaches reading patterns. Weak point: two
arm launchers. Health 80. First seen 3-1. Name: Trawler. Look: a
thicker, more armored mob with emphasis on shields. Deep lime body,
purple shields, orange launchers (weak points)." Section 3.1: "Each
launcher removes half its foam wall." Section 3.3: huge, shoulder
spikes, ammo drum on its back.

```
ID:          GAME-10h
Title:       The F08 Trawler: palette look, a slow advance, a wall of foam
             balls with a gap to slip through, each launcher half of the
             wall and a weak point
Owner:       Pi (Qwen 3.8 Flash Next, dgx-spark, thinking medium)
Reviewer:    Claude Opus 5.5
Depends on:  GAME-10g (done)
Branch:      game-10h, in its own worktree
```

**Running at the same time:** LVL-04a (DeepSeek: `data/levels/1-4.json`,
`src/level/`, `src/arena/levels.ts`, `tests/level/`) and BUG-11 (local
Qwen: `tests/foamers/parts.test.ts`). Do not edit those. Your files:
`data/foamers.json` (F08), `data/foamer-rigs.json` (F08 only),
`src/foamers/`, `src/ai/`, `data/sounds.json`, `design/SOUNDS.md`, new
files in `tests/foamers/` and `tests/ai/`, `design/foamers/`. Change
`src/game/` or `src/range/main.ts` only if the balls' hit on the player
cannot use the existing ball path.

## Read first

Read each once; write yourself a short note instead of rereading.

1. `CLAUDE.md` (no horror; toy weapons)
2. `design/CONTENT-PLAN.md`: the F08 rows (sections 3, 3.1, 3.3, 3.4)
3. `tasks/GAME-10g.md` and its PLAN.md section 14 rows: the pellet
   `BallKind`, `src/foamers/pellet.ts`, the gun-gone stomp
4. `data/foamers.json` (base, F02, F09), the F08 rig
5. `src/foamers/projectiles.ts`, and in `src/foamers/foamers.ts` where
   the F09 stream fires

## What to build

All numbers in data. Three stages; each leaves the game working and is
committed on its own. The starting numbers below are proposals for Paul
to tune, not his.

**Stage 1: look and type.**
- **Look:** the F08 rig's palette: deep lime body and head, purple
  shoulder plates (the "shields") and drum, orange launchers, eyes like
  the others. Shoulder spikes only if the rig format already has a
  shape for them; otherwise say so in HANDOFF. Render the turnaround
  with `npx tsx tools/render-rig.ts F08` into `design/foamers/`.
- **Type:** an `F08` entry in `data/foamers.json` `types` (rig F08,
  health 80). It advances slowly and fires from range: use an existing
  brain if one fits (say which in section 14), keeping about 12 m
  (data) and firing from up to 20 m. The range's type choice spawns it.
  Every other type behaves exactly as before.

**Stage 2: the wall.**
- **Volley:** a windup (start 1.0 s, both launchers lift), then one
  wall, then a recover (start 2.5 s). The wall is a flat row of balls
  across the aim line, all launched at once at the player's chest
  height: `wall.ballsPerLauncher` (start 5) from each launcher,
  `wall.spacingMetres` (start 0.6) apart, so about 6 m wide.
- **The gap:** `wall.gapBalls` (start 2) side-by-side balls are left
  out at a position picked by a seeded PRNG (never `Math.random()`),
  never at the row's ends, so a player who reads it can step through.
- **Balls** are a `BallKind`: slow so the wall can be read (start
  9 m/s), flat (gravity start 0), radius 0.15, damage start 8, no
  bounce, not parryable (not `BALL_MATERIAL`; F08's attack has no P in
  CONTENT-PLAN), orange. They burst on any geometry. A live cap in data
  (start 40).
- **Launchers:** each is a weak point (`weakpointMultiplier`, start 2)
  and owns its half of the row. With one gone, the wall is that one
  half (the gap rule still applies to what is left, or say in section
  14 why not). With both gone it cannot fire: it walks in and stomps (a
  short melee attack on the base melee range, damage start 12).
- **Sounds,** placeholder IDs in `data/sounds.json` and
  `design/SOUNDS.md`: `F08-windup`, `F08-wall` (one sound per wall, not
  per ball), `F08-step`.

**Stage 3: docs** (below).

## Done when

- Tests in new files in `tests/foamers/` and `tests/ai/`: the F08 type
  reads its own spec; a wall launches `2 x ballsPerLauncher - gapBalls`
  balls in one step, in one row across the aim, with the gap never at an
  end; the same seed gives the same gap; a player standing in the gap is
  not hit and one standing beside it is; a wall between it and the
  player stops every ball; a launcher multiplies damage; one launcher
  gone halves the row; both gone means no balls and a stomp in reach;
  the live cap holds; every other type's tests unchanged.
- `npx tsc --noEmit`, `npx vitest run`, `npm run build` pass; no em or en
  dashes.
- PLAN.md: a GAME-10h row under GAME-10g; decisions in section 14.
  HANDOFF: a dated entry at the top of the Log (directly under
  `## Log`), Status updated, and what was not checked by eye.

## Not in this task

Level 3-1, the Trawler in any level file, the drum doing anything
special, two rows or curved walls, vacuum entries, Paul's look notes
beyond the palette.
