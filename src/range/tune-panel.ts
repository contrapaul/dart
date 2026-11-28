// R3-14: the Tune section of the range's panel. One row per field in the
// fields file, grouped Fire / Ammo / Movement; a row whose field is changed
// by this browser's override gets a reset beside it. Every edit goes through
// tuneBlaster, so the editor, the arena and play see the same numbers. The
// panel draws what blaster-fields.ts reports; it holds no tuning logic of
// its own.

import type { Loadout } from "../weapons/loadout";
import {
  exportTuning, onTuningChange, resetTuning, tuneBlaster,
} from "../core/tuning";
import {
  FIELDS, committedValue, isChanged, patchFor, valueInForce, type BlasterField,
} from "./blaster-fields";

const GROUPS = ["Fire", "Ammo", "Movement"] as const;

export class TunePanel {
  private rows = new Map<string, { input: HTMLInputElement; out: HTMLElement; reset: HTMLButtonElement }>();

  constructor(
    private root: HTMLElement,
    private loadout: Loadout,
  ) {
    this.render();
    onTuningChange(() => this.refresh());
  }

  /** Rebuild the rows for the held blaster (a blaster change). */
  render(): void {
    this.root.textContent = "";
    this.rows.clear();
    const id = this.blasterId();
    for (const group of GROUPS) {
      const fields = FIELDS.filter((f) => f.group === group);
      if (fields.length === 0) continue;
      const h = document.createElement("p");
      h.className = "tuneGroup";
      h.textContent = group;
      this.root.appendChild(h);
      for (const field of fields) this.addRow(id, field);
    }
    this.addButtons();
  }

  /** Update every row in place after a tuning change (a slider drag must
   *  not be interrupted, so the rows are kept). */
  refresh(): void {
    const id = this.blasterId();
    for (const [key, row] of this.rows) {
      const field = FIELDS.find((f) => f.key === key)!;
      // An input being dragged keeps its own value: the readout follows
      // the drag, not the store echo.
      if (document.activeElement !== row.input) row.input.value = String(valueInForce(id, field));
      row.out.textContent = String(valueInForce(id, field));
      row.reset.hidden = !isChanged(id, field);
    }
  }

  private blasterId(): string {
    return this.loadout.activeId();
  }

  private addRow(id: string, field: BlasterField): void {
    const row = document.createElement("label");
    row.className = "tuneRow";
    const name = document.createElement("span");
    name.className = "tuneName";
    name.textContent = field.note ? `${field.label} (${field.note})` : field.label;
    const input = document.createElement("input");
    input.type = "range";
    input.min = String(field.min);
    input.max = String(field.max);
    input.step = String(field.step);
    input.value = String(valueInForce(id, field));
    input.addEventListener("input", () => {
      tuneBlaster(id, patchFor(field, Number(input.value)));
    });
    const out = document.createElement("span");
    out.className = "tuneVal";
    out.textContent = String(valueInForce(id, field));
    const reset = document.createElement("button");
    reset.type = "button";
    reset.className = "tuneReset";
    reset.textContent = "Reset";
    reset.addEventListener("click", () => {
      tuneBlaster(id, patchFor(field, committedValue(id, field)));
    });
    this.showOrHideReset(reset, isChanged(id, field));
    // The readout follows the input, not the store (the store rebuilds the
    // panel on every change, so a store echo would fight the slider).
    input.addEventListener("input", () => { out.textContent = input.value; });
    row.append(name, input, out, reset);
    this.root.appendChild(row);
    this.rows.set(field.key, { input, out, reset });
  }

  private showOrHideReset(reset: HTMLButtonElement, changed: boolean): void {
    reset.hidden = !changed;
  }

  private addButtons(): void {
    const id = this.blasterId();
    const row = document.createElement("div");
    row.className = "row tuneButtons";
    const resetOne = document.createElement("button");
    resetOne.type = "button";
    resetOne.textContent = "Reset this blaster";
    resetOne.addEventListener("click", () => resetTuning({ blaster: id }));
    const resetAll = document.createElement("button");
    resetAll.type = "button";
    resetAll.textContent = "Reset all tuning";
    resetAll.addEventListener("click", () => {
      if (window.confirm("Reset all tuning in this browser? The committed file is untouched.")) resetTuning();
    });
    const exportBtn = document.createElement("button");
    exportBtn.type = "button";
    exportBtn.textContent = "Export tuning";
    exportBtn.addEventListener("click", () => exportTuningFile());
    row.append(resetOne, resetAll, exportBtn);
    this.root.appendChild(row);
  }
}

/** Download the tuning in force as tuning.json. */
export function exportTuningFile(): void {
  const blob = new Blob([exportTuning()], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "tuning.json";
  a.click();
  URL.revokeObjectURL(url);
}
