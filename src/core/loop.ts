// Fixed-step simulation with a variable-rate render, so physics behaves the
// same at 30 fps and 144 fps. ENG-01 builds on this.
export const STEP = 1 / 60;
const MAX_FRAME = 0.25;

export function startLoop(update: (dt: number) => void, render: () => void) {
  let last = performance.now() / 1000;
  let acc = 0;

  function frame() {
    const now = performance.now() / 1000;
    acc += Math.min(now - last, MAX_FRAME);
    last = now;
    while (acc >= STEP) {
      update(STEP);
      acc -= STEP;
    }
    render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
