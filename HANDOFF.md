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
- **The dev server is started from the workspace launch config**
  (`GitHub/.claude/launch.json`, entry `dart`), not one inside this repo.

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
- Verified: `npm run build` passes; the scene runs with no console errors both
  locally and on https://dart.contrapaul.com. Not verified: frame rate on the
  benchmark Mac (nothing heavy to measure yet), push-to-deploy (not connected).
