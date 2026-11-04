# LVL-02a: placed ammo pickups from the level file

Written 2026-11-04. D08 (Paul): "I'd like there to be ammo in specific
locations, but not dropped haphazardly. For example, when a player first
finds a new weapon type, or before an end of level gauntlet." The level
format already has `pickups` (`src/level/format.ts`, `design/levels/
BLOCKOUT.md`), the Pit file has one (`pit-ammo`), and GAME-07 built a
generic pickup system (`src/pickups/`) that only spawns health today.

```
ID:          LVL-02a
Title:       Ammo pickups placed by the level file: a foam ammo box that
             refills the reserve of the blasters it is for
Owner:       Pi (Qwen 3.8-27B, Linux AI machine)
Reviewer:    Claude Opus 5.5
Depends on:  LVL-01, GAME-07 (done)
Branch:      lvl-02a, in its own worktree
```

## Read first

1. `CLAUDE.md`
2. `design/levels/BLOCKOUT.md` (pickups), `design/levels/README.md` 3
   (where ammo goes), `design/CONTENT-PLAN.md` D08 and the ammo types
3. `src/pickups/pickups.ts` and `data/pickups.json`, `src/level/format.ts`,
   `src/level/validate.ts`, `src/level/build.ts`, `src/arena/extras.ts`
4. `src/weapons/loadout.ts`, `src/weapons/blaster.ts` (`reserve`,
   `reserveMax`), `data/blasters.json`, `data/darts.json`

Keep each reasoning pass short and start writing code in your first few
replies; commit each stage.

## What to build

- An `ammo` pickup kind in `src/pickups/`: a small foam box in the
  factory palette that sits on the floor (no hop, a slow turn and bob so
  it reads), collected by walking within about 1 m. It adds its count to
  the reserve of every blaster that takes its dart type, never past
  `reserveMax`; at a full reserve it stays put. A short sound and a
  small HUD flash on pickup (not the heal flash colour).
- The level loader spawns every `pickups` entry with a `darts-*` type at
  its position when the level loads, and again on Try again and Play
  again (a collected box comes back on a restart). The validator checks
  the type names a real dart type in `data/darts.json`.
- Numbers in `data/pickups.json`; nothing tuned in code.
- Place boxes: keep the Pit's `pit-ammo`, add one more on the far side
  of the pit floor; give the ring level two, one by each pillar.
- Watch helpers: ammo box count in `state()`.
- Sounds: placeholder ID in `data/sounds.json` and `design/SOUNDS.md`.

## Done when

- Tests: a box adds its count to the right blasters, never past
  `reserveMax`, stays at a full reserve; the level loader spawns the
  file's boxes and respawns them on a restart; the validator rejects an
  unknown dart type.
- `npx tsc --noEmit`, `npx vitest run`, `npm run build` pass; no em or
  en dashes. PLAN.md row (Phase 2 table, under LVL-01) and HANDOFF entry.

## Not in this task

Ammo drops from Foamers, the ammo-for-kills tool (GAME-08), new dart
types.
