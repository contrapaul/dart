import { ARENA_LEVELS } from "../../src/arena/levels";
// ED-07c: the arena to triggers converter. The Ring (one wave) converts
// to parts that pass the validator; the Pit (two waves) runs end to end
// through the real TriggerRunner with a fake host (enter, wave 1 after
// its delay, kill all, wave 2 after its delay, kill all, the unlock
// doors open). The hall from 1-3 (noLock and escape) checks the doors
// stay shut nothing and the escape warning.

import { describe, expect, it } from "vitest";
import ringJson from "../../data/levels/1-4-ring.json";
import pitJson from "../../data/levels/1-1-pit.json";
import hallJson from "../../data/levels/1-3.json";
import { arenaToTriggers } from "../../src/level/arena-to-triggers";
import { validateLevel } from "../../src/level/validate";
import { TriggerRunner, type TriggerHost } from "../../src/level/triggers";
import type { Level, Vec3 } from "../../src/level/format";

const ring = ringJson as unknown as Level;
const pit = pitJson as unknown as Level;
const hallLevel = hallJson as unknown as Level;

interface HostCall {
  fn: string;
  args: unknown[];
}

function fakeHost(): { host: TriggerHost; calls: HostCall[] } {
  const calls: HostCall[] = [];
  const host: TriggerHost = {
    spawnOne(foamer, at, tag, promoted) {
      calls.push({ fn: "spawnOne", args: [foamer, at, tag, promoted] });
    },
    wake(ids) { calls.push({ fn: "wake", args: [ids] }); },
    show(ids) { calls.push({ fn: "show", args: [ids] }); },
    hide(ids) { calls.push({ fn: "hide", args: [ids] }); },
    open(door) { calls.push({ fn: "open", args: [door] }); },
    close(door) { calls.push({ fn: "close", args: [door] }); },
    message(text, seconds) { calls.push({ fn: "message", args: [text, seconds] }); },
    checkpoint(pos, yaw) { calls.push({ fn: "checkpoint", args: [pos, yaw] }); },
  };
  return { host, calls };
}

describe("the Ring converts (single wave)", () => {
  const { level, warnings } = arenaToTriggers(ring);

  it("no arenas left, no warnings, and the level passes the validator", () => {
    expect(level.arenas).toEqual([]);
    expect(warnings).toEqual([]);
    expect(validateLevel(level).errors).toEqual([]);
  });

  it("one zone, the two doors, the two rifts as spawn points", () => {
    expect(level.zones).toEqual([
      { id: "ring-zone", pos: [0, 2, 6], size: [24, 4, 8] },
    ]);
    expect(level.doors?.map((d) => [d.id, d.lock])).toEqual([
      ["ring-in", "none"],
      ["ring-out", "trigger"],
    ]);
    expect(level.spawnPoints).toEqual([
      { id: "ring-r1", pos: [-11, 0.2, -6], facing: [0, 1, 0] },
      { id: "ring-r2", pos: [11, 0.2, -6], facing: [0, 1, 0] },
    ]);
  });

  it("three triggers: wave 1 waits on the lock, clear opens the doors, the lock has the checkpoint and the close", () => {
    const byId = new Map((level.triggers ?? []).map((t) => [t.id, t]));
    expect([...byId.keys()].sort()).toEqual(["ring-clear", "ring-lock", "ring-w1-after"]);

    const lock = byId.get("ring-lock")!;
    expect(lock.when).toEqual({ kind: "enter", zone: "ring-zone" });
    // Checkpoint first, then the door that started open. No spawn in the
    // lock: wave 1's delay is above 0, so the after does it.
    expect(lock.do).toEqual([
      { kind: "checkpoint", pos: [-6, 0, 12.6], yaw: 0 },
      { kind: "close", door: "ring-in" },
    ]);

    const after = byId.get("ring-w1-after")!;
    expect(after.when).toEqual({ kind: "after", trigger: "ring-lock", seconds: 1.5 });
    expect(after.do).toEqual([
      { kind: "spawn", id: "ring-w1-0", foamer: "F05", count: 2,
        at: ["ring-r1", "ring-r2"], holdSeconds: 2 },
    ]);

    const clear = byId.get("ring-clear")!;
    expect(clear.when).toEqual({ kind: "killed", ids: ["ring-w1-0"] });
    expect(clear.do).toEqual([
      { kind: "open", door: "ring-out" },
      { kind: "open", door: "ring-in" },
    ]);
  });
});

describe("the Pit runs end to end (two waves)", () => {
  const IN: Vec3 = [0, 1, -6]; // inside the pit's trigger box
  const OUT: Vec3 = [0, 1, 10];

  it("converting keeps the input unchanged", () => {
    const before = JSON.stringify(pit);
    arenaToTriggers(pit);
    expect(JSON.stringify(pit)).toBe(before);
  });

  it("enter, wave 1 after 1.5 s staggered 1.5 s, kill all, wave 2 after 6 s, kill all, doors open", () => {
    const { level, warnings } = arenaToTriggers(pit);
    expect(warnings).toEqual([]);
    expect(validateLevel(level).errors).toEqual([]);

    const { host, calls } = fakeHost();
    const runner = new TriggerRunner(level, host);
    runner.start();
    expect(calls.length).toBe(0); // nothing runs before the entry

    runner.update(1 / 60, OUT); // still outside
    expect(calls.length).toBe(0);

    runner.update(1 / 60, IN); // enters: the lock fires
    expect(calls).toEqual([
      { fn: "checkpoint", args: [[0, 4, -11], 0] },
      { fn: "close", args: ["pit-in"] },
    ]);

    runner.update(1.4, IN); // 1.4 s: wave 1 is not due yet (1.5)
    expect(calls.length).toBe(2);

    runner.update(0.2, IN); // 1.6 s: wave 1 arms, first of three
    expect(calls.at(-1)?.args).toEqual(["F01", "pit-r1", "pit-w1-0", false]);
    // The hold spreads the three over 1.5 s each.
    runner.update(1.5, IN);
    expect(calls.at(-1)?.args).toEqual(["F01", "pit-r2", "pit-w1-0", false]);
    runner.update(1.5, IN);
    expect(calls.at(-1)?.args).toEqual(["F01", "pit-r1", "pit-w1-0", false]); // round robin, back to r1
    expect(calls.filter((c) => c.fn === "spawnOne").length).toBe(3);

    runner.killed("pit-w1-0");
    runner.killed("pit-w1-0");
    runner.update(1 / 60, IN); // two of three: wave 2 is not due
    expect(calls.filter((c) => c.fn === "spawnOne").length).toBe(3);

    runner.killed("pit-w1-0");
    runner.update(1 / 60, IN); // all three: wave 2's timer starts, nothing shows
    expect(calls.some((c) => c.fn === "message")).toBe(false);
    expect(calls.filter((c) => c.fn === "spawnOne").length).toBe(3);

    runner.update(1.0, IN); // 1 s in: not there yet (6)
    expect(calls.filter((c) => c.fn === "spawnOne").length).toBe(3);

    runner.update(5.1, IN); // past 6 s: wave 2 arms, two round robin
    expect(calls.at(-2)?.args).toEqual(["F01", "pit-r1", "pit-w2-0", false]);
    expect(calls.at(-1)?.args).toEqual(["F02", "pit-r1", "pit-w2-1", false]);

    runner.killed("pit-w2-0");
    runner.killed("pit-w2-1");
    runner.update(1.3, IN); // past the 1.2 s hold: the second pair
    expect(calls.at(-2)?.args).toEqual(["F01", "pit-r2", "pit-w2-0", false]);
    expect(calls.at(-1)?.args).toEqual(["F02", "pit-r2", "pit-w2-1", false]);

    runner.killed("pit-w2-0");
    runner.killed("pit-w2-1");
    runner.update(1.3, IN); // the last Slowmer; the Snappers are done
    expect(calls.at(-1)?.args).toEqual(["F01", "pit-r3", "pit-w2-0", false]);

    runner.killed("pit-w2-0");
    runner.update(1 / 60, IN); // all five down: the unlock doors open
    expect(calls.at(-2)).toEqual({ fn: "open", args: ["pit-out"] });
    expect(calls.at(-1)).toEqual({ fn: "open", args: ["pit-in"] });

    runner.update(5, IN); // nothing else happens
    expect(calls.at(-1)).toEqual({ fn: "open", args: ["pit-in"] });
  });
});

describe("noLock and escape (the hall, from 1-3)", () => {
  it("closes nothing, drops the wave 1 delay, warns about the escape, and the level still validates", () => {
    const { level, warnings } = arenaToTriggers(hallLevel);
    const hall = (hallLevel.arenas ?? []).find((a) => a.id === "hall")!;
    expect(hall.noLock).toBe(true);
    expect(hall.escape).toBeDefined();

    expect(warnings.join("\n")).toMatch(/arena hall: escape is not converted/);
    expect(validateLevel(level).errors).toEqual([]);

    const lock = (level.triggers ?? []).find((t) => t.id === "hall-lock")!;
    // The hall's door is open on entry and noLock says shut nothing: no
    // close in the lock, and wave 1 (a 0.5 s delay, dropped) runs in it.
    expect(lock.do.some((d) => d.kind === "close")).toBe(false);
    expect(lock.do.some((d) => d.kind === "spawn" && (d as { id?: string }).id === "hall-w1-0")).toBe(true);
    expect(warnings.join("\n")).toMatch(/noLock drops wave hall-w1 delay of 0\.5/);
  });
});

describe("ED-07c review: every built-in level converts", () => {
  it("and the result passes the validator", () => {
    for (const [name, level] of Object.entries(ARENA_LEVELS)) {
      const { level: out } = arenaToTriggers(level);
      expect(validateLevel(out).errors, name).toEqual([]);
    }
  });
});
