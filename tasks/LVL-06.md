# LVL-06: level 2-1 concept, and the blaster rows brought up to date

Written 2026-11-13. Act 1 is being chained into one campaign (LVL-05).
The next level to build is 2-1, the first level of Act 2 and level 5 of
the campaign. It has a short concept in `design/levels/ACTS-2-3.md`;
Act 1's levels each got a full concept (`design/levels/LEVEL-1-x.md`)
before they were built. This card writes 2-1's. Design only: no code.

```
ID:          LVL-06
Title:       design/levels/LEVEL-2-1.md, a full concept in the shape of
             LEVEL-1-4.md, for Paul to approve; the blaster rows in the
             level docs follow Paul's campaign rules
Owner:       Pi (DeepSeek V4.1 Flash 1017, OpenRouter, thinking medium)
Reviewer:    Claude Opus 5.5
Branch:      lvl-06, in its own worktree
```

**Your files:** a new `design/levels/LEVEL-2-1.md`;
`design/levels/LEVEL-1-1.md` to `LEVEL-1-4.md` and `ACTS-2-3.md` only
for the "New blaster" lines; `design/levels/README.md` if it lists the
level docs. Nothing in `src/`, `data/` or `tests/` (another model is
changing those).

## Paul's rules (PLAN.md section 14, 2026-11-13)

- The player starts with B02 only. Blasters are found in levels: B01 in
  level 1 (1-1, the Pit), B04 in 2 (1-2), B03 in 3 (1-3), B05 in 4 (1-4),
  **B06 in 5 (2-1)**, B07 in 7 (2-3), B08 in 9 (3-1). From level 5 on, a
  new blaster comes every second level (none in 6 and 8) on purpose.
- Health and ammo carry between levels; hand weapons are found in levels
  too (which and where is decided later, with melee).
- Level 1 is the Pit as it is; the longer 1-1 in LEVEL-1-1.md is not built
  for now.
- Direction: semi-open linear (PLAN.md section 9): one clear critical path,
  wide multi-level spaces off it, arenas lock until cleared.

## What to write

1. **Read first:** `PLAN.md` sections 2 and 9, `design/CONTENT-PLAN.md`,
   `design/levels/README.md`, `KIT.md`, `BLOCKOUT.md`, `ENVIRONMENT.md`,
   all four `LEVEL-1-x.md`, `ACTS-2-3.md`, `data/blasters.json` (B06 The
   Standard: what it does and its mods) and `data/foamers.json` (which
   Foamers exist and what each does).
2. **`LEVEL-2-1.md`** in the same shape as `LEVEL-1-4.md`: the header
   table (new blaster **B06**, new Foamer, new mechanic, arenas, target
   time, archetypes), what it teaches and how the space does it, beat by
   beat with minutes, each arena's waves (which Foamers, how many, from
   where), the sketch of each signature space (one character = 2 m), where
   B06 is found (on the critical path, before the arena that needs it),
   ammo and health placement, the exit, and open questions for Paul.
   Build on the 2-1 short concept: the workshop floor, the gantry, F04
   Blockers and flanking. Its "B04 flywheel auto" no longer applies (B04
   is found in 1-2): the auto blaster here is B06, which suits carving a
   shield line. Melee weapon 1 is listed as decided later.
3. **Only Foamers that exist** in `data/foamers.json`; if the concept
   wants one that does not, say so as an open question.
4. **Blaster rows:** in `LEVEL-1-1.md` to `LEVEL-1-4.md` and every level
   in `ACTS-2-3.md`, the "New blaster" line follows Paul's rules (and
   says "none, by design" for levels 6, 8 and others without one). Keep
   the rest of those docs as they are.
5. Names of places, the level and its setting are `[Paul]`. No trademarks,
   no horror, foam only, ages 10 and up (PLAN.md section 2).

## Done when

- `node tools/check-no-em-dash.mjs` passes and `npm run check` passes.
- HANDOFF.md: a dated entry directly under `## Log` listing the open
  questions for Paul. PLAN.md: an LVL-06 row in section 12 next to LVL-05.
- Commit on `lvl-06` with a Conventional Commit message
  (`docs(levels): ...`), including `tasks/LVL-06.md`. Do not push.
