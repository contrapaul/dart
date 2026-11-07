# GAME-10l: the F13 Biomechanic, a support Foamer that heals its allies

Written 2026-11-07. Paul's order of work: every enemy and weapon first.
CONTENT-PLAN F13 (Paul): "Elite. Support: rebuilds other Foamers' foam.
Attack: heals allies. Teaches target priority. Weak point: its tank.
Health 25. First seen 3-4. Name: Biomechanic. Look: a fat foamer with a
tank of compressed foam that it sprays on others or on you to cause
damage. Orange body, purple hood, lime tank (weak point)." Section 3.3:
a hooded medic, foam tank and antenna on its back, a spray wand with a
core-coloured tip; parts tank, antenna, wand, arms. Section 3.1: losing
the tank means no more healing.

The greybox rig is in `data/foamer-rigs.json` (`F13`, `movement:
support`, speed 1.6, health 25; parts body, head, tank, antenna, both
arms, legs, `wand` on the right forearm).

```
ID:          GAME-10l
Title:       The F13 Biomechanic: palette look with a hood, a support brain
             that keeps behind its allies, a foam stream that heals the
             most hurt ally in range, a short damaging spray at the player,
             and the tank as the weak point that ends both
Owner:       Pi (DeepSeek V4.1 Flash, openrouter, thinking high)
Reviewer:    Claude Opus 5.5
Depends on:  GAME-10j (the latest Foamer pattern), GAME-10k
Branch:      game-10l, in its own worktree
```

**Running at the same time:** GAME-09c (qwen-machine, B02) and GAME-09e
(dgx-spark, B05), both in `src/weapons/`, `src/game/game.ts` and
`data/blasters.json`, `data/darts.json`. Stay out of those. Your files:
the F13 rig in `data/foamer-rigs.json`, an F13 entry in
`data/foamers.json` (not the shared `damage` block), `src/foamers/`,
`src/ai/`, `data/sounds.json` and `design/SOUNDS.md` for F13 only, new
tests in `tests/foamers/` and `tests/ai/`, `design/foamers/F13-*`.

## Read first

Read each once; write yourself a short note. First edit by your sixth
reply.

1. `CLAUDE.md` (no fluids: the stream is foam, chunky and bright, not a
   liquid; pink means parryable only, orange a weak point)
2. `design/CONTENT-PLAN.md`: the F13 rows (sections 3, 3.1, 3.3)
3. `tasks/GAME-10j.md` and the F10 entry in `data/foamers.json` (the
   latest Foamer card: a type entry, a weak point, its tests)
4. `src/foamers/pellet.ts` (`weakpointOf`), `src/ai/f02-brain.ts` (the
   keep-distance brain)
5. The F13 rig in `data/foamer-rigs.json`

## What to build

All numbers in data, proposals for Paul to tune. Four stages, each
committed on its own and each leaving the game working.

**Stage 1: look, type, weak point.**
- **Look:** body and arms `foam-orange`, a new `hood` part over the head
  in `foam-purple` (a rounded cowl, the face showing under it), the tank
  `foam-lime`, the antenna and the wand `foam-purple` with the wand's
  tip in `foam-core`. Render with `npx tsx tools/render-rig.ts F13` into
  `design/foamers/`. You cannot see images: check by script that the hood
  covers the top of the head, the tank is on the back and the wand in the
  right hand, and say in HANDOFF that the look was not seen.
- **Type:** an `F13` entry (rig F13, health 25) on the keep-distance brain,
  keeping about 10 m from the player.
- **Tank:** the weak point (multiplier start 2).

**Stage 2: the healing stream.**
- Every so often (start every 0.5 s) the Biomechanic picks the most hurt
  ally (lowest health share, below full) within `heal.range` (start 7 m)
  that it can see, turns to it, and streams foam from the wand tip to it
  while it stays in range and in sight: the ally regains `heal.perSecond`
  (start 5) health, never above its maximum. One ally at a time. It moves
  to bring a hurt ally in range rather than to the player, but never
  closer to the player than its kept distance.
- **The stream's look:** a short chain of foam-core blobs from the wand
  tip to the ally, a hard cap on blobs (start 12), drawn only while
  healing. Not a liquid.
- **Antenna gone:** the heal range halves.

**Stage 3: the spray and the tank.**
- With no ally to heal and the player within `spray.range` (start 5 m),
  it winds up (start 0.6 s) and sprays the player for `spray.seconds`
  (start 1.2 s), `spray.perSecond` damage (start 6), through the page's
  ordinary hit path so the raised shield blocks its share. Not parryable.
- **Tank gone:** no healing and no spray; it closes in and bonks with the
  wand (base melee).
- **Sounds,** placeholder IDs: `F13-heal` (a loop while streaming,
  capped), `F13-spray`, `F13-tank-break`.

**Stage 4: docs** (below).

## Done when

- Tests in new files: the F13 reads its own spec; the tank takes the
  multiplier; it heals the most hurt ally in range, not a full one or one
  out of range or out of sight, never above maximum; one ally at a time;
  the antenna gone halves the range; with nobody to heal and the player
  close it sprays, and a raised shield takes the block share; the tank
  gone ends healing and spraying and it bonks; the blob cap holds; every
  other type's tests unchanged.
- `npx tsc --noEmit`, `npx vitest run`, `npm run build` pass; no dashes.
- PLAN.md: a GAME-10l row under GAME-10k; decisions in section 14.
  HANDOFF: a dated entry at the top of the Log (directly under
  `## Log`), Status updated, and what was not checked by eye.

## Not in this task

Regrowing broken parts on an ally (health only), Level 3-4, the F13 in any
level file, the promoted look.
