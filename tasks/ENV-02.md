# ENV-02: the toy button (E08)

Written 2026-11-07. Third of the first environment set
(`design/levels/ENVIRONMENT.md` section 0). A button the player shoots,
hits or walks into, that does one thing in the level, once.

```
ID:          ENV-02
Title:       E08 toy button: a flat box with a cylinder button (Paul's
             look) that a dart, a melee hit or the player's body presses
             once, wired in level data to open a door
Owner:       Pi (DeepSeek V4.1 Flash, openrouter, thinking high)
Reviewer:    Claude Opus 5.5
Depends on:  ENV-01 (done: the test level pattern)
Branch:      env-02, in its own worktree
```

**Running at the same time:** ENV-03 (qwen-machine: the mod station, `Level.stations`, `src/weapons/loadout.ts`, a new `data/levels/env-03.json`). You both add one optional field to `Level` in `src/level/format.ts`, one line to `src/arena/levels.ts` and the key list in `tests/level/ring-load.test.ts`, and sound IDs to `data/sounds.json` and `design/SOUNDS.md`: keep those edits small and in their own lines so the merge is easy. Stay out of each other's files.

**Lesson from ENV-01:** its crate rule passed every unit test and never ran in play, because `buildArena` in `src/arena/extras.ts` did not hand the crates to the game. Whatever you add to the level must reach the arena page: trace it from `buildLevel` through `buildArena` to `createGame` (`src/game/game.ts`), and write in HANDOFF the path it takes.

## Read first

Read each once; write yourself a short note. First edit by your sixth
reply.

1. `CLAUDE.md`
2. `design/levels/ENVIRONMENT.md` sections 0 and E08
3. `src/level/format.ts` (`Door`, `Level`), `src/level/build.ts`
   (`DoorHandle`), `src/level/arena.ts` (how a lock opens and shuts doors)
4. `src/weapons/darts.ts` (`DartSystem.onHit`, `DartHit`) and how the
   melee reports a hit (`data/melee.json` and its code)

## What to build

**Stage 1: the button and its wiring.**
- **Format:** `Level.buttons?: Button[]`, each with an `id`, a `pos`, a
  `facing` (on a floor or a wall) and an `action`. The only action for
  now: `{ open: "<door id>" }`. A second press does nothing but click.
- **Look (Paul):** a flat box with a cylinder button to press. Start
  0.5 x 0.12 x 0.5 m for the box and a 0.25 m wide, 0.08 m tall
  cylinder; the cylinder squashes into the box when pressed and its
  colour changes to the lit accent. Sizes and colours in `data/`.
- **Pressed by** a dart hit on the cylinder, a melee hit within reach,
  or the player stepping on a floor button. Foamers never press it.

**Stage 2: a test level** `data/levels/env-02.json` (registered as
`"env-02"`): two rooms, a closed door between them, a wall button by the
door and a floor button across the room, either one opens it. Sounds:
placeholder IDs `ENV-button-press`, `ENV-button-dead` in
`data/sounds.json` and `design/SOUNDS.md`.

## Done when

- Tests: a dart hit presses it, a melee hit in reach presses it, a step
  on a floor button presses it; the door opens once; a second press does
  not change the door; a level with no buttons loads as before.
- `npx tsc --noEmit`, `npx vitest run`, `npm run build` pass; no dashes.
- PLAN.md row under ENV-01, section 14 decisions, HANDOFF entry.

## Not in this task

Any action but opening a door, targets (E09), placing buttons in real
levels.
