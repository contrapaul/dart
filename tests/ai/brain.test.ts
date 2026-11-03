import { describe, expect, it } from "vitest";
import aiData from "../../data/ai.json";
import { Director } from "../../src/ai/director";
import {
  BRAIN,
  circleSide,
  decideF01,
  makeF01Brain,
  makeF01Context,
  releaseToken,
  tokenScore,
  type F01Context,
  type F01Decision,
  type F01State,
} from "../../src/ai/f01-brain";
import { Brain, type BrainHooks } from "../../src/ai/brain";

const DT = 1 / 60;
const ATTACK_RANGE = 1.3;
const ATTACK_TIME = 0.5;
const MELEE_CAP = aiData.difficulties.normal.melee;

/** A simulated F01 on a flat floor: the brain, its context and its clock. */
interface Agent {
  id: number;
  brain: Brain<F01State, F01Context>;
  ctx: F01Context;
  attacking: number;
  attacks: number;
  /** Seconds spent asking for a token without one (feeds the bid). */
  waited: number;
}

/** A context for a simulated F01, with its rig's attack range filled in. */
function ctxFor(id: number): F01Context {
  const ctx = makeF01Context(id);
  ctx.input.attackRange = ATTACK_RANGE;
  return ctx;
}

function makeAgent(id: number, state: F01State = "approach"): Agent {
  const ctx = ctxFor(id);
  return { id, brain: makeF01Brain(state, 64), ctx, attacking: 0, attacks: 0, waited: 0 };
}

/** One step of the simulated world: only the parts the tests need. */
function step(director: Director, agents: Agent[], dt: number, distance: number): void {
  for (const a of agents) {
    const i = a.ctx.input;
    i.distance = distance;
    i.lineOfSight = true;
    i.hasToken = director.request(a.id, "melee", tokenScore(distance, true, a.waited));
  }
  director.update(dt);
  for (const a of agents) {
    a.brain.update(dt, a.ctx);
    const want = a.ctx.decision.wantsToken;
    a.ctx.input.hasToken = director.request(a.id, "melee", tokenScore(distance, true, a.waited));
    if (want && !a.ctx.input.hasToken) a.waited += dt;
    else if (a.ctx.input.hasToken) a.waited = 0;
    if (a.attacking > 0) {
      a.attacking -= dt;
      if (a.attacking <= 0.0001) {
        releaseToken(director, a.id, "attackEnd");
        a.ctx.input.hasToken = false;
      }
    } else if (a.ctx.input.hasToken && a.ctx.decision.state === "approach") {
      // In reach with a token: it attacks.
      a.attacking = ATTACK_TIME;
      a.attacks++;
    }
  }
}

describe("brain state machine", () => {
  it("tracks state time, resets it on a transition and logs the change", () => {
    let stay = true;
    const b = new Brain<"a" | "b", void>(
      "a",
      { a: { update: () => (stay ? null : "b") }, b: { update: () => null } },
      8,
    );
    b.update(0.1, undefined);
    b.update(0.1, undefined);
    expect(b.state).toBe("a");
    expect(b.stateTime).toBeCloseTo(0.2, 6);
    stay = false;
    b.update(0.1, undefined);
    expect(b.state).toBe("b");
    expect(b.stateTime).toBeCloseTo(0, 6);
    b.update(0.2, undefined);
    expect(b.stateTime).toBeCloseTo(0.2, 6);
    expect(b.logLength()).toBe(1);
    expect(b.logAt(0).from).toBe("a");
    expect(b.logAt(0).to).toBe("b");
  });

  it("calls enter and exit, and never logs a state as its own transition", () => {
    const calls: string[] = [];
    const hooks: BrainHooks<"x" | "y", void> = {
      x: {
        enter: () => calls.push("enter x"),
        exit: () => calls.push("exit x"),
        update: () => "x",
      },
      y: { enter: () => calls.push("enter y") },
    };
    const b = new Brain<"x" | "y", void>("x", hooks, 4);
    b.update(DT, undefined);
    b.update(DT, undefined);
    expect(b.transitions).toBe(0);
    b.go("y", undefined);
    // go() does not enter the initial state, only leaves it.
    expect(calls).toEqual(["exit x", "enter y"]);
    b.go("y", undefined);
    expect(b.transitions).toBe(1);
  });

  it("keeps the log a fixed size, newest last", () => {
    const b = new Brain<"a" | "b" | "c", void>("a", {}, 2);
    b.go("b", undefined);
    b.go("c", undefined);
    b.go("a", undefined);
    expect(b.logLength()).toBe(2);
    expect(b.transitions).toBe(3);
    expect(b.log().map((t) => `${t.from}>${t.to}`)).toEqual(["b>c", "c>a"]);
  });
});

describe("F01 idle and alert", () => {
  it("stays idle out of sight, and alerts when shot", () => {
    const ctx = ctxFor(0);
    const out: F01Decision = { state: "idle", move: "stand", wantsToken: false };
    ctx.input.distance = BRAIN.sightRangeMetres + 5;
    ctx.input.lineOfSight = false;
    decideF01("idle", 1, ctx.input, 0, out);
    expect(out.state).toBe("idle");
    expect(out.move).toBe("stand");
    // Shot from behind: a hit is never out of sight.
    ctx.input.tookDamage = true;
    decideF01("idle", 1, ctx.input, 0, out);
    expect(out.state).toBe("alert");
  });

  it("alerts to a nearby Foamer, and at sightRange with line of sight", () => {
    const ctx = ctxFor(1);
    const out: F01Decision = { state: "idle", move: "stand", wantsToken: false };
    ctx.input.distance = 30;
    ctx.input.nearbyAlert = true;
    decideF01("idle", 1, ctx.input, 1, out);
    expect(out.state).toBe("alert");
    ctx.input.nearbyAlert = false;
    ctx.input.distance = BRAIN.sightRangeMetres - 0.1;
    ctx.input.lineOfSight = true;
    decideF01("idle", 1, ctx.input, 1, out);
    expect(out.state).toBe("alert");
    // Seen but not in sight: a wall between them keeps it idle.
    ctx.input.lineOfSight = false;
    decideF01("idle", 1, ctx.input, 1, out);
    expect(out.state).toBe("idle");
  });

  it("holds alert for the telegraph, then approaches", () => {
    const ctx = ctxFor(0);
    const out: F01Decision = { state: "alert", move: "stand", wantsToken: false };
    ctx.input.distance = 6;
    ctx.input.lineOfSight = true;
    decideF01("alert", BRAIN.alertTimeSeconds - 0.01, ctx.input, 0, out);
    expect(out.state).toBe("alert");
    expect(out.move).toBe("stand");
    decideF01("alert", BRAIN.alertTimeSeconds, ctx.input, 0, out);
    expect(out.state).toBe("approach");
  });

  it("logs alert as the only state an idle brain can enter", () => {
    // Drive a real brain at a player standing on top of it: the log must show
    // idle -> alert and nothing else out of idle.
    const ctx = ctxFor(0);
    ctx.input.distance = 0.5;
    ctx.input.lineOfSight = true;
    const brain = makeF01Brain("idle", 16);
    for (let s = 0; s < 60; s++) {
      ctx.input.hasToken = s > 30;
      brain.update(DT, ctx);
    }
    const fromIdle: F01State[] = [];
    for (let i = 0; i < brain.logLength(); i++) {
      const t = brain.logAt(i);
      if (t.from === "idle") fromIdle.push(t.to);
    }
    expect(fromIdle).toEqual(["alert"]);
  });

  it("never goes from idle straight to approach or hold", () => {
    // Close, seen and holding a token: still the alert telegraph first.
    const ctx = ctxFor(0);
    ctx.input.distance = 0.5;
    ctx.input.lineOfSight = true;
    ctx.input.hasToken = true;
    const out: F01Decision = { state: "idle", move: "stand", wantsToken: false };
    decideF01("idle", 10, ctx.input, 0, out);
    expect(out.state).toBe("alert");
  });
});

describe("F01 approach and hold", () => {
  it("follows a path while out of reach", () => {
    const ctx = ctxFor(0);
    ctx.input.distance = 10;
    ctx.input.lineOfSight = true;
    const out: F01Decision = { state: "approach", move: "stand", wantsToken: false };
    decideF01("approach", 1, ctx.input, 0, out);
    expect(out.move).toBe("followPath");
    expect(out.wantsToken).toBe(false);
  });

  it("asks for a token in reach, and holds and circles without one", () => {
    const ctx = ctxFor(0);
    ctx.input.distance = ATTACK_RANGE;
    ctx.input.lineOfSight = true;
    const out: F01Decision = { state: "approach", move: "stand", wantsToken: false };
    decideF01("approach", 1, ctx.input, 0, out);
    expect(out.wantsToken).toBe(true);
    expect(out.state).toBe("hold");
    expect(out.move).toBe("circleLeft");
    // Odd ids circle the other way, so two Foamers do not mirror.
    decideF01("approach", 1, ctx.input, 1, out);
    expect(out.move).toBe("circleRight");
  });

  it("holds at the player, asking each step, until it gets a token", () => {
    const ctx = ctxFor(2);
    ctx.input.distance = BRAIN.holdRangeMetres;
    ctx.input.lineOfSight = true;
    const out: F01Decision = { state: "hold", move: "stand", wantsToken: false };
    decideF01("hold", 1, ctx.input, 2, out);
    expect(out.state).toBe("hold");
    expect(out.wantsToken).toBe(true);
    expect(circleSide(2)).toBe("circleLeft");
    ctx.input.hasToken = true;
    decideF01("hold", 1, ctx.input, 2, out);
    expect(out.state).toBe("approach");
  });

  it("leaves hold when the player walks away", () => {
    const ctx = ctxFor(0);
    ctx.input.distance = BRAIN.holdRangeMetres + 1;
    const out: F01Decision = { state: "hold", move: "stand", wantsToken: false };
    decideF01("hold", 1, ctx.input, 0, out);
    expect(out.state).toBe("approach");
    expect(out.move).toBe("followPath");
  });
});

describe("F01 token bids", () => {
  it("scores a closer agent above a farther one", () => {
    expect(tokenScore(2, true, 0)).toBeGreaterThan(tokenScore(8, true, 0));
  });

  it("lets a waiting agent's rising score beat a static one", () => {
    // Far but patient: 4 s of waiting covers a 3 m head start.
    expect(tokenScore(6, false, 4)).toBeGreaterThan(tokenScore(3, true, 0));
  });

  it("releases on attack end but forgets on down", () => {
    const d = new Director("normal");
    d.request(0, "melee", 1);
    d.request(1, "melee", 0.5);
    d.update(DT);
    expect(d.stats().melee.inUse).toBe(2);
    releaseToken(d, 0, "down");
    expect(d.stats().melee.inUse).toBe(1);
    releaseToken(d, 1, "attackEnd");
    expect(d.stats().melee.inUse).toBe(0);
  });
});

describe("4 F01s at the player", () => {
  function run(seconds: number): { attacks: number; mostAtOnce: number; held: number } {
    const director = new Director("normal");
    const agents = [0, 1, 2, 3].map((id) => makeAgent(id));
    let mostAtOnce = 0;
    let heldSteps = 0;
    const steps = Math.round(seconds / DT);
    for (let s = 0; s < steps; s++) {
      step(director, agents, DT, ATTACK_RANGE - 0.2);
      let attacking = 0;
      let holding = 0;
      for (const a of agents) {
        if (a.attacking > 0) attacking++;
        if (a.ctx.decision.state === "hold") holding++;
      }
      if (attacking > mostAtOnce) mostAtOnce = attacking;
      if (holding > 0) heldSteps++;
      // The director's cap is the real gate: tokens in use never exceeds it.
      expect(director.stats().melee.inUse).toBeLessThanOrEqual(MELEE_CAP);
    }
    const attacks = agents.reduce((n, a) => n + a.attacks, 0);
    return { attacks, mostAtOnce, held: heldSteps };
  }

  it("never has more than the melee token count attacking at once over 10 s", () => {
    const r = run(10);
    expect(r.mostAtOnce).toBeLessThanOrEqual(MELEE_CAP);
    expect(r.attacks).toBeGreaterThan(0);
  });

  it("makes every Foamer attack at least once in 20 s", () => {
    const director = new Director("normal");
    const agents = [0, 1, 2, 3].map((id) => makeAgent(id));
    for (let s = 0; s < Math.round(20 / DT); s++) step(director, agents, DT, ATTACK_RANGE - 0.2);
    for (const a of agents) expect(a.attacks).toBeGreaterThanOrEqual(1);
  });
});
