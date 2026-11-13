import hazardData from "../../data/hazards.json";
import type { Prim, PrimBehaviour, PrimShape, Vec3 } from "../level/format";
import { isVoxelBreakable } from "../level/validate";
import { GRID, LIMITS, PALETTE, ROTATE_STEP, snapVec3 } from "./doc";

// ED-02 stage 3: the inspector's fields for the selected prims. It reads a
// prim and calls back with a patch; the page turns the patch into one undo
// step, so typing a number or picking a colour is one Ctrl+Z away.

const HAZARD_LOOKS = (hazardData as { looks: Record<string, unknown> }).looks;
const HAZARD_DEFAULTS = (hazardData as { defaults: { dps: number; slow: number } }).defaults;

export interface InspectorContext {
  /** One undo step changing every selected prim the same way. */
  change(patch: Partial<Prim>, text: string): void;
  /** One undo step for one prim (a rename). */
  changeOne(id: string, patch: Partial<Prim>, text: string): void;
  /** Rebuilds the panels: after a change the fields may need different ones
   *  (a behaviour brings its own block). */
  redraw(): void;
  /** The last colours used, newest first. */
  recent: string[];
  remember(colour: string): void;
}

function label(text: string): HTMLElement {
  const el = document.createElement("label");
  el.textContent = text;
  return el;
}

function numberInput(value: number, step: number, onCommit: (n: number) => void): HTMLInputElement {
  const input = document.createElement("input");
  input.type = "number";
  input.step = String(step);
  input.value = String(round(value));
  input.addEventListener("change", () => {
    const n = Number(input.value);
    if (Number.isFinite(n)) onCommit(n);
  });
  return input;
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/** Three number boxes for a vector, committed one at a time. */
function vecField(
  current: Vec3, step: number, snap: number, onChange: (v: Vec3) => void,
): HTMLElement {
  const host = document.createElement("div");
  host.className = "vec";
  const value: Vec3 = [...current] as Vec3;
  (["x", "y", "z"] as const).forEach((axis, i) => {
    const input = numberInput(current[i]!, step, (n) => {
      value[i] = n;
      const next = snap > 0 ? snapVec3(value, snap) : value;
      onChange(next as Vec3);
    });
    input.title = axis;
    host.append(input);
  });
  return host;
}

function selectField(options: string[], current: string, onChange: (v: string) => void): HTMLSelectElement {
  const select = document.createElement("select");
  for (const option of options) {
    const el = document.createElement("option");
    el.value = option;
    el.textContent = option;
    select.append(el);
  }
  select.value = current;
  select.addEventListener("change", () => onChange(select.value));
  return select;
}

/** A colour input over a row of swatches. Used for a prim's colour (the
 *  last six used, then the palette) and for the sky's three colours (the
 *  palette alone, so a sky does not fill the prim history). */
export function colourField(value: string, swatches: string[], onChange: (c: string) => void): HTMLElement {
  const host = document.createElement("div");
  host.className = "swatches";
  const input = document.createElement("input");
  input.type = "color";
  input.value = value;
  input.addEventListener("input", () => onChange(input.value));
  host.append(input);
  for (const colour of [...new Set(swatches)]) {
    const swatch = document.createElement("button");
    swatch.type = "button";
    swatch.style.background = colour;
    swatch.title = colour;
    swatch.addEventListener("click", () => onChange(colour));
    host.append(swatch);
  }
  return host;
}

/** The fields for the selected prims: every one of them when they agree,
 *  the first one's value when they do not, and one undo step per edit. */
export function buildPrimFields(host: HTMLElement, prims: Prim[], ctx: InspectorContext) {
  const first = prims[0]!;
  const same = (get: (p: Prim) => unknown) => prims.every((p) => JSON.stringify(get(p)) === JSON.stringify(get(first)));

  // The id, renamed only when one prim is selected (a shared id would be a
  // validator error, and a rename of two prims to one name is never meant).
  const idLabel = label("id");
  const idInput = document.createElement("input");
  idInput.type = "text";
  idInput.value = prims.length === 1 ? first.id : "(several)";
  idInput.disabled = prims.length !== 1;
  idInput.addEventListener("change", () => {
    const id = idInput.value.trim();
    if (id && id !== first.id) ctx.changeOne(first.id, { id }, `rename to ${id}`);
  });
  idLabel.append(idInput);
  host.append(idLabel);

  const shapeLabel = label("shape");
  shapeLabel.append(selectField(["box", "ramp", "wedge", "cylinder", "stairs"], same((p) => p.shape) ? first.shape : "", (v) => {
    ctx.change({ shape: v as PrimShape }, `shape ${v}`);
    ctx.redraw();
  }));
  host.append(shapeLabel);

  const posLabel = label("position");
  posLabel.append(vecField(first.pos, GRID, GRID, (v) => ctx.change({ pos: v }, "move")));
  host.append(posLabel);

  const sizeLabel = label("size");
  sizeLabel.append(vecField(first.size, GRID, GRID, (v) => {
    ctx.change({ size: v.map((n) => Math.max(GRID, n)) as Vec3 }, "size");
  }));
  host.append(sizeLabel);

  const rotLabel = label("rotation");
  rotLabel.append(vecField(first.rot ?? [0, 0, 0], ROTATE_STEP, ROTATE_STEP, (v) => ctx.change({ rot: v }, "rotate")));
  host.append(rotLabel);

  const colourLabel = label("colour");
  colourLabel.append(colourField(first.colour, [...ctx.recent, ...PALETTE], (c) => {
    ctx.remember(c);
    ctx.change({ colour: c }, "colour");
  }));
  host.append(colourLabel);

  const behaviourLabel = label("behaviour");
  behaviourLabel.append(selectField(
    ["solid", "breakable", "hazard", "decor"],
    same((p) => p.behaviour) ? first.behaviour : "",
    (v) => {
      const behaviour = v as PrimBehaviour;
      const patch: Partial<Prim> = { behaviour };
      // A behaviour needs its own block: a hazard its look, a breakable
      // shape that is not voxel foam its hit points.
      if (behaviour === "hazard" && !first.hazard) {
        patch.hazard = { dps: HAZARD_DEFAULTS.dps, slow: HAZARD_DEFAULTS.slow, look: Object.keys(HAZARD_LOOKS)[0] ?? "toxic" };
      }
      if (behaviour === "breakable") {
        patch.hitPoints = first.hitPoints ?? 3;
        patch.steps = first.shape === "stairs" ? first.steps ?? 4 : first.steps;
      }
      ctx.change(patch, `behaviour ${v}`);
      ctx.redraw();
    },
  ));
  host.append(behaviourLabel);

  if (first.shape === "stairs") {
    const stepsLabel = label("steps");
    stepsLabel.append(numberInput(first.steps ?? 4, 1, (n) => {
      const steps = Math.max(2, Math.min(LIMITS.stairsMaxSteps, Math.round(n)));
      ctx.change({ steps }, "steps");
    }));
    host.append(stepsLabel);
  }

  if (first.behaviour === "hazard") {
    const h = first.hazard ?? { dps: HAZARD_DEFAULTS.dps, look: "toxic" };
    const lookLabel = label("look");
    lookLabel.append(selectField(Object.keys(HAZARD_LOOKS), h.look, (v) => {
      ctx.change({ hazard: { ...h, look: v } }, "hazard look");
    }));
    host.append(lookLabel);
    const dpsLabel = label("damage/s");
    dpsLabel.append(numberInput(h.dps, 1, (n) => {
      ctx.change({ hazard: { ...h, dps: Math.max(0, n) } }, "hazard dps");
    }));
    host.append(dpsLabel);
    const slowLabel = label("slow");
    slowLabel.append(numberInput(h.slow ?? 1, 0.05, (n) => {
      ctx.change({ hazard: { ...h, slow: Math.max(0, Math.min(1, n)) } }, "hazard slow");
    }));
    host.append(slowLabel);
    const hurtsLabel = document.createElement("label");
    const hurts = document.createElement("input");
    hurts.type = "checkbox";
    hurts.checked = h.hurtsFoamers !== false;
    hurts.addEventListener("change", () => {
      ctx.change({ hazard: { ...h, hurtsFoamers: hurts.checked } }, "hazard hurts Foamers");
    });
    hurtsLabel.append(document.createTextNode("hurts Foamers"), hurts);
    host.append(hurtsLabel);
  }

  if (first.behaviour === "breakable" && !prims.every(isVoxelBreakable)) {
    const hpLabel = label("hit points");
    hpLabel.append(numberInput(first.hitPoints ?? 3, 1, (n) => {
      ctx.change({ hitPoints: Math.max(1, Math.round(n)) }, "hit points");
    }));
    host.append(hpLabel);
  }

  const hiddenLabel = document.createElement("label");
  const hidden = document.createElement("input");
  hidden.type = "checkbox";
  hidden.checked = first.hidden === true;
  hidden.addEventListener("change", () => {
    ctx.change({ hidden: hidden.checked ? true : undefined }, hidden.checked ? "hide" : "show");
  });
  hiddenLabel.append(document.createTextNode("starts hidden"), hidden);
  host.append(hiddenLabel);
}
