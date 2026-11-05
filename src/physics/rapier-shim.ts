// Alias target for "@dimforge/rapier3d-compat" (see the resolve.alias entry
// in vite.config.ts). The compat build inlines the Rapier WebAssembly as a
// base64 string inside its JavaScript: 4.1 MB of the 4.5 MB game-sounds
// chunk (1.4 MB gzipped), re-downloaded on every code change (OPS-02). The
// non-compat "@dimforge/rapier3d" is the same engine version 0.21.0 but
// ships its WebAssembly as a plain .wasm ES module, which Vite loads as its
// own content-hashed file under /assets and compiles while it streams.
import * as RAPIER from "@dimforge/rapier3d";

// The compat package's init() decodes the inline base64 and instantiates
// the module; here the WebAssembly is ready by the time this module is
// loaded, so init() is a no-op and the 38 call sites need no change.
export function init(): Promise<void> {
  return Promise.resolve();
}

// Default export mirrors the compat package's `export default RAPIER`
// (see its dist/rapier.d.ts), so the 40 `import RAPIER from` lines in the
// game keep working.
export default { ...RAPIER, init };
