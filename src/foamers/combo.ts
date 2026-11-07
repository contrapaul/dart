import type { FoamerSpec } from "./foamer";

// GAME-10k: the Seawall's combo, and the melee parry that is its counter
// (CONTENT-PLAN F11: "Combo, then a parryable finisher. Teaches parry
// mastery"). Everything here is data driven, so any later Foamer may run a
// combo of its own or mark an attack parryable.
//
// The combo is an ordered list of attack ids in the type's spec
// (data/foamers.json, `combo`): the Foamer fights them in that order, one
// per strike, and the turn counter (Foamer.comboTurn) counts the attacks
// that actually landed, the way the Floater's blobTurn counts its spits.
//
// A parryable attack is the pink tell (CONTENT-PLAN 3: pink means parryable
// and only parryable): during its windup the named part wears the parry
// balls' material, and only a raised shield inside the parry window turns
// it. A blocked but unparried hit costs its block share as any attack does.

/** The type's combo: its attack ids in the order it fights them. */
export interface ComboSpec {
  attacks: string[];
}

/** The parry numbers of a type whose attacks can be parried, or null. */
export interface MeleeParrySpec {
  /** The part that takes the parries and breaks off when they are spent. */
  part: string;
  /** The part that shows the pink tell during a parryable attack's windup
   *  (the Seawall's mace head: what is coming is the thing that swings). */
  tellPart: string;
  /** Seconds the Foamer staggers when one of its attacks is parried. */
  staggerSeconds: number;
  /** Parries the part takes before it breaks off. */
  parriesToBreak: number;
}

/** The combo block of a type, or null when it fights without one. */
export function comboOf(spec: FoamerSpec): ComboSpec | null {
  const c = (spec as { combo?: ComboSpec }).combo;
  return c && c.attacks.length > 0 ? c : null;
}

/** The melee parry block of a type, or null when none of its attacks can be
 *  parried. */
export function meleeParryOf(spec: FoamerSpec): MeleeParrySpec | null {
  const p = (spec as { meleeParry?: Partial<MeleeParrySpec> }).meleeParry;
  if (!p || !p.part) return null;
  return {
    part: p.part, tellPart: p.tellPart ?? p.part,
    staggerSeconds: p.staggerSeconds ?? 1.5, parriesToBreak: p.parriesToBreak ?? 2,
  };
}

/** Whether this attack is marked parryable in the type's spec. */
export function parryableAttack(spec: FoamerSpec, attackId: string): boolean {
  const a = spec.attacks.find((x) => x.id === attackId) as { parryable?: boolean } | undefined;
  return a?.parryable === true;
}

/**
 * What a melee hit that reached the player costs it. `blocked` is the raised
 * disc's own read (Shield.blocksAttackFrom), `withinWindow` the parry
 * window's own read (Shield.canParry). Only an attack marked parryable can
 * be parried, and only behind the disc: anything else is a block behind the
 * disc or a clean hit.
 */
export function decideMeleeParry(
  spec: FoamerSpec,
  attackId: string,
  blocked: boolean,
  withinWindow: boolean,
): "parry" | "block" | "hit" {
  if (!blocked) return "hit";
  if (parryableAttack(spec, attackId) && withinWindow) return "parry";
  return "block";
}
