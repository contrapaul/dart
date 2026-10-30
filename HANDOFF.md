# Handoff

Running record of what is built, what was decided, and what the next session
should know. Newest log entry at the top. The plan is `PLAN.md`; the rules are
`CLAUDE.md`.

## Status

PRE-09, ENG-01 to ENG-05 and GAME-01 done. The test course: click to capture the mouse,
then walk, sprint, jump, dash and mantle around steps, ledges, ramps and walls.
Left mouse fires darts, E throws foam blocks, T toggles dart type. Esc or
gamepad Start pauses.

A striped 4 m foam wall made of 0.1 m voxels stands in the course, topped
with cardboard, wood and concrete. Melee (F / middle mouse) is a temporary
debug blast: it carves where you look and throws foam debris.

GAME-02 (placeholder pump blaster, dart hits carve voxels) is with Pi on
branch `game-02` in worktree `../dart-game-02` (card: `tasks/GAME-02.md`).

Next up: ENG-06 (pieces cut loose fall as physics bodies; right now they
float). ENG-07 (foam shader) can run alongside. P0 prototype due 2026-11-12.

Live at https://dart.contrapaul.com since 2026-10-30. Paul connected the repo
in the Cloudflare dashboard: a push to `main` builds (`npm run build`) and
deploys. Repo: github.com/contrapaul/dart (public), MIT licence.

## Open items

- [ ] Paul: blaster cards, story outline, Foamer names (PRE-02 to PRE-05).

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
