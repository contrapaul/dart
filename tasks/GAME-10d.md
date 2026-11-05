# GAME-10d: the F03 Swarmer, a fast pack that nibbles

Written 2026-11-05. GAME-10a made Foamer types data driven, GAME-10b added
the F05 Darter. The F03 rig is a greybox in `data/foamer-rigs.json` (body,
head, four legs, `movement: scurry`, speed 4.5, `pack` 5, health 2).
CONTENT-PLAN F03 (Paul): "Fodder. Small, fast, comes in packs of 4 to 6.
Nibble swarm. Teaches spread blaster, staying mobile. Weak point: none.
Health 2. First seen 1-3. Name: Swarmer. Look: foamy dogs with big
mouths. Purple body, lime spines, orange mouth."

```
ID:          GAME-10d
Title:       The F03 Swarmer: a pack of small fast four-legged Foamers that
             dart in for quick nibbles and back out, with its own token pool
             and a hard cap on live Swarmers
Owner:       Pi (DeepSeek V4.1 Flash, openrouter deepseek/deepseek-v4.1-flash-1017)
Reviewer:    Claude Opus 5.5
Depends on:  GAME-10a, GAME-10b, ART-03 (done)
Branch:      game-10d, in its own worktree
```

**Running at the same time:** GAME-08 (vacuum) and GAME-06 (melee). Do not
edit `src/player/shield.ts`, `data/shield.json`, the melee or use key
blocks in `src/game/game.ts`, or `src/pickups/`. Do not add `vacuum`
entries to `data/foamers.json` (GAME-08 owns those).

## Read first

1. `CLAUDE.md` (every rule applies; no teeth, no horror: the "big mouth"
   is a wide open foam mouth with no teeth, the spines are soft rounded
   foam nubs)
2. `design/CONTENT-PLAN.md`: the F03 row and section 3.1; PLAN.md 3.1, 4.3
3. `tasks/GAME-10a.md`, `tasks/GAME-10b.md`, `tasks/ART-03.md` (how F01,
   F02 and F05 got their factory palette looks and turnaround sheets)
4. `data/foamers.json` (base and `types`), `data/foamer-rigs.json` (F03 and
   F05 for the palette fields), `data/ai.json` (tokens per difficulty)
5. `src/foamers/foamers.ts`, `foamer.ts`, `rig-states.ts`; `src/ai/`
   (`f01-brain.ts`, `f02-brain.ts`, `f05-brain.ts`, `agent.ts`,
   `director.ts`); `src/range/main.ts` (the type choice), `tools/render-rig.ts`

## What to build

All numbers in data.

- **Look:** give the F03 rig its factory palette in the way ART-03 did
  for F01, F02 and F05: purple body, lime spines (rounded foam nubs along
  the back), an orange wide open mouth (no teeth), eyes like the others.
  Low, dog-like proportions on four legs. Render the turnaround sheet with
  `npx tsx tools/render-rig.ts F03` into `design/foamers/` so the reviewer
  and Paul can see it.
- **Type:** an `F03` entry in `data/foamers.json` `types` (rig F03, health
  2, its speed, its nibble). F01, F02 and F05 behave exactly as before;
  their tests pass unchanged.
- **Brain:** `src/ai/f03-brain.ts` in the style of the others. The pack
  notices together (one alert wakes the pack), runs at the player, and
  attacks hit and run: a short windup (start 0.25 s), a quick nibble for
  small damage (start 3), then it darts back out to a ring (start 3 m)
  before it may nibble again (start a 1.2 s gap). Between nibbles it
  circles at speed so it is hard to track. Losing legs follows the
  existing rules (four legs: it falls when it is left with fewer than the
  data's share; crawl as now).
- **Tokens:** a new `swarm` token kind in `data/ai.json` per difficulty
  (start Story 2, Normal 3, Hard 4, Foam Fury 6), separate from `melee`
  and `ranged`, so a pack can nibble together without starving the F01s.
- **Pack spawn and cap:** `spawnPack(feet, facing?, count?)` spawns
  `pack` Swarmers around a point (count from the rig's `pack` unless
  given), and a hard cap on live Swarmers (`maxAlive`, start 12) in data:
  past the cap a spawn is skipped, never the oldest removed.
- **Damage:** a nibble goes through the existing attack path (`damageOf`,
  the shield's `blocksAttackFrom`, the 0.5 s grace), so the shield blocks
  it from the front.
- **Range and watch:** the range's type choice spawns a Swarmer pack; the
  watch's `state()` already lists types and states, keep it working.
- **Sounds:** placeholder IDs in `data/sounds.json` and `design/SOUNDS.md`:
  `F03-yip` (alert), `F03-nibble`, `F03-scurry` (a light loop or repeated
  patter, cheap).

## Done when

- Tests in `tests/foamers/` and `tests/ai/`: the F03 type reads its own
  spec; one alert wakes the whole pack; a nibble needs a `swarm` token, and
  `swarm` tokens do not use up `melee` ones; after a nibble the Swarmer
  backs out to its ring and waits its gap; `spawnPack` spawns `pack`
  Swarmers and never passes `maxAlive`; F01, F02, F05 tests unchanged.
- The range Benchmark with two packs (10 Swarmers) out: say the frame
  time in HANDOFF (run headless if you cannot open a browser: then say so).
- `npx tsc --noEmit`, `npx vitest run`, `npm run build` pass; no em or en
  dashes.
- PLAN.md: a GAME-10d row under GAME-10b; decisions in section 14 (the
  token pool, hit and run). HANDOFF: a dated entry at the top of the Log,
  the Status section updated, and what was not checked by eye (the look,
  the scurry, the nibble, the sounds).

## Not in this task

Level 1-3 itself (LVL-02), vacuum entries (GAME-08), finisher variety,
new art files beyond the turnaround renders.
