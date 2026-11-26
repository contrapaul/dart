// ED-30 item 3: locking. A locked thing is drawn and listed but not picked,
// not box selected, not moved, not deleted, not turned. The lock lives on
// the thing itself (Prim.locked, Prop.locked, PhysicsObject.locked,
// PlacedModel.locked, Terrain.locked), so an undo step is one change.
// Pure helpers: no DOM, no Three.js, so the document and the outliner can
// share them.

import type { Level } from "../level/format";
import { ICONS } from "./icons";

const LOCK_ICON = ICONS.lock;
const UNLOCK_ICON = ICONS.unlock;

/** The kinds that can be locked, all of them arrays of id'd entries. */
export const LOCKABLE_KINDS = ["prims", "props", "physics", "models"] as const;

/** Every locked id in the level, in one set. Terrain has no id (it is the
 *  level's ground), so it is not covered here; it has no outliner row either. */
export function lockedIds(level: Level): Set<string> {
  const out = new Set<string>();
  const record = level as unknown as Record<string, { id?: string; locked?: boolean }[] | undefined>;
  for (const kind of LOCKABLE_KINDS) {
    for (const entry of record[kind] ?? []) {
      if (entry?.id && entry.locked === true) out.add(entry.id);
    }
  }
  return out;
}

/** The ids a selection may still move: the unlocked ones, and the ones that
 *  were skipped, so the page can say "<id> is locked". */
export function movableIds(ids: string[], locked: Set<string>): { ok: string[]; skipped: string[] } {
  const ok: string[] = [];
  const skipped: string[] = [];
  for (const id of ids) (locked.has(id) ? skipped : ok).push(id);
  return { ok, skipped };
}

/** True when a kind's rows can carry a lock button. */
export function isLockableKind(kind: string): boolean {
  return (LOCKABLE_KINDS as readonly string[]).includes(kind);
}

/** The lock button in a row: an inline SVG padlock, aria-pressed, one undo
 *  step per toggle through the caller's patch. */
export function lockButton(locked: boolean, onToggle: () => void): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "lock";
  btn.title = locked ? "Unlock" : "Lock";
  btn.setAttribute("aria-pressed", String(locked));
  btn.setAttribute("aria-label", locked ? "Unlock" : "Lock");
  btn.innerHTML = locked ? LOCK_ICON : UNLOCK_ICON;
  btn.addEventListener("click", () => onToggle());
  return btn;
}

