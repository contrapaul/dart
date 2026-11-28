import type { Level, Trigger } from "../level/format";

// R3-09: a rename rewrites the entry and every reference to it, in one
// step. Every field that can name another thing lives in the trigger
// clauses, the button's `on` and `action.open`, and an arena's
// unlockOnClear and escape.sealDoors. Pure: takes a level, returns a new
// one, never touches the old.

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

function idsUsed(level: Level): Set<string> {
  const used = new Set<string>();
  const add = (id: unknown) => {
    if (typeof id === "string" && id) used.add(id);
  };
  const lists: { id?: unknown }[][] = [
    level.prims ?? [],
    level.foamers ?? [],
    level.pickups ?? [],
    level.doors ?? [],
    level.spawnPoints ?? [],
    level.zones ?? [],
    level.triggers ?? [],
    level.props ?? [],
    level.buttons ?? [],
    level.lights ?? [],
    level.physics ?? [],
    level.models ?? [],
    level.modelAssets ?? [],
  ];
  for (const list of lists) for (const e of list) add(e.id);
  for (const t of level.triggers ?? []) {
    for (const d of t.do ?? []) {
      if (d.kind === "spawn") add(d.id);
    }
  }
  for (const a of level.arenas ?? []) {
    add(a.id);
    for (const w of a.waves ?? []) add(w.id);
  }
  return used;
}

/** Why the new id cannot be used, in words; null when it can. `oldId` is
 *  the id being replaced, so the target id itself is not a conflict. */
export function renameProblem(level: Level, oldId: string, newId: string): string | null {
  const trimmed = (newId ?? "").trim();
  if (!trimmed) return "An id cannot be empty.";
  if (!ID_PATTERN.test(trimmed)) {
    return "An id takes letters, numbers, dashes and underscores, starting with a letter or a number.";
  }
  if (trimmed === oldId) return "That is already the id.";
  if (idsUsed(level).has(trimmed)) return `${trimmed} is already used by something in the level.`;
  return null;
}

/** Every id field of a trigger that names another thing, rewritten. Spawn
 *  rows: the row's own tag and the spawn points it spawns at. */
function rewriteTrigger(t: Trigger, oldId: string, newId: string): Trigger {
  const w = t.when;
  let when = w;
  if (w?.kind === "enter" && w.zone === oldId) when = { kind: "enter", zone: newId };
  else if (w?.kind === "killed") {
    const ids = (w.ids ?? []).map((id) => (id === oldId ? newId : id));
    if (ids.length !== (w.ids ?? []).length || ids.some((id, i) => id !== w.ids![i])) when = { ...w, ids };
  } else if (w?.kind === "pressed" && w.button === oldId) when = { kind: "pressed", button: newId };
  else if (w?.kind === "taken" && w.pickup === oldId) when = { kind: "taken", pickup: newId };
  else if (w?.kind === "after" && w.trigger === oldId) when = { ...w, trigger: newId };
  const doRows = (t.do ?? []).map((d) => {
    switch (d.kind) {
      case "spawn": {
        // The spawn row's own tag is the row's name, not a reference to
        // another thing: it is left as is. Only the spawn points it names.
        const at = d.at.map((id) => (id === oldId ? newId : id));
        return { ...d, at };
      }
      case "wake":
      case "show":
      case "hide":
      case "move":
        return { ...d, ids: (d.ids ?? []).map((id) => (id === oldId ? newId : id)) };
      case "open":
      case "close":
        return { ...d, door: d.door === oldId ? newId : d.door };
      default:
        return d;
    }
  });
  return {
    ...t,
    id: t.id === oldId ? newId : t.id,
    when,
    do: doRows,
  };
}

/** The level with the renamed entry and every reference to it rewritten.
 *  Returns a new level; the input is left alone. */
export function applyRename(level: Level, oldId: string, newId: string): Level {
  const next = structuredClone(level);
  const kindLists: [string, { id: string }[] | undefined][] = [
    ["prims", next.prims],
    ["foamers", next.foamers],
    ["pickups", next.pickups],
    ["doors", next.doors],
    ["spawnPoints", next.spawnPoints],
    ["zones", next.zones],
    ["triggers", next.triggers],
    ["props", next.props],
    ["buttons", next.buttons],
    ["lights", next.lights],
    ["physics", next.physics],
    ["models", next.models],
    ["modelAssets", next.modelAssets],
  ];
  for (const [, list] of kindLists) {
    for (const e of list ?? []) {
      if (e.id === oldId) e.id = newId;
    }
  }
  if (next.triggers) {
    next.triggers = next.triggers.map((t) => rewriteTrigger(t, oldId, newId));
  }
  if (next.models) {
    next.models = next.models.map((m) => (m.asset === oldId ? { ...m, asset: newId } : m));
  }
  if (next.buttons) {
    next.buttons = next.buttons.map((b) => {
      let next_b = b;
      if (b.on === oldId) next_b = { ...next_b, on: newId };
      if (b.action?.open === oldId) next_b = { ...next_b, action: { ...b.action!, open: newId } };
      return next_b;
    });
  }
  if (next.arenas) {
    next.arenas = next.arenas.map((a) => {
      let next_a = a;
      if ((a.unlockOnClear ?? []).some((id) => id === oldId)) {
        next_a = { ...next_a, unlockOnClear: a.unlockOnClear.map((id) => (id === oldId ? newId : id)) };
      }
      if (a.escape?.sealDoors?.some((id) => id === oldId)) {
        next_a = {
          ...next_a,
          escape: { ...a.escape!, sealDoors: a.escape!.sealDoors.map((id) => (id === oldId ? newId : id)) },
        };
      }
      return next_a;
    });
  }
  return next;
}
