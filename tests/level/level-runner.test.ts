import { describe, expect, it } from "vitest";
import pitJson from "../../data/levels/1-1-pit.json";
import { LevelRunner, type LevelEvents } from "../../src/level/level-runner";
import type { Arena, DoorState, Level } from "../../src/level/format";

// LVL-02b: a level's arenas play in file order. Two arenas come from the
// Pit's own arena, second copied and renamed and moved 60 m north so its
// trigger does not overlap the first.

const pitArena = (pitJson as unknown as Level).arenas![0] as Arena;

function twoArenas(): Arena[] {
  const second = structuredClone(pitArena);
  second.id = "pit-2";
  second.trigger = { pos: [0, 2, 54], size: [20, 4, 6] };
  second.checkpointPos = [0, 4, 49];
  for (const door of second.doors) {
    door.id = door.id.replace("pit-", "p2-");
    door.pos = [door.pos[0], door.pos[1], door.pos[2] + 60];
  }
  for (const rift of second.rifts) {
    rift.id = rift.id.replace("pit-", "p2-");
    rift.pos = [rift.pos[0], rift.pos[1], rift.pos[2] + 60];
  }
  for (const wave of second.waves) {
    wave.id = wave.id.replace("pit-", "p2-");
    wave.rifts = wave.rifts.map((r) => r.replace("pit-", "p2-"));
  }
  second.unlockOnClear = second.unlockOnClear.map((d) => d.replace("pit-", "p2-"));
  return [pitArena, second];
}

const IN_1: [number, number, number] = pitArena.trigger.pos;
const IN_2: [number, number, number] = [0, 2, 54];
const START: [number, number, number] = [0, 4, -29];
const DT = 1 / 60;

interface Recorded {
  doors: Map<string, DoorState>;
  started: number[];
  levelCleared: number;
  spawned: string[];
}

function makeRunner(arenas: Arena[], opts: { alive?: () => number } = {}) {
  const rec: Recorded = {
    doors: new Map(),
    started: [],
    levelCleared: 0,
    spawned: [],
  };
  for (const arena of arenas) for (const door of arena.doors) rec.doors.set(door.id, door.state);
  const events: LevelEvents = {
    setDoor(id, state) {
      rec.doors.set(id, state);
    },
    spawn(foamer) {
      rec.spawned.push(foamer);
      return true;
    },
    onLocked() {},
    onWaveStart() {},
    onCleared() {
      // Which arena just cleared: the runner's current index reads it after.
    },
    onArenaStart(arena, index) {
      rec.started.push(index);
      void arena;
    },
    onLevelCleared() {
      rec.levelCleared++;
    },
  };
  const runner = new LevelRunner(arenas, events);
  const alive = opts.alive ?? (() => 0);
  return { runner, rec, alive };
}

/** Steps until `done`, or fails after two minutes of game time. */
function run(runner: LevelRunner, alive: () => number, done: () => boolean, pos: [number, number, number]) {
  for (let i = 0; i < 120 / DT; i++) {
    runner.update(DT, { playerPos: pos, aliveCount: alive() });
    if (done()) return;
  }
  throw new Error("the level did not reach the wanted state");
}

/** Steps a fixed number of frames. */
function step(runner: LevelRunner, alive: () => number, frames: number, pos: [number, number, number]) {
  for (let i = 0; i < frames; i++) runner.update(DT, { playerPos: pos, aliveCount: alive() });
}

describe("the level runner plays arenas in order", () => {
  it("starts at arena 0 in the file's door states", () => {
    const arenas = twoArenas();
    const { runner, rec } = makeRunner(arenas);
    expect(runner.state.arenaIndex).toBe(0);
    expect(runner.state.arenaId).toBe("pit");
    expect(runner.state.phase).toBe("waiting");
    expect(rec.started).toEqual([0]);
    expect(rec.doors.get("pit-out")).toBe("locked");
    expect(rec.doors.get("p2-out")).toBe("locked");
  });

  it("a two-arena level plays both in order and completes", () => {
    const arenas = twoArenas();
    const { runner, rec, alive } = makeRunner(arenas);
    run(runner, alive, () => runner.state.arenasCleared === 1, IN_1);
    expect(runner.state.arenaIndex).toBe(1);
    expect(runner.state.arenaId).toBe("pit-2");
    expect(runner.state.phase).toBe("waiting");
    expect(rec.doors.get("pit-out")).toBe("open");
    // The second arena has not locked yet even though its trigger is right
    // there: it locks when the player steps into it after the first cleared.
    run(runner, alive, () => runner.state.phase === "wave", IN_2);
    expect(runner.state.arena.waveIndex).toBe(0);
    run(runner, alive, () => runner.state.phase === "complete", IN_2);
    expect(rec.levelCleared).toBe(1);
    expect(runner.state.arenaIndex).toBe(1);
    expect(runner.state.progress).toBe(1);
    expect(rec.started).toEqual([0, 1]);
  });

  it("the second arena's trigger does nothing while the first is fighting", () => {
    const arenas = twoArenas();
    const { runner, rec, alive } = makeRunner(arenas);
    // Stand in arena 2's trigger the whole time: arena 1 never locks.
    step(runner, alive, 600, IN_2);
    expect(runner.state.arenaIndex).toBe(0);
    expect(runner.state.phase).toBe("waiting");
    expect(rec.spawned.length).toBe(0);
  });

  it("Try again in arena 2 keeps arena 1 cleared", () => {
    const arenas = twoArenas();
    const { runner, rec, alive } = makeRunner(arenas);
    run(runner, alive, () => runner.state.arenaIndex === 1, IN_1);
    run(runner, alive, () => runner.state.phase === "wave", IN_2);
    runner.resetCurrent();
    expect(runner.state.arenaIndex).toBe(1);
    expect(runner.state.arenasCleared).toBe(1);
    expect(runner.state.phase).toBe("waiting");
    // Arena 1's doors stay open, arena 2's are back to the file's states.
    expect(rec.doors.get("pit-out")).toBe("open");
    expect(rec.doors.get("p2-out")).toBe("locked");
    // And arena 2 locks again from its own trigger.
    run(runner, alive, () => runner.state.phase === "wave", IN_2);
    expect(runner.state.arena.waveIndex).toBe(0);
    expect(rec.started).toEqual([0, 1]);
  });

  it("resetAll puts every arena back to waiting", () => {
    const arenas = twoArenas();
    const { runner, rec, alive } = makeRunner(arenas);
    run(runner, alive, () => runner.state.arenaIndex === 1, IN_1);
    runner.resetAll();
    expect(runner.state.arenaIndex).toBe(0);
    expect(runner.state.arenasCleared).toBe(0);
    expect(rec.doors.get("pit-out")).toBe("locked");
    expect(rec.started).toEqual([0, 1, 0]);
  });

  it("one arena levels play exactly as before", () => {
    const arenas = [structuredClone(pitArena)];
    const { runner, rec, alive } = makeRunner(arenas);
    expect(runner.state.arenaId).toBe("pit");
    step(runner, alive, 600, START);
    expect(runner.state.phase).toBe("waiting");
    run(runner, alive, () => rec.spawned.length === 3, IN_1);
    run(runner, alive, () => runner.state.phase === "complete", IN_1);
    expect(rec.levelCleared).toBe(1);
    expect(rec.doors.get("pit-out")).toBe("open");
  });
});
