import type { Blaster, BlasterState } from "../weapons/blaster";

// Crosshair and ammo counter in the DOM, layered over the canvas. The
// counter shows the blaster name and mag / reserve bottom-right, with the
// word RELOAD while reloading and PRIMING while the pump action returns.
// A break-action blaster also gets one pip per barrel, filled while a
// shell is in the barrel. Only the DOM is touched when a value actually
// changed. No web fonts: system-ui from style.css carries this.
export class Hud {
  private root: HTMLElement;
  private ammo: HTMLElement;
  private lastText = "";
  private lastPipCount = -1;
  private lastPipState = -1; // packed: bit i set = shell in barrel i

  constructor(root: HTMLElement) {
    this.root = root;
    this.ammo = root.querySelector<HTMLElement>("#ammo")!;
    this.ammo.textContent = "";
    this.show(false);
  }

  show(visible: boolean): void {
    this.root.hidden = !visible;
    if (!visible) {
      this.lastText = "";
      this.lastPipCount = -1;
      this.lastPipState = -1;
    }
  }

  setAmmo(b: Blaster, state: BlasterState): void {
    if (this.root.hidden) return;
    const label =
      state === "reloading" ? "RELOAD" : state === "priming" ? "PRIMING" : "AMMO";
    const mag = b.spec.mode === "break" ? b.loaded.filter(Boolean).length : b.mag;
    const text = `${b.spec.name}\n${label} ${mag} / ${b.reserve}`;
    if (text !== this.lastText) {
      this.lastText = text;
      this.ammo.textContent = text;
    }
    // Pips only on the break action; hide them on the others.
    const isBreak = b.spec.mode === "break";
    const n = isBreak ? b.loaded.length : 0;
    let state_ = 0;
    if (isBreak) for (let i = 0; i < b.loaded.length; i++) if (b.loaded[i]) state_ |= 1 << i;
    if (n !== this.lastPipCount || state_ !== this.lastPipState) {
      this.lastPipCount = n;
      this.lastPipState = state_;
      this.setPips(n, state_);
    }
  }

  private setPips(n: number, state_: number): void {
    // Rebuild the pip row only when the count or the state changed.
    let row = this.ammo.querySelector<HTMLElement>(".pips");
    if (n === 0) {
      if (row) row.remove();
      return;
    }
    if (!row) {
      row = document.createElement("div");
      row.className = "pips";
      this.ammo.appendChild(row);
    }
    // Build or reuse pip nodes.
    while (row.childNodes.length < n) {
      const d = document.createElement("i");
      d.className = "pip";
      row.appendChild(d);
    }
    while (row.childNodes.length > n) row.removeChild(row.lastChild!);
    for (let i = 0; i < n; i++) {
      row.children[i].classList.toggle("full", Boolean((state_ >> i) & 1));
    }
  }
}
