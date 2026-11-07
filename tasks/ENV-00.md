# ENV-00: a proposal of environment and terrain elements, for Paul to choose from

Written 2026-11-07. Paul's order of work (PLAN.md section 14,
2026-11-07): first the gameplay of every enemy and weapon plus the
environmental and terrain elements, then his story, flow and new levels.
The game has destructible voxel pieces, doors, lifts, drops, ramps and
the kit's connectors (`design/levels/KIT.md` section 3), but no list of
environment elements beyond those. This card writes that list as a
design document, as LVL-00 did for the levels. No code.

```
ID:          ENV-00
Title:       Environment and terrain elements: a proposal of 10 to 14
             candidates, each with what it teaches, what it pairs with
             and a cost to build, for Paul to approve, change or cut
Owner:       Pi (DeepSeek V4.1 Flash, openrouter, thinking high)
Reviewer:    Claude Opus 5.5
Depends on:  LVL-00 (done)
Branch:      env-00, in its own worktree
```

**Running at the same time:** GAME-10j (qwen-machine: the F10 Turbo in
`src/foamers/`, `src/ai/`, `data/`). Your only new file is
`design/levels/ENVIRONMENT.md`; you also edit `PLAN.md` (a row, and
section 13 for the open questions) and `HANDOFF.md`. No code, no data.

## Read first

1. `CLAUDE.md` (foam only, no fluids or horror, toy look, audience 10+,
   Paul writes the content: names and settings are `[Paul]`)
2. `PLAN.md` sections 2, 3, 7.3 (destruction), 9 (level design)
3. `design/levels/README.md` (the pillars), `design/levels/KIT.md`
   (sections 3, 5, 6: connectors, destructibles, caps)
4. `design/CONTENT-PLAN.md` sections 3 (the Foamers), 3.1 (parts) and 4
   (the blasters: B05 to B08 are not built; B07's explosions carve
   terrain)
5. The level concepts `design/levels/LEVEL-1-*.md`, skimmed for what the
   levels already ask of the terrain

## What to write

`design/levels/ENVIRONMENT.md`, in the house style of the level docs
(plain short sentences, tables, no em or en dashes):

1. **What already exists** (half a page): the terrain pieces the game
   has today and where the code is, so Paul sees the base.
2. **Candidates, 10 to 14,** across these kinds, at least one each:
   destructible (beyond voxel pieces), hazard, movement (jump pads,
   moving or collapsing floors, ledges), interactive (switches, things
   the player sets off), cover that changes during a fight, and
   pickups or stations placed in the world. For each, a table row and a
   short paragraph:
   - what it is and how it looks in foam and toy terms,
   - what it teaches or adds to a fight, which Foamers and blasters it
     pairs with (by ID), and which pillar in `README.md` it serves,
   - a build cost (S, M, L) and what in the code it would need (the
     voxel system, the nav grid, the physics, the runner),
   - risks: performance (the caps), the nav grid (can Foamers path
     around or over it), readability, the age 10+ rule.
3. **A recommended first set** of 4 to 6, with the reason, and the order
   to build them in.
4. **Questions for Paul** in PLAN.md section 13, and `[Paul]` wherever a
   name, a setting or a look is his to give.

Rules: nothing that reads as a fluid, fire, electricity that hurts, or
horror; foam and toys only. Every number is a proposal. Do not invent
story, place names or characters.

## Done when

- `design/levels/ENVIRONMENT.md` exists with the four parts above; no em
  or en dashes (check with perl as the brief says).
- PLAN.md: an ENV-00 row after the LVL-04b row (status: proposal, for
  Paul); the questions in section 13. HANDOFF: a dated entry at the top
  of the Log (directly under `## Log`) and the Status.
- `npx vitest run` still passes (no code was touched; prove it).

## Not in this task

Building any element, level files, story, names.
