# OPS-02: ship the physics engine as its own file

Written 2026-11-06 (overnight). The build's largest chunk,
`game-sounds-*.js`, is 4.5 MB (1.7 MB gzip). 4.1 MB of it is one string:
the Rapier physics WebAssembly, inlined as base64 because the game uses
`@dimforge/rapier3d-compat`. Inlined, it is a quarter bigger than the
binary, it is parsed as JavaScript before it is decoded, it cannot be
compiled while it downloads, and any change to the game's code changes
that chunk's hash, so returning players download the physics engine
again. The cache headers (`public/_headers`: `/assets/*` immutable) are
already right; the file layout is what needs to change.

```
ID:          OPS-02
Title:       The physics WebAssembly is a separate hashed .wasm file under
             /assets, loaded with streaming compile, so it is cached apart
             from the game's code and the main chunks shrink by about 4 MB
Owner:       Pi (Qwen 3.8-27B, qwen-machine, 1cat config, thinking low)
Reviewer:    Claude Opus 5.5
Depends on:  OPS-01 (done)
Branch:      ops-02, in its own worktree
```

**Running at the same time:** GAME-09b (the Foamer hit and kill path,
`data/blasters.json`, `data/foamers.json`) and LVL-02c (`src/level/`,
`src/arena/`, `data/levels/`). Your files are `vite.config.ts`,
`package.json` and `package-lock.json`, `src/physics/world.ts`, and a new
shim module if you need one. Do not change the `rapier3d-compat` import
lines in the 58 files that have them: point the import at the new package
in one place (a Vite and Vitest `resolve.alias`, or one re-export module
that the alias targets) so nobody else's files change.

## Read first

1. `CLAUDE.md` (nothing is fetched from another host: the .wasm is built
   into `dist/assets/` and served by the same Worker)
2. `vite.config.ts`, `package.json`, `public/_headers`, `wrangler.jsonc`
3. `src/physics/world.ts` (`createPhysics`: where `RAPIER.init()` runs)
4. How the tests create a world: `grep -rn "init()" tests src | head`
5. The Rapier package docs in `node_modules/@dimforge/rapier3d-compat/`
   and, once installed, `node_modules/@dimforge/rapier3d/` (README and
   `package.json`: how the non-compat build loads its .wasm)

## What to build

- **Stage 1 is a spike, and it may stop the card.** Find a way for the
  game to load the same Rapier version (0.21.0, pinned exact like every
  dependency) from a separate .wasm file in both `npm run build` and
  `npm run dev`, while `npx vitest run` still passes in Node. Likely
  routes, try in this order:
  1. `@dimforge/rapier3d@0.21.0` (the non-compat build, which imports its
     .wasm as an ES module) with the Vite plugins it needs (for example
     `vite-plugin-wasm`, plus top-level await if the target needs it),
     pinned exact, and an alias so `@dimforge/rapier3d-compat` resolves to
     a small shim that re-exports it with a no-op `init()`.
  2. Keep the compat package but pass `init()` the URL of a separate
     .wasm that Vite emits (`?url` import of the package's wasm file, if
     the compat package ships one or it can be built from the non-compat
     one), so the base64 string is never bundled.
  If neither works in about two hours of effort, stop: write in HANDOFF
  what you tried and what blocked it, change nothing in the game, and set
  the PLAN row to "Blocked". That is a fine result.
- **If it works:** the build has a `*.wasm` under `dist/assets/` with a
  content hash, no chunk carries the base64, every page (index, range,
  sandbox, arena) still loads and plays, and the dev server works.
  Say the before and after sizes (raw and gzip) of every chunk over
  100 kB and of the .wasm in HANDOFF.
- **Headers:** `.wasm` served as `application/wasm` (check what the
  Worker's assets serve; add a `_headers` rule only if needed).
- **A test** that fails if a built chunk inlines the WebAssembly: for
  example a Node test that runs only when `dist/` exists and checks no
  `.js` file there contains `AGFzbQ` (the base64 of the .wasm magic
  number); or a check in a small script that `npm run build` runs. Pick
  one and say which.

## Done when

- `npx tsc --noEmit`, `npx vitest run`, `npm run build` pass; no em or en
  dashes. The four pages load in `npm run dev` and in `npx vite preview`
  of the build (you cannot open a browser: run the preview server and
  fetch each page and the .wasm with curl, check the status and the
  content type, and say so in HANDOFF).
- PLAN.md: the OPS-02 row points to this card, Done or Blocked; the route
  and why in section 14. HANDOFF: a dated entry at the top of the Log,
  Status updated, and what was not checked by eye (that each page plays).

## Not in this task

A loading screen or progress bar, splitting the mesher or three.js
chunks, sound files (all placeholder synths today), service workers.
