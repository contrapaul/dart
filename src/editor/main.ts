import * as THREE from "three";
import type { Level, Button, LevelDoor, LevelLight, PhysicsObject, Pickup, PlacedFoamer, PlacedModel, Prim, PrimShape, Prop, Trigger, Vec3 } from "../level/format";
import {
  EDITOR, ENTRY_KINDS, LevelDoc, GRID, LIMITS, makePrim, newLevel, PALETTE, snapPrim, snapVec3, ROTATE_STEP, type EntryKind,
  type IdEntry,
} from "./doc";
import { isUpright, transformSelection, type GroupPatch, type GroupThing } from "./group-transform";
import { exportFileName, readLevelFile, skyImageDataUrl } from "./files";
import { buildPrimFields } from "./inspector";
import {
  buildDoorFields, buildExitFields, buildFoamerFields, buildPickupFields, buildPropFields, buildSpawnFields,
  buildStartFields, buildZoneFields, numberInput, selectField, selectKind,
} from "./inspector-parts";
import { EXIT_ID, START_ID, markerFor, setMarkerLevel } from "./markers";
import {
  buildModelFields, modelAssetOf, modelAt, modelFileProblem, modelGhost, removeUnusedAssets,
  unusedAssetIds, voxelCapProblem,
} from "./models-editor";
import { loadModelAsset } from "../level/models";
import { AMMO_TYPES, MARKERS, MIN_SIZE, RIGS, dragPatch, foamerColour, pickupColour, makeDoor, makeFoamer, makePickup, makeProp, makeSpawn, makeZone, rigLabel } from "./parts";
import { buildPaintPanel, PAINT_BRUSH, type PaintSettings } from "./paint-tool";
import { problemsFor, problemsLabel, type Problem } from "./problems";
import { buildTriggerFields } from "./inspector-trigger";
import { PHYSICS_SHAPES, buildPhysicsFields, makePhysicsObject } from "./physics-editor";
import { arenaProblem, blockerChoices, buildArena, type ArenaSpec, type ArenaWaveSpec } from "./arena-build";
import {
  formulasFileName, formulasFileText, formulaProblem, fitImport, deleteFormula,
  listFormulas, putFormula, readFormulasFile, tidyFormulaName, type ArenaFormula,
} from "./arena-formulas";
import { applyLink, firstLinkKey, newTrigger, triggerIds } from "./trigger-parts";
import { triggerSummary } from "./trigger-text";
import { buildLevelFields } from "./sky";
import { deleteLevel, listLevels, pictureDue, putLevel } from "./store";
import { buildMapsScreen } from "./maps-screen";
import { acceptClose, playUrl } from "./play";
import { capProblem, clipText, groupMembers, idsInRect, makeClip, pasteClip, pasteMove, readClip, type Clip } from "./clipboard";
import { ASSET_LIMITS, asOneGroup, type Asset } from "./assets";
import { buildAssetPanel } from "./asset-panel";
import { faceCentre, faceDirection, resizeFace, sizeText, type Resizable } from "./resize";
import { openChoice } from "./open";
import { builtInCopy } from "./builtin";
import { buildHelp } from "./help";
import { buildLightFields, buildLightingSection, makeLight, type LightKindChoice } from "./lights-editor";
import { EditorView, type TransformMode } from "./view";
import { ICONS, type IconName } from "./icons";
import { isFolded, toggleFolded, unfoldGroup } from "./outliner-fold";
import { isLockableKind, lockButton, lockedIds, movableIds } from "./lock";
import { LEAKING_BARREL, PROP_KINDS } from "../level/props";
import { BUTTON_COLOUR, buildButtonFields, makeButton } from "./buttons-editor";
import { TerrainTool, TERRAIN_ID, buildTerrainInspector } from "./terrain-editor";
import { isNudgeKey, nudgeOffset } from "./nudge";
import { layerForPaint } from "../level/terrain";
import { connectedSameLook, fillTerrain, heaviestLayerAt, lookOf, type Look } from "./bucket";

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
  { kind: "props", name: "Prop" },
  { kind: "lights", name: "Light" },
  { kind: "physics", name: "Physics object" },
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
type PartKind = "foamers" | "pickups" | "doors" | "spawnPoints" | "zones" | "props" | "lights" | "buttons" | "physics";
let armed: PrimShape | null = null;
/** The shape the folded Shapes button shows: the last one armed. */
let lastShape: PrimShape = "box";
let armedPart: PartKind | null = null;
/** ED-23: the saved asset the next click in the view places, or null. */
let armedAsset: Asset | null = null;
/** ED-37: how far the armed asset is turned, in degrees, before it is
 *  placed. The ghost shows it turned. */
let assetTurn = 0;
/** ED-35: the model asset id the next click places, or null. */
let armedModel: string | null = null;
/** The kind of pickup and the rig the palette places. */
let pickupType: Pickup["type"] = "darts-standard";
let armedRig = RIGS[0]?.id ?? "F01";
/** The prop kind the Prop tool places (data/props.json or the leaking barrel). */
let armedProp = LEAKING_BARREL;
/** The light kind the Light tool places. */
let armedLight: LightKindChoice = "point";
/** ED-33: the shape the Physics tool places. */
let armedPhysics: PhysicsObject["shape"] = PHYSICS_SHAPES[0]!.value;
/** The colour new prims take: the last one picked in the inspector. */
let placeColour = "#ff7a1a";
/** ED-36: the Paint tool. `paintSurface` is the surface brushed on a prim,
 *  `paintColour` is null (keep the prim's colour) or a hex colour. */
let armedPaint = false;
const paintSettings: PaintSettings = { surface: "brick", colour: null, mode: "brush", radius: PAINT_BRUSH.radius, strength: PAINT_BRUSH.strength };
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

/** ED-30 item 12: the rotation snap choice (degrees, 0 = off), remembered in
 *  localStorage. The rotate handle, snapPrim's rotation and the inspector's
 *  rotation boxes' step use it; a rotation typed into the inspector is kept
 *  exactly as typed. */
const ROTATE_SNAP_KEY = "dart-editor-rotate-snap";
const ROTATE_SNAP_CHOICES = [0, 1, 5, 15, 45, 90];

function readRotateSnap(fallback: number): number {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(ROTATE_SNAP_KEY) : null;
    if (raw === null) return fallback;
    const n = Number(raw);
    return ROTATE_SNAP_CHOICES.includes(n) ? n : fallback;
  } catch {
    return fallback;
  }
}

let rotateSnap = readRotateSnap(ROTATE_STEP);

function saveRotateSnap() {
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(ROTATE_SNAP_KEY, String(rotateSnap));
  } catch {
    // Storage blocked: the choice still works for this session.
  }
}

function rotateStep(): number {
  return rotateSnap > 0 ? rotateSnap : 1;
}

/** True while the keyboard belongs to a text field (typing a name, a
 *  number), so the editor's single letter keys are not taken. */
function typing(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.tagName === "INPUT" || el.tagName === "SELECT" || el.tagName === "TEXTAREA" || el.isContentEditable;
}

// The panels that read the document.
function redraw() {
  view.setLocked(lockedIds(doc.level));
  setMarkerLevel(doc.level);
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
  const modelProblems = [...modelWarnings].map(([id, text]): Problem => ({ text, severity: "warning", id }));
  problems = [...extraProblems, ...modelProblems, ...problemsFor(doc.level, allIds(), START_ID, EXIT_ID)];
  const button = $<HTMLButtonElement>("problemsBtn");
  button.textContent = problemsLabel(problems);
  button.classList.toggle("over", problems.some((p) => p.severity === "error"));
  counts.title = `Caps from data/editor.json: ${LIMITS.prims} prims, ${LIMITS.foamers} foamers, ${LIMITS.triggers} triggers`;
  counts.classList.toggle("over", overCaps(doc.level).length > 0);
}

/** "12 prims, 3 Foamers": short, so the top bar fits a laptop screen; the
 *  caps in data/editor.json are in its tooltip and the Problems count. */
function countText(level: Level): string {
  const parts = [
    `${level.prims?.length ?? 0} prims`,
    `${level.foamers?.length ?? 0} Foamers`,
    `${level.triggers?.length ?? 0} triggers`,
    `${level.lights?.length ?? 0} lights`,
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
  const lights = level.lights?.length ?? 0;
  if (lights > LIMITS.lights) over.push(`${lights} lights, over ${LIMITS.lights}`);
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

/** ED-09 stage 3: warnings that are not the validator's, shown once in the
 *  Problems list. Opening a built in level as a copy puts the conversion's
 *  warnings here; the next level opened clears them. */
let extraProblems: Problem[] = [];

/** ED-35: the Problems warning a model's voxel fill earned (the cap), by
 *  model id. Cleared with the level, set when the tick or the scale changes. */
const modelWarnings = new Map<string, string>();
function setModelWarning(id: string, text: string | null) {
  if (text) modelWarnings.set(id, text);
  else modelWarnings.delete(id);
  updateTopBar();
}

// ED-08 stage 5: a blocker starts hidden so it is out of the way until the
// fight brings it in. In the editor it is drawn see-through so it can be seen
// and clicked; this button stops drawing those prims at all, for a look at the
// level exactly as it begins. It changes nothing in the level.
$("hiddenBtn").addEventListener("click", () => {
  view.setSkipHidden(!view.skipHidden);
  $("hiddenBtn").classList.toggle("on", view.skipHidden);
  const count = (doc.level.prims ?? []).filter((p) => p.hidden).length;
  status.textContent = view.skipHidden
    ? `Not drawing ${count} prim${count === 1 ? "" : "s"} that start hidden.`
    : `Drawing the prims that start hidden see-through again (${count}).`;
  selectInView();
});

// ED-30 item 12: the rotation snap choice, remembered in localStorage.
const rotateSnapSelect = $<HTMLSelectElement>("rotateSnap");
rotateSnapSelect.value = String(rotateSnap);
view.setRotationSnap(rotateSnap);
rotateSnapSelect.addEventListener("change", () => {
  const n = Number(rotateSnapSelect.value);
  if (ROTATE_SNAP_CHOICES.includes(n)) {
    rotateSnap = n;
    view.setRotationSnap(rotateSnap);
    saveRotateSnap();
    status.textContent = rotateSnap ? `Rotation snaps to ${rotateSnap} degrees.` : "Rotation snap off.";
    buildInspector();
  }
});

$("helpBtn").addEventListener("click", () => {
  void dialog("Help", (body) => {
    const host = document.createElement("div");
    host.className = "help";
    body.append(host);
    buildHelp(host);
  });
});

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
const PART_GROUPS: { kind: PartKind | "models"; title: string }[] = [
  { kind: "foamers", title: "Foamers" },
  { kind: "pickups", title: "Pickups" },
  { kind: "doors", title: "Doors" },
  { kind: "spawnPoints", title: "Spawn points" },
  { kind: "zones", title: "Zones" },
  { kind: "props", title: "Props" },
  { kind: "lights", title: "Lights" },
  { kind: "buttons", title: "Buttons" },
  { kind: "physics", title: "Physics" },
  { kind: "models", title: "Models" },
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
  if (kind === "props") {
    const p = doc.find<Prop>(kind, id);
    return p ? `${id}  ${PROP_KINDS[p.kind]?.label ?? p.kind}` : id;
  }
  if (kind === "lights") {
    const l = doc.find<LevelLight>(kind, id);
    return l ? `${id}  ${l.kind}` : id;
  }
  if (kind === "models") {
    const m = doc.find<PlacedModel>(kind, id);
    const asset = m && doc.level.modelAssets?.find((a) => a.id === m.asset);
    return asset ? `${id}  ${asset.name}` : id;
  }
  if (kind === "buttons") {
    const b = doc.find<Button>(kind, id);
    return b?.on ? `${id}  on ${b.on}` : id;
  }
  if (kind === "physics") {
    const o = doc.find<PhysicsObject>(kind, id);
    return o ? `${id}  ${PHYSICS_SHAPES.find((s) => s.value === o.shape)?.label ?? o.shape}` : id;
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
  const mkTitle = (title: string, count: number): HTMLElement => {
    const h = document.createElement("h2");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "group-title";
    btn.setAttribute("aria-expanded", String(!isFolded(title)));
    const tri = document.createElement("span");
    tri.className = "tri";
    tri.textContent = isFolded(title) ? "\u25B8" : "\u25BE";
    const name = document.createElement("span");
    name.textContent = isFolded(title) ? `${title} (${count})` : title;
    btn.append(tri, name);
    btn.addEventListener("click", () => {
      toggleFolded(title);
      buildOutliner();
    });
    h.append(btn);
    return h;
  };
  const mkGroup = (title: string, count: number): { group: HTMLElement; rows: HTMLElement } => {
    const group = document.createElement("div");
    group.className = "group";
    group.append(mkTitle(title, count));
    const rows = document.createElement("div");
    rows.className = "rows";
    if (isFolded(title)) rows.hidden = true;
    group.append(rows);
    return { group, rows };
  };
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
    const { group, rows } = mkGroup(behaviour, prims.length);
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
      const lock = lockButton(prim.locked === true, () => togglePrimLock(prim));
      row.append(name, eye, lock);
      rows.append(row);
    }
    host.append(group);
  }
  // ED-05: one group per kind of placed thing, then the start and the exit.
  for (const { kind, title: groupTitle } of PART_GROUPS) {
    const list = doc.entries(kind);
    if (!list.length) continue;
    const { group, rows } = mkGroup(groupTitle, list.length);
    for (const entry of list) {
      const row = document.createElement("div");
      row.className = "row" + (selected.has(entry.id) ? " selected" : "");
      const name = document.createElement("span");
      name.className = "name";
      name.textContent = partName(entry.id);
      name.addEventListener("click", (e) => pick(entry.id, e.shiftKey));
      if (isLockableKind(kind) && "locked" in entry) {
        const lock = lockButton((entry as { locked?: boolean }).locked === true, () => toggleEntryLock(kind, entry.id));
        row.append(name, lock);
      } else {
        row.append(name);
      }
      rows.append(row);
    }
    host.append(group);
  }
  // ED-08: the Logic group, one row per trigger with what it says in a line.
  const triggers = doc.level.triggers ?? [];
  if (triggers.length) {
    const { group, rows } = mkGroup("Logic", triggers.length);
    for (const trigger of triggers) {
      const row = document.createElement("div");
      row.className = "row" + (selected.has(trigger.id) ? " selected" : "");
      const name = document.createElement("span");
      name.className = "name";
      name.textContent = trigger.id;
      row.title = triggerSummary(trigger);
      // The whole row picks: a long summary used to squeeze the name to
      // nothing, which left nothing to click (Paul, 2026-11-27).
      row.addEventListener("click", (e) => pick(trigger.id, e.shiftKey));
      const summary = document.createElement("span");
      summary.className = "hint";
      summary.textContent = triggerSummary(trigger);
      row.append(name, summary);
      rows.append(row);
    }
    host.append(group);
  }
  const levelList: [string, string][] = [[START_ID, "Player start"], [EXIT_ID, "Exit"]];
  if (doc.level.terrain) levelList.push([TERRAIN_ID, "Terrain"]);
  const { group: level, rows: levelRows } = mkGroup("Level", levelList.length);
  for (const [id, label] of levelList) {
    const row = document.createElement("div");
    row.className = "row" + (selected.has(id) ? " selected" : "");
    const name = document.createElement("span");
    name.className = "name";
    name.textContent = label;
    name.addEventListener("click", (e) => pick(id, e.shiftKey));
    row.append(name);
    levelRows.append(row);
  }
  host.append(level);
}

/** One undo step per lock toggle, for a row in the outliner. */
function togglePrimLock(prim: Prim) {
  doc.change("prims", [{ id: prim.id, patch: { locked: prim.locked ? undefined : true } }], prim.locked ? "unlock" : "lock");
}

function toggleEntryLock(kind: EntryKind, id: string) {
  const entry = doc.find<{ id: string; locked?: boolean }>(kind, id);
  if (!entry) return;
  const locked = entry.locked === true;
  doc.change(kind, [{ id, patch: { locked: locked ? undefined : true } }], locked ? "unlock" : "lock");
}

/** The title of the outliner group an id lives in (a behaviour, a part
 *  kind's group, Logic, or Level), or null for an id with no group. */
function groupTitleFor(id: string): string | null {
  const kind = doc.kindOf(id);
  if (kind === "prims") return doc.prim(id)?.behaviour ?? null;
  if (kind === "triggers") return "Logic";
  if (kind) {
    const g = PART_GROUPS.find((g) => g.kind === kind);
    return g ? g.title : null;
  }
  if (id === START_ID || id === EXIT_ID) return "Level";
  return null;
}

/** Selects one thing, or adds it to the selection with Shift (design/EDITOR
 *  section 4: click, Shift+click). The id names an entry of any kind, or the
 *  view's pseudo ids for the player start and the exit. */
function pick(id: string, add = false) {
  endLink();
  if (!add) selected.clear();
  if (add && selected.has(id)) selected.delete(id);
  else selected.add(id);
  const title = groupTitleFor(id);
  if (title && selected.has(id)) unfoldGroup(title);
  selectInView();
  buildOutliner();
  buildInspector();
}

/** ED-13: a click in the view on a grouped thing selects its whole group;
 *  Shift adds the group, or takes it out when all of it is selected. A thing
 *  in no group is picked as before. */
function pickGroup(id: string, add = false) {
  const members = groupMembers(doc.level, id);
  if (members.length < 2) {
    pick(id, add);
    return;
  }
  selectMany(members, add, add && members.every((m) => selected.has(m)));
}

/** ED-13: selects several things at once (a group, a box select, a paste). */
function selectMany(ids: string[], add = false, remove = false) {
  endLink();
  if (!add) selected.clear();
  for (const id of ids) {
    if (remove) selected.delete(id);
    else selected.add(id);
  }
  if (!remove) {
    const titles = new Set<string>();
    for (const id of ids) {
      const title = groupTitleFor(id);
      if (title) titles.add(title);
    }
    if (titles.size) for (const t of titles) unfoldGroup(t);
  }
  selectInView();
  buildOutliner();
  buildInspector();
}

/** One toolbar button: an icon, a name in its tooltip, and the colour of
 *  the thing it makes, so the button looks like what lands in the view. */
function toolButton(icon: IconName, name: string, colour: string | null, on: boolean, act: () => void): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "tool" + (on ? " armed" : "");
  button.title = name;
  button.setAttribute("aria-label", name);
  button.setAttribute("aria-pressed", String(on));
  button.innerHTML = ICONS[icon];
  if (colour) button.style.color = colour;
  button.addEventListener("click", act);
  return button;
}

function toolGroup(host: HTMLElement, title: string): HTMLElement {
  const group = document.createElement("div");
  group.className = "tools";
  const heading = document.createElement("span");
  heading.className = "tools-title";
  heading.textContent = title;
  group.append(heading);
  host.append(group);
  return group;
}

/** The colour a part's toolbar button is drawn in: its marker's colour. */
function partColour(kind: PartKind): string {
  switch (kind) {
    case "foamers": return foamerColour(armedRig);
    case "pickups": return pickupColour({ type: pickupType } as Pickup);
    case "doors": return MARKERS.doorColour;
    case "spawnPoints": return MARKERS.spawnColour;
    case "zones": return MARKERS.zoneColour;
    case "props": return PROP_KINDS[armedProp]?.parts[0]?.colour ?? MARKERS.doorColour;
    case "lights": return "#fff6e8";
    case "buttons": return BUTTON_COLOUR;
    case "physics": return placeColour;
  }
}

/** Arms one shape or part, or disarms it when it is already armed, and says
 *  in the status line what a click will do. */
function arm(shape: PrimShape | null, part: PartKind | null) {
  if (shape) lastShape = shape;
  terrainTool.disarm();
  armed = shape;
  armedPart = part;
  armedAsset = null;
  armedPaint = false;
  assetTurn = 0;
  armedModel = null;
  view.setGhost(null);
  const name = shape
    ? SHAPES.find((s) => s.shape === shape)!.label
    : part
      ? part === "buttons" ? "Button" : PART_BUTTONS.find((b) => b.kind === part)!.name
      : null;
  const how = shape
    ? "Click to place, or drag out its size on a floor."
    : part === "buttons" ? "Click a surface to mount it on that face." : "Click to place.";
  const hint = $("toolHint");
  hint.textContent = name ? `${name}: ${how} Shift keeps the tool. Esc stops.` : "";
  hint.hidden = !name;
  buildPalette();
}

/** ED-23: arms a saved asset. Its ghost is every thing in it, built once
 *  and then moved under the cursor. */
function armAsset(asset: Asset) {
  arm(null, null);
  armedPaint = false;
  armedAsset = asset;
  const ghost = new THREE.Group();
  for (const kind of ENTRY_KINDS) {
    if (kind === "triggers") continue;
    for (const entry of asset.clip.entries[kind] ?? []) {
      ghost.add(kind === "prims" ? view.primObject(entry as unknown as Prim) : markerFor(kind, entry as never).object);
    }
  }
  view.setGhost(ghost);
  view.ghostAt(null);
  const hint = $("toolHint");
  hint.textContent = `${asset.name}: Click to place. Shift keeps the tool. Esc stops.`;
  hint.hidden = false;
}

/** ED-36: arms the Paint tool. No ghost (painting is a click or a drag, not a
 *  placement), and the hint says what a drag does. */
function armPaint() {
  armed = null;
  armedPart = null;
  armedAsset = null;
  armedPaint = true;
  armedModel = null;
  terrainTool.disarm();
  view.setGhost(null);
  const hint = $("toolHint");
  hint.textContent = "Paint: click or drag across prims to set their surface, or drag on the terrain to paint it. Shift keeps the tool. Esc stops.";
  hint.hidden = false;
  buildPalette();
}

/** ED-35: arms a model asset. A click places a copy sitting on the surface
 *  under the cursor, the way a prim does. */
function armModel(assetId: string) {
  arm(null, null);
  armedModel = assetId;
  const asset = doc.level.modelAssets?.find((a) => a.id === assetId);
  const hint = $("toolHint");
  hint.textContent = `${asset?.name ?? assetId}: click to place. Shift keeps the tool. Esc stops.`;
  hint.hidden = false;
  buildPalette();
}

/** Arms or disarms the Paint tool; its settings live in paintSettings. */
function togglePaint() {
  if (armedPaint) {
    armedPaint = false;
    const hint = $("toolHint");
    hint.textContent = "";
    hint.hidden = true;
    buildPalette();
  } else {
    armPaint();
  }
}

/** The toolbar down the left: shapes, things, logic and the handle modes.
 *  The armed button is lit, and a Foamer or a pickup shows its type picker
 *  beside it. */
function buildPalette() {
  const host = $("palette");
  host.replaceChildren();
  // The shapes fold into one button, the last shape used (Paul,
  // 2026-11-27), so the bar has room. The rest fly out to the right on
  // hover, and on keyboard focus or a tap, since nothing may need hover.
  const shapes = toolGroup(host, "Shapes");
  const current = SHAPES.find((s) => s.shape === (armed ?? lastShape)) ?? SHAPES[0]!;
  const fly = document.createElement("div");
  fly.className = "tool-wrap flyout-wrap";
  const main = toolButton(current.shape, `${current.label} (more shapes beside it)`, placeColour, armed === current.shape,
    () => arm(armed === current.shape ? null : current.shape, null));
  main.setAttribute("aria-haspopup", "true");
  const flyout = document.createElement("div");
  flyout.className = "tool-flyout";
  flyout.setAttribute("role", "group");
  flyout.setAttribute("aria-label", "Shapes");
  for (const { shape, label: name } of SHAPES) {
    flyout.append(toolButton(shape, name, placeColour, armed === shape,
      () => arm(armed === shape ? null : shape, null)));
  }
  fly.append(main, flyout);
  shapes.append(fly);
  // ED-05: the other kinds. A prim armed and a part armed are exclusive, so
  // a click in the view is never ambiguous.
  const things = toolGroup(host, "Things");
  for (const { kind, name } of PART_BUTTONS) {
    const on = armedPart === kind;
    const button = toolButton(kind, name, partColour(kind), on, () => arm(null, on ? null : kind));
    const options = on ? partOptions(kind) : null;
    if (options) {
      const wrap = document.createElement("div");
      wrap.className = "tool-wrap";
      wrap.append(button, options);
      things.append(wrap);
    } else things.append(button);
  }
  // ED-36: the Paint tool. Its option panel lists the surfaces and palette
  // colours; the armed state is its own.
  const paint = toolGroup(host, "Paint");
  const paintWrap = document.createElement("div");
  paintWrap.className = "tool-wrap";
  paintWrap.append(toolButton("paint", "Paint", null, armedPaint, () => togglePaint()));
  if (armedPaint) paintWrap.append(buildPaintPanel(paintSettings, () => buildPalette()));
  paint.append(paintWrap);
  // ED-35: the level's imported models, each by its own name. The button
  // arms the one the picker shows; with none imported the section is not
  // drawn at all.
  const assets = doc.level.modelAssets ?? [];
  if (assets.length) {
    const models = toolGroup(host, "Models");
    const select = document.createElement("select");
    select.className = "tool-options";
    select.title = "Model";
    for (const asset of assets) select.append(new Option(asset.name, asset.id));
    select.value = armedModel && assets.some((a) => a.id === armedModel) ? armedModel : assets[0]!.id;
    select.addEventListener("change", () => armModel(select.value));
    const place = toolButton("box", "Place model", null, armedModel !== null, () => {
      if (armedModel === select.value) arm(null, null);
      else armModel(select.value);
    });
    models.append(place, select);
  }
  const logic = toolGroup(host, "Logic");
  // ED-31: placed by clicking a surface, so it mounts on the face clicked.
  logic.append(toolButton("buttons", "Button", BUTTON_COLOUR, armedPart === "buttons",
    () => arm(null, armedPart === "buttons" ? null : "buttons")));
  // ED-08: a trigger is not placed by a click, so its button adds one at
  // once and selects it, ready for the inspector.
  logic.append(toolButton("trigger", TRIGGER_BUTTON, null, false, () => {
    if (!roomForTriggers(1)) return;
    const made = newTrigger(doc.nextId("trigger"));
    doc.add("triggers", made);
    pick(made.id);
  }));
  // ED-08 stage 4: the Arena button asks a few questions once and writes the
  // three or more triggers the usual fight takes. It needs a zone to start
  // from, so with none selected it says so rather than guessing one.
  logic.append(toolButton("arena", `${ARENA_BUTTON} (select a zone first)`, null, false, () => {
    const zone = [...selected].find((id) => doc.kindOf(id) === "zones");
    if (!zone) {
      status.textContent = "Select a zone first, then build an arena in it.";
      return;
    }
    arenaDialog(zone);
  }));
  // ED-34: the ground. The brush panel shows beside the armed button.
  const ground = toolGroup(host, "Ground");
  const terrainButton = toolButton("terrain", "Terrain", null, terrainTool.armed, () => terrainTool.toggle());
  if (terrainTool.armed) {
    const wrap = document.createElement("div");
    wrap.className = "tool-wrap";
    wrap.append(terrainButton, terrainTool.options());
    ground.append(wrap);
  } else ground.append(terrainButton);
  buildHandleBar();
}

/** The move, rotate and scale buttons, in a bar at the top of the view
 *  under the header, shown only while something with handles is selected
 *  (Paul, 2026-11-27). A trigger or the terrain alone has none. */
function buildHandleBar() {
  const bar = $("handleBar");
  bar.replaceChildren();
  const handled = [...selected].some((id) => id !== TERRAIN_ID && doc.kindOf(id) !== "triggers");
  bar.hidden = !handled;
  if (!handled) return;
  for (const [key, name, label] of [["translate", "Move (1)", "Move"], ["rotate", "Rotate (2)", "Rotate"], ["scale", "Scale (3)", "Scale"]] as const) {
    const button = toolButton(key, name, null, view.mode === key, () => setMode(key));
    const text = document.createElement("span");
    text.textContent = label;
    button.append(text);
    bar.append(button);
  }
}

/** The type picker shown beside an armed Foamer or pickup button. */
function partOptions(kind: PartKind): HTMLElement | null {
  if (kind === "props") {
    // Grouped as data/props.json groups them, the leaking barrel first.
    const select = document.createElement("select");
    select.className = "tool-options";
    select.title = "Prop";
    const groups = new Map<string, HTMLOptGroupElement>();
    for (const [value, k] of Object.entries(PROP_KINDS)) {
      let group = groups.get(k.group);
      if (!group) {
        group = document.createElement("optgroup");
        group.label = k.group;
        groups.set(k.group, group);
        select.append(group);
      }
      group.append(new Option(k.label, value));
    }
    select.value = armedProp;
    select.addEventListener("change", () => {
      armedProp = select.value;
      buildPalette();
    });
    return select;
  }
  if (kind === "lights") {
    const select = document.createElement("select");
    select.className = "tool-options";
    select.title = "Light";
    for (const [value, label] of [["point", "Point"], ["spot", "Spot"]] as const) {
      select.append(new Option(label, value));
    }
    select.value = armedLight;
    select.addEventListener("change", () => {
      armedLight = select.value as LightKindChoice;
      buildPalette();
    });
    return select;
  }
  if (kind === "physics") {
    const select = document.createElement("select");
    select.className = "tool-options";
    select.title = "Physics object shape";
    for (const shape of PHYSICS_SHAPES) select.append(new Option(shape.label, shape.value));
    select.value = armedPhysics;
    select.addEventListener("change", () => {
      armedPhysics = select.value as PhysicsObject["shape"];
      buildPalette();
    });
    return select;
  }
  if (kind !== "pickups" && kind !== "foamers") return null;
  const select = document.createElement("select");
  select.className = "tool-options";
  if (kind === "pickups") {
    select.title = "Pickup type";
    for (const ammo of AMMO_TYPES) select.append(new Option(ammo.label, ammo.type));
    for (const [value, text] of [["health", "Health"], ["blaster", "Blaster"], ["melee", "Hand weapon"], ["key", "Key"]] as const) {
      select.append(new Option(text, value));
    }
    select.value = pickupType;
    select.addEventListener("change", () => {
      pickupType = select.value as Pickup["type"];
      buildPalette();
    });
  } else {
    select.title = "Foamer type";
    for (const rig of RIGS) select.append(new Option(`${rig.id} ${rig.label}`, rig.id));
    select.value = armedRig;
    select.addEventListener("change", () => {
      armedRig = select.value;
      buildPalette();
    });
  }
  return select;
}

/** The inspector for what is selected, or the level's sky and name when
 *  nothing is (stage 4 fills the sky in). */
function buildInspector() {
  buildHandleBar();
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
  if (only === TERRAIN_ID) {
    buildTerrainInspector(host, doc, PALETTE, () => {
      selected.delete(TERRAIN_ID);
      terrainTool.disarm();
    });
    return;
  }
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
    if (id === TERRAIN_ID) continue;
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
  if (id === TERRAIN_ID) return "Terrain";
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
    rotateStep: rotateStep(),
  };
  if (kind === "start") buildStartFields(host, doc.level, ctx);
  else if (kind === "exit") buildExitFields(host, doc.level, ctx);
  else if (kind === "foamers") buildFoamerFields(host, doc.find(kind, id)!, RIGS, ctx);
  else if (kind === "pickups") buildPickupFields(host, doc.find(kind, id)!, ctx);
  else if (kind === "doors") buildDoorFields(host, doc.find(kind, id)!, ctx);
  else if (kind === "spawnPoints") buildSpawnFields(host, doc.find(kind, id)!, ctx);
  else if (kind === "props") buildPropFields(host, doc.find(kind, id)!, ctx);
  else if (kind === "lights") buildLightFields(host, doc.find<LevelLight>(kind, id)!, {
    change: ctx.change,
    redraw: ctx.redraw,
    refused: (text) => { status.textContent = text; },
    maxShadows: EDITOR.lights.maxShadows,
    shadows: doc.entries("lights").filter((l) => (l as LevelLight).castShadow === true).length,
  });
  else if (kind === "buttons") buildButtonFields(host, doc.find<Button>(kind, id)!, doc.level, ctx);
  else if (kind === "physics") buildPhysicsFields(host, doc.find(kind, id)!, ctx);
  else if (kind === "models") {
    buildModelFields(host, doc.find(kind, id)!, doc.level, {
      change: (patch, text) => doc.change("models", [{ id, patch }], text),
      redraw: buildInspector,
      warn: (text) => setModelWarning(id, text),
    });
  }
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
  buildLightingSection(host, doc.level, {
    change: (patch, text) => doc.setFields(patch, text),
    redraw: buildInspector,
  });
  // ED-35: an asset stays in the file after its last copy is deleted, until
  // this drops it. Only assets no placed model uses go.
  const unused = unusedAssetIds(doc.level);
  if (unused.length) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "wide";
    button.textContent = `Remove unused models (${unused.length})`;
    button.addEventListener("click", () => {
      const patch = removeUnusedAssets(doc.level);
      if (!patch) return;
      doc.setFields(patch, "remove unused models");
      status.textContent = `Removed ${unused.length} unused model${unused.length === 1 ? "" : "s"}.`;
      buildInspector();
    });
    host.append(button);
  }
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
    rotateStep: rotateStep(),
  });
  // A prim's fields live in inspector.ts (not my file), so the locked
  // checkbox is appended here, one selected prim only.
  const only = selected.size === 1 ? [...selected][0]! : null;
  if (only) {
    const prim = doc.prim(only);
    if (prim) {
      const lock = document.createElement("label");
      const lockInput = document.createElement("input");
      lockInput.type = "checkbox";
      lockInput.checked = prim.locked === true;
      lockInput.addEventListener("change", () => {
        const locked = lockInput.checked;
        doc.change("prims", [{ id: prim.id, patch: { locked: locked ? true : undefined } }], locked ? "lock" : "unlock");
      });
      lock.append(document.createTextNode("locked"), lockInput);
      host.append(lock);
    }
  }
}

// The view: the camera's own mouse controls are in src/editor/camera.ts
// (wheel, middle and right drags, Alt+left). A plain left click places or
// selects.
const canvas = $<HTMLCanvasElement>("view");

// ED-34: the Terrain tool, its brush strokes and the terrain's inspector.
const terrainTool = new TerrainTool({
  doc, view, canvas, status,
  disarmOthers: () => arm(null, null),
  redrawPalette: () => {
    buildPalette();
    const hint = $("toolHint");
    if (terrainTool.armed) {
      hint.textContent = "Terrain: drag on it to shape or paint. Shift swaps raise and lower. Esc stops.";
      hint.hidden = false;
    } else if (!armed && !armedPart && !armedAsset) hint.hidden = true;
  },
});

/** Pixels the cursor must travel before a press becomes a drag. */
const DRAG_PIXELS = 4;

/** A left press in the view that may turn into a drag: placing the armed
 *  tool (a shape's footprint can be dragged out on a floor), or moving the
 *  thing under the cursor along the surfaces. */
let press:
  | { kind: "place"; x: number; y: number; point: THREE.Vector3; normal: THREE.Vector3; corner: THREE.Vector3 | null; id: string | null }
  | { kind: "move"; x: number; y: number; id: string; grab: THREE.Vector3; started: boolean; offset: THREE.Vector3; lift: number; startY: number }
  | { kind: "box"; x: number; y: number; started: boolean }
  | {
    kind: "resize"; x: number; y: number; id: string; box: Resizable; axis: 0 | 1 | 2; side: 1 | -1;
    origin: THREE.Vector3; dir: THREE.Vector3; grab: number; next: { pos: Vec3; size: Vec3 } | null;
  }
  // ED-36: the Paint tool. One entry per prim painted this drag, each holding
  // the prim's before-state (surface and colour).
  | { kind: "paint"; x: number; y: number; painted: Map<string, { surface: string | undefined; colour: string }> }
  | null = null;

/** ED-14: the size in metres shown by the cursor while a face is dragged or
 *  a shape's footprint is dragged out. Made on first use. */
let sizeLabel: HTMLDivElement | null = null;
function showSize(e: { clientX: number; clientY: number }, size: Vec3 | null) {
  if (!sizeLabel) {
    sizeLabel = document.createElement("div");
    sizeLabel.id = "sizeLabel";
    document.body.append(sizeLabel);
  }
  sizeLabel.hidden = !size;
  if (!size) return;
  sizeLabel.textContent = sizeText(size);
  sizeLabel.style.left = `${e.clientX + 16}px`;
  sizeLabel.style.top = `${e.clientY + 16}px`;
}

/** ED-14: the one selected thing as a box a face drag can resize (a prim, a
 *  zone, a door or the exit), or null. */
function resizable(id: string): Resizable | null {
  const prim = doc.prim(id);
  if (prim) return { pos: prim.pos, size: prim.size, rot: prim.rot };
  const marker = view.markerOf(id);
  if (!marker?.size) return null;
  const pos = marker.kind === "exit" ? doc.level.exit.pos : marker.pos;
  const size = marker.kind === "exit" ? doc.level.exit.size : marker.size;
  return { pos, size, rot: marker.rot };
}

/** ED-13: the rectangle a box select draws, made on first use. */
let selectBox: HTMLDivElement | null = null;
function showSelectBox(x0: number, y0: number, x1: number, y1: number) {
  if (!selectBox) {
    selectBox = document.createElement("div");
    selectBox.id = "selectBox";
    document.body.append(selectBox);
  }
  selectBox.hidden = false;
  selectBox.style.left = `${Math.min(x0, x1)}px`;
  selectBox.style.top = `${Math.min(y0, y1)}px`;
  selectBox.style.width = `${Math.abs(x1 - x0)}px`;
  selectBox.style.height = `${Math.abs(y1 - y0)}px`;
}

/** ED-13: where the cursor last was over the view, for a paste, or null
 *  when it is somewhere else. */
let lastPointer: { clientX: number; clientY: number } | null = null;
/** Set when a press was a place or a drag, so the click after it is not a pick. */
let pressUsed = false;
/** R3-03: where an Alt+click press started, so a click with no drag can pick
 *  a look. The camera's Alt+drag orbit is never a pick. */
let altDown: { clientX: number; clientY: number } | null = null;

/** Paint one prim (the tracked id is recorded once, as a snapshot of before-state). */
function paintPrim(id: string) {
  if (!press || press.kind !== "paint") return;
  const prim = doc.prim(id);
  if (!prim) return;
  if (press.painted.has(id)) return;
  press.painted.set(id, { surface: prim.surface, colour: prim.colour });
  prim.surface = paintSettings.surface === "plain" ? undefined : paintSettings.surface;
  if (paintSettings.colour) prim.colour = paintSettings.colour;
  view.refreshOne(prim);
}

function ndcOf(e: { clientX: number; clientY: number }): [number, number] {
  const rect = canvas.getBoundingClientRect();
  return [((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1];
}

/** The see-through copy of what a click would place, at the cursor. */
function showGhost(point: THREE.Vector3 | null, normal: THREE.Vector3, corner?: THREE.Vector3) {
  if (!point || (!armed && !armedPart && !armedPaint && !armedModel)) {
    view.setGhost(null);
    return;
  }
  if (armed) {
    view.setGhost(view.primObject(primAt(armed, "ghost", point, normal, corner)));
    return;
  }
  if (armedModel) {
    view.setGhost(modelGhost(doc.level, armedModel, point));
    return;
  }
  const entry = partAt(armedPart!, "ghost", point, normal);
  view.setGhost(markerFor(armedPart!, entry as never).object);
}

/** Where a ray from the cursor meets the level's floor height of a drag. */
function floorPoint(e: PointerEvent, y: number): THREE.Vector3 | null {
  const [x, ny] = ndcOf(e);
  const ray = new THREE.Raycaster();
  ray.setFromCamera(new THREE.Vector2(x, ny), view.camera);
  return ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -y), new THREE.Vector3());
}



/** R3-03: Alt+click with the Paint tool armed copies a prim's or physics
 *  object's look into the settings (on the terrain, the heaviest layer under
 *  the cursor). The camera's Alt+drag orbit is untouched: only a click with
 *  no drag picks. */
function pickLookFromView(e: { clientX: number; clientY: number }) {
  const entry = view.pick(...ndcOf(e));
  if (entry?.id) {
    const kind = doc.kindOf(entry.id);
    let look: Look | null = null;
    if (kind === "prims") {
      const p = doc.prim(entry.id);
      if (p) look = lookOf(p);
    } else if (kind === "physics") {
      const o = doc.find("physics", entry.id) as { surface?: string; colour: string } | undefined;
      if (o) look = lookOf(o);
    }
    if (look) {
      paintSettings.surface = look.surface;
      paintSettings.colour = look.colour;
      buildPalette();
      status.textContent = `Picked ${look.surface} / ${look.colour}.`;
      return;
    }
  }
  const t = doc.level.terrain;
  if (t && onTerrain(e, entry)) {
    const th = view.terrainHit(...ndcOf(e));
    if (th) {
      const i = heaviestLayerAt(t, th.x, th.z);
      const layer = t.layers[i]!;
      paintSettings.surface = layer.surface;
      paintSettings.colour = layer.colour;
      buildPalette();
      status.textContent = `Picked ${layer.surface} / ${layer.colour}.`;
      return;
    }
  }
  status.textContent = "Nothing to pick a look from.";
}

/** R3-03: Bucket mode. A click on a prim paints every prim reachable through
 *  touching or overlapping boxes that wear the same surface and colour; a
 *  click on the terrain fills the whole terrain with the chosen look. Each
 *  is one undo step. */
function paintBucket(hit: { id: string | null; point: THREE.Vector3 } | null, e: PointerEvent) {
  if (hit?.id && doc.kindOf(hit.id) === "prims") {
    const ids = connectedSameLook(doc.level, hit.id).map((p) => p.id);
    if (!ids.length) return;
    const patch: Record<string, unknown> = {
      surface: paintSettings.surface === "plain" ? undefined : paintSettings.surface,
    };
    if (paintSettings.colour) patch.colour = paintSettings.colour;
    doc.change("prims", ids.map((id) => ({ id, patch })), `paint ${ids.length} prim${ids.length === 1 ? "" : "s"}`);
    status.textContent = `Filled ${ids.length} prim${ids.length === 1 ? "" : "s"}.`;
    finishBucket(e);
    return;
  }
  const t = doc.level.terrain;
  if (t && onTerrain(e, hit)) {
    if (t.locked) {
      status.textContent = "The terrain is locked. Unlock it in its inspector to paint it.";
      return;
    }
    const { layers, index } = layerForPaint(t, paintSettings.surface, paintSettings.colour);
    const work = structuredClone(t);
    work.layers = layers.map((l) => ({ ...l }));
    fillTerrain(work, index);
    doc.setFields({ terrain: work }, "fill the terrain");
    status.textContent = "Filled the terrain.";
    finishBucket(e);
  }
}

/** R3-03: after a bucket fill, leave the tool armed only when Shift is held,
 *  like the brush drag. */
function finishBucket(e: PointerEvent) {
  // The click that follows this press must not select what was filled.
  pressUsed = true;
  if (!e.shiftKey) {
    armedPaint = false;
    const hint = $("toolHint");
    hint.textContent = "";
    hint.hidden = true;
  }
  buildPalette();
}

// Registered in the capture phase, so it runs before the handles' own
// listener and can keep them out of a press that drags the thing itself.
canvas.addEventListener("pointerdown", (e) => {
  pressUsed = false;
  altDown = e.altKey && armedPaint && e.button === 0 ? { clientX: e.clientX, clientY: e.clientY } : null;
  if (e.button !== 0 || e.altKey || view.nav.busy || view.overHandle || linkKey) return;
  // ED-36: the Paint tool paints, it does not move or select.
  if (armedPaint) {
    const hit = view.pick(...ndcOf(e));
    if (paintSettings.mode === "bucket") {
      paintBucket(hit, e);
      return;
    }
    if (hit?.id && doc.kindOf(hit.id) === "prims") {
      press = { kind: "paint", x: e.clientX, y: e.clientY, painted: new Map() };
      paintPrim(hit.id);
      return;
    }
    // The ground too (Paul, 2026-11-27): a drag on the terrain paints the
    // chosen surface and colour into one of its layers, with the Terrain
    // tool's brush size. The tool stays armed: ground takes many strokes.
    const t = doc.level.terrain;
    if (t && onTerrain(e, hit)) {
      if (t.locked) {
        status.textContent = "The terrain is locked. Unlock it in its inspector to paint it.";
        return;
      }
      const { layers, index } = layerForPaint(t, paintSettings.surface, paintSettings.colour);
      const brush = { mode: "paint" as const, radius: paintSettings.radius, strength: paintSettings.strength, layer: index };
      if (terrainTool.beginStroke(e, brush, layers === t.layers ? undefined : layers, () => {
        status.textContent = "Painted the terrain.";
      })) pressUsed = true;
    }
    return;
  }
  // ED-14: a press on a face handle pulls or pushes that face.
  const face = !armed && !armedPart && !armedAsset && selected.size === 1 ? view.pickFace(...ndcOf(e)) : null;
  const only = face ? [...selected][0]! : null;
  const box = only ? resizable(only) : null;
  if (face && only && box) {
    const origin = new THREE.Vector3(...faceCentre(box, face.axis, face.side));
    const dir = faceDirection(box, face.axis, face.side);
    press = {
      kind: "resize", x: e.clientX, y: e.clientY, id: only, box, axis: face.axis, side: face.side,
      origin, dir, grab: view.axisTravel(...ndcOf(e), origin, dir), next: null,
    };
    canvas.style.cursor = "grabbing";
    return;
  }
  const hit = view.pick(...ndcOf(e));
  if (armed || armedPart || armedAsset || armedModel) {
    if (hit) press = { kind: "place", x: e.clientX, y: e.clientY, point: hit.point, normal: hit.normal, corner: null, id: hit.id };
    return;
  }
  // A placed thing (a Foamer, a pickup) drags at once; a shape only once it
  // is selected, so a drag that starts on the floor does not move the floor.
  if (hit?.id && (selected.has(hit.id) || view.markerOf(hit.id))) {
    press = {
      kind: "move", x: e.clientX, y: e.clientY, id: hit.id, grab: hit.point,
      started: false, offset: new THREE.Vector3(), lift: 0, startY: 0,
    };
    view.holdHandles(true);
    return;
  }
  // ED-13: anywhere else (empty space, the floor, a shape that is not
  // selected) a drag draws a box and selects what is in it.
  press = { kind: "box", x: e.clientX, y: e.clientY, started: false };
}, true);

window.addEventListener("pointermove", (e) => {
  lastPointer = e.target === canvas ? { clientX: e.clientX, clientY: e.clientY } : null;
  if (!press) {
    if ((armed || armedPart || armedModel) && e.target === canvas && !view.nav.busy) {
      const hit = view.pick(...ndcOf(e));
      showGhost(hit?.point ?? null, hit?.normal ?? new THREE.Vector3(0, 1, 0));
    }
    if (armedAsset && e.target === canvas && !view.nav.busy) {
      const hit = view.pick(...ndcOf(e));
      view.ghostAt(hit ? pasteMove(armedAsset.clip, [hit.point.x, hit.point.y, hit.point.z], snapOn ? GRID : 0) : null);
    }
    return;
  }
  if (press.kind === "paint") {
    const hit = view.pick(...ndcOf(e));
    if (hit?.id && doc.kindOf(hit.id) === "prims") paintPrim(hit.id);
    return;
  }
  const far = Math.hypot(e.clientX - press.x, e.clientY - press.y) > DRAG_PIXELS;
  if (press.kind === "resize") {
    if (!far && !press.next) return;
    const metres = view.axisTravel(...ndcOf(e), press.origin, press.dir) - press.grab;
    // A prim is never under a grid step; a door is thinner than one.
    const min = doc.prim(press.id) ? GRID : MIN_SIZE;
    press.next = resizeFace(press.box, press.axis, press.side, metres, snapOn ? GRID : 0, min);
    view.previewResize({ ...press.box, ...press.next });
    showSize(e, press.next.size);
    return;
  }
  if (press.kind === "box") {
    if (!far && !press.started) return;
    press.started = true;
    showSelectBox(press.x, press.y, e.clientX, e.clientY);
    return;
  }
  if (press.kind === "place") {
    // Only a shape on a floor drags out a footprint; a part, or a click on
    // a wall, places at the press point when the button comes up.
    if (!armed || press.normal.y < 0.5 || (!far && !press.corner)) return;
    press.corner = floorPoint(e, press.point.y);
    showGhost(press.point, press.normal, press.corner ?? undefined);
    // ED-14: the footprint's size, by the cursor, while it is dragged out.
    showSize(e, press.corner ? primAt(armed, "ghost", press.point, press.normal, press.corner).size : null);
    return;
  }
  if (!press.started) {
    if (!far) return;
    if (!selected.has(press.id)) pickGroup(press.id, e.shiftKey);
    beginHandleDrag("translate");
    view.beginFollow();
    const proxy = view.proxyPosition;
    press.offset.set(proxy.x - press.grab.x, 0, proxy.z - press.grab.z);
    press.lift = proxy.y - view.selectionBox().min.y;
    press.startY = proxy.y;
    press.started = true;
    canvas.style.cursor = "grabbing";
  }
  // The selection slides over whatever is under the cursor, itself not
  // counted, and stands on a floor; over a wall it keeps its height. Over
  // nothing but the empty ground plane it keeps its height too: the level's
  // floor box stands on that plane, so it used to jump up by its own
  // thickness when dragged (Paul, 2026-11-27).
  const hit = view.pick(...ndcOf(e), new Set(selected));
  if (!hit) return;
  const to = hit.point.clone().add(press.offset);
  const bare = !hit.id && !onTerrain(e, hit);
  to.y = hit.normal.y > 0.5 && !bare ? hit.point.y + press.lift : press.startY;
  if (snapOn) {
    to.x = Math.round(to.x / GRID) * GRID;
    to.z = Math.round(to.z / GRID) * GRID;
  }
  view.moveProxyTo(to);
});

window.addEventListener("pointerup", (e) => {
  const was = press;
  press = null;
  if (!was || e.button !== 0) return;
  if (was.kind === "move") view.holdHandles(false);
  showSize(e, null);
  if (was.kind === "resize") {
    canvas.style.cursor = "";
    const next = was.next;
    // The click that follows a press on a handle is not a pick.
    pressUsed = true;
    if (!next) return;
    const same = next.size.every((n, i) => n === was.box.size[i]);
    if (same) {
      // Nothing to write: put the view back as the level has it.
      redraw();
      return;
    }
    // One undo step, on whichever kind of thing it is.
    const kind = doc.kindOf(was.id);
    if (kind) doc.change(kind, [{ id: was.id, patch: next }], "resize");
    else if (was.id === EXIT_ID) doc.setExit(next, "resize the exit");
    return;
  }
  if (was.kind === "box") {
    if (selectBox) selectBox.hidden = true;
    if (!was.started) return;
    pressUsed = true;
    // Whole groups come with any member the box catches. A locked thing is
    // left out, with the status line saying so.
    const locked = lockedIds(doc.level);
    const caught = idsInRect(view.screenPoints(), { x0: was.x, y0: was.y, x1: e.clientX, y1: e.clientY })
      .filter((id) => !locked.has(id));
    selectMany([...new Set(caught.flatMap((id) => groupMembers(doc.level, id)))], e.shiftKey);
    const skipped = [...locked].filter((id) => idsInRect(view.screenPoints(), { x0: was.x, y0: was.y, x1: e.clientX, y1: e.clientY }).includes(id));
    if (skipped.length) status.textContent = `${skipped.join(", ")} is locked.`;
    else status.textContent = `${selected.size} selected.`;
    return;
  }
  if (was.kind === "place") {
    pressUsed = true;
    const shift = e.shiftKey;
    if (armedModel) {
      placeModel(armedModel, was.point);
      if (!shift) arm(null, null);
      else buildPalette();
      return;
    }
    if (armedAsset) {
      const count = pasteAt(
        armedAsset.clip, [was.point.x, was.point.y, was.point.z], `place ${armedAsset.name}`, true,
        assetTurn ? { deg: assetTurn, centre: view.ghostCentrePoint() } : null,
      );
      if (count) status.textContent = `Placed ${armedAsset.name}.`;
      if (!shift) arm(null, null);
      return;
    }
    view.setGhost(null);
    if (armed) place(armed, was.point, was.normal, was.corner ?? undefined);
    else if (armedPart) placePart(armedPart, was.point, was.normal, was.id);
    // One thing per pick of the tool; Shift keeps the tool for the next.
    if (!shift) arm(null, null);
    else buildPalette();
    return;
  }
  if (was.kind === "move" && was.started) {
    pressUsed = true;
    canvas.style.cursor = "";
    endHandleDrag();
  }
  // ED-36: finish the drag with one undo step for every prim painted.
  if (was.kind === "paint") {
    pressUsed = true;
    const ids = [...was.painted.keys()];
    if (ids.length) {
      const edits: { id: string; patch: Record<string, unknown> }[] = [];
      for (const id of ids) {
        const prim = doc.prim(id);
        if (!prim) continue;
        // Put the before-state back, so doc.change captures the right pair.
        const before = was.painted.get(id)!;
        if (before.surface === undefined) delete prim.surface;
        else prim.surface = before.surface;
        prim.colour = before.colour;
        const patch: Record<string, unknown> = {
          surface: paintSettings.surface === "plain" ? undefined : paintSettings.surface,
        };
        if (paintSettings.colour) patch.colour = paintSettings.colour;
        edits.push({ id, patch });
      }
      doc.change("prims", edits, `paint ${ids.length} prim${ids.length === 1 ? "" : "s"}`);
      status.textContent = `${edits.length} prim${edits.length === 1 ? "" : "s"} painted.`;
      if (!e.shiftKey) {
        armedPaint = false;
        const hint = $("toolHint");
        hint.textContent = "";
        hint.hidden = true;
      }
      buildPalette();
    }
  }
});

canvas.addEventListener("pointerleave", () => {
  if (press) return;
  if (armedAsset) view.ghostAt(null);
  else view.setGhost(null);
});
// ED-13: a double click picks the one thing, out of its group.
canvas.addEventListener("dblclick", (e) => {
  if (armed || armedPart || armedAsset || armedPaint || armedModel || linkKey || e.altKey) return;
  const hit = view.pick(...ndcOf(e));
  if (hit?.id) pick(hit.id, false);
});
canvas.addEventListener("click", (e) => {
  // R3-03: Alt+click with the Paint tool armed picks a look from the thing
  // under the cursor (or the heaviest terrain layer). A drag is the camera's
  // orbit, never a pick.
  if (e.altKey && armedPaint) {
    if (altDown && Math.hypot(e.clientX - altDown.clientX, e.clientY - altDown.clientY) <= DRAG_PIXELS) {
      pickLookFromView(e);
    }
    altDown = null;
    return;
  }
  if (view.nav.swallowClick) {
    view.nav.swallowClick = false;
    return;
  }
  if (pressUsed) {
    pressUsed = false;
    return;
  }
  if (e.altKey || view.nav.busy || view.dragging || typing(e.target)) return;
  if (armedPaint) return;
  const hit = view.pick(...ndcOf(e));
  // ED-08 stage 3: while linking, the click adds the thing to the trigger's
  // field and does not select anything else.
  if (linkKey) {
    if (hit?.id) link(hit.id);
    return;
  }
  // Placing happens when the button comes up (above), not on the click.
  if (armed || armedPart || armedAsset || armedModel) return;
  if (hit?.id) pickGroup(hit.id, e.shiftKey);
  // A click on the terrain selects it, so its colours are one click away.
  else if (doc.level.terrain && onTerrain(e, hit)) pick(TERRAIN_ID, e.shiftKey);
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

/** A prim of a shape standing on the surface under the cursor: the click
 *  point plus half the prim's size along the surface normal, snapped to the
 *  grid. With `corner`, the second corner of a footprint dragged out on a
 *  floor, the prim covers that footprint instead of its default size. */
function primAt(shape: PrimShape, id: string, point: THREE.Vector3, normal: THREE.Vector3, corner?: THREE.Vector3): Prim {
  const base = makePrim(shape, [point.x, point.y, point.z], placeColour);
  if (corner) {
    const a = snapOn ? snapVec3([point.x, point.y, point.z], GRID) : [point.x, point.y, point.z];
    const b = snapOn ? snapVec3([corner.x, corner.y, corner.z], GRID) : [corner.x, corner.y, corner.z];
    const min = snapOn ? GRID : 0.1;
    const size: Vec3 = [Math.max(min, Math.abs(b[0]! - a[0]!)), base.size[1], Math.max(min, Math.abs(b[2]! - a[2]!))];
    // The footprint grows from the anchor toward the cursor, so a small
    // drag never jumps the shape to the far side of the click.
    const cx = a[0]! + Math.sign(b[0]! - a[0]! || 1) * size[0] / 2;
    const cz = a[2]! + Math.sign(b[2]! - a[2]! || 1) * size[2] / 2;
    const made: Prim = { ...base, id, size, pos: [cx, point.y + size[1] / 2, cz] };
    return snapOn ? { ...snapPrim(made, GRID, rotateSnap), pos: made.pos } : made;
  }
  const pos: Vec3 = [
    point.x + normal.x * base.size[0] / 2,
    point.y + normal.y * base.size[1] / 2,
    point.z + normal.z * base.size[2] / 2,
  ];
  const made: Prim = { ...base, id, pos };
  return snapOn ? snapPrim(made, GRID, rotateSnap) : made;
}

/** Places a prim (see `primAt`) and selects it. */
function place(shape: PrimShape, point: THREE.Vector3, normal: THREE.Vector3, corner?: THREE.Vector3) {
  if (!roomFor(1)) return;
  const prim = primAt(shape, doc.nextId(shape), point, normal, corner);
  selected.clear();
  doc.add("prims", prim);
  // Select what was just placed, after the document's own redraw: the
  // inspector then has the new prim, one Ctrl+D from a copy.
  pick(prim.id);
}

/** ED-05: a Foamer, a pickup, a door, a spawn point or a zone on the surface
 *  under the cursor, snapped to the grid. The factory (src/editor/parts.ts)
 *  fills the fields the validator wants for that kind. */
function partAt(kind: PartKind, id: string, point: THREE.Vector3, normal: THREE.Vector3): { id: string; pos: Vec3 } {
  const at: Vec3 = [point.x, point.y, point.z];
  const snapped = <T extends { pos: Vec3 }>(made: T): T => snapOn ? { ...made, pos: snapVec3(made.pos, GRID) } : made;
  if (kind === "foamers") return snapped(makeFoamer(id, at, armedRig));
  if (kind === "pickups") return snapped(makePickup(id, pickupType, at));
  if (kind === "doors") {
    const made = makeDoor(id, at);
    // A door stands on the surface it was clicked: its centre is half its
    // height up along the normal, as a prim's is.
    return snapped({ ...made, pos: [point.x + normal.x * 0.2, made.pos[1], point.z + normal.z * 0.2] as Vec3 });
  }
  if (kind === "spawnPoints") return snapped(makeSpawn(id, at));
  if (kind === "props") return makeProp(id, armedProp, at);
  if (kind === "lights") return snapped(makeLight(id, at, armedLight, 0.5, [normal.x, normal.y, normal.z]));
  // ED-31: a button sits at the hit point, facing out of the face clicked.
  if (kind === "buttons") return makeButton(id, at, [normal.x, normal.y, normal.z]);
  if (kind === "physics") {
    return snapped(makePhysicsObject(id, armedPhysics, placeColour, at, [normal.x, normal.y, normal.z]));
  }
  return snapped(makeZone(id, at));
}

/** Places a part (see `partAt`) and selects it. `on` is the thing the click
 *  hit, for a button mounted on it (null on the level's own floor). */
function placePart(kind: PartKind, point: THREE.Vector3, normal: THREE.Vector3, on: string | null = null) {
  if (kind === "foamers" && !roomForKind("foamers")) return;
  if (kind === "props" && doc.entries("props").length >= LIMITS.props) {
    status.textContent = `Prop cap: ${LIMITS.props}.`;
    return;
  }
  if (kind === "lights" && doc.entries("lights").length >= LIMITS.lights) {
    status.textContent = `Light cap: ${LIMITS.lights}.`;
    return;
  }
  if (kind === "physics" && doc.entries("physics").length >= LIMITS.physics) {
    status.textContent = `Physics object cap: ${LIMITS.physics}.`;
    return;
  }
  const prefix = kind === "foamers" ? "foamer" : kind === "pickups" ? pickupPrefix() : kind === "doors" ? "door" : kind === "spawnPoints" ? "spawn" : kind === "props" ? "prop" : kind === "lights" ? "light" : kind === "buttons" ? "button" : kind === "physics" ? "object" : "zone";
  const id = doc.nextId(prefix);
  // ED-31: a button mounts on a thing, not on a marker for a door or a
  // pickup: only the kinds a move can carry count.
  const carrier = on && ["prims", "props", "models", "physics"].includes(doc.kindOf(on) ?? "") ? on : null;
  const entry = kind === "buttons"
    ? makeButton(id, [point.x, point.y, point.z], [normal.x, normal.y, normal.z], carrier ?? undefined)
    : partAt(kind, id, point, normal);
  doc.add(kind, entry as never);
  pick(entry.id);
}

/** ED-35: places a model of an asset where the click landed, once its
 *  bounds are known (the asset loads off the main path). It sits on the
 *  surface: its own bounds' bottom at the hit point. */
function placeModel(assetId: string, point: THREE.Vector3) {
  if (doc.entries("models").length >= LIMITS.models) {
    status.textContent = `Model cap: ${LIMITS.models}.`;
    return;
  }
  const id = doc.nextId("model");
  void modelAt(doc.level, id, assetId, point).then((entry) => {
    if (!entry) {
      status.textContent = `${assetId} is not an asset of this level.`;
      return;
    }
    doc.add("models", entry);
    pick(entry.id);
    status.textContent = `Placed ${entry.id}.`;
  });
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
  // ED-11: while a playtest is up the keys are the game's. Esc reaches this
  // page only when the frame does not have the keyboard, and closes it.
  if (playFrame) {
    if (e.code === "Escape") closePlay();
    return;
  }
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
    // ED-13: the copies of a group form a new group, across the kinds.
    const groups = new Map<string, string>();
    for (const [kind, ids] of byKind) {
      if (kind === "prims" && !roomFor(ids.length)) continue;
      if (kind === "foamers" && doc.entries("foamers").length + ids.length > LIMITS.foamers) {
        status.textContent = `Foamer cap: ${LIMITS.foamers}.`;
        continue;
      }
      made.push(...doc.duplicate(kind, ids, undefined, groups));
    }
    selected.clear();
    for (const id of made) selected.add(id);
    return;
  }
  // ED-13: Ctrl+G groups what is selected, Ctrl+Shift+G takes it apart.
  if (meta && e.code === "KeyG") {
    e.preventDefault();
    const ids = [...selected];
    if (e.shiftKey) {
      doc.setGroup(ids, null);
      status.textContent = "Ungrouped.";
    } else if (ids.filter((id) => doc.kindOf(id) && doc.kindOf(id) !== "triggers").length < 2) {
      status.textContent = "Select two or more things to group them.";
    } else {
      doc.setGroup(ids, doc.nextGroup());
      status.textContent = "Grouped. A click on one selects them all; a double click picks one.";
    }
    return;
  }
  if (meta) return;
  const codes = ["KeyW", "KeyA", "KeyS", "KeyD", "KeyQ", "KeyE", "ShiftLeft", "ShiftRight"];
  if (codes.includes(e.code)) view.nav.keyDown(e.code);
  if (e.code === "KeyF") view.frame([...selected]);
  if (e.code === "Home") resetCamera();
  // [ and ] turn the selection about the vertical by one rotate step.
  if ((e.code === "BracketLeft" || e.code === "BracketRight") && !view.isLooking) {
    const deg = e.code === "BracketLeft" ? -ROTATE_STEP : ROTATE_STEP;
    if (armedAsset) turnAsset(deg);
    else turnSelection(deg);
  }
  // ED-09 stage 1: P plays from the level's start, Shift+P from the camera.
  // ED-11: Tab and Shift+Tab do the same.
  if ((e.code === "KeyP" || e.code === "Tab") && !view.isLooking) {
    e.preventDefault();
    playFrom(e.shiftKey ? view.cameraSpot() : null);
  }
  if (e.code === "KeyG") {
    snapOn = !snapOn;
    view.setSnap(snapOn);
  }
  // W, A, S, D, Q and E fly the camera (Paul, 2026-11-27), so the handle
  // modes are on 1, 2 and 3.
  if (e.code === "Digit1") setMode("translate");
  if (e.code === "Digit2") setMode("rotate");
  if (e.code === "Digit3") setMode("scale");
  // The arrow keys nudge the selection one grid step (0.1 m with snap
  // off), Shift four times as far; PageUp and PageDown move it up and down.
  if (isNudgeKey(e.code) && selected.size) {
    e.preventDefault();
    const step = (snapOn ? GRID : EDITOR.nudgeFine) * (e.shiftKey ? 4 : 1);
    const forward = view.camera.getWorldDirection(new THREE.Vector3());
    nudgeSelection(nudgeOffset(e.code, forward.x, forward.z, step));
  }
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
  if (e.code === "Escape" && !linkKey && (armed || armedPart || armedAsset || armedPaint)) arm(null, null);
  if (e.code === "Escape" && terrainTool.armed) terrainTool.disarm();
  if (e.code === "Escape" && linkKey) {
    endLink();
    status.textContent = "";
    buildInspector();
  }
  if (e.code === "Delete" || e.code === "Backspace") {
    e.preventDefault();
    if (selected.size) {
      const locked = lockedIds(doc.level);
      const { ok, skipped } = movableIds([...selected], locked);
      if (skipped.length) status.textContent = `${skipped.join(", ")} is locked.`;
      if (ok.length) {
        doc.remove(ok);
        for (const id of ok) selected.delete(id);
      }
    }
  }
});

// ED-13: copy, cut and paste go through the browser's own clipboard events,
// so they need no permission and the clip is plain text any tab can read.
// A text field, words selected on the page, and a running playtest keep
// the browser's own behaviour.
function clipboardIsOurs(): boolean {
  return !playFrame && !typing(document.activeElement) && !window.getSelection()?.toString();
}

function copySelection(e: ClipboardEvent): number {
  const clip = makeClip(doc.level, [...selected]);
  const count = Object.values(clip.entries).reduce((n, list) => n + list.length, 0);
  if (!count || !e.clipboardData) return 0;
  e.clipboardData.setData("text/plain", clipText(clip));
  e.preventDefault();
  return count;
}

document.addEventListener("copy", (e) => {
  if (!clipboardIsOurs()) return;
  const count = copySelection(e);
  if (count) status.textContent = `Copied ${count} thing${count === 1 ? "" : "s"}.`;
});

document.addEventListener("cut", (e) => {
  if (!clipboardIsOurs()) return;
  const count = copySelection(e);
  if (!count) return;
  doc.remove([...selected]);
  selected.clear();
  status.textContent = `Cut ${count} thing${count === 1 ? "" : "s"}.`;
});

document.addEventListener("paste", (e) => {
  if (!clipboardIsOurs()) return;
  const clip = readClip(e.clipboardData?.getData("text/plain") ?? "");
  if (!clip) return;
  e.preventDefault();
  // Under the cursor when it is over the view, else in the middle of it.
  const hit = lastPointer ? view.pick(...ndcOf(lastPointer)) : view.pick(0, 0);
  const at: Vec3 | null = hit ? [hit.point.x, hit.point.y, hit.point.z] : null;
  const count = pasteAt(clip, at, "paste");
  if (count) status.textContent = `Pasted ${count} thing${count === 1 ? "" : "s"}.`;
});

/** ED-37: turns a clip's things as one object about `pivot`, before they
 *  are added: the patches of src/editor/group-transform.ts on entries that
 *  are not in the level yet. */
function turnMade(
  made: { kind: EntryKind; entry: IdEntry }[], pivot: Vec3, deg: number,
): { kind: EntryKind; entry: IdEntry }[] {
  const things = made.flatMap((m) => {
    const thing = thingFromEntry(m.kind, m.entry as TurnyEntry);
    return thing ? [thing] : [];
  });
  const R = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), deg * RAD);
  const byId = new Map(transformSelection(things, pivot, R, 1).map((p) => [p.id, p.patch]));
  return made.map((m) => {
    const patch = byId.get(m.entry.id);
    return patch ? { kind: m.kind, entry: { ...m.entry, ...patch } } : m;
  });
}

/** Adds a clip's things to the level at a point as one undo step, selects
 *  them, and returns how many. Over a cap it says why and adds nothing.
 *  ED-23: a placed asset (`oneGroup`) goes in as one group. */
function pasteAt(
  clip: Clip, at: Vec3 | null, verb: string, oneGroup = false,
  turned: { deg: number; centre: Vec3 } | null = null,
): number {
  const problem = capProblem(doc.level, clip);
  if (problem) {
    status.textContent = problem;
    return 0;
  }
  let made = pasteClip(clip, {
    next: (prefix) => doc.nextId(prefix),
    nextGroup: (taken) => doc.nextGroup(taken),
  }, at, snapOn ? GRID : 0);
  if (oneGroup) made = asOneGroup(made, doc.nextGroup());
  if (!made.length) return 0;
  if (turned && Math.abs(turned.deg) > 1e-4) {
    // ED-37: an asset turned before it was placed turns as one object here,
    // about the middle its ghost showed, moved to where it lands.
    const move = pasteMove(clip, at, snapOn ? GRID : 0);
    const pivot: Vec3 = [
      turned.centre[0] + move[0], turned.centre[1] + move[1], turned.centre[2] + move[2],
    ];
    made = turnMade(made, pivot, turned.deg);
  }
  doc.addMixed(made, `${verb}, ${made.length} thing${made.length === 1 ? "" : "s"}`);
  selectMany(made.map((m) => m.entry.id));
  return made.length;
}

// ED-23: the Assets panel. Saving takes what is selected; picking an asset
// closes the panel and arms it, to be placed by a click in the view.
$("assetsBtn").addEventListener("click", () => {
  void dialog("Assets", (body) => buildAssetPanel(body, {
    selection: () => makeClip(doc.level, [...selected]),
    picture: (clip) => view.picture(
      Object.values(clip.entries).flat().map((entry) => entry.id), ASSET_LIMITS.pictureSize,
    ),
    place: (asset) => {
      $("dialogs").hidden = true;
      armAsset(asset);
    },
  }));
});

window.addEventListener("keyup", (e) => {
  view.nav.keyUp(e.code);
});

/** The document patch for one part (the handles' readback), one undo step.
 *  A light's patch writes its own XYZ rot; every other kind goes through
 *  the shared dragPatch. */
function partPatch(part: NonNullable<typeof dragStart>["parts"][number], move: Vec3, turnY: number, ratio: Vec3): Record<string, unknown> | null {
  if (part.kind !== "lights") return dragPatch(part, move, turnY, ratio, snapOn ? GRID : 0, rotateSnap);
  const patch: Record<string, unknown> = {};
  if (move.some((n) => Math.abs(n) > 1e-4)) {
    const pos: Vec3 = [part.pos[0] + move[0], part.pos[1] + move[1], part.pos[2] + move[2]];
    patch.pos = snapOn ? snapVec3(pos, GRID) : pos;
  }
  if (Math.abs(turnY) > 1e-4) {
    const y = (((part.rot[1] + turnY) % 360) + 360) % 360;
    patch.rot = [part.rot[0], y, part.rot[2]];
  }
  return Object.keys(patch).length ? patch : null;
}

// ED-37: a selection of two or more turns and scales as one object about the
// middle of its bounds. These three read what is selected into the entries
// src/editor/group-transform.ts wants, apply its patches as one undo step,
// and give the drag a pivot.

const RAD = Math.PI / 180;

function quatEulerDegrees(rot: Vec3): [number, number, number, number] {
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rot[0] * RAD, rot[1] * RAD, rot[2] * RAD, "XYZ"));
  return [q.x, q.y, q.z, q.w];
}

function quatYaw(radians: number): [number, number, number, number] {
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), radians);
  return [q.x, q.y, q.z, q.w];
}

/** One selected thing as the group transform reads it, or null for a thing
 *  with no place in the world (a trigger). */
function groupThing(id: string): GroupThing | null {
  if (id === START_ID) {
    const start = doc.level.playerStart;
    return {
      id, kind: "start", pos: [...start.pos] as Vec3, quat: quatYaw(start.yaw),
      upright: true, turnKey: "yaw", sizeKey: null, size: null,
    };
  }
  if (id === EXIT_ID) {
    const exit = doc.level.exit;
    return {
      id, kind: "exit", pos: [...exit.pos] as Vec3, quat: [0, 0, 0, 1],
      upright: true, turnKey: null, sizeKey: "size", size: [...exit.size] as Vec3,
    };
  }
  const kind = doc.kindOf(id);
  if (!kind || kind === "triggers") return null;
  return thingFromEntry(kind, doc.find(kind, id) as TurnyEntry | undefined);
}

/** The fields the group transform reads off any kind's entry (an asset's
 *  things are read this way before they are in the level). */
type TurnyEntry = IdEntry & {
  rot?: Vec3; size?: Vec3; scale?: Vec3; yaw?: number; rotY?: number;
};

/** One entry of any kind, as the group transform reads it. */
function thingFromEntry(kind: EntryKind, entry: TurnyEntry | undefined): GroupThing | null {
  if (!entry?.pos) return null;
  // Read the fields the kind's own type has, so a card that adds a kind needs
  // no line here: `rot` is Euler degrees, `yaw` radians, `rotY` degrees.
  const upright = isUpright(kind);
  const quat = entry.rot ? quatEulerDegrees(entry.rot)
    : kind === "foamers" ? quatYaw(entry.yaw ?? 0)
      : kind === "doors" || kind === "props" ? quatYaw((entry.rotY ?? 0) * RAD)
        : [0, 0, 0, 1] as [number, number, number, number];
  const sizeKey: "size" | "scale" | null = entry.size ? "size" : entry.scale || kind === "models" ? "scale" : null;
  const size = (entry.size ?? entry.scale ?? (kind === "models" ? [1, 1, 1] : null)) as Vec3 | null;
  // A prim, a physics object and a model always hold a `rot`, even when it is
  // omitted (format.ts), so theirs is written on every turn.
  const euler = kind === "prims" || kind === "physics" || kind === "models";
  return {
    id: entry.id, kind, pos: [...entry.pos] as Vec3, quat, upright,
    turnKey: euler ? "rot" : upright ? (kind === "foamers" ? "yaw" : "rotY") : null,
    sizeKey, size: size ? [...size] as Vec3 : null,
  };
}

/** Every selected thing the group transform can move. */
function groupThings(ids: string[]): GroupThing[] {
  return ids.flatMap((id) => {
    const thing = groupThing(id);
    return thing ? [thing] : [];
  });
}

/** Applies patches of any kinds as one undo step, through the level fields:
 *  a group drag can span prims, markers and the start. */
function applyGroupPatches(patches: GroupPatch[], text: string) {
  if (!patches.length) return;
  const patch: Partial<Level> = {};
  const byKind = new Map<EntryKind, Map<string, Record<string, unknown>>>();
  let start: Record<string, unknown> | null = null;
  let exit: Record<string, unknown> | null = null;
  for (const p of patches) {
    if (p.kind === "start") { start = p.patch; continue; }
    if (p.kind === "exit") { exit = p.patch; continue; }
    const map = byKind.get(p.kind) ?? new Map<string, Record<string, unknown>>();
    map.set(p.id, p.patch);
    byKind.set(p.kind, map);
  }
  for (const [kind, map] of byKind) {
    const list = doc.entries(kind).map((e) => (map.has(e.id) ? { ...e, ...map.get(e.id) } : e));
    (patch as Record<string, unknown>)[kind] = list;
  }
  if (start) patch.playerStart = { ...doc.level.playerStart, ...start };
  if (exit) patch.exit = { ...doc.level.exit, ...exit };
  doc.setFields(patch, text);
}

/** The middle of the selection's bounds as drawn, which a group turns and
 *  scales about. */
function selectionPivot(): Vec3 {
  const c = view.selectionBox().getCenter(new THREE.Vector3());
  return [c.x, c.y, c.z];
}

/** True when the pointer is over the terrain and nothing stands in front of
 *  it (the view's pick gives the terrain no id, as it does the floor). */
function onTerrain(e: { clientX: number; clientY: number }, hit: { point: THREE.Vector3; id: string | null } | null): boolean {
  const on = view.terrainHit(...ndcOf(e));
  return !!(on && hit && !hit.id && on.distanceTo(hit.point) < 0.01);
}

/** Moves every selected thing that can move by one offset, as one undo
 *  step. Locked things stay put and the status line says so. */
function nudgeSelection(by: Vec3) {
  const locked = lockedIds(doc.level);
  const { ok, skipped } = movableIds([...selected], locked);
  const things = groupThings(ok);
  status.textContent = skipped.length ? `${skipped.join(", ")} is locked.` : "";
  if (!things.length) return;
  const round = (n: number) => Math.round(n * 1e4) / 1e4;
  applyGroupPatches(things.map((t) => ({
    id: t.id, kind: t.kind,
    patch: { pos: [round(t.pos[0] + by[0]), round(t.pos[1] + by[1]), round(t.pos[2] + by[2])] },
  })), `nudge ${things.length} thing${things.length === 1 ? "" : "s"}`);
}

/** ED-37: turns the armed asset as one object about the middle of its
 *  bounds, before it is placed. The ghost shows the turn. */
function turnAsset(deg: number) {
  assetTurn = (((assetTurn + deg) % 360) + 360) % 360;
  view.turnGhost(assetTurn);
  status.textContent = `Asset turned ${Math.round(assetTurn)} degrees. Click to place it.`;
}

/** Turns every selected thing that can turn by `deg` about the vertical,
 *  each about its own centre: one undo step per kind. */
function turnSelection(deg: number) {
  const locked = lockedIds(doc.level);
  const { ok, skipped } = movableIds([...selected], locked);
  if (skipped.length) status.textContent = `${skipped.join(", ")} is locked.`;
  if (!ok.length) return;
  const ids = ok;
  // ED-37: two or more turn as one object about the middle of their bounds.
  const things = groupThings(ids);
  if (things.length >= 2) {
    const R = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), deg * RAD);
    const patches = transformSelection(things, selectionPivot(), R, 1);
    applyGroupPatches(patches, `turn ${patches.length} things`);
    return;
  }
  const prims = ids.flatMap((id) => {
    const prim = doc.prim(id);
    if (!prim) return [];
    const r = prim.rot ?? [0, 0, 0];
    const rot: Vec3 = [r[0], (((r[1] + deg) % 360) + 360) % 360, r[2]];
    return [{ id, patch: { rot: snapOn ? snapVec3(rot, rotateSnap) : rot } }];
  });
  if (prims.length) doc.change("prims", prims, "turn");
  const byKind = new Map<EntryKind, { id: string; patch: Record<string, unknown> }[]>();
  for (const part of partHandles(ids)) {
    const patch = partPatch(part, [0, 0, 0], deg, [1, 1, 1]);
    if (!patch) continue;
    if (part.kind === "start") doc.setStart(patch as never, "turn the start");
    else if (part.kind !== "exit") {
      const list = byKind.get(part.kind) ?? [];
      list.push({ id: part.id, patch });
      byKind.set(part.kind, list);
    }
  }
  for (const [kind, edits] of byKind) doc.change(kind, edits, "turn");
}

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
   *  at the start, so a marker's patch is worked out from what it was. A
   *  light also carries its full rot triple (XYZ), which is what the
   *  rotate handle writes. */
  parts: { id: string; kind: EntryKind | "start" | "exit"; pos: Vec3; yawDeg: number; size: Vec3 | null; rot: Vec3 }[];
  /** ED-37: the group of two or more, the middle it turns about and the
   *  handles' rotation when the drag began. */
  things: GroupThing[];
  pivot: Vec3;
  quat: THREE.Quaternion;
} | null = null;
/** Where each selected placed thing is, its yaw and size, as the drag and
 *  turn code reads them. */
function partHandles(ids: string[]): NonNullable<typeof dragStart>["parts"] {
  return ids.flatMap((id) => {
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
    return [{ id, kind, pos: [...pos] as Vec3, yawDeg, size: size ? [...size] as Vec3 : null, rot: [...(marker.rot ?? [0, 0, 0])] as Vec3 }];
  });
}

/** The start of a drag of the selection, by its handles or by the things
 *  themselves (`mode` is then "translate"). */
function beginHandleDrag(mode: TransformMode = view.mode) {
  const ids = [...selected];
  const state = view.proxyState();
  dragStart = {
    mode,
    ids,
    pos: state.pos,
    rot: state.rot,
    scale: state.scale,
    size: Object.fromEntries(ids.map((id) => [id, doc.prim(id)?.size ?? [1, 1, 1]])),
    parts: partHandles(ids),
    things: groupThings(ids),
    pivot: selectionPivot(),
    quat: view.proxyQuaternion(),
  };
}
view.controls.addEventListener("mouseDown", () => beginHandleDrag());

/** The end of a drag: writes what moved into the document, one undo step. */
function endHandleDrag() {
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
  // ED-37: two or more things turn and scale as one object about the middle
  // of their bounds, as one undo step across the kinds a group may span.
  if (start.things.length >= 2) {
    const R = view.proxyQuaternion().multiply(start.quat.clone().invert());
    const s = ((scale[0] / (start.scale[0] || 1)) + (scale[1] / (start.scale[1] || 1)) + (scale[2] / (start.scale[2] || 1))) / 3;
    let patches = transformSelection(start.things, start.pivot, R, s > 0 ? s : 1, move);
    // A drag that only moves the group snaps its places to the grid; a turn
    // or a scale keeps every thing's place relative to the others.
    if (snapOn && !turned && !scaled) {
      patches = patches.map((p) => (p.patch.pos
        ? { ...p, patch: { ...p.patch, pos: snapVec3(p.patch.pos as Vec3, GRID) } }
        : p));
    }
    applyGroupPatches(patches, start.mode === "scale" ? "resize" : start.mode === "rotate" ? "rotate" : "move");
    return;
  }
  // ED-05: a drag of a placed thing's handles, one undo step per kind (the
  // start and the exit have their own setters).
  if (start.parts.length) {
    const text = start.mode === "scale" ? "resize" : start.mode === "rotate" ? "rotate" : "move";
    const ratio: Vec3 = [scale[0] / (start.scale[0] || 1), scale[1] / (start.scale[1] || 1), scale[2] / (start.scale[2] || 1)];
    const byKind = new Map<EntryKind, { id: string; patch: Record<string, unknown> }[]>();
    for (const part of start.parts) {
      const patch = partPatch(part, move, turn[1], ratio);
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
      // ED-12: only what the drag changed is written, and only that is
      // snapped. A move used to snap the turn as well, which bent a prim
      // at an off-step angle (a converted ramp) the first time it was moved.
      if (moved) patch.pos = snapOn ? snapVec3(pos, GRID) : pos;
      if (turned) patch.rot = snapOn ? snapVec3(rot, rotateSnap) : rot;
    }
    return { id, patch };
  }).filter((e) => Object.keys(e.patch).length);
  if (edits.length) doc.change("prims", edits, start.mode === "scale" ? "resize" : start.mode === "rotate" ? "rotate" : "move");
}
view.controls.addEventListener("mouseUp", () => endHandleDrag());

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

let lastPictureAt: number | null = null;

async function saveNow(): Promise<string | null> {
  window.clearTimeout(saveTimer);
  try {
    // A level's thumbnail is retaken at most once per 10 s, so typing is
    // not a redraw per keystroke.
    const picture = pictureDue(lastPictureAt, Date.now()) ? view.levelPicture() || undefined : undefined;
    if (picture) lastPictureAt = Date.now();
    savedKey = await putLevel(doc.level, savedKey ?? undefined, picture);
    status.textContent = "Saved";
    return savedKey;
  } catch (e) {
    status.textContent = `Not saved: ${(e as Error).message}`;
    return null;
  }
}

/** ED-12: true while a level is being put into the document, which is not
 *  a change to it. A level is first written to the store on its first
 *  change, so opening the editor or pressing New leaves no empty level. */
let opening = false;

function load(level: Level, key: string | null) {
  selected.clear();
  savedKey = key;
  extraProblems = [];
  modelWarnings.clear();
  opening = true;
  doc.load(level);
  opening = false;
  // ED-35: a voxel model already over the cap in the file is a warning as
  // soon as it opens, the same one the voxel tick gives.
  for (const m of level.models ?? []) {
    if (m.behaviour !== "breakable" || !m.voxel) continue;
    void voxelCapProblem(level, m).then((text) => {
      if (text) setModelWarning(m.id, text);
    });
  }
  syncNameField();
  // ED-12: every level opens looking at the place a run begins.
  view.openOn(level.playerStart);
}

$("newBtn").addEventListener("click", () => load(newLevel(), null));

// The File menu closes once one of its buttons is used, and on a click
// anywhere else.
const fileMenu = $<HTMLDetailsElement>("fileMenu");
fileMenu.addEventListener("click", (e) => {
  if ((e.target as HTMLElement).closest(".menu-items button")) fileMenu.open = false;
});
document.addEventListener("pointerdown", (e) => {
  if (fileMenu.open && !fileMenu.contains(e.target as Node)) fileMenu.open = false;
});

// Paul, 2026-11-28: back to the opening view, behind the player start, from
// wherever the camera has flown to. Home does the same.
function resetCamera() {
  view.openOn(doc.level.playerStart);
  status.textContent = "Camera reset to the opening view.";
}
$("resetCameraBtn").addEventListener("click", resetCamera);

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
  const waves: ArenaWaveSpec[] = [{ foamer: RIGS[0]?.id ?? "F01", count: EDITOR.arena.defaultCount }];
  let lockDoors = false;
  let unlockOnClear = true;

  const spec = (): ArenaSpec => ({
    zone, blockers: [...blockers], spawnPoints: [...points],
    waves: waves.map((w) => ({ ...w })), doors: [...doors], lockDoors, unlockOnClear,
  });

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
        const promote = document.createElement("label");
        const promoteInput = document.createElement("input");
        promoteInput.type = "checkbox";
        promoteInput.checked = wave.promoted === true;
        promoteInput.addEventListener("change", () => { wave.promoted = promoteInput.checked || undefined; say(); });
        promote.append(promoteInput, document.createTextNode("promoted"));
        const hold = numberInput(wave.holdSeconds ?? EDITOR.arena.holdSeconds, 0.25, (n) => { wave.holdSeconds = Math.max(0, n); say(); });
        hold.title = "seconds between arrivals";
        const delay = numberInput(wave.delaySeconds ?? 0, 0.5, (n) => { wave.delaySeconds = Math.max(0, n); say(); });
        delay.title = "seconds after the previous wave";
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
        row.append(type, count, promote, hold, delay, up, cut);
        waveBox.append(row);
      });
      const add = document.createElement("button");
      add.type = "button";
      add.textContent = "Add a wave";
      add.addEventListener("click", () => {
        waves.push({ ...waves[waves.length - 1]!, count: EDITOR.arena.defaultCount });
        waves_();
      });
      waveBox.append(add);
    };
    waves_();

    // Doors open when the fight is won; doors can also be shut when it
    // starts, the two halves of an arena lock.
    const doorTicks = ticksSection("doors to open when the fight is won", (level.doors ?? []).map((d) => ({ id: d.id, label: d.id })), doors);
    const lockBox = document.createElement("label");
    const lockInput = document.createElement("input");
    lockInput.type = "checkbox";
    lockInput.checked = lockDoors;
    lockInput.addEventListener("change", () => { lockDoors = lockInput.checked; say(); });
    lockBox.append(lockInput, document.createTextNode("Lock the doors when the fight starts"));
    const unlockBox = document.createElement("label");
    const unlockInput = document.createElement("input");
    unlockInput.type = "checkbox";
    unlockInput.checked = unlockOnClear;
    unlockInput.addEventListener("change", () => { unlockOnClear = unlockInput.checked; say(); });
    unlockBox.append(unlockInput, document.createTextNode("Open the doors when the fight is won"));
    lockBox.className = "formula-toggle";
    unlockBox.className = "formula-toggle";
    body.append(lockBox, unlockBox, doorTicks);

    function ticksSection(title: string, options: { id: string; label: string }[], on: Set<string>) {
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
      return box;
    }

    // Formula row: pick a saved formula (it fills the dialog), save the
    // current dialog as one, delete one, export and import a file.
    const formulaBox = document.createElement("div");
    formulaBox.className = "formula-row";
    const formulaHeading = document.createElement("h3");
    formulaHeading.textContent = "formula";
    const formulaSelect = document.createElement("select");
    formulaSelect.className = "formula-select";
    const formulaButtons = document.createElement("div");
    formulaButtons.className = "formula-buttons";
    const save = document.createElement("button");
    save.type = "button";
    save.textContent = "Save as formula";
    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.textContent = "Delete";
    const exportBtn = document.createElement("button");
    exportBtn.type = "button";
    exportBtn.textContent = "Export";
    const importBtn = document.createElement("button");
    importBtn.type = "button";
    importBtn.textContent = "Import";
    const importFile = document.createElement("input");
    importFile.type = "file";
    importFile.accept = ".json,application/json";
    importFile.hidden = true;

    const formulaNote = document.createElement("div");
    formulaNote.className = "hint";

    let formulas: ArenaFormula[] = [];

    const refreshFormulas = () => {
      const current = formulaSelect.value;
      formulaSelect.replaceChildren();
      const unsaved = document.createElement("option");
      unsaved.value = "";
      unsaved.textContent = "(unsaved)";
      formulaSelect.append(unsaved);
      for (const f of formulas) {
        const option = document.createElement("option");
        option.value = f.name;
        option.textContent = f.name;
        formulaSelect.append(option);
      }
      formulaSelect.value = formulas.some((f) => f.name === current) ? current : "";
      deleteBtn.disabled = !formulaSelect.value;
    };

    const applyFormula = (f: ArenaFormula) => {
      waves.length = 0;
      for (const w of f.waves) waves.push({ ...w });
      lockDoors = f.lockDoors;
      unlockOnClear = f.unlockOnClear;
      lockInput.checked = lockDoors;
      unlockInput.checked = unlockOnClear;
      waves_();
      say();
    };

    const loadFormulas = async () => {
      formulas = await listFormulas().catch(() => [] as ArenaFormula[]);
      refreshFormulas();
    };

    formulaSelect.addEventListener("change", () => {
      const picked = formulas.find((f) => f.name === formulaSelect.value);
      if (picked) applyFormula(picked);
    });

    save.addEventListener("click", () => {
      const name = tidyFormulaName(window.prompt("Formula name", formulaSelect.value || "gap") ?? "");
      const problem = formulaProblem(name, waves, formulas.length);
      if (problem) { formulaNote.textContent = problem; return; }
      const formula: ArenaFormula = { name, waves: waves.map((w) => ({ ...w })), lockDoors, unlockOnClear };
      void putFormula(formula).then(() => {
        formulas = [...formulas.filter((f) => f.name !== name), formula];
        refreshFormulas();
        formulaSelect.value = name;
        formulaNote.textContent = `Saved "${name}".`;
      }).catch(() => { formulaNote.textContent = "The browser would not store that."; });
    });

    deleteBtn.addEventListener("click", () => {
      const name = formulaSelect.value;
      if (!name) return;
      void deleteFormula(name).then(() => {
        formulas = formulas.filter((f) => f.name !== name);
        refreshFormulas();
        formulaNote.textContent = `Deleted "${name}".`;
      }).catch(() => { formulaNote.textContent = "The browser would not delete that."; });
    });

    exportBtn.addEventListener("click", () => {
      const picked = formulas.find((f) => f.name === formulaSelect.value);
      const chosen = picked ? [picked] : formulas;
      if (!chosen.length) { formulaNote.textContent = "No formulas to export."; return; }
      const url = URL.createObjectURL(new Blob([formulasFileText(chosen)], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = formulasFileName(chosen);
      link.click();
      URL.revokeObjectURL(url);
    });

    importBtn.addEventListener("click", () => importFile.click());
    importFile.addEventListener("change", () => {
      const file = importFile.files?.[0];
      if (!file) return;
      void file.text().then((text) => {
        const { formulas: incoming, error } = readFormulasFile(text);
        if (error) { formulaNote.textContent = error; return; }
        const { formulas: stored, left } = fitImport(incoming, formulas);
        void Promise.all(stored.map((f) => putFormula(f))).then(() => {
          formulas = [...formulas, ...stored];
          refreshFormulas();
          formulaNote.textContent = left
            ? `Imported ${stored.length}; ${left} did not fit the store.`
            : `Imported ${stored.length} formula${stored.length === 1 ? "" : "s"}.`;
        }).catch(() => { formulaNote.textContent = "The browser would not store the import."; });
      });
      importFile.value = "";
    });

    formulaButtons.append(save, deleteBtn, exportBtn, importBtn);
    formulaBox.append(formulaHeading, formulaSelect, formulaButtons, formulaNote, importFile);
    body.append(formulaBox);
    void loadFormulas();

    const build = document.createElement("button");
    build.type = "button";
    build.className = "name";
    build.textContent = "Build the triggers";
    build.addEventListener("click", () => {
      const problem = arenaProblem(spec());
      if (problem) return;
      const made = buildArena(spec(), (prefix) => doc.nextId(prefix));
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
      state.textContent = arenaProblem(spec()) ?? `Lock, ${waves.length} wave${waves.length === 1 ? "" : "s"}, clear. Nothing is written to the level until Build.`;
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
  openMapsScreen();
});

function openMapsScreen() {
  void dialog("Maps", (body) => {
    buildMapsScreen(body, {
      currentKey: () => savedKey,
      currentState: () => status.textContent ?? "",
      stored: listLevels,
      builtIns: () => Object.keys(BUILT_IN).map((path) => ({ path })),
      openStored: (key) => {
        void listLevels().then((stored) => {
          const found = stored.find((s) => s.key === key);
          if (!found) return;
          load(structuredClone(found.level), key);
          $("dialogs").hidden = true;
        });
      },
      duplicateStored: (key) => {
        void listLevels().then((stored) => {
          const found = stored.find((s) => s.key === key);
          if (!found) return;
          void putLevel(structuredClone(found.level), undefined).then((newKey) => {
            load(structuredClone(found.level), newKey);
            $("dialogs").hidden = true;
            status.textContent = `Duplicated ${found.level.meta.name || "[Paul]"}.`;
          });
        });
      },
      exportStored: (level) => {
        const text = JSON.stringify(level, null, 2);
        const blob = new Blob([text], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = exportFileName(level);
        link.click();
        URL.revokeObjectURL(url);
      },
      deleteStored: (key) => {
        void deleteLevel(key).then(() => {
          if (savedKey === key) savedKey = null;
          openMapsScreen();
        });
      },
      openBuiltIn: (path) => {
        // ED-09 stage 3: a built in level opens as a copy with its arenas
        // turned into triggers, so its fights can be edited.
        const module = BUILT_IN[path];
        if (!module) return;
        const copy = builtInCopy(module.default as Level);
        load(copy.level, null);
        extraProblems = copy.warnings.map((text): Problem => ({ text, severity: "warning", id: null }));
        updateTopBar();
        $("dialogs").hidden = true;
        status.textContent = copy.warnings.length
          ? `Opened ${nameOf(path)} as a copy: ${copy.warnings.length} warning${copy.warnings.length === 1 ? "" : "s"} in Problems.`
          : `Opened ${nameOf(path)} as a copy.`;
      },
      newMap: () => {
        load(newLevel(), null);
        extraProblems = [];
        updateTopBar();
        $("dialogs").hidden = true;
        status.textContent = "New map.";
      },
    });
  });
}

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

// ED-35: a GLB becomes a model asset in the level file. It is checked by
// size and by loading it once, so a file the loader cannot read (Draco,
// say) is refused with the loader's own plain words rather than saved.
$("importModelBtn").addEventListener("click", () => $<HTMLInputElement>("importModelFile").click());
$<HTMLInputElement>("importModelFile").addEventListener("change", () => {
  const input = $<HTMLInputElement>("importModelFile");
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;
  void file.arrayBuffer().then((buffer) => {
    const problem = modelFileProblem(file.name, buffer.byteLength);
    if (problem) {
      void dialog("That model will not load", (body) => {
        const line = document.createElement("p");
        line.textContent = problem;
        body.append(line);
      });
      return;
    }
    const taken = (doc.level.modelAssets ?? []).map((a) => a.id);
    const asset = modelAssetOf(file.name, new Uint8Array(buffer), taken);
    void importAsset(asset);
  });
});

/** Adds an imported asset to the level once the loader has taken it, arms
 *  it, and says so. A failed load removes nothing, since nothing was added. */
async function importAsset(asset: { id: string; name: string; data: string }) {
  try {
    await loadModelAsset(asset);
  } catch (e) {
    void dialog("That model will not load", (body) => {
      const line = document.createElement("p");
      line.textContent = (e as Error).message;
      body.append(line);
    });
    return;
  }
  if (doc.level.modelAssets?.some((a) => a.id === asset.id)) return;
  doc.setFields({
    modelAssets: [...(doc.level.modelAssets ?? []), asset],
  }, `import ${asset.name}`);
  armModel(asset.id);
  status.textContent = `Imported ${asset.name}. Click in the view to place it.`;
}

$("playBtn").addEventListener("click", () => playFrom(null));

/** ED-11: the frame a playtest runs in, or null when none is up. */
let playFrame: HTMLIFrameElement | null = null;

/** ED-09 stage 1, ED-11: saves, then plays this level in a frame over the
 *  editor, so the editor never unloads and the undo list, the camera and the
 *  selection are as they were when the frame closes. `start` is the camera's
 *  spot for Shift+Tab, or null to begin at the level's player start. A save
 *  that fails says why and plays nothing. */
function playFrom(start: { pos: Vec3; yaw: number } | null) {
  if (playFrame) return;
  void saveNow().then((key) => {
    if (!key || playFrame) return;
    const frame = document.createElement("iframe");
    frame.id = "playFrame";
    frame.title = "Playtest";
    frame.src = playUrl(key, start, true);
    frame.addEventListener("load", () => frame.contentWindow?.focus());
    document.body.append(frame);
    playFrame = frame;
    view.running = false;
  });
}

/** ED-11: ends the playtest. The frame is removed, not hidden, so the game's
 *  physics world, GPU memory and listeners all go with it. */
function closePlay() {
  if (!playFrame) return;
  playFrame.remove();
  playFrame = null;
  view.running = true;
  window.focus();
}

window.addEventListener("message", (e) => {
  if (acceptClose(e, location.origin, playFrame?.contentWindow ?? null)) closePlay();
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
    // The terrain is not an entry: it stays selected while there is one,
    // so its fields can be changed one after another.
    if (id === TERRAIN_ID && doc.level.terrain) continue;
    if (!doc.kindOf(id)) selected.delete(id);
  }
  redraw();
  if (!opening) scheduleSave();
});

// The level the page opens with: `?open=<key>` when it names a stored level,
// else the newest one saved in this browser, else a new one. "Ready" waits
// for a frame, so the smoke check (which waits for the word) has a picture
// before it reads it.
void listLevels()
  .then((stored) => {
    const choice = openChoice(location.search, stored);
    const found = choice.key ? stored.find((s) => s.key === choice.key) : undefined;
    if (found) load(structuredClone(found.level), found.key);
    else load(newLevel(), null);
    // A key the store does not hold is said in the Problems list, so the
    // status line still ends on "Ready" for the smoke check.
    if (choice.missing) {
      extraProblems = [{
        text: `no stored level called ${choice.missing}: opened the latest instead`,
        severity: "warning",
        id: null,
      }];
    }
  })
  .catch(() => load(newLevel(), null))
  .finally(() => {
    syncNameField();
    redraw();
    requestAnimationFrame(() => {
      status.textContent = "Ready";
    });
  });
