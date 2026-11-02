// AUD-01 test 1: every synth recipe in the data renders cleanly. Imported
// for the shape check as well, so a recipe shape that cannot render fails
// here rather than in the engine.
import { describe, expect, it } from "vitest";
import { renderRecipe, type Layer, type Recipe } from "../../src/audio/synth";
import DATA from "../../data/sounds.json";

// DATA is the JSON file; the cast below is permissive because JSON imports
// are typed as their literal shape only by the compiler, and the shape
// here mirrors the runtime contract of the file for the tests.
const SOUNDS = (DATA as unknown) as {
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
    synth: Recipe;
  }>;
  blasterCues: Record<string, { state: string; at: number; sound: string }[]>;
  surfaces: Record<string, string>;
  player: Record<string, number>;
};

/** The longest dur in a recipe, in samples at 48 kHz, as the card's
 *  spec has it: dur times 48000, the longest layer for layers. */
function recipeSamples(synth: Recipe): number {
  const layers: Layer[] = "layers" in synth ? synth.layers : [synth];
  let dur = 0;
  for (const l of layers) {
    dur = Math.max(
      dur,
      l.noise?.dur ?? l.tone?.dur ?? l.click?.dur ?? l.crackle?.dur ?? 0,
    );
  }
  return Math.round(dur * 48000);
}

describe("renderRecipe over data/sounds.json", () => {
  it("has at least one sound", () => {
    expect(Object.keys(SOUNDS.sounds).length).toBeGreaterThan(0);
  });

  it("renders every recipe at dur times 48000 samples, peak in range, ends near zero, deterministic", () => {
    const ids = Object.keys(SOUNDS.sounds);
    expect(ids.length).toBeGreaterThan(10);
    for (const id of ids) {
      const synth = SOUNDS.sounds[id].synth;
      const a = renderRecipe(synth);
      const n = recipeSamples(synth);
      expect(a.length, `length of ${id}`).toBe(n);
      let peak = 0;
      for (let i = 0; i < a.length; i++) {
        const v = a[i] < 0 ? -a[i] : a[i];
        if (v > peak) peak = v;
      }
      expect(peak, `peak of ${id}`).toBeLessThanOrEqual(1);
      expect(peak, `peak of ${id} (not silent)`).toBeGreaterThan(0.05);
      expect(Math.abs(a[0]), `first sample of ${id}`).toBeLessThan(0.01);
      expect(Math.abs(a[a.length - 1]), `last sample of ${id}`).toBeLessThan(0.01);
      const b = renderRecipe(synth);
      expect(a.length).toBe(b.length);
      let same = true;
      for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) { same = false; break; }
      expect(same, `determinism of ${id}`).toBe(true);
    }
  });

  it("loops have ends that fade to silence, so looping does not click", () => {
    const ids = ["B04-rev-loop", "AMB-level"];
    for (const id of ids) {
      const a = renderRecipe(SOUNDS.sounds[id].synth);
      // The first and last 96 samples (2 ms) are a flat fade to zero.
      let m = 0;
      for (let i = a.length - 96; i < a.length; i++) m = Math.max(m, Math.abs(a[i]));
      expect(m, `tail of ${id}`).toBeLessThan(0.005);
      m = 0;
      for (let i = 0; i < 96; i++) m = Math.max(m, Math.abs(a[i]));
      expect(m, `head of ${id}`).toBeLessThan(0.005);
    }
  });
});
