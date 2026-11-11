// Every page's build points at a file under public/, and a missing one used
// to leave the overlay on "Loading" for ever with nothing but a console
// line. This is the other half of that guard: each blaster's `model` must be
// a file the repo actually has, so a rename cannot half-land (B08's 2026-11-12
// rename moved the glb and the data had to move with it).
//
// It reads the tree rather than the build, so it catches the mistake before
// anything is deployed. Node types are not installed, so ts-checking is off
// here only, as in models.test.ts, the other test that reads files.
// @ts-nocheck
import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import blastersJson from "../../data/blasters.json";

describe("every model path in data/blasters.json exists in public/", () => {
  const raw = blastersJson as unknown as { order: string[]; [k: string]: unknown };

  it("every blaster's model file is present", () => {
    for (const id of raw.order) {
      const spec = raw[id] as { model: string };
      const rel = spec.model.startsWith("/") ? spec.model.slice(1) : spec.model;
      expect(existsSync(`public/${rel}`), `${id}: public/${rel} is missing`).toBe(true);
    }
  });

  it("no two blasters share one model by accident", () => {
    // B02 pointed at the B01 file as a placeholder while its own model was
    // being made. That exemption is over: B02 has shipped its own glb, so
    // every blaster now names its own file. If a placeholder is ever needed
    // again, add it here with the reason.
    const shared: Record<string, string> = {};
    for (const id of raw.order) {
      const model = (raw[id] as { model: string }).model;
      expect(shared[model], `${id} and ${shared[model]} both use ${model}`).toBeUndefined();
      shared[model] = id;
    }
  });
});
