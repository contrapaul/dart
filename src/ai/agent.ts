import type { Director, TokenKind } from "./director";
import type { Brain } from "./brain";
import {
  BRAIN,
  makeF01Brain,
  makeF01Context,
  tokenScore,
  releaseToken,
  circleSide,
  type F01Context,
  type F01Decision,
  type F01State,
  type MoveIntent,
  type ReleaseReason,
} from "./f01-brain";
import { makePath, NavGrid, type PathPoints, type Point2 } from "./nav-grid";

// One Foamer's brain on a director and a nav grid (ENG-08 stage 3b). The
// pure logic lives in f01-brain.ts; this class owns what is per agent: the
// brain, its context, the token bid and the path. The Foamer side feeds
// positions in and reads the movement intent and the waypoints back. No
// Three.js and no Rapier: the grid is passed as one argument.

/** How the agent's mind is set up: which pool it draws from and where it
 *  starts. Arena spawns start alert, range spawns idle. */
export interface AgentSetup {
  /** The token pool its attacks draw from (their data `token` field). */
  tokenKind: TokenKind;
  /** The state it starts in. */
  initial: F01State;
}

/** What the Foamer tells its agent each step. */
export interface AgentInput {
  /** The Foamer's feet, ground plane. */
  x: number;
  z: number;
  /** The player's feet, ground plane. */
  playerX: number;
  playerZ: number;
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
}

export class FoamerAgent {
  readonly agentId: number;
  readonly brain: Brain<F01State, F01Context>;
  readonly ctx: F01Context;
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
  private goalZ = NaN;

  constructor(director: Director | null, setup: AgentSetup, agentId: number) {
    this.director = director;
    this.tokenKind = setup.tokenKind;
    this.agentId = agentId;
    this.brain = makeF01Brain(setup.initial, 32);
    this.ctx = makeF01Context(agentId);
  }

  get decision(): F01Decision {
    return this.ctx.decision;
  }
  get state(): F01State {
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
    this.ask(input);
  }

  /** One step of the brain, after the director's update: it reads the token
   *  answer, advances `waited`, and leaves the decision in `ctx.decision`. */
  step(dt: number, input: AgentInput): void {
    const i = this.ctx.input;
    i.tookDamage = input.tookDamage;
    i.nearbyAlert = input.nearbyAlert;
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
   * flagging one the moment it holds it), and along an approach, which keeps
   * the token it won on the walk in. Idle, alert and a far approach do not.
   */
  private ask(input: AgentInput): void {
    const i = this.ctx.input;
    this.wants = this.ctx.decision.wantsToken || input.crawlInReach ||
      input.keepToken || this.state === "approach";
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
    if (this.repathIn > 0 && grid.version === this.pathVersion && moved <= 0.5) {
      return this.path;
    }
    this.repathIn = BRAIN.repathSeconds;
    this.pathVersion = grid.version;
    this.goalX = input.playerX;
    this.goalZ = input.playerZ;
    this.from.x = input.x;
    this.from.z = input.z;
    this.to.x = input.playerX;
    this.to.z = input.playerZ;
    grid.findPath(this.from, this.to, this.path);
    return this.path;
  }

  /** Which way it sidles round the player without a token. From the agent
   *  id, so two Foamers do not mirror each other into the same gap. */
  circleSide(): MoveIntent {
    return circleSide(this.agentId);
  }
}
