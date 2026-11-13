import * as THREE from "three";
import type { Level, Prim, PrimShape, Vec3 } from "../level/format";
import { LevelDoc, GRID, LIMITS, makePrim, newLevel, snapPrim, snapVec3, ROTATE_STEP } from "./doc";
import { exportFileName, readLevelFile, skyImageDataUrl } from "./files";
import { buildPrimFields } from "./inspector";
import { buildLevelFields } from "./sky";
import { deleteLevel, listLevels, putLevel, LOCAL_PREFIX } from "./store";
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

/** The last colours used in the inspector, newest first (six, the card). */
const recent: string[] = [];
function remember(colour: string) {
  const i = recent.indexOf(colour);
  if (i >= 0) recent.splice(i, 1);
  recent.unshift(colour);
  recent.length = Math.min(recent.length, 6);
  placeColour = colour;
}

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
  counts.textContent = countText(doc.level);
  counts.title = `Caps from data/editor.json: ${LIMITS.prims} prims, ${LIMITS.foamers} foamers, ${LIMITS.triggers} triggers`;
  counts.classList.toggle("over", overCaps(doc.level).length > 0);
}

/** "12 of 2000 prims, 3 of 150 foamers" against the caps in data/editor.json. */
function countText(level: Level): string {
  const parts = [
    `${level.prims?.length ?? 0} of ${LIMITS.prims} prims`,
    `${level.foamers?.length ?? 0} of ${LIMITS.foamers} foamers`,
    `${level.triggers?.length ?? 0} of ${LIMITS.triggers} triggers`,
  ];
  return parts.join(", ");
}

/** Which caps the level is over. The validator refuses to load such a level,
 *  so the top bar says so before a save or an export runs into it. */
function overCaps(level: Level): string[] {
  const over: string[] = [];
  const prims = level.prims?.length ?? 0;
  const foamers = level.foamers?.length ?? 0;
  const triggers = level.triggers?.length ?? 0;
  if (prims > LIMITS.prims) over.push(`${prims} prims, over ${LIMITS.prims}`);
  if (foamers > LIMITS.foamers) over.push(`${foamers} foamers, over ${LIMITS.foamers}`);
  if (triggers > LIMITS.triggers) over.push(`${triggers} triggers, over ${LIMITS.triggers}`);
  return over;
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

function buildSkyInspector(host: HTMLElement) {
  const sub = document.createElement("h2");
  sub.textContent = "Level";
  host.append(sub);
  buildLevelFields(host, doc.level, {
    change: (patch, text) => {
      doc.setFields(patch, text);
      syncNameField();
    },
    uploadSky,
    redraw: buildInspector,
  });
}

/** The top bar's name field follows the document's name, so an undo of a
 *  rename shows there too. */
function syncNameField() {
  const input = $<HTMLInputElement>("levelName");
  if (input.value !== doc.level.meta.name) input.value = doc.level.meta.name;
}

function buildPrimInspector(host: HTMLElement) {
  const prims = [...selected].map((id) => doc.prim(id)).filter((p): p is Prim => !!p);
  if (!prims.length) return;
  buildPrimFields(host, prims, {
    change: (patch, text) => doc.change([...selected].map((id) => ({ id, patch })), text),
    changeOne: (id, patch, text) => doc.change([{ id, patch }], text),
    redraw: () => {
      buildInspector();
      buildPalette();
    },
    recent,
    remember,
  });
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
  if (!roomFor(1)) return;
  const base = makePrim(shape, [point.x, point.y, point.z], placeColour);
  const pos: Vec3 = [
    point.x + normal.x * base.size[0] / 2,
    point.y + normal.y * base.size[1] / 2,
    point.z + normal.z * base.size[2] / 2,
  ];
  const made: Prim = { ...base, id: doc.nextId(shape), pos };
  const prim: Prim = snapOn ? snapPrim(made) : made;
  selected.clear();
  doc.add(prim);
  // Select what was just placed, after the document's own redraw: the
  // inspector then has the new prim, one Ctrl+D from a copy.
  pick(prim.id);
}

/** True when the level has room for `count` more prims; otherwise it says
 *  so in the status line and does not add them (stage 5: the prim cap from
 *  data/editor.json is a hard cap, and the validator would refuse the file). */
function roomFor(count: number): boolean {
  const have = doc.level.prims?.length ?? 0;
  if (have + count <= LIMITS.prims) return true;
  status.textContent = `Prim cap: ${LIMITS.prims}. ${have} already placed.`;
  return false;
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
  if (meta && e.code === "KeyD") {
    e.preventDefault();
    if (selected.size && roomFor(selected.size)) {
      const made = doc.duplicate([...selected]);
      selected.clear();
      for (const id of made) selected.add(id);
    }
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

/** One drag of the handles, written into the document when it ends: the
 *  proxy's position and rotation, or its scale as the prims' size. */
let dragStart: {
  mode: TransformMode; ids: string[]; pos: Vec3; rot: Vec3;
  scale: Vec3; size: Record<string, Vec3>;
} | null = null;
view.controls.addEventListener("mouseDown", () => {
  const ids = [...selected];
  const state = view.proxyState();
  dragStart = {
    mode: view.mode,
    ids,
    pos: state.pos,
    rot: state.rot,
    scale: state.scale,
    size: Object.fromEntries(ids.map((id) => [id, doc.prim(id)?.size ?? [1, 1, 1]])),
  };
});
view.controls.addEventListener("mouseUp", () => {
  const start = dragStart;
  dragStart = null;
  if (!start || !start.ids.length) return;
  const state = view.proxyState();
  const move: Vec3 = [
    state.pos[0] - start.pos[0], state.pos[1] - start.pos[1], state.pos[2] - start.pos[2],
  ];
  const turn: Vec3 = [
    state.rot[0] - start.rot[0], state.rot[1] - start.rot[1], state.rot[2] - start.rot[2],
  ];
  const scale: Vec3 = state.scale;
  const moved = move.some((n) => Math.abs(n) > 1e-4);
  const turned = turn.some((n) => Math.abs(n) > 1e-4);
  const scaled = start.mode === "scale";
  if (!moved && !turned && !scaled) return;
  const edits = start.ids.map((id) => {
    const before = doc.prim(id);
    const patch: Partial<Prim> = {};
    if (!before) return { id, patch };
    if (start.mode === "scale") {
      // The handles start at the last prim's size, so the change is the
      // ratio: every selected prim keeps its own size, scaled the same way.
      const from = start.size[id] ?? [1, 1, 1];
      patch.size = from.map((n, i) => {
        const ratio = scale[i]! / (start.scale[i] || 1);
        return Math.max(GRID, Math.round(n * ratio * 1000) / 1000);
      }) as Vec3;
    } else {
      const pos: Vec3 = [before.pos[0] + move[0], before.pos[1] + move[1], before.pos[2] + move[2]];
      const rot: Vec3 = [
        (before.rot?.[0] ?? 0) + turn[0], (before.rot?.[1] ?? 0) + turn[1], (before.rot?.[2] ?? 0) + turn[2],
      ];
      patch.pos = snapOn ? snapVec3(pos, GRID) : pos;
      patch.rot = snapOn ? snapVec3(rot, ROTATE_STEP) : rot;
    }
    return { id, patch };
  }).filter((e) => Object.keys(e.patch).length);
  if (edits.length) doc.change(edits, start.mode === "scale" ? "resize" : start.mode === "rotate" ? "rotate" : "move");
});

$("undoBtn").addEventListener("click", () => doc.undo());
$("redoBtn").addEventListener("click", () => doc.redo());

// Stage 4: the level's own store key, made by the first save.
let savedKey: string | null = null;
let saveTimer = 0;

/** Saves half a second after the last change, so typing a number or a name
 *  is one save, not one per keystroke. */
function scheduleSave() {
  window.clearTimeout(saveTimer);
  status.textContent = "Saving";
  saveTimer = window.setTimeout(() => void saveNow(), 500);
}

async function saveNow(): Promise<string | null> {
  window.clearTimeout(saveTimer);
  try {
    savedKey = await putLevel(doc.level, savedKey ?? undefined);
    status.textContent = "Saved";
    return savedKey;
  } catch (e) {
    status.textContent = `Not saved: ${(e as Error).message}`;
    return null;
  }
}

function load(level: Level, key: string | null) {
  selected.clear();
  savedKey = key;
  doc.load(level);
  syncNameField();
  scheduleSave();
}

$("newBtn").addEventListener("click", () => load(newLevel(), null));

$("levelName").addEventListener("change", () => {
  const name = $<HTMLInputElement>("levelName").value.trim() || "[Paul]";
  doc.setFields({ meta: { ...doc.level.meta, name } }, "level name");
  syncNameField();
});

// A dialog over the view: a title, then whatever the caller builds.
function dialog(title: string, build: (body: HTMLElement) => void) {
  const host = $("dialogs");
  const body = $("dialogBody");
  body.replaceChildren();
  const heading = document.createElement("h2");
  heading.textContent = title;
  body.append(heading);
  build(body);
  const close = document.createElement("button");
  close.type = "button";
  close.textContent = "Close";
  close.addEventListener("click", () => {
    host.hidden = true;
  });
  body.append(close);
  host.hidden = false;
  return body;
}

/** The built in levels the editor can open as a copy (design/EDITOR.md 5:
 *  they arrive by import in the end, but a copy of one is the quickest way
 *  to a room to build in). Bundled, never fetched. */
const BUILT_IN = import.meta.glob<{ default: unknown }>("../../data/levels/*.json", { eager: true });

function nameOf(path: string): string {
  return path.split("/").pop()?.replace(/\.json$/, "") ?? path;
}

$("openBtn").addEventListener("click", () => {
  void dialog("Open a level", (body) => {
    const list = document.createElement("div");
    list.className = "list";
    body.append(list);
    const note = document.createElement("p");
    note.className = "hint";
    note.textContent = "Saved levels open as they are. A built in level opens as a copy: saving makes a new one.";
    body.append(note);

    const row = (name: string, open: () => void, remove?: () => void) => {
      const el = document.createElement("div");
      el.className = "row";
      const openButton = document.createElement("button");
      openButton.type = "button";
      openButton.className = "name";
      openButton.textContent = name;
      openButton.addEventListener("click", open);
      el.append(openButton);
      if (remove) {
        const del = document.createElement("button");
        del.type = "button";
        del.textContent = "Delete";
        del.addEventListener("click", remove);
        el.append(del);
      }
      list.append(el);
    };

    void listLevels().then((stored) => {
      if (stored.length) {
        const heading = document.createElement("h2");
        heading.textContent = "Saved here";
        list.append(heading);
      }
      for (const { key, level, saved } of stored) {
        row(`${level.meta.name || "[Paul]"}  ${new Date(saved).toLocaleString()}`, () => {
          load(structuredClone(level), key);
          $("dialogs").hidden = true;
        }, () => {
          void deleteLevel(key).then(() => {
            if (savedKey === key) savedKey = null;
            $("dialogs").hidden = true;
            $("openBtn").click();
          });
        });
      }
      const heading = document.createElement("h2");
      heading.textContent = "Built in, as a copy";
      list.append(heading);
      for (const [path, module] of Object.entries(BUILT_IN)) {
        row(nameOf(path), () => {
          load(structuredClone(module.default as Level), null);
          $("dialogs").hidden = true;
        });
      }
    });
  });
});

$("exportBtn").addEventListener("click", () => {
  const text = JSON.stringify(doc.level, null, 2);
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = exportFileName(doc.level);
  link.click();
  URL.revokeObjectURL(url);
});

$("importBtn").addEventListener("click", () => $<HTMLInputElement>("importFile").click());
$<HTMLInputElement>("importFile").addEventListener("change", () => {
  const input = $<HTMLInputElement>("importFile");
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;
  void file.text().then((text) => {
    const result = readLevelFile(text);
    if (result.errors.length) {
      void dialog("That file will not load", (body) => {
        const list = document.createElement("div");
        list.className = "errors";
        for (const error of result.errors) {
          const line = document.createElement("div");
          line.textContent = error;
          list.append(line);
        }
        body.append(list);
      });
      return;
    }
    load(structuredClone(result.level!), null);
    status.textContent = "Imported";
  });
});

$("playBtn").addEventListener("click", () => {
  void saveNow().then((key) => {
    if (key) location.href = `arena.html?level=${encodeURIComponent(LOCAL_PREFIX + key)}`;
  });
});

// The sky's picture: read it, scale it on a canvas, put it in the level.
function uploadSky(file: File) {
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.onload = () => {
    try {
      const data = skyImageDataUrl(image, LIMITS.skyImageWidth, LIMITS.skyImageHeight);
      doc.setFields({ sky: { kind: "image", image: data } }, "sky picture");
      buildInspector();
    } catch (e) {
      status.textContent = `Picture not used: ${(e as Error).message}`;
    } finally {
      URL.revokeObjectURL(url);
    }
  };
  image.onerror = () => {
    URL.revokeObjectURL(url);
    status.textContent = "Picture not read";
  };
  image.src = url;
}

doc.onChange(() => {
  // The selection drops prims that are gone (an undo of an add, a delete).
  for (const id of [...selected]) if (!doc.prim(id)) selected.delete(id);
  redraw();
  scheduleSave();
});

// The level the page opens with: the newest one saved in this browser, or a
// new one. "Ready" waits for a frame, so the smoke check (which waits for
// the word) has a picture before it reads it.
void listLevels()
  .then((stored) => {
    const newest = stored[0];
    if (newest) load(structuredClone(newest.level), newest.key);
    else doc.load(newLevel());
  })
  .catch(() => doc.load(newLevel()))
  .finally(() => {
    syncNameField();
    redraw();
    requestAnimationFrame(() => {
      status.textContent = "Ready";
    });
  });
