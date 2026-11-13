import * as THREE from "three";
import type { Level, LevelDoor, Pickup, PlacedFoamer, Prim, PrimShape, Trigger, Vec3 } from "../level/format";
import {
  EDITOR, ENTRY_KINDS, LevelDoc, GRID, LIMITS, makePrim, newLevel, snapPrim, snapVec3, ROTATE_STEP, type EntryKind,
} from "./doc";
import { exportFileName, readLevelFile, skyImageDataUrl } from "./files";
import { buildPrimFields } from "./inspector";
import {
  buildDoorFields, buildExitFields, buildFoamerFields, buildPickupFields, buildSpawnFields,
  buildStartFields, buildZoneFields, numberInput, selectField, selectKind,
} from "./inspector-parts";
import { EXIT_ID, START_ID } from "./markers";
import { AMMO_TYPES, RIGS, dragPatch, makeDoor, makeFoamer, makePickup, makeSpawn, makeZone, rigLabel } from "./parts";
import { problemsFor, problemsLabel, type Problem } from "./problems";
import { buildTriggerFields } from "./inspector-trigger";
import { arenaProblem, blockerChoices, buildArena, type ArenaSpec } from "./arena-build";
import { applyLink, firstLinkKey, newTrigger, triggerIds } from "./trigger-parts";
import { triggerSummary } from "./trigger-text";
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

/** ED-05: the palette buttons for things that are not primitives. */
const PART_BUTTONS: { kind: PartKind; name: string }[] = [
  { kind: "foamers", name: "Foamer" },
  { kind: "pickups", name: "Pickup" },
  { kind: "doors", name: "Door" },
  { kind: "spawnPoints", name: "Spawn point" },
  { kind: "zones", name: "Zone" },
];

/** ED-08: a trigger is not a thing in the world, so it is not placed by a
 *  click: the palette's Trigger button adds one with nothing chosen yet and
 *  selects it for the inspector. */
const TRIGGER_BUTTON = "Add a trigger";

/** ED-08 stage 4: one click builds the usual fight (lock, waves, clear) out
 *  of ordinary triggers, which Paul can then edit like any other. */
const ARENA_BUTTON = "Build an arena";

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const doc = new LevelDoc(newLevel());
const view = new EditorView($<HTMLCanvasElement>("view"));

/** What the palette will place on the next click in the view: a primitive
 *  shape, or ED-05's other kinds (a Foamer, a pickup, a door, a spawn point,
 *  a zone). Only one is armed at a time. */
type PartKind = "foamers" | "pickups" | "doors" | "spawnPoints" | "zones";
let armed: PrimShape | null = null;
let armedPart: PartKind | null = null;
/** The kind of pickup and the rig the palette places. */
let pickupType: Pickup["type"] = "darts-standard";
let armedRig = RIGS[0]?.id ?? "F01";
/** The colour new prims take: the last one picked in the inspector. */
let placeColour = "#ff7a1a";
const selected = new Set<string>();
/** ED-08 stage 3: the trigger field Link fills ("enter", "killed", "do:2"),
 *  or null when nothing is linking. Cleared when the selection changes. */
let linkKey: string | null = null;
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
  selectInView();
  buildOutliner();
  buildInspector();
  buildPalette();
  updateTopBar();
}

function updateTopBar() {
  $<HTMLButtonElement>("undoBtn").disabled = !doc.canUndo;
  $<HTMLButtonElement>("redoBtn").disabled = !doc.canRedo;
  counts.textContent = countText(doc.level);
  // ED-05 stage 5: the validator runs on every change, and the top bar says
  // how many problems it found.
  problems = problemsFor(doc.level, allIds(), START_ID, EXIT_ID);
  const button = $<HTMLButtonElement>("problemsBtn");
  button.textContent = problemsLabel(problems);
  button.classList.toggle("over", problems.some((p) => p.severity === "error"));
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

/** Every id the document holds, in any kind. */
function allIds(): string[] {
  const ids: string[] = [];
  for (const kind of ENTRY_KINDS) {
    for (const entry of doc.entries(kind)) ids.push(entry.id);
  }
  return ids;
}

/** The problems the last change left, and the panel that lists them. */
let problems: Problem[] = [];

$("problemsBtn").addEventListener("click", () => {
  void dialog("Problems", (body) => {
    const list = document.createElement("div");
    list.className = "problems";
    body.append(list);
    if (!problems.length) {
      const none = document.createElement("p");
      none.className = "hint";
      none.textContent = "Nothing: the validator has no errors or warnings for this level.";
      list.append(none);
      return;
    }
    for (const problem of problems) {
      const row = document.createElement("div");
      row.className = `problem ${problem.severity}`;
      row.textContent = problem.text;
      if (problem.id) {
        row.classList.add("selectable");
        row.title = "Select it";
        row.addEventListener("click", () => {
          pick(problem.id!, false);
          $("dialogs").hidden = true;
        });
      }
      list.append(row);
    }
  });
});

/** The level groups the outliner shows for the placed things, in the order
 *  design/EDITOR.md section 4 lists them. */
const PART_GROUPS: { kind: PartKind; title: string }[] = [
  { kind: "foamers", title: "Foamers" },
  { kind: "pickups", title: "Pickups" },
  { kind: "doors", title: "Doors" },
  { kind: "spawnPoints", title: "Spawn points" },
  { kind: "zones", title: "Zones" },
];

/** The name a row shows for a placed thing: its id, and what it is. */
function partName(id: string): string {
  const kind = doc.kindOf(id);
  if (kind === "foamers") {
    const f = doc.find<PlacedFoamer>(kind, id);
    return f ? `${id}  ${rigLabel(f.foamer)}` : id;
  }
  if (kind === "pickups") {
    const p = doc.find<Pickup>(kind, id);
    return p ? `${id}  ${p.type}` : id;
  }
  if (kind === "doors") {
    const d = doc.find<LevelDoor>(kind, id);
    return d ? `${id}  ${d.lock}` : id;
  }
  return id;
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
  const empty = !groups.size && PART_GROUPS.every((g) => !doc.entries(g.kind).length)
    && !doc.entries("triggers").length;
  if (empty) {
    const hint = document.createElement("div");
    hint.className = "hint";
    hint.textContent = "Nothing yet. Pick something below and click the view.";
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
  // ED-05: one group per kind of placed thing, then the start and the exit.
  for (const { kind, title: groupTitle } of PART_GROUPS) {
    const list = doc.entries(kind);
    if (!list.length) continue;
    const group = document.createElement("div");
    group.className = "group";
    const title = document.createElement("h2");
    title.textContent = groupTitle;
    group.append(title);
    for (const entry of list) {
      const row = document.createElement("div");
      row.className = "row" + (selected.has(entry.id) ? " selected" : "");
      const name = document.createElement("span");
      name.className = "name";
      name.textContent = partName(entry.id);
      name.addEventListener("click", (e) => pick(entry.id, e.shiftKey));
      row.append(name);
      group.append(row);
    }
    host.append(group);
  }
  // ED-08: the Logic group, one row per trigger with what it says in a line.
  const triggers = doc.level.triggers ?? [];
  if (triggers.length) {
    const group = document.createElement("div");
    group.className = "group";
    const title = document.createElement("h2");
    title.textContent = "Logic";
    group.append(title);
    for (const trigger of triggers) {
      const row = document.createElement("div");
      row.className = "row" + (selected.has(trigger.id) ? " selected" : "");
      const name = document.createElement("span");
      name.className = "name";
      name.textContent = trigger.id;
      name.title = triggerSummary(trigger);
      name.addEventListener("click", (e) => pick(trigger.id, e.shiftKey));
      const summary = document.createElement("span");
      summary.className = "hint";
      summary.textContent = triggerSummary(trigger);
      row.append(name, summary);
      group.append(row);
    }
    host.append(group);
  }
  const level = document.createElement("div");
  level.className = "group";
  const levelTitle = document.createElement("h2");
  levelTitle.textContent = "Level";
  level.append(levelTitle);
  for (const [id, label] of [[START_ID, "Player start"], [EXIT_ID, "Exit"]] as const) {
    const row = document.createElement("div");
    row.className = "row" + (selected.has(id) ? " selected" : "");
    const name = document.createElement("span");
    name.className = "name";
    name.textContent = label;
    name.addEventListener("click", (e) => pick(id, e.shiftKey));
    row.append(name);
    level.append(row);
  }
  host.append(level);
}

/** Selects one thing, or adds it to the selection with Shift (design/EDITOR
 *  section 4: click, Shift+click). The id names an entry of any kind, or the
 *  view's pseudo ids for the player start and the exit. */
function pick(id: string, add = false) {
  endLink();
  if (!add) selected.clear();
  if (add && selected.has(id)) selected.delete(id);
  else selected.add(id);
  selectInView();
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
      armedPart = null;
      buildPalette();
    });
    host.append(button);
  }
  // ED-05: the other kinds. A prim armed and a part armed are exclusive, so
  // a click in the view is never ambiguous.
  for (const { kind, name } of PART_BUTTONS) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "shape" + (armedPart === kind ? " armed" : "");
    button.textContent = name;
    button.addEventListener("click", () => {
      armedPart = armedPart === kind ? null : kind;
      armed = null;
      buildPalette();
    });
    host.append(button);
  }
  // ED-08: a trigger is not placed by a click, so its button adds one at
  // once and selects it, ready for the inspector.
  const addTrigger = document.createElement("button");
  addTrigger.type = "button";
  addTrigger.textContent = TRIGGER_BUTTON;
  addTrigger.addEventListener("click", () => {
    if (!roomForTriggers(1)) return;
    const made = newTrigger(doc.nextId("trigger"));
    doc.add("triggers", made);
    pick(made.id);
  });
  host.append(addTrigger);

  // ED-08 stage 4: the Arena button asks a few questions once and writes the
  // three or more triggers the usual fight takes. It needs a zone to start
  // from, so with none selected it says so rather than guessing one.
  const arenaBtn = document.createElement("button");
  arenaBtn.type = "button";
  arenaBtn.textContent = ARENA_BUTTON;
  arenaBtn.addEventListener("click", () => {
    const zone = [...selected].find((id) => doc.kindOf(id) === "zones");
    if (!zone) {
      status.textContent = "Select a zone first, then build an arena in it.";
      return;
    }
    arenaDialog(zone);
  });
  host.append(arenaBtn);
  if (armedPart === "pickups") {
    const select = document.createElement("select");
    select.title = "Pickup type";
    for (const ammo of AMMO_TYPES) {
      const option = document.createElement("option");
      option.value = ammo.type;
      option.textContent = ammo.label;
      select.append(option);
    }
    for (const [value, text] of [["health", "Health"], ["blaster", "Blaster"], ["melee", "Hand weapon"], ["key", "Key"]] as const) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = text;
      select.append(option);
    }
    select.value = pickupType;
    select.addEventListener("change", () => {
      pickupType = select.value as Pickup["type"];
    });
    host.append(select);
  }
  if (armedPart === "foamers") {
    const select = document.createElement("select");
    select.title = "Foamer type";
    for (const rig of RIGS) {
      const option = document.createElement("option");
      option.value = rig.id;
      option.textContent = `${rig.id} ${rig.label}`;
      select.append(option);
    }
    select.value = armedRig;
    select.addEventListener("change", () => {
      armedRig = select.value;
    });
    host.append(select);
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
      selectInView();
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
  heading.textContent = selected.size === 1 ? selectionName([...selected][0]!) : `${selected.size} selected`;
  host.append(heading);
  if (selected.size === 0) {
    buildSkyInspector(host);
    return;
  }
  // A selection of one placed thing gets that kind's fields; a prim or a
  // mixed selection gets the prim fields (which also covers a start or the
  // exit, since their fields are position and size too, stage 5).
  const only = selected.size === 1 ? [...selected][0]! : null;
  const kind = only ? selectKind(only) ?? doc.kindOf(only) : null;
  if (only && kind && kind !== "prims") {
    buildPartInspector(host, only, kind);
    return;
  }
  buildPrimInspector(host);
}

/** ED-08 stage 3: what the view outlines. A selected trigger is not in the
 *  world, so instead of a box round it the view outlines everything it names,
 *  which is how Paul sees what the trigger acts on. */
function selectInView() {
  const picked: string[] = [];
  const named: string[] = [];
  for (const id of selected) {
    if (doc.kindOf(id) !== "triggers") {
      picked.push(id);
      continue;
    }
    const trigger = doc.find<Trigger>("triggers", id);
    if (trigger) named.push(...triggerIds(trigger));
  }
  // A trigger gets no box and no handles (there is nothing to drag), so the
  // handles only follow what is really selected.
  view.select(picked, view.mode);
  view.showLinked(named);
}

/** The name the inspector's heading uses for one selected id. */
function selectionName(id: string): string {
  const kind = selectKind(id);
  if (kind === "start") return "Player start";
  if (kind === "exit") return "Exit";
  return partName(id);
}

/** ED-05: the inspector for one Foamer, pickup, door, spawn point, zone, the
 *  player start or the exit. `change` patches one undo step per edit. */
function buildPartInspector(host: HTMLElement, id: string, kind: EntryKind | "start" | "exit") {
  const ctx = {
    change: (patch: Record<string, unknown>, text: string) => {
      if (kind === "start") doc.setStart(patch as never, text);
      else if (kind === "exit") doc.setExit(patch as never, text);
      else doc.change(kind, [{ id, patch }], text);
    },
    redraw: buildInspector,
  };
  if (kind === "start") buildStartFields(host, doc.level, ctx);
  else if (kind === "exit") buildExitFields(host, doc.level, ctx);
  else if (kind === "foamers") buildFoamerFields(host, doc.find(kind, id)!, RIGS, ctx);
  else if (kind === "pickups") buildPickupFields(host, doc.find(kind, id)!, ctx);
  else if (kind === "doors") buildDoorFields(host, doc.find(kind, id)!, ctx);
  else if (kind === "spawnPoints") buildSpawnFields(host, doc.find(kind, id)!, ctx);
  else if (kind === "triggers") buildTriggerInspector(host, id);
  else buildZoneFields(host, doc.find(kind, id)!, ctx);
}

/** ED-08 stage 2: the inspector for one trigger. `change` is one undo step on
 *  that trigger's fields; a new when or do kind rebuilds the panel, since it
 *  brings its own fields. */
function buildTriggerInspector(host: HTMLElement, id: string) {
  const trigger = doc.find<Trigger>("triggers", id);
  if (!trigger) return;
  buildTriggerFields(host, trigger, {
    level: doc.level,
    change: (patch, text) => doc.change("triggers", [{ id, patch: patch as Record<string, unknown> }], text),
    redraw: buildInspector,
    linkKey,
    setLink: (key) => {
      linkKey = key;
      status.textContent = key ? "Linking: click the thing in the view, Esc to stop." : "";
      buildInspector();
    },
    cameraSpot: () => {
      const cam = view.camera;
      const euler = new THREE.Euler().setFromQuaternion(cam.quaternion, "YXZ");
      return { pos: [cam.position.x, cam.position.y, cam.position.z], yaw: euler.y };
    },
  });
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
    change: (patch, text) => doc.change("prims", [...selected].map((id) => ({ id, patch })), text),
    changeOne: (id, patch, text) => doc.change("prims", [{ id, patch }], text),
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
  // ED-08 stage 3: while linking, the click adds the thing to the trigger's
  // field and does not select anything else.
  if (linkKey) {
    if (hit?.id) link(hit.id);
    return;
  }
  if (armed) {
    if (!hit) return;
    place(armed, hit.point, hit.normal);
    return;
  }
  if (armedPart) {
    if (!hit) return;
    placePart(armedPart, hit.point, hit.normal);
    return;
  }
  if (hit?.id) pick(hit.id, e.shiftKey);
  else if (!e.shiftKey) {
    selected.clear();
    selectInView();
    buildOutliner();
    buildInspector();
  }
});

/** The trigger being linked into: the one selected trigger whose inspector
 *  started the link. */
function linkedTrigger(): Trigger | null {
  if (!linkKey) return null;
  for (const id of selected) {
    const trigger = doc.find<Trigger>("triggers", id);
    if (trigger) return trigger;
  }
  return null;
}

/** ED-08 stage 3: adds the clicked thing to the field the link names. A thing
 *  of a kind the field does not take is refused with a word in the status
 *  line, so a click on the wrong wall does not quietly change anything. */
function link(id: string) {
  const trigger = linkedTrigger();
  const kind = doc.kindOf(id);
  if (!trigger || !kind || !linkKey) return;
  const next = applyLink(trigger, linkKey, id, kind);
  if (!next) {
    status.textContent = `${id} is not something this field takes.`;
    return;
  }
  doc.change("triggers", [{ id: trigger.id, patch: next as unknown as Record<string, unknown> }], `link ${id}`);
  status.textContent = `Linked ${id}. Esc when done.`;
  buildInspector();
}

/** Ends a link (Esc, or a change of selection). */
function endLink() {
  linkKey = null;
}

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
  doc.add("prims", prim);
  // Select what was just placed, after the document's own redraw: the
  // inspector then has the new prim, one Ctrl+D from a copy.
  pick(prim.id);
}

/** ED-05: places a Foamer, a pickup, a door, a spawn point or a zone on the
 *  surface under the cursor, snapped to the grid. The factory (src/editor/
 *  parts.ts) fills the fields the validator wants for that kind. */
function placePart(kind: PartKind, point: THREE.Vector3, normal: THREE.Vector3) {
  if (kind === "foamers" && !roomForKind("foamers")) return;
  const at: Vec3 = [point.x, point.y, point.z];
  let id: string;
  let entry: { id: string };
  if (kind === "foamers") {
    const made = makeFoamer(doc.nextId("foamer"), at, armedRig);
    entry = snapOn ? { ...made, pos: snapVec3(made.pos, GRID) } : made;
    id = entry.id;
    doc.add(kind, entry as never);
  } else if (kind === "pickups") {
    const made = makePickup(doc.nextId(pickupPrefix()), pickupType, at);
    entry = snapOn ? { ...made, pos: snapVec3(made.pos, GRID) } : made;
    id = entry.id;
    doc.add(kind, entry as never);
  } else if (kind === "doors") {
    const made = makeDoor(doc.nextId("door"), at);
    // A door stands on the surface it was clicked: its centre is half its
    // height up along the normal, as a prim's is.
    const placed = { ...made, pos: [point.x + normal.x * 0.2, made.pos[1], point.z + normal.z * 0.2] as Vec3 };
    entry = snapOn ? { ...placed, pos: snapVec3(placed.pos, GRID) } : placed;
    id = entry.id;
    doc.add(kind, entry as never);
  } else if (kind === "spawnPoints") {
    const made = makeSpawn(doc.nextId("spawn"), at);
    entry = snapOn ? { ...made, pos: snapVec3(made.pos, GRID) } : made;
    id = entry.id;
    doc.add(kind, entry as never);
  } else {
    const made = makeZone(doc.nextId("zone"), at);
    entry = snapOn ? { ...made, pos: snapVec3(made.pos, GRID) } : made;
    id = entry.id;
    doc.add(kind, entry as never);
  }
  pick(id);
}

/** The id prefix a pickup takes: a key is `key`, everything else `pickup`. */
function pickupPrefix(): string {
  return pickupType === "key" ? "key" : "pickup";
}

/** ED-08: true when the level has room for more triggers against the cap in
 *  data/editor.json, otherwise it says so in the status line. */
function roomForTriggers(count: number): boolean {
  const have = doc.level.triggers?.length ?? 0;
  if (have + count <= LIMITS.triggers) return true;
  status.textContent = `Trigger cap: ${LIMITS.triggers}. ${have} already there.`;
  return false;
}

/** True when a kind has room for one more against its cap in data/editor.json.
 *  The validator refuses a level over the Foamer cap, so say so first. */
function roomForKind(kind: "foamers"): boolean {
  const have = doc.entries(kind).length;
  if (have + 1 <= LIMITS.foamers) return true;
  status.textContent = `Foamer cap: ${LIMITS.foamers}. ${have} already placed.`;
  return false;
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
    // ED-05: a selection may hold several kinds; each makes its own copies,
    // and the start and the exit have no second one to make.
    const byKind = new Map<EntryKind, string[]>();
    for (const id of selected) {
      const kind = doc.kindOf(id);
      if (!kind) continue;
      if (kind === "prims" && !roomFor(1)) continue;
      const list = byKind.get(kind) ?? [];
      list.push(id);
      byKind.set(kind, list);
    }
    if (!byKind.size) {
      if (selected.size) status.textContent = "Only one start and one exit: neither can be copied.";
      return;
    }
    const made: string[] = [];
    for (const [kind, ids] of byKind) {
      if (kind === "prims" && !roomFor(ids.length)) continue;
      if (kind === "foamers" && doc.entries("foamers").length + ids.length > LIMITS.foamers) {
        status.textContent = `Foamer cap: ${LIMITS.foamers}.`;
        continue;
      }
      made.push(...doc.duplicate(kind, ids));
    }
    selected.clear();
    for (const id of made) selected.add(id);
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
  // ED-08 stage 3: L links the selected trigger's first field, Esc stops.
  if (e.code === "KeyL" && !view.isLooking) {
    const trigger = [...selected].map((id) => doc.find<Trigger>("triggers", id)).find((t): t is Trigger => !!t);
    const key = trigger ? firstLinkKey(trigger) : null;
    if (!trigger) status.textContent = "Select a trigger first, then L links what it acts on.";
    else if (!key) status.textContent = `${trigger.id} has no field for a click yet: give it a when or a do row.`;
    else {
      linkKey = key;
      status.textContent = "Linking: click the thing in the view, Esc to stop.";
      buildInspector();
    }
  }
  if (e.code === "Escape" && linkKey) {
    endLink();
    status.textContent = "";
    buildInspector();
  }
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
  selectInView();
  buildPalette();
}

/** One drag of the handles, written into the document when it ends: the
 *  proxy's position and rotation, or its scale as the prims' size. */
let dragStart: {
  mode: TransformMode; ids: string[]; pos: Vec3; rot: Vec3;
  scale: Vec3; size: Record<string, Vec3>;
  /** ED-05: the placed things the drag moves, their position, yaw and size
   *  at the start, so a marker's patch is worked out from what it was. */
  parts: { id: string; kind: EntryKind | "start" | "exit"; pos: Vec3; yawDeg: number; size: Vec3 | null }[];
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
    parts: ids.flatMap((id) => {
      const marker = view.markerOf(id);
      if (!marker) return [];
      const kind = marker.kind;
      let pos: Vec3 = marker.pos;
      let yawDeg = marker.rot[1];
      let size: Vec3 | null = marker.size;
      if (kind === "start" || kind === "exit") {
        // The view's pseudo ids: the start and the exit live outside the
        // level's arrays and are read back from the level itself.
        const start = doc.level.playerStart;
        const exit = doc.level.exit;
        if (kind === "start") { pos = start.pos; yawDeg = (start.yaw * 180) / Math.PI; size = null; }
        else { pos = exit.pos; size = exit.size; }
      } else {
        const entry = doc.find(kind, id);
        if (!entry) return [];
      }
      return [{ id, kind, pos: [...pos] as Vec3, yawDeg, size: size ? [...size] as Vec3 : null }];
    }),
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
  // ED-05: a drag of a placed thing's handles, one undo step per kind (the
  // start and the exit have their own setters).
  if (start.parts.length) {
    const text = start.mode === "scale" ? "resize" : start.mode === "rotate" ? "rotate" : "move";
    const ratio: Vec3 = [scale[0] / (start.scale[0] || 1), scale[1] / (start.scale[1] || 1), scale[2] / (start.scale[2] || 1)];
    const byKind = new Map<EntryKind, { id: string; patch: Record<string, unknown> }[]>();
    for (const part of start.parts) {
      const patch = dragPatch({ ...part, yawDeg: part.yawDeg }, move, turn[1], ratio, snapOn ? GRID : 0);
      if (!patch) continue;
      if (part.kind === "start") doc.setStart(patch as never, "move the start");
      else if (part.kind === "exit") doc.setExit(patch as never, "move the exit");
      else {
        const list = byKind.get(part.kind) ?? [];
        list.push({ id: part.id, patch });
        byKind.set(part.kind, list);
      }
    }
    for (const [kind, edits] of byKind) doc.change(kind, edits, text);
    return;
  }
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
  if (edits.length) doc.change("prims", edits, start.mode === "scale" ? "resize" : start.mode === "rotate" ? "rotate" : "move");
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

/** ED-08 stage 4: the Arena dialog. It asks what the fight is made of and
 *  writes the triggers in one undo step. Every field is a tick or a number,
 *  so nothing is typed: the message lines are Paul's and are added later in
 *  the inspector. */
function arenaDialog(zone: string) {
  const level = doc.level;
  const blockers = new Set<string>();
  const points = new Set<string>((level.spawnPoints ?? []).map((s) => s.id));
  const doors = new Set<string>();
  const waves: ArenaSpec["waves"] = [{ foamer: RIGS[0]?.id ?? "F01", count: EDITOR.arena.defaultCount }];

  void dialog(`Arena in ${zone}`, (body) => {
    const state = document.createElement("p");
    state.className = "hint";
    body.append(state);

    const ticks = (title: string, options: { id: string; label: string }[], on: Set<string>) => {
      const box = document.createElement("label");
      box.textContent = title;
      const list = document.createElement("div");
      list.className = "ticks";
      for (const option of options) {
        const tick = document.createElement("label");
        const input = document.createElement("input");
        input.type = "checkbox";
        input.checked = on.has(option.id);
        input.addEventListener("change", () => {
          if (input.checked) on.add(option.id);
          else on.delete(option.id);
          say();
        });
        tick.append(input, document.createTextNode(option.label));
        list.append(tick);
      }
      box.append(list);
      body.append(box);
    };

    // Blockers: the prims that start hidden are the ones a fight brings in,
    // so they are ticked to begin with. Any other prim can be picked too.
    const choices = blockerChoices(level);
    for (const prim of level.prims ?? []) if (prim.hidden) blockers.add(prim.id);
    ticks("blockers", choices, blockers);

    ticks("spawn points", (level.spawnPoints ?? []).map((s) => ({ id: s.id, label: s.id })), points);

    const waveBox = document.createElement("div");
    body.append(waveBox);
    const waves_ = () => {
      waveBox.replaceChildren();
      const heading = document.createElement("h3");
      heading.textContent = "waves";
      waveBox.append(heading);
      waves.forEach((wave, i) => {
        const row = document.createElement("div");
        row.className = "row";
        const type = selectField(
          RIGS.map((r) => ({ value: r.id, label: `${r.id} ${r.label}` })),
          wave.foamer,
          (v) => { wave.foamer = v; say(); },
        );
        const count = numberInput(wave.count, 1, (n) => { wave.count = Math.max(1, Math.round(n)); say(); });
        const up = document.createElement("button");
        up.type = "button";
        up.textContent = "Up";
        up.addEventListener("click", () => {
          if (i === 0) return;
          [waves[i - 1], waves[i]] = [waves[i]!, waves[i - 1]!];
          waves_();
        });
        const cut = document.createElement("button");
        cut.type = "button";
        cut.textContent = "Remove";
        cut.addEventListener("click", () => {
          if (waves.length < 2) return;
          waves.splice(i, 1);
          waves_();
        });
        row.append(type, count, up, cut);
        waveBox.append(row);
      });
      const add = document.createElement("button");
      add.type = "button";
      add.textContent = "Add a wave";
      add.addEventListener("click", () => {
        waves.push({ ...waves[waves.length - 1]! });
        waves_();
      });
      waveBox.append(add);
    };
    waves_();

    ticks("doors to open when the fight is won", (level.doors ?? []).map((d) => ({ id: d.id, label: d.id })), doors);

    const build = document.createElement("button");
    build.type = "button";
    build.className = "name";
    build.textContent = "Build the triggers";
    build.addEventListener("click", () => {
      const spec: ArenaSpec = {
        zone, blockers: [...blockers], spawnPoints: [...points], waves: waves.map((w) => ({ ...w })), doors: [...doors],
      };
      const problem = arenaProblem(spec);
      if (problem) return;
      const made = buildArena(spec, (prefix) => doc.nextId(prefix));
      if (!roomForTriggers(made.length)) return;
      doc.addMany("triggers", made, `arena in ${zone}`);
      $("dialogs").hidden = true;
      selected.clear();
      for (const trigger of made) selected.add(trigger.id);
      selectInView();
      buildOutliner();
      buildInspector();
      status.textContent = `Arena in ${zone}: ${made.length} triggers. Give them a message in the inspector if you want words.`;
    });
    body.append(build);

    function say() {
      const spec: ArenaSpec = {
        zone, blockers: [...blockers], spawnPoints: [...points], waves: waves.map((w) => ({ ...w })), doors: [...doors],
      };
      state.textContent = arenaProblem(spec) ?? `Lock, ${waves.length} wave${waves.length === 1 ? "" : "s"}, clear. Nothing is written to the level until Build.`;
    }
    say();
  });
}

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
  for (const id of [...selected]) {
    if (id === START_ID || id === EXIT_ID) continue;
    if (!doc.kindOf(id)) selected.delete(id);
  }
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
