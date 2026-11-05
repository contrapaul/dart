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
  // Health (UI-01): a chunky foam-lime bar bottom-left with the number
  // beside it, a white flash of the bar on each hit, and a cream edge
  // glow over the whole screen. Writes only happen when a value changed
  // or a hit arrives.
  private bar: HTMLElement;
  private barFill: HTMLElement;
  private healthNum: HTMLElement;
  private flash: HTMLElement;
  private lastHp = -1;
  private lastMax = -1;
  // GAME-07: the finisher prompt by the crosshair, and the heal flash
  // (green, never red). Writes only on a change, like the rest of the
  // HUD.
  private prompt: HTMLElement;
  private lastPrompt = "";
  private lock: HTMLElement | null = null;
  private lastLock = false;
  private pips = document.querySelector<HTMLElement>("#meleepips");
  private lastPips = "";
  private heal: HTMLElement;
  private healTimer = 0;
  private ammoTimer = 0;
  /** Stage 2 wires this to the reduce flashes setting; while false the
   *  cream edge glow stays off (the bar's own flash still shows). */
  reduceFlashes = false;
  private flashTimer = 0;

  constructor(root: HTMLElement) {
    this.root = root;
    this.ammo = root.querySelector<HTMLElement>("#ammo")!;
    this.ammo.textContent = "";
    this.bar = root.querySelector<HTMLElement>("#health .bar")!;
    this.barFill = this.bar.querySelector<HTMLElement>("i")!;
    this.healthNum = root.querySelector<HTMLElement>("#health .num")!;
    // The edge glow sits outside the HUD root (it shows over the popped
    // overlay too), so it is looked up on the document.
    this.flash = document.querySelector<HTMLElement>("#hitflash")!;
    this.prompt = root.querySelector<HTMLElement>("#finishprompt")!;
    this.lock = root.querySelector<HTMLElement>("#lockmarker");
    this.heal = document.querySelector<HTMLElement>("#healflash")!;
    this.setHealth(0, 0); // hides until the first real update
    this.lastHp = -1;
    this.lastMax = -1;
    this.show(false);
  }

  /** GAME-07: the finisher prompt by the crosshair, showing the bound key
   *  while a weakened Foamer stands in reach and in the view. Writes only
   *  on a change (the prompt flickers in and out as the view moves). */
  setFinishPrompt(show: boolean, key: string) {
    if (this.root.hidden) { this.lastPrompt = ""; return; }
    const text = show ? key : "";
    if (text === this.lastPrompt) return;
    this.lastPrompt = text;
    this.prompt.hidden = !show;
    if (show) this.prompt.textContent = key;
  }

  /** GAME-06: the melee's charge pips near the shield area (under the
   *  health bar): one filled pip per charge, and a pip that pulses when a
   *  parry (or the timer) refills one. Writes only on a change. */
  meleePips(charges: number, max: number, pulse: boolean) {
    const el = this.pips;
    if (!el || this.root.hidden) return;
    const key = `${charges}/${max}`;
    if (key !== this.lastPips) {
      this.lastPips = key;
      el.textContent = "";
      for (let i = 0; i < max; i++) {
        const pip = document.createElement("i");
        if (i < charges) pip.classList.add("full");
        el.appendChild(pip);
      }
    }
    if (!pulse) return;
    const pip = el.children[Math.max(0, Math.min(charges, max) - 1)];
    if (!pip) return;
    pip.classList.remove("pulse");
    // Restart the animation even when the class was already on.
    void (pip as HTMLElement).offsetWidth;
    pip.classList.add("pulse");
  }

  /** GAME-05: the lock marker, the crosshair's ring while a charge
   *  target is locked. The page calls it with the disc's raised state
   *  (the lock exists only with the disc up); no marker element on a
   *  page is a silent off (the range has no #lockmarker yet). */
  setChargeLock(show: boolean) {
    if (!this.lock) return;
    if (this.root.hidden) return;
    if (show === this.lastLock) return;
    this.lastLock = show;
    this.lock.hidden = !show;
  }

  /** GAME-07: the green edge glow on a pickup collect, never red (the
   *  hit flash is cream). Suppressed by reduce flashes, like a hit. */
  healFlash() {
    if (this.root.hidden) return;
    if (this.reduceFlashes) return;
    this.heal.classList.add("on");
    window.clearTimeout(this.healTimer);
    this.healTimer = window.setTimeout(() => this.heal.classList.remove("on"), 200);
  }

  /** LVL-02a: the ammo box collect: a small pulse of the counter itself
   *  (the heal flash is a green edge glow; a box is not health, so it gets
   *  its own). Suppressed by reduce flashes, like the heal flash. */
  ammoFlash() {
    if (this.root.hidden) return;
    if (this.reduceFlashes) return;
    this.ammo.classList.add("topped");
    window.clearTimeout(this.ammoTimer);
    this.ammoTimer = window.setTimeout(() => this.ammo.classList.remove("topped"), 250);
  }

  show(visible: boolean): void {
    this.root.hidden = !visible;
    if (!visible) {
      this.lastText = "";
      this.lastPipCount = -1;
      this.lastPipState = -1;
      this.lastHp = -1;
      this.lastMax = -1;
      this.clearFlash();
    }
  }

  /** Draw the health bar and number; only the DOM is touched when a
   *  value actually changed. */
  setHealth(hp: number, max: number): void {
    if (this.root.hidden) return;
    if (hp === this.lastHp && max === this.lastMax) return;
    this.lastHp = hp;
    this.lastMax = max;
    const pct = max > 0 ? Math.max(0, Math.min(1, hp / max)) : 0;
    this.barFill.style.width = `${Math.round(pct * 100)}%`;
    this.bar.classList.toggle("low", pct <= 0.3);
    this.healthNum.textContent = String(Math.ceil(hp));
  }

  /** A hit landed: the bar flashes white and the screen edges glow
   *  cream (never red). The page calls this when damage was applied. */
  onHit(): void {
    if (this.root.hidden) return;
    this.bar.classList.add("hit");
    if (!this.reduceFlashes) this.flash.classList.add("on");
    window.clearTimeout(this.flashTimer);
    this.flashTimer = window.setTimeout(() => this.clearFlash(), 160);
  }

  /** The pop: a soft foam-core (warm cream) edge glow, longer than a hit
   *  flash. No red anywhere (CLAUDE.md). Shown even after the HUD hid: the
   *  glow element lives outside the HUD root, over the dimmed scene. */
  popFlash(): void {
    this.flash.classList.add("pop");
    window.clearTimeout(this.flashTimer);
    this.flashTimer = window.setTimeout(() => this.clearFlash(), 600);
  }

  /** Hide the hit feedback (on pause or respawn). */
  clearFlash(): void {
    window.clearTimeout(this.flashTimer);
    this.flash.classList.remove("on");
    this.flash.classList.remove("pop");
    this.bar.classList.remove("hit");
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
