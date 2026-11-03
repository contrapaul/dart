import aiData from "../../data/ai.json";

// The AI director (ENG-08 stage 1): attack tokens, so only a few Foamers
// attack at once and arenas stay intense but fair (PLAN.md 4.3). Pure
// TypeScript: no Three.js, no Rapier. Nothing is allocated per call: the
// agent tables are fixed-size arrays sized by data/ai.json maxAgents, and
// the token pools by the difficulty's counts.

/** A Foamer's attack data says which pool it draws from. */
export type TokenKind = "melee" | "ranged";

const KINDS: readonly TokenKind[] = ["melee", "ranged"];
/** Difficulty keys: story, normal, hard, fury. */
export type DifficultyKey = keyof typeof aiData.difficulties;
const DEFAULT: DifficultyKey = aiData.default as DifficultyKey;

const MAX = aiData.maxAgents;
/** Agent bids: no bid, waiting for a token, holding one. */
const FREE = 0;
const WAITING = 1;
const HOLDING = 2;

/** A snapshot for the range report and the tests. */
export interface DirectorStats {
  melee: { inUse: number; cap: number };
  ranged: { inUse: number; cap: number };
  waiting: number;
}

/**
 * Attack tokens by kind. One director per level.
 *
 * Agents ask every step while they want to attack: `request` records a bid
 * (and returns true if the agent already holds a token). Bids are resolved
 * in `update`, highest score first, so when tokens are short the best bid
 * wins rather than the first caller. Recent releases are withheld for
 * `tokenCooldown` seconds so attacks do not chain back to back.
 *
 * Agent ids must be integers in [0, maxAgents).
 */
export class Director {
  private readonly caps: number[] = [0, 0];
  private readonly cooldown = aiData.tokenCooldown;
  private now = 0;
  /** holder[kind][token]: the agent holding it, or -1. */
  private readonly holder: Int32Array[] = [];
  /** readyAt[kind][token]: when a free token joins the pool again. */
  private readonly readyAt: Float64Array[] = [];
  private readonly agentState = new Uint8Array(MAX);
  private readonly agentKind = new Uint8Array(MAX);
  private readonly agentScore = new Float64Array(MAX);
  /** agentToken[agent]: the token slot it holds. */
  private readonly agentToken = new Int32Array(MAX);

  constructor(difficulty: DifficultyKey = DEFAULT) {
    const counts = aiData.difficulties[difficulty];
    const cap = [counts.melee, counts.ranged];
    for (let k = 0; k < KINDS.length; k++) {
      this.caps[k] = cap[k];
      this.holder[k] = new Int32Array(cap[k]).fill(-1);
      this.readyAt[k] = new Float64Array(cap[k]);
    }
  }

  /**
   * Ask for a token of `kind`. True if the agent now holds one. While tokens
   * are short the request is a bid: the best bid wins the next free token in
   * `update`, so keep asking every step.
   */
  request(agentId: number, kind: TokenKind, score: number): boolean {
    if (!this.known(agentId)) return false;
    const k = KINDS.indexOf(kind);
    if (k < 0) return false;
    if (this.agentState[agentId] === HOLDING) return this.agentKind[agentId] === k;
    this.agentState[agentId] = WAITING;
    this.agentKind[agentId] = k;
    this.agentScore[agentId] = score;
    return false;
  }

  /** Give the token back. It rejoins the pool after `tokenCooldown`. */
  release(agentId: number): void {
    if (!this.known(agentId)) return;
    if (this.agentState[agentId] === HOLDING) this.free(agentId, this.now + this.cooldown);
    else this.agentState[agentId] = FREE;
  }

  /**
   * An agent died or despawned: drop its bid and free its token at once, with
   * no cooldown. The cooldown spaces out one agent's attacks; a gone agent is
   * not attacking, so the next Foamer in line should not wait for it.
   */
  forget(agentId: number): void {
    if (!this.known(agentId)) return;
    if (this.agentState[agentId] === HOLDING) this.free(agentId, this.now);
    this.agentState[agentId] = FREE;
  }

  /** Advance the cooldowns, then grant free tokens to the best bids. */
  update(dt: number): void {
    this.now += dt;
    for (let k = 0; k < KINDS.length; k++) {
      const held = this.holder[k]!;
      for (;;) {
        const token = this.freeToken(k);
        if (token < 0) break;
        const agent = this.bestBid(k);
        if (agent < 0) break;
        held[token] = agent;
        this.agentToken[agent] = token;
        this.agentState[agent] = HOLDING;
        this.agentKind[agent] = k;
      }
    }
  }

  stats(): DirectorStats {
    let waiting = 0;
    for (let a = 0; a < MAX; a++) if (this.agentState[a] === WAITING) waiting++;
    const inUse = (k: number): number => {
      const held = this.holder[k]!;
      let n = 0;
      for (let i = 0; i < held.length; i++) if (held[i]! >= 0) n++;
      return n;
    };
    return {
      melee: { inUse: inUse(0), cap: this.caps[0]! },
      ranged: { inUse: inUse(1), cap: this.caps[1]! },
      waiting,
    };
  }

  private known(agentId: number): boolean {
    return Number.isInteger(agentId) && agentId >= 0 && agentId < MAX;
  }

  /** Hand the token back and set the time it rejoins the pool. */
  private free(agentId: number, readyAt: number): void {
    const k = this.agentKind[agentId]!;
    this.holder[k]![this.agentToken[agentId]!] = -1;
    this.readyAt[k]![this.agentToken[agentId]!] = readyAt;
    this.agentState[agentId] = FREE;
  }

  /** The first token of `kind` that is home and out of cooldown, or -1. */
  private freeToken(k: number): number {
    const held = this.holder[k]!;
    const ready = this.readyAt[k]!;
    for (let i = 0; i < held.length; i++) if (held[i]! < 0 && ready[i]! <= this.now) return i;
    return -1;
  }

  /** The highest bid of `kind` (lowest id on a tie), or -1. */
  private bestBid(k: number): number {
    let best = -1;
    let bestScore = -Infinity;
    for (let a = 0; a < MAX; a++) {
      if (this.agentState[a] !== WAITING || this.agentKind[a] !== k) continue;
      const score = this.agentScore[a]!;
      if (best < 0 || score > bestScore) {
        best = a;
        bestScore = score;
      }
    }
    return best;
  }
}
