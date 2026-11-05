import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config";

// Vitest reads this file instead of vite.config.ts, so it merges that one
// (the rapier aliases, OPS-02) rather than repeating it.
export default mergeConfig(viteConfig, defineConfig({
  test: {
    server: {
      deps: {
        // One module identity for the whole engine (OPS-02): evaluated
        // twice the .wasm state gets set on the copy the tests do not use.
        inline: [/@dimforge\/rapier3d/],
      },
    },
  },
}));
