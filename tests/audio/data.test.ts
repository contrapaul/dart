// AUD-01 test 2: data/sounds.json is well formed, only uses IDs that
// exist, and every key in it appears as an ID in the first column of the
// tables in design/SOUNDS.md (read from disk so a rename on either side
// fails here).
import { describe, expect, it } from "vitest";
import DATA from "../../data/sounds.json";
import SOUNDS_MD from "../../design/SOUNDS.md?raw";

const S = DATA as unknown as {
  _note?: string;
  buses: Record<string, number>;
  maxVoices: number;
  refDistance: number;
  maxDistance: number;
  sounds: Record<string, {
    files: string[];
    volume: number;
    jitter: number;
    maxVoices: number;
    synth: unknown;
  }>;
  blasterCues: Record<string, { state: string; at: number; sound: string }[]>;
  surfaces: Record<string, string>;
  player: Record<string, number>;
};

function isRecipe(x: unknown): boolean {
  if (typeof x !== "object" || x === null) return false;
  const o = x as Record<string, unknown>;
  const leaf = Boolean(
    o.noise || o.tone || o.click || o.crackle,
  );
  const layers = Array.isArray(o.layers) &&
    o.layers.length > 0 &&
    (o.layers as unknown[]).every(isRecipe);
  return leaf || layers;
}

/** IDs from the first column of the markdown tables in SOUNDS.md. */
function idsFromSOUNDS_md(): Set<string> {
  const out = new Set<string>();
  for (const line of SOUNDS_MD.split("\n")) {
    if (!line.startsWith("|")) continue;
    const cells = line.split("|").slice(1, -1).map((c) => c.trim());
    const c0 = cells[0] ?? "";
    if (!c0) continue;
    if (setOnly(c0)) continue; // separator line like ---
    if (c0 === "ID" || c0 === "Foamer" || c0 === "Track") continue;
    out.add(c0);
  }
  return out;
}

function setOnly(s: string): boolean {
  for (const ch of s) {
    if (ch !== "-" && ch !== ":") return false;
  }
  return true;
}

describe("data/sounds.json", () => {
  it("has the top-level shape the engine reads", () => {
    expect(S.buses).toBeTruthy();
    for (const b of ["master", "sfx", "music", "voice"]) {
      expect(S.buses[b], `bus ${b}`).toBeGreaterThanOrEqual(0);
    }
    expect(S.maxVoices).toBeGreaterThan(0);
    expect(S.refDistance).toBeGreaterThan(0);
    expect(S.maxDistance).toBeGreaterThan(S.refDistance);
    expect(Object.keys(S.sounds).length).toBeGreaterThan(10);
  });

  it("every sound has files (possibly empty), a synth recipe, sane fields", () => {
    for (const [id, e] of Object.entries(S.sounds)) {
      expect(Array.isArray(e.files), id).toBe(true);
      expect(e.volume, id).toBeGreaterThanOrEqual(0);
      expect(e.volume, id).toBeLessThanOrEqual(1);
      expect(e.jitter, id).toBeGreaterThanOrEqual(0);
      expect(e.maxVoices, id).toBeGreaterThanOrEqual(1);
      expect(isRecipe(e.synth), `synth recipe of ${id}`).toBe(true);
    }
  });

  it("every ID used by a cue or a surface exists in sounds", () => {
    for (const [bl, cues] of Object.entries(S.blasterCues)) {
      expect(cues.length, bl).toBeGreaterThan(0);
      for (const c of cues) {
        expect(["priming", "reloading"]).toContain(c.state);
        expect(c.at).toBeGreaterThanOrEqual(0);
        expect(c.at).toBeLessThan(1);
        expect(typeof c.sound).toBe("string");
        expect(S.sounds[c.sound], `sound ${c.sound} of cue ${bl}`).toBeTruthy();
      }
    }
    for (const [surface, id] of Object.entries(S.surfaces)) {
      expect(surface).toBeTruthy();
      expect(S.sounds[id], `surface sound ${id} (${surface})`).toBeTruthy();
    }
  });

  it("every key in sounds appears as an ID in design/SOUNDS.md", () => {
    const ids = idsFromSOUNDS_md();
    expect(ids.size).toBeGreaterThan(80);
    const missing: string[] = [];
    for (const key of Object.keys(S.sounds)) {
      if (!ids.has(key)) missing.push(key);
    }
    expect(missing, `not in SOUNDS.md: ${missing.join(", ")}`).toEqual([]);
  });
});
