// Frame time log and (later) the canvas graph that draws it, for the
// test range page (ENG-11). The log keeps the last graph.frames frames in
// ring buffers of typed arrays; push never allocates, so the hot path cost
// is a handful of stores per frame. The graph class lands in stage 2.
import rangeJson from "../../data/range.json";
import { STEP, type FrameStats } from "../core/loop";

export const GRAPH = (rangeJson as {
  graph: {
    frames: number; width: number; height: number;
    hitchFactor: number; longWorkFactor: number; gcDropMb: number;
  };
}).graph;

const N = GRAPH.frames;

/** One hitch, for the summary: the frame number, the fields that matter
 *  for blaming it, and whether a heap drop (a GC) was within 2 frames. */
export interface HitchInfo {
  frame: number;
  raw: number;
  work: number;
  steps: number;
  gcNear: boolean;
}

/** What summary() returns at one moment. A fresh object per call. */
export interface FrameSummary {
  frames: number;
  refreshMs: number;
  refreshHz: number;
  rawAvg: number;
  rawP95: number;
  rawWorst: number;
  workAvg: number;
  workP95: number;
  workWorst: number;
  hitches: { total: number; long: number; pacing: number };
  heapDrops: number;
  recentHitches: HitchInfo[];
}

export class FrameLog {
  readonly raw = new Float32Array(N);
  readonly dt = new Float32Array(N);
  readonly steps = new Float32Array(N);
  readonly work = new Float32Array(N);
  readonly updateWork = new Float32Array(N);
  readonly heap = new Float32Array(N).fill(NaN);
  readonly paused = new Uint8Array(N);
  private head = 0;
  private count = 0;
  private frameNo = 0; // frames pushed since construction

  get frames(): number { return this.count; }
  get frameNumber(): number { return this.frameNo; }

  /** Append one frame. The loop reuses one FrameStats object, so every
   *  field is copied out here; nothing is allocated, the buffers keep
   *  their identity. */
  push(s: FrameStats, heapMb: number = NaN, paused = false): void {
    if (this.count < N) this.count++;
    else this.head = (this.head + 1) % N;
    const i = (this.head + this.count - 1) % N;
    this.raw[i] = s.raw;
    this.dt[i] = s.dt;
    this.steps[i] = s.steps;
    this.work[i] = s.work;
    this.updateWork[i] = s.updateWork;
    this.heap[i] = heapMb;
    this.paused[i] = paused ? 1 : 0;
    this.frameNo++;
  }

  /** The median raw of the buffer: the best estimate of the display
   *  interval from what the log holds. Allocates one scratch buffer, but
   *  only on demand (the readout), never per frame. */
  refreshMs(): number {
    const n = this.count;
    if (n === 0) return 0;
    const a = new Float32Array(n);
    for (let i = 0; i < n; i++) a[i] = this.at(this.raw, i);
    a.sort();
    const m = n >> 1;
    if (n % 2) return a[m]!;
    return (a[m - 1]! + a[m]!) / 2;
  }

  /** Classify every frame in the buffer and describe it. A hitch is a
   *  frame whose raw is over hitchFactor times the median, or one that
   *  ran a step count the refresh rate cannot explain while not paused
   *  (at 60 Hz anything but 1; at 120 Hz, 0 and 1 alternate normally, so
   *  only 2 or more). A hitch is a long
   *  (work-heavy) frame when work is over longWorkFactor times the
   *  median, otherwise a pacing hitch. A heap drop is a frame whose heap
   *  fell by more than gcDropMb from the frame before: a GC. */
  summary(): FrameSummary {
    const n = this.count;
    if (n === 0) {
      return {
        frames: 0, refreshMs: 0, refreshHz: 0,
        rawAvg: 0, rawP95: 0, rawWorst: 0,
        workAvg: 0, workP95: 0, workWorst: 0,
        hitches: { total: 0, long: 0, pacing: 0 },
        heapDrops: 0, recentHitches: [],
      };
    }
    const ref = this.refreshMs();
    const hitchAt = GRAPH.hitchFactor * ref;
    const longAt = GRAPH.longWorkFactor * ref;
    const raws = new Float32Array(n);
    const works = new Float32Array(n);
    let rawSum = 0, workSum = 0, rawWorst = 0, workWorst = 0, drops = 0;
    let total = 0, long = 0, pacing = 0;
    const isHitch = new Uint8Array(n);
    const heapDrop = new Uint8Array(n);
    // A step hitch is decided by isStepHitch, which shares its rule with
    // the graph's tick marks.
    for (let i = 0; i < n; i++) {
      const r = this.at(this.raw, i);
      const w = this.at(this.work, i);
      raws[i] = r;
      works[i] = w;
      rawSum += r;
      workSum += w;
      rawWorst = Math.max(rawWorst, r);
      workWorst = Math.max(workWorst, w);
      if (i > 0) {
        const h = this.at(this.heap, i);
        const hp = this.at(this.heap, i - 1);
        if (Number.isFinite(h) && Number.isFinite(hp) && h < hp - GRAPH.gcDropMb) {
          drops++;
          heapDrop[i] = 1;
        }
      }
      if (r > hitchAt || this.isStepHitch(i, ref)) {
        isHitch[i] = 1;
        total++;
        if (w > longAt) long++;
        else pacing++;
      }
    }
    raws.sort();
    works.sort();
    const p = (a: Float32Array) => a[Math.max(0, Math.ceil(0.95 * n) - 1)]!;
    // The last 20 hitches, oldest first; each notes a heap drop within two
    // frames (either side).
    const recent: HitchInfo[] = [];
    for (let i = n - 1, want = 20; i >= 0 && want > 0; i--) {
      if (!isHitch[i]) continue;
      let gcNear = false;
      for (let d = -2; d <= 2; d++) {
        const j = i + d;
        if (j >= 0 && j < n && heapDrop[j]) gcNear = true;
      }
      recent.unshift({
        frame: this.frameNo - n + i,
        raw: this.at(this.raw, i),
        work: this.at(this.work, i),
        steps: this.at(this.steps, i),
        gcNear,
      });
      want--;
    }
    return {
      frames: n,
      refreshMs: ref,
      refreshHz: ref > 0 ? 1000 / ref : 0,
      rawAvg: rawSum / n,
      rawP95: p(raws),
      rawWorst: rawWorst,
      workAvg: workSum / n,
      workP95: p(works),
      workWorst: workWorst,
      hitches: { total, long, pacing },
      heapDrops: drops,
      recentHitches: recent,
    };
  }

  /** A plain-text block for pasting into chat: the summary, the last
   *  hitches, then the extra key values (the switch states, the user
   *  agent, the pixel ratio, the screen). */
  report(extra: Record<string, string | number>): string {
    const s = this.summary();
    const f = (v: number) => v.toFixed(1);
    const lines: string[] = [
      `${s.frames} frames`,
      `refresh ${f(s.refreshMs)} ms (${f(s.refreshHz)} Hz)`,
      `raw ${f(s.rawAvg)} avg / ${f(s.rawP95)} p95 / ${f(s.rawWorst)} worst ms`,
      `work ${f(s.workAvg)} avg / ${f(s.workP95)} p95 / ${f(s.workWorst)} worst ms`,
      `hitches ${s.hitches.total} (long ${s.hitches.long}, pacing ${s.hitches.pacing})`,
      `GC drops ${s.heapDrops}`,
    ];
    if (s.recentHitches.length > 0) {
      lines.push("last hitches:");
      for (const h of s.recentHitches)
        lines.push(
          `  frame ${h.frame}: raw ${f(h.raw)} work ${f(h.work)} `
          + `steps ${h.steps}${h.gcNear ? " gc near" : ""}`,
        );
    }
    for (const [k, v] of Object.entries(extra)) lines.push(`${k}: ${v}`);
    return lines.join("\n");
  }

  /** A frame is a step hitch when its step count is outside what the
   *  refresh rate explains while not paused: at 60 Hz anything but 1, at
   *  120 Hz 0 and 1 alternate normally so only 2 or more, at 30 Hz a
   *  single step. The graph's tick marks use the same rule. */
  isStepHitch(i: number, refMs: number): boolean {
    if (this.at(this.paused, i)) return false;
    const perFrame = refMs / (STEP * 1000);
    const lo = Math.floor(perFrame + 0.05);
    const hi = Math.ceil(perFrame - 0.05);
    const st = this.at(this.steps, i);
    return st < lo || st > hi;
  }

  /** Drop everything (Clear log, benchmark start). */
  reset(): void {
    this.head = 0;
    this.count = 0;
    this.frameNo = 0;
  }

  /** Copy the frame at position i (oldest-to-newest) into out, so a
   *  reader allocates nothing. */
  peek(i: number, out: FrameStats): FrameStats {
    out.raw = this.at(this.raw, i);
    out.dt = this.at(this.dt, i);
    out.steps = this.at(this.steps, i);
    out.work = this.at(this.work, i);
    out.updateWork = this.at(this.updateWork, i);
    return out;
  }

  /** Heap MB at position i, oldest-to-newest (NaN where absent). */
  heapAt(i: number): number {
    return this.at(this.heap, i);
  }

  /** The field at position i in oldest-to-newest order. */
  private at(arr: Float32Array | Uint8Array, i: number): number {
    return Number(arr[(this.head + i) % N]);
  }
}

// The graph: draws a FrameLog on a 2D canvas, newest frame on the right.
// One bar per frame, height the raw interval with the part that was game
// work in a second colour; a line at one refresh, one at the hitch
// threshold; a tick under each step-hitch frame; a dot at each heap drop;
// a heap line (MB) where the browser reports it. summary() runs for the
// text row at most 4 times a second, the draw itself allocates nothing.
export class FrameGraph {
  private box: HTMLElement;
  private textEl: HTMLElement;
  private ctx: CanvasRenderingContext2D;
  private log: FrameLog;
  private stats = { raw: 0, dt: 0, steps: 0, work: 0, updateWork: 0 };
  shown = true;
  private textClock = 250; // show the first text as soon as frames exist
  private lastText = "";

  constructor(canvas: HTMLCanvasElement, box: HTMLElement, textEl: HTMLElement, log: FrameLog) {
    this.box = box;
    this.textEl = textEl;
    this.log = log;
    // CSS pixels are the data size; the backing store follows the device
    // ratio so it stays sharp, set once.
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(GRAPH.width * dpr);
    canvas.height = Math.round(GRAPH.height * dpr);
    this.ctx = canvas.getContext("2d")!;
    this.ctx.scale(dpr, dpr);
  }

  /** Back-quote turns it on or off. */
  toggle(): void {
    this.shown = !this.shown;
    this.box.hidden = !this.shown;
  }

  /** Called once per render frame; dtMs is the display interval. */
  draw(dtMs: number): void {
    if (!this.shown) return;
    this.textClock += dtMs;
    if (this.textClock >= 250) {
      this.textClock = 0;
      this.text();
    }
    this.bars();
  }

  private text(): void {
    const s = this.log.summary();
    const t =
      `refresh ${s.refreshHz.toFixed(0)} Hz | `
      + `raw ${s.rawAvg.toFixed(1)} / ${s.rawP95.toFixed(1)} / ${s.rawWorst.toFixed(1)} ms | `
      + `work ${s.workAvg.toFixed(1)} / ${s.workP95.toFixed(1)} / ${s.workWorst.toFixed(1)} ms | `
      + `hitches ${s.hitches.total} (long ${s.hitches.long}, pacing ${s.hitches.pacing}) | `
      + `GC drops ${s.heapDrops}`;
    if (t !== this.lastText) {
      this.textEl.textContent = t;
      this.lastText = t;
    }
  }

  private bars(): void {
    const c = this.ctx;
    const W = GRAPH.width, H = GRAPH.height;
    c.clearRect(0, 0, W, H);
    const n = Math.min(this.log.frames, N);
    if (n === 0) return;
    const ref = this.log.refreshMs();
    const span = Math.max(ref * 3, 30); // chart height covers 3 refreshes
    const bw = W / N;
    const base = (v: number) => H - Math.min(1, v / span) * (H - 4) - 2;
    const start = this.log.frames - n; // first slot drawn, oldest-to-newest
    c.lineWidth = 1;
    c.strokeStyle = "rgba(255,255,255,0.22)";
    c.beginPath();
    c.moveTo(0, base(ref));
    c.lineTo(W, base(ref));
    c.moveTo(0, base(ref * GRAPH.hitchFactor));
    c.lineTo(W, base(ref * GRAPH.hitchFactor));
    c.stroke();
    c.beginPath();
    for (let i = 0; i < n; i++) {
      const f = this.log.peek(start + i, this.stats);
      const x = W - (n - i) * bw;
      const top = base(f.raw);
      c.moveTo(x, H - 2);
      c.lineTo(x, top);
      c.lineTo(x + bw - 0.25, top);
      c.lineTo(x + bw - 0.25, H - 2);
    }
    c.strokeStyle = "#8ea3ff";
    c.stroke();
    c.fillStyle = "#ff7a1a";
    for (let i = 0; i < n; i++) {
      const f = this.log.peek(start + i, this.stats);
      const x = W - (n - i) * bw;
      const w = Math.min(f.work, f.raw);
      const top = base(w);
      c.fillRect(x, top, bw - 0.25, H - 2 - top);
    }
    // Heap line on its own scale (0 to the max in view, at least 128 MB).
    let heapMax = 0;
    for (let i = 0; i < n; i++) {
      const h = this.log.heapAt(start + i);
      if (Number.isFinite(h) && h > heapMax) heapMax = h;
    }
    if (heapMax > 0) {
      const hs = Math.max(heapMax * 1.1, 128);
      const hb = (v: number) => H - Math.min(1, v / hs) * (H - 8) - 4;
      c.beginPath();
      let pen = false;
      for (let i = 0; i < n; i++) {
        const h = this.log.heapAt(start + i);
        if (!Number.isFinite(h)) { pen = false; continue; }
        const x = W - (n - i) * bw + bw / 2;
        if (pen) c.lineTo(x, hb(h));
        else { c.moveTo(x, hb(h)); pen = true; }
      }
      c.strokeStyle = "rgba(182,255,59,0.5)";
      c.stroke();
      // A dot at each heap drop.
      c.fillStyle = "#b6ff3b";
      for (let i = 1; i < n; i++) {
        const f0 = this.log.heapAt(start + i - 1);
        const f1 = this.log.heapAt(start + i);
        if (Number.isFinite(f0) && Number.isFinite(f1) && f1 < f0 - GRAPH.gcDropMb) {
          const s2 = this.log.peek(start + i, this.stats);
          c.fillRect(W - (n - i) * bw, base(s2.raw) - 6, 2.5, 2.5);
        }
      }
    }
    // A tick under each frame whose step count the refresh rate cannot
    // explain, the same rule the summary uses.
    if (ref > 0) {
      c.fillStyle = "rgba(255,79,163,0.9)";
      for (let i = 0; i < n; i++) {
        if (this.log.isStepHitch(start + i, ref)) {
          c.fillRect(W - (n - i) * bw + bw / 2 - 0.75, H - 2, 1.5, 2);
        }
      }
    }
  }
}
