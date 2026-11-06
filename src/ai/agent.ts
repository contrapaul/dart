import type { Director, TokenKind } from "./director";
import type { Brain } from "./brain";
import type { ChargerState } from "./f05-brain";
import {
  BRAIN,
  makeF01Brain,
  makeF01Context,
  tokenScore,
  releaseToken,
  circleSide,
  type F01Decision,
  type F01State,
  type MoveIntent,
  type ReleaseReason,
} from "./f01-brain";
import { makeF02Brain, type F02Context } from "./f02-brain";
import { makeF03Brain } from "./f03-brain";
import { makeF04Brain } from "./f04-brain";
import { makeChargerBrain } from "./f05-brain";
import { makePath, NavGrid, type PathPoints, type Point2 } from "./nav-grid";

// One Foamer's brain on a director and a nav grid (ENG-08 stage 3b). The
// pure logic lives in f01-brain.ts; this class owns what is per agent: the
// brain, its context, the token bid and the path. The Foamer side feeds
// positions in and reads the movement intent and the waypoints back. No
// Three.js and no Rapier: the grid is passed as one argument.

/** How the agent's mind is set up: which pool it draws from, which brain it
 *  runs, and where it starts. Arena spawns start alert, range spawns idle. */
export interface AgentSetup {
  /** The token pool its attacks draw from (their data `token` field). */
  tokenKind: TokenKind;
  /** The state it starts in. */
  initial: F01State;
  /** GAME-10a: the ranged brain for a thrower, the F01 one otherwise.
   *  GAME-10b: "f05" is the charger (the F01 four states plus telegraph,
   *  charge and wallStun, which the Foamer system drives). GAME-10d: "f03"
   *  is the Swarmer, a hit and run biter on the swarm token pool.
   *  GAME-10e: "f04" is the Blocker, holding a slot in the shield wall. */
  brain?: "f01" | "f02" | "f03" | "f04" | "f05";
}

/** What the Foamer tells its agent each step. */
export interface AgentInput {
  /** The Foamer's feet, ground plane. */
  x: number;
  z: number;
  /** The Foamer's feet height (y), so its path starts on the floor it stands
   *  on and not the pit floor under the ring (BUG-01 round 2). */
  y: number;
  /** The player's feet, ground plane. */
  playerX: number;
  playerZ: number;
  /** The player's feet height (y), so a player on the ring is reachable. */
  playerY: number;
  /** The rig's attack range (metres). */
  attackRange: number;
  /** Nothing solid between it and the player. */
  lineOfSight: boolean;
  /** It took damage since the last step. */
  tookDamage: boolean;
  /** A Foamer inside alertRadius went alert since the last step. */
  nearbyAlert: boolean;
  /** Prone with its head in reach: a crawl wants a token like a hold does,
   *  though the brain's states do not cover it. */
  crawlInReach: boolean;
  /** It is in an attack (windup, strike, recover): keep the token it has,
   *  even though the brain no longer wants a new one. */
  keepToken: boolean;
  /** GAME-10a, the F02 brain only: the distance at which it stops walking in
   *  (its throw range). For a bonker this is `attackRange` itself. */
  throwRange: number;
  /** GAME-10a, the F02 brain only: the distance it tries to keep. */
  preferredDistance: number;
  /** GAME-10a, the F02 brain only: closer than this it backs off. */
  retreatDistance: number;
  /** The distance the circle stride keeps (metres): the bonker's hold ring,
   *  or the thrower's preferred distance. Filled by the system. */
  holdRange: number;
  /** GAME-10d, the F03 brain only: seconds since its last nibble landed
   *  (Infinity before the first). Low means it is on the ring, waiting. */
  sinceNibble: number;
  /** GAME-10e, the F04 brain only: the slot it holds in the shield wall,
   *  in the ground plane, and how far it is from it. The system works the
   *  slot out (it can see the other Blockers) and fills these in. */
  slotX?: number;
  slotZ?: number;
  slotDistance?: number;
  /** GAME-10e, the F04 brain only: its shield part has been shot away, so
   *  there is no wall and it keeps its distance instead. */
  shieldBroken?: boolean;
}

export class FoamerAgent {
  readonly agentId: number;
  /** Either brain: an F02 context is an F01 one plus the three ranged
   *  distances, which an F01 brain does not read, so one field serves both. */
  readonly brain: Brain<ChargerState, F02Context>;
  readonly ctx: F02Context;
  /** The path it follows, reused by every re-path: nothing allocates. */
  readonly path: PathPoints = makePath();
  /** Metres to the player, filled by bid(). */
  distance = Infinity;

  private readonly tokenKind: TokenKind;
  private readonly director: Director | null;
  /** Seconds spent asking for a token without one (feeds the bid). */
  private waited = 0;
  /** The brain wanted a token on its last step. */
  private wants = false;
  /** Two scratch points for navigate(), so a re-path allocates nothing. */
  private readonly from: Point2 = { x: 0, z: 0 };
  private readonly to: Point2 = { x: 0, z: 0 };
  /** Seconds until the next re-path. */
  private repathIn = 0;
  /** The grid version the current path was made on. */
  private pathVersion = -1;
  /** Where the path was aimed, so a player who barely moved is not
   *  re-pathed for nothing. */
  private goalX = NaN;
  private goalY = NaN;
  private goalZ = NaN;

  constructor(director: Director | null, setup: AgentSetup, agentId: number) {
    this.director = director;
    this.tokenKind = setup.tokenKind;
    this.agentId = agentId;
    // GAME-10e: the F04 context is an F02 one plus slot fields the system
    // fills only for a Blocker, so one field still holds every brain.
    this.brain = (setup.brain === "f02" ? makeF02Brain(setup.initial, 32)
      : setup.brain === "f04" ? makeF04Brain(setup.initial, 32)
        : setup.brain === "f03" ? makeF03Brain(setup.initial, 32)
          : setup.brain === "f05" ? makeChargerBrain(setup.initial, 32)
            : makeF01Brain(setup.initial, 32)) as Brain<ChargerState, F02Context>;
    this.ctx = makeF01Context(agentId) as F02Context;
  }

  get decision(): F01Decision {
    return this.ctx.decision;
  }
  get state(): ChargerState {
    return this.brain.state;
  }
  get move(): MoveIntent {
    return this.ctx.decision.move;
  }
  /** True while it holds an attack token. */
  get hasToken(): boolean {
    return this.ctx.input.hasToken;
  }
  /** The player was in line of sight on the last step. */
  lineOfSight(): boolean {
    return this.ctx.input.lineOfSight;
  }

  /**
   * Ask the director for a token. A bid, not a grant: every agent bids before
   * the director's own update, so the best bid wins the free tokens and the
   * Foamer reads the answer back on its next step. Only an agent that wants a
   * token bids: an idle or alert one, or an approaching one still short of the
   * hold ring, does not, so the tokens go to the Foamers in the fight.
   */
  bid(input: AgentInput): void {
    const i = this.ctx.input;
    this.distance = Math.hypot(input.playerX - input.x, input.playerZ - input.z);
    i.distance = this.distance;
    i.lineOfSight = input.lineOfSight;
    i.attackRange = input.attackRange;
    i.holdRange = input.holdRange;
    i.sinceNibble = input.sinceNibble;
    i.throwRange = input.throwRange;
    i.preferredDistance = input.preferredDistance;
    i.retreatDistance = input.retreatDistance;
    this.ask(input);
  }

  /** One step of the brain, after the director's update: it reads the token
   *  answer, advances `waited`, and leaves the decision in `ctx.decision`. */
  step(dt: number, input: AgentInput): void {
    const i = this.ctx.input;
    i.tookDamage = input.tookDamage;
    i.nearbyAlert = input.nearbyAlert;
    i.holdRange = input.holdRange;
    i.sinceNibble = input.sinceNibble;
    i.throwRange = input.throwRange;
    i.preferredDistance = input.preferredDistance;
    i.retreatDistance = input.retreatDistance;
    // GAME-10e: the F04 brain's own fields. Other brains never read them,
    // and the system leaves them undefined for anything but a Blocker.
    if (input.slotX !== undefined) {
      const i4 = i as typeof i & {
        slotX?: number; slotZ?: number; slotDistance?: number; shieldBroken?: boolean;
      };
      i4.slotX = input.slotX;
      i4.slotZ = input.slotZ;
      i4.slotDistance = input.slotDistance;
      i4.shieldBroken = input.shieldBroken;
    }
    this.brain.update(dt, this.ctx);
    this.ask(input);
    if (this.wants && !i.hasToken) this.waited += dt;
    else if (i.hasToken) this.waited = 0;
  }

  /**
   * Ask while the agent wants a token; otherwise let it go, which also clears
   * a stale bid (the director sets a waiting agent free at once). It wants
   * one when the brain says so (hold, or approach at the ring), when a crawl
   * is in reach, while it is in an attack (keepToken: the brain stops
   * flagging one the moment it holds it), and along an approach that already
   * holds one, which keeps the token it won on the walk in. Idle, alert and
   * an approach without a token do not bid: a Foamer far off must not win a
   * token and carry it the whole way while closer ones hold.
   */
  private ask(input: AgentInput): void {
    const i = this.ctx.input;
    this.wants = this.ctx.decision.wantsToken || input.crawlInReach ||
      input.keepToken || (this.state === "approach" && i.hasToken);
    if (!this.director) return;
    if (this.wants) {
      i.hasToken = this.director.request(
        this.agentId, this.tokenKind, tokenScore(this.distance, input.lineOfSight, this.waited),
      );
    } else {
      this.director.release(this.agentId);
      i.hasToken = false;
      this.waited = 0;
    }
  }

  /** Give the token back when it ends an attack, staggers, falls or goes
   *  down (down forgets it, see releaseToken). */
  release(reason: ReleaseReason): void {
    if (this.director) releaseToken(this.director, this.agentId, reason);
    this.ctx.input.hasToken = false;
    this.waited = 0;
  }

  /**
   * Re-path if the timer ran out, the grid re-baked, or the player moved.
   * Writes into `this.path` and returns it; its `count` is 0 when there is
   * no grid or no path this step.
   */
  navigate(dt: number, grid: NavGrid | null, input: AgentInput): PathPoints {
    if (!grid) {
      this.path.count = 0;
      return this.path;
    }
    this.repathIn -= dt;
    const moved = Math.hypot(input.playerX - this.goalX, input.playerZ - this.goalZ);
    const heightMoved = Math.abs(input.playerY - this.goalY);
    if (this.repathIn > 0 && grid.version === this.pathVersion && moved <= 0.5 &&
      heightMoved <= 0.5) {
      return this.path;
    }
    this.repathIn = BRAIN.repathSeconds;
    this.pathVersion = grid.version;
    this.goalX = input.playerX;
    this.goalY = input.playerY;
    this.goalZ = input.playerZ;
    this.from.x = input.x;
    this.from.z = input.z;
    this.to.x = input.playerX;
    this.to.z = input.playerZ;
    grid.findPath(this.from, this.to, this.path, input.y, input.playerY);
    return this.path;
  }

  /** Which way it sidles round the player without a token. From the agent
   *  id, so two Foamers do not mirror each other into the same gap. */
  circleSide(): MoveIntent {
    return circleSide(this.agentId);
  }
}
