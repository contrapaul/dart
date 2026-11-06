# BUG-08: a Roamer that finds no clear throw sidles for good

Written 2026-11-06. BUG-07 made a Roamer (F02) throw only when its ball's
arc reaches the player: with no clear flight it hands its token back and
keeps sidling round its ring, which usually finds a clear spot. When no
spot on the ring is clear, it sidles for good and never throws. Level
1-2's tower shows it: two Roamers spawn on floor 2, and a player standing
on the ground floor under the slab is never reached (BUG-07 counted 5
thrown and none reached in that case, and the rest of the time the
Roamers circle above). The fix is a way out of the ring when it has been
blocked too long.

```
ID:          BUG-08
Title:       A Roamer blocked for too long leaves its ring and walks its
             path to the player until a throw is clear
Owner:       Pi (DeepSeek V4.1 Flash, openrouter, thinking high)
Reviewer:    Claude Opus 5.5
Depends on:  BUG-07 (done)
Branch:      bug-08, in its own worktree
```

**Running at the same time:** LVL-03a (a new `data/levels/1-3.json`,
`src/level/`, `src/arena/`, `tests/level/`). Your files are
`src/ai/f02-brain.ts`, `src/foamers/foamers.ts` (only where the F02 input
is filled), `data/ai.json` and `tests/ai/`. Do not edit `src/level/`,
`data/levels/` or `tests/level/`.

## Read first

1. `CLAUDE.md`
2. `tasks/BUG-07.md`, its two HANDOFF Log entries (the fix and the
   review), and the BUG-07 rows in PLAN.md section 14
3. `src/ai/f02-brain.ts` (the `approach` and `hold` cases, `ringMove`),
   where `FoamerSystem` fills the F02 input and the `throwClear` cache
4. `tests/ai/tower-throw.test.ts`, `tests/ai/pit-throw.test.ts`,
   `tests/ai/pit-rig.ts`

## What to build

1. **Repro first:** in `tests/ai/tower-throw.test.ts` (or a new test
   beside it with the same rig), the tower case with the player still on
   the ground floor under the slab and the two floor 2 Roamers: count
   thrown and reached over 30 s. Commit it with the expectation marked
   failing or skipped, with the before numbers in the commit message.
2. **The fix, in the brain:** the F02 brain counts how long it has gone
   without a clear flight while it holds (a timer in its input or
   context, like `sinceNibble` for F03). Past
   `brain.blockedRepathSeconds` (new, in `data/ai.json`, start at 3) it
   stops sidling and walks its path to the player (`followPath`) until
   the flight is clear again or it is inside its retreat distance, then
   goes back to the normal ring and asks for a token as now. A clear
   flight resets the timer. Keep it inside the existing states (no new
   state) unless the state machine truly cannot say it; say why in
   section 14 if so.
3. Nothing else changes: a Roamer with a clear flight behaves exactly as
   today (the Pit test's counts must not drop), F04 Blockers (which hand
   their step to `decideF02` once their shield is broken) still work, and
   the F01, F03 and F05 brains are untouched.

## Done when

- The tower repro passes: the floor 2 Roamers reach a player under the
  slab inside 30 s (at least 3 balls reach the player) by walking down,
  and the test prints the after counts.
- `tests/ai/pit-throw.test.ts` counts are no worse; a unit test in
  `tests/ai/` for the brain: blocked past the time gives `followPath`, a
  clear flight resets it, inside the retreat distance it backs off as
  now.
- Every other test still passes, none loosened. `npx tsc --noEmit`,
  `npx vitest run`, `npm run build` pass; no em or en dashes.
- PLAN.md: a BUG-08 row after BUG-07; the decision in section 14.
  HANDOFF: a dated entry at the top of the Log, Status updated, and what
  was not checked by eye (the Roamer walking down the ramps, how it reads
  in the Pit).

## Not in this task

Choosing a better spot by search (sampling places with a clear flight),
other Foamer types, level changes.
