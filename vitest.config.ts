import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

const rapierShim = resolve(import.meta.dirname, "src/physics/rapier-shim.ts");

export default defineConfig({
  resolve: {
    alias: [
      { find: "@dimforge/rapier3d-compat", replacement: rapierShim },
      {
        find: /^@dimforge\/rapier3d$/,
        replacement: resolve(import.meta.dirname, "node_modules/@dimforge/rapier3d/rapier.js"),
      },
    ],
  },
  test: {
    server: {
      deps: {
        // One module identity for the whole engine (OPS-02): evaluated
        // twice the .wasm state gets set on the copy the tests do not use.
        inline: [/@dimforge\/rapier3d/],
      },
    },
  },
});
