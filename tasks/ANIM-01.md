# ANIM-01: the Roamer's throw and the Darter's scrape and charge poses

Written 2026-11-04. GAME-10a and GAME-10b left these unposed: the F02
Roamer's arm does not wind up before a throw (there is no throw motion
in `src/foamers/rig-states.ts`), and the F05 Darter's telegraph (scrape,
head down) and charge (run, head low) reuse other motions.

```
ID:          ANIM-01
Title:       Procedural poses: F02 throw windup and release, F05 scrape,
             charge run and wall stun
Status:      Stages 1 and 2 done 2026-11-04 (poses, data, tests, render
             option, key frames; two stages committed green). Not watched
             by eye: no browser on the AI machine, see HANDOFF log.
Owner:       Pi (Qwen 3.8-27B, Linux AI machine)
Reviewer:    Claude Opus 5.5
Depends on:  GAME-10a, GAME-10b (done)
Branch:      anim-01, in its own worktree
```

## Read first

1. `CLAUDE.md`
2. `src/foamers/rig-states.ts` (every motion, `windupMotion`,
   `strikeMotion`, `walkMotion`), `src/foamers/rig.ts` (`RigMotion`,
   `solvePose`), `src/foamers/foamer.ts` (`poseParts`: which motion plays
   in which state)
3. `data/foamer-rigs.json` (the F02 and F05 parts and pivots)

Keep each reasoning pass short and start writing code in your first few
replies; commit each stage.

## What to build

- **F02 throw:** in `windup` with the `throw` attack, the ball arm
  (`armR`, `foreArmR`, `ball`) swings back and up over the windup time,
  the body turns a little away; in `strike` it whips forward past the
  shoulder and the body turns through; `recover` eases back. Readable
  from 10 m: the wind up is the player's cue to raise the shield.
- **F05 telegraph:** head and body dip forward, one leg scrapes back and
  forward twice over the telegraph time. **Charge:** body pitched forward,
  a fast short stride. **Wall stun:** body rocks back and wobbles, head
  shakes, so the open back reads.
- Every number (angles in degrees, cycle counts) in a `motions` block in
  `data/foamer-rigs.json` per rig, or in the rig's own entry; nothing
  tuned in code. The F01 motions do not change.
- `npx tsx tools/render-rig.ts F02` and `F05` gain an option to render a
  given state and time (for example `--state windup --t 0.5`) so the
  poses can be checked as PNGs; render the key frames into
  `design/foamers/poses/`.

## Done when

- Tests: the F02 throw pose moves the ball part back during windup and
  forward in strike (its position along the facing); the F05 charge
  pitches the body forward; F01 poses are unchanged.
- The key frame PNGs exist and you have looked at them.
- `npx tsc --noEmit`, `npx vitest run`, `npm run build` pass; no em or
  en dashes. PLAN.md row (Phase 2 table) and HANDOFF entry.
