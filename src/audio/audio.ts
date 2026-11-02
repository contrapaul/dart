// AUD-01 stage 2: the only file that touches Web Audio. Implements the
// AudioSink (sink.ts) and owns the one AudioContext, the bus gains, the
// voice slots and the spatial panner. Built in the "Click to play"
// handler on both pages (the browser keeps sound off until a click);
// tests never import it (they fake the AudioSink instead).
//
// No fetch from another host (CLAUDE.md): every file is same origin, from
// /audio/<file>. A missing or bad file logs a warning and the placeholder
// plays. Nothing is allocated per frame in the listener update; one-shots
// do create their own nodes (Web Audio needs that) but reuse vectors.

import * as THREE from "three";
import { renderRecipe, SAMPLE_RATE } from "./synth";
import { VoicePool, makeTakePicker } from "./voices";
import type { AudioSink, PlayOptions, LoopHandle } from "./sink";
import DATA from "../../data/sounds.json";

// The shape of data/sounds.json the engine reads.
interface RawSound {
  files: string[];
  volume: number;
  jitter: number;
  maxVoices: number;
  loop?: boolean;
  synth: unknown;
}
interface SoundData {
  buses: Record<string, number>;
  maxVoices: number;
  refDistance: number;
  maxDistance: number;
  sounds: Record<string, RawSound>;
}
type SoundTable = SoundData;

// Everything the engine knows about one sound, ready to play.
interface SoundEntry {
  takes: AudioBuffer[];     // decoded recordings, in data order
  placeholder: AudioBuffer; // always present, the code-made fallback
  volume: number;
  jitter: number;
  maxVoices: number;
  picker: { pick(): number; reset(): void };
}

// A voice currently occupying a slot. kind is "one" (ends on its own) or
// "loop" (runs until stop) so kill can treat them the same.
interface ActiveVoice {
  kind: "one" | "loop";
  source: AudioBufferSourceNode;
  gain: GainNode;
  panner: PannerNode | null;
}

export class AudioEngine implements AudioSink {
  private ctx: AudioContext;
  private master: GainNode;
  private sfx: GainNode;
  private music: GainNode;
  private voice: GainNode;
  private pool: VoicePool;
  private entries: Map<string, SoundEntry>;
  private voices: (ActiveVoice | null)[];
  private warned: Set<string> = new Set();
  private refDistance: number;
  private maxDistance: number;
  private camera: THREE.Camera | null = null;
  private _fwd = new THREE.Vector3();
  private _muted = false;
  private _vol = 1;

  private constructor(
    ctx: AudioContext,
    entries: Map<string, SoundEntry>,
    camera: THREE.Camera,
  ) {
    this.ctx = ctx;
    this.entries = entries;
    this.camera = camera;
    const A = DATA as SoundTable;
    this.refDistance = A.refDistance;
    this.maxDistance = A.maxDistance;
    // Buses: sfx, music and voice all feed the master. Music and voice have
    // no content yet (card: no music, no settings menu) but the buses exist.
    this.master = ctx.createGain();
    this.master.connect(ctx.destination);
    this.sfx = ctx.createGain();
    this.sfx.connect(this.master);
    this.music = ctx.createGain();
    this.music.connect(this.master);
    this.voice = ctx.createGain();
    this.voice.connect(this.master);
    this.applyMaster();
    this.pool = new VoicePool(A.maxVoices);
    this.voices = new Array(A.maxVoices).fill(null);
  }

  /** Build the engine: open the context, render every placeholder, decode
   *  every recording. Call it from the click handler and await it. */
  static async create(camera: THREE.Camera): Promise<AudioEngine> {
    const ctx = new AudioContext();
    // Resume inside the click gesture that made this call: the file loads
    // below are awaits, and the user-activation window closes before a
    // resume call that lands after them.
    if (ctx.state === "suspended") void ctx.resume();
    const A = DATA as SoundTable;
    const entries = new Map<string, SoundEntry>();
    for (const [id, raw] of Object.entries(A.sounds)) {
      const samples = renderRecipe(raw.synth as Parameters<typeof renderRecipe>[0]);
      const placeholder = ctx.createBuffer(1, samples.length, SAMPLE_RATE);
      placeholder.copyToChannel(new Float32Array(samples), 0);
      const takes: AudioBuffer[] = [];
      for (const file of raw.files) {
        try {
          const res = await fetch("/audio/" + file);
          if (!res.ok) throw new Error(file + " -> " + res.status);
          const ab = await res.arrayBuffer();
          takes.push(await ctx.decodeAudioData(ab));
        } catch {
          // A file that is missing or wrong: warn and fall back to the
          // placeholder, which is always appended below.
          console.warn("audio: " + id + " file " + file + " failed to load; playing the placeholder");
        }
      }
      entries.set(id, {
        takes,
        placeholder,
        volume: raw.volume,
        jitter: raw.jitter,
        maxVoices: raw.maxVoices,
        picker: makeTakePicker(takes.length),
      });
    }
    const engine = new AudioEngine(ctx, entries, camera);
    void engine.resume(); // the click just happened, so the context may run
    return engine;
  }

  // ---- the AudioSink ----

  play(id: string, opts?: PlayOptions): void {
    const e = this.entries.get(id);
    if (!e) { this.warnOnce(id); return; }
    const now = this.ctx.currentTime;
    const book = this.pool.start(id, e.maxVoices, now, false);
    if (!book) return;                          // nothing to steal (loops only)
    if (book.stop != null) this.kill(book.stop);
    const buffer = this.pick(e);
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = this.rateFor(e, opts);
    const gain = this.ctx.createGain();
    gain.gain.value = e.volume * (opts?.volume ?? 1);
    let dest: AudioNode = this.sfx;
    let panner: PannerNode | null = null;
    if (opts?.position) {
      panner = this.newPanner(opts.position);
      source.connect(panner);
      panner.connect(gain);
      dest = gain;
    } else {
      source.connect(gain);
    }
    gain.connect(dest === gain ? this.sfx : dest);
    const slot = book.voice;
    const v: ActiveVoice = { kind: "one", source, gain, panner };
    source.onended = () => this.release(slot, v);
    this.voices[slot] = v;
    source.start();
  }

  loop(id: string, opts?: PlayOptions): LoopHandle {
    const e = this.entries.get(id);
    if (!e) { this.warnOnce(id); return NOOP_HANDLE; }
    const now = this.ctx.currentTime;
    const book = this.pool.start(id, e.maxVoices, now, true);
    if (!book) return NOOP_HANDLE;           // no slot (only loops playing)
    if (book.stop != null) this.kill(book.stop);
    const source = this.ctx.createBufferSource();
    source.buffer = this.pick(e);
    source.loop = true;
    source.playbackRate.value = this.rateFor(e);
    const gain = this.ctx.createGain();
    gain.gain.value = e.volume * (opts?.volume ?? 1);
    let panner: PannerNode | null = null;
    if (opts?.position) {
      panner = this.newPanner(opts.position);
      source.connect(panner);
      panner.connect(gain);
      gain.connect(this.sfx);
    } else {
      source.connect(gain);
      gain.connect(this.sfx);
    }
    const slot = book.voice;
    const v: ActiveVoice = { kind: "loop", source, gain, panner };
    this.voices[slot] = v;
    source.start();
    return {
      set: (volume, rate) => {
        gain.gain.value = e.volume * volume;
        source.playbackRate.value = rate;
      },
      setPosition: (p) => {
        if (!panner) return;
        panner.positionX.value = p.x;
        panner.positionY.value = p.y;
        panner.positionZ.value = p.z;
      },
      stop: () => this.kill(slot, v),
    };
  }

  
  // ---- internals ----

  private warnOnce(id: string): void {
    if (this.warned.has(id)) return;
    this.warned.add(id);
    console.warn("audio: unknown sound id " + id);
  }

  /** Random take; the placeholder when there is no recording. Never the
   *  same take twice in a row with two or more (see makeTakePicker). */
  private pick(e: SoundEntry): AudioBuffer {
    if (e.takes.length === 0) return e.placeholder;
    return e.takes[e.picker.pick()];
  }

  /** Rate times random jitter around it. */
  private rateFor(e: SoundEntry, opts?: PlayOptions): number {
    const base = opts?.rate ?? 1;
    if (e.jitter <= 0) return base;
    return base * (1 + (Math.random() * 2 - 1) * e.jitter);
  }

  /** A space node at p uses the distance model and distances from the data.
   *  One new node makes one sound (Web Audio just needs the node); its values
   *  get written, not have vectors copied. */
  private newPanner(p: THREE.Vector3): PannerNode {
    const n = this.ctx.createPanner();
    n.panningModel = "equalpower";
    n.distanceModel = "inverse";
    n.refDistance = this.refDistance;
    n.maxDistance = this.maxDistance;
    n.positionX.value = p.x;
    n.positionY.value = p.y;
    n.positionZ.value = p.z;
    return n;
  }

  /** Returns the slot to the pool and lets its nodes go. Safe to call
   *  twice: an empty slot, or one now holding another voice, does nothing. */
  private release(slot: number, v: ActiveVoice): void {
    if (this.voices[slot] !== v) return;
    this.voices[slot] = null;
    this.pool.end(slot);
    v.source.onended = null;
    if (v.panner) v.panner.disconnect();
    v.gain.disconnect();
  }

  /** Stops a voice now and frees its slot (a manual stop), or, with no
   *  voice given, whatever is in the slot (a theft: the pool has already
   *  rebooked the slot, so it is not ended here). */
  private kill(slot: number, only?: ActiveVoice): void {
    const v = this.voices[slot];
    if (!v || (only && v !== only)) return;
    this.voices[slot] = null;
    if (only) this.pool.end(slot);
    v.source.onended = null;
    if (v.panner) v.panner.disconnect();
    v.gain.disconnect();
    try { v.source.stop(); } catch { /* already stopped */ }
  }

  // ---- page-facing ----

  /** Called once per frame by the render step: the listener is always the
   *  camera (position and forward direction, no allocation). */
  updateListener(): void {
    if (!this.camera || this.ctx.state !== "running") return;
    this.camera.getWorldDirection(this._fwd);
    const p = this.camera.position;
    this.ctx.listener.positionX.value = p.x;
    this.ctx.listener.positionY.value = p.y;
    this.ctx.listener.positionZ.value = p.z;
    this.ctx.listener.forwardX.value = this._fwd.x;
    this.ctx.listener.forwardY.value = this._fwd.y;
    this.ctx.listener.forwardZ.value = this._fwd.z;
    this.ctx.listener.upX.value = 0;
    this.ctx.listener.upY.value = 1;
    this.ctx.listener.upZ.value = 0;
  }

  /** Pauses on losing the pointer lock; resumes when it returns. */
  suspend(): void { void this.ctx.suspend(); }
  resume(): void  { void this.ctx.resume(); }

  get muted(): boolean { return this._muted; }
  set muted(m: boolean) { this._muted = m; this.applyMaster(); }
  get volume(): number { return this._vol; }
  set volume(v: number) { this._vol = v; this.applyMaster(); }
  private applyMaster(): void {
    const b = (DATA as SoundTable).buses;
    this.master.gain.value = (this._muted ? 0 : 1) * this._vol * (b.master ?? 1);
    this.sfx.gain.value = b.sfx ?? 1;
    this.music.gain.value = b.music ?? 1;
    this.voice.gain.value = b.voice ?? 1;
  }

  /** How many voices are playing now (the report line). */
  get playingCount(): number { return this.pool.playingCount(); }

  /** Whether this sound plays a recording (yes) or the placeholder (no);
   *  the number of takes on the range panels. */
  takeCount(id: string): number {
    const e = this.entries.get(id);
    return e ? e.takes.length : 0;
  }
}

/** Returned from loop() when the sound cannot play. Still implements the
 *  handle so a hook never has to guard. */
const NOOP_HANDLE: LoopHandle = {
  set() {},
  setPosition() {},
  stop() {},
};
