// R3 (Paul, 2026-11-28): the Foamer tuning panel. A toggle between "This
// Foamer" (the placed one's own tuning, one undo step) and "Every <type>"
// (the type, shared by every workspace, via tuneFoamer). Changed fields are
// marked, with a small reset beside them.

import { deepMerge, exportTuning, removeLeaves, resetTuning, tuneFoamer, untuneFoamer } from "../core/tuning";
import type { FoamerTune } from "../core/tuning";
import { tunedOne } from "../foamers/foamers";
import type { PlacedFoamer } from "../level/format";
import { fieldsFor, committedValue, type FieldValue } from "./tuning-fields";

export interface TuningPanelContext {
  /** One undo step for a patch to the selected Foamer ("This Foamer" edits). */
  change(patch: Record<string, unknown>, text: string): void;
  /** Rebuilds the panel (a kind's fields differ by what is chosen). */
  redraw(): void;
}

type Mode = "own" | "type";

let mode: Mode = "own";

/** The editor's Foamer inspector appends this under the other fields. */
export function buildTuningPanel(host: HTMLElement, f: PlacedFoamer, ctx: TuningPanelContext) {
  const type = f.foamer;
  const section = document.createElement("section");
  section.className = "tuning-panel";

  const toggle = document.createElement("div");
  toggle.className = "tuning-toggle";
  for (const [key, text] of [["own", "This Foamer"], ["type", `Every ${type}`]] as [Mode, string][]) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = text;
    btn.classList.toggle("active", mode === key);
    btn.addEventListener("click", () => {
      mode = key;
      ctx.redraw();
    });
    toggle.append(btn);
  }
  section.append(toggle);

  const own = mode === "own" ? f.tuning : undefined;
  const { spec, rig } = tunedOne(type, own, f.promoted === true);
  const fields = fieldsFor(type, own, f.promoted === true);
  for (const group of ["Movement", "Health", "Size", "Damage dealt", "Attack speed", "Damage taken"] as const) {
    const rows = fields.filter((v) => v.field.group === group);
    if (!rows.length) continue;
    const h = document.createElement("h3");
    h.textContent = group;
    section.append(h);
    for (const row of rows) section.append(buildRow(row, f, spec, rig, ctx));
  }

  // Buttons.
  const buttons = document.createElement("div");
  buttons.className = "tuning-buttons";
  const resetType = document.createElement("button");
  resetType.type = "button";
  resetType.textContent = "Reset this type";
  resetType.addEventListener("click", () => {
    resetTuning({ foamer: type });
    ctx.redraw();
  });
  const resetAll = document.createElement("button");
  resetAll.type = "button";
  resetAll.textContent = "Reset all tuning";
  resetAll.addEventListener("click", () => {
    if (!window.confirm("Clear all tuning (this browser's override)? The committed data is not touched.")) return;
    resetTuning();
    ctx.redraw();
  });
  const exportBtn = document.createElement("button");
  exportBtn.type = "button";
  exportBtn.textContent = "Export tuning";
  exportBtn.addEventListener("click", () => downloadTuning());
  buttons.append(resetType, resetAll, exportBtn);
  section.append(buttons);
  host.append(section);
}

function buildRow(row: FieldValue, f: PlacedFoamer, spec: ReturnType<typeof tunedOne>["spec"], rig: ReturnType<typeof tunedOne>["rig"], ctx: TuningPanelContext) {
  const { field, value, changed } = row;
  const label = document.createElement("label");
  label.className = "tuning-row" + (changed ? " changed" : "");
  const name = document.createElement("span");
  name.className = "tuning-name";
  name.textContent = field.label;
  name.title = field.title;
  const input = document.createElement("input");
  input.type = "number";
  input.step = String(field.step);
  input.min = String(field.min);
  input.max = String(field.max);
  input.title = field.title;
  input.value = String(Math.round(value * 1000) / 1000);
  input.addEventListener("change", () => {
    const n = Number(input.value);
    if (!Number.isFinite(n)) return;
    commit(field.patch(spec, rig, n), f, ctx, `tuning ${field.id}`);
    ctx.redraw();
  });
  label.append(name, input);
  if (changed) {
    const reset = document.createElement("button");
    reset.type = "button";
    reset.className = "tuning-reset";
    reset.textContent = "reset";
    reset.title = "Back to the committed value";
    reset.addEventListener("click", () => {
      // Forget the change (the GPU1 reviewer: writing the committed value
      // back left a no-op entry, kept the "changed" note on and went into
      // the export).
      const which = field.patch(spec, rig, committedValue(field, f.foamer));
      if (mode === "own") {
        ctx.change({ tuning: removeLeaves(f.tuning, which) }, `reset ${field.id}`);
      } else untuneFoamer(f.foamer, which);
      ctx.redraw();
    });
    label.append(reset);
  }
  return label;
}

function commit(patch: FoamerTune, f: PlacedFoamer, ctx: TuningPanelContext, text: string) {
  if (mode === "own") {
    const tuning = mergeTune(f.tuning, patch);
    ctx.change({ tuning }, text);
  } else {
    tuneFoamer(f.foamer, patch);
  }
}

export function mergeTune(a: FoamerTune | undefined, b: FoamerTune): FoamerTune {
  // One undo step per edit: the patch is merged into the existing tuning.
  return deepMerge(a ?? {}, b) as FoamerTune;
}

function downloadTuning() {
  const blob = new Blob([exportTuning()], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "tuning.json";
  a.click();
  URL.revokeObjectURL(url);
}
