# GAME-09e: B05 Shrike gameplay, the precision dart, pierce and zoom

Written 2026-11-07. Paul's order of work: every enemy and weapon first.
B05 (CONTENT-PLAN section 4, Paul): "Precision. Bolt or spring sniper,
zoom. Precision dart (whistler). 5 / 30. Long range, weak-point killer,
piercing rounds. Mod 1: explosive rounds. Mod 2: heavier rounds which
pierce through multiple enemies. Name: Shrike." The model is built and
approved (`public/models/blasters/B05.glb`, `design/blasters/B05.md`).
The shared explosion exists (GAME-09d, `src/weapons/explosion.ts`), and
the player's own explosions never hurt the player (Paul).

```
ID:          GAME-09e
Title:       B05 Shrike: the precision dart that pierces, a bolt cycle
             between shots, a zoom while held, an explosive-rounds mod and
             a heavier-rounds mod that pierces several Foamers
Owner:       Pi (Qwen 3.8 Flash Next, dgx-spark, thinking medium)
Reviewer:    Claude Opus 5.5
Depends on:  GAME-09, GAME-09b, GAME-09d (the shared explosion)
Branch:      game-09e, in its own worktree
```

**Running at the same time:** GAME-09c (qwen-machine: B02, new fire
modes in `src/weapons/blaster.ts`, `src/weapons/loadout.ts`,
`src/weapons/viewmodel.ts`, the weapon keys in `src/game/game.ts` and the
range page). **Do not change fire-mode, loadout or viewmodel code.** B05
uses the existing `pump` mode: its `primeTime` is the bolt cycle.
Your files: a `B05` entry in `data/blasters.json`, a `precision` dart
type in `data/darts.json`, `precision` damage in `data/foamers.json`, the
pierce in `src/weapons/darts.ts`, a new `src/game/zoom.ts` and its data,
a `zoom` action in `data/input.json`, the zoom's few lines where the
camera's field of view is set in `src/game/game.ts` (not the weapon key
lines), `data/sounds.json` and `design/SOUNDS.md` for B05, new tests in
`tests/weapons/` and `tests/game/`.

## Read first

Read each once; write yourself a short note. First edit by your sixth
reply.

1. `CLAUDE.md`
2. `design/CONTENT-PLAN.md` section 4 (B05 row and notes)
3. `design/blasters/B05.md` (the card; the model's parts: `bolt`,
   `trigger`, `mag`, `muzzle_1`)
4. `data/blasters.json` (B01's pump entry, B06's explosive mod),
   `data/darts.json`, the `damage` block in `data/foamers.json`
5. `src/weapons/darts.ts` (a dart's hit and what stops it),
   `src/weapons/explosion.ts`, `src/game/game.ts` (where `camera.fov` is
   set from the settings, and the look sensitivity)

## What to build

All numbers in data, proposals for Paul to tune.

**Stage 1: the dart, the blaster and the pierce.**
- **Precision dart** (`precision`): fast and flat (start speed 60, very
  little drop and drag), thin, a small carve, high damage (start 8, the
  slug's is 6), so a weak-point hit is a kill on most Fodder.
- **Pierce:** a dart type or a shot may carry `pierce` (start 1 for the
  precision dart): on hitting a Foamer part it does its damage and flies
  on through, at most `pierce` Foamers, never the same Foamer twice; any
  wall or floor stops it. A dart with no `pierce` is unchanged.
- **B05 entry:** name "Shrike", `model` the approved
  `/models/blasters/B05.glb`, mode `pump` with `primeTime` start 0.9 (the
  bolt), precision darts, one per shot, no spread, magazine 5, reserve 30
  (start 15), reload 1.8 s, `muzzle_1`, viewmodel numbers of its own (a
  long blaster: check it sits low and right and the scope does not fill
  the view). B05 joins the blaster `order`.

**Stage 2: the zoom and the mods.**
- **Zoom** (`src/game/zoom.ts`, numbers in data): while the `zoom` action
  is held and the active blaster has `zoom` in its data, the camera's
  field of view eases to a share of the player's own setting (start 0.4)
  over a short time (start 0.12 s) and the look sensitivity scales with
  it; letting go eases back. Switching blaster or starting a reload drops
  the zoom. The `zoom` key starts as `KeyZ` (and a gamepad button) in
  `data/input.json`: a proposal, say so in HANDOFF for Paul. Only B05 has
  `zoom` for now.
- **Explosive rounds** (mod 1): every shot explodes at its first hit
  through the shared explosion (`explosiveEvery` 1).
- **Heavier rounds** (mod 2): `pierce` start 3, a little more damage and
  impulse.
- **Sounds,** placeholder IDs: `B05-fire` (a sharp crack), `B05-whistle`
  (the dart in flight, capped), `B05-bolt`, `B05-reload`.

## Done when

- Tests in new files: the precision dart reads its type; B05 reads its
  spec and needs the bolt time between shots; a precision dart passes
  through one Foamer and hits a second behind it, and stops at a wall;
  the heavier mod passes through three; a dart never hits the same Foamer
  twice; standard darts are unchanged; the zoom eases the field of view
  to its share while held with B05 out, not with another blaster, and
  drops on a switch or a reload; the explosive mod explodes every shot;
  every other blaster's tests unchanged.
- `npx tsc --noEmit`, `npx vitest run`, `npm run build` pass; no dashes.
- PLAN.md: a GAME-09e row after GAME-09d and the B05 row in 5.1 updated;
  decisions in section 14. HANDOFF: a dated entry at the top of the Log
  (directly under `## Log`), with what was not checked by eye.

## Not in this task

The bolt's animation on the model (it needs viewmodel code GAME-09c is
changing; the review or ART-05 adds it), a scope overlay on screen, B07,
where B05 is found in a level.
