// AUD-01 stages 2 and 3a, card tests 5, 6, 7, 9 and 10: GameSounds
// against a fake AudioSink that records every play and loop call. The
// blaster tests drive the real Loadout and Blaster classes with fixed
// fake viewmodels and a quiet dart sink; the player tests drive the real
// PlayerController on a flat Rapier floor; the dart surface tests drive
// the full DartSystem -> DartImpacts -> FoamerSystem chain.
import { beforeAll, describe, expect, it } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { Blaster, resolveSpec } from "../../src/weapons/blaster";
import type { DartFiring } from "../../src/weapons/blaster";
import { Loadout } from "../../src/weapons/loadout";
import { PlayerController } from "../../src/player/controller";
import type { Input } from "../../src/core/input";
import { GameSounds } from "../../src/audio/game-sounds";
import { DartImpacts, type VoxelTarget } from "../../src/weapons/impacts";
import { DartSystem } from "../../src/weapons/darts";
import { VoxelVolume } from "../../src/voxel/chunk";
import { materialId, linearColorTable } from "../../src/voxel/materials";
import { greedyMesh } from "../../src/voxel/mesher";
import type { Mesher } from "../../src/voxel/pieces";
import { DebrisSystem } from "../../src/voxel/debris";
import { FoamerSystem } from "../../src/foamers/foamers";
import type { Foamer } from "../../src/foamers/foamer";
import type { FoamerPart } from "../../src/foamers/foamer-part";
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

/** Node has no Worker: mesh synchronously on the main thread, as the
 *  worker would. Same rig as the Foamer tests. */
function fakeMesher(): Mesher {
  const colors = linearColorTable();
  return { mesh: (padded) => Promise.resolve(greedyMesh(padded, colors)) };
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
  const ignore = world.createCollider(
    RAPIER.ColliderDesc.cuboid(1, 1, 1).setTranslation(0, 100, 0),
  );
  const darts = new DartSystem(new THREE.Scene(), world, RAPIER, ignore);
  const gs = new GameSounds(sink, lo, player, darts);
  return { lo, sink, player, world, gs };
}

const NO = { fireHeld: false, firePressed: false, reloadPressed: false, sprintHeld: false };
const HOLD = { ...NO, fireHeld: true, firePressed: true };

const ids = (log: { id: string; opts?: PlayOptions }[]) =>
  log.map((e) => e.id);
const countOf = (list: string[], id: string) =>
  list.reduce((n, x) => n + (x === id ? 1 : 0), 0);

describe("card test 5: B01", () => {
  it("a shot whose onShot refills the magazine (the range's infinite ammo) still plays its fire sound", () => {
    const { lo, sink, gs } = makeProbed();
    const b = lo.blasters[0];
    const inner = b.onShot;
    b.onShot = (i: number) => { inner(i); b.refill(); };
    lo.update(DT, HOLD, AIM);
    gs.update(DT, HOLD);
    expect(b.mag).toBe(b.spec.magSize);
    expect(countOf(ids(sink.log), "B01-fire")).toBe(1);
  });

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

/* The card test 7 rig: the full dart chain (DartImpacts before the Foamer
 * system, so the Foamer relabel runs last), a wood voxel wall with a
 * collider flush to the volume, and a plain box collider. GameSounds is
 * wired on the same darts and impacts the darts use. */
function surfRig() {
  const sink = new FakeSink();
  const lo = makeLo();
  const world = flatWorld();
  const player = new PlayerController(
    RAPIER,
    world,
    new THREE.Vector3(-40, 0, 0),
  );
  const ignore = world.createCollider(
    RAPIER.ColliderDesc.cuboid(1, 1, 1).setTranslation(0, 100, 0),
  );
  const darts = new DartSystem(new THREE.Scene(), world, RAPIER, ignore);
  const debris = new DebrisSystem(RAPIER, world);
  // The wood wall: 29 x 4 x 4 voxels (2.9 m x 0.4 m x 0.4 m) from
  // x -3 to -0.1, z 0 to 0.4. The collider is flush with the faces, so a
  // hit point sits on a volume face and the carve centre is in range.
  const vol = new VoxelVolume(0.1);
  vol.fillBox(-30, 0, 0, 29, 4, 4, materialId("wood"));
  const wallBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(1.45, 0.2, 0.2).setTranslation(-1.55, 0.2, 0.2),
    wallBody,
  );
  // A plain collider a dart can hit that no voxel target owns: the
  // "default" surface (the card's DT-hit-hard case).
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(0.5, 0.5, 0.5).setTranslation(2.5, 0.25, 0.25),
    world.createRigidBody(RAPIER.RigidBodyDesc.fixed()),
  );
  const targets: VoxelTarget[] = [
    {
      volume: vol,
      owns: (c) => c.parent()?.handle === wallBody.handle,
      worldToVoxel: (v) => v.divideScalar(0.1),
      voxelToWorld: (v) => v.multiplyScalar(0.1),
    },
  ];
  const impacts = new DartImpacts(darts, debris, targets);
  const foamers = new FoamerSystem(RAPIER, world, fakeMesher(), debris, darts, targets);
  const gs = new GameSounds(sink, lo, player, darts, impacts, foamers);
  world.step();
  return { sink, world, darts, foamers, impacts, gs, vol, player };
}

/** Fire one dart from (x, y, z) toward -z and step the world. */
function fireForward(
  R: ReturnType<typeof surfRig>,
  x: number,
  y: number,
  z: number,
  type: DartTypeName = "standard",
  n = 240,
) {
  R.darts.fire(new THREE.Vector3(x, y, z), new THREE.Vector3(0, 0, -1), type);
  for (let i = 0; i < n; i++) {
    R.darts.update(DT);
    R.world.step();
  }
}

function posOf(e: { id: string; opts?: PlayOptions }): THREE.Vector3 {
  expect(e.opts?.position).toBeDefined();
  return e.opts!.position!;
}

describe("card test 7: dart surfaces", () => {
  it("a hit on a wood voxel target plays DT-hit-wood at the hit point", () => {
    const R = surfRig();
    fireForward(R, -1.55, 0.25, 2);
    const e = R.sink.log.find((x) => x.id === "DT-hit-wood");
    expect(e).toBeDefined();
    // The wall face the dart strikes is at z 0.4, at the fired x and y.
    expect(posOf(e!).distanceTo(new THREE.Vector3(-1.55, 0.25, 0.4))).toBeLessThanOrEqual(0.3);
  });

  it("a voxel material with no surface entry of its own plays the default DT-hit-hard", () => {
    const R = surfRig();
    R.vol.fillBox(-30, 0, 0, 29, 4, 4, materialId("foam-orange"));
    fireForward(R, -1.55, 0.25, 2);
    expect(R.sink.log.find((x) => x.id === "DT-hit-hard")).toBeDefined();
  });

  it("a hit on a plain collider plays DT-hit-hard at the hit point", () => {
    const R = surfRig();
    fireForward(R, 2.5, 0.25, 2);
    const e = R.sink.log.find((x) => x.id === "DT-hit-hard");
    expect(e).toBeDefined();
    expect(posOf(e!).distanceTo(new THREE.Vector3(2.5, 0.25, 0.5))).toBeLessThanOrEqual(0.3);
  });

  it("a slug hit plays DT-slug-hit at the hit point", () => {
    const R = surfRig();
    fireForward(R, 2.5, 0.25, 2, "slug");
    const e = R.sink.log.find((x) => x.id === "DT-slug-hit");
    expect(e).toBeDefined();
    expect(posOf(e!).distanceTo(new THREE.Vector3(2.5, 0.25, 0.5))).toBeLessThanOrEqual(0.3);
    // A slug is its own sound: it never takes the plain surface sound.
    expect(R.sink.log.find((x) => x.id === "DT-hit-hard")).toBeUndefined();
  });

  it("a hit on a Foamer part plays DT-hit-foamer at the hit point", async () => {
    const R = surfRig();
    const f = R.foamers.spawn(
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, 1),
    );
    expect(f).not.toBeNull();
    // Let the remeshed part colliders land before the dart flies.
    for (const part of f!.parts.values()) part.mesh.update();
    await new Promise((r) => setTimeout(r, 0));
    R.world.step();
    R.world.step();
    fireForward(R, 0, 0.7, 3);
    const e = R.sink.log.find((x) => x.id === "DT-hit-foamer");
    expect(e).toBeDefined();
    // The Foamer faced +z and stood at the origin; the hit is on one of
    // its parts, roughly a metre tall and in front of the feet.
    expect(posOf(e!).distanceTo(new THREE.Vector3(0, 0.7, 0.3))).toBeLessThanOrEqual(0.4);
  });
});

/* Card test 8 rig (the card's "the fake sink": GameSounds on a
 * FakeSink). One fixed step runs in the game's own order: the Foamer
 * system, the world, then the sounds. Hits are real standard darts fired
 * 1 m out at the part's centre, the way the parts tests do it. The pop
 * comes from a temporary edit to the data's pop types, restored in a
 * finally, because the shipped data pops no starter dart. */
const _eye8 = new THREE.Vector3();

function tick8(R: ReturnType<typeof surfRig>, player: THREE.Vector3, n = 4) {
  for (let i = 0; i < n; i++) {
    R.foamers.update(DT, R.player.eye(1, _eye8).copy(player));
    R.darts.update(DT);
    R.world.step();
    R.gs.update(DT, NO);
  }
}

/** One approach F01 at the origin, facing the player. */
async function spawnF01(
  R: ReturnType<typeof surfRig>,
  face: THREE.Vector3,
): Promise<Foamer> {
  R.foamers.spawnCount = 0; // the test owns the population
  R.foamers.spawnPoints = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  const f = R.foamers.spawn(new THREE.Vector3(0, 0, 0), face)!;
  for (const part of f.parts.values()) part.mesh.update(); // land colliders
  await new Promise((r) => setTimeout(r, 0));
  for (let i = 0; i < 3; i++) {
    R.world.step();
    R.gs.update(DT, NO);
  }
  return f;
}

/** Fire one standard dart 1 m back along dir, at the part's centre. */
function fireAtPart(
  R: ReturnType<typeof surfRig>,
  part: FoamerPart,
  dir: [number, number, number],
) {
  const d = new THREE.Vector3(...dir).normalize();
  const c = part.voxelToWorld(
    new THREE.Vector3(
      part.spec.size[0] / 2, part.spec.size[1] / 2, part.spec.size[2] / 2,
    ),
  );
  R.darts.fire(c.addScaledVector(d, -1), d, "standard");
}

/** Break one part by dart misses; the candidate side is the one whose 1 m
 *  line of fire touches no other part. */
async function breakLeg(
  R: ReturnType<typeof surfRig>,
  f: Foamer,
  id: string,
): Promise<void> {
  const cands = [
    [0, 0, -1], [0, 0, 1], [-1, 0, 0], [1, 0, 0],
  ] as [number, number, number][];
  const part = f.parts.get(id)!;
  let dir = cands[0]!;
  for (const d of cands) {
    const dd = new THREE.Vector3(...d).normalize();
    const c = part.voxelToWorld(new THREE.Vector3(
      part.spec.size[0] / 2, part.spec.size[1] / 2, part.spec.size[2] / 2));
    let clear = true;
    for (const o of f.parts.values()) {
      if (o === part) continue;
      const oc = o.voxelToWorld(new THREE.Vector3(
        o.spec.size[0] / 2, o.spec.size[1] / 2, o.spec.size[2] / 2));
      const t = c.addScaledVector(dd, 1);
      if (
        Math.abs(t.x - oc.x) < 0.35 &&
        Math.abs(t.y - oc.y) < 0.45 &&
        Math.abs(t.z - oc.z) < 0.35
      ) { clear = false; break; }
      t.set(c.x, c.y, c.z);
    }
    if (clear) { dir = d; break; }
  }
  for (let i = 0; i < 10 && f.parts.has(id); i++) {
    fireAtPart(R, f.parts.get(id)!, dir);
    tick8(R, new THREE.Vector3(99, 0, 99), 60); // the player far off
  }
  if (f.parts.has(id)) throw new Error("could not break " + id);
}

describe("card test 8: Foamers", () => {
  it("a standard-dart kill plays FX-wound per damaging hit and one FX-topple, and never FX-fizz-out", async () => {
    const R = surfRig();
    const player = new THREE.Vector3(0, 1, 11);
    const f = await spawnF01(R, new THREE.Vector3(0, 0, 1));
    // One body dart at a time until it is down. The shipped data has no
    // popping starter dart, so the kill is a down, not a pop.
    let guard = 0;
    while (f.state !== "down" && guard++ < 80) {
      fireAtPart(R, f.parts.get("body")!, [0, 0, 1]);
      tick8(R, player, 9);
    }
    expect(f.state, "killed").toBe("down");
    // FX-wound once per damaging hit, spatial at the hit part.
    const seen = ids(R.sink.log);
    expect(
      countOf(seen, "FX-wound"),
      "one wound line per damaging dart",
    ).toBe(R.foamers.stats.hits);
    expect(R.foamers.stats.hits).toBeGreaterThanOrEqual(3);
    const w = R.sink.log.find((x) => x.id === "FX-wound")!;
    expect(w.opts?.position, "the hit part's position").toBeDefined();
    // One topple for the down.
    expect(countOf(seen, "FX-topple"), "one topple for the down").toBe(1);
    // PT-04 (Paul): no fizz-out after the down. Step on for well over the
    // old 0.3 s delay to show nothing follows the topple.
    tick8(R, player, 60);
    const seen2 = ids(R.sink.log);
    expect(countOf(seen2, "FX-fizz-out"), "no fizz-out").toBe(0);
  });

  it("a broken leg plays FX-part-off once, at the part", async () => {
    const R = surfRig();
    const f = await spawnF01(R, new THREE.Vector3(0, 0, 1));
    await breakLeg(R, f, "legL");
    const seen = ids(R.sink.log);
    expect(
      countOf(seen, "FX-part-off"),
      "one part-off line for the one leg",
    ).toBe(1);
    const p = R.sink.log.find((x) => x.id === "FX-part-off")!;
    expect(p.opts?.position, "spatial, at the part").toBeDefined();
    // GAME-11: a broken leg now knocks it over, so FX-topple comes once,
    // when the body lands. It is not a down, so no fizz-out follows.
    expect(countOf(seen, "FX-topple"), "one topple for the fall").toBe(1);
    expect(countOf(seen, "FX-fizz-out"), "no fizz-out, it is not down").toBe(0);
  });

  it("a pop plays FX-pop and FX-chunk", async () => {
    // PT-03: a pop comes from overkill now, not from a dart type list: one
    // precisionHeavy dart (10 damage) on an F01 at 0.5 health is impact
    // 9.5 / 6 = 1.58, at or above popAt (1.5), so the burst pops.
    {
      const R = surfRig();
      const f = await spawnF01(R, new THREE.Vector3(0, 0, 1));
      f.health = 0.5;
      const body = f.parts.get("body")!;
      const c = body.voxelToWorld(new THREE.Vector3(
        body.spec.size[0] / 2, body.spec.size[1] / 2, body.spec.size[2] / 2));
      R.darts.fire(new THREE.Vector3(c.x, c.y, c.z + 1), new THREE.Vector3(0, 0, -1), "precisionHeavy");
      let guard = 0;
      while (
        R.foamers.stats.popped < 1 &&
        f.health > 0 &&
        f.state !== "down" &&
        guard++ < 180
      ) {
        tick8(R, new THREE.Vector3(99, 0, 99), 1);
      }
      expect(R.foamers.stats.popped, "it popped").toBe(1);
      const seen = ids(R.sink.log);
      expect(countOf(seen, "FX-pop"), "one pop line").toBe(1);
      expect(countOf(seen, "FX-chunk"), "one chunk line").toBe(1);
      expect(seen.indexOf("FX-chunk")).toBeGreaterThanOrEqual(
        seen.indexOf("FX-pop"),
      );
    }
  });

  it("a walking F01 plays footsteps at about two per walk cycle, within one over 3 s", async () => {
    const R = surfRig();
    const player = new THREE.Vector3(0, 1, 40); // far: it approaches all 3 s
    const f = await spawnF01(R, new THREE.Vector3(0, 0, 40));
    expect(f.state, "walking toward the player").toBe("approach");
    const before = R.sink.log.length;
    tick8(R, player, 180); // 3 s
    const seen = ids(R.sink.log).slice(before);
    const steps = countOf(seen, "FX-step-medium");
    // It has walked: the gait has advanced past the first half.
    expect(f.gait).toBeGreaterThan(0.5);
    // Over 3 s of walking the walk cycle runs once: about two foot plants,
    // within one.
    expect(steps).toBeGreaterThanOrEqual(1);
    expect(steps).toBeLessThanOrEqual(3);
    const s = R.sink.log.find((x) => x.id === "FX-step-medium")!;
    expect(s, "at least one step over 3 s").toBeDefined();
    expect(s.opts?.position, "spatial, at the Foamer").toBeDefined();
  });
});

describe("card test 9: player", () => {
  it("16 m of walking plays PL-step-hard 10 times (plus or minus 1)", () => {    const { player, world, sink, gs } = makeProbed();
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
      const ignore = world.createCollider(
        RAPIER.ColliderDesc.cuboid(1, 1, 1).setTranslation(0, 100, 0),
      );
      const darts = new DartSystem(new THREE.Scene(), world, RAPIER, ignore);
      new GameSounds(sink, makeLo(), player, darts);
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

describe("PT-04: the sound cuts", () => {
  it("a weapon switch plays neither BX-holster nor BX-draw", () => {
    const { lo, sink, gs } = makeProbed();
    const step = (c: typeof NO) => {
      lo.update(DT, c, AIM);
      gs.update(DT, c);
    };
    // A switch that goes through and back, so both edges are covered: the
    // start of the switch (the old holster) and the halfway swap (the draw).
    lo.select(1);
    while (lo.switching) step(NO);
    lo.select(2);
    while (lo.switching) step(NO);
    expect(lo.activeId()).toBe("B03");
    const seen = ids(sink.log);
    expect(countOf(seen, "BX-holster"), "no holster").toBe(0);
    expect(countOf(seen, "BX-draw"), "no draw").toBe(0);
  });

  it("the F10 starts no jet loop and the F06 still hums", async () => {
    const R = surfRig();
    R.foamers.spawnCount = 0; // the test owns the population
    R.foamers.spawnPoints = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    const face = new THREE.Vector3(0, 0, 14);
    const f10 = R.foamers.spawn(new THREE.Vector3(0, 0, 0), face, "F10")!;
    const f06 = R.foamers.spawn(new THREE.Vector3(6, 0, 0), face, "F06")!;
    for (const f of [f10, f06]) {
      for (const part of f.parts.values()) part.mesh.update();
    }
    await new Promise((r) => setTimeout(r, 0));
    for (let i = 0; i < 10; i++) {
      R.foamers.update(DT, face);
      R.world.step();
      R.gs.update(DT, NO);
    }
    // The Floater keeps its hum; the Turbo is silent on the same path.
    expect(
      R.sink.loopLog.filter((id) => id === "F06-hum").length,
      "the F06 hums once",
    ).toBe(1);
    expect(
      R.sink.loopLog.filter((id) => id === "F10-jet").length,
      "the F10 starts no loop",
    ).toBe(0);
    // Breaking the F10's last jet still drops it with one flop.
    f10.parts.delete("jetL");
    f10.parts.delete("jetR");
    for (let i = 0; i < 5; i++) {
      R.foamers.update(DT, face);
      R.world.step();
      R.gs.update(DT, NO);
    }
    expect(
      countOf(ids(R.sink.log), "F10-fall"),
      "the flop is still heard",
    ).toBe(1);
    expect(
      R.sink.loopLog.filter((id) => id === "F10-jet").length,
      "and still no loop",
    ).toBe(0);
  });
});

describe("card test 10: B04 loop", () => {
  it("PT-04: B04 active starts no rev loop, and its shots still sound", () => {
    const { lo, sink, gs } = makeProbed();
    const step = (fire: boolean) => {
      const c = { ...NO, fireHeld: fire, firePressed: fire };
      lo.update(DT, c, AIM);
      gs.update(DT, c);
    };
    lo.select(lo.ids.indexOf("B04")); // to the B04
    while (lo.switching) step(false);
    expect(lo.activeId()).toBe("B04");
    // Hold the trigger across the spin up and beyond: no flywheel loop.
    for (let i = 0; i < 60; i++) step(true);
    expect(
      sink.loopLog.filter((id) => id === "B04-rev-loop").length,
      "no rev loop while B04 is active",
    ).toBe(0);
    expect(
      countOf(ids(sink.log), "B04-fire"),
      "B04-fire is kept",
    ).toBeGreaterThan(0);
    // And back to the B01: still nothing looped.
    lo.select(0);
    while (lo.switching) step(false);
    for (let i = 0; i < 30; i++) step(false);
    expect(sink.loopLog.filter((id) => id === "B04-rev-loop").length).toBe(0);
  });
});
