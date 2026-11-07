# GAME-10i: the F07 Brawler gets its foam sword

Written 2026-11-07. GAME-10f built the F07 Brawler with lime fists and
left "sword or fists" to Paul. Paul chose the sword (PLAN.md section 14,
2026-11-07). CONTENT-PLAN F07: "A taller, stronger looking F02 with
apparent armor that uses a foam sword. Purple body, orange armour, lime
sword." Section 3.1: parts arms and legs; legs gone means no leap slam.

```
ID:          GAME-10i
Title:       The F07 Brawler: a lime foam sword in its right hand in place
             of the right fist, a sword swing in place of the punch, the
             sword a breakable part, the leap slam unchanged
Owner:       Pi (Qwen 3.8-27B, qwen-machine, thinking medium)
Reviewer:    Claude Opus 5.5
Depends on:  GAME-10f (done)
Branch:      game-10i, in its own worktree
```

**Running at the same time:** LVL-04b stage 2 (DeepSeek:
`data/levels/1-4.json`, `src/level/`, `src/arena/`, a new top-level
`promoted` block in `data/foamers.json`, and a small change where
`src/foamers/foamers.ts` spawns a Foamer, to apply a promoted spawn's
health and plate colours). Stay out of the spawn code and the
`promoted` block. Your files: the F07 rig in `data/foamer-rigs.json`,
the F07 entry in `data/foamers.json`, the melee attack code in
`src/foamers/`, `tests/foamers/brawler.test.ts` and new test files,
`design/foamers/F07-*`, `data/sounds.json` and `design/SOUNDS.md` for
F07 only.

## Read first

Read each once; write yourself a short note instead of rereading.

1. `CLAUDE.md` (toy weapons only: a foam sword, rounded, no edge or
   point that reads as sharp)
2. `design/CONTENT-PLAN.md`: the F07 rows (sections 3, 3.1, 3.3, 3.4)
3. `tasks/GAME-10f.md` and its PLAN.md section 14 rows
4. The F07 rig in `data/foamer-rigs.json` and the F07 entry in
   `data/foamers.json`; the shapes `src/foamers/rig.ts` can build
5. `tests/foamers/brawler.test.ts`

## What to build

All numbers in data. Two stages; each leaves the game working and is
committed on its own. Starting numbers are proposals for Paul to tune.

**Stage 1: the sword.**
- **Look:** replace `fistR` with a foam sword held in the right hand: a
  hilt, a cross guard and a long rounded blade (about 1.2 m, built from
  the rig's existing shapes; a `box` with soft ends or a `capsule` is
  fine), lime, parented to `foreArmR` so it moves with the arm. The left
  fist stays. Body purple, armour pads orange, as now. Render the
  turnaround with `npx tsx tools/render-rig.ts F07` into
  `design/foamers/`.
- **Part:** the sword is a breakable `weapon` part with its own health,
  the way the F09's gun and the F08's launchers are.
- **Attack:** a `swing` replaces the right-hand punch: a windup (start
  0.8 s, the sword drawn back), a wide horizontal strike (start 0.25 s)
  that reaches farther than the punch (start 2.4 m; say in section 14 how
  the reach is set), damage start 16. It needs the sword. With the sword
  gone it fights with its left fist: the existing punch, needing
  `foreArmL` only. The leap slam and its shockwave are unchanged, and
  still end when both legs are gone.

**Stage 2: sounds and docs.**
- Placeholder sound IDs for F07 only: `F07-swing` (the whoosh) and
  `F07-sword-break`. Then the docs (below).

## Done when

- Tests in `tests/foamers/`: the F07 rig has a `sword` part parented to
  the right forearm and no right fist; the sword takes damage and breaks
  off; with the sword the Brawler swings, and a player inside the swing's
  reach but outside the old punch's is hit; with the sword gone it
  punches with the left fist; the leap slam and shockwave tests from
  GAME-10f pass unchanged; every other type's tests unchanged.
- `npx tsc --noEmit`, `npx vitest run`, `npm run build` pass; no em or en
  dashes.
- PLAN.md: a GAME-10i row under GAME-10h; decisions in section 14.
  HANDOFF: a dated entry at the top of the Log (directly under
  `## Log`), Status updated, and what was not checked by eye.

## Not in this task

A sword parry or block, a thrown sword, a sword on any other Foamer, the
promoted look, level files.
