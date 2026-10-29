// Fixed-step simulation with a variable-rate render, so physics behaves the
// same at 30 fps and 144 fps.
export const STEP = 1 / 60;
const MAX_FRAME = 0.25;

export interface LoopHooks {
  /** Once per render frame, before any steps: read input, apply look. */
  frame(dt: number): void;
  /** Zero or more times per frame, always with dt = STEP. */
  update(dt: number): void;
  /** Once per render frame, after the steps. */
  render(dt: number): void;
}

export function startLoop(hooks: LoopHooks) {
  let last = performance.now() / 1000;
  let acc = 0;

  function frame() {
    const now = performance.now() / 1000;
    const dt = Math.min(now - last, MAX_FRAME);
    last = now;
    acc += dt;
    hooks.frame(dt);
    while (acc >= STEP) {
      hooks.update(STEP);
      acc -= STEP;
    }
    hooks.render(dt);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
