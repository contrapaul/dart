import editorData from "../../data/editor.json";
import rigData from "../../data/foamer-rigs.json";
import blastersData from "../../data/blasters.json";
import meleeData from "../../data/melee.json";
import materialData from "../../data/materials.json";
import type {
  KeyColour, LevelDoor, Pickup, PlacedFoamer, Rift, Vec3, Zone,
} from "../level/format";
import { GRID, snapVec3 } from "./doc";

// ED-05 stage 1: the things the editor places besides prims, and the numbers
// that describe them. Pure data, like the document: the view and the
// inspector both read it, and a test can build one without a canvas.

/** The marker numbers and starting values, from data/editor.json. */
export const MARKERS = editorData.markers;
export const START_LOADOUT = editorData.start;

/** The rig ids the editor offers, with the names data/foamer-rigs.json
 *  gives them, in the file's order. */
export const RIGS: { id: string; label: string }[] = (rigData.rigs as { id: string; label: string }[])
  .map((r) => ({ id: r.id, label: r.label }));

/** Every blaster the start can hold and a pickup can give. */
export const BLASTERS: { id: string; name: string }[] =
  ((blastersData as { order: string[] }).order).map((id) => ({
    id,
    name: ((blastersData as unknown as Record<string, { name?: string }>)[id]?.name) ?? id,
  }));

/** Every hand weapon a pickup can give. */
export const MELEE: { id: string; name: string }[] =
  Object.entries((meleeData as { weapons: Record<string, { name?: string }> }).weapons)
    .map(([id, w]) => ({ id, name: w.name ?? id }));

/** The ammo boxes the palette offers: a pickup type and the name it shows. */
export const AMMO_TYPES: { type: Pickup["type"]; label: string; count: number }[] = [
  { type: "darts-standard", label: "Darts", count: 20 },
  { type: "darts-precision", label: "Precision darts", count: 10 },
  { type: "shells-b03", label: "Shells", count: 6 },
  { type: "mega", label: "Mega darts", count: 5 },
  { type: "foam-balls", label: "Foam balls", count: 8 },
];

export const KEY_COLOURS: KeyColour[] = ["red", "blue", "yellow"];

/** The colour a pickup is drawn in: a key its own colour, a health pack the
 *  pack colour, anything else the generic one. */
export function pickupColour(pickup: Pickup): string {
  if (pickup.type === "key" && pickup.key) return MARKERS.keyColours[pickup.key];
  if (pickup.type === "health") return MARKERS.healthPickupColour;
  return MARKERS.pickupColour;
}

/** The colour a door is drawn in: its own, or its key's, or the default. */
export function doorColour(door: LevelDoor): string {
  if (door.colour) return door.colour;
  if (door.lock !== "none" && door.lock !== "trigger") return MARKERS.keyColours[door.lock];
  return MARKERS.doorColour;
}

/** The colour a Foamer is drawn in: its rig's body material. */
export function foamerColour(rig: string): string {
  const found = (rigData.rigs as { id: string; material?: string }[]).find((r) => r.id === rig);
  const name = found?.material;
  const entry = name
    ? (materials().find((m) => m.name === name)?.colour)
    : undefined;
  return entry ?? MARKERS.doorColour;
}

let paletteCache: { name: string; colour: string }[] | null = null;
function materials(): { name: string; colour: string }[] {
  return paletteCache ?? (paletteCache = materialData.materials.map((m) => ({ name: m.name, colour: m.color })));
}

/** A rig's label, e.g. "F01 Slowmer", or the id when the data has no label. */
export function rigLabel(rig: string): string {
  const found = RIGS.find((r) => r.id === rig);
  return found ? `${found.id} ${found.label}` : rig;
}

function at(pos: Vec3): Vec3 {
  return snapVec3([pos[0], pos[1], pos[2]], GRID);
}

/** A Foamer standing at a point, facing -z. */
export function makeFoamer(id: string, pos: Vec3, rig = RIGS[0]?.id ?? "F01"): PlacedFoamer {
  return { id, foamer: rig, pos: at(pos), yaw: 0, wake: "sight" };
}

/** A pickup of a type at a point, with the fields that type needs. */
export function makePickup(id: string, type: Pickup["type"], pos: Vec3): Pickup {
  const p: Pickup = { id, type, pos: at(pos) };
  const ammo = AMMO_TYPES.find((a) => a.type === type);
  if (ammo) p.count = ammo.count;
  if (type === "health") p.amount = 25;
  if (type === "key") p.key = "red";
  if (type === "blaster") p.blaster = BLASTERS[0]?.id ?? "B01";
  if (type === "melee") p.melee = MELEE[0]?.id ?? "M01";
  return p;
}

/** A door standing on the floor at a point: a 2 by 3 m slab, 0.4 m thick. */
export function makeDoor(id: string, pos: Vec3): LevelDoor {
  return {
    id,
    pos: at([pos[0], pos[1] + 1.5, pos[2]]),
    size: [2, 3, 0.4],
    lock: "none",
  };
}

/** A spawn point a trigger's spawn names, lying on the floor. */
export function makeSpawn(id: string, pos: Vec3): Rift {
  return { id, pos: at([pos[0], pos[1], pos[2]]), facing: [0, 1, 0] };
}

/** A zone a trigger's "enter" watches: a 4 by 3 by 4 m box on the floor. */
export function makeZone(id: string, pos: Vec3): Zone {
  return { id, pos: at([pos[0], pos[1] + 1.5, pos[2]]), size: [4, 3, 4] };
}
