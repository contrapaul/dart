import aiData from "../../data/ai.json";
import { Brain, type BrainHooks } from "./brain";
import { circleSide, type F01Input, type F01State } from "./f01-brain";
import type { F02Context } from "./f02-brain";

// F05 Darter's brain (GAME-10b): the charger. It runs the F01 four states
// for idle, alert, hold and the walk in, and three of its own: telegraph
// (it stops, lowers its head and scrapes, so a sidestep is possible),
// charge (a straight line, locked at the end of the telegraph, which it
// cannot steer) and wallStun (it hit a wall; its back is open while it
// recovers). The Foamer side runs the movement and the contact
// (src/foamers/foamers.ts): this layer decides when a charge may start.
//
// It holds the melee token from the telegraph until the wall stun ends, so
// only a few Darters commit at once.

const BRAIN = aiData.brain;

/** The charger's own states, on top of the F01 four. */
export type ChargerState = F01State | "telegraph" | "charge" | "wallStun";

/** What one step tells the charge logic. */
export interface ChargeInput {
  /** Metres to the player, ground plane. */
  distance: number;
  /** Nothing solid between them. */
  lineOfSight: boolean;
  /** It holds the melee token. */
  hasToken: boolean;
  /** Where a charge may start (metres). */
  range: number;
  /** It is on its feet: a legless Darter crawls and bites, it cannot charge. */
  canCharge: boolean;
}

/**
 * May it start a charge this step? Only from approach, with the token, in
 * range, in sight, on its feet. The line itself is locked by the Foamer at
 * the end of the telegraph, at the player's position then.
 */
export function decideCharge(state: ChargerState, input: ChargeInput): boolean {
  if (state !== "approach") return false;
  if (!input.canCharge || !input.hasToken) return false;
  return input.lineOfSight && input.distance <= input.range;
}

/** How long a charge runs for: its longest straight line, or the time to
 *  reach the player, whichever is shorter, and never less than a nudge, so
 *  a charge that starts on the player still reads. */
export function chargeSeconds(metres: number, distance: number, speed: number): number {
  if (speed <= 0) return 0;
  return Math.max(0.05, Math.min(metres / speed, distance / speed));
}

/** The states the charger brain runs: the F01 four plus its own three. */
export function makeChargerBrain(
  initial: ChargerState = "idle",
  logSize = 8,
): Brain<ChargerState, F02Context> {
  const hooks: BrainHooks<ChargerState, F02Context> = {
    idle: { update: (_dt, t, ctx) => step("idle", t, ctx) },
    alert: { update: (_dt, t, ctx) => step("alert", t, ctx) },
    approach: { update: (_dt, t, ctx) => step("approach", t, ctx) },
    hold: { update: (_dt, t, ctx) => step("hold", t, ctx) },
    // The three charger states run on the Foamer's own clock and end on the
    // events it sees (the telegraph's time, the wall, the contact), so the
    // brain only stands in them.
    telegraph: {},
    charge: {},
    wallStun: {},
  };
  return new Brain(initial, hooks, logSize);
}

/** One step of the F01 logic for the charger's shared states: idle, alert
 *  and hold are F01's; approach keeps walking in while it holds the token
 *  (a Darter with a token means to charge, not to stand in bite range). */
function step(state: F01State, stateTime: number, ctx: F02Context): ChargerState {
  const d = ctx.decision;
  d.state = state;
  d.move = "stand";
  d.wantsToken = false;
  const input: F01Input = ctx.input;
  switch (state) {
    case "idle": {
      const sees = input.distance <= BRAIN.sightRangeMetres && input.lineOfSight;
      d.state = sees || input.tookDamage || input.nearbyAlert ? "alert" : "idle";
      return d.state;
    }
    case "alert": {
      d.state = stateTime >= BRAIN.alertTimeSeconds ? "approach" : "alert";
      return d.state;
    }
    case "approach": {
      d.move = "followPath";
      if (input.hasToken) return "approach";
      if (input.distance <= input.holdRange) {
        d.state = "hold";
        d.move = circleSide(ctx.agentId);
        d.wantsToken = true;
      }
      return d.state;
    }
    case "hold": {
      d.wantsToken = true;
      d.move = circleSide(ctx.agentId);
      if (input.hasToken || input.distance > input.holdRange + BRAIN.holdExitMarginMetres) {
        d.state = "approach";
        d.wantsToken = !input.hasToken;
        d.move = "followPath";
      }
      return d.state;
    }
  }
}
