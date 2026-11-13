import { describe, expect, it } from "vitest";
import * as THREE from "three";
import levelJson from "../../data/levels/ed-07.json";
import type { Level } from "../../src/level/format";
import { validateLevel } from "../../src/level/validate";
import { TriggerRunner, type TriggerHost } from "../../src/level/triggers";
import { KeyPickups } from "../../src/level/key-pickups";

const level = levelJson as unknown as Level;

function fakeHost() {
  const log: string[] = [];
  const host: TriggerHost = {
    spawnOne: (_f, at, tag) => log.push(`spawn ${tag} ${at}`),
    wake: (ids) => log.push(`wake ${ids}`),
    show: (ids) => log.push(`show ${ids}`),
    hide: (ids) => log.push(`hide ${ids}`),
    open: (d) => log.push(`open ${d}`),
    close: (d) => log.push(`close ${d}`),
    message: () => log.push("message"),
    checkpoint: () => log.push("checkpoint"),
  };
  return { host, log };
}

describe("ED-07b: the trigger test level", () => {
  it("validates", () => {
    expect(validateLevel(level).errors).toEqual([]);
  });

  it("locks, runs two waves and clears", () => {
    const { host, log } = fakeHost();
    const r = new TriggerRunner(level, host);
    r.start();
    r.update(0.1, [0, 0, 14]);
    expect(log).toEqual([]);
    r.update(0.1, [0, 0, 2]);
    expect(log).toContain("show blocker");
    for (let i = 0; i < 20; i++) r.update(0.1, [0, 0, 2]);
    expect(log.filter((l) => l.startsWith("spawn wave-1 "))).toHaveLength(3);
    for (let i = 0; i < 3; i++) r.killed("wave-1");
    r.update(0.1, [0, 0, 2]);
    expect(log.filter((l) => l.startsWith("spawn wave-2-spawn"))).toHaveLength(2);
    expect(log).not.toContain("hide blocker");
    r.killed("wave-2-spawn");
    r.killed("wave-2-spawn");
    r.update(0.1, [0, 0, 2]);
    expect(log).toEqual(expect.arrayContaining(["hide blocker", "open side-door", "checkpoint"]));
  });
});

describe("ED-07b: keys in play", () => {
  it("takes the red key in reach and then opens the red door", () => {
    const keys = new KeyPickups(level.pickups!, level.doors!);
    const opened: string[] = [];
    const locked = (id: string) => !opened.includes(id);
    expect(keys.update(0.1, new THREE.Vector3(0, 0, -11), locked, (d) => opened.push(d))).toEqual([]);
    expect(keys.neededNear(new THREE.Vector3(0, 0, -11), locked)).toBe("red");
    expect(opened).toEqual([]);
    const taken = keys.update(0.1, new THREE.Vector3(9, 0, -9), locked, (d) => opened.push(d));
    expect(taken.map((k) => k.id)).toEqual(["red-key"]);
    expect(keys.held()).toEqual(["red"]);
    keys.update(0.1, new THREE.Vector3(0, 0, -11), locked, (d) => opened.push(d));
    expect(opened).toEqual(["exit-door"]);
    keys.reset();
    expect(keys.held()).toEqual([]);
  });
});
