# Handoff

Running record of what is built, what was decided, and what the next session
should know. Newest log entry at the top. The plan is `PLAN.md`; the rules are
`CLAUDE.md`.

## Status

PRE-09, ENG-01 and ENG-02 done. The test course: click to capture the mouse,
then walk, sprint, jump, dash and mantle around steps, ledges, ramps and walls.
Fire throws foam blocks. Esc or gamepad Start pauses.

Next up: ENG-03 (voxel chunk storage). P0 prototype due 2026-11-12.

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
