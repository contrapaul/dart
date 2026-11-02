# ENG-08: AI director, Foamer brain and navigation

Written 2026-11-02. PLAN.md section 4.3 is the source: "Each Foamer is a
small state machine driven by a shared director that limits how many
enemies attack at once ... only a few enemies are allowed to attack at a
time, so arenas stay intense but fair." This unblocks GAME-10 (the next
Foamer types) and LVL-01 (the first arena).

```
ID:          ENG-08
Title:       Attack tokens (the director), a Foamer brain state machine,
             and grid navigation that follows voxel destruction
Owner:       DeepSeek V4.1 Flash (via Pi, OpenRouter)
Reviewer:    Claude Opus 5.5
Depends on:  GAME-03, ENG-10 (done); stage 3 also needs GAME-11 merged
Branch:      eng-08, in its own worktree
```

## Read first

1. `CLAUDE.md` (every rule applies to you)
2. `PLAN.md` sections 4.3 (AI), 7.5 (layout: AI code lives in `src/ai/`),
   7.3 (voxel destruction)
3. `src/foamers/foamers.ts` (`update`, `stepFoamer`: today's ad hoc state
   machine, the character controller move) and `src/foamers/foamer.ts`
4. `src/physics/world.ts` (collision groups, `SOLID_QUERY_GROUPS`)
5. `src/main.ts` (how carves and falling pieces change the level:
   `impacts.onCarve`, the pieces system)
6. `data/foamers.json`

## How to work (important)

Keep each reply's thinking short and act through tools. One stage per
run. Never write more than about 100 lines in one tool call. After each
file, run `npx tsc --noEmit` and the tests.

## Decision: grid navigation, not recast

PLAN.md 7.2 proposed recast-navigation (a WebAssembly navmesh). The level
is destructible: carves open holes and cut cover loose every few seconds,
and a navmesh would need re-baking around each change. A walkable grid
baked from the physics world is simpler, has no dependency, and can
re-bake a small rectangle in well under a millisecond. Flyers (later)
steer without the grid. Record this in PLAN.md section 14 in stage 2.

## Stage 1: the director (`src/ai/director.ts`)

Pure TypeScript, no Three.js or Rapier.

- Tokens by kind: `melee` and `ranged` (a Foamer's attack data says which
  it uses; F01's bonk and headbutt are `melee`). The number of each comes
  from `data/ai.json` per difficulty (Story, Normal, Hard, Foam Fury; the
  keys `story`, `normal`, `hard`, `fury`), default `normal`:
  melee 1, 2, 3, 4 and ranged 1, 2, 3, 4.
- `request(agentId, kind, score): boolean`: true if the agent now holds a
  token of that kind. Agents ask every step while they want to attack;
  when tokens are short, the highest score wins. The score is the
  caller's (stage 3 uses closeness to the player, being in view, and time
  spent waiting, so no Foamer starves).
- `release(agentId)`: give the token back. A token comes back to the
  pool after `tokenCooldown` seconds (data, 0.4), so attacks do not chain
  back to back.
- `update(dt)`, `forget(agentId)` (an agent that dies or despawns frees
  its token at once), and `stats()` for the range report (tokens in use
  per kind, agents waiting).
- No allocation per call after construction (fixed-size arrays sized by
  `data/ai.json` `maxAgents`, 64).

**Tests (`tests/ai/director.test.ts`):** a pool of 2 melee tokens with 5
agents asking gives tokens to the 2 best scores; a release frees a token
only after the cooldown; `forget` frees at once; a waiting agent's score
rising lets it win the next free token; ranged and melee pools are
separate; the difficulty keys give the counts above.

Commit: `ENG-08 stage 1: the director (attack tokens)`.

## Stage 2: navigation (`src/ai/nav-grid.ts`, `src/ai/steer.ts`)

- **Bake:** a 2D grid over a rectangle of the level, cell size from
  `data/ai.json` (`navCell`, 0.25 m). For each cell, cast down from
  `navTop` (8 m) to find the ground (Rapier ray, `SOLID_QUERY_GROUPS`,
  excluding Foamer and player colliders); the cell is walkable if there is
  ground, the slope is under `maxSlope` (40 degrees, from the hit normal),
  and a shape cast of an agent of `agentRadius` (0.35 m) and
  `agentHeight` (1.6 m) standing there hits nothing. Store ground height
  per cell (Float32Array) and walkable flags (Uint8Array).
- **Re-bake a rectangle:** `rebake(minX, minZ, maxX, maxZ)` redoes only
  the cells in it plus one agent radius around. The pages call it from
  `impacts.onCarve` (the carved volume's world bounds) and when a falling
  piece comes to rest or is removed.
- **Paths:** `findPath(from, to, out)`: A* on 8-connected cells (no
  corner cutting past a blocked cell), step-up limit `maxStep` (0.45 m)
  between neighbours, then string-pulled to the fewest waypoints with a
  grid line-of-sight check. If the goal is unwalkable, path to the
  nearest walkable cell. Reuse buffers: no allocation per query after
  the first.
- **Steering (`steer.ts`):** given an agent's position, its path and its
  neighbours, return the desired velocity: seek the next waypoint, arrive
  at the last, and separate from other agents within `separation`
  (0.9 m). Pure function on plain numbers.

**Tests (`tests/ai/nav-grid.test.ts`, `steer.test.ts`):** a floor with a
wall across it: the path goes round the end of the wall; after carving
a gap in the wall (remove the collider, `rebake` its rectangle) the path
goes through the gap; a 1 m ledge is not walkable up, a 0.3 m step is; a
slope steeper than `maxSlope` is not walkable; the string-pulled path on
an open floor is a single straight segment; separation pushes two
overlapping agents apart; bake of a 40 by 40 m floor at 0.25 m takes under
150 ms and a path query across it under 2 ms in the test runner (print
the times).

Commit: `ENG-08 stage 2: grid navigation and steering`.

## Stage 3 (only once GAME-11 is merged): the brain

Do not start this stage until the reviewer says GAME-11 is on main; it
changes the same Foamer state machine.

- `src/ai/brain.ts`: a small state machine base: states as a string
  union, `enter`, `update`, `exit` per state, `stateTime`, and a
  transition log the tests can read. F01's behaviour moves onto it with
  the same states it has today, plus `idle` and `alert`:
  - `idle`: stands, sways. Goes `alert` when the player is within
    `sightRange` (20 m) and in line of sight, when it takes damage, or
    when a Foamer within `alertRadius` (8 m) goes alert. Arena spawns
    start `alert`.
  - `alert`: a short telegraph (`alertTime` 0.4 s, a head turn to the
    player), then `approach`.
  - `approach`: follows a path to the player (re-pathing every `repath`
    0.5 s or when the grid re-bakes), steering with separation. At
    attack range it asks the director for a token; without one it
    holds: it circles at `holdRange` (2.2 m) facing the player, sidling
    left or right, and asks again each step. With the token it attacks;
    it releases the token when the attack ends, staggers, falls or goes
    down.
  - The states GAME-11 adds (`fall`, `crawl`) and `stagger`, `down` keep
    their behaviour; `crawl` uses the path too, at its crawl speed.
- The pages build one director and one nav grid per level, bake the grid
  at load over the level's bounds, and re-bake on carves and pieces.
- Range: the report adds the director's `stats()`; a **Nav grid**
  switch draws walkable cells as a faint overlay (one InstancedMesh,
  built when switched on) and each Foamer's current path as a line.

**Tests (`tests/ai/brain.test.ts`):** 4 F01s at the player: at most the
normal melee token count attack at once over 10 s, the rest hold at
`holdRange`; every one of them attacks at least once in 20 s (no
starving); an idle F01 out of sight stays idle, and goes alert when shot;
an F01 behind a wall walks round it to reach the player; the transition
log shows no state change that skips `alert` from `idle`.

Commit: `ENG-08 stage 3: Foamer brain on the director and the nav grid`.

## Data (`data/ai.json`)

All numbers above live here with a `_note` explaining each, in the style
of the other data files. Nothing tunable is hard coded.

## Done when (after stage 3)

- [ ] `npm test` passes (old tests unchanged, the new ones added).
- [ ] `npx tsc --noEmit` and `npm run build` pass.
- [ ] No em or en dashes anywhere you wrote (check with
      `perl -CSD -ne 'print "$ARGV:$.\n" if /\x{2014}|\x{2013}/' $(git ls-files | grep -vE '\.(png|glb|webp|jpg)$')`).
- [ ] A dated `HANDOFF.md` log entry at the top of the Log for each stage
      (`date +%F`): what was built, decisions and why, what is unverified.
      Set the ENG-08 row in `PLAN.md` to "DeepSeek (review)" after stage 3.
- [ ] Committed on `eng-08`, each message ending with
      `Co-Authored-By: DeepSeek V4.1 Flash via Pi <noreply@local>`. **Do
      not merge and do not push.**

## If something is unclear

Stop and write the question at the top of your HANDOFF entry rather than
guessing. Do not change the public API of existing modules beyond what
this card names.
