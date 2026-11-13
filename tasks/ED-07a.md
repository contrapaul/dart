# ED-07a: the trigger runner and keys (pure)

Written 2026-11-13. Paul's level editor scripts levels with "when this
happens, do that" triggers (design/EDITOR.md section 3). This card is the
runner, plain TypeScript with no Three.js and no DOM, and the key rules.
The reviewer wires it into the game.

```
ID:          ED-07a
Owner:       Pi (qwen3.8-27b-1cat on qwen-machine, thinking medium)
Reviewer:    Claude Opus 5.5
Branch:      ed-07a, in its own worktree
```

**Your files:** new `src/level/triggers.ts`, new `src/level/keys.ts`, new
tests `tests/level/triggers.test.ts` and `tests/level/keys.test.ts`. Do NOT
touch anything else: other models are changing the rest.

## Read first

Only these: `design/EDITOR.md` section 3, `src/level/format.ts` (the ED-00
block: `Trigger`, `TriggerWhen`, `TriggerDo`, `Zone`, `LevelDoor`,
`KeyColour`). Then start writing code.

## What to build

1. `triggers.ts`:

```ts
export interface TriggerHost {
  /** Spawn one Foamer at a spawn point; `tag` is the spawn action's id. */
  spawnOne(foamer: string, at: string, tag: string, promoted: boolean): void;
  wake(ids: string[]): void;
  show(ids: string[]): void;
  hide(ids: string[]): void;
  open(door: string): void;
  close(door: string): void;
  message(text: string, seconds: number): void;
  checkpoint(pos: Vec3, yaw: number): void;
}
export class TriggerRunner {
  constructor(level: Level, host: TriggerHost);
  /** Fires the "start" triggers. Call once when the level begins. */
  start(): void;
  /** Zones (player feet inside a zone box: fires on entering, not while
   *  standing in it), "after" timers and spawn holds. */
  update(dt: number, playerFeet: Vec3): void;
  /** A Foamer died. `tag` is its placed id, or the spawn action id that
   *  made it. */
  killed(tag: string): void;
  pressed(button: string): void;
  taken(pickup: string): void;
  /** Back to the level's start state (a restart). */
  reset(): void;
}
```

Rules: a trigger fires once unless `repeat`. Its `do` list runs in order.
`spawn` issues `count` calls to `spawnOne`, round robin over `at`, the
first at once and each next one `holdSeconds` later (0 or omitted: all at
once). `killed` counts deaths of the tags in `ids` (a spawn id counts each
Foamer it made); with no `count`, it needs every one: the placed ones
named, plus every Foamer each named spawn will make (`count` of that
spawn). `after` fires `seconds` after the named trigger fired (each time,
if that one repeats). A kill or a press before its trigger can fire still
counts. `message` seconds default 3. No allocation in `update` once
running (keep arrays and reuse them).

2. `keys.ts`: `class KeyRing` (`add(colour)`, `has(colour)`, `held()` in
   the order red, blue, yellow, `clear()`), and `doorOpensFor(door:
   LevelDoor, keys: KeyRing): boolean` (`none` always, `trigger` never,
   a colour when held).

## Done when

- Tests: start fires once; entering a zone fires on the edge only, and a
  `repeat` one fires again after leaving and coming back; a spawn of 3 with
  hold 1 s spawns at 0, 1 and 2 s round robin; "killed all" over a placed
  Foamer and a spawn of 3 needs all four; "killed" with count 2; `after`
  fires on time; the usual arena (enter: show blockers and spawn; all
  killed: hide blockers and open the door) runs end to end with a fake
  host; reset brings it back; keys and door rules.
- `npx tsc --noEmit` and `npx vitest run` pass.
- PLAN.md: an ED-07a row in section 12. HANDOFF.md: a dated entry directly
  under `## Log`.

## Rules

No em dashes anywhere. No Three.js, no DOM, no `Math.random`. Commit on
`ed-07a` (include `tasks/ED-07a.md`); do not push.
