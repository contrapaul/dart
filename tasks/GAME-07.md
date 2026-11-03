# GAME-07: stagger, Pop finishers and health drops

Written 2026-11-03. PLAN 3.1: "Pop finishers: a staggered Foamer
glows/wobbles; melee it for a short, funny finisher (squeeze, pop, wring
out) that sprays health pickups. Finishers must be quick (under 1 s) and
never gory." CONTENT-PLAN: any part breaking staggers a Foamer for about
half a second, which opens a finisher, and a finisher always pops it.

```
ID:          GAME-07
Title:       A weakened or part-broken Foamer staggers and glows; melee it
             up close for a quick Pop finisher that drops health
Owner:       Pi (Qwen 3.8-27B, Linux AI machine)
Reviewer:    Claude Opus 5.5
Depends on:  ENG-10, ENG-13 (done)
Branch:      game-07, in its own worktree
```

## Read first

1. `CLAUDE.md` (every rule applies to you; no gore, foam only)
2. PLAN.md 3.1, `design/CONTENT-PLAN.md` sections 3.1 and the finisher
   lines (search "finisher")
3. `src/foamers/foamers.ts`: the stagger state (`SPEC.stagger.time`),
   `breakPart`, `pop`, `handleHit`, `onSound`; `src/foamers/foamer.ts`;
   `data/foamers.json`
4. `src/game/game.ts` (the shared step and watch helpers), `src/main.ts`
   (the course uses `melee` for a debug blast), `src/arena/main.ts`
5. `src/player/health.ts`, `src/ui/hud.ts`

## What to build

- Numbers in `data/foamers.json` (a `finisher` block) and a new
  `data/pickups.json`; nothing tuned in code.
- **Weakened stagger:** the first time a Foamer's health falls to or
  below a share of its max (start at 30%), it staggers for longer (start
  at 2.5 s). A part break keeps its short stagger. While a Foamer can be
  finished it glows and wobbles (an emissive pulse on its parts in a
  colour that is not the parry pink, and a small scale wobble).
- **Finisher:** pressing `melee` with a finishable Foamer within reach
  (start at 2.5 m) and inside a narrow cone of the view does the
  finisher: the player is held for at most 0.8 s, the view turns to the
  Foamer, the Foamer squashes and stretches like a squeezed toy, then
  pops with the existing pop. A short sound. When no Foamer can be
  finished, `melee` keeps whatever the page did before (the course's
  debug blast).
- **Health drops:** a finisher sprays health pickups (start at 3 of 10
  health each): small cream foam blobs that hop out, settle, bob, and are
  collected by walking within about 1 m (they drift to the player inside
  2 m). Never above max health; at full health they stay on the floor.
  Hard cap on live pickups (start at 24, oldest go first) and a lifetime
  (start at 30 s). `src/pickups/` with a small, generic pickup so ammo can
  use it later (D08); only health is built now.
- HUD: a small prompt by the crosshair when a finisher is available
  (the bound key name, from the input map), and a green flash on pickup.
- Watch helpers in the shared set: `finish()` (presses melee for one
  step) and pickup counts plus each Foamer's finishable flag in
  `state()`.
- Sounds: placeholder IDs in `data/sounds.json` and `design/SOUNDS.md`
  (finisher squeeze, pickup).

## Done when

- Tests in `tests/foamers/` and `tests/pickups/`: the weakened stagger
  fires once at the threshold; a finisher works in reach and not beyond
  it; it pops the Foamer and drops the pickups; a pickup heals, never
  past max, and stays on the floor at full health; the cap and lifetime
  hold.
- `npx tsc --noEmit`, `npx vitest run`, `npm run build` pass; no em or
  en dashes.
- PLAN.md: the GAME-07 row points to this card; decisions in section 14.
  HANDOFF: a dated entry at the top of the Log, status updated.

## Not in this task

Ammo pickups (D08), the ammo-for-kills tool (GAME-08), finisher variety
per Foamer type, upgrades.
