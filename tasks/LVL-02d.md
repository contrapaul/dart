# LVL-02d: Level 1-2 beat 5, the tower climb, and a nav grid with more floors

Written 2026-11-06 (overnight). LVL-02c built beats 6 to 9 and left a
marked empty bay in the connecting corridor where the beat 5 tower goes
(`_note` in `data/levels/1-2.json`). The tower is four floors stacked over
one footprint, and the nav grid holds at most two walkable surfaces per
cell (`data/ai.json` `nav.maxLayers` 2, BUG-01 round 2), so a Foamer on
floor 3 cannot be pathed today. This card raises the layer limit, proves
it costs little, and builds the tower.

```
ID:          LVL-02d
Title:       The nav grid holds four walkable layers per cell at the same
             speed budget; Level 1-2 beat 5, the tower set piece, fills the
             bay between the Ring and the Crossroads
Owner:       Pi (Qwen 3.8 Flash Next, dgx-spark, thinking medium)
Reviewer:    Claude Opus 5.5
Depends on:  LVL-02c, BUG-01 (done)
Branch:      lvl-02d, in its own worktree
```

**Running at the same time:** GAME-09b (the Foamer hit and kill path in
`src/foamers/foamers.ts`) and BUG-02 (`spawnPack` and the `parryNext`
helper). Your files are `src/ai/nav-grid.ts`, `data/ai.json` (the `nav`
block only), `data/levels/1-2.json`, `src/level/`, `src/arena/` and their
tests. Do not edit `src/foamers/`, `src/game/` or `src/player/`.

## Read first

1. `CLAUDE.md`; `design/levels/LEVEL-1-2.md` section 2 (beat 5) and
   section 4 "Set piece: Tower climb (A5)"; `design/levels/KIT.md` (A5)
2. `tasks/BUG-01.md` (round 2: the layered grid) and `src/ai/nav-grid.ts`
   (how layers are found in `bake`, `nodeNear`, the A* over nodes)
3. `tests/ai/nav-grid.test.ts`, especially the timing test (bake under
   150 ms, a path under 2 ms) and the two-layer Pit tests
4. `data/levels/1-2.json` (the bay's `_note`, the connector, how LVL-02c
   did the bowl's ramps), `tests/level/level-1-2.test.ts`
5. `src/level/arena.ts` and `level-runner.ts` (whether an arena can run
   without locking: the tower has no lock-in)

Write the level in small pieces (one room or one floor per edit or short
script), never the whole file in one reply: a previous run lost its work
to the output limit that way.

## What to build

- **Layers:** `nav.maxLayers` to 4 in data. Whatever in `nav-grid.ts`
  assumed two (if anything) handles up to `maxLayers`. Tests: a stack of
  four floors 5 m apart bakes four layers; a path from floor 1 to floor 4
  climbs the stairs; the existing Pit and BUG-01 tests pass unchanged;
  the timing test passes unchanged (do not loosen it). Say the bake and
  path times before and after in HANDOFF (rerun the timing test alone if
  other runs load the machine).
- **The tower (beat 5)** in the bay, scaled to fit as LVL-02c scaled its
  spaces (say what in section 14): four floors about 5 m apart, a hole in
  each slab on alternating sides, and a walkable way up each storey that
  the player and Foamers can both use without jumping (stairs or ramps:
  the player's `stepHeight` is 0.4 m and the nav autostep is 0.2 m, so
  1.5 m ledges alone will not do; keep the ledge look where you can).
- **Fights:** 2 Roamers on floor 2; 2 Roamers and 1 Slowmer on floor 3.
  The design says no lock-in. If the runner can play an arena with no
  doors that lock, use that; otherwise one arena per fight whose doors are
  all open and stay open, and say so in section 14. Rifts on those floors
  (the format has no placed Foamers).
- **The ceiling plug:** a cardboard voxel piece above floor 2 that one
  shot breaks, dropping a foam slab to the floor below if the existing
  break-off islands do that; otherwise a `_note`. No damage from it.
- The way out at the top leads on to the connector and the Crossroads as
  now. The level stays playable start to exit.

## Done when

- Tests: the layer tests above; `1-2.json` validates with the tower's
  arenas in order (now six); the walk from start to exit is on floor all
  the way, the tower's floors included; each tower floor is walkable on
  the nav grid and a path exists from the tower's bottom to its top; the
  existing level tests pass (update only what the tower changes).
- `npx tsc --noEmit`, `npx vitest run`, `npm run build` pass; no em or en
  dashes.
- PLAN.md: an LVL-02d row under LVL-02c; decisions in section 14. HANDOFF:
  a dated entry at the top of the Log, Status updated, the timings, and
  what was not checked by eye (the climb, the shots from above, the plug).

## Not in this task

Fall damage and the 8 s fall cost, the satchel weak point, stations,
secrets, the level's name and setting.
