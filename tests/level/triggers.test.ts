// ED-07a: the trigger runner. A fake host records every call so a test can
// read the level's logic straight off it. Levels are small objects in the
// shape of src/level/format.ts, so the runner's handling of zones, kills,
// presses, after timers and resets runs against the real types.

import { describe, expect, it } from "vitest";
import { TriggerRunner, type TriggerHost } from "../../src/level/triggers";
import type { Level, Vec3, Zone } from "../../src/level/format";

interface HostCall {
  fn: string;
  args: unknown[];
}

/** A recording fake: the test reads what the runner did, in order. */
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

function level(partial: Partial<Level> = {}): Level {
  return {
    meta: { id: "t", name: "T", act: 0, targetSeconds: 0, accent: "#fff" },
    shell: [],
    playerStart: { pos: [0, 0, 0], yaw: 0 },
    exit: { pos: [0, 0, 10], size: [2, 1, 2] },
    ...partial,
  };
}

// The zone is a 4 by 6 by 4 box centred at [5, 1, 0]: inside means
// 3 <= x <= 7, 0 <= y <= 2, -2 <= z <= 2.
const ZONE: Zone = { id: "z", pos: [5, 1, 0], size: [4, 6, 4] };
const IN: Vec3 = [5, 1, 0];
const OUT: Vec3 = [0, 1, 0];

describe("TriggerRunner", () => {
  it("fires a `start` trigger once, its do list in order", () => {
    const lv = level({
      triggers: [
        {
          id: "s",
          when: { kind: "start" },
          do: [
            { kind: "message", text: "go" },
            { kind: "open", door: "d1" },
            { kind: "checkpoint", pos: [1, 2, 3], yaw: 0.5 },
          ],
        },
      ],
    });
    const { host, calls } = fakeHost();
    const r = new TriggerRunner(lv, host);
    r.start();
    r.update(1 / 60, OUT);
    expect(calls).toEqual([
      { fn: "message", args: ["go", 3] },
      { fn: "open", args: ["d1"] },
      { fn: "checkpoint", args: [[1, 2, 3], 0.5] },
    ]);
    r.update(1, OUT);
    expect(calls.length).toBe(3);
  });

  it("a zone trigger fires on the entry edge only, and a repeat one fires again after leaving", () => {
    const lv = level({
      zones: [ZONE],
      triggers: [
        { id: "a", when: { kind: "enter", zone: "z" }, do: [{ kind: "show", ids: ["w"] }] },
        { id: "b", when: { kind: "enter", zone: "z" }, repeat: true, do: [{ kind: "open", door: "d" }] },
      ],
    });
    const { host, calls } = fakeHost();
    const r = new TriggerRunner(lv, host);
    r.start();
    r.update(1 / 60, OUT);
    expect(calls.length).toBe(0);

    r.update(1 / 60, IN); // enters: both fire, once
    expect(calls.length).toBe(2);
    expect(calls[0]).toEqual({ fn: "show", args: [["w"]] });
    expect(calls[1]).toEqual({ fn: "open", args: ["d"] });

    r.update(1 / 60, IN); // still inside: nothing (both fired, a is done)
    expect(calls.length).toBe(2);

    r.update(1 / 60, OUT); // leaves
    r.update(1 / 60, IN); // comes back: only the repeat one fires again
    expect(calls.length).toBe(3);
    expect(calls[2]).toEqual({ fn: "open", args: ["d"] });
  });

  it("a spawn of 3 with a 1 second hold spawns at 0, 1 and 2 seconds, round robin", () => {
    const lv = level({
      spawnPoints: [
        { id: "r1", pos: [0, 0, 5], facing: [0, 1, 0] },
        { id: "r2", pos: [3, 0, 5], facing: [0, 1, 0] },
      ],
      triggers: [
        {
          id: "s", when: { kind: "start" },
          do: [{ kind: "spawn", id: "wave", foamer: "F01", count: 3,
                at: ["r1", "r2"], holdSeconds: 1 }],
        },
      ],
    });
    const { host, calls } = fakeHost();
    const r = new TriggerRunner(lv, host);
    r.start();
    // The first is at once, on `start`.
    expect(calls.map((c) => c.args)).toEqual([["F01", "r1", "wave", false]]);
    r.update(1, OUT); // clock to 1.0: the second
    expect(calls.length).toBe(2);
    expect(calls[1].args).toEqual(["F01", "r2", "wave", false]);
    r.update(1, OUT); // clock to 2.0: the third, back to r1 (round robin)
    expect(calls.length).toBe(3);
    expect(calls[2].args).toEqual(["F01", "r1", "wave", false]);
    r.update(10, OUT);
    expect(calls.length).toBe(3);
  });

  it("a spawn with no hold spawns all at once", () => {
    const lv = level({
      spawnPoints: [{ id: "r1", pos: [0, 0, 5], facing: [0, 1, 0] }],
      triggers: [
        { id: "s", when: { kind: "start" },
          do: [{ kind: "spawn", id: "w", foamer: "F01", count: 2, at: ["r1"] }] },
      ],
    });
    const { host, calls } = fakeHost();
    new TriggerRunner(lv, host).start();
    expect(calls.length).toBe(2);
    for (const c of calls) expect(c.fn).toBe("spawnOne");
  });

  it("`killed` over a placed Foamer and a spawn of 3 needs all four", () => {
    const lv = level({
      foamers: [{ id: "pl1", foamer: "F01", pos: [0, 1, 0], yaw: 0 }],
      spawnPoints: [{ id: "r1", pos: [0, 0, 5], facing: [0, 1, 0] }],
      triggers: [
        { id: "s", when: { kind: "start" },
          do: [{ kind: "spawn", id: "w", foamer: "F01", count: 3, at: ["r1"] }] },
        { id: "clear", when: { kind: "killed", ids: ["pl1", "w"] },
          do: [{ kind: "open", door: "exit" }] },
      ],
    });
    const { host, calls } = fakeHost();
    const r = new TriggerRunner(lv, host);
    r.start();
    expect(calls.length).toBe(3); // the spawn of 3
    r.killed("w");
    r.update(1 / 60, OUT);
    expect(calls.length).toBe(3); // one of three is not enough
    r.killed("w");
    r.killed("w");
    r.update(1 / 60, OUT);
    expect(calls.length).toBe(3); // two more: still needs the placed one
    r.killed("pl1");
    r.update(1 / 60, OUT);
    expect(calls.length).toBe(4);
    expect(calls[3]).toEqual({ fn: "open", args: ["exit"] });
    r.killed("pl1");
    r.update(1, OUT);
    expect(calls.length).toBe(4); // a trigger fires once
  });

  it("`killed` with a count fires at the number, not at the set; a count that includes a spawn id counts each Foamer it made", () => {
    const lv = level({
      spawnPoints: [{ id: "r1", pos: [0, 0, 5], facing: [0, 1, 0] }],
      triggers: [
        { id: "s", when: { kind: "start" },
          do: [{ kind: "spawn", id: "w", foamer: "F01", count: 3, at: ["r1"] }] },
        { id: "half", when: { kind: "killed", ids: ["w"], count: 2 },
          do: [{ kind: "message", text: "half down" }] },
      ],
    });
    const { host, calls } = fakeHost();
    const r = new TriggerRunner(lv, host);
    r.start();
    r.killed("w");
    r.update(1 / 60, OUT);
    expect(calls.map((c) => c.fn)).toContain("spawnOne");
    expect(calls.some((c) => c.fn === "message")).toBe(false);
    r.killed("w");
    r.update(1 / 60, OUT);
    expect(calls.some((c) => c.fn === "message" && c.args[0] === "half down")).toBe(true);
  });

  it("`after` fires its do its seconds after the named trigger, and a non-repeat parent that fires once echoes once", () => {
    const lv = level({
      foamers: [
        { id: "p1", foamer: "F01", pos: [0, 1, 0], yaw: 0 },
      ],
      triggers: [
        { id: "one", when: { kind: "killed", ids: ["p1"] },
          do: [{ kind: "show", ids: ["A"] }] },
        { id: "delayed", when: { kind: "after", trigger: "one", seconds: 2 },
          do: [{ kind: "open", door: "d" }] },
      ],
    });
    const { host, calls } = fakeHost();
    const r = new TriggerRunner(lv, host);
    r.start();
    r.killed("p1");
    r.update(1 / 60, OUT); // "one" fires, the after clock starts
    expect(calls).toEqual([{ fn: "show", args: [["A"]] }]);
    r.update(1.9, OUT); // not there yet
    expect(calls.length).toBe(1);
    r.update(0.2, OUT); // over the 2 second line
    expect(calls.length).toBe(2);
    expect(calls[1]).toEqual({ fn: "open", args: ["d"] });
    r.update(10, OUT);
    expect(calls.length).toBe(2);
  });

  it("`after` re-arms every time the parent fires, so a repeating parent echoes again", () => {
    const lv = level({
      zones: [ZONE],
      triggers: [
        { id: "in", when: { kind: "enter", zone: "z" }, repeat: true,
          do: [{ kind: "message", text: "edge" }] },
        { id: "once", when: { kind: "after", trigger: "in", seconds: 1 },
          do: [{ kind: "message", text: "once" }] },
      ],
    });
    const { host, calls } = fakeHost();
    const r = new TriggerRunner(lv, host);
    r.start();
    // enter at 0.5: edge, echo armed at 1.5
    r.update(0.5, IN);
    // leave at 1.5: the first echo is due on the way out, before any
    // re-arm
    r.update(1.0, OUT);
    expect(calls.map((c) => c.args[0])).toEqual(["edge", "once"]);
    // back in at 2.0: edge again, echo re-armed at 3.0 even though it
    // already fired
    r.update(0.5, IN);
    // out at 3.0: the second echo
    r.update(1.0, OUT);
    expect(calls.map((c) => c.args[0])).toEqual(["edge", "once", "edge", "once"]);
  });

  it("a kill or a press before its trigger can fire still counts", () => {
    const lv = level({
      buttons: [{ id: "b1", pos: [0, 1, 0], facing: [0, 1, 0], action: { open: "x" } }],
      foamers: [{ id: "p1", foamer: "F01", pos: [0, 1, 0], yaw: 0 }],
      triggers: [
        { id: "p", when: { kind: "pressed", button: "b1" },
          do: [{ kind: "message", text: "pressed" }] },
        { id: "k", when: { kind: "killed", ids: ["p1"] },
          do: [{ kind: "message", text: "killed" }] },
      ],
    });
    const { host, calls } = fakeHost();
    const r = new TriggerRunner(lv, host);
    // Kill and press before the level has even started: both still count.
    r.killed("p1");
    r.pressed("b1");
    r.start();
    r.update(1 / 60, OUT);
    const kinds = calls.map((c) => c.args[0]).sort();
    expect(kinds).toEqual(["killed", "pressed"]);
  });

  it("the usual arena runs end to end: enter shows blockers and spawns; all killed hides and opens the door", () => {
    const lv = level({
      zones: [ZONE],
      spawnPoints: [
        { id: "r1", pos: [0, 0, 5], facing: [0, 1, 0] },
        { id: "r2", pos: [3, 0, 5], facing: [0, 1, 0] },
      ],
      doors: [{ id: "exit", pos: [0, 1, 9], size: [2, 2, 1], lock: "trigger" }],
      triggers: [
        { id: "in", when: { kind: "enter", zone: "z" },
          do: [
            { kind: "show", ids: ["wall1", "wall2"] },
            { kind: "spawn", id: "w1", foamer: "F01", count: 4, at: ["r1", "r2"] },
          ] },
        { id: "all", when: { kind: "killed", ids: ["w1"] },
          do: [
            { kind: "hide", ids: ["wall1", "wall2"] },
            { kind: "open", door: "exit" },
          ] },
      ],
    });
    const { host, calls } = fakeHost();
    const r = new TriggerRunner(lv, host);
    r.start();
    expect(calls.length).toBe(0);
    r.update(1 / 60, IN); // enters
    expect(calls[0]).toEqual({ fn: "show", args: [["wall1", "wall2"]] });
    expect(calls.length).toBe(5); // 4 Foamers at once, no hold
    r.killed("w1");
    r.killed("w1");
    r.killed("w1");
    r.update(1 / 60, IN);
    expect(calls.length).toBe(5);
    r.killed("w1");
    r.update(1 / 60, IN);
    expect(calls.length).toBe(7);
    expect(calls[5]).toEqual({ fn: "hide", args: [["wall1", "wall2"]] });
    expect(calls[6]).toEqual({ fn: "open", args: ["exit"] });
  });

  it("reset brings the runner back to the level's start state", () => {
    const lv = level({
      zones: [ZONE],
      triggers: [
        { id: "s", when: { kind: "start" }, do: [{ kind: "message", text: "go" }] },
        { id: "in", when: { kind: "enter", zone: "z" },
          do: [{ kind: "spawn", id: "w", foamer: "F01", count: 2, at: ["r1"] }] },
        { id: "all", when: { kind: "killed", ids: ["w"] },
          do: [{ kind: "open", door: "exit" }] },
      ],
      spawnPoints: [{ id: "r1", pos: [0, 0, 5], facing: [0, 1, 0] }],
    });
    const { host, calls } = fakeHost();
    const r = new TriggerRunner(lv, host);
    r.start();
    expect(calls.length).toBe(1);
    r.update(1 / 60, IN);
    expect(calls.length).toBe(3);
    r.killed("w");
    r.killed("w");
    r.update(1 / 60, IN);
    expect(calls.length).toBe(4);

    // A restart: the same runner, the host keeps its history, the runner
    // goes back to its start state and fires it once more.
    calls.length = 0;
    r.reset();
    r.start();
    expect(calls.length).toBe(1);
    expect(calls[0]).toEqual({ fn: "message", args: ["go", 3] });
    r.update(1 / 60, IN);
    expect(calls.length).toBe(3); // the spawn runs again
    r.killed("w");
    r.killed("w");
    r.update(1 / 60, IN);
    expect(calls.length).toBe(4);
    expect(calls[3]).toEqual({ fn: "open", args: ["exit"] });
  });
});
