import type { StartLoadout } from "./format";

// ED-01: what a level hands the player when it is played on its own, away
// from the campaign (design/EDITOR.md section 6). The campaign's carry
// decides that instead, so this only runs outside it. It goes through the
// same owned set the campaign uses (Loadout.setOwned), so a level's start
// set behaves exactly like a carried one: the ones it does not name are not
// there, and a restart comes back to the same set.

/** The parts of the game a start loadout touches. The real Loadout,
 *  PlayerHealth and Melee all have this shape. */
export interface StartTarget {
  loadout: {
    readonly ids: readonly string[];
    readonly activeIndex: number;
    setOwned(ids: readonly string[]): void;
    select(i: number): void;
  };
  health: { readonly max: number; hp: number };
  melee: { readonly weaponId: string; setArmed(on: boolean): void };
}

/** Applies a level's `start` block. A level with none, or a start that
 *  names no blaster the game has, leaves everything as it is. */
export function applyStart(start: StartLoadout | undefined, t: StartTarget): void {
  if (!start) return;
  const known = start.blasters.filter((id) => t.loadout.ids.includes(id));
  if (known.length === 0) return;
  t.loadout.setOwned(known);
  // The first one named is held. setOwned keeps the active blaster if it
  // is still owned, so a start list that leads with another one switches.
  const first = t.loadout.ids.indexOf(known[0]!);
  if (first >= 0 && first !== t.loadout.activeIndex) t.loadout.select(first);
  t.melee.setArmed((start.melee ?? []).includes(t.melee.weaponId));
  if (start.health !== undefined) {
    t.health.hp = Math.min(t.health.max, Math.max(1, start.health));
  }
}
