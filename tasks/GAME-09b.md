# GAME-09b: the chunk finish (catastrophic hits that are not pops)

Written 2026-11-05 (overnight). Paul's D12 (`design/CONTENT-PLAN.md`):
catastrophic deaths beyond the whole Foamer exploding; for example a close
range blast with B03 could blow a huge chunk out of a mid-tier enemy or a
heavily weakened elite or boss, ending it in a big burst of foam, but not
the whole body popping. Today a kill either pops (`catastrophic.popTypes`,
empty on purpose: no starter dart pops) or goes down as a ragdoll.

```
ID:          GAME-09b
Title:       A big enough close hit from the right blaster on a mid-tier or
             weakened Foamer blows a large chunk out of it, sprays a foam
             burst, and finishes it: it goes down with the hole in it
Owner:       Pi (DeepSeek V4.1 Flash, openrouter deepseek/deepseek-v4.1-flash-1017)
Reviewer:    Claude Opus 5.5
Depends on:  GAME-09, ENG-10, ENG-12, GAME-07, GAME-10d (done)
Branch:      game-09b, in its own worktree
```

**Running at the same time:** GAME-08 (vacuum: `src/pickups/`, the use key
block of `src/game/game.ts`, the Foamer removal path, `vacuum` entries in
`data/foamers.json`) and LVL-02b (`src/level/`, `src/arena/`,
`data/levels/`). Stay out of those. Keep your edits to `foamers.ts` to the
hit and kill path.

## Read first

1. `CLAUDE.md` (foam only: the chunk is foam core and foam debris, never
   anything like gore; no starter dart pops)
2. `design/CONTENT-PLAN.md` D12 and section 3.2; PLAN.md 3.2
3. `src/foamers/foamers.ts` (`handleHit`, the kill: `catastrophic`,
   `recentDamage`, `pop`, `goDown` with the hit's push, `paintWound`,
   `breakPart`), `src/foamers/foamer.ts`, `data/foamers.json`
   (`catastrophic`, the types' rigs and the rig `tier` in
   `data/foamer-rigs.json`)
4. `src/weapons/blaster.ts`, `src/weapons/darts.ts`, `src/weapons/impacts.ts`,
   `data/blasters.json` (B03 break action 8 per shot, B01 and its slug mod),
   `data/darts.json`
5. `src/voxel/carve.ts`, `src/voxel/debris.ts` (the caps)

## What to build

All numbers in data: a `chunk` block on each blaster (or mod) that can do
it, and a `chunk` block in the Foamer base spec.

- **Which shots:** a blaster or mod with a `chunk` block: B03 (start
  `rangeMetres` 5) and B01's slug mod (start 8). A shot's darts carry what
  they need (the blaster's chunk data and the muzzle position) so the hit
  can judge range.
- **Which Foamers:** a type whose rig tier is in `chunk.tiers` (start
  `["Heavy", "Elite", "Boss"]`), or any Foamer already finishable
  (`finishWeakened`). F01, F02 and F03 at full health just go down as now.
- **The rule:** when such a shot kills and its own darts' damage on that
  Foamer within `catastrophic.window` is at least `chunk.minShare` of max
  health (start 0.25), it is a chunk finish instead of a plain go down.
  Pops are unchanged (`popTypes` still empty).
- **The chunk:** carve a large sphere (start `chunk.carveRadius` 0.35 m)
  centred on the mean hit point of that shot's darts, through the parts it
  reaches; a foam burst of debris from the hole, inside the existing debris
  caps (`chunk.debrisMax`, start 40); the Foamer goes down as a ragdoll
  pushed hard along the shot (`chunk.push`), hole and all, then lies and
  sinks as now. A part the carve takes below its break line breaks off.
- **Sound:** placeholder `FX-chunk` in `data/sounds.json` and
  `design/SOUNDS.md`.
- **Range page:** a switch or button to make the spawned Foamer weakened,
  so the chunk can be tried on an F01.

## Done when

- Tests in `tests/foamers/`: a close B03 shot that kills an F05 is a
  chunk finish; the same shot from beyond `rangeMetres` is a go down; a
  B03 kill on a full health F01 is a go down, on a weakened F01 a chunk;
  the slug mod qualifies, the plain B01 does not; the carve removes voxels
  around the mean hit point and debris stays inside its cap; no starter
  dart pops (the existing test unchanged).
- `npx tsc --noEmit`, `npx vitest run`, `npm run build` pass; no em or en
  dashes.
- PLAN.md: the GAME-09b row points to this card; decisions in section 14.
  HANDOFF: a dated entry at the top of the Log, Status updated, and what
  was not checked by eye (the hole, the burst, the push, the sound).

## Not in this task

Area blasts (B05 and B06 mods, B07: not built yet), pops from new dart
types, finisher variety.
