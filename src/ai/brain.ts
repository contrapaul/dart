// The small state machine that a Foamer brain sits on (ENG-08 stage 3).
// Pure TypeScript: no Three.js, no Rapier, no Foamer class. States are a
// string union given as a type parameter, each state may have enter,
// update and exit hooks, and every transition is written to a fixed-size
// ring so the tests (and the range report) can read the recent history.
// Nothing is allocated per step.

/** One state's hooks. `update` returns the state to go to, or null to stay.
 *  `stateTime` is already advanced for this step, so a hook that waits out a
 *  duration compares against it directly. */
export interface StateHooks<S extends string, C> {
  enter?: (ctx: C) => void;
  update?: (dt: number, stateTime: number, ctx: C) => S | null | undefined;
  exit?: (ctx: C) => void;
}

/** A hook table keyed by state. A state with no hooks simply stays put. */
export type BrainHooks<S extends string, C> = {
  [K in S]?: StateHooks<S, C>;
};

/** One recorded transition, oldest first. Allocating: for tests and tools. */
export interface Transition<S extends string> {
  from: S;
  to: S;
  /** The brain's clock when the transition happened (seconds). */
  time: number;
}

/**
 * A state machine over a string union. `C` is the context handed to the
 * hooks; the brain never looks inside it, so a caller can pass a per-step
 * input struct (or nothing at all).
 *
 * `stateTime` is the seconds spent in the current state, reset on every
 * transition, and `update` keeps it while the state stays the same. A state
 * that returns itself is not a transition and is not logged.
 */
export class Brain<S extends string, C = void> {
  state: S;
  stateTime = 0;
  /** How many transitions have happened in total (may exceed logSize). */
  transitions = 0;

  private readonly hooks: BrainHooks<S, C>;
  private readonly capacity: number;
  /** The ring: logFrom[i] is the state left, logTo[i] the one entered. */
  private readonly logFrom: S[];
  private readonly logTo: S[];
  private readonly logTime: Float64Array;
  private clock = 0;

  constructor(initial: S, hooks: BrainHooks<S, C>, logSize = 32) {
    this.state = initial;
    this.hooks = hooks;
    this.capacity = Math.max(1, Math.floor(logSize));
    this.logFrom = new Array<S>(this.capacity);
    this.logTo = new Array<S>(this.capacity);
    this.logTime = new Float64Array(this.capacity);
  }

  /** Run the current state's update and follow the transition it asks for. */
  update(dt: number, ctx: C): void {
    this.stateTime += dt;
    this.clock += dt;
    const next = this.hooks[this.state]?.update?.(dt, this.stateTime, ctx);
    if (next && next !== this.state) this.go(next, ctx);
  }

  /** Leave the current state and enter `next`. Same state: nothing happens. */
  go(next: S, ctx: C): void {
    if (next === this.state) return;
    const from = this.state;
    this.hooks[from]?.exit?.(ctx);
    this.record(from, next);
    this.state = next;
    this.stateTime = 0;
    this.hooks[next]?.enter?.(ctx);
  }

  /** How many entries the log holds right now, up to its capacity. */
  logLength(): number {
    return Math.min(this.transitions, this.capacity);
  }

  /** Transition `i` of the log, 0 being the oldest one still kept. */
  logAt(i: number): Transition<S> {
    const slot = this.slot(i);
    return { from: this.logFrom[slot]!, to: this.logTo[slot]!, time: this.logTime[slot]! };
  }

  /** The whole log, oldest first. Allocates: not for the game loop. */
  log(): Transition<S>[] {
    const out: Transition<S>[] = [];
    for (let i = 0; i < this.logLength(); i++) out.push(this.logAt(i));
    return out;
  }

  /** The states entered since the log began, oldest first (tests: no skip). */
  statesEntered(): S[] {
    const out: S[] = [];
    for (let i = 0; i < this.logLength(); i++) out.push(this.logTo[this.slot(i)]!);
    return out;
  }

  private slot(i: number): number {
    const oldest = this.transitions - this.logLength();
    return (oldest + i) % this.capacity;
  }

  private record(from: S, to: S): void {
    const slot = this.transitions % this.capacity;
    this.logFrom[slot] = from;
    this.logTo[slot] = to;
    this.logTime[slot] = this.clock;
    this.transitions++;
  }
}
