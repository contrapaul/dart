import { describe, expect, it } from "vitest";
import pitJson from "../../data/levels/1-1-pit.json";
import { ArenaRunner, type ArenaEvents } from "../../src/level/arena";
import type { Arena, DoorState, Level } from "../../src/level/format";

const arena = (pitJson as unknown as Level).arenas![0] as Arena;
const INSIDE = arena.trigger.pos;
const OUTSIDE: [number, number, number] = [0, 4, -20];
const DT = 1 / 60;

interface Recorded {
  doors: Map<string, DoorState>;
  locked: number;
  waves: { index: number; count: number }[];
  cleared: number;
  spawned: { foamer: string; rift: string }[];
}

function makeRunner(opts: { cap?: number } = {}) {
  const rec: Recorded = {
    doors: new Map(arena.doors.map((d) => [d.id, d.state])),
    locked: 0, waves: [], cleared: 0, spawned: [],
  };
  let live = 0;
  const events: ArenaEvents = {
    setDoor(id, state) {
      rec.doors.set(id, state);
    },
    spawn(foamer, rift) {
      if (opts.cap !== undefined && live >= opts.cap) return false;
      live++;
      rec.spawned.push({ foamer, rift: rift.id });
      return true;
    },
    onLocked() {
      rec.locked++;
    },
    onWaveStart(_wave, index, count) {
      rec.waves.push({ index, count });
    },
    onCleared() {
      rec.cleared++;
    },
  };
  return { runner: new ArenaRunner(arena, events), rec, live: () => live };
}

/** Steps until `done`, or fails after a minute of game time. */
function run(runner: ArenaRunner, live: () => number, done: () => boolean, pos = INSIDE) {
  for (let i = 0; i < 60 / DT; i++) {
    runner.update(DT, { playerPos: pos, aliveCount: live() });
    if (done()) return;
  }
  throw new Error("the arena did not reach the wanted state");
}

/** Steps a fixed number of frames, then returns. */
function step(runner: ArenaRunner, live: () => number, frames: number, pos = INSIDE) {
  for (let i = 0; i < frames; i++) runner.update(DT, { playerPos: pos, aliveCount: live() });
}

describe("the arena state machine", () => {
  it("starts waiting with the file's door states", () => {
    const { runner, rec } = makeRunner();
    expect(runner.state.phase).toBe("waiting");
    expect(rec.doors.get("pit-in")).toBe("open");
    expect(rec.doors.get("pit-out")).toBe("locked");
  });

  it("stays waiting while the player is outside the trigger", () => {
    const { runner, rec, live } = makeRunner();
    step(runner, live, 600, OUTSIDE);
    void live;
    expect(runner.state.phase).toBe("waiting");
    expect(rec.locked).toBe(0);
  });

  it("locks the doors when the player steps into the trigger", () => {
    const { runner, rec } = makeRunner();
    runner.update(DT, { playerPos: INSIDE, aliveCount: 0 });
    expect(runner.state.phase).toBe("locked");
    expect(rec.locked).toBe(1);
    expect([...rec.doors.values()].every((s) => s === "locked")).toBe(true);
  });

  it("waits out the first wave's delay, then spawns wave 1 at its rifts", () => {
    const { runner, rec, live } = makeRunner();
    run(runner, live, () => runner.state.phase === "wave");
    expect(rec.waves).toEqual([{ index: 0, count: 3 }]);
    run(runner, live, () => rec.spawned.length === 3);
    expect(rec.spawned.map((s) => s.foamer)).toEqual(["F01", "F01", "F01"]);
    // Two rifts, round robin.
    expect(new Set(rec.spawned.map((s) => s.rift))).toEqual(new Set(["pit-r1", "pit-r2"]));
  });

  it("spaces spawns by holdSeconds", () => {
    const { runner, rec, live } = makeRunner();
    run(runner, live, () => runner.state.phase === "wave");
    const times: number[] = [];
    let t = 0;
    let seen = 0;
    for (let i = 0; i < 300 && seen < 3; i++) {
      runner.update(DT, { playerPos: INSIDE, aliveCount: live() });
      t += DT;
      if (rec.spawned.length > seen) {
        seen = rec.spawned.length;
        times.push(t);
      }
    }
    // 1.5 s apart (the file's holdSeconds), give or take a frame.
    expect(times[1] - times[0]).toBeCloseTo(arena.waves[0].holdSeconds!, 1);
    expect(times[2] - times[1]).toBeCloseTo(arena.waves[0].holdSeconds!, 1);
  });

  it("waits for the wave to be cleared before starting the next", () => {
    const { runner, rec, live } = makeRunner();
    run(runner, live, () => runner.state.phase === "wave" && rec.spawned.length === 3);
    step(runner, live, 1200);
    expect(rec.waves.length).toBe(1);
    expect(runner.state.waveIndex).toBe(0);
  });

  it("runs both waves and clears the arena, opening the exit", () => {
    const { runner, rec, live } = makeRunner();
    run(runner, live, () => runner.state.phase === "wave" && rec.spawned.length === 3);
    // Wave 1 is down: three alive Foamers to zero. A fake count does this.
    const zero = () => 0;
    run(runner, zero, () => runner.state.phase === "wave" && runner.state.waveIndex === 1);
    expect(rec.waves).toEqual([{ index: 0, count: 3 }, { index: 1, count: 5 }]);
    run(runner, zero, () => rec.spawned.length === 8);
    run(runner, zero, () => runner.state.phase === "cleared");
    expect(rec.cleared).toBe(1);
    expect(rec.doors.get("pit-out")).toBe("open");
    expect(runner.state.progress).toBe(1);
  });

  it("counts a wave as cleared only after its last spawn lands", () => {
    const { runner, rec, live } = makeRunner();
    run(runner, live, () => runner.state.phase === "wave");
    // Alive is zero throughout (a page that has not spawned yet), yet the
    // wave must not be counted out before its spawns are issued.
    runner.update(DT, { playerPos: INSIDE, aliveCount: 0 });
    expect(runner.state.waveIndex).toBe(0);
    run(runner, live, () => rec.spawned.length === 3);
    // And the grace stops the first pop from ending the wave.
    const zero = () => 0;
    runner.update(DT, { playerPos: INSIDE, aliveCount: 0 });
    expect(runner.state.waveIndex).toBe(0);
    void zero;
  });

  it("retries a spawn the page refused at its cap", () => {
    const { runner, rec, live } = makeRunner({ cap: 2 });
    run(runner, live, () => runner.state.phase === "wave");
    step(runner, live, 180);
    expect(rec.spawned.length).toBe(2);
    expect(runner.state.phase).toBe("wave");
  });

  it("resets to waiting mid-wave, doors back to the file's states", () => {
    const { runner, rec, live } = makeRunner();
    run(runner, live, () => runner.state.phase === "wave" && rec.spawned.length === 3);
    runner.reset();
    expect(runner.state.phase).toBe("waiting");
    expect(rec.doors.get("pit-in")).toBe("open");
    expect(rec.doors.get("pit-out")).toBe("locked");
    // And the lock happens again from scratch.
    const again = makeRunner();
    run(runner, live, () => runner.state.phase === "locked");
    expect(again.runner.state.phase).toBe("waiting");
    expect(rec.locked).toBe(2);
  });

  it("does not fire onLocked twice while locked", () => {
    const { runner, rec, live } = makeRunner();
    run(runner, live, () => runner.state.phase === "locked");
    step(runner, live, 600);
    expect(rec.locked).toBe(1);
  });

  it("leaves a sealed door sealed", () => {
    const sealed: Arena = structuredClone(arena);
    sealed.doors.push({ id: "vault", pos: [0, 6, 5], size: [2, 2, 2], state: "sealed" });
    const doors = new Map<string, DoorState>();
    const runner = new ArenaRunner(sealed, {
      setDoor: (id, state) => doors.set(id, state),
      spawn: () => true,
      onLocked() {}, onWaveStart() {}, onCleared() {},
    });
    runner.update(DT, { playerPos: INSIDE, aliveCount: 0 });
    expect(doors.get("vault")).toBe("sealed");
  });
});

// LVL-04b: the Ring's second wave arrives at half the pair's health instead
// of at the arena's last kill, so a fight that is going well goes faster.
describe("a wave that starts on the health left", () => {
  /** A two wave arena: wave 1 is one Foamer, wave 2 has no delay and only a
   *  health share, so it can only come from the share. */
  function arenaOnHealth(share?: number): Arena {
    const a = structuredClone(arena);
    a.waves = [
      { id: "w1", rifts: ["pit-r1"], spawns: [{ foamer: "F01", count: 1 }], delaySeconds: 0 },
      {
        id: "w2", rifts: ["pit-r2"], spawns: [{ foamer: "F03", count: 2 }], delaySeconds: 0,
        startsWithHealthShare: share,
      },
    ];
    return a;
  }

  function make(a: Arena) {
    let live = 0;
    let health = 0;
    const waves: number[] = [];
    const spawned: string[] = [];
    const runner = new ArenaRunner(a, {
      setDoor() {},
      spawn(foamer) { live++; spawned.push(foamer); return true; },
      onLocked() {}, onCleared() {}, onWaveStart(_w, index) { waves.push(index); },
    });
    const step = (frames: number) => {
      for (let i = 0; i < frames; i++) runner.update(DT, { playerPos: INSIDE, aliveCount: live, aliveHealth: health });
    };
    return { runner, waves, spawned, step, set: (l: number, h: number) => { live = l; health = h; } };
  }

  it("starts the next wave when the living Foamers hold the share", () => {
    const t = make(arenaOnHealth(0.5));
    // Wave 1's single Foamer is up at its full health.
    t.set(1, 30);
    t.step(10);
    expect(t.waves).toEqual([0]);
    // Hurt but above half: no adds yet.
    t.set(1, 20);
    t.step(10);
    expect(t.waves).toEqual([0]);
    // At half: the adds arrive with wave 1's Foamer still standing.
    t.set(1, 15);
    t.step(10);
    expect(t.waves).toEqual([0, 1]);
    expect(t.spawned.filter((f) => f === "F03")).toHaveLength(2);
  });

  it("still starts it on the last kill, and never asks for health when the share is absent", () => {
    // No share: the old rule, only when the arena empties.
    const plain = make(arenaOnHealth(undefined));
    plain.set(1, 1);
    plain.step(30);
    expect(plain.waves).toEqual([0]);
    plain.set(0, 0);
    plain.step(30);
    expect(plain.waves).toEqual([0, 1]);
    // With a share but the wave killed outright, the clear path still runs.
    const killed = make(arenaOnHealth(0.5));
    killed.set(1, 30);
    killed.step(10);
    killed.set(0, 0);
    killed.step(30);
    expect(killed.waves).toEqual([0, 1]);
  });

  it("does not fire twice, and a page that reports no health never fires it", () => {
    const t = make(arenaOnHealth(0.5));
    // The pair stands at its full 30, then drops to 10 (a third).
    t.set(2, 30);
    t.step(10);
    t.set(2, 10);
    t.step(60);
    expect(t.waves).toEqual([0, 1]);
    // A page that leaves aliveHealth out: Infinity, so the share is never met.
    const noHealth = new ArenaRunner(arenaOnHealth(0.5), {
      setDoor() {}, spawn() { return true; }, onLocked() {}, onCleared() {}, onWaveStart() {},
    });
    for (let i = 0; i < 60; i++) noHealth.update(DT, { playerPos: INSIDE, aliveCount: 2 });
    expect(noHealth.state.waveIndex).toBe(0);
  });
});
