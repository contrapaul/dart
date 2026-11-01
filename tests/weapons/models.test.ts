// @ts-nocheck
// Test 13 for GAME-09: every blaster has every named node its mode, muzzles,
// mods and animation need. Reads the .glb from public/ and parses the glTF
// JSON chunk directly, no loader: the unit test needs no three. This file
// is the only file reader in the repo and Node types are not installed,
// so ts-checking is disabled here only.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import blastersJson from "../../data/blasters.json";
import { resolveSpec } from "../../src/weapons/blaster";
const CHUNK_JSON = 0x4e4f534a;

function glbNodeNames(path: string): Set<string> {
  const buf = readFileSync(path);
  const dv = new DataView(buf.buffer ?? buf, buf.byteOffset ?? 0, buf.byteLength);
  const len = dv.getUint32(8, true);
  let off = 12;
  let json: { nodes: { name: string }[] } | null = null;
  while (off + 8 <= len) {
    const clen = dv.getUint32(off, true);
    const ctype = dv.getUint32(off + 4, true);
    if (ctype === CHUNK_JSON)
      json = JSON.parse(new TextDecoder().decode(buf.subarray(off + 8, off + 8 + clen)));
    if (clen <= 0) break;
    off += 8 + clen;
  }
  if (!json) throw new Error(`no glTF JSON chunk in ${path}`);
  return new Set(json.nodes.map((n) => n.name));
}

// Path from the tests directory to the mounted public directory.
const MODELS = "public/models/blasters";

describe("GAME-09 models", () => {
  const ids = (blastersJson as unknown as { order: string[] }).order;

  it("13. every blaster has every node its mode, muzzles, mods and animation need", () => {
    for (const id of ids) {
      const spec = resolveSpec(id);
      const names = glbNodeNames(`${MODELS}/${id}.glb`);
      // Every blaster animates its trigger.
      expect(names.has("trigger")).toBe(true);
      // Every muzzle in use fires darts from a named empty.
      for (const m of spec.muzzles) expect(names.has(m), `${id}: missing muzzle ${m}`).toBe(true);
      // Mode specific moving parts.
      if (spec.mode === "pump") {
        expect(names.has("pump"), `${id}: no pump`).toBe(true);
        expect(names.has("mag"), `${id}: no mag`).toBe(true);
      } else if (spec.mode === "auto") {
        expect(names.has("flywheel_l"), `${id}: no flywheel_l`).toBe(true);
        expect(names.has("flywheel_r"), `${id}: no flywheel_r`).toBe(true);
        expect(names.has("mag"), `${id}: no mag`).toBe(true);
      } else {
        expect(names.has("breach"), `${id}: no breach`).toBe(true);
        expect(names.has("latch"), `${id}: no latch`).toBe(true);
        expect(names.has("shell_1"), `${id}: no shell_1`).toBe(true);
        expect(names.has("shell_2"), `${id}: no shell_2`).toBe(true);
      }
      // Every node each mod shows, hides, and points at lives in the file.
      const raw = (blastersJson as unknown as {
        [k: string]: { mods?: Record<string, { show?: string[]; hide?: string[]; muzzles?: string[] }> };
      })[id];
      for (const [modName, mod] of Object.entries(raw.mods ?? {})) {
        for (const n of mod.show ?? [])
          expect(names.has(n), `${id} mod ${modName}: missing show ${n}`).toBe(true);
        for (const n of mod.hide ?? [])
          expect(names.has(n), `${id} mod ${modName}: missing hide ${n}`).toBe(true);
        for (const m of mod.muzzles ?? [])
          expect(names.has(m), `${id} mod ${modName}: missing muzzle ${m}`).toBe(true);
      }
    }
  });
});
