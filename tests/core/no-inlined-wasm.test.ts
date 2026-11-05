// @ts-nocheck
// OPS-02 guard: the game-sounds chunk used to be 4.5 MB because the Rapier
// WebAssembly was inlined as base64. This test scans every .js in dist/ for
// the base64 of the .wasm magic number ("AGFzbQ" for \0asm) and fails if a
// chunk still carries it, so the .wasm stays a separate content-hashed file
// under /assets. Runs only when dist/ exists (fresh clones have none). The
// file is ts-nochecked for the same reason as tests/weapons/models.test.ts:
// it reads Node's fs and Node types are not installed.
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

describe("OPS-02: no inlined WebAssembly in chunks", () => {
  const root = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
  const dist = join(root, "dist");

  function* walk(dir: string): Generator<string> {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      const st = statSync(p);
      if (st.isDirectory()) yield* walk(p);
      else if (p.endsWith(".js")) yield p;
    }
  }

  it("no .js file in dist/ contains AGFzbQ", () => {
    // Skip if there is no build yet (fresh clone, `npm test` before `npm run build`).
    if (!existsSync(dist)) return;
    const offenders: string[] = [];
    for (const p of walk(dist)) {
      const text = readFileSync(p, "utf8");
      if (text.includes("AGFzbQ")) offenders.push(p);
    }
    expect(offenders, `found inlined WebAssembly (base64 start "AGFzbQ") in: ${offenders.join(", ")}`).toEqual([]);
  });
});
