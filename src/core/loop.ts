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
}

/**
 * Turns frame timestamps into steady frame times. Browsers round timers
 * (Firefox to about 1 ms), and a 60 Hz display beside a 60 Hz step then
 * sometimes runs two steps in one frame and none in the next: a visible
 * hitch about once a second. The clock learns the display's refresh
 * interval and snaps each frame to a whole number of intervals, so a 60 Hz
 * display runs exactly one step per frame.
 */
export function createFrameClock() {
  let last = -1;
  let refresh = 0; // learned refresh interval, seconds
  return {
    /** Seconds since the previous call; t is a timestamp in milliseconds. */
    tick(tMs: number): number {
      const t = tMs / 1000;
      let dt = last < 0 ? 0 : t - last;
      last = t;
      if (dt <= 0) return 0;
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
  let acc = 0;

  // The rAF timestamp is the frame's display time, steadier than reading
  // performance.now() inside the callback.
  function frame(t: number) {
    const dt = clock.tick(t);
    acc += dt;
    hooks.frame(dt);
    while (acc >= STEP) {
      hooks.update(STEP);
      acc -= STEP;
    }
    hooks.render(dt, acc / STEP);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
