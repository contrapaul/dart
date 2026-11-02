// AUD-01 stage 2, card tests 5, 6, 9 and 10: GameSounds against a fake
// AudioSink that records every play and loop call. The blaster tests drive
// the real Loadout and Blaster classes with fixed fake viewmodels and a
// quiet dart sink; the player tests drive the real PlayerController on a
// flat Rapier floor.
import { beforeAll, describe, expect, it } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { Blaster, resolveSpec } from "../../src/weapons/blaster";
import type { DartFiring } from "../../src/weapons/blaster";
import { Loadout } from "../../src/weapons/loadout";
import { PlayerController } from "../../src/player/controller";
import type { Input } from "../../src/core/input";
import { GameSounds } from "../../src/audio/game-sounds";
import type { DartTypeName } from "../../src/weapons/darts";
import type {
  AudioSink,
  LoopHandle,
  PlayOptions,
} from "../../src/audio/sink";

beforeAll(async () => {
  await RAPIER.init();
});

const DT = 1 / 60;
const AIM = new THREE.Vector3(0, 0, -1);

/** Records every call, so a test reads the whole order back. */
class FakeSink implements AudioSink {
  readonly log: { id: string; opts?: PlayOptions }[] = [];
  readonly loopLog: string[] = [];
  readonly loops = new Map<string, FakeLoopHandle>();
  play(id: string, opts?: PlayOptions): void {
    this.log.push({ id, opts });
  }
  loop(id: string, _opts?: PlayOptions): LoopHandle {
    this.loopLog.push(id);
    const h = new FakeLoopHandle(id);
    this.loops.set(id, h);
    return h;
  }
}

class FakeLoopHandle implements LoopHandle {
  readonly sets: { v: number; r: number }[] = [];
  stopped = false;
  constructor(readonly id: string) {}
  set(v: number, r: number): void {
    this.sets.push({ v, r });
  }
  setPosition(_p: THREE.Vector3): void {}
  stop(): void {
    this.stopped = true;
  }
}

class FakeDarts implements DartFiring {
  fire(_o: THREE.Vector3, _d: THREE.Vector3, _t: DartTypeName): void {}
}

class FakeVM {
  visible = false;
  private pts: THREE.Vector3[];
  constructor(pts: [number, number, number][]) {
    this.pts = pts.map((p) => new THREE.Vector3(...p));
  }
  setVisible(on: boolean): void { this.visible = on; }
  setMods(): void {}
  muzzleCameraPoint(i: number, out: THREE.Vector3): THREE.Vector3 {
    return out.copy(this.pts[i]);
  }
  onShot = (_m: number): void => {};
}

// The blaster row, driven by the card's real classes. ORDER is B01, B04,
// B03, so the active blaster at the start of every test is the B01.
function makeLo(): Loadout {
  const darts = new FakeDarts();
  const vms = [
    new FakeVM([[0.9, 0, -1], [0.9, 0.1, -1], [0.9, -0.1, -1]]),
    new FakeVM([[0.7, 0.5, -1]]),
    new FakeVM([[-0.7, 0, -1], [-0.7, 0.1, -1]]),
  ];
  const out = new THREE.Vector3();
  const parts = ["B01", "B04", "B03"].map((id, i) => ({
    id,
    blaster: new Blaster(
      resolveSpec(id),
      darts,
      (j: number) => vms[i].muzzleCameraPoint(j, out),
    ),
    viewmodel: vms[i],
  }));
  return new Loadout(parts, darts, 0.35);
}

function flatWorld() {
  const w = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  w.createCollider(
    RAPIER.ColliderDesc.cuboid(60, 0.5, 60).setTranslation(0, -0.5, 0),
  );
  return w;
}

function moveInput() {
  const state = {
    move: { x: 0, y: 0 },
    pressed: new Set<string>(),
    down: new Set<string>(),
  };
  const input = {
    move: () => state.move,
    wasPressed: (a: string) => state.pressed.has(a),
    isDown: (a: string) => state.down.has(a),
  } as unknown as Input;
  return { state, input };
}

function makeProbed() {
  const lo = makeLo();
  const sink = new FakeSink();
  const world = flatWorld();
  const player = new PlayerController(
    RAPIER,
    world,
    new THREE.Vector3(-40, 0, 0),
  );
  const gs = new GameSounds(sink, lo, player);
  return { lo, sink, player, world, gs };
}

const NO = { fireHeld: false, firePressed: false, reloadPressed: false, sprintHeld: false };
const HOLD = { ...NO, fireHeld: true, firePressed: true };

const ids = (log: { id: string; opts?: PlayOptions }[]) =>
  log.map((e) => e.id);
const countOf = (list: string[], id: string) =>
  list.reduce((n, x) => n + (x === id ? 1 : 0), 0);

describe("card test 5: B01", () => {
  it("one shot fires once, priming plays its cues in order, reload plays mag-out then mag-in", () => {
    const { lo, sink, gs } = makeProbed();
    const step = (c: typeof NO) => {
      lo.update(DT, c, AIM);
      gs.update(DT, c);
    };

    // One pump shot: the three darts are one magazine drop, one sound.
    step(HOLD);
    expect(lo.blasters[0].mag).toBe(7);
    expect(countOf(ids(sink.log), "B01-fire")).toBe(1);

    // Across the priming: pump-back, then pump-fwd, once each, in order.
    let guard = 0;
    while (lo.blasters[0].state !== "ready" && guard++ < 200) step(NO);
    const seen = ids(sink.log);
    const back = seen.indexOf("B01-pump-back");
    const fwd = seen.indexOf("B01-pump-fwd");
    expect(back).toBeGreaterThanOrEqual(0);
    expect(fwd).toBeGreaterThanOrEqual(0);
    expect(back).toBeLessThan(fwd);
    expect(countOf(seen, "B01-pump-back")).toBe(1);
    expect(countOf(seen, "B01-pump-fwd")).toBe(1);

    // An empty magazine with a full reserve starts a reload on the next
    // press; across it, mag-out then mag-in, once each, in order.
    lo.blasters[0].mag = 0;
    step(HOLD);
    guard = 0;
    while (lo.blasters[0].state !== "ready" && guard++ < 400) step(NO);
    const after = ids(sink.log);
    const o = after.indexOf("B01-mag-out");
    const n = after.indexOf("B01-mag-in");
    expect(o).toBeGreaterThanOrEqual(0);
    expect(n).toBeGreaterThanOrEqual(0);
    expect(o).toBeLessThan(n);
    expect(countOf(after, "B01-mag-out")).toBe(1);
    expect(countOf(after, "B01-mag-in")).toBe(1);
  });
});

describe("card test 6: B03", () => {
  it("pressing with the both mod fires both barrels (two), reload plays its cues once each in time order", () => {
    const { lo, sink, gs } = makeProbed();
    const step = (c: typeof NO) => {
      lo.update(DT, c, AIM);
      gs.update(DT, c);
    };
    // To the B03 and set the both mod so a press fires both barrels.
    lo.select(2);
    while (lo.switching) step(NO);
    lo.setMod(2, "both", true);
    for (let i = 0; i < 5; i++) step(NO);
    expect(lo.activeId()).toBe("B03");
    expect(lo.blasters[2].spec.bothBarrels).toBe(true);

    // One press fires both barrels: two magazine drops, two fire sounds.
    step(HOLD);
    expect(countOf(ids(sink.log), "B03-fire")).toBe(2);
    // The blaster is now empty with a full reserve; holding the trigger
    // makes it reload (after the break mode's own firing interval has
    // passed).
    let guard2 = 0;
    while (lo.blasters[2].state !== "reloading" && guard2++ < 30)
      step(HOLD);
    expect(lo.blasters[2].state).toBe("reloading");
    let guard = 0;
    while (lo.blasters[2].state !== "ready" && guard++ < 300) step(NO);
    const all = ids(sink.log);
    const order = [
      "B03-latch",
      "B03-break-open",
      "B03-eject",
      "B03-shell-drop",
      "B03-load",
      "B03-close",
    ];
    let prev = -1;
    for (const id of order) {
      const i = all.indexOf(id);
      expect(countOf(all, id)).toBe(1);
      expect(i).toBeGreaterThan(prev);
      prev = i;
    }
  });
});

describe("card test 9: player", () => {
  it("16 m of walking plays PL-step-hard 10 times (plus or minus 1)", () => {
    const { player, world, sink, gs } = makeProbed();
    const { state, input } = moveInput();
    state.move.x = 1; // walk along +x at yaw 0
    const eye = new THREE.Vector3();
    const sx = player.eye(1, eye).x;
    let guard = 0;
    while (player.eye(1, eye).x - sx < 16 && guard++ < 2000) {
      player.update(DT, input);
      world.step();
      gs.update(DT, NO);
    }
    const steps = countOf(ids(sink.log), "PL-step-hard");
    expect(steps).toBeGreaterThanOrEqual(9);
    expect(steps).toBeLessThanOrEqual(11);
  });

  it("no steps while airborne, and a jump plays PL-jump once", () => {
    const { player, world, sink, gs } = makeProbed();
    const { state, input } = moveInput();
    // Stand still first: a controller at floor level settles (and may emit
    // one soft landing) before we look at anything.
    for (let i = 0; i < 30; i++) {
      player.update(DT, input);
      world.step();
      gs.update(DT, NO);
    }
    expect(player.grounded).toBe(true);
    const from = sink.log.length;
    state.pressed.add("jump");
    let jumpIdx = -1;
    let landIdx = -1;
    let guard = 0;
    while (landIdx < 0 && guard++ < 300) {
      const before = sink.log.length;
      player.update(DT, input);
      world.step();
      gs.update(DT, NO);
      state.pressed.clear();
      for (let i = before; i < sink.log.length; i++) {
        if (sink.log[i].id === "PL-jump" && jumpIdx < 0) jumpIdx = i;
        if (sink.log[i].id === "PL-land-soft" || sink.log[i].id === "PL-land-hard")
          landIdx = i;
      }
    }
    expect(jumpIdx).toBeGreaterThanOrEqual(from);
    expect(landIdx).toBeGreaterThan(jumpIdx);
    // Nothing between the jump and the landing is a footstep.
    const air = sink.log.slice(jumpIdx, landIdx).map((e) => e.id);
    expect(countOf(air, "PL-step-hard")).toBe(0);
    expect(countOf(air, "PL-jump")).toBe(1);
  });

  it("a landing at 8 m/s is hard and one at 3 m/s is soft", () => {
    // The speed at contact is sqrt(2 * gravity * h) with the game's
    // gravity (22 m/s squared in data/player.json): a 1.5 m drop lands at
    // 8.2 m/s, a 0.25 m drop at 3.3 m/s, each clear of the data's
    // 7 m/s floor on the right side.
    for (const [h, want] of [
      [1.5, "PL-land-hard"],
      [0.25, "PL-land-soft"],
    ] as const) {
      const world = flatWorld();
      const player = new PlayerController(
        RAPIER,
        world,
        new THREE.Vector3(-20, h, 0),
      );
      const sink = new FakeSink();
      new GameSounds(sink, makeLo(), player);
      const { input } = moveInput();
      let guard = 0;
      while (guard++ < 400) {
        player.update(DT, input);
        world.step();
        if (
          sink.log.some(
            (e) => e.id === "PL-land-soft" || e.id === "PL-land-hard",
          )
        )
          break;
      }
      expect(countOf(ids(sink.log), want)).toBe(1);
    }
  });
});

describe("card test 10: B04 loop", () => {
  it("one loop however long fire is held; the volume follows wheelSpeed and is 0 after the wheels stop", () => {
    const { lo, sink, gs } = makeProbed();
    const step = (fire: boolean) => {
      const c = { ...NO, fireHeld: fire, firePressed: fire };
      lo.update(DT, c, AIM);
      gs.update(DT, c);
    };
    lo.select(1); // to the B04
    while (lo.switching) step(false);
    expect(lo.activeId()).toBe("B04");

    // Hold the trigger across the spin up and beyond.
    for (let i = 0; i < 15; i++) step(true);
    expect(
      sink.loopLog.filter((id) => id === "B04-rev-loop").length,
    ).toBe(1);
    const loop = sink.loops.get("B04-rev-loop");
    expect(loop).toBeDefined();
    // The spin up passes through the middle, and the wheels reach full.
    expect(loop!.sets.some((s) => s.v > 0.2 && s.v < 0.9)).toBe(true);
    expect(loop!.sets.some((s) => s.v === 1 && s.r === 1)).toBe(true);

    // Release: the wheels run down over spinDown (1 s) and the volume is
    // 0 a moment after. The rate parks at its floor (0.6) with the wheels
    // still. Still exactly one loop for the whole test.
    for (let i = 0; i < 75; i++) step(false);
    expect(lo.blasters[1].wheelSpeed).toBe(0);
    const last = loop!.sets[loop!.sets.length - 1];
    expect(last.v).toBe(0);
    expect(last.r).toBeGreaterThanOrEqual(0.6);
    expect(last.r).toBeLessThanOrEqual(1);
  });
});
