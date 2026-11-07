# GAME-09g: B08 Firehose gameplay, foam balls that ricochet, spin-up and the movement slow

Written 2026-11-08. Paul's order of work: every enemy and weapon first,
and B08 is the last blaster. B08 (CONTENT-PLAN section 4, Paul):
"Gatling. Room-clearing 'final word', spins up to fire at an incredible
rate. Foam balls. 120 / 240. Massive power, recoil, chaotic, ricochets,
slows movement when firing. Mod 1: recoil control and reduced movement
penalty. Mod 2: add a second barrel for 2x fire rate. Name: Firehose."
D14 (Paul): five ammo types, the foam ball is B08's.

B08 has no card brief or model yet (ART-01 and ART-04 come after this,
for Paul to approve). Like B02's gameplay (GAME-09c), it starts on a
**placeholder model**: B04's `/models/blasters/B04.glb`, whose flywheels
already spin. Swapping in B08's own model later is a one-line data change.

```
ID:          GAME-09g
Title:       B08 Firehose: foam balls that ricochet, a long spin-up to a
             very high fire rate, heavy recoil, a movement slow while
             firing, and its two mods
Owner:       Pi (Qwen 3.8 Flash Next, dgx-spark, thinking medium)
Reviewer:    Claude Opus 5.5
Depends on:  GAME-09f, ART-05b (merged)
Branch:      game-09g, in its own worktree
```

**Running at the same time:** GAME-10l (qwen-machine: the F13 Foamer in
`src/foamers/`, `data/foamers.json` and `data/sounds.json`). Do not edit
anything in `src/foamers/`. Your files: a `B08` entry in
`data/blasters.json`, a `ball` dart type in `data/darts.json` and its one
damage line in `data/foamers.json`'s shared `damage` block (that line
only), `src/weapons/` (`darts.ts`, `blaster.ts`), `src/player/controller.ts`
for the slow, the weapon key lists in `src/game/game.ts` and
`src/range/main.ts` (key 8) and the place in `src/game/game.ts` that
tells the player the active blaster is firing, `data/sounds.json` for B08
only, new tests in `tests/weapons/`.

**Edit the JSON files by hand, line by line.** Never rewrite a data file
through a JSON dump: each must keep its compact layout, with only your
new lines added.

## Read first

Read each once; write yourself a short note. First edit by your sixth
reply.

1. `CLAUDE.md`
2. `design/CONTENT-PLAN.md` section 4 (the B08 row and the notes under
   the table), D14
3. `data/blasters.json` B04 (an `auto` blaster with `spinUp`,
   `spinDown`, `recoil`) and B07 (the newest entry)
4. `src/weapons/blaster.ts` (the `auto` mode, `wheelSpeed`, recoil),
   `src/weapons/darts.ts` (dart types, what a dart does when it hits a
   wall, the `maxLive` pool cap)
5. `src/player/controller.ts` (`speedScale`, which the shield sets every
   frame in `src/player/shield.ts`)

## What to build

All numbers in data, start values for Paul to tune on the range.

**Stage 1: the ball and the blaster.**
- **Foam ball** (`ball` dart type): a round foam ball, fast (start
  30 m/s), a little drop, light. On a hard surface (a wall, the floor, a
  crate) it **ricochets**: it bounces off with `restitution` (start 0.6)
  of its speed, up to `bounces` times (start 2), then falls and rests like
  a dart. On a Foamer it hits once (damage line `ball`, start 1.5) and
  bounces off with what is left. The `maxLive` pool cap still holds: at
  this fire rate the pool fills, and the oldest goes, as today.
- **B08 entry:** name "Firehose", the placeholder model above, mode
  `auto`, foam balls, one per shot, magazine 120, reserve 240 (start
  120), a long `spinUp` (start 0.8 s) to a very high rate (`fireInterval`
  start 0.035, about 28 a second), `spinDown` start 1.2, reload start
  3.0 s, heavy recoil (spread and climb well above B04's), key 8, its own
  viewmodel numbers. B08 joins the end of the blaster `order`.
- **Movement slow:** while B08 is firing (the trigger held and the wheels
  up to speed), the player walks and sprints at `fireMoveShare` of their
  speed (start 0.6). It must combine with the shield's slow, not replace
  it: add a second scale on the controller that multiplies in, rather
  than writing `speedScale`, which the shield owns.
- **Sounds,** placeholder IDs: `B08-fire` (a fast soft thud), `B08-spin`.

**Stage 2: the mods.**
- **Control** (mod 1, Paul: recoil control and reduced movement
  penalty): much less spread and climb, and `fireMoveShare` start 0.85.
- **Twin** (mod 2, Paul: a second barrel for 2x fire rate): half the
  `fireInterval`, alternating two muzzles. The placeholder model has one
  muzzle, so both entries name `muzzle_1` until B08's own model exists;
  say so in HANDOFF.

## Done when

- Tests in new files: the ball reads its type; it bounces off a wall with
  less speed, stops bouncing after `bounces`, and hits a Foamer once; B08
  reads its spec, fires nothing until spun up and then fires about
  1 / `fireInterval` a second; the player is slower while B08 fires, at
  full speed when it stops, and the shield's slow still applies on top;
  each mod changes what the card says; every other blaster's tests
  unchanged.
- `npx tsc --noEmit`, `npx vitest run`, `npm run build` pass; no dashes.
- PLAN.md: a GAME-09g row after GAME-09f, and the B08 row in 5.1 says the
  gameplay is done on a placeholder model; decisions in section 14.
  HANDOFF: a dated entry at the top of the Log (directly under `## Log`),
  with what was not checked by eye.

## Not in this task

B08's card brief and model, where B08 is found in a level, a foam-ball
pickup's look, viewmodel motion beyond B04's wheels, levels.
