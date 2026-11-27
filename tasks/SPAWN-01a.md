# SPAWN-01a: Foamers teleport in (the timeline and the game side)

Paul, 2026-11-27: "Foamers need a teleport in/spawn animation, rather than
simply appearing." Owner: Inkling-2-Mini (swarm role `spawn-core`).
Reviewer: Claude. A second builder (`spawn-fx`, card SPAWN-01b) draws the
effect at the feet at the same time; you call it, you do not draw it.

## Read first

`AGENTS.md`, `data/spawn.json`, `src/foamers/spawn-in.ts` and
`src/foamers/spawn-fx.ts` (the contract: keep every exported name and
signature), `src/foamers/foamers.ts` (`spawn`, `spawnPack`, `update`: see
how a staggered Foamer is skipped), `src/foamers/foamer.ts`, and the two
arena calls in `src/arena/extras.ts` (search `foamers.spawn(`).

## Build, one commit per step

1. **The timeline** in `spawn-in.ts`, `spawnInPose(t)`: before
   `portalShare * seconds` the scale is `growFrom`, hidden is fine at 0.
   Then it grows to `overshoot` and settles to exactly 1 by `seconds`
   (an ease out and a small settle; any smooth curve, no Math.random).
   `active` is false until `t >= seconds`, then true and scale 1. Tests in
   `tests/foamers/spawn-in.test.ts`: the start, the middle, the overshoot
   is reached, exactly 1 and active at the end and after.
2. **The game side** in `foamers.ts` and `foamer.ts`:
   - `spawn(feet, facing, type, promoted, teleport = false)` and the same
     last argument on `spawnPack`, passed through.
   - A teleporting Foamer gets `spawnLeft` (seconds) on `Foamer`. While it
     is above 0, in `update`: count it down, set `f.group.scale` from the
     pose (about the feet: the group's origin is the feet, check that it
     is, and if not, scale a child instead), and skip everything else for
     that Foamer (brain, movement, attacks), the way the code skips other
     states. Its parts' colliders are off, so darts pass through and it
     takes no damage; turn them on when it becomes active.
   - The system owns one `SpawnFx` (`readonly spawnFx = new SpawnFx()`),
     adds `spawnFx.group` to its own `group`, calls
     `spawnFx.update(dt)` every update and `spawnFx.clear()` wherever the
     system clears its Foamers. On a teleport spawn call
     `spawnFx.start(feet, heightOfTheRig, mainColour)`.
   - The two arena calls in `src/arena/extras.ts` (a rift's wave and a
     trigger's spawn) pass `teleport: true`. Placed Foamers, ambushes and
     the range line up stay instant.
3. Tests in `tests/foamers/spawn-in-game.test.ts` (see the other Foamer
   tests for how a rig and a world are made): a teleporting Foamer does not
   move or attack and takes no dart damage until `seconds`, then does; its
   scale goes from small to 1; an instant spawn is unchanged; a restart
   that clears the Foamers clears the effect.

## Files

Yours: `src/foamers/spawn-in.ts`, `src/foamers/foamers.ts`,
`src/foamers/foamer.ts`, `src/arena/extras.ts` (the two calls only),
`tests/foamers/spawn-in.test.ts`, `tests/foamers/spawn-in-game.test.ts`,
this card. Not yours: `src/foamers/spawn-fx.ts` and `data/spawn.json`
(write a request in `docs/requests/spawn-core.md` if you need a change).

## Checks

`.swarm/preflight.sh` green before each commit. No browser: say what to
look at. Add `## Result` at the end of this card when done.
