import type { Level, Trigger, TriggerDo, TriggerWhen, Vec3 } from "../level/format";
import { GRID, ROTATE_STEP } from "./doc";
import {
  checkField, label, numberInput, selectField, textField, vecField,
} from "./inspector-parts";
import { RIGS } from "./parts";
import { DO_KINDS, WHEN_KINDS, emptyDo, emptyWhen, fieldIds } from "./trigger-parts";

// ED-08 stage 2: the inspector's block for one trigger. The when is one kind
// plus its fields; the do list is rows that can be added, removed and moved.
// Nothing is invented for Paul: a message's text starts empty and is his to
// write. Every edit is one undo step through the page's `change`.

export interface TriggerHandlers {
  level: Level;
  /** One undo step changing this trigger's fields. */
  change(patch: Partial<Trigger>, text: string): void;
  /** Rebuilds the panel: a kind change brings its own fields. */
  redraw(): void;
  /** The do row the Link button fills, or null when nothing is linking.
   *  Without `setLink` there is no Link button (ED-08 stage 3 adds it). */
  linkRow: number | null;
  setLink?(row: number | null): void;
  /** Where the editor's camera is, for a checkpoint. */
  cameraSpot(): { pos: Vec3; yaw: number };
}

function hint(text: string): HTMLElement {
  const el = document.createElement("span");
  el.className = "hint";
  el.textContent = text;
  return el;
}

/** The id list a field offers, as select options; the current value is kept
 *  even when the level no longer has it, so a broken name shows as itself. */
function idOptions(level: Level, field: { kind: string }, current: string): { value: string; label: string }[] {
  const ids = fieldIds(level, field) ?? [];
  const options = ids.map((id) => ({ value: id, label: id }));
  if (current && !ids.includes(current)) options.unshift({ value: current, label: `${current} (not in the level)` });
  else if (!current) options.unshift({ value: "", label: "none yet" });
  return options;
}

/** One id field: a list of the ids of the right kind, and a Link button that
 *  takes the next click in the view (ED-08 stage 3). `row` names the do row
 *  the field belongs to, so Link knows where to put the click. */
function idField(
  ctx: TriggerHandlers, field: { kind: string }, current: string,
  commit: (id: string) => void, row: number | null = null,
): HTMLElement {
  const host = document.createElement("div");
  host.className = "ticks";
  host.append(selectField(idOptions(ctx.level, field, current), current, commit));
  if (!ctx.setLink) return host;
  const link = document.createElement("button");
  link.type = "button";
  const on = row !== null && ctx.linkRow === row;
  link.className = on ? "on" : "";
  link.textContent = on ? "Linking: click in the view" : "Link";
  link.addEventListener("click", () => ctx.setLink!(on ? null : row));
  host.append(link);
  return host;
}

/** A name a field already holds, with a tick that takes it out. */
function nameRow(id: string, drop: () => void): HTMLElement {
  return checkField(id, true, (on) => {
    if (!on) drop();
  });
}

/** The when's own fields for its kind. */
function whenFields(host: HTMLElement, ctx: TriggerHandlers, w: TriggerWhen, set: (when: TriggerWhen, text: string) => void) {
  switch (w.kind) {
    case "start":
      break;
    case "enter":
      host.append(label("zone", idField(ctx, w, w.zone, (id) => set({ kind: "enter", zone: id }, `enter ${id}`))));
      break;
    case "killed": {
      for (const id of w.ids ?? []) {
        host.append(label("", nameRow(id, () => {
          set({ kind: "killed", ids: (w.ids ?? []).filter((x) => x !== id), count: w.count }, `killed ${id}`);
          ctx.redraw();
        })));
      }
      const add = document.createElement("button");
      add.type = "button";
      add.textContent = "Add a Foamer or a wave";
      add.addEventListener("click", () => {
        const next = (fieldIds(ctx.level, w) ?? []).find((id) => !(w.ids ?? []).includes(id));
        if (!next) return;
        set({ kind: "killed", ids: [...(w.ids ?? []), next], count: w.count }, `killed ${next}`);
        ctx.redraw();
      });
      host.append(label("add", add));
      host.append(label("count", numberInput(w.count ?? 0, 1, (n) => {
        set({ kind: "killed", ids: w.ids ?? [], count: n >= 1 ? Math.round(n) : undefined }, "killed count");
      })));
      host.append(label("", hint("0 means all of them")));
      break;
    }
    case "pressed":
      host.append(label("button", idField(ctx, w, w.button, (id) => set({ kind: "pressed", button: id }, `pressed ${id}`))));
      break;
    case "taken":
      host.append(label("pickup", idField(ctx, w, w.pickup, (id) => set({ kind: "taken", pickup: id }, `taken ${id}`))));
      break;
    case "after":
      host.append(label("trigger", idField(ctx, w, w.trigger, (id) => set({ kind: "after", trigger: id, seconds: w.seconds }, `after ${id}`))));
      host.append(label("seconds", numberInput(w.seconds, 0.5, (n) => set({ kind: "after", trigger: w.trigger, seconds: Math.max(0, n) }, "after seconds"))));
      break;
  }
}

/** The spawn row's spawn points: one tick each, so a wave can come in at
 *  more than one rift. */
function spawnPoints(
  ctx: TriggerHandlers, d: Extract<TriggerDo, { kind: "spawn" }>, set: (row: TriggerDo, text: string) => void,
): HTMLElement {
  const host = document.createElement("div");
  host.className = "ticks";
  const points = ctx.level.spawnPoints ?? [];
  if (!points.length) host.append(hint("no spawn points in the level yet"));
  for (const point of points) {
    host.append(checkField(point.id, d.at.includes(point.id), (on) => {
      const at = on ? [...d.at.filter((id) => id !== point.id), point.id] : d.at.filter((id) => id !== point.id);
      set({ ...d, at }, `spawn at ${point.id}`);
    }));
  }
  return host;
}

/** One do row: its kind, the four buttons that move or remove it, and the
 *  fields its kind takes. */
function doRow(
  ctx: TriggerHandlers, trigger: Trigger, d: TriggerDo, row: number,
): HTMLElement {
  const rows = trigger.do ?? [];
  const host = document.createElement("div");
  host.className = "do-row";
  const setRows = (next: TriggerDo[], text: string) => ctx.change({ do: next }, text);
  const setRow = (next: TriggerDo, text: string) => setRows(rows.map((r, i) => (i === row ? next : r)), text);
  const head = document.createElement("div");
  head.className = "ticks";
  head.append(selectField(
    DO_KINDS.map((k) => ({ value: k.kind, label: k.label })),
    d.kind,
    (v) => {
      setRow(emptyDo(v as TriggerDo["kind"]), `do ${v}`);
      ctx.redraw();
    },
  ));
  const move = (by: -1 | 1) => {
    const next = [...rows];
    const [taken] = next.splice(row, 1);
    next.splice(row + by, 0, taken!);
    setRows(next, by < 0 ? "move a step up" : "move a step down");
    ctx.redraw();
  };
  const actions: [string, boolean, () => void][] = [
    ["Up", row > 0, () => move(-1)],
    ["Down", row < rows.length - 1, () => move(1)],
    ["Out", true, () => {
      setRows(rows.filter((_, i) => i !== row), "remove a step");
      ctx.redraw();
    }],
  ];
  for (const [text, enabled, run] of actions) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = text;
    button.disabled = !enabled;
    button.addEventListener("click", run);
    head.append(button);
  }
  host.append(head);

  switch (d.kind) {
    case "spawn":
      host.append(label("id", textField(d.id, (v) => setRow({ ...d, id: v }, `spawn id ${v}`))));
      host.append(label("type", selectField(
        RIGS.map((r) => ({ value: r.id, label: `${r.id} ${r.label}` })),
        d.foamer,
        (v) => setRow({ ...d, foamer: v }, `spawn type ${v}`),
      )));
      host.append(label("count", numberInput(d.count, 1, (n) => setRow({ ...d, count: Math.max(1, Math.round(n)) }, "spawn count"))));
      host.append(label("at", spawnPoints(ctx, d, setRow)));
      host.append(checkField("promoted", d.promoted === true, (on) => setRow({ ...d, promoted: on || undefined }, on ? "promote" : "demote")));
      host.append(label("hold", numberInput(d.holdSeconds ?? 0, 0.5, (n) => setRow({ ...d, holdSeconds: n > 0 ? n : undefined }, "spawn hold"))));
      host.append(label("", hint("seconds between them")));
      break;
    case "wake":
      host.append(label("wake", idField(ctx, d, "", (id) => {
        if (!id || d.ids.includes(id)) return;
        setRow({ ...d, ids: [...d.ids, id] }, `wake ${id}`);
        ctx.redraw();
      }, row)));
      for (const id of d.ids) {
        host.append(label("", nameRow(id, () => {
          setRow({ ...d, ids: d.ids.filter((x) => x !== id) }, `wake ${id}`);
          ctx.redraw();
        })));
      }
      break;
    case "show":
    case "hide":
      host.append(label(d.kind, idField(ctx, d, "", (id) => {
        if (!id || d.ids.includes(id)) return;
        setRow({ ...d, ids: [...d.ids, id] }, `${d.kind} ${id}`);
        ctx.redraw();
      }, row)));
      for (const id of d.ids) {
        host.append(label("", nameRow(id, () => {
          setRow({ ...d, ids: d.ids.filter((x) => x !== id) }, `${d.kind} ${id}`);
          ctx.redraw();
        })));
      }
      break;
    case "open":
    case "close":
      host.append(label("door", idField(ctx, d, d.door, (id) => {
        setRow({ ...d, door: id }, `${d.kind} ${id}`);
        ctx.redraw();
      }, row)));
      break;
    case "message":
      host.append(label("text", textField(d.text, (v) => setRow({ ...d, text: v }, "message text"))));
      host.append(label("seconds", numberInput(d.seconds ?? 2, 0.5, (n) => setRow({ ...d, seconds: Math.max(0, n) }, "message seconds"))));
      break;
    case "checkpoint": {
      host.append(label("position", vecField(d.pos, GRID, GRID, (v) => setRow({ ...d, pos: v }, "checkpoint"))));
      host.append(label("yaw", numberInput(d.yaw, ROTATE_STEP, (n) => setRow({ ...d, yaw: n }, "checkpoint yaw"))));
      const use = document.createElement("button");
      use.type = "button";
      use.textContent = "Use the camera's spot";
      use.addEventListener("click", () => {
        const spot = ctx.cameraSpot();
        setRow({ kind: "checkpoint", pos: spot.pos, yaw: spot.yaw }, "checkpoint at the camera");
        ctx.redraw();
      });
      host.append(label("", use));
      break;
    }
  }
  return host;
}

export function buildTriggerFields(host: HTMLElement, trigger: Trigger, ctx: TriggerHandlers) {
  host.append(label("id", textField(trigger.id, (v) => ctx.change({ id: v }, `rename to ${v}`))));
  host.append(label("when", selectField(
    WHEN_KINDS.map((k) => ({ value: k.kind, label: k.label })),
    trigger.when?.kind ?? "start",
    (v) => {
      ctx.change({ when: emptyWhen(v as TriggerWhen["kind"]) }, `when ${v}`);
      ctx.redraw();
    },
  )));
  whenFields(host, ctx, trigger.when ?? { kind: "start" }, (when, text) => ctx.change({ when }, text));

  const rows = trigger.do ?? [];
  const heading = document.createElement("h2");
  heading.textContent = "Do";
  host.append(heading);
  rows.forEach((d, i) => host.append(doRow(ctx, trigger, d, i)));
  const add = document.createElement("button");
  add.type = "button";
  add.textContent = "Add a step";
  add.addEventListener("click", () => {
    ctx.change({ do: [...rows, emptyDo("show")] }, "add a step");
    ctx.redraw();
  });
  host.append(label("add", add));
  host.append(label("repeat", checkField("yes", trigger.repeat === true, (on) => ctx.change({ repeat: on || undefined }, on ? "repeat" : "once"))));
  if (ctx.linkRow !== null) host.append(label("", hint("Linking: click the thing in the view, Esc to stop")));
}

/** The kind of thing a do row's id field takes, for Link: a Foamer to wake,
 *  a prim to show or hide, a door to open or close. Null when the row takes
 *  no click from the view. */
export function rowTakes(d: TriggerDo | undefined): "wake" | "show" | "hide" | "open" | "close" | null {
  if (!d) return null;
  switch (d.kind) {
    case "wake": return "wake";
    case "show": return "show";
    case "hide": return "hide";
    case "open": return "open";
    case "close": return "close";
    default: return null;
  }
}
