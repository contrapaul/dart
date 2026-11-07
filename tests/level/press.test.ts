import { beforeAll, describe, expect, it } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { buildLevel } from "../../src/level/build";
import {
  buildPress, HealthPressPlayer, PressSystem, CYCLE, CYCLE_TOTAL,
} from "../../src/level/presses";
import { validateLevel } from "../../src/level/validate";
import { PlayerHealth } from "../../src/player/health";
import type { Level, Press } from "../../src/level/format";
import type { Foamer } from "../../src/foamers/foamer";
import { greedyMesh, type MeshData } from "../../src/voxel/mesher";
import { linearColorTable } from "../../src/voxel/materials";
import pressJson from "../../data/press.json";
import soundsJson from "../../data/sounds.json";

// ENV-04 stage 1 (E14): the crushing toy press. A level names presses in
// `presses`; each runs the data's cycle (up, telegraph, slam, hold, rise)
// at its own beat. At the end of the slam the footprint (the pad's box, up
// to the head's lowest point) is tested, and once per slam end the player
// inside takes the damage through its own health (the shield never in the
// loop) and a Foamer inside pops the way a fatal one does. Built through
// `buildLevel`, the builder the arena page uses, the way the button's
// tests are.

const DT = 1 / 60;
const FAKE = {
  mesh(padded: Uint8Array): Promise<MeshData> {
    return Promise.resolve(greedyMesh(padded, linearColorTable()));
  },
};

/** The room the presses are tested in: a floor and a ceiling, no arena,
 *  so the page's runner is complete from the first frame like env-01. */
function room(presses?: Press[]): Level {
  return {
    meta: { id: "env-04-test", name: "test", act: 1, targetSeconds: 30, accent: "#fff" },
    shell: [
      { id: "floor", shape: "box", pos: [0, -0.5, 0], size: [12, 1, 12], material: "greybox-dark" },
      { id: "ceiling", shape: "box", pos: [0, 5, 0], size: [12, 1, 12], material: "greybox" },
    ],
    arenas: [],
    presses,
    playerStart: { pos: [0, 0, 3], yaw: 0 },
    exit: { pos: [0, 1, 4], size: [1, 1, 1] },
  };
}

function press(id: string, phase: number, at: [number, number, number] = [0, 0, 0]): Press {
  return { id, pos: at, size: [1.5, 1.5], height: 2.2, phase };
}

/** The page's wiring, in tests: the arena page's own press player (so the
 *  damage is the game's, not a copy), a board of foamers the page would
 *  pop through its chain, and the system the page steps. */
async function rig(presses = [press("p1", 0)]) {
  const rapier = RAPIER;
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const level = room(presses);
  const built = buildLevel(level, rapier, world, FAKE);
  const health = new PlayerHealth();
  const ui = { paused: false, poppedOut: false, pops: 0, pop() { this.pops++; } };
  const hud = { hits: 0, onHit() { this.hits++; } };
  const audio = { log: [] as string[], play(id: string, _opts?: { position?: THREE.Vector3 }) { this.log.push(id); } };
  const player = new HealthPressPlayer(health, ui, hud, audio);
  const list: Foamer[] = [];
  const popped: Foamer[] = [];
  const sys = new PressSystem(built.presses);
  return { rapier, world, level, built, health, ui, hud, audio, player, list, popped, sys, pop(f: Foamer) { popped.push(f); } };
}

/** Run `frames` fixed steps with the player's feet at `feet`. */
function run(rigg: Awaited<ReturnType<typeof rig>>, frames: number, feet?: [number, number, number]) {
  const p = rigg.sys;
  for (let i = 0; i < frames; i++) {
    const res = p.step(DT, feet ? (() => { rigg.player.feet.set(feet[0], feet[1], feet[2]); return rigg.player; })() : null, {
      list: rigg.list, pop: rigg.pop,
    });
    for (const s of res.slams) rigg.audio.play("ENV-press-slam", { position: s.pos });
    for (const w of res.windups) rigg.audio.play("ENV-press-windup", { position: w.pos });
  }
}

function foamerAt(x: number, y: number, z: number, rigg: Awaited<ReturnType<typeof rig>>): Foamer {
  const f = { centre: new THREE.Vector3(x, y, z), state: "approach" } as unknown as Foamer;
  rigg.list.push(f);
  return f;
}

beforeAll(async () => {
  await RAPIER.init();
});

/** How many fixed steps cover one whole cycle, margin and one. */
const FULL_CYCLE = Math.ceil(CYCLE_TOTAL / DT) + 1;

describe("the crushing toy press", () => {
  it("its cycle comes from data/press.json", () => {
    expect(CYCLE).toEqual(pressJson.cycle);
    expect(pressJson.cycle).toMatchObject({ up: 2.0, telegraph: 0.7, slam: 0.12, down: 0.5, rise: 1.0 });
    expect(CYCLE_TOTAL).toBeCloseTo(
      pressJson.cycle.up + pressJson.cycle.telegraph + pressJson.cycle.slam
      + pressJson.cycle.down + pressJson.cycle.rise,
    );
  });

  it("a level with presses validates and builds one head per press", async () => {
    const r = await rig([press("a", 0), press("b", 2.16, [3, 0, 0])]);
    expect(validateLevel(r.level).errors).toEqual([]);
    expect(r.built.presses.map((p) => p.id)).toEqual(["a", "b"]);
    expect(r.sys.ids).toEqual(["a", "b"]);
    expect(r.sys.phaseOf("a")).toBe("up");
    expect(r.sys.ids.length).toBe(2);
    expect(() => buildPress(press("c", 7), new THREE.Group(), r.rapier, r.world)).not.toThrow();
  });

  it("runs the five phases in order on one cycle", async () => {
    const r = await rig();
    const p = r.sys.list[0]!;
    const seen: string[] = [];
    for (let i = 0; i < FULL_CYCLE; i++) {
      if (seen.indexOf(p.phase) < 0) seen.push(p.phase);
      r.sys.step(DT, null, { list: [], pop: r.pop });
    }
    const order = ["up", "telegraph", "slam", "down", "rise"];
    expect(seen).toEqual(order);
    expect(p.phase).toBe("up"); // back to the rest at cycle end
  });

  it("slams once per cycle and the slam and windup events carry the page's sounds", async () => {
    const r = await rig();
    run(r, FULL_CYCLE);
    expect(r.audio.log.filter((id) => id === "ENV-press-slam")).toHaveLength(1);
    expect(r.audio.log.filter((id) => id === "ENV-press-windup")).toHaveLength(1);
    const sounds = (soundsJson as { sounds: Record<string, unknown> }).sounds;
    expect(sounds["ENV-press-slam"]).toBeTruthy();
    expect(sounds["ENV-press-windup"]).toBeTruthy();
  });

  it("a player in the footprint at the slam end takes 100 and, at No armour, Normal difficulty, downs", async () => {
    const r = await rig();
    // HealthPressPlayer is the page's own player: the damage is its own
    // health.damage, the shield not in the loop.
    run(r, FULL_CYCLE, [0, 0, 0]); // the pad is at the origin
    expect(r.hud.hits).toBe(1);
    expect(r.health.hp).toBe(0);
    expect(r.health.dead).toBe(true);
    expect(r.ui.pops).toBe(1);
    expect(r.audio.log).toContain("PL-hurt");
  });

  it("a player beside the pad touches nothing", async () => {
    const r = await rig();
    run(r, FULL_CYCLE, [2.2, 0, 0]); // 2.2 m east: outside the 0.75 m half
    expect(r.hud.hits).toBe(0);
    expect(r.health.hp).toBe(r.health.max);
    expect(r.ui.pops).toBe(0);
  });

  it("a raised shield never stops it", async () => {
    // The page's press player takes its damage straight through
    // health.damage, the same verb a Foamer's hit uses, and the page does
    // not run a shield check for it: a disc in front cannot stop a head
    // from the top. A Foamer's hit behind a raised block lands reduced
    // by the shield's damageShare; this line would. Check the amount the
    // press line deals.
    const r = await rig();
    const amounts: number[] = [];
    const real = r.health.damage.bind(r.health);
    r.health.damage = (amount, from) => {
      amounts.push(amount);
      return real(amount, from);
    };
    run(r, FULL_CYCLE, [0, 0, 0]);
    expect(amounts).toEqual([100]); // the full 100, no share
  });

  it("one slam damages once, not every step the head is down", async () => {
    const r = await rig();
    // The hold is 0.5 s = 30 steps: 0.5 * 70 = each so 100 is dealt, not 30 * 100.
    run(r, FULL_CYCLE, [0, 0, 0]);
    expect(r.hud.hits).toBe(1);
    expect(r.health.hp).toBe(0); // 100, not 3000.
  });

  it("a Foamer in the footprint pops, a Foamer out of it stays", async () => {
    const r = await rig();
    const under = foamerAt(0, 0, 0, r);
    const beside = foamerAt(2.2, 0, 0, r);
    run(r, FULL_CYCLE);
    expect(r.popped).toEqual([under]);
    expect(r.popped).not.toContain(beside);
  });

  it("two presses on different beats slam at different steps", async () => {
    const r = await rig([
      press("a", 0, [-1.5, 0, 0]),
      press("b", CYCLE_TOTAL / 2, [1.5, 0, 0]),
    ]);
    const firstSlam = new Map<string, number>();
    for (let i = 0; i < FULL_CYCLE; i++) {
      const res = r.sys.step(DT, null, { list: [], pop: r.pop });
      for (const s of res.slams) firstSlam.set(s.id, firstSlam.get(s.id) ?? i);
    }
    expect(firstSlam.has("a")).toBe(true);
    expect(firstSlam.has("b")).toBe(true);
    expect(firstSlam.get("a")).not.toBe(firstSlam.get("b"));
  });

  it("a level with no presses loads and runs as before", async () => {
    const r = await rig([]);
    expect(r.built.presses).toEqual([]);
    expect(r.sys.count).toBe(0);
    run(r, FULL_CYCLE, [0, 0, 0]);
    expect(r.audio.log).toEqual([]);
    expect(r.hud.hits).toBe(0);
  });

  it("reset puts every head back to rest", async () => {
    const r = await rig([press("a", 0), press("b", CYCLE_TOTAL / 2, [3, 0, 0])]);
    run(r, 130); // mid-telegraph
    expect(r.sys.phaseOf("a")).toBe("telegraph");
    r.sys.reset();
    for (const p of r.sys.list) {
      expect(p.lit).toBe(false);
      expect(p.phase).toBe("up");
      expect(p.t).toBeCloseTo(p.spec.phase % CYCLE_TOTAL);
    }
  });

  it("a phase named into the data's cycle starts that press already off its rest", async () => {
    const r = await rig([press("d", CYCLE.up + 0.1)]);
    expect(r.sys.phaseOf("d")).toBe("telegraph");
    expect(r.sys.list[0]!.lit).toBe(true);
  });
});
