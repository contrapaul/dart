import aiData from "../../data/ai.json";
import { Brain, type BrainHooks } from "./brain";
import {
  circleSide,
  type F01Decision,
  type F01Input,
  type F01State,
  type MoveIntent,
} from "./f01-brain";

// F02 Roamer's brain (GAME-10a): the ranged variant of f01-brain.ts. Same
// four states, same pure shape, same token bid; what differs is the distance
// it wants. An F01 walks to bonking range and holds there; an F02 stops at
// its throw range, keeps a preferred distance while it throws, and backs off
// when the player closes in on it. The numbers are per type in
// data/foamers.json (throwRangeMetres, preferredDistanceMetres,
// retreatDistanceMetres).

const BRAIN = aiData.brain;

/** What one step tells the F02 brain. The three distances come from the
 *  type's spec; `holdRange` is the ring the system strafes along, which the
 *  caller sets to the preferred distance for this type. */
export interface F02Input extends F01Input {
  /** The distance at which it stops walking in (metres): inside it, it is
   *  close enough to throw. */
  throwRange: number;
  /** The distance it tries to keep (metres). */
  preferredDistance: number;
  /** Closer than this (metres), it backs away instead of holding. */
  retreatDistance: number;
}

/**
 * One step of F02's logic. Writes the wanted state and movement intent into
 * `out` and returns it. As with F01, idleness always passes through alert.
 */
export function decideF02(
  state: F01State,
  stateTime: number,
  input: F02Input,
  agentId: number,
  out: F01Decision,
): F01Decision {
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
      // The telegraph: a head turn to the player, then it commits.
      out.state = stateTime >= BRAIN.alertTimeSeconds ? "approach" : "alert";
      return out;
    }
    case "approach": {
      // It walks in until it is inside its throw range, then keeps the ring.
      // With a token it stays in approach (that is where the state machine
      // starts attacks), the way an F01 does; without one it settles on the
      // ring and sidles there while it waits.
      out.move = dist <= input.preferredDistance ? "stand" : "followPath";
      if (input.hasToken) {
        // Chasing a runner that came inside the retreat distance: back out
        // to the ring instead of walking into it.
        if (dist < input.retreatDistance) out.move = "backOff";
      } else if (dist <= input.throwRange) {
        out.state = "hold";
        out.move = ringMove(dist, input, agentId);
        out.wantsToken = true;
      }
      return out;
    }
    case "hold": {
      out.wantsToken = true;
      // A token, or the player walking a margin past the throw range, sends
      // it back to approach: with a token it throws from approach (that is
      // where the state machine starts attacks), and too far out it must
      // close again. The margin is the hysteresis that stops the pair of
      // states flapping at the boundary.
      if (input.hasToken || dist > input.throwRange + BRAIN.holdExitMarginMetres) {
        out.state = "approach";
        out.move = dist <= input.preferredDistance ? "stand" : "followPath";
        out.wantsToken = !input.hasToken;
        return out;
      }
      out.move = ringMove(dist, input, agentId);
      return out;
    }
  }
}

/**
 * What to do about the distance on the ring: back off when the player is
 * inside the retreat distance, sidle along the ring at any other distance.
 * The ring itself (stepping in or out toward the distance it keeps while it
 * strafes) is the system's circle stride, which aims at the agent's
 * `holdRange`, set to the preferred distance for this type.
 */
function ringMove(dist: number, input: F02Input, agentId: number): MoveIntent {
  if (dist < input.retreatDistance) return "backOff";
  return circleSide(agentId);
}

/** The context the Foamer feeds in, and the decision it reads back. Same
 *  shape as the F01 one plus the three ranged distances, so the agent class
 *  holds either brain in one field. */
export interface F02Context {
  agentId: number;
  input: F02Input;
  /** Written by every step: the state to want and the movement intent. */
  decision: F01Decision;
}

/** A Brain over F02's four states, wiring decideF02 to the hooks. The caller
 *  fills `ctx.input` before `brain.update(dt, ctx)` and reads `ctx.decision`
 *  after it. */
export function makeF02Brain(
  initial: F01State = "idle",
  logSize = 8,
): Brain<F01State, F02Context> {
  const hooks: BrainHooks<F01State, F02Context> = {
    idle: { update: (_dt, t, ctx) => step("idle", t, ctx) },
    alert: { update: (_dt, t, ctx) => step("alert", t, ctx) },
    approach: { update: (_dt, t, ctx) => step("approach", t, ctx) },
    hold: { update: (_dt, t, ctx) => step("hold", t, ctx) },
  };
  return new Brain(initial, hooks, logSize);
}

/** Run one state and say which state to be in next. */
function step(state: F01State, stateTime: number, ctx: F02Context): F01State {
  return decideF02(state, stateTime, ctx.input, ctx.agentId, ctx.decision).state;
}

/** A fresh context for one F02 agent: one allocation per Foamer, none per
 *  step. The caller fills the three distances from the type's spec. */
export function makeF02Context(agentId: number): F02Context {
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
      sinceNibble: Infinity,
    },
    decision: { state: "idle", move: "stand", wantsToken: false },
  };
}
