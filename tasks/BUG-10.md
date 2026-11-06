# BUG-10: tests that fail only when the machine is busy

Written 2026-11-07. With Pi models running their own test suites on the
same machine, full `npx vitest run` passes on main have failed these,
each of which passes alone:

- `tests/ai/nav-grid.test.ts` "bakes a 40 by 40 m floor in under 150 ms
  and paths across it in under 2 ms" (the bake is timed once; the query
  already takes the median of 9)
- `tests/foamers/rig.test.ts` "movement never snaps" (failed at about
  8000 ms: it loops every rig for 30 s of 60 Hz frames with an `expect`
  per joint per frame, and ran past vitest's timeout; BUG-09's model saw
  it fail 3 of 10 loaded runs)
- `tests/level/pit-load.test.ts` "bakes the whole Pit's nav grid" (a
  single timed bake under 1000 ms) is the same shape and has not failed
  yet

A red full run that is green alone wastes a review each time and trains
everyone to ignore red. The checks must keep measuring what they measure
now: no budget raised, no assertion removed.

```
ID:          BUG-10
Title:       Make the load-sensitive tests pass under a busy machine
             without loosening what they check
Owner:       Pi (Qwen 3.8-27B, qwen-machine, thinking medium)
Reviewer:    Claude Opus 5.5
Depends on:  BUG-09 (done)
Branch:      bug-10, in its own worktree
```

**Running at the same time:** LVL-03b (DeepSeek: `data/levels/1-3.json`,
`src/level/`, `tests/level/level-1-3.test.ts`) and GAME-10g (the Spark:
`src/foamers/`, `src/ai/`, `tests/foamers/` new files). Your files: the
three tests above and `vitest.config.ts`. No game code.

## Read first

1. `CLAUDE.md`
2. The three tests above, and `vitest.config.ts`
3. HANDOFF.md, the BUG-09 entries (how that flake was proven)

## What to do

1. **Reproduce under load:** run the full suite with a second full suite
   running at the same time (two terminals' worth, in the background),
   five times, and record which tests fail and with what message
   (timeout or budget).
2. **Timed budgets** (nav bake, Pit bake): time the work several times
   and assert on the fastest or the median, as the path query already
   does, with the reason in a comment. Same budgets.
3. **"never snaps":** find out why it takes seconds. Likely the `expect`
   call per joint per frame (hundreds of thousands of calls). Keep the
   same frames, rigs and 0.35 rad limit, but collect the worst jump per
   rig and assert once per rig with the frame named in the message. If it
   is still slow, say why before raising any timeout.
4. **Show it:** five loaded full runs (as in step 1) all green, and the
   test times before and after in HANDOFF.

## Done when

- The cause of each failure is named in HANDOFF with the evidence.
- No budget raised, no frame or rig dropped, no assertion removed.
- `npx tsc --noEmit`, `npx vitest run`, `npm run build` pass; no em or en
  dashes.
- PLAN.md: a BUG-10 row after BUG-09. HANDOFF: a dated entry at the top
  of the Log (directly under `## Log`).

## Not in this task

Any other failure: write it up in HANDOFF and stop.
