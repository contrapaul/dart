// Fixed-step simulation with a variable-rate render, so physics behaves the
// same at 30 fps and 144 fps.
export const STEP = 1 / 60;
const MAX_FRAME = 0.25;
/** A frame within this fraction of a whole number of refresh intervals is
 *  treated as exactly that many. */
const SNAP = 0.2;
/** Common display rates. A learned interval within 3% of one is taken as
 *  exact, so 60 and 120 Hz line up with the step and never drift. */
const RATES = [30, 50, 60, 72, 75, 90, 100, 120, 144, 165, 240];

export interface LoopHooks {
  /** Once per render frame, before any steps: read input, apply look. */
  frame(dt: number): void;
  /** Zero or more times per frame, always with dt = STEP. */
  update(dt: number): void;
  /** Once per render frame, after the steps. alpha (0 to 1) is how far the
   *  clock is between the last step and the next, for interpolation. */
  render(dt: number, alpha: number): void;
  /** After render, once per frame. Times in milliseconds. */
  stats?(s: FrameStats): void;
}

/** One set of frame statistics. The loop reuses one object every frame, so
 *  a hook must copy values out, not hold on to the object. */
export interface FrameStats {
  raw: number;    // rAF timestamp minus the previous one, unsnapped
  dt: number;     // what the frame clock returned, x1000
  steps: number;  // update() calls this frame
  work: number;   // performance.now() spent inside frame + updates + render
  updateWork: number; // of which, inside the update() calls
}

/**
 * Turns frame timestamps into steady frame times. Browsers round timers
 * (Firefox to about 1 ms), and a 60 Hz display beside a 60 Hz step then
 * sometimes runs two steps in one frame and none in the next: a visible
 * hitch about once a second. The clock learns the display's refresh
 * interval and snaps each frame to a whole number of intervals, so a 60 Hz
 * display runs exactly one step per frame.
 */
export function createFrameClock(initialSnap = true) {
  let last = -1;
  let refresh = 0; // learned refresh interval, seconds
  let snap = initialSnap;
  return {
    /** The raw interval of the last tick, in seconds; 0 for the first. */
    raw: 0,
    /** Snap on or off. Off, the raw interval is returned (still capped at
     *  MAX_FRAME), so the frame clock can be compared to the rAF clock. */
    setSnap(on: boolean): void { snap = on; },
    /** Seconds since the previous call; t is a timestamp in milliseconds. */
    tick(tMs: number): number {
      const t = tMs / 1000;
      let dt = last < 0 ? 0 : t - last;
      last = t;
      if (dt <= 0) return 0;
      this.raw = dt;
      if (!snap) return Math.min(dt, MAX_FRAME);
      // Learn the interval from frames near it; a dropped frame (about
      // twice as long) does not count, and a much shorter one restarts it.
      if (refresh === 0 || dt < refresh * 0.5) refresh = dt;
      else if (dt < refresh * 1.5) refresh += (dt - refresh) * 0.1;
      let interval = refresh;
      for (const hz of RATES) if (Math.abs(refresh * hz - 1) < 0.03) interval = 1 / hz;
      const n = Math.max(1, Math.round(dt / interval));
      if (Math.abs(dt - n * interval) < SNAP * interval) dt = n * interval;
      return Math.min(dt, MAX_FRAME);
    },
  };
}

export function startLoop(hooks: LoopHooks) {
  const clock = createFrameClock();
  const stats: FrameStats = { raw: 0, dt: 0, steps: 0, work: 0, updateWork: 0 };
  let acc = 0;

  // The rAF timestamp is the frame's display time, steadier than reading
  // performance.now() inside the callback. The work timers read
  // performance.now(), which is resolution enough for spotting a long
  // frame, not timing one.
  function frame(t: number) {
    const w0 = performance.now();
    const dt = clock.tick(t);
    acc += dt;
    hooks.frame(dt);
    const u0 = performance.now();
    let steps = 0;
    while (acc >= STEP) {
      hooks.update(STEP);
      acc -= STEP;
      steps++;
    }
    const u1 = performance.now();
    hooks.render(dt, acc / STEP);
    if (hooks.stats) {
      stats.raw = clock.raw * 1000;
      stats.dt = dt * 1000;
      stats.steps = steps;
      stats.updateWork = u1 - u0;
      stats.work = performance.now() - w0;
      hooks.stats(stats);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  return {
    /** Snap the frame clock on or off (the range page's switch, ENG-11). */
    setSnap(on: boolean): void { clock.setSnap(on); },
  };
}
