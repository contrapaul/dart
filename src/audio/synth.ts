// AUD-01 stage 1: render placeholder sound recipes (from data/sounds.json)
// to 48 kHz mono Float32Array. Pure functions, no Web Audio, deterministic
// in recipe and seed, so the tests can render and compare without a browser.

export const SAMPLE_RATE = 48000;

// ---- recipe types, matching the recipes in data/sounds.json ----

export interface NoiseParams {
  dur: number;       // seconds
  attack: number;    // seconds, linear ramp from silence
  decay: number;     // seconds, exponential fall after the peak
  lowpass: number;   // Hz, one-pole low-pass cutoff at the start
  highpass: number;  // Hz, one-pole high-pass cutoff
  lowpassEnd?: number; // if given, the low-pass cutoff slides to this
}
export interface ToneParams {
  dur: number;
  f0: number;        // Hz at the start
  f1: number;        // Hz at the end (linear sweep)
  wave: "sine" | "square" | "triangle";
  attack: number;    // seconds; 0 or less means immediate
  decay: number;     // seconds, exponential fall; 0 means undamped
                     // (used by loop sounds so the level is constant)
}
export interface ClickParams { dur: number; freq: number; }
export interface CrackleParams { dur: number; rate: number; decay: number; }

export interface Layer {
  noise?: NoiseParams;
  tone?: ToneParams;
  click?: ClickParams;
  crackle?: CrackleParams;
  gain?: number;     // default 1
  seed?: number;     // default 1, chooses the random stream
  loop?: boolean;    // true: the buffer must repeat without a click
}
export type Recipe = Layer | { layers: Layer[]; loop?: boolean };

// Small seeded random (LCG from Numerical Recipes). Deterministic per seed;
// every layer re-creates its stream, so the same recipe renders identically.
export function makeRng(seed: number): () => number {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

function layerDur(l: Layer): number {
  return (
    l.noise?.dur ?? l.tone?.dur ?? l.click?.dur ?? l.crackle?.dur ?? 0
  );
}

// Render a whole recipe. Layers render to their own buffers and are
// summed; the result is capped at a peak of 1 and windowed at the ends.
// A non-loop gets a 2 ms fade in and out so nothing clicks at the ends.
// A loop (loop: true) is crossfaded instead: its last LOOP_XF seconds are
// faded into its start and dropped, so the end runs straight on into the
// start at the same level, with no gap and no click at the join.
/** Seconds of crossfade at a loop's join. */
export const LOOP_XF = 0.1;

export function renderRecipe(recipe: Recipe): Float32Array {
  const layers = "layers" in recipe ? recipe.layers : [recipe];
  let dur = 0;
  for (const l of layers) dur = Math.max(dur, layerDur(l));
  const n = Math.max(1, Math.round(dur * SAMPLE_RATE));
  const out = new Float32Array(n);
  for (const l of layers) {
    const lbuf = renderLayer(l, Math.max(1, Math.round(layerDur(l) * SAMPLE_RATE)));
    for (let i = 0; i < lbuf.length; i++) out[i] += lbuf[i];
  }
  // Peak at most 1: cap only, so a recipe over 1 in the worst case is
  // scaled down and nothing is boosted (the gains in the data then mean
  // what they say across sounds).
  let peak = 0;
  for (let i = 0; i < n; i++) { const a = out[i] < 0 ? -out[i] : out[i]; if (a > peak) peak = a; }
  if (peak > 1) for (let i = 0; i < n; i++) out[i] /= peak;
  // End windowing: a crossfaded join for loops, a 2 ms linear fade for
  // one-shots.
  const loop = "layers" in recipe ? recipe.loop === true : recipe.loop === true;
  if (loop) {
    const xf = Math.min(Math.floor(n / 2), Math.round(LOOP_XF * SAMPLE_RATE));
    const m = n - xf;
    for (let i = 0; i < xf; i++) {
      const w = i / xf;
      out[i] = out[i] * w + out[m + i] * (1 - w);
    }
    return out.slice(0, m);
  }
  const f = Math.min(n, Math.max(2, Math.round(0.002 * SAMPLE_RATE)));
  for (let i = 0; i < f; i++) {
    const k = (i + 1) / f;
    out[i] *= k;
    out[n - 1 - i] *= k;
  }
  return out;
}

// ---- the four layer shapes ----

// White noise through one-pole high-pass and low-pass; the low-pass cutoff
// slides linearly toward lowpassEnd. One-pole coefficient per sample at 48k.
function renderNoise(p: NoiseParams, n: number, rng: () => number): Float32Array {
  const out = new Float32Array(n);
  const sr = SAMPLE_RATE;
  const lp0 = 2 * Math.PI * p.lowpass / sr;
  const lpE = 2 * Math.PI * (p.lowpassEnd ?? p.lowpass) / sr;
  const hp = 1 - Math.exp(-2 * Math.PI * p.highpass / sr);
  let lp = 0, hpPrev = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    // decay 0: constant level after the attack (loops), as for tones.
    const env = t < p.attack
      ? t / Math.max(p.attack, 1e-6)
      : p.decay <= 0 ? 1 : Math.exp(-(t - p.attack) / p.decay);
    const fc = p.lowpassEnd !== undefined
      ? lp0 + (lpE - lp0) * Math.min(1, t / p.dur)
      : lp0;
    const lpC = 1 - Math.exp(-fc);           // one-pole low-pass coeff
    const w = rng() * 2 - 1;
    hpPrev += hp * (w - hpPrev);             // one-pole high-pass
    lp += lpC * (hpPrev - lp);
    out[i] = lp * env;
  }
  let peak = 0;
  for (let i = 0; i < n; i++) { const a = out[i] < 0 ? -out[i] : out[i]; if (a > peak) peak = a; }
  if (peak > 1e-9) for (let i = 0; i < n; i++) out[i] /= peak;
  return out;
}

// Pitch sweep f0 to f1 with a periodic waveform; constant level when
// decay is 0 (loops), exponential fall otherwise; linear attack.
function renderTone(p: ToneParams, n: number): Float32Array {
  const out = new Float32Array(n);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const frac = n > 1 ? i / (n - 1) : 0;
    const f = p.f0 + (p.f1 - p.f0) * frac;
    phase += f / SAMPLE_RATE;
    const ph = phase - Math.floor(phase);
    let v: number;
    if (p.wave === "sine") v = Math.sin(2 * Math.PI * ph);
    else if (p.wave === "square") v = ph < 0.5 ? 1 : -1;
    else v = 4 * Math.abs(ph - 0.5) - 1;     // triangle, -1 at quarter points
    const env =
      (p.attack > 0 && t < p.attack ? t / p.attack : 1)
      * (p.decay > 0 ? Math.exp(-t / p.decay) : 1);
    out[i] = v * env;
  }
  return out;
}

// A very short tick: a decaying sine tuned to freq, exploding at the start
// and nearly gone over dur.
function renderClick(p: ClickParams, n: number): Float32Array {
  const out = new Float32Array(n);
  const span = Math.max(p.dur, 1e-6);
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    out[i] = Math.sin(2 * Math.PI * p.freq * t) * Math.exp(-8 * t / span) * 0.9;
  }
  return out;
}

// Random short clicks at rate per second. Each click is a short ringing
// blip of a fixed detuned chirp; clicks are scheduled deterministically
// from the seed (a click when the accumulated counter rolls over), and
// decayed into a small history buffer so ring-tails overlap.
function renderCrackle(p: CrackleParams, n: number, rng: () => number): Float32Array {
  const out = new Float32Array(n);
  const hold = 1 / Math.max(p.rate, 0.001);
  const blip = 0.012; // seconds each click rings
  let counter = 0;
  for (let i = 0; i < n; i++) {
    counter += hold;
    let iLimit = i;
    let ran = false;
    while (counter >= 1 && !ran) {
      counter -= 1;
      ran = true;
      const sgn = rng() < 0.5 ? 1 : -1;
      const f = 900 + 1800 * rng();
      const blipN = Math.min(Math.ceil(blip * SAMPLE_RATE), n - iLimit);
      for (let k = 0; k < blipN; k++) {
        const t2 = k / SAMPLE_RATE;
        out[iLimit + k] += sgn * Math.sin(2 * Math.PI * f * t2) * Math.exp(-20 * t2 / blip) * 0.25;
      }
      iLimit += blipN;
    }
  }
  return out;
}

function renderLayer(layer: Layer, n: number): Float32Array {
  const out = new Float32Array(n);
  const gain = layer.gain ?? 1;
  const rng = makeRng(layer.seed ?? 1);
  let src: Float32Array;
  if (layer.noise) src = renderNoise(layer.noise, n, rng);
  else if (layer.tone) src = renderTone(layer.tone, n);
  else if (layer.click) src = renderClick(layer.click, n);
  else if (layer.crackle) src = renderCrackle(layer.crackle, n, rng);
  else return new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = src[i] * gain;
  return out;
}
