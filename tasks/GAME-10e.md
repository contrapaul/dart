# GAME-10e: the F04 Blocker, a shield wall that fires over the top

Written 2026-11-06 (overnight). GAME-10d built the F03 Swarmer. The F04
rig is a greybox in `data/foamer-rigs.json` (`movement: shieldwalk`,
parts body, head, arms, `shield`, `blaster`, legs). CONTENT-PLAN F04
(Paul): "Fodder. Holds a shield wall, fires over it. Volley (P).
Teaches flanking, shield charge. Weak point: shield can be carved away.
Health 10. First seen 2-1. Name: Blocker. Look: an F02 with a shield.
Orange body, deep purple shield, lime visor."

```
ID:          GAME-10e
Title:       The F04 Blocker: Blockers line up into a shield wall facing the
             player, fire parryable volleys over it, the shield stops darts
             from the front until it is carved away, and the player's shield
             charge breaks the wall
Owner:       Pi (DeepSeek V4.1 Flash, openrouter deepseek/deepseek-v4.1-flash-1017)
Reviewer:    Claude Opus 5.5
Depends on:  GAME-10a, GAME-10b, GAME-10d, ANIM-01, GAME-05 (done)
Branch:      game-10e, in its own worktree
```

**Running at the same time:** BUG-03 (Qwen 27B: `src/ai/nav-grid.ts`,
`src/ai/level.ts`) and LVL-02d (the Spark: `src/ai/nav-grid.ts`,
`data/ai.json` `nav`, `data/levels/`, `src/level/`). Do not edit those.
In `data/ai.json` touch only a new F04 block or the token lines you need.

## Read first

1. `CLAUDE.md` (no teeth, no horror; the shield and blaster look like
   toys)
2. `design/CONTENT-PLAN.md` the F04 row and section 3.1; PLAN.md 3.1, 4.3
3. `tasks/GAME-10d.md` and its HANDOFF review entries (what went well and
   what review caught), `tasks/GAME-10b.md` (the F05's armour plate that
   stops darts from the front: reuse that for the shield), `tasks/ANIM-01.md`
4. `data/foamers.json` (base, `types`, F02's ball and F05's `armour`),
   `data/foamer-rigs.json` (F04, and F02 and F03 for the palette fields),
   `data/ai.json` (tokens per difficulty)
5. `src/ai/f02-brain.ts` (the Roamer: keeps distance and throws),
   `src/ai/f03-brain.ts`, `src/ai/director.ts`; `src/foamers/armour.ts`,
   `src/foamers/projectiles.ts`; `src/player/shield.ts` (the charge and
   what it does on contact); `src/range/main.ts` (the type choice);
   `tools/render-rig.ts`

Read each file once, with short ranges; start editing by your sixth reply.
Keep replies short: never more than about 80 lines written at once.

## What to build

All numbers in data.

- **Look:** the F04 rig in its factory palette the way ART-03 and
  GAME-10d did: orange body, deep purple shield (a big rounded toy shield
  held in front), lime visor, a toy blaster held up over the shield's top
  edge. Proportions of an F02. Render the turnaround with
  `npx tsx tools/render-rig.ts F04` into `design/foamers/`.
- **Type:** an `F04` entry in `data/foamers.json` `types` (health 10).
  F01, F02, F03, F05 behave exactly as before; their tests pass unchanged.
- **The shield:** armour on the `shield` part, as the F05's plate: darts
  that hit it from the front do little or no damage to the Blocker and
  carve the shield slowly; once the shield part breaks off (its own hp or
  wear, as other parts), the Blocker takes full damage and its brain
  falls back to an F02-like keep-distance-and-throw.
- **Brain:** `src/ai/f04-brain.ts`. Blockers that notice the player walk
  to a hold distance (start 9 m) and take slots side by side in a line
  across the player's direction (start 1.2 m apart), shields toward the
  player, turning to keep facing as the player moves. With a `ranged`
  token one fires a volley over the shield: a short windup, then a few
  F02 balls (start 3, a small spread, parryable as F02's are) through the
  existing projectile system. A Blocker alone holds its own slot.
- **Shield charge:** the player's shield charge (GAME-05) into a Blocker
  with its shield up knocks it back and staggers it (start 1.2 s), which
  opens the wall; a staggered Blocker's shield is down. Through the
  existing charge contact path; do not change the charge itself.
- **Flanking:** a dart that hits the Blocker from the side or back (out
  of the shield's arc, as the F05 plate's arc) does full damage.
- **Range and watch:** the range's type choice spawns a line of three
  Blockers; the watch's `state()` keeps working and lists them.
- **Sounds:** placeholder IDs in `data/sounds.json` and `design/SOUNDS.md`:
  `F04-alert`, `F04-volley`, `F04-shieldhit` (a dart on the shield),
  `F04-shieldbreak`.

## Done when

- Tests in `tests/foamers/` and `tests/ai/`: the F04 type reads its own
  spec; a front dart on the shield does little damage and a side dart does
  full; a broken shield gives full damage from the front; three Blockers
  take three distinct slots in a line facing the player; a volley needs a
  `ranged` token and fires the data's count of balls; a shield charge
  staggers a Blocker; F01, F02, F03, F05 tests unchanged.
- `npx tsc --noEmit`, `npx vitest run`, `npm run build` pass; no em or en
  dashes.
- PLAN.md: a GAME-10e row under GAME-10d; decisions in section 14.
  HANDOFF: a dated entry at the top of the Log, Status updated, and what
  was not checked by eye (the look, the wall forming, the volley, the
  shield's carve).

## Not in this task

Level 2-1, F06 and later types, finisher variety, new art files beyond
the turnaround renders.
