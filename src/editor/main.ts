import * as THREE from "three";
import type { Prim, PrimShape, Vec3 } from "../level/format";
import { LevelDoc, makePrim, newLevel, snapPrim } from "./doc";
import { EditorView, type TransformMode } from "./view";

// ED-02 stage 2: the editor page, the panels around the view. The document
// (src/editor/doc.ts) holds the level and the undo list; the view
// (src/editor/view.ts) draws it; this file wires the two to the DOM.

const SHAPES: { shape: PrimShape; label: string }[] = [
  { shape: "box", label: "Box" },
  { shape: "ramp", label: "Ramp" },
  { shape: "wedge", label: "Wedge" },
  { shape: "cylinder", label: "Cylinder" },
  { shape: "stairs", label: "Stairs" },
];

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const doc = new LevelDoc(newLevel());
const view = new EditorView($<HTMLCanvasElement>("view"));

/** What the palette will place on the next click in the view. */
let armed: PrimShape | null = null;
/** The colour new prims take: the last one picked in the inspector. */
let placeColour = "#ff7a1a";
const selected = new Set<string>();
const status = $("status");
const counts = $("counts");

/** Grid snap on or off (G): the handles' snap, and the placing snap. */
let snapOn = true;

/** True while the keyboard belongs to a text field (typing a name, a
 *  number), so the editor's single letter keys are not taken. */
function typing(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.tagName === "INPUT" || el.tagName === "SELECT" || el.tagName === "TEXTAREA" || el.isContentEditable;
}

// The panels that read the document.
function redraw() {
  view.show(doc.level);
  view.select([...selected], view.mode);
  buildOutliner();
  buildInspector();
  buildPalette();
  updateTopBar();
}

function updateTopBar() {
  $<HTMLButtonElement>("undoBtn").disabled = !doc.canUndo;
  $<HTMLButtonElement>("redoBtn").disabled = !doc.canRedo;
  const prims = doc.level.prims?.length ?? 0;
  counts.textContent = `${prims} prims`;
}

function buildOutliner() {
  const host = $("outlinerList");
  host.replaceChildren();
  const groups = new Map<string, Prim[]>();
  for (const prim of doc.level.prims ?? []) {
    const list = groups.get(prim.behaviour) ?? [];
    list.push(prim);
    groups.set(prim.behaviour, list);
  }
  if (!groups.size) {
    const hint = document.createElement("div");
    hint.className = "hint";
    hint.textContent = "No prims yet. Pick a shape below and click the view.";
    host.append(hint);
    return;
  }
  for (const [behaviour, prims] of groups) {
    const group = document.createElement("div");
    group.className = "group";
    const title = document.createElement("h2");
    title.textContent = behaviour;
    group.append(title);
    for (const prim of prims) {
      const row = document.createElement("div");
      row.className = "row" + (selected.has(prim.id) ? " selected" : "");
      const name = document.createElement("span");
      name.className = "name";
      name.textContent = prim.id;
      name.addEventListener("click", (e) => pick(prim.id, e.shiftKey));
      const eye = document.createElement("button");
      eye.type = "button";
      eye.textContent = "o";
      eye.title = "Hide or show while editing";
      eye.addEventListener("click", () => {
        const mesh = !view.isHidden(prim.id);
        view.setVisible(prim.id, !mesh);
        eye.classList.toggle("on", mesh);
      });
      row.append(name, eye);
      group.append(row);
    }
    host.append(group);
  }
}

/** Selects one prim, or adds it to the selection with Shift (design/EDITOR
 *  section 4: click, Shift+click). */
function pick(id: string, add = false) {
  if (!add) selected.clear();
  if (add && selected.has(id)) selected.delete(id);
  else selected.add(id);
  view.select([...selected], view.mode);
  buildOutliner();
  buildInspector();
}

function buildPalette() {
  const host = $("palette");
  host.replaceChildren();
  const label = document.createElement("span");
  label.textContent = "Place:";
  host.append(label);
  for (const { shape, label: name } of SHAPES) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "shape" + (armed === shape ? " armed" : "");
    button.textContent = name;
    button.addEventListener("click", () => {
      armed = armed === shape ? null : shape;
      buildPalette();
    });
    host.append(button);
  }
  const mode = document.createElement("span");
  mode.textContent = "\u00a0\u00a0";
  host.append(mode);
  for (const [key, name] of [["translate", "Move W"], ["rotate", "Rotate E"], ["scale", "Scale R"]] as const) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = view.mode === key ? "on" : "";
    button.textContent = name;
    button.addEventListener("click", () => {
      view.setMode(key);
      view.select([...selected], view.mode);
      buildPalette();
    });
    host.append(button);
  }
}

/** The inspector for what is selected, or the level's sky and name when
 *  nothing is (stage 4 fills the sky in). */
function buildInspector() {
  const host = $("inspector");
  host.replaceChildren();
  const heading = document.createElement("h2");
  heading.textContent = selected.size === 1 ? [...selected][0]! : `${selected.size} selected`;
  host.append(heading);
  if (selected.size === 0) {
    buildSkyInspector(host);
    return;
  }
  buildPrimInspector(host);
}

function buildSkyInspector(_host: HTMLElement) {
  /* Stage 4: the sky editor lands here. */
}

function buildPrimInspector(_host: HTMLElement) {
  /* Stage 3: the prim fields land here. */
}

// The view: right mouse looks, a left click places or selects.
const canvas = $<HTMLCanvasElement>("view");
canvas.addEventListener("contextmenu", (e) => e.preventDefault());
canvas.addEventListener("mousedown", (e) => {
  if (typing(e.target)) return;
  if (e.button === 2) {
    view.setLooking(true);
    canvas.requestPointerLock();
  }
});
document.addEventListener("pointerlockchange", () => {
  view.setLooking(document.pointerLockElement === canvas);
  if (!view.isLooking) view.clearKeys();
});
document.addEventListener("mousemove", (e) => {
  if (!view.isLooking) return;
  const cam = view.camera;
  const euler = new THREE.Euler().setFromQuaternion(cam.quaternion, "YXZ");
  euler.y -= e.movementX * 0.0025;
  euler.x = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, euler.x - e.movementY * 0.0025));
  cam.quaternion.setFromEuler(euler);
});
canvas.addEventListener("click", (e) => {
  if (view.isLooking || view.dragging || typing(e.target)) return;
  const rect = canvas.getBoundingClientRect();
  const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  const hit = view.pick(ndcX, ndcY);
  if (armed) {
    if (!hit) return;
    place(armed, hit.point, hit.normal);
    return;
  }
  if (hit?.id) pick(hit.id, e.shiftKey);
  else if (!e.shiftKey) {
    selected.clear();
    view.select([], view.mode);
    buildOutliner();
    buildInspector();
  }
});

/** Places a prim of a shape on the surface under the cursor, standing on
 *  that surface: the click point plus half the prim's height along the
 *  surface normal, snapped to the grid. */
function place(shape: PrimShape, point: THREE.Vector3, normal: THREE.Vector3) {
  const base = makePrim(shape, [point.x, point.y, point.z], placeColour);
  const pos: Vec3 = [
    point.x + normal.x * base.size[0] / 2,
    point.y + normal.y * base.size[1] / 2,
    point.z + normal.z * base.size[2] / 2,
  ];
  const prim: Prim = snapPrim({ ...base, id: doc.nextId(shape), pos });
  doc.add(prim);
  selected.clear();
  selected.add(prim.id);
}

window.addEventListener("keydown", (e) => {
  if (typing(e.target)) return;
  const meta = e.ctrlKey || e.metaKey;
  if (meta && e.code === "KeyZ") {
    e.preventDefault();
    if (e.shiftKey) doc.redo();
    else doc.undo();
    return;
  }
  if (meta && e.code === "KeyY") {
    e.preventDefault();
    doc.redo();
    return;
  }
  if (meta) return;
  const codes = ["KeyW", "KeyA", "KeyS", "KeyD", "KeyQ", "KeyE", "ShiftLeft", "ShiftRight"];
  if (codes.includes(e.code)) view.keyDown(e.code);
  if (e.code === "KeyF") view.frame([...selected]);
  if (e.code === "KeyG") {
    snapOn = !snapOn;
    view.setSnap(snapOn);
  }
  if (e.code === "KeyW" && !view.isLooking) setMode("translate");
  if (e.code === "KeyE" && !view.isLooking) setMode("rotate");
  if (e.code === "KeyR" && !view.isLooking) setMode("scale");
  if (e.code === "Delete" || e.code === "Backspace") {
    e.preventDefault();
    if (selected.size) {
      doc.remove([...selected]);
      selected.clear();
    }
  }
});

window.addEventListener("keyup", (e) => {
  view.keyUp(e.code);
});

function setMode(mode: TransformMode) {
  view.setMode(mode);
  view.select([...selected], view.mode);
  buildPalette();
}

$("undoBtn").addEventListener("click", () => doc.undo());
$("redoBtn").addEventListener("click", () => doc.redo());
$("newBtn").addEventListener("click", () => {
  selected.clear();
  doc.load(newLevel());
});

doc.onChange(() => {
  // The selection drops prims that are gone (an undo of an add, a delete).
  for (const id of [...selected]) if (!doc.prim(id)) selected.delete(id);
  redraw();
});
redraw();
// The status line flips only once a frame is on screen, so the smoke check
// (which waits for it) has a picture by the time it reads "Ready".
requestAnimationFrame(() => {
  status.textContent = "Ready";
});
