# GAME-10f: the F07 Brawler, a melee heavy that leaps and slams

Written 2026-11-06. GAME-10a made Foamer types data driven; GAME-10b to
10e added the F05 Darter, F06 Floater, F03 Swarmer and F04 Blocker. The F07
rig is a greybox in `data/foamer-rigs.json` (`movement: leap`, speed 2.4).
CONTENT-PLAN F07 (Paul): "Heavy. Melee brawler, leaps and slams. Attack:
shockwave ring (jump it). Teaches dash timing. Weak point: none. Health
45. First seen 2-4. Name: Brawler. Colours: purple body, orange armour,
lime sword." Section 3.1: parts arms and legs; losing the legs means no
more leap slam. Section 3.3 greybox: gorilla stance, tiny head sunk in
the shoulders, huge fists with knuckle nubs.

**Open for Paul:** the look column says "uses a foam sword", the greybox
row says "huge fists". This card does not choose. Keep the rig's fists,
colour them lime (the sword's colour), and add a `[Paul]` note in
`data/foamer-rigs.json` and in section 14: sword or fists.

```
ID:          GAME-10f
Title:       The F07 Brawler: palette look, a walk-in melee brain, a punch
             up close, a leap slam that lands a shockwave ring the player
             jumps or dashes through, legs lost end the leap
Owner:       Pi (Qwen 3.8 Flash Next, dgx-spark, thinking medium)
Reviewer:    Claude Opus 5.5
Depends on:  GAME-10a, GAME-10b, GAME-10c (done)
Branch:      game-10f, in its own worktree
```

**Running at the same time:** LVL-03b (DeepSeek: `data/levels/1-3.json`,
`src/level/`, `tests/level/`) and BUG-09 (local Qwen:
`tests/foamers/finisher.test.ts`). Do not edit those. Your files:
`data/foamers.json` (F07), `data/foamer-rigs.json` (F07 only),
`src/foamers/`, `src/ai/`, `src/game/game.ts` and `src/range/main.ts`
(only the shockwave's hit on the player), `data/sounds.json`,
`design/SOUNDS.md`, `tests/foamers/`, `tests/ai/`, `design/foamers/`.

## Read first

Read each once; write yourself a short note instead of rereading.

1. `CLAUDE.md` (no horror; blocky foam)
2. `design/CONTENT-PLAN.md`: the F07 rows (sections 3, 3.1, 3.3, 3.4)
3. `tasks/GAME-10b.md` (the F05 Darter: a heavy with its own movement
   block, `src/foamers/charge.ts`, `src/ai/f05-brain.ts`) and
   `tasks/GAME-10c.md` (how a type got its own data block)
4. `data/foamers.json` (base and F05), the F07 rig
5. `src/foamers/foamers.ts` where F05's charge runs and where a strike
   lands on the player; `data/player.json` (jump height, dash)

## What to build

All numbers in data. Three stages; each leaves the game working and is
committed on its own.

**Stage 1: look and type.**
- **Look:** the F07 rig's palette as ART-03 did: purple body, orange
  armour pieces, lime fists, eyes like the others. Render the turnaround
  with `npx tsx tools/render-rig.ts F07` into `design/foamers/`.
- **Type:** an `F07` entry in `data/foamers.json` `types` (rig F07,
  health 45, a `punch` melee attack). It walks in like F01 (the melee
  brain) and punches in reach. Every other type behaves exactly as
  before. The range's type choice spawns it.

**Stage 2: the leap slam.**
- When the player is between `leap.minMetres` (start 5) and
  `leap.maxMetres` (start 12) and the cooldown (start 6 s) is up, it
  crouches (telegraph, start 0.6 s), leaps in an arc to a point
  `leap.landShortMetres` (start 1.5) short of where the player was, and
  lands.
- The landing makes a **shockwave ring**: a flat ring on the floor that
  grows from the landing point at `shockwave.speed` (start 9 m/s) out to
  `shockwave.radius` (start 8 m), `shockwave.thickness` (start 0.6 m)
  thick. A player whose feet are on the ground inside the ring's band as
  it passes takes `shockwave.damage` (start 15) once; a player in the
  air (a jump) or dashing takes none. Draw it as a thin foam ring (a
  capped mesh, one per Brawler).
- Keep the leap and ring maths in a pure module (`src/foamers/leap.ts`)
  so it is testable without the renderer.
- Losing both legs: no more leap (it crawls as F01 does). Losing an arm
  does not stop the leap.
- Sounds, placeholder IDs in `data/sounds.json` and `design/SOUNDS.md`:
  `F07-crouch`, `F07-land`, `F07-punch`.

**Stage 3: docs** (below).

## Done when

- Tests in `tests/foamers/` and `tests/ai/`: the F07 type reads its own
  spec; it leaps only inside its min and max distance and off cooldown;
  the leap lands short of the target point; the ring hits a grounded
  player in its band once, misses one in the air, misses one inside the
  band after it has passed; no leap with both legs gone; every other
  type's tests unchanged.
- `npx tsc --noEmit`, `npx vitest run`, `npm run build` pass; no em or en
  dashes.
- PLAN.md: a GAME-10f row under GAME-10c; decisions in section 14 (and
  the sword or fists question for Paul). HANDOFF: a dated entry at the
  top of the Log, Status updated, and what was not checked by eye.

## Not in this task

Level 2-4, the Brawler in any level file, a mini-boss pair, a sword
model, vacuum entries.
