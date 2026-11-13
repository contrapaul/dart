# ENV-05: a leaking foam barrel that blows up

Written 2026-11-13. Paul: "I'd like a 'barrel' added to the range that
'sprays' cubes from puncture impacts before exploding. As if it's leaking
fuel. A single puncture with a standard dart would result in an explosion
10 seconds later, a second puncture cuts the explosion timer in half, and
a third sets it off. This means a 3 round cluster of the Dartman would
blow up the barrel. All other ammo instantly blows it up. If the 'spray'
effect is good we'll explore on mobs." He also wants explosive terrain
later (FX-01), so build it as a reusable element, shown on the range first.

```
ID:          ENV-05
Title:       E15 the leaking barrel: punctures spray foam cubes and start a
             fuse, standard darts shorten it, any other round sets it off;
             on the range first
Owner:       Pi (DeepSeek V4.1 Flash 1017, OpenRouter, thinking medium)
Reviewer:    Claude Opus 5.5
Branch:      env-05, in its own worktree
```

**Your files:** a new `src/level/barrels.ts` (the system) and a new pure
`src/level/barrel-fuse.ts` (the rules), a new `data/barrel.json`,
`data/explosion.json` (a `barrel` profile only), `data/range.json` and
`src/range/main.ts` (or `src/range/setup.ts`) to place and wire it,
`design/levels/ENVIRONMENT.md` (an E15 entry), new tests in `tests/level/`.
Two other models are working at the same time on pickups and melee
(`tasks/HP-01.md`, `tasks/MEL-01.md`): do not touch `src/pickups/`,
`src/game/melee.ts` or `src/game/game.ts`.

## What is there today (read first)

- `src/weapons/explosion.ts` `ExplosionSystem.explode(point, profile)`:
  damage, carve, push, a chunk burst, and (FX-01) the visible blast through
  `onExplode(point, fxRadius)`. Profiles in `data/explosion.json`.
- `src/voxel/debris.ts` `DebrisSystem`: loose foam cubes with a hard cap
  (`destruction.json` `debris.max`, the oldest reused). Its `burst` uses
  `Math.random`; your spray must use a seeded PRNG (`makeRng` in
  `src/audio/synth.ts` is one; copy or move it to a shared place if you
  import it outside audio).
- `src/weapons/darts.ts` and `src/weapons/impacts.ts`: how a dart hit is
  reported (dart type, point, normal). Find the hook other targets use.
- The range: `data/range.json`, `src/range/main.ts`, `src/range/setup.ts`;
  the `T` key respawns the line.

## The rules (Paul's, put in the pure module and `data/barrel.json`)

- A **puncture** is a hit by a `standard` dart. Every other dart type, the
  ball, a blast reaching the barrel, sets it off at once.
- Puncture 1 starts the fuse at `fuseSeconds` (10). Puncture 2 halves the
  time left. Puncture 3 sets it off. So B01's three standard darts in one
  shot set it off at once (three punctures in the same step count as
  three).
- When it goes off: one `explode(centre, "barrel")` (a new profile in
  `data/explosion.json`, bigger than the launcher's: start carveRadius 1.2,
  damageCentre 30, rangeMetres 4.5, fxRadius 3.6, the rest like
  `launcher`), then the barrel is gone. A barrel set off by a blast goes off
  a short `chainDelay` later (start 0.15 s), so a row of barrels ripples.
- A `maxPerSecond` style cap is already on explosions; respect it.

## The look

- A code-built toy barrel: a short foam cylinder (start 0.6 m across,
  0.9 m tall) in a bright warning colour from the palette
  (`data/materials.json`; orange body, a yellow band), with a solid
  collider so darts hit it and the player cannot walk through it. No
  hazard symbols copied from real products.
- **The spray** (the part Paul will judge): each puncture becomes a leak
  at the hit point that jets small foam cubes out along the hit's normal
  in a narrow cone, as if fuel were leaking, from the puncture until the
  barrel goes off. Numbers in `data/barrel.json` `spray`: cubes per
  second per leak (start 25), speed, cone degrees, cube size, colour (a
  foam colour, not a liquid; no fluids, PLAN.md section 2), at most
  `maxLeaks` 3. The cubes go through `DebrisSystem` so the hard cap holds.
  The jet gets faster as the fuse runs down, so the player can read it.
- Optional and cheap only: the barrel swells or wobbles slightly in the
  last second.

## The range

Two barrels in `data/range.json` (say one beside the Foamer line and one
in the open), a `T` respawn brings them back. On the range the barrel's
blast hurts Foamers but not the player (as all blasts on the range).

## Done when

- Tests for the pure rules: one puncture gives a 10 s fuse; a second at
  t = 4 s leaves 3 s; a third goes off at once; three in one step go off;
  a mega dart, a ball, a precision dart and a blast each set it off at
  once; nothing happens after it has gone off. For the system: a spray
  never adds more cubes than its rate allows and stops when the barrel is
  gone; the barrel profile exists and `explode` is called once.
- `npm run check` and `npm run smoke` pass.
- `design/levels/ENVIRONMENT.md`: an E15 entry. PLAN.md: an ENV-05 row
  next to ENV-04. HANDOFF.md: a dated entry directly under `## Log` with
  how to try it on the range and what was not seen by eye.

## Rules

No em dashes anywhere (`node tools/check-no-em-dash.mjs`). Nothing fetched
from another host. Tuning numbers live in `data/` JSON. Edit JSON by hand,
never by dumping it from a script. Never `Math.random` in simulation code.
Anything that spawns objects has a hard cap. Commit on `env-05` with a
Conventional Commit message (include `tasks/ENV-05.md`); do not push.
