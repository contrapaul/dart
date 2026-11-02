// AUD-01 test 1: every synth recipe in the data renders cleanly. Imported
// for the shape check as well, so a recipe shape that cannot render fails
// here rather than in the engine.
import { describe, expect, it } from "vitest";
import { LOOP_XF, renderRecipe, type Layer, type Recipe } from "../../src/audio/synth";
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
  const n = Math.round(dur * 48000);
  // A loop drops its crossfaded tail (see renderRecipe).
  return isLoop(synth) ? n - Math.min(Math.floor(n / 2), Math.round(LOOP_XF * 48000)) : n;
}

function isLoop(synth: Recipe): boolean {
  return (synth as { loop?: boolean }).loop === true;
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
      if (!isLoop(synth)) {
        // Loops are checked below: their ends join, they are not silent.
        expect(Math.abs(a[0]), `first sample of ${id}`).toBeLessThan(0.01);
        expect(Math.abs(a[a.length - 1]), `last sample of ${id}`).toBeLessThan(0.01);
      }
      const b = renderRecipe(synth);
      expect(a.length).toBe(b.length);
      let same = true;
      for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) { same = false; break; }
      expect(same, `determinism of ${id}`).toBe(true);
    }
  });

  it("loops join without a jump and keep their level at the join", () => {
    const ids = ["B04-rev-loop", "AMB-level"];
    for (const id of ids) {
      const a = renderRecipe(SOUNDS.sounds[id].synth);
      // The step from the last sample back to the first is no bigger than
      // the biggest step inside the loop (no click).
      let maxStep = 0;
      for (let i = 1; i < a.length; i++) maxStep = Math.max(maxStep, Math.abs(a[i] - a[i - 1]));
      expect(Math.abs(a[0] - a[a.length - 1]), `join of ${id}`).toBeLessThanOrEqual(maxStep);
      // Level (RMS) over 20 ms either side of the join is at least half the
      // whole loop's level: the loop does not dip to silence as it repeats.
      const rms = (from: number, to: number) => {
        let s = 0;
        for (let i = from; i < to; i++) s += a[i] * a[i];
        return Math.sqrt(s / (to - from));
      };
      const w = 960;
      const whole = rms(0, a.length);
      expect(rms(0, w), `start level of ${id}`).toBeGreaterThan(0.5 * whole);
      expect(rms(a.length - w, a.length), `end level of ${id}`).toBeGreaterThan(0.5 * whole);
    }
  });
});
