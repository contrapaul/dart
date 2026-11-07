# GAME-09c: B02 Musketeer gameplay, on a placeholder model

Written 2026-11-07. Paul's order of work: every enemy and weapon first.
B02 (CONTENT-PLAN section 4, Paul): "Sidearm. Semi-auto. Standard darts.
6 / infinite. Quick backup, never empty. Mod 1: burst of 3. Mod 2: heavy
rounds, slower firing, much larger impact and damage. Name: Musketeer."
Its model waits on its design brief (ART-01, from Paul's photo, for Paul
to approve) and a Blender model; this card builds the gameplay now on a
placeholder model so the model can drop in later with no code change.

```
ID:          GAME-09c
Title:       B02 Musketeer: semi-auto, a 6 dart magazine with a reserve
             that never runs out, a burst-of-3 mod and a heavy-round mod,
             on the B01 model as a placeholder
Owner:       Pi (Qwen 3.8-27B, qwen-machine, thinking medium)
Reviewer:    Claude Opus 5.5
Depends on:  GAME-09, GAME-09b (the blaster system and mods)
Branch:      game-09c, in its own worktree
```

**Running at the same time:** GAME-10k review (Claude, the F11 Seawall:
`src/foamers/`, `src/game/game.ts` `onBonk`). Your files: a `B02` entry
in `data/blasters.json`, `src/weapons/`, `data/input.json` only if a key
is needed, `data/sounds.json` and `design/SOUNDS.md` for B02 only, new
tests in `tests/weapons/`.

## Read first

Read each once; write yourself a short note. First edit by your sixth
reply.

1. `CLAUDE.md`
2. `design/CONTENT-PLAN.md` section 4 (the B02 row and the notes),
   `design/blasters/B01.md` (the card shape)
3. `src/weapons/blaster.ts` (`BlasterMode`, `resolveSpec`, the fire
   clock, prime and reload), `src/weapons/loadout.ts` (reserves,
   `refillReserves`, mods), `data/blasters.json` (B01's entry and mods)
4. `tasks/GAME-09.md` and `tasks/GAME-09b.md`

## What to build

All numbers in data, proposals for Paul to tune.

**Stage 1: the blaster.**
- **Entry:** `B02`, name "Musketeer", standard darts, one dart per shot,
  spread start 1 degree, magazine 6, reload start 1.0 s.
- **Semi-auto:** a new mode `semi`: one shot per trigger press, no pump,
  no hold-to-fire; a minimum gap between shots (`fireInterval`, start
  0.15 s) so a fast clicker is capped.
- **Never empty:** the reserve never runs out (a data flag, for example
  `reserveInfinite: true`): reloads always fill the magazine, ammo boxes
  and the vacuum's refill skip it, and the HUD shows the reserve as
  infinite (a symbol, not a number). Every other blaster's reserve is
  unchanged.
- **Placeholder model:** `model` points at the B01 `.glb` for now, with
  one muzzle, and a `_note` saying the B02 model replaces it. Viewmodel
  numbers its own, so it can be told apart (smaller scale).
- **In the game:** B02 joins the blaster `order` as the sidearm. Read how
  the weapon keys and the range page pick blasters, and make B02
  selectable on the range and in the arena without dropping any blaster
  the levels use today; say in HANDOFF what you changed and why.

**Stage 2: the mods.**
- **Burst** (mod 1): a new mode `burst`: one trigger press fires 3 darts
  `burstGap` apart (start 0.07 s), then a cooldown (start 0.3 s); a burst
  is never cut short by the magazine running out mid-burst (it fires
  what is left).
- **Heavy** (mod 2): the `slug` dart type, slower fire (`fireInterval`
  start 0.45 s), its own chunk numbers (larger carve and push than the
  standard, smaller than B01's slug).
- **Sounds,** placeholder IDs: `B02-fire`, `B02-fire-heavy`,
  `B02-reload`.

## Done when

- Tests in new files: B02 reads its spec; one press fires one dart, a
  held trigger fires one; presses faster than `fireInterval` are capped;
  the reserve never runs out over many reloads, and an ammo box or the
  vacuum refill leaves it alone; the burst fires 3 per press with the
  gap, then waits the cooldown; a burst with 2 left fires 2; the heavy
  mod fires slugs at the slower rate; every other blaster's tests
  unchanged.
- `npx tsc --noEmit`, `npx vitest run`, `npm run build` pass; no dashes.
- PLAN.md: a GAME-09c row after GAME-09b and the B02 row in 5.1 updated;
  decisions in section 14. HANDOFF: a dated entry at the top of the Log
  (directly under `## Log`), with what was not checked by eye.

## Not in this task

The B02 model and its brief, where B02 is found in a level, upgrade paths.
