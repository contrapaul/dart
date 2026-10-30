import type { BlasterState } from "../weapons/blaster";

// Crosshair and ammo counter in the DOM, layered over the canvas. The
// counter shows mag / reserve bottom-right, with the word RELOAD while
// reloading and PRIMING while the pump action returns. Only the DOM is
// touched when a value actually changed. No web fonts: system-ui from
// style.css carries this.

export class Hud {
  private root: HTMLElement;
  private ammo: HTMLElement;
  private lastMag = -1;
  private lastReserve = -1;
  private lastState: BlasterState | "off" = "off";

  constructor(root: HTMLElement) {
    this.root = root;
    this.ammo = root.querySelector<HTMLElement>("#ammo")!;
    this.show(false);
  }

  show(visible: boolean): void {
    this.root.hidden = !visible;
    if (!visible) {
      this.lastMag = -1;
      this.lastReserve = -1;
      this.lastState = "off";
    }
  }

  setAmmo(mag: number, reserve: number, state: BlasterState): void {
    if (this.root.hidden) return;
    if (mag === this.lastMag && reserve === this.lastReserve && state === this.lastState)
      return;
    this.lastMag = mag;
    this.lastReserve = reserve;
    this.lastState = state;
    const label =
      state === "reloading" ? "RELOAD" : state === "priming" ? "PRIMING" : "AMMO";
    this.ammo.textContent = `${label} ${mag} / ${reserve}`;
  }
}
