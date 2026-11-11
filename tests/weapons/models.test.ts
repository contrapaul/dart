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

describe("GAME-09 models", () => {
  const ids = (blastersJson as unknown as { order: string[] }).order;

  it("13. every blaster has every node its mode, muzzles, mods and animation need", () => {
    for (const id of ids) {
      const spec = resolveSpec(id);
      // GAME-09c: read the model the spec points at, not "<id>.glb":
      // the B02 placeholder points at the B01 file until its own ships.
      const rel = spec.model.startsWith("/") ? spec.model.slice(1) : spec.model;
      const names = glbNodeNames(`public/${rel}`);
      // Every blaster animates its trigger.
      expect(names.has("trigger")).toBe(true);
      // Every muzzle in use fires darts from a named empty.
      for (const m of spec.muzzles) expect(names.has(m), `${id}: missing muzzle ${m}`).toBe(true);
      // Mode specific moving parts.
      if (spec.mode === "pump") {
        // GAME-09e: a pump blaster works a pump (B01) or, for the bolt
        // action B05, a bolt. Either is the moving part; the viewmodel
        // animates whichever the file has (B05's bolt animation is ART-05).
        expect(
          names.has("pump") || names.has("bolt"),
          `${id}: no pump and no bolt`,
        ).toBe(true);
        // GAME-09f: B07's drum is its magazine, so a drum node counts too
        // (its glb has body, drum, pump, trigger, muzzle_1, no separate
        // mag).
        expect(
          names.has("mag") || names.has("drum"),
          `${id}: no mag and no drum`,
        ).toBe(true);
      } else if (spec.mode === "auto") {
        // GAME-09d: an auto blaster spins a pair of flywheels (B04) or
        // cycles a bolt (B06, whose approved model has one) or spins a
        // barrel cluster (B08's gatling: barrels, plus barrels_2 with
        // the Twin mod). Either is a moving part; the viewmodel animates
        // whichever the file has.
        expect(
          names.has("flywheel_l") && names.has("flywheel_r") || names.has("bolt") || names.has("barrels"),
          `${id}: no flywheels, bolt or barrels`,
        ).toBe(true);
        expect(names.has("mag"), `${id}: no mag`).toBe(true);
      } else if (spec.mode === "semi") {
        // GAME-09c: B02 reuses the B01 glb as a placeholder and needs
        // only the magazine node to drop on its reload.
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
