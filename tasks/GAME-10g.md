# GAME-10g: the F09 Crawler, a four-legged turret walker with a pellet stream

Written 2026-11-07. GAME-10a to 10f added the F02 to F07 types. The F09
rig is a greybox in `data/foamer-rigs.json` (`movement: spider`, speed
1.8, health 40; parts body, gun, barrelL, barrelR, four legs with shins).
CONTENT-PLAN F09 (Paul): "Heavy. Turret walker, sustained fire. Attack:
stream of pellets. Teaches using cover, carving cover. Weak point: its
gun. Health 40. First seen 2-3. Name: Crawler. Look: a 4-legged tank,
very menacing compared to fodder. Deep orange body, purple legs, lime gun
(weak point)." Section 3.1: parts gun and legs; losing the gun ends its
attack.

```
ID:          GAME-10g
Title:       The F09 Crawler: palette look, a keep-distance brain, a
             sustained stream of small pellets that cover and voxel walls
             stop, the gun a weak point that can be shot off
Owner:       Pi (Qwen 3.8 Flash Next, dgx-spark, thinking medium)
Reviewer:    Claude Opus 5.5
Depends on:  GAME-10c, GAME-10f (done)
Branch:      game-10g, in its own worktree
```

**Running at the same time:** LVL-03b (DeepSeek: `data/levels/1-3.json`,
`src/level/`, `tests/level/`) and BUG-09 (local Qwen:
`tests/foamers/finisher.test.ts`). Do not edit those. Your files:
`data/foamers.json` (F09), `data/foamer-rigs.json` (F09 only),
`src/foamers/`, `src/ai/`, `data/sounds.json`, `design/SOUNDS.md`,
`tests/foamers/`, `tests/ai/`, `design/foamers/`. Change `src/game/` or
`src/range/main.ts` only if the pellets' hit on the player cannot use
the existing ball path.

## Read first

Read each once; write yourself a short note instead of rereading.

1. `CLAUDE.md` (no horror; toy weapons)
2. `design/CONTENT-PLAN.md`: the F09 rows (sections 3, 3.1, 3.3, 3.4)
3. `tasks/GAME-10c.md` and its PLAN.md section 14 rows: the `BallKind`
   per launch in `src/foamers/projectiles.ts` and `src/foamers/blob.ts`
4. `data/foamers.json` (base, F02, F06), the F09 rig
5. `src/foamers/projectiles.ts`, and in `src/foamers/foamers.ts` where a
   ranged attack fires (the F06 blob branch)

## What to build

All numbers in data. Three stages; each leaves the game working and is
committed on its own.

**Stage 1: look and type.**
- **Look:** the F09 rig's palette: deep orange body, purple legs and
  shins, lime gun and barrels, eyes like the others. Render the
  turnaround with `npx tsx tools/render-rig.ts F09` into
  `design/foamers/`.
- **Type:** an `F09` entry in `data/foamers.json` `types` (rig F09,
  health 40) on the keep-distance ranged brain (`decideF02`: say in
  section 14 if it fits as it is), keeping about 14 m (data). The
  range's type choice spawns it. Every other type behaves exactly as
  before.

**Stage 2: the pellet stream.**
- **Burst:** a windup (start 0.8 s, the barrels spin up), then a stream
  of `pellets.count` (start 12) small pellets, one every
  `pellets.intervalSeconds` (start 0.1), aimed at the player's eye with a
  small random spread (`pellets.spreadDeg`, start 3; a seeded PRNG, never
  `Math.random()`), then a recover. Damage per pellet small (start 2).
- **Pellets** are a `BallKind`: fast (start 22 m/s), nearly flat
  (gravity start 1), small (radius 0.05), no bounce, not parryable (not
  `BALL_MATERIAL`), lime. They burst on any geometry, so cover and voxel
  walls stop them. A live cap in data (start 24).
- **Weak point:** the gun takes `weakpointMultiplier` (start 2) damage.
  With the gun or both barrels gone it cannot fire: it walks up and
  stomps (a short melee attack on the base melee range, damage start 8).
- **Sounds,** placeholder IDs in `data/sounds.json` and
  `design/SOUNDS.md`: `F09-spinup`, `F09-pellet` (cheap, many voices
  capped), `F09-step`.

**Stage 3: docs** (below).

## Done when

- Tests in `tests/foamers/` and `tests/ai/`: the F09 type reads its own
  spec; a burst fires exactly `pellets.count` pellets at the interval;
  the spread is the same for the same seed; a wall between it and the
  player stops every pellet; the gun multiplies damage; gun gone means
  no pellets and a stomp in reach; the live cap holds; every other
  type's tests unchanged.
- `npx tsc --noEmit`, `npx vitest run`, `npm run build` pass; no em or en
  dashes.
- PLAN.md: a GAME-10g row under GAME-10f; decisions in section 14.
  HANDOFF: a dated entry at the top of the Log (directly under
  `## Log`), Status updated, and what was not checked by eye.

## Not in this task

Level 2-3, the Crawler in any level file, carving cover by its pellets,
climbing walls, vacuum entries.
