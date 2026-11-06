import aiData from "../../data/ai.json";
import { Brain, type BrainHooks } from "./brain";
import {
  circleSide,
  type F01Decision,
  type F01State,
  type MoveIntent,
} from "./f01-brain";
import { decideF02, type F02Context, type F02Input } from "./f02-brain";

// F04 Blocker's brain (GAME-10e): the shield wall. It walks to a slot on a
// line across the player and holds it, shield to the front, and with the
// ranged token it fires a volley over the shield. The slots are worked out
// by the Foamer system (it knows the other Blockers) and fed in as
// `slotX`/`slotZ`; this layer only decides whether to walk to the slot or
// stand on it.
//
// A Blocker whose shield has been shot away has nothing to hold a wall
// with, so it keeps its distance the way an F02 Roamer does. That is the
// F02 brain, borrowed whole, rather than a second copy of the logic.

const BRAIN = aiData.brain;

/** What one step tells the F04 brain. The three F02 distances are kept so
 *  the broken-shield fallback has what it needs. */
export interface F04Input extends F02Input {
  /** The slot it should hold, in the ground plane (metres). */
  slotX: number;
  slotZ: number;
  /** Metres from the Foamer to its slot, in the ground plane. */
  slotDistance: number;
  /** The shield part has been shot away: no wall left, so keep away. */
  shieldBroken: boolean;
}

/** The context the Foamer feeds in, and the decision it reads back. An
 *  F02Context plus the slot fields, so the agent class holds either brain
 *  in one field. */
export interface F04Context extends F02Context {
  input: F04Input;
}

/**
 * One step of F04's logic. Writes the wanted state and movement intent into
 * `out` and returns it. With the shield gone it hands the step to F02.
 */
export function decideF04(
  state: F01State,
  stateTime: number,
  input: F04Input,
  agentId: number,
  out: F01Decision,
): F01Decision {
  if (input.shieldBroken) {
    // Nothing to hide behind: keep the throw distance like a Roamer.
    if (state === "hold") state = "approach";
    return decideF02(state, stateTime, input, agentId, out);
  }
  out.state = state;
  out.move = "stand";
  out.wantsToken = false;
  const dist = input.distance;

  switch (state) {
    case "idle": {
      const sees = dist <= BRAIN.sightRangeMetres && input.lineOfSight;
      out.state = sees || input.tookDamage || input.nearbyAlert ? "alert" : "idle";
      return out;
    }
    case "alert": {
      // The telegraph, then it takes its place in the wall.
      out.state = stateTime >= BRAIN.alertTimeSeconds ? "approach" : "alert";
      return out;
    }
    case "approach": {
      // Walk to the slot, not to the player: the slot is where the wall
      // stands. Standing on the slot and inside the slot range, it holds
      // and asks for the ranged token.
      if (input.hasToken) {
        out.move = input.slotDistance > SLOT_REACHED ? "toSlot" : "stand";
        return out;
      }
      if (input.slotDistance > SLOT_REACHED) {
        out.move = "toSlot";
        return out;
      }
      if (dist <= input.throwRange) {
        out.state = "hold";
        out.wantsToken = true;
        return out;
      }
      // On its slot but out of throw range (the player ran off): sidle
      // along the ring the way a Roamer does, until the slot is redrawn.
      out.move = dist < input.retreatDistance ? "backOff" : circleSide(agentId);
      return out;
    }
    case "hold": {
      // A token in hand sends it to approach, which is where the state
      // machine starts attacks: it fires its volley from there and comes
      // back to hold afterwards. The wall does not budge for it.
      if (input.hasToken) {
        out.state = "approach";
        out.move = input.slotDistance > SLOT_REACHED ? "toSlot" : "stand";
        return out;
      }
      out.wantsToken = true;
      // The player moved: the slot has moved with it, so go back to
      // walking to the new place. A margin stops the pair of states
      // flapping while the wall shuffles.
      if (input.slotDistance > SLOT_LEAVE) {
        out.state = "approach";
        out.move = "toSlot";
        return out;
      }
      // On its slot and holding: stand, so the shield stays to the front.
      out.move = "stand";
      return out;
    }
  }
}

/** Metres: inside this of the slot counts as standing on it. */
export const SLOT_REACHED = 0.4;
/** Metres: outside this, a holding Blocker walks back to its slot. */
export const SLOT_LEAVE = 1.0;

/** A Brain over F04's four states, wiring decideF04 to the hooks. */
export function makeF04Brain(
  initial: F01State = "idle",
  logSize = 8,
): Brain<F01State, F04Context> {
  const hooks: BrainHooks<F01State, F04Context> = {
    idle: { update: (_dt, t, ctx) => step("idle", t, ctx) },
    alert: { update: (_dt, t, ctx) => step("alert", t, ctx) },
    approach: { update: (_dt, t, ctx) => step("approach", t, ctx) },
    hold: { update: (_dt, t, ctx) => step("hold", t, ctx) },
  };
  return new Brain(initial, hooks, logSize);
}

function step(state: F01State, stateTime: number, ctx: F04Context): F01State {
  return decideF04(state, stateTime, ctx.input, ctx.agentId, ctx.decision).state;
}

/** A fresh context for one F04 agent: one allocation per Foamer. */
export function makeF04Context(agentId: number): F04Context {
  return {
    agentId,
    input: {
      distance: Infinity,
      lineOfSight: false,
      tookDamage: false,
      nearbyAlert: false,
      hasToken: false,
      attackRange: 0,
      holdRange: BRAIN.holdRangeMetres,
      throwRange: 0,
      preferredDistance: 0,
      retreatDistance: 0,
      flightClear: true,
      sinceNibble: Infinity,
      slotX: 0,
      slotZ: 0,
      slotDistance: Infinity,
      shieldBroken: false,
    },
    decision: { state: "idle", move: "stand", wantsToken: false },
  };
}

export type { MoveIntent };
