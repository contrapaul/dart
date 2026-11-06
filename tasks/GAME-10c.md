# GAME-10c: the F06 Floater, a slow floating heavy that spits bouncing blobs

Written 2026-11-06. GAME-10a made Foamer types data driven; GAME-10b, 10d
and 10e added the F05 Darter, F03 Swarmer and F04 Blocker. The F06 rig is
a greybox in `data/foamer-rigs.json` (body, jaw, two fins, three
tendrils, `movement: float`, speed 1.2, `hover` 1.2, health 35).
CONTENT-PLAN F06 (Paul): "Heavy. Floats slowly, spits blobs. Attacks:
bouncing blobs, one big blob (P). Teaches shooting up, staggering. Weak
point: mouth while open. Health 35. First seen 2-2. Name: Floater. Look:
spiky floating ball, gaping mouth with a jaw, three tendrils. Lime body,
purple tendrils and fins, orange mouth (weak point)." Section 3.1: parts
mouth flap and fins; losing the fins makes it sink and float slower.
(P) means parryable: the big blob is pink like the Roamer's ball.

```
ID:          GAME-10c
Title:       The F06 Floater: palette look, floating movement at a hover
             height over the nav grid, a keep-distance brain, small
             bouncing blobs and one big parryable blob, the mouth a weak
             point only while open, fins lost make it sink
Owner:       Pi (Qwen 3.8 Flash Next, dgx-spark, thinking medium)
Reviewer:    Claude Opus 5.5
Depends on:  GAME-10a, GAME-10e, BUG-07, BUG-08 (done)
Branch:      game-10c, in its own worktree
```

**Running at the same time:** LVL-03a (DeepSeek: `data/levels/1-3.json`,
`src/level/`, `src/arena/`, `tests/level/`). Do not edit those. Your
files: `data/foamers.json`, `data/foamer-rigs.json` (F06 only),
`data/ai.json`, `src/foamers/`, `src/ai/`, `src/range/main.ts` (the type
choice), `data/sounds.json`, `design/SOUNDS.md`, `tests/foamers/`,
`tests/ai/`, `design/foamers/`.

## Read first

Read each once; write yourself a short note instead of rereading.

1. `CLAUDE.md` (no teeth, no horror: the mouth is a wide open foam mouth,
   the spikes are soft rounded foam nubs)
2. `design/CONTENT-PLAN.md`: the F06 rows (sections 3, 3.1, 3.3, 3.4)
3. `tasks/GAME-10a.md` (how a type and a ranged brain were added) and
   `tasks/GAME-10e.md` (a ranged attack with its own projectile numbers)
4. `data/foamers.json` (base, F02 and F04 types), the F02 and F06 rigs in
   `data/foamer-rigs.json`
5. `src/foamers/projectiles.ts` (the ball, `launch`, `bounce`,
   `flightClear`), `src/ai/f02-brain.ts`, `src/foamers/foamers.ts` where a
   Foamer moves and where the F02 input is filled

## What to build

All numbers in data. Work in three stages; each leaves the game working
and is committed on its own.

**Stage 1: look, type, floating.**
- **Look:** the F06 rig's factory palette, as ART-03 did for the others:
  lime body with rounded spikes, purple fins and tendrils, an orange mouth
  and jaw, eyes like the others. Render the turnaround sheet with
  `npx tsx tools/render-rig.ts F06` into `design/foamers/`.
- **Type:** an `F06` entry in `data/foamers.json` `types` (rig F06,
  health 35, its attacks). Every other type behaves exactly as before.
- **Floating:** a floating Foamer holds its feet `hoverMetres` (start 3)
  above the floor under it, with a slow bob, and is not pulled down by
  gravity. It steers along the nav grid's path like the walkers (the grid
  is the floor under it), at its own slow speed. Losing a fin lowers the
  hover (start to 1.2) and its speed (start times 0.6); losing both puts
  it on the floor. Killed, it falls as the others do.
- **Range:** the range's type choice spawns a Floater.

**Stage 2: the brain and the blobs.**
- **Brain:** `src/ai/f06-brain.ts`, or reuse `decideF02` if the Roamer's
  keep-distance ring and its BUG-07 and BUG-08 rules fit as they are (say
  which in section 14). It keeps its distance (start 12 m) and attacks
  with a `ranged` token.
- **Blobs:** the normal attack spits `blob.count` (start 3) small blobs
  in a short fan that bounce off level geometry up to `blob.bounces`
  (start 2) times before they burst, in a non-pink colour, not
  parryable, small damage (start 3 each). Every fourth attack (data) is
  one big pink blob, slower, more damage (start 10), parryable like the
  Roamer's ball. Use the existing `ProjectileSystem` (a kind or a size
  per ball), with a cap on live blobs in data.
- **Weak point:** the jaw drops to spit; while open (the windup and
  strike) the mouth takes `weakpointMultiplier` damage (start 2.5) and
  shut it takes normal damage. A big hit staggers it as other heavies.
- **Sounds:** placeholder IDs in `data/sounds.json` and
  `design/SOUNDS.md`: `F06-hum` (a cheap loop), `F06-spit`,
  `F06-blobBounce`.

**Stage 3: docs** (below).

## Done when

- Tests in `tests/foamers/` and `tests/ai/`: the F06 type reads its own
  spec; a Floater spawned over the floor stays at its hover height after
  5 s of steps; one fin lost lowers it and slows it, both fins put it on
  the floor; a blob bounces off a wall and bursts after its last bounce;
  only the big blob is parryable; the mouth multiplies damage only while
  open; the live blob cap holds; every other type's tests unchanged.
- `npx tsc --noEmit`, `npx vitest run`, `npm run build` pass; no em or en
  dashes.
- PLAN.md: a GAME-10c row under GAME-10b; decisions in section 14.
  HANDOFF: a dated entry at the top of the Log, Status updated, and what
  was not checked by eye (the look, the float and bob, the blobs'
  bounces, the sounds).

## Not in this task

Level 2-2, the Floater in any level file, vacuum entries for F06, flying
over gaps the floor grid cannot path, tendril attacks.
