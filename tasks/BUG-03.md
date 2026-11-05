# BUG-03: the nav grid sees destructible blocks

Written 2026-11-06 (overnight), from the BUG-02 review. In the Pit, a
Swarmer pack spawned round the central block (`pit-block`, voxel pieces
filling x -4.8 to 4.8, z 2.4 to 5.6, floor to 3.2 m) put members inside
it. BUG-02's pack placement asks the nav grid, and the grid is wrong
there, twice over:

1. **The first bake is too early.** `makeLevelAI` (`src/ai/level.ts`)
   bakes once, at load, before the voxel pieces have built their
   colliders (they are meshed off the main thread and get colliders a
   few frames later). On a fresh page `groundAt(0, 4, 3.2)` finds no block
   top at all; after `grid.rebake(-6, 1, 6, 7)` it finds 3.2 m. Nothing
   rebakes when the colliders arrive, only on a carve or a resting piece.
2. **Inside a block reads as walkable.** After that rebake,
   `canStandAt(0, 4, 0)` is still true: the floor under the block is a
   walkable layer. Voxel pieces collide as hollow trimeshes, and the
   bake's agent shape test (`SOLID_QUERY_GROUPS`) only meets surfaces, so
   a cell in the middle of a solid block passes.

Foamers are pathed through or into every destructible block until it is
carved, which also fits the earlier "stalled against a block" reports.

```
ID:          BUG-03
Title:       The nav grid is baked once the level's voxel pieces have their
             colliders, and a cell inside a solid voxel volume is never
             walkable
Owner:       Pi (Qwen 3.8-27B, qwen-machine, 1cat config, thinking low)
Reviewer:    Claude Opus 5.5
Depends on:  BUG-01, BUG-02 (done)
Branch:      bug-03, in its own worktree
```

**Running at the same time:** LVL-02d (the Spark) raises
`nav.maxLayers` to 4 and may touch the layer code in
`src/ai/nav-grid.ts`, and builds the tower in `data/levels/1-2.json`;
GAME-09b (DeepSeek) is in the Foamer hit path. In `nav-grid.ts` change
only the per-cell walkability test and add the new hook; leave the layer
search, `nodeNear` and the A* alone. Do not edit `data/levels/`,
`src/foamers/` or `src/player/`.

## Read first

1. `CLAUDE.md`; `tasks/BUG-01.md`; `tasks/BUG-02.md` and its review entry
   in HANDOFF (the numbers above)
2. `src/ai/level.ts`, `src/ai/nav-grid.ts` (`bake`, `bakeCell`: the
   down cast, the layers, the agent shape test)
3. `src/voxel/pieces.ts` (how a level piece gets its colliders, when,
   `onRest`), `src/level/build.ts` (how the level's pieces are built),
   `src/game/game.ts` (where `makeLevelAI` is called and the pieces are
   stepped)
4. How a voxel volume answers "is this point solid": `src/voxel/` (the
   volume's get, world to voxel)
5. `tests/ai/nav-grid.test.ts`, `tests/level/` (the Pit and Ring loads)

## What to build

- **Bake after the colliders:** the grid is right for the level's
  pieces from the first frame a Foamer can path. For example: the pages
  rebake the level's bounds (or just the pieces' boxes) once every
  level piece has its colliders, or the bake waits for them. Pick the
  simplest that is reliable and say why in section 14.
- **Solid inside:** a hook on the grid, `solidAt(x, y, z) => boolean`
  (null by default, so the grid's own tests and pages without pieces work
  as now), that `makeLevelAI` sets from the level's voxel pieces. The bake
  rejects a layer when the hook says the agent's body would be inside a
  solid voxel (probe a few heights over the layer, up to the agent
  height). A carve that empties the space makes it walkable again on the
  existing carve rebake.
- **Tests:** a level with a solid voxel block on a floor: before the fix
  the cells inside read walkable (show it fails on the old code), after
  it they do not, the block's top does (if an agent fits), and the floor
  round it does; after carving a tunnel through it the tunnel cells are
  walkable. The Pit: on a grid built the way the page builds it, the
  centre of `pit-block` is not walkable at floor height. The existing nav
  and level tests and the timing test pass unchanged (a solid hook must
  not slow the bake past its budget: say the times).

## Done when

- `npx tsc --noEmit`, `npx vitest run`, `npm run build` pass; no em or en
  dashes.
- PLAN.md: a BUG-03 row beside BUG-02; decisions in section 14. HANDOFF:
  a dated entry at the top of the Log, Status updated, the bake timings,
  and what was not checked by eye (Foamers walking round the Pit's block
  in the browser: the reviewer will check).

## Not in this task

The layer limit (LVL-02d), the Swarmer brain, the parry helper, any
level data.
