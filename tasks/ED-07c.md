# ED-07c: turn an old arena block into editor triggers (pure)

Written 2026-11-13. The Act 1 levels describe their fights as `arenas`
(a trigger box, doors, rifts, waves, `unlockOnClear`). The editor scripts
fights with when/do triggers (design/EDITOR.md section 3). Paul wants to
open Act 1 levels in the editor and rework them, so an arena must become
editor parts he can see and change. This card is the converter, plain
TypeScript, tested. Nothing calls it yet.

```
ID:          ED-07c
Owner:       Pi (qwen3.8-27b-1cat on qwen-machine, thinking medium)
Reviewer:    Claude Opus 5.5
Branch:      ed-07c, in its own worktree
```

**Your files:** a new `src/level/arena-to-triggers.ts`, a new test
`tests/level/arena-to-triggers.test.ts`. Do NOT touch anything else.

## Read first

Only these: `design/EDITOR.md` section 3, `src/level/format.ts` (`Arena`,
`Wave`, `Door`, `Rift`, and the ED-00 block: `Zone`, `LevelDoor`,
`Trigger`, `TriggerWhen`, `TriggerDo`), `src/level/triggers.ts` (how the
runner reads them). Then start writing code.

## What to build

`export function arenaToTriggers(level: Level): Level` returns a new level
(the input is not changed) where every arena is gone and in its place:

- a zone `<arena>-zone` with the arena's trigger box;
- every arena door as a `LevelDoor` with the same id, pos and size: state
  "open" becomes lock "none", "locked" and "sealed" become lock
  "trigger";
- every rift as a spawn point with the same id, pos and facing;
- trigger `<arena>-lock`: when enter `<arena>-zone`: close every door
  that started open (unless the arena is `noLock`), message "[Paul]"
  is not added (no text is invented), then wave 1's spawns;
- each wave becomes one spawn action per `spawns` entry, id
  `<wave>-<n>`, with its foamer, count, promoted, holdSeconds and the
  wave's rifts as `at`. Wave 1 runs in the lock trigger after
  `delaySeconds` (use an `after` trigger on the lock with that delay when
  it is above 0). Each next wave starts when the one before is cleared:
  a trigger `<wave>-start` when killed all of the previous wave's spawn
  ids, then an `after` of its `delaySeconds` that does the spawns (skip
  the after when the delay is 0);
- `startsWithHealthShare` cannot be expressed: keep that wave as a
  "cleared" start and return a warning string for it;
- trigger `<arena>-clear`: when killed all of the last wave's spawns:
  open every door in `unlockOnClear`;
- `checkpoint` with `checkpointPos`: a checkpoint do in the lock trigger
  (yaw 0);
- `escape`: not converted; return a warning naming the arena.

Return `{ level, warnings }` if that reads better; say which in HANDOFF.

## Done when

- Tests: the Ring (`data/levels/1-4-ring.json`) converts with no arenas
  left and passes `validateLevel`; one zone, doors, spawn points and
  triggers per arena; a two wave arena runs end to end through
  `TriggerRunner` with a fake host (enter, wave 1 spawns, kill all,
  wave 2 spawns after its delay, kill all, the unlock doors open); a
  `noLock` arena closes nothing; an escape gives a warning; the input
  level is unchanged.
- `npx tsc --noEmit` and `npx vitest run` pass.
- PLAN.md: an ED-07c row in section 12. HANDOFF.md: a dated entry
  directly under `## Log`.

## Rules

No em dashes anywhere. No Three.js, no DOM, no `Math.random`. Commit on
`ed-07c` (include `tasks/ED-07c.md`); do not push.
