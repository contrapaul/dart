import { resolve } from "node:path";
import { defineConfig } from "vite";

// Three pages: the game (index.html), the test range (range.html) and the
// Foamer sandbox (sandbox.html).
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, "index.html"),
        range: resolve(import.meta.dirname, "range.html"),
        sandbox: resolve(import.meta.dirname, "sandbox.html"),
      },
    },
  },
});
