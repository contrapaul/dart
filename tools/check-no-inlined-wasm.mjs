// OPS-02 guard, run by `npm run build` right after `vite build`: fails the
// build if any built .js still carries the Rapier WebAssembly inlined as
// base64 ("AGFzbQ" is the base64 of the .wasm magic number, \0asm). It runs
// on the fresh dist/ only, so a stale build left on disk never trips it.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (p.endsWith(".js")) yield p;
  }
}

const offenders = [...walk("dist")].filter((p) => readFileSync(p, "utf8").includes("AGFzbQ"));
if (offenders.length > 0) {
  console.error("Inlined WebAssembly found (OPS-02): " + offenders.join(", "));
  process.exit(1);
}
