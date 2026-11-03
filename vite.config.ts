import { resolve } from "node:path";
import { defineConfig } from "vite";

// Four pages: the game (index.html), the test range (range.html), the
// Foamer sandbox (sandbox.html) and the level arena (arena.html).
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, "index.html"),
        range: resolve(import.meta.dirname, "range.html"),
        sandbox: resolve(import.meta.dirname, "sandbox.html"),
        arena: resolve(import.meta.dirname, "arena.html"),
      },
    },
  },
});
