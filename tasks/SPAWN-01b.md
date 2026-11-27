# SPAWN-01b: the teleport's look at the feet

Paul, 2026-11-27: "Foamers need a teleport in/spawn animation, rather than
simply appearing." Owner: Inkling-2-Mini (swarm role `spawn-fx`).
Reviewer: Claude. A second builder (`spawn-core`, card SPAWN-01a) makes the
Foamer grow in and calls your class.

## Read first

`AGENTS.md`, `CLAUDE.md` (foam only, no gore, no demonic or religious
imagery: this is foam arriving, not a hell portal), `data/spawn.json`,
`src/foamers/spawn-in.ts` and `src/foamers/spawn-fx.ts` (the contract: keep
every exported name and signature), `src/arena/rifts.ts` (the rift seam's
colours), and how debris and the foam material look
(`src/render/foam-material.ts`, `src/voxel/debris.ts`).

## Build, one commit per step

Fill in `SpawnFx` in `src/foamers/spawn-fx.ts`. One arrival lasts
`spec.seconds`. Times below are shares of it.

1. **The ring:** a flat foam disc on the floor at the feet, in
   `look.ringColour`, that opens from 0 to `look.ringRadius` over the
   first `portalShare`, glows (MeshBasicMaterial, additive or a bright
   colour, depthWrite false), then shrinks and fades out by the end.
2. **The column:** a soft cylinder of foam (open ended, `look.foamColour`,
   see-through, depthWrite false) rising to `look.columnHeight`, or the
   Foamer's `height` if that is larger, over the portal time, fading as the
   body grows.
3. **The puff:** `look.chunks` small foam cubes thrown up and out from the
   feet at `look.chunkSpeed`, falling under gravity and shrinking away, in
   the Foamer's own `colour` and the foam colour. Directions from a small
   seeded PRNG (no Math.random).
4. **Pool and cap:** build at most `maxLive` arrivals' meshes once (in the
   constructor or on first use) and reuse them; `start` returns false past
   the cap. `update` allocates nothing. `clear` hides every arrival.

Tests in `tests/foamers/spawn-fx.test.ts`: `start` shows an arrival and
`live` counts it; the ring's radius grows then shrinks; after `seconds`
everything is hidden and `live` is 0; the cap holds; the same start gives
the same chunk directions; `update` makes no new objects (count the
group's children before and after).

## Files

Yours: `src/foamers/spawn-fx.ts`, `data/spawn.json` (the `look` block and
`maxLive`; keep the other keys), `tests/foamers/spawn-fx.test.ts`, this
card. Not yours: `src/foamers/spawn-in.ts`, `foamers.ts` (requests go in
`docs/requests/spawn-fx.md`).

## Checks

`.swarm/preflight.sh` green before each commit. No browser: say what to
look at. Add `## Result` at the end of this card when done.
