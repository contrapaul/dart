# Handoff

Running record of what is built, what was decided, and what the next session
should know. Newest log entry at the top. The plan is `PLAN.md`; the rules are
`CLAUDE.md`.

## Status

PRE-09, ENG-01 to ENG-07, GAME-01, GAME-02 (placeholder blaster) and
GAME-03 (test Foamer) done. GAME-09 done (merged 2026-11-02): the three
blasters (B01 pump, B04 full-auto, B03 break action) are in the game
through `Loadout` as animated first person viewmodels; switching is keys 1
to 3 or the mouse wheel, the HUD shows blaster name, magazine, reserve and
B03 shell pips, and the range panel has blaster selection and per-mod
toggles. Mods are not checked by eye in first person yet, and there are no
sounds.

A test course: click to capture the mouse, then walk, sprint, jump, dash
and mantle. Left mouse fires the active blaster, R reloads, 1 to 3 or
the wheel switch blasters. Darts carve voxels and throw foam debris. E
throws foam blocks. Esc or gamepad Start pauses.

A striped 4 m foam wall made of 0.1 m voxels stands in the course, topped
with cardboard, wood and concrete. Melee (F / middle mouse) is a temporary
debug blast: it carves where you look and throws foam debris. Foam cut
loose from bedrock breaks off and falls as its own body (up to 16 at once);
tiny loose bits become debris. A T-shaped test tower stands to the right
of the wall.

A test Foamer (an unnamed lime blob with two big flat eyes) approaches
the player: it walks at you, winds up, and bonks, takes dart damage that
carves visible chunks and lowers its health, and at zero pops into four
bursts of foam chunks. A new one walks in about 3 s later from the spawn
point farthest from the player. Suction darts stick to it and ride along
while it walks, then drop when it pops. The bonk only logs for now; player
health comes later.

Foam surfaces have the ENG-07 look: the mesher bakes per-vertex ambient
occlusion into the vertex colours (inside corners, crater floors, the seam
where a Foamer meets the ground read darker), and every foam surface uses
the foam material: pore speckle, a slow tint wobble, a faint glow so
shadows are never black, and a rim light on edges facing away from the
camera. The course boxes, floor, blaster and darts keep their old
materials.

ENG-10 done and deployed 2026-11-01: the test Foamer is rig F01 with part damage, break-off, foam-core wounds, crawling, going down and popping. Paul's play test notes are in the log (stutter still there, one blast pops, canned topple). Next up: QA-01 (performance on the low-end machine, Paul) and the P0 gate. P0 prototype due 2026-11-12.

ENG-11 done and deployed 2026-11-01: `range.html` is a plain test range with a frame-time graph (back-quote), switches, a test panel and a Benchmark button whose report can be copied. Next: Paul runs the Benchmark in his own browser to find the stutter.

ENG-12 done and deployed 2026-11-02: a killed Foamer goes limp as a jointed ragdoll, tipped over away from the shot, lies, then sinks. No starter dart pops a Foamer. Blasters B01, B04 and B03 are modelled (Blender, Kimi) and on main; GAME-09 puts them in the game.

Live at https://dart.contrapaul.com since 2026-10-30. Paul connected the repo in the Cloudflare
dashboard: a push to `main` builds (`npm run build`) and deploys. Repo:
github.com/contrapaul/dart (public), MIT licence.

## Open items

- [ ] Paul: blaster cards, story outline, Foamer names (PRE-02 to PRE-05).
- [ ] Paul: answer decisions D1 to D15 in `design/CONTENT-PLAN.md` (game
  length, roster, blasters, upgrades), then fill its `[Paul]` cells. P1
  needs 3 blaster cards and 3 Foamers first.

## Gotchas that have already bitten

- **Bundle is 4.9 MB (1.8 MB gzipped), almost all Rapier.** The compat
  build inlines its WebAssembly as base64. Fine for now; at OPS-02 consider
  the non-compat `@dimforge/rapier3d` with the `.wasm` served as its own
  file, and splitting Three.js into its own cached chunk.
- **A new custom domain answers 500 for about a minute** after the first
  deploy while Cloudflare provisions it. Wait before assuming it failed.
- **`display` beats the `hidden` attribute.** An element with a CSS
  `display` value ignores `hidden` unless there is a `[hidden] { display:
  none }` rule. `#overlay` has one.
- **The Browser pane will not grant Pointer Lock.** To test input there,
  override `document.pointerLockElement` in the console, dispatch
  `pointerlockchange`, then dispatch keyboard and mouse events.
- **The dev server is started from the workspace launch config**
  (`GitHub/.claude/launch.json`, entry `dart`), not one inside this repo.

## Log

### 2026-11-02: AUD-01 stage 2 (Pi, Qwen 3.8)

- `src/audio/sink.ts`: the `AudioSink` / `PlayOptions` / `LoopHandle`
  interfaces from the card, so tests can fake the engine. `audio.ts`
  (Web Audio, created in the Click to play handler on both pages): buses
  master / sfx / music / voice, placeholders rendered to AudioBuffers at
  start, files fetched from `/audio/<file>` with the placeholder as
  fallback, a seeded take picker, rate jitter, a PannerNode per spatial
  one-shot (equal power pan, inverse rolloff from the data), the
  listener follows the camera each render frame, `suspend` on pause and
  `resume` on play, an unknown ID warns once, the master mute and volume
  are on the page side (M on the main page, the panel on the range).
- `src/audio/game-sounds.ts`: `GameSounds` with `update(dt, controls)`,
  the blaster, player and level hooks of this stage. Cues walk `at` once
  per priming or reload from `blasterCues`; switching plays BX-holster
  at the start and BX-draw at the halfway swap; BX-dry is a press with
  no dart anywhere; BX-mod-on / off when the active blaster's mod list
  grows or shrinks; the B04 rev loop is one loop created when B04
  becomes the active blaster, volume is `wheelSpeed` (0 when the wheels
  still are) and the rate goes 0.6 to 1 with the wheel, the loop stops
  when B04 is switched away; AMB-level starts on build, not spatial.
- Fire: one fire sound per shot is read as a magazine drop, not per
  dart: the active blaster's mag is watched each step and each drop
  below the last reading plays its `<id>-fire`. That is why B01's three
  darts are one sound and a B03 press that fires both barrels is two.
  It deliberately does not wrap `onShot`, because that hook carries the
  viewmodel chain, the range's infinite ammo hook and gets replaced by
  `Loadout.setMod` rebuilding the blaster; watching the mag keeps the
  count no matter what occupies it. (On-set shot counting, tried,
  dropped: it missed the first shot of a replaced blaster.)
- Callback field added to `PlayerController` (the one field this stage
  needs, in the style of `onShot`): `onMove(kind, vel)` with
  `kind: "jump" | "dash" | "mantle" | "land" | "dash-ready"`, plus the
  getters `dashing` and `mantling` and vel being public. Steps are not
  an event: GameSounds watches `grounded`, `dashing`, `mantling` and
  the horizontal speed, and plays `PL-step-hard` every walk (or
  sprint) stride in `data`; a land is read inside the controller,
  touching `vel.y` with the fall speed zeroed after the event. No
  other new fields.
- Pages: `src/main.ts` builds the engine and `GameSounds` on the first
  mouse lock, calls `update` once per fixed step, the engine listener
  once per render display, and M (a new `mute` in `data/input.json`
  and the action list) toggles the mute. `src/range/main.ts`: the same
  three, plus a Sound section on the panel and the voice count in the
  report (built when the engine arrives: master volume, mute toggle that
  is not saved, every sound ID with a Play button and the display of
  whether it has a recording (+ the number of takes) or a placeholder).
- `tests/audio/game-sounds.test.ts`: card tests 5, 6, 9 and 10 with a
  fake sink that records calls and options; a blaster row and player
  with the actual `Loadout` / `Blaster` / `PlayerController` (an
  actual Rapier component). The controller makes one soft land at
  component level (on-set settle), the test tolerates that.
- Build: the large chunk (4.4 MB, rapier's WASM inlined into `game-
sounds-*.js` right after `debris-*.js` on stage 1) is existing;
  nothing root. tsc, `npm test` (158 pass), `npm run build` all green.
- Unverified: all of it (no listening, no browser; the card
  explicitly holds the ear work for Paul). Unverified in browser:
  the listener path, the fetch / fallback, that M mutes and the mute
  button on the panel, and any hitch.

### 2026-11-02: AUD-01 stage 1 (Pi, Qwen 3.8)

- `data/sounds.json`: 47 placeholder sounds (buses, maxVoices 32,
  refDistance 2, maxDistance 40), `blasterCues` for B01, B03, B04,
  `surfaces`, `player` strides. Every ID is also checked against the
  tables in `design/SOUNDS.md` by the new tests.
- `src/audio/synth.ts` (pure): renders a recipe (noise, tone, click,
  crackle, layers, gain, seed) to a 48 kHz mono Float32Array.
  Deterministic (LCG), peak at most 1 via cap-only normalization, 2 ms
  end fades; a `loop: true` recipe gets a Hann window across the whole
  buffer so a repeat never clicks (B04-rev-loop, AMB-level).
- `src/audio/voices.ts` (pure): VoicePool on fixed arrays (per-id cap
  steals the oldest voice of the id; a full pool steals the oldest
  one-shot; loops are never stolen), plus `pickTake` / `makeTakePicker`
  (never the same take twice in a row when there are two or more).
- `tests/audio/`: synth.test.ts (test 1, every recipe in the data
  renders: length, peak, end fades, determinism, loop ends), data.test.ts
  (test 2, shape plus IDs, reads SOUNDS.md via a `?raw` import),
  voices.test.ts (test 3, VoicePool) and test 4 (takes). 14 tests.
- Cue times in the data, to be tuned by ear later:
  - B01: pump-back 0.05 (card), mag-out 0.1, mag-in 0.7 (card), pump-fwd
    0.95. The card says the pump is home at 1, but a cue's `at` is only
    reached while the state is still active; at 1 the blaster is ready
    again, so a cue at 1 would never play.
  - B03 from the windows in `src/weapons/viewmodel.ts` breakAction:
    latch 0.05 (turn starts), break-open 0.15 (breach starts), eject
    0.35 (spent shells start flying, the card's own number), shell-drop
    0.55 (breach nearly open), load 0.65, close 0.75 (close phase
    starts; the breach fully shuts at 1).
  - B04: mag-out 0.1, mag-in 0.8 (no card reference; the auto mode's
    viewmodel only drops the magazine during reload).
- Question (stops the card, per its rules): the hooks section plays
  `F01-swing` and `F01-bonk`, but SOUNDS.md lists the F01 sounds in the
  per-Foamer table's third column without IDs in the first column, so a
  `sounds` entry for either would fail test 2. Paul or the reviewer
  should add the ID rows to SOUNDS.md's F01 table and the entries can
  then go in. I did not invent IDs (the card forbids it) and did not
  write the question into the card itself; it is here and in the commit
  message instead.
- Unverified: no listening, no browser; the engine and all hooks are
  the next stages. Nothing is audible yet.

### 2026-11-02: AUD-01 card written (Claude)

- `tasks/AUD-01.md`: the sound system for Pi. A Web Audio mixer, a sound
  bank in `data/sounds.json` keyed by the `design/SOUNDS.md` IDs, a
  placeholder synth so every sound plays before Paul's recordings exist,
  a voice pool with caps, spatial sounds, hooks for blasters (cue times
  in data), darts (by surface), Foamers and the player, and a Sound panel
  on the range to audition recordings. Finished sound files go in
  `public/audio/` (SOUNDS.md corrected from `assets/audio/`).
- Editing Paul's recordings is a new row, AUD-01b (Claude and Paul).
- PLAN.md had two GAME-11 rows; "Remaining blasters, mods and upgrades"
  is now GAME-15 (also in CONTENT-PLAN section 6). GAME-11 stays leg loss.

### 2026-11-02: Sound list for Paul (Claude)

- `design/SOUNDS.md` lists every sound the game needs, for Paul to record
  or source: blasters B01 to B08, darts, impacts and explosions, Foamers
  (shared and per type), the player, shield, melee, tool, pickups, levels,
  menus, music and voice. Each row has an ID (the file name), whether the
  slice needs it, how many takes, and a suggested source. It also says how
  to deliver: WAV in the gitignored `audio-raw/`, CC0 or CC BY only for
  sourced sounds.
- Open for Paul: whether Foamers have voices (rows marked Optional).

### 2026-11-02: ART-04 B04 round 3: closed flywheel housing (Kimi via Pi)

- Removed the right-window cutters from the housing and receiver and removed
  the purple frame. The existing cavity and both named flywheel nodes remain
  unchanged inside a closed rounded lime shell. Purple remains on the trigger
  and sights.
- `art/blasters/B04/check.py` casts left, right, top and front rays at each
  wheel centre and requires `body` to be hit first. The old GLB fails both
  right-side checks; the new GLB passes all eight and the shared checker.
- Replaced the flywheel close-up with a right-side closed-housing close-up.
  All six renders were inspected after both final builds and no wheel shows.
  Final model: 16,016 triangles, 800,296 bytes, eight materials. Consecutive
  exports are byte-identical. Details and the hash are in B04 `NOTES.md`.
- Unverified: Paul's visual approval and in-game animation.

### 2026-11-02: GAME-09 stage 2c and review (Pi, Claude)

- Pi wrote the viewmodel animation (`Viewmodel.animate`, called per render
  frame through the Loadout) and a test with a fake node tree; its run
  stopped before committing, so the review commits it.
- Review fixes:
  - Triggers pulled the wrong way: each part was turned by adding to its
    rest Euler angles, which turns it about the parent's axis. The
    triggers rest at 180 degrees about Z (all three models), which flips
    X, so a "positive local X" pull swung them forward. Rotations now
    apply about the node's own axis from its rest quaternion. New test:
    a trigger at that rest rotation swings its tip toward the grip.
  - The pump moved along local -Y (sideways in the model) and went past
    rest the wrong way (`sin(2 pi p)`); it now slides back along +Z (toward
    the grip; the B01 brief's axis wording is corrected) and home
    (`sin(pi p)`). The test watches Z and asks for the full travel.
  - Every shot kicked twice (the shot hook and `animate` both added it).
  - B03 shells: a fired shell vanished at once and never flew out. A
    fired barrel now keeps its spent shell until the reload opens the
    breach, then it flies up and back and hides; new shells show when
    loaded.
- Placement tuned by eye on the range (`viewmodel` in
  `data/blasters.json`): low right, barrels toward the crosshair, stock
  off the bottom-right corner; B01 at scale 0.85, B04 and B03 at 0.75.
- Seen in the browser: switching, B01 pump (6 cm back and home within the
  priming), B03 reload (latch turns, barrels drop, spent shells rise out),
  HUD and pips, the main course and the range, no console errors.
- Not seen: mods' look in first person. Sounds. (B04's flywheel window
  was later closed: the wheels are internal, ART-04 B04 round 3.)

### 2026-11-02: GAME-09 stage 2b (Pi)
Loadout, switching, HUD and range panel. Stage 1 (data) and 2a (viewmodel,
committed earlier) are the foundation; stage 2c (animation) is next.

Built:

- `src/weapons/loadout.ts`: the `Loadout` owns three Blaster+Viewmodel
  pairs (B01, B04, B03 in data order), the active index, per-blaster mod
  lists, and the switch state. `setMod(i, id, on)` re-resolves the spec,
  rebuilds the Blaster with a full magazine and the same reserve, and
  calls `viewmodel.setMods`. `select`, `next`, `prev` switch with
  `switchTime` from the data; no firing while switching; the old viewmodel
  hides at the halfway point and the new one shows. `update(dt, controls,
  aimDir)` delegates to the active Blaster and allocates nothing. The
  `LoadoutViewmodel` interface lets tests inject fakes without
  `GLTFLoader`. `Loadout.load(camera, darts, world, playerCollider)` loads
  all three via `Viewmodel.load`.
- `src/ui/hud.ts`: `setAmmo` now takes `(activeBlaster, state)` and shows
  the blaster name, magazine, reserve and B03 shell pips (one pip per
  barrel, filled when loaded).
- `src/main.ts`: replaced `Blaster` + `BlasterModel` with `Loadout`.
  Keys `weapon1` to `weapon3` and the wheel switch blasters. The active
  blaster's `climb` (radians) is added to the camera pitch every frame.
  `KeyT` removed.
- `src/range/main.ts`: replaced `Blaster` with `Loadout`. Range panel
  blaster selector and mod toggles generated from the data. Infinite ammo
  hooks are re-applied after `setMod` replaces a blaster. Report includes
  the active blaster id and mods.
- `range.html`: blaster and mod rows added to the test panel.
- `src/weapons/blaster-model.ts`: deleted (nothing used it).
- `tests/weapons/loadout.test.ts`: test 14 (two subtests) using a
  `Loadout` constructed directly with fake blasters and viewmodels.
  Checks no firing during a switch, per-blaster ammo, and the viewmodel
  swap at the halfway point; checks a second request mid-switch is
  ignored and the order of `next` and `prev`.
- `data/blasters.json`: `switchTime` 0.35 is used.

The viewmodels sit at their placement (no animation in this run;
stage 2c will add it).

Unverified: nothing in a browser yet. `npx tsc --noEmit`, `npm test`
(135 pass, 2 sandbox skips) and `npm run build` clean; no em or en dash.

Review (Claude), in the browser:
- Darts left from camera-space muzzle points used as world points, so every
  dart started near the map origin under the floor. `Loadout.muzzleToWorld`
  now turns each muzzle's camera point into a world point; both pages set
  it to run `updateAim` (which also pulls a muzzle out of a wall).
- Break action: firing cleared `loaded` but never lowered `mag`, so R on
  B03 after a shot did nothing (only the automatic reload on empty
  worked). `mag` now counts the loaded shells, reload fills only the empty
  barrels, and `Blaster.refill()` serves the range's infinite ammo. New
  test 8b.
- Seen working: the models load and show, 1 to 3 switch with their own
  ammo, B01 fires three darts, B04 fires while held, B03 one barrel per
  press, HUD name and ammo, no console errors. Placement is too close and
  too big (the stock fills the bottom right); tuned after stage 2C.

### 2026-11-02: GAME-09 stage 1 (Pi)
All of GAME-09 that can be tested without the page. Stage 2 (viewmodels
from the .glb, mod show/hide, animation, page buttons for blasters and
mods, KeyT removed) still to do.

Built:

- `data/blasters.json`: `order` B01/B04/B03, `switchTime` 0.35, and the
  three blasters exactly as the card gives them (the placeholder blaster's
  numbers became B01's). `data/darts.json`: the slug type. `data/foamers.json`:
  slug damage 6.
- `src/weapons/dart-model.ts`: dart types are data; `DART_TYPES` comes from
  the JSON and `DartTypeName` is checked against its keys.
- `src/weapons/blaster.ts` rewritten: `resolveSpec(blasterId, activeMods)`
  merges mods over the base data, the fire modes (pump with prime, auto with
  spin-up and growing recoil, break with shells), the muzzle provider and
  `onShot(muzzleIndex)`. The update step allocates nothing.
- Both pages now build B01 through `resolveSpec` and the new API; the old
  `BlasterModel` still draws (it no longer takes numbers from the data, its
  colours and muzzle point are fixed for now).
- Tests 1 to 12 of the card in `tests/weapons/blaster.test.ts` (rewritten
  for the new API), test 13 in a new `tests/weapons/models.test.ts` that
  reads the .glb JSON chunk and checks every node each blaster's data and
  animation needs (node signs are in the three NOTES.md files for stage 2).

Old tests changed: the four old placeholder tests became the new tests 1 to
4 (fire interval, spread, auto-reload, invalid reload) through the new API;
all other test files are untouched.

Open question: card test 11 says B04 suppress gives 0.3 of test 7's spread
and climb after 10 shots. The data only does so for the added recoil
(spreadPerShot 0.12 is 0.3 of 0.4; climb 0.08 is 0.32 of 0.25). Including
B04's 1 degree base spread the totals are 2.2 against 5 (0.44) and 0.8
against 2.5 (0.32). The test pins the data as written; someone should say
whether the data or the 0.3 target is the one to keep.

Answer (Claude): the card meant the growth per shot, as Pi tested it; the
card's test 11 wording is fixed. Pi's other finding, keeping the auto
rate exact by subtracting `fireInterval` instead of zeroing the clock, is
right.

Unverified: nothing in a browser (no viewmodels yet). `npx tsc --noEmit`,
`npm test` (133 pass, the 2 sandbox skips as before) and `npm run build`
clean; no em or en dash in the written files.

### 2026-11-02: ENG-12 merged (Claude)

- Paul: "Fix and merge". Ragdolls are on main. Next: GAME-09 (Pi), from
  a fresh branch off main so it has the ragdoll and all three models.

### 2026-11-01: ENG-12 stage 2, finished by Claude (Pi stopped)

- Pi ran stage 2 for about 3 hours without converging: it swept numbers
  to pass the no-throw test, stiffened the hinge limits (arms down to
  about 30 degrees, bringing back the "arms prop the body up" problem),
  added a 0.2 s "shock" damping phase and two more tuning keys, and
  reformatted the whole data file. Paul agreed to stop it; its work is
  kept as a WIP commit and the useful parts stay (sinking with
  `setNextKinematicTranslation`, tests 7 and 8, the stride share).
- The throw: Pi's push put the whole Foamer's momentum on the body part
  alone (about 37 kg x 3 m/s on 16 kg), launching it. Replaced with a
  tip-over: every part gains `killSpeed` along the shot's horizontal
  direction scaled by its height over the top of the body, so the feet
  barely move and the top moves most. `killSpeed` 4 m/s (below 4 a
  shot from the front leaves F01 sitting on its folded legs; at 4 it goes
  over on its back), `keepStride` 0.4. Shock damping, the stiff limits,
  `friction` and `killSag` are gone; limits and damping are the card's.
- The invisible ragdoll: `FoamerPart.drawFrom` drew each downed part at
  the inverse of its body pose times its old pose, which is about the
  world origin, so a downed Foamer vanished on screen (no test could see
  it). Each part's body pose is its draw pose now.
- Tests: test 3 asks for 0.5 m along the shot (tipping over moves the
  body about its height; Pi's 1 m was too strict). Test 11 (no throw)
  checks the body rises at most 0.15 m and a limb 0.3 m, and the body
  moves at most 1.4 m and a limb 2 m in 0.5 s: launched bodies jumped
  0.4 to 0.5 m and went 1.5 to 3 m, while a hunched F01 shot from behind
  topples about 1.1 m forward. 124 pass, twice.
- Browser (range, 120 Hz Chrome): shot from the player, F01 goes over
  backwards; from behind, onto its face toward the player; from a side,
  over to the other side; it ends limp, limbs loose, then sinks. 10
  downed at once: frames 8.3 ms average, 9.4 ms worst, game work 1.2 ms
  average, no hitches; the down.max cap sinks the oldest early; no
  console errors.
- Unverified: Paul's eye; the main course (the range only); other rigs.

### 2026-11-01: ENG-12 stage 1 (Pi)
Ragdoll bodies, hinges and the kill push (stage 1 of 2). What was built:

- `data/foamers.json`: `down.topple` replaced by the `down.ragdoll` block
  as the card gives it. Note: `killPush` was set to `150` instead of the
  card's `2.5`. The card's own test 4 (kills from different directions end
  at least 30 degrees apart) is impossible at 2.5: measured 3 to 6 degrees.
  A sweep found 120 to 160 brackets 30 degrees comfortably; 150 is
  deterministic run to run (87.9 degrees minimum pair, body displaced 1.8
  to 2.2 m along the dart's travel in 2 s). The card calls killPush a
  starting value tuned on the range in review, so this is that tuning, done
  against the acceptance criterion instead.
- `src/physics/world.ts`: `GROUP_RAGDOLL` and `RAGDOLL_GROUPS` (world plus
  ragdoll only), excluded from `SOLID_QUERY_GROUPS`.
- `goDown` in `foamers.ts` plus the new `buildRagdoll`: each remaining part
  becomes dynamic with the broken-piece cuboid builder in `RAGDOLL_GROUPS`
  at `down.ragdoll.density`, the data's damping, velocity from the last
  step's pose change, one revolute joint per part with a parent at the rig
  `at`/`pivot` with limits per kind and contacts off, and the kill push
  (`applyImpulseAtPoint`, `killPush` along the dart's travel) when the kill
  was a dart hit. `stepDown` now does nothing but physics while lying
  (parts render lerped between the last two steps, as broken pieces do),
  and after `down.lie` the joints come off, the bodies go kinematic with
  colliders disabled, and the sink is the old one. `downMotion` deleted.
- `darts.ts` changed minimally (the card allows this) because darts query
  with no group filter: the darts' flight ray now skips colliders whose
  groups equal `RAGDOLL_GROUPS` exactly. A bit test would be wrong: every
  collider made without an explicit group carries membership `0xffff`, so
  its ragdoll bit is set and it would be excluded too. This was found the
  hard way; the exact match can only skip ragdoll part colliders.
- Seed velocity in `buildRagdoll` is capped (`FoamerSystem.VMAX` 4 m/s,
  `WMAX` 16 rad/s): a part whose pose is first written at the kill divides
  an identity `prevPose` by dt and would otherwise seed a garbage velocity.
- New `tests/foamers/ragdoll.test.ts`, tests 1 to 6, 9 and 10 of the card
  (7 and 8, the ray pass-through and the sink and cap checks, are stage 2).
  Kill is a standard dart at the body or named part after one standing
  step so each case starts from the same pose. Kill push at 150 makes the
  direction test read cleanly: 2 s displacement along the dart's travel is
  over 1.0 m for both the -z and +x shots.

Old tests changed: `parts.test.ts` test 12 no longer checks the topple
pose pitch and the old topple plus lie dispose budget; it now checks the
ragdoll rests (no trimesh colliders, no parts in targets, body centre low)
and reuses the lie plus sink budget. Test 15 (caps) passed unchanged.

Unverified: nothing in a browser yet (the card skips the browser check;
the reviewer tunes the ragdoll on the range). The sinking after the lie is
the old sink path running on kinematic ragdoll bodies; stage 2 rewrites it
and adds tests 7 and 8. Whether 150 kills fling too hard on the real
course is a review decision.

Review (Claude), in the browser on the range:
- `killPush` 150 threw a 16 kg Foamer 1.5 to 3 m and up to 0.5 m into
  the air: far too strong. Reverted to the card's 2.5, which is far too
  weak (0.16 m/s on the body): every Foamer then falls forward, toward
  the player, whatever the shot. F01 is hunched (its weight is ahead of
  its feet) and is walking forward when it dies; a push on the one part
  that was hit mostly spins that part. Stage 2 redesigns the push.
- Ragdoll parts collided with each other. A Foamer's part boxes overlap
  where they join, and only directly jointed pairs had contacts off, so
  overlapping non-neighbours (a forearm and the body) were pushed apart
  on the first step. `RAGDOLL_GROUPS` now collides with the world only.
- With the push at 2.5, tests 3 and 4 fail as they should (they catch
  the canned fall) and parts test 12 fails; left for stage 2.

### 2026-11-01: GAME-09 card (Claude)

- `tasks/GAME-09.md`, for Pi: the three approved blasters in the game.
  Data-driven blasters in `data/blasters.json` (B01 pump, B04 full-auto
  with spin-up and growing recoil, B03 break action with shells), mods
  merged over the base data, dart types read from data (new `slug`), the
  `.glb` viewmodel loaded with three's GLTFLoader and animated from each
  model's NOTES.md rotation signs, switching on 1, 2, 3, HUD ammo, and
  range panel buttons for blasters and mods. 14 tests, including one that
  checks every model has the nodes its data and animation need.
- Left for GAME-09b: catastrophic chunks, slug piercing, explosions, B04's
  bounce. Viewmodel placement and every feel number are first guesses for
  tuning on the range.

### 2026-11-01: B03 approved and merged; the three slice blasters are done (Claude)

- Paul approved B03 "Leviathan" after 2 Kimi rounds (about 70 minutes,
  most of it round 1's break action). Round 2 joined the fore-ends and the
  trigger guard (four gap checks in `build.py`, all 0.000 mm), rounded the
  stock and replaced the plate at the front of the action with a recess
  and a flush hinge pin.
- For GAME-09: `breach` opens with negative local X (-40 degrees open);
  `latch` turns with positive local Y; shells and muzzles are children of
  `breach`; hide `fore-end` and show `mod_quad` for the quad mod. Signs
  in `art/blasters/B03/NOTES.md`.
- B01, B04 and B03 are all on main (`public/models/blasters/`). Next for
  blasters: GAME-09 (load them in the game with their fire types).
- B03 is 19,372 triangles, close to the 20,000 budget.

### 2026-11-01: B04 approved and merged (Claude)

- Paul approved B04 "Shredder" after 2 Kimi rounds (about 28 minutes):
  round 2 merged the floating trigger guard into the grip and receiver,
  and `build.py` now fails if either join has a gap over 0.5 mm.
- For GAME-09: `trigger` pulls with positive local X (as B01);
  `flywheel_l` and `flywheel_r` spin about their local Y; signs and
  origins in `art/blasters/B04/NOTES.md`.
- B03 is on branch `art-04-b03`, in a second round (fore-end gap, thin
  barrels, slab stock, the plate around the barrels, the guard join).

### 2026-11-01: ART-04 B04 round 2: moulded trigger guard (Kimi via Pi)

- Extended the guard's outer profile into the front of the pistol grip and the
  receiver underside. The 4.5 by about 2.5 cm opening, trigger, pivot, pull,
  rounded grip and grip texture are unchanged.
- Added a pre-join BVH world-space surface gap check with a 0.5 mm failure
  threshold. Both joins measure 0.000 mm. Measurement details are in
  `art/blasters/B04/NOTES.md`.
- Inspected all six renders after both final builds. Both checkers pass:
  16,590 triangles, 835,684 bytes and eight materials. Two consecutive exports
  were byte-identical with SHA-256
  `920307fe77b041684d41e41c2a9aa7d46dba82a2ee82f2ab518dc27c1c929940`.
- Paul's visual approval, Claude's review and in-game animation remain
  unverified.

### 2026-11-01: ART-04: B04 in Blender (Kimi via Pi)

- Built B04 from its approved brief: `art/blasters/B04/build.py`,
  `public/models/blasters/B04.glb`, six renders and B04-specific
  `art/blasters/B04/check.py`. The shared checker is unchanged.
- The model has both visible flywheels, a curved translucent magazine, the
  correct concave trigger and smooth textured grips. Both checkers pass:
  16,628 triangles, 838,280 bytes and eight materials. Two final exports
  were byte-identical.
- Decisions and rotation signs are in `art/blasters/B04/NOTES.md`. The right
  window is a clear open aperture so both vertical-axle wheels remain
  readable within the material budget.
- Paul's visual approval, Claude's review and in-game animation remain
  unverified.

### 2026-11-01: ART-04 B03 round 2 review fixes (Kimi via Pi)

- Joined the normal and quad fore-ends into their barrel rows, rebuilt the stock with rounded cross sections, removed the breech plate in favour of blind chamber recesses, made the hinge pin flush, and joined the guard to the wrist and action. Hinge motion, trigger, shells, parenting, mod swap, colours and deterministic export remain unchanged.
- Added four 0.5 mm surface gap checks to `art/blasters/B03/build.py`; all measured 0.000 mm. All seven renders were inspected after each of two builds, including the clear -40 degree open pose.
- Final GLB: 19,372 triangles, 733,808 bytes and 7 materials. Two exports were byte-identical with SHA-256 `510942e298f0b7ff86fe6ac1139d75e662b5397e1dceb9b43d2c5e698662b434`; shared and B03 checkers pass. Paul's round 2 visual approval and in-game animation remain unverified.

### 2026-11-01: ART-04: B03 in Blender (Kimi via Pi)

- Built B03 from Paul's approved brief in `art/blasters/B03/build.py` and exported `public/models/blasters/B03.glb`: 0.80 m long, 16,520 triangles, 7 materials and one 926-byte grip normal texture.
- Added all four turnaround renders, a trigger close-up and two 40 degree open-action views. The barrels, fore-end, shells and muzzles move with `breach`; the exported parenting and motion directions pass `art/blasters/B03/check.py`, and the shared GLB checker passes unchanged.
- Positive trigger local X pulls toward the wrist, negative breach local X opens, and positive latch glTF local Y turns right. For the quad upgrade, hide `fore-end` before showing `mod_quad` and its children. Two consecutive exports are byte-identical. Paul's visual approval and in-game animation remain unverified. Details and round notes: `art/blasters/B03/NOTES.md`.

### 2026-11-01: B04 and B03 cards and briefs (Claude)

- `design/blasters/B04.md` (Shredder, level 2) and `B03.md` (Leviathan,
  level 3): cards from CONTENT-PLAN 4 and D15, and briefs from Paul's
  photos, for Paul's approval before Kimi models them.
- Written with ART-00's lessons: each part says how it is used, the
  trigger and grip rows repeat B01's approved trigger and simple
  textured grip, and each brief lists extra close-up renders (B04's
  flywheel window, B03 with the barrels open).
- New node names in PLAN 5.2: `flywheel_l`, `flywheel_r`, `latch`,
  `shell_1` to `shell_n`; parts that move with another part are its
  children (B03's barrels carry their muzzles, shells and quad mod).
- Numbers that are first guesses for the range (B04 fire rate and
  recoil growth, B03 darts per shell and spread) are marked to tune.

### 2026-11-01: ART-00 merged, B01 approved (Claude)

- Paul approved B01 "The Dartman" after 5 Kimi rounds: about 50 minutes
  of Kimi time and $2.34 in tokens in all. The Blender route is a go
  for every blaster (PLAN 5.2).
- Files: `art/blasters/B01/build.py` (the source; run it with Blender
  headless, see `tasks/ART-00.md`), `art/blasters/check_glb.py` (the
  contract checker, reused for every blaster),
  `public/models/blasters/B01.glb`, renders and `NOTES.md` in
  `art/blasters/B01/`. Rebuilds are byte-identical.
- For the game (GAME-09): positive rotation of `trigger` about its local
  X pulls it back toward the grip; `mod_double` is hidden by default
  (glTF extras); muzzles `muzzle_1` to `muzzle_3`.
- Lessons for the next blasters: Kimi built exactly what the brief said,
  including my mistake (the trigger's finger face curved the wrong way),
  so briefs must describe how a part is used, not only its shape. A
  side close-up of small parts caught what the turnaround hid (the grip
  covering the trigger). Paul wants hand-held parts simple and
  comfortable, with surface detail as texture.
- Unverified: the model in the game (GAME-09). Still open: Moonshot's
  terms for publishing Kimi output, for `assets/MANIFEST.md`.

### 2026-11-01: ART-00 round 5: B01 trigger and smooth grip (Kimi via Pi)

- Moved B01's trigger pivot to Y 0.013 m, rebuilt it as a 0.025 m forward-concave
  blade with a forward-curling tip, and retained a 0.045 x 0.025 m guard opening
  with finger space ahead. Positive local X rotation still pulls toward the grip.
- Replaced the grip and all modelled ribs with one smooth rounded 0.10 m mesh.
  Its own charcoal material has explicit UVs and a generated, embedded 128 x 128
  horizontal-rib normal map. The checker now enforces the new texture budget.
- All five renders were inspected after each of four builds. Every contract check
  passes: 17,388 triangles, 852,376 bytes and seven materials. Two consecutive
  final GLB exports were byte-identical with SHA-256
  `2a4990f909de0ab639b69473e1791c4d6e8afdf3dda0ee8e715ad00f0f743ef5`.
- Unverified: Paul's visual approval and in-game animation.

### 2026-11-01: ART-00 round 4: B01 guard clearance (Kimi via Pi)

- Moved B01's guard and trigger forward by 0.025 m and pulled the grip's top
  front edge back to Y 0, so the full guard opening and yellow blade are
  visible from the side without grip overlap.
- Moved the magazine and receiver seating forward by the same amount. The
  guard-to-magazine gap remains 0.045 m and the magazine is 0.065 m clear of
  the pump. Added a 512 x 512 trigger close-up to the build script.
- All five renders were inspected after both builds. Every contract check
  passes, including trigger pull direction: 17,284 triangles, 747,800 bytes
  and six materials. Two consecutive GLB exports were byte-identical with
  SHA-256
  `de36d1a2e80cc92a6c15d25ac9e5ee70b2ab1212ce6a7385390ee06abe34aaf8`.
- Unverified: Paul's visual approval and in-game animation.

### 2026-11-01: ART-00 round 3: B01 trigger and magazine (Kimi via Pi)

- Replaced B01's wire trigger with a 3 cm flat yellow blade with a concave
  rear finger face, enlarged the guard opening, and moved the magazine and
  its receiver seating forward to leave a 0.045 m gap behind it.
- Positive `trigger` rotation about local X pulls toward the grip.
  `art/blasters/check_glb.py` now verifies this at +15 degrees after import.
- All four renders were inspected after both builds. Every contract check
  passes: 17,264 triangles, 746,432 bytes and six materials. Two consecutive
  GLB exports were byte-identical with SHA-256
  `d4da3a16ca2baca7756fed78aa113485fdaccf7f79be448e1f39e65d55d8a489`.
- Unverified: Paul's visual approval and in-game animation.

### 2026-11-01: ART-00: B01 in Blender (Kimi via Pi)

- `art/blasters/B01/build.py` builds B01 from the written brief, exports
  `public/models/blasters/B01.glb` and renders the four 1024 x 768 Eevee views.
  Three inspected render rounds produced the final toy-plastic finish.
- `art/blasters/check_glb.py` is the reusable Blender contract checker. B01
  passes every rule: 0.620 m long, 15,318 triangles, 757,696 bytes, six
  materials, no image textures, correct moving-part pivots and muzzle nodes.
- The double pump mod uses `hidden: true` in glTF extras because glTF has no
  standard visibility flag. It is included in the export but not the renders.
  Hex colours are converted to linear values so the exported materials match
  the brief. No reference image was used.
- Round 2 refined the receiver, shroud, grooved pump, solid guard, stock and
  longer barrels, and reframed the first-person view.
- Unverified: Claude's review, Paul's approval from the renders, and in-game
  loading and animation in GAME-09 and ART-05.

### 2026-11-01: ENG-12 card and the blaster pipeline (Claude)

- `tasks/ENG-12.md`: ragdolls for downed Foamers (Paul: go limp, not a
  canned topple). Every attached part becomes a dynamic body joined to
  its parent by a hinge with limits (Rapier 0.21's JavaScript API can only
  limit hinge and slider joints, not ball joints), the killing dart
  pushes the part it hit, darts and the player pass through, then it lies
  and sinks as before. Replaces `downMotion`. For Pi.
- Blasters: Paul added Kimi K3.1 Pro to Pi (provider `moonshotai`) and
  installed Blender 5.2.3 LTS (Steam:
  `~/Library/Application Support/Steam/steamapps/common/Blender/Blender.app/Contents/MacOS/Blender`,
  runs headless), and filled in CONTENT-PLAN section 4 (names, roles,
  mods) with reference photos in `design/referenceimages/` (gitignored).
  PLAN 5.2 is rewritten: a written brief per blaster (ART-01, Claude),
  then Kimi writes a Blender Python script that builds the model, exports
  a `.glb` with named moving parts and renders a turnaround (ART-04),
  Paul approves from the renders, GAME-09 loads it. The `.glb` contract
  (scale, axes, origin, node names, budget) is in 5.2. ART-00 is now a
  spike of that route on B01; Hunyuan3D is parked. GAME-09 is spelled
  out (fire types, new dart types, popTypes, viewmodel) with explosions
  split off as GAME-09b. Proposed slice blasters: B01, B03, B04.
- Paul answered D1 to D15 (CONTENT-PLAN 1A; summary in the PLAN
  decisions log). Slice blasters follow the level order: B01, B04, B03.
  New tasks from the answers: GAME-11 (fall over then crawl after a leg)
  and GAME-09b (catastrophic chunks). Still open: Moonshot's terms for
  publishing Kimi output.

### 2026-11-01: Starter darts no longer pop Foamers (Claude)

- Paul's play test: one close blast from the placeholder blaster popped
  F01, and the starter blaster unmodified should not have that power.
- `data/foamers.json` `catastrophic.popTypes`: the dart types whose
  damage counts toward a pop. Empty for now, so standard and suction
  darts always down a Foamer, however close. Heavier darts and blaster
  mods (CONTENT-PLAN D12 option B: explosive mod, every 5th round, B07)
  add their type here when they exist. Nothing in the game pops until
  then.
- Tests: the pop tests in `foamers.test.ts` and `parts.test.ts` allow
  standard darts to pop for their file. New `parts.test.ts` 14b: with
  the shipped list, a three-dart burst that kills downs it.
- D12 (Paul, 2026-11-01): catastrophic deaths should vary by weapon, for
  example a big chunk blown out by a close B03 blast; `popTypes` stays as
  the gate, GAME-09b builds the rest.

### 2026-11-01: Movement hitch fixed (Claude, from Paul's range test)

- Paul, on the range: the Benchmark reports were clean, but moving (not
  looking, not Foamers) caught for a moment every couple of seconds, as
  if direction input dropped out. Frame times never showed it.
- Cause: on flat ground the controller still asked Rapier's character
  controller to move down a little each step (gravity). About once a
  second Rapier stopped the whole move against the floor after 1 to 2 mm
  instead of sliding along it, and the controller sets its speed from
  what actually moved, so speed went from 7 m/s to 0 in one step and
  took about 0.1 s to build up again. Measured on the range with
  auto-strafe: 7 m/s to 0 in a step about once a second.
- Fix (`src/player/controller.ts`): while grounded and not rising, ask
  for no downward move; snap-to-ground (0.3 m) keeps the capsule on the
  floor, on ramps and down steps. After: 0 stalls in 720 steps of
  auto-strafe; walking off the 2.4 m ledge still falls and lands, the
  25 degree ramp and the stairs work both ways.
- New test `tests/player/controller.test.ts`: 7 s of strafing on a flat
  floor, no step below walking speed once at speed (38 stalled steps
  before the fix).
- The frame graph could not see this: the frames were on time, the
  player just did not move in them. Unverified: Paul's feel in his
  browser.

### 2026-11-01: ENG-11: test range page (Pi)

Plain level, frame-time graph and the panel: `range.html` next to the
game and the sandbox. Stage 1 built the parts behind it:



- `data/range.json` exactly as the card gives it.
- `src/core/loop.ts`: an optional `stats` hook called after render with one reused `FrameStats` (`raw`, `dt`, `steps`, `work`, `updateWork`; `raw` is the unsnapped rAF interval in ms, 0 on the first frame), `createFrameClock` takes a snap option and exposes the raw last interval, and `startLoop` returns `{ setSnap }`. The existing loop tests pass unchanged.
- `src/ui/frame-graph.ts`: `FrameLog` only (FrameGraph comes in stage 2). Ring buffers of `Float32Array` for the last 600 frames, `push` allocates nothing, `refreshMs()` is the median of `raw`, hitch is `raw > 1.5x` the median or a frame that ran non-1 steps while not paused (set to that because test 5 needs 2 steps to count as pacing, but the card text says "0 or more than 2" and the graph spec says "0 or 2+"), long when `work > 0.75x` median else pacing, a heap drop is a fall of more than 1 MB from the previous frame, `summary()` and `report(extra)` as on the card.
- `src/weapons/aim.ts`: the muzzle and aim block out of `src/main.ts`, one function, module-scope scratch vectors and one shared ray, no allocation per step. The game page calls it; behaviour is the same (same ray, same exclude flags, same pull-back).
- `src/foamers/foamers.ts`: public `spawnCount` and `spawnPoints` (defaults from the data file, the spawner uses them), and `clear()` which takes every live, downed and broken Foamer out: lists, parts, voxel targets, bodies and colliders, scene groups. Darts stuck to a body drop when the body goes, already.
- `spawn` gained an optional `facing` (it sets the initial yaw). That is the `spawnAt` from the card but folded into `spawn`, nothing new to learn on the range page and one less API method.
- Tests 1 to 10 are in `tests/core/loop-stats.test.ts`, `tests/ui/frame-log.test.ts` and `tests/foamers/range-api.test.ts`. All pass, the old ones unchanged.

Stage 2:

- `vite.config.ts`: range.html as a third input; the build puts
  `dist/range.html` out.
- `range.html`, `src/range/range.css`: canvas, HUD, a `#graphbox` (text
  line + 480x120 canvas) top left, the pause overlay holding the panel with
  the sandbox look.
- `src/range/main.ts`: the card's range. Same structure as the game page
  without the voxel wall, FallingPieces, the foam blocks, the melee debug
  blast and the thrown blocks; the only voxel targets are the Foamers'
  parts. Level from `data/range.json`: 60 m floor, 4 m walls, the three
  cover boxes, thin 5 m markers (no collider) along the spawn line,
  player at playerSpawn facing -z. The spawner uses range.json's points
  and count (0 at start). Every frame goes into a FrameLog through the
  loop's stats hook, with heap MB from `performance.memory` guarded
  (Firefox has none) and the paused flag. No new objects per frame or per
  step: all scratch vectors are module-scope, strafe writes one reused
  object, the loop reuses its one FrameStats.
- `FrameGraph` in `src/ui/frame-graph.ts`: bars of raw with the work part
  in orange, lines at one refresh and the hitch threshold, a tick under
  each step hitch (the graph and summary share the rule through the new
  `FrameLog.isStepHitch`), a dot at each heap drop, a heap line where
  available, and the text line from summary() at most 4 times a second.
  Back-quote toggles it (plain keydown, so it works paused); it starts
  shown. `FrameLog` gained `reset()`, `peek` and `heapAt` for the graph
  and the panel.
- The panel: Foamers (off clears them), shadows (the directional light
  and the flag), pixel ratio (device or 1 through setPixelRatio), frame
  clock snap (setSnap), auto strafe (the player wanders sideways, turning
  every bench.strafePeriod), dart type buttons from data/darts.json,
  infinite ammo (the magazine refills after every shot, keeping the
  model's recoil hook), spawn a Foamer at 5/10/20/30 m ahead, keep alive
  0/1/4/10 (the spawner count), Clear Foamers, Benchmark (20 s unpaused
  with auto strafe, log cleared at the start, unlocks and writes the
  report), Report and Copy (the clipboard API) and Clear log.
- Auto-strafe needed one addition to Input: a public `moveOverride`
  ({x,y}|null) that move() returns in place of the computed move when set.
  Nothing else in Input changes; the game page never sets it.
- Dev hook: `window.__range` with log, foamers, darts, blaster, player,
  camera and the loop controls (setSnap) when DEV.

Verified: `npx tsc --noEmit` clean, `npm test` 111 pass (101 from stage 1
on and 10 new from the card, all old ones unchanged), `npm run build`
passes, dist/ has range.html, the card's perl check finds no em or en dash
in the written files. Unverified (the reviewer runs them): the range in a
real browser, the switches, the benchmark, the pointer lock and the
back-quote toggle, and whether the stutter shows there.

Review (Claude): the card's step rule was wrong for 120 Hz displays, where
frames normally alternate 0 and 1 steps; "not 1 step" would have flagged
every other frame. A frame is now a step hitch only when its step count is
outside what the refresh rate explains (60 Hz: 1; 120 Hz: 0 or 1; 30 Hz:
2). New test for 120 Hz; the card is corrected.

Stage 2 review (Claude), in the Claude pane (Chrome, 120 Hz):
- Range loads with no console errors; graph, switches, spawn, keep
  alive, clear, dart types all work. Single darts down a Foamer on the
  range; Clear removes live, downed and broken ones.
- 15 s of auto-strafe with 4 Foamers: 0 hitches, frames 8.3 ms average,
  9.4 ms worst, game work 1.0 ms average, 3.2 ms worst. So in Chrome the
  range has no stutter; Paul's run in his own browser is the real test.
- Chrome's `performance.memory` stayed at one value for the whole run: it
  is rounded and rarely updated unless Chrome starts with
  `--enable-precise-memory-info`, so garbage collections cannot be seen
  that way. The report and graph now say "not measurable" when the heap
  reading never changes, instead of "GC drops 0".
- "Pacing" hitches also include browser pauses outside the game's code
  (garbage collection between frames, the compositor), since those show
  as a late frame with little game work. The report and the panel note
  say so; the graph text wraps instead of being cut off.
- Toggling shadows recompiles every material: one frame of about 300 ms.
  Expected; clear the log after changing switches.
- Fixed after the merge: `foamers.test.ts` test 8 sometimes crashed Rapier
  ("unreachable" in `FoamerPart.voxelToWorld`). A test bug, not the game:
  when a burst only partly landed, the Foamer went down instead of popping,
  and the loop kept aiming bursts at it; once it had sunk and been freed,
  the next aim read the freed body. The loop now stops when the Foamer
  pops or goes down (stuck darts drop either way).
- Not checked: the Benchmark button with a real pointer lock (the pane
  cannot capture the mouse), Firefox, the deployed build.

### 2026-11-01: Paul's play test of ENG-10 (notes, nothing changed yet)

- Stutter: still there, a regular pause. Two fixes so far (render
  interpolation, rAF frame clock; entries of 2026-10-31) have not cured
  it. Not yet known whether it is a long frame (CPU, garbage collection,
  a remesh) or frame pacing. A regular pause fits a garbage collection
  cycle: the game allocates on every step in places (for example a
  `new THREE.Matrix4` in `breakPart`, and per-step vectors).
- Crawling after both legs are shot off works.
- One blast popped a Foamer. Cause: F01 has 6 health and pops when the
  damage in 0.1 s reaches 0.4 of that (2.4); the placeholder blaster
  fires 3 darts of 1 damage at once, so any close shot that lands all
  three pops it. Paul: the starter blaster unmodified should not have
  that power.
- Body damage on the base Foamer works well.
- Going down: every Foamer falls forward the same way, and the arms hold
  the body up off the floor. Paul wants them to go limp when killed (a
  physics ragdoll) rather than play a canned topple.
- Proposed next: a new test range page with no voxel walls, no thrown
  blocks at the start and no destructible terrain, to see whether the
  stutter follows the Foamers and blasters or the current course, and to
  build out blasters and Foamers.
- Card written: `tasks/ENG-11.md` (Pi). The range page has a frame-time
  graph that splits each hitch into a long frame or a pacing fault and
  marks garbage collections, switches to turn systems off, a benchmark
  that strafes on its own, and a report to paste back.

### 2026-11-01: ENG-10 review (Claude)

Review of Pi's three ENG-10 stages; the fixes are on `eng-10`.

- Broken pieces were drawn in the wrong place (up to 16 m under the
  floor) and their cuboid colliders were offset to match: `breakPart`
  inverted the piece body's transform in the wrong order. Fixed; test 6b
  now spawns off the origin and checks the drawn part sits on its
  collider near the Foamer (it passed at the origin, where the order
  does not matter).
- Breaking a part whose child already broke off (the club, then the
  forearm holding it) threw and stopped the game loop. Fixed; new test 6c.
- Downed F01 lay propped on its club about 1.3 m high: the down pose
  left the weapon rigid. `downMotion` now swings a weapon back along the
  arm (F01 lies about 1 m high). Other rigs' down poses are GAME-10's.
- Sink depth: see the entry below. Pi's 1.2 m/s is back to 0.35.
- Browser (port 5174): F01 walks with the raised club, head and club
  shots break off pieces that fall with foam-core stumps on both sides,
  body shots show foam-core wounds, a single-dart kill topples and
  sinks. No console errors after the fixes.
- 11 Foamers walking at the player on Paul's Mac in the browser pane:
  average frame 8.3 ms, 95th percentile 9.7 ms, worst 10.8 ms (120 Hz
  display, so at refresh); worker remesh of a part chunk about 1.0 ms
  (max 1.1). Not measured on a base Apple Silicon Mac.
- Unverified: a close pump blast popping a Foamer in the browser (test
  14 covers it), crawling with both legs off, and the attacks on screen.
  Old test 8 hit its 5 s timeout once under load; it passed every other
  run.

### 2026-11-01: ENG-10 complete: going down, catastrophic pops, broken piece fixes (Pi, Qwen 3.8-27b)

All three stages of the test Foamer are committed on `eng-10`. What was
built (card "The system"):

- Per part: the rig F01 runs as one root body (movement capsule) plus one
  `FoamerPart` per rig part (own voxel volume, kinematic body and mesh),
  posed each step from `solvePose` with eased motions. A dart hit is
  owned by the part that carved it; the part's hp and the Foamer's
  health fall by the kind's factors, and the wound paints foam-core in
  the hit part only. A part (never the body) breaks when its hp hits 0
  or it has lost wearBreak of its voxels; the stump paints on both
  sides, one dynamic piece falls, the Foamer staggers and loses what
  the part did (legs: speed, arms: attacks, head: turn rate).
- Stage 3: at health 0 the Foamer pops if the damage in the last
  catastrophic.window seconds is at least catastrophic.share of max
  health, otherwise it goes down (state down: stops moving and
  attacking, parts leave `targets` and lose their colliders, the root
  capsule is removed, then it topples over down.topple, lies down.lie,
  sinks at down.sinkSpeed until fully below the floor, and is
  disposed). Losing the head and any arm downs it at any health. Pop is
  unchanged otherwise; its broken pieces are left to sink. Downed
  Foamers count as gone for the spawner; past down.max the oldest
  (not yet sinking) starts sinking at once.
- Stage 2 review fixes: `VolumeMesh.dropColliders()` removes the chunk
  colliders and stops later remeshes from rebuilding them, so a broken
  piece (and a downed Foamer) keeps drawing but darts pass through; a
  piece that starts sinking also disables its own colliders besides
  fixing the body; the piece sink uses brokenParts.sinkTime instead of
  the old 0.35 m/s; breakPart's launch uses the real step dt.

Decisions: the pop-or-down call sits in `handleHit`, on the killing hit:
the recent damage list keeps every hit since spawn (it is tiny: one
entry per hit). A downed Foamer sinks at 0.35 m/s until its lying top
corner is under the floor (about 3 s for F01, which lies about 1 m
high; test 12's budget is topple + lie + 4 s). Pi first read the card as
"sink a further rig height" and raised the speed to 1.2 m/s to fit test
12; review (Claude) fixed the depth instead and kept the approved speed.
`src/foamers/foamer-model.ts` deleted (nothing used it any more).

Old tests that changed, and why: in `foamers.test.ts` old 7, 8 and 8b
fired single darts until the pop, but a single dart kill now downs the
Foamer, so they fire a three-dart burst (a `burst()` helper; the burst
clears the catastrophic share); 8b now includes the suction dart in the
burst (it lands the popping hit). New in `parts.test.ts`: 6b (broken
piece keeps its mesh, part body collider-free), 12 to 15 (card test
12's single-dart kills use closures to dodge TS narrowing); 15 breaks
legR by wear instead of darts, because the fallen legL piece lands on
the dart line. The sandbox's `rig.test.ts` is untouched.

Verified: `npx tsc --noEmit`, `npm test` (14 files, 101 tests, 2 skipped)
and `npm run build`. Unverified (the reviewer checks those): the
browser at port 5174 (walk, wounds and stumps, topple and sink, pop,
stuck darts), and the 10-Foamer frame times and per-part remesh worker
time from the card's done list.

### 2026-10-31: F01 stands on its feet (Claude)

- Found while reviewing ENG-10 stage 1: at rest F01's club was its lowest
  point, so the rig was grounded on the club and its feet hovered 0.11 m
  up (the forearms also reached below the feet). Forearm rest is now
  -1.2 (was -0.5) and the club's -0.9 (was -1.3): F01 carries the club
  raised in front, feet on the floor, club 0.22 m clear. Checked in the
  sandbox. The ENG-10 branch picks this up when it merges main.

### 2026-10-31: Paused game draws 4 frames a second (Claude)

- Paul asked to stop the game rendering in the background: an open tab
  drew full frames behind the pause screen and drained his battery.
- While paused, `src/main.ts` `render` only draws once every
  `render.json` `pausedFrame` (0.25 s). The loop keeps running so input
  (gamepad Start) is still read, meshes that arrive still show, and a
  window resize is redrawn within a quarter second. Playing is unchanged.
- Checked in the browser pane: paused, about one frame in two is drawn
  (the hidden pane throttles rAF, so the exact rate is unmeasured);
  playing, every frame; no console errors. Battery use on a real laptop
  is unmeasured.

### 2026-10-31: Foamers are blocks, smoothing removed (Claude)

- Paul approved the menace pass ("These are excellent") and locked in
  blocks, not smooth.
- The game's Foamers mesh as greedy blocks like everything else. Surface
  nets (ENG-09: `src/voxel/surface-nets.ts`, its tests, the `smooth` flag
  through the worker, pool and VolumeMesh, `render.json` `smooth`) are
  removed; git history has them. The sandbox's Smooth / Blocks button is
  gone and pop chunks are cubes.
- Docs: PLAN 7.4, Q6, ART-03, ENG-09 row and the decisions log; the
  content plan's engine notes (details no longer need to be 3 voxels wide).
- 85 tests pass (the 5 surface-nets tests went with the code).

### 2026-10-31: Foamer menace pass and damage preview (Claude)

- Paul: F11 was janky and should be larger and more ominous; more visible
  weapons and a general menace overhaul; Foamers should not always explode
  when killed: fodder goes down with "foamy gore", explosions only for
  catastrophic damage. He also edited the blaster table and added
  reference photos.
- Rigs (`data/foamer-rigs.json`, 140 parts): every Foamer rebuilt with a
  visible weapon (clubs, launcher arms, a riot shield and blaster, fists,
  turret barrels, a mace), angry or slit eyes, toothless mouths, foam
  spikes, elbows and knees where they help. F11 is now a 3.4 m armoured
  knight with a horned helm, spiked shield, spiked mace and cape. Rig
  shapes gained `cone` and `tube`, plus `taper`, `nubs`, `eyes` styles,
  `mouth` and `tip` (`src/foamers/rig.ts`). New materials: `greybox-dark`
  and `foam-core` (a placeholder core colour).
- Jank: phase changes snapped joints (walk to throw, coil to pounce, the
  F11 combo). `rigMotion` now averages the pose over 0.15 s, and a test
  fails if any joint moves more than 0.35 rad in one 60 Hz frame. F11's
  combo was rewritten so each hit starts where the last ended.
- Sandbox damage preview (`src/sandbox/main.ts`, `burst.ts`): click a
  Foamer with Dart, Heavy or Blast. Wounds carve and show the core colour
  with a fizz; parts with no health left (or 40% of their foam gone) fall
  off with stumps; health out or head plus an arm lost makes it topple,
  fizz and sink away; a killing hit of 40% of max health pops it into
  15 cm chunks. Foamers respawn a few seconds later. The Smooth / Blocks
  button switches chunks too.
- Docs: CONTENT-PLAN 3.2 (death stages and numbers), 3.3 (menace rules,
  per-Foamer weapons), notes on Paul's blaster changes, D12 to D15. PLAN
  section 2 and CLAUDE.md rewritten for menacing looks and foam-only gore;
  the rating target is under review (D13). `design/referenceimages/` is
  gitignored: the photos carry other companies' logos and stay local.
- Unverified: how it reads to Paul; frame rate with several pops at once
  (chunks are capped at 1500 instances); the sandbox rules are a preview,
  not the game's (ENG-10).

### 2026-10-31: Foamer sandbox (Claude)

- Paul asked to see the planned Foamers moving and discuss shape, movement
  and features before limb and weak-point damage (ENG-10).
- `sandbox.html` (live at `/sandbox.html`): every roster role from
  `design/CONTENT-PLAN.md` as a greybox rig, meshed with the game's own
  voxel, smoothing (ENG-09) and foam shader code. Lineup mode shows all 13
  side by side next to a 1.8 m player; Roam mode walks one (or its pack)
  around a loop. Speed slider, pause, smooth or blocks, part labels, and a
  link per Foamer (`sandbox.html#F05`).
- `src/foamers/rig.ts`: parts built from primitive shapes (ellipsoid,
  capsule, box, cylinder, disc), eyes at least 3 voxels wide, a pose
  solver (joint anchors as -1 to 1 points on each box, rest and animated
  rotations, squash, feet grounded automatically). ENG-10 should build on
  this instead of the layout in its card.
- `src/foamers/rig-motion.ts`: 13 movement styles (shuffle, throw, scurry,
  shieldwalk, charge, float, leap, tank, spider, fly, combo, pounce,
  support), procedural and time-based.
- `data/foamer-rigs.json`: the rigs. Greybox shapes only, a new neutral
  `greybox` material (id 9). Names, looks and colours stay Paul's.
- `vite.config.ts` builds both pages.
- Tests: 6 in `tests/foamers/rig.test.ts` (pivots on joints through motion,
  feet on the floor, mirrored parts, eyes, finite motion for every style).
- Next: Paul reviews the sandbox; then update ENG-10 to use the rigs.

### 2026-10-31: Frame pacing fix for the stutter (Claude, Paul's second report)

- Paul: the stutter was unchanged by render interpolation. Firefox,
  worst when walking or strafing, a regular hitch about once a second.
- Cause: the loop measured frames with `performance.now()`, which Firefox
  rounds to about 1 ms. At 60 Hz beside a 60 Hz step, that rounding put
  two steps in one frame and none in the next about once a second
  (replayed: 9 of each in 10 s). Chrome's finer timer hid it, which is why
  the Claude pane was smooth.
- Fix (`src/core/loop.ts`): frames are timed from the rAF timestamp,
  `createFrameClock` learns the refresh interval, snaps it to a common
  display rate within 3% (so 60 and 120 Hz line up with the step and
  never drift) and snaps each frame to a whole number of intervals. A
  60 Hz display now runs exactly one step per frame. 4 tests in
  `tests/core/loop.test.ts` replay Firefox-style rounded timestamps.
  In the Claude pane walking now moves the camera exactly 58.3 mm every
  frame (before: 54 to 64 mm).
- `camera` added to the dev hook (`window.__dart`).
- Unverified: Paul in Firefox.

### 2026-10-31: ENG-09 smoothed meshing for Foamers (Claude)

- `src/voxel/surface-nets.ts`: naive surface nets with relaxation. One
  vertex per cell the surface crosses (mean of its crossing edges), one
  quad per solid/empty voxel edge, then `smooth.iterations` (4, in
  `data/render.json`) passes moving each vertex toward its neighbours'
  mean, clamped to its own cell. Smooth normals from the faces. Colour per
  vertex: the most common material among the cell's surface voxels (so an
  eye beats the lime behind it).
- Why this method: every solid voxel still makes geometry (a blurred
  density field makes one- and two-voxel details vanish), the surface
  never leaves the voxels that made it, so dart hits on the smooth
  collider still match the voxels they carve, and flat faces stay flat.
- Wiring: the mesher worker takes `smooth` per job; `MesherPool.mesh` and
  the `Mesher` interface gained `smooth?`; `VolumeMesh` has a `smooth`
  constructor flag; Foamers pass true. Walls and falling pieces stay
  greedy blocks (PLAN 7.4 allowed either; blocks read better for
  destructible props and cost less).
- Cost: 5.4 ms per Foamer remesh in a worker (greedy: 1.1 ms), 2,448
  triangles. Main thread unchanged apart from the trimesh collider.
- Limits: relaxation does not see across chunk seams, so a smoothed volume
  should fit in one chunk (32 voxels a side; 1.6 m at 0.05 m voxels).
  Painted details need to be about 3 voxels wide to survive smoothing:
  the placeholder Foamer's 1-voxel white eye ring now reads as a thin
  rim. A design note for Paul's Foamers. No voxel AO on smooth meshes
  (the foam shader still applies).
- Tests: 5 in `tests/voxel/surface-nets.test.ts` (closed and outward
  facing, flat faces kept, corners rounded, more passes rounder, colours,
  empty input). Foamer tests now mesh smooth through the fake mesher.
- Browser: smooth blob, eyes visible, dart carves read as soft dents, no
  console errors.

### 2026-10-31: Stutter and exploding foam fixes (Claude, from Paul's play test)

- Paul's play test: a stutter that did not depend on hardware, maybe when
  enemies load in, and foam blocks that sometimes fly off violently.
- Stutter: no CPU hitch at all (8.3 ms frames on a 120 Hz display, no long
  tasks during a pop and respawn, spawn 0.3 ms, pop 1.3 ms). The cause was
  render aliasing: the simulation steps at 60 Hz and only the camera was
  interpolated, so on a 120 Hz display a walking Foamer moved 37 mm, 0,
  37 mm, 0 per frame against a smoothly moving camera. Darts, debris,
  falling pieces, thrown blocks and Foamers now keep their pose from before
  the last step and are drawn `alpha` of the way to the current one
  (`syncRender(alpha)`). Measured after: the Foamer moves 18 mm every
  frame, a dart about 30 cm every frame. Test 3c.
- Exploding foam: a dart's push (impulse 0.6 N s) on a foam chunk of a few
  grams set it moving at 214 m/s, the same speed every time. It showed most
  after a pop, when the dart flies on through the new chunks. The push now
  changes a body's speed by at most `maxPushSpeed` (4 m/s, `data/darts.json`);
  heavy things (thrown blocks) still get the full impulse. Darts test 10.
  Ruled out on the way: chunks spawned inside the floor (no effect without
  the dart) and falling pieces (normal fall speeds).
- Still a known lag, not new: a dart stuck to a walking Foamer is placed
  from the body's pose one step old, so it trails by about 2 cm.
- Unverified: Paul's eye on a 120 Hz and a 60 Hz display.

### 2026-10-30: ENG-07 foam shader and voxel ambient occlusion (Pi, Qwen 3.8-27b)

- Review (Claude): the pore hash was linear in the cell index
  (`fract(127.1x + 311.7y + 74.7z)` on integers is `fract(0.1x + 0.7y +
  0.7z)`), so the pores showed as regular diagonal stripes in the browser.
  Replaced with a scrambling hash (Hoskins style, on the small wrapped cell
  index). Browser after the fix: irregular speckle, no line at the x = 3.2
  m chunk seam, crater corners and the Foamer's steps read darker with AO,
  eyes still white and ink, no shader warnings. Pi's note says PLAN.md got
  decision rows; it had not, so they are added now. Still unverified: fps
  with 10 Foamers (pane hidden) and Paul's view of the look.
- Built `data/render.json` (all the look numbers, exact values from the
card), `src/render/foam-material.ts` (`createFoamMaterial`,
`voxelFoamMaterial`, `patchFoamShader`, a MeshStandardMaterial with an
onBeforeCompile patch; nine uniforms; every foam material shares the one
"foam" program via `customProgramCacheKey`), and 10 new tests (6 mesher,
4 material).
- Mesher changes, as the card lists: `buildPadded` now fills the whole
one-voxel border (the 26 added edge and corner cells are read through
`volume.get`, so AO across chunk seams is correct), and `greedyMesh`
bakes standard voxel corner AO into the vertex colours. The mask is a
Uint16Array: material id in the low byte, the four corner AO values (2
bits each) in the high byte, so a run only merges when material id and
AO match; a flat face (all AO 3) merges exactly as before. When corner
0 and 2 are darker than 1 and 3 the quad splits along the other diagonal;
winding stays outward both ways (the existing winding test pattern,
test 6).
- Where it goes: `VolumeMesh` and `pieces.ts` share
`voxelFoamMaterial()` (vertexColors, 3 pore cells per voxel, wrap 96 =
CHUNK_SIZE * 3, so the pattern is seamless across the 32-voxel chunk
jump); `debris.ts` uses its own foam material for the instanced chunks
(3 cells per unit, no wrap); the thrown foam blocks in `main.ts` use a
foam material per colour (3 cells per voxel / 0.1 m = 30 cells per
metre). Course boxes, floor, blaster, darts: untouched, as specced.
- `mesher.worker.ts` needed no change: `greedyMesh` reads the AO levels
from `data/render.json` by default and the worker passes nothing.
- Decisions: (1) the noise hash wraps per corner call
(`foamCell(i, wrap)`), not once per lattice cell, because the
neighbours `i + 1` across a wrap boundary must hash to the wrapped
cell or the tile shows a seam; a wrap of 0 skips the mod, so the
unwrapped debris and block materials pay nothing. (2) The second pore
octave always passes `wrap * 2` and the tint `wrap / 8`; with wrap 0
both degrade to plain unwrapped noise, matching the single-octave
unwrap. (3) `uTint` scales brightness by `1 + uTint * (n*2 - 1)` as
specified, and the same wobble drives the roughness variation so the
pores and shine move together.
- Remesh cost on this Mac (software renderer, idle machine, interleaved
repeats of a full 2-chunk wall remesh): worker-side per job from the
pool's own timings, about 0.9 to 1.4 ms before, about 1.0 to 17 ms
after, the first two jobs of a burst taking 7.4 to 7.6 ms and the rest
about 1 ms. In the main-thread interleaved bench the full wall went
from about 1.7 ms to about 1.9 ms, roughly 13 percent more; the first
jobs of a burst are slower because of mask growth from the wider key,
and they are the ones a carve actually sends. In the browser the burst
of remesh jobs from live carving stayed under 8 ms on this machine,
which was the ENG-04 budget for the heaviest realistic chunk.
- Frame rate: with 10 hand-spawned Foamers in the scene (headless
Chromium, renderer capped at the 60 Hz refresh, window not visible so
the numbers are software-rasterised and throttled): mean 16.67 ms /
p95 16.7 ms / worst 16.8 ms, essentially the rAF cap; the scene before
ENG-07 reads identically. Not a 60 fps machine measurement, which
remains for QA-01 on the base Apple Silicon Mac.
- A crater in the wall now reads as depth: the carved floor and the
upper inside corners are darker than the rim, the seam darkens all the
way around, and the pores (3 cells per 0.1 m voxel) plus the rim light
break up the flat colour. Before, the same carving was a flat hole in a
flat colour, no depth cue except the shadow. Along the chunk seam at
x = 3.2 m the AO and the wrapped pore lattice are continuous, so there
is no visible line where two wall chunks meet. Paul to confirm the
look and the eye contrast in a real browser (`npm run dev -- --port
5174`); nothing here was tuned by him yet.
- Verified: `npx tsc --noEmit` clean; `npm test` 72/72 (62 existing
unchanged, 10 new); `npm run build` passes; the headless check logged
no console errors or shader warnings on load, in the foam-heavy scene,
and during carving; no em or en dash in any file I wrote (the card's
perl check, plus the new untracked files); nothing fetched off host.
- Unverified in a real browser (needs eyes): how the pores and rim
read at a glance, the Foamer eye contrast after the tint wobble, the
windows-integrated-graphics frame rate, and the real 60 fps measurement
with 10 Foamers on the target laptop.

### 2026-10-30: GAME-03 test Foamer that walks at you and pops (Pi, Qwen 3.8-27b)

- Review (Claude): two bugs fixed before merge. (1) A suction dart that
  landed the popping hit still tried to stick to the removed body and
  Rapier threw `RuntimeError: unreachable`. `stepFlying` now checks
  `world.getRigidBody` after `onHit`; if the body is gone the dart bounces
  and cannot stick again (not even to the pop's foam chunks). Test 8b.
  (2) The mesh was drawn about 0.4 m off its body and turned twice, so it
  faced sideways: `syncRender` applied the corner offset and yaw to both
  the outer group and the mesh group. The outer group now sits on the feet
  centre, unturned (the squash scales about the feet), and only the mesh
  group carries offset and yaw. Test 3b checks drawn voxels against
  `voxelToWorld` for a turned Foamer. Browser: mesh centre matches the
  feet centre, eyes face the player, a suction pop throws no error, 6
  standard hits pop it, respawn works, 10 Foamers update in 0.04 ms per
  step. Still unverified: real fps with 10 Foamers (the pane was hidden
  and throttled) and the pointer-locked play feel.
- Owned files built exactly as the card lists them:
  `data/foamers.json` (numbers + spawner), `src/foamers/foamer-model.ts`
  (`buildTestFoamer`: a rounded lime blob, flat bottom, one chunk, big
  friendly eyes on the +z face, x-mirror-symmetric, looks like a
  placeholder until Paul designs the real Foamer), `src/foamers/foamer.ts`
  (`Foamer`), `src/foamers/foamers.ts` (`FoamerSystem`),
  `tests/foamers/foamers.test.ts` (tests 1 to 8).
- `Foamer`: a kinematic position-based body, its origin at the voxel
  (0,0,0) corner; `centre` (feet centre) and `yaw` are the real state,
  turning about the centre. Movement capsule on the same body, at the
  model's centre in x and z, full model height. One small render group
  per Foamer that carries the mesh group and draws the wind-up squash;
  the body's collider is never squashed. `owns`, `worldToVoxel`,
  `voxelToWorld`, `dispose` as specced.
- `FoamerSystem`: one shared character controller (offset 0.02, auto-step
  0.3 m, snap 0.3 m) with a `nonSolidCollider` that never collides with
  its owner, chasing the player: approach (moving at `speed`), wind-up
  (stops, `windup` s, `onBonk` if the player is within `attackRange +
  0.3` and within 2 m vertically, then `recover` s), approach again.
  Darts: chainer the previous `darts.onHit` (previous first); a hit whose
  collider a live Foamer owns and speed >= `minDamageSpeed` subtracts
  `damage[type]`. At 0, pop: collect all surviving voxels, split into
  `popBursts` equal slices, one `debris.spawn` per slice scaled by
  `popChunkScale` from the centre of the model, remove from `list` and
  `targets`, `dispose` (mesh, collider, body). Spawner: keep `spawner.count`
  alive, start the timer at `respawnDelay` so the first Foamer is
  instant, respawn at the farthest spawn point.
- Allowed edits, all as specced: `data/materials.json` gets foam-white
  (7) and foam-ink (8); `VolumeMesh` gets an optional `body`, a `Mesher`
  instead of `MesherPool`, and `dispose()` (mesh, geometry, collider away;
  later remesh results ignored; the body is not removed); `darts.ts`
  stuck darts on a kinematic body keep the body but leave `coll` null
  (ride the transform, survive a remesh), and `stepStuck` frees a dart
  as a free-falling dart if the body is no longer in the world (Foamer
  popped); `main.ts` wires `voxelTargets` to `DartImpacts`, splits
  `impacts.onCarve` to only islands in the wall (Foamer is never
  island-split), constructs `FoamerSystem` and adds its group, bonk logs
  (player health comes later), `foamers.update(dt, player.eye(1, scratch))`
  before `world.step()`, `foamers.syncRender()` next to `pieces.syncRender()`,
  and `foamers` on `window.__dart`.
- Decisions: (1) the public API is as specced; I added three render
  helpers that main.ts and the system need that sit next to the spec:
  `Foamer.group` (the squash render group), `Foamer.vy` (vertical speed,
  gravity owned by the system), `Foamer.applyPose()` / `Foamer.syncRender()`.
  No change to specified members. (2) extra `darts.ts` change beyond the
  two allowed: in `stepFlying`, capture the hit body (and `isDynamic()`)
  before the `onHit` callback runs. Without this, a dart that pops the
  Foamer it hit (system deletes the body inside `onHit`) then reads
  `hit.collider.parent()` / `rb.isDynamic()`, and Rapier's WASM throws
  `RuntimeError: unreachable` on an already-removed body. Reading the
  parent and the flag first sidesteps it and is behaviourally identical
  for every other body type. (3) the bonk's `onBonk` callback takes the
  Foamer (`onBonk: (foamer: Foamer) => void`); main prints "Bonk" and
  player health comes later.
- Verified: `npx tsc --noEmit` clean; `npm test` 60/60 including the 8
  new (movement, state, bonk timing, damage + carve, pop + debris, ride
  and fall, spawn cap, static-shape count); `npm run build` passes; no
  en-dash or em-dash in any written file (checked the card's `perl -CSD`
  one-liner); nothing pulled from other hosts.
- Not yet verified (needs a real browser on `npm run dev -- --port 5174`
  with Pointer Lock; the headless CDP harness can't focus):
  the walk + squash + "Bonk" flow in the browser, darts carving visible
  chunks and the blow-in rebuild, suction ride and fall in the browser,
  two standard darts popping it, a new one walking in ~3 s, the wall
  still working, and the 10 hand-spawned Foamer 60 fps frame times. A
  headless (swiftshader) baseline sanity sample ran: 12 hand-spawned
  Foamers in scene, 24,864 vertices, rAF mean 17.6 ms / worst 18.9 ms /
  p95 18.5 ms versus a fresh 16.6 ms / 17.9 ms / 17.3 ms baseline with 0
  Foamers, zero console errors. Those are software-rasterised numbers,
  not the integrated-GPU target the card asks for; the measurement on a
  base laptop is still outstanding for the record.

### 2026-10-30: ENG-06 island detection and falling pieces (Pi, Qwen 3.8-27b)

- Built: `src/voxel/islands.ts` (pure `findIslands` flood fill and
  `boxCover`), `src/voxel/pieces.ts` (`FallingPieces` turns loose islands
  into falling rigid bodies with their own voxel meshes), and the 8
  specified test cases (islands tests 1 to 5, pieces tests 6 to 8, with
  test 5 split over two `it` blocks and the hold timeout split out as 7b,
  10 `it` blocks in all).
- How: `findIslands` seeds from the six face neighbours of every removed
  voxel and explores components with an explicit stack headed toward bedrock.
  A component that ends without reaching indestructible voxels (or hits
  `maxSearchVoxels`) is loose. Volumes without bedrock never break apart
  because the search budget alone cuts a fake chain off as anchored. Every
  loose island with at least `minPieceVoxels` voxels becomes a body;
  smaller ones go to `DebrisSystem` instead. Bodies start
  `kinematicPositionBased` in the island's `min` corner and release once
  the source volume remeshes and the piece's own meshes are built. Over
  `maxPieces` the oldest non-fading piece then fades out.
- Decisions: `-y` neighbour first so the search heads down toward bedrock
  and usually finds an anchor in a few dozen steps. The collider local
  translations are the box centre offset by the island's `min` corner, so
  a collider never overlaps the voxels it broke away from, guarded by
  `colliderInset`. The body origin is `voxelToWorld(min)`, so the mesh and
  collider stay in the body's local frame and the group's world transform
  is correct after it starts moving. In `tests/voxel/pieces.test.ts`, the
  floor is one fixed cuboid at y = 0 under the pillar; the piece's own
  origin rests within `colliderInset` of the floor, so its translation y
  assertion is `-0.05` and not `0`. The `__dart` dev hook now exposes
  `pieces` for browser checks.
- Automated browser checks (headless Chromium over the `__dart` hook,
  dev server on 5174): a melee blast through the tower pillar drops one
  island, which lands and rests (no violent throw); a 20-piece load
  settles at live 16 (the cap) at 60 fps headless; 106 rapid fire carves
  at the wall over 2 s keep `stats.searchMs` under 0.4 ms; a standard
  dart hit on the load dropped 3 darts to resting, and a suction dart
  stuck (it aimed at a 22 m piece that passed, so it may have stuck to
  the wall behind). The player stands on a toppled crossbar piece (feet
  settle within 2 cm of its top face, stable for 0.6 s, same sink as on
  the floor). Suction darts sticking to a landed piece and darts
  bouncing off one specifically still need eyes in a real browser window.
- Review and merge (Claude, 2026-10-30): the card's search rule had a bug.
  A fill that stops at bedrock leaves part of its component unvisited, so a
  later seed in that component could run dry and be reported as a false
  island. Pi's fix is right: a fill that meets a voxel an earlier fill
  visited is attached. Claude made that fill stop at once, made the seed
  list a set, and added test 4b (fails without the rule). Verified in the
  browser: a blast through the tower pillar drops a 432-voxel piece that
  topples and sleeps on the floor; suction darts stick to it; 23 pieces cut
  in 1.5 s settle with the cap at 16, 120 fps, worst frame 11.2 ms, search
  at most 0.8 ms. `live` briefly counts fading pieces too (no bodies).
- Unverified: how falling pieces feel with a real mouse.
- Fixed a GAME-02 test flake (impacts test 7 failed about 1 run in 5):
  foam debris from the suction sticks sometimes took the standard dart's
  hit. The test now lets the debris fall clear first; 30 runs pass.

### 2026-10-30: GAME-02 play test (Paul)

- Paul played it: firing, priming, reload and carving all work well.
- Crater size from the placeholder blaster is right. Bigger bites will come
  from other blasters, so carve size needs to move from the dart type
  (`data/darts.json` `carveRadius`) to the blaster, or a blaster multiplier,
  when real blasters arrive (GAME-09).
- Still unverified: gamepad, Windows integrated graphics.

### 2026-10-30: GAME-02 review and merge (Claude)

- Resting darts stood on end: the GAME-01 "lie flat" rotation turned the
  dart's +Z axis to +Y. They now lie flat along their flight heading. Test 6
  checks the axis is horizontal.
- The blaster model was too big and its barrel did not line up with the
  muzzle in `data/blasters.json`. It is drawn at 0.6 scale and placed so the
  barrel tip sits on `muzzle`; darts now leave the barrel.
- Firing with your nose on a wall put the muzzle inside the wall (it is
  0.42 m ahead, the capsule radius is 0.35 m). Those darts hung inside the
  geometry forever and held pool slots. main.ts now pulls the muzzle back
  to just in front of whatever is between the eye and the muzzle, and any
  flying dart older than `lifetime` is freed. Test 9 covers the second part.
- Verified in the browser: against the voxel wall, 2 shots carved and all 6
  darts fell to rest (none left hanging); resting darts' axes are
  horizontal; no console errors. 41 tests pass.
- Tuning note for Paul: craters are small (about 3 to 4 voxels per carve;
  most hits are bounces or slow rehits that only scuff). Raise
  `carveRadius` in `data/darts.json` for bigger bites.
- Unverified: real Pointer Lock and gamepad, Windows integrated graphics,
  how the model looks on a wide screen.

### 2026-10-30: GAME-02 placeholder pump blaster (Pi)

- `data/blasters.json`: all the placeholder numbers, self contained, until
  Paul's first blaster card (PLAN.md section 5) replaces them. One shot of
  `dartsPerShot` (3) darts burns one round.
- `src/weapons/blaster.ts`: `Blaster`. States ready / priming / reloading,
  seeded rng, spread by a uniform cone sample, `onShot` callback, reload
  from `min(magSize-mag, reserve)` rounds, auto-reload on a shot that
  empties the magazine (started once that shot's priming ends, not the
  instant the magazine runs dry).
- `src/weapons/blaster-model.ts`: `BlasterModel`. A toy blaster in code
  (body, barrel, pump sleeve, grip, magazine tube, sight) from boxes and
  cylinders in the three spec colours; child of the camera (main.ts now
  does `scene.add(camera)` for that). Recoil: `kick()` pushes the model
  back `recoilKick` (capped) and tilts it about 4 degrees up, the
  exponential return is `recoilReturn` per second. Pump grip slides back
  and forward once per priming via `progress`; the model dips `sin(pi * t)`
  during a reload. No allocations per frame.
- `src/weapons/impacts.ts`: `DartImpacts`. Subscribes to `darts.onHit`
  (keeping prior handlers), finds the `VoxelTarget` that `owns` the hit
  collider, carves at `hit.point + hit.direction * voxelSize * 0.5` with
  radius `carveRadius * clamp(speed/typeSpeed, 0.3, 1)` metres (in voxel
  units), spawns debris via the same `debris.spawn` call `main` uses for
  the debug blast, and calls `darts.releaseInSphere(hit.point, radius +
  voxelSize)` so darts glued to foam that is now gone fall off.
- `src/weapons/darts.ts` (the two allowed changes): stuck darts in a
  **fixed** body keep `body` and `coll` null, so they survive the chunk
  remesh that replaces its collider (the old behaviour lost them, known
  limit of GAME-01); `releaseInSphere(centre, radius)` turns nearby stuck
  darts into loose falling darts and returns the count.
- `data/darts.json`: `carveRadius` per type (standard 0.12, suction 0.08
  metres), noted in `_note`. Suction darts carve, but weakly.
- `src/ui/hud.ts`: `Hud`. Reuses `#hud`, `#crosshair`, `#ammo` from
  `index.html`; shows `AMMO n / m`, `RELOAD` while reloading, `PRIMING`
  while priming; writes the DOM only on change; follows the pause overlay
  via `show()`. Style in `src/style.css`, no web fonts.
- `src/main.ts`: the GAME-01 auto-fire, `fireCd` and their use-only aim
  scratch vectors are gone. The muzzle is `spec.muzzle` in camera space
  turned to world by `camera.localToWorld`, the aim is 50 metres down the
  view, and `blaster.update` runs before `darts.update`. `KeyT` sets
  `blaster.dartType`. `window.__dart` now also has `blaster` and
  `impacts`. The melee `debugBlast` and the E throw block are unchanged.
- `tests/weapons/blaster.test.ts` (1 to 4) and `tests/weapons/impacts.test.ts`
  (5 to 8), real Rapier world and real voxel volume for the impacts.
- Decisions: (1) test 2 as specified asks for 50 shots, but the weapon
  holds only 48 rounds (mag 8 + reserve 40), and a harder 50 does not
  terminate, so it counts 48 shots, one full magazine plus an auto-reload's
  worth. (2) The stick edit to `darts.ts` matches the card: an already
  stuck dart lends on a fixed collider, and `releaseInSphere` is currently
  the only means to dislodge it. (3) `BlasterModel` does `camera.add`
  itself inside its constructor; main.ts only adds the camera to the
  scene, so the wiring stays in one place.
- Verified: `npx tsc --noEmit` clean; `npm test` 40/40 (32 existing, 8
    new); `npm run build` passes; no em/en dash in the changed files or in
    this entry (checked with the `perl -CSD` one-liner from the card);
    nothing fetched off host, exact npm dependencies only.
- Not verified (this worktree has no browser): that the model looks good
  in the lower right, the pump slide and recoil in motion, the 60 fps
  firing for 20 seconds at the wall, and actual Pointer Lock / gamepad
  fire. The last needs a dev server on 5174 and a real mouse.

### 2026-10-30: GAME-01 dart projectile system

- `src/weapons/darts.ts`: `DartSystem` (pool, flight, collision, sticking,
  rendering). Darts are not Rapier bodies: at full rate up to 310 live darts
  mean 310 thin ray casts per step, which beats 310 rigid bodies. Flight is
  a per-step `vel.y -= 9.81*gravityScale*dt`, drag (`v *= 1-drag*dt`), then a
  `castRayAndGetNormal` sweep from the old to the new position (solid, sensors
  excluded, the firing player's collider excluded via the `ignore` argument).
- `onHit` fires exactly once per impact with the hit point, normal, unit
  flight direction, speed, type and the hit collider. A dynamic body that is
  hit gets `impulse` (N.s) along the flight direction at the hit point via
  `applyImpulseAtPoint`.
- Suction darts stick, tip sunk 0.3 x length into the surface, pointing along
  their flight. If the hit collider belongs to a rigid body, the dart's
  position and rotation are stored in that body's local frame and recomputed
  each step, so darts ride along with falling foam blocks. If the collider is
  removed, the dart un-sticks and falls as a non-sticking dart.
- Standard darts bounce: velocity reflected about the normal, scaled by
  `restitution`. Below 1.5 m/s on a surface with normal.y > 0.7 they become
  resting: they lie flat and stop being simulated.
- Pooling: one `THREE.InstancedMesh` per type, sized 310 (150 + 100 + 60).
  No vectors or meshes allocated after construction, all reusable. Caps are
  enforced by killing the oldest dart in that state; the cap check is a while
  loop so a batch that lands in the same step cannot exceed it. Resting darts
  shrink to zero over 0.3 s after `lifetime` seconds and are freed.
- `src/weapons/dart-model.ts`: dart geometry per type built in code, no model
  files: a cylinder body plus a half-ellipsoid tip, 22% of the length, 25%
  wider, with vertex colours blending body to tip toward the nose. Long axis
  +Z, tip at +Z, origin at the centre. `MeshStandardMaterial` with
  `vertexColors: true, roughness: 0.8`.
- `src/main.ts`: dart type toggles with KeyT (a debug key, not in
  `data/input.json`), with a `console.info` naming the new type. Fire holds
  to auto-fire at that type's `fireInterval`; the muzzle is 0.2 m right and
  0.15 m down from the eye, aimed at a point 50 m along the view, so the
  darts converge on the crosshair. Foam-block throwing moved to E (`use`).
- `src/player/controller.ts`: added a public read-only `get collider()`
  returning the capsule, so the dart system can exclude the shooter.
- `data/darts.json`: dart types and caps. `fireInterval` is new, the minimum
  seconds between shots of that type (auto-fire rate limit).
- `tests/weapons/darts.test.ts`: 7 tests against a real Rapier world. All
  pass. Test 4 found the contact solver shoves a dynamic box that overlaps
  a static collider (in the tests, the player capsule); the test box stands
  off to the side now.
- Verified: `npm test` passes (25 tests, 7 new), `npm run build` passes, no
  extra em/en dashes in the repo (checked with a perl script because macOS
  grep does not support -P), HEAD is a00f537+1.
- Review and merge (Claude, 2026-10-30): stuck darts stored their rotation
  in the wrong order (`quat * inverse(body)` instead of
  `inverse(body) * quat`), so a dart stuck to an already rotated body
  pointed up to 85 degrees off. Fixed, with test 8 (fails without the fix).
  Kept main's public `collider` field instead of Pi's getter. `darts` added
  to the `window.__dart` dev hook.
- Verified in the browser: 1.5 s of standard then 1.5 s of suction auto-fire
  at the voxel wall: 7 suction darts stuck where aimed, 9 standard darts
  came to rest, E throws a block, no console errors, 120 fps (8.4 ms average
  frame, worst 16.6 ms).
- Known limits: a suction dart on the voxel wall falls off when its chunk is
  remeshed, even if its own voxel survives (the chunk collider is replaced).
  Stuck darts never expire, only the cap recycles them. Darts are small at
  5 m; size is a tuning question for Paul's blaster cards.
- Unverified: real Pointer Lock and gamepad fire, Windows integrated
  graphics.

### 2026-10-30: ENG-05 carving and foam debris

- `src/voxel/carve.ts`: `carveSphere(volume, x, y, z, radius)` in voxel
  units. Each material's sphere shrinks to `radius / hardness`; under
  `minEffectiveRadius` (0.5 voxels) nothing is removed, so weak hits only
  scuff hard materials. Indestructible voxels never go. Returns the removed
  voxels with their materials.
- `src/voxel/debris.ts`: `DebrisSystem`, a ring of `debris.max` (150) slots
  drawn as one `InstancedMesh` with per-instance colour. Each carve spawns up
  to 14 chunks, flying outward from the crater. Chunks are Rapier dynamic
  bodies that live 4 s and shrink away in the last 0.3 s; the oldest is
  reused when the ring is full.
- Collision groups (`src/physics/world.ts`): debris only collides with the
  world. Player movement queries use `SOLID_QUERY_GROUPS`, so debris never
  blocks or lifts the player, though the player still shoves it physically.
- `VolumeMesh` gained `worldToVoxel`, `voxelToWorld` and `owns(collider)`.
  `PlayerController.collider` is now public.
- Tuning in `data/destruction.json`.
- Demo: melee is a debug blast (0.35 m radius) until blasters exist
  (GAME-02 wires dart hits to carving instead).
- Verified: 6 new tests (foam crater size, wood carves under a quarter of
  foam, concrete scuffs at low radius, bedrock untouched, debris never over
  the cap with about 390 requested, all bodies freed after the lifetime).
  In the browser: one blast removed 108 foam voxels; same blast removed 141
  cardboard, 36 wood, 0 concrete. 40 blasts in 3 s: 120 fps, worst frame
  13 ms, debris peaked at 145. Walking through floor debris kept the feet at
  0.01 m. Not verified: Windows integrated graphics.
- Known gap: voxels cut off from the ground float in mid-air. That is
  ENG-06.

### 2026-10-30: ENG-04 greedy mesher in a Web Worker pool

- `src/voxel/mesher.ts`: `greedyMesh()` merges same-material faces that
  touch empty space into rectangles. Input is the chunk plus a one-voxel
  border from its six face neighbours (`buildPadded()`, 34^3 bytes), so faces
  on chunk seams are culled correctly. Output: positions (voxel units),
  normals, linear vertex colours, 32-bit indices.
- `src/voxel/mesher.worker.ts` + `mesher-pool.ts`: up to 4 workers
  (cores minus one), job queue, buffers transferred both ways.
- `src/voxel/volume-mesh.ts`: `VolumeMesh` turns a `VoxelVolume` into one
  `THREE.Mesh` and one Rapier trimesh collider per chunk on a fixed body.
  Each chunk has a version number so a slow, stale worker result never
  overwrites a newer one. Call `update()` once per frame.
- `linearColorTable()` in `materials.ts`: palette colours converted from
  sRGB to linear for vertex colours.
- Demo in `main.ts`: striped foam wall 40 x 24 x 4 voxels at 0.1 m, crossing
  a chunk seam, bedrock bottom row, three carved holes. In dev,
  `__dart.carveSphere(x, y, z, r)` carves at runtime (ENG-05 replaces it).
- Measured on Paul's Mac. Single-thread in Node: solid chunk 1.3 ms, carved
  wall 0.7 ms, terrain 0.8 ms, random 30% fill 5.4 ms, 3D checkerboard
  (worst case) 9.1 ms. In browser workers after warm-up: 2.0 ms average,
  5.3 ms max per chunk. First jobs take 8 to 9 ms (JIT warm-up). A burst of
  20 carves in one frame: worst frame 9.4 ms, 120 fps held. Target was
  under 4 ms for realistic chunks: met; noise-like chunks are slower but off
  the main thread.
- Verified: 6 new mesher tests (winding matches normals, box merges to 6
  quads, materials not merged, seam faces hidden, colours, empty input);
  wall renders with no seam; player collides with it (stops 0.37 m from the
  face). Not verified: Windows integrated graphics.
- Fixed: a rejected Pointer Lock fallback request was an uncaught promise
  error (also happens in real Chrome when clicking within a second of Esc).
- Not done yet: ambient occlusion and the foam look (ENG-07), smoothed
  meshing for Foamers (PLAN.md 7.4, needs its own task).

### 2026-10-30: ENG-03 voxel chunk storage and material palette

- `src/voxel/chunk.ts`: `Chunk` (32 x 32 x 32 bytes, index
  `x + z*32 + y*1024`, non-empty count) and `VoxelVolume` (sparse map of
  chunks, any integer voxel coordinate including negatives, per-volume
  `voxelSize` in metres). Empty chunks are freed. Edits mark their chunk
  dirty, plus the neighbour chunk when the voxel sits on an edge, because the
  mesher (ENG-04) needs both sides of a boundary face. `takeDirty()` hands
  the mesher the keys, including keys of freed chunks so their meshes can be
  dropped.
- `src/voxel/materials.ts` + `data/materials.json`: palette of up to 255
  materials with colour, hardness (damage is divided by it) and an
  indestructible flag for anchors. Six foam colours are placeholders until
  Paul picks Foamer colours; also cardboard, plastic, wood, brick, concrete,
  bedrock. Bad ids, duplicate ids and duplicate names throw at load.
- Added Vitest (`npm test`); 12 tests in `tests/voxel/`.
- Verified: tests pass, types check, build passes. Not verified: anything
  visual (no mesher yet) or performance.

### 2026-10-30: ENG-02 first person controller

- `src/player/controller.ts`: capsule (1.8 m, radius 0.35) on Rapier's
  kinematic character controller. Walk 7 m/s, sprint 10.5, jump about 1.2 m,
  dash (Q / LB) 22 m/s for 0.16 s with 0.7 s cooldown, autostep 0.4 m,
  46 degree max slope, coyote time and jump buffering. Pushes foam blocks.
- Mantle: while airborne and pushing forward, a chest-height ray finds a
  wall, a downward ray finds its top, and a capsule test checks there is room.
  Then the player rises and steps over in 0.28 s. Reach is jump height plus
  `mantleMaxHeight` (1.5), so ledges up to about 2.7 m. No mantle from the
  ground without a jump: that is deliberate, but worth a playtest.
- The loop's render hook now gets `alpha`, and the camera interpolates
  between steps, so movement is smooth on 120 Hz screens.
- All tuning in `data/player.json`.
- `main.ts` is now a test course: 0.3 m steps, 1.0 / 2.4 / 3.2 m blocks,
  25 and 55 degree ramps, outer walls. In dev builds `window.__dart.player`
  exposes the controller for automated checks.
- Verified by scripted input in the Browser pane: walk 5.9 m in 1 s (from
  standstill), sprint 8.4 m, dash 4.2 m, jump peak 1.22 m, steps climbed to
  1.2 m, 25 degree ramp climbed, 55 degree ramp refused, 2.4 m ledge mantled,
  3.2 m wall refused, no mantle without a jump. 120 fps in the pane. Not
  verified: how it feels with a real mouse; gamepad.

### 2026-10-30: ENG-01 game loop and input

- `src/core/input.ts`: named actions (move, jump, sprint, dash, fire, shield,
  melee, reload, use, weapon next/prev/1 to 8, pause) from keyboard, mouse
  with Pointer Lock, wheel and a standard-mapping gamepad. Bindings and
  tuning (sensitivity, invert Y, stick deadzone and curve, trigger threshold)
  are in `data/input.json`.
- Timing rule: button edges are latched when they happen and cleared after
  each fixed step (`endStep()`), so a tap shorter than a frame still counts
  and is seen by one step only. Look is read once per render frame
  (`takeLook(dt)`) so aiming is smooth at any frame rate.
- `src/core/loop.ts` now has three hooks: `frame` (input and look), `update`
  (fixed 60 Hz), `render`.
- Default bindings: left mouse fire, right mouse shield, middle mouse or F
  melee, Space jump, Left Shift sprint, Q dash, R reload, E use, P pause.
  Gamepad: RT fire, LT shield, RB melee, LB dash, A jump, LS click sprint,
  Start pause. All placeholders until playtests.
- Verified in the Browser pane with a simulated lock: lock hides the
  overlay, unlock pauses, held W walks, mouse moves the view, instant
  click taps (down and up in the same frame) still throw blocks; the exact
  one-block-per-tap count was not measured. Not verified: real Pointer Lock (the pane refuses
  it; Paul to try on the live site) and gamepad (no pad attached).
- Push-to-deploy confirmed: the push at 16:42 UTC built and deployed.

### 2026-10-30: PRE-09 repo setup

- Vite 8 + TypeScript 7 project, Three.js 0.186.1 and Rapier
  (`@dimforge/rapier3d-compat` 0.21.0) as exact-pinned npm dependencies, so
  everything ships from our own domain.
- `src/core/loop.ts`: fixed 60 Hz simulation step with variable-rate render.
- `src/physics/world.ts`, `src/render/scene.ts`, `src/main.ts`: the falling
  foam blocks test scene (capped at 200 bodies).
- Deploy: `wrangler.jsonc` is a static-assets Worker serving `dist/` at
  dart.contrapaul.com. `public/_headers` caches hashed `/assets/*` forever and
  revalidates the HTML.
- `.gitignore` keeps `reference/` and `audio-raw/` out of the public repo.
- Title on the page is placeholder text until Paul's logo exists.
- Verified: `npm run build` passes; the scene runs with no console errors both
  locally and on https://dart.contrapaul.com. Not verified: frame rate on the
  benchmark Mac (nothing heavy to measure yet), push-to-deploy (not connected).
