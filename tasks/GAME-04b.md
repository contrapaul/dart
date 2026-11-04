# GAME-04 stage 2: parry and bounce-back

Written 2026-11-04. PLAN 3.2: "Bounce-back: projectiles with a distinct
colour/outline (glowing pink) can be parried with the shield at the right
moment and return to sender. Key to readability: one colour always means
parryable." Stage 1 (block and throw) and the F02 Roamer's pink foam balls
(GAME-10a, `BALL_MATERIAL`) are in. CONTENT-PLAN: level 1-2 teaches
"Shield block and parry", the Shield upgrade track raises the parry
window, and later melee weapons are recharged by parries.

```
ID:          GAME-04 (stage 2)
Title:       Raise the shield just before a pink ball lands to parry it:
             the ball flies back at its thrower and staggers it
Owner:       Pi (Qwen 3.8-27B, Linux AI machine)
Reviewer:    Claude Opus 5.5
Depends on:  GAME-04 stage 1, GAME-10a (done)
Branch:      game-04b, in its own worktree
```

## Read first

1. `CLAUDE.md` (every rule applies to you)
2. PLAN.md 3.2, 10 (accessibility: difficulty sliders include the parry
   window), `tasks/GAME-04.md`
3. `src/player/shield.ts` and `data/shield.json` (block, the front arc
   check, the raise timing), `src/foamers/projectiles.ts` (`LiveBall`,
   `thrower`, the hit on the player), `src/game/game.ts` (where a ball's
   hit is blocked), `data/difficulty.json`, `src/core/settings.ts`
4. `src/foamers/foamers.ts` (`startStagger`, damage on a Foamer)

## What to build

- Numbers in a `parry` block in `data/shield.json`; nothing tuned in
  code. Write in small steps: one change per tool call, commit each
  stage.
- **Parry:** a parryable ball (one made with `BALL_MATERIAL`) that would
  hit the player inside the shield's front arc is parried when the
  shield started rising within the parry window before the hit (start at
  0.25 s). Holding the shield up longer than that only blocks, as now.
- **Bounce-back:** a parried ball turns round at a higher speed (start at
  1.6 times) and flies at its thrower's chest, steering a little (so it
  lands most of the time), and on hitting it does damage (start at 4)
  and staggers it with `startStagger`. If the thrower is gone it flies
  straight and bursts on the world as usual. A bounced ball cannot hurt
  the player and can hit another Foamer on the way.
- **Feedback:** a short sound, a brief bright flash on the disc, a small
  view kick, and a tiny hit-stop (start at 0.05 s, the world steps slow)
  so a parry feels different from a block. No HUD text.
- **Difficulty:** each preset in `data/difficulty.json` gets a parry
  window multiplier (Story wider, Foam Fury narrower), read the way the
  other preset values are.
- Watch helpers: parry count in `state()`, and a `parryNext()` helper
  that raises the shield on the step the next ball is 0.1 s away (for
  automated checks).
- Sounds: placeholder IDs in `data/sounds.json` and `design/SOUNDS.md`
  (parry, bounced ball hit).

## Done when

- Tests in `tests/shield/`: a ball arriving within the window after the
  raise is parried and one after it is only blocked; a ball from behind
  is not parried; the bounced ball hits and staggers its thrower and
  never the player; the difficulty multiplier changes the window.
- `npx tsc --noEmit`, `npx vitest run`, `npm run build` pass; no em or
  en dashes.
- PLAN.md: the GAME-04 row gets stage 2 done; decisions in section 14.
  HANDOFF: a dated entry at the top of the Log.

## Not in this task

Parrying melee attacks, melee weapon charges from parries (GAME-06),
upgrades.
