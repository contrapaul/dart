import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config";

// Vitest reads this file instead of vite.config.ts, so it merges that one
// (the rapier aliases, OPS-02) rather than repeating it.
export default mergeConfig(viteConfig, defineConfig({
  test: {
    // BUG-10: the default pool spawns one fork per test file, so a full run
    // runs about 85 forks on this 12-core machine. Each fork then gets
    // little over 15 percent of a core and a wall-time test stopped
    // measuring the work it was meant to: the 40 by 40 m nav bake ran at
    // about 36 ms in an idle run but over 200 ms under a second full suite
    // running at the same time, far past its 150 ms budget. Capping the pool
    // at 6 keeps each fork well fed, so wall time once again reflects the
    // bake's or query's own cost (loaded runs, 6 workers: bake about 42 ms,
    // query 1.2 ms; the suite still takes about the same 7 s, because the
    // total CPU work is unchanged, only the self-oversubscription is gone).
    maxWorkers: 6,
    server: {
      deps: {
        // One module identity for the whole engine (OPS-02): evaluated
        // twice the .wasm state gets set on the copy the tests do not use.
        inline: [/@dimforge\/rapier3d/],
      },
    },
  },
}));
