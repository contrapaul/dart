# GAME-10b: the F05 Darter, a charger with an armoured front

Written 2026-11-04. GAME-10a made Foamer types data-driven and added the
F02 Roamer. The F05 Darter's rig is done (ART-03, `data/foamer-rigs.json`:
body with eyes and a gaping mouth, a lime `chest` plate and `brow`, an
orange `weakpoint` on the back, two legs). CONTENT-PLAN F05: "Heavy.
Charges in a straight line, armoured front. Charge, stun on hit. Teaches
sidestep, shoot the back. Weak point: back. Health 30. First seen 1-4 (a
mini-boss arena with two chargers)." Losing the legs means no more
charging (CONTENT-PLAN 3.1).

```
ID:          GAME-10b
Title:       The F05 Darter: telegraphs, charges in a straight line, stuns
             on hit, shrugs off darts from the front, weak at the back
Owner:       Pi (DeepSeek V4.1 Flash)
Reviewer:    Claude Opus 5.5
Depends on:  GAME-10a, GAME-05 (done)
Branch:      game-10b, in its own worktree
```

## Read first

1. `CLAUDE.md` (every rule applies to you)
2. `design/CONTENT-PLAN.md`: the F05 rows in sections 3, 3.1 and the
   look table; PLAN.md 3.1 and 3.2
3. `data/foamers.json` (the base spec and `types`), `data/foamer-rigs.json`
   (F05), `data/ai.json`
4. `src/foamers/foamers.ts`, `foamer.ts`, `rig-states.ts`; `src/ai/`
   (`f01-brain.ts`, `f02-brain.ts`, `agent.ts`, `director.ts`)
5. `src/game/game.ts` (`onBonk`, the shield's `blocksAttackFrom`, the
   charge in `src/player/shield.ts`), `src/game/attack.ts` (`damageOf`
   takes the Foamer's spec), `data/levels/1-1-pit.json`, `src/range/main.ts`

## What to build

- **Type:** an `F05` entry in `data/foamers.json` `types` (rig F05,
  health 30, its speeds and attacks). F01 and F02 behave exactly as
  before; their tests pass unchanged.
- **Brain:** a charger brain in `src/ai/` in the style of the others:
  approach to a charge range (start at 14 m) with sight, then with a
  melee token: **telegraph** (start at 0.9 s: it stops, lowers its head,
  scrapes, a sound, a little dust), lock a straight line at the player's
  position at that moment, and **charge** along it fast (start at 11
  m/s, at most 18 m), not steering. It stops on a wall or at the end
  (stagger itself briefly on a wall, start at 1.2 s, its back open), then
  recovers and turns slowly (a long turn, so the player can get behind
  it). A player it runs into is hit (damage from its `charge` attack)
  and stunned briefly (start at 0.4 s: no move, look still works); the
  shield blocks the hit like a bonk.
- **Armour:** darts that hit the `chest` or `brow` plate do a small share
  of damage (start at 15%) and carve little; the `weakpoint` takes extra
  (start at 2.5 times). Plates can still be carved away over time.
- **Legs:** with both legs gone it can no longer charge (it crawls as
  GAME-11 does, and bites at close range only).
- **Charge into it:** the player's shield charge at a Darter's front is
  stopped by the plate (the player bounces back, no stagger); from the
  side or back it staggers it as usual.
- **Arena:** the Pit stays as it is. Add `data/levels/1-4-ring.json`, a
  small ring arena (about 30 m across, the KIT A2 Ring, `design/levels/`)
  with two pillars, one wave of 2 F05, and its page entry through the
  level loader: `arena.html?level=1-4-ring` loads it (the Pit stays the
  default). The range spawn panel gets F05.
- Watch helpers: `state()` already lists types; add each Darter's brain
  state (telegraph, charge, wallStun).
- Sounds: placeholder IDs in `data/sounds.json` and `design/SOUNDS.md`
  (telegraph scrape, charge run loop or step, wall hit, player hit).

## Done when

- Tests: an F05 spawns with its rig and 30 health; the telegraph comes
  before every charge and lasts its time; the charge keeps its line (it
  does not steer after the lock) and stops on a wall with a wall stun;
  a front plate hit does its share and a back hit its multiple; the
  player is hit and stunned once per charge; both legs gone ends
  charging; the level file validates.
- `npx tsc --noEmit`, `npx vitest run`, `npm run build` pass; no em or
  en dashes.
- PLAN.md: a GAME-10b row under GAME-10a pointing to this card;
  decisions in section 14. HANDOFF: a dated entry at the top of the Log.

## Not in this task

The heavy (GAME-10c), new art, promoted colour variants, the mini-boss
framing of level 1-4.
