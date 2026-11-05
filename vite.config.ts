import { resolve } from "node:path";
import { defineConfig } from "vite";

const rapierShim = resolve(import.meta.dirname, "src/physics/rapier-shim.ts");
const rapier3d = resolve(import.meta.dirname, "node_modules/@dimforge/rapier3d/rapier.js");

// The 58 files that import "@dimforge/rapier3d-compat" keep their import
// lines; the alias resolves them to a shim that re-exports the non-compat
// build, whose WebAssembly is a separate content-hashed .wasm under
// /assets instead of base64 inside the game-sounds chunk (OPS-02). The
// second entry points the non-compat package at its ESM entry: its
// package.json has no "main" or "exports" field, so Node (Vitest's SSR
// consumer) cannot resolve the bare name on its own.
export default defineConfig({
  resolve: {
    alias: [
      { find: "@dimforge/rapier3d-compat", replacement: rapierShim },
      { find: /^@dimforge\/rapier3d$/, replacement: rapier3d },
    ],
  },
  // The dev server's dependency pre-bundler would put the Rapier glue in
  // .vite/deps while its .wasm binding loads from node_modules: two module
  // copies, and the one the game calls never gets the wasm instance (the
  // page hung on Loading). Served as is, it stays one copy.
  optimizeDeps: {
    exclude: ["@dimforge/rapier3d"],
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, "index.html"),
        range: resolve(import.meta.dirname, "range.html"),
        sandbox: resolve(import.meta.dirname, "sandbox.html"),
        arena: resolve(import.meta.dirname, "arena.html"),
      },
      output: {
        // TheRapier glue (rapier_wasm3d.js) imports its .wasm and calls
        // __wbg_set_wasm on the instance. If Rollup split the glue and the
        // bg module into two chunks, the same wasm-scoped instance gets set
        // in one copy while the other copy's test path reads an unset one,
        // so both must stay in a single chunk (see tests that instantiate
        // a world via createPhysics out of this non-compat build).
        manualChunks(id) {
          if (id.includes("@dimforge/rapier3d")) return "rapier";
        },
      },
    },
  },
});
