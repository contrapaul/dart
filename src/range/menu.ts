import type { Loadout } from "../weapons/loadout";
import { modIds } from "../weapons/loadout";

// PT-01 stage 3: the range menu. The card asks for one thing on the default
// page: the active blaster's name, a button per mod of it, lit when on, and
// Respawn. The old switches, spawn buttons, type picker, sound rows, report
// and frame graph stay on the page behind `range.html?bench`.
//
// The logic is a plain model with no DOM in it, so a headless test drives
// exactly what the panel's buttons drive.

/** One mod button: the mod's name and whether it is on now. */
export interface ModButton {
  mod: string;
  on: boolean;
}

export class RangeMenu {
  /** Called after anything the page must redraw (the blaster name, the mod
   *  row, the ammo). The panel sets it; a test can leave it alone. */
  onChanged: () => void = () => {};

  constructor(private loadout: Loadout) {}

  /** The active blaster as the menu shows it: its id and its name from the
   *  data (`B01 The Dartman`). */
  blasterLabel(): string {
    return `${this.loadout.activeId()} ${this.loadout.active.spec.name}`;
  }

  /** The active blaster's mods, in data order, each with whether it is on. */
  modButtons(): ModButton[] {
    const i = this.loadout.activeIndex;
    return modIds(this.loadout.activeId()).map((mod) => ({
      mod,
      on: this.loadout.modsOf(i).includes(mod),
    }));
  }

  /** A click on a mod button: flip it and report the change. A mod that the
   *  active blaster does not have does nothing. */
  toggleMod(mod: string): void {
    const i = this.loadout.activeIndex;
    if (!modIds(this.loadout.activeId()).includes(mod)) return;
    this.loadout.setMod(i, mod, !this.loadout.modsOf(i).includes(mod));
    this.onChanged();
  }

  /** Keys 1 to 3 and the wheel select a blaster; the menu follows, so the
   *  page calls this after any of them. */
  blasterChanged(): void {
    this.onChanged();
  }
}

/** The menu in the panel: the blaster name, one button per mod, lit when on,
 *  and the Respawn button. Both live in the paused overlay, which Esc shows
 *  and the Play button (or a click on the canvas) closes. */
export class RangeMenuPanel {
  constructor(
    private menu: RangeMenu,
    private nameEl: HTMLElement,
    private modRow: HTMLElement,
    respawnBtn: HTMLButtonElement,
    onRespawn: () => void,
  ) {
    respawnBtn.addEventListener("click", () => onRespawn());
    menu.onChanged = () => this.render();
    this.render();
  }

  render(): void {
    this.nameEl.textContent = this.menu.blasterLabel();
    this.modRow.textContent = "";
    for (const b of this.menu.modButtons()) {
      const el = document.createElement("button");
      el.textContent = b.mod;
      el.dataset.mod = b.mod;
      if (b.on) el.classList.add("on");
      el.addEventListener("click", () => this.menu.toggleMod(b.mod));
      this.modRow.appendChild(el);
    }
  }
}
