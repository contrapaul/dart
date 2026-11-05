import aiData from "../../data/ai.json";
import { Brain, type BrainHooks } from "./brain";
import { BRAIN, circleSide, makeF01Context, type F01Decision, type F01State, type MoveIntent } from "./f01-brain";
import type { F02Context } from "./f02-brain";

// F03 Swarmer's brain (GAME-10d): a biter that works in packs and never
// stands still. It runs in on the player, nibbles once, darts back out to a
// ring at pack.ringMetres and waits out pack.nibbleGapSeconds there before
// it may run in again. Between nibbles it keeps moving round that ring at
// the player, so a pack is a moving ring of foam, not a line of biters.
//
// The four states are the F01 ones: approach is the run in (and where the
// Foamer side starts the windup), hold is the ring wait. It goes to hold the
// moment its nibble lands, because `sinceNibble` restarts at zero, which is
// the same shape as F02's throw-and-hold. The numbers live in
// data/foamers.json (attackRange, holdRangeMetres) and data/ai.json (pack).

export const PACK = aiData.pack;

/**
 * One step of F03's logic. Writes the wanted state and the movement intent
 * into `out`. A Swarmer only nibbles from approach with a token and inside
 * its attack range; back out on the ring it circles until the gap is over.
 */
export function decideF03(
  state: F01State,
  stateTime: number,
  input: F02Context["input"],
  agentId: number,
  out: F01Decision,
): F01Decision {
  out.state = state;
  out.move = "stand";
  out.wantsToken = false;
  const dist = input.distance;
  const gap = input.sinceNibble >= PACK.nibbleGapSeconds;

  switch (state) {
    case "idle": {
      const sees = dist <= BRAIN.sightRangeMetres && input.lineOfSight;
      out.state = sees || input.tookDamage || input.nearbyAlert ? "alert" : "idle";
      return out;
    }
    case "alert": {
      // Same telegraph as the others, one whole pack at a time.
      out.state = stateTime >= BRAIN.alertTimeSeconds ? "approach" : "alert";
      return out;
    }
    case "approach": {
      // It runs straight at the player while the gap is over. The moment it
      // has bitten, the gap is not, and it goes to the ring instead.
      if (!gap) {
        out.state = "hold";
        out.move = ringMove(dist, input, agentId);
        return out;
      }
      out.move = dist <= input.attackRange ? "stand" : "followPath";
      out.wantsToken = dist <= input.attackRange;
      return out;
    }
    case "hold": {
      // The ring wait after a nibble: sidle along the ring, and run back in
      // for the next bite once the gap is over. A player who follows it out
      // past the ring is still circled, not chased in.
      if (gap) {
        out.state = "approach";
        out.move = "followPath";
        return out;
      }
      out.move = ringMove(dist, input, agentId);
      return out;
    }
  }
}

/** Back off when the player is inside the ring, sidle along it otherwise. */
function ringMove(dist: number, input: F02Context["input"], agentId: number): MoveIntent {
  return dist < input.holdRange ? "backOff" : circleSide(agentId);
}

/** The context the Foamer feeds in and the decision it reads back. */
export interface F03Context {
  agentId: number;
  input: F02Context["input"];
  decision: F01Decision;
}

/** A fresh context for one F03 agent. The system fills `holdRange` from the
 *  type's holdRangeMetres each step, and `sinceNibble` from its own clock.
 *  Until then it sits out a full gap, so it never rings without cause. */
export function makeF03Context(agentId: number): F03Context {
  const c = makeF01Context(agentId) as F03Context;
  c.input.holdRange = PACK.ringMetres;
  return c;
}

/** A Brain over F03's four states, wiring decideF03 to the hooks. */
export function makeF03Brain(initial: F01State = "idle", logSize = 8): Brain<F01State, F02Context> {
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
  return decideF03(state, stateTime, ctx.input, ctx.agentId, ctx.decision).state;
}

