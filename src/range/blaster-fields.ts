// R3-14 (PLAN-GPU0 items 12 to 14): the numbers a blaster has, as data, for
// the range's Tune panel. Pure module, no DOM: the panel draws what
// `fieldsFor` reports, and the tests assert on the same shape.
//
// Damage is left out on purpose: a dart's damage lives in data/darts.json
// (per dart type), not per blaster, so there is no per-blaster damage field.

import { deepMerge, localTuning } from "../core/tuning";
import { resolveSpec } from "../weapons/blaster";
import rawJson from "../../data/blasters.json";
import committedJson from "../../data/tuning.json";

export interface BlasterField {
  /** Stable key, for the panel's DOM order and tests. */
  key: string;
  group: "Fire" | "Ammo" | "Movement";
  /** Path into the raw blaster record (the tuning patch's shape). */
  path: string[];
  label: string;
  step: number;
  min: number;
  max: number;
  /** A short note for the row (e.g. "auto only"). */
  note?: string;
}

export const FIELDS: BlasterField[] = [
  // Fire. fireInterval is only read by auto/semi/burst; a pump blaster
  // uses primeTime instead. spinUp is an auto feature too. The recoil
  // knob the panel edits is the per-shot spread; the rest of the recoil
  // block stays in the data (the panel is not a free-form JSON editor).
  { key: "fireInterval", group: "Fire", path: ["fireInterval"], label: "Fire interval (s)", step: 0.01, min: 0, max: 2, note: "auto/semi only" },
  { key: "spinUp", group: "Fire", path: ["spinUp"], label: "Spin-up (s)", step: 0.05, min: 0, max: 3, note: "auto only" },
  { key: "dartsPerShot", group: "Fire", path: ["dartsPerShot"], label: "Darts per shot", step: 1, min: 1, max: 12 },
  { key: "spreadDeg", group: "Fire", path: ["spreadDeg"], label: "Spread (degrees)", step: 0.25, min: 0, max: 20 },
  { key: "recoilSpreadPerShot", group: "Fire", path: ["recoil", "spreadPerShot"], label: "Recoil spread per shot", step: 0.1, min: 0, max: 10 },
  // Ammo.
  { key: "magSize", group: "Ammo", path: ["magSize"], label: "Magazine size", step: 1, min: 1, max: 150 },
  { key: "reserveMax", group: "Ammo", path: ["reserveMax"], label: "Reserve max", step: 5, min: 0, max: 500 },
  { key: "reserveStart", group: "Ammo", path: ["reserveStart"], label: "Reserve start", step: 5, min: 0, max: 500 },
  { key: "reloadTime", group: "Ammo", path: ["reloadTime"], label: "Reload (s)", step: 0.1, min: 0, max: 10 },
  { key: "primeTime", group: "Ammo", path: ["primeTime"], label: "Prime time (s)", step: 0.05, min: 0, max: 5, note: "pump only" },
  // Movement.
  { key: "fireMoveShare", group: "Movement", path: ["fireMoveShare"], label: "Fire move share", step: 0.05, min: 0.2, max: 1, note: "speed while firing" },
];

type RawBlaster = Record<string, unknown>;

function rawOf(id: string): RawBlaster {
  return (rawJson as unknown as Record<string, RawBlaster>)[id]!;
}

function readPath(obj: unknown, path: string[]): number {
  let v: unknown = obj;
  for (const k of path) {
    if (typeof v !== "object" || v === null) return 0;
    v = (v as Record<string, unknown>)[k];
  }
  return typeof v === "number" ? v : 0;
}

function committedBase(id: string): RawBlaster {
  const committed = (committedJson as { blasters?: Record<string, Record<string, unknown>> });
  return deepMerge(rawOf(id), committed.blasters?.[id] ?? {});
}

/** The value in force for a field: the resolved spec (committed plus this
 *  browser's override), with no mods applied (the mod layer stacks on top). */
export function valueInForce(id: string, field: BlasterField): number {
  return readPath(resolveSpec(id), field.path);
}

/** The value the committed file gives the field: what a reset restores. */
export function committedValue(id: string, field: BlasterField): number {
  return readPath(committedBase(id), field.path);
}

/** The override for this blaster, for a field's path (the browser's own
 *  value, or undefined when nothing is overridden). */
function overrideValue(id: string, path: string[]): number | undefined {
  const ov = localTuning().blasters[id];
  if (!ov) return undefined;
  let cur: unknown = ov;
  for (const k of path) {
    if (typeof cur !== "object" || cur === null) return undefined;
    cur = (cur as Record<string, unknown>)[k];
    if (cur === undefined) return undefined;
  }
  return typeof cur === "number" ? cur : undefined;
}

/** Is a field changed from the committed file by this browser's override? */
export function isChanged(id: string, field: BlasterField): boolean {
  const v = overrideValue(id, field.path);
  if (v === undefined) return false;
  return v !== committedValue(id, field);
}

/** The patch for one field's value, nested for the deep-merge store. */
export function patchFor(field: BlasterField, value: number): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  let cur = patch;
  for (let i = 0; i < field.path.length - 1; i++) {
    cur[field.path[i]!] = {};
    cur = cur[field.path[i]!] as Record<string, unknown>;
  }
  cur[field.path[field.path.length - 1]!] = value;
  return patch;
}

/** Grouped, in data order, for the panel. */
export function fieldsFor(_id: string): BlasterField[] {
  return FIELDS;
}

