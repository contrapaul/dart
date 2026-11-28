import type { Level, LevelDoor, Pickup, PlacedFoamer, Prop, Rift, Vec3, Zone } from "../level/format";
import { LEAKING_BARREL, PROP_KINDS, propSolid } from "../level/props";
import { GRID, snapAxis, type EntryKind } from "./doc";
import { EXIT_ID, START_ID } from "./markers";
import { BLASTERS, MELEE, makePickup } from "./parts";

// ED-05 stage 3: the inspector's block for a placed thing that is not a
// prim. Each kind shows its own fields and calls back with a patch; the page
// turns a patch into one undo step, as it does for a prim.

/** The kind an inspector selection is, from a level id or the two pseudo
 *  ids the view uses for the start and the exit. */
export type SelectKind = EntryKind | "start" | "exit";

export function selectKind(id: string): SelectKind | null {
  if (id === START_ID) return "start";
  if (id === EXIT_ID) return "exit";
  return null;
}

export interface PartContext {
  /** One undo step for a patch to the selected things. */
  change(patch: Record<string, unknown>, text: string): void;
  /** Rebuilds the panel (a kind's fields differ by what is chosen). */
  redraw(): void;
  /** The rotation snap choice: the rotation boxes' step, not their snap. */
  rotateStep: number;
  /** Renames this entry, as one undo step; refuses with a status message. */
  rename(v: string): void;
}

export function label(text: string, input: HTMLElement): HTMLElement {
  const el = document.createElement("label");
  el.textContent = text;
  el.append(input);
  return el;
}

export function numberInput(value: number, step: number, commit: (n: number) => void): HTMLInputElement {
  const input = document.createElement("input");
  input.type = "number";
  input.step = String(step);
  input.value = String(Math.round(value * 1000) / 1000);
  input.addEventListener("change", () => {
    const n = Number(input.value);
    if (Number.isFinite(n)) commit(n);
  });
  return input;
}

export function vecField(current: Vec3, step: number, snap: number, commit: (v: Vec3) => void): HTMLElement {
  const host = document.createElement("div");
  host.className = "vec";
  let value: Vec3 = [...current] as Vec3;
  (["x", "y", "z"] as const).forEach((axis, i) => {
    const input = numberInput(current[i]!, step, (n) => {
      value = snapAxis(value, i as 0 | 1 | 2, n, snap);
      commit(value);
    });
    input.title = axis;
    host.append(input);
  });
  return host;
}

export function selectField(options: { value: string; label: string }[], current: string, commit: (v: string) => void): HTMLSelectElement {
  const select = document.createElement("select");
  for (const option of options) {
    const el = document.createElement("option");
    el.value = option.value;
    el.textContent = option.label;
    select.append(el);
  }
  select.value = current;
  select.addEventListener("change", () => commit(select.value));
  return select;
}

/** ED-30 item 3: the locked checkbox. */
export function lockedCheckbox(checked: boolean, commit: (on: boolean) => void): HTMLElement {
  return checkField("locked", checked, commit);
}

export function checkField(text: string, checked: boolean, commit: (on: boolean) => void): HTMLElement {
  const el = document.createElement("label");
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = checked;
  input.addEventListener("change", () => commit(input.checked));
  el.append(document.createTextNode(text), input);
  return el;
}

export function textField(value: string, commit: (v: string) => void): HTMLInputElement {
  const input = document.createElement("input");
  input.type = "text";
  input.value = value;
  input.addEventListener("change", () => {
    if (input.value.trim()) commit(input.value.trim());
  });
  return input;
}

/** The editable id, at the top of a single-selection panel. Commits on
 *  Enter or leaving the field; the caller refuses with a status message. */
export function renameField(host: HTMLElement, value: string, commit: (v: string) => void) {
  host.append(label("id", textField(value, commit)));
}

// Per-kind field lists, so the page and a test can see what each kind edits.

/** The rig ids and their names (data/foamer-rigs.json), as select options. */
export function buildFoamerFields(host: HTMLElement, f: PlacedFoamer, rigs: { id: string; label: string }[], ctx: PartContext) {
  renameField(host, f.id, (v) => ctx.rename(v));
  host.append(label("type", selectField(
    rigs.map((r) => ({ value: r.id, label: `${r.id} ${r.label}` })),
    f.foamer,
    (v) => ctx.change({ foamer: v }, `type ${v}`),
  )));
  host.append(label("position", vecField(f.pos, GRID, GRID, (v) => ctx.change({ pos: v }, "move"))));
  host.append(label("yaw", numberInput(f.yaw, ctx.rotateStep, (n) => ctx.change({ yaw: n }, "turn"))));
  host.append(checkField("promoted", f.promoted === true, (on) => ctx.change({ promoted: on || undefined }, on ? "promote" : "demote")));
  host.append(label("wake", selectField(
    [{ value: "sight", label: "sight" }, { value: "trigger", label: "trigger" }],
    f.wake ?? "sight",
    (v) => ctx.change({ wake: v as PlacedFoamer["wake"] }, `wake ${v}`),
  )));
  host.append(checkField("starts hidden", f.hidden === true, (on) => ctx.change({ hidden: on || undefined }, on ? "hide" : "show")));
}

export function buildPickupFields(host: HTMLElement, p: Pickup, ctx: PartContext) {
  renameField(host, p.id, (v) => ctx.rename(v));
  // The type list is grouped by what the pickup gives, since the fields
  // below change with it.
  const types: { value: string; label: string }[] = [
    { value: "darts-standard", label: "Darts (standard)" },
    { value: "darts-precision", label: "Darts (precision)" },
    { value: "shells-b03", label: "Shells" },
    { value: "mega", label: "Mega darts" },
    { value: "foam-balls", label: "Foam balls" },
    { value: "health", label: "Health" },
    { value: "blaster", label: "Blaster" },
    { value: "melee", label: "Hand weapon" },
    { value: "key", label: "Key" },
    { value: "armor", label: "Armour" },
    { value: "token", label: "Token" },
    { value: "toy", label: "Toy" },
  ];
  if (!types.some((t) => t.value === p.type)) types.push({ value: p.type, label: p.type });
  host.append(label("type", selectField(types, p.type, (v) => {
    // A type change carries the fields it needs, so the pickup stays valid.
    const made = makePickup(p.id, v as Pickup["type"], p.pos);
    const patch: Record<string, unknown> = { type: made.type, count: made.count, amount: made.amount, blaster: made.blaster, melee: made.melee, key: made.key };
    ctx.change(patch, `type ${v}`);
    ctx.redraw();
  })));
  host.append(label("position", vecField(p.pos, GRID, GRID, (v) => ctx.change({ pos: v }, "move"))));
  if (p.type.startsWith("darts-") || p.type === "shells-b03" || p.type === "mega" || p.type === "foam-balls") {
    host.append(label("count", numberInput(p.count ?? 0, 1, (n) => ctx.change({ count: Math.max(1, Math.round(n)) }, "count"))));
  }
  if (p.type === "health") {
    host.append(label("amount", numberInput(p.amount ?? 25, 5, (n) => ctx.change({ amount: Math.max(1, Math.round(n)) }, "amount"))));
  }
  if (p.type === "blaster") {
    host.append(label("blaster", selectField(
      BLASTERS.map((b) => ({ value: b.id, label: `${b.id} ${b.name}` })),
      p.blaster ?? BLASTERS[0]?.id ?? "",
      (v) => ctx.change({ blaster: v }, `blaster ${v}`),
    )));
  }
  if (p.type === "melee") {
    host.append(label("hand weapon", selectField(
      MELEE.map((m) => ({ value: m.id, label: `${m.id} ${m.name}` })),
      p.melee ?? MELEE[0]?.id ?? "",
      (v) => ctx.change({ melee: v }, `hand weapon ${v}`),
    )));
  }
  if (p.type === "key") {
    host.append(label("colour", selectField(
      [{ value: "red", label: "red" }, { value: "blue", label: "blue" }, { value: "yellow", label: "yellow" }],
      p.key ?? "red",
      (v) => ctx.change({ key: v as Pickup["key"] }, `key ${v}`),
    )));
  }
}

export function buildDoorFields(host: HTMLElement, d: LevelDoor, ctx: PartContext) {
  renameField(host, d.id, (v) => ctx.rename(v));
  host.append(label("lock", selectField([
    { value: "none", label: "none" },
    { value: "trigger", label: "trigger" },
    { value: "red", label: "red key" },
    { value: "blue", label: "blue key" },
    { value: "yellow", label: "yellow key" },
  ], d.lock, (v) => ctx.change({ lock: v as LevelDoor["lock"] }, `lock ${v}`))));
  host.append(label("position", vecField(d.pos, GRID, GRID, (v) => ctx.change({ pos: v }, "move"))));
  host.append(label("size", vecField(d.size, GRID, GRID, (v) => ctx.change({ size: v.map((n) => Math.max(GRID, n)) as Vec3 }, "size"))));
  host.append(label("rotation", numberInput(d.rotY ?? 0, ctx.rotateStep, (n) => ctx.change({ rotY: n }, "turn"))));
  const colour = document.createElement("input");
  colour.type = "color";
  colour.value = d.colour ?? "#c89a5b";
  colour.addEventListener("input", () => ctx.change({ colour: colour.value }, "colour"));
  host.append(label("colour", colour));
}

/** A prop: what it is, where, its turn, and whether it blocks. The leaking
 *  barrel always blocks, so its box is shown ticked and cannot be changed. */
export function buildPropFields(host: HTMLElement, p: Prop, ctx: PartContext) {
  renameField(host, p.id, (v) => ctx.rename(v));
  host.append(label("prop", selectField(
    Object.entries(PROP_KINDS).map(([value, k]) => ({ value, label: k.label })),
    p.kind, (v) => ctx.change({ kind: v, solid: undefined }, `make it a ${PROP_KINDS[v]?.label ?? v}`),
  )));
  host.append(label("position", vecField(p.pos, GRID, GRID, (v) => ctx.change({ pos: v }, "move"))));
  host.append(label("rotation", numberInput(p.rotY ?? 0, ctx.rotateStep, (n) => ctx.change({ rotY: n }, "turn"))));
  host.append(lockedCheckbox(p.locked === true, (on) => ctx.change({ locked: on || undefined }, on ? "lock" : "unlock")));
  const solid = checkField("solid", propSolid(p), (on) => ctx.change({ solid: on }, on ? "make solid" : "make walk-through"));
  if (p.kind === LEAKING_BARREL) solid.querySelector("input")!.disabled = true;
  host.append(solid);
  const hint = document.createElement("p");
  hint.className = "hint";
  hint.textContent = p.kind === LEAKING_BARREL
    ? "Darts puncture it and it sprays foam, then blows. A blast sets off barrels nearby."
    : "Solid blocks the player, Foamers and darts. Off, it is scenery you walk through.";
  host.append(hint);
}

export function buildSpawnFields(host: HTMLElement, r: Rift, ctx: PartContext) {
  renameField(host, r.id, (v) => ctx.rename(v));
  host.append(label("position", vecField(r.pos, GRID, GRID, (v) => ctx.change({ pos: v }, "move"))));
}

export function buildZoneFields(host: HTMLElement, z: Zone, ctx: PartContext) {
  renameField(host, z.id, (v) => ctx.rename(v));
  host.append(label("position", vecField(z.pos, GRID, GRID, (v) => ctx.change({ pos: v }, "move"))));
  host.append(label("size", vecField(z.size, GRID, GRID, (v) => ctx.change({ size: v.map((n) => Math.max(GRID, n)) as Vec3 }, "size"))));
}

/** The player start: its foot position and the way the level begins facing. */
export function buildStartFields(host: HTMLElement, level: Level, ctx: PartContext) {
  const s = level.playerStart;
  host.append(label("position", vecField(s.pos, GRID, GRID, (v) => ctx.change({ pos: v }, "move the start"))));
  host.append(label("yaw", numberInput(s.yaw, ctx.rotateStep, (n) => ctx.change({ yaw: n }, "turn the start"))));
}

/** The exit pad: where it is and how big. */
export function buildExitFields(host: HTMLElement, level: Level, ctx: PartContext) {
  host.append(label("position", vecField(level.exit.pos, GRID, GRID, (v) => ctx.change({ pos: v }, "move the exit"))));
  host.append(label("size", vecField(level.exit.size, GRID, GRID, (v) => ctx.change({ size: v.map((n) => Math.max(GRID, n)) as Vec3 }, "size"))));
}
