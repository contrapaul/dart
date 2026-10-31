# Handoff

Running record of what is built, what was decided, and what the next session
should know. Newest log entry at the top. The plan is `PLAN.md`; the rules are
`CLAUDE.md`.

## Status

PRE-09, ENG-01 to ENG-07, GAME-01, GAME-02 (placeholder blaster) and
GAME-03 (test Foamer) done. The test course: click to capture the mouse,
then walk, sprint, jump, dash and mantle around steps, ledges, ramps and
walls. Left mouse fires the placeholder pump blaster (3 darts per shot,
priming after each shot, R reloads, auto-reload on empty), darts carve
voxels and throw foam debris. E throws foam blocks, T toggles dart type.
Esc or gamepad Start pauses.

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

In progress: ENG-10 (Pi, branch `eng-10`): the F01 rig in the game with part damage, going down and popping. Next up: QA-01 (performance on the low-end machine, Paul) and the P0 gate. P0 prototype due 2026-11-12.

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
