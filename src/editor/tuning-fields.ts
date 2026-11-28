// R3 (Paul, 2026-11-28): the fields the tuning panel shows, as data.
// One field per tunable number, grouped, each with its path in a tune
// patch, a label, a step and a min and max. Pure (spec-only), so the panel
// and the tests share it. Tuned via `tunedOne`; a placed Foamer's own
// tuning (PlacedFoamer.tuning) sits over the type's.

import type { FoamerTune } from "../core/tuning";
import { tunedOne } from "../foamers/foamers";
import type { FoamerSpec, GameRig } from "../foamers/foamer";
import foamerData from "../../data/foamers.json";
import rigData from "../../data/foamer-rigs.json";

export type FieldGroup =
  | "Movement" | "Health" | "Size" | "Damage dealt" | "Attack speed" | "Damage taken";

export interface TuningField {
  id: string;
  group: FieldGroup;
  label: string;
  /** One sentence: what the number does, for the tooltip. */
  title: string;
  step: number;
  min: number;
  max: number;
  /** The value in force, from the resolved spec or rig. */
  get(spec: FoamerSpec, rig: GameRig): number;
  /** A fresh patch that sets the value. Needs the current spec to rebuild
   *  the attack list (arrays replace in the merge). */
  patch(spec: FoamerSpec, rig: GameRig, value: number): FoamerTune;
}

export interface FieldValue {
  field: TuningField;
  /** The value in force (type tuning, plus the placed Foamer's own). */
  value: number;
  /** False when the value matches the committed data files. */
  changed: boolean;
}

function baseSpec(type: string): FoamerSpec {
  const base = foamerData.test;
  const o = (foamerData.types as Record<string, Record<string, unknown> & { attacks?: FoamerSpec["attacks"]; rig?: string }>)[type] ?? {};
  return {
    ...base,
    ...(o as Record<string, unknown>),
    attacks: (o.attacks as FoamerSpec["attacks"]) ?? base.attacks,
    rig: o.rig ?? base.rig,
  } as FoamerSpec;
}

function baseRig(type: string): GameRig {
  const spec = baseSpec(type);
  const rigs = rigData.rigs as unknown as GameRig[];
  return rigs.find((r) => r.id === spec.rig) ?? rigs[0]!;
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

function numberField(
  id: string, group: FieldGroup, label: string, title: string,
  step: number, min: number, max: number,
  get: (spec: FoamerSpec, rig: GameRig) => number,
  set: (spec: FoamerSpec, rig: GameRig, value: number) => FoamerTune,
): TuningField {
  return {
    id, group, label, title, step, min, max,
    get,
    patch: (spec, rig, value) => set(spec, rig, clamp(value, min, max)),
  };
}

function attacks(spec: FoamerSpec): FoamerSpec["attacks"] {
  return spec.attacks;
}

/** Every field the panel can show for `type`, or `type` plus a placed
 *  Foamer's own tuning. `own` is PlacedFoamer.tuning (undefined for the
 *  whole type). */
export function fieldsFor(type: string, own?: FoamerTune): FieldValue[] {
  const { spec, rig } = tunedOne(type, own, false);
  const bSpec = baseSpec(type);
  const bRig = baseRig(type);
  const fields: TuningField[] = [
    numberField("rig.speed", "Movement", "movement speed (m/s)", "How fast the Foamer walks.", 0.1, 0, 6,
      (_s, r) => r.speed, (_s, _r, v) => ({ rig: { speed: v } })),
    numberField("spec.turnRate", "Movement", "turn rate (rad/s)", "How quickly the Foamer swings to face the player.", 0.5, 0, 20,
      (s) => s.turnRate, (_s, _r, v) => ({ spec: { turnRate: v } })),
    numberField("spec.attackRange", "Movement", "attack range (m)", "How close the player must be before the Foamer swings.", 0.1, 0.2, 6,
      (s) => s.attackRange, (_s, _r, v) => ({ spec: { attackRange: v } })),
  ];
  // Preferred distance: only types that declare one keep a field for it.
  if (spec.preferredDistanceMetres !== undefined) {
    fields.push(numberField("spec.preferredDistanceMetres", "Movement", "preferred distance (m)", "How far away the Foamer prefers to keep the player.", 0.5, 0, 30,
      (s) => s.preferredDistanceMetres, (_s, _r, v) => ({ spec: { preferredDistanceMetres: v } })));
  }
  fields.push(numberField("rig.health", "Health", "health (hp)", "How much damage the Foamer can take before it dies.", 1, 1, 300,
    (_s, r) => r.health, (_s, _r, v) => ({ rig: { health: v } })));
  // Size is a multiplier of the type's committed size (1.0 is normal).
  // It still writes the rig's voxelSize: committed voxelSize x multiplier.
  const committedSize = bRig.voxelSize;
  fields.push(numberField("rig.voxelSize", "Size", "size (x)", "Scale of the whole Foamer: 1.0 is normal, 2.0 is twice as big.", 0.1, 0.5, 3,
    (_s, r) => r.voxelSize / committedSize, (_s, _r, v) => ({ rig: { voxelSize: committedSize * v } })));
  // Damage dealt, per attack.
  for (const atk of attacks(spec)) {
    fields.push(numberField(`attack.${atk.id}.damage`, "Damage dealt", `${atk.id} damage (hp)`, "How many hit points this attack takes off the player.", 1, 0, 100,
      (s) => s.attacks.find((a) => a.id === atk.id)?.damage ?? 0,
      (s, _r, v) => ({
        spec: { attacks: s.attacks.map((a) => (a.id === atk.id ? { ...a, damage: v } : a)) },
      })));
  }
  // Attack speed, per attack: windup and strike.
  for (const atk of attacks(spec)) {
    fields.push(numberField(`attack.${atk.id}.windup`, "Attack speed", `${atk.id} wind-up before a hit (s)`, "Seconds to wind up before this attack lands.", 0.05, 0, 3,
      (s) => s.attacks.find((a) => a.id === atk.id)?.windup ?? 0,
      (s, _r, v) => ({
        spec: { attacks: s.attacks.map((a) => (a.id === atk.id ? { ...a, windup: v } : a)) },
      })));
    fields.push(numberField(`attack.${atk.id}.strike`, "Attack speed", `${atk.id} strike time (s)`, "How long this attack takes to strike.", 0.05, 0, 2,
      (s) => s.attacks.find((a) => a.id === atk.id)?.strike ?? 0,
      (s, _r, v) => ({
        spec: { attacks: s.attacks.map((a) => (a.id === atk.id ? { ...a, strike: v } : a)) },
      })));
  }
  // Damage taken: part damage multipliers, wear break, min hp, weakpoint,
  // catastrophic thresholds.
  for (const kind of Object.keys(spec.partDamage.kinds)) {
    fields.push(numberField(`partDamage.${kind}.hit`, "Damage taken", `${kind} hit (times)`, "How much damage this part takes, in times the base damage.", 0.25, 0, 5,
      (s) => (s.partDamage.kinds as Record<string, { hit: number }>)[kind]?.hit ?? 0,
      (s, _r, v) => ({
        spec: {
          partDamage: {
            kinds: { [kind]: { ...((s.partDamage.kinds as Record<string, unknown>)[kind] as Record<string, unknown>), hit: v } },
          },
        },
      })));
  }
  fields.push(numberField("partDamage.wearBreak", "Damage taken", "wear break (share)", "How much a part wears away before it snaps off.", 0.05, 0, 0.9,
    (s) => s.partDamage.wearBreak,
    (_s, _r, v) => ({ spec: { partDamage: { wearBreak: v } } })));
  fields.push(numberField("partDamage.minHp", "Damage taken", "part min HP (hp)", "The least health a part holds, whatever its share of the Foamer's.", 1, 1, 30,
    (s) => s.partDamage.minHp,
    (_s, _r, v) => ({ spec: { partDamage: { minHp: v } } })));
  const weak = (spec as { weakpoint?: { damage?: number } }).weakpoint;
  if (weak?.damage !== undefined) {
    fields.push(numberField("weakpoint.damage", "Damage taken", "weakpoint hit (times)", "How hard a shot to the weak point hits.", 0.5, 1, 10,
      (s) => (s as { weakpoint?: { damage?: number } }).weakpoint?.damage ?? 0,
      (_s, _r, v) => ({ spec: { weakpoint: { damage: v } } })));
  }
  fields.push(numberField("catastrophic.chunkAt", "Damage taken", "chunk at (times)", "At what damage level a chunk flies off.", 0.05, 0.05, 2,
    (s) => s.catastrophic.chunkAt,
    (_s, _r, v) => ({ spec: { catastrophic: { chunkAt: v } } })));
  fields.push(numberField("catastrophic.popAt", "Damage taken", "pop at (times)", "At what damage level the Foamer pops.", 0.1, 0.5, 5,
    (s) => s.catastrophic.popAt,
    (_s, _r, v) => ({ spec: { catastrophic: { popAt: v } } })));

  return fields.map((field) => {
    const value = field.get(spec, rig);
    const committed = field.get(bSpec, bRig);
    return { field, value, changed: Math.abs(value - committed) > 1e-9 };
  });
}

/** The committed value of one field, for the “changed” check and resets. */
export function committedValue(field: TuningField, type: string): number {
  return field.get(baseSpec(type), baseRig(type));
}
