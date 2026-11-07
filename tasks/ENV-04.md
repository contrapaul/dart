# ENV-04: the crushing toy press (E14), the first hazard that can kill

Written 2026-11-07. Paul (Q19): Act 1 hazards must be able to kill the
player, "Players must feel a sense of danger or they will not feel
accomplished." He chose a crushing toy press (`design/levels/
ENVIRONMENT.md` E14, PLAN.md section 14).

```
ID:          ENV-04
Title:       E14 crushing toy press: a toy stamp over a floor pad that
             rests, telegraphs, slams and rises on a timer, and crushes
             the player or a Foamer under it, in a test level
Owner:       Pi (Qwen 3.8-27B, qwen-machine, thinking medium)
Reviewer:    Claude Opus 5.5
Depends on:  ENV-03 (done: the test level pattern)
Branch:      env-04, in its own worktree
```

**Running at the same time:** BUG-12 (dgx-spark: `src/level/build.ts`
`fillPieces`, `src/voxel/pieces.ts`). Stay out of those.

**Lesson from ENV-01:** a feature can pass every unit test and never run
in play if the arena page does not hand it to the game. Trace the press
from the level file through `buildLevel`, `buildArena` and `arenaExtras`
(`src/arena/extras.ts`) and write that path in HANDOFF.

## Read first

Read each once; write yourself a short note. First edit by your sixth
reply.

1. `CLAUDE.md` (toy look, nothing that reads as gore: a crush is a foam
   pop for a Foamer, a hit and the usual go-down for the player)
2. `design/levels/ENVIRONMENT.md` sections 0 and E14
3. `src/level/buttons.ts` and its wiring in `src/arena/extras.ts` (the
   newest level element: copy its shape: format, build, system, page)
4. `src/player/health.ts` (`damage`, the grace, the difficulty
   multiplier), and how the game applies a Foamer's hit
   (`src/game/game.ts`, `health.damage`)

## What to build

All numbers in a new `data/press.json`. Starting numbers are proposals
for Paul to tune.

**Stage 1: the press.**
- **Format:** `Level.presses?: Press[]`, each with an `id`, a `pos` (the
  centre of the floor pad), a `size` of the pad (x and z), a `height`
  the head rises to, and a `phase` in seconds so two presses can run off
  beat.
- **Cycle** (data): `up` (start 2.0 s), `telegraph` (0.7 s: the head
  shakes, a light on it turns on, `ENV-press-windup` plays), `slam`
  (0.12 s, fast), `down` (0.5 s), `rise` (1.0 s).
- **Crush:** at the end of the slam, test the footprint (the pad's box
  up to the head's lowest point), not physics contact. The player inside
  takes `damage` (start 100, the player's full health) through the same
  path a Foamer's hit takes, and the shield does not block it. A Foamer
  inside takes the same as damage and pops as a catastrophic hit does.
  `ENV-press-slam` plays on every slam.
- **Collider:** the head has a kinematic collider that moves with it, so
  nothing stands inside it while it is down.
- **Look:** a chunky block with a rounded soft face, on two guide posts,
  over a pad marked in a colour no floor uses. Colours: not orange (weak
  point), pink (parryable), blue or yellow (the player's darts); leave a
  `[Paul]` note for the final look in the data.

**Stage 2: the test level** `data/levels/env-04.json`, registered as
`"env-04"`: a corridor 3 m wide with two presses across it, a beat apart
(`phase`), the exit beyond them, so the only way to finish is to time
the crossing. Add the level to the key list in
`tests/level/ring-load.test.ts`.

## Done when

- Tests: the cycle times come from data; a player in the footprint at
  the slam takes the damage (and at 100, with no armour and Normal
  difficulty, is downed); a player beside the footprint takes nothing; a
  raised shield does not stop it; one slam damages once, not every step
  it is down; a Foamer in the footprint is popped; two presses with
  different phases slam at different times; a level with no presses
  loads as before.
- `npx tsc --noEmit`, `npx vitest run`, `npm run build` pass; no dashes.
- PLAN.md: the ENV-04 row; decisions in section 14. HANDOFF: a dated
  entry at the top of the Log (directly under `## Log`), with the path
  to the page and what you could not check by eye.

## Not in this task

Placing presses in real levels, a press the player can stop or trigger,
how the press reads on Easy (the difficulty multiplier may make 100 not
kill there: note what happens and leave it to the reviewer).
