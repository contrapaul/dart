# GAME-09d: B06 The Standard gameplay, the mega dart and the shared explosion

Written 2026-11-07. Paul's order of work: every enemy and weapon first.
B06 (CONTENT-PLAN section 4, Paul): "Heavy. Full-auto. Mega dart. 60 /
120. Slower rate of fire than B04, but shots are considerably more
damaging. Mod 1: increased rate of fire. Mod 2: every 5th dart is
explosive. Name: The Standard." The model is built and approved
(`public/models/blasters/B06.glb`, `design/blasters/B06.md`). The mega
dart is shared with B07 later (D14), and CONTENT-PLAN 4: "B05, B06 and
B07 all gain explosive options. Explosions should carve": so the
explosion built here is shared, not B06's own.

```
ID:          GAME-09d
Title:       B06 The Standard: the mega dart, full-auto on its approved
             model, an increased-rate mod, and every fifth dart exploding
             through a shared explosion that carves, pushes and damages
Owner:       Pi (Qwen 3.8 Flash Next, dgx-spark, thinking medium)
Reviewer:    Claude Opus 5.5
Depends on:  GAME-09, GAME-09b (the blaster system, mods, B04's auto)
Branch:      game-09d, in its own worktree
```

**Running at the same time:** GAME-09c (qwen-machine: B02, new fire
modes `semi` and `burst` in `src/weapons/blaster.ts` and
`src/weapons/loadout.ts`, the weapon keys). **Do not change the fire-mode
code in `blaster.ts` or `loadout.ts`:** B06 uses the existing `auto`
mode. Your files: a `B06` entry in `data/blasters.json`, a `mega` dart
type in `data/darts.json`, `mega` damage in `data/foamers.json`, a new
`src/weapons/explosion.ts` and `data/explosion.json`, the dart hit path
(`src/weapons/darts.ts`, `src/weapons/impacts.ts`) only to call the
explosion, `data/sounds.json` and `design/SOUNDS.md` for B06 and the
explosion, new tests in `tests/weapons/`.

## Read first

Read each once; write yourself a short note. First edit by your sixth
reply.

1. `CLAUDE.md` (no gore: an explosion is a foam burst; caps on anything
   that spawns)
2. `design/CONTENT-PLAN.md` section 4 (B06 row and notes), D14
3. `design/blasters/B06.md` (the card and the model's named parts)
4. `data/blasters.json` (B04's entry: auto, spin, recoil, mods),
   `data/darts.json`, the `damage` block in `data/foamers.json`
5. `src/weapons/darts.ts`, `src/weapons/impacts.ts` (where a dart hit
   carves), `src/voxel/carve.ts`, `src/foamers/foamers.ts` `parryDamage`
   (damage that is not a dart)

## What to build

All numbers in data, proposals for Paul to tune.

**Stage 1: the mega dart and the blaster.**
- **Mega dart** (`mega` in `data/darts.json`): bigger and heavier than a
  standard dart (radius about 1.6 times, a little slower, more drop),
  more impulse and a bigger carve (start 0.2 m). A `mega` damage entry
  in the Foamer damage table, start about 3 times standard.
- **B06 entry:** name "The Standard", `model` the approved
  `/models/blasters/B06.glb`, mode `auto`, mega darts, one per shot,
  magazine 60, reserve 120 (start 60), `fireInterval` start 0.17 (about
  6 a second, slower than B04's 0.1), a short spin-up, a heavy recoil
  that climbs slowly, reload 2.4 s, `muzzle_1`, viewmodel numbers of its
  own (it is a big blaster: check it sits low and right like B04).
- **Mod 1, rate:** `fireInterval` start 0.12.
- **Placement:** B06 joins the blaster `order`. GAME-09c is adding a
  fourth weapon key for B02; if B06 needs a fifth slot, say so in HANDOFF
  and leave the key wiring for the review rather than editing
  `game.ts` or the range page.

**Stage 2: the explosion and mod 2.**
- **Shared explosion** (`src/weapons/explosion.ts`, `data/explosion.json`):
  at a point, (1) carve a sphere from the voxel volume through the
  existing carve and island path (start radius 0.6 m), (2) damage every
  Foamer whose centre is in range with a falloff to the edge (start 12 at
  the centre, range 2.5 m), through the same non-dart damage path
  `parryDamage` uses, so it can down or pop, (3) push loose debris and
  pieces outward, (4) a foam burst of chunks inside the debris caps, and
  a sound `FX-explode`. No damage to the player (Paul, 2026-11-07: the
  player's own explosions never hurt the player). A hard cap on explosions per second (start 6).
- **Mod 2:** every fifth mega dart B06 fires is explosive: it explodes
  where it first hits (a wall, the floor or a Foamer). Count shots on
  the blaster, like B04's bounce counter would.
- **Sounds,** placeholder IDs: `B06-fire`, `B06-spin`, `B06-reload`,
  `FX-explode`.

## Done when

- Tests in new files: the mega dart reads its type; B06 reads its spec
  and fires full-auto at its interval; the rate mod fires faster; a mega
  dart does more damage than a standard one on the same part; with mod 2
  the 5th, 10th and 15th darts explode and the others do not; an
  explosion carves voxels, damages a Foamer in range more at the centre
  than at the edge and none outside, and never the player; the cap holds;
  every other blaster's tests unchanged.
- `npx tsc --noEmit`, `npx vitest run`, `npm run build` pass; no dashes.
- PLAN.md: a GAME-09d row after GAME-09c and the B06 row in 5.1 updated;
  decisions in section 14. HANDOFF: a dated entry at the top of the Log
  (directly under `## Log`), with the path from a dart hit to the
  explosion and what was not checked by eye.

## Not in this task

B05 and B07, the explosive mod on any other blaster, where B06 is found
in a level, animations of the model's parts beyond what B04's motion
block already gives.
