import type { Level } from "../level/format";
import { arenaToTriggers } from "../level/arena-to-triggers";

// ED-09 stage 3: a built in level opens in the editor as a copy. Its fights
// are written as `arenas`, which the editor does not edit, so the copy is
// run through arenaToTriggers first: every arena becomes a zone, doors,
// spawn points and triggers Paul can change. What the conversion cannot
// express comes back as warnings for the Problems list.

export interface BuiltInCopy {
  level: Level;
  warnings: string[];
}

/** A copy of a built in level, with its arenas turned into triggers. The
 *  input is not changed. */
export function builtInCopy(level: Level): BuiltInCopy {
  const copy = structuredClone(level);
  const { level: converted, warnings } = arenaToTriggers(copy);
  return { level: converted, warnings };
}
