import * as THREE from "three";
import editorData from "../../data/editor.json";
import type { Terrain } from "../level/format";
import {
  applyBrush, flatTerrain, heightAt, terrainBounds, tidyTerrain, type Brush, type BrushMode,
} from "../level/terrain";
import { SURFACES, SURFACE_NAMES } from "../render/surfaces";
import type { LevelDoc } from "./doc";
import type { EditorView } from "./view";
import { colourField } from "./inspector";

// ED-34 (design/EDITOR-V2.md): the Terrain tool. Armed, a left drag on the
// terrain runs a brush (raise, lower, flatten, smooth, noise, paint) under
// the cursor every frame, on a working copy of the terrain; letting go
// writes it back as one undo step. With no terrain yet, arming the tool
// makes a flat one. The brush numbers start from data/editor.json
// `terrain`.

/** The outliner's and the inspector's id for the level's terrain. It is
 *  not an entry: a level has one terrain or none. */
export const TERRAIN_ID = "@terrain";

const T = editorData.terrain as {
  maxCells: number;
  defaultSize: number;
  defaultCell: number;
  baseY: number;
  layers: Terrain["layers"];
  brush: { radius: number; strength: number; maxRadius: number; maxStrength: number };
};

const MODES: { mode: BrushMode; label: string; hint: string }[] = [
  { mode: "raise", label: "Raise", hint: "Shift lowers" },
  { mode: "lower", label: "Lower", hint: "Shift raises" },
  { mode: "flatten", label: "Flatten", hint: "to the height where the drag starts" },
  { mode: "smooth", label: "Smooth", hint: "evens out bumps" },
  { mode: "noise", label: "Roughen", hint: "random bumps" },
  { mode: "paint", label: "Paint", hint: "blends in the chosen layer" },
];

export interface TerrainHost {
  doc: LevelDoc;
  view: EditorView;
  canvas: HTMLCanvasElement;
  status: HTMLElement;
  /** The page's other tools are put down when this one is armed. */
  disarmOthers(): void;
  /** Redraw the tool bar (the armed state and the brush panel). */
  redrawPalette(): void;
}

export class TerrainTool {
  armed = false;
  readonly brush: Brush = { mode: "raise", radius: T.brush.radius, strength: T.brush.strength, layer: 1 };
  private stroke: { work: Terrain; last: number; x: number; z: number; shift: boolean } | null = null;
  private cursor: { x: number; z: number } | null = null;
  private seed = 1;
  private readonly ring: THREE.LineLoop;

  constructor(private readonly host: TerrainHost) {
    const points = new Float32Array(64 * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(points, 3));
    this.ring = new THREE.LineLoop(geo, new THREE.LineBasicMaterial({ color: "#ffd23f", depthTest: false }));
    this.ring.renderOrder = 10;
    this.ring.visible = false;
    host.view.scene.add(this.ring);
    // Capture on the window, so a stroke's press never reaches the page's
    // own place and move handlers (or the camera's left button orbit).
    window.addEventListener("pointerdown", (e) => this.down(e), { capture: true });
    window.addEventListener("pointermove", (e) => this.move(e));
    window.addEventListener("pointerup", () => this.up());
  }

  /** The tool bar button's action: arm (making a terrain if there is none),
   *  or put it down. */
  toggle() {
    if (this.armed) {
      this.disarm();
      return;
    }
    this.host.disarmOthers();
    const doc = this.host.doc;
    if (!doc.level.terrain) {
      doc.setFields({ terrain: defaultTerrain() }, "make terrain");
      this.host.status.textContent = "Made a flat terrain. Drag on it to shape it.";
    } else if (doc.level.terrain.locked) {
      this.host.status.textContent = "The terrain is locked. Unlock it in its inspector to shape it.";
      return;
    }
    this.armed = true;
    this.host.redrawPalette();
  }

  disarm() {
    if (!this.armed) return;
    this.armed = false;
    this.stroke = null;
    this.ring.visible = false;
    this.host.redrawPalette();
  }

  /** The panel beside the armed button: the modes, radius, strength and,
   *  for paint, the layer. */
  options(): HTMLElement {
    const panel = document.createElement("div");
    panel.className = "tool-options terrain-options";
    const modes = document.createElement("div");
    modes.className = "terrain-modes";
    for (const m of MODES) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = m.label;
      b.title = `${m.label}: ${m.hint}`;
      b.setAttribute("aria-pressed", String(this.brush.mode === m.mode));
      if (this.brush.mode === m.mode) b.classList.add("on");
      b.addEventListener("click", () => {
        this.brush.mode = m.mode;
        this.host.redrawPalette();
      });
      modes.append(b);
    }
    panel.append(modes);
    panel.append(this.slider("radius", this.brush.radius, 0.5, T.brush.maxRadius, 0.5, (v) => { this.brush.radius = v; }));
    panel.append(this.slider("strength", this.brush.strength, 0.1, T.brush.maxStrength, 0.1, (v) => { this.brush.strength = v; }));
    const t = this.host.doc.level.terrain;
    if (this.brush.mode === "paint" && t) {
      const layers = document.createElement("div");
      layers.className = "terrain-layers";
      t.layers.forEach((layer, i) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "swatch" + (this.brush.layer === i ? " on" : "");
        b.style.background = layer.colour;
        b.title = `Layer ${i + 1}: ${SURFACES[layer.surface]?.label ?? layer.surface}`;
        b.setAttribute("aria-pressed", String(this.brush.layer === i));
        b.addEventListener("click", () => {
          this.brush.layer = i;
          this.host.redrawPalette();
        });
        layers.append(b);
      });
      panel.append(layers);
    }
    return panel;
  }

  private slider(name: string, value: number, min: number, max: number, step: number, set: (v: number) => void) {
    const wrap = document.createElement("label");
    wrap.className = "terrain-slider";
    const text = document.createElement("span");
    text.textContent = `${name} ${value}`;
    const input = document.createElement("input");
    input.type = "range";
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(value);
    input.addEventListener("input", () => {
      const v = Number(input.value);
      set(v);
      text.textContent = `${name} ${v}`;
    });
    wrap.append(text, input);
    return wrap;
  }

  private ndc(e: { clientX: number; clientY: number }): [number, number] {
    const r = this.host.canvas.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1];
  }

  private down(e: PointerEvent) {
    if (!this.armed || e.target !== this.host.canvas || e.button !== 0 || e.altKey) return;
    const t = this.host.doc.level.terrain;
    if (!t) return;
    const hit = this.host.view.terrainHit(...this.ndc(e));
    if (!hit) return;
    e.stopImmediatePropagation();
    e.preventDefault();
    const work = structuredClone(t);
    if (this.brush.mode === "flatten") this.brush.target = heightAt(work, hit.x, hit.z) ?? hit.y;
    this.brush.seed = this.seed++;
    this.stroke = { work, last: performance.now(), x: hit.x, z: hit.z, shift: e.shiftKey };
    this.cursor = { x: hit.x, z: hit.z };
    requestAnimationFrame(() => this.tick());
  }

  private move(e: PointerEvent) {
    if (!this.armed) return;
    const hit = this.host.view.terrainHit(...this.ndc(e));
    this.cursor = hit ? { x: hit.x, z: hit.z } : null;
    if (this.stroke && hit) {
      this.stroke.x = hit.x;
      this.stroke.z = hit.z;
      this.stroke.shift = e.shiftKey;
    }
    this.drawRing();
  }

  /** One brush step per frame while the button is held, at the cursor. */
  private tick() {
    const s = this.stroke;
    if (!s) return;
    const now = performance.now();
    const dt = Math.min(0.1, (now - s.last) / 1000);
    s.last = now;
    const brush: Brush = { ...this.brush };
    if (s.shift && brush.mode === "raise") brush.mode = "lower";
    else if (s.shift && brush.mode === "lower") brush.mode = "raise";
    if (applyBrush(s.work, s.x, s.z, brush, dt)) this.host.view.setTerrain(s.work, true);
    this.drawRing();
    requestAnimationFrame(() => this.tick());
  }

  private up() {
    const s = this.stroke;
    if (!s) return;
    this.stroke = null;
    this.host.doc.setFields({ terrain: tidyTerrain(s.work) }, `terrain: ${this.brush.mode}`);
  }

  /** The brush's rim, laid on the ground under the cursor. */
  private drawRing() {
    const t = this.stroke?.work ?? this.host.doc.level.terrain;
    const c = this.cursor;
    this.ring.visible = !!(this.armed && t && c);
    if (!this.ring.visible || !t || !c) return;
    const pos = this.ring.geometry.getAttribute("position") as THREE.BufferAttribute;
    for (let k = 0; k < pos.count; k++) {
      const a = (k / pos.count) * Math.PI * 2;
      const x = c.x + Math.cos(a) * this.brush.radius;
      const z = c.z + Math.sin(a) * this.brush.radius;
      pos.setXYZ(k, x, (heightAt(t, x, z) ?? t.origin[1]) + 0.05, z);
    }
    pos.needsUpdate = true;
  }
}

/** A flat terrain of the default size, centred on the origin. */
export function defaultTerrain(): Terrain {
  const size = T.defaultSize;
  return tidyTerrain(flatTerrain([0, 0], T.baseY, size, size, T.defaultCell, T.layers.map((l) => ({ ...l }))));
}

/** The inspector for the selected terrain: its size, its layers, locked,
 *  and a way to remove it. */
export function buildTerrainInspector(host: HTMLElement, doc: LevelDoc, palette: string[], afterRemove: () => void) {
  const t = doc.level.terrain;
  if (!t) {
    const p = document.createElement("p");
    p.className = "hint";
    p.textContent = "No terrain. Arm the Terrain tool to make one.";
    host.append(p);
    return;
  }
  const b = terrainBounds(t);
  const info = document.createElement("p");
  info.className = "hint";
  info.textContent = `${t.nx} by ${t.nz} cells of ${t.cell} m: ${(b.maxX - b.minX).toFixed(0)} by ${(b.maxZ - b.minZ).toFixed(0)} m. Drag with the Terrain tool to shape and paint it.`;
  host.append(info);
  const change = (patch: Partial<Terrain>, text: string) => doc.setFields({ terrain: { ...t, ...patch } }, text);
  t.layers.forEach((layer, i) => {
    const row = document.createElement("div");
    row.className = "field";
    const name = document.createElement("span");
    name.textContent = `layer ${i + 1}`;
    const surface = document.createElement("select");
    for (const s of SURFACE_NAMES) {
      const o = document.createElement("option");
      o.value = s;
      o.textContent = SURFACES[s]!.label;
      o.selected = s === layer.surface;
      surface.append(o);
    }
    surface.addEventListener("change", () => {
      const layers = t.layers.map((l, k) => (k === i ? { ...l, surface: surface.value } : l));
      change({ layers }, "terrain layer surface");
    });
    row.append(name, surface, colourField(layer.colour, palette, (c) => {
      const layers = t.layers.map((l, k) => (k === i ? { ...l, colour: c } : l));
      change({ layers }, "terrain layer colour");
    }));
    host.append(row);
  });
  const lock = document.createElement("label");
  lock.className = "field";
  const box = document.createElement("input");
  box.type = "checkbox";
  box.checked = !!t.locked;
  box.addEventListener("change", () => change({ locked: box.checked || undefined }, box.checked ? "lock terrain" : "unlock terrain"));
  lock.append(box, document.createTextNode(" locked (the Terrain tool leaves it alone)"));
  host.append(lock);
  const remove = document.createElement("button");
  remove.type = "button";
  remove.textContent = "Remove terrain";
  remove.addEventListener("click", () => {
    doc.setFields({ terrain: undefined }, "remove terrain");
    afterRemove();
  });
  host.append(remove);
}
