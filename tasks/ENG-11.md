# ENG-11: Test range page with a frame-time graph

Written 2026-11-01 after Paul's play test of ENG-10. The game still has a
regular pause ("a hitching stutter, like a regular pause") after two fixes
that treated it as frame pacing. This task builds a second, plain page to
find out what causes it and to build out blasters and Foamers on later.

```
ID:          ENG-11
Title:       Test range page (range.html): plain level, frame-time graph,
             system switches, test panel
Owner:       Pi (Qwen 3.8-27b)
Reviewer:    Claude Opus 5.5
Depends on:  ENG-10 (done)
Branch:      eng-11, in its own worktree (see "Setup")
```

## Read first

1. `CLAUDE.md` (every rule applies to you)
2. `HANDOFF.md`: the 2026-11-01 play test notes, and the two 2026-10-31
   stutter entries (render interpolation, then the frame clock)
3. `src/main.ts` (the game page this one is modelled on),
   `src/core/loop.ts`, `src/foamers/foamers.ts` (public API only)
4. `sandbox.html` and `src/sandbox/main.ts` (an existing second page, and
   how it lays out a side panel)

## How to work (important)

Keep each reply's thinking short and act through tools. Build in stages:
one file, then `npx tsc --noEmit` and the tests, then the next. Never write
more than about 200 lines in one tool call. Suggested order: the loop
stats (tests 1 to 3), the frame log (4 to 7), the shared aim helper, the
range page, the graph, the panel, then the Foamer system additions (8 to
10).

## Goal

A new page, `range.html`, served beside the game and the sandbox:

- **A plain level.** A flat floor and a few solid boxes for cover. No voxel
  wall, no test tower, no foam blocks dropped at the start, no
  destructible terrain. Foamers and darts work as in the game (Foamers are
  still voxel parts that carve and pop; that is what is being tested).
- **A frame-time graph** on screen: for every frame, how long it took
  between displays, how long the game's own work took, and how many
  simulation steps ran. A hitch shows as a spike, and the graph says
  whether it was the game working too long (CPU, garbage collection, a
  remesh) or a normal frame shown at the wrong moment (pacing).
- **Switches** to turn systems off one at a time until the pause goes away.
- **A test panel** to pick the dart type and spawn Foamers at set
  distances. Later tasks add blasters (GAME-09) and Foamer types
  (GAME-10) here.

The game page (`index.html`) keeps working and behaves exactly as before.

## Setup

```bash
cd /Users/paul/Documents/GitHub/dart
git worktree add ../dart-eng-11 -b eng-11
cd ../dart-eng-11
npm install
```

Dev server: `npm run dev -- --port 5175`. The range is at
`http://localhost:5175/range.html`.

## Files

Create:

- `range.html`, `src/range/main.ts`, `src/range/range.css`
- `src/ui/frame-graph.ts`: `FrameLog` (data, no DOM) and `FrameGraph`
  (draws a `FrameLog` on a 2D canvas)
- `src/weapons/aim.ts`: the muzzle and aim block from `src/main.ts`,
  moved into one function both pages call (no change in behaviour)
- `data/range.json`: every number below
- `tests/core/loop-stats.test.ts`, `tests/ui/frame-log.test.ts`,
  `tests/foamers/range-api.test.ts`

Edit:

- `vite.config.ts`: add `range.html` as a third input.
- `src/core/loop.ts`: the stats hook (below). Nothing else changes.
- `src/main.ts`: call the aim helper instead of its inline block.
- `src/foamers/foamers.ts`: the three additions under "Foamer system".

Do not change `darts.ts`, `impacts.ts`, `debris.ts`, the mesher, the rig
files, `data/foamer-rigs.json`, or anything in `src/sandbox/`.

## The loop stats hook (`src/core/loop.ts`)

Add an optional hook to `LoopHooks`:

```ts
/** After render, once per frame. Times in milliseconds. */
stats?(s: FrameStats): void;

export interface FrameStats {
  raw: number;    // rAF timestamp minus the previous one, unsnapped
  dt: number;     // what the frame clock returned, x1000
  steps: number;  // update() calls this frame
  work: number;   // performance.now() spent inside frame + updates + render
  updateWork: number; // of which, inside the update() calls
}
```

Reuse one `FrameStats` object (no allocation per frame). When `raw`
cannot be measured (the first frame), report 0. `createFrameClock` gains
an option `snap: boolean` (default true); with `snap: false` it returns
the raw interval (still capped at `MAX_FRAME`). `startLoop` returns
`{ setSnap(on: boolean) }` so the range can switch it.

## The frame log (`FrameLog` in `src/ui/frame-graph.ts`)

- A ring buffer of the last `graph.frames` frames (600), in
  `Float32Array`s, one per `FrameStats` field plus `heap` (MB, from
  `performance.memory.usedJSHeapSize` where the browser has it, else NaN).
  `push(s, heapMb)` never allocates.
- `refreshMs()`: the median `raw` of the buffer.
- A frame is a **hitch** when `raw > graph.hitchFactor * refreshMs()`
  (1.5), or when it ran 0 steps or more than 2 while not paused.
- A hitch is a **long frame** when `work > graph.longWorkFactor *
  refreshMs()` (0.75), otherwise a **pacing** hitch.
- A **heap drop** is a frame where `heap` fell by more than
  `graph.gcDropMb` (1 MB) from the frame before: almost certainly a
  garbage collection.
- `summary()` returns: frames, refresh (ms and Hz), average and 95th
  percentile `raw` and `work`, worst `raw` and `work`, hitch count split
  into long and pacing, heap drops, and the frame numbers of the last 20
  hitches with their `raw`, `work`, `steps`, and whether a heap drop was
  within 2 frames of them.
- `report(extra)` returns a plain-text block: the summary, then the
  `extra` object (the switch states, browser user agent, device pixel
  ratio, screen size), for Paul to paste into chat.

## The graph (`FrameGraph`)

- A canvas in the top left, `graph.width` by `graph.height` CSS pixels
  (480 by 120), drawn every frame from the log, newest frame on the right.
- One bar per frame: height is `raw`, with the part that was `work`
  drawn in a second colour. A horizontal line at one refresh interval and
  one at the hitch threshold. A tick under each frame that ran 0 or 2+
  steps. A dot at each heap drop. A line for heap (MB) where available.
- Text above: `refresh Hz | avg / p95 / worst ms | hitches N (long L,
  pacing P) | GC drops G`.
- Back-quote (`` ` ``) shows or hides it, read with a plain keydown
  listener like the game's `KeyT`. It starts shown.
- Drawing must not allocate per frame either: reuse paths and strings
  only when the text changes (at most 4 times a second).

## The range (`src/range/main.ts`)

Copy the structure of `src/main.ts` (renderer, physics, input, player,
darts, blaster, `DartImpacts`, `DebrisSystem`, `MesherPool`, Foamers,
HUD, pause on Esc, paused drawing at `pausedFrame`) without the voxel
wall, `FallingPieces`, the foam blocks, the melee debug blast and the
thrown blocks. `DartImpacts` gets only the Foamers' parts as voxel targets.

Level, from `data/range.json`:

- Floor `range.size` square (60 m), outer walls 4 m high.
- `range.cover`: a list of boxes `[x, y, z, w, h, d]`, a few low walls
  and pillars at 8 to 25 m from the spawn.
- Distance markers on the floor every 5 m out from the player spawn (thin
  boxes, no collider), so spawn distances can be seen.
- The player spawns at `range.playerSpawn` facing the long axis.

The Foamer spawner on this page uses `range.spawn.points` and starts
with `range.spawn.count` (0: no Foamers until the panel adds them).

## The panel

Shown on the pause overlay (Esc), so it can be clicked with the mouse;
a "Play" button captures the mouse again. Layout like the sandbox panel.

**Switches** (each takes effect at once and is listed in the report):

- Foamers: on (update and draw) / off (removed and the spawner stopped).
- Shadows: on / off (`renderer.shadowMap.enabled` and the light).
- Pixel ratio: device / 1.
- Frame clock snap: on / off (`setSnap`).
- Auto-strafe: when on, the player walks left and right on its own,
  changing direction every `bench.strafePeriod` seconds (1.5), so a hitch
  that comes with walking can be reproduced without touching the keys.

**Test panel:**

- Dart type: one button per type in `data/darts.json`.
- Infinite ammo: on / off (the magazine refills after every shot).
- Spawn a Foamer at 5, 10, 20 or 30 m straight ahead of the player.
- Keep N alive: 0, 1, 4 or 10 (sets the spawner count).
- Clear Foamers.
- Benchmark: runs `bench.seconds` (20) with auto-strafe on and keeps the
  current switches, clears the log at the start, then shows the report.

**Report:** a box with `FrameLog.report(...)` text and a "Copy" button
(`navigator.clipboard.writeText`). Also a "Clear log" button.

## Foamer system (`src/foamers/foamers.ts`)

Small additions, no change for the game page:

1. `spawnCount` (public, default `SPAWNER.count`) and `spawnPoints`
   (public, default `SPAWNER.points`), used by the spawner in place of
   the constants.
2. `clear()`: removes every live, downed and broken Foamer piece, their
   bodies, colliders, meshes and voxel targets, and releases darts stuck
   to them.
3. `spawnAt(feet, facing)` if `spawn` cannot face a given point; otherwise
   use `spawn`.

## Data: `data/range.json`

```json
{
  "_note": "Test range page (ENG-11). Metres, seconds, CSS pixels.",
  "range": {
    "size": 60,
    "playerSpawn": [0, 0, 25],
    "cover": [[-4, 0.6, 12, 4, 1.2, 0.6], [5, 1.5, 5, 1, 3, 1], [-8, 0.6, -2, 3, 1.2, 0.6]],
    "spawn": { "count": 0, "points": [[-10, 0, -20], [10, 0, -20], [0, 0, -25]] }
  },
  "graph": { "frames": 600, "width": 480, "height": 120, "hitchFactor": 1.5, "longWorkFactor": 0.75, "gcDropMb": 1 },
  "bench": { "seconds": 20, "strafePeriod": 1.5 }
}
```

Adjust the cover boxes if they block the spawn line; keep the shape.

## Tests

`tests/core/loop-stats.test.ts` (drive `startLoop` with a fake
`requestAnimationFrame` and fake timestamps):

1. `stats` is called once per frame, with `steps` matching the number of
   `update` calls and `raw` the unsnapped timestamp difference.
2. The same `FrameStats` object is passed every frame.
3. With `setSnap(false)`, Firefox-style rounded timestamps at 60 Hz give
   `dt` equal to `raw`; with snap on, every `dt` is exactly 1/60 s (the
   existing loop tests stay as they are).

`tests/ui/frame-log.test.ts`:

4. Steady 60 Hz frames with one 50 ms frame: one hitch, `refreshMs()`
   within 0.1 ms of 16.67.
5. A 50 ms frame with `work` 40 ms counts as long; one with `work` 2 ms
   and 2 steps counts as pacing.
6. A heap that rises then falls by 5 MB is one heap drop, and a hitch on
   the next frame is reported as near it.
7. After more frames than the buffer holds, the summary covers only the
   last `graph.frames`; `push` does not allocate (spy on nothing; check
   the array buffers are the same objects before and after).

`tests/foamers/range-api.test.ts` (with the existing fake mesher):

8. `spawnCount = 0`: no Foamer spawns in 10 s of steps; set it to 2 and
   two are alive within `respawnDelay * 2 + 1` seconds.
9. `clear()` after a Foamer has a broken part and another is down: no
   Foamers, no broken pieces, no downed list, none of their parts left in
   the voxel targets, and the world has no bodies left that they owned.
10. `spawnPoints` replaced: new Foamers appear only at the new points.

## Done when

- [ ] `npm test` passes (all existing tests unchanged, plus the 10 new).
- [ ] `npm run build` passes and `dist/` contains `range.html`.
- [ ] `npx tsc --noEmit` is clean.
- [ ] The game page plays exactly as before (same course, blocks, wall).
- [ ] No em or en dashes anywhere you wrote (check with
      `perl -CSD -ne 'print "$ARGV:$.\n" if /\x{2014}|\x{2013}/' $(git ls-files)`).
- [ ] A dated `HANDOFF.md` log entry (`date +%F`): what was built,
      decisions and why, what is unverified. Do not delete or rewrite
      other entries or headings. Set the ENG-11 row in `PLAN.md` to
      "Review".
- [ ] Committed on `eng-11`, message starting `ENG-11:` and ending with
      `Co-Authored-By: Qwen3.8-27B via Pi <noreply@local>`. **Do not merge
      and do not push.**

Skip the browser check: the reviewer runs the range, the benchmark and
the switches in the browser.

## Known limits (do not fix in this task)

- Only F01 and the placeholder blaster exist; the panel lists only what
  the data files hold.
- No fix for the stutter here: this task only measures it.
- No fix for one blast popping a Foamer or for the canned topple (both in
  the 2026-11-01 play test notes; later tasks).

## If something is unclear

Stop and write the question at the top of your HANDOFF entry rather than
guessing. Do not change the public API of existing modules beyond what
this card lists.
