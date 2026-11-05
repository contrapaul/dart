# LVL-02c: Level 1-2 beats 6 to 9 (Crossroads, breather 2, the bowl, the exit)

Written 2026-11-06 (overnight). LVL-02b made the runner play a level's
arenas in order and built Level 1-2 beats 1 to 4 (`data/levels/1-2.json`,
`arena.html?level=1-2`). This card adds the second half of the level from
the LVL-00 concept, which Paul approved: Arena 2, the second breather, the
gauntlet and the exit. Beat 5, the tower set piece, is left for a later
card: four floors over one spot need more nav layers than the grid holds
today (`data/ai.json` `nav.maxLayers` is 2), and that is AI work.

```
ID:          LVL-02c
Title:       Level 1-2 beats 6 to 9: the Crossroads arena (A7), breather 2,
             the tiered bowl gauntlet (A3) and the lit exit, after a marked
             gap where the tower will go
Owner:       Pi (Qwen 3.8 Flash Next, dgx-spark, thinking medium)
Reviewer:    Claude Opus 5.5
Depends on:  LVL-02b (done)
Branch:      lvl-02c, in its own worktree
```

**Running at the same time:** GAME-08 (vacuum: `src/pickups/`, the use
key block of `src/game/game.ts`) and GAME-09b (the Foamer hit and kill
path, `data/blasters.json`, `data/foamers.json`). Your files are
`data/levels/1-2.json`, `src/level/`, `src/arena/` and `tests/level/`. Do
not edit `src/ai/`, `src/foamers/`, `src/pickups/`, `src/player/` or
`data/ai.json`.

## Read first

1. `CLAUDE.md` (place names, the level name and the setting are [Paul])
2. `design/levels/README.md`, `design/levels/BLOCKOUT.md`,
   `design/levels/KIT.md` (A3 Bowl, A7 Crossroads),
   `design/levels/LEVEL-1-2.md` sections 2, 3, 4 (Arena 2, Gauntlet), 6, 7
3. `tasks/LVL-02b.md` and its HANDOFF Log entry and PLAN.md section 14 rows
   (the shared floor slab and perimeter, why the Ring is half scale)
4. `data/levels/1-2.json`, `src/level/` (`level-runner.ts`, `validate.ts`,
   `build.ts`), `src/arena/extras.ts`
5. `tests/level/level-1-2.test.ts`, `tests/level/level-runner.test.ts`

## What to build

All in `data/levels/1-2.json` unless the format truly cannot say it.

- **The gap for beat 5:** from the Ring's north exit, a plain connecting
  corridor with a marked empty bay where the tower will go (a `_note` in
  the file saying so). It must walk: no climb needed.
- **Beat 6, Arena 2, the Crossroads (A7):** a hub with one centre pillar
  and four spokes, lock on a trigger in the hub, every spoke gate shut,
  the entry spoke included. Wave 1: 6 Roamers (F02) from the north, east
  and west spokes, staggered (tuning in the file). Wave 2: 7 Roamers plus
  one Slowmer (F01) from a rift at the pillar's base, the "behind you"
  moment. The pillar's four foam skins as voxel pieces over a solid core.
  Exit as the design says (section 4: the way on is the way back, flagged
  there for review); if the validator or the runner cannot allow it, use
  a fourth spoke instead and say so in section 14.
- **Beat 7, breather 2 (8 x 8 m):** one ammo box; the U2 station and the
  S3 ledge are [Paul] (not built): leave marked empty spots.
- **Beat 8, the Gauntlet bowl (A3):** tiers at 0, 1.2 and 2.4 m reachable
  by walking (steps or ramps no steeper than the player and Foamers can
  climb: check `data/ai.json` `nav` and `data/player.json` for the step
  heights), rifts on the upper tiers. Wave 1: 8 Roamers from two upper
  rifts. Wave 2: 10 Roamers plus a floor rift in the bottom tier's centre.
  Four foam cover pillars on tier 1. Ammo boxes at both bottom corners.
  The floor island that drops is not in this card (no falling floor yet):
  leave a `_note`.
- **Beat 9, the exit:** a lit 4 m door on the far wall, visible from the
  bowl; move the level's exit pad here (out of the beat 4 store).
- Every space can be scaled down as LVL-02b did for the Ring if the
  validator's rules need it; say what was scaled in section 14. Keep the
  wave sizes inside the validator's budget and the live caps.
- Names, setting and accent colour stay [Paul].

## Done when

- Tests in `tests/level/`: `1-2.json` validates with four arenas in order;
  a floor under the whole walk from the start to the new exit; the bowl's
  tiers are walkable on the nav grid (built the way the arena page builds
  it); the exit pad does nothing until the last arena clears; the beat 1
  to 4 tests still pass (update only what moving the exit pad changes).
- `npx tsc --noEmit`, `npx vitest run`, `npm run build` pass; no em or en
  dashes.
- PLAN.md: an LVL-02c row under LVL-02b; decisions in section 14.
  HANDOFF: a dated entry at the top of the Log, Status updated, and what
  was not checked by eye (the spaces, the pacing, the behind you moment,
  the tiers).

## Not in this task

Beat 5, the tower (needs more nav layers: a later card), the lift, the
falling floor island, stations, secrets, the B02 blaster, the level's
name and setting.
