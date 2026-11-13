import { describe, expect, it } from "vitest";
import type { Level } from "../../src/level/format";
import { TriggerRunner, type TriggerHost } from "../../src/level/triggers";
import { validateLevel } from "../../src/level/validate";
import { arenaProblem, blockerChoices, buildArena, type ArenaSpec } from "../../src/editor/arena-build";

// ED-08 stage 4: the Arena button builds the usual fight out of ordinary
// triggers, so the test runs them through the real runner the way
// tests/level/ed-07.test.ts does.

/** A room with one zone to enter, two spawn points, a blocker and a door. */
function room(): Level {
  return {
    meta: { id: "arena-test", name: "Arena test", act: 0, targetSeconds: 60, accent: "#ff7a1a" },
    shell: [],
    prims: [
      { id: "floor-1", shape: "box", pos: [0, -0.5, 0], size: [32, 1, 32], colour: "#6f6788", behaviour: "solid" },
      { id: "blocker", shape: "box", pos: [0, 1.5, 7], size: [24, 3, 0.5], colour: "#ff4fa3", behaviour: "solid", hidden: true },
    ],
    playerStart: { pos: [0, 0, 14], yaw: 0 },
    exit: { pos: [0, 0, -14], size: [2, 1, 2] },
    sky: { kind: "gradient", top: "#3a6ff0", horizon: "#bfe3ff", bottom: "#3a3550" },
    spawnPoints: [{ id: "sp-west", pos: [-8, 0, -2], facing: [0, 0, 1] }, { id: "sp-east", pos: [8, 0, -2], facing: [0, 0, 1] }],
    zones: [{ id: "arena-zone", pos: [0, 1, 1], size: [24, 2, 10] }],
    doors: [{ id: "side-door", pos: [16, 1.5, 0], size: [2, 3, 0.4], lock: "trigger" }],
  };
}

const spec: ArenaSpec = {
  zone: "arena-zone",
  blockers: ["blocker"],
  spawnPoints: ["sp-west", "sp-east"],
  waves: [{ foamer: "F01", count: 3 }, { foamer: "F01", count: 2 }],
  doors: ["side-door"],
};

/** Fresh ids out of the level's own space, as LevelDoc.nextId gives them. */
function ids() {
  let n = 0;
  return (prefix: string) => `${prefix}-${++n}`;
}

function fakeHost() {
  const log: string[] = [];
  const host: TriggerHost = {
    spawnOne: (_f, at, tag) => log.push(`spawn ${tag} ${at}`),
    wake: (list) => log.push(`wake ${list}`),
    show: (list) => log.push(`show ${list}`),
    hide: (list) => log.push(`hide ${list}`),
    open: (d) => log.push(`open ${d}`),
    close: (d) => log.push(`close ${d}`),
    message: (text) => log.push(`message ${text}`),
    checkpoint: () => log.push("checkpoint"),
  };
  return { host, log };
}

describe("ED-08 stage 4: the arena builder", () => {
  it("makes triggers a level validates", () => {
    const triggers = buildArena(spec, ids());
    const level = { ...room(), triggers };
    const result = validateLevel(level);
    expect(result.errors).toEqual([]);
    expect(triggers).toHaveLength(3);
    expect(triggers[0]!.when).toEqual({ kind: "enter", zone: "arena-zone" });
    expect(triggers[1]!.when).toMatchObject({ kind: "killed" });
    expect(triggers[2]!.when).toMatchObject({ kind: "killed" });
  });

  it("summarises the way a hand written arena reads", () => {
    const triggers = buildArena(spec, ids());
    const summaries = triggers.map((t) => {
      const when = t.when.kind === "enter"
        ? `enter ${t.when.zone}`
        : `killed ${(t.when as { ids: string[] }).ids.join("+")}`;
      const acts = t.do.map((d) => {
        if (d.kind === "spawn") return `spawn ${d.count} ${d.foamer}`;
        if (d.kind === "show" || d.kind === "hide") return `${d.kind} ${d.ids.length}`;
        if (d.kind === "open") return `open ${d.door}`;
        return d.kind;
      });
      return `${when}: ${acts.join(", ")}`;
    });
    expect(summaries).toEqual([
      "enter arena-zone: show 1, spawn 3 F01",
      "killed wave-2: spawn 2 F01",
      "killed wave-2+wave-4: hide 1, open side-door",
    ]);
  });

  it("runs the fight through the real runner: enter, two waves, clear", () => {
    const triggers = buildArena(spec, ids());
    const level = { ...room(), triggers };
    // The spawn action's id is what a killed condition counts, so the test
    // reads it off the lock trigger instead of guessing it.
    const tags = triggers
      .map((t) => t.do.find((d) => d.kind === "spawn"))
      .filter((d) => d !== undefined)
      .map((d) => (d as { id: string }).id);
    const { host, log } = fakeHost();
    const runner = new TriggerRunner(level, host);
    runner.start();
    runner.update(0.1, [0, 0, 14]);
    expect(log).toEqual([]);
    runner.update(0.1, [0, 0, 2]);
    expect(log).toContain("show blocker");
    for (let i = 0; i < 20; i++) runner.update(0.1, [0, 0, 2]);
    expect(log.filter((l) => l.startsWith(`spawn ${tags[0]} `))).toHaveLength(3);
    expect(log).not.toContain("hide blocker");

    for (let i = 0; i < 3; i++) runner.killed(tags[0]!);
    for (let i = 0; i < 20; i++) runner.update(0.1, [0, 0, 2]);
    expect(log.filter((l) => l.startsWith(`spawn ${tags[1]} `))).toHaveLength(2);
    expect(log).not.toContain("hide blocker");

    for (let i = 0; i < 2; i++) runner.killed(tags[1]!);
    for (let i = 0; i < 20; i++) runner.update(0.1, [0, 0, 2]);
    expect(log).toEqual(expect.arrayContaining(["hide blocker", "open side-door"]));
  });

  it("refuses a spec that would make triggers the level rejects", () => {
    expect(arenaProblem({ ...spec, zone: "" })).toMatch(/zone/);
    expect(arenaProblem({ ...spec, waves: [] })).toMatch(/wave/);
    expect(arenaProblem({ ...spec, spawnPoints: [] })).toMatch(/spawn point/);
    expect(arenaProblem({ ...spec, waves: [{ foamer: "F01", count: 0 }] })).toMatch(/count/);
    expect(arenaProblem(spec)).toBeNull();
    expect(buildArena({ ...spec, waves: [] }, ids())).toEqual([]);
  });

  it("copes with no blockers and no doors, which is a plain fight", () => {
    const bare = buildArena({ ...spec, blockers: [], doors: [] }, ids());
    const level = { ...room(), triggers: bare };
    expect(validateLevel(level).errors).toEqual([]);
    const { host, log } = fakeHost();
    const runner = new TriggerRunner(level, host);
    runner.start();
    for (let i = 0; i < 20; i++) runner.update(0.1, [0, 0, 2]);
    expect(log).not.toContain("show blocker");
    const tag = (bare[0]!.do.find((d) => d.kind === "spawn") as { id: string }).id;
    expect(bare).toHaveLength(2);
    expect(log.filter((l) => l.startsWith(`spawn ${tag} `))).toHaveLength(3);
  });

  it("offers the prims as blockers and says which start hidden", () => {
    const choices = blockerChoices(room());
    expect(choices).toEqual([
      { id: "floor-1", label: "floor-1 (box)" },
      { id: "blocker", label: "blocker (box, hidden)" },
    ]);
  });
});
