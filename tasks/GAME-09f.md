# GAME-09f: B07 Collateral gameplay, the launcher round, remote detonation and the cluster

Written 2026-11-08. Paul's order of work: every enemy and weapon first.
B07 (CONTENT-PLAN section 4, Paul): "Launcher. Pump. 5 / 15. Arcing shot,
area explosion, blast can push enemies. Mod 1: remote detonate. Mod 2:
cluster: splits into 4 smaller explosions after the initial blast. Name:
Collateral." D14 (Paul): five ammo types, so B07 fires its own launcher
round (a mega dart with a foam warhead) with its own pickup. The model is
approved (`public/models/blasters/B07.glb`, `design/blasters/B07.md`:
nodes `body`, `drum`, `pump`, `trigger`, `muzzle_1`; a six-round drum).
The shared explosion exists (`src/weapons/explosion.ts`, GAME-09d), and
the player's own explosions never hurt the player (Paul).

```
ID:          GAME-09f
Title:       B07 Collateral: the launcher round that arcs and explodes on
             impact with a bigger blast that pushes Foamers, a pump and a
             turning drum, a remote-detonate mod and a cluster mod
Owner:       Pi (Qwen 3.8 Flash Next, dgx-spark, thinking medium)
Reviewer:    Claude Opus 5.5
Depends on:  GAME-09d (the shared explosion), GAME-09e
Branch:      game-09f, in its own worktree
```

**Running at the same time:** GAME-10l (qwen-machine: the F13
Biomechanic in `src/foamers/` and `data/foamers.json`). Do not edit
`src/foamers/foamers.ts`; to push a Foamer use its existing
`knockStep(f, dirX, dirZ, want)`. Your files: a `B07` entry in
`data/blasters.json`, a `launcher` dart type in `data/darts.json` and its
damage entry (one line in `data/foamers.json`'s shared `damage` block),
`data/explosion.json` and `src/weapons/explosion.ts`, `src/weapons/`
(`darts.ts`, `blaster.ts`, `viewmodel.ts` for the drum), the weapon key
lists in `src/game/game.ts` and `src/range/main.ts` (add key 7),
`data/pickups.json` only if a launcher-round box needs an entry,
`data/sounds.json` and `design/SOUNDS.md` for B07, new tests in
`tests/weapons/`.

## Read first

Read each once; write yourself a short note. First edit by your sixth
reply.

1. `CLAUDE.md`
2. `design/CONTENT-PLAN.md` section 4 (B07 row and notes), D14
3. `design/blasters/B07.md` (the card)
4. `src/weapons/explosion.ts` and `data/explosion.json`,
   `src/weapons/darts.ts` (explosive shots, B06), `data/blasters.json`
   (B05's pump entry, B06's explosive mod)
5. `src/foamers/foamers.ts` `knockStep` (read only), `src/pickups/pickups.ts`
   (ammo boxes by dart type)

## What to build

All numbers in data, proposals for Paul to tune.

**Stage 1: the round and the blaster.**
- **Launcher round** (`launcher` dart type): slow (start 18 m/s), a high
  arc (much more gravity than a mega dart), big and heavy; it explodes at
  its first hit, every shot.
- **Blast profiles:** `data/explosion.json` gains named profiles; today's
  numbers become `dart` (B06 and B05 keep them), and a `launcher` profile
  is bigger (start carve 1.0 m, range 3.5 m, centre damage 25) and pushes
  every Foamer in range away from the blast through `knockStep` (start
  push 2.5 m at the centre, falling to 0 at the edge). Never the player.
- **B07 entry:** name "Collateral", `model` the approved
  `/models/blasters/B07.glb`, mode `pump` with `primeTime` start 0.9,
  launcher rounds, one per shot, drum 6, reserve 18 (start 12), reload
  2.5 s, `muzzle_1`, its own viewmodel numbers. B07 joins the end of the
  blaster `order` (key 7). Launcher-round ammo boxes work like the other
  types' (a `darts-launcher` box).
- **Drum:** the viewmodel turns the `drum` node one chamber (60 degrees,
  about its own bore axis) after each shot, eased over the pump time; the
  `pump` node moves as B01's does.

**Stage 2: the mods.**
- **Remote detonate** (mod 1): rounds do not explode on impact; they stop
  where they hit and stay (start cap 3 live; the oldest goes off if a
  fourth is fired). Pressing fire while any are live detonates all of them
  instead of firing (a press with none live fires as usual).
- **Cluster** (mod 2): after a round's blast, four smaller blasts (a
  `cluster` profile: start carve 0.4, range 1.8, centre damage 10) go off
  around it (start 1.5 m out, at the four sides, after 0.25 s). The
  shared per-second cap still holds: raise it in data if it would cut a
  single cluster short, and say so.
- **Sounds,** placeholder IDs: `B07-fire` (a hollow thoomp), `B07-pump`,
  `B07-reload`, `B07-detonate`.

## Done when

- Tests in new files: the launcher round reads its type and falls more
  than a mega dart over the same distance; B07 reads its spec and needs
  the pump between shots; a round explodes on impact with the launcher
  profile, damages a Foamer in range and pushes it away from the blast,
  and never touches the player; the B06 and B05 blasts are unchanged; the
  drum turns one chamber per shot; remote: rounds stay, the next press
  detonates them all, the cap holds; cluster: four smaller blasts after
  the delay at the four sides; every other blaster's tests unchanged.
- `npx tsc --noEmit`, `npx vitest run`, `npm run build` pass; no dashes.
- PLAN.md: a GAME-09f row after GAME-09e and the B07 row in 5.1 updated;
  decisions in section 14. HANDOFF: a dated entry at the top of the Log
  (directly under `## Log`), with what was not checked by eye.

## Not in this task

Where B07 is found in a level, a launcher-round pickup's look, the
pump's animation beyond B01's, levels.
