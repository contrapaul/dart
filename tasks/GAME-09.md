# GAME-09: Blaster framework and the three slice blasters

Written 2026-11-01, after Paul approved B01, B04 and B03 (ART-00, ART-04).
Today the game has one placeholder pump blaster built from boxes in code.
After this task it has The Dartman, Shredder and Leviathan: their approved
Blender models as the first-person viewmodel, their own fire behaviour,
switched with 1, 2 and 3, all driven from data.

```
ID:          GAME-09
Title:       Data-driven blasters: pump, full-auto and break-action fire
             modes, mods, the .glb viewmodel with animated parts, switching
Owner:       Pi (Qwen 3.8-27b)
Reviewer:    Claude Opus 5.5 (tunes on the range), then Paul plays it
Depends on:  ART-00, ART-04 (models on main), ENG-11 (range)
Branch:      game-09, in its own worktree
```

## Read first

1. `CLAUDE.md` (every rule applies to you)
2. `design/blasters/B01.md`, `B04.md`, `B03.md`: the cards (numbers,
   mods, feel, motion). The models are fixed; do not edit anything in
   `art/` or `public/models/`.
3. `art/blasters/B01/NOTES.md`, `B04/NOTES.md`, `B03/NOTES.md`: node
   names, origins and **the rotation sign of every moving part**. Use
   those signs; do not guess.
4. `PLAN.md` section 5.2 ("The `.glb` contract")
5. `src/weapons/blaster.ts`, `blaster-model.ts`, `aim.ts`, `darts.ts`,
   `dart-model.ts`, `src/ui/hud.ts`, `src/main.ts`, `src/range/main.ts`,
   `data/blasters.json`, `data/darts.json`, `data/foamers.json` (`damage`,
   `catastrophic.popTypes`), `data/input.json` (`weapon1` to `weapon8`
   already exist)
6. `tests/weapons/blaster.test.ts` (keep its tests working through the
   new API)

## How to work (important)

Keep each reply's thinking short and act through tools. Build in stages:
one file, then `npx tsc --noEmit` and the tests, then the next. Never write
more than about 200 lines in one tool call. Suggested order: data and dart
types, the fire modes with tests 1 to 9, mods (10 to 12), the model check
(13), the viewmodel, switching (14), the HUD, then the pages.

## Data

### `data/darts.json`

Dart types become data: `darts.ts` and `dart-model.ts` read the type list
from `types` instead of the hard-coded `"standard" | "suction"` (the type
name stays a string type checked against the data at load). Add **`slug`**
(B01 mod 1): one heavy dart, `speed` 34, `gravityScale` 0.5, `length`
0.2, `radius` 0.03, `carveRadius` 0.25, `impulse` 1.5, colours your
choice from the palette. Piercing through thin parts is GAME-09b, not
here. Add `slug: 6` to `damage` in `data/foamers.json`; `popTypes` stays
empty.

### `data/blasters.json`

Replace `placeholder` with one entry per blaster, keyed by id. Shared
fields, then one block for the fire mode. Starting values from the cards
(marked to tune):

```json
"B01": {
  "name": "The Dartman", "model": "/models/blasters/B01.glb",
  "mode": "pump", "dartType": "standard", "dartsPerShot": 3, "spreadDeg": 2.5,
  "magSize": 8, "reserveMax": 40, "reserveStart": 40,
  "primeTime": 0.45, "reloadTime": 1.4, "autoReload": true,
  "muzzles": ["muzzle_1", "muzzle_2", "muzzle_3"],
  "viewmodel": { "position": [0.16, -0.17, -0.32], "rotationDeg": [0, 0, 0], "scale": 0.6 },
  "motion": { "kick": 0.04, "tiltDeg": 5, "return": 12, "triggerDeg": 15, "pumpTravel": 0.06, "magDrop": 0.15 },
  "mods": {
    "slug": { "dartType": "slug", "dartsPerShot": 1, "spreadDeg": 0 },
    "double": { "dartsPerShot": 6, "magSize": 12, "muzzles": ["muzzle_1", "muzzle_2", "muzzle_3", "muzzle_4", "muzzle_5", "muzzle_6"], "show": ["mod_double"] }
  }
},
"B04": {
  "name": "Shredder", "model": "/models/blasters/B04.glb",
  "mode": "auto", "dartType": "standard", "dartsPerShot": 1, "spreadDeg": 1,
  "magSize": 35, "reserveMax": 175, "reserveStart": 105,
  "fireInterval": 0.1, "spinUp": 0.15, "spinDown": 1.0, "reloadTime": 1.8, "autoReload": true,
  "recoil": { "spreadPerShot": 0.4, "spreadMax": 6, "climbDegPerShot": 0.25, "climbDegMax": 4, "recover": 0.4 },
  "muzzles": ["muzzle_1"],
  "viewmodel": { "position": [0.15, -0.18, -0.34], "rotationDeg": [0, 0, 0], "scale": 0.55 },
  "motion": { "kick": 0.01, "tiltDeg": 1, "return": 18, "triggerDeg": 15, "wheelSpin": 60, "magDrop": 0.18 },
  "mods": {
    "suppress": { "recoil": { "spreadPerShot": 0.12, "climbDegPerShot": 0.08 } },
    "bounce": { "_note": "Every 5th shot bounces to another target: GAME-09b. Data only for now." }
  }
},
"B03": {
  "name": "Leviathan", "model": "/models/blasters/B03.glb",
  "mode": "break", "dartType": "standard", "dartsPerShot": 8, "spreadDeg": 7,
  "magSize": 2, "reserveMax": 24, "reserveStart": 12,
  "fireInterval": 0.25, "reloadTime": 1.6, "autoReload": true,
  "muzzles": ["muzzle_1", "muzzle_2"],
  "viewmodel": { "position": [0.15, -0.17, -0.36], "rotationDeg": [0, 0, 0], "scale": 0.55 },
  "motion": { "kick": 0.06, "tiltDeg": 8, "return": 8, "triggerDeg": 15, "breachOpenDeg": -40, "latchDeg": 30 },
  "mods": {
    "both": { "bothBarrels": true },
    "quad": { "magSize": 4, "muzzles": ["muzzle_1", "muzzle_2", "muzzle_3", "muzzle_4"], "show": ["mod_quad"], "hide": ["fore-end"] }
  }
}
```

Plus `"order": ["B01", "B04", "B03"]` (the 1, 2, 3 keys, D04's level
order) and `"switchTime": 0.35`. A mod's fields override the blaster's;
nested blocks (`recoil`) merge key by key. Viewmodel placement numbers are
first guesses: the reviewer sets them on the range.

## Fire modes (`src/weapons/blaster.ts`)

`Blaster` takes a resolved spec (blaster plus active mods) and a muzzle
provider (a function giving the world position of muzzle `i`, so tests can
pass fixed points). `update(dt, controls, aimDir)` with controls
`{ fireHeld, firePressed, reloadPressed }`. Keep it allocation-free per
step. States: `ready`, `priming`, `reloading`, plus what each mode needs.

- **pump** (B01): as today. One press fires `dartsPerShot` darts with
  `spreadDeg`, spread across the active muzzles in turn, then `priming`
  for `primeTime`. Reload refills the magazine from reserve.
- **auto** (B04): while fire is held the flywheels spin up for `spinUp`
  seconds, then one dart every `fireInterval`. Each shot adds
  `spreadPerShot` to the current spread (up to `spreadMax`) and
  `climbDegPerShot` to the climb (up to `climbDegMax`). The climb tilts
  the aim direction up; expose it as `climb` (radians) so the page also
  adds it to the camera pitch it draws (the player's own pitch is not
  changed, so releasing the trigger brings the view back). When fire is
  released both return to zero over `recover` seconds and the wheels spin
  down over `spinDown`. Expose `wheelSpeed` (0 to 1).
- **break** (B03): the magazine is the loaded shells. Each press fires one
  shell (`dartsPerShot` darts) from the next loaded barrel, in order,
  at least `fireInterval` apart. With `bothBarrels` (mod), one press fires
  every loaded shell at once. Empty, a press (or auto-reload) starts
  `reloading`, which loads `min(magSize, reserve)` shells at the end.
  Expose `loaded[]` (which barrels hold a shell) and `reloadPhase` (0 to 1)
  for the animation.

`onShot(muzzleIndex)` fires once per shot for the viewmodel.

## Mods

`resolveSpec(blasterId, activeMods)` returns the merged spec. Mods are
switched on from the range panel for now (pickups come later). Switching
a mod on or off resets that blaster's magazine to its new `magSize` and
keeps the reserve.

## The viewmodel (`src/weapons/viewmodel.ts`, replaces `blaster-model.ts`)

- Load each blaster's `.glb` with three's `GLTFLoader`
  (`three/examples/jsm/loaders/GLTFLoader.js`, bundled by Vite; the file
  is on our own host). Load all three at start-up before the pause screen
  says "Click to play".
- Add it as a child of the camera at `viewmodel.position`,
  `rotationDeg` and `scale`. Nodes with `extras.hidden: true` start
  hidden; a mod's `show` and `hide` lists apply on top.
- Muzzle world positions: from the `muzzles` nodes, each frame, through
  the camera. Feed them to `updateAim` (`aim.ts`) in place of the old
  fixed `spec.muzzle`, so a muzzle inside a wall is still pulled back.
  Change `updateAim` to take a camera-space muzzle point (it already
  does, as `muzzleSpec`), nothing else.
- Animation, from each model's NOTES.md signs and the `motion` data,
  drawn each frame (not on the fixed step), easing so nothing snaps:
  - every blaster: kick back and tilt up on each shot, spring back at
    `return`; `trigger` rotates `triggerDeg` while fire is held or for
    0.08 s after a press;
  - B01: `pump` slides `pumpTravel` back and forward across `priming`;
    `mag` drops `magDrop` and returns across `reloading`;
  - B04: `flywheel_l` and `flywheel_r` spin at `wheelSpeed * wheelSpin`
    revolutions a second, in opposite directions; `mag` drops and returns
    on reload;
  - B03: on reload the `latch` turns `latchDeg`, the `breach` opens to
    `breachOpenDeg`, spent `shell_n` nodes fly out (up and back, hidden
    after 0.3 s), new ones reappear, the breach closes, the latch returns.
    `shell_n` nodes are hidden when their barrel is empty.
- Switching (keys `weapon1` to `weapon3`, and the mouse wheel): the
  current blaster dips out of view over half `switchTime`, the next rises
  in over the other half; no firing while switching. Each blaster keeps
  its own magazine and reserve.

## HUD and pages

- `Hud.setAmmo` shows the blaster name, magazine and reserve; for B03 the
  loaded shells as two (or four) small pips.
- `src/main.ts` and `src/range/main.ts` use the new blasters (all three
  available on both pages), feed `fireHeld` from `input.isDown("fire")`,
  and add the blaster's `climb` to the camera pitch they draw.
- Range panel: a row of blaster buttons (B01, B04, B03) and, for the
  selected blaster, one toggle per mod. The dart type buttons stay. The
  report lists the blaster and its active mods.
- Remove `blaster-model.ts` and the `placeholder` data once nothing uses
  them. The `KeyT` dart type toggle on the game page goes (the range's
  dart buttons remain for tests).
- The dev hooks (`__dart`, `__range`) expose the blasters and viewmodel.

## Tests (`tests/weapons/blaster.test.ts`, extended)

With a fake dart system that records each fire (origin, direction, type)
and fixed muzzle points:

1. to 4. The existing four, through the new API on B01.
5. B01 fires its darts from muzzles 1 to 3 in turn.
6. B04 held: no dart before `spinUp`; then one every `fireInterval`
   (count over 2 s within 1).
7. B04 recoil: after 10 shots the spread is `1 + 10 * 0.4` (capped at
   `spreadMax`) and `climb` is `10 * 0.25` degrees (capped); 0.4 s after
   release both are back to 0; every dart direction is within the current
   spread plus climb of the aim.
8. B03: press, press: 8 darts from muzzle 1, then 8 from muzzle 2, at
   least `fireInterval` apart; a third press with both fired starts a
   reload that loads 2 shells and takes 2 from the reserve.
9. B03 `fireInterval`: two presses 0.1 s apart fire one shell, the second
   press is ignored.
10. Mods: B01 `double` gives 6 darts per shot, magSize 12, muzzles 1 to 6;
    B01 `slug` fires one `slug` dart.
11. B04 `suppress`: after 10 shots the growth in spread and climb is
    about 0.3 of test 7's (the per-shot growth is cut, not the base spread).
12. B03 `both`: one press fires 16 darts (8 per muzzle); `quad`: magSize 4,
    four muzzles.
13. Models: for every blaster in `blasters.json`, read its `.glb` from
    `public/` (parse the glTF JSON chunk directly; no loader) and check it
    has every node its mode, its muzzles, its mods' `show` and `hide`
    lists and its animation need (`trigger`; pump: `pump`, `mag`; auto:
    `flywheel_l`, `flywheel_r`, `mag`; break: `breach`, `latch`,
    `shell_1`, `shell_2`).
14. Switching: during `switchTime` no shot fires; each blaster keeps its
    own ammo across a switch.

## Done when

- [ ] `npm test` passes (all existing tests, the 14 above).
- [ ] `npx tsc --noEmit` and `npm run build` pass.
- [ ] No em or en dashes anywhere you wrote (check with
      `perl -CSD -ne 'print "$ARGV:$.\n" if /\x{2014}|\x{2013}/' $(git ls-files | grep -vE '\.(png|glb|webp|jpg)$')`).
- [ ] A dated `HANDOFF.md` log entry (`date +%F`): what was built,
      decisions and why, which old tests changed, what is unverified. Do
      not delete or rewrite other entries. Set the GAME-09 row in
      `PLAN.md` to "Pi (review)".
- [ ] Committed on `game-09`, message starting `GAME-09:` and ending with
      `Co-Authored-By: Qwen3.8-27B via Pi <noreply@local>`. **Do not merge
      and do not push.**

Skip the browser check: the reviewer places the viewmodels, tunes the
numbers on the range and checks every animation by eye.

## Known limits (do not do in this task)

- GAME-09b: catastrophic hits (big chunks), slugs piercing thin parts,
  explosions, B04's every-5th-shot bounce.
- Pickups for blasters, mods and ammo (D8), upgrade stations (D7).
- Sounds, muzzle flash and screen shake beyond the kick and climb.
- B02 and B05 to B08.

## If something is unclear

Stop and write the question at the top of your HANDOFF entry rather than
guessing. Ask in HANDOFF before changing any model or anything in `art/`.
