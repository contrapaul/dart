# GAME-10j: the F10 Turbo, a jet flyer with parryable homing foam

Written 2026-11-07. GAME-10a to 10i built F02 to F09 and the F07 sword.
The F10 rig is a greybox in `data/foamer-rigs.json` (`movement: fly`,
speed 3.5, hover 1.6, health 30; parts body, head, jetL, jetR, wingL,
wingR, both arms, a `blaster` tube on the right forearm). CONTENT-PLAN
F10 (Paul): "Elite. Flying, homing shots. Attack: homing foam (P).
Teaches prioritising targets. Weak point: its jets. Health 30. First
seen 3-2. Name: Turbo. Look: a jetpack version of F02, larger and with
ability to shoot rockets. Purple body, lime visor and trim, orange jets
(weak point)." Section 3.1: parts jets and arms; jets gone means it
falls and walks.

```
ID:          GAME-10j
Title:       The F10 Turbo: palette look, flight on jets over the nav
             grid's ground, slow homing foam shots the player can parry,
             the jets a weak point that drops it to the floor
Owner:       Pi (Qwen 3.8-27B, qwen-machine, thinking medium)
Reviewer:    Claude Opus 5.5
Depends on:  GAME-10c (the F06 float), GAME-10i (done)
Branch:      game-10j, in its own worktree
```

**Running at the same time:** ENV-00 (DeepSeek: a design document in
`design/`, no code). Your files: the F10 rig in `data/foamer-rigs.json`,
an F10 entry in `data/foamers.json`, `src/foamers/`, `src/ai/`,
`data/sounds.json` and `design/SOUNDS.md` for F10 only, new files in
`tests/foamers/` and `tests/ai/`, `design/foamers/F10-*`.

## Read first

Read each once; write yourself a short note instead of rereading.

1. `CLAUDE.md` (toy weapons; pink means parryable and only parryable)
2. `design/CONTENT-PLAN.md`: the F10 rows (sections 3, 3.1, 3.3, 3.4)
3. `tasks/GAME-10c.md` and its PLAN.md section 14 rows: how the F06
   floats on data (`float` in `data/foamers.json`, the rig's hover) and
   loses height when its fins go. Reuse that path for flight; say in
   section 14 what you reused and what was new.
4. `src/foamers/projectiles.ts`: `BallKind`, `BALL_MATERIAL` (what makes
   a ball parryable) and the steering a parried ball already does
   (`steerLeft`)
5. The F10 rig, and the F02 and F06 entries in `data/foamers.json`

## What to build

All numbers in data. Three stages; each leaves the game working and is
committed on its own. Starting numbers are proposals for Paul to tune.
Never `Math.random()` in simulation code; use the seeded PRNG the
pellet stream and the wall use.

**Stage 1: look, type and flight.**
- **Look:** the F10 palette: purple body and arms, lime visor (the head's
  eyes area or a visor part) and trim (wings), orange jets. Render the
  turnaround with `npx tsx tools/render-rig.ts F10` into
  `design/foamers/`. Read the PNG's size and check by script that the
  jets and the blaster are where a jetpack and a wrist launcher belong
  (you cannot see images: say so in HANDOFF).
- **Type:** an `F10` entry (rig F10, health 30) on the keep-distance
  ranged brain, keeping about 12 m (data), flying higher than the F06
  (start 4 m over the ground under it) and faster (the rig's 3.5 m/s).
- **Jets:** each jet is a weak point (multiplier start 2). One jet gone:
  it flies lower and slower (data, as the F06's lost fin). Both gone: it
  drops to the floor and walks, on the same brain, still shooting.

**Stage 2: homing foam.**
- **Shot:** a windup (start 0.6 s, the wrist launcher raised), then one
  shot from the `blaster` tip. The ball is a `BallKind`: pink, parryable
  (the shared `BALL_MATERIAL`, so the existing parry works on it), slower
  than a thrown ball (start 7 m/s), little gravity (start 1), damage
  start 10.
- **Homing:** it steers toward the player's chest for
  `homing.seconds` (start 2.5) at a limited turn rate
  (`homing.turnDegPerSecond`, start 90), then flies straight. A parried
  ball stops homing on the player (the parry's own steer takes over).
  A live cap in data.
- **Launcher:** the `blaster` part gone means no shots; it then closes
  in and uses a melee bonk (base melee).
- **Sounds,** placeholder IDs: `F10-jet` (a loop or a repeated hiss,
  capped), `F10-shot`, `F10-fall`.

**Stage 3: docs** (below).

## Done when

- Tests in new files in `tests/foamers/` and `tests/ai/`: the F10 reads
  its own spec; it holds about its hover height over flat ground; one
  jet off lowers it and slows it, both off put it on the floor walking;
  a jet takes the multiplier; a shot turns toward a player who has moved
  aside and stops turning after `homing.seconds`; the turn per step never
  exceeds the turn rate; a parried shot does not home on the player; the
  launcher gone means no shots; the live cap holds; every other type's
  tests unchanged.
- `npx tsc --noEmit`, `npx vitest run`, `npm run build` pass; no em or en
  dashes.
- PLAN.md: a GAME-10j row under GAME-10i; decisions in section 14.
  HANDOFF: a dated entry at the top of the Log (directly under
  `## Log`), Status updated, and what was not checked by eye.

## Not in this task

Level 3-2, the Turbo in any level file, rockets that explode, flying
over walls or between floors (it follows the nav grid's ground like the
F06), the promoted look.
