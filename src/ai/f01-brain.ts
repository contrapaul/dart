import aiData from "../../data/ai.json";
import type { Director, TokenKind } from "./director";
import { Brain, type BrainHooks } from "./brain";

// F01's brain logic (ENG-08 stage 3a): idle, alert, approach and hold as pure
// functions over a plain input struct. No Foamer class, no Three.js, no
// Rapier: the Foamer side gathers the input (distance, sight, damage, its
// neighbours) and applies the movement intent, so this file can be tested
// with simulated agents.
//
// The attack states (windup, strike, recover) and the damage states (stagger,
// fall, crawl, down) stay where they are in src/foamers/; this layer decides
// when to want a token and when to give it back.

export const BRAIN = aiData.brain;

/** What one step tells the brain. Filled in by the Foamer, read only here. */
export interface F01Input {
  /** Metres from the Foamer to the player, in the ground plane. */
  distance: number;
  /** The player is in line of sight (nothing solid between them). */
  lineOfSight: boolean;
  /** It took damage since the last step: being shot wakes it up. */
  tookDamage: boolean;
  /** A Foamer inside alertRadius went alert since the last step. */
  nearbyAlert: boolean;
  /** It holds an attack token from the director right now. */
  hasToken: boolean;
  /** The rig's attack range (metres). */
  attackRange: number;
  /** The distance it holds at without a token (metres). */
  holdRange: number;
}

/** What the brain wants done this step. */
export type MoveIntent = "stand" | "followPath" | "circleLeft" | "circleRight";

/** The decision, written in place so a step allocates nothing. */
export interface F01Decision {
  state: F01State;
  move: MoveIntent;
  /** Ask the director for a token this step. */
  wantsToken: boolean;
}

/** The four states this layer owns. The Foamer's attack and damage states
 *  are separate: it takes over once the brain says it may attack. */
export type F01State = "idle" | "alert" | "approach" | "hold";

/** Why a token is going back: the director treats them differently. */
export type ReleaseReason = "attackEnd" | "stagger" | "fall" | "down";

/**
 * Which way a holding Foamer sidles. From the agent id, so it is a pure
 * function of the caller and two Foamers on the same player do not mirror
 * each other into the same gap.
 */
export function circleSide(agentId: number): MoveIntent {
  return agentId % 2 === 0 ? "circleLeft" : "circleRight";
}

/**
 * One step of F01's logic. Writes the wanted state and movement intent into
 * `out` and returns it. Never goes straight to approach from idle: idleness
 * always passes through alert, which is the telegraph the player sees.
 */
export function decideF01(
  state: F01State,
  stateTime: number,
  input: F01Input,
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
      out.move = "followPath";
      out.wantsToken = dist <= input.attackRange;
      if (input.hasToken && dist <= input.attackRange) {
        // It may attack: the Foamer's windup takes over from here.
        out.move = "stand";
        return out;
      }
      if (!input.hasToken && dist <= input.attackRange) {
        // In reach but without a token: back off to holdRange and wait.
        out.state = "hold";
        out.move = circleSide(agentId);
        out.wantsToken = true;
      }
      return out;
    }
    case "hold": {
      out.wantsToken = true;
      out.move = circleSide(agentId);
      // A token, or the player walking away, sends it back to approach.
      if (input.hasToken || dist > input.holdRange) {
        out.state = "approach";
        out.move = "followPath";
      }
      return out;
    }
  }
}

/**
 * The bid for a token: closer agents win, an agent in view beats one that is
 * not, and every second of waiting adds to the score so no Foamer starves
 * (the director grants to the highest score). `waited` is seconds spent
 * asking without a token.
 */
export function tokenScore(distance: number, lineOfSight: boolean, waited: number): number {
  const closeness = 1 / Math.max(distance, 0.5);
  return closeness + (lineOfSight ? 1 : 0) + waited * 0.5;
}

/** Ask the director while the brain wants a token. True once it holds one. */
export function updateToken(
  director: Director,
  agentId: number,
  kind: TokenKind,
  wants: boolean,
  distance: number,
  lineOfSight: boolean,
  waited: number,
): boolean {
  return wants ? director.request(agentId, kind, tokenScore(distance, lineOfSight, waited)) : false;
}

/**
 * Give the token back. Attack end, stagger and fall release it, so it comes
 * home after tokenCooldown and attacks do not chain. Going down forgets it:
 * that Foamer is out of the fight (down is terminal), and making the next
 * Foamer in line wait out a cooldown for a dead one would look like a stall.
 */
export function releaseToken(director: Director, agentId: number, reason: ReleaseReason): void {
  if (reason === "down") director.forget(agentId);
  else director.release(agentId);
}

/** The context the Foamer feeds in, and the decision it reads back. */
export interface F01Context {
  agentId: number;
  input: F01Input;
  /** Written by every step: the state to want and the movement intent. */
  decision: F01Decision;
}

/**
 * A Brain over F01's four states, wiring decideF01 to the hooks. The caller
 * fills `ctx.input` before `brain.update(dt, ctx)` and reads `ctx.decision`
 * after it. The hooks are stateless: one brain per agent, no shared table.
 */
export function makeF01Brain(
  initial: F01State = "idle",
  logSize = 8,
): Brain<F01State, F01Context> {
  const hooks: BrainHooks<F01State, F01Context> = {
    idle: { update: (_dt, t, ctx) => step("idle", t, ctx) },
    alert: { update: (_dt, t, ctx) => step("alert", t, ctx) },
    approach: { update: (_dt, t, ctx) => step("approach", t, ctx) },
    hold: { update: (_dt, t, ctx) => step("hold", t, ctx) },
  };
  return new Brain(initial, hooks, logSize);
}

/** Run one state and say which state to be in next. */
function step(state: F01State, stateTime: number, ctx: F01Context): F01State {
  return decideF01(state, stateTime, ctx.input, ctx.agentId, ctx.decision).state;
}

/** A fresh context for one agent: one allocation per Foamer, none per step.
 *  The caller sets `input.attackRange` from the rig before each step. */
export function makeF01Context(agentId: number): F01Context {
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
    },
    decision: { state: "idle", move: "stand", wantsToken: false },
  };
}
