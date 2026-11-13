import type { Level, Trigger, TriggerDo, TriggerWhen } from "../level/format";

// ED-08 stage 2: the pieces a trigger is made of, as lists the inspector and
// the palette both read. Pure data and small functions, so a test can check
// what a new trigger starts as and what the id lists a field may offer.

/** The when kinds in the order the inspector offers them (design/EDITOR.md
 *  section 3), with the words the kind list shows. */
export const WHEN_KINDS: { kind: TriggerWhen["kind"]; label: string }[] = [
  { kind: "start", label: "the level starts" },
  { kind: "enter", label: "the player enters a zone" },
  { kind: "killed", label: "Foamers are killed" },
  { kind: "pressed", label: "a button is pressed" },
  { kind: "taken", label: "a pickup is taken" },
  { kind: "after", label: "another trigger fired" },
];

/** The do kinds, in the order the inspector offers them. */
export const DO_KINDS: { kind: TriggerDo["kind"]; label: string }[] = [
  { kind: "spawn", label: "spawn Foamers" },
  { kind: "wake", label: "wake Foamers" },
  { kind: "show", label: "show" },
  { kind: "hide", label: "hide" },
  { kind: "open", label: "open a door" },
  { kind: "close", label: "close a door" },
  { kind: "message", label: "show a message" },
  { kind: "checkpoint", label: "set the checkpoint" },
];

/** A when of a kind, with the fields the validator needs to accept it as
 *  far as the editor knows. A kind with an id field starts empty and is
 *  filled by the picker or by Link (ED-08 stage 3). */
export function emptyWhen(kind: TriggerWhen["kind"]): TriggerWhen {
  switch (kind) {
    case "start": return { kind: "start" };
    case "enter": return { kind: "enter", zone: "" };
    case "killed": return { kind: "killed", ids: [] };
    case "pressed": return { kind: "pressed", button: "" };
    case "taken": return { kind: "taken", pickup: "" };
    case "after": return { kind: "after", trigger: "", seconds: 1 };
  }
}

/** A do row of a kind, empty but for what a row cannot be without: a count
 *  of 1 and one second, both inside the validator's rules. */
export function emptyDo(kind: TriggerDo["kind"]): TriggerDo {
  switch (kind) {
    case "spawn": return { kind: "spawn", id: "", foamer: "F01", count: 1, at: [] };
    case "wake": return { kind: "wake", ids: [] };
    case "show": return { kind: "show", ids: [] };
    case "hide": return { kind: "hide", ids: [] };
    case "open": return { kind: "open", door: "" };
    case "close": return { kind: "close", door: "" };
    case "message": return { kind: "message", text: "", seconds: 2 };
    case "checkpoint": return { kind: "checkpoint", pos: [0, 0, 0], yaw: 0 };
  }
}

/** A fresh trigger: the level starts, and it shows nothing yet. Nothing is
 *  invented for Paul: no message text, no name. */
export function newTrigger(id: string): Trigger {
  return { id, when: { kind: "start" }, do: [{ kind: "show", ids: [] }] };
}

/** Every spawn action id any trigger's do list gives a `spawn`. These are
 *  the tags a `killed` when may count as well as a placed Foamer. */
export function spawnActionIds(level: Level): string[] {
  const ids: string[] = [];
  for (const t of level.triggers ?? []) {
    for (const d of t.do ?? []) if (d.kind === "spawn" && d.id) ids.push(d.id);
  }
  return ids;
}

/** What a `killed` when may name: placed Foamers and spawn actions. */
export function killedIds(level: Level): string[] {
  return [...(level.foamers ?? []).map((f) => f.id), ...spawnActionIds(level)];
}

/** What a show or a hide may name: prims and Foamers (the validator's
 *  `showable`). */
export function showableIds(level: Level): string[] {
  return [...(level.prims ?? []).map((p) => p.id), ...(level.foamers ?? []).map((f) => f.id)];
}

/** What a wake may name: placed Foamers. */
export function wakeableIds(level: Level): string[] {
  return (level.foamers ?? []).map((f) => f.id);
}

/** The ids a field of a trigger takes, for the field's list and for Link:
 *  the kind of thing it names. Null when the field takes no level id (a
 *  message, a checkpoint). */
export function fieldIds(level: Level, field: { kind: string }): string[] | null {
  switch (field.kind) {
    case "enter": return (level.zones ?? []).map((z) => z.id);
    case "killed": return killedIds(level);
    case "pressed": return (level.buttons ?? []).map((b) => b.id);
    case "taken": return (level.pickups ?? []).map((p) => p.id);
    case "after": return (level.triggers ?? []).map((t) => t.id);
    case "wake": return wakeableIds(level);
    case "show":
    case "hide": return showableIds(level);
    case "open":
    case "close": return (level.doors ?? []).map((d) => d.id);
    default: return null;
  }
}
