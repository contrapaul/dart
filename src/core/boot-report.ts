// A page's boot, step by step (PT-10). Every page's module is a chain of top
// level awaits: Rapier's wasm, each blaster's model, the level, the Foamers'
// meshes. This records each named step with the time it took, writes the step
// being waited on into the page's status line ("Loading blasters 3 / 8"), and
// logs one `DART boot: <step> <ms>` line per step. With `?diag` a small
// readout stays up after boot: the browser, the mesher's mode and fallbacks
// (PT-09), and every step's time.
//
// The per-frame part is a counter: a page polls its Foamers' mesh state and
// only calls progress() when the count changed, so no frame allocates.

export interface BootStep {
  name: string;
  /** Milliseconds since the previous step finished (the step's own wait). */
  ms: number;
  /** Milliseconds since the report started (review: the total is what a
   *  slow browser's report needs). */
  at: number;
}

/** The one thing this needs from a status element: its text. */
export interface BootStatus {
  textContent: string | null;
}

export class BootReport {
  readonly steps: BootStep[] = [];
  /** Steps still being waited on are named by progress(); null for none. */
  private waiting = "";
  private done = 0;
  private total = 0;
  private last: number;
  private readonly start: number;
  private clock: () => number;
  /** Called after any step or progress change once set (the `?diag`
   *  readout redraws itself from it; review: it was drawn once, at the
   *  first frame, before the Foamers had landed). */
  onChange: (() => void) | null = null;
  /** True after finish(): the status line is the page's, not the boot's. */
  private quiet = false;

  constructor(
    private status: BootStatus | null = null,
    clock: () => number = () => performance.now(),
  ) {
    this.clock = clock;
    this.last = clock();
    this.start = this.last;
  }

  /** The step still being waited on, with its count, or "" for none. */
  get stillWaiting(): string {
    return this.waiting ? this.waitingText : "";
  }

  /** What the status line says right now. */
  get waitingText(): string {
    if (!this.waiting) return "Loading";
    return this.total > 0 ? `${this.waiting} ${this.done} / ${this.total}` : this.waiting;
  }

  /** Name the step being waited on, and how far it is (0 of 0 for a wait
   *  with no count). Call only when the text changes, not every frame.
   *  After finish() a late step (a Foamer mesh still arriving) records its
   *  name here and logs its step, but leaves the ready line alone. */
  progress(name: string, done = 0, total = 0): void {
    this.waiting = name;
    this.done = done;
    this.total = total;
    if (this.status && !this.quiet) this.status.textContent = this.waitingText;
    this.onChange?.();
  }

  /** Record a step that just finished: its time is since the last one.
   *  One console line, the same shape every page logs. */
  step(name: string): void {
    const now = this.clock();
    const ms = Math.max(0, now - this.last);
    this.last = now;
    this.waiting = "";
    this.steps.push({ name, ms, at: Math.max(0, now - this.start) });
    console.log(`DART boot: ${name} ${Math.round(ms)}`);
    this.onChange?.();
  }

  /** The boot is over: the status line hands over to the page's own text. */
  finish(ready: string): void {
    this.waiting = "";
    this.quiet = true;
    if (this.status) this.status.textContent = ready;
  }
}

let page: BootReport | null = null;
let fallbacks: (() => number) | null = null;

/** The page's one report: its `#status` if the page has one (the range now
 *  does, so a failed boot shows there), and the mesher fallback count going.
 *  The clock starts when this module first loads, close enough to the page's
 *  own start for a boot readout. */
export function pageBoot(): BootReport {
  page ??= new BootReport(
    typeof document === "undefined"
      ? null
      : document.querySelector<HTMLElement>("#status"),
  );
  fallbacks ??= countMesherFallbacks();
  return page;
}

/** PT-09 announces a main-thread mesh with a `mesher:` console warning, so
 *  the diag readout counts those instead of growing the pool's API for it.
 *  Returns a getter; the wrapper stays for the session (it only counts). */
export function countMesherFallbacks(): () => number {
  let n = 0;
  const warn = console.warn;
  console.warn = (...args: unknown[]) => {
    if (typeof args[0] === "string" && args[0].startsWith("mesher:")) n++;
    warn.apply(console, args);
  };
  return () => n;
}

/** The mesher's mode, read from the pool's own fields: "main thread", or how
 *  many workers it kept. */
export function mesherMode(pool: unknown): string {
  const p = pool as { slots?: unknown[]; noWorkers?: boolean } | null | undefined;
  const n = p?.slots?.length ?? 0;
  if (!p || p.noWorkers || n === 0) return "main thread";
  return `${n} worker${n === 1 ? "" : "s"}`;
}

/** The lines of the `?diag` readout. Redrawn on every boot change after
 *  the first frame (a late Foamer mesh shows when it lands). */
export function diagText(boot: BootReport, pool: unknown, fallbackCount: number, extra?: () => string): string {
  const browser = typeof navigator === "undefined" ? "unknown" : navigator.userAgent;
  const lines = [
    `Browser: ${browser}`,
    `Mesher: ${mesherMode(pool)}, ${fallbackCount} on the main thread`,
  ];
  for (const s of boot.steps) lines.push(`${s.name}: ${Math.round(s.ms)} ms (at ${Math.round(s.at)} ms)`);
  const waiting = boot.stillWaiting;
  if (waiting) lines.push(`Waiting: ${waiting}`);
  if (extra) lines.push(extra());
  return lines.join("\n");
}

/** Put the readout up, bottom left and small: `?diag` only. */
export function showDiag(boot: BootReport, pool: unknown, extra?: () => string): HTMLElement | null {
  if (!new URLSearchParams(location.search).has("diag")) return null;
  const el = document.createElement("pre");
  el.id = "diag";
  el.style.cssText =
    "position:fixed;left:8px;bottom:8px;margin:0;padding:6px;font:11px/1.4 monospace;" +
    "color:#fff;background:rgba(0,0,0,.65);pointer-events:none;z-index:30;white-space:pre";
  const draw = () => { el.textContent = diagText(boot, pool, fallbacks?.() ?? 0, extra); };
  draw();
  document.body.appendChild(el);
  boot.onChange = draw;
  // The mouse line changes without a boot step, so redraw twice a second
  // (`?diag` only).
  if (extra) setInterval(draw, 500);
  return el;
}

/** The game is running: record the first frame, write the ready line, and
 *  with `?diag` put the readout up. Call once, from the page's first render
 *  after it has drawn (that frame is also when the Input may take the
 *  mouse). */
export function firstFrame(boot: BootReport, ready: string, pool?: unknown, extra?: () => string): void {
  boot.step("First frame");
  boot.finish(ready);
  showDiag(boot, pool, extra);
}
