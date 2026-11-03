# GAME-10a: Foamer types, and the F02 Roamer that throws foam balls

Written 2026-11-03. GAME-10 is "3 Foamer types (fodder ranged, charger,
heavy)"; this is its first part. The game has one Foamer spec today
(`data/foamers.json` `test`, the F01 Slowmer). The F02 Roamer's rig is
done (ART-03, `data/foamer-rigs.json`) and the director already has a
ranged token pool (`src/ai/director.ts`, caps in `data/ai.json`).
CONTENT-PLAN F02: "Climbs and keeps distance; slow foam ball (P); teaches
parry; health 8". Parry itself is GAME-04 stage 2, after this card.

```
ID:          GAME-10a
Title:       Per-type Foamer specs, and the F02 Roamer: keeps its distance,
             throws slow, readable foam balls that hurt
Owner:       Pi (Qwen 3.8 Flash Next, DGX Spark)
Reviewer:    Claude Opus 5.5
Depends on:  ENG-08, ENG-13, GAME-07, GAME-04 stage 1 (all done)
Branch:      game-10a, in its own worktree
```

## Read first

1. `CLAUDE.md` (every rule applies to you)
2. `design/CONTENT-PLAN.md` sections 3 (the F02 row) and 3.1 to 3.2
   (parts and handicaps), PLAN.md 3.2 (readable projectiles, one glow
   colour means parryable: pink, PLAN says "Proposed: glowing pink")
3. `data/foamers.json`, `data/foamer-rigs.json` (F01 and F02),
   `data/ai.json`
4. `src/foamers/foamers.ts` and `foamer.ts` (every `SPEC.` use),
   `src/foamers/rig-states.ts`, `src/ai/f01-brain.ts`, `src/ai/agent.ts`,
   `src/ai/director.ts`
5. `src/game/game.ts` (the shared step, `onBonk` and the shield's
   `blocksAttackFrom`), `src/level/` and `data/levels/1-1-pit.json` (how
   a wave names its Foamer)

## What to build

- **Types:** `data/foamers.json` gets a shared base plus one entry per
  type (`F01`, `F02`), each type overriding what differs (rig, health,
  speed, attacks, ranges). `spawn(feet, facing?, type = "F01")`; every
  `SPEC.` read becomes the Foamer's own spec. F01 must behave exactly as
  before: the existing Foamer tests pass unchanged.
- **F02 brain:** a ranged variant of the F01 brain (`src/ai/`): approach
  until in sight and inside its throw range (start at 12 m), then keep a
  preferred distance (start at 8 m), backing off when the player closes
  inside 5 m and strafing along the ring. It throws only with a `ranged`
  token. Same states, logs and tests style as `f01-brain.ts`.
- **Foam ball:** a projectile system (`src/foamers/projectiles.ts` or
  similar): a slow ball (start at 9 m/s, light arc) thrown from the ball
  hand, with a windup of about 0.6 s that shows the throw coming. It
  glows pink (the parryable colour; one shared material constant so the
  parry can find it later), hits the player for its damage, bursts into
  a few foam chunks on the world, and has a hard cap on live balls.
  Blocked by the shield like a bonk: the shield's front arc check
  applies to the ball's direction of travel.
- **Arena:** a wave can name `"F02"`; the Pit's wave 2 becomes 3 F01 and
  2 F02 so the type is seen in play. The range spawn panel gets a type
  choice if it is a few lines.
- Watch helpers: `state()` lists each Foamer's type, and live balls.
- Sounds: placeholder IDs in `data/sounds.json` and `design/SOUNDS.md`
  (throw windup, throw, ball hit, ball burst).

## Done when

- Tests: the F01 tests pass unchanged; a spawned F02 has the F02 rig and
  health 8; the F02 brain keeps its distance and backs off; a ball
  travels at its speed, hurts once, bursts on a wall, and the cap holds;
  the shield blocks a ball from the front.
- `npx tsc --noEmit`, `npx vitest run`, `npm run build` pass; no em or
  en dashes.
- PLAN.md: a GAME-10a row under GAME-10 pointing to this card;
  decisions in section 14. HANDOFF: a dated entry at the top of the Log.

## Not in this task

Climbing, the parry and bounce-back (GAME-04 stage 2), F05 and the heavy
(GAME-10b and later), new art.
