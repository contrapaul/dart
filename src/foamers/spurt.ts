import type { FoamerSpec } from "./foamer";
import type { PartSpec } from "./rig";
import { armourOf } from "./armour";
import tuning from "../../data/spurt.json";

// FX-spurt (Paul, 2026-11-16): which hits throw a spurt of foam cubes. Only
// the Foamer's own foam does: its body, head, limbs and fins, plus the soft
// parts the data lists by id. A weapon, a worn detail, a piece of gear, a
// plate and a shield throw none. Every number is in data/spurt.json.

export const SPURT = tuning;

/** Does a dart on this part throw a spurt? */
export function spurtsFoam(spec: FoamerSpec, part: PartSpec): boolean {
  if (!SPURT.kinds.includes(part.kind) && !SPURT.parts.includes(part.id)) return false;
  // A plate or a shield (armour that cuts damage) is not the Foamer's own
  // foam, whatever its kind, and whichever side the dart came from.
  const armour = armourOf(spec, part.id);
  return !armour || armour.damage >= 1;
}
