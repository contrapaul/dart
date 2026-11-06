# BUG-09: the finisher test fails now and then in a full run

Written 2026-11-06. After the LVL-03a merge one full `npx vitest run` on
main failed `tests/foamers/finisher.test.ts` test 1:
`f.finishWeakened` was still false after 120 ticks. It passed alone and
on the next full run. The test counts ticks, not milliseconds, so machine
load alone should not change its result: something it depends on is not
deterministic. A vitest exit 1 earlier the same day before a push may be
the same failure.

```
ID:          BUG-09
Title:       Find why finisher.test.ts test 1 sometimes fails in a full
             run, and make it deterministic
Owner:       Pi (Qwen 3.8-27B, qwen-machine, thinking medium)
Reviewer:    Claude Opus 5.5
Depends on:  nothing
Branch:      bug-09, in its own worktree
```

**Running at the same time:** GAME-10f (the Spark: `src/foamers/`,
`src/ai/`) and LVL-03b (DeepSeek: `data/levels/1-3.json`, `src/level/`).
Your file is `tests/foamers/finisher.test.ts`. If the cause is in game
code, keep the code change as small as you can, name the file and line
in HANDOFF, and do not refactor around it.

## Read first

1. `CLAUDE.md`
2. `tests/foamers/finisher.test.ts` (the `settle` helper and test 1)
3. `src/game/finisher.ts`, and in `src/foamers/foamers.ts` where
   `finishWeakened` is set
4. `src/voxel/pieces.ts` (how a part's mesh and its collider arrive from
   the mesher promise)

## A lead to test first

`settle()` waits one `setTimeout(0)` for a part's mesh promise and then
steps the world once. If the mesher's promise chain takes more than one
macrotask to resolve (or other test files load the event loop), the
collider may not exist when the shot is fired, the dart misses, and the
Foamer is never weakened. Other tests wait until `busy` is false instead
(`tests/level/level-1-3.test.ts`, `settle`). Check whether this is it:
prove it by making the failure happen on purpose (for example, delay the
fake mesher by one extra macrotask) before you fix anything.

## What to do

1. Reproduce: run the test file alone 30 times and the full suite 5
   times (`for i in $(seq 30); do npx vitest run tests/foamers/finisher.test.ts || echo FAIL $i; done`),
   and record the counts. If it does not fail, force it as above.
2. Find the cause and show it with a failing run that is reliable.
3. Fix it so the test waits on the real condition, not on time or on a
   fixed number of macrotasks. Look for the same `settle` pattern in
   other tests under `tests/foamers/` and list them in HANDOFF; fix them
   only if they are the same one-line change.
4. Show it: the forced case passes, and 30 runs alone plus 5 full runs
   all pass.

## Done when

- The cause is named in HANDOFF with the evidence (the forced failure).
- `npx tsc --noEmit`, `npx vitest run`, `npm run build` pass; no em or en
  dashes.
- PLAN.md: a BUG-09 row after BUG-08. HANDOFF: a dated entry at the top
  of the Log.

## Not in this task

Anything else that fails: write it up in HANDOFF and stop.
