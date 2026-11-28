// ED-36: the Paint tool's option panel. It lists the surfaces as small
// swatches (drawn from the same canvases the textures use) and the palette
// colours, and is the only thing the paint tool knows: the page (main.ts)
// owns the state and the painting itself.

import { drawSurface, SURFACES, SURFACE_NAMES } from "../render/surfaces";
import { EDITOR, PALETTE } from "./doc";

/** The paint tool's settings: the surface to brush on, and the colour to
 *  brush (null keeps the prim's own colour). */
export interface PaintSettings {
  surface: string;
  colour: string | null;
  /** Brush (drag) or Bucket (click). R3-03. */
  mode: "brush" | "bucket";
  /** The brush on the ground, its own and not the Terrain tool's (Paul,
   *  2026-11-28): metres, and how fast it lays the paint (a share a
   *  second). Prims are painted whole, so they ignore both. */
  radius: number;
  strength: number;
}

/** The paint brush's starting numbers and slider ends, data/editor.json. */
export const PAINT_BRUSH = EDITOR.paint as { radius: number; strength: number; maxRadius: number; maxStrength: number };

/** A small canvas of one surface, drawn from the same pixels the texture
 *  uses (negated? no: the grey pattern, tinted at paint time by the
 *  prim's colour, so a swatch shows the pattern as greys). */
export function swatchCanvas(name: string, size = 32): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  const img = drawSurface(name);
  if (!img) {
    ctx.fillStyle = "#d9d2c2";
    ctx.fillRect(0, 0, size, size);
    return canvas;
  }
  const full = document.createElement("canvas");
  full.width = full.height = img.width;
  const fullCtx = full.getContext("2d");
  if (!fullCtx) return canvas;
  const data = fullCtx.createImageData(img.width, img.height);
  data.data.set(img.data);
  fullCtx.putImageData(data, 0, 0);
  ctx.drawImage(full, 0, 0, img.width, img.height, 0, 0, size, size);
  return canvas;
}

/** The option panel beside an armed Paint button: one swatch per surface
 *  (plain shows a plain swatch), then the palette colours, with a colour
 *  button that keeps the prim's own colour. Calls onChange after every
 *  pick, so the page knows the new state. */
export function buildPaintPanel(state: PaintSettings, onChange: () => void): HTMLElement {
  const panel = document.createElement("div");
  panel.className = "tool-options paint-options";

  const modes = document.createElement("div");
  modes.className = "paint-modes";
  for (const m of ["brush", "bucket"] as const) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = m === "brush" ? "Brush" : "Bucket";
    b.dataset.mode = m;
    b.setAttribute("aria-pressed", String(state.mode === m));
    if (state.mode === m) b.classList.add("on");
    b.addEventListener("click", () => {
      state.mode = m;
      onChange();
    });
    modes.append(b);
  }
  panel.append(modes);

  const surfaceTitle = document.createElement("span");
  surfaceTitle.className = "paint-title";
  surfaceTitle.textContent = "Surface";
  panel.append(surfaceTitle);

  const swatches = document.createElement("div");
  swatches.className = "paint-swatches";
  for (const name of SURFACE_NAMES) {
    const spec = SURFACES[name];
    if (!spec) continue;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "paint-swatch" + (state.surface === name ? " on" : "");
    button.title = spec.label;
    button.setAttribute("aria-label", `Surface ${spec.label}`);
    button.setAttribute("aria-pressed", String(state.surface === name));
    button.append(swatchCanvas(name));
    button.addEventListener("click", () => {
      state.surface = name;
      onChange();
    });
    swatches.append(button);
  }
  panel.append(swatches);

  const colourTitle = document.createElement("span");
  colourTitle.className = "paint-title";
  colourTitle.textContent = "Colour";
  panel.append(colourTitle);

  const colours = document.createElement("div");
  colours.className = "paint-colours";
  const keep = document.createElement("button");
  keep.type = "button";
  keep.className = "paint-colour" + (state.colour === null ? " on" : "");
  keep.title = "Keep the prim's own colour";
  keep.setAttribute("aria-label", "Keep the prim's colour");
  keep.setAttribute("aria-pressed", String(state.colour === null));
  keep.append(document.createTextNode("·"));
  keep.addEventListener("click", () => {
    state.colour = null;
    onChange();
  });
  colours.append(keep);
  for (const colour of PALETTE) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "paint-colour" + (state.colour === colour ? " on" : "");
    button.title = colour;
    button.setAttribute("aria-label", `Paint ${colour}`);
    button.setAttribute("aria-pressed", String(state.colour === colour));
    button.style.background = colour;
    button.addEventListener("click", () => {
      state.colour = colour;
      onChange();
    });
    colours.append(button);
  }
  panel.append(colours);

  // The brush for the ground. Sliders change the numbers in place without
  // redrawing the panel, so a drag on one is not interrupted. Hidden in
  // Bucket mode, where the whole terrain fills at once.
  if (state.mode === "brush") {
    const brushTitle = document.createElement("span");
    brushTitle.className = "paint-title";
    brushTitle.textContent = "Brush on the terrain";
    panel.append(brushTitle);
    panel.append(
      paintSlider("size", state.radius, 0.5, PAINT_BRUSH.maxRadius, 0.5, (v) => { state.radius = v; }),
      paintSlider("strength", state.strength, 0.5, PAINT_BRUSH.maxStrength, 0.5, (v) => { state.strength = v; }),
    );
  }
  return panel;
}

function paintSlider(name: string, value: number, min: number, max: number, step: number, set: (v: number) => void): HTMLElement {
  const wrap = document.createElement("label");
  wrap.className = "paint-slider";
  const text = document.createElement("span");
  text.textContent = `${name} ${value}`;
  const input = document.createElement("input");
  input.type = "range";
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.value = String(value);
  input.setAttribute("aria-label", `Paint brush ${name}`);
  input.addEventListener("input", () => {
    const v = Number(input.value);
    set(v);
    text.textContent = `${name} ${v}`;
  });
  wrap.append(text, input);
  return wrap;
}
