# GAME-04c: the shield's look, its spin, and the foam saw

Written 2026-11-05. Paul wants a round foam shield in the spirit of a
classic round hero shield (an original design, not a copy: see Read first),
spinning when thrown, and if possible a foam chainsaw type weapon. PLAN 3.2
(the Dark Ages shield saw).

```
ID:          GAME-04c
Title:       Concentric-ring disc look; the thrown disc spins; a thrown disc
             lodges in the first Foamer it hits and grinds it like a foam
             saw, then ricochets on
Owner:       Pi (DeepSeek V4.1 Flash, openrouter deepseek/deepseek-v4.1-flash-1017)
Reviewer:    Claude Opus 5.5
Depends on:  GAME-04, GAME-04b, GAME-05 (done)
Branch:      game-04c, in its own worktree
```

**This card owns `src/player/shield.ts` and `data/shield.json` while it
runs.** GAME-06 (melee) and GAME-08 (vacuum) run at the same time and only
read the shield's public state.

## Read first

1. `CLAUDE.md`. Trademarks matter here: no brand names, and no copy of any
   real shield. No star emblem, and not a red, white and blue ring set. The
   centre emblem is Paul's to design: leave a plain placeholder boss and a
   `[Paul]` note.
2. PLAN.md 3.2, `tasks/GAME-04.md`, `tasks/GAME-04b.md`, `tasks/GAME-05.md`
3. `src/player/shield.ts` (the look built in the constructor, `startThrow`,
   `stepDisc`, `nextTarget`, `stagger`, `carve`, `catchDisc`, the
   `discMesh`), `data/shield.json`
4. `src/foamers/foamers.ts` (part damage, armour shares `armourOf`, the
   stagger, the damage floor the throw uses so it never kills)
5. `src/game/game.ts` (shield events and sounds), `data/sounds.json`,
   `design/SOUNDS.md`

## What to build

All numbers in `data/shield.json` (`look` and a new `saw` block).

- **Look:** a round toy shield made of concentric foam rings (start with
  four bands: outer rim, a ring, a ring, a centre boss), slightly domed so
  it reads as a shield and not a plate, in the factory palette with colours
  in `look.colors`. Code-built geometry only (no art files). A ring of soft,
  rounded foam nubs on the rim's edge (start 16) gives the saw its teeth:
  toy-like, never sharp blades. The **flying** disc must use the same model
  as the held one (today it is a bare rim cylinder): build the parts once
  and show the same group in the hand and in flight.
- **Spin:** the flying disc spins about its own axis at `look.spinRevPerSec`
  (start 6) on the way out and on the way back, faster while it grinds
  (`saw.spinRevPerSec`, start 14).
- **Foam saw:** the first Foamer a throw strikes, the disc lodges at the
  contact point and grinds for `saw.grindSeconds` (start 0.9 s): it stays
  stuck to that point as the Foamer moves, spins fast, carves a small
  sphere (`saw.carveRadius`) every `saw.tickSeconds` (start 0.1), deals
  `saw.damagePerTick`, throws a capped spray of foam debris, and holds the
  Foamer in a stagger so it cannot attack. Armour plates take
  `saw.plateShare` of the tick (start 1.0, against a dart's 0.15), so the
  saw is the Darter's counter. Then it carries on with the existing
  ricochet (bounces and range unchanged) and returns to the arm. The saw
  keeps the throw's rule that it never kills (`saw.canKill` false, the same
  damage floor); a Foamer it weakens becomes finishable, which is the point.
- A lodged disc counts as thrown: no block, no parry, no charge until it is
  back, as today.
- **Sounds:** placeholder IDs: `SH-saw` (a loop while grinding, pitched by
  spin) and `SH-sawEnd`. The flying spin may add a soft whirr loop
  (`SH-spin`) if it is cheap.
- **Watch helpers:** the shield's state gains `grinding` (the target id and
  time left) so `state()` shows it; `throwShield()` works as before.

## Done when

- Tests in `tests/player/`: the first struck Foamer is ground for
  grindSeconds (the disc stays at its contact point while the Foamer moves);
  the tick count and damage match the data; plates take `plateShare`; the
  saw never kills with `canKill` false; the disc ricochets and returns
  after the grind; no block or parry while lodged; the held and flying disc
  are the same model.
- `npx tsc --noEmit`, `npx vitest run`, `npm run build` pass; no em or en
  dashes.
- PLAN.md: a GAME-04c row under GAME-04, decisions in section 14 (why the
  saw never kills, the plate share). HANDOFF: a dated entry at the top of
  the Log, the Status section updated, and what was not checked by eye
  (the look, the spin, the grind, the sounds).

## Not in this task

The emblem and the shield's name ([Paul]), a held saw attack (the disc
spinning in the hand as melee), upgrades, new art files.
