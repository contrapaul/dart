# BUG-11: parts.test.ts test 8 failed once in a full run

Written 2026-11-07. After the BUG-10 merge, one full `npx vitest run` on
main failed `tests/foamers/parts.test.ts` test 8, "both forearms gone:
the next attack is the headbutt, a 0.9 s windup, not the 0.6 s bonk"
(102 ms; the assertion message was not captured). It passed 15 of 15
runs alone and the next 11 full runs. The failing run was made while two
other models' test suites ran on the same machine.

The test counts ticks, so load alone should not change its result, but
it awaits mesh work between ticks (`settleAll`, `breakOff` in the same
file), as `finisher.test.ts` did before BUG-09. Something it depends on
is not deterministic: a promise that resolves on a different tick, a
wall clock (`performance.now`, `Date.now`) or `Math.random` somewhere in
the code it runs, or the dart's ricochet landing on a part whose collider
is mid-remesh.

```
ID:          BUG-11
Title:       Find why parts.test.ts test 8 sometimes fails, and make it
             deterministic
Owner:       Pi (Qwen 3.8-27B, qwen-machine, thinking medium)
Reviewer:    Claude Opus 5.5
Depends on:  BUG-09, BUG-10 (done)
Branch:      bug-11, in its own worktree
```

**Running at the same time:** GAME-10g (the Spark: `src/foamers/`,
`src/ai/`, new tests in `tests/foamers/`) and LVL-03b (DeepSeek:
`data/levels/1-3.json`, `src/level/`). Your file is
`tests/foamers/parts.test.ts`. If the cause is in game code, keep the
change as small as you can, name the file and line in HANDOFF, and do
not refactor around it.

## Read first

1. `CLAUDE.md`
2. HANDOFF.md, your BUG-09 and BUG-10 entries
3. `tests/foamers/parts.test.ts` (the helpers and test 8)
4. In `src/foamers/foamers.ts`: `chooseAttack` and where a broken part
   leaves `f.parts`

## What to do

1. Find out which assertion fails: run test 8 in a loop under load (a
   second full suite in the background) and in-process many times, as
   your BUG-09 probe did, and record the message and how often.
2. Search the code test 8 runs for anything not deterministic
   (`performance.now`, `Date.now`, `Math.random`, timers, promise order)
   and say what you found, including where nothing was found.
3. Prove the cause with a failure you can make happen on purpose, then
   fix it so the test checks the same thing (headbutt, 0.9 s windup)
   without depending on it.
4. Show it: the forced case passes, 30 runs alone and 5 loaded full runs
   all pass.

## Done when

- The cause is named in HANDOFF with the evidence.
- No assertion removed or loosened.
- `npx tsc --noEmit`, `npx vitest run`, `npm run build` pass; no em or en
  dashes.
- PLAN.md: a BUG-11 row after BUG-10. HANDOFF: a dated entry at the top
  of the Log (directly under `## Log`).

## Not in this task

Any other failure: write it up in HANDOFF and stop. The
`tower-throw.test.ts` timeout from BUG-10's notes is separate.
