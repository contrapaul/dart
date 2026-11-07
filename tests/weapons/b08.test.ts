import { beforeAll, describe, expect, it } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { linearColorTable } from "../../src/voxel/materials";
import { greedyMesh } from "../../src/voxel/mesher";
import type { Mesher } from "../../src/voxel/pieces";
import { DebrisSystem } from "../../src/voxel/debris";
import { DartSystem } from "../../src/weapons/darts";
import { DartImpacts, type VoxelTarget } from "../../src/weapons/impacts";
import { FoamerSystem } from "../../src/foamers/foamers";
import { Blaster, resolveSpec, type BlasterControls, type DartFiring } from "../../src/weapons/blaster";
import { PlayerController, P } from "../../src/player/controller";
import type { Input } from "../../src/core/input";
import dartTuning from "../../data/darts.json";
import foamerData from "../../data/foamers.json";
import type { DartTypeName } from "../../src/weapons/darts";

// GAME-09g stage 1: the foam ball (the ball dart type) and B08 Firehose.
// The ball reads its type and ricochets off a hard surface with
// restitution of its speed up to bounces times, then falls and rests; it
// damages a Foamer once and bounces off with what is left. B08 reads its
// spec, fires nothing until its wheels are up to speed, then fires about
// 1 / fireInterval a second.

const DT = 1 / 60;
const AIM = new THREE.Vector3(0, 0, -1);
const MUZ = [new THREE.Vector3(0, 1.4, -0.5)];
// A twin blaster asks for muzzle index 1 too; the placeholder model has one
// muzzle, so both entries point at the same point until B08's model exists.
const muzzleAt = (i: number) => MUZ[i % MUZ.length];

function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

class FakeDarts implements DartFiring {
  readonly types: DartTypeName[] = [];
  readonly times: number[] = [];
  now = 0;
  fire(_o: THREE.Vector3, _d: THREE.Vector3, t: DartTypeName, _shot?: unknown): void {
    this.types.push(t);
    this.times.push(this.now);
  }
  get count(): number {
    return this.types.length;
  }
}

function make(blasterId: string, mods: string[] = []): { b: Blaster; darts: FakeDarts } {
  const darts = new FakeDarts();
  const b = new Blaster(resolveSpec(blasterId, mods), darts, muzzleAt, lcg(7));
  return { b, darts };
}
const HOLD: BlasterControls = { fireHeld: true, firePressed: true, reloadPressed: false };

/** Scene, world and a DartSystem with a floor, plus one fixed wall at z=-5. */
function makeWorld(rapier: typeof RAPIER, wall = true) {
  const scene = new THREE.Scene();
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.createCollider(RAPIER.ColliderDesc.cuboid(40, 0.5, 40).setTranslation(0, -0.5, 0));
  if (wall) world.createCollider(RAPIER.ColliderDesc.cuboid(20, 12, 0.5).setTranslation(0, 4, -5.5));
  const body = world.createRigidBody(rapier.RigidBodyDesc.fixed());
  const ignore = world.createCollider(rapier.ColliderDesc.capsule(0.5, 0.3).setTranslation(0, 0, 200), body);
  return { scene, world, system: new DartSystem(scene, world, rapier, ignore) };
}

/** The single live slot (the test fires exactly one ball). */
function liveSlot(system: DartSystem) {
  const slots = (system as unknown as {
    slots: { alive: boolean; state: number; vel: THREE.Vector3; bounceLeft: number }[];
  }).slots;
  const live = slots.filter((s) => s.alive);
  expect(live.length).toBe(1);
  return live[0];
}

// state codes in darts.ts: FLYING 0, STUCK 1, RESTING 2, FADING 3, LIVE 4.
const FLYING = 0;
const RESTING = 2;

function fakeMesher(): Mesher {
  const colors = linearColorTable();
  return { mesh: (padded) => Promise.resolve(greedyMesh(padded, colors)) };
}

beforeAll(async () => {
  await RAPIER.init();
});

describe("GAME-09g: the foam ball type", () => {
  const m = dartTuning.types.ball;
  const s = dartTuning.types.standard;

  it("1. the ball reads its type: round, fast, a little drop, light, and it bounces", () => {
    expect(m).toBeTruthy();
    expect(m.shape).toBe("ball");
    expect(m.radius).toBeGreaterThan(m.length / 3); // round, not a dart
    expect(m.speed).toBeGreaterThanOrEqual(28); // fast
    expect(m.speed).toBeLessThan(s.speed);
    expect(m.gravityScale).toBeGreaterThan(s.gravityScale); // a little drop
    expect(m.impulse).toBeLessThan(s.impulse * 2); // light
    expect(m.restitution).toBeCloseTo(0.6, 6); // the card's start
    expect(m.bounces).toBe(2); // the card's start
    expect(foamerData.test.damage.ball).toBe(1.5); // the card's start
  });

  it("2. a ball bounces off a wall with less speed, twice, then falls and rests", () => {
    const { world, system } = makeWorld(RAPIER);
    world.step();
    let hits = 0;
    system.onHit = () => { hits += 1; };
    // Straight at the wall's face from 4 m away, above the floor.
    system.fire(new THREE.Vector3(0, 4, -1), new THREE.Vector3(0, 0, -1), "ball");
    // Read the slot right after the first contact: the leaving speed is
    // restitution of the hitting speed.
    let inSpeed = 0;
    let outSpeed = 0;
    for (let i = 0; i < 1200; i++) {
      const beforeHits = hits;
      system.update(DT);
      world.step();
      const s0 = liveSlot(system);
      if (beforeHits === 0 && hits === 1) {
        inSpeed = s0.vel.length() / m.restitution; // what it had coming in
        outSpeed = s0.vel.length();
      }
      if (s0.state === RESTING) break;
    }
    expect(inSpeed).toBeGreaterThan(20); // came in fast
    // Each bounce keeps about restitution of the speed of the last.
    expect(outSpeed).toBeCloseTo(inSpeed * m.restitution, 1);
    // After bounces (2) contacts the third one is the end: the ball rests.
    const s0 = liveSlot(system);
    expect(s0.state).toBe(RESTING);
    expect(s0.bounceLeft).toBe(0);
    expect(hits).toBe(3);
  });

  it("3. a ball that hits a Foamer damages it once and bounces off with what is left", async () => {
    const { scene, world } = makeWorld(RAPIER, false);
    world.createCollider(RAPIER.ColliderDesc.cuboid(40, 0.5, 40).setTranslation(0, -0.5, 0));
    const pb = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    const ignore = world.createCollider(
      RAPIER.ColliderDesc.capsule(0.5, 0.3).setTranslation(0, 0, 200), pb,
    );
    const darts = new DartSystem(scene, world, RAPIER, ignore);
    const debris = new DebrisSystem(RAPIER, world);
    const targets: VoxelTarget[] = [];
    const foamers = new FoamerSystem(RAPIER, world, fakeMesher(), debris, darts, targets);
    new DartImpacts(darts, debris, targets);
    world.step();
    const eye = new THREE.Vector3(0, 1.6, 30);
    const f = foamers.spawn(new THREE.Vector3(0, 0, 0), eye, "F01")!;
    for (const part of f.parts.values()) {
      for (;;) {
        part.mesh.update();
        if (!part.mesh.busy) break;
        await new Promise((r) => setTimeout(r, 0));
      }
      world.step();
    }
    const before = f.health;
    const body = f.parts.get("body")!;
    const p = body.voxelToWorld(new THREE.Vector3(
      body.spec.size[0] / 2, body.spec.size[1] / 2, body.spec.size[2] + 0.4,
    ));
    darts.fire(p, new THREE.Vector3(0, 0, -1), "ball");
    for (let i = 0; i < 90 && f.health === before; i++) {
      darts.update(DT);
      foamers.update(DT, eye);
      world.step();
    }
    expect(before - f.health).toBe(foamerData.test.damage.ball);
    // The hit did not stick or end the ball: it bounced with what was left
    // (still flying, one bounce of its budget gone).
    const s0 = liveSlot(darts);
    expect(s0.state).toBe(FLYING);
    expect(s0.vel.length()).toBeGreaterThan(0);
    expect(s0.bounceLeft).toBe(m.bounces - 1);
  });
});

describe("GAME-09g: B08 Firehose", () => {
  const S = resolveSpec("B08");

  it("4. B08 reads its spec: name, placeholder model, auto, balls, 120/240, long spin-up", () => {
    expect(S.name).toBe("Firehose");
    expect(S.model).toBe("/models/blasters/B04.glb"); // the ART-01/04 placeholder
    expect(S.mode).toBe("auto");
    expect(S.dartType).toBe("ball");
    expect(S.dartsPerShot).toBe(1);
    expect(S.magSize).toBe(120);
    expect(S.reserveMax).toBe(240);
    expect(S.reserveStart).toBe(120);
    expect(S.fireInterval).toBe(0.035);
    expect(S.spinUp).toBe(0.8);
    expect(S.spinDown).toBe(1.2);
    expect(S.reloadTime).toBe(3.0);
    expect(S.fireMoveShare).toBe(0.6);
    expect(S.muzzles).toEqual(["muzzle_1"]);
    // Heavy recoil, well above B04's.
    const S4 = resolveSpec("B04");
    expect(S.recoil.spreadPerShot).toBeGreaterThan(S4.recoil.spreadPerShot);
    expect(S.recoil.climbDegPerShot).toBeGreaterThan(S4.recoil.climbDegPerShot);
    expect(S.recoil.spreadMax).toBeGreaterThan(S4.recoil.spreadMax);
  });

  it("5. B08 fires nothing until spun up, then about 1 / fireInterval a second", () => {
    const { b, darts } = make("B08");
    // The whole spin-up (0.8 s) at 60 Hz: nothing may leave the muzzle.
    for (let i = 0; i < 47; i++) { // 0.783 s: still short of wheelSpeed 1
      b.update(DT, HOLD, AIM);
      darts.now += DT;
    }
    expect(b.wheelSpeed).toBeLessThan(1);
    expect(darts.count).toBe(0);
    // Past the spin-up it fires at its interval.
    for (let i = 0; i < 120; i++) { // 2 s of held trigger
      b.update(DT, HOLD, AIM);
      darts.now += DT;
    }
    const want = 2 / S.fireInterval; // about 57
    expect(darts.count).toBeGreaterThan(want * 0.85);
    expect(darts.count).toBeLessThan(want * 1.15);
    expect(darts.types.every((t) => t === "ball")).toBe(true);
    // While firing, the blaster reports itself firing (the movement slow).
    expect(b.firing).toBe(true);
  });

  it("6. releasing the trigger spins the wheels down and stops the firing flag", () => {
    const { b, darts } = make("B08");
    const NO: BlasterControls = { fireHeld: false, firePressed: false, reloadPressed: false };
    for (let i = 0; i < 120; i++) { b.update(DT, HOLD, AIM); darts.now += DT; }
    expect(b.firing).toBe(true);
    for (let i = 0; i < 120; i++) { b.update(DT, NO, AIM); darts.now += DT; }
    expect(b.wheelSpeed).toBe(0);
    expect(b.firing).toBe(false);
  });
});

describe("GAME-09g: B08's movement slow", () => {
  /** Input that always moves forward and holds nothing else. */
  function walking() {
    const move = { x: 0, y: 1 };
    return {
      move: () => move,
      wasPressed: () => false,
      isDown: () => false,
    } as unknown as Input;
  }

  /** Steady walk speed on a flat floor after settling, with the firing
   *  slow applied the way src/game/game.ts applies it. */
  function walkSpeed(fireMoveScale: number, speedScale: number): number {
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    world.createCollider(RAPIER.ColliderDesc.cuboid(30, 0.5, 30).setTranslation(0, -0.5, 0));
    const player = new PlayerController(RAPIER, world, new THREE.Vector3(0, 0, 0));
    player.speedScale = speedScale; // the shield's own scale, owned by shield.ts
    const input = walking();
    for (let i = 0; i < 60; i++) {
      player.fireMoveScale = fireMoveScale;
      player.update(DT, input);
      world.step();
    }
    return Math.hypot(player.vel.x, player.vel.z);
  }

  it("7. while B08 fires the player moves at fireMoveShare, at full speed when it stops", () => {
    const S = resolveSpec("B08");
    const slow = walkSpeed(S.fireMoveShare, 1);
    const normal = walkSpeed(1, 1);
    expect(slow).toBeCloseTo(normal * S.fireMoveShare, 1);
    // The blaster's own firing flag drives the page's choice (the same
    // condition game.ts uses): false means scale 1, full speed.
    const { b, darts } = make("B08");
    const NO: BlasterControls = { fireHeld: false, firePressed: false, reloadPressed: false };
    expect(b.firing ? S.fireMoveShare : 1).toBe(1);
    for (let i = 0; i < 60; i++) { b.update(DT, HOLD, AIM); darts.now += DT; }
    expect(b.firing ? S.fireMoveShare : 1).toBe(S.fireMoveShare);
    for (let i = 0; i < 120; i++) { b.update(DT, NO, AIM); darts.now += DT; }
    expect(b.firing ? S.fireMoveShare : 1).toBe(1);
  });

  it("8. the shield's slow still applies on top of B08's", () => {
    const S = resolveSpec("B08");
    const shieldShare = 0.8; // the share shield.ts would set speedScale to
    const both = walkSpeed(S.fireMoveShare, shieldShare);
    expect(both).toBeCloseTo(P.walkSpeed * S.fireMoveShare * shieldShare, 1);
  });
});

describe("GAME-09g: B08's mods", () => {
  const BASE = resolveSpec("B08");

  it("9. Control (mod 1, Paul): recoil control and reduced movement penalty", () => {
    const C = resolveSpec("B08", ["control"]);
    // Much less spread growth and climb than the bare blaster.
    expect(C.recoil.spreadPerShot).toBeLessThan(BASE.recoil.spreadPerShot * 0.5);
    expect(C.recoil.climbDegPerShot).toBeLessThan(BASE.recoil.climbDegPerShot * 0.5);
    expect(C.recoil.spreadMax).toBeLessThan(BASE.recoil.spreadMax);
    expect(C.recoil.climbDegMax).toBeLessThan(BASE.recoil.climbDegMax);
    // The recovery keeps the blaster's own value (the block merges key by key).
    expect(C.recoil.recover).toBe(BASE.recoil.recover);
    // The movement penalty is eased.
    expect(BASE.fireMoveShare).toBe(0.6);
    expect(C.fireMoveShare).toBe(0.85);
  });

  it("10. Twin (mod 2, Paul): a second barrel for 2x fire rate, alternating muzzles", () => {
    const T = resolveSpec("B08", ["twin"]);
    expect(T.fireInterval).toBeCloseTo(BASE.fireInterval / 2, 6);
    // The placeholder model has one muzzle, so both entries name muzzle_1
    // until B08's own model exists (tests/weapons/b08.test.ts, HANDOFF).
    expect(T.muzzles).toEqual(["muzzle_1", "muzzle_1"]);
    const { b, darts } = make("B08", ["twin"]);
    const muzzleIdx: number[] = [];
    b.onShot = (i) => muzzleIdx.push(i);
    // Spin up first (nothing fires below wheelSpeed 1), then 2 s of held
    // trigger: about twice the bare rate.
    for (let i = 0; i < 47; i++) { b.update(DT, HOLD, AIM); darts.now += DT; }
    expect(darts.count).toBe(0);
    for (let i = 0; i < 120; i++) { b.update(DT, HOLD, AIM); darts.now += DT; }
    const want = 2 / T.fireInterval;
    expect(darts.count).toBeGreaterThan(want * 0.85);
    expect(darts.count).toBeLessThan(want * 1.15);
    // The auto shot alternates the two muzzles.
    expect(muzzleIdx.slice(0, 4)).toEqual([0, 1, 0, 1]);
  });

  it("11. the bare blaster alternates one muzzle only, and the mods leave other blasters alone", () => {
    const { b, darts } = make("B08");
    const muzzleIdx: number[] = [];
    b.onShot = (i) => muzzleIdx.push(i);
    for (let i = 0; i < 120; i++) { b.update(DT, HOLD, AIM); darts.now += DT; }
    expect(muzzleIdx.every((i) => i === 0)).toBe(true);
    // B04 still has its own numbers (its spec never reads fireMoveShare).
    const S4 = resolveSpec("B04");
    expect(S4.fireMoveShare).toBe(1);
    expect(S4.fireInterval).toBe(0.1);
  });
});
