# Handoff

Running record of what is built, what was decided, and what the next session
should know. Newest log entry at the top. The plan is `PLAN.md`; the rules are
`CLAUDE.md`.

## Status

PRE-09 (repo setup) done. The page is a skeleton that proves the stack: Three.js
renders, Rapier runs (its WebAssembly bundled inline), and foam blocks fall onto
a floor; clicking drops more. No gameplay yet.

Next up: ENG-01 (game loop and input) and ENG-03 (voxel chunk storage), which
can run in parallel. P0 prototype due 2026-11-12.

## Open items

- [ ] Paul: confirm the code licence (MIT, copied from build) is what you want.
- [ ] Paul: which model you run in Pi (PLAN.md 11.1).
- [ ] Paul: blaster cards, story outline, Foamer names (PRE-02 to PRE-05).

## Gotchas that have already bitten

(none yet)

## Log

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
