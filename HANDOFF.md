# Handoff

Running record of what is built, what was decided, and what the next session
should know. Newest log entry at the top. The plan is `PLAN.md`; the rules are
`CLAUDE.md`.

## Status

Rewritten 2026-11-13. The old section had grown to about 740 lines of
per-task notes, most of them out of date ("not reviewed, not merged" for
work merged since). Every one of them has its own log entry below, and
the old text is in git history.

**Live at dart.contrapaul.com** (main, pushed 2026-11-12, `bbe2a43`):

- The range is the weapon tuning page and plays in Chrome, Edge and
  Firefox (Paul, 2026-11-12). Playtest cards PT-01 to PT-10 are all
  reviewed and merged.
- Keys 1 to 8 select B01 to B08; B04 is plain fast full-auto.
- QA-01 (performance) passed: above 60 fps (Paul, 2026-11-12).
- CI (`.github/workflows/check.yml`) runs build, tests, the text checks
  and the smoke check, and reports only: Cloudflare deploys every push to
  `main` whatever CI says (Paul's decision, PLAN section 14).
- 1012 tests pass, 2 skipped.

**In progress:** nothing. OPS-04 (graphics presets, `?quality=low`,
`medium`, `high`) is merged on local main, not pushed. LVL-06 (the 2-1
concept and the blaster rows) is committed on branch `lvl-06`, not
pushed, waiting on Paul's answers and Claude Opus 5.5's review. MEL-01
(the sword, the hand weapon pickup, hand weapons in the save) is
committed on branch `mel-01`, not pushed, waiting on review; the suite
is 1104 tests, 2 skipped on that branch.

**Waiting on Paul:**

- The voxel go/no-go gate (PLAN section 12).
- More weapon tuning on the range, then level testing.
- If Firefox shows an error again: the `Loop errors:` line from
  `/range?diag`.
- Turn off Cloudflare Web Analytics for the site in the dashboard (its
  beacon was seen once on the live page; nothing in the repo adds it).

**Loose ends:**

- `src/voxel/debris.ts` uses `Math.random` for chunk speeds. Cosmetic:
  debris no longer blocks Foamers or piercing darts.
- Branch `bug-05` is deliberately unmerged (see its 2026-11-06 entry);
  its `tests/ai/pit-rig.ts` change is worth taking on its own.
- Headless Firefox here no longer starts its remote agent since a
  Firefox update, so Firefox checks need Paul's real browser.

## Open items

- [ ] Paul: blaster cards, story outline, Foamer names (PRE-02 to PRE-05).
- [ ] Paul: answer decisions D1 to D15 in `design/CONTENT-PLAN.md` (game
  length, roster, blasters, upgrades), then fill its `[Paul]` cells. P1
  needs 3 blaster cards and 3 Foamers first.

## Gotchas that have already bitten

- **The game-sounds chunk used to be 4.5 MB (1.7 MB gzipped), almost all
  Rapier, because the compat build inlined its WebAssembly as base64.**
  OPS-02 fixed this: the engine is now a separate content-hashed .wasm
  under /assets behind a shim (see Status and the OPS-02 log entry).
  Splitting Three.js and the mesher into their own cached chunks is still
  open.
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
- **A WebGL canvas reads back empty through `drawImage`.** The drawing
  buffer is cleared once the frame is presented, so a canvas probe finds
  one flat colour even when the game drew fine. `tools/smoke.mjs` takes a
  real screenshot and decodes the PNG instead; copy that if you need to
  check the picture again.
- **`grep $'\u2014'` does not survive a YAML file.** The em dash check is
  `tools/check-no-em-dash.mjs` for that reason.
- **A check that has never failed proves nothing.** Every gate added on
  2026-11-12 was made to fail once on purpose before it was trusted.

## Log

### 2026-11-13: ED-03 hazard primitives (Pi, branch ed-03)

- Task: `tasks/ED-03.md`.
- Built `src/level/hazard-rules.ts` and `src/level/hazards.ts`; numbers in `data/hazards.json` (`tickSeconds` 0.25); 10 tests in `tests/level/hazards.test.ts`.
- Decisions: damage is dealt in fixed ticks (`dps * tickSeconds`) so hits land on the HUD; overlapping hazards use the highest dps and the lowest slow; exposure only grows and drains inside, so leaving and returning does not reset the tick; Foamers skip hazards with `hurtsFoamers: false`; hidden hazards are invisible and do nothing until `setShown`.
- `npm run check` green: 1186 tests pass, 2 skipped, build and text/remote checks green.
- Not wired into the arena yet; the reviewer does that. No browser here, so the see-through look, shimmer and depth order are not checked by eye. `primContains` clones its point internally, so that allocation remains per body per frame in `src/level/prim-geometry.ts`, which this card did not touch.

### 2026-11-13: level editor plan drafted (Claude Opus 5.5)

- Paul played Act 1 and wants to build the levels himself, in an editor
  that ships with the game for players too.
- Drafted `design/EDITOR.md`: what can be placed, when/do scripting,
  blockers, keys and doors, hazards, the screen and keys, saving and
  sharing by file, hard caps, the engine limits, and cards ED-00 to ED-10.
- Decision row in PLAN.md section 14; section 9 points at the plan.
- Paul answered the four main questions: files only, when/do lists,
  breakable both ways, shapes box, ramp, wedge, cylinder, stairs.
- ED-00 (the contract, Claude, on main): the level file's new optional
  parts in `src/level/format.ts` (prims with shape and behaviour, hazards,
  placed Foamers, zones, level doors with key locks, when/do triggers,
  sky, start loadout, the `key` pickup), `src/level/prim-geometry.ts` (the
  five shapes' meshes, collider parts and an inside test, tested),
  `src/editor/store.ts` (IndexedDB, not yet tried in a browser),
  `data/hazards.json`, `data/editor.json`. The validator checks every new
  part (`editorParts` in `src/level/validate.ts`, tests in
  `tests/level/editor-validate.test.ts`): one id space for what triggers
  name, every name a trigger uses exists, a key door has its key, an image
  sky is a data: URL, the caps in `data/editor.json`. A level may now be
  prims alone, with an empty shell. The size cap is 512 m, since 1-4 is
  already 304 m long.
- Cards started in parallel: ED-01 game plays them and ED-02 the editor
  page (DeepSeek, two runs), ED-03 hazards (strata), ED-07a the trigger
  runner and keys (qwen-machine).

### 2026-11-13: HP-01 review, merged (Claude Opus 5.5): health on the map

- DeepSeek V4.1 Flash 1017 built the card (after two restarts: Paul's
  early message stopped the first, and the second hit "database is
  locked" because two Pi runs opened their session store at the same
  instant; start parallel Pi runs a few seconds apart).
- Merged together with MEL-01, which touched the same pickup code: both
  new kinds (the health pack and the sword) now sit side by side in
  `src/pickups/pickups.ts`, the level format and the validator.
- Seen in the browser (`?watch`, by script): in 1-2 a player hurt to 40
  walked onto the store's pack and went to 65, the pack gone (3 packs to
  2); in `env-03&campaign` the melee key bashed before the sword pickup
  and swung the combo after it, with the `[Paul]` name flash.
- 1164 tests pass (2 skipped); check and smoke green.
- Not verified: a melee kill dropping health in play (tested headless),
  the packs' look and where they sit by eye, Firefox.

### 2026-11-13: HP-01 health on the map and from melee kills (Pi, DeepSeek V4.1 Flash 1017)

Paul's decision (PLAN section 14, 2026-11-13): "Health should be found in
drops on the map and melee kills". LVL-06 found that a level file could
list a `health` pickup and pass the validator while `loadLevelBoxes` never
built it.

- **Placed health.** `PickupSystem` has a `healthPack` kind with its own
  `data/pickups.json` block (size 0.4, the blob's cream, collectRadius 1,
  turnRate 0.6, bob 0.04 at 2, max 8). A `health` entry in a level file
  builds one: a cream box on the floor, no hop, no lifetime, no drift to
  the player, turning and bobbing like the ammo box. Walked within 1 m it
  heals the entry's own `amount`, capped at the maximum, and is gone; at
  full health (or dead) it stays. A restart's `clear` plus
  `loadLevelBoxes` brings it back. `Pickup.amount` is new in
  `src/level/format.ts`; `src/level/validate.ts` rejects a `health` entry
  without a positive amount.
- **Melee kills.** `Melee` gained `onKill(f, at)`, called from `strike`
  when a hit leaves the Foamer `state === "down"`, and a `killDrop`
  getter. `src/game/game.ts` wires it to
  `pickups.sprayHealth(at, killDrop.count, killDrop.amount)`, so the
  melee never imports the pickups (the blaster pickup's loadout hook
  shape). `sprayHealth` now takes count and amount, and every blob carries
  its own `amount`; the finisher's call passes neither, so its spray is
  unchanged (3 blobs of 10). `data/melee.json` `killDrop` is 2 of 5. A
  dart or a blast kill never reaches `parryDamage`'s down path from
  `strike`, and `strike` skips Foamers already down, so one kill sprays
  once.
- **Placements** (start values, Paul will move them; each is on the floor,
  outside every arena, on the path or a step off it):
  - 1-2: `store-health` at `[4, 0.2, -16.5]` in the breather store by its
    ammo box; `crossroads-health` at `[-6, 0.2, -47]` on the Crossroads
    checkpoint; `breather2-health` at `[-3, 0.2, -80]` in breather 2 by
    its ammo box.
  - 1-3: `breather-health` at `[-2, -3.8, -71]` in the catwalk breather
    after the Pit; `breather2-health` at `[-2.5, -9.8, -152]` in breather
    2 after the hall drop. None in the Pit or the arenas (LEVEL-1-3.md's
    note said no health at all; the card overrides it, and these two are
    the two breathers it named).
  - 1-4: `alcove-health` at `[5, 0.2, -113]` in the mid-hall alcove;
    `lift-health` at `[0, -8.8, -292]` in the corridor before the lift
    exit; `corr6-health` at `[0, -8.8, -248]` in the corridor from the
    Ring to the Yard. Breather 2 stays pickup-free (its own test).
- **Watch.** `dartArena.state().pickups` gained `packs` (the placed packs
  still on the floor), and the watch has a `hurt(amount)` helper so a
  check can walk a hurt player over a pack.
- Tests: 8 in `tests/pickups/pickups.test.ts` (heal and gone, cap at the
  maximum, stays at full and dead, no expiry and no drift, floor and bob
  and turn, restart, no positive amount builds nothing, the cap trims its
  own), 5 in `tests/game/melee.test.ts` (combo kill sprays, once only,
  charged swing, bash, dart kill sprays none and the finisher's numbers
  are unchanged), 4 in `tests/level/validate.test.ts` (amount rules and
  the three files), 9 in the new
  `tests/level/health-pack-placement.test.ts` (the Pit has none, two or
  three per level, floor under each, none in an arena, 1-4's breather 2
  still empty, all three validate). `npm run check` green (1109 tests, 2
  skipped), `npm run smoke` green (4 pages).
- Seen in the real page with a throwaway DevTools probe (not committed):
  each level's packs on the floor (1-2 three, 1-3 two, 1-4 three, the Pit
  none, no page errors), a player hurt to 40 healed to 65 then 90 by the
  store and crossroads packs with each pack gone, and a pack kept at full
  health. **Not seen by eye:** the box's look and its turn and bob in a
  real frame (the probe reads state, not pixels), where each pack sits
  relative to the room's furniture at eye level, and a melee kill in play
  (the spray is tested headless).

### 2026-11-13: MEL-01 review, merged (Claude Opus 5.5): the sword

- DeepSeek V4.1 Flash 1017 built the card in one run (after a restart:
  Paul's early message had stopped the first try before it began).
- Reviewed: the save goes to version 2 with the owned hand weapons, and a
  version 1 save still loads (Act 1 progress kept, no hand weapon).
  Without the sword the melee key is the bash and no charges show; a
  parry or a recharge cannot arm a weapon that was not found.
- Seen in the browser (`/arena?level=env-03&watch`, a swing by script):
  the lime foam blade sweeps across the view mid-swing. The sword is
  drawn only while it swings, as the baton was; the card's "the grip sits
  in the lower right at rest" was read as the rest pose of the swing,
  not a held weapon. Paul's call if he wants it held in view.
- 1138 tests pass (2 skipped); check and smoke green.
- Not verified: a whole Act 1 run with the bash only, Firefox, the guard
  and grip by eye (hidden behind the blaster in the frame taken).

### 2026-11-13: MEL-01, the sword (Pi, DeepSeek V4.1 Flash 1017): not reviewed

Branch `mel-01`, committed, not pushed. M01 is no longer a placeholder
baton: it is a code-built foam sword, the campaign owns hand weapons the
way it owns blasters, and a level can give one away as a pickup.

- **The look.** `buildSword()` in `src/game/meleeView.ts` builds it from
  `data/melee.json` `look`: lime flat blade 0.7 x 0.07 x 0.025 m (a half
  cylinder tip, so no corner has an edge), orange cross guard and pommel,
  purple grip. Every material is roughness 0.95 and metalness 0 (foam).
  The three strokes and the blaster dip are the old ones, re-placed: the
  grip sits lower right at rest and the blade sweeps across the view.
  `look.position`, `look.rest` and `look.dip` are the camera tuning.
- **Owning it.** `data/campaign.json` gains `startMelee: []` and
  `foundMelee: { "2-1": "M01" }`; `src/game/campaign.ts` gains
  `ownedMeleeAt`, `foundMeleeAt`, `CAMPAIGN_START_MELEE`,
  `CAMPAIGN_FOUND_MELEE`, `MELEE_IDS_KNOWN`, `CampaignState.melee` and
  `LiveCarry.melee`/`setOwnedMelee`. The save is version 2. A version 1
  save loads with `melee: []` and keeps its level, blasters and health.
  `Melee.armed` (with `setArmed`) makes the key the bash while nothing is
  owned: no charge is spent and no parry or timer arms it.
- **The pickup.** A level entry `{ "id": ..., "type": "melee",
  "melee": "M01", "pos": [x, y, z] }` shows the same `buildSword()` at
  world size, turning and bobbing like the blaster pickup, taken within
  1 m. Taking it arms the melee (full charges) and flashes its `[Paul]`
  name through the existing `hud.blasterFlash`. The validator wants the
  id to exist in `data/melee.json`; a pickup of a weapon the melee does
  not hold is left on the floor.

How to see it:

- Sword at rest and in the swing: `arena.html?level=env-03` and press F.
  The first press swings, so the whole three-stroke combo shows over
  about a second; the blaster dips out of the way each time.
- The pickup: `arena.html?level=env-03` again. The sword stands 2 m left
  of the player start (the player faces +z from `[0, 0, 6]`, the sword is
  at `[-2, 0, 4]`). Walk into it, the name flashes over the ammo counter,
  and F now swings the combo rather than bashing.
- The campaign rule needs a level past 2-1, which does not exist yet, so
  the no-sword case is only covered by tests (`melee-sword.test.ts`).

Seen by eye: frames from headless Chrome over the built `dist/`
(`arena.html?level=env-03`, a throwaway probe in `/tmp`, not committed).
The rest frame has no sword in view; mid-swing the whole lime blade, the
orange guard and the pommel read against the grey room, with the blaster
dipped; the pickup stands on the floor as a small sword turning, and
walking into it flashes `[Paul]` over the ammo counter and the pickup is
gone. No page errors.

Not verified, and questions for the reviewer or Paul:

- Should the sword be held at rest, the way the blaster is? Today it
  shows only during a swing (the baton's behaviour, kept). The card's
  "the grip sits in the lower right at rest" is met by the hand's rest
  placement, but it could also mean "visible in the hand between swings",
  which would need the blaster lowered while it is up. Not changed without
  an answer.
- Is the blade big enough on screen? It crosses the lower half of the view
  at the swing's start.
- Do the colours hold against the level's grey? Lime on grey reads; orange
  and purple are small.
- Does the pickup read as a sword rather than a stick on the floor? It is
  about 0.95 m tall standing on its pommel.
- The three strokes are the baton's; a sword may want a different third
  (the overhead chop currently runs off the bottom of the view).

Tuning is all in `data/melee.json` `look` (`position`, `rest`, part sizes
and colours, `dip`) plus `STROKES` in `src/game/meleeView.ts`.

Files touched outside the card: `src/arena/extras.ts` (the page's
`LiveCarry` needs `melee`/`setOwnedMelee`, or a restart would not put the
entry hand weapons back), and `tests/game/campaign-save.test.ts` (the
new state literals need `melee`, and the "older version" case now uses a
version nobody wrote, since version 1 loads). `tasks/MEL-01.md` is
already committed, so the commit carries only the code and the docs.

### 2026-11-13: ENV-05 review, merged (Claude Opus 5.5): the leaking barrel

- DeepSeek V4.1 Flash 1017 built the card in one run, first try. The
  fuse rules match Paul's ask exactly (`src/level/barrel-fuse.ts`, 10
  tests). One file outside the card, with its reason: `DebrisSystem`
  gained `sprayCube` so the spray can use a seeded PRNG.
- Seen in the browser (range, Chromium, shots fired by script): one B04
  standard dart punctured a barrel, it leaked and went off 10 s later;
  from 4 m the leak jets small orange foam cubes out of the hole and they
  pool on the floor beside the barrel. The barrel reads as a toy (orange
  with a yellow band and a white lid).
- The dev-only `window.__range` handle now has `barrels`.
- 1116 tests pass (2 skipped); check and smoke green.
- For Paul: the jet is gentle (2 m/s, rising to 4.5 m/s near the end); if
  it should spurt harder or read from further away, raise
  `data/barrel.json` `spray` `speedStart`, `speedEnd` or `cubeSizeMetres`.
  The barrel's orange and yellow are the colours ENV-01's review kept for
  weak points and darts; a barrel being a "shoot this" target fits that,
  but it is Paul's call.
- Not verified: Firefox, the chain of two barrels, and the blast at the
  end of the fuse seen by eye.

### 2026-11-13: ENV-05 (E15) the leaking foam barrel, on the range

Built on branch `env-05`, not reviewed, not pushed. Card `tasks/ENV-05.md`.

**What was asked.** Paul: a barrel on the range that sprays cubes out of
punctures "as if it's leaking fuel", a standard dart sets a 10 s fuse, a
second cuts it in half, a third sets it off (so B01 Dartman's three dart
cluster does it), all other ammo sets it off at once. Built as a reusable
element for explosive terrain (FX-01) later.

**What was built.**

- `src/level/barrel-fuse.ts`: the rules with no world in them. `startFuse`,
  `puncture` (1st gives `fuseSeconds`, 2nd halves what is left, 3rd sets
  off), `advance` (never fires twice), `classifyHit` (the data's
  `punctureType` is the only round that punctures), `blastReaches`, and the
  constants `FUSE_SECONDS` and `CHAIN_DELAY`.
- `src/level/barrels.ts`: the system. One `THREE.Group` and one fixed
  cylinder collider per barrel, a leak per puncture (its own seeded
  `makeRng` stream, a narrow cone around the hit normal, faster as the
  fuse runs down), the spray through `DebrisSystem` so its ring is the
  hard cap, one `explosion.explode(centre, "barrel")` when it goes, then
  the barrel leaves the world. A blast that reaches a barrel sets it off
  a `chainDelay` later, so a row ripples.
- `data/barrel.json` (fuse, chain delay, the look, the spray numbers),
  a `barrel` profile in `data/explosion.json` (carveRadius 1.2,
  damageCentre 30, rangeMetres 4.5, fxRadius 3.6, the rest like
  `launcher`), two barrels in `data/range.json`.
- `src/range/main.ts`: builds the barrels, chains `barrels.hit` after the
  existing `darts.onHit` (so the impacts and the Foamers see the hit
  first), calls `barrels.onBlast` from the page's `explosion.onExplode`,
  steps `barrels.update` with the other systems, and `T` (or the menu's
  Respawn) puts the barrels back with the line.
- `design/levels/ENVIRONMENT.md`: an E15 entry. `PLAN.md`: an ENV-05 row
  after ENV-04.

**Checks.** `npm run check` green and `npm run smoke` green (4 pages,
`/range` drawn). New tests, 29 in three files: `tests/level/barrel-fuse.test.ts`
(10), `tests/level/barrels.test.ts` (15), `tests/level/range-barrels.test.ts`
(4).

**How to try it.** `npm run dev`, open `/range.html`. Two barrels: one to
your right in the open, one to the left and nearer than the Foamer line.
Hit one with a standard dart (B04 and B01's default round are standard):
the fuse starts and a jet of cubes comes out of the puncture, quickening
as the time runs out, and it goes off after 10 s. Hit it again to halve
it, a third time (or B01's three dart cluster in one shot) to set it off.
A mega, ball or precision dart, or a launcher round's blast, sets it off
at once. Shoot the left barrel from near the line to watch a chain.

**Decisions and why.**

- One file outside the card's list: `src/voxel/debris.ts` gained a public
  `sprayCube(at, vel, size, mat)` that calls the existing private `add`.
  The card asks for seeded spray through `DebrisSystem`, and its only
  entry points used `Math.random`, so there was no way to do it without
  touching that file.
- `makeRng` stays in `src/audio/synth.ts` and is imported, as
  `src/foamers/foamers.ts` already does. Moving it would have touched
  unrelated files for no gain.
- The chain is aged from the state at the start of the step, so a blast
  that lands in a step waits its own delay instead of going off at once
  inside the same walk. That is what makes a row ripple rather than pop
  together (a test covers it).
- The blast is the shared `ExplosionSystem`, so the range's existing rules
  hold: Foamers take it, the player does not, the per-second cap applies.

**Not verified.** No browser here, so nothing was seen by eye: the look of
the barrel, the read of the spray (the part Paul said he would judge), or
whether the barrel's collider is solid under a walked-into player. The
smoke check loaded `/range` and found the page drawn, and the unit tests
build the real system in Rapier, but nobody has watched a barrel leak.

**Question for the reviewer.** The card asks for an orange body with a
yellow band. ENV-01's review reserved orange (weak point) and yellow (the
player's darts) for those meanings. Followed the card, but say if the
barrel should move to another pair of palette colours.


### 2026-11-13: B05 makes a dent; every blaster's own impact range now works (Claude Opus 5.5)

- Paul: B05's impact is extremely weak; it kills but hardly makes a dent,
  and it should blow the head off a weaker Foamer easily.
- Cause, found in the browser: each dart keeps its own copy of its shot
  (GAME-09b), and that copy dropped the shot's `impact` block. So no
  blaster's own impact range was ever used in play: every kill read the
  shared one (full within 2 m, nothing past 10 m). B05 kills at range
  scored near 0 and just went down. This also hit B03's point blank block
  from PT-03, which only the pure tests ever used. Fixed in
  `src/weapons/darts.ts`; test in `tests/weapons/darts.test.ts`.
- B05 now has its own block: no fall off to 60 m, and a `floor` 0.8 (a new
  optional field of an impact block): every Shrike kill is at least a
  chunk, the hole carved where the dart hit. A big overkill still pops.
  The precision dart's own dent (`carveRadius`) went from 0.07 to 0.14.
  Tests in `tests/foamers/impact.test.ts`.
- Seen in the browser (range, Chromium, shots fired by script at 15 m):
  a B05 head shot on an F02 chunked it and took the whole head (0 of 560
  voxels left); a body shot on an F01 carved a hole out of the body.
- Paul should know: B03's close-range kills now use its own point blank
  range as PT-03 meant, so they chunk and pop more than he has seen.
- 1087 tests pass (2 skipped); check green.
- Also running, each in its own worktree: HP-01 (health pickups), MEL-01
  (the sword), ENV-05 (the leaking barrel).

### 2026-11-13: LVL-05 review, merged (Claude Opus 5.5): the campaign

- DeepSeek V4.1 Flash 1017 built both stages, one run each, first try.
  Stage 2 also found and fixed the flaky test seen earlier today
  (`tests/range/ttk.test.ts`, B01's random spread, about 1 in 30 runs:
  now a fixed seed).
- Review fixes: a mod station would fit a mod to a blaster the campaign
  has not found (it now says the blaster is needed; test in
  `tests/arena/stations.test.ts`); New game and Continue did nothing
  until the test course behind the title had booted (now wired first).
- Paul's answers on 2-1 came in during the review. One changes this
  card: health is full again when the next level starts a new act
  (`healthInto`, tested). The rest are in PLAN section 14.
- Played in the browser (Chromium, the dev server): the title with no
  save shows New game only; New game opens the Pit in campaign mode with
  B02 alone and full health and writes the save; walking onto the B01
  pickup takes it, switches to it (8 + 40) and flashes "The Dartman";
  the arena cleared and the real exit pad reached with 37 health and B01
  at 3 + 21 shows the panel (name `[Paul]`, the time, Next level, Main
  menu); Next level opens 1-2 with 37 health, B01 at 3 + 21, and B01 and
  B02 owned; the title then shows Continue. The Foamers were removed by
  script, not fought.
- `tools/lvl05-probe.mjs` (DeepSeek's headless check of the campaign) is
  kept: it is the only scripted check of the whole flow.
- Not verified: a real fight to an exit, levels 1-2 to 1-4 played
  through, Firefox, Esc and Enter on the panel by hand.

### 2026-11-13: LVL-05 stage 2, carry-over, the end screen and the save

Built on branch `lvl-05` in its own worktree, on top of stage 1. Not
pushed. Stage 2 is the whole card: what carries, the save, the end
screen and the main menu.

How to play the campaign: open `/` and press **New game**. It clears the
save and starts `1-1-pit` as `/arena.html?level=1-1-pit&campaign`.
Finish the level's exit and the panel shows the level's name, the time,
and **Next level** / **Main menu** (Enter and Esc do the same). Continue
appears on `/` when a save exists and starts the level the save names.
A restart or a death inside a level puts back the state the level began
with, not a fresh loadout.

- `src/game/campaign.ts` grew the carry and the save, still pure:
  `newGame`, `entryState`, `carryTo`, `captureState`, `applyState`,
  `readSave`, `writeSave`, `clearSave`, `filledBlaster`, `formatTime`,
  `campaignUrl`, `firstLevel`, plus `SAVE_KEY` `dart.save.v1` and
  `SAVE_VERSION` 1. `applyState` needs a `LiveCarry`: blasters, health,
  and optionally `setOwned`. Every storage call is in try/catch, and a
  missing, broken, old-version, unknown-level or nonsense save is a new
  game.
- `Loadout.setOwned(ids)`: the restart's owned set, so a blaster found
  during an attempt that ended in a death is not owned by the retry. The
  active blaster falls back to an owned one at once (no switch).
- `src/arena/extras.ts`: campaign mode applies the entry state at the
  level start (and writes it), and `respawnAtEntry` restores it rather
  than refilling. `showComplete` fills `#completeName`, `#completeTime`,
  shows **Next level** or the act's end, hides Play again, and writes
  the carried state. After the last level the save goes back to the
  entry state. A level clock runs while the level plays and stops at the
  exit.
- `arena.html` / `arena.css`: the panel's name, time, act's end and the
  two buttons, in a `.choices` row.
- `index.html` / `src/style.css` / new `src/game/title.ts`: **New game**
  and **Continue** (hidden unless a save exists) above Settings. The
  test course below is unchanged.

Two bugs the browser probe caught that the unit tests could not, both
fixed:

1. The carry mapped every blaster, so the campaign would have owned all
   eight after its first level. It now filters to the owned set.
2. The restore's `LiveCarry` held plain copies of mag and reserve, so
   `applyState` wrote to throwaway objects: health came through (a real
   object) but ammo stayed at full. They are accessors onto the real
   blaster now, and the entry state is applied to every blaster so a
   carried blaster's ammo is restored before the owned set trims it.

`npm run check` green (1082 tests, 2 skipped) and `npm run smoke` green
(4 pages). New tests: `tests/game/campaign-save.test.ts` (21),
`tests/game/title-menu.test.ts` (4), three more for the campaign panel's
ids in `tests/game/pages.test.ts`, and three for `setOwned` in
`tests/weapons/loadout.test.ts`. Stage 1 was 1044 tests, this is 1082
(2 skipped in both).

Seen by eye, headless Chromium, `tools/lvl05-probe.mjs` (29 checks, kept
in the repo as a throwaway probe): a fresh campaign starts 1-1-pit with
full health and the B02 alone and writes that save; a planted save of
37 health with B01 3/17 and B04 12/50 starts 1-3 with exactly those and
with the B03 still not owned; Enter on the panel goes to
`/arena.html?level=1-4&campaign`, Enter on 1-4 goes nowhere, Esc goes to
`/`; New game from `/` reaches `1-1-pit` in campaign mode and the title
shows Continue when a save exists.

Not seen by eye: actually playing a level to its exit (the probe opens
the panel and dispatches the keys, it does not fight through to the
exit pad), so the panel's real appearance, the clock's reading and the
save written by a real finish are untested in a browser; the two
versions of the end screen's look; carrying from 1-1 into 1-2 by
playing; and Continue after a mid-level abandon (the save is written at
the level start, so it names that level).

### 2026-11-13: LVL-05 stage 1, owned blasters and blaster pickups

Built on branch `lvl-05` in its own worktree. Stage 1 only: owned
blasters and the blaster pickups. Carry-over, the end screen, the save
and the main menu are stage 2, not started. Not pushed.
- `data/campaign.json`: `order` (`1-1-pit`, `1-2`, `1-3`, `1-4`),
  `startBlasters` (`["B02"]`) and `found`, all seven of Paul's blasters
  (B01 in 1-1, B04 in 1-2, B03 in 1-3, B05 in 1-4, B06 2-1, B07 2-3,
  B08 3-1). Paul's rules, PLAN.md section 14.
- `src/game/campaign.ts`, pure and headless: `campaignMode(search)`,
  `ownedAt(levelId)`, `foundAt`, `nextLevel`, `levelIndex`.
- `src/weapons/loadout.ts`: an owned set on top of the eight always-built
  blasters. `own`/`owns`, `select` refuses an unowned one, `next`/`prev`
  skip them, the first owned one is active. With nothing passed the
  loadout owns all eight, so the range and the test pages are unchanged.
- `arena.html?level=1-2&campaign` is campaign mode; without `&campaign`
  the page owns all eight exactly as before.
- A `blaster` pickup kind (`data/pickups.json`, `src/pickups/pickups.ts`):
  the blaster's own model at world size, turning and bobbing like the
  ammo box, taken within 1 m. Taking it owns it, switches to it, fills the
  magazine and gives `reserveStart`, plays the ammo box's pickup sound and
  flashes its name above the ammo counter on the HUD. In test mode it only
  tops up ammo.

Where each pickup was put (start values, Paul will move them; each one is
on the level's centre line, dead ahead of the player at the start, on the
floor and lit):

- 1-1 Pit, the B01 Dartman: `[0, 4.0, -25.5]`, on the start room's floor
  3.5 m straight ahead of the player (`playerStart` `[0, 4, -29]`).
- 1-2, the B04: `[-4, 0, 57.5]`, 2.5 m ahead of the start.
- 1-3, the B03: `[0, 0, -7]`, 4 m ahead of the start in the open bay,
  between the two white dummies.
- 1-4, the B05: `[0, 0, -7]`, 4 m ahead of the start in the forecourt.

`npm run check` green (1044 tests, 2 skipped) and `npm run smoke` green
(4 pages). New tests: `tests/game/campaign.test.ts`,
`tests/game/blaster-pickup.test.ts`, `tests/game/level-pickup.test.ts`,
and the owned-set cases in `tests/weapons/loadout.test.ts`.

Seen by eye (headless Chromium, `?level=<id>&campaign`, scripted walk):
all four pickups show the right blaster in the right spot, walking over
one takes it, the first blaster is B02 with no B01 in hand, and after
the Pit pickup the HUD reads "The Dartman" over `AMMO 8 / 40`. Not seen
by eye: a real playthrough past the first arena in any level, the pickup
coasting over uneven ground, and how the pickup reads in a fight. Stage 2
(carry-over, the end screen, the save, the main menu) is not started.

### 2026-11-13: LVL-06, level 2-1 concept and the blaster rows (Pi, DeepSeek V4.1 Flash 1017)

- Wrote `design/levels/LEVEL-2-1.md`, a full concept in the shape of
  LEVEL-1-4.md: header table, what it teaches and how the space does it,
  10 beats totalling 18 min, map, three arenas and a gantry set piece
  with waves and a sketch each, three secrets, stations and pickups, notes
  for review and open questions. Design only: no code, no data, no tests.
- Built on the ACTS-2-3 short concept (workshop floor, 3 m gantry, F04
  Blockers, flanking) and replaced its B04 line with B06 The Standard, per
  Paul's campaign rules (PLAN section 14, 2026-11-13). B06 is found in the
  Open beat, 30 m before Arena 1, with four dummies to try it on.
- Decision: B06 is never the key to a door. A flanked Blocker dies to four
  mega darts (3 damage each, 10 health), but a B04 burst into its back also
  kills it, so the level teaches the flank and rewards it rather than
  gating on the blaster.
- Decision: three spaces, three ways round the wall. The hall gives the
  over (a 6 x 18 m deck above the line), the ring gives the round (6 m
  corridor, so the shield charge's 1.2 s stagger is the answer), the bowl
  gives height and a drop behind. Health is in the finishers, so there are
  no level-placed health pickups, as in 1-3.
- Decision: the set piece is the gantry drop, one 6 m drop into a conveyor
  well, not a second deck. One deck in the level keeps the flank lesson
  from repeating, and the drop teaches that the level goes down as well as
  along, which the bowl then uses.
- Noted in the doc as a balance risk, not changed: B03 point blank can
  out-shoot the shield. Both barrels landing at 3 m is 88 damage, and the
  shield's 0.05 share still leaves 4.4 off a Blocker's 10. Keeping it is a
  playtest call (walking into a wall at 1.4 m means bashes).
- Found by checking the code, and written into the doc: height does not
  beat a shield. `plateFaces` in `src/foamers/armour.ts` judges the arc on
  the ground plane, so a dart fired down onto a Blocker's shield from the
  gantry is still inside the 120 degree arc. The gantry and the bowl work
  as position, never as angle.
- Found by checking the data: the short concept's "12 m wide arc" of three
  Blockers cannot happen. `slots.spacingMetres` is 1.2, so three Blockers
  make a 3.6 m wall (body 0.6 m, gap 0.6 m, player diameter 0.7 m, so the
  line cannot be squeezed either). The concept says 3.6 m and notes the
  mismatch.
- Found by checking the pickups code: a `health` pickup type is in
  `src/level/format.ts` and passes the validator, but
  `src/pickups/pickups.ts` only spawns `darts-*` entries, so a placed
  health box would never appear. Noted in the doc; not fixed here (a code
  change is outside this card).
- Blaster rows updated to Paul's rule (player starts with B02; B01 in 1,
  B04 in 2, B03 in 3, B05 in 4, B06 in 5, B07 in 7, B08 in 9; none in 6
  and 8 by design): `LEVEL-1-1.md` to `LEVEL-1-4.md` row only, and every
  level in `ACTS-2-3.md` including Boss 2 and Boss 3. "none, by design"
  is used for levels 6, 8, 10, 11, 12 and the bosses.
- Also fixed in ACTS-2-3.md, because the row change made them wrong: the
  2-1 paragraph's "carved away by the auto blaster" (a front mega dart is
  0.05 of 3, so it does not carve through), its 12 m arc (now 3.6 m), and
  3-1's "60-round mag" (the 60 mag is B06's, in 2-1; B08 is 120).
- Not touched, and left for Paul: `design/levels/LEVEL-1-2.md:15-18` still
  says "swap the B02 row to B04 if Paul wants D04's order", which is now
  simply the rule; `LEVEL-1-3.md` section 8 still argues for no blaster
  there while its header now says B03; the beat tables in LEVEL-1-2 and
  LEVEL-1-4 still pick up B02 and B03 in the Open beat. The card says keep
  the rest of those docs as they are.
- Checks: `npm run check` (build, tests, both text checks) green, 1017
  tests pass and 2 skipped; `npm run smoke` green. Not seen in a browser:
  nothing to see, this is a doc.

**Open questions for Paul (also in LEVEL-2-1.md section 8):** the setting
(workshop, school hall with a stage, or toy store aisle), whether the
conveyor or gantry actually moves (E07, a large piece of work), whether
melee weapon 1 is found in 2-1, whether B06's `rate` or `explosive` mod is
granted here at a station, whether the last arena closes on a promoted
pair, and whether 2-1 starts on the health the player carried.

### 2026-11-13: FX-01 review, merged (Claude Opus 5.5): the blast

- strata-dsv41 built the card in one run, first try. The code was right:
  seconds from the render hook, frozen while paused, a fixed pool of 12,
  no allocation per blast, no lights or shadows, and every explosion
  goes through it (B07, its cluster mod, the B05 and B06 explosive mods).
- Seen in the browser (range, Chromium, blasts fired by hand through the
  dev handle): the blast showed and scaled, but the puff was a flat
  sphere with a hard edge, like a glass dome over the Foamers. Fix: each
  layer fades towards its outline (`softEdge` per layer in
  `data/explosion.json` `fx`, flash 1.5, puff 2; a small shader edit in
  `src/render/blast-fx.ts`, the same draw calls and one shared program
  per layer). It now reads as a soft glowing burst at both the launcher
  and the dart size.
- The dev-only `window.__range` handle now also has `explosion` and
  `blastFx`, so a blast can be fired by hand for review.
- 1017 tests pass (2 skipped); check and smoke green.
- Not verified: Firefox, a fight at full speed with many blasts at once
  (the pool is 12), and the frame cost on low-end hardware. Paul to
  judge the look: B07 (and its cluster mod) on the range, B06's
  explosive mod. Colours, times, sizes and softness are all in
  `data/explosion.json` `fx` and each profile's `fxRadius`.

### 2026-11-13: FX-01, visible blast (Pi): pooled effect for every explosion

- Built `src/render/blast-fx.ts` and `src/render/blast-curve.ts`: one pool of `fx.maxLive` (12) slots, shared sphere geometry and one material per layer per slot, no lights or shadows. `spawn(point, radius)` shows a core flash and foam puff. The flash and puff grow and fade from the `fx` block in `data/explosion.json`; when the pool is full the oldest live slot is reused. `update(dt)` advances ages from the page render hook and freezes when paused.
- `data/explosion.json` gained `fx` and `fxRadius` per profile: dart 1.76 m, launcher 2.8 m, cluster 1.44 m. `ExplosionSystem.onExplode` now takes the radius. `game.ts` keeps `FX-explode` and spawns the blast; `range/main.ts` spawns it too.
- Tests: `tests/render/blast-curve.test.ts` (3) and `tests/render/blast-fx.test.ts` (2) prove the curve, the pool cap and oldest reuse, and no new children or materials after many spawns. 1017 tests pass, 2 skipped; check and smoke green.
- Paul should look at B07 on the range, B06's explosive mod and B07's cluster mod. Nothing was seen by eye: the smoke check proves the pages render but not the blast's look, so Paul and the reviewer judge the flash, puff, colours and timing.

### 2026-11-13: B08 balls red and half size; B06 and B08 spread halved (Claude Opus 5.5)

- Paul: OPS-04 is "great for lower end hardware". Then: B08's balls red
  and 50% smaller; B08 and B06 spread down 50%; a new explosion effect
  (card FX-01, strata on dgx-spark, branch `fx-01`).
- `data/darts.json` `ball`: radius 0.06 to 0.03 and length to match,
  colour `#e8332a` (the mega dart's red). The radius is also the ball's
  hit size, so it is a smaller target as well as a smaller sight.
- `data/blasters.json`: spread halved for B06 (spreadDeg 1.5 to 0.75,
  recoil spreadPerShot 0.5 to 0.25, spreadMax 7 to 3.5) and B08
  (spreadDeg 2.5 to 1.25, 0.9 to 0.45, 14 to 7; the control mod 0.2 to
  0.1 and 6 to 3, so it still halves the bare blaster's bloom). Recoil
  climb (the view kick) is unchanged: Paul asked for spread.
- One test failed once in the first full run, with strata's run on the
  same machine, then passed six runs in a row; its name was cut from the
  output. Not identified yet: every later run saves its full output.

### 2026-11-13: OPS-04 review, merged (Claude Opus 5.5): quality presets

- strata-dsv41 (DeepSeek V4.1 Flash quant on dgx-spark, via Pi) built
  the card in one run, first try. The code matched the card; no bugs
  found.
- One fix: the "high equals today" test compared high with numbers it
  wrote itself; it now also checks high's caps against
  `destruction.json` (`debris.max`, `islands.maxPieces`), so the two
  cannot drift apart.
- Seen in the browser (Chromium, 1x screen): `/range?quality=low&diag`
  boots, the diag line reads `Quality: low (...)` and the range's
  shadow switch starts off; `/arena?quality=medium&diag` boots with
  `Quality: medium`. 1012 tests pass (2 skipped); check and smoke green.
- Not verified: a 2x screen (where the pixel ratio cap matters most),
  Firefox, and whether low is fast enough on an older machine. That is
  Paul's measurement: `/range?quality=low&bench` against
  `/range?bench`.

### 2026-11-13: HANDOFF Status rewritten; OPS-04 card written (Claude Opus 5.5)

- Paul picked OPS-04 (graphics presets) for strata on dgx-spark and the
  HANDOFF tidy for Claude.
- The Status section is now a short summary of what is live, what is in
  progress, what waits on Paul and the loose ends. The old 740 lines
  were per-task notes, many stale; checked that each of the 57 task ids
  in them has its own log entry before removing them.
- `tasks/OPS-04.md`: three presets in `data/render.json` picked with
  `?quality=low|medium|high`, high exactly today's picture. Foamer count
  is left out on purpose: fewer Foamers in a level changes the fight,
  not only the picture, so that is Paul's call.
### 2026-11-13: three quality presets (Pi, ops-04)

- Task OPS-04: older machines need a cheaper picture. `data/render.json`
  now has `quality` with `default` high and presets low, medium, high.
  `high` keeps today's values (pixel ratio 2, antialias on, shadows on,
  shadow map 2048, debris 150, break-off pieces 16). Suggested low is 1,
  no antialias, no shadows, 512, 60, 8; medium is 1.5, antialias and
  shadows on, 1024, 100, 12.
- `src/render/quality.ts` has the pure `pickQuality(search, data)` and one
  `QUALITY` resolved from `location.search`. `createRenderer` takes the
  preset, caps the pixel ratio, turns antialias and shadows off when the
  preset says so, and caps a level's own shadow map. `DebrisSystem` and
  `FallingPieces` take their caps from the preset; tests built without one
  keep the high values.
- The range starts its shadows switch in the preset's state, and its pixel
  ratio switch uses the preset's cap. `?diag` now adds `Quality: <name>`
  with the values. The range's Foamer count is unchanged; fewer Foamers is
  Paul's call.
- Paul compares presets with `/range?quality=low&diag` and
  `/range?quality=low&bench`; the same query works on the game pages.
- Tests: 1012 passed, 2 skipped. `npm run check` and `npm run smoke` green.
- Not verified: the low and medium pictures were not opened and looked at
  on older hardware; smoke boots the default high pages only.

### 2026-11-12: keys 1 to 8 are B01 to B08 (Claude Opus 5.5)

- Paul: B07 no longer errors in Firefox and B04 fires at once. Then:
  map B01 to B08 on keys 1 to 8; 1, 2 and 3 were out of place.
- `data/blasters.json` `order` is now B01 to B08 (was B01, B04, B03,
  B06, B02, B05, B07, B08). The wheel cycles in the same order.
- Found on the way: `Loadout.ids` was always the full data order, even
  for a loadout built with only some blasters, so an index named the
  wrong one. It now comes from the loadout's own blasters (the pages
  load every blaster, so play was not affected; three tests relied on
  the old coincidence and now select by id).
- 1007 tests pass (2 skipped); check and smoke green.

### 2026-11-12: B04 is plain fast full-auto; Firefox plays until B07 (Claude Opus 5.5)

- Paul: in Firefox the range now plays (mouse and keys) and performance
  is good, until B07 "triggered an error". Not reproduced: B07 fired
  through the real page loop in headless Chromium raised no loop error
  (the F05 took 5.5); the run with sound on could not be done headless
  (the click needs a pointer lock headless Chromium refuses). Since the
  audio listener fix, a loop error no longer stops the game and `?diag`
  shows `Loop errors: N, last: <message> <where>`; Paul to send that
  line (his screenshot was the earlier one, without the Mouse and Loop
  lines). A message in the status line instead would be an error outside
  the loop (an event or a promise), caught by boot-errors.ts.
- B04 Shredder (Paul): no delay before firing and no flywheel sound;
  plain fast full-auto. `spinUp` 0 and `spinDown` 0 (it fires on the
  first held step, test b06.test.ts 4b), `wheelSpin` 0 (the flywheels no
  longer spin). The flywheel sound: PT-04 already removed
  `B04-rev-loop`, and no loop or cue plays for B04 now; only `B04-fire`,
  a short thud, about 10 a second. If Paul still hears a flywheel, it is
  that thud at full rate, or a stale cache.

### 2026-11-12: Firefox: the audio listener stopped the game loop (Claude Opus 5.5)

- Paul's `?diag` mouse line from Firefox: lock asked 2, granted 2, 403
  moves while locked (7616 px), and no keys either; only Esc paused. So
  Firefox delivered the input and the game was not running.
- Cause: `AudioEngine.updateListener()` set `listener.positionX.value`
  and the other listener AudioParams every render. Firefox has none of
  them (they are undefined), so it threw a TypeError. It only runs while
  the audio context is running, and the range suspends audio while
  paused: behind the menu nothing threw, and the first frame after the
  click (lock taken, audio resumed) threw. A throwing hook skipped the
  loop's next `requestAnimationFrame`, so the loop stopped for good: the
  picture froze, the mouse and keys did nothing, and Esc still paused
  because that is a browser event.
- Fix: `placeListener()` in `src/audio/audio.ts` uses the AudioParams
  where they exist and `setPosition`/`setOrientation` otherwise. Tested
  both ways; with the old code the Firefox case throws "Cannot set
  properties of undefined".
- Also: the loop asks for its next frame before running the hooks, so
  one error can no longer stop it; it drops the owed time, logs each
  distinct error once (`DART: loop error`) and `?diag` shows a
  `Loop errors:` line. Test in `tests/core/loop-errors.test.ts`.
- Not verified in Firefox itself (headless Firefox here will not start
  its remote agent since its update). Paul to confirm the range plays.

### 2026-11-12: Firefox boots fine now; the mouse is next (Claude Opus 5.5)

- Paul's `?diag` from Firefox 159 on macOS, live range after PT-10:
  4 mesher workers, none on the main thread; Rapier 0 ms, range 2 ms,
  loadout ready at 2746 ms (the eight blaster models), first frame at
  3067 ms, Foamers meshed at 3160 ms. Monsters load. So the slow boot is
  gone (PT-10 builds the line behind the menu), and the models take
  about 2.7 s on a first visit.
- Still broken in Firefox: the mouse is taken but the camera does not
  turn. Gamepad look only adds to mouse look, so that is not it.
- To find out which half fails, `?diag` now ends with a live line:
  `Mouse: lock on/off (element, raw/plain), asked N, granted N,
  refused N, moves N (N locked, N px)`, redrawn twice a second. If
  locked moves stay 0 while the lock is on, Firefox is not delivering
  moves to the page; if they count up, the game is dropping them.
- Paul's Firefox numbers recorded here because the text could not be
  copied (a screenshot).

### 2026-11-12: PT-10 review, merged (Claude Opus 5.5): a visible boot

- DeepSeek built it to the card: `src/core/boot-report.ts` (steps with
  times, the status line's "Loading blasters 3 / 8", one `DART boot:`
  console line per step, the `?diag` readout), wired into the game pages,
  the range and the sandbox; `range.html` has a `#status` line, so a
  range boot error shows there; `Input` takes no pointer lock before the
  first drawn frame, the page's own buttons included.
- **Fix: the `?diag` readout was drawn once, at the first frame,** before
  the Foamers had landed, so the step that matters for Firefox never
  showed. It now redraws on every boot change, shows each step's time
  since the start ("at N ms"), and a live "Waiting: Building Foamers
  9 / 16" line until the line is done.
- **Fix: the range built its Foamers only after Play.** Their meshes
  update inside the paused game step, so behind the menu the line was not
  built at all, and a slow browser built it while the player was trying
  to play. The range now meshes and poses the line while paused (the
  PT-01 lesson: without the pose they draw in a heap). Seen in headless
  Chromium: line built 0.4 s after load, standing in its arc, behind the
  menu.
- Chromium numbers from `?diag`: loadout 46 ms, first frame at 297 ms,
  Foamers meshed at 410 ms.
- **For Paul:** open `https://dart.contrapaul.com/range?diag` in Firefox,
  wait, and send the readout (or the `DART boot:` console lines if it
  never gets to the first frame).
- `npm run check` (1002 tests) and `npm run smoke` green.

### 2026-11-12: PT-10, a boot you can see, and no mouse lock before the game runs (DeepSeek V4.1 Flash via Pi)

- What was asked: a boot report with step times on every page, a `?diag`
  readout, the range's status line so a boot error shows there, and no
  pointer lock before the game runs.
- Built: `src/core/boot-report.ts` (`pageBoot`, `BootReport` with
  `progress`/`step`/`finish`, `firstFrame`, `diagText`, `mesherMode`,
  `countMesherFallbacks`). Steps log one `DART boot: <step> <ms>` line each
  and write the waiting step into `#status` ("Loading blasters 3 / 8").
  Wired into `src/game/game.ts`, `src/range/main.ts` and
  `src/sandbox/main.ts`; `Loadout.load` takes an optional `onLoaded`.
  `Input.ready`/`setReady()` refuses both the canvas click and
  `requestLock` until the first drawn frame.
- Range: `range.html` has `<p id="status">Loading</p>` (styled in
  `src/range/range.css`), so `boot-errors.ts` shows a failed range boot on
  the page. `tools/smoke.mjs` waits for the range's ready text now.
- Decisions: the mesher fallback count wraps `console.warn` instead of
  changing `MesherPool` (the reviewer may prefer a counter on the pool);
  after `finish()` a late Foamer mesh still logs its step but cannot
  overwrite the ready line.
- Checks run here: `npm run check` green (1000 passed, 2 skipped; one
  `tests/weapons/b05.test.ts` timing failure under load, green when run
  alone), `npm run smoke` green on all four pages (range now reports
  "Click to play. Esc shows the panel.").
- Not checked by eye: no browser and no image reading here, so the `?diag`
  readout's look, the range status line's place in the panel, and Firefox's
  real first click after boot are for the reviewer. The Firefox boot itself
  was not timed, only the steps it now reports.
### 2026-11-12: a piercing dart flies through loose foam chunks (Claude Opus 5.5)

- CI failed on a docs-only commit: `tests/weapons/b05.test.ts` 9 (a dart
  never hits the same Foamer twice). Reproduced here about 1 run in 15
  alone and more under load, with test 8 (heavy round damaged 2 of 4)
  flaky too. Cause: the dart's entry hole throws foam chunks at random
  speeds (`Math.random` in debris.ts); darts hit loose debris, and a
  debris hit takes the stop-or-bounce path, so a piercing round could be
  stopped by its own debris. Test 9 also counted debris hits as Foamer
  hits.
- Fix: a dart with `pierce` above 0 ignores colliders in the debris group
  (`src/weapons/darts.ts`). Ordinary darts still knock chunks about.
  Test 9 counts only non-debris hits. 60 of 60 runs green under load.

### 2026-11-12: CI timing budgets off on CI, QA-01 passed (Claude Opus 5.5)

- Two more CI runs failed on the path-query budget alone: the fastest of
  nine queries took 7.7 and 8.1 ms on GitHub against 3.4 ms one run
  earlier, so a scaled budget (`PERF_BUDGET_SCALE`, now removed) could
  not make it reliable. The nav bake and query budgets now run only off
  CI (GitHub sets `CI`); on CI the numbers are logged. They hold on a
  dev machine.
- QA-01 passed (Paul): above 60 fps without issue on the range. More
  will come from level testing. The voxel go/no-go gate is Paul's call
  and still open in PLAN.md.
- Firefox (Paul, 2026-11-12): not playable. The mouse is taken but the
  camera does not turn; Foamers never load or load very late. Edge is
  playable. Both symptoms fit a boot that has not finished: the canvas
  takes the lock on click before the loop runs. Headless Firefox here
  measured the live range at 20 to 30 s to boot against about 3 s in
  Chromium (models fetched in under 1 s each), so the time is spent
  elsewhere in Firefox. Card PT-10 adds a boot report to find it.

### 2026-11-12: review of the 11-12 work, pushed, CI made green on GitHub (Claude Opus 5.5)

- Reviewed the four unpushed commits (B08 wired under its plain name,
  boot errors, the model cache rule, the CI gate). `npm run check` and
  `npm run smoke` green.
- Fix: the smoke check called `range.html` ready as soon as `#overlay`
  showed, which is static HTML, so a range that never finished booting
  passed (it passed at 0.4 s with the menu still on "Blaster -"). It now
  waits for `#menuBlaster` to name B01. Made to fail on purpose: with
  `B01.glb` taken out of `dist/`, range.html fails "never became ready".
- Moved the 11-10 and 11-12 entries from above `## Status` into this
  Log; dropped a stale 11-07 GAME-09d note there (merged long since,
  its review is below). The ART-04B entry is marked superseded.
- Open: `range.html` has no `#status`, so a range boot error is only in
  the console (by design in boot-errors.ts; worth showing on the range
  now that it is the test page).
- **First CI runs on GitHub.** Run 1 failed 8 tests, all on speed: the
  fixed `maxWorkers: 6` oversubscribed the 2-core runner threefold (the
  BUG-10 problem) and the level and nav bakes went past vitest's 5 s
  timeout. Now `maxWorkers` is never more than the cores and
  `testTimeout` is 20 s. Run 2 failed one wall-clock budget (path query
  3.4 ms against 2 ms on the runner's slower CPU): the workflow now sets
  `PERF_BUDGET_SCALE` 3 for `npm test`; locally it is 1, the real
  budget. Run 3 green end to end, including the smoke check of the live
  site.
- The workflow does not stop a deploy: Cloudflare builds every push to
  `main` whatever CI says. Its comment claimed otherwise and is fixed.
  To truly gate, Cloudflare's build command would have to run the
  checks, or the deploy move into the workflow.

### 2026-11-12: OPS-03, the CI gate and the smoke check (Claude via pi)

CI gate and smoke check, 2026-11-12 (session by Claude via pi). Paul
asked for the CI workflow and `tools/smoke.mjs`, and said performance has
been good apart from solved bugs, with graphics options for older machines
needed later but not now. So:

- `.github/workflows/check.yml` (new) runs on every push to `main` and
  every pull request: `npm ci`, `npm run build`, `npm test`, then
  `tools/check-no-em-dash.mjs` and `tools/check-no-remote.mjs`, then
  installs Chromium and runs `tools/smoke.mjs` against `dist/`. This is
  the gate Cloudflare's own build does not have: a red suite used to go
  live.
- `tools/smoke.mjs` (new) boots all four pages (`index.html`,
  `arena.html`, `range.html`, `sandbox.html`) in Chromium over the
  DevTools protocol, using the global `WebSocket` that Node 22+ has, so it
  needs no new dependency. It serves `dist/` itself, or takes
  `SMOKE_URL`. It fails on a boot error, on a page that never reaches its
  ready text, on a missing or CSS-hidden canvas, and on a canvas that is
  one flat colour: the picture is measured from a real screenshot,
  decoded with `zlib`, because a WebGL canvas reads back empty through
  `drawImage`.
- `tools/check-no-remote.mjs` (new) fails when the built output fetches
  from another host (an element `src`/`href`, a `fetch`/`Worker`/`Image`,
  a CSS `url()`). `tools/check-no-em-dash.mjs` (new) fails on U+2014 in
  the files we write. Both were written as scripts rather than grep lines
  because `grep $'\u2014'` does not survive a YAML file.
- `package.json` gained `npm run smoke` and `npm run check` (build, test
  and the two text rules), so a local run matches CI.
- Proven, not assumed: the live site passes all four pages
  (`SMOKE_URL=https://dart.contrapaul.com`) and `dist/` passes locally;
  deleting `B08.glb` fails `arena.html` with the boot error text; a
  `canvas{visibility:hidden}` rule fails with "the canvas is hidden by
  CSS"; a Google Fonts `<link>` fails the remote check; an em dash in a
  test file fails the dash check. `npm run check` is green: build clean,
  144 files / 989 passed / 2 skipped, no em dashes, no remote fetches.
- Not verified: the workflow has never run on GitHub (nothing is pushed
  yet), so the Linux paths in `smoke.mjs` (a Playwright Chromium under
  `~/.cache/ms-playwright` or `/ms-playwright`, SwiftShader for WebGL) are
  reasoned, not observed. First push to `main` is the test of that.
- Still open from before: QA-01 on Paul's base Apple Silicon Mac with
  numbers in this file, then the voxel go/no-go. Graphics options for
  older machines are recorded as OPS-04 in PLAN.md section 12 and not
  started.

### 2026-11-12: B08 named and wired, boot errors, model cache rule (Claude via pi)

B08 named and wired, boot errors, model cache rule, 2026-11-12 (session
by Claude via pi). Paul's decision, given this session: the 2026-11-10
rebuild he picked is DeepSeek's, he renamed `art/blasters/B08-pi/` to
`art/blasters/B08/` and deleted the other candidates, and B08 should be
that blaster. The rename had landed on disk but not in the repo, so the
work finished it:

- Assets: `public/models/blasters/B08.glb` is now the approved build
  (344,068 bytes, 7,622 tris, 4 materials, nodes `body`, `barrels`,
  `barrels_2`, `mag`, `trigger`, `mod_twin`, `muzzle_1`, `muzzle_2`). The
  old 990,444-byte hopper build that held that name and the runner-up
  `B08-1cat.glb` are deleted, so no stale copy can be picked up.
- Code and data: `art/blasters/B08/build.py` writes `B08.glb` into
  `art/blasters/B08/renders/`; `data/blasters.json` B08 `model` is
  `/models/blasters/B08.glb` and its `_note` names the new paths. The
  twin wiring (`show: ["mod_twin"]`, `muzzles: ["muzzle_1", "muzzle_2"]`)
  is as it was.
- New guard: `tests/weapons/model-files.test.ts` fails when any blaster's
  `model` is not a file in `public/`, and when two blasters share one
  model. Before this, a rename like this one could land the data without
  the file: the page then died on a 404 that Cloudflare's SPA fallback
  turns into 200 text/html, so nothing said why.
- Seen in a browser at last, headless Chromium against the built site:
  `/arena.html` reaches "Click to play", takes the pointer lock, and draws
  the Firehose in hand (six barrels, side magazine, handle over the body,
  HUD reads `AMMO 120 / 120`). Screenshot taken. Still unseen by eye: the
  spin at `wheelSpin` 60 rev/s (a data value to tune on the range), the
  reload, and the Twin mod's second cluster in play.
- Boot errors: `src/core/boot-errors.ts`, imported first by all four page
  modules, puts the reason into `#status` ("Could not start: <reason>.
  Reload the page to try again.") and logs it. Proven both ways in
  headless Chromium: with `B08.glb` removed the overlay said
  `Could not start: fetch for ".../models/blasters/B08.glb" responded
  with 404: File not found.`; with it back, the game booted clean. All
  four pages boot with no console exceptions.
- `public/_headers`: `/models/*` now sends `max-age=0, must-revalidate`
  (model names carry no hash; a rebuilt blaster lands on the same URL and
  had no rule at all).
- Docs: `design/blasters/B08.md` rewritten to the approved design (the
  old file described the hopper brief Paul rejected), with the restated
  brief quoted verbatim, the as-built dimensions, the node table and the
  motion notes for ART-05. `PLAN.md` rows and decisions log updated.

Verified: `npm test` 144 files, 989 passed, 2 skipped; `npm run build`
clean (tsc, vite, the wasm guard). Not done: the changes are uncommitted
and unpushed; the dead code for the old hopper build is gone with it.
Real fps on the base Apple Silicon Mac is still the open QA-01 question.

### 2026-11-10: B08 rebuild, two competing models

B08 rebuild, two competing models, 2026-11-10 (Paul: "B08 is awful and
needs a new from-scratch build", and "no 'hopper' atop the barrel, this is
a side magazine fed blaster. The handle is over the body of the blaster.
The mod which adds a 2nd barrel adds the entire 6 barrel assembly, and
both would spin on individual axis when fired"). This supersedes the
hopper-and-shroud brief in `design/blasters/B08.md` (that file still
describes the old design; it needs a rewrite once Paul picks a winner).
Two builds, both from scratch in Blender 5.2.3 (Steam), kept for the
record; only the first is still in the tree:
- pi's (DeepSeek via pi, the one Paul picked, since renamed to plain B08):
  `art/blasters/B08/build.py` to
  `public/models/blasters/B08.glb`, renders in
  `art/blasters/B08/renders/`. 7,622 tris, 4 materials, check_glb
  PASS, plus a numeric geometry audit (`art/blasters/B08/audit.py`)
  that checks six-barrel ring, no top hopper, top handle over the body,
  right-side mag, twin is a whole second cluster, both cluster sweeps
  clear of static parts, muzzles on axis.
- 1Cat-vLLM's (qwen-machine/qwen3.8-27b-1cat via acp_delegate worker):
  `art/blasters/B08-1cat/build.py` to `public/models/blasters/B08-1cat.glb`,
  renders in `art/blasters/B08-1cat/renders/`. 11,028 tris, 4 materials,
  397 KB, check_glb PASS. The same audit found one jam risk: its static
  feed collar puts 164 verts inside the main cluster's sweep disc (the
  barrels would clip it when spinning); pi's has 0.
Game hookup: the viewmodel now spins nodes `barrels` and `barrels_2` on
their own axes beside the flywheels in the auto branch
(`src/weapons/viewmodel.ts`); `tests/weapons/b08-gatling.test.ts` covers
spin-up offset, twin spin and spin-down stop; `models.test.ts` accepts
`barrels` as an auto blaster's moving part. Neither GLB is wired into
`data/blasters.json` yet: B08 still points at the B04 placeholder until
Paul picks the winner (one line).
DECISION (Paul, 2026-11-10): the pi build (DeepSeek's) is the winner.
Wired in 2026-11-12 under the plain name: `data/blasters.json` B08
`model` is `/models/blasters/B08.glb`,
the Twin mod carries `show: ["mod_twin"]` and `muzzles: ["muzzle_1",
"muzzle_2"]` (one muzzle per cluster), and its `_note` records the
restated brief. `tests/weapons/b08.test.ts` cases 4 and 10 now assert
the own model and the two-cluster twin. The 1cat runner-up (it had the
feed-collar jam) was deleted on 2026-11-12 with the rejected 2026-11-08
build; `art/blasters/B08-1cat/` is gone too.
Unverified: not seen in a browser by eye; the spin at wheelSpin 60
rev/s is a data value to tune on the range; the old B08 sounds still
play. `design/blasters/B08.md` rewrite and the ART-05 motion brief
(barrel spin-up, reload as a magazine drop) still to do.

### 2026-11-10: ART-04B, the first B08 build (superseded)

Superseded the same day: Paul rejected this hopper build ("B08 is awful") and the rebuild above replaced it; its files are deleted.

ART-04B code done 2026-11-10: B08 Firehose model built from the approved
written brief in `design/blasters/B08.md`. Script at
`art/blasters/B08/build.py`, GLB exported to
`public/models/blasters/B08.glb`, renders at
`art/blasters/B08/renders/` (side, three-quarter, top, first-person,
barrel-front, twin-mod). All six views rendered. The `check_glb.py`
contract passes every check: 18,116 triangles, 1.0 MB, 7 materials,
origin at the pistol grip, magazine origin at rest centre, trigger
pulls toward the grip on positive local X, `mod_twin` hidden by
default, `muzzle_1` and `muzzle_2` forward along +Y. Colours as
proposed in the brief: white body, charcoal grips and barrels,
yellow accents on ribs and rings, orange bumper, smoke hopper with
foam-blue balls inside. The gameplay is already in from GAME-09g on
B04's model; swapping to B08's own model is a one-line data change
once Paul approves the palette. Not seen by eye in the game engine;
the renders were checked by image only.

### 2026-11-09: PT-09 review, merged (Claude Opus 5.5): Firefox

- DeepSeek: pointer lock now takes the plain form inside the click after
  any refusal (promise, throw or `pointerlockerror`), raw input kept
  where it worked; the mesher pool meshes a job on the main thread when
  its worker errors, its reply cannot be cloned or no worker starts,
  with one `console.warn` naming the cause. 11 new tests with fakes.
- **Firefox tested headless here** (Firefox 159, macOS, WebDriver BiDi
  from a small Node script): current main, the PT-09 build and the live
  site all load the range and draw all 16 Foamers with no console
  errors. So Paul's "mobs do not fully load" did not reproduce on this
  Mac; his Firefox differs (version, OS, privacy settings or an
  extension). The fallback covers a worker failure there. Pointer lock
  cannot be tested headless.
- The live page takes about 20 to 30 s to start in a fresh browser (it
  loads about 4.7 MB of blaster models before the game starts), which
  may read as "not loading".
- **For Paul:** the live page also loads
  `static.cloudflareinsights.com/beacon.min.js` (Cloudflare Web
  Analytics, injected by Cloudflare, not in the repo). That is an
  outside host, against the no-external-hosts rule. It is turned off in
  the Cloudflare dashboard (Web Analytics for the site), not in code.
- Known limit: in a browser that reports a refusal only by event, the
  first click fails and the second locks.
- 980 tests pass (2 skipped), tsc and build green.

### 2026-11-09: PT-09, Firefox pointer lock and Foamers that finish loading (DeepSeek V4.1 Flash via Pi)

Card: `tasks/PT-09.md`. Paul: the range does not let him look with the
mouse in Firefox, and Foamers do not finish loading there. Chrome is fine.

- **Mouse.** `Input.requestLock` called
  `requestPointerLock({ unadjustedMovement: true })` and only asked for the
  plain lock inside the promise's `.catch`. Firefox has no raw mouse input:
  it either returns `undefined` and fires `pointerlockerror`, or rejects.
  Either way the fallback arrived after the click, once the user activation
  could be gone, so Firefox refused it and the player never got the lock.
  My belief: this was the cause, and I am fairly sure, not certain, because
  I could not run Firefox. Now a refusal (rejected promise, synchronous
  throw, or `pointerlockerror` before raw input has ever been granted) sets
  `plainLock`, and `requestLock` asks for the plain form directly inside the
  click. `pointerlockchange` sets `rawWorked` when a raw lock is granted, so
  Chrome and Safari keep raw input and the fast re-lock refused after Esc is
  not mistaken for a refusal of raw input.
- **Foamers.** `MesherPool` resolved a job only from `onmessage`, with no
  `onerror` and no `onmessageerror`: a worker that failed to start, threw,
  or answered with something that could not be cloned left the job pending
  forever, the part's `VolumeMesh` stayed `busy`, and it was never drawn and
  had no collider. My belief: this was the cause of Foamers that never
  finish loading, either because a module worker failed in Firefox or
  because one worker error stuck the whole part. Also fairly sure, not
  certain; I found no Firefox-only fault in the worker's imports (no JSON
  is imported by `mesher.worker.ts`; `materials.ts` imports
  `data/materials.json`, which Vite inlines into the worker bundle) and no
  buffer listed twice in either transfer list. Now each slot keeps its job;
  `onerror` and `onmessageerror` warn once with the cause, terminate and
  drop that worker, and mesh the job here with the same `greedyMesh` call;
  when no worker is left every job is meshed here. `pump` keeps a copy of
  the padded buffer before transferring it, and a late reply from a dropped
  worker is ignored by job id. A `new Worker` that throws (no module
  workers) is caught and the pool goes straight to the main thread.
- Tests: `tests/core/input-lock.test.ts` (undefined return plus
  `pointerlockerror`, a rejected promise, a synchronous throw, the next
  click straight to plain, raw-only in a browser that takes it, and the Esc
  refusal not switching a raw browser) and `tests/voxel/mesher-pool.test.ts`
  (a worker `onerror` gives the same mesh on the main thread, a
  `messageerror` ditto, construction that throws still meshes, a normal
  worker path unchanged, a stale reply ignored). 980 pass, 2 skipped; tsc
  and build green.
- What only Paul can check in Firefox: that the first click gives the lock
  and that the mouse looks without the need for a second click; that the
  console shows no `mesher:` warning when a Foamer loads (a warning means a
  worker failed and a part was meshed on the main thread, which works but is
  slower); and that Foamers are drawn and can be hit. Nothing here was seen
  by eye (no browser, cannot view images).

### 2026-11-09: PT-07 review, merged (Claude Opus 5.5): weapons and the F11 shield

- dgx-spark did it to the card: `kinds.weapon.total` 0, and F11's
  `armour.shield` and `shieldBoss` gained `wear 1` and `carve 0.3`, so a
  front dart does nothing to the Seawall but wears the plate.
- On the range: six precisionHeavy darts at an F01's club shot it off
  and the F01 kept 6 of 6 health. Darts at F11's shield from the front
  wore it from 15 hp; it broke on its 15th hit and the next front dart
  hurt the Seawall (51.5 to 50.5). Darts that missed the plate and hit
  the parts round it took 0.5 each, as before.
- Tuning for Paul: the shield takes 15 standard darts (its hp is the
  `ability` hpShare 0.25 of 60); `wear` scales it.
- 969 tests pass (2 skipped) twice after merging main, tsc and build
  green. Not seen: the wear marks and the plate flying off.

### 2026-11-09: PT-04 review, merged (Claude Opus 5.5): sound cuts and B06

- dgx-spark did it to the card: the F10 jet loop, `BX-holster` and
  `BX-draw`, the `B04-rev-loop` and `FX-fizz-out` are no longer played
  (their data stays for Paul's recordings); `PL-step-hard` volume 0.14;
  B06 `spinUp` 0, and it fires on the first held step (tested; the auto
  code already clamped the divisor).
- Nothing was listened to (no audio in the review pane). Paul to check by
  ear: the footstep level, and that the F10 still reads alive silent.
- 949 tests pass (2 skipped) after merging main, tsc and build green.
### 2026-11-09: PT-07, done, not merged (Qwen 3.8 Flash Next via Pi, dgx-spark): weapons off the health, the Seawall's shield wears

- Task (Paul, second playtest): "Enemy weapons should not contribute to
  their health. IE, F01 should not die because of heavy damage to the
  club", and "F11's shield needs to be able to break with enough damage"
  (`tasks/PT-07.md`).
- Weapons: `data/foamers.json` base `partDamage.kinds.weapon.total` 0.5 to
  0. `handleHit` (src/foamers/foamers.ts:2081) already did
  `f.health -= dmg * kind.total`, so no code change was needed there: the
  part keeps `part.hp -= dmg`, still carves, still breaks off, and the
  Foamer keeps its health. `f.addDamage` and the shot's damage now see 0
  from a weapon hit too, which is consistent: a weapon hit is not health
  damage, so it should not feed the impact rule.
- Rigs with a weapon part (from `data/foamer-rigs.json`): F01 club, F02
  ball, F04 blaster, F07 fistL and sword, F08 launcherL/R, F09 barrelL/R,
  F10 blaster, F11 handle and maceHead, F13 wand. All of them keep their
  own hp (`hpShare` 0.25 of the rig's health, floor `minHp` 2), carve and
  break off as before, and none of them can carry a Foamer to its death.
  Attacks that `need` a broken part are dropped by `chooseAttack`, so F01
  and F11 still lose the mace swings and F07 still falls back to the fists
  (checked by the existing tests).
- The F11's shield: `armour.shield` and `armour.shieldBoss` keep `damage` 0
  and `arcDeg` 120, and gain a new optional `wear` 1 and `carve` 0.3. A new
  `ArmourPart.wear` (src/foamers/armour.ts) is the share of the dart's
  damage taken off the plate's own hp, applied in `handleHit` only when the
  arc armour actually covers the hit (`shielded`), so the Blocker (F04, no
  `wear`) is untouched and its darts still cannot break its shield. At the
  plate's hp 0 the ordinary `breakPart` path runs, the same one the parry
  break uses, and with the part gone `armourOf` finds nothing, so the arc
  goes with it and the next front dart hurts. The `carve` 0.3 is the
  part's `carveScale` in the dart carve (src/weapons/impacts.ts), so the
  plate takes a small mark, not the whole crater. The two-parry break
  (`meleeParry.parriesToBreak` 2) is unchanged and still tested.
- The shield's hp in darts, from the part's `hpShare`: the shield is an
  `ability` part (0.25) and the boss a `detail` (0.15), of the F11's health
  60, so 15 and 9 hp, at standard damage 1 x `hit` 1 x `wear` 1. So 15
  standard front darts break the shield and 9 break the boss; a mega (3) or
  precision (8) spends that hp in fewer (5 and 2 for the shield); slug and
  buck are 6 and 11, so one buck dart breaks the boss and two the shield.
- Tests: new `tests/foamers/weapon-parts.test.ts` (the weapon kind's
  shares; an F01 keeps full health through losing its club; a precisionHeavy
  dart worth more than the F01's whole health on the club does not kill it;
  an F07 keeps full health through losing its sword and still attacks).
  `tests/foamers/seawall.test.ts` gained: the shield's own health is 15
  standard front darts, fewer than that leave it on and worn, enough break
  it off and the next front dart hurts, the boss wears the same way, the
  two-parry break still works. Existing tests that asserted the old rules
  were updated, not deleted: `brawler.test.ts` 2 now expects the sword's
  damage to stay off the health, `seawall.test.ts` expects the mark and the
  wear on a front dart, and `trawler-wall.test.ts` 9 reads the launcher's
  own hp (a weapon part no longer moves the Trawler's health, which is the
  only reason it failed).
- Verified: `npx tsc --noEmit` clean, `npx vitest run` 955 passed 2 skipped
  (136 files), `npm run build` built. No em or en dash in the files touched.
- Not verified by eye: no browser and no image viewing here, so nobody has
  looked at the shield wearing down on screen, the marks it takes, or the
  plate flying off as a foam piece. The reviewer should look at that, at the
  sound (a worn-front dart still plays `shield-hit`, and the break plays
  `shield-break`), and at whether 15 standard darts feels right, since it
  is the number to tune (`armour.shield.wear` in `data/foamers.json`).

### 2026-11-09: PT-06 review, merged (Claude Opus 5.5): the dart look

- qwen-machine stopped once when Pi's context compaction failed and it
  read the harness note as an order to pause; restarted from its saved
  work, it finished in about 30 minutes.
- The black streaks were the winding: the old side quads mixed two
  triangle orders, so half the faces pointed inward. Fixed at the cause.
- Seen in the browser, close up: standard blue with a reddish orange
  tip, mega red with yellow, precision and precisionHeavy yellow with
  blue, buck blue with reddish orange, the launcher a yellow ball; no
  black faces from any angle.
- Review fix: the tip had two rings and looked like a crayon point; it
  now has four and reads as a rounded foam tip.
- Darts turn along their velocity every step (tested after a bounce and
  through an arc). Not seen in motion in the browser.
- 946 tests pass (2 skipped), tsc and build green.

### 2026-11-09: PT-06 dart look, in flight and after a bounce (Qwen 3.8-27B via Pi, qwen-machine)

PT-06 code done on `pt-06`, not reviewed, not merged, not pushed. This was
a continuation of an earlier run of mine that had saved a work-in-progress
commit (`0752c72`) before its context ran out; I kept what was right
(the shape rewrite, Paul's colours, the in-flight turn) and finished the
card.

The shape in `src/weapons/dart-model.ts` is now a plain cylinder, flat at
the back, with a rounded foam tip of the body's own radius. The old tip
was 22% of the length and bulged 1.25x the body radius; both are gone. The
tip's share is a new `tipShare` 0.15 in `data/darts.json` (only the shape,
size and colour lines changed, edited by hand, layout kept).

The cause of the black triangles streaked with blue that Paul saw: the tip
quads used two diagonals with opposite winding, so roughly half of every
tip face was backfacing and unlit. `quad()` now takes one diagonal (`a, b,
c, a, c, d`) so both triangles wind outward, and every face's triangle
normal points away from the dart. `tests/weapons/dart-look.test.ts` proves
it: the tip is one point at +Z, the back is flat, all normals point
outward, the tip has no bulge, and the per-vertex colours are the data's
colours with
a float32 tolerance (the colour attribute is linear float32, so exact
equality fails on rounding; that was the only remaining failure, as
`0752c72`'s message and the card both predicted).

Paul's colours, as given: standard body `#2ec4ff` tip `#ff5a1a` (reddish
orange); mega body `#e8332a` tip `#ffd23f` (yellow); precision body
`#ffd23f` tip `#2ec4ff` (blue). The launcher round is a yellow ball
`#ffd23f` of its current radius (`#ffd23f`, the `shape: ball` path B08
already had). For the types Paul did not name, I kept: `precisionHeavy`
like precision (yellow body, blue tip), `buck` like standard (blue body,
reddish orange tip), `b01slug` and `slug` keep their purple body and cream
tip, `suction` keeps its yellow body and pink tip, and `ball` stays as it
is. [Paul] please confirm those defaults against your intent.

Orientation: `DartSystem.update` now turns every flying non-ball dart
along its velocity each step (`setFromUnitVectors(AXIS_Z, dir)`), so the
tip leads through the arc and takes the new direction at each bounce.
Resting and stuck darts keep their old rules; the two ball types do not
turn (they are round, nothing to point). Two card tests: a dart fired at
45 degrees up points within 10 degrees of its (downward) velocity near the
end of its arc, and a dart after a wall bounce has its +Z axis within 15
degrees of its new velocity. Both pass headless.

Not seen by eye: I can see no images and open no browser, so the new look
(the colours, the rounded tip, the darts turning in flight and after a
bounce) was only checked by the headless geometry and scene tests. The
reviewer has to look at it in the browser.

`npx tsc --noEmit`, `npx vitest run` (946 passed, 2 skipped) and
`npm run build` all pass. No em or en dashes in the files I touched
(perl check clean).
### 2026-11-09: PT-08, blaster hold positions (Claude Opus 5.5)

- Paul: blasters are held too far forward; B02 Musketeer is the closest
  to correct and looks larger than the rest; B05 Shrike is so far out
  two hands could not hold it.
- Measured: scales ran 0.62 to 0.85 and triggers sat 33 to 51 cm in
  front of the eye (B05 worst: 0.62 at 51 cm), so the rifles looked
  small and floating.
- Every blaster's `viewmodel` is now B02's: position (0.18, -0.22,
  -0.32), scale 0.85, its own small rotation kept. They keep their true
  relative sizes (B05 is long, B02 short) and all sit low right, the
  fore-end within a left hand's reach. A first try at scale 1 and 28 cm
  was far too big (a live trial had not taken the scale; the page
  resets it each frame).
- Seen in the browser for all eight. Not checked: a 16:9 window (the
  pane is 4:3), and whether the recoil and sway now clip the screen edge.
- 934 tests pass (2 skipped), tsc and build green.
### 2026-11-09: PT-04, the sound cuts and The Standard's fire delay (Qwen 3.8 Flash Next via Pi, dgx-spark, branch `pt-04`, two commits, not merged)

What Paul asked for (second playtest): the F10's jet loop gone, footsteps
about 80 per cent quieter, the change-weapon sound gone, the B04 flywheel
sound dropped, the foamer dying sound dropped, and The Standard firing with
no delay. All six are in. The sound definitions stay in `data/sounds.json`
(his recordings will reuse the IDs), so what was removed is only the code
that played them, noted as "Not played since PT-04, Paul" in
`design/SOUNDS.md` against `F10-jet`, `FX-fizz-out`, `BX-holster`,
`BX-draw`, `B04-rev-loop`, `B06-spin` and `PL-step-hard`.

What was decided and why. The F10 keeps the float-or-fly path in
`src/audio/foamer-sounds.ts` rather than being excluded from it, because
that path is also what sounds `F10-fall` when the last jet breaks: its
`hums` map entry now holds null for a Turbo instead of a `LoopHandle`, so
the state is tracked and nothing plays. The F06 hum is untouched. The
fizz-out queue (`Fizz`, `FIZZ_DELAY`, `FIZZ_CAP`) went entirely, so
`FoamerSounds.update` no longer uses its `dt` (renamed `_dt`): it had no
other caller. With the B04 loop went `stopRev`, the `rev` field and the
`LoopHandle` import; `Blaster.wheelSpeed` itself stays, since
`src/weapons/viewmodel.ts` still spins the wheels with it, and `B04-fire`
per shot is kept.

B06 is a data line only: `spinUp` 0.25 to 0. No code change was needed for
zero, and that was checked rather than assumed: `updateAuto` divides by
`Math.max(s.spinUp, 1e-6)` and `updateAutoFire` gates on `wheelSpeed < 1`,
which zero spin-up reaches on the first held step, so the first mega dart
leaves on step one. `B06-spin` had never been wired (game-sounds.ts loops
only B04 today, as its own `_note` in the data said), so there was nothing
to remove for it.

Tests. Added: the card cases in `tests/audio/game-sounds.test.ts` (a new
`PT-04: the sound cuts` block: a switch plays neither `BX-holster` nor
`BX-draw`; the F10 starts no loop while the F06 still hums once, and the
F10 still sounds its flop; B04 active starts no loop and still fires its
fire sound), and a `PL-step-hard` volume assertion in
`tests/audio/data.test.ts`. Updated where they asserted the old sounds,
as the card asked: `a standard-dart kill ... FX-fizz-out 0.3 s later` in
`tests/audio/game-sounds.test.ts` now asserts no fizz-out after the topple
(stepped 60 ticks past the old delay), and the whole old `card test 10`
rev-loop case (one loop, volume follows wheelSpeed) is deleted, replaced by
the no-loop test above. In `tests/weapons/b06.test.ts`, spec test 3 expects
`spinUp` 0 and test 4 fires on the first held step. `tests/foamers/fall.test.ts`
already asserted no fizz-out on a fall and still passes unchanged.
`npx tsc --noEmit`, `npx vitest run` (134 files, 937 passed, 2 skipped) and
`npm run build` are green; no em or en dashes in the files touched.

Not checked by eye or ear. Nothing here was heard: no dev server was run, so
the mix is unverified, and the footsteps at 0.14 in particular is Paul's
number, not a listened level. Whether B06 at zero delay now feels right, and
whether the F10 reads as silent-but-alive with only its flop left, are for
the reviewer's ear on the range and in the arena.
### 2026-11-09: PT-05 review, merged (Claude Opus 5.5): explosions that blow Foamers apart

- DeepSeek did all three stages in about 20 minutes: the blast reaches
  the nearest part, walls block it, the shove is a speed spent over the
  steps, it carves every part in its sphere, a kill can chunk, pop or
  obliterate (`obliterateAt` 3), and the explosive mods are small
  launcher blasts (20 at the centre, 2.2 m, a shove).
- **Fix: every Foamer in range was judged as if hit dead on.** The kill
  used the profile's `damageCentre`, not the damage taken at its
  distance, so a nearly dead F05 at the edge was chunked. It now uses
  the damage taken. Test 2 of blast-carve, which locked in the old
  result, rewritten; it fails without the fix.
- **Fix: loose debris blocked Foamer movement.** The movement queries had
  no group filter, so a foam chunk (thrown at a `Math.random` speed in
  debris.ts) in a Foamer's path stopped its walk or its shove on some
  runs: the cause of blast.test 4 failing under load. Both movement
  queries now use `SOLID_QUERY_GROUPS` (no debris, no ragdolls).
- **Fix: the range line was never shoved.** Held Foamers skip the step
  where the shove is spent; they now spend it through the wall-safe
  `knockStep`. New test in tests/range/lineup.test.ts.
- Three time-to-kill tests assumed a B01 kill is always a plain down;
  since PT-03 the random spread can make it a chunk or a pop. Loosened.
- On the range: a launcher round 1.6 m from an F05 took 15 and carved
  1742 voxels; 1.2 m from an F07, 18 and 5285 voxels, shoved 1.1 m over
  the steps; an F03 beside a blast popped. The F04 takes nothing from
  the front: its own shield wall blocks the blast (as it does darts).
- Note: `src/voxel/debris.ts` uses `Math.random` for chunk speeds
  (pre-existing; debris is visual and no longer blocks movement).
- Not seen close up: the hole sizes, an obliteration against a pop.
- 945 tests pass (2 skipped) three runs running, tsc and build green.

### 2026-11-09: PT-05, blasts that blow Foamers apart (DeepSeek V4.1 Flash via Pi, branch `pt-05`, three commits plus this docs commit, not reviewed, not merged)

Card: `tasks/PT-05.md`, from Paul's second playtest ("explosions barely
mark Foamers, survivors teleport, walls do not block them, the explosive
mods are too weak").

**Stage 1 (eb9f75f)**: a blast now reaches a Foamer by its parts, not its
feet: `FoamerSystem.blastDistance` finds the nearest part box centre with
no fixed level geometry between it and the blast point, so an arm in the
sphere takes the blast when the feet are out of it, and a wall in between
does not. Only level geometry blocks; Foamers, debris and ragdolls never
do. One trap worth knowing: a blast point resting on the floor sits a hair
inside the floor collider and Rapier reports that shape at ray time 0 for
every ray, which made every part read as blocked until the ray was started
1 cm in and a hit at time 0 was ignored. The shove is now a speed, not a
step: `blastKnock` sets the Foamer's own knock speed out from the point,
the movement controller spends it through `computeColliderMovement` with
the data decay, so no step moves further than the speed allows and a wall
stops it mid-walk. Debris and broken pieces go straight out from the point
in 3D with only `pushLift` (0.15) on top instead of straight up.

**Stage 2 (fe182d2)**: `blastCarve` carves each Foamer part inside
`foamerCarveRadius` (per profile), the sphere set down so it just reaches
the part's centre, so the hole is on the side facing the blast and a
survivor is visibly marked. A killing blast is judged by the same impact
rule a dart kill uses, with the profile's `damageCentre` as the shot and
near 1: the chunk band carves and goes down, `popAt` pops with the foam
thrown outward from the point, and the new `obliterateAt` (data, 3) bursts
every part and leaves nothing, inside the debris caps.

**Stage 3 (895098c)**: the `dart` profile (B05 explosive mod, B06 every
fifth shot) is a small launcher blast: 20 damage at the centre (was 12),
2.2 m range, shove 5 m/s. Numbers for Paul: `data/explosion.json`, per
profile `damageCentre`, `rangeMetres`, `foamerCarveRadius`, `knockSpeed`,
`knockDecay`, `liftSpeed`, and top level `obliterateAt` and `pushLift`.

Tests: `tests/foamers/blast.test.ts` (walls block, an arm in range, the
shove over time, a wall stopping it), `tests/foamers/blast-carve.test.ts`
(an F01 obliterated at 1 m, an F05 chunked at 2.5 m on the near side, a
surviving F07 losing voxels), `tests/foamers/blast-mods.test.ts` (a dart
blast at least twice a plain mega dart's damage, the neighbour shoved).

**Not checked by eye.** I cannot see images or run a browser: nothing here
was watched in the game. Worth a look by the reviewer: how big the hole
reads on a survivor at each profile's radius, whether the obliteration
looks like a pop or distinct, and whether 5 m/s of shove on the dart
profile feels right on the range. Two tests changed for the rule change,
not to make a failure go away: `tests/weapons/b07.test.ts` test 9 now
expects the dart profile to shove (it deliberately did not in stage 1, so
B05/B06 kept their old numbers for one stage), and `blast.test.ts` test 5
checks the shove numbers on the launcher and cluster profiles only.

### 2026-11-09: Paul's second playtest, four cards (Claude Opus 5.5)

Paul's notes: the F10 jet drone, loud footsteps, the weapon switch sound,
the B04 flywheel sound and the Foamer dying sound must go; B06 has a delay
before firing; darts look bad and do not turn after a bounce; blasters are
held too far forward; explosions barely mark Foamers, survivors teleport,
walls do not block them, and the explosive mods are too weak; F11's shield
cannot break; weapon parts count toward health.

Causes found: the dying sound is `FX-fizz-out` (3 s of crackle); B06's
delay is `spinUp` 0.25; dart orientation is set only at launch and rest;
`explode()` carves only the level, ignores walls, shoves in one step and
cannot chunk; the `dart` blast profile has no push; `kinds.weapon.total`
is 0.5; F11's shield armour turns darts whole so only parries break it.

Cards: PT-04 sounds and B06 (dgx-spark), PT-05 explosions (DeepSeek),
PT-06 dart look (qwen-machine), PT-07 weapons and the F11 shield
(dgx-spark after PT-04). The blaster hold positions are done by Claude
in the browser (they need looking at).

### 2026-11-09: PT-03 review, merged (Claude Opus 5.5): impact from overkill and distance, B03, punch-through

- dgx-spark began it and its model server went down (502) halfway
  through stage 1; the partial work was saved (d5e7cd2). qwen-machine
  (Qwen 3.8-27B) finished all three stages in about six hours.
- **Fix: the chunk band only worked for three blasters.** A kill between
  `chunkAt` and `popAt` blew a hole only when the shot carried a `chunk`
  block (B01 slug, B02 heavy, B03); every other blaster just went down.
  It now carves with the Foamer-wide `catastrophic.chunk` numbers. Seen
  on the range: a B05 heavy round through the pierce row chunked the
  first F01 (impact 0.54). New test (b03.test.ts 5); chunk.test.ts 8,
  which asserted the old gap, updated.
- Played on the range (pane hidden, stepped by hand):
  - B03, one barrel at 1.5 m: F01 pops (impact 15.5); F05 chunks, 54
    damage (0.79); F08 takes 33, two barrels down it; F11's shield takes
    most of it (11).
  - B03 at 15 m: one barrel took an F12 from 25 to 9. **Damage does not
    fall off with distance**; only the impact does (the card's rule).
  - B01 slug: through the first F01 of the row, killed the second.
  - B05 heavy: through all three of the row.
- **For Paul to tune:** qwen-machine set `buck` damage to 11 a pellet,
  not the card's 3: at 3 the 7 degree scatter rarely gave the worked
  examples. A full point-blank barrel can do 88. `data/foamers.json`
  test.damage.buck.
- 934 tests pass (2 skipped) three times running, tsc and build green.
- Not checked by eye: the pop and chunk sizes on screen, the exit hole
  of a punch-through, the feel of B03 at mid range.

### 2026-11-09: PT-03, one impact scale to judge every kill (Qwen 3.8-27B via Pi, dgx-spark, branch `pt-03`, three commits, not merged)

- **The task.** `tasks/PT-03.md`: one impact scale from overkill and
  distance decides down, chunk or pop and how big; B03 fires `buck`
  pellets that hit far harder close in; B01 slugs pierce; punch-through
  carves right through and the range gets a pierce row. Another model
  started stage 1 (commit d5e7cd2, stopped mid-route when the server
  went down); its engine side stood and was kept. Its failures went in
  order, and each one was recorded here.
- **Stage 1 (b1112c5).** Four failures on the list, looked at one
  by one; the fix was on the test side of every one (the commit
  touched the five test files, and only the test files). (a) tsc: the
  unused `foamerData` import in `tests/audio/game-sounds.test.ts` was
  removed. (b) `tests/foamers/foamers.test.ts` 8b: the test was
  asserting the old pop rule (three standard darts burst, from the
  `popTypes`'s share), but that rule is no longer there. The new card's
  code is right; the test was rewritten to the new rule: a
  `precisionHeavy` raw dart against an F that a suction dart had already
  cut to half health has impact 1.58 and clears `popAt`. (c)
  `tests/range/lineup.test.ts` (Respawn restores the whole line): the
  kill was one max blast against a healthy F09, and since a kill with no
  overkill is now down (not pop), the downed Foamer stays in the list
  and `list.length` does not drop. The test keeps its reason (respawn
  refreshes the line where a member has gone down) and gives the kill
  enough overkill (three max blasts) that a pop happens. (d)
  `tests/weapons/b05.test.ts` 8 (the heavy mod passes three Foamers):
  the code was right, the test was fragile. The heavy darts killed the
  first two Foamers, which respawned into the same hole in the list;
  the damage count was position-based and was reading the replacements.
  The damage is now counted by identity. The pierce tests 6 and 7 pass
  unchanged: a piercing dart that still has pierce
  left to spend goes on to the next Foamer, whatever the kill does to the one it leaves.
- **Stage 2 (58c4228).** B03 gets its own dart type `buck` in
  `data/darts.json` (the standard dart's profile, `carveRadius` 0.14,
  `pierce` 0) and its own `impact` block in `data/blasters.json`
  (full 3, zero 12; the shared block stays a default of 2 to 10). The
  tune the test forced (the card told us to tune and say so): the test
  block's line for `buck` is **11**, not the card's worked 3. At
  3, a real 7-degree burst of 8 pellets mostly lands on the legs and
  the half-share chest, and the F01 survives it, so a point-blank pop
  never comes out on the real rig (the worked math only holds if the
  whole barrel lands on one part; the test notes the real scatter reads
  impact about 4.2, which pops either way). B01's slug mod is now its
  own dart type `b01slug` (the slug's profile with `pierce` 1): its
  slug knocks through, B02's (a plain `slug`, `pierce` 0) does not,
  and the mods no longer share one dart type across two blasters.
  New: `tests/foamers/impact.test.ts` (10 pure-math tests against the
  card's worked numbers, including an explosion kill read at `near` 1),
  `tests/weapons/b03.test.ts` (the card's cases driven by a real B03:
  point blank, one barrel pops a fresh F01; point blank, both barrels
  take a fresh F05 to a chunk; 15 m neither pops nor chunks; 15 m a
  fresh F05 survives the burst with health left; the spread is the
  type's real 7, so the seed is pinned to the run that lands each case),
  and `tests/weapons/slug-pierce.test.ts` (a b01slug meets the first
  F01 and then the one right behind it, and does not reach the third;
  the B02 heavy keeps the plain slug, pierce 0). Gate green: tsc,
  133 files / 930 pass / 2 skipped, build.
- **Stage 3 (4d81527).** The punch-through becomes visible. The dart
  gets an `onPierceExit` hook (`src/weapons/darts.ts`): when a dart
  exits a body it has punched through, it walks its own flight line
  forward through only that body's own colliders, up to 12 m, and hands the exit point to the
  Foamer system (`handlePierceExit`), which carves it there
  (`handlePierceExit`, no debris: the burst's chunks would clog the
  hole's mouth and stop every dart that still has pierce left to spend).
  The carve looks for a live part that owns the exit collider; no part,
  no carve. A `pierceRow` in `data/range.json` (three F01s, 9.5
  m ahead of the player, 1.5 m apart, one behind another, nearer than
  the 15 m arc so it does not block it) is built by
  `createPierceRow` in `src/range/setup.ts` (the cap is shared with the
  line) and `respawnLineup` restores it. `tests/weapons/punchthrough.test.ts`
  proves a slug leaves the near and far face of the head open, that
  the exit lies behind the entry along the dart's own line, and that
  the carve emptied voxels that were solid before the shot.
  `tests/range/lineup.test.ts` covers the row's placement and the
  respawn. Gate green: tsc, 134 files / 933 passing / 2 skipped,
  build.
- **The tests as the card set out:** the impact rule (overkill, the
  three outcomes, the debris and pop boosts, `near`) is tested by
  `tests/foamers/impact.test.ts`. B03's point blank pops an F01, both
  barrels chunk an F05, 15 m does neither (`tests/weapons/b03.test.ts`).
  The slug pierces (`tests/weapons/slug-pierce.test.ts`). B05's
  precision and precisionHeavy counts (`tests/weapons/b05.test.ts`
  6 and 8, passing through the new code). A blast kill is read as
  `near` 1 (`impact.test.ts` 7). The punch-through is visible
  (`tests/weapons/punchthrough.test.ts`). The row and the respawn
  (`tests/range/lineup.test.ts`).
- **Could not check by eye:** no images, no browser open. Whether the
  hole reads as a punch at game speed, how the burst feels on the B03, and the row
  reads on the range are test numbers here. They are for the reviewer.
- **The docs.** PLAN.md's PT-03 line says done, not merged, section 14
  got three decisions (stage 1's rule, stage 2's dart types, stage 3's
  carve), and the D12 line got a PT-03 amendment. Since the card was
  written, PT-01 and PT-02 are merged: the line is an arc and a head off
  means down, so the row is straight ahead inside the arc, nearer than
  the line, and the exit carve has to handle a killed body (it carves
  no live part, and the tests show the pierce counts are unaffected).

### 2026-11-08: PT-02 review, merged (Claude Opus 5.5): head off means down

- dgx-spark did it in about 45 minutes. The rule sits in `breakPart`, so
  every cause counts (dart, wear, blast). The head-and-arm rule and the
  headless turn rate are gone. Every head in the rigs hangs straight off
  the root body, so no head can leave with another part unnoticed.
- Played on the range with precision darts at the head: the F07 went
  down at 29/45 health, the F11 at 28/60, the F12 at 5/25, each the step
  its head broke.
- Review fix: the time-to-kill panel repeated the id for a type with no
  name ("F12 F12"), as the labels did.
- Behaviour change to know: a downed Foamer's parts no longer break off
  (it is a ragdoll by then); dgx-spark added it so a second break in one
  step cannot stagger it back up.
- For Paul: the F05 Darter's face is its root part (kind head), so
  breaking it now downs the Darter. Set `headOffDowns: false` on F05 if
  it should fight on. `src/sandbox/main.ts` still describes the old
  head-and-arm rule in its preview text (not changed).
- 916 tests pass (2 skipped) twice, tsc and build green.

### 2026-11-08: PT-02, a Foamer that loses its head goes down (Qwen 3.8 Flash Next via Pi, dgx-spark)

Asked for (card `tasks/PT-02.md`): Paul's playtest, "some enemies keep
moving after they lose their heads. (A blown off head should be death...)".
Losing the head now downs a Foamer at once, whatever its health, replacing
D12's head-and-an-arm rule.

Built. The rule is one check in `Foamers.breakPart`, after the part has
gone out as a foam piece: `part.spec.kind === "head"` and the type's new
`headOffDowns` flag, then `goDown`. One choke point rather than a check at
each call site, so every cause counts: a dart (`handleHit`), the
once-per-step wear check in `update`, the parry (`parryAttack`), and a
blast or a chunk that carves the head away, which breaks the part on the
next step's wear check. `goDown` is the ordinary down path: same topple,
fizz and dissolve, same `down` sound, same `downed` list and spawner
accounting.

Decisions.
- **The pop still wins a tie.** `handleHit` checks the health before the
  part break, so a catastrophic hit that also takes the head pops as it
  does today. `goDown` and `pop` are each once per Foamer (both return
  early or remove it from `list`), so the kill counts once. Test 4 of the
  new file fires a dart that spends the last 1.5 health and breaks the
  head in one step and asserts `downed.length === 1`.
- **`breakPart` now returns on `f.state === "down"`.** Without it a second
  break in the same step (the head and an arm from two darts, or the wear
  loop) called `startStagger` after the down and pulled the Foamer back out
  of `down` into `stagger`. That is what the range-api clear() test caught.
- **`handicaps.noHeadTurnRate` and `Foamer.hasHead()` are removed.**
  `Foamer.turnRate()` was their only reader, and a living Foamer is never
  headless any more. `handicaps` keeps the leg and crawl numbers.
- **`headOffDowns` (default true) sits in the shared base of
  `data/foamers.json`**, next to `turnRate`, so every type inherits it and
  a boss can set it false in its own `types` block. No boss exists yet, so
  nothing sets it; test 7 flips it on a cached spec to prove the opt-out.
- **"head" is the rig's kind, not the part id.** The F06 blob and the F09
  turret have no kind-`head` part and are not affected (test 2). Test 1
  runs over the ten types whose rig has a breakable head: F01 to F04, F07,
  F08, F10 to F13. The F05 Darter is the case the reviewer should look at
  (test 8): it carries the face on its **root** part (id `body`, kind
  `head`, no parent), and `breakPart` only refuses kind `body`, so that
  part can come off. A probe on the baseline showed what that did today:
  set the root's hp to 0 and the Darter lost every part and stayed alive
  and partless. Under the new rule losing it is losing the head, so it
  goes down, which is what the card asks for ("a blown off head should be
  death"). It is the one behaviour change beyond the head-and-arm rule
  itself. If Paul wants the Darter to keep fighting without its face, set
  `headOffDowns: false` on F05, and the partless-alive state comes back
  with it.

Tests. New `tests/foamers/head-off.test.ts` (8 tests): every headed type
goes down with its health untouched and counts once; a headless type keeps
walking; an arm alone does not down it; the tie case above; the carved
head; the flag's default; the opt-out; the F05's root-part face. Existing
tests changed: `parts.9` asserted the headless turn took 1.7 to 2.3 times
as long, which is the
removed handicap, so it now asserts the head downs it and the turn rate is
the spec's; `parts.13` (head and an arm) keeps its shape but its wording
and its expectation are the new rule; `weapons/b05.10` fired a standard
dart through one F01 at a second and expected one hurt, which only held
because the first F01 survived the hit, so it now pins the first one's head
hp so the test measures what it always measured (a dart stops at the first
Foamer) instead of the new rule.

Not seen by eye: no browser and no dev server here, so nobody has watched
a headless Foamer topple, fizz and dissolve, or heard the `down` sound
fire on a head shot, or checked the ragdoll of a Foamer whose head left as
a piece a step before the topple. The reviewer should watch a head shot on
the range and listen.

Not touched (outside the card's files): the sandbox preview
(`src/sandbox/main.ts:219`) still shows the old head-and-arm rule, and
`tasks/ENG-10.md` and `tasks/ENG-12.md` still describe it. The sandbox is a
look-and-feel preview, not the game's rules; say the word if you want it
changed too.

916 tests pass (2 skipped), `npx tsc --noEmit` and `npm run build` green.

### 2026-11-08: PT-01 review, merged (Claude Opus 5.5): the rebuilt range

- dgx-spark built all three stages in about 1.5 hours.
- **Fix: the line of Foamers was invisible where it stood.** A held
  Foamer skipped `stepFoamer`, where its pose is solved, so the page drew
  every one in a heap near the origin while their colliders and labels
  stood in the line (darts would hit nothing you could see). The held
  branch now solves the pose. A new lineup test renders between two steps
  as the page does; it fails without the fix.
- **Change: the line is an arc** round the player's start, every Foamer
  15 m away, 3 m apart along it. A straight row put the end ones at 28 m
  and the middle at 15 m, which skews a time to kill (and PT-03 makes
  damage fall off with distance).
- The frame graph showed on the default page: it is now behind `?bench`
  with the other tools (Backquote still toggles it).
- Labels no longer repeat the id when a rig has no name ("F09 40/40").
- **Flaky tests fixed** (they failed about one run in four, before this
  review too): the time-to-kill tests aimed at 1.2 m, the top of an F01,
  with B01's random spread; the five-kills test reused one spot where the
  last round's pop debris could take the dart. The tracker now keys
  Foamers by the object, not the physics handle (handles are reused).
  Full suite green 8 runs in 8.
- Played in the browser (pane hidden, stepped by hand): the menu's mod
  buttons light and toggle the blaster's mods; the line of 13 stands
  still with labels; B07 explodes on the range (a round 1.4 m from the
  F09 took it from 40 to 25).
- Not checked by hand: the wheel and keys in real play (the pane cannot
  lock the pointer), the time-to-kill panel's look, `?bench`.
- 908 tests pass (2 skipped), tsc and build green.

### 2026-11-08: PT-01, the range rebuilt for time-to-kill testing (Qwen 3.8 Flash Next via Pi, dgx-spark)

Asked for (card `tasks/PT-01.md`): every blaster cycleable by keys and
wheel, one of every Foamer in a line standing still, a time-to-kill
readout, a menu with only mod toggles and Respawn, and B07 and every
explosive shot exploding on the range. Three commits on `pt-01`, not
merged, not pushed: `51f4c28` stage 1, `32ece38` stage 2, `7bc462a`
stage 3.

Built. Stage 1: `src/range/setup.ts` (`createRangeSystems`,
`fillReserves`, `createLineup`, `respawnLineup`) holds the wiring the
page used to do inline, with no DOM, so a headless test builds what the
page builds. The real bug behind "B07 never explodes": the range made
its `DartImpacts` with no `ExplosionSystem`, so B07's rounds, B05's
explosive mod and B06's every fifth shot landed as plain darts. Ammo is
now `fillReserves` (reserve refilled, magazine and reload honoured) so a
measured time to kill includes its reloads. Stage 2: the lineup is one
Foamer of each type in `data/foamers.json` order at
`range.lineup.distanceMetres` (15) and `range.lineup.spacingMetres` (4),
held still by `FoamerSystem.held` (the one edit outside `src/range/`: a
set that gates brain, walk, attack, throw, heal, hover), and
`src/range/labels.ts` puts a div per Foamer in `#hud` showing name and
health. Stage 3: `src/range/ttk.ts` (`TtkTracker` wraps `darts.fire` and
subscribes to `darts.onHit` last; `TtkPanel` writes the last five kills
into `#ttk`, newest first) and `src/range/menu.ts` (`RangeMenu` model +
`RangeMenuPanel` view: the active blaster's name, one lit button per mod
of it, Respawn). The old switches, spawn buttons, type picker, dart-type
row, sound rows, report and frame graph moved into `#benchTools`, shown
only for `range.html?bench`; a click on the canvas takes the lock again.

Decided (PLAN.md section 14): a held set rather than a new Foamer state;
reserve refill rather than magazine refill; a div per label rather than
a text texture; the tracker wrapping the dart system rather than the
Foamer carrying bookkeeping; the menu as a model with no DOM plus a
view; the old tools behind `?bench` rather than deleted. Tests:
`tests/range/ttk.test.ts` (a real B07 round explodes and kills, a
magazine empties and a reload costs time, shots and pulls counted
rightly, one kill per Foamer, the last five kept),
`tests/range/menu.test.ts` (the mod list follows the blaster) and
`tests/range/page.test.ts` (every id `main.ts` looks up exists in
`range.html`, and no bench-only id is on the default page).

Green: `npx tsc --noEmit` silent, `npx vitest run` 1074 passed (95
files), `npm run build` ok (chunk-size warning only), no em or en dash
in any touched file.

Not checked by eye (no browser, no dev server, cannot see images): the
menu's look and that its buttons answer a click, the lineup's placement
and that the labels sit above the right Foamers, that B07 and the
explosive mods visibly explode on this page, the time-to-kill panel's
placement and readability, `range.html?bench` still rendering its tools,
the recoil and the ball's bounce feel. The reviewer has to open the page.

### 2026-11-08: Paul's playtest, three cards (Claude Opus 5.5)

Paul played the live site and reported: the range menu is broken (blaster
buttons ignore clicks, mod toggles do nothing), B07 never explodes,
nothing punches through, Foamers keep moving with their heads off, B03
is far too weak and point blank is not catastrophic. He asked for the
range rebuilt for time-to-kill testing and for impact to come from
overkill and distance. Causes found before writing the cards:

- The range builds `DartImpacts` with no `ExplosionSystem`, so no
  explosive shot explodes there (the game pages pass one).
- `catastrophic.popTypes` is empty, so darts never pop; the chunk finish
  needs Heavy or Elite tier and 25% in one shot.
- B03 is 8 darts of damage 1 a barrel: 8 at most.
- B01's `slug` has `pierce: 0`, against CONTENT-PLAN 4.
- Head off only slows turning; D12 downs a Foamer on head and arm.

Cards: `tasks/PT-01.md` (the range), `PT-02.md` (head off downs it),
`PT-03.md` (impact, B03, pierce). All three go to dgx-spark one after
another, each reviewed before the next starts.

### 2026-11-08: GAME-10m stages 3 and 4 review, merged (Claude Opus 5.5): the F12 ambush from a growth, and its sounds

- qwen-machine (Qwen 3.8-27B) ran four hours and wrote about 70 lines,
  so it was stopped; its level format and validator check were kept
  (76eff06). dgx-spark (Qwen 3.8 Flash Next) wrote the rest in about
  three hours (de92c56, 1c25289).
- **Fix: the F12 could not leave its growth.** Played in env-05: it woke
  and crouched, but it was built in the middle of the 1.6 m growth with a
  0.9 m hole round it, so the leap and every step after were blocked and
  it stood there for good. The unit tests only checked its state. It now
  bursts out of the side facing the player: the hole is bitten out where
  that side meets the line to the player, and the F12 stands
  `burstRadiusMetres` outside it. New test: it is born outside the box
  and its pounce closes more than 3 m on the player.
- **Fix: a restart woke it at once.** Carved voxels stay through a
  restart, so the old burst hole read as a new loss. `reset()` now counts
  the growths again. New test.
- Played in the browser (env-05, stepped by hand, the pane hidden): four
  darts into the growth from the start woke it from 9 m; it came out,
  flew about 7 m and landed on the player for 15. Walking up woke it at
  5.6 m and not at 6.4 m. Seen in a screenshot: the F12 out in front of
  the growth, the lime visor showing.
- Wave counting checked by dgx-spark and confirmed: a hidden ambusher is
  never built, so it is in no Foamer list and no counter sees it.
- 876 tests pass (2 skipped), tsc and build green.
- Not checked: the three sounds by ear, the shield block against a burst
  pounce in play, what happens if the side facing the player is against
  a wall (it would be born inside the wall; env-05 has no such growth).
- For Paul: the growth (`foam-purple`) and the F12 (`foam-purple-deep`)
  are close purples, so it may be hard to see it coming out.

### 2026-11-08: GAME-10m stages 3 and 4 (Qwen 3.8 Flash Next via Pi): the F12 Ambusher's ambush, test level and sounds

- Asked for: stage 3 (the ambush from a growth, the validator, the test
  level env-05) and stage 4 (sounds and docs) of `tasks/GAME-10m.md`, on
  top of commit 76eff06 (the `ambushes` list and its validator check).
- Stage 3 (commit de92c56): `src/level/ambush.ts` holds `AmbushSystem`
  and `buildAmbushes`. A hidden ambusher is never built, so it is inert
  in the strong sense the card asks for: nothing to draw, no colliders,
  no brain, no damage to take, and nothing in the `FoamerSystem`'s lists
  at all. Waking (the player's feet within `ambush.wakeMetres` 6 of the
  growth's box, or the growth holding fewer voxels than it was counted
  with at build) carves a sphere of `burstRadiusMetres` 0.9 out of the
  growth, spawns the F12 at the growth's centre through the ordinary
  `foamers.spawn`, and starts the crouch and pounce at the player on the
  spot with `leapCooldown` forced to 0 (the stage 2 path runs the rest).
  The burst's carve goes out through `onCarveReport` to the page's own
  carve path (`g.pieces.afterCarve` and `g.levelAI.carveChanged`), so
  islands fall and the nav grid re-bakes over the hole, as for a dart.
- How the wave and level counters were checked: `src/arena/extras.ts`
  sets `arenaCtx.aliveCount = foamers.live - foamers.downed.length` each
  step and `src/level/arena.ts:194` clears a wave only when the spawn
  grace has run out and `aliveCount === 0`; `foamers.live` is
  `list.length`, and the watch-state `alive` reads the same pair. A
  hidden ambusher is in none of those (it is created only at its wake),
  so it can neither hold a wave open nor end one early. env-05 lists
  `arenas: []`, so its pad completes from the first frame: a hidden F12
  does not delay it either. A woken one is a plain Foamer and counts.
- Two things decided on the way, both in section 14: the growth's voxel
  count is walked at the type's `recheckSeconds` 0.25 cadence, not every
  frame (the distance test still runs every step, and a growth already
  below the level's count needs no walk at all), and a wake blocked at
  the `FoamerSystem` cap carves its hole anyway, so the next step takes
  the lost-voxels path and tries again rather than losing the ambush.
- Validator (`src/level/validate.ts`): ambush ids unique; unknown foamer;
  the growth missing or not of kind `growth`; and a new check that the
  type carries an `ambush` block, so only types that ambush can hide.
  F12's numbers are a new `ambush` block in `data/foamers.json` (6, 0.9,
  0.25), proposals for Paul to tune.
- Stage 4: placeholder IDs `F12-crouch` (the card's low hiss),
  `F12-pounce` (the launch out of the crouch) and `F12-burst` (out of the
  growth) in `data/sounds.json`, with rows in the `design/SOUNDS.md`
  table before the F12 line. `FoamerSoundKind` gains `"pounce"`, sent by
  the crouch-to-leaping transition when the type has a `pounce` block
  (the Brawler's leap stays silent between its crouch and its landing);
  `src/audio/foamer-sounds.ts` plays `F12-crouch` for an F12's crouch and
  `F12-pounce` for the launch; the page plays `F12-burst` where the F12
  came out. `AmbushSystem.wake` sends the `"crouch"` event itself: the
  approach branch would not, since the wake sets the crouch directly.
- Test level `data/levels/env-05.json`: env-01's room (same shell, start
  and pad), two `foam-purple` growths, an F12 hidden in `growth-a`,
  `[Paul]` meta fields as env-03's. Registered in `src/arena/levels.ts`
  (the env-05 name added to the registry list in
  `tests/level/ring-load.test.ts`).
- New tests `tests/level/ambush.test.ts` (11): the file validates and
  lists one ambush in a growth; hidden is inert (lists, `live`, `downed`
  all empty over 60 steps far away); inside `wakeMetres` it wakes into
  the crouch aimed at the player with the cooldown 0 and a hole carved,
  then flies; one voxel lost from the far side of the room wakes it; the
  burst's carve is reported once and non-empty; a restart hides it again;
  the five validator rejections; and the `crouch` and `pounce` events
  fire. 874 tests pass (2 skipped), `npx tsc --noEmit` and
  `npm run build` green.
- Not checked by eye (no browser, cannot view images): env-05 in the
  arena (`?level=env-05`) was never opened, so the growth's look, the F12
  coming out of it, the crouch read as a telegraph at close range, the
  pounce arc from inside a growth and whether the burst hole reads as a
  burst were all only checked by test and by script. The three new sounds
  were never heard: they are placeholder synths, `files: []`, and
  `tests/audio/data.test.ts` and `tests/audio/synth.test.ts` only check
  the shape renders.
- Look clashes for Paul, two. The card's own (line 16) is unchanged from
  stage 1 and stands: CONTENT-PLAN 3.3 still calls the F12 a long low
  stalker with a tail, Paul's row a lean biped, and Paul's row is what is
  built (noted in the stage 1 and 2 entries). The new one is the ambush's:
  the growths in env-05 are `foam-purple` and the
  F12's body is `foam-purple-deep` (`#5b2fb8`), the same hue a step
  darker. An Ambusher coming out of its own growth may read as part of
  it, especially at a distance or in a dark room. Options are Paul's: a
  different growth material (the palette has `foam-lime` and
  `foam-orange`, both of which mean something else in this game), a
  lighter body for the F12, or an outline when it wakes. Left as it is
  until he says.
- Not done here: no other level uses `ambushes` yet, no growth is in any
  shipped level, and the ambush has never been played. Not merged, not
  pushed.

### 2026-11-08: fix: the F11 Seawall read as legless (Claude Opus 5.5)

- Found in the GAME-10m review: `Foamer.legs()` counted only legs whose
  parent is the root part. The F11 hangs its legs from a `hips` part, so
  every Seawall read as legless from the start and walked at the no-legs
  speed. A leg is now a part of kind leg whose parent is not itself a leg
  (a thigh, not a shin). Every other rig gives the same answer as before.
- New test `tests/foamers/legs.test.ts`: every rig with legs starts on
  them (failed on F11 before the fix).
- The Seawall tests had no floor and passed only because the legless
  Seawall did not fall; they now have the floor the other Foamer tests use.
- The F12's legs on the body (GAME-10m) are no longer needed for this,
  and do no harm.
- 863 tests pass (2 skipped), tsc and build green. Not seen in play: the
  Seawall now walks at its full speed, Paul to judge the feel.

### 2026-11-08: GAME-10m stages 1 and 2 review, merged (Claude Opus 5.5): the F12 Ambusher's look and pounce

- **Look fix.** The first render had both arms pointing straight up over
  the head: the arm and claw parts set their pivot near the far end, so
  they grew upward from the shoulder. Pivots back to the default, upper
  arms 13, forearms 10, claws 7 x 8 x 7 voxels, shoulders out to x 1.1 so
  the arms clear the body. Re-rendered `design/foamers/F12-*.png`; it now
  stands with the arms hanging and the claws reaching forward to knee
  height. It still reads chunky rather than lean: Paul to judge.
- **Lime eyes.** The rig has no eye colour, so the lime is a visor bar
  above painted eyes. Paul to say if that reads as "lime eyes".
- **Look clash for Paul:** CONTENT-PLAN 3.3 still says a long low stalker
  with a tail; this follows Paul's F12 row (a lean biped).
- Corrected the docs: `foam-purple-deep` was already a palette material.
  The `hitMetres` comment now says the landing is the one hit check.
- tsc clean, 862 tests pass (2 skipped), build green.
- Not seen in play: the crouch, the arc, the hit, any of it on screen.
  Stages 3 (the ambush from a growth, env-05) and 4 (sounds) not started.

### 2026-11-08: GAME-09g review, merged (Claude Opus 5.5): B08 Firehose on a placeholder model

- Reviewed dgx-spark's run: the data lines are hand-edited in main's
  layout, the slow multiplies beside the shield's own, and Twin
  alternates the muzzles. Fixed in review: a ball that had used its
  bounces stopped dead where it touched, so it could hang on a wall. It
  now takes the ordinary dart path after its budget and falls to rest.
- Played in env-03 (the loop stepped by hand, the pane hidden): the first
  ball leaves 0.78 s into the spin-up, then about 29 a second (36 in the
  next 1.2 s); `firing` is on while held; all 36 balls ricocheted and
  came to rest on the floor (highest at 0.06 m).
- For Paul: B08 still needs its card brief and model (ART-01, ART-04);
  the gameplay uses B04's model until then, a one-line swap. Twin names
  `muzzle_1` twice until B08's model has two muzzles.
- Not checked by eye: the ball's look, the recoil at 29 a second, the
  slow in hand, the sounds.
- tsc, vitest (843 passed, 2 skipped), build green.

### 2026-11-08: GAME-09g: B08 Firehose gameplay on a placeholder model (Qwen 3.8 Flash Next via Pi, dgx-spark, branch `game-09g`, three commits, not reviewed, not merged)

- Task card `tasks/GAME-09g.md`: the last blaster. Paul's order is every
  enemy and weapon first, so B08 runs on **B04's model**
  (`/models/blasters/B04.glb`, whose flywheels already spin); ART-01 and
  ART-04 give it its own card and model after this. The swap is one data
  line in `data/blasters.json`.
- **Stage 1** (commit 1). The `ball` dart type in `data/darts.json`: speed
  30, gravityScale 0.45, drag 0.25, radius 0.06, `shape: "ball"`,
  restitution 0.6, `bounces` 2, carve 0.12, impulse 0.8, and its one line
  in `data/foamers.json`'s shared `damage` block (`ball`: 1.5). It is a
  sphere in `src/weapons/dart-model.ts` (a `shape` branch, the dart shape
  otherwise untouched). The ricochet in `src/weapons/darts.ts`: a ball
  bounces off a hard surface with restitution of its speed up to `bounces`
  times; the contact after the budget ends it, so it stops where it
  touched, on any surface, and falls into the resting state like a dart
  that has landed. It does **not** fire `onDartRest` there: that event is
  a spent dart landing on the floor (the DT-floor sound), not a ball
  stopped against a wall. On a Foamer it damages once and bounces off with
  what is left. `maxLive` still holds: at 28 a second the pool fills and
  the oldest goes, as today.
- **B08 entry:** Firehose, auto, ball, 1/shot, 120 / 240 (start 120),
  `spinUp` 0.8, `fireInterval` 0.035 (about 28 a second), `spinDown` 1.2,
  reload 3.0, heavy recoil (spread 0.9/shot to 14, climb 0.6/shot to 10,
  well above B04's), `fireMoveShare` 0.6, key 8, at the end of `order`.
- **The movement slow, and the decision behind it.** The controller gains
  `fireMoveScale`, a second scale multiplied in beside `speedScale`, which
  `src/player/shield.ts` owns and rewrites every step, so B08 never writes
  there and the two slows combine rather than replace. `src/game/game.ts`
  feeds it: `loadout.active.firing ? spec.fireMoveShare : 1`, and 1 while
  switching. `Blaster.firing` is new: true for an auto blaster with the
  trigger held and the wheels up to speed, cleared for every other mode.
  A test walks the player on a floor with each scale and checks the product
  (`tests/weapons/b08.test.ts` 7 and 8).
- **Stage 2** (commit 2). `control` (Paul: recoil control, reduced movement
  penalty): `spreadPerShot` 0.2 / `spreadMax` 6 / `climbDegPerShot` 0.15 /
  `climbDegMax` 4, `fireMoveShare` 0.85, recovery kept (the block merges
  key by key). `twin` (Paul: second barrel, 2x rate): `fireInterval`
  0.0175 and a two-entry `muzzles` list; the auto shot already round-robins
  `spec.muzzles`, so a one-muzzle blaster is unchanged and Twin needs no
  new mode. Measured: 115 balls in 2 s against the bare 58.
- **Says so in the record, per the card:** the placeholder model has one
  muzzle node, so **both of Twin's entries name `muzzle_1`**. Both barrels
  draw from the same point until B08's own model exists, and
  `tests/weapons/b08.test.ts` says it too. The test's muzzle callback maps
  any index onto the one point for the same reason.
- Sounds `B08-fire` (a fast soft thud, `maxVoices` 10 because the rate is
  high) and `B08-spin-up` (a rising whirr over the 0.8 s spin-up) in
  `data/sounds.json`: synth placeholders, `files: []`. `B08-fire` plays
  through the page's existing `<id>-fire` convention (`watchFire`);
  `B08-spin-up` plays nothing yet, exactly as `B06-spin` does, because
  `src/audio/game-sounds.ts` has no per-blaster spin loop. That wiring
  belongs to the audio pass.
- env-03 gains `station-b08` (B08's `control`) so the per-mod-station test
  in `tests/arena/stations.test.ts` stays green with eight blasters.
- **Tests:** 11 in `tests/weapons/b08.test.ts` (the ball reads its type;
  it bounces off a wall at restitution and rests on the third contact;
  a Foamer takes the ball damage once and the ball goes on flying; B08
  reads its spec; nothing fires until spun up, then about 1 / `fireInterval`
  a second; release spins down; each mod does what the card says; B04's
  numbers untouched). `tests/weapons/b05.test.ts` had one line to update:
  its `order` expectation (B08 joins at the end, key 8), the same line each
  blaster task has touched before. Gate at every stage: `npx tsc --noEmit` clean, `npx vitest
  run` 115 files / 820 passed, 2 skipped, `npm run build` clean, no em or
  en dash in any file touched.
- **Not checked by eye (this run has no browser, and starting a dev server
  was out of scope):** the ball's round look on screen and its colour, the
  ricochet feel and whether 2 bounces reads right at 28 a second, whether
  balls bouncing in a small room feel chaotic or noisy, the viewmodel (it
  is B04's model at scale 0.8, so its placement numbers are a first guess
  and its flywheels are B04's, not gatling barrels), the recoil pattern and
  whether the climb at 28 shots a second is uncontrollable, the spin-up
  timing in the hand, the movement slow against the shield's slow, and
  every B08 sound (neither has been heard).
- Open for the review: `bounces` 2 ends the ball on the **third** contact
  (the third is the one that stops it). If Paul wants exactly two visible
  hops and a drop, that is a one-line change in `src/weapons/darts.ts`.
### 2026-11-08: GAME-10m stages 1 and 2 (Qwen 3.8-27B via Pi): the F12 Ambusher's look and pounce

Two commits on `game-10m` (in its own worktree), not reviewed, not merged,
not pushed. Stage 1 (230ae3a): the look and the type. Stage 2 (db592ce):
the pounce. `tools/f12-check.ts` measured the rig 2.22 m at stage 1 and
2.14 m after the stage 2 leg reparent (the rest solve shifted slightly);
either way it stands over the player's 1.8 m.

- **Look (stage 1).** The F12 rig in `data/foamer-rigs.json` is rebuilt
  from the greybox stalker to Paul's own F12 row: a lean biped 2.14 m
  (the player is 1.8), body `foam-purple-deep`, a narrow head with the
  painted angry eyes (white and foam-ink, the F04/F10 pattern, on the
  +z face) under a lime visor bar, a row of three small orange spines
  down the back, long arms to blunt foam claws, both feet flat-bottom
  on the ground. The `F12` type in `data/foamers.json`: rig F12, health
  25, speed 3, no weak point.
- **Look clash for Paul.** CONTENT-PLAN 3.3 still describes F12 as "a
  long low stalker, spined back, jointed legs, tail, gaping head".
  Paul's own row (a lean biped) wins over the older stalker line, as
  the card says. The spined back is kept; the tail is dropped.
- **Material.** A new `foam-purple-deep` material is added to
  `data/materials.json` (id 13, a dark purple): the palette had no
  dark purple and the row asks for "deep purple ... as dark as the
  palette allows". The orange spines are kept small (each under 0.3 m)
  because orange means weak point or parryable and the F12 has neither,
  so the spines are decoration, not a tell.
- **The pounce (stage 2).** Between 3 and 9 m, in sight and off the
  4 s cooldown (from the start of the crouch, as the Brawler's leap),
  it crouches 0.45 s (the telegraph) and pounces in an arc at where the
  player stood when the crouch began; a landing within 1.2 m of the
  player hits once for 15 through the ordinary hit path (the raised
  shield takes its share; not parryable, no pink). Up close it claws
  for 8 (falling back to a headbutt when a forearm is gone). Both legs
  gone: no pounce, it crawls in and claws. All numbers are in
  `data/foamers.json` (`pounce`, `attacks`); the flight speed and arc
  are read through `pounceOf` in `src/foamers/pounce.ts`, and the
  decide is `decidePounce` in `src/ai/f12-brain.ts`. The crouch and
  leaping states are the Brawler's, re-used: the Brawler lands short of
  the player's spot (it sends the ring out) and the Ambusher lands on
  the spot (the landing is the hit); the pounce path never touches the
  shockwave code. 14 new tests in `tests/foamers/pounce.test.ts`.
- **The legs.** The F12's legs are parented to the body part, not the
  hips part (same world positions as before), because `f.legs()`
  counts `kind: "leg"` whose parent is the root part
  (`Foamer.legs()` in `src/foamers/foamer.ts`). On the hips part every
  F12 would read legless and could never pounce. The F11's legs have
  the same shape and are parented to its hips part: for its own card
  to check, not this one.
- **Not seen by eye.** No browser was run in this session (card rule).
  The `design/foamers/F12-*.png` renders, the crouch and flight poses,
  the pounce arc, the claw and the hit feel were not seen or played:
  the look is checked by script (`tools/f12-check.ts`: height, feet on
  the ground, spines on the back, eyes on the forward face) and
  `tests/foamers/ambusher.test.ts`; the flight and the hit by
  `tests/foamers/pounce.test.ts` only. The crouch sound is the shared
  `F07-crouch` until stage 4; `F12-crouch`, `F12-pounce` and
  `F12-burst` are added there.
- **Left in a later run.** Stage 3 (the ambush from a growth, the test
  level `env-05.json`, the validator) and stage 4 (the sounds and the
  docs) start fresh after review of these two stages.
- **Environment.** `dgx-spark` works in parallel in its own worktree on
  `src/weapons/`, `src/player/controller.ts`, `src/game/game.ts`,
  `src/range/main.ts`, `data/blasters.json` and `data/darts.json`; none
  of those were touched here. The machine is shared with other test
  runs: a timing test that fails under load is re-run on its own
  before it is treated as a bug.

### 2026-11-08: GAME-10l review, merged (Claude Opus 5.5): the F13 Biomechanic, all stages

- Reviewed qwen-machine's stages 3 and 4. The two stage 2 flags are done:
  the blob spacing and drift are data (`blobSpacingMetres`,
  `blobDriftMetres`), and a Biomechanic with its wand broken heals nobody.
- Fixed in review: a spray's hits kept landing after the player stepped
  behind cover mid-run. Each hit now needs the player in sight (test 18b,
  which fails without the fix).
- Merged main in (B07, ART-05a, ART-05b); PLAN and HANDOFF conflicts kept
  both sides. Dropped a stale "Started" ENV-02 row that was already
  doubled on main.
- Played: not possible with the pane hidden (the physics world and the
  Foamer build only step in the render frame). The heal and the spray are
  covered by the unit tests, which drive the real Foamer system and
  physics. The look was checked from the stage 1 renders
  (`design/foamers/F13-*.png`): hood, tank and antenna on the back, wand
  in hand; the arm proportions are greybox and stay for Paul.
- Not checked by eye: the stream and the spray in play, the three
  placeholder sounds.
- tsc, vitest (832 passed, 2 skipped), build green.

### 2026-11-08: GAME-10l stage 3 and 4 (Qwen 3.8-27B via Pi): the short spray, the tank gone, the sounds, the docs

- **Asked for** (`tasks/GAME-10l.md`): stage 3 (the spray at the player,
  the tank gone, the sounds) and stage 4 (the docs), plus two review fixes
  from the stage 1 and 2 review, each with a test: the blob chain's
  spacing and drift are tuning numbers in `data/foamers.json`, not in
  code, and a Biomechanic with the wand broken off does not heal at all.
- **The spray.** With no ally to heal and the player inside the spray's
  range (5 m) it winds up (0.6 s, the telegraph, the player's window to
  raise the shield) and lays on the spray for its own time (1.2 s): 6
  damage a second, one hit (3.6, `round(seconds / tick)`, 2 of them) every
  `tick` (0.6 s, past the player's 0.5 s post-hit grace so the run pours
  through) through the page's ordinary hit path (the bonk path as
  `src/game/game.ts` wires it: the shield's block and its share, the melee
  parry decider, the player's health). The raised shield takes its share,
  the spray is not parryable. The run is the strike, the `spray` attack in
  the data (`windup`/`strike` read the block), the numbers in F13's `spray`
  block read by the new `src/foamers/spray.ts` (`sprayOf`, `canSpray`, the
  wand is the nozzle, the tank the press: either one missing is no spray).
- **chooseAttack.** The `healStream` is the attack while there is an ally
  to mend, one it holds or one it is walking in (the ring ride runs on
  its 10 m windup: with it skipped the engagement range reads as
  5, which stops the windup at the ring, and the ring walk toward a hurt
  ally dies with it. Caught by stage 2 test 14, fixed; the traces of both
  states were checked against each other). With no ally the wand is the
  spray's; with the tank or the wand missing the bonk remains.
- **The tank gone.** No healing (stage 2), no spray, and the brain's
  distances close to the bonk's reach (stage 2), so the wand closes in
  and bonks. The tank breaking plays `F13-tank-break`.
- **Review fixes.** 1: the blob chain's spacing and drift went from
  code constants (`BLOB_SPACING`, `BLOB_SPEED` in `src/foamers/heal.ts`)
  to the `heal` block (`blobSpacingMetres`, `blobDriftMetres`); test 6
  reads them. 2: `canHeal` now needs the wand as well: no tip to pour
  from, and a stream nobody can see is no stream (a rule, PLAN section
  14); test 15 covers it (the target is dropped, the chain is hidden, the
  ally's health does not move, and the ring closes to the bonk's reach).
- **The sounds.** `F13-heal` is a loop owned by the audio state
  (`src/audio/foamer-sounds.ts`): it runs only while the chain is actually
  drawn (the held target and the chain's visibility), so it starts and
  stops with the stream. `F13-spray` is one puff as the run starts.
  `F13-tank-break` plays on the break, over the generic part thump (the
  sword-break's pattern). Placeholder synths in `data/sounds.json`, the
  rows in `design/SOUNDS.md`.
- **The docs (stage 4).** The GAME-10l row in PLAN.md reads that all
  stages are done, and the section 14 decisions record the hit read as
  perSecond over the seconds through the run's tick, the healStream's
  ring-ride condition, the tank gone and the wand-gone no-heal rule.
  The status above is updated.
- **Tests.** A new `tests/foamers/biomechanic-spray.test.ts`, five: the
  spray's numbers and its needs, the run landing in whole rounds of
  perSecond-over-seconds, a raised shield taking the block share and the
  spray not being parryable, no spray while the stream is held, and the
  tank gone with no spray and the wand closing in to bonk. The heal tests
  carry 6 (the blob numbers), 12 (tank gone) and 15 (wand gone). All 22
  F13 tests are green. `npx tsc --noEmit`, `npx vitest run` (763 passed,
  2 skipped) and `npm run build` are green, and the dash check comes back
  empty. No dev server was run in this session (card rule).
- **What I did not check by eye:** the stream's look and the spray's
  moment. This session cannot see images and cannot open a browser, so
  the spray is verified by the tests only. The three sounds were never
  heard. Nothing was played.
- Stage 3 and the docs (stage 4) are committed to `game-10l`, not
  reviewed, not merged, not pushed. The task card is done in all stages.

### 2026-11-07: GAME-10l stage 2 (DeepSeek V4.1 Flash via Pi): the Biomechanic's healing stream

- **Asked for** (`tasks/GAME-10l.md`): stage 2 only, the healing stream.
  Stage 3 (the short spray at the player, and the docs) is next.
- **What it does.** Every `heal.pickSeconds` (0.5 s) F13 looks for the ally
  with the lowest health share that is below full, inside its 7 m heal
  range and in sight, turns to it and pours `heal.perSecond` (5) health a
  second into it, one ally at a time and never above its maximum. The
  stream is a chain of foam-core blobs from the wand tip to the ally's
  chest, at most `heal.blobCap` (12), drawn only while it is healing.
  Without the antenna the range halves to 3.5 m; without the tank there is
  no healing and it closes in to bonk, as before.
- **Moving.** With nobody in reach it walks its ring toward a hurt ally it
  can see, taking the stride side that closes on the ally, and it never
  steps inside its 10 m kept distance (the circle branch of
  `steerAgent` refuses the inward step for a healing type).
- **Numbers** live in F13's `heal` block in `data/foamers.json` and are
  read by the new `src/foamers/heal.ts` (`healOf`, `canHeal`, `healRange`,
  `healthShare`, `HealStream`, `wandTipPoint`). No number is in code except
  the blob spacing and drift speed, which are look constants.
- **Two decisions.** Aim is by health share, not by health missing: a 5 of
  35 F06 outranks a 20 of 25 F13. The target is held until it is full, dying,
  out of range or out of sight rather than re-picked every look, because
  two equally hurt allies otherwise traded the stream on every look and
  neither healed (seen in the tests).
- **Sight.** The ray is cast the full length and accepts a first hit on the
  ally's own capsule; a ray to a standing body cannot stop short of it the
  way the player's sight stops short of the player, so the shared margin
  gave no ally ever (the first version's bug, caught by the tests).
- **Tests.** New `tests/foamers/biomechanic-heal.test.ts`, nine: the
  numbers and the cap, the most hurt ally by share and the turn to it, no
  target when full, stopping at the maximum, one ally at a time, out of
  range and out of sight, the antenna halving the range, the tank ending
  it plus the ring closing to the bonk, and the blob cap at the far edge.
  `npx tsc --noEmit`, `npx vitest run` (757 passed, 2 skipped) and
  `npm run build` are green.
- **Not checked by eye:** the blob chain, its drift, and the moment the
  stream appears and goes. No browser and no images in this session, so
  the stream was checked by test only. Nothing was played.
- Stage 2 is committed on `game-10l`, not reviewed, not merged, not
  pushed.

### 2026-11-07: GAME-10l stage 1 (DeepSeek V4.1 Flash via Pi): the F13 Biomechanic's look, type and tank

- **Asked for** (`tasks/GAME-10l.md`): stage 1 only, the Biomechanic's
  palette look with a hood, its `F13` type on the keep-distance brain at
  about 10 m, and the tank as its weak point. Stages 2 (the healing
  stream) and 3 (the spray and the docs) are next.
- **Look.** The rig's material is `foam-orange` and the tank `foam-lime`,
  the antenna and the wand `foam-purple` with the wand's three-voxel tip
  left `foam-core`, and the legs purple. The hood is a new `kind:
  "detail"` part on the head, an ellipsoid of 15 x 9 x 15 voxels with
  `taper [1, 0.6]` at `[0, 0.6, -0.1]`: measured from the solved rest
  pose it sits over 78 of the 80 crown voxels and leaves all 26 eye
  voxels (white and ink) showing. A narrower taper, `[0.9, 0.55]`, covered
  71 and pushing the hood back dropped it to about half, so the hood
  stays forward and wide.
- **Type.** `data/foamers.json` gains the `F13` entry: rig F13, the
  rig's health 25, `preferredDistanceMetres` 10 and
  `retreatDistanceMetres` 5, `weakpoint: { parts: ["tank"], damage: 2 }`.
  Its first attack carrying a token is `healStream` (token `ranged`, no
  damage, `needs` the tank), which is what makes the system pick the
  keep-distance brain, so no brain code was written; the `bonk` is last,
  so a tankless one still fights. Stage 1 declares the stream and does
  not fire it: two lines in `src/foamers/foamers.ts` keep it out of the
  player's windup and excuse it from `flightClear`, the way the F10's
  homing shot is excused, because the target is an ally.
- **Rendered** `design/foamers/F13-{front,side,back,three-quarter,sheet}.png`
  with `npx tsx tools/render-rig.ts F13`.
- **Tests.** `tests/foamers/biomechanic.test.ts` (palette, hood coverage
  and the eyes showing, the tank behind the body and the wand in the
  right hand with a foam-core tip, the type reading its own spec, the
  tank taking 2x where the body does not) and
  `tests/ai/biomechanic-brain.test.ts` (the keep-distance brain on its
  own distances, and 20 s of walking that never comes inside the
  retreat distance). `npx tsc --noEmit`, `npx vitest run` (748 passed,
  2 skipped) and `npm run build` are green.
- **Not checked by eye:** the five PNGs and the look in the game. This
  session had no browser and cannot view images, so the hood, the tank
  placement and the wand were checked by script from the solved rest
  pose only. The hood has not been seen on the model, and nothing has
  been played.
- Stage 1 is committed on `game-10l`, not reviewed, not merged, not
  pushed.
### 2026-11-08: ART-05b review, merged (Claude Opus 5.5): reload tilts, B07's reload drum, mod motion, and the fire kick

- Reviewed dgx-spark's run. Fixed in review:
  - B07's reload drum turned smoothly through the whole reload, so it sat
    between chambers part way through. Each round now has an equal slot:
    the drum turns its chamber over the first half and sits on it for
    the second (test 5b).
  - The run flagged a real bug it was told not to touch: `springKick` was
    handed a fresh object literal and its result dropped, so no blaster
    ever kicked back or tipped up on a shot. Fixed in its own commit: the
    spring works on a member and snaps to rest within a thousandth of the
    kick; the B01 test now checks the kick shows.
- For Paul: the spring as written peaks near kick / e (B01: 0.9 cm for a
  `kick` of 0.04), not at `kick`, so every blaster's kick reads about a
  third of its brief's number. Raise the `kick` values, or say if `kick`
  should mean the peak and I will change the spring.
- Checked on the real glbs in env-03 (the loop stepped by hand, the pane
  hidden): B01 kicks back 0.9 cm; B02 rolls 8 deg right and B04 8 deg
  left at mid reload, both back to exactly rest; B07 reloading three
  rounds turns 60, 120, 180 deg, holding on each chamber.
- Not checked by eye: how the tilts and the kick look on screen.
- tsc, vitest (809 passed, 2 skipped), build green.

### 2026-11-08: ART-05b (Qwen 3.8 Flash Next via Pi, dgx-spark): reload tilts, B07's reload drum, B02 heavy's motion

- Asked for: the rest of the "Motion (for ART-05)" briefs after ART-05a
  and GAME-09f (`tasks/ART-05b.md`). Files: `src/weapons/viewmodel.ts`,
  `src/weapons/blaster.ts` (`MotionSpec`, `RawMod`, `resolveSpec`), the
  `motion` blocks and B02's `heavy` line in `data/blasters.json`, and
  `tests/weapons/art-05b.test.ts`.
- Reload tilt: new optional `MotionSpec.reloadRollDeg`. In `animate`,
  while `blaster.state === "reloading"` the root's local Z rotation gets
  `-reloadRollDeg * sin(progress * pi)`, so the blaster eases over and
  back and is exactly at rest when the reload ends (sin is 0 at both
  ends). Decision: folded into the existing root `rotation.set`, not a
  new node or a new helper, because the root is already rewritten every
  frame there.
- Sign, found by test (test 1), as the card asked: `rotationDeg` is
  `[2, 4, 0]` for B02 and `[2, 5, 0]` for B04, so Z is the only free roll
  axis. A positive rotation about the local Z turns the top of the
  blaster to the player's left (the camera looks down -Z), so
  `reloadRollDeg` positive (right, B02) is subtracted. B02 is +8, B04 is
  -8. The test asserts B02's peak is negative and B04's positive, which
  is what "right" and "left" mean here.
- B07's reload drum: the drum's existing index (one chamber per shot,
  eased across the priming) is unchanged. Added `inReload` and
  `reloadRounds`: the first reloading frame records `drumFrom` and the
  round count (`magSize - blaster.mag`, read then, because the magazine
  is only filled when the reload finishes), and `drumA` eases from
  `drumFrom` to `drumFrom + rounds * drumStepDeg` on `blaster.progress`.
  The frame the reload ends lands it exactly on that angle rather than on
  the last frame's near miss, so it never sits between chambers. Decision:
  spread evenly across the whole reload, not across part of it; the brief
  just says one chamber for each round.
- Mod motion: `RawMod.motion?: Partial<MotionSpec>` and one line in
  `resolveSpec` (`s.motion = { ...s.motion, ...mod.motion }`), the same
  shape as the `recoil` merge above it. B02's `heavy` carries
  `{ "kick": 0.035, "slideReturn": 0.18 }`. Data lines hand-edited, the
  compact one-line layout kept.
- Untouched blasters: B01, B03, B05, B06 have no `reloadRollDeg`, and
  test 3 drives each through shots and a reload and checks the root's Z
  rotation never leaves its base value. The ART-05a and GAME-09f tests
  pass unchanged; the whole suite is green (114 files, 808 passed,
  2 skipped), `npx tsc --noEmit` and `npm run build` pass.
- Test notes: `rig2` copies the spec with `autoReload: false` so an empty
  magazine cannot start a reload the test is not asking for; `fireShots`
  holds the trigger (an auto blaster's flywheels need `fireHeld`) and
  re-presses once the blaster is ready and past its interval; the drum
  reader unwraps the turn (a plain angle between quaternions folds every
  360 degrees to zero) and must be read every frame, and reads `2 *
  atan2(q.y, q.w)` for a rotation about local Y.
- Not checked by eye: none of it on screen. The roll direction is only as
  good as the reading above, so Paul should look at B02 and B04 reloading
  and confirm which way they tip; and B07's drum should be watched
  loading six rounds to see the pacing reads as round by round.
- Not verified by test: the root shot kick's travel. Pre-existing, not
  touched here: `animate` calls `springKick(dt, m.return, m.kick, { k:
  this.kick, v: this.kickVel, j: 0 })` with a fresh object literal, and
  `springKick` mutates that literal, so `this.kick` stays 0 and the root
  never moves back or tips (only `kickVel` grows). ART-05a's
  `viewmodel-anim.test.ts` already says so ("skip check of the max kick
  reached in this version"). Left alone: making the kick work would move
  B01, B03, B05 and B06, which this card requires stay unchanged. For
  Paul to decide on, separately. Test 8 therefore checks the heavy
  `slideReturn` by motion and the bigger `kick` through the spec.

### 2026-11-08: ART-05a review, merged (Claude Opus 5.5): B02 slide, B05 bolt, B06 handle

- Reviewed dgx-spark's run: clean, the data lines hand-edited in main's
  layout. One change: the per-frame `seg` closure in `applyBolt` became a
  module function, since the viewmodel allocates nothing per frame.
- Checked on the real glbs in env-03 (the pane was hidden, so the loop was
  stepped by hand): B02's slide goes back 2.1 cm on the shot frame and is
  home within 10 frames; B05's bolt lifts 60 deg, goes back 4 cm at mid
  priming and is home at rest when ready, and the lift raises the lever
  (its top rises from 0.101 to 0.137 in the blaster's frame), so the
  direction is right; B06's handle goes back 4 cm through the reload and
  returns at the end.
- Not checked by eye: how the three look on screen.
- tsc, vitest (800 passed, 2 skipped), build green.

### 2026-11-08: ART-05a (Qwen 3.8 Flash Next via Pi, dgx-spark): B02 slide, B05 bolt, B06 cocking handle

- Asked for: the three viewmodel motions the approved models have waiting
  for them, per `tasks/ART-05a.md`. Nothing else.
- Built, all in `src/weapons/viewmodel.ts` following the B01 pump and B07
  drum pattern (offset from `restP`/`restQ`, allocate nothing per frame):
  - `applySlide(dt)` in the semi/burst branch: `hookShot` zeroes a clock
    when `motion.slideTravel` is set and the `slide` node eases from
    `slideTravel` back to rest over `slideReturn` seconds along its local
    +Z. `hookShot` drops later darts of the same frame (existing
    `shotsThisFrame` gate), but a burst's darts come on separate frames
    `burstGap` apart, so each one re-kicks the slide.
  - `applyBolt(blaster)` in the pump branch (B05) and the auto branch
    (B06): the `bolt` node is driven by `blaster.progress`. Pump: lift
    `boltLiftDeg` about local Z over 0 to 0.2, back `boltTravel` along
    local +Z over 0.2 to 0.5, forward over 0.5 to 0.8, down over 0.8 to
    1.0, only while `state === "priming"`. Auto: back `boltTravel` over 0
    to 0.15 of the reload, held, let go over 0.85 to 1.0, only while
    `state === "reloading"`. Outside its state the node sits at rest.
- Decided: one `applyBolt` covers B05 and B06 by `spec.mode`, no new
  field names per blaster; B06's data sets `boltTravel` alone so its
  handle translates and never rotates. A blaster with no `bolt` node, or
  with neither field, is left exactly as it was (B01, B03, B04, B07
  untouched; their tests unchanged and still green).
- New optional `MotionSpec` fields in `src/weapons/blaster.ts`:
  `slideTravel`, `slideReturn`, `boltLiftDeg`, `boltTravel`. Data: the
  three `motion` lines in `data/blasters.json` (hand-edited, one line
  each): B02 `slideTravel` 0.025 / `slideReturn` 0.1, B05 `boltLiftDeg`
  60 / `boltTravel` 0.05, B06 `boltTravel` 0.04. Start values for Paul
  to tune on the range.
- Not done on purpose: the heavy mod's slower slide, reload tilts, sounds
  (all "not in this task"). B05 keeps its `pumpTravel` 0.05 even though
  its glb has no `pump` node (pre-existing, the card says it moves
  nothing).
- Verified: `npx tsc --noEmit` clean, `npx vitest run` 800 passed 2
  skipped (113 files) including 10 new tests in
  `tests/weapons/art-05a.test.ts` (named-node trees, no glb, like
  `tests/weapons/b07.test.ts` test 10), `npm run build` built. No em or
  en dashes in the files touched.
- Not checked by eye: none of it on screen. I could not open a browser, so
  the slide kick, the bolt's lift direction (local +Z per the card's
  "back is local +Z" fact, and the lift about the node's own Z) and the
  handle pull are proven only by the node transforms in tests. The real
  glb node names (`slide`, `bolt`) come from the card's facts, not from
  loading the models. Paul should watch all three on the range, especially
  that B05's bolt lifts the right way and B06's handle pulls the right
  way.

### 2026-11-08: GAME-09f review, merged (Claude Opus 5.5): B07 Collateral

- Reviewed dgx-spark's run. Fixed in review:
  - Both mods were always on, with two invented placeholder mods
    (`longrange`, `rapid`) in their place. The card makes remote detonate
    mod 1 and cluster mod 2, so they are now `mods.remote` and
    `mods.cluster`; plain B07 blasts on its hit. The env-03 station offers
    `remote`, moved to (-2.5, 0, -7) so B03's station does not hide it.
  - The run rewrote `data/blasters.json` and `data/levels/env-03.json`
    through a JSON dump, reformatting every blaster. Both are back in
    main's compact layout with only B07's lines added.
  - Cluster on its own never clustered: the impact hook dropped the
    shot's `clustered` flag (only a remote detonation passed it). Fixed in
    `src/weapons/impacts.ts`, with test 13b.
- Played in env-03 (the pane was hidden, so the loop was stepped by hand):
  plain B07 lands one launcher blast; with remote the round sits live,
  the next press sets it off and spends no round; with cluster one round
  gives five blasts (one launcher, four cluster 0.27 s later); the drum
  node turns; the player's health stays at 100 throughout.
- Not checked by eye: B07 on screen (viewmodel placement, the drum's look
  as it turns), the blast push on Foamers in play (Foamer colliders do not
  build while the pane is hidden; unit tests cover it), the sounds.
- tsc, vitest (790 passed, 2 skipped), build green.

### 2026-11-08: GAME-09f, both stages done (Qwen 3.8 Flash Next via Pi, branch `game-09f`)

- Task (Paul): `tasks/GAME-09f.md`, B07 Collateral gameplay, two stages.
- Stage 1 (commit `GAME-09f: stage 1, ...`): the `launcher` dart type
  (`data/darts.json`: 18 m/s, gravityScale 1.0, explodes at its first
  hit), B07 Collateral in `data/blasters.json` (pump, primeTime 0.9,
  drum 6 / reserve 18 / start 12, reload 2.5, `explosiveEvery` 1, key 7
  in `src/game/game.ts` and `src/range/main.ts`), and named blast
  profiles in `data/explosion.json` read by the shared
  `src/weapons/explosion.ts` (`dart` = B05/B06's old numbers, unchanged;
  `launcher` carves 1.0 m, 25 damage, 3.5 m range, and shoves each Foamer
  it damaged 2.5 m outward through the Foamer system's existing
  `knockStep`, so a wall stops them and the player, who is never in the
  Foamer list, is never touched). The viewmodel turns B07's `drum` node
  60 deg about its bore (its local Y) per shot, eased over the priming,
  from `motion.drumStepDeg`; B01 has none and is untouched. Sounds
  `B07-fire`/`B07-pump`/`B07-reload` placeholder synths + cues (added to
  `design/SOUNDS.md` 2.8), an env-03 mod station (B07 remote), and
  `tests/weapons/b07.test.ts`.
- Stage 2 (second commit): mod 1 remote detonate (a round that hits stops
  as a new LIVE dart state, cap `maxLiveRounds` 3 in `data/darts.json`,
  the oldest goes off when a fourth fires; a fire press while any are
  live detonates them all through `DartSystem.detonateLive` and spends no
  round; the press plays `B07-detonate` and each blast is the launcher
  profile through the existing `onDetonate` hook) and mod 2 cluster (a
  clustered blast schedules the data's four small `cluster` blasts, 1.5 m
  out at the four sides, 0.25 s later, in simulation time, through the
  same cap; `maxPerSecond` raised 6 -> 10 so a B07 round's five blasts,
  or two rounds back to back, never lose one to the cap, as the card
  asks). Tests 11-15 in the same file cover the remote stops, the press,
  the cap, the four sides after the delay, and the cap room.
- Decisions recorded in PLAN.md 14 (2026-11-08 entries): explosion
  profiles, the shove through `knockStep`, LIVE as a dart state, the
  simulation-time cluster.
- `tests/weapons/models.test.ts` now accepts `drum` as B07's magazine
  node (its approved glb has no `mag`), like the earlier pump/bolt
  widening; `tests/weapons/b05.test.ts` order check extended with B07.
- Green: `npx tsc --noEmit`, `npx vitest run` (112 files, 789 passed, 2
  skipped), `npm run build`. No other repo touched, no dev server run.
- Not checked by eye (this session had no browser): B07 in hand (viewmodel
  placement and scale are start values), the drum's turn against the real
  glb (the axis is read from its rest quaternion 90 deg about X, not
  seen), the pump's look, the launcher round's arc and blast feel, and
  the four placeholder sounds. B07's flight
  sound (B07-flight in SOUNDS.md) was not asked for by the card and is
  not wired.

### 2026-11-07: GAME-09e review, merged (Claude Opus 5.5): B05 Shrike

- Read through: the precision dart (and `precisionHeavy` for the heavy
  mod), the pierce in `src/weapons/darts.ts` (a pierced Foamer's bodies
  are ignored for the rest of the flight, walls stop it, never the same
  Foamer twice), the zoom in `src/game/zoom.ts` (it holds the player's
  own field of view and sensitivity and narrows both; a switch or reload
  drops it). Clean.
- Merged with B02: the order is B01, B04, B03, B06, B02, B05 on keys 1
  to 6 (B05 after B02, so every earlier key stays); the `env-03` test
  level keeps all six stations, B05's moved to an empty spot.
- **Played** (`arena.html?watch&level=env-01`): two quick presses fire
  once, the bolt's 0.9 s later the next fires. Not checkable with the
  pane hidden: the zoom (driven from the render frame) and dart hits on
  Foamers (their part colliders come from meshes built off the render
  frame); both are covered by the unit tests (21 new).
- Not checked: the model in hand, the bolt's animation (none yet), the
  sounds. The zoom key is `KeyZ`, a proposal for Paul.

### 2026-11-07: GAME-09e (Qwen 3.8 Flash Next via Pi, dgx-spark, branch `game-09e`): B05 Shrike, the precision dart, pierce and zoom

- **Task** (card: `tasks/GAME-09e.md`): the precision dart that pierces,
  B05's bolt cycle, a zoom while held, and the explosive and heavier
  rounds mods. Two commits, not reviewed, not merged. Fire-mode, loadout
  and viewmodel code untouched (GAME-09c owns them).
- **Stage 1** (`fd36fd1`). `precision` and `precisionHeavy` dart types in
  `data/darts.json`; `precision` 8 / `precisionHeavy` 10 in
  `data/foamers.json` (slug 6). Pierce is on the dart type: a dart with
  `pierce` n flies through n Foamers, stops at n + 1, on a wall, or on a
  second visit to the same Foamer. `src/weapons/darts.ts` gives each hit
  the Foamer's key (root body handle) and, for a piercing type, all its
  body handles, which the dart then ignores for the rest of its flight.
  The `B05` entry in `data/blasters.json`: pump mode, `primeTime` 0.9 as
  the bolt, precision darts, 1 per shot, no spread, 5/30 (start 15),
  reload 1.8, `zoom` block, mods explosive (`explosiveEvery` 1) and heavy
  (`dartType` precisionHeavy). In the order between B03 and B06; env-03
  gained a fifth mod station. `tests/weapons/models.test.ts` accepts a
  `bolt` node in place of `pump` for a pump blaster (B05's moving part).
- **Stage 2** (`77ff1fa`). `src/game/zoom.ts`: while the `zoom` action is
  held with a blaster whose data has a `zoom` block (B05 only: fovShare
  0.4, easeTime 0.12), the camera's fov eases to that share of the
  player's own setting and the look sensitivity scales with it; letting
  go eases back, a switch or a reload drops it and the key must be
  pressed again. `game.ts` drives it in `frame()`; `applySettings` hands
  it the player's own fov and sensitivity. The `zoom` action is KeyZ and
  gamepad button 11 in `data/input.json`.
- **Decisions** (PLAN.md 14): pierce on the dart type, not the blaster;
  heavier rounds is a second dart type so a mod changes one field; the
  zoom narrows the player's own fov so the slider keeps working; a zoom
  that survives a switch is a bug; B05 reuses `pump` with the bolt time
  as `primeTime` rather than a new fire mode.
- **Sound:** `B05-fire`, `B05-bolt`, `B05-reload`, `B05-whistle` in
  `data/sounds.json` (synth placeholders) with B05's priming and reload
  cues, listed in `design/SOUNDS.md` 2.6. `B05-bolt` and `B05-reload` are
  one id each for what the recording pass may split (bolt-back/fwd,
  mag-out/in). **Not a proposal from me:** KeyZ, gamepad 11, every B05
  number, and those merged sound ids are all for Paul.
- **Tests:** 21 new (`tests/weapons/b05.test.ts`,
  `tests/weapons/b05-mods.test.ts`, `tests/game/zoom.test.ts`). Full
  suite green: 110 files, 762 passed, 2 skipped; `npx tsc --noEmit` and
  `npm run build` pass.
- **Not checked by eye** (no browser, no images): the model in hand, the
  viewmodel placement and whether the scope fills the view, the pierce
  and the explosive blast on the range, the zoom's feel and how much the
  narrowed view actually helps, and every B05 sound (synth only, never
  heard). The bolt has no animation and there is no scope overlay, both
  out of the card.
- **Open:** B05 needs a fifth weapon-key slot (`game.ts` maps weapon1-3
  to ids), and GAME-09c owns the weapon keys: left for that work or the
  review.
### 2026-11-07: GAME-09c review, merged (Claude Opus 5.5): B02 Musketeer

- Merged with GAME-09d (B06): B02 joins the order after B06, so blasters
  are B01, B04, B03, B06, B02 on keys 1 to 5 (index-based tests keep
  their slots; level order can be set later). B06's fire-clock cap would
  have stopped B02's burst after its first burst (the cooldown runs on
  the same clock, longer than B02's interval); the cap now covers the
  longer of the two. New test: a second burst fails with the old cap and
  passes with the new.
- B02 now uses its own approved model (`public/models/blasters/B02.glb`),
  viewmodel scale 0.85; the spec test that pinned the placeholder moved
  with it. A duplicate mod field and comment from the two branches went.
- **Played** (`arena.html?watch&level=env-01`): B02 loads with its
  `body`, `slide`, `trigger`, `mag` and `muzzle_1` nodes; one dart per
  press, six then an automatic reload back to six; the HUD reads
  "Musketeer AMMO 6 / ∞".
- Not checked: the slide's kick (not animated yet: the viewmodel moves
  only the magazine for semi and burst), the look in hand (pane hidden),
  the three sounds.

### 2026-11-07: GAME-09c: B02 Musketeer, both stages

Built on `game-09c`, not reviewed, not merged, not pushed (Qwen 3.8-27B
via Pi). All of the model work is not started.

- **The weapon.** `data/blasters.json` gains `B02`: name Musketeer, mode
  `semi`, standard darts, one dart a shot, spread 1 degree, magazine 6,
  reload 1.0 s, auto reload, `fireInterval` 0.15 s (the fast-click cap).
  The placeholder model is the B01 `.glb` with `muzzle_1`; its `_note`
  says the B02 model replaces it when ART-01 ships, with no code change.
- **New mode `semi`** in `src/weapons/blaster.ts`: one dart per trigger
  press, never primes, and the fire clock caps presses faster than
  `fireInterval`. Empty plus autoReload starts the reload. The viewmodel
  animates a semi (and a burst, below) like a small pump: magazine drop
  on the reload, no pump travel, no wheel.
- **Never empty.** A data flag `reserveInfinite` on the resolved spec:
  `finishReload` fills the magazine without touching the reserve, the
  vacuum's refill (`Loadout.refillReserves`) and the ammo box
  (`PickupSystem.giveAmmo`) skip such blasters, and the HUD shows the
  reserve as an infinity sign, not a number. Every other blaster's
  reserve is untouched. I added one line to `src/ui/hud.ts` for the
  symbol: it is not in the card's file list, but the card asks for it.
- **Stage 2, the burst mod.** A new mode `burst` on the blaster: one
  press fires `burstCount` darts (3) at `burstGap` (0.07 s) on its own
  gap clock, then the fireClock carries the `burstCooldown` (0.3 s).
  Presses mid-burst or mid-cooldown do nothing, so no mash can beat the
  data. A magazine that empties mid-burst (2 left fires 2, never a
  third) ends the burst and starts the reload at once. Numbers in
  `data/blasters.json`, not the code.
- **Stage 2, the heavy mod.** Pure data: `slug` darts, the slower
  `fireInterval` 0.45 s, and its own `chunk` (range 6 m, carve 0.2, push
  1.0, larger than the standard dart's, smaller than B01's slug). The
  shared chunk system turned it into a foam pop with no new code.
- **In the game.** B02 is appended to the blaster `order` after B03 and
  takes weapon key 4, so B01, B04 and B03 keep keys 1 to 3 and no level
  loses a blaster (the level only depends on the first three being in
  this order); `game.ts` and the range's `WEAPON_KEYS` lists grow by
  one. The range's blaster and mod rows are data driven, so B02 shows up
  with its two mods and no range code. `models.test.ts` node check reads
  the model the spec points at and has a `semi`/`burst` branch
  (placeholder reads the B01 file, where `mag` and `muzzle_1` live).
  `data/levels/env-03.json` gains a fourth station (`B02` / `burst`, at
  0, -4, between the start and the B03 station) because the env-03 test
  offers one station per mod-carrying blaster and B02 has mods now.
- **Sounds.** `data/sounds.json` gains the card's three placeholder IDs,
  all synth for now (the files will land in AUD-02 when recorded):
  `B02-fire` (light, quick), `B02-fire-heavy` (a slow, big thud),
  `B02-reload` (a click and a soft noise). `SOUNDS.md` documents the
  same three, renaming the earlier `B02-heavy-fire` draft. The fire
  sound plays by the engine's `activeId + "-fire"` naming, so `B02-fire`
  is live; `B02-reload` plays on the reload cue; `B02-fire-heavy` is
  defined but not yet wired (a heavy shot still plays `B02-fire`).
- **Tests.** `tests/weapons/b02.test.ts` (11 tests): the spec, one press
  one dart, a held trigger fires only that one, fast presses are capped
  by the clock, spaced presses fire exactly one each, the reserve stays
  full over four full magazines, the vacuum's refill leaves it alone
  while a real reserve still takes its share, the burst reads, the burst
  fires 3 per press with the gap then waits the cooldown, a burst with 2
  left fires 2 and reloads itself, the heavy mod reads, the heavy fires
  slugs at the slower rate. All other weapon tests ran unchanged. `npx
  tsc --noEmit`, `npx vitest run` (726 passed, 2 skipped) and `npm run
  build` pass; the dash check is clean.
- **Not checked by eye, I cannot see or run the game:** the B02 viewmodel
  look and scale, the infinity sign render in the HUD, the semi and burst
  feel and cadence in the range and arena, and whether the three sounds
  sit right (the synth numbers are guessed); a heavy shot plays the
  standard `B02-fire` until the heavy sound is wired.
### 2026-11-07: B07 Collateral brief and model (ART-01, ART-04, Claude Opus 5.5)

- Paul said to proceed with B07 in navy blue with red accents. Brief
  `design/blasters/B07.md` (a tube magazine under a wide launch tube, a
  ribbed pump sleeve, a ladder sight, a short stock) and the model from
  `art/blasters/B07/build.py`; notes and checks in
  `art/blasters/B07/NOTES.md`. All contract checks pass; the export is
  repeatable. Waiting for Paul's approval of both. Gameplay not started.

### 2026-11-07: GAME-09d review, merged (Claude Opus 5.5): B06 and the shared explosion

- **Bug, fixed in review, in every full-auto blaster: a stored burst
  after a pause.** `Blaster.fireClock` grew by dt every step, trigger held
  or not, and was never capped, so after any idle time a full-auto
  blaster fired one dart per step until the stored time ran out (on the
  arena page B06 emptied 60 darts in about a second; B04 its 35). The
  clock now stores at most one shot. New test in
  `tests/weapons/b06.test.ts` (five idle seconds, then a held second):
  B04 fired 35 before the fix, at most its interval after.
- **Played** (`arena.html?watch&level=env-01`, the trigger held through
  the input module): after a long idle B06 fired 11 darts in 2 s (0.17 s
  apart after the 0.25 s spin-up), every fifth exploding; explosive darts
  blew both crates of a stack apart; an explosion at an F05 took 12 (the
  centre damage) and a second F05 4 m away nothing; five blasts popped
  it; a blast at the player's own feet did nothing (Paul: the player's
  explosions never hurt the player).
- Kept: the model also added a B06 `rate` station to the `env-03` test
  level, outside its file list but useful.
- Not checked: B06 in hand and the mega dart in flight by eye (pane
  hidden; with it hidden the camera does not turn, so aimed fire at a
  moving Foamer was not testable), the four sounds. B06 has no weapon key
  yet (keys 1 to 3 are mapped; B02's card adds a fourth): it is reached
  with the next-weapon key until the keys are sorted after GAME-09c merges.

### 2026-11-07: B06 The Standard and the shared explosion (GAME-09d, Qwen 3.8 Flash Next via Pi, dgx-spark, branch `game-09d`)

- Asked for: the mega dart and B06's gameplay (card `tasks/GAME-09d.md`),
  and one explosion system every explosive dart shares, with B06's
  explosive mod on every fifth dart.
- Stage 1 (commit `511fb96`): the `mega` type in `data/darts.json` (radius
  0.029 against standard's 0.017, speed 33, gravityScale 0.5, drag 0.4,
  impulse 1.8, carveRadius 0.2, sticks false); `mega` damage 3 in
  `data/foamers.json` beside standard 1; a `B06` entry in
  `data/blasters.json` on the approved model (auto, mega, 1 dart, 60/120,
  fireInterval 0.17, spinUp 0.25, spinDown 1.2, climb recoil, mods `rate`
  at 0.12 and `explosive`). The only code change: one line in
  `resolveSpec` (src/weapons/blaster.ts:167 area) so a mod can override
  `fireInterval`. No fire-mode code was touched (GAME-09c owns it).
- Stage 2 (commit `b9d8b87`): `src/weapons/explosion.ts` and
  `data/explosion.json`. One `ExplosionSystem` per page, so a B06 blast and
  a later B05 or B07 blast behave the same. At a world point it carves a
  sphere through the same `carveSphere` a dart carve uses (so a blast's
  islands go down the page's existing `onCarve` path, and the nav grid
  re-bakes), damages Foamer centres inside `rangeMetres` 2.5 with a linear
  falloff from `damageCentre` 12, pushes loose debris and broken pieces
  outward, bursts `burstChunks` 10 foam chunks through the debris ring
  (the ring's own cap holds), and calls `onExplode` for the sound. Hard
  cap: `maxPerSecond` 6; a request over the cap does nothing at all.
- The dart-hit path to the explosion: a blaster tags a shot
  (`Blaster.beginShot`, every `explosiveEvery`th shot) → `DartSystem.fire`
  copies the flag onto the slot's own shot copy → in `stepFlying`, the
  first `onHit` of an exploding dart calls `onExplosiveHit` once (the
  slot's `exploded` flag stops a bounce blasting twice) → `DartImpacts`
  (given the system as a 4th argument) calls `explosion.explode(hit.point)`
  and ticks the cap's clock from the new `DartSystem.onUpdate`. Foamer
  damage goes through the new non-dart `Foamers.blastDamage`, like
  `parryDamage` but the blast's own damage counts toward a catastrophic
  hit, so a blast at the centre can pop as well as go down.
- Decided: a blast does no damage to the player. Proposal for Paul: the
  explosive rounds are a reward, not a hazard to their own feet. The
  explosion carves the level's volume, not a Foamer's parts (the dart path
  owns part carving); the blast's own damage is what kills a Foamer.
- Sounds: `B06-fire`, `B06-spin`, `B06-reload`, `FX-explode` in
  `data/sounds.json` (synth only) and rows in `design/SOUNDS.md` (the card
  asked for `B06-spin`; SOUNDS.md listed `B06-rev-loop`, so both ids are
  there now and `B06-spin` is marked as the placeholder the card named).
  `game-sounds.ts` loops `B04-rev-loop` only, so B06's motor does not
  sound yet: wiring a second rev loop is left for the review.
- Not checked by eye (no browser here): the B06 viewmodel placement and
  the model's look in hand, the mega dart in flight, the carve, the push
  and the chunk burst on the range, the drum reload animation. Not heard:
  all four placeholder sounds. Not played: the rate mod's feel, and every
  fifth dart's blast (only the tests cover it).
- Open for the review: B06 is the fourth blaster in the loadout order
  (B01, B04, B03, B06), but `src/game/game.ts` maps only weapon1 to
  weapon3, so B06 cannot be selected by key. The card said to leave the
  key wiring rather than edit `game.ts`, so the fifth slot is untouched.
  `data/levels/env-03.json` gained a `station-b06` for the `rate` mod so
  that level's own test stays green.
- Green: `npx tsc --noEmit`, `npx vitest run` (740 pass, 2 skipped; 15 new
  tests in `tests/weapons/b06.test.ts` and `tests/weapons/explosion.test.ts`),
  `npm run build`; no dash characters in the files touched.

### 2026-11-07: B05 Shrike and B06 The Standard models (ART-04, Claude Opus 5.5)

- Briefs approved by Paul with his changes (B05 deep red and a
  rectangular scope; B06 teal like the reference, no bipod, a chunky
  house-shaped magazine). Models built in Blender from
  `art/blasters/B05/build.py` and `art/blasters/B06/build.py`; renders,
  changes made by eye and checks in each folder's `NOTES.md`. Both pass
  every glb contract check and export byte-identically.
- Not done: gameplay for both (precision dart, mega dart, bolt action,
  zoom, explosive rounds) and their animations. Paul approved both looks
  the same day (B06 after a second round).

### 2026-11-07: B02 Musketeer model (ART-04, Claude Opus 5.5)

- `art/blasters/B02/build.py` builds `public/models/blasters/B02.glb`
  from the approved brief in Blender (Steam install), on B01's helpers.
  A plain round bumper (Paul dropped the flared one mid-build). Renders in
  `art/blasters/B02/renders/`; notes, departures from the brief and the
  checks in `art/blasters/B02/NOTES.md`. All contract checks pass and the
  export is repeatable.
- Not done: the slide's kick animation, and pointing B02's data at the
  model (after GAME-09c merges). Paul approved the look the same day.

### 2026-11-07: GAME-10k review, merged (Claude Opus 5.5): the F11 Seawall

- **Look, checked by eye:** the turnaround matches the brief: deep lime
  helm, chest and boots, a purple spiked mace in the right hand, a big
  orange tower shield on the shield arm, purple horns and cape.
- **Bug, fixed in review: a parried Seawall froze for good.** The page
  parries inside `onBonk`, which the Foamer system calls in the middle of
  the windup-to-strike step. `parryAttack` staggered it and cleared its
  attack, then the step set `strike` over the stagger; the strike step
  read `f.attack()!.strike` with no attack and threw every frame. The
  unit test called `parryAttack` directly, never through a strike. The
  step now keeps a stagger the bonk set. New test in
  `tests/foamers/seawall.test.ts` parries through the real strike; it
  threw before the fix and passes after.
- **Played on the range** (the F11 button, the shield raised by the watch
  just before each finisher lands): overhead 0.7 s, sweep 0.5 s, finisher
  1.2 s, in order and looping; the first finisher parried at 8.9 s and it
  staggered, recovered and fought round to the next finisher; the second
  parry at 15.1 s broke the shield off.
- Not checked: the pink tell and the poses by eye (the pane was hidden),
  the three sounds, a front dart after the break in the page (the unit
  test covers it).

### 2026-11-07: GAME-10k, finished (Qwen 3.8 Flash Next via Pi): the F11 Seawall

- All three stages of `tasks/GAME-10k.md` are committed on `game-10k`
  (stage 1 `b20b5bd`, stage 2 `5f1be5e`, this docs pass the third), not
  reviewed, not merged, not pushed. The card's done list is met:
  `tests/foamers/seawall.test.ts` (9 tests) covers the spec (rig F11,
  health 60 from the rig, all attacks melee, the shield parts and the
  mace on the rig), the shield (a dart inside the 120 degree arc does no
  damage and carves nothing, a dart from behind hurts, `plateFaces` at
  50 and 80 degrees, the body and mace unarmoured), the combo (the data
  order and numbers, four real bonks in the order overhead, sweep,
  finisher, overhead, `comboTurn` matching), the tell (the mace head's
  chunk material is `BALL_MATERIAL` only during the finisher's windup,
  the shared foam during the other two and after), and the parry
  (`decideMeleeParry` for parryable and unmarked attacks, blocked and
  not; a parry costs no health, staggers 1.5 s, counts; two break the
  shield and the boss off and then a front dart hurts). No other type's
  test file was touched; the full suite is green with them.
- Stage 1: the palette per CONTENT-PLAN 3 (deep lime armour, purple
  weapon and limbs, orange shield as the weak point) in
  `data/foamer-rigs.json`, the F11 entry in `data/foamers.json` on the
  melee brain (no brain code: the F07's shape, the rig's speed 1.4 and
  health 60), arc armour as the Blocker's (`armour` block, damage 0,
  carve 0, `arcDeg` 120 on `shield` and `shieldBoss`).
- Stage 2: `src/foamers/combo.ts` (new, small) holds the combo read,
  the `meleeParry` read and `decideMeleeParry`; `Foamer.comboTurn` and
  `Foamer.parriesTaken` are the counters; `FoamerSystem.parryAttack`
  staggers and breaks the shield through the existing `breakPart`;
  `stepTell` draws the pink tell. Both pages (`src/game/game.ts`,
  `src/range/main.ts`) wire the parry in their `onBonk`; `shield.ts` and
  `data/shield.json` did not need a change (the parry window and the
  block share are the ball parry's own numbers). Three new attacks in
  data with the card's numbers, poses in `rig-states.ts` on the bonk and
  swing patterns. `F11-swing`, `F11-windup` and `F11-shield-break`
  placeholder synths in `data/sounds.json`, with the matching rows in
  `design/SOUNDS.md` (the audio data test cross-checks the two).
- What was not checked by eye: nothing was rendered or played here. The
  F11 turnaround in `design/foamers/F11-*.png` was generated in stage 1
  and only checked by script (the shield solved onto the left forearm,
  the mace into the right hand, from the rig's rest pose); the shield's
  look, the combo poses, the pink tell, the three sounds and the parry
  feel in play are all unverified by sight or ear. The look needs Paul
  and a browser pass, the way GAME-10j's did.
- Final gate: `npx tsc --noEmit` clean, `npx vitest run` 707 pass 2
  skip, `npm run build` clean, dash check (`perl -CSD`) clean on every
  file touched.

### 2026-11-07: ENV-04 review, merged (Claude Opus 5.5): the crushing toy press

Three bugs fixed in review, all invisible to the unit tests:
- **The first crush crashed the game.** `arenaExtras` handed `g.ui` to the
  press player while the hooks were being set up, but the UI controller
  is built after that (the comment at the top of the function says so),
  so the press held `null` and threw on its first crush. It now reads
  `g.ui` when a crush lands.
- **The test corridor did not load.** The page's validator refused it
  (side walls overlapping the end walls, the exit pad in the north
  wall). The press tests validate a level of their own, never this one.
  New `tests/level/env-04.test.ts` validates the real file; the walls are
  16 m, the exit 0.5 m off the north wall, the presses at z -0.5 and -4.
- **The presses could be walked round.** Each pad was 1.5 m in a 3 m
  corridor, and the level's note said so. The pads now span the corridor.
- **A crush skipped the grace.** It went through `health.damage`, which
  ignores everything for 0.5 s after a hit. `PlayerHealth.crush` skips
  that grace and still rides the difficulty multiplier (Story: 50 of
  100). Test in `tests/player/health.test.ts`.
- **Played** (`arena.html?watch&level=env-04`): on a pad the cycle runs
  up, telegraph, slam, and the player goes from 100 to 0 and is downed;
  between the presses the player is untouched through every phase of
  both; the exit completes the level. Not seen by eye: the head, the
  shake and light, the sounds (pane hidden).
- For Paul: on Story difficulty a crush takes half the bar, so it does
  not kill from full health there. Say if a press should kill on every
  difficulty.

### 2026-11-07: ENV-04 both stages committed (Qwen 3.8-27B via Pi, branch `env-04`): the crushing toy press

- **Task:** the E14 hazard that can kill, per `tasks/ENV-04.md`: a toy
  stamp on a timer that telegraphs (shake, light on, windup sound), slams,
  holds, rises; crushing whoever stands on its pad. Test level `env-04`.
  Two commits: stage 1 `8eb75be`, stage 2 `5b34d7d`, both on `env-04`,
  unreviewed, unmerged, unpushed.
- **The press.** `data/press.json`: the cycle (up 2.0, telegraph 0.7, slam
  0.12, down 0.5, rise 1.0, 4.32 s whole), 100 damage, head thickness 0.5 m
  with a 2 cm air gap at the bottom, pad 6 cm, two 0.3 m posts, shake 3 cm
  at 12 Hz, plus a [Paul] note that the lime/purple look is a placeholder
  that stays away from orange, pink, blue and yellow. `src/level/presses.ts`:
  `buildPress` draws the pad, the two posts and the head (a chunky block,
  a capsule as the soft face, its light) on a kinematic collider that moves
  with it; `PressSystem.step(dt, player, { list, pop })` advances each press
  on its own phase (its `t`) and, once per slam end, runs the footprint
  test: the pad's box (x and z) up to the head's low point against a body's
  feet. In it, the player goes to the page handler and a Foamer is popped.
  No physics contact: the crush is the test, and one slam damages once, not
  per step of the hold.
- **The damage path (stage 1).** The arena page's `HealthPressPlayer`
  copies the player's feet and calls `health.damage(amount, "press")` on
  the crush, then the hurt sound, the HUD flash, and `ui.pop()` when down,
  the same order as the Foamer hit in `src/game/game.ts`. The raised
  shield does not block it: the shield's arc test answers Foamer attacks
  only, and a head comes from the top. At 100 with no armour at Normal
  (damageTaken 1) one slam downs; on Story (0.5) it is 50, left to the
  reviewer per the card's Easy-difficulty note.
- **Wiring, the ENV-01 lesson.** The press reaches the arena page through
  `src/arena/extras.ts`: `buildLevel` builds every `presses[]` entry into
  `BuiltLevel.presses`, `arenaExtras` takes the handles and makes one
  `HealthPressPlayer` with the real `PlayerHealth`, UI, HUD and audio, and
  one `PressSystem` over the handles; the page's step hook (after the
  runner) copies the player's feet, steps the system with `foamers.list`
  and a pop that plays `FX-pop` and flashes, plays `ENV-press-windup` at
  each windup and `ENV-press-slam` at each slam (both positional), and a
  fall or a Try again calls `presses.reset()` so the heads are back at rest
  and the lights off. `watchState` reports each press's phase. No test
  builds the arena page, so this wiring is from reading the code, like
  ENV-03's; nothing in a unit test proves the page passes the press to the
  game.
- **Sounds.** `ENV-press-windup` (a rising square over a noise burst) and
  `ENV-press-slam` (a noise thud that low-passes from 900 Hz down to 60,
  a bass sine under it), synth only, in `data/sounds.json`, rows in
  `design/SOUNDS.md`.
- **Stage 2.** `data/levels/env-04.json`: a 3 m wide corridor (wall faces
  at x ±1.5, walls 0.5 m thick, ceiling 4.5), 17 m long; two presses at
  z = -2.5 and -6, both 1.5 x 1.5 m, 2.2 m between pad and head face, phase
  0 and 2.16 (half the cycle apart, so they never slam the same step); the
  exit pad beyond them at z = -7.5, `arenas: []` so it works from the first
  frame; name, accent and setting are [Paul]. Registered as `env-04` in
  `src/arena/levels.ts` and the key list in `tests/level/ring-load.test.ts`.
  The head is clear of a 1.8 m standing player: its face rests at 2.26 m
  above the floor and comes down to 8 cm on the pad at the bottom.
- **Validation.** `src/level/validate.ts`: a duplicate id, the pad's
  numbers, and a `phase` outside `[0, CYCLE_TOTAL)` are errors, and a pad
  that sits inside a solid of the level (anything but the shell) is an
  error.
- **Tests.** 13 in `tests/level/press.test.ts`, all built through
  `buildLevel` (the builder the page uses, ENV-02's pattern): the cycle is
  the data's; the five phases walk in order on a cycle; one slam and one
  windup event per cycle, carrying the page's sounds; a player in the
  footprint at the slam takes the full 100 (no shield share) and downs (one
  pop, the hurt sound); a player 2 m away takes nothing; one slam damages
  exactly once, not every step of the 0.5 s hold; a Foamer under the head
  pops, one beside stays; two presses half a cycle apart slam on different
  steps; a level with no presses loads and runs as before; a phase named
  into the data's cycle starts that press already off its rest; reset puts
  the heads back. The ring-load key list now counts env-04 among the nine
  registered levels.
- `npx tsc --noEmit` clean, `npx vitest run` 102 files and 703 passed with
  2 skipped, `npm run build` clean, the em dash check clean on every file
  touched.
- **Not checked by eye:** no browser in this run. Nobody has seen the pad,
  the posts or the head in the world, the shake, the light, the capsule's
  face, or the crush in `arena.html?level=env-04`; the two sounds have not
  been heard; the look is the placeholder the data's [Paul] note names.
### 2026-11-07: BUG-12 review, merged (Claude Opus 5.5): anchors and the sleeping piece

- The anchor fix is right: a ceiling piece beds its top row, a wall piece
  beds only the voxels built into an axis-aligned shell box, so
  `store-window` now wears as cover and `pit-island` still drops its
  middle into the hole when carved.
- **The tower plug, by design now.** LVL-02d wanted "a cardboard voxel
  piece above floor 2 that one shot breaks"; it only did that because of
  the bug, and the model rightly left the file for review. Review added
  `anchor: "none"` (a piece that hangs from nothing: the first carve
  drops it whole; `src/level/format.ts`, the validator skips its anchor
  side) and set `tower-plug` to it. Test 9 of `level-1-2.test.ts` is
  back to "drops as one slab". Played in `arena.html?level=1-2`: from
  floor 2, the dart that hit the plug dropped it whole onto floor 2.
- **Wake fix, one addition:** a piece that settled on the old colliders
  had already reported its rest to the nav grid, so a woken piece never
  reported where it really landed. Waking it now clears `rested`.
- Not seen by eye: the pane was hidden. The bedrock rows of wall and
  ceiling pieces show the bedrock colour where they are flush with the
  shell, as floor anchors always have; worth a look in play.

### 2026-11-07: BUG-12, done, not yet reviewed (Qwen 3.8 Flash Next via Pi, dgx-spark, branch `bug-12`): the wall and ceiling anchors, and the sleeping piece

- **Task (card `tasks/BUG-12.md`).** Two fixes: `fillPieces` wrote a
  bedrock row only for `anchor: "floor"`, so a wall or ceiling anchored
  piece had nothing for `findIslands` to find and a small one dropped
  whole on its first carve; and a falling piece let go at
  `islands.maxHoldTime` while its source was still remeshing could
  settle on the source's old chunk colliders, sleep there, and float
  when they were replaced.
- **Stage 1 (`src/level/build.ts`, commit "BUG-12 stage 1").** Ceiling
  anchor: the piece's top row becomes bedrock, the mirror of the floor
  row. Wall anchor: every piece voxel whose cell meets an axis-aligned
  shell box on all three axes becomes bedrock, flush contact included
  (PLAN 14). A ramp or a box with `rotY` is never a wall: its drawn
  shape is not axis-aligned. `fillPieces` now takes the voxel bounds
  through one `voxelBounds` helper shared by the fill, the crate boxes
  and the anchor layers. Floor behaviour unchanged.
- **Stage 2 (`src/voxel/pieces.ts`, commit "BUG-12 stage 2").** On
  release, `FallingPieces` sets `wakeWhenSourceDone` when
  `source.busy` is still true; the first update after the source goes
  quiet calls `wakeUp()` on the body. The hold itself is untouched.
- **Tests.** New `tests/level/anchors.test.ts` (7 tests): each anchor
  kind beds only its layer, a carve that leaves a piece touching its
  anchor breaks nothing off, a part cut off from the wall or the
  ceiling still falls, the floor piece behaves as before. New test 7c
  in `tests/voxel/pieces.test.ts`: held past `maxHoldTime` with the
  source busy, the piece falls, sleeps, and wakes when `busy` clears
  (red before the fix, green after). A probe over the three real
  pieces (throwaway, removed) showed each now keeps 0 break-off
  islands after a 0.35 m centre carve, with bedrock rows present.
  `npx tsc --noEmit`, `npx vitest run` (681 pass, 2 skip) and
  `npm run build` pass.
- **What the three pieces meant, and whether they now do it.**
  - `store-window` (1-2, cover, wall): LVL-02b card 4, the breather
    store's "window onto the ring". Cover per KIT: it should wear down
    and open sight lines, not drop whole. It now holds by its sill row
    (flush with `window-sill`) and its lintel row (flush with
    `window-lintel`) and wears as meant.
  - `tower-plug` (1-2, plug, ceiling): LVL-02d wanted "a cardboard
    voxel piece above floor 2 that one shot breaks, dropping a foam
    slab to the floor below". That is the card's plug-you-shoot-open
    case: after stage 1 the plug holds after a single carve, so one
    shot no longer opens it. `tests/level/level-1-2.test.ts` test 9
    asserted the old drop-whole behaviour and was updated to expect
    the plug to hold. `data/levels/1-2.json` is left alone as the
    card directs; whether the plug should drop on one shot is the
    reviewer's call (a smaller piece, or a rule that a `plug` kind
    releases whole at a damage threshold, would both serve LVL-02d).
  - `pit-island` (1-4, island, wall): LVL-04b's "floor island on the
    west ramp's top (3.2 x 0.4 x 3.2 m, a voxel piece over a hole)";
    level-1-4 test 12 says a player who carves it falls to the pit
    floor. Its `wall` anchor existed only so the floor rule's bedrock
    bottom row would not plug the hole. Stage 1 beds only the columns
    built into the `pit-west-ledge-w` and `-e` boxes (about the outer
    0.3 m of each end, flush included); the middle stays destructible,
    carving the middle drops it and opens the hole, as meant. Worth
    noting for review: those end columns are now invisible
    indestructible voxels, so the island's very ends never crumble.
- **Not checked by eye.** No browser here (dev servers are out of scope
  for this task). What has not been seen rendering: the three pieces
  holding in game, a carved wall piece hanging from its bedrock, and
  the woken piece visibly falling. All three are covered by headless
  tests only.

### 2026-11-07: ENV-03 review, merged (Claude Opus 5.5): the mod station

- **The first run drifted.** After Pi compressed its context, Qwen lost
  the task, read the video-kit skill and made a promo video in another
  folder, left a dev server running on port 5199 and the station half
  built and uncommitted. The server was stopped, the video deleted at
  Paul's word, and a fresh run with hard limits (no skills, no servers,
  nothing outside the worktree) finished the card from the half-built
  work. Every brief now carries those limits.
- **Played** (`arena.html?watch&level=env-03`, the use key held through
  the input module because the watch cannot lock the pointer): a 0.3 s
  hold grants nothing; a full hold at the Leviathan station grants `both`
  with the banner "BOTH TAKEN: LEVIATHAN"; a second hold on the spent
  station changes nothing; the Dartman station grants `slug`, the
  Shredder station `suppress`; from 2.5 m away nothing is granted. The
  use prompt reads the mod and the key ("both E").
- Merged with ENV-02: both levels replayed on the merged code (the wall
  button opens its door, the Shredder station grants its mod).
- **For Paul:** the screen and the banner show the mods' data ids (`slug`,
  `both`, `suppress`); mods have no display names yet, which are yours.
  The cabinet's beige, dark screen and green text are a proposal.
- Not seen by eye: the cabinet, its screen text and the spent screen (the
  pane was hidden), and the two sounds.

### 2026-11-07: ENV-03, the mod station (E13), both stages (Qwen 3.8-27B via Pi)

Task: `tasks/ENV-03.md`, in full. Branch `env-03`. Two commits:
`525a5f1` (stage 1: the cabinet) and `4c2ecf5` (stage 2: the env-03 test
level).

- **Stage 1.** `Level.stations?: Station[]` (`src/level/format.ts`; the
  validator checks the blaster exists, the mod is a key of its mods,
  facing is finite, pos is a Vec3). `Stations` (`src/arena/stations.ts`)
  builds the cabinet from boxes: beige case, bezel, a canvas screen that
  glows the mod's and blaster's names from data, a slot, grille bars,
  square edges; sizes and colours in `data/station.json`. The use point
  is on the cabinet's face (the level's `facing` is the way the cabinet
  faces the player; face normal `(-sin, -cos)` times half the depth), at
  1.15 m. The gate: 1.2 m reach of that point plus the view within the
  cone onto it (dot against normalised forward, the finisher's way).
  Holding `use` with the eye in the gate for 0.6 s calls
  `Loadout.setMod(idx, mod, true)` once; the screen dims to
  `spendScale` 0.12; `reset()` (restart) sets spent, holds, nudged and
  the screen flat, so it can grant again.
- **The use key settles to the tools first.** `useHeldForStations`
  (`src/arena/stations.ts`) says the key does not reach the stations
  while a finisher or vacuum is active or has a target (finisher.reads
  the use press before the page's step hook runs, vacuum.targets are
  read with the same eye and forward as the stations'; both statements
  therefore hold in play, and the unit test's cases are the card's last
  done-when clause). The step hook passes that to `stations.update`.
- **The prompt reuses the finisher's element.** `GameHooks.stationPrompt?
  (eye, forward)` (`src/game/game.ts`) is called in the render, after
  the done and target lines, and returns the mod's name plus the use
  key (the same wording as the finisher and vacuum's prompts). A level
  without a station returns null and the line is invariant. `game.prompt`
  records the component ("melee", "station" or "use") and the display
  flag for the QA watch menu.
- **A player who does not carry the blaster is told so** via the banner in
  `arenaExtras` (onNeedBlaster), and the station stays unspent: it can
  grant later if the blaster arrives (in play, via a pickup; the unit
  test is driven by a stub loadout without B01). A held use on a spent
  station plays `ENV-station-spent` (a low, dry buzz); a grant uses `ENV-station-grant`
  (a rising two-note blip). Both are synth-only placeholder tones in
  `data/sounds.json`, listed in the level table of `design/SOUNDS.md`.
- **Stage 2.** `data/levels/env-03.json` is env-01's room (floor,
  ceiling, four walls, exit pad) minus the columns and crates, with
  three stations (B01 slug at west, B04 suppress at east, B03 both at
  north, each facing the player start), `arenas: []`, no pickups (the
  page loadout always carries all three blasters, so the no-pickup case
  is in the unit test, not the file). Registered as `env-03` in
  `src/arena/levels.ts` (its own line next to env-01's, to keep the
  ENV-02 merge small), picked up in `tests/level/ring-load.test.ts`'s key list, and
  self-validated in `tests/level/env-03.test.ts` (loads with no validate
  errors or warnings; one station per blaster that has mods; no
  arenas).
- **The ENV-01 lesson, in full:** the path `buildLevel` -> `buildArena`
  (`buildArena` in `src/arena/extras.ts`) -> `createGame`
  (`src/game/game.ts`): `buildArena`'s return object is unused by the
  game for station state, so `arenaExtras(g)` constructs the
  `Stations` directly from `LEVEL.stations` (the level the page chose,
  the same object `buildArena` built; the build's return object carries
  no station state, the page keeps its own).
  The `step` hook drives `stations.update` each frame; `respawnAtEntry`
  calls `stations.reset()`, so a death, a try again and a play again
  all start the run with every station live again. The `render` hook's
  `stationPrompt` reads `stations.prompt` for the prompt element. A
  level without stations: `new Stations(..., [])` has empty items,
  `update` returns at once, `prompt` returns null and nothing changes,
  as before (the card's level-without-stations-loads-as-before case).
- **Bugs found in this session:** (1) the gate in `passes` divided the
  eye-to-point delta by the forward *length* instead of dotting the view
  with the normalised delta, so a view aimed straight at the point scored
  -1 and failed the cone (the unit test caught it); the gate now dots
  the normalised view with the normalised delta, the finisher's way. (2) The test passed the same `STATION` object to
  every `Stations` in the suite and `spent` bled across tests; fixed
  with `structuredClone`.
- **Verified:** `npx tsc --noEmit` clean; `npx vitest run` 99 files,
  674 pass, 2 skip; `npm run build` clean; dash check clean on every
  touched file (PLAN.md and this entry re-checked after editing them).
  New tests: `tests/arena/stations.test.ts` (8 station cases and 6
  use-key precedence cases, headless, a bare Rapier world) and
  `tests/level/env-03.test.ts` (3).
- **Not seen by eye (no browser in this session, card rule is no dev
  server):** the cabinet's shape and the screen's text, whether it
  reads as Paul's 1990s office computer or as a generic box, whether
  the grille and slot are visible at play distance, the two sounds, and
  the prompt's replacement of the vacuum's (the render logic is
  unit-chosen, I have not run it). For play: `arena.html?watch&level=env-03`,
  stand in front of a cabinet, hold E for 0.6 s; all three should grant,
  a fourth hold on a spent cabinet should play the spent buzz; the vacuum (a foamer in view) and the finisher (at the exit pad) should still take the key first.
- **Left to Paul:** meta name for `env-03.json` and which mod each
  station offers in the real level are his per the card; the stage 1
  commit body notes the [Paul] placeholders.
### 2026-11-07: ENV-02 review, merged (Claude Opus 5.5): the toy button

- **Bug, fixed in review: a swing pressed a button through a wall.**
  `ButtonSystem.pressNear` was a reach and angle test only (its comment
  said the swing's own line had proved a clear path; it had not). The
  divider in `env-02` is 1 m thick and the melee reach is 2.2 m, so a
  swing in the north room pressed the button on the south face. It now
  casts a sight ray from the eye to the cap (the player's own capsule
  excluded) and presses only if the cap is the first thing met. New test
  3b in `tests/level/env-02.test.ts` failed before and passes after.
- **Played** (`arena.html?watch&level=env-02`): the door is locked on
  load; a dart on the wall button presses it and opens the door; the walk
  through to the pad completes the level; standing on the floor button
  presses it and opens the door; a swing from in front presses the wall
  button (after the fix too).
- Not checked: walking onto the floor button rather than landing on it
  (the watch helper only places the player), the look of the plate, cap
  and lit colour (the pane was hidden), the two sounds. With the pane
  hidden the camera does not turn with the watch's look, so swing tests
  that face anything but the start direction are not valid there.

### 2026-11-07: ENV-02 stage 2 (DeepSeek V4.1 Flash via Pi): the button test level

Task: `tasks/ENV-02.md`, E08, stage 2 only (a test level). Branch `env-02`,
not merged and not pushed.

What was built: `data/levels/env-02.json`, registered as `env-02` in
`src/arena/levels.ts` and in the key list of `tests/level/ring-load.test.ts`.
Two 10 x 10 m rooms sharing a 1 m divider at z = 0, joined by one 2 m wide,
3 m tall door (a 1 m lintel above it). The door `env-02-door` is `locked` in
its arena's file state, so it is shut from the first frame. The single arena
`env-02-chamber` has `noLock: true` and no waves: nothing ever re-states the
door, the trigger clears the arena at once, and the exit pad (north room,
z = -8) ends the level. The player starts in the south room at [0, 0, 8], so
the level can only be finished by opening the door. Two buttons, both wired
to `env-02-door`: `door-button`, a wall button at [-1.6, 1.3, 0.56] facing +z
(chest height beside the door), and `floor-button` at [3.5, 0.06, 4.5], off
the walking line across the south room.

Path into play, the ENV-01 lesson: `chosenLevel` (`src/arena/levels.ts`) ->
`buildArena` (`src/arena/extras.ts`) -> `buildLevel` (`src/level/build.ts`,
which builds one plate, cap and collider per entry in `level.buttons`) ->
`ButtonSystem(level.buttons, events.setDoor)` -> the dart's `onHit`, the
melee's `pressNear` and the per-frame `step` -> `events.setDoor(id, "open")`
-> `level.doors.get(id).setState("open")`. The arena's `locked` door is set
by the same `setDoor` the runner's reset uses, so a retry shuts it again and
`buttons.reset()` makes the buttons able to open it.

Tests: 5 in `tests/level/env-02.test.ts`, all through `buildLevel` and the
real `LevelRunner`. It validates with no errors; the door blocks the walk
north and clearing the arena does not open it; the wall button opens it by a
swing and the way then reads clear; the floor button opens it by a step; the
doorway is clear air with floor under the start and the exit.

`npx tsc --noEmit`, `npx vitest run` (672 pass, 2 skipped) and `npm run build`
pass. No em or en dashes in the new and touched files.

Not checked by eye (no browser here): that the two rooms read as two rooms in
play, that the door's yellow slab reads as shut and then gone, that the wall
button at 1.3 m looks chest height from the player's eye at 1.6 m, that the
plate sits flush against the divider rather than in it, that the floor button
is clear of the walking line, that the cap lights after a press, and the two
sounds. The geometry numbers were reasoned from the data, not looked at.

### 2026-11-07: ENV-02 stage 1 (DeepSeek V4.1 Flash via Pi): the toy button, wired into play

Task: `tasks/ENV-02.md`, E08, stage 1 only (the button and its wiring).
Branch `env-02`, not merged and not pushed.

- **Data.** `data/buttons.json`: a 0.5 x 0.12 x 0.5 m `plastic` plate, a
  0.25 m diameter, 0.08 m tall `foam-ink` cap that sinks 0.06 m and lights
  `foam-lime-light` when pressed, and `stepTolerance` 0.06 m. Orange and
  yellow are avoided, as ENV-01's review resolved (orange is a weak point,
  yellow is the player's darts). Two new sounds in `data/sounds.json`,
  `ENV-button-press` (a click and a rising chirp) and `ENV-button-dead` (a
  click), listed in `design/SOUNDS.md`.
- **Level data.** `Level.buttons?: Button[]` in `src/level/format.ts`:
  `id`, `pos`, a unit `facing`, `action.open`. Sizes are global, so a
  button entry carries no `size`, unlike a door. `src/level/build.ts` gives
  `BuiltLevel.buttons`, and `src/level/validate.ts` checks the ids, that
  `facing` is a single unit axis, that `action.open` names a door of the
  level, and that the raised cap stays under the ceiling.
- **The press.** `src/level/buttons.ts` builds the plate, the cap and one
  cylinder collider round the cap. `ButtonSystem` turns a dart collider
  (`pressByCollider`), a melee swing (`pressNear`, tested at the melee's own
  `reach` and `arcDeg`) or a step (`step`, floor buttons only) into one
  press: the action runs on the first press, every later press returns
  `opened: false` and only clicks.
- **Wiring, the ENV-01 lesson.** The button reaches the arena page through
  `src/arena/extras.ts`, not only the tests: the dart's `onHit` chain
  presses a cap, the melee's new `presses` counter asks `pressNear` when it
  changes (so a held key presses once and a bash presses too), `step` runs
  each frame, and the door opens through `events.setDoor`, the same verb the
  lock-in uses, so the door's sound and mesh move come with it. A retry
  calls `buttons.reset()` after the runner re-locks the doors, or a lit
  button could never open them again. `watchState` reports `buttons`.
- **Shared game code touched:** `src/game/melee.ts` gained `presses` (a
  count of swings and bashes, zeroed by `reset()`) and the `reach` and
  `arcDeg` getters. No other game module changed.
- **Tests.** `tests/level/buttons.test.ts`, 10 tests, every one built
  through `buildLevel` so the collider a dart meets is the one that exists
  in play: a level with buttons validates and builds one handle each; a
  fired dart presses a cap and opens the door once; a second press clicks
  and changes nothing; a swing in reach presses, out of arc and out of
  reach do not; the cap squashes into the plate and lights; a step on a
  floor button presses and a step beside it does not; a wall button is
  never pressed by walking; a level with no buttons loads exactly as
  before; a retry's reset lets the re-locked door be opened again; an
  unknown door name is a validation error.
- `npx tsc --noEmit` clean, `npx vitest run` 98 files and 667 passed with 2
  skipped, `npm run build` clean, the em dash check clean on every file
  touched.
- **Not checked by eye:** there is no browser in this run. Nobody has seen
  the plate and cap in the world, the cap's squash and lit colour, the two
  sounds, or a real dart, swing or step pressing one in `arena.html`. The
  stage 2 room is not built, so there is no place in a level to do that yet.

### 2026-11-07: ENV-01 stage 3 review, merged (Claude Opus 5.5): crates break whole

- **Bug, fixed in review: the rule never ran in play.** `buildArena`
  (`src/arena/extras.ts`) handed the game the level's voxels and mesh but
  not its crates, so `createGame` had none and no carve was counted: 60
  darts left a crate's tally at 184 of 184. It now passes `level.crates`.
  The unit tests call the crate code directly, so they could not see this;
  no test builds the arena page (it reads its level from the URL).
- **Played** (`arena.html?watch&level=env-01`, the Dartman): every crate
  starts at 184 voxels; a dart that lands takes 1 to 14; stack B's bottom
  crate broke after 7 darts and stack A's left crate after 12, and each
  top crate fell (A's to the floor, B's tumbled off its plinth and rolled
  about 2.6 m); stack A's right crate stayed whole at 184.
- **Seen while testing, not changed:** with the browser pane hidden the
  page's render frame does not run, so the voxel mesh is not rebuilt; a
  falling piece is released after `islands.maxHoldTime` (0.5 s) onto the
  old colliders, settles and sleeps, and nothing wakes it when they go.
  In play the frame runs and the rebuild is far quicker than 0.5 s, so the
  crates fell once the test ran the rebuild each step. But on a slow
  machine a rebuild over 0.5 s would leave a piece floating: worth a bug
  card (`src/voxel/pieces.ts`, wake a released piece when its source
  finishes remeshing).
- Not seen by eye: the pane was hidden, so the break and the fall were
  read from the voxel volume and the piece bodies, not watched.

### 2026-11-07: ENV-01 stage 3, a crate breaks whole when worn (DeepSeek V4.1 Flash via Pi)

Task: stage 3 of `tasks/ENV-01.md`, after the review found the topple never
happens in play (a dart cuts a crater in the near face; the back panel and
bars keep the top crate tied to its plinth unless a full ring is cut).

- A crate is the set of volumes tagged with one `crate` id. All five crates'
eighteen volumes are tagged in `data/levels/env-01.json` (`cr-a-l`,
`cr-a-r`, `cr-a-top`, `cr-b-bottom`, `cr-b-top`); the three wood plinths are
untagged, so no plinth is ever part of a crate and no bedrock row is ever
counted.
- New `src/voxel/crates.ts`: `Crates` counts each crate's destructible
voxels at load, tallies every carve against it, and once it has lost
`crate.breakShare` of them (0.25 in `data/destruction.json`) it empties the
rest at once and returns those voxels in the carve's removed list, so the
existing island search sees the whole crate go and the crate above falls.
`burstCrate` turns a break into debris through `DebrisSystem.spawn`, which
keeps the `debris.max` and `debris.perCarveMax` caps.
- Counting is over each crate's union box, once, not per volume. Counting the
  18 volumes separately gave 384 for a 216 voxel crate: the six panels and
twelve frame bars overlap. The union box is 184 voxels a crate (the panels
and bars, not the hollow inside).
- `src/level/build.ts` records one `CrateBox` per tagged volume (same
rounding as the fill) and puts `crates` on `BuiltLevel`.
- One carve path: `carveReport` in `src/game/game.ts` runs the crate tally,
the break debris, the islands and the nav patch. `impacts.onCarve` (darts)
and the new `MeleeEvents.carves` (melee, `Melee.press` now reports
`{target, removed}`) both feed it, so no carve source counts twice or
misses.
- Tests: `tests/voxel/crates.test.ts`, 8 tests, all green: tags and plinths,
  counting, under and over the share, the crate above becoming an island at
  the right height, an untagged volume unchanged, the union box count, the
  debris caps, and a real melee swing's carve counting once against a crate.
- `npx tsc --noEmit`, `npx vitest run` (641 pass, 2 skipped) and
`npm run build` are clean. No em or en dashes in the files touched.
- Not checked by eye (no browser here): the break in play, whether 184
voxels split into the six panels and twelve bars reads as a crate
collapsing, and whether one swing past the share feels right at 0.25. The
melee carve was proved in a unit rig, not in the page.

### 2026-11-07: ENV-01 review (Claude Opus 5.5)

- Stage 1, the cladding, passes: tsc, 633 tests and the build are green,
  and in the page eight darts took 82 voxels off the coat's east face and
  nothing else moved. The pane was hidden, so this was read from the voxel
  volume, not seen.
- Colours changed in review. The crate frame was `foam-orange` and orange
  means a weak point (Paul, 2026-11-07); it is `foam-ink` now. The coat was
  `foam-yellow` and yellow is the player's darts; it is `foam-white` now.
  Both are Paul's to change.
- Crates are now hollow (six 0.1 m cardboard panels inside the same frame)
  and the offset top crate of `stack-a` sits on the 0.1 m grid at x -5.6
  (it was at -5.45, half a voxel off, so one edge was rounded away).
- **Not working in play: the topple.** The tests pass because they delete a
  whole bottom crate at once. In the page, 150 Dartman darts on a solid
  crate, 40 slugs on another, and 120 darts on a hollow one all left the
  top crate standing: darts carve the near face and the back panel and
  bars keep the top crate tied to its plinth. A stack only falls if a full
  ring through the bottom crate is cut from every side. Needs Paul's call:
  a crate that breaks whole after a share of its voxels is gone (a small
  rule in the voxel code), or crates stay cover to chew through and only
  explosions topple them.
- The wall and ceiling anchors write no bedrock (DeepSeek's finding, true:
  `fillPieces` in `src/level/build.ts`). A wall or ceiling piece under the
  6000 voxel island search budget drops whole on its first carve.
  `store-window` and `tower-plug` (1-2) and `pit-island` (1-4) use them;
  not checked yet whether any is small enough to drop.

ENV-01 stage 2 merged locally 2026-11-07, not pushed (card `tasks/ENV-01.md`,
DeepSeek V4.1 Flash via Pi, branch `env-01`): E02, the toy crate stacks, in
`data/levels/env-01.json`. A crate is 0.6 m: a 0.4 m `cardboard` body with
twelve `foam-ink` bars on its edges, each bar 0.2 m thick so it overlaps
the body by 0.1 m and stands 0.1 m proud of the panel it frames (one 0.1 m
voxel, per the reviewer's correction; the card said 0.08 m). Thirteen
volumes per crate, which costs one KIT 5 zone: the room is now 3 of 6 (the
coat 2, the stacks 1 each), counted in the test by the chunks the built
volume actually allocates, not by volume entries.

Each stack is ONE `floor` anchored piece, and that is what makes the topple
work. `fillPieces` writes a bedrock row under a floor anchor only, so the
bottom of the piece is a hidden 0.6 x 0.1 x 0.6 wood plinth and every crate
above it hangs from that row through its own voxels. Carve a bottom crate
out and the crate above has no path to bedrock, so `findIslands` returns it
as one island carrying both its frame and its panel: the crate breaks as one
crate and falls. Three separate floor anchored crates would each get their
own bedrock bottom row and could never fall; three unanchored crates would
be free islands that drop the first time anything touched them.

`stack-a` (x -5.3 / -4.7, z 1.4) is two bottom crates with the top over the
left one only at x -5.45, so it touches the right crate only along an edge
(the islands search is 6-connected, faces only) and cannot stay up on the
right crate when the left one goes. `stack-b` (x 2.5, z 1.0) is a plain
column of two. A top crate bridging both bottom crates was rejected: it
shares faces with both, so shooting one out leaves it tied to the other,
which is correct but shows nothing.

The frame is foam (`foam-ink` after review) rather than `wood` because a standard dart carves
0.12 m and `carveSphere` divides that by hardness: against wood (2.5) the
effective radius is 0.048 m, under `minEffectiveRadius` 0.5, so a dart
could not remove a single frame voxel and the stack would be permanent. The
body stays `cardboard` (0.7, so 0.17 m, a few darts per panel).

Tests in `tests/level/env-01-crates.test.ts`: the level validates, the zone
count is 3 (of the cap 6), each crate is 13 volumes spanning 0.6 m on every
axis with a 0.4 m body and twelve bars, a stack tops out at 1.3 m (under the
1.5 m mantle), only the plinth is on the lowest row, and carving a bottom
crate leaves exactly one island, 0.7 m to 1.3 m up, with both materials and
fewer boxes than `maxCollidersPerPiece`. Both stacks are tested, and the
right bottom crate of `stack-a` is proved still standing. Stage 1's
`tests/level/env-01.test.ts` was narrowed to judge the coat on its own (it
had asserted the room held exactly one piece). `npx tsc --noEmit`, full
`npx vitest run` (633 pass, 2 skipped) and `npm run build` clean; no em or
en dashes.

Not checked by eye (no browser here): how the frame reads at 0.6 m, whether
the 0.1 m proud bars look like a frame or like a bulkier box, the stack
silhouette in the room, the fall itself in play (only the island search is
proved, not the rigid body's tumble and rest), and whether a settling crate
lands on the nav grid sensibly.

### 2026-11-07: ENV-01 stage 1, the cladding test room and E01 (DeepSeek V4.1 Flash via Pi)

- Card `tasks/ENV-01.md`, branch `env-01`, stage 1 only. Stage 2 (E02
  crates) is not started.
- `data/levels/env-01.json`: one plain lit room, 16 x 16 m inside walls,
  5 m ceiling, a player start at `[0, 0, 6]` facing north and an exit pad
  at `[3, 0.01, -6]` with its box. `arenas: []`, so no lock: the
  `LevelRunner` is `complete` from the first frame and the pad ends the
  level on touch. Registered as `"env-01"` in `src/arena/levels.ts`, and
  `arena.html?level=env-01` picks it.
- E01: `col-shell` is a shell box, 0.8 x 3 x 0.8 m at `[-3, 1.5, 0]`,
  indestructible. `col-coat` is one `cover` piece of four volumes, 0.3 m
  thick on all four sides, `foam-white` (yellow after the review: yellow is the player's darts) so it reads softer than the
  greybox shell, and each volume touches the next at the corners. It is
  floor anchored on purpose: a wall anchor gets no bedrock row from
  `fillPieces`, so the first carve would drop the whole coat as one
  island. See the PLAN section 14 rows.
- Zone count against KIT 5: **4 volumes, cap 6**, all in the one room.
  The validator does not count them (its rule 3 counts volumes inside an
  arena, and this level has none), so `tests/level/env-01.test.ts`
  asserts the count itself.
- Tests, all new or one line changed: `tests/level/env-01.test.ts` (7
  tests: it registers and validates clean, the runner completes with no
  arena, floor under the start and pad, no coat volume shares space with
  the shell column, the coat stops a side shot, and carving the whole
  west face away leaves the shell column solid, the bedrock anchor row
  in place and the other three sides standing). `tests/level/ring-load`
  test 5's level list gains `env-01`. No `src/voxel/` or `src/level/`
  code changed.
- `npx tsc --noEmit`, `npx vitest run` (626 pass, 2 skipped) and
  `npm run build` clean; no em or en dashes in the files touched
  (checked with perl).
- Not checked by eye (no browser here): whether the room reads as lit
  and empty at all, whether the coat's four sides show the 0.1 m gap at
  the top and bottom the file note describes, whether a dart's real
  carve radius chews the coat at the rate the test's 4 voxel spheres
  model, and whether the exit pad ending the level on touch works in a
  running page rather than in the runner's model.

### 2026-11-07: GAME-10j review, merged (Claude Opus 5.5): the F10 Turbo

- **Look, fixed in review.** The head was all lime; the card asks for a
  purple body with a lime visor, so the head is purple with a lime visor
  box above the slit eyes (the F04's pattern). The launcher was a 0.5 m
  tube hanging from the forearm to the floor, reading as a third leg; it
  is now a short tube on the outside of the right wrist. Its tip was
  orange, which means a weak point; it is ink. Turnaround and poses
  re-rendered and checked by eye: in the windup the launcher comes up and
  points forward.
- **Bug, fixed in review: the Turbo never fired in play.** The release
  needs the Foamer within 2 m of height of the player (`dy < 2` in
  `src/foamers/foamers.ts`), so at its 4 m hover every strike released
  nothing. Qwen's shot test passed only because it stood the player 3 m
  up. The limit now applies to melee only; a ball flies from any height.
  New test 3b (a player on the floor, the Turbo at its hover) failed
  before the fix and passes after. A ranged Foamer on a ledge more than
  2 m above the player now fires too, where before its strike fizzled.
- Test 4 (the steer runs out) read a ball that had already hit the player
  or the floor; it now keeps the ball in the air (player 40 m off, launch
  9 m up) and checks it is still flying.
- **Played on the range** (`range.html?watch`, the F10 button): it hovers
  at 4.0 m; a pink ball leaves about 5.4 m up and curves onto a player
  10 m off, two hits in 6 s; after a 5 m sidestep the ball turns at the
  90 deg/s cap (18 deg per 0.2 s) and goes wide; four parries out of four,
  the homing cleared on each, and the returned balls took it from 30 to
  14 health; one jet off it drops to 2.0 m, both off to the floor and it
  still winds up to shoot; the launcher off, no launches and it walks in
  10.6 m in 3 s to bonk.
- Not checked: the slower flight with one jet (the range holds it in its
  ring, so it did not move; the unit test covers the speed), the three
  sounds by ear, and the range's parry helper, which predicts a straight
  flight and so cannot time a ball that is still curving (the parries
  above were done by raising the shield at 2 m).
- tsc, 635 tests (2 skipped) and the build are green.

### 2026-11-07: GAME-10j stage 3, finished (Qwen 3.8-27B via Pi): docs and the done-list

- The card's own stage 3: a verification pass, not new build. The
  whole done list is checked and all held: the new test files
  (`tests/foamers/f10-fly.test.ts`, `tests/foamers/f10-homing.test.ts`,
  `tests/ai/f10-brain.test.ts`) cover each item of the done list
  (spec loading; hover check; lowering + slowing down on one jet
  damage and flight to the floor; jet weak point; steering on the
  moved player and stopping after `homing.seconds`; per-step turn
  upper bound; parried ones don't follow; no flight with the launcher
  destroyed; live cap; tests of other types unmodified). The PLAN row
  and the item-14 judgment (stages 1-2) are in order; this entry and
  the Status finish the HANDOFF.
- Final gate on the updated docs: `npx tsc --noEmit` clean, `npx
  vitest run` 634 pass 2 skip, `npm run build` clean, dash check clean.
- What's left unverified by everything (no browser on this machine):
  the turnaround PNG and the play-look, the homing ball's behavior
  in the game field, the wind-up/attack poses, the three new sounds
  (F10-jet / F10-shot / F10-fall), and the range page with an F10
  button from it. Branch `game-10j` has the three stage commits
  above `7c0fd04` and is unmerged and unpushed.

### 2026-11-07: GAME-10j stage 2, committed (Qwen 3.8-27B via Pi): the F10 Turbo's homing shot

- Stage 2 of `tasks/GAME-10j.md` on branch `game-10j` (stage 1 is
  `7c0fd04`; the card's stage order: look + flight, then homing,
  then docs).
- **Shot:** `data/foamers.json` type F10 gets the `homing` block (the
  card's starting numbers: speed 7, gravity 1, radius 0.1, lifetime
 6, chunks 3, maxLive 6, seconds 2.5, turnDegPerSecond 90), and
  `src/foamers/homing.ts` adds `homingShotKind` (the pink parryable
  `BALL_MATERIAL`, the flight times and turn rate live on the
  ball: `BallKind.homing`). `foamers.ts` fires it at the
  windup/strike handoff. The launch comes from the blaster's part:
  `handAt` in `projectiles.ts` now tries `ball` and then tries
  `blaster` (the F07's sword set that precedent).
- **Homing:** `steerHoming` turns the horizontal velocity toward the
  player, and by no more than `turnDegPerSecond * dt` in a given step
  (the speed is retained, this is the card's limit); after
  `seconds` run out the ball flies straight. Parry (`bounce`) zeroes
  `homingLeft`, so the parry's own steering is the next steer, and
  the ball never goes after the player again.
- **Launcher gone:** `chooseAttack` falls through via data `needs`
  (no code). The brain has the single line GAME-10g/h gave the
  Crawler and the Trawler: while only the bonk remains, the brain
  walks in like a bonker's (otherwise the 12 m ring carries it from
  the bonk it can never reach).
- **Pose:** `homingShot` cases in `rig-states.ts`: the windup raises
  the wrist launcher, the strike whips it forward through the ~60%
  mark, and both land on rest. Rendered to
  `design/foamers/poses/F10-{windup,strike}-t0.5-*.png` (unverified
  by eye: no browser).
- **Sounds:** `data/sounds.json` and `design/SOUNDS.md` get
  `F10-jet` (looping, follows the F06-hum pattern; the hum block now
  reads `floatOf ?? flyOf`, so both flyers share one loop path and
  the F06's hum stops on the same line as always), `F10-shot` (one
  per firing), `F10-fall` (one, when the jet hiss stops). None of
  them was audible.
- **New tests** in `tests/foamers/f10-homing.test.ts`: the type
  reads its own numbers, it's pink and parryable; a launch from the
  blaster's tip (the F02 still from the ball hand); a real attack
  fires one of that kind; it steers toward the player and then
  flies straight, the turn rate holds per step over the whole
  flight; a parried shot does not go after the player; launcher
  gone means bonk and no shot; live cap of 6 holds.
- `npx tsc --noEmit`, full `npx vitest run` (634 pass, 2 skipped),
  `npm run build` clean; perl dash check clean on every file
  changed.
- Stage 3 (docs check) is next: re-check the card's done list, the
  PLAN row, and a room one-liner.

### 2026-11-07: GAME-10j stage 1, committed (Qwen 3.8-27B via Pi): the F10 Turbo's look, type and flight

- Stage 1 of `tasks/GAME-10j.md` on branch `game-10j` (own worktree,
  ENV-00 runs in `design/` at the same time, not these files).
- **Look:** the F10 rig's greybox is the palette: a purple body and arms
  (the rig's own material), a lime head (the visor, the painted slit eyes
  stay), lime wings and the blaster's trim, orange jets with their orange
  tips. The rig also gained four purple legs (F02's pattern): the card
  says both jets gone means it drops to the floor and walks, and a
  four-legged rig walks. `npx tsx tools/render-rig.ts F10` renders the
  turnaround to `design/foamers/F10-{front,side,back,three-quarter}.png`
  and the sheet; a script then checks, from the solved rest pose, that
  the jets sit on the lower back one on either side and the blaster
  dangles from the right forearm's end (all pass). Not checked by eye:
  the PNGs could not be opened here (no browser).
- **Type:** an `F10` in `data/foamers.json`: rig F10 (health 30, speed
  3.5), a `fly` block (hover 4 m, bob 0.12, damaged hover 2 m, damaged
  speed share 0.6, the jets as its fins), the jets a weak point
  (x2), and attacks `homingShot` (ranged, needs the blaster, damage 10,
  windup 0.6) and the base `bonk`. It fights with the Roamer's brain
  (the ranged token picks `f02`), holding at 12 m (PLAN section 14 says
  what was reused).
- **Flight:** the F06's float path, reused: `src/foamers/fly.ts` keeps
  the flight's numbers (same shape as the float), and the one flight
  block in `src/foamers/foamers.ts` reads `floatOf(spec) ?? flyOf(spec)`.
  With one jet out it flies low and dull; with both gone it falls to the
  floor and walks (the test walks, does not cruise).
- The weak-point data now names its parts (`parts: ["gun"]`, the F10's
  `["jetL", "jetR"]`); the Crawler test saw one line change with it.
- New tests: `tests/foamers/f10-fly.test.ts` (spec, hover, slow down with
  one jet, walk with both, weak-point count) and
  `tests/ai/f10-brain.test.ts` (ranged brain, 12 m ring). `npx tsc
  --noEmit`, full `npx vitest run` (626 passed, 2 skipped), `npm run
  build` clean; the perl dash check on every file touched is clean.
- Not in this stage (stage 2): the homing ball and its turn cap, the
  launcher-less no-fire, the live cap, the poses for the shot and the
  sounds. Not yet checked by eye: the palette, the flight in the page.
### 2026-11-07: Paul's answers to Q17 to Q20, and the ENV-01 to ENV-03 cards (Claude Opus 5.5)

- Recorded Paul's answers in `PLAN.md` sections 13 and 14 and in section 0
  of `design/levels/ENVIRONMENT.md`, with a look line on E02, E08, E09 and
  E13 and a dropped or paused line on E12 and E07.
- Wrote `tasks/ENV-01.md` (E01, E02), `tasks/ENV-02.md` (E08) and
  `tasks/ENV-03.md` (E13), with PLAN rows. Each builds its own test level
  (`env-01` to `env-03`) so they do not touch real levels.
- Moved eight decision rows that sat above the section 14 table header
  (left by an earlier merge) to below it, so the table renders.
- Open: which hazard can kill in Act 1 and how it hurts in foam terms.
  The station's beige case and green or amber text are a starting
  proposal on Paul's styling note, for him to tune.

### 2026-11-07: ENV-00 review, merged (Claude)

- Read `design/levels/ENVIRONMENT.md` in full: what exists today, 13
  candidates (E01 to E13) across destructible, hazard, movement,
  interactive, changing cover and stations, a first set of five (E01
  cladding, E02 crate stack, E04 sticky patch, E08 toy button, E12 ammo
  station) and Q17 to Q20 in PLAN section 13. Foam and toys only, no
  fluid, fire or shock, `[Paul]` on every look; blaster and Foamer names
  are Paul's own. Docs only; the suite passes (619, 2 skipped).
- Waiting on Paul: which elements to build, and Q17 to Q20.

### 2026-11-07: ENV-00, the environment element list (design only)

- Card `tasks/ENV-00.md`, branch `env-00`. No game code touched: the
  deliverable is `design/levels/ENVIRONMENT.md`, a proposal for Paul.
- Section 1 lists what terrain the game has now and where it lives
  (`src/level/format.ts`, `src/level/build.ts`, `src/voxel/pieces.ts`,
  `src/voxel/islands.ts`, `src/arena/rifts.ts`, `src/pickups/pickups.ts`,
  `src/ai/nav-grid.ts`), plus the two rules that limit every candidate:
  the nav grid decides where a Foamer can follow, and the caps (6 zones,
  150 debris bodies, 12 Foamers, 8 pickups) are hard.
- Section 2 has 13 candidates, E01 to E13, one table then a paragraph
  each: look in foam and toy terms, what it teaches, Foamers and blasters
  by ID from `design/CONTENT-PLAN.md`, the README pillar it serves, cost
  (S, M, L) and what code it needs against the real modules, and risks
  (caps, nav bake, readability, age 10+). Kinds: destructible (E01, E02),
  hazard (E03, E04), movement (E05 to E07), interactive (E08, E09),
  changing cover (E10, E11), stations (E12, E13).
- Decided, for Paul to overrule: foam cladding and the crate stack are
  free because `Piece` plus the island path already does them; the sticky
  patch and the vent are one multiplier and one push on the controller;
  the ferry is the only L (it needs the ride-on-a-kinematic-body work the
  KIT lift also needs); buttons, targets and latches share one hit
  trigger; ammo and upgrade stations share one registry.
- Section 3 recommends five first: E01 cladding, E02 crate stack, E04
  sticky patch, E08 button, E12 ammo station, each S or M and each
  reusing existing code. Section 4 gives Q17 to Q20, added to PLAN.md
  section 13, with `[Paul]` left for every look.
- PLAN.md: the ENV-00 row now reads proposal for Paul.
- `npx vitest run` passes (no code changed). Not checked by eye: nothing
  visual was built, so there is nothing to look at yet.

### 2026-11-07: LVL-04b stage 3 review, merged (Claude): Level 1-4 is whole

- The first start got no reply from OpenRouter in three tries (Pi never
  opened a session); a test call worked minutes later and the restart
  built the stage in two commits.
- Read the diff: `data/levels/1-4.json` and its tests only. The older
  assertions it changed follow the level going on past the Ring. Its
  PLAN edit had dropped the row's task cell; restored here.
- Main merged in (HANDOFF Status and Log conflicts, both kept). `tsc`,
  the full suite (619 pass, 2 skipped) and the build pass.
- Played by script at the Yard: it locks; wave 1 spawns staggered (2
  Darters, 8 Swarmers); wave 2's 13 fill up to the 12 cap and hold, and
  one taken down lets the 13th in (23 spawned in the arena, 10 plus 13).
  Cleared, the north door opens; from it the lift is a lit lime panel at
  the end of the corridor; stepping on it shows "Level complete".
- Not checked: the islands as high ground and their jump gaps, the fight
  by hand, the frame time with 12 Foamers in the Yard.

### 2026-11-07: LVL-04b stage 3, the Yard and the lift (DeepSeek V4.1 Flash via Pi)

- Task: the card's stage 3, the last one. The A6 Yard gauntlet past the
  Ring's north door, both waves, and the lit lift as the level's real exit,
  with the temporary pad removed.
- Built in `data/levels/1-4.json`: a 4 m corridor from the Ring's north
  door, the yard shell (44 x 36 m, 9 m ceiling, a doorway in each end wall
  with a lintel), six island pieces, the arena `yard` (A6) with four rifts,
  two doors, a floor-level trigger 6 m inside the south door and a
  checkpoint at the door, A6 and A7 ammo, and the lift past the north door
  (a short corridor, a 6 x 5 m room, the 3 x 3 m lime pad, a lime-light
  panel on white walls). `LEVEL.exit` moved onto the pad, so the existing
  box test in `src/arena/extras.ts` triggers it with no shared-code change.
- Decided: islands are one voxel volume each because 3.2 m is the
  per-volume cap and the arena's six-zone budget is already full with six
  islands. Wave 2's 13 stays, with `holdSeconds` and the page's cap doing
  the work, rather than cutting a Foamer the concept names. The lift is lit
  with bright materials, not a new light, because the level has no point
  lights and adding one is a render change this card does not ask for.
- Tests in `tests/level/level-1-4.test.ts`: 24 now, 5 of them new (the
  yard's size, ceiling and island gaps; the walk from the Ring to the lift
  and the islands as high ground; both waves and the doors; the lift as a
  lit 3 x 3 m pad 30 m from the yard centre; and a run of the arena with
  the page's spawn cap). Test 10 now runs each arena with that same cap
  instead of counting the file, and the old "ring is last" and pad asserts
  were updated, not loosened.
- Green: `npx tsc --noEmit`, `npx vitest run` (615 pass, 2 skipped),
  `npm run build`. No em or en dashes in the files touched.
- Not checked by eye: everything below. A browser was not available.

### 2026-11-07: GAME-10i review, merged (Claude)

- Read the diff: the `swing` attack in data (range pinned at 2.4, needs
  the sword), the punch now needing `foreArmL` only, the swing's windup
  and strike motion, the two sounds. Small and in the card's files.
- Fixed in review, from the turnaround: (1) the blade's bottom sat on
  the hand, so it grew back up the forearm past the shoulder with the
  grip at the tip. Now it hangs from its hilt end at the hand, tilted
  forward (rest -1.2 rad), hilt and guard at that end. (2) The cross
  guard was orange, the weak-point colour; it is purple now. Turnaround
  and the F07 pose sets re-rendered (the crouch and leap sets show the
  rest pose, as before: the renderer has no pose for those states).
- Main merged in (one HANDOFF log conflict, both kept). `tsc`, the full
  suite (614 pass, 2 skipped) and the build pass.
- Played on the range: from 4 m it closes to about 2.2 m and swings
  (beyond the old punch's 1.7 m), hitting for 16; with the sword broken
  off (hilt and guard go with it) it punches with the left fist.
- Not checked: the swing seen from the side in play (in first person it
  points at the camera), the two sounds by ear. The sword is 1.5 m, not
  the card's 1.2 m; Paul to judge.

### 2026-11-07: GAME-10i, the Brawler's foam sword (Qwen 3.8-27B via Pi, branch `game-10i`)

- Stage 1, the sword: `fistR` in the F07 rig is gone; a `sword` weapon
capsule (0.3 m wide, 1.5 m long, the card proposed about 1.2 m) is
parented to `foreArmR` at the fist, with a `swordHilt` and a
`swordGuard` as children, so `breakPart` drops all three in one piece.
The left fist stays. The `swing` attack (data/foamers.json) needs the
sword and pins `range: 2.4`, 0.7 m past the punch's 1.7 plus the 0.3 m
grace; the punch's `needs` are now `foreArmL` only, so `chooseAttack`
falls to it when the blade is gone. No melee code changed: `needs`
carrying does the fallback. `windupMotion` and `strikeMotion` got a
`swing` case, a wide horizontal arc. Stage 2: `F07-swing` and
`F07-sword-break` in data/sounds.json and design/SOUNDS.md; the
`attack` sound picks the swing over the punch, and `breakPart` got a
`sword-break` kind (the shield-break's pattern). Four tests in
`tests/foamers/brawler.test.ts`: the rig shape (sword, no `fistR`, part-
own health), the blade darts away in 20 hits with hilt and guard, a
player at 2.2 m is bonked by a `swing` (outside the punch's reach), and
sword-less the next bonk is the left-fist `punch`. The GAME-10f leap and
shockwave tests pass unchanged.
- `npx tsc --noEmit`, `npx vitest run` (606 pass, 2 skipped) and
`npm run build` all pass; no em or en dashes in the files touched.
- Not checked by eye (no browser here): the turnaround renders and the
windup and strike pose renders in `design/foamers/` (faced right in
render-rig.ts), the moving swing in play, and the two placeholder
sounds by ear.

### 2026-11-07: LVL-04b stage 2 review, merged (Claude)

- Read the diff: a cached promoted rig copy in `FoamerSystem.spawn`
  (1.5 times the health, chest and brow in `foam-purple-light`, from the
  `promoted` block in `data/foamers.json`), the page passing the wave's
  flag and the alive Foamers' health, and `Wave.startsWithHealthShare`
  in the runner (optional: a page that reports no health keeps the old
  rule). Small and in the files the card allowed.
- Main merged in, no conflicts. `tsc`, the full suite (610 pass, 2
  skipped) and the build pass.
- Played by script at the Ring: both Darters spawn promoted, 45 health,
  light purple plates, seen on screen against the deep purple body with
  the orange back still the only orange. Wave 2 waits at 50 of 90 health
  (55%) and starts at 42 (47%), all 6 Swarmers arriving with the pair
  still up. Cleared, the north door opens and the pad shows "Level
  complete".
- For Paul, from the model's section 14 rows: the Ring is a through room
  with two doors, not the concept's four shutters, and reuses 1-3's 30 x
  30 m room with a 10 x 8 m block, so the ring is about 10 m wide, not
  6 m.
- Not checked: the fight by hand, the pillars and ammo by eye, the
  frame time.

### 2026-11-07: LVL-04b stage 2, promoted Foamers and the Ring (DeepSeek V4.1 Flash via Pi)

- Card `tasks/LVL-04b.md`, stage 2 only, in two commits.
- Promoted spawns are data: `data/foamers.json` gained a top-level
  `promoted` block (`healthMultiplier` 1.5, `parts` per rig id), and
  `src/foamers/foamers.ts` builds a cached rig copy from it inside
  `rigForSpawn(spec, promoted)`. `spawn`'s new fourth argument defaults
  to false, so every existing caller is unchanged; `src/arena/extras.ts`
  passes the wave's flag through. Health is scaled on the rig, which the
  Foamer's constructor also uses for part hit points, so plates and body
  are 1.5x together.
- The health-started wave is in `src/level/arena.ts` (a `peakHealth` the
  runner tracks while a wave is up) and `src/level/format.ts`
  (`Wave.startsWithHealthShare`). `ArenaContext.aliveHealth` is optional
  so the other pages and tests keep compiling; the page adds the living
  Foamers' health each step.
- The Ring is a through-room, not the concept's sealed pit: doors on the
  south and north walls, both locked in the fight and opened on the
  clear, so the exit pad can sit past it and the level keeps one line
  north. The four pillars match KIT 5's cover pillar; A4 and A5 counts
  match the concept's station table.
- Tests: `tests/level/level-1-4.test.ts` 19 (walk to the pad, the Ring's
  shell and loop, its waves and the health share, the pillars and ammo,
  the moved pad, the promoted health and plates) and
  `tests/level/arena.test.ts` three for the runner rule.
- Not checked by eye: everything visual listed in Status, and nothing
  was played in a browser. Not touched: `src/ai/`, `src/player/`,
  stages 3 to 5.

### 2026-11-07: LVL-04b stage 1 review, merged (Claude)

- DeepSeek's first LVL-04b run spent 86 minutes and 143 tool calls
  reading with no edit and was stopped. A fresh run limited to stage 1,
  with its first edit due by its sixth reply, built it in one commit.
- Read the diff: `data/levels/1-4.json`, its test file, PLAN, HANDOFF
  and the card. The older tests it changed follow the level going on
  past the bridge (the arena list, the pickups, the bridge escape now
  starting the Pit instead of ending the level); none loosened.
- Main merged in (HANDOFF Status and Log conflicts, both kept; the
  GAME-10h Status paragraph corrected to "merged locally"). `tsc`, the
  full suite (602 pass, 2 skipped) and the build pass.
- Played by script on `arena.html?watch&level=1-4`, starting at the
  Pit: the floor 4 m below the ring locks it; wave 1 is 2 Darters and 6
  Swarmers, wave 2 is 3 Darters and 6 Roamers arriving staggered; the
  north door opens on the clear and the pad in breather 2 shows "Level
  complete".
- Not checked: walking the ramps by hand (the player was moved by
  script; the nav test covers them), the west island over its hole, the
  Pit's look (the camera faced a wall), the frame time with 9 Foamers.

### 2026-11-07: LVL-04b stage 1, the Pit and breather 2 (DeepSeek V4.1 Flash via Pi)

- Built in `data/levels/1-4.json` only, plus the stage's tests in
  `tests/level/level-1-4.test.ts` (10 tests became 14). No shared game
  code changed.
- The ring's north wall is now a doorway (`ring-wall-n-w`,
  `-e`, `-lintel`) into a 4 m corridor (`corr4-*`) under the far yard.
  The far yard's floor is at -9 and the corridor's is too, so the way
  south to the Pit is flat and then drops 4 m.
- The Pit: 34 x 26 m over x -17..17, z -176..-202. South and north
  ledges at -9, pit floor at -13, a 7 m ramp up at each short end
  (`pit-ramp-e` at x 9.5, `pit-ramp-w` at x -9.5, 4 m rise, 0.57
  slope). Its doorways are floor-to-lintel openings 8 m tall so the
  bakes keep the ledge layer as well as the floor layer: a wall pier
  from the ledge down reads as a 4 m step the agent cannot climb.
- Pieces: the centre block (three 2 m columns of foam-orange, a
  3.2 m volume each), two ring pillars 1.6 m square, and the west
  island (3.2 x 0.4 x 3.2 m) anchored `wall` over the shell gap at
  x -13.2..-16.8, z -187.4..-190.6. `wall`, not `floor`: a floor
  piece's lowest voxel row is filled with bedrock in
  `src/level/build.ts fillPieces`, which would plug the hole.
- Arena `pit` (A1): trigger on the pit floor 3 m in from the south
  door, `pit-in` open, `pit-out` locked, both open on the clear.
  Wave 1: 2 F05 from the north-east and north-west rifts plus 6 F03
  from the floor rift. Wave 2: 3 F05 plus 6 F02, the first two from
  the north seams and the rest from the floor and a south rift. Both
  waves use one rift slot per spawn, filled in order, so the list is
  spelled out in the JSON.
- `a3-ammo` (8 standard darts) on the west ledge. `s3-marking` and
  `u2-marking` in breather 2, no pickups there.
- `exit` moved from the ring to breather 2 `[0, -7.5, -207]` so the
  level still ends. Stage 3 replaces it with the lift.
- Tests: the walk ring -> corridor -> south ledge -> floor -> east
  ramp -> east ledge, the two ramps' ground heights, the island's
  anchor, the waves' spawns and rifts, the trigger, breather 2's size
  and marks, and no ammo in breather 2. Two older tests were updated
  because the level no longer ends on the ring: after the escape the
  runner now starts the Pit, and the last arena is `pit`.
- Decided: the north door stays locked until the Pit clears, so stage
  3 has to open it (or the lift pads the way) rather than walking
  through it; the card says the lift waits for that.
- Not checked: everything by eye. The pit's proportions, whether the
  centre block reads as cover, the ramps' feel, the corridor's height,
  and the actual arena fight (waves, rifts, timing) are only tested
  through the runner and the grid, never played.

### 2026-11-07: GAME-10h review, merged (Claude)

- The Spark (dgx-spark) committed stage 1 and stopped answering mid stage
  2; Qwen 3.8-27B on qwen-machine took the uncommitted stage 2 over,
  fixed its three tests (they waited for the attack choice, not the
  wall leaving the launchers) and wrote the docs. Two of its commit
  messages had the Co-Authored-By trailer with no blank line before it;
  reworded on the branch before the merge.
- Read the diff: `src/foamers/wall.ts` (the spec, the seeded slots, the
  wall kind), `launchWall` and a shared `spawnBall` in
  `projectiles.ts` (the old per-field defaults now one
  `SHARED_BALL_KIND`), the strike branch in `foamers.ts`, the launcher
  multiplier. The gap uses the existing `makeRng`, never `Math.random`.
- Main merged in (PLAN and HANDOFF conflicts, both kept; the LVL-04a
  Status paragraph corrected to "merged locally"). `tsc`, the full
  suite (598 pass, 2 skipped) and the build pass.
- Played on the range: from 16 m it holds near 12 m and fires a row of
  10 slots 0.6 m apart at chest height, two side by side left out (the
  gap), the two centre balls hitting the player for 8; on screen the
  row of orange balls and the gap read clearly. With both launchers
  broken it fires nothing, walks in at its slow speed and picks the
  stomp at 1.4 m.
- Not checked: crossing a gap by hand, one launcher's half wall in play,
  the stomp's damage landing, the three sounds by ear, shoulder spikes
  (not built; the rig keeps nubs).

### 2026-11-07: LVL-04a review, merged (Claude)

- Read the diff: `data/levels/1-4.json`, the level list, a new test file
  and the level id list in `tests/level/ring-load.test.ts` (one id added,
  nothing loosened). The seven section 14 rows are sound: full design
  sizes, 2.8 m explore pillars, 3.2 m hall columns for the KIT 5 cap, a
  clear 40 m centre lane for the charge, `noLock` plus `escape` for the
  bridge, B03 from the loadout order, no fall damage.
- Main merged in (one HANDOFF log conflict, both sides kept). `tsc`, the
  full suite (585 pass, 2 skipped) and the build pass.
- Played by script on `arena.html?watch&level=1-4`: the forecourt
  renders with its four targets; the explore room locks and its Darter
  telegraphs, charges, hits for 8 and stuns on the wall; the hall locks,
  wave 1 is 4 Swarmers and a Darter, wave 2 is 4 Roamers and 2 Darters,
  and its doors open on the clear; the bridge starts both Darters with no
  door shut; stepping off the deck's side drops the player 9 m to the
  ring, the escape ends the arena and removes the Darters, and the pad
  shows "Level complete".
- Not checked: the shield charge against a Darter on the deck, the
  blast wall over the yard hole, whether the hall's columns read as
  cover, the frame time. The page title is "DART: the Pit" for every
  level (`arena.html`, older than this card).

### 2026-11-07: LVL-04a, Level 1-4 beats 1 to 5 (DeepSeek V4.1 Flash via Pi)

- Asked: build beats 1 to 5 of Level 1-4 from its approved LVL-00 concept
  in a new `data/levels/1-4.json`, list it for `arena.html?level=1-4`,
  and cover the card's done-when with tests. Beats 6 to 10 are out of
  scope; GAME-10b's `1-4-ring` test file is untouched.
- Built, all in the level file: forecourt with four foam dummies at 4, 6,
  10 and 15 m and the A1 box (24); the 14 m corridor into a 16 x 12 m
  room with two pillars and one Darter as a one-wave arena; the A4 hall
  (18 x 44 m, 7 m ceiling, six columns, four rifts, two waves, A2 ammo at
  column 3); the alcove off the corridor past the hall with the U1 mark;
  the A8 bridge: two yards, a 4 x 24 m deck 9 m over an 8 m ring, no
  doors, `noLock`, two Darters, an `escape` box over the ring, a blast
  wall over a 3.2 m hole in the near yard's floor, and the S2 mark; a
  temporary exit pad on the ring below the deck. `_notes` in the file say
  what the card asked to be noted (the dummies, the missing fall damage,
  the temporary exit, the [Paul] marks, nothing scaled).
- Decided and why, in PLAN.md section 14: the explore pillars are 2.8 m
  not 1.6 m (1.6 m hides nothing at eye height); the hall columns are
  3.2 m zones at the KIT 5 cap, three foam and three shell as LVL-03b
  did; the centre lane is held clear for the F05's 14 m `rangeMetres` and
  18 m `metres`; the bridge yard floors are split into four pieces around
  the hole so the hole is a real hole, not a decal; B03 comes from the
  loadout order rather than a stand, the card's own fallback.
- Tests: `tests/level/level-1-4.test.ts` (10) check validation with the
  arenas in order, floor under the whole walk sampled every metre from
  the start to the far yard, the hall and both yards walkable on a nav
  grid baked the way the arena page bakes it with the path across the
  bridge, the lane clear in both directions at every column's z, the drop
  landing at -9 (and the yard's hole), every rift `canStandAt`, the
  bridge ending on the escape with Darters up and no door shut, and the
  exit pad doing nothing until the last arena ends. One line in
  `tests/level/ring-load.test.ts` gained `1-4` in its expected key list;
  nothing was loosened elsewhere.
- Not checked by eye (no browser here): the four spaces' look and
  reading, the dummies' placement against the walls, whether the Darter
  actually charges down the hall lane between the waves, the shield
  charge on the bridge, and the 9 m drop. The F05 windup against a real
  player is untested.

### 2026-11-07: BUG-11 review, merged (Claude)

- Read the commit: one line in `tests/foamers/parts.test.ts`'s `tick`
  (`debris.update(dt)` before `world.step()`), the same order as the
  game's fixed step (`src/game/game.ts`). No game code, no assertion
  changed; test 8 still checks the headbutt and its 0.9 s windup. The
  four probe files were removed before the commit.
- Main merged into the branch (one HANDOFF log conflict, both sides
  kept); `tsc`, the full suite and the build pass on the merge.
- Noted, not changed: `src/voxel/debris.ts` throws its chunks with
  `Math.random`, and the chunks collide with Foamers, so they can change
  a fight. The project rule is a seeded PRNG in simulation code. That is
  a card of its own if it matters for replays or tests.

### 2026-11-07: BUG-11, why parts.test.ts test 8 failed once in a full run (Qwen 3.8-27B via Pi, branch `bug-11`)

- Symptom as card: test 8 (both forearms gone, the next attack must be the 0.9 s
  windup headbutt not the 0.6 s bonk) failed once in a full `npx vitest run` on
  main, 15 of 15 alone, 11 full runs clean, the failure was made while two other
  models' test suites ran on the same machine.
- Cause: the test-only `tick` in `tests/foamers/parts.test.ts` ran
  `darts.update`, `foamers.update`, `world.step` but not `debris.update`,
  whereas the game's fixed step (`src/game/game.ts`) ages and dies the foam
  chunks every step. Breaking both forearms in the test carves the two parts
  and throws a handful of real chunks (`src/voxel/debris.ts` spawn: 4 s life,
  0.108 m cubes, random direction and speed out of `Math.random`). Where a
  chunk lands is random, and under a loaded event loop the pending mesh work
  in `settleAll` and `breakOff` resolves in a different order, so a chunk can
  land in the Foamer's walk line. The chunks die after 4 s in the game, but in
  the test tick they are immortal. A chunk on the line under the autostep
  (0.2 m, data/ai.json) still holds the character controller's straight walk on
  some rolls, so the Foamer never closes the approach to the 1.3 m attack range
  in the 10 s window and the windup never starts.
- Forced proof: planting one immortal 0.108 m chunk in the walk line made test
  8's sequence stall in 5 of 10 forced runs (probe `parts-probe8` 8L); the same
  scene with the game's tick (debris ages out at 4 s) passed 30 of 30 and every
  forced variant. That is the on-purpose failure the card asks for.
- Fix: `tick` in `tests/foamers/parts.test.ts` now calls `debris.update(dt)`
  before `world.step()`, matching the game's fixed step order, so a chunk that
  throws itself in the walk line dies 4 s later like in the game. Test-only,
  one line. No assertion was removed or loosened; test 8 still checks the
  headbutt and its 0.9 s windup.
- Gates: `npx tsc --noEmit`, `npx vitest run` (554 pass, 2 skip) and
  `npm run build` all pass; 30 solo test-8 runs and 5 loaded full-suite runs
  (a second full suite in the background) all green.
- Not checked by eye in a browser: the change is in the test's tick, nothing
  visual moves.
- Search for other non-determinism in the code test 8 runs: `Math.random` in
  the debris spawn (direction and speed) is the one real source. No
  `performance.now`, `Date.now`, `setTimeout`, `setInterval` or `crypto` in
  `src/foamers/`, `src/weapons/darts.ts`, `src/voxel/debris.ts`, the
  `src/voxel/carve`/`mesher` path, `src/physics/world.ts` or `src/ai/` that
  touches this test.
- Separate, untouched: the `tower-throw.test.ts` timeout from BUG-10's notes.

### 2026-11-07: LVL-03b review (Claude)

- Merged locally at 07:21 on a quiet machine (load 3): main (with
  GAME-10g) merged in, `tsc` clean, full `npx vitest run` 575 pass and 2
  skipped, `npm run build` clean. The two load failures noted below did
  not recur.
- DeepSeek's first run and a resumed one both died on "Stream ended
  without finish_reason" (OpenRouter), the first with the runner edits
  uncommitted. A fresh session (13 MB of old context dropped) finished
  the card in three commits. Main was merged into the branch first; one
  HANDOFF conflict, both sides kept.
- The card allowed `src/level/` only; the model also added `onEscaped` to
  `src/arena/extras.ts` (clear the Foamers the drop left behind, dim the
  rifts). That is the page side of the escape the card asked for, so it
  stays.
- Played in the browser (`arena.html?watch&level=1-3`, jumped to the
  hall by setting the runner's arena index, health refilled by script):
  the hall started on the trigger with no door shut, Swarmers spawned
  every 4 s behind the player (7 up at 26 s); dropping through the hole
  at z -152 ended the hall and cleared all 7; `drop-hatch` read sealed
  about 3 s after the drop. The Ring locked on its trigger; its 10
  Swarmers all reached the player (every one within 3 m from 2 s on).
  Waves cleared by script: 10 Swarmers, 12 Swarmers, 4 Roamers, then
  `ring-out` opened and the exit pad showed "Level complete".
- Not checked: the look of the hall, the drop, breather 2 and the Ring
  (the pane was hidden); the mantle chain onto the block; whether a
  player can outrun the chase; frame time with 12 Swarmers in the lane.

### 2026-11-07: LVL-03b, the hall chase, the drop, breather 2, the Ring and the exit (Pi)

Task: build card `tasks/LVL-03b.md`, beats 6 to 9 of Level 1-3.

Built:
- `src/level/`: `ArenaRunner` gained `noLock` (the trigger starts the
  waves, no door is set, no "Clear the arena" banner) and `escape`
  (`{ box, sealDoors, sealDelaySeconds }`: the arena ends by leaving with
  its Foamers up, opens no unlockOnClear door, seals the named doors
  after the delay). `LevelRunner` steps the seal for every arena each
  frame, because a cleared arena is not stepped again. Tests in
  `tests/level/level-runner.test.ts`.
- `data/levels/1-3.json`: the temporary exit is gone. The hall (A4,
  18 x 44 m, 7 m ceiling, three 3.2 m voxel columns and three 4 m shell
  ones), the drop (the lane's last 6 m is a hole over breather 2, 6 m
  down, 3 m ledges either side and `drop-hatch` over it), breather 2
  (10 x 8 m, 35 darts, U2 and S3 marks as 0.1 m slabs), the Ring (A2,
  30 x 30 m, a 10 x 8 x 3.5 m shell block with a 1.5 m and a 1.3 m step
  on its east face, four rifts, four 1.6 x 1.6 x 2.8 m voxel pillars, A5
  and A6) and the lit 3 m north exit with its pad.
- `src/arena/extras.ts`: `onEscaped` clears the Foamers, so the hall's
  Swarmers cannot hold the cap or block the Ring.
- `tests/level/level-1-3.test.ts`: five arenas in order and their waves;
  floor under the walk from the start to the drop's lip and from the
  drop's foot to the exit; the hole under the lane's end; the Ring's ring
  a loop; the block top walkable through the steps; no nav path back up
  the drop; the chase and the 3 s seal on the file; the exit still dead
  until the Ring clears.

Decisions in PLAN.md section 14 (2026-11-07 rows): the escape ends the
chase at the room, the Roamers are a third wave so no more than 12 are
alive, the hall columns are three zones plus three shell, the block's
steps fit the 1.5 m mantle, and the second A3 is `breather2-ammo`.

Checks: `npx tsc --noEmit` clean, `npx vitest run tests/level` 90 pass,
`npm run build` clean, no em or en dashes in the touched files. Commits
`9fc45ca` (runner) and `10d16cc` (level and page).

Not checked by eye: no browser here, so nothing was walked through. Not
verified: that the two block steps and the 0.7 m jump really mantle onto
the Ring's block top; that the drop reads as a drop and the 3 s seal is
not too fast or slow; that 12 Swarmers at 4 s gaps are fightable in a
44 m lane and the hatch reads as shut; that the exit door is visible from
the Ring's east side; where the U2 and S3 marks sit. Two full-suite tests
(`tests/ai/nav-grid.test.ts` bake budget and `tests/foamers/rig.test.ts`
snap loop) failed all session with the machine at load average 242 from
the other models' runs, so they were not trusted as green or as this
card's bugs.

### 2026-11-07: GAME-10g review, merged (Claude)

- Merged main into the branch first (it was cut before BUG-09 and
  BUG-10); one HANDOFF log conflict, both sides kept.
- Played on the range (`range.html?watch`, F09 spawned 14 m out): it
  held at 14 m, wound up 0.8 s and fired bursts of 12 pellets over 1.2 s;
  about 4 or 5 of each 12 hit the player. Broke the gun (`breakPart`): no
  more pellets, it walked in to 1.8 m and stomped. The turnaround matches
  the card's palette.
- No code changes. Noted: the spread's PRNG is `makeRng` from
  `src/audio/synth.ts`, so Foamer code now imports from the audio
  module (synth.ts has no imports, so nothing heavy comes with it). A
  shared `src/core/rng.ts` would be cleaner; left as is. The render
  tool's sheet label drops digits and some letters ("F0", "RAWLER" on
  F07); the tool's pixel font, not this card.
- Tests: the Crawler, Brawler and Floater tests (31) pass and the build
  is clean. Merge held for a quiet full run: BUG-11's loaded runs held
  the load average near 300 for over an hour, and under that load the
  full suite fails 5 s timeouts on main too (`tower-throw.test.ts`, and
  `pit-load.test.ts`, whose BUG-10 fix now bakes ten times, so it
  outgrows the default timeout under heavy load where one bake fit).

### 2026-11-07 GAME-10g: the F09 Crawler (Qwen 3.8 Flash Next via Pi, branch `game-10g`)

Task: card `tasks/GAME-10g.md`, three stages. Built: stage 1 the look
and the type (rig palette deep orange / purple legs / lime gun, the F09
entry in `data/foamers.json`, sheets in `design/foamers/`,
`tests/foamers/crawler.test.ts`); stage 2 the stream, the weak point and
the stomp (`src/foamers/pellet.ts` new: `pelletOf`, `weakpointOf`,
`canStream`, `pelletKind`; firing in the strike branch of
`src/foamers/foamers.ts`; barrel spin and stomp motions in
`src/foamers/rig-states.ts`; `F09-spinup`, `F09-pellet`, `F09-step` in
`data/sounds.json`, `design/SOUNDS.md` and `src/audio/foamer-sounds.ts`;
`tests/foamers/crawler-stream.test.ts` 9 tests, `tests/ai/crawler-brain.test.ts`
2 tests); stage 3 these docs plus the PLAN.md row and three section 14
entries, and the `design/foamers/README.md` row.

Decided (full text PLAN.md 14): `decideF02` fits the Crawler unmodified,
its own spec distances do the work; the gunless close (stomp distances =
`attackRange` in `stepBrain`) is a system read, not a brain state;
spread seeded per burst and pellet through `makeRng` from
`src/audio/synth.ts`; a ranged attack that keeps a ring must pin its
firing `range` outside the ring (the F06's trick; without it the stream
never fired: floating-point equality against the parking distance).

Unverified: nothing seen by eye (no browser here): the range with an
F09, the rig's pose and spin, the stomp, the three placeholder sounds,
and the rendered sheets (generated, not viewed). `tests/ai/nav-grid.test.ts`
(bake under 150 ms) and `tests/foamers/rig.test.ts` (movement never
snaps, a 5 s testTimeout) are the two wall-clock timing tests in the
suite: they failed on every run while this machine's load average sat at
about 350 (other agents' test runs), and one full-suite run was green
(569 pass, 2 skipped) when the load dipped. They are not touched by this
card (the F09's own motions pass the same snap check in
`tests/foamers/crawler*.test.ts`'s rigs); a rerun on a quiet machine is
the last thing this card leaves open.

### 2026-11-07: BUG-10 review, merged (Claude)

- Read the diff: tests and `vitest.config.ts` only. Budgets unchanged
  (150 ms bake, 2 ms query, 1000 ms Pit bake, 0.35 rad); the rig test
  walks the same rigs and frames and asserts the worst jump once per rig,
  naming the frame and joint. Two choices to know about: the timed tests
  now take the fastest of nine runs (the card allowed fastest or median;
  the fastest is the more lenient of the two), and `maxWorkers: 6` caps
  vitest's pool for every run.
- Checked: the full suite on the branch took 6.98 s; it also passed with
  a second full suite running at the same time, and passes on main after
  the merge.
- Open, from the model's notes: `tests/ai/tower-throw.test.ts` timed out
  once under load (5.6 s against the 5 s default). Not looked into.
- New flake after the merge: one full run on main failed
  `tests/foamers/parts.test.ts` test 8 (headbutt after both forearms);
  15 of 15 alone and the next 11 full runs passed. Card BUG-11.

### 2026-11-07: BUG-10, the load-sensitive tests (Qwen 3.8-27B via Pi)

Task: `tests/ai/nav-grid.test.ts` (the 40x40 timing test),
`tests/foamers/rig.test.ts` ("movement never snaps") and
`tests/level/pit-load.test.ts` ("bakes the whole Pit's nav grid") failed
in full `npx vitest run` only when the machine was busy. All test and
runner changes; no game code; no budget raised, no frame or rig dropped,
no assertion removed.

Reproduced under load (a second full suite running at the same time):
5 of 5 runs red. The nav timing test failed on the bake 258 ms against
the 150 ms budget (loaded single bake: 220 to 299 ms in the five
reproduction runs), and on the query in two later runs (median of 9 at
4.4 ms against the 2 ms budget). The rig test failed with "Test timed
out in 5000 ms" after about 7 to 12 s of wall time. One out-of-scope
failure was seen and written up here, not fixed: `tests/ai/tower-throw.test.ts`
"does not throw into the slab" timed out in 5000 ms in one loaded run
only (a 30 s simulated fight at 60 Hz is near the default 5 s timeout
when the process is starved of CPU); it also passed once per loaded run
of the final verification.

Cause of each failure, with the evidence:

1. The suite oversubscribes the machine. Vitest 5's default pool spawns
   one fork per test file, so a full run is about 85 forks on a 12-core
   machine; each fork gets little over 15 percent of a core. A wall-time
   measurement then measures the machine, not the work. Evidence: the
   40x40 bake printed 36 ms in the BUG-03 row of this log, 85 to 101 ms
   in idle full runs here, and 220 to 300 ms in the five loaded runs,
   the median of every consecutive sample raised.
2. The rig test called `expect` once per joint per frame: 13 rigs times
   1800 frames of 30 s times about 30 parts, roughly 700,000 one-argument
   `expect` calls. Alone it took 1425 ms (already over a third of the
   5000 ms timeout); when the fork also lost CPU time, it ran 7.4 to
   12.3 s and hit the timeout with every jump still under 0.35 rad
   (the timeout error, not an assertion, is every failure in the logs).

Fixes (the two timed bakes, the query and the rig test keep the budgets
the cards set):

- `vitest.config.ts` gets `maxWorkers: 6`. Each fork is well fed again,
  so wall time reflects the work's own cost even while another full
  suite runs. The suite still takes about the same 7 s (total CPU work
  is unchanged; only the 85-to-12 oversubscription is gone).
- `tests/ai/nav-grid.test.ts` and `tests/level/pit-load.test.ts`: each
  timed bake now times 9 identical bakes and asserts on the minimum
  (median of 9 was still 220 to 300 ms under load, because the whole
  run is busy, not one of nine samples). The nav query keeps 9 timed
  queries but asserts on the minimum too: its median measured 4.4 ms in
  the loaded runs against the 2 ms budget, the same starvation. The
  game's page pays one bake and one query; the budget is about their
  own cost, which the fastest sample measures.
- `tests/foamers/rig.test.ts` "movement never snaps": same frames (30 s
  of 60 Hz per rig), same rigs, same 0.35 rad limit, but the worst
  per-frame jump is collected per rig and asserted once per rig, the
  frame and the joint named in the message. 1425 ms to 114 ms idle,
  114 to 170 ms in the five loaded runs.

Verification: `npx tsc --noEmit` clean, `npm run build` clean, `npx
vitest run` 85 files 554 pass 2 skipped, and after the fix five full
runs while a second full suite ran all green (before: 5 of 5 red). Test
times, idle vs loaded (the card asks for before/after): the 40x40 bake
assert fell from 220 to 300 ms to 68 to 95 ms; its query from 4.4 to
1.5 ms to 1.1 to 1.5 ms; "never snaps" from a 5000 ms timeout to 114
to 170 ms; the Pit bake ran 1621 to 1766 ms wall in the five loaded runs
(asserts on the baked grid itself, the minimum of its 9 bakes).
Not checked by eye in a browser: nothing renders; the changes are the
runner's parallelism and what three test files time.

### 2026-11-07: BUG-09 review, merged (Claude)

- Read the diff: test files only, no game code. The eight `settle`
  helpers now loop until `mesh.busy` clears (the level tests' pattern),
  and test 1's crossing health is band + 0.5, so one dart decides it
  instead of the dart's bounce re-hit. That does not loosen the test: it
  still asserts the crossing hit gives the finishable stagger.
- Checked: the fixed finisher test passed 25 of 25 runs alone, and the
  full suite passes on main after the merge. The 2 in 80 failure rate
  before the fix is the model's own probe; I did not reproduce it.
- Noted, not changed: the new `settle` loops have no iteration cap (the
  level test's has 200), so a mesh that never clears `busy` would hang
  until vitest's timeout rather than fail fast.

### 2026-11-07: BUG-09, the flaky finisher test (Qwen 3.8-27B via Pi)

Task: `tests/foamers/finisher.test.ts` test 1 failed now and then in a
full `npx vitest run` (line 103, `f.finishWeakened` still false). Two
causes, both test-only; no game code changed.

Cause 1, the card's lead: every helper `settle` in `tests/foamers/` waited
one `setTimeout(0)` for the part's mesh promise (`tests/foamers/finisher.test.ts:30-38` before
the change, and the same eight files: `blocker.test.ts:42`,
`chunk.test.ts:36`, `darter.test.ts:20`, `fall.test.ts:41`,
`foamers.test.ts:28`, `parts.test.ts:30`, `ragdoll.test.ts:33`).
`VolumeMesh.update` sends dirty chunks to the mesher's promise and builds
the trimesh collider only when the promise lands
(`src/voxel/volume-mesh.ts` `update`/`apply`). On a loaded event loop the
chain can take more than one macrotask, so a fired dart met a missing or
stale collider. Proven by forcing: delaying the fake mesher by one extra
macrotask made the old settle miss the crossing shot. Fix: settle now
loops `update`/`setTimeout(0)` until `mesh.busy` is false, the pattern
`tests/level/level-1-3.test.ts` already uses. All eight files got the same
one-line-shaped change (added the `busy: boolean` to the mesh parameter
and the while loop) because they are the same bug.

Cause 2, found by a probe (test 1 copied in-process, 80 repetitions, per-hit
health deltas logged): at the test's old crossing health (band + 2 = 3.80,
band 1.80) the crossing needs two effective damages: the body dart's 1.0
and the bounce dart's 1.0 (13.04 m/s, over the 8 m/s `minDamageSpeed`).
Whether the bounce re-hit the body depended on the wound's remesh in flight
and where debris chunks from the first shot (random speeds, dart-castable)
fell: the probe failed 2 of 80, and in both failures the bounce dart hit
the floor or a debris chunk and health stopped at 2.80, above the band.
The fix: `tests/foamers/finisher.test.ts:108` sets the crossing health to
band + 0.5, so one dart's 1.0 damage alone crosses the band; the bounce's
re-hit (which deals at most one more 1.0) can no longer change the
outcome. 60/60 in-process after, and the same probe at band + 2 failed
2 of 80, which is the forced evidence.

Verification: the debug probe file was deleted before the gates. `tsc
--noEmit` clean, `npm run build` clean, `vitest run` 5 full runs clean
(82 files), `tests/foamers/finisher.test.ts` alone 30/30, no em or en
dash in any touched file. Could not check by eye in a browser: nothing
visual changed; the sole changed behaviour is the second shot's starting
health (3.80 now 2.30), which the test itself asserts via
`finishWeakened`.

Unrelated, observed but not touched (out of this card): in loaded full
runs `tests/foamers/rig.test.ts` ("movement never snaps", an assertion on
per-frame joint deltas) failed 3 of 10 full runs but passed 10 of 10 when
run alone; it is wall-time sensitive, the kind of timing test the card
warns can flake under load. It is not the BUG-09 failure: `finisher.test.ts` never flaked in the final verification. Flagged for whoever next sees it: a fixed 0.35 rad threshold on 60 Hz frames is a marginal bound when the isolate pool steals wall time.

### 2026-11-07: GAME-10f review, merged (Claude)

- Played on the range (`range.html?watch`, F07, spawned 10 m out): it
  walked in, crouched at 7.6 m for 0.6 s, flew 0.9 s, landed 1.5 m short
  of the player, and the lime ring grew to 8 m and hit once (health 100
  to 85), then it went back to punching. The palette matches the card;
  the turnaround is in `design/foamers/F07-sheet.png`.
- One fix: every Foamer of every type (a pack of Swarmers included)
  built its own torus geometry and material for the ring, and the
  landing rebuilt the geometry each leap. Now only a type with a
  `shockwave` block gets a ring mesh, built once at spawn at full radius
  and scaled, with one shared material; the geometry is disposed with
  the Foamer. New test 5b.
- Noted, not changed: the Spark's Status said "punch 10, like the
  Roamer"; the data is 14 and it uses the Slowmer's melee brain
  (corrected in Status). The punch lists both forearms in `needs`, but
  with one forearm gone `chooseAttack` falls back to the last attack, so
  it still punches.
- The full suite under the other models' load failed two timing tests
  (nav-grid bake, rig-motion "never snaps"); both pass alone.
- Not checked: jumping or dashing through the band in play, the sounds,
  the [Paul] sword or fists question.

### 2026-11-07: GAME-10f, the F07 Brawler, code done (Qwen 3.8 Flash Next via Pi)

- Card `tasks/GAME-10f.md`, branch `game-10f`, two commits: `4541c47` the
  look and the type, `e2277c0` the leap and the ring. Not merged, not pushed.
- Asked for: the F07 Brawler (CONTENT-PLAN F07) in the factory palette, a
  walk-in melee type with a punch, and a leap slam that lands a shockwave
  ring the player jumps or dashes through. Losing both legs ends the leap.
- Built: the rig's palette (purple body, orange armour pads, lime fists,
  angry eyes like the others) in `data/foamer-rigs.json`, turnaround
  rendered to `design/foamers/F07-*.png` with `tools/render-rig.ts`, and
  the crouch and leap poses to `design/foamers/poses/F07-{crouch,leaping}-
  t1-*.png` (rendered through the same encoder with `crouchMotion`/
  `leapMotion` at k 1); an
  `F07` type in `data/foamers.json` (health 45, a `punch` at 10, a `leap`
  block: min 5 m, max 12 m, cooldown 6 s, crouch 0.6 s, speed 7 m/s, arc
  1.4 m, land 1.5 m short; and a `shockwave` block: 9 m/s out to 8 m,
  0.6 m band, 15 damage); the leap and ring maths in a pure module
  `src/foamers/leap.ts`; the one decision in `src/ai/f07-brain.ts`
  (`decideLeap`, the sibling of `decideCharge`); two new `FoamerState`
  states (`crouch`, `leaping`) run by the Foamer system's machine, and
  their poses in `rig-states.ts` (`crouchMotion`, `leapMotion`, driven by
  data in the rig's `motions`); the ring as one torus per Brawler scaled
  as it grows; `F07-crouch`, `F07-punch` and `F07-land` placeholder synth
  sounds in `data/sounds.json` and `design/SOUNDS.md`; and the shockwave's
  hit on the player on both pages (`src/game/game.ts`, `src/range/main.ts`)
  behind `playerVulnerable` (`player.grounded && !player.dashing`).
- Decided: no new brain (the Roamer's does the walk-in and the punch, its
  token is `melee`), the F05's shape for the leap (PLAN 14, four entries).
  The arc's `vy` is read from the state clock, not integrated, because the
  character controller zeroes a vy on the frames after the launch and the
  Brawler hung at its apex (seen in the test's flight log). The flight's
  horizontal step goes through `_wish` at `leap.speed`, not `moveTowards`,
  which caps at the walk's 2.4 m/s. A leap blocked short by a wall still
  lands its ring at the end of the time. The one hit of a ring is marked
  inside `bandReaches`, so no caller can forget it. Sword or fists stays
  Paul's: the fists are kept, coloured lime, `[Paul]` notes in the rig and
  in PLAN 14.
- Tests: `tests/foamers/leap.test.ts` (8: the flight maths, the ring
  growing, the band hitting once, missing one the band has passed,
  missing one that spent it in the hole), `tests/foamers/brawler.test.ts`
  (8, in a physics rig: it crouches then leaps inside its distances and
  not outside them, the cooldown starts at the crouch, the flight is an
  arc that comes back down, the landing sends the ring out once and the
  ring is drawn, a grounded player is hurt once, one in the air is not,
  no leap with both legs gone and a leap with an arm gone), and
  `tests/ai/brawler-brain.test.ts` (3: `decideLeap` at the min, the max,
  inside the cooldown, without legs, and that only F07 has leap numbers).
  Full suite 553 pass, 2 skipped; `tsc` and `npm run build` clean.
- Not checked by eye: no browser here, and this model cannot open the
  rendered PNGs either. The turnaround and the pose sheets were rendered
  and their pose extents measured numerically (the crouch dips the body to
  1.81 m from 2.02 and the leap raises it to 3.04 with the arms up), but
  the Brawler in the game, the crouch and leap poses in motion, and the
  ring's look as it grows were not seen. The three
  placeholder sounds were not heard. The jump-over-the-band and the
  dash-through are unit tested (`playerVulnerable` false) but not tried in
  play, and the ring's own read at speed (can a player tell where it will
  land in the 0.6 s crouch) is a playtest question, not a code one.

### 2026-11-06: GAME-10c review, merged (Claude)

- One bug found in play on the range (`range.html?watch`, F06): the
  small blobs never bounced. After a bounce the blob's centre was left
  on the surface it hit, so the next frame's ray started inside it, hit
  with a zero normal and spent the second bounce at once; the blob burst
  within three frames. The Spark's wall test still counted two bounces,
  so it passed. Fix: lift the blob off the surface by its radius. New
  test 2b: a blob off the floor rises above 0.2 m and its two bounces are
  more than 6 frames apart (it failed at 1 frame before the fix). After:
  on the range a blob bounces off the floor, flies about 1.5 s, bounces
  off the far wall and bursts.
- Removed a second, unused `BlobSpec` interface the Spark left in
  `projectiles.ts` (the used one is in `blob.ts`).
- Seen in play: it hovers 3.00 m over the ground and spits fans of three
  lime blobs; the fourth attack was the big pink blob; one fin broken
  (`breakPart`) dropped it to 1.20 m, both to the floor (0.02 m), where
  it keeps spitting.
- For Paul to judge (the look is his): the spikes render as a jagged
  pixel crown rather than soft rounded nubs, and from the side the jaw
  sticks out as a separate orange lump and the fins are flat slabs. Both
  come from the greybox rig's shapes; only the colours changed here.
- Not checked: the three placeholder sounds by ear, the big blob's parry
  in play (unit tested), the mouth multiplier in play (unit tested), the
  hover over uneven ground in a level.

### 2026-11-06: GAME-10c, the F06 Floater (Qwen 3.8 Flash Next via Pi)

- Asked (card `tasks/GAME-10c.md`): Paul's F06, a Heavy that floats slowly
  and spits blobs: bouncing blobs and one big parryable one, the mouth a
  weak point only while open, fins lost making it sink and float slower.
- Built, in three commits on `game-10c`. Stage 1: the F06 rig's palette
  (lime body and nubs, purple fins and tendrils, orange jaw and mouth),
  the type entry in `data/foamers.json`, and the float in the Foamer
  system (hover from the type's `float` block over
  `navGrid.groundAt(x, z, y)`, no gravity, the same `steerAgent` path a
  walker takes, damaged hover and speed with fins lost, floor with none).
  Renders in `design/foamers/F06-*.png`. Stage 2: blobs. The
  `ProjectileSystem` takes a per-ball `BallKind` (speed, gravity, size,
  life, colour, bounces, cap, attack) from the type's `blob` block; a
  small blob reflects off the ray hit's normal (`castRayAndGetNormal`)
  until its bounce count runs out; the big pink one carries the Roamer's
  own material so both pages parry it unchanged. `handleHit` multiplies
  the jaw's damage by the type's `mouth.damage` while the state is
  windup or strike. Sounds: F06-hum (loop while flying, owned by
  `FoamerSounds`), F06-spit (the `throw` cue), F06-blobBounce (the
  projectile cue), all placeholder synths in `data/sounds.json` with
  rows in `design/SOUNDS.md`. Stage 3: this entry, the PLAN row and four
  `§14` decisions.
- Decided: reuse `decideF02` (no `f06-brain.ts`); the float is data plus
  the nav grid's ground, and the rig keeps no `hover` field (`rig.test.ts`
  pins the rig's lowest point to it, and it is a drawing height, not a
  physics one); a blob is a ball of a kind, not a second system; the
  open-mouth rule keys on the attack's own states, not a new timer; the
  Floater's speed is `rig.speed`, not `f.speed()` (the no-legs handicap
  would hand it 0.25 times). PLAN `§14` has the detail.
- Tests: `tests/foamers/floater.test.ts` (5: spec and health, hover over
  the floor after 5 s, one fin lost, both fins, killed goes down),
  `tests/foamers/floater-blobs.test.ts` (6: the fan and its material and
  bounces, bounce off a wall then burst, every fourth big blob and its
  material/size/speed, the live cap, the open mouth only, the data read),
  `tests/ai/floater-brain.test.ts` (2: ranged distances, keeps its ring).
  Full suite 524 pass, 2 skipped; `tsc` and `npm run build` clean.
- Not checked by eye (no browser here): the Floater's look and palette,
  the float and bob in motion, the blobs bouncing off real geometry,
  the big blob's parry in play, and all three sounds.
- Untouched as the card asks: level 2-2, the Floater in any level file,
  vacuum entries, flying over gaps the grid cannot path, tendril attacks.

### 2026-11-06: LVL-03a review, merged (Claude)

- One bug found in play: in the Pit's wave 1 a Swarmer stood at
  (-12, -51) in approach for over 25 s. Its rift sat on the pit floor
  under the north ramp, and a ramp is a tilted slab, so it spawned in
  the pocket under the slab. `pit-rift-n2` was under the slab's low end
  too. Moved n1 to the ramp's head on the west ledge (-15, 0.2, -51) and
  n2 just past its foot (-5.5, -3.8, -50). New test 4d: every rift in
  the level passes the nav grid's `canStandAt` (it failed on both rifts
  before the move). After: the first Swarmer walks down the ramp and all
  six reach the player within 16 s.
- In the browser (`arena.html?watch&level=1-3`): the explore pair comes
  out and reaches the player; the Pit's ramps feed the pack in; in the
  Yard's wave 1 two Swarmers were slow to leave the north end (about
  15 s) but did arrive. Every arena cleared by script, the Yard's north
  gate opened, and the exit pad showed "Level complete".
- Corrected in the notes: the Pit's third wave is two Slowmers, and the
  breather and the Yard are at the pit floor's height (-4), not 0.
- Not checked: the look of each space by eye (the pane was hidden; only
  the bay was seen: the dummies stand clear of the north door), the
  pacing with real shooting, the frame time with 10 Swarmers.
- Flaky test, open: after the merge one full run on main failed
  `tests/foamers/finisher.test.ts` test 1 (`f.finishWeakened` still
  false after 120 ticks); it passed alone and on the next full run. It
  counts ticks, not milliseconds, so load alone should not change it:
  something in it is not deterministic. Possibly the same unexplained
  vitest exit 1 seen before a push earlier on 2026-11-06. Not looked into.

### 2026-11-06: LVL-03a Level 1-3 beats 1 to 5 (DeepSeek V4.1 Flash via Pi)

Asked for (card `tasks/LVL-03a.md`): the bay, explore 1, Arena 1 the Pit,
the breather, Arena 2 the Yard and a temporary exit in `data/levels/1-3.json`,
listed in `src/arena/levels.ts`, with tests for the walk, the nav grid,
the swarm cap and the exit pad.

Built in three stages, each green before its commit:

- Stage 1 (`ef33c28`): the 18 by 12 bay (three foam-white dummies as
  voxel pieces, ammo A1 40), the two 10 m corridors and the 12 by 10
  explore room (one F01 and one F03 from the side seams, one wave, a lock
  so the pair cannot be walked past), then the Pit shell and its arena.
- Stage 2 (`ded13c0`): the Pit's centre block and two pillars, the 8 by 6
  breather, the 44 by 36 Yard with six islands, four gates, both waves and
  its ammo, the S2 and U1 marks, and the temporary exit pad.
- Stage 3: this entry, the PLAN.md row and section 14 decisions.

Decisions and why (also in PLAN.md section 14):

- The Pit's centre block is 3.2 m tall, not 3.5: a voxel zone cannot pass
  3.2 m on any side.
- The Yard islands are 3.2 m square, not 4 to 6, so six islands at one
  zone each fit the arena's six zone budget. Each has a 2.5 m ramp at
  26.6 degrees (inside the nav grid's 40 degree slope), and the nav test
  walks up and back down all six, so no Foamer is stranded.
- The U1 and S2 marks are flat 0.1 m shell slabs, not voxel pieces, for
  the same zone budget. Both carry the [Paul] note.
- East and west Yard gates are `sealed`, since the card's waves only use
  the short ends and a player should not leave mid fight.
- A wave's F03s already arrive one at a time at rifts and each is a swarm
  token Foamer, so no change to `src/level/` was needed. The card's
  question is answered in PLAN.md section 14 rather than in code.

Lesson: voxel colliders are built from mesher promises, so a test that
rays or bakes the nav grid must wait for `voxelMesh.busy` to go false and
pass `built.voxels` plus the volume origin to `makeLevelAI`, as the page
does. Without that the islands read as 4 m down and the down paths fail.

Not verified by eye: no browser was opened. The corridor and room look,
the pit ledges and ramps at 27 and 34 degrees, the yard islands' footprint,
door sizes, and how the Yard's 8 then 10 Swarmers feel in play.

### 2026-11-06: BUG-08 review, merged (Claude)

- The fix is small and stays in the existing states: `blockedSeconds` on
  the Foamer, filled in `stepBrain`, read by the F02 brain's hold case.
  One difference from the card: the timer counts whenever the flight is
  blocked and the player is outside the retreat distance, not only while
  it holds, so a Roamer that arrives at its ring already blocked walks on
  at once instead of sidling 3 s first. Harmless, left as is. tsc, 511
  tests and the build pass (one full run lost the nav grid timing test
  to the Spark's parallel run; it passes alone and on the rerun).
- In the browser (`arena.html?watch&level=1-2`, parry corridor and Ring
  cleared by script, player held at (-3, -29) under the slab): both floor
  2 Roamers left their ring once blocked for 3 s, walked across floor 2
  to the ramp and down it (y 5 until 9 s, 3.3 at 12 s, 0 by 15 s) and
  threw from the ground floor: 10 thrown, 10 hit in 30 s.
- Not checked: how the walk out of the ring reads in the Pit by eye, the
  Pit's live wave (headless 12 thrown, 11 reached).

### 2026-11-06: BUG-08, a Roamer blocked too long walks to the player (DeepSeek V4.1 Flash via Pi)

- Asked: a Roamer that finds no clear throw anywhere on its ring sidles
  for good. Level 1-2's tower shows it: two Roamers on floor 2 over a
  player on the ground floor under the slab never reach them.
- Built: the Foamer keeps `blockedSeconds` (reset by a clear flight and by
  arriving inside its retreat distance), the system fills
  `AgentInput.blockedSeconds`, and `decideF02`'s hold case past
  `brain.blockedRepathSeconds` (3, `data/ai.json`) asks for `followPath`
  instead of `ringMove`, or `backOff` inside the retreat distance. No new
  state; the reason is in PLAN section 14.
- Repro and counts: a new `tests/ai/tower-throw.test.ts` case, the two
  floor 2 rifts and the player at (-3, 1.6, -29), 30 s. That spot is off
  the stair well, so no arc can drop through the floor's opening: before
  the fix 0 thrown, 0 reached; after 10 thrown, 10 reached. The earlier
  `DOWN` spot at (-8, -29) sits under the opening and already reached (5
  thrown, 4 hit) without the fix, so it is not the repro and its test is
  left as it was.
- Also: the Pit case holds at 12 thrown and 11 reached (BUG-07's was 13
  and 13; no ball is lost, one fewer is thrown), the tower's floor 2 case
  is unchanged at 22 thrown and 21 hits, and F04, F01, F03 and F05 are
  untouched apart from the new input field.
- Tests: five brain cases in `tests/ai/f02-brain.test.ts` (sidles under
  the time, walks past it, backs off inside the retreat distance, back on
  the ring the step the flight clears, and approach unaffected).
- Decided 3 s by measuring 3, 4, 5 and 6 on both rigs; the numbers and the
  trade-off are in PLAN section 14.
- Not checked by eye: the Roamer walking down the tower's ramps in the
  browser, how the walk down and the return to the ring read in the Pit,
  and whether 3 s of sidling before it commits looks patient or slow to a
  player. The rigs are headless only.

### 2026-11-06: BUG-07 review, merged (Claude)

- DeepSeek's fix samples the ball's own launch arc (6 ball-radius shape
  casts with the ball step's filters, now one shared `ballIgnores`), cached
  per Foamer for 0.25 s; a Roamer with no clear flight does not start a
  throw, hands its token back (`noFlight`) and keeps sidling; a release
  that went blocked during the windup is cancelled. F04's fanned volley
  is exempt, its tests unchanged. Checked in review: the ball filter
  refactor is equivalent to the old one, the launch math is unchanged
  (moved into `launchVelocity`), `chooseAttack` is deterministic so the
  check judges the attack that is thrown. tsc, 505 tests and the build
  pass.
- In the browser (Pit, real wave 2, wave 1 cleared by script, player
  held at (0, 1.2)): 20 thrown in 30 s, 19 reached the player (BUG-06's
  review saw 2 in 10). The Roamers walked the ring between throws.
- Not checked by eye: the tower case (headless only: no bursts above
  y 3 with the player under the slab, 21 of 22 hits from floor 2); a
  Roamer that can find no clear spot at all sidles for good rather than
  pathing elsewhere.

### 2026-11-06: BUG-07, a Roamer throws only when its ball can arrive (DeepSeek V4.1 Flash via Pi)

- The card saw a Roamer throw into cover: in the Pit's wave 2, 8 of 10
  balls burst on the level trimesh 1.7 m from the hand, and in Level
  1-2's tower two Roamers on floor 2 kept throwing with the player under
  the slab. Cause: `FoamerSystem.lineOfSight` is one ray from the chest
  to the player's eye, while `ProjectileSystem.launch` throws from the
  ball hand, lower, on a lofted arc. A clear sight is not a clear throw.
- Headless repro first (`tests/ai/pit-throw.test.ts`): the Pit as the
  arena page builds it, one F02 at (-6.5, 0, 5.8), a still player
  capsule at (0, 0, 1.2), counting thrown, reached and burst. Before:
  18 thrown, 0 reached, 17 burst (one still flying).
- The fix is `ProjectileSystem.flightClear(from, eye)`: it rebuilds the
  launch's own velocity (`launchVelocity`, now shared with `launch`) and
  walks `ball.flightSegments` (6) shape casts of the ball's radius along
  the arc, with `ballIgnores`, the ball step's own filter. Level geometry
  stops the check; the player's capsule, foam chunks and Foamer parts
  (its own hand included) do not. `handAt` is shared too.
- `FoamerSystem` caches the answer on the Foamer (`throwClear`,
  `throwCheckIn`) and reads it at three points: the F02 brain will not
  ask for a ranged token while the flight is blocked and keeps sidling
  instead of holding; `canStartThrow` refuses a blocked throw and gives
  the token back with the new `noFlight` reason; the release re-checks as
  a backstop, since the 0.6 s windup lets the player step behind cover.
  A blocked Foamer never freezes: it always keeps a move.
- Cost: at most four shape casts a second for a thrower that wants to
  throw, on the `brain.flightCheckSeconds` timer (`data/ai.json`, 0.25),
  and none for a Foamer that is not a ranged thrower, or that is in an
  attack state. A blocked thrower that is sidling re-checks; a clear one
  casts once at the windup's start and once at the release.
- F04's volley is exempt (multi-shot attacks are skipped by
  `singleBall`); its tests pass unchanged.
- After: Pit 13 thrown, 13 reached, and every one of the 13 bursts is on
  the capsule; tower under the slab 5 thrown and nothing bursting above
  y 3; tower on floor 2, 22 thrown, 21 hits.
- Not checked: anything by eye. No browser here, so the throw's look
  (does a sidling Roamer read as searching?), the sound of a withheld
  throw, and the fight pacing at the Pit are unverified.

### 2026-11-06: LVL-02d review, merged (Claude)

- DeepSeek built the tower in one run where the Spark failed four times:
  floors at 0, 5, 10, 15 m, three 22.6 degree ramps in side bands, its
  own 19 m roof (the level's ceilings cut back to its walls), two
  lock-free arenas, a cardboard plug that drops as one slab. The
  connector's north end is now shut, so the route runs through the
  tower's ground floor and the fights cannot be skipped. The
  `topMetres` 17 roof check is a test in Level 1-2 and the Pit (0
  bridged layers). Timing alone: bake 38.8 ms, path 1.16 ms. Existing
  level tests were updated for six arenas, none loosened. Main merged
  in; tsc, 502 tests and the build pass.
- In the browser (`arena.html?watch&level=1-2`): the player stands on
  all four floors and on the ramps at the right heights (ramp 1: 0.9,
  2.6, 4.2 m along it). The first fight's two Roamers spawn on floor 2;
  with the player on the ground floor under the slab they throw into
  the slab (no hits); from floor 2, 7 throws in 10 s, 7 hits.
- Not checked: the floor 3 fight, the plug by hand, the climb with real
  movement keys (positions were set, not walked), the look beyond one
  greybox view. Roamers throwing with no clear line (here at the slab,
  in the Pit at cover) is the same open issue BUG-06's review found.

### 2026-11-06: BUG-06 review, merged (Claude)

- The cause is a real game bug, not only the helper's: `castRay`'s
  `timeOfImpact` is metres along a unit ray, and the ball moved by
  velocity times it, so on any hit it jumped speed times too far (about
  1 m past the capsule's front). A player's block or parry by hand was
  judged from behind as often as not, and wall bursts showed past the
  wall. DeepSeek's fix (`t / speed`) and the debris pass-through for
  balls are right. Headless Pit test 2 to 10 of 10; 497 tests and the
  build pass. Two garbled comments in the range helper (from BUG-04)
  reworded.
- In the browser (Pit wave 2, real fight, wave 1 cleared by script):
  hand-placed F02s gave 6 parries in 10; in the live wave, of the balls
  that reached the player both were parried, but 8 in 10 never arrived:
  a Roamer at (-6.5, 5.8) throws into the level trimesh 1.7 m from its
  hand (bursts at y 2.6). That is the Roamer throwing without a clear
  line, a separate issue (next card), not the parry.
- By hand: blocks and parries should now feel right from the front for
  the first time; worth a playtest.

### 2026-11-06: BUG-06, a ball hit is a distance not a time (DeepSeek V4.1 Flash via Pi)

- Card: `tasks/BUG-06.md`. Branch `bug-06` from `bug-04`; BUG-04's
  helper fix (face the timed ball's thrower, lower the disc after) is
  kept as it was and BUG-04's Pit test is now green.
- Cause 1, the reported one: `ProjectileSystem.update` read Rapier's
  `castRay` `timeOfImpact` as seconds and stepped the ball by
  `b.vel * t` (m/s times "seconds"). It is a distance in metres along
  the unit ray, as `src/weapons/darts.ts` already notes. Ball 0 at
  `(-0.33, 1.71, -7.76)` hits at 0.132 along a 9.5 m/s ray and landed
  at `(0.63, 1.31, -8.45)`: 1.27 m of travel instead of 0.132 m, about
  1.1 m past the capsule's front. `onHitPlayer`'s `from` (0.5 m back
  along the velocity) then sat at `(0.2, 1.5, -8.2)` against an eye at
  `(0.0, 1.6, -8.0)`, behind the capsule centre `z -8.0`, so
  `blocksAttackFrom` read 75 to 143 degrees off the view and the throw
  hurt. Fix: `b.pos.addScaledVector(b.vel, t / speed)`.
- Cause 2, found with the same probe and not on the card: a parried
  ball bursts on its thrower and leaves foam chunks at the ball hand.
  The next ball's ray stopped on a chunk (collision groups `0x40001`,
  `DEBRIS_GROUPS`, a dynamic body at the hand) 0.03 to 0.12 s after it
  left the hand, so it never reached the player and the walk recorded
  "gone". Fix: the ball's ray filter passes debris, as the darts' does.
- The card's four candidates, checked with numbers and none of them
  the cause: the cast starts outside the capsule (0.16 m out, hit at
  0.13); the capsule collider and the timed centre are the same point
  (`cap` and `pc` both `(0.00, 0.92, -8.00)` on every hit), so the
  capsule does not lag; the eye and the capsule agree; nothing lands
  on the cap.
- Counts, `npx vitest run tests/shield/parry-pit.test.ts`, ten runs
  each. Stage 1 (the as-is helper, so its own wrong-Foamer aim still
  costs it): 1 of 10 before, 7 of 10 after. Stage 2 (the helper's fix):
  2 of 10 before, 10 of 10 after. Stage 1's pin moved from "fewer
  than 5" to "fewer than 9", with the reason in the comment: the old
  pin described the broken sim, not the helper.
- The HIT log line now also prints the capsule collider, the timed
  centre and `from`'s distance from the eye, which is what the card
  asked to instrument; it is always on, cheap, and it is the test's
  own output.
- Status: BUG-06 done, awaiting review (Claude Opus 5.5). Full suite
  497 pass, 2 skipped; `tsc --noEmit` and `npm run build` clean; no em
  or en dashes in the two files touched.
- What a player by hand may notice: a ball now meets them where the
  ray says, so a block or parry from the side judges on the throw's
  real direction instead of behind the centre. The parry window and
  the shield's numbers are unchanged.
- Not checked by eye: the browser Pit (2 in 10 there per BUG-04), the
  chunk-at-the-hand case in a live game, and whether the foam chunks
  a parry leaves now read oddly flying through a new ball.

### 2026-11-06: LVL-02d and BUG-06 started with DeepSeek (Claude)

- LVL-02d stage 2 (the tower) restarted with DeepSeek V4.1 Flash on
  branch `lvl-02d` (main merged in), with orders to write the level by
  short scripts and to check the `topMetres` 17 side effect on the other
  levels. The walls and ceilings are 9 m, so four floors 5 m apart do
  not fit the bay: it chooses a taller bay roof or lower storeys and says
  which in section 14.
- BUG-06 (new card): find why a ball meets the player's capsule from
  behind in the Pit (BUG-04's lead) and fix it, so BUG-04's Pit test
  parries 9 in 10. A second DeepSeek run, branch `bug-06` made from
  `bug-04` so it keeps Qwen's repro and helper.

### 2026-11-06: BUG-04 stopped at 2 in 10, a lead (Claude, morning)

- Qwen 27B ran about ten hours in all and was stopped at 07:10 so the
  machines are idle while Paul is out. Its work is on branch `bug-04`
  (commit "work in progress"), not merged: the Pit test's stage 2 still
  gives 2 parries in 10 and fails.
- On the branch: a headless Pit repro (`tests/shield/parry-pit.test.ts`,
  stage 1 records the old helper), and a helper that times the earliest
  ball, faces that ball's thrower and lowers the disc after the ball is
  done. Facing the right thrower did not change the count, so that was
  not the cause.
- Lead from its instrumented run, not confirmed: ball 14 first touches
  the capsule 0.39 m in front of it, above the top, but the hit is
  judged with the ball at z -8.6, behind the capsule centre (-8.0), at
  138 degrees to the view, so the shield reads it as from behind and
  the player is hurt. If so the cause is where the hit is judged in
  `src/foamers/projectiles.ts` (the ball moves on past the contact
  before `onHitPlayer` runs), outside the card's files: a next card
  should check that first.
- Nothing checked in the browser.

### 2026-11-06: BUG-05 not merged, the review's test was the cause (Claude, overnight)

- DeepSeek reproduced the stuck Swarmers headless and found why: when
  the pack was placed, the player was still at the level start in the
  corridor beyond the open `pit-in` door, so the shortest path to them
  left the pit; the door then locked them out. That is normal chasing,
  and the "too fast" trip was over more time than the BUG-03 review
  thought. In play, arena waves spawn Swarmers at rifts inside the arena
  after it locks.
- Its fix leashes a hand placed pack to 11 m from where it was put. Only
  the range calls `spawnPack`, so the leash changes nothing in a level,
  but on the range a pack spawned 20 or 30 m out would stop 9 m short of
  the player. Not merged. The branch `bug-05` also updates
  `tests/ai/pit-rig.ts` to build the grid with the voxel pieces the way
  the page does (BUG-03): worth taking on its own later.

### 2026-11-06: LVL-02d stage 2, the tower in the bay (DeepSeek V4.1 Flash via Pi)

- `data/levels/1-2.json`: the beat 5 tower (A5) now fills the bay off the
  connecting corridor, interior x -19..1, z -36..-22. Four floors at 0, 5,
  10 and 15 m; three side-by-side ramps in 3 m bands (5 m of rise over a
  12 m run, 22.6 degrees) that the player (slope limit 46 degrees) and a
  Foamer (nav autostep 0.2 m per 0.25 m cell) can both walk, which is why
  the design's 1.5 m ledges are not the route. Each upper slab is a ring
  with a 3 m hole over the ramp under it, so no flight is stacked on
  another and every floor has 5 m of headroom. Path from the bottom floor
  to the top is 9 waypoints on the nav grid.
- Roof decision (also PLAN section 14): the tower carries its own roof at
  19 m and the level's ceilings stay at 9.5 m, cut back to the tower's
  walls (`north-ceiling` now z -112..-42, plus `ceil-spur`, `ceil-conn`,
  `neck-lintel`). The alternative was floors closer together, and 5 m
  apart with 5 m of headroom needs 19 m. Nothing goes over `nav.topMetres`
  17 except the roof itself, which the bake sees as a flat face and which
  no agent can step onto (checked, see below).
- Route: the connector's north end is shut (`conn-n-end`), so the way on
  to the spur and the Crossroads is through the tower's ground floor: in
  at the 4 m doorway from the connector (x 2, z -31..-27) and out through
  the north neck (x -12..-8, z -37). Both tower arenas are therefore
  always on the route and cannot be skipped; a detour would have let a
  player reach the exit pad with arenas uncleared, and it would never open.
- Fights, no lock-in: `tower-low` (trigger the ground floor, 2 Roamers,
  rifts on floor 2) and `tower-high` (trigger floor 3, 2 Roamers plus a
  Slowmer). Both arenas have no doors at all, so `ArenaRunner.lock()` has
  nothing to shut: the player may walk out and back at any time, which is
  what the design asks for. `tower-low` is a checkpoint.
- Ceiling plug: `tower-plug`, cardboard, 3.0 x 0.6 x 3.0 m under floor
  3's slab at [-6, 9.2, -29], ceiling anchored. A ceiling anchor gets no
  bedrock row, so one dart's island search takes the whole slab (5400
  voxels: under `destruction.maxSearchVoxels` 6000) and it falls onto
  floor 2 as one piece, 0 damage. It is 3.0 m in plan, not the design's
  3.2, because 3.2 x 0.6 x 3.2 is 6144 voxels: over the island search's
  budget, the search would have treated the slab as anchored and left it
  hanging. New test 9 in `tests/level/level-1-2.test.ts` proves the one
  island and the falling piece.
- The topMetres side effect: new test 8 in `tests/level/level-1-2.test.ts`
  and a new test in `tests/level/pit-load.test.ts` scan every cell pair
  and assert no layer above 9 m sits within `maxStepMetres` 0.45 of a
  layer under 6 m in a neighbouring cell, in Level 1-2 and in the Pit.
  Both report 0, so no Foamer can step from a floor onto a roof or a
  ceiling top. The ceilings and the roof do become layers (the bake meets
  them), but nothing walks to them and the floors keep their slots (lowest
  first). The 40x40 budget test, run alone on an idle machine: bake 38.8 ms
  (was 37.6 ms with `maxLayers` 2 and `topMetres` 8, stage 1 recorded 36 to
  39 ms), median path query 1.160 ms (was 1.158 ms). The difference is
  noise, and the budget (150 ms, 2 ms) is untouched.
- Tests: `tests/level/level-1-2.test.ts` now expects six arenas in order
  (parry-corridor, ring, tower-low, tower-high, crossroads, gauntlet) and
  archetypes A6, A2, A5, A5, A7, A3; its walk from start to exit goes
  through the tower's ground floor and back out at the neck; the
  rift/pickup floor test casts from just above each spot so the tower's
  floor 2 and 3 rifts check their own slab; the exit pad test stands on the
  ground floor and on floor 3 for the tower's two arenas. `NavGrid.maxLayers`
  is public now (a test indexes `layerY` and needs the stride).
- Not checked by eye (no browser here): the tower's look and read from
  inside, whether the three ramps are easy to find from the ground floor,
  the plug's drop on screen, the fights' pacing on floors 2 and 3, and the
  frame cost of four floors of shell boxes.
- Not covered: `src/level/validate.ts` rule 9 does not know about the
  tower's two arenas overlapping in plan (their triggers are 10 m apart in
  height, so the reachable-order rule passes), and no test walks a Foamer
  up the ramps in the physics world: the nav path and the geometry are
  checked, the actual climb is not.

### 2026-11-06: LVL-02d parked after stage 1 (Claude, overnight)

- The Spark committed stage 1 on branch `lvl-02d`: `nav.maxLayers` 2 to
  4 and `nav.topMetres` 8 to 17 (so the bake reaches a 15 m floor), with
  tests (four floors in one cell, a path up switchback stairs) and the
  timing test unchanged (bake 36 to 39 ms, path 1.1 ms). Not merged:
  it only matters with the tower, and `topMetres` 17 also lets the bake
  see roof and ceiling tops in the other levels (floors still win the
  four slots, lowest first), which wants a check in the Pit and the Ring.
- Stage 2, the tower, failed four times: every run (resumed, thinking
  low, fresh, and with orders to write the level by small scripts) hit
  the Spark's output limit before saving anything. The Spark also slowed
  to about 25 s for a one word reply after the third. Parked for Paul:
  a smaller tower card, another model, or the Spark with a higher output
  limit.

### 2026-11-06: GAME-10e review, a Blocker wall in the Ring (Claude, overnight)

- DeepSeek finished all three stages in one run (the read-once brief
  worked). Checked by value: of `data/foamer-rigs.json` only F04 changed
  (the rest is number formatting), of `data/foamers.json` only the F04
  type; the F01 brain change is one new move intent; `shield.ts` gets one
  line, the Blocker's longer charge stagger with a fallback to the old
  time. Main merged in; tsc, 495 tests and the build pass.
- Played in the Ring with the watch: three Blockers walked to a line at
  9.3 to 9.4 m, about 1 to 1.4 m apart, shields up, and fired a three ball
  volley over the top. A B01 shot into the front: 3 darts, 0.08 damage.
- Changed in review: F04 `turnRate` 5 to 1.4 rad/s (the Darter's). At 5 a
  Blocker faced a strafing player within a second, so a side shot met the
  shield and flanking, the thing it teaches, could not work. At 1.4 it
  lagged a quick strafe by about 25 degrees. Tune in playtest.
- Not verified in the browser: a flank shot landing full damage (my
  scripted strafe and aim missed three times; the unit test for side
  damage passes), the shield charge stagger, the shield breaking, the
  look up close, the four sounds.

### 2026-11-06: GAME-10e, the F04 Blocker and its shield wall (DeepSeek V4.1 Flash via Pi)

Task card `tasks/GAME-10e.md`. Three stages, each committed green.

- **The type and the look.** `F04` in `data/foamer-rigs.json` (orange body
  and head with a wide lime visor bar, no eyes: a faceless blocker; arms
  and legs purple; a deep purple shield plate with a lime boss held ahead
  of the body; a blaster box over the right shoulder) and in
  `data/foamers.json` (`slots` 9 m hold, 1.2 m spacing; `stagger`
  0.5 s / `shieldChargeTime` 1.2 s; `line` count 3; armour `shield`
  damage 0.05, carve 0.3, arc 120 degrees; a 3 ball `volley` with a 5
  degree spread, pinned `range` 16 m, and a `bash`). Turnaround sheet in
  `design/foamers/F04-sheet.png`. `src/foamers/armour.ts` is the one
  cover rule: `armourOf` reads the part's table, `plateFaces` answers
  whether a dart came in inside the arc, and `handleHit` multiplies by
  `damage` only when the plate covers the hit.
- **The wall.** `src/ai/f04-brain.ts`: four states as the other brains,
  but the slot comes from the system, not the brain. `assignSlots` runs
  before the bids each step, sorts the live Blockers by agent id (no
  swapping), and puts them on a line across the player at the hold
  distance. Reaching one needed a new `toSlot` intent, because the nav
  grid only paths to the player. A token sends it from hold back to
  approach, where the state machine starts the attack, and the volley
  fires `atk.shots` balls fanned by `spreadDeg` through the existing
  `ProjectileSystem.launch`. A broken shield hands the step to the
  Roamer's keep-distance brain.
- **The charge.** `knockBack` uses `stagger.shieldChargeTime` (1.2 s);
  a staggered Foamer is already outside every cover arc, so the shield is
  down for free. The charge's own branch is untouched.
- **Sounds and range.** `F04-alert`, `F04-volley`, `F04-shieldhit`,
  `F04-shieldbreak` are placeholder synth entries in `data/sounds.json`,
  wired in `src/audio/foamer-sounds.ts` (the shield hit and break are new
  system sound kinds), and moved into the real table in
  `design/SOUNDS.md`. The range's F04 choice spawns the line of three
  (`spawnLine`); the watch lists them from `foamers.list` with no change.

Tests: `tests/ai/f04-brain.test.ts` (8) and
`tests/foamers/blocker-wall.test.ts` (8), plus the existing armour tests in
`tests/foamers/blocker.test.ts`. Full suite 492 pass, 2 skipped; `tsc` and
`npm run build` clean; dash scan clean on every file touched.

**Not checked by eye** (no browser here): how the wall reads as a line at
9 m, whether the 120 degree plate is wide enough to feel like a shield to
shoot around rather than a wall to give up on, whether three balls at a 5
degree spread are fair to parry, whether the shield-break sound lands with
the plate coming off, and how the Blocker's rig looks walking and firing.
The frame cost of three Blockers is unmeasured.

**Decisions** are in `PLAN.md` section 14, `PLAN.md`'s GAME-10e row is
updated, and the card's out of scope items (level 2-1, F06 and later, new
finished art) are untouched.

### 2026-11-06: BUG-03 review, the Pit's block seen by the grid (Claude, overnight)

- Qwen 27B finished all three stages in one run, tests shown failing on
  the old code first (it used `git stash` for that; the shared stash list
  was checked afterwards and is empty). Main merged in (HANDOFF kept both
  sides); tsc, 472 tests and the build pass.
- On a fresh Pit page: the floor inside `pit-block` is no longer
  standable (`canStandAt` false at (0, 4), (-3.2, 4), (3.2, 4)) and the
  block's top is found at 3.2 m; a Swarmer pack centred on the block
  spawns nobody (every ring spot is inside it), one beside it lands all
  outside. Wave 1's Slowmers walked round the block from z 7 to a player
  at z 1.2. Paths from the ring top down the ramps still exist with the
  solid probe on (checked against a rebake with it off).
- Seen, not BUG-03: four Swarmers stood on the ring level at z -13.9,
  just outside the locked `pit-in` door, in `approach` with an empty path
  for 10 s. How they got there is not clear (they came from a pack placed
  by hand); worth a look with the Swarmer brain later.
- A pack centred on a solid block skips every member rather than moving
  out: fine for a hand placed spawn, but a level's pack spawn should not
  sit on a block. The validator does not check that yet.

### 2026-11-06: BUG-03, the nav grid sees the level's solid voxel pieces (Qwen 3.8-27B via Pi, qwen-machine)

`tasks/BUG-03.md`. Two faults from the BUG-02 review: the load-time bake
ran before the level's voxel pieces had their colliders (they mesh off
the main thread, a few frames later; feet and colliders arrive
separately) so on a fresh page the bake met only the shell, and a cell
inside a solid block read as floor because the pieces collide as hollow
trimeshes and the bake's shape cast meets only surfaces. In the Pit a
Swarmer pack round the centre block could stand in it.

- The grid takes a new private hook `solidAt(x,y,z)`, set by a public
  `setSolidAt` (default null, it doesn't change the grid's own tests or
  pages without pieces). `bakeCell` rejects a stand-able surface when
  a probe finds the agent's body inside the solid volume: samples at
  heights of 1/8, 9/20 and 7/8 of the agent's height above the surface,
  so a flat floor reads clear and a body pressed inside the block does
  not. A tunnel that cuts through a block passes the probes again on the
  carve's own rebake. `nav-grid.ts`'s bake did not touch the layer
  search, `nodeNear` or the A* (the card's limit, LVL-02d).
- `makeLevelAI` takes the level's voxel volume and the voxel mesh's
  world origin, and wires the hook to read the volume in world space
  (`src/ai/level.ts`); the origin is the mesh's because it carries the
  snap, and the range (no pieces) builds it without one. `levelAI
  .piecesReady()` re-bakes the level's bounds. The shared game frame
  (`src/game/game.ts`) notices the level mesher's first time it stops
  being busy (that backlog is dirty, then pending jobs; both a piece
  needs and live chunks; an empty level is not busy from load) and
  calls it once, so the first Foamer to path already sees every block.
- Bake timings on the Pit's bounds (once per load, the page pays them
  once):
  - full bake, no solid hook (old): 55.8 ms;
  - `piecesReady` rebake with the hook on (the page's second bake):
    45.4 ms;
  - the 40x40 budget test (bake + a query): bake 36.4 ms, query 1.158
    ms; the budget is 150 ms and 2 ms.
  The hook is nearly free: about one `volume.get` per stand-able
  candidate, and the volume is an in-memory array that the game mutates
  every frame already.
- Tests (all fail on the old code, pass on the new):
  - `tests/level/voxel-block.test.ts` builds a level with a 3 m solid
    block on a floor the way the page builds it (FAKE mesher, the
    microtasks, `piecesReady`), then the real Pit the same way. In the
    test level: the cell inside the block is "not" floor-height (read
    as floor on the old code), the block's top "is" stand-able, the
    floor round it is, and a carve tunnel through the block (and its
    piece's rebake) makes the floor under the hole walkable again. In
    the real Pit: for the centre of `pit-block`, `groundAt(0,4)` is
    3.2 (was 0), `canStandAt(0,4,0)` is false (was true: that is the
    read `spawnPack` used), floor under the ring and the exit room are
    untouched. The timing scratch is not committed; the numbers are
    here.

### 2026-11-06: GAME-09b review, the chunk finish played in the Pit (Claude, overnight)

- DeepSeek's first run looped for 2.5 hours reading files and wrote
  nothing; restarted with a map of the lines to read and edit, it built
  stages 1 and 2 in one run. Review found three things. Fixed by Claude:
  (1) every dart held a reference to the blaster's one reused shot
  object, so the next trigger pull rewrote the id and muzzle of darts
  still flying (each dart keeps its own copy now; test 10 fails on the
  old code); (2) shot ids were counted per blaster, so two blasters could
  share one (one counter now). Sent back: (3) a weakened Foamer could
  never be chunked in play, since the first dart of a shot killed it and
  the rest passed through (test 7 had set its health to 3, not weakened).
  DeepSeek's fix holds the kill for two steps so the whole shot lands
  (test 11). Claude added the same skip to the vacuum the finisher got.
  Main merged in; tsc, 469 tests and the build pass.
- Played with the watch in the Pit, B03 at 2.5 m on a weakened F01
  (health 1.6 of 6): 14 and 15 darts landed and it chunked each time: a
  hole through the body with the cream core showing, lime and purple
  foam cubes bursting out, and the body thrown back. Foam only.
- For Paul's playtest: the push is strong (2x), the burst is busy at 40
  cubes, and `FX-chunk` reuses the pop's chunk sound ID. Not heard.
  Area blasts (B05, B06, B07) are still open on the PLAN row.

### 2026-11-06: GAME-09b review fix, a held kill so a whole shot counts (DeepSeek V4.1 Flash via Pi)

- The fault (found by Claude in the browser): a weakened Foamer died to the
  first dart of a B03 shot, the kill was judged on that one dart's ~1
  damage against `minShare` x 6 = 1.5, it went down, its colliders dropped
  and the rest of the shot flew through. A B03 shot at 2.5 m on a weakened
  F01 gave 1 hit and 0 chunks.
- Fix: when a dart that carries a shot with a chunk block brings a Foamer to
  0 health and the chunk could still apply (`chunkPossible`: tier or
  `finishWeakened`, inside `rangeMetres`; the health share is not checked
  yet), the kill is held. `Foamer.dyingHit` keeps the killing hit and
  `dyingStep` the update count, so the Foamer keeps its colliders and its
  pose and does nothing else: no walk, no attack, no part wear, no finisher
  (`finisher.has` and the melee loop both skip it). The hold is settled by
  `resolveKill` (pop, then chunk, then go down, as before) at the start of
  the update two steps later, so the shot's darts of that step and the next
  all land, or at once when a dart from another shot hits it. Darts with no
  shot, and kills the chunk cannot apply to, resolve at once as before.
- Tests: test 7's weakened case now uses `finisher.weakenShare` x max
  (1.8) instead of 3, which was not weakened in play. New test 11: a full
  B03 shot at 2.5 m on an F01 at half `weakenShare` (0.9, the range page's
  spawn) counts more than one hit and more than `minShare` x max of the
  shot's own damage, and is a chunk. Confirmed test 11 fails on the old
  code ("expected 1 to be greater than 1") and passes now. Pop and go down
  tests unchanged.
- Verified: tsc clean, 459 tests (68 files, 2 skipped), build passes, no
  em or en dashes. Not checked by eye: the hole and burst on the range page.

### 2026-11-06: GAME-09b stage 1 and 2, the chunk finish (DeepSeek V4.1 Flash via Pi)

- `DartHit` carries `shot: DartShot | null` (`id`, `muzzle`, `chunk`), and
  `darts.fire` takes it as an optional fourth argument. `blaster.ts` gives
  each trigger pull one id in `beginShot()` (so B03's two barrels are one
  shot) and copies the muzzle in `fireDart`, so a shot is judged by what it
  did, not by what the player did earlier.
- The rule lives in `src/foamers/chunk.ts` as data-reading pure functions
  (`judgeChunk`, `shotSummary`, `addShotDamage`, `chunkRadius`), so a test
  can try the cases without a world. `handleHit` keeps a capped per-Foamer
  list of dart damage tagged with its shot, then at the kill checks pop,
  then chunk, then go down.
- "Already finishable" means before the shot began: the first dart's
  `preWeakened` flag is carried by the rest of the shot. A volley that
  weakens a Fodder and then kills it is a plain go down, as the card says
  full health F01s are; a Fodder is otherwise never a chunk.
- `goDown` and `buildRagdoll` take a push scale, default 1. A chunk sound
  (`FoamerSoundKind` `"chunk"`) plays `FX-chunk`, the placeholder the card
  names. `stats.chunks` counts chunk finishes.
- Numbers: B03 `chunk` range 5 m, carve 0.35 m, push 2.0; B01 slug 8 m,
  0.3 m, 1.6; Foamer base `catastrophic.chunk` minShare 0.25, tiers Heavy,
  Elite, Boss, carve 0.35, debrisMax 40, push 1. The carve radius is the
  larger of the Foamer's and the blaster's, so a blaster never carves less
  than the base.
- Range page: a "Spawn weakened" yes/no row puts a fresh Foamer into the
  finishable band (health at half `finisher.weakenShare`, flag set, no
  stagger) so B03 can be tried on an F01.
- Tests `tests/foamers/chunk.test.ts` (9): data, the rule's cases, the shot
  window, radius; live: F05 chunk at 3 m, plain go down at 8 m, F01 full
  health go down and a weakened F01 chunk, slug yes and B01 no, the centre
  of the hole empty and the back of the body intact, debris inside the cap.
- Not checked by eye: the hole shape, how the burst reads, the push, the
  sound. Verified: tsc clean, 457 tests (68 files, 2 skipped), build passes,
  no em or en dashes in the touched files.

### 2026-11-06: BUG-02 review, parries and packs tried in the Pit (Claude, overnight)

- Qwen 27B's first run hit its output limit mid stage 1; resumed with
  short replies it finished all three stages. Main merged in (HANDOFF
  kept both sides); tsc, 458 tests and the build pass. The code is sound:
  `timeToImpact` steps the ball's own arc and tests the swept segment
  against the capsule; `canStandAt` is layer aware.
- `parryNext()` in the Pit against wave 2's Roamers, facing the thrower,
  the disc lowered between tries: 2 parries in 10 (6 blocks, 2 hits),
  where the old helper gave 0. Better, not reliable. Likely cause: the
  ball meets the disc, which is in front of the capsule, before it meets
  the capsule the new timing aims at. Also: the helper leaves
  `forcedHold` on, so a caller must `block(false)` between tries (I did
  not at first, and every later try then read as a block). Paul's hands
  are still the real test of the parry window.
- `spawnPack()` round the Pit's central block still put Swarmers inside
  it, and BUG-02 is not why: the nav grid is wrong there. (1) The first
  bake runs before the voxel pieces build their colliders, so a fresh
  page's grid has no block at all (a rebake of the area found the block
  top at 3.2 m). (2) Even after a rebake the floor inside the block reads
  walkable: voxel pieces collide as hollow trimeshes, and the bake's
  agent shape test only meets surfaces, so a cell in the middle of a
  solid block passes. That is BUG-03 (`tasks/BUG-03.md`). The pack fix
  is right given a right grid, which is what its tests build.

### 2026-11-06: BUG-02, the parry watch's timing and the pack's floor

- The watch helper timed a loft by a line (Qwen 3.8-27B via Pi,
  `tasks/BUG-02.md`, branch `bug-02`): `parryNext()` asked straight-line
  distance over speed, the raise landed out of the parry window, and
  the ball burst on the disc as a block. The fix is `timeToImpact` in
  `src/foamers/ball-time.ts`, a shared pure function that steps a copy
  of the ball with the projectile's own gravity and the page's step and
  returns the step at which the flight segment reaches the player's
  capsule spine (the shape the projectile's own raycast meets, read
  from the eye minus `eyeHeight`). The helper waits that time minus the
  shield's `parryLead` and then holds: through `fixedStep` on the game
  page, through the loop's own step (`parryWaitSec`) on the range. No
  parry rule or number changed.
- The card's demonstration, shown in the test: the old
  distance-over-speed wait on a 20 m loft misses the window by more
  than a window, so the old helper would have blocked, not parried.
- `spawnPack` asked the grid before it placed: a new `canStandAt` on
  the nav grid (the layer the feet sit near, autostep up, full step
  down; a bare `walkableAt` reads the top face of a block a floor, so
  the Pit's central block is why a standability ask was needed), a
  ring spot that fails is stepped a few in along the angle
  (`pack.inboundStepMetres` 0.5, `pack.inboundSteps` 4 in `data/ai.json`), and
  a member the steps cannot place is skipped: neither spawned nor
  counted, and a skipped one is not a slot a later pack must budget
  against. Without a grid the placement is unchanged.
- New tests: `tests/foamers/ball-time.test.ts`,
  `tests/shield/parry-next.test.ts`, `tests/foamers/pack-walkable.test.ts`
  (the two pack rows fail on the old placement; verified).
  Existing shield, projectile and pack tests unchanged and passing.
- Not checked by eye: that the helper lands parries in the browser
  (no browser on this machine; the reviewer will check against the
  page), and the Pit's own pack near its central block. The helper's
  walk itself is what the test walks: the range's rig, the page's
  own flight, the page's own shield read, the helper's wait and its
  hold, end to end at 60 Hz.

### 2026-11-06: LVL-02c review, Level 1-2 played start to exit (Claude, overnight)

- The Spark's first run hit its output limit writing the level in one
  reply and saved nothing; resumed with "one room per edit", it finished
  all three stages. Main merged in (HANDOFF Status rebuilt by hand);
  tsc, 450 tests and the build pass.
- Played `arena.html?level=1-2&watch` through all four arenas: the parry
  corridor and the Ring as before; the Crossroads locks all four gates,
  Roamers come from the spokes, and every gate opens on clear; the bowl's
  wave 1 Roamers stand on the upper tier at the back, wave 2 clears, the
  exit door opens and the pad completes the level only after the fourth
  arena. No console errors.
- For Paul's playtest: in the greybox the bowl's three tiers read weakly
  (one grey); the lit exit sits between the two upper rifts, so it is seen
  from the whole bowl but the Roamers guard it. The way on from the
  Crossroads is the north spoke, not the way back the concept asked for
  (section 14 says why).
- Not checked by eye: pacing, the pillar seam's behind you moment, and
  whether Foamers use the ramps well under pressure.

### 2026-11-06: LVL-02c, Level 1-2 beats 6 to 9 (Qwen 3.8 Flash Next via Pi)

Built, in `data/levels/1-2.json` (no `src/` changes; the page already
drives any number of arenas through `LevelRunner`):

- Beat 5 gap: from the store's north wall a 4 m way on into a connecting
  corridor that runs north and bends west past an empty bay (x -20 to -8,
  z -30) where the tower will go. The bay has a foam-yellow floor marking
  and a `_note`; `data/ai.json` `nav.maxLayers` is too small for a four
  floor tower today, so the later card needs that raised first.
- Beat 6, the Crossroads (A7): a 14 x 16 m hub with a 1.6 m centre pillar
  (solid core plus four carveable foam skins as separate pieces, so it
  breaks off foam-style) and four 6 m spokes, each with a gate door. Lock
  shuts all four gates including the entry. Wave 1: 6 Roamers from the
  north, east and west spoke rifts, `delaySeconds` 2 so they arrive
  staggered from three directions. Wave 2: 7 Roamers from the same three
  plus 1 Slowmer from a floor seam rift at the pillar's base (the behind
  you moment). Cleared unlocks the north gate (`unlockOnClear` also
  reopens the others), checkpoint just inside the hub.
- Beat 7, breather 2: 8 x 8 m off the hub's north gate, one 20 dart box,
  two foam-yellow floor markings where the U2 station and the S3 ledge
  will go ([Paul], not built), `_note` says so.
- Beat 8, the Gauntlet (A3): a 31 x 25 m bowl. Tier 1 at 1.2 m along both
  side walls (4 m deep), tier 2 at 2.4 m along the far wall with a 4 m
  gap over the exit door. Ramps (1.2 m rise over 3 m) reach both tiers;
  the nav grid walks them (verified: paths floor to tier 1 to tier 2 and
  back down). Four foam cover pillars on tier 1, ammo boxes in both
  bottom corners (30 darts each). Rifts: two on tier 2 at the far wall
  (wave 1: 8 Roamers) and one floor rift in the bottom tier's centre
  (wave 2 adds 10 more Roamers, from all three, the ring of Firebacks the
  design asks for is a later tuning pass). Cleared unlocks the far door
  and the entry; checkpoint at the bowl's mouth.
- Beat 9: the level's `exit` pad moved from the store to behind a lit 4 m
  door in the bowl's far wall (`bowl-out`). The store is a plain room.

Decisions (PLAN.md section 14 row dated 2026-11-06): both arenas scaled
down to fit one 31 m wide north bound corridor beside LVL-02b's Ring; tiers
walked up by ramps not 1.2 m steps (a 1.2 m step is over the nav
autostep of 0.2 m so Foamers could not climb the bowl); the Crossroads' way
on is the spoke opposite the entry, not the design's south spoke, because
breather 2, the bowl and the exit all lie north and the runner only lets
you on once cleared anyway; the exit pad moved to the bowl's far door.

Tests (`tests/level/level-1-2.test.ts`): arenas in order with archetypes
and wave counts of all four; the walk from the start through all nine
beats to the new exit; nav grid checks that tiers, rifts and both new
triggers are walkable with paths up ramps and down; door block/open ray
checks including `bowl-out`; and a `LevelRunner` test that the exit phase
stays short of `complete` until the fourth arena clears. `npx tsc
--noEmit`, `npx vitest run` (444 passed, 2 skipped), `npm run build` all
pass. Level validator: no errors, one warning carried over from LVL-02b
(ring voxel count).

Not checked by eye (no browser here): pacing of the corridor, bay and hub;
whether the three spoke rifts read as three directions in play; the
pillar rift's surprise; whether the bowl's three heights read at a glance
and the tiers feel like cover; rift glow placement in the dark spokes;
Foamers streaming down the ramps sensibly; and that clearing the fourth
arena plus walking to the lit door feels like an ending.

Next: beat 5's tower card (raise `nav.maxLayers` first), U2/S3 stations
([Paul] content), secrets, the B02 blaster, the level's name and setting.

### 2026-11-06: OPS-02 review, the physics .wasm checked in a browser (Claude, overnight)

- Qwen 27B's route is sound: `@dimforge/rapier3d` 0.21.0 behind a shim
  that the compat name aliases to, so no import line changed. Main merged
  in cleanly; tsc, 449 tests and the build pass.
- Fixed in review: (1) the dev server hung on Loading. Vite's dependency
  pre-bundler put the Rapier glue in `.vite/deps` while its .wasm binding
  loaded from `node_modules`, two copies, and the one the game called had
  no wasm instance (the same split the model found and fixed in Vitest;
  curl could not see it). `optimizeDeps.exclude` keeps it one copy.
  (2) The guard test threw on a fresh clone with no `dist/` instead of
  skipping (`statSync` of a missing path throws), and it read whatever
  `dist/` was on disk, so a stale build failed it. It is now
  `tools/check-no-inlined-wasm.mjs`, run by `npm run build` on the fresh
  `dist/` (checked: it fails on a planted file and passes clean). (3) `vitest.config.ts` repeated the aliases; it merges
  `vite.config.ts` now, so the two cannot drift.
- Played in the browser, dev server and `vite preview` of the build: the
  Pit locks, Foamers spawn and go down to darts; the game, range and
  sandbox pages load with no errors. In the build the .wasm is its own
  file (3.0 MB raw, 1.19 MB gzip) and the game chunk is 223 kB (67 kB
  gzip), down from 4.5 MB.
- Not checked: the deployed site (Cloudflare serves `.wasm` as
  `application/wasm` and compresses it; check after the push), and older
  Safari (the build uses top-level await for the wasm import: Safari 15
  and later).

### 2026-11-06: OPS-02, the physics WebAssembly as its own file (Qwen 3.8 27B via Pi)

- Stage 1 (spike) succeeded, so the card proceeded to the guard test and
  the size check rather than a Blocked result. Route 1 from the card: the
  non-compat `@dimforge/rapier3d@0.21.0` (the same engine, exact-pinned, a
  new dependency) rather than keeping the compat build behind it.
- `src/physics/rapier-shim.ts` is the single re-export the card allows:
  it does `import * as RAPIER from "@dimforge/rapier3d"` and
  `export default { ...RAPIER, init }`, where `init()` is a no-op
  `Promise.resolve()`. The non-compat build has no `init`; its `.wasm` is
  an ES-module import, so by the time the shim's module loads the
  WebAssembly is already compiled. The 38 `RAPIER.init()` call sites and
  the `import type RAPIER from "@dimforge/rapier3d-compat"` type imports
  keep working because the default export still exposes the same surface
  (World, Collider, Ray, ...).
- `vite.config.ts` gains two `resolve.alias` entries. The first points
  `@dimforge/rapier3d-compat` at the shim. The second points
  `@dimforge/rapier3d` at the raw `node_modules/@dimforge/rapier3d/rapier.js`
  because the non-compat package has no `"exports"` field (only
  `"module"`), so the bare name would not resolve on its own.
- `vitest.config.ts` (new) has the same two aliases plus
  `test.server.deps.inline: [/@dimforge\/rapier3d/]`. This was the
  non-obvious blocker. Left external, Vitest evaluates the engine twice in
  one worker, once through raw Node ESM and once through Vite's transform,
  and the glue sets its wasm instance on the copy the tests do not use, so
  `wasm.memory` is undefined on the other and every World construction
  throws (203 test failures before the fix). Inlining the whole package
  forces one shared module graph, and 36 files failed / 203 tests before,
  all 67 pass after.
- Guard test `tests/core/no-inlined-wasm.test.ts`: runs only when
  `dist/` exists; fails if any `.js` there contains `AGFzbQ` (the base64
  head of the `\0asm` magic). It passes on the new build. `@types/node` is
  not installed, so the file carries `// @ts-nocheck` like the existing
  file reader, `tests/weapons/models.test.ts`.
- `public/_headers` needed no new rule: the `.wasm` lands under
  `/assets/*` (already immutable) and the Worker maps the `.wasm`
  extension to `application/wasm` by default. Verified by curl on
  `npx vite preview`: 200, `application/wasm`, and the `\0asm` magic in
  the body.
- Sizes (raw / gzip) recorded in the Status entry: `game-sounds` went from
  4,556,407 B (1,722,764 B) to 223,152 B (68,846 B); a new `rapier` glue
  chunk is 295,950 B (51,479 B); the `.wasm` is 3,082,103 B (1,171,203 B);
  `mesher-pool` is unchanged.
- Not checked by eye (no browser here): that each of the four pages loads
  and plays in a real browser, including the stream-compile of the
  `.wasm`. Verified by curl only: status 200 and content-type for the four
  `.html` pages and the `.wasm`, under `npm run dev` and under
  `npx vite preview` of the build.
### 2026-11-06: GAME-08 review, the vacuum played in the Pit (Claude, overnight)

- Qwen 27B finished all three stages. Main merged in: `game.ts` took both
  the melee (GAME-06) and the vacuum in every block (restart hooks,
  `canFire`, the HUD, `state()`, the watch helpers); `audio.ts` kept
  main's `loop` from GAME-04c (the branch had added the same thing);
  `sounds.json` is main plus the five VC entries. tsc, 448 tests and the
  build pass.
- Fixed in review: (1) the suck drew the Foamer toward a fixed world -z
  point, so a player facing +z pulled it through and behind them; the
  nozzle now sits along the lock's view. (2) The render set the active
  blaster's dip to 0 every frame, which undid the weapon switch's rise,
  and its -0.28 never showed (the loadout applies its dip first). The
  loadout now takes a `lowered` offset that it adds itself, set from
  `vacuum.blasterDip` in `data/vacuum.json`.
- Played in the Pit with the watch: a weakened stagger shows as
  vacuumable; E locks, the view turns, the blaster dips away, the tube
  rises at the lower right, the Foamer shrinks toward it and is removed
  with no pop (`popped` 0). Reserves rose by the shares exactly (20 of 40
  active, 44 of 175 and 6 of 24 others). A press before the recharge is
  the empty case. A player facing +z draws the Foamer toward them.
- For Paul: the placeholder tube stands upright, so it reads as a stick
  more than a nozzle aimed at the Foamer. The look is [Paul] anyway. The
  ammo box still credits through its own code in `pickups.ts`, not
  `loadout.refillReserves` (different rule: darts from a box, not a
  share), so "one credit path" is not quite true; fine as is.
- Not checked by ear or eye: the five VC sounds, the puff, the shrink at
  full speed.

### 2026-11-06: GAME-08 done, the foam vacuum (Qwen 3.8-27B via Pi)

Built. The vacuum (`src/game/vacuum.ts`) is the finisher's sibling: E on a
weakened Foamer in its stagger, inside 3 m of the hollow and in the view
cone, locks on. One charge, `rechargeSeconds` (15 s) to refill, full on level
start and retry. The lock holds the player the way the finisher does and turns
the view onto the Foamer; from half the turn the Foamer is drawn to the nozzle
and shrunk to nothing (scale and position ease). Removed with no pop chunks,
a capped white-foam puff at the nozzle. Reward: darts straight into each
blaster's reserve, the type's `ammoShare` (active 0.5, others 0.25) of its own
`reserveMax`, rounded up, capped at `reserveMax` via `loadout.refillReserves`
(the one credit path the ammo box's refill shares).

Files: `src/game/vacuum.ts` (new), `src/foamers/foamers.ts` (`suck`, no-pop
removal), `src/weapons/loadout.ts` (`refillReserves`), `src/game/audio.ts`
(`loop` on the sink), `src/game/game.ts` (use-key wiring, charge step, the
placeholder viewmodel, the render (recharge meter), watch helpers),
`src/ui/hud.ts` (`setVacCharge`, `#vacpip`), `data/vacuum.json` (new),
`data/foamers.json` (per-type `vacuum` block: `allowed` and `ammoShare`),
`data/sounds.json` (VC-* placeholder synths), `design/SOUNDS.md` (IDs match),
`index.html`/`arena.html` (`#vacpip`), `src/style.css` (the meter),
`tests/foamers/vacuum.test.ts` (new).

All numbers in `data/`: reach 3, cone cos 0.97, lock 0.9 s, recharge 15 s,
one charge, the nozzle puff count and size in `data/vacuum.json`; the per-type
`vacuum` entry (allowed: F01, F02 and F05, with each `ammoShare`) in
`data/foamers.json`.

Decisions: the reward is darts into reserves, never past `reserveMax` (the
card, and no pickups, keeping Paul's "no loot drops" rule clean); the types with a per-type `vacuum`
entry and `allowed: true` (F01, F02 and F05) are the allowed ones; a type
with no entry is not allowed (heavies come later); the placeholder viewmodel is
code (no art files), rising in the lower right as the blaster dips, as the
card asks.

Still unverified by eye (no browser on this machine): the vacuum's look and
how it reads rising, the nozzle's foam puff, and the five VC-* placeholder
sounds (all code synths, not Paul's beds). Not done by card: Paul's name for
the tool, upgrades (faster recharge, heavies), the range-panel "Fill vacuum"
button. Reviewer: Claude. Not merged or pushed.

### 2026-11-05: GAME-04c card; GAME-08, GAME-06 and GAME-04c started (Claude)
### 2026-11-06: LVL-02b review, Level 1-2 played through (Claude, overnight)

- Code read: `LevelRunner` is small and keeps `ArenaRunner` unchanged; the
  validator's new rules are sound. Main merged in (HANDOFF kept both
  sides); tsc, 442 tests and the build pass.
- Played `arena.html?level=1-2&watch` with the watch hooks: the parry
  corridor locks on entry, its Roamer spawns and dies, both doors open and
  the runner moves to the Ring (`arena` 1). The Ring locks, runs wave 1 (4)
  and wave 2 (6), and opens every door on clear. Try again in the Ring kept
  the parry corridor cleared and put the Ring back to waiting. The exit pad
  shows the complete panel only after both arenas clear. The Pit still
  loads as one arena. No console errors.
- Seen in passing: Roamers on the far side of the centre block stand at
  its corners and lob over it, so the block works as cover; a player who
  hugs its south face is hard to reach. Worth a look in Paul's playtest.
- Not checked by eye: the spaces and pacing, the north exit reveal, the
  store window, the banner overlap. The rift spawn for the lone Roamer and
  the half scale Ring are the model's format shortcuts (section 14); a
  `placed` Foamer field is a candidate for a later card.

### 2026-11-06: LVL-02b, arenas in order and Level 1-2 beats 1 to 4 (Qwen 3.8 Flash Next via Pi)

`src/level/level-runner.ts`: `LevelRunner` owns one `ArenaRunner` per arena
and steps only the current one, so a later arena's trigger does nothing until
every earlier arena has cleared. It is built from the file's `arenas` array in
order; every arena's runner is constructed up front, which puts every door in
the file into its file state at load, so a player cannot run ahead through a
later arena's open door. `state()` reports `phase` (the arena's own phase, or
`complete` once every arena is down), `arenaIndex`, `arenaId`, `arenasCleared`
and `progress`. `resetCurrent()` restarts the arena being played with the
earlier ones still cleared (Try again); `resetAll()` puts every arena back to
waiting (Play again, and a fall out of the world). `ArenaRunner` itself is
untouched, so the Pit and the Ring play exactly as before and their tests pass
unchanged. The page passes the same `ArenaEvents` it did plus `onArenaStart`
(which moves the rift glow and, in a multi arena level, shows an `Arena n of m`
banner) and `onLevelCleared`. The exit pad only ends the level once the
runner's phase is `complete`; in a one arena level the locked door in front of
the pad already kept the player out of the exit room, so nothing changed there.
The watch's `dartArena.state()` gains `arena`, `arenaId` and `arenasCleared`.

The validator gained three rules: arena ids unique, each arena's trigger inside
the shell, and a later arena's trigger not inside the space an earlier arena
seals when it locks (the trigger, doors and rifts box, ungrown, so a trigger
you can never walk to is an error rather than a level that soft locks).

`data/levels/1-2.json` is beats 1 to 4 of `design/levels/LEVEL-1-2.md`, played
by `arena.html?level=1-2`: the service corridor with a two block foam wall to
test a blaster on and the empty B02 plinth (the rack is [Paul]), the parry
corridor with a west alcove and one Roamer at the far end as its own one wave
arena, the yard, the Ring arena (two waves of Roamers, 4 then 6 with the third
rift behind the block, two foam pillars, south west ammo, the north exit a
reveal) and the breather store with a foam window onto the ring, one ammo box
and the level's exit pad. Three choices a reviewer should see: the lone Roamer
spawns at a rift at the corridor's far end rather than being placed at load,
because the blockout format has no placed Foamer field and the wave machine is
the only thing that spawns; the rooms share one floor slab, one ceiling and one
perimeter wall with the walls between them as pinches, because rule 10 forbids
two shell boxes sharing volume; and the Ring is a half scale A2 (26 x 30 m
around a 12 x 10 m block), because a full 30 x 30 m arena would not fit a
level that is mostly corridor. The parry arena opens its own entry door on
clear as well as the exit, so a cleared player can walk back for the alcove.

Tests: `tests/level/level-runner.test.ts` (a two arena level built by copying
the Pit's arena 60 m north plays both in order; arena 2's trigger does nothing
while arena 1 is fighting; Try again in arena 2 keeps arena 1 cleared and its
doors open; Play again resets both; a one arena level is unchanged) and
`tests/level/level-1-2.test.ts` (1-2 validates, floor under the whole walk from
the start to the exit and under every rift, pickup and checkpoint, both arena
exits block until opened, the triggers and the store bake walkable, `?level=1-2`
selects it). Not checked by eye, no browser here: whether the spaces read and
pace as the concept intends, the reveal of the north exit, the lone Roamer at
the corridor's far end, the store window's read, the two banner texts
competing (`Arena 2 of 2` over `Clear the arena`), and whether the Ring's
Foamers path round the block well rather than hugging it.
### 2026-11-05: GAME-10d review, packs played in the Pit (Claude, overnight)

- DeepSeek's first run broke off on an upstream provider error after
  stage 1; resumed with `pi -c`, it finished stages 2 and 3. Reviewer
  note taken: the spines were one lime tuft on the head (a turnip top),
  now a row of five nubs along the back.
- Merged main in (sounds.json: both sides' new sounds kept; HANDOFF
  rebuilt from main plus this branch's entries, git had misaligned an old
  entry). `foamer-rigs.json` was re-indented by the model: content checked,
  only F03 changed. 426 tests and the build pass.
- Played `arena.html?watch`: Swarmers dart in to about 1 m and back out
  to about 3 m, the swarm pool filled to its cap of 3 while the F01s held
  their own melee tokens, 14 nibbles in 12 s on a standing player. A pack
  of 5 plus two more packs stopped at the live cap. No console errors.
- My own test spawned a pack inside the Pit's centre block (x -4.8 to 4.8,
  z 2.4 to 5.6) and four stayed trapped in its voxel shell: not a bug in
  the Swarmer, but `spawnPack` does not check the spots are walkable.
  Rifts sit on open floor, so it only matters for a hand placed pack.
- For Paul's play test: a full pack is deadly to a player who stands still
  (popped in about 2 s with health resets off). Hit and run feels right in
  the numbers; the look of the scurry, the nibble and the sounds are
  unverified by eye.
- Merged into local main overnight under Paul's standing instruction;
  not pushed.

### 2026-11-05: GAME-10d, the F03 Swarmer built (DeepSeek V4.1 Flash via Pi)

Three commits on `game-10d`: `39112e0` the look, type and turnaround;
`d22fea3` the swarm pool, F03 brain, `spawnPack` and the cap; `d2732ef`
the sounds, the range pack spawn and the benchmark. `npx tsc --noEmit`,
`npx vitest run` (63 files, 417 passed, 2 skipped) and `npm run build`
pass; no em or en dashes in any touched file.

- Look: `data/foamer-rigs.json` F03, five `spine1..5` detail parts on the
  body's back (ellipsoids `[5,6,5]`, taper `[1,0.4]`, `pivot [0,-1,0]`,
  `foam-lime`), a body ellipsoid `[11,9,15]`, a head `[12,11,12]` with the
  angry eyes and an orange `gape`. The reviewer's note that the first try
  read as one lime tuft on the head, like a turnip top, is what moved them
  onto the back as a row of small nubs. Turnaround re-rendered with
  `npx tsx tools/render-rig.ts F03` (four views, sheet, README row).
- Brain: `src/ai/f03-brain.ts`, an F01 sibling with four states, no new
  ones. `decideF03` is pure so the test asks it directly. Range is the
  type's `attackRange` (1.4) to bite and `holdRangeMetres` (3.0) to ring,
  gap `pack.nibbleGapSeconds` (1.2). The clock is `sinceNibble` on
  `AgentInput`: `Infinity` at spawn, set to 0 by the system when a nibble
  lands (only for a swarm member), plus `dt` each step. It is not a new
  Foamer state, so the recover, the stagger, the fall and the crawl all
  behave exactly as they did for the others.
- Tokens: `swarm` is a third `TokenKind` in `src/ai/director.ts` and
  `data/ai.json`, with its own cap per difficulty and its own `stats()`
  row. `tokenKindOf` reads it off the attack's token, and `spawn` picks
  the f03 brain from it.
- Pack and cap: `spawnPack(feet, facing?, count?, type = "F03")` places
  `pack` members on a ring round the point at 55 to 100 percent of
  `pack.spreadMetres` (1.6), and stops at `pack.maxAlive` (12). Past the
  cap a spawn is skipped, and nobody is trimmed. The system's own
  `SPAWNER.max` (12) still applies underneath.
- Damage: a nibble is the ordinary attack path, so `damageOf`,
  `blocksAttackFrom` and the 0.5 s grace all apply and the shield blocks
  it from the front. `tests/foamers/swarmer.test.ts` checks the nibble id
  and the dart-free path; the shield test for it is the existing one,
  unchanged.
- Range: `src/range/main.ts` spawns a whole pack when F03 is the chosen
  type, singly for the others, so one press shows the ring.
- Sounds: `F03-yip` on the new `"alert"` event (sent only for a swarm
  member), `F03-nibble` picked from the attack's token, `F03-scurry` for
  an F03's steps. Recipes are in `data/sounds.json`, rows in
  `design/SOUNDS.md` 4.2, and the old "later" F03 row is gone from the
  other-Foamers table.
- Tests: `tests/ai/f03-brain.test.ts` (5: wake and run in, back out and
  ring, the type's ring not the shared one, one alert waking a pack, the
  data numbers), `tests/foamers/swarmer.test.ts` (5: own spec and health,
  `spawnPack` count and cap, swarm tokens not eating melee ones, nibble
  then back out, the pack waking together), `tests/foamers/swarmer-sounds.test.ts`
  (3: the yip and no shared alert line, the nibble line and not a swing,
  skitter against a thump). F01, F02 and F05 tests are unchanged and pass.
- Benchmark: `npx tsx tools/bench-swarmer.ts` (new, headless, the same rig
  the tests use): 10 Swarmers, 600 frames, 0.20 ms mean, 0.18 median,
  0.30 p95, 18 nibbles. There is no browser here, so this is the
  simulation half of a frame only, not a frame rate.
- Unverified by eye: the look (whether the five nubs read as nubs and not
  as a lumpy ridge), the skitter and the nibble poses at speed, whether
  the ring reads as a pack circling rather than a crowd jittering, and the
  three placeholder sounds. Also unverified: the real fps with two packs
  in the Ring or Pit.

### 2026-11-05: GAME-06 review, the combo played in the Pit (Claude, overnight)

- Merged main in; `game.ts` restart hooks now reset the melee and stop
  the saw loop. 413 tests and the build pass.
- Played `arena.html?watch` against one F01: hits of 1, 1 and 2 damage,
  the third staggered it and knocked it 2 m back, charges 3 to 0; the next
  press was the bash (it missed: the knockback had put the F01 past the
  bash's 1.8 m reach), the one after the empty click on the bash's
  cooldown. The new shield and the three charge pips under the health bar
  show in the screenshots. No console errors.
- Not checked by eye: the baton's sweep. It animates on render time, and
  the watch harness renders one frame per step call, so a screenshot could
  not catch it mid swing; the shoves and sounds too. For Paul's play test.
- Merged into local main overnight under Paul's standing instruction;
  not pushed.

### 2026-11-05: GAME-10d card, the F03 Swarmer, started (Claude)

- Paul asked for a DeepSeek task while GAME-08 and GAME-06 run. Card
  `tasks/GAME-10d.md`: the Swarmer's palette look and turnaround, a pack
  brain (hit and run nibbles), a `swarm` token pool, `spawnPack` and a
  live cap. Kept clear of the shield, the melee and use blocks, pickups
  and vacuum entries. Running on `game-10d`.

### 2026-11-05: GAME-04c review, the saw played in the Pit (Claude)

- Played `arena.html?watch`, one F01, a throw from 4 to 8 m: the disc
  lodged, ground for 0.9 s (9 ticks), held the F01 staggered the whole
  time, then flew home. The F01 went from 6 health to 0.5 (the throw's 1
  plus 9 x 0.5): never killed, left finishable. No console errors.
- Fixed: the flying disc flew face first (its face 0.99 along the travel),
  a plate seen from behind. It now flies flat and edge first, the nubbed
  rim leading, its face up and tipped back toward the thrower by
  `look.flightTiltDeg` (20) so the rings still read. A screenshot shows it
  meeting the Foamer edge on.
- For Paul's play test: one saw throw takes 92 percent of a Slowmer's
  health. That makes the saw plus a finisher a two button kill on fodder;
  `saw.damagePerTick` (0.5) and `grindSeconds` (0.9) are the knobs.
- The nav timing test failed in this branch's full run while two other
  models were testing on the same Mac; the 39 shield and saw tests pass.
- Not checked by eye: the look held on the arm, the grind on a Darter's
  plates, the sounds.

### 2026-11-05: GAME-04c built: disc look, spin, foam saw (DeepSeek)

- Look: `data/shield.json` `look` is now three concentric foam bands
  (`bands`, each thinner and stepped forward by `domeDepth`, so the face
  domes), 16 rounded nubs on the rim (`nubCount`, `nubRadius`) as the saw's
  teeth, and the factory palette in `look.colors`. The boss is a plain foam
  cylinder with a `[Paul]` note: the emblem is Paul's. The disc is built
  once in the `Shield` constructor as `discModel` and the throw reparents
  that one group into a scene-level `flight` holder (the catch returns it to
  the arm), so the held and the flying disc are the same model; the old
  `discMesh` name is kept as a getter on `flight`.
- Spin: about the disc's own axis (the face along the flight), at
  `look.spinRevPerSec` (6) out and back and `saw.spinRevPerSec` (14) while
  grinding. Chose in-plane spin over edge over edge: the card says about its
  own axis, and the bands and teeth are what should be seen turning.
- Foam saw: a new `saw` block. The first Foamer a flight strikes is lodged
  in: the disc holds its contact point in the struck part's voxel frame (so
  it rides a Foamer that walks or is shoved), spins fast, carves a
  `carveRadius` sphere every `tickSeconds`, deals `damagePerTick` (plates
  take `plateShare` 1.0, against a dart's 0.15, measured with `armourOf`),
  throws at most `debrisPerTick` chunks a tick and keeps the Foamer
  staggered for the grind. Then it ricochets as before (bounces and range
  unchanged). It never kills (`canKill` false): it keeps the throw's floor
  and sets `finishWeakened`, the point of the weapon. A prone Foamer takes
  it without the stagger. No block, parry or charge while it is lodged
  (unchanged: `state` is not `raised`).
- Sounds: `SH-saw` (a loop, started on the lodge, followed to the disc,
  pitched by the grind time left, stopped when the grind ends or the disc
  comes home or the run restarts) and `SH-sawEnd`, with placeholder synth
  recipes and `design/SOUNDS.md` rows. No separate spin whirr: the card
  allowed it only if cheap, and the saw's loop carries the spin's sound.
  `src/game/audio.ts` gained a `loop` pass-through (a no-op handle while
  the engine loads).
- Watch: `state()` gains `grinding` (the target's rig and seconds left).
- Tests: `tests/player/saw.test.ts` (9): grind length, riding a moved
  Foamer, tick count and damage, the Darter's plate share, never kills and
  leaves it finishable, ricochet and return after the grind, no block or
  parry while lodged, one model held and flown, and the look data's bands
  and spin. `tests/shield/throw.test.ts` test 2 now asserts the total cost
  is more than the throw's own damage (the grind adds its ticks).
- `npx tsc --noEmit`, `npx vitest run` (404 passed, 2 skipped) and
  `npm run build` pass. Not checked by eye: the look, the spin's speed and
  direction, the disc sitting on the body rather than in it during the
  grind, and the two sounds. Reviewer: Opus 5.5.

### 2026-11-05: GAME-06 done: melee weapon 1 M01, the combo, the bash, the charges (Qwen 3.8 Flash Next via Pi, dgx-spark)

- New `src/game/melee.ts` (`Melee`) owns the combo, the charges and the hit
  query; `data/melee.json` owns every number (active id `M01`, `weapons`
  map so weapons 2 and 3 are data plus small code later). Three charges:
  each press within `comboWindow` (0.6 s) swings the combo's next hit and
  spends one, a later press restarts at hit 1; each hit takes every Foamer
  in reach (eye to chest), inside the 70-degree arc, in sight of the eye,
  nearest first, at most `maxTargets` (3), through the existing
  `parryDamage`; hit 3 staggers (the existing stagger) and knocks back via
  each Foamer's own `knockStep`; each hit carves a small foam sphere at the
  contact through the dart carve path with its own debris cap. With no
  charge a press is the shield bash (weak damage, a small push, no
  stagger, its own cooldown, never nothing) plus the view's short shove
  (`melee.kick` rides the camera climb with the shield's kicks). A parry
  gives a charge back (reads the shield's `parries` only), and below full
  one returns every `rechargeSeconds` (8); full at start and retry
  (`melee.reset()` on the restart hooks). No swing while the disc is
  raised or a charge runs; a swing with the disc thrown is fine. A running
  swing blocks the blaster (`canFire` gains `!melee.swinging`).
- Key order (PLAN 14): the finisher sees the press first, unchanged; with
  none finishable the weapon takes it and the press is spent. The
  course's debug blast (which had borrowed `melee`) moved to its own
  binding `debugBlast` (KeyB, `data/input.json`, `src/core/input.ts`),
  course page only.
- Look: `src/game/meleeView.ts`, a code-built foam baton (orange handle,
  cream foam ball, `look` block in `data/melee.json`) that sweeps L-to-R,
  R-to-L, then overhead over `swingTime`, easing out; the blaster dips
  out of the way (applied after `loadout.render`). The bash shows no
  baton. [Paul]'s look to come.
- HUD: `hud.meleePips(charges, max, pulse)`: three pips under the health
  bar in `index.html` and `arena.html` (`#meleepips`); the newest full
  one pulses on a refill. Sounds: placeholder synth recipes for
  `ML-swing`, `ML-hit`, `ML-bash`, `ML-empty`, `ML-charge` in
  `data/sounds.json` (rows in `design/SOUNDS.md`).
- Watch: `swing()` (one melee press, one step; reports `{charges, swung}`;
  `swung` is the hit index, -1 the bash, null nothing) and `state().melee`
  (charges, max, combo step, swing and bash seconds left). `meleePress()`
  is exported from `src/game/melee.ts` as the shared key-order helper the
  finisher-first test uses.
- Tests: `tests/game/melee.test.ts`, 9 tests on a real Rapier world with
  spawned Foamers and a carve wall: the combo steps and restarts, each
  charged hit spends one charge and takes only Foamers in reach, arc and
  sight at most maxTargets, hit 3 staggers and knocks back, the swing
  gates the next press, the bash is weak and never staggers, parries and
  the timer refill one at a time never past max, `reset` refills, the
  raised/charging gate (thrown is fine), and the finisher takes the press
  first. `npx tsc --noEmit`, `npx vitest run` (404 passed) and
  `npm run build` pass.
- Not checked by eye (no browser here): the swing look (baton sweeps and
  the blaster dip), the feel (timing, the bash's shove), and the sounds.
  The pips' placement relative to GAME-04c's shield area is my guess (the
  pips sit under the health bar); Paul to judge.

### 2026-11-05: GAME-04c card; GAME-08, GAME-06 and GAME-04c started (Claude)

- Paul on the shield: a round foam shield in the spirit of a classic round
  hero shield, spinning when thrown, and a foam chainsaw type weapon if it
  can be done. Card `tasks/GAME-04c.md` (DeepSeek): concentric foam rings,
  the flying disc uses the held model and spins, and a throw lodges in the
  first Foamer and grinds it, then ricochets. Not a copy of any real
  shield (no star, no red, white and blue rings, no brand words, per
  CLAUDE.md); the emblem and name stay [Paul].
- GAME-06 no longer touches `src/player/shield.ts`: GAME-04c owns it while
  both run; the bash is a camera shove.
- Started together: GAME-08 (Qwen 27B, qwen-machine), GAME-06 (Spark),
  GAME-04c (DeepSeek). Pi needs `.ts.net` in `NO_PROXY`: the local proxy on
  7890 breaks the TLS handshake to qwen-machine.

### 2026-11-05: ammo boxes hold 20 darts (Paul)

- Paul: start the ammo boxes at 20 darts and tune in play tests. Every
  `darts-standard` box in the Pit and the Ring now has `count` 20 (it was
  4). `count` stays darts, not magazines.

### 2026-11-05: nav path query back to its old speed (Claude)

- The "flaky" nav timing test was a real slowdown. Alone, the 40 x 40 m
  path query took 1.1 ms before BUG-01 and 1.85 ms after it (the two-layer
  A*), against a 2 ms budget, so any load in the full run tipped it over.
  The bake was unchanged (about 30 ms, budget 150).
- Three changes in `src/ai/nav-grid.ts`, same paths as before:
  `stepOk` is gone (every neighbour comes from `nodeNear`, which already
  applies the same step rule, so it ran the check twice); `nodeNear` skips
  the nearest-layer search for a one-layer cell (nearly all of them); the
  heuristic reads its target once per search instead of per neighbour, and
  the diagonal corner checks reuse the four straight neighbours' results.
- Now 1.13 to 1.23 ms alone; five full parallel runs in a row all pass
  (395 tests). The test and its budgets are unchanged.

### 2026-11-05: LVL-02a merged (Claude)

- Merged clean; 395 tests and the build pass. `tests/ai/nav-grid.test.ts`'s
  timing test (bake a 40 x 40 m floor under 150 ms) failed twice today in
  the full parallel run (303 ms once) and passed alone every time. The
  two-layer bake made it a little slower, and 57 files run at once. Fixed the same
  day: it was a real slowdown, see the next entry up.
- Still open for Paul: the ammo box holds 4 darts (see the review entry).

### 2026-11-05: LVL-02a review, ammo boxes played in the Pit (Claude)

- Merged main in (23 commits); only the docs conflicted.
- Fixed, with tests: the pickup cap counted every kind together and
  trimmed the oldest item, and the level's ammo boxes are the oldest, so a
  few finishers' health sprays deleted them. The cap is now per kind and
  trims the oldest of that kind.
- Fixed, with a test: a box split one pool of darts, first blaster first,
  and all three blasters take standard darts, so B01 took the whole box.
  The card says every blaster of the type gets the count; it does now.
- Played `arena.html?watch`: the Pit starts with 2 boxes; walking onto one
  took B01, B04 and B03 from 10 to 14 each; at full reserves the other box
  stayed; Try again brought both back. A screenshot shows a readable yellow
  box on the pit floor. No console errors.
- Answered 2026-11-05 (20 darts, see above). Was: a box holds 4 darts (`count` in the level files, from the
  original Pit file). That is half a B01 magazine and about a tenth of a
  B04 one, so it barely reads as a pickup. Pick the number, or say whether
  `count` should mean magazines instead of darts.

### 2026-11-05: GAME-04b and ANIM-01 merged (Claude)

- Merged after BUG-01; only the docs and the BUG-01 card conflicted (kept
  both sides, and main's BUG-01 card with round 2). 383 tests pass, the
  build is clean.
- Smoke check on merged main, `arena.html?watch`: no console errors;
  F01s and F02s go through approach, windup, strike, recover and hold, and
  the Roamers threw 24 balls in 25 s.
- Not a merge problem, worth a fix later: `parryNext()` does not land a
  parry. Six tries against a lone F02 gave 0 parries on merged main and the
  same 0 on the unmerged `game-04b` branch (the balls burst on the disc as
  blocks). The parry's unit tests pass; the watch helper's timing is off,
  which fits the single parry seen in the GAME-04b review. Paul's hands-on
  play is the real check of the parry window.

### 2026-11-05: BUG-01 round 2 review, both Pit spots played (Claude)

- Played `arena.html?watch` on the branch (port 5191):
  - Player on ring-s at (0, 4, -11.5), wave 1: all three F01s climbed
    ramp-s (one on the ring by 25 s), walked the ring and hit the player
    (health 100 to 88).
  - Player on open floor at (0, 0, -4), the wave 2 mix (3 F01, 2 F02):
    the F01s closed and attacked, the F02s threw 24 balls in 30 s (14 hit).
  - Player under the ring at (0, 0, -11): the F01s walked in at floor
    level and attacked, the F02s threw 25 balls (17 hit). No console errors.
- Rebaking an 8 x 8 m area takes about 2.5 ms (2.4 us a cell), so a
  carve-sized rebake stays well under a millisecond.
- Fixed: the `stepOk` comment described edge sampling the code does not
  do; it now describes the autostep cap, which is the real fix.
- Worth Paul's eye: the Foamer controller now autosteps 0.2 m, not 0.3 m,
  and the steering's waypoint skip fell from 0.5 m to 0.1 m. Neither
  showed a problem in the Pit, but watch for Foamers balking at a
  0.2 to 0.3 m step on other levels, or jittering at path corners.

### 2026-11-05: BUG-01 round 2, the ring's top and the real ramp stall (DeepSeek V4.1 Flash via Pi)

- Review finding R1: round 1's "lowest surface wins" bake threw the Pit's
  ring tops away. `groundAt(0, -11)` was 0, not 4, so a player standing on
  the ring drew an F01 that walked to the pit floor under the slab and
  struck at nothing 4 m below. Fixed with a layered grid:
  `src/ai/nav-grid.ts` keeps up to `nav.maxLayers` (2) walkable surfaces per
  cell, lowest first, and A* runs on `(cell, layer)` nodes. `groundAt` and
  `walkableAt` take an optional height and pick the nearest layer (no height
  still means the lowest, so old callers and tests are unchanged).
  `findPath` takes the agent's and the goal's feet height; the pages pass
  `player.eye - player.eyeHeight`, since `player.eye(1, ...)` is feet plus
  1.6 m. The agent re-paths when the goal's height moves more than 0.5 m.
- The bake is still allocation free: the ray hits reuse preallocated slots.
- Review finding R2, the ramp-side stall, is the character controller's
  autostep, not the string pull. Measured: at a Foamer's 1 m/s and 60 fps
  (a 0.017 m frame move) Rapier autosteps a 0.2 m rise but not 0.25 m, no
  matter what `maxHeight` is set to, because the autostep needs room ahead of
  the capsule that a small step does not give it. The grid called any rise up
  to 0.45 m a step, and the south ramp's east side is 0.44 m from the floor
  at the next cell, so A* and the pull both routed through it. `nav` gained
  `stepAutostepMetres` (0.2), and `stepOk`, `nodeNear` and `lineClear` cap a
  climb with it; a drop still uses `maxStepMetres`. `steer`'s waypoint skip
  also fell from 0.5 m to 0.1 m: at 0.5 m the walk cut the dogleg at the
  ramp's foot and went into the side again.
- Review finding R3: the stall guard drops a Foamer's entry when it is not
  walking its path (so a Foamer that held its ring does not sidestep the
  moment it walks again) and in `removeFoamer`. The walk builds the set of
  every Foamer body once per `update` instead of once per Foamer, and the
  old `others` set is gone (the predicate reads `allBodies` directly).
- Tests added: `tests/ai/pit-foamers.test.ts` now has the ring's-top lookup
  and a Foamer that walks the ramp up to a player standing on ring-s;
  `tests/ai/stall.test.ts` has the guard's memory (entry dropped on remove,
  entry dropped when not walking a path).
- The card asked for the ring test to pass within 25 s. It takes about 35 s:
  the only route up is the south ramp, which makes the walk about 28 m, and
  an F01 walks 1 m/s. The test uses 45 s and says why in a comment. It is on
  the ring by second 25 and reaches the player at about 35.
- Not checked by eye (no browser here): the ring route on
  `arena.html?watch`, whether the Foamer now prefers the ramp visually, the
  sidestep's look, and whether the 0.2 m climb cap makes any other level's
  step look too tall to walk. Nothing visual was run.

### 2026-11-05: BUG-01 round 2 sent back; GAME-06 and GAME-08 cards queued (Claude)

- BUG-01 review: round 1 is not mergeable. The lowest-surface bake drops
  the ring top from the grid (both rings are slabs over open floor), so a
  player on the ring draws Foamers under it; and the ramp-side stall is
  only hidden (on main a Foamer chasing a player on the ring still freezes
  at (-9.8, -2.1) beside ramp-s). Round 2 is in `tasks/BUG-01.md`: two
  layers per cell from round 1's filter, the ramp-side cause, stall guard
  fixes. DeepSeek V4.1 Flash (`openrouter deepseek/deepseek-v4.1-flash-1017`)
  is running it on `bug-01`.
- Model rules from Paul (2026-11-05): DeepSeek is that exact id; Kimi is on
  hold for cost until a task needs it; qwen-machine and dgx-spark start only
  when Paul says.
- Queued for the local models, not started: `tasks/GAME-08.md` (the vacuum,
  Qwen 27B) and `tasks/GAME-06.md` (melee weapon 1, Spark). Both start from
  main after BUG-01, GAME-04b, ANIM-01 and LVL-02a merge. They can run at
  the same time; they touch different modules but both edit the melee and
  use block in `src/game/game.ts`, the HUD, `data/sounds.json` and the
  docs, so the second to merge resolves those.

### 2026-11-05: START HERE, session handoff for Claude (Claude)

Paul ended the long 2026-11-03/04 session to save usage. Read this, then
the Status section; do not re-read the whole Log.

**How the work runs.** Pi models write the code; Claude writes the task
card (`tasks/<ID>.md`), starts the model in its own worktree, reviews,
fixes small things with a test, and asks Paul before every merge ("Approve
and merge"). Pushing main is publishing: only as part of an approved merge.
- Worktree: `git worktree add -q ../dart-<b> -b <b> && ln -s
  ../dart/node_modules ../dart-<b>/node_modules`. Every `GitHub/dart-*`
  folder is one of these: a checkout of the branch named after it, never
  a separate project. `dart/` (main) is the only one that deploys. After a
  merge, remove it: `git worktree remove ../dart-<b>` (the branch stays).
  `git worktree list` is the truth; as of 2026-11-05:
  - Waiting (not merged): `dart-bug-01` (BUG-01, review), `dart-game-04b`
    (parry, merged 2026-11-05), `dart-anim-01` (ANIM-01, merged 2026-11-05),
    `dart-lvl-02a` (LVL-02a, review). These four are the only ones; the
    nine merged leftovers were removed on 2026-11-05.
- Start a model: `tools/pi/run-pi.sh <worktree> <provider> <model>
  <thinking> <brief file> <log>` (retries a start-up hang; never kills
  pi's children, which may own the local context proxy on 18787). Brief:
  `tools/pi/brief-template.txt`.
- Providers: DeepSeek `openrouter deepseek/deepseek-v4.1-flash-1017
  medium` (long cards); Qwen 27b `qwen-machine qwen3.8-27b-1cat low`
  (shorter cards, Paul's Linux AI machine; PAUSED by Paul until he says
  so); Spark `dgx-spark qwen3.8-flash-next medium` (travels with Paul,
  check it answers first); Kimi `moonshotai` (art).
- A run that stops with nothing committed: Qwen can overthink and hit
  its output limit (resume with `pi -c` and "stop planning, write code");
  DeepSeek can break down in a very long session (start a fresh one with
  a brief on what is on disk).

**Reviewing.** Each worktree gets a `.claude/launch.json` entry (in the
GitHub folder) on its own port; `preview_start` it and drive
`arena.html?watch` or `index.html?watch` with `dartArena` / `dartGame`
(`state`, `moveTo`, `look`, `aimNearest`, `fire`, `step`, `block`,
`throwShield`, `charge`, `finish`, `parryNext`) and the dev hook
`__arena` / `__dart` (`foamers`, `foamers.projectiles`, `player`,
`health`, `loadout`, `camera`). Lessons:
- Await a `setTimeout(0)` between steps after a spawn: Foamer part
  colliders come from the mesher worker and never land in one long
  synchronous loop (darts then pass through every Foamer).
- After a hit the player ignores damage for 0.5 s: count
  `foamers.projectiles.stats.hitPlayer`, not health drops.
- A popped player pauses the game; reset health each step in long runs.
- Standing under the Pit's ring overhang breaks Foamer pathing (BUG-01).
- Keep browser checks short; the costly part of the last session was
  long debugging in the conversation.
- `set -o pipefail` before `npx vitest run | grep`, or a failing suite
  still lets the commit through. `tests/ai/nav-grid.test.ts` timing test
  flakes under load; rerun alone.

**Jobs remaining, in order.**
1. Done 2026-11-05: BUG-01 reviewed (two rounds) and merged.
2. Ask Paul to merge `game-04b` (parry, GAME-04 stage 2, reviewed: one
   clean parry seen; main already merged in) and `anim-01` (ANIM-01
   throw and charge poses, reviewed by key frames). They conflict with
   each other in the docs only.
3. Review `lvl-02a` (Qwen, 3 commits, placed ammo pickups; not yet
   reviewed), then ask Paul.
4. Main here is 3 commits ahead of origin (the BUG-01, ANIM-01 and
   LVL-02a cards, plus this entry); they go out with the next approved
   merge.
5. Next cards when Paul says: GAME-06 melee weapon, GAME-08 ammo for
   kills (vacuum, D09), GAME-10c the heavy, GAME-09b catastrophic hits,
   ART-05 first person animations, AUD-01b Paul's recordings, QA-01
   low-end machine check (due 2026-11-12).

**Waiting on Paul.** Whether the player is safe during a finisher; the
shield's name and look, and whether the lowered disc should sit lower
(it fills the lower left); the content plan review (1-2 blaster clash,
act settings and accent colours, the "Foam Demon" working name, level
names such as the ring's).

### 2026-11-04: BUG-01, two Pit stalls fixed (DeepSeek V4.1 Flash via Pi)

- Cause 1, the overhang: `src/ai/nav-grid.ts` baked a cell from the first
  surface a ray from above met, so the floor under the Pit's ring baked as
  the ring's top at y 4. A player standing underneath was pathed to 4 m up
  and the Foamers walked at the ramp instead. `bakeCell` now collects every
  surface, keeps the up-facing ones, sorts them low to high and takes the
  first that is not swallowed by a surface within `nav.maxStepMetres` above
  it and that leaves the agent's capsule shape clear. A wall still bakes as
  its own top, so the step, ledge, slope and wall tests are unchanged.
- Cause 2, the clump: every Foamer's movement capsule is a world-group
  member (darts and aim skip it by its own bit), so two Foamers pressed
  together each asked the character controller to walk into the other and it
  cancelled both steps. Wave 2 spawns from one rift, so the whole front rank
  froze. The walk now ignores the other Foamers' root and part bodies by
  handle. Note for next time: a character-controller filter predicate may not
  read `collider.contactGroups`/`shape` or its parent, it must use
  `collider.handle` / `collider.parent()?.handle`; anything else throws
  inside the query and is silently ignored.
- Guard: a Foamer whose path stops making progress now sidesteps for a
  moment and tries again, so a Foamer can never be frozen for long by
  something the bake cannot see (a wall built after the bake, a body parked
  in a doorway). Numbers in `data/ai.json` `steer`.
- Tests: `tests/ai/pit-foamers.test.ts` (floor under both rings, a Foamer
  walks under the ring), `tests/ai/pit-wave.test.ts` (a five strong wave on
  one rift engages), `tests/ai/pit-ramp-side.test.ts` (the card's recorded
  spots against ramp-s), `tests/ai/stall.test.ts` (no more than 2 s still
  while walking). All four fail on the unfixed code.
- Unverified by eye: everything visual. Nothing was run in a browser here.
- Also dropped: the half-finished two-levels-per-cell nav rewrite from a
  previous session (12 tests failing); the lowest-surface rule does the job
  with the existing tests intact.
### 2026-11-04: GAME-04 stage 2 review, parry in the Pit (Claude)

- Merged main (GAME-10b) in; only the imports and docs conflicted.
- Played `arena.html?watch` against wave 2's Roamers with `parryNext()`:
  a parried ball flew back and took its thrower from 8 to 4 health, and
  the parry count went up. Only one clean parry: most tries had no ball
  reach the player, for the two reasons below, not the parry code.
- Found, not fixed (see `tasks/BUG-01.md`): Foamers in the Pit freeze.
  (1) The nav grid is 2.5D, one ground height per cell, so a player
  standing under the ring's overhang reads as on the ring top, 4 m up,
  and Foamers path for the ramps and stall. (2) On open floor too, all
  four wave 2 Foamers stood still for over 30 s in `approach` against
  the side of the south ramp (x about -9.5), paths of 2 or 3 points, so
  the Roamers never got their throw.
- Measuring lesson: after any hit the player ignores damage for 0.5 s
  (UI-01 grace), so health drops undercount ball hits while Slowmers bonk;
  count `foamers.projectiles.stats.hitPlayer` instead.
- Corrected: the PLAN row said "Paul approved" before he had.
### 2026-11-04: ANIM-01 review, key frames viewed (Claude)

- Viewed the key frames Qwen could not: the F02 windup holds the ball high
  beside the head with the arm cocked, and the strike whips the arm and
  ball out past the shoulder; the F05 telegraph dips the head, the charge
  pitches the whole body forward, and the wall stun rocks it back with
  the orange back showing. All read at a glance. 32 PNGs, 208 KB.
- Unverified: timing and readability at 10 m in a live game.

### 2026-11-04: ANIM-01, the F02 throw and the F05 scrape and charge poses (Qwen 3.8-27B via Pi)

- Card: `tasks/ANIM-01.md`. Two stages, each committed green (tsc, vitest,
  build, no em or en dashes):
  - Stage 1 (bd18c74): the poses. A per-rig `motions` block in
    `data/foamer-rigs.json` holds every number (angles in degrees, distances
    in metres). F02 `throw.wind` lifts the ball arm back and over the head
    (armR -180, foreArmR 80) and turns the body 15 degrees away; `strike`
    whips it through past the shoulder (armR -60, foreArmR 100) with the
    body swung to the far side so it reads as coming through. F05 `scrape`
    dips the body forward and sweeps a leg back and forward twice; `charge`
    pitches 25 degrees forward on a 34 degree stride; `wallStun` rocks the
    body back with a wobble, and on a rig whose body is its head (F05) the
    head shake judders the pitch. `poseNums` reads the block; a missing
    block reads zero, so no other rig changes (F01 tested at rest).
  - Stage 2 (aec6522): `npx tsx tools/render-rig.ts <id> --state <state>
    --t <0..1> [--attack <id>]` renders every view for that state and time
    to `design/foamers/poses/`. Key frames for the F02 throw (windup t.5,
    t1; strike t.7, t1) and the F05 telegraph (t.25, t.75), charge (t.5)
    and wall stun (t.25) are rendered there. `tools/pose-check.ts`
    measures each key frame's part extents numerically, `tools/pose-ascii.ts`
    prints a front and side silhouette so the shape can be checked without
    a browser.
- New `RigMotion.turn` (root yaw, radians) carries the body's in-place turn;
  `poseParts` eases it like the other root motion, `solveRaw` folds it into
  the root yaw.
- Tests (`tests/foamers/poses.test.ts`): the F02 ball sits behind its rest
  position at full windup and in front through the strike, and the body
  turns away then through the target; the F05 charge pitches forward, the
  telegraph dips and moves a leg, the wall stun rocks back and wobbles; F01
  with no block keeps its old poses.
- Unverified by eye: this is a headless AI machine, no browser. The pose
  math is verified numerically and sketched as silhouettes, but the PNG key
  frames in `design/foamers/poses/` should be looked at, and a real F02
  throw and F05 charge watched in the game to check the timing, the 10 m
  readability of the windup, the shake of the wall stun, and the charge's
  look. No em or en dashes.

### 2026-11-04: LVL-02a, placed ammo boxes from the level file (Qwen 3.8-27B via Pi)

- The level file now places ammo: the `ammo` pickup kind in
  `src/pickups/pickups.ts` is a 0.35 m foam box on the floor (no hop, a slow
  turn and a bob until it settles), collected by walking within 1 m of the
  feet. It adds its `count` to the `reserve` of every blaster the system
  holds (`PickupSystem.blasters`) that takes its dart type, caps each at
  `reserveMax`, and a box that would give nothing stays on the floor (like a
  health blob at full health). A dead player never collects.
- The arena page (`src/arena/extras.ts`) gives the system the loadout's
  blasters and calls `pickups.loadLevelBoxes(LEVEL)` at load; `respawnAtEntry`
  (Try again, Play again) and the fall respawn clear and reload, so a
  collected box comes back on a restart. `dartArena.state().ammoBoxes` counts
  the boxes still on the floor.
- The validator (`src/level/validate.ts`) rejects a `darts-*` pickup whose
  type slice is not in `data/darts.json.types`; non `darts-*` pickup types are
  ignored.
- The Pit keeps `pit-ammo` and gains `pit-ammo-far` at `[-12, 0.4, 7]` (the
  far side of the pit floor from `pit-ammo` at `[12, 0.4, -7]`). The Ring's
  single `ring-ammo` becomes `ring-ammo-w` `[-11, 0.4, 1.6]` and
  `ring-ammo-e` `[11, 0.4, 1.6]`, one by each pillar, as the card asks.
- A collected box plays `PU-ammo` (new synth placeholder in
  `data/sounds.json`, noise rattle; `design/SOUNDS.md` already lists the ID)
  and pulses the ammo counter in the box's yellow (`hud.ammoFlash`, the
  `#ammo.topped` class), never the green heal glow.
- Not in scope per card: Foamer ammo drops, GAME-08 (ammo-for-kills), new dart
  types.
- Not verified by eye: how the box turn and bob read, the collect sound and
  counter pulse on the real page, and the new box positions (the far Pit box
  and the two by the Ring pillars) feel-right in play. `tests/ai/nav-grid.test.ts`
  flakes under the full parallel run (passes alone and in a rerun); everything
  else is green (tsc, vitest 375, build).

### 2026-11-04: GAME-10b review, Darters played in the ring, merged (Claude)

- Played `arena.html?level=1-4-ring&watch`: two Darters, the lime plates
  on the side they face (chest +0.13 m, brow +0.22 m along the facing) and
  the orange weak point behind (-0.44 m), so the -z offsets in the rig
  data are only rig-local.
- Fixed: the Darter used the shared 2.2 m hold ring, so it walked into
  bite range and "charged" from about 2 m, a slow bonk. Chargers now hold
  on their own ring (`charge.holdMetres`, 9 m) and telegraph from 5 to 8 m
  out. Test 7 in `tests/foamers/charge.test.ts` (2.19 m before).
- Fixed: a charge that ran into the player was stopped by the player's
  capsule and counted as a wall, so every hit gave the player a free wall
  stun on its back. A hit on the player now ends in the normal recover;
  only a real wall opens the back.
- Small, not fixed: the tab title still reads "DART: the Pit" on the ring
  level (the level name is [Paul]).
- Unverified by eye: the scrape and charge poses, the stun feel, the
  plate chip, the sounds.

### 2026-11-04: GAME-10b, the F05 Darter and the Ring (DeepSeek V4.1 Flash via Pi)

- Card: `tasks/GAME-10b.md`. Three stages, each committed green (tsc,
  vitest, build): 1 the F05 data and armour shares (ed9d333), 2 the charge,
  telegraph, wall stun and player stun (4641c05), 3 the Ring level, the
  `?level=` loader and the watch states (4cdb02b), then the scrape dust and
  the wall hit sound wired in the shared game (b64d774).
- Data: `types.F05` in `data/foamers.json` (rig F05, health 30, turnRate
  1.4, `charge` and `armour` blocks, a charge attack and a bite). All the
  charge numbers are there: speed 11 m/s, 18 m, range 14 m, telegraph
  0.9 s, wall stun 1.2 s, player stun 0.4 s, dust count and size, plate
  arc 120 degrees. Sounds are `F05-snort`, `F05-run-loop`, `F05-impact` and
  `F05-stun` placeholders (synth only, no audio files), listed in
  `design/SOUNDS.md`.
- Code: `src/ai/f05-brain.ts` (the charger states and the pure
  `decideCharge`), `src/foamers/charge.ts` (`ChargeSpec`, `chargeOf`), the
  three states in `src/foamers/foamer.ts` and `src/foamers/foamers.ts`
  (the run moves through `knockStep`, so walls stop it; `onChargeHit`,
  `onWallHit` and `onScrape` report out, and the game turns a hit into the
  controller's `stunTime`), `scrapeMotion` and `chargeMotion` in
  `src/foamers/rig-states.ts`, the shield's `plateFacesCharge` in
  `src/player/shield.ts` (bounce, no damage, no stagger) and the
  `stunTime` in `src/player/controller.ts`.
- Decided: the player stun is a number on the controller, not a state; the
  charge is a Foamer state driven by the system (the brain only stands in
  it); the level choice is `src/arena/levels.ts` with the Pit default and a
  notice for an unknown name; the Ring's ceiling is at 9.5 m because the
  nav bake casts down from 8 m and a ceiling at 8 m reads as ground (the
  first bake made every cell unwalkable). All in PLAN.md section 14.
- Tests: 8 new (2 files for the charge and the brain, 1 for the level, and
  2 for the shield's front plates) plus the 5 stage 1 ones, 362 passed.
- Not checked by eye: the scrape and charge poses, the wall stun's long
  turn out, the stun's feel (0.4 s with the look free), the dust at the
  scrape (six orange chunks from `debris.burst`, the shared game's), the
  plate arc against the real F05 rig (its chest and brow sit on -z while
  +z is forward, so the arc uses yaw forward: Paul should look), the
  sounds, the Ring's look, and whether the 6 m ring corridor fights well
  with two Darters (no browser here).

### 2026-11-04: GAME-04 stage 2, the shield parry and bounce-back (Qwen 3.8-27B via Pi)

Card: `tasks/GAME-04b.md`, in the `game-04b` worktree. One commit
(`GAME-04b: ...`) when this is accepted; not merged or pushed yet. `npx tsc
--noEmit`, `npx vitest run` (50 files, 343 passed, 2 skipped) and `npm run
build` all pass. No em or en dashes in any touched file (checked with the
perl scan in CLAUDE.md).

What was built:
- `data/shield.json`: a `parry` block (window 0.25 s, speedShare 1.6, damage
  4, stagger 0: the thrower's own stagger time, steerSec 8, kick 0.035 rad
  over kickTime 0.15, hitStop 0.05 s at slow 0.15, flashTime 0.12 s,
  parryNextLead 0.1 s); the `_note` explains it too.
- `src/player/shield.ts`: `parryWindowScale` (set by the pages from the
  preset), `parries`, `parryWindow()`, `canParry()` (disc raised, fully up,
  and the raise younger than the window; the age resets when the disc
  drops), `parryKick`, `flash`, `noteParry()` and `slowed(dt)`; a private
  `raiseAge` and a bright flash disc over the viewmodel (white basic
  material, opacity driven by flashTime).
- `src/foamers/projectiles.ts`: the constructor takes the `FoamerSystem`;
  `LiveBall` grows `bounced`, `flatSpeed` and `steerLeft`; `bounce(b)` keeps
  the ball (no burst) and speeds it to 1.6x; `steerBounce` re-aims at the
  thrower's chest each step while steering runs, as a solved arc, and stops
  steering within 0.35 m so the ball flies straight in (at 14 m/s a re-aim
  that close would cross the target point and it would limit-cycle); a
  bounced ball's ray is the ordinary ball's ray with the Foamer parts added
  back in and the player's own capsule excluded by identity (that
  collider carries the world's group, so a group test cannot name it); a
  bounced ball can hit the thrower or another Foamer and burst on the
  world, but never the player; the
  hit goes through `FoamerSystem.parryDamage` (health, a damage `record`, a
  sound, `startStagger` for its data time, or the Foamer's own, the
  `finishWeakened` band, a go-down on depletion, never `pop`) and
  `onSound("parryHit", at)`; `stats.bounced` and `stats.parryHits`.
- The pages (`src/game/game.ts`, `src/range/main.ts`): `onHitPlayer` computes
  `blocked` and `parryable` (the shared `BALL_MATERIAL`) and, if both and
  `canParry()`, notes the parry, bounces the ball and plays SH-parry, no
  damage to the player; otherwise the block and the ball hit run as before.
  The difficulty multiplier is read like `director` (`DIFFICULTIES[s.difficulty]?.parryWindow ?? 1`).
  While a hit-stop is running the pages step the Foamer, the projectiles,
  the darts, the pieces, the pickups and the `step`/`afterPieces` hooks from
  `slowed(dt)`, the character, the shield and the world step from the real
  `dt`. The parry's kick is added to the camera's climb, same as the blast
  recoil and the block kick. `onSound("parryHit")` plays SH-parry-hit at the
  hit point. The watch: `state()` gains `parries`; the game page's
  `parryNext()` steps the simulation until the closest non-bounced ball is
  `parryLead` seconds from the eye, then force-holds the disc (so the
  raise lands inside the window); the range page's `parryNext()` simply
  returns true and force-holds the disc so long as a non-bounced ball is
  alive (its update loop is not callable from the watch, so the lead time
  is not applied; the disc's own window is what the ball lands inside).
- `data/difficulty.json` and `src/core/settings.ts`: `parryWindow` per
  preset (story 1.5, normal 1, hard 0.75, fury 0.6) and
  `DifficultyPreset.parryWindow: number`.
- `data/sounds.json` and `design/SOUNDS.md`: SH-parry (a click and a 320 to
  880 Hz sine twang, non-positioned) and SH-parry-hit (a low thud,
  positioned), code-made placeholders like the other SH- IDs.
- `tests/shield/parry.test.ts`, 4 tests: (a) with the disc up, a ball in the
  front arc inside the window is parried; after the same raise ages out of
  the window it is only blocked; (b) a ball from behind is outside the arc,
  so neither parried nor blocked; (c) the full bounce route with a real
  F02: the ball is parried by the page's substitute, comes back, hits its
  thrower (damage 4: health 8 to 4, does not kill), staggers it, and the
  player capsule is met exactly once (the parry itself, not the
  return flight, which the bounced ball's rays cannot count); (d) the difficulty multiplier: a raise aged 0.18 s
  is inside Story's 1.5x window and outside Foam Fury's 0.6x window, and
  `parryWindow()` narrows by the same factor. The bounce test `settle`s the
  Foamer's part meshes first, like the other Foamer tests: the part meshes
  are built asynchronously from the mesher's Promise, and a raycast that
  hasn't been settled can't see them (this is what took the bounce test so
  long to debug).

Not checked in a real browser (no browser here): the feel of the hit-stop
(0.05 s world-slowness), the kick and flash, the two placeholder sounds,
and whether a parried ball from a moving, re-targeting F02 finds its mark
(since steering gives it some room to work with). Also unchecked: whether
`parryNext()` on the range page is sharp enough for the automated checks.
Finished so far; the look of the disc is still from stage 1.

### 2026-11-04: GAME-05 and GAME-10a merged; arena HUD fix (Claude)

- Merged both after Paul's approval; only the docs conflicted.
- Found in the merge smoke test, live on main since GAME-07: the arena
  page had no `#finishprompt` or `#healflash`, so the shared HUD threw the
  first time a finisher was open or a health blob was picked up there.
  Both added to `arena.html`; `tests/game/pages.test.ts` checks every id
  the HUD looks up is on both pages.
- Smoke test on merged main: the Pit cleared end to end with both F02s
  in wave 2.

### 2026-11-04: GAME-10a review, Roamers played in the arena, merged (Claude)

- Played `arena.html?watch`: wave 2 is 3 F01 and 2 F02. The Roamers
  held at 5.5 to 8.4 m and cycled windup, throw and recover while the
  Slowmers closed in; balls were in the air during the throws. On the
  range an F02 spawns with health 8 and its own rig.
- Fixed: the attack damage map was keyed by attack id alone, so the F02's
  own "bonk" (10) replaced the F01's (12) for every Foamer. `damageOf`
  now reads the attacking Foamer's spec, with the base spec winning the
  fallback map. Test: `tests/game/attack.test.ts` (failed before).
- Noted by the Spark, not fixed: an F01 walking straight down the exact
  x = 0 grid line can stall (pre-existing, its tests avoid it); worth a
  bug card.
- Unverified by eye: the ball's look and glow, the throw pose (no throw
  motion in rig-states yet, the arm does not wind up visibly), the four
  sounds, and the range's type buttons by hand.

### 2026-11-04: GAME-10a, per-type Foamer specs and the F02 Roamer (Qwen 3.8 Flash Next via Pi)

Task card `tasks/GAME-10a.md`, branch `game-10a`, four commits: per-type
specs (`6eeda44`), the F02 brain (`5a79af7`), the foam ball (`0c6c34d`),
arena/range/watch wiring (`e0df30b`).

What was built:

- `data/foamers.json` is now a shared base (`test`, kept as the name) plus
  `types` overrides; `specFor(type)` merges and caches, and every `SPEC.`
  read in `src/foamers/foamers.ts` goes through the Foamer's own spec.
  `spawn(feet, facing?, type = "F01")`. The F01 tests pass unchanged.
- `src/ai/f02-brain.ts`: the ranged sibling of the F01 brain (approach to
  12 m, ring at 8 m, back off inside 5 m, throws with a `ranged` token).
  New `backOff` move intent in `src/ai/f01-brain.ts`; `FoamerAgent` carries
  either brain by a setup tag; the circle stride keeps the agent's own
  `holdRange`.
- `src/foamers/projectiles.ts`: kinematic raycast balls (9 m/s, light arc,
  from the ball hand at strike after the 0.6 s windup), one shared pink
  `BALL_MATERIAL` for the coming parry, one hit on the player, burst into
  foam chunks (`DebrisSystem.burst`), hard cap 8 live. Tuning in the base
  spec's `ball` block. A throw does not call `onBonk`; the ball's arrival
  does the damage through `damageOf("throw")` (attack table now merges the
  type attacks). The disc blocks a ball by its direction of travel: the
  handler asks `blocksAttackFrom(position - velocity dir * 0.5)`.
- Pit wave 2 = 3 F01 + 2 F02 (`data/levels/1-1-pit.json`); the rift spawn
  callback passes the file's id as the type; the range panel has a F01/F02
  type row for its spawn buttons and keep-alive spawner (`spawnType`); the
  watches list each Foamer's type and the live ball count.
- Sounds: placeholder IDs `F02-windup`, `F02-throw`, `FB-hit`, `FB-burst`
  with synth recipes in `data/sounds.json`, rows in `design/SOUNDS.md`
  (replacing the old F02-ball rows).

Decisions and rationale: PLAN section 14 (three GAME-10a rows, 2026-11-04).

Tests: 46 files, 331 passed, 2 skipped (`npx vitest run`); `npx tsc
--noEmit` and `npm run build` pass. New: `tests/ai/f02-brain.test.ts` (ring,
back off, token bids, ranged pool cap), `tests/foamers/projectiles.test.ts`
(flight speed, burst + chunks, one hit on the player, the cap, shared
material, a throw makes no bonk), F02 system tests in
`tests/ai/foamer-ai.test.ts` (keeps its ring and throws, backs off, F01
still bonks, health 8 and the F02 rig), and a ball-front-arc block test in
`tests/shield/block.test.ts`.

Not checked by eye (no browser here): the ball's look (size, the pink glow
strength of `BALL_MATERIAL`), the throw windup pose (rig-states has no
"throw" motion yet, so the windup is the generic one), the four sounds, the
wave 2 mix in the arena, the range type row. All need Paul's pass.

Notes for the reviewer:

- The ball ray excludes the exact `FOAMER_GROUPS` and `CAPSULE_GROUPS` (as
  darts and the disc do), or a ball bursts on its own thrower.
- Pre-existing, not from this card, found while writing the F02 system
tests: an F01 spawned exactly at x = 0 walking straight at a player at
x = 0 stalls at z ~= 0.37 (the character controller stops along that exact
line; nudging it cures and it never re-stalls there). New tests spawn off
that line. Worth a bug card.
- Flake seen twice during this card, both in `tests/ai/nav-grid.test.ts`
  ("bakes a 40 by 40 m floor in under 150 ms and paths across it in under
  2 ms"): a wall-clock perf assertion that fails when the machine is busy
  (other vitest runs in parallel). Passes on re-run; not timing-related to
  this card's code.

### 2026-11-04: GAME-05 review, charge played in watch mode, merged (Claude)

- Qwen 27b's first run spent 40 minutes reading, then hit its output
  limit inside one long think and wrote nothing; resumed with `pi -c` and
  a nudge to write in small steps, it finished in three commits.
- Played on `arena.html?watch`: with the disc up, a Slowmer at 17.9 m
  (past the 14 m range) gave no lock and dash was the normal dash; at
  12.6 m the lock ring showed, the charge rushed in, knocked it back about
  2 m, staggered it and took 2 of its 6 health.
- Fixed: the charge started the long, finishable stagger, so any charge
  opened an instant-kill finisher on a full-health Foamer. It is the
  short stagger now; the test checks it.
- Unverified: the rush's feel at 60 fps, the lock ring's size, the three
  placeholder sounds.

### 2026-11-04: GAME-05 shield charge (Qwen 3.8-27B via Pi)

- Built the charge in `src/player/shield.ts` (all numbers in the
  `charge` block of `data/shield.json`): with the disc up the shield
  locks the nearest Foamer in the crosshair's range and cone in sight
  of the player's eye, and a small ring marks it at the crosshair in
  the HUD. Dash with a target starts the charge (the press is spent
  here, before the player controller would dash): the player rushes at
  the lock through its own character controller, and on contact the
  Foamer is knocked back along the line, staggered and takes the data's
  small damage. A charge never kills (the same 0.0001 health floor as
  the throw). The cooldown (2 s) holds before the next one, the disc
  stays raised and blocks through it, and no finisher can start
  mid-charge (nor a charge during one).
- Sounds: `SH-lock` (the blip on the press), `SH-charge` (the whoosh on
  the first step), `SH-charge-hit` (the thud at the body), all from the
  placeholder IDs in `data/sounds.json`; see `design/SOUNDS.md` for
  takes.
- Watch helpers: `charge()` and a `charge` state `{locked, target,
  running}` in `state()` for `index.html?watch` and `arena.html?watch`.
- Tests: `tests/shield/charge.test.ts` (lock picks nearest in cone/range
  and ignores past, wide, hidden; no target is the normal dash; the hit
  stops short, knocks back, staggers, damages and holds the cooldown
  until it is spent; a wall ends the charge on the time limit without a
  hit, at rest). 318 passing, `tsc` and `build` clean, no em or en
  dashes.
- Unverified by eye (no browser here): the feel of the rush speed, the
  lock's cone against real view spread, the HUD ring's size and colour
  against the course background, the three placeholder sounds, and
  whether a charge that ends mid-flight still feels like a hit when
  the Foamer is knocked into a tight corner.

### 2026-11-03: GAME-04 stage 1 review, shield played in watch mode, merged (Claude)

- Played on `arena.html?watch`: the raised disc reads well (purple face,
  orange rim, low left, clear of the crosshair). Blocking a Slowmer's
  bonk from the front took 1.8 health against 12 with the disc down. A
  throw at three Slowmers left the arm, hit and staggered two of them
  (one twice, not in a row), flew home and lowered.
- Merged main (GAME-07) in. One stagger start now serves both: the
  Foamer system's `startStagger(f, long, seconds)` sets the stagger's
  length, and the shield calls it. Before, the shield wrote its own
  stagger time that never reset, so after one disc hit every later
  part-break stagger would have lasted the disc's stun. A disc stagger
  also opens a finisher (it is a stagger).
- Throw damage 4 to 1 in `data/shield.json`: 4 was two thirds of a
  Slowmer, and the card asks for a small damage.
- No shooting during a finisher holds with the shield too. The carve
  sound hook is set once, not every step.
- Unverified: feel at 60 fps (raise time, walk slow, kick), the
  placeholder sounds, the hold or toggle setting by hand, and that the
  flying disc (a plain orange ring) reads against arena walls.

### 2026-11-03: GAME-04 stage 1, the shield: block, movement gates, ricochet throw, return (Claude)

- `src/player/shield.ts` (new): one `Shield` class, all numbers in
  `data/shield.json` (new). States `lowered / raised / thrown / returning`;
  `update(dt, controls)` runs on the fixed step and returns the step's news
  (a reused events object: `raised, lowered, thrown, hits, caught`). The
  viewmodel (foam rim, face, boss from `createFoamMaterial`) hangs off the
  camera; the disc in flight is a scene mesh. `blocksAttackFrom` +
  `damageShare` for the block, `kick` for the view kick, `blocksFire` and
  `usedFirePress` for the blaster gate, `speedScale`/`allowSprint` written
  onto the controller each step, `forcedHold` for the range's watch helper.
- Blocking: `game.ts` and `range/main.ts` `onBonk` ask
  `shield.blocksAttackFrom(f.centre)` (raised, disc over halfway, inside
  the front arc from the view); a blocked bonk costs `damageShare`, plays
  `SH-block` at the attacker, and is not a hit (no HUD flash). The
  attacker's own logic is untouched.
- The throw (press fire while fully raised, not during a blaster switch):
  the disc flies from the left hand along the view at `throw.speed`,
  striking centres within `hitRadius` of the swept step, nearest first,
  `1 + bounces` hits, then home at `returnSpeed`, caught within
  `homeRange`, cooldown before the next throw. Each ricochet picks the
  nearest living Foamer in sight within `ricochetRange` (a clear ray from
  the disc to its middle), so it may strike one again with another
  between: the card's rule is never the same one twice in a row. It
  staggers (the Foamer's own `staggerTime`, new field; `stun` 0 in the
  data reuses it) and takes `damage` per hit but cannot kill: health
  floors at 0.0001 (the kill stays with darts and finishers). Voxel cover
  in the path carves a `carveRadius` crater (capped `debrisMax` chunks a
  flight) and turns it home.
- The disc's own rays treat a Foamer's movement capsule as neither cover
  nor sight block (exact-match `CAPSULE_GROUPS`, as darts do; plus
  excluding the two capsules either side of a ricochet): the disc leaves a
  struck body's capsule sitting inside it, and a ricochet's sight ray
  starts inside the one it just hit. Without this the disc threw itself
  home a step after every hit.
- Pages: both fixed steps call `shield.update` before the loadout and
  gate the blaster with `canFire`; `camera.rotation` adds `shield.kick`
  with the blaster's climb; restart hooks call `shield.reset()`. The range
  watch gets `block(on)` and `throwShield()`. Settings get "Shield:
  toggle, not hold" (`shieldMode`), and `data/sounds.json` gains the five
  `SH-*` placeholder sounds (SOUNDS.md updated).
- Tests: `tests/shield/block.test.ts` (front reduced, rear full, arc
  edge, walk speed, sprint off, raise time) and `throw.test.ts` (hit
  count, order, no repeat in a row, stagger damage, block again after a
  catch, cooldown, wall carve, range turn, sight behind cover) on a real
  Rapier world with real Foamers and voxel walls. `tsc`, `vitest` (302
  pass) and `build` pass.
- Not checked by eye (no browser here): the disc's look and placement
  (size, rim/face/boss proportions, hand offset), raise/lower feel,
  the kick feel, the `SH-*` placeholder sounds, toggle in the Settings
  panel, and that the disc reads well against arena walls in flight.
- Decisions in PLAN section 14; the GAME-04 row says stage 1 done, parry
  stage 2 waits for GAME-10.

### 2026-11-03: GAME-07 review, finisher played in watch mode, merged (Claude)

- Played on `index.html?watch`: shot a Slowmer to the weakened stagger,
  walked up, the F prompt showed, the finisher held the view, squeezed
  and popped it, and the three health blobs drifted in and healed 60 to
  90.
- Fixed: a dart burst that popped the target mid-finisher made the
  finisher pop it again on bodies already freed, which crashed Rapier
  ("recursive use of an object"). The finisher now stands down when its
  target has left the finish state, and the blaster cannot fire while a
  finisher holds the player. Test 5.
- Fixed: the view cone (cos 0.98) was measured to the chest, so at 1.5 m
  looking at the head (18 degrees above the chest) gave no finisher. It
  is now measured to the Foamer's upright line at the height the view
  crosses it. Test 6.
- Not decided: the player is not protected during the 0.8 s finisher, so
  another Foamer can still bonk. The modern Doom games make the player
  safe during a finisher; worth a call by Paul.

### 2026-11-03: GAME-07 the Pop finisher and the health drops (Qwen3.8-27B via Pi)

- **The weakened stagger** (`src/foamers/`). A hit that pushes a live
  Foamer to or below `finisher.weakenShare` (0.3) of its max health
  marks it `finishWeakened` and gives it the long, finishable stagger
  (`finisher.weakenStaggerTime`, 2.5 s); the normal part-break stagger
  stays short, and the mark is set once and never re-set, so a wound
  while finishable does not restart the clock. While finishable and
  staggering, the Foamer glowes and wobbles: the glow is an additive
  soft shell on its own world-space group, because the shared foam
  material is one mesh material and cannot pulse per Foamer, and the
  part-group matrices are world matrices so it cannot sit under the
  Foamer's group (`Foamer.glow`, `Foamer.glowGroup`, `syncGlow`).
- **The finisher** (`src/game/finisher.ts`, `finisher.*` tuning in
  `data/foamers.json`): a melee on a finishing-enough stagger within
  reach (2.5 m, eye to chest) inside the view cone (cos 0.98) holds the
  player for 0.8 s, turns the view onto the Foamer, squeezes and
  stretches it (the new `finish` state and `finishMotion`), then pops
  it on schedule. `Finisher.attempt` is the pure geometry; `has` gates
  the HUD prompt; `update` owns the view turn and the pop. The melee
  key is consumed when the finisher spends it (`Input.consumePress`),
  so the course's debug blast does not fire on the same press; a melee
  with no finishable in reach keeps the page's old behaviour.
- **The health drops** (`src/pickups/pickups.ts`, a new generic pickup
  with `data/pickups.json`; health is the first kind, ammo comes at
  D08). A pop sprays 3 cream blobs of 10 health; they hop out, settle
  and bob, are collected walking within 1 m (drifted to the player
  within 2 m), heal back to max but never past it, stay on the floor
  at full health, cap at 24 live (oldest first) and dissolve after
  30 s. The blobs carry their own colliders with the world and are
  ignored by darts and by the player capsule.
- **Shared wiring** (`src/game/game.ts`, not the pages): builds the
  `PickupSystem` and `Finisher` on the Game, runs the finisher in place
  of the player update while it is active, steps the pickups after
  `world.step()`, renders and runs the HUD prompt and the green heal
  flash (green, so it never reads as a hit). The course and arena reset
  paths clear the blobs alongside the Foamers. `input.simulatePress`
  backs the watch's `finish`; the watch also reports pickup counts and
  a per-Foamer finishable flag.
- **Sounds**: `FX-stagger` (the weakened stagger), `FN-finisher` (the
  squeeze) and `PU-health` (the collect) are synthesised placeholders
  in `data/sounds.json`; the lines were already in `design/SOUNDS.md`.
- Tests: `tests/foamers/finisher.test.ts` (the crossing hit staggers
  long, once, and holds beyond the short stagger; the part break keeps
  its short stagger; the reach and cone gate the attempt; the full run
  turns the view, pops on schedule and sprays blobs that settle on the
  floor) and the existing `tests/pickups/pickups.test.ts`. `npx tsc
  --noEmit`, `npx vitest run` and `npm run build` all pass; no em or
  en dashes in any touched file.
- Not checked by eye (no browser here): the glow's colour and shape,
  the wobble amount, the finisher prompt's size and position, the heal
  flash, the squeeze-stretch-pop by hand, the pickup look, and the 60
  fps cost of the glow and the blobs on mid-range hardware.

### 2026-11-03: darts pass Foamer capsules, and aim at what the crosshair is on (Claude)

- `CAPSULE_GROUPS` (`src/physics/world.ts`): a live Foamer's movement
  capsule, upright and lying, is a world member as before plus a capsule
  bit, and darts skip it by exact match (like ragdolls). Nothing draws the
  capsule, and between the legs and arms a dart could stop on it and do no
  damage. Test: `tests/foamers/dart-capsule.test.ts`, a fan of 56 darts at
  a standing Slowmer; 1 stopped on the capsule before, 0 after.
- `updateAim` (`src/weapons/aim.ts`): the shot used to converge on a point
  50 m down the view, so from the muzzle (below and right of the eye) a
  dart landed about 0.2 m low and right at 4 to 10 m. It now aims at the
  first solid thing under the crosshair (past capsules, at least 2 m, at
  most 50 m). Test: `tests/weapons/aim.test.ts` (0.23 m off before).
- Arena, same scripted fight on both builds: main cleared both waves in
  26 shots, this branch in 22.
- Watch-mode lesson: Foamer part colliders come from the mesher worker,
  whose results land only between JavaScript tasks. A console script that
  steps in one long synchronous loop never gets them, so darts pass
  through every Foamer. Scripts must yield (await a setTimeout) between
  steps after a spawn. That, not the capsule, caused the "every shot hits
  the capsule" reading in the ENG-13 review.
- Unverified by hand: how the aim feels at 60 fps, close to walls and
  over cover edges (the dart now leaves the muzzle toward the crosshair
  point, so a lip in front of the muzzle can still catch it).

### 2026-11-03: ENG-13 reviewed and merged (Claude)

- Merged after Paul's approval. The shared step keeps the old order; the
  same arena script on main and on eng-13 gave identical Foamer positions
  step for step, and `index.html?watch` spawns, walks and takes a hit.
- Found in review: darts sometimes stopped on a Foamer's movement capsule.
  The first measurement (every shot on the capsule) was a watch-mode
  artifact, see the capsule fix entry above; the real effect is smaller.

### 2026-11-03: ENG-13, one shared game module for the playable pages (DeepSeek via Pi)

- `src/main.ts` and `src/arena/main.ts` were near copies (501 and 537
  lines). Everything both pages did is now `src/game/game.ts`:
  `createGame` takes a page's `build`, its hooks and its scene options,
  and owns renderer, physics, input, player, health, settings store and
  panels, HUD, loadout, darts, impacts, carving, debris, falling pieces,
  Foamers on the level AI, sound, the fixed step, render and the loop.
  `src/game/ui.ts` holds the pause menu, settings and popped screen;
  `src/game/audio.ts` holds the engine start and its volume and pause
  wiring.
- Page code moved to `src/course/extras.ts` (throwable foam blocks, the
  melee debug blast, the pop burst, the course respawn) and
  `src/arena/extras.ts` (level build, the lock-in runner, rifts, exit
  pad, banner, checkpoint restart, the `dartArena` watch fields). Each
  page file is now its geometry and a call: `src/main.ts` 112 lines,
  `src/arena/main.ts` 50 lines.
- The step and render order is unchanged and lives in one place now:
  health, player, Foamers, the page step hook, blaster and aim, sounds,
  debris, pieces, the page's after-pieces hook, darts, the page's
  before-world hook, `world.step`, the page's after-world hook. Render:
  debris, pieces, Foamers, page render hook, camera, viewmodel, HUD,
  page late hook, darts, listener, draw.
- `index.html?watch` now exists alongside the arena's, with one shared
  set of console helpers (`state`, `moveTo`, `look`, `aimNearest`,
  `fire`, `step`, `pause`); each page adds its own fields to `state()`.
- Not verified here: the pages have not been run in a browser. The
  checks are tsc, the 289 unit tests and the build. The arena's two
  waves and the course's Foamer spawns still want a watch-mode pass.
### 2026-11-03: LVL-01 review, played through in watch mode, merged (Claude)

- Played `arena.html?watch` end to end by stepping by hand: the doors
  lock on entering the pit, wave 1 (3 Slowmers) comes from the two north
  rifts, wave 2 (5) from all three once wave 1 is down, both doors open
  on clear, and the exit pad shows Level complete. Try again restarts at
  the pit entry with the arena reset.
- Fixed: Try again kept the ammo left at the pop, and there are no
  pickups yet, so a retry could be unwinnable; the checkpoint now resets
  every blaster to its starting magazine and reserve. Added
  `dartArena.aimNearest()` for review (points at the nearest standing
  Foamer's body).
- Not a bug, but worth knowing: at 13 m the pump's spread and dart drop
  miss a Slowmer more often than they hit; up close it goes down fast.
- `src/arena/main.ts` is still mostly a copy of `src/main.ts` (only the
  attack damage and carve bounds moved to `src/game/`). Fine for one
  arena; fold the shared wiring into `src/game/` before a second page.
- Pre-existing (UI-01, same on index.html): the title overlay shows
  through behind "You popped!".
- Unverified: frame cost of the pit at 60 fps, how the pit looks and
  reads by eye (it is all greybox), and the lock-in banner timing.

### 2026-11-03: LVL-01 the first arena (DeepSeek via Pi)

- Built in three stages, one commit each: `be844ca` format, validator,
  builder and the Pit file; `b0a88f3` arena lock-in and waves; `20993b5`
  the arena page.
- `src/level/format.ts` types the subset of BLOCKOUT.md LVL-01 uses;
  `validate.ts` implements rules 1 to 6 and 9 to 12 as pure data checks
  (no Three.js, so Node tests run them) and returns errors plus warnings;
  `build.ts` builds the shell with fixed colliders, ramps as rotated
  slabs on a real slope, one voxel volume for every piece with a bedrock
  row under each anchor, and doors whose mesh and collider switch off
  together.
- `data/levels/1-1-pit.json` is the Pit from LEVEL-1-1 4: start room,
  12 m corridor, 34 x 26 m pit floor 4 m below the entry ring, two ramps,
  the centre block (3 volumes) and two pillars, three rifts, the lock
  trigger plus entry door and exit door, and a lit exit pad. It validates
  with one warning (5 piece volumes, close to the KIT cap of 6).
- `src/level/arena.ts` is the lock-in state machine: waiting, locked,
  waves with `delaySeconds` between them and `holdSeconds` between
  spawns, cleared opens `unlockOnClear`. Twelve tests drive it with a
  fake Foamer count; the spawn cap retries rather than dropping a spawn.
- `arena.html` plays the level with the full game. Shared code moved to
  `src/game/` (`attack.ts`, `shared.ts`) so `index.html` and
  `range.html` use the same damage table and carve bounds; the test
  course otherwise behaves as before (only `createRenderer` gained
  options, with the old values as defaults).
- HUD banners: "Clear the arena" on lock, "Wave n of m", "Arena clear".
  Rifts are dim seams before the lock and glow while a wave comes out.
  The exit pad shows Level complete with Play again. Six placeholder
  sounds were added to `data/sounds.json` (LV-door, LV-arena-lock,
  LV-rift-open, LV-wave, LV-arena-clear, LV-exit); all were already in
  `design/SOUNDS.md`, so no doc change was needed.
- `arena.html?watch` starts unpaused without pointer lock and
  `window.dartArena` has `state()`, `moveTo`, `look`, `pause`, `fire()`
  and `step(n)`.
- Decisions (also in PLAN.md 14): doors may overlap a shell wall, since
  the format has no doorway field; the arena voxel budget counts the
  trigger, doors and rifts grown by 4 m; the arena page owns its spawns
  with `spawnCount = 0`; a popped player restarts at `checkpointPos` with
  the arena reset but carved voxels left as they are; `checkpointPos` was
  added to BLOCKOUT.md with a line saying why.
- Unverified: the card's end-to-end check (walk in, both waves, exit
  opens, pad completes) was not run in a browser, because there is no
  Chrome, Playwright or Puppeteer on this machine. The frame cost of the
  Pit (voxel volume, nav bake, six waves of Foamers) was not measured
  against the test course, so the card's frame budget question is still
  open. The nav bake at load is asserted under 1 s in
  `tests/level/pit-load.test.ts`, but no real frame graph exists yet.
  Paul has not seen the Pit's look; everything visual is greybox.
- Small fixes found while wiring the page: the south doorway stood over
  a 1 m gap in the floor (a sill box was added), and the arena's
  `state.cleared` / `progress` used the wrong index.

### 2026-11-03: LVL-00 reviewed and merged (Claude)

- Merged after Paul's approval. Review fixes: an arena's way on is across
  the room from the way in (README contradicted itself), one alive cap of
  12 at Normal in every file, and Boss 1's weak points made consistent
  (two launchers and the back tank; the crown is the last target).
- Open for Paul: the 1-2 blaster clash (level table B02, D04 answer the
  Shredder), 1-2's Crossroads exception to pillar 2, act settings and
  accent colours, and the BOSS 1 working name "Foam Demon" against the no
  demonic imagery rule. Not yet good: the 1-1 map is a schematic stack,
  and Boss 1 phase 3 (charge the knee in a 1 s window, then mantle) may be
  too fiddly for 10+.

### 2026-11-03: LVL-00 level design concepts (DeepSeek via Pi, review)

- New `design/levels/`: `README.md` (pillars with checks, the 10 beat
  rhythm for a 17 to 19 minute level, where secrets, stations, placed
  ammo, blaster pickups and rifts sit, 10 wayfinding rules), `KIT.md`
  (the player ruler from `data/player.json`, 8 arena archetypes with
  ASCII sketches and metre sizes, 9 connectors, 6 secret types, the
  destructible piece table with 3.2 m voxel-zone limits from
  `data/destruction.json`, and the arena budgets from `data/ai.json`),
  `LEVEL-1-1.md` to `LEVEL-1-4.md`, `BOSS-1.md`, `ACTS-2-3.md` and
  `BLOCKOUT.md` (JSON proposal only, one worked arena, no loader code).
- Bucket limits the concepts respect: a destructible zone is 3.2 x 3.2 x
  3.2 m (32 voxels of 0.1 m), 6 zones per arena, 12 Foamers alive,
  arena footprint 44 x 36 m so the nav grid and the 2 melee tokens hold.
- Decisions: PLAN 9 direction line added (semi-open linear, Paul) and a
  section 14 row dated 2026-11-03. LVL-00 row added to the Phase 2 table
  above LVL-01.
- Proposed, needs Paul: every place name, act setting and boss look
  ([Paul] left in each file); the act accent colour; whether 1-3 gets a
  blaster (table 2 is blank there, `LEVEL-1-3.md` section 8 argues for
  none); the 1-2 blaster order clash between CONTENT-PLAN table 2 (B02)
  and D04 (Shredder); whether A7 in 1-2 is allowed to make the way on
  the way back.
- Unverified: none of the metrics are playtested. The boss plinth and
  its 2 m shield-charge reach (BOSS-1 section 8), and the Swarmer
  debris load (LEVEL-1-3 section 7) are the first things to check in a
  blockout. `npx tsc --noEmit` and `npx vitest run` pass; no game code
  or data changed.

### 2026-11-03: ART-03 reviewed and merged (Claude)

- Round 3 left the Slowmer's pupils as a 1 by 2 strip at one side of each
  eye, cut by the top of the head: the eye centres fell between voxels and
  sat too high on the 11 voxel head. `buildPartVolume` now snaps round eye
  centres to a voxel (only F01 has round eyes; the others are unchanged), and a new `eyeHeight` part field (fraction of the part's
  height; default 0.22 round, 0.12 others) moves them. F01 uses 0.12 at
  scale 1: two 3 by 3 eyes, one centred pupil each, a lime gap between.
  F02 and F05 re-rendered and checked; the Darter crown is clean.
- Unverified: the Slowmer eyes are small at 11 voxels; bigger eyes would
  need a bigger head, which changes its hit volume. Two eye white voxels
  show on the crown from behind.

### 2026-11-03: ART-03 round 3 face fixes (Kimi via Pi)

- Slowmer now has two separate cream eyes with centred 2 x 2 ink pupils, and Darter's lowered brow leaves no lime sliver on its crown. Re-rendered and checked all three sheets; all 174 active tests, TypeScript checking and the production build pass.

### 2026-11-03: ART-03 round 2 review fixes (Kimi via Pi)

- Fixed turnaround raster cracks by overlapping projected faces and sampling
  pixel centres explicitly. Uniform face shading removes the remaining false
  streaks from exposed voxel rows.
- Slowmer keeps every original gameplay part box and combat behaviour. Big
  round cream eyes, a separate grin, head nubs and light body-shag paint give
  it the requested foam-zombie look. `eyeScale` and `shag` change paint only;
  body nubs and mixed-material shag were rejected because they broke hits.
- Roamer now holds its ball at shoulder height with a raised forearm, and has
  angry cream eyes above a separate ink grin.
- Darter has one curved chest plate and one curved brow plate fitted into the
  body, with no floating slabs or overhang. Its gape and orange back remain.
- Re-rendered and visually checked all 12 views. All 174 active tests,
  TypeScript checking and the production build pass. Paul's visual approval
  and in-game framing remain unverified.

### 2026-11-03: ART-03 Slowmer, Roamer and Darter (Kimi via Pi)

- Added the light and deep purple, orange and lime palette materials and
  rebuilt F01, F02 and F05 to their CONTENT-PLAN silhouettes and colours.
- Added `tools/render-rig.ts`: real rig volumes and rest poses become four
  orthographic PNG views and a labelled sheet, with no new dependencies.
- Slowmer keeps its original part sizes and combat volumes. Longer arms and
  body nubs broke existing hit and ragdoll tests, so its shaggy nubs are on
  the head. Darter has split front armour, a rear orange weak point and a
  paint-only `gapeScale` option for a readable mouth.
- Added palette, F01 gameplay-contract and deterministic-PNG tests. All
  172 active tests and TypeScript checking pass; final sheets were checked
  visually. Paul's approval and in-game framing remain unverified.

### 2026-11-03: ENG-08, QA-watch and QA-flaky merged (Claude)

- Merged `eng-08`, `qa-watch` and `qa-flaky` into main after Paul's
  approval. HANDOFF conflicts only, both sides kept. 240 tests pass, build
  clean.
- Still unverified by eye at 60 fps: the prone attack (head rises to about
  standing height in the windup) and the feel of the hold circle.

### 2026-11-03: QA-flaky test 7 was seeded (Qwen3.8-27B via Pi)

- `tests/foamers/foamers.test.ts` test 7 (a burst kills and pops it) failed
  once under heavy machine load. Cause: the carved debris chunks are kicked
  with `Math.random` (`src/voxel/debris.ts` chunk speeds, directions and
  spin). A chunk can rebound into the dart flight path, so which of the
  dying round's darts hit the Foamer versus a chunk varied with the
  process's random state at that moment. When the killing darts landed on
  chunks or carved ground, the round dealt less than the catastrophic
  share (0.4 x max health in 0.1 s), so the Foamer went down instead of
  popping and the test's `popped === 1` failed. Game code is correct (the
  burst window is exact and the damage is what the game intends); the test
  depended on randomness it never seeded.
- Reproduced with a seeded copy that swapped `Math.random` for an LCG:
  2 of 80 seeds failed (downed instead of popped, health 0, popped 0).
- Fixed in the test only: test 7 now wraps the fight loop in a seeded
  `Math.random` (seed 0x1bdcb3d2) and restores the process random after.
  No step, timing or wall-clock dependence remains: steps are fixed
  `DT = 1/60` and the loop is deterministic.
- Verified: 25 runs of the file alone and several full-suite runs under
  extra load, all green; `npx tsc --noEmit` and `npm test` pass.

### 2026-11-03: QA-watch, range watch mode for the in-app browser (Qwen3.8-27B via Pi)

`range.html?watch` starts the range unpaused without pointer lock, which
the reviewer's automated in-app browser cannot take. The overlay is
hidden, the HUD shows and the sim steps as when playing; Esc and pointer
lock work as before when `?watch` is absent (same code path, no other
page or module changed).

In watch mode only, `window.dartRange` holds plain console functions that
reuse the panel's own handlers: `spawn(distanceMetres)`, `breakLeg()`,
`look(yawRadians, pitchRadians)` (sets the player's yaw and pitch, the
render step points the camera), `moveTo(x, z)` (teleport on the floor
grid), `pause(on)` and `state()` (each Foamer's state, health, feet
position and attached part ids). Unverified: whether the in-app browser
calls them and reads `state()` back as the reviewer expects.

### 2026-11-03: ENG-08 review, seen on the range (Claude)

- Watched on the range in watch mode (QA-watch branch, stepped by hand
  because a hidden browser pane gets no animation frames): a range spawn
  stands idle, sees the player at 8 m, alerts, approaches, takes a token at
  the hold ring, winds up, strikes and recovers; with a leg broken it falls
  in under 0.9 s, crawls and attacks from the ground.
- Fixed in review: line of sight was always blocked (the ray started inside
  the Foamer's own capsule and part boxes and ended inside the player's
  capsule), so no Foamer ever saw the player; new `SIGHT_QUERY_GROUPS`, the
  own capsule excluded, `sightEndMarginMetres` in `data/ai.json`, and a test
  on the real system. An approach without a token no longer bids, and a
  falling Foamer no longer bids until it is crawling.
- Unverified: how the prone attack looks (the head rises to about standing
  height in the windup) and the feel of the hold circle, by eye at 60 fps.
- `tests/ai/nav-grid.test.ts` timing test still fails now and then under
  load (wall clock); not touched.

### 2026-11-03: ENG-08 stage 3b (DeepSeek V4.1 Flash)

The Foamer brain on the director and the nav grid. Stage 3a built the pure
logic; this is the wiring into `src/foamers/` now that GAME-11 has merged,
plus the two pages and the range overlay.

- `data/foamers.json`: both test attacks (bonk, headbutt) declare
  `"token": "melee"`. The rig's pool is read from the attacks when a Foamer
  spawns, so a ranged rig will draw from the ranged pool with no code change.
- `src/ai/agent.ts`: one class per Foamer, `FoamerAgent`, holding the brain,
  its context, the token bid and one reused path. `bid` and `step` are split
  so every agent bids before `Director.update` resolves the bids (the best
  bid wins, not the first caller), then reads the answer back. `navigate`
  re-paths on `repathSeconds`, when `grid.version` changed (a carve or a
  rest re-bake), or when the player moved more than 0.5 m. Nothing from
  Three.js or Rapier is imported.
- `src/ai/level.ts`: `makeLevelAI(rapier, world, bounds, difficulty)` builds
  one director and one grid per level, with `carveChanged` and `pieceRested`
  re-bake helpers. The director's difficulty comes from the settings preset's
  `director` key (`DIFFICULTIES[...].director` in `data/difficulty.json`),
  so a preset that should feel harder can cap more tokens.
- `src/foamers/foamers.ts`: each Foamer gets an agent at spawn, with its
  first state from `spawnState` (arena alert, range idle). The brain runs
  before the state machine each step and owns idle, alert, approach and hold;
  windup, strike, recover, stagger, fall, crawl and down stay in the Foamer.
  An attack needs a token; the token is released on attack end, on stagger,
  on fall, and forgotten on down. Approach follows the grid path with
  separation steering; hold strides along the ring at `holdRange`. A crawl
  follows the same path at crawl speed. Line of sight is a ray from chest to
  player, with debris and ragdoll bodies excluded. Being shot wakes it
  (`tookDamage`), and an idle Foamer picks up a neighbour's alert inside
  `alertRadius`.
- `src/voxel/pieces.ts`: `onRest(centre, radius)` fires once when a fallen
  piece sleeps, so the grid can re-bake under it.
- `src/main.ts` and `src/range/main.ts`: one `makeLevelAI` each, assigned to
  the Foamer system; main bakes over the course and starts spawns alert, the
  range bakes over its floor and starts spawns idle so the sight test can be
  watched. Carves and resting pieces re-bake their patch in both.
- Range: a Nav grid switch draws the walkable cells as one InstancedMesh
  (built when first switched on, cells tinted by height) and each Foamer's
  path as a line; the report gains the director's `stats()` (melee and
  ranged tokens in use, and how many are waiting).
- Tests: `tests/ai/foamer-ai.test.ts`, two real-physics tests: an F01 behind
  a wall with one far gap reaches the player, and 4 F01s on the player never
  have more than the normal melee token count attacking at once while the
  director never issues more than its cap.

Decisions. A Foamer with no director keeps the pre-brain behaviour (walk in,
attack in range). That is deliberate: the older Foamer tests and the debug
tools spawn without one, and it keeps the change surgical. `NavGrid.findPath`
gained a fallback for an agent standing in a cell the bake calls unwalkable
(pressed against a wall): it paths from the nearest walkable cell on its own
level. Without that a Foamer that walked into a wall stood still for ever.

Still unverified. The overlay is not checked by eye in the browser, and the
bake over the main course's bounds (x -20 to 70) has not been timed there;
the stage 2 measurement was 70 ms for 40 by 40 m at 0.25 m cells. The arena
alert spawn means the main page starts with Foamers already closing in, which
is new behaviour and has not been played.

Review (same day, after the stage 3b review). One real bug: tokens were never
given back, because the release on attack end and on stagger was only
promised and never called, and every living Foamer bid every step, so the
first Foamers to win a token kept it for good. Now `FoamerAgent.ask` bids
only while it wants one (hold, a crawl in reach, an attack in progress, or an
approach carrying the token it won) and calls `director.release` otherwise,
which frees a stale bid too; `recover` end releases `attackEnd` and a stagger
releases `stagger`. `nextAgentId` uses `aiData.maxAgents` and returns -1 when
all are taken, so that Foamer spawns without an agent instead of sharing id
0. `navigate` reuses two scratch points. The circle's 0.5, 0.6 and 0.15 are
now `circleRampMetres`, `circleStrafeShare` and `circleDeadbandMetres` in
`data/ai.json`. Two more real-physics tests: 4 F01s all attack within 20 s of
sim time, and an idle F01 out of sight holds no token.

### 2026-11-03: ENG-08 stage 3a (DeepSeek V4.1 Flash)

The parts of stage 3 that do not touch the Foamer code, so it could land
while GAME-11 rewrites `src/foamers/`:

- `src/ai/brain.ts`: a small state machine base. States are a string union
  given as a type parameter, each with optional `enter`, `update`, `exit`
  hooks over a caller context, `stateTime` (reset on every transition) and a
  fixed-size transition ring the tests read (`logLength`, `logAt`, `log`,
  `statesEntered`). A state that returns itself is not a transition, so
  nothing is logged for standing still. The hooks get `(dt, stateTime, ctx)`
  so they never have to read `brain.stateTime` back.
- `src/ai/f01-brain.ts`: idle, alert, approach and hold as pure functions
  (`decideF01`) over a five field input struct plus attack range and
  `holdRange`, returning the wanted state and a movement intent (`stand`,
  `followPath`, `circleLeft`, `circleRight`). `makeF01Brain` wires the four
  states onto the base machine; `makeF01Context` makes the one allocation per
  Foamer. `updateToken` and `releaseToken` talk to the stage 1 director.
  Nothing from `src/foamers/` is imported.
- `data/ai.json`: the `brain` block with sightRange 20, alertRadius 8,
  alertTime 0.4, repath 0.5 and holdRange 2.2, each explained in the `_note`.
  `repathSeconds` is data only in 3a: the brain has no path yet, so the
  Foamer side schedules re-paths in 3b.
- `tests/ai/brain.test.ts`, 17 tests: the state machine base (time, enter and
  exit, the ring wrapping); idle stays idle when the player is out of sight
  and goes alert when shot or when a neighbour alerts; alert holds for the
  telegraph then approaches; approach follows a path and asks for a token in
  reach only; without a token it goes to hold, circles (odd ids the other way
  so two Foamers do not mirror) and asks again every step; hold ends on a
  token or when the player walks away; token scores put a closer agent ahead
  and let a waiting one catch up; `down` forgets a token at once, attack end
  releases it; 4 simulated F01s on the player never exceed the 2 normal
  melee tokens attacking at once over 10 s, and every one attacks at least
  once in 20 s.

Decisions. Hold and circle live in the brain, not in the Foamer, so the
"never attack without a token" rule is testable without a physics world. The
brain never leaves `idle` for anything but `alert`: the log check asserts a
real brain driven at point blank distance only ever logs `idle` to `alert`.
`down` calls `Director.forget` rather than `release`, because down is terminal
and the cooldown would otherwise look like a stall to the next Foamer.

Still unverified. The card's "an F01 behind a wall walks round it" test waits
for stage 3b, where the Foamer owns position, path and the nav grid; nothing
here observes a real Foamer, so the walk round a wall is not tested yet.
Attack range (1.3 m from `data/foamers.json`) is passed in by the caller and
is not yet read from the rig; 3b wires it. Stages 3b and the range overlay
(the Nav grid switch, the per Foamer path lines, the director `stats()` in
the report) are still to do after GAME-11 merges.

Review fixes (same entry): approach without a token now hands over to hold at
`holdRange` instead of `attackRange`, and hold only returns to approach on a
token or once the player is past `holdRange + holdExitMarginMetres` (new data
value, 1.0 m), so a tokenless Foamer settles at 2.2 m instead of walking in
and being told to hold and approach on alternate steps. With a token,
approach walks to `attackRange` and stands. `tokenScore`'s three weights moved
to `data/ai.json` brain (`tokenMinDistanceMetres` 0.5, `tokenSightScore` 1,
`tokenWaitPerSecond` 0.5, each in the `_note`) and are read from `BRAIN`. New
test: a tokenless agent whose distance follows its own intent enters hold
once and stays for 5 s (one transition, no flapping).

### 2026-11-03: ENG-08 stage 2 (DeepSeek V4.1 Flash)

Grid navigation and steering: `src/ai/nav-grid.ts`, `src/ai/steer.ts`, the
`nav` and `steer` blocks in `data/ai.json`, 18 tests in
`tests/ai/nav-grid.test.ts` and `tests/ai/steer.test.ts`. Pure numbers and
typed arrays; Three.js is not imported.

`NavGrid` bakes a rectangle of the level into a 0.25 m grid: a downward ray
from 8 m finds the ground, the hit normal rejects slopes over 40 degrees,
and an agent sized capsule (0.35 m radius, 1.6 m tall) standing on that
ground must hit nothing. Ground height and a walkable flag live in two
typed arrays. `rebake(minX, minZ, maxX, maxZ)` redoes only the cells in
that rectangle plus one agent radius around it, for `impacts.onCarve` and
for a falling piece that rests. `findPath(from, to, out)` is A* on
8-connected cells with no corner cutting and a 0.45 m step limit between
neighbours, string pulled to the fewest waypoints, writing into caller
owned arrays: no allocation per query after the first. An unwalkable or
walled off goal paths to the reachable cell nearest it. `steer` seeks the
next waypoint, eases to a stop inside `arriveRadius` 0.6 m of the last one,
and pushes away from neighbours nearer than `separation` 0.9 m.

Measured in the test runner: bake of a 40 by 40 m floor 27.8 ms, path
query across it 1.1 ms with 4 waypoints (targets under 150 ms and under
2 ms).

Decisions and why (PLAN.md 14, row of 2026-11-03):
- A walkable grid, not a recast navmesh. The level is destructible, so a
  navmesh would need re-baking around every carve, which is the cost 4.3
  exists to avoid. A grid re-bakes a small rectangle instead, needs no new
  dependency, and is plain typed arrays.
- Cells are test baked from the physics world, not from the voxel data:
  pieces that have fallen, ramps and the level all come out the same way,
  and there is one source of truth for what is solid.
- Kinematic bodies are skipped in the bake. The player and Foamers are
  kinematic, so nobody steers around an agent that is steering; pieces
  (dynamic) and the level (fixed) are found.
- The standing shape is lifted by `maxStep` before the shape cast. Without
  that lift every 0.45 m step reads as a wall, because the capsule's lower
  half is inside the step. With it, a step the character controller walks
  up passes and a 1 m ledge still fails.
- A* uses an indexed heap with decrease-key, one entry per open cell.
  Lazy duplicate insertion overflowed the fixed heap on a long search.
- The goal that cannot be reached falls back to a second A* that may end
  anywhere and keeps the cell nearest the goal. Picking the nearest
  walkable cell first is wrong: it can be an isolated pocket under a ramp.

Two things to know when wiring this in stage 3:
- Rapier's query pipeline only updates on `world.step()`. A bake or rebake
  straight after adding or removing a collider queries the old world, so
  the game must rebake after the step that applies the change (or call the
  query pipeline update). The tests step before every bake.
- A wall's own top is stand-able ground, so its cells are walkable; what
  stops a path climbing a 2 m wall is the step limit, not the flag. The
  tests assert paths and ground heights rather than the flag for that
  reason.

Unverified: nothing in the game calls the grid or steering yet (stage 3
wires them into the Foamer loop). Bake cost on the real 40 by 40 m course
with its voxel wall and towers is not measured; the 27.8 ms above is a
plain floor in the test runner. The rebake cost per carve is not measured
either, only reasoned about. Grid resolution 0.25 m is from the card and
has not been tuned against a 0.35 m agent walking through the course.

### 2026-11-02: ENG-08 stage 1 (DeepSeek V4.1 Flash)

The AI director: `src/ai/director.ts` plus `data/ai.json`, 8 tests in
`tests/ai/director.test.ts`. Pure TypeScript, no Three.js or Rapier.
Attack tokens by kind (`melee`, `ranged`), 1/2/3/4 of each for story /
normal / hard / fury, default `normal`, `tokenCooldown` 0.4 s and
`maxAgents` 64. `request(agentId, kind, score)` records a bid and returns
true once the agent holds a token, `release` returns it, `forget` drops a
dead agent's bid and its token at once, `update(dt)` runs the cooldowns and
then grants free tokens, `stats()` reports tokens in use per kind and
agents waiting. Fixed-size typed arrays: no allocation per call.

Decisions and why:
- Bids are resolved in `update`, highest score first, not inside
`request`. If `request` granted on the spot, the first caller in a frame
would always beat a higher score later in the same frame, and every Foamer
would need an update order in `main.ts`. One pass over 64 slots per kind
per frame, no sort.
- A forgotten agent frees its token with no cooldown. The cooldown exists
to stop one agent's attacks chaining; an agent that is gone cannot attack,
so the next Foamer should not inherit its wait.
- A waiting agent may raise its score between updates; the newest bid is
what the next `update` sees. Ties go to the lower agent id, which keeps
the grant order stable.
- Ids are integers in [0, `maxAgents`); anything else is ignored rather
than throwing, because the caller is the Foamer loop.
- The card says F01's bonk and headbutt are `melee`, but `data/foamers.json`
carries no kind per attack, only `needs`, `windup` and `strike`, and adds
no `attackKind`. Stage 1 does not read `data/foamers.json`, so nothing is
hard coded either way. Question for the reviewer: should stage 3 add a
`kind` field to each attack in `data/foamers.json`, or hold one kind per
rig in `data/ai.json`?

Unverified: nothing in the game calls the director yet (stage 3 wires it).
No range report field yet either. Stage 2 (nav grid, steering) not started.

### 2026-11-03: GAME-11 merged (Claude)

- Merged `game-11` into main after Paul's approval. Review: matches the
  card; the three changed old assertions are right (one lost leg now
  falls, it no longer limps). One indent restored.
- Left in code, small: the crawl's arm angles (-1.4, -0.6), the lying
  capsule's 0.45 m offset and the half turn rate. Move them to
  `data/foamers.json` when the crawl is tuned by eye.
- Unverified: the fall and crawl seen in motion. The range needs pointer
  lock, which the in-app browser cannot take; watch it on the range with
  Break leg.

### 2026-11-03: GAME-11 stage 2, crawl, attacks from the ground, sound and range button (DeepSeek V4.1 Flash via Pi)

The prone Foamer now moves and fights. `crawlMotion(rig, gait, out)` in
`src/foamers/rig-states.ts`, the signature the card names, adds the crawl
to the pose the Foamer already has: the arms reaching forward in turn
(`-1.4` plus and minus `0.5 * sin(gait * PI)`), the leg it has left
dragging at `-0.5 + 0.12 * cos`, and a small body rock in pitch. It does
not set pitch, roll or y itself: `poseParts` calls `proneMotion` for the
prone tilt first (which splits it with the fall's own `sideShare`, so the
crawl takes over from exactly where the fall ended and no part turns
over), then lays the crawl on top. A prone attack lays
`windupMotion`/`strikeMotion` over the same prone base pose, so it attacks
from where it lies instead of standing up to do it.

`Foamer.prone` is set by `startFall` and outlives the `crawl` state,
because the attack states are not prone states: every pose, floor fit and
reach check asks `prone`, not `state`. Speed is `Foamer.crawlSpeed()` =
`rig.speed * handicaps.crawlSpeed` (0.3 m/s measured on F01), and the turn
rate is halved while prone (`CRAWL_TURN` 0.5 in `foamers.ts`). It does not
turn at all during the fall, which is what the card's "no movement during
the fall" says.

Reach from the ground uses `Foamer.headPos`, the head's box centre taken
from the pose the Foamer was just solved into. Both the decision to attack
and the strike's own `dist <= attackRange + 0.3` check use it while prone,
so a crawl whose feet are still 1.8 m out attacks as soon as its head is
in range. With no forearms, `chooseAttack` already fell through to the
headbutt (`needs: []`), so no new data was needed. A prone Foamer cannot
stagger: an arm break on the ground only cancels the attack, because a
stagger would stand it back up.

The fall sound and the lying capsule came in stage 1 (`FoamerSoundKind`
`fall` -> `FX-topple`, no fizz-out; `setCapsuleLying`), and the range's
Break leg button and `breakLegForTest()` did too, so stage 2 only had to
keep them working. Footsteps were already gated on `state === "approach"`
in `src/audio/foamer-sounds.ts`, which covers the fall and the crawl; test
7 now pins that.

Tests: card 4 (closing speed within 15% of `rig.speed * crawlSpeed` and an
attack in range, then the same crawl with both forearms gone headbutting),
6 (a crawling Foamer killed by darts ragdolls and stays down; the test also
covers a kill mid-fall) and 7 (`onSound` gets `fall` once at the body, and
through the real `FoamerSounds` `FX-topple` plays once, with no
`FX-fizz-out` and no `FX-step-medium` during the fall or the crawl). Card
tests 1, 2, 3, 5 and 8 were built in stage 1 and are unchanged. One old
assertion had to change: `tests/foamers/parts.test.ts` 7 asserted that a
fallen Foamer "holds still prone" (stage 1's placeholder), which the card's
own crawl supersedes; it now checks that it crawls, more slowly than it
walked. None of the card's numbers changed.

Unverified: how the crawl reads on screen (the arm reach, the drag, the
pitch rock) and whether the prone attack's head reach feels right, both by
eye on the range. The card's numbers are the reviewer's to tune.

### 2026-11-03: GAME-11 stage 1, the fall (DeepSeek V4.1 Flash via Pi, from a Qwen 27b start)

A Foamer that is left with fewer than `handicaps.fallBelowLegs` (2) legs
now falls over: the attack is cancelled, it enters the new `fall` state
and tips as an inverted pendulum about the foot it still stands on,
`a'' = (gravity / pivotHeight) * sin(a)` in `Foamer.stepFall`, starting at
`fall.startTilt` and stopping at `fall.proneTilt`. It bounces once (back
less than `fall.bounce * proneTilt`), settles, and then enters `crawl`,
which for stage 1 holds still prone (`crawlSpeed` and moving come in
stage 2). `pivotHeight` is the body box centre found by solving the rest
pose once in the constructor, so the card's formula has a measured
number behind it. The tilt drives `RigMotion`: `pitch = a * (1 -
sideShare)` and `roll = a * sideShare * side`, where `side` is negative
for a lost left leg, the same sign the removed 0.15 rad per missing leg
used; the arms swing forward (`x` to -1.4 * reach) as it goes down. The
pose blends through the usual `poseBlend`, so a spring drop can cut in
and the whole thing goes down as one. `poseParts` fits the prone body to
the floor for `fall` and `crawl` as it already did for no legs and
`down`, so the fall ends on the ground and not in it.

`FoamerSoundKind` gains `fall`: one FX-topple at the body when it first
lands, no FX-fizz-out (it is not down). Foamers do not turn toward the
player or step while falling or crawling. `goDown` still works from both
states (a killing dart builds the ragdoll from the pose it was in).
`breakPart` only falls on a leg, only when it is not already down or
under, and the stagger sweep now runs after the head and arms check so
the same step cannot fall and stagger. The range panel has a Break leg
button (`breakLegForTest`).

Collision fix found while doing this: a severed part spawns inside the
voxels of the body it left, so the falling hips squashed a fresh leg
piece into the floor and it never rose (old parts test 6). A live
Foamer's part colliders are now `FOAMER_GROUPS` (kinematic VolumeMesh
only) and broken pieces are `DEBRIS_GROUPS`, so debris passes through a
living Foamer's own part boxes. The level's VolumeMesh is fixed, so it
keeps the default groups.

Tests: new `tests/foamers/fall.test.ts` covers the card's 1, 2, 3, 5 and
8 (fall then crawl in under 2 s, the pendulum speeding up and bouncing
at proneTilt, mirrored roll per leg, no joint moving over 0.35 rad in a
step through the transition, darts still hitting a falling Foamer) plus
the once-per-fall sound and going down from a fall and from the crawl.
The card's numbers were not changed. Three old tests did have to change,
because the card's own design supersedes them: `tests/foamers/parts.test.ts`
7 (one leg gone was a 50% limp; a two-legged Foamer now falls) and 11
(it staggered on a leg break, so it staggers on an arm break instead),
and `tests/audio/game-sounds.test.ts` (a leg break used to play no
topple; it now plays one). Unverified: how the fall reads on screen at
60 fps, the bounce size and timing by eye, and the crawl's silhouette
(stage 2 adds the movement).
### 2026-11-03: UI-01 merged (Claude)

- Merged `ui-01` into main after Paul's approval. Review fixes on the
  branch: the hit flash is found on the document (it sits outside the HUD
  root; the main page crashed on load), and `data/difficulty.json` has no
  note key, since every key becomes a preset button.
- Checked in the browser: settings open and save, the Hard preset sticks
  over a reload, the hit grace works, the range loads. 183 tests pass.
- Unverified: gamepad Start into the menu, and how damage feels in a real
  fight; tune `data/player.json` and `data/foamers.json` when arenas exist.

### 2026-11-02: UI-01 stage 2, pause menu and settings (Qwen 3.8 Flash-next via Pi)

- `src/core/settings.ts`: `SettingsStore`, one `Settings` object loaded
  from and saved to `localStorage` under `dart.settings` as
  `{ ...values, version: 1 }`. Every storage access is in try/catch: a
  blocked storage or broken JSON falls back to `DEFAULTS`. An older save
  merges over the defaults so new keys gain theirs; unknown `difficulty`
  values fall back to `normal`. `set(key, value)` and
  `setDifficulty(key)` save and call every `onChange` listener. Moving
  `damageTaken` by hand sets `difficulty` to `custom`; other keys do not.
  `applySettings` in `src/main.ts` is the one page subscriber: it pushes
  sensitivity and invert into `settings` from `src/core/input.ts`, FOV onto
  the camera, `damageTaken` onto `health`, `reduceFlashes` onto the HUD, and
  volume/mute onto the engine (re-applied when the engine loads).
- `data/difficulty.json`: Story 0.5, Normal 1, Hard 1.5, Foam Fury 2
  damage taken, each with the `director` key (`story`, `normal`, `hard`,
  `fury`) ENG-08's director will read. Names as in D10.
- `src/ui/menus.ts`: `SettingsPanel`, plain DOM built once into
  `#settingsRows`: four preset buttons plus a readout that shows "Custom",
  sliders for damage taken (25 to 200%), mouse sensitivity (shown as a
  percent of the default 0.0022), FOV (60 to 100), volume, and switches for
  invert look, mute, reduce screen shake, reduce flashes, reduce head bob
  (shake and head bob stored for later tasks). Subscribes to the store so it
  always mirrors it. Keyboard and mouse only; Tab follows element order.
- `index.html` + `src/style.css`: `#pausemenu` (Resume, Settings, Restart)
  and `#settings` (panel with `#settingsRows` and Back) over a dimmed
  screen, and a Settings button on the title overlay. Foam colours, system
  fonts.
- `src/main.ts` flow: `started` becomes true on the first pointer lock. The
  pause menu shows when paused, started and not popped; before the first
  click only the title (with its Settings button) shows. Resume, a click on
  the dimmed background, or the canvas plays on; Restart shares the Try
  again respawn (`restart()`). The M key now toggles `muted` through the
  store so the panel and storage stay in step.
- Tests: `tests/core/settings.test.ts` (6): defaults on empty and broken
  storage; round-trip; presets set damage taken; a slider move marks
  Custom; an old version gains new keys with defaults. `npm test` 183
  passed, `tsc --noEmit` and `npm run build` pass.
- Decisions: sensitivity is stored in rad/px (the input's unit) and shown
  as a percent of the default, so no second source of truth. FOV applies
  live via `camera.updateProjectionMatrix()`. The store is per page; the
  range page keeps its own panel and does not read the store yet (the card
  scopes the panels to the main page).
- Unverified: everything visual (tab order, the panels' look, live FOV and
  volume) awaits the reviewer's browser pass; no browser check was run
  here.

### 2026-11-02: UI-01 stage 1, player health, damage and HUD v1 (Qwen 3.8 Flash-next via Pi)

- `src/player/health.ts`: `PlayerHealth`, pure (no DOM, no THREE). `hp`,
  `max`, `damage(amount, from?)`, `heal(amount)`, `dead`, `reset()`,
  `update(dt)` for the grace timer, `damageTaken` (1 until stage 2 sets it
  from the difficulty). Numbers from `data/player.json`: new `health` block
  `{ "max": 100, "hitGrace": 0.5 }`. `damage` returns the hp actually lost
  (0 while in the grace or already dead), clamped so hp cannot go below 0;
  `heal` cannot pass max.
- `data/foamers.json`: each attack gained `"damage"` (bonk 12, headbutt 8),
  the only change to that file. Both pages read the id into a Map at load.
- Game page (`src/main.ts`): `foamers.onBonk` keeps the old chain (the AUD-01
  wrapper wraps our handler, the console log stays) and applies the attack's
  damage, skipping it while paused. On a hit the HUD flashes; at 0 hp the
  game pauses into a `#popped` panel ("You popped!" plus **Try again**), and
  a foam burst (10 foam blocks from the player's eye) plus a longer
  foam-core edge glow and FX-pop plays. No red anywhere. Try again respawns
  at SPAWN with full health and calls `foamers.clear()`; while popped, the
  lock change cannot unpause.
- HUD v1 (`src/ui/hud.ts`, DOM): health bottom-left (rounded foam-lime bar,
  cream border, number beside it; amber under 30%), bar flashes white on a
  hit, cream `#hitflash` edge glow outside the HUD root so it shows over the
  dimmed pop. `reduceFlashes` (stage 2 wires it) turns the edge glow off.
  Ammo bottom-right unchanged in behaviour, restyled alongside. Writes only
  when a value changed (`setHealth` compares hp and max).
- Range page: same bar via `#hud` markup in `range.html` plus a copy of the
  health CSS in `src/range/range.css`; a **God mode** switch (in the
  Switches group) makes bonks do nothing and tops the player back up.
- Tests: `tests/player/health.test.ts`, 8 cases (lower hp, grace blocks
  inside 0.5 s and allows after, 0/max clamps, `dead`, the multiplier). Old
  tests untouched. `npx tsc --noEmit`, `npm test` (177 pass, 2 skipped),
  `npm run build` pass.
- Unverified by eye: the pop panel and burst, the bar's look, Tab order
  around the Try again button. The reviewer plays it.
- Decisions: the grace blocks the hit entirely (rather than halving it) so
  a crowd cannot drain the bar in one second; the pop panel is its own
  element, not the title `#overlay`, so the title copy cannot leak into
  death; `onHit()` is called by the page, not the HUD watching health, so
  the HUD stays a pure view.

### 2026-11-02: AUD-01 stage 3b and final review (Pi, Claude)

Pi (Qwen 3.8) built the Foamer sounds: one `FoamerSystem.onSound(kind, f,
point)` field (spawn, wound, part-off, attack, down, sink, pop), and
`src/audio/foamer-sounds.ts`, owned by GameSounds: FX-spawn, FX-wound,
FX-part-off, F01-swing on attack start, F01-bonk plus PL-hurt (wrapping
the existing onBonk), FX-topple then FX-fizz-out 0.3 s later (a timer in
update), FX-sink once per Foamer, FX-pop plus FX-chunk, and FX-step-medium
each time `Math.floor(gait)` rises while approaching (two per walk cycle).
Test 8 added.

Claude's review across all stages fixed:
- Fire sounds count a new `Blaster.shots` field, not magazine drops: the
  range's infinite ammo refills the magazine in onShot and hid every shot.
- The engine never returned pool slots, and stopped loops kept running:
  after about 32 B04 switches the game would have gone silent.
- Voxel materials with no surface entry (the foam colours) played nothing;
  they now fall back to `default` (DT-hit-hard).
- A one-shot of a looping sound's ID (the range panel's Play on
  AMB-level) took over the loop's voice and killed the hum. The voice
  pool now leaves loops out of the per-ID cap.
- Sound now starts on the first click or key on both pages, not on the
  pointer lock event, which is not a user gesture (Safari would keep the
  context silent). The range panel's Play resumes the context, since the
  panel shows while paused.
- Loops crossfade at the join (stage 1 windowed them to silence).

Callback fields added to existing modules: `PlayerController.onMove`
(plus `dashing`, `mantling` getters), `Blaster.shots`,
`DartSystem.onDartHit` and `onDartRest`, `DartHit.material`,
`DartImpacts.onCarveAt`, `FoamerSystem.onSound`.

Checked in the browser (range, port 5178): the engine starts on the click
without pointer lock, all 49 sounds play from the panel with no console
errors, voices free when they end (16 playing, then 1, the hum). Not
heard: the browser pane has no speakers. Unverified: cue timing, volumes
and footstep rates by ear (left for Paul's recordings, AUD-01b: no more
time on the placeholder sounds, Paul's call); F01's headbutt attack also
plays F01-swing and F01-bonk. 169 tests pass.

### 2026-11-02: AUD-01 stage 3a, dart sounds (Pi, Qwen 3.8)

- **Dart sounds only; the Foamer hooks wait for the next stage.** New
  callback fields (the card's "add one field, no change to existing
  public APIs"):
  - `src/weapons/darts.ts` `DartSystem.onDartHit` (the full `DartHit`,
    fired after the `onHit` chain so subscribers have run) and
    `DartSystem.onDartRest` (the rest point) (no-op defaults).
    `DartHit` gains `material` (the voxel material name or `null`).
  - `src/weapons/impacts.ts` `DartImpacts.onCarveAt` (the hit point,
    once per carve that removed voxels). It also fills `DartHit.material`
    from the voxel under the dart's tip.
- `src/foamers/foamers.ts`: `handleHit` relabels a Foamer part hit as
  material "foamer" before the damage-speed early return, so even a soft
  graze thumps like foam in the sounds.
- `src/audio/game-sounds.ts`: the dart hooks. A non-slug hit plays the
  surface sound of `data/sounds.json`'s `surfaces` block by material
  name (Foamer part "foamer", voxel target its material, else
  "default"), spatial at the hit point, volume scaled by speed and full
  at 30 m/s and above. A slug plays `DT-slug-hit`. A carve plays
  `DT-carve` at the hit point. A dart at rest plays `DT-floor` at its
  position (the sound's `maxVoices` caps it). `GameSounds` now takes the
  `DartSystem` (required) and the `DartImpacts` (optional: a page without
  them passes none) after `player`; both pages and the existing tests'
  construction were updated to match.
- Card test 7 in `tests/audio/game-sounds.test.ts`: a hit on a wood
  voxel wall plays `DT-hit-wood`, a plain collider `DT-hit-hard`, a slug
  `DT-slug-hit`, a hit on a spawned Foamer's part `DT-hit-foamer`, each
  at the hit point.
- Unverified by ear: the actual sounds (Paul records the files; the
  synth placeholders stand in). Hand-checked in a run of each page: a
  burst and a wood wall on the main page, and a Foamer part on the
  test range. Test-writing gotchas found along the way: Rapier's
  `ColliderDesc.cuboid` takes half extents, so a collider bigger than its
  voxel volume leaves the material look-up empty; and the Foamer's root
  capsule sits in front of the parts on a dart aimed at low height at
  the body centre, so a test hit on the part fires higher.

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
