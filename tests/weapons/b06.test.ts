import { describe, expect, it } from "vitest";
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
import dartTuning from "../../data/darts.json";
import foamerData from "../../data/foamers.json";
import type { DartTypeName } from "../../src/weapons/darts";

// GAME-09d stage 1: the mega dart type and B06 The Standard. The mega dart
// reads its own type in data/darts.json and hits harder than a standard one
// on the same part; B06 reads its spec and fires full-auto at its interval;
// the rate mod fires faster.

const DT = 1 / 60;
const AIM = new THREE.Vector3(0, 0, -1);
const MUZ = [new THREE.Vector3(0, 1.4, -0.5)];

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
  fire(_o: THREE.Vector3, _d: THREE.Vector3, t: DartTypeName): void {
    this.types.push(t);
    this.times.push(this.now);
  }
  get count(): number {
    return this.types.length;
  }
}

function make(blasterId: string, mods: string[] = []): { b: Blaster; darts: FakeDarts } {
  const darts = new FakeDarts();
  const b = new Blaster(resolveSpec(blasterId, mods), darts, (i) => MUZ[i], lcg(7));
  return { b, darts };
}
const HOLD: BlasterControls = { fireHeld: true, firePressed: true, reloadPressed: false };

describe("GAME-09d: the mega dart type", () => {
  const m = dartTuning.types.mega;
  const s = dartTuning.types.standard;

  it("1. the mega dart exists and is bigger and heavier than a standard one", () => {
    expect(m).toBeTruthy();
    expect(m.radius).toBeGreaterThan(s.radius * 1.5);
    expect(m.speed).toBeLessThan(s.speed); // a little slower
    expect(m.gravityScale).toBeGreaterThan(s.gravityScale); // more drop
    expect(m.impulse).toBeGreaterThan(s.impulse); // more impulse
    expect(m.carveRadius).toBeCloseTo(0.2, 6); // the start carve
  });

  it("2. a mega dart does more damage than a standard one on the same part", async () => {
    // The damage table is data; the dart path reads f.spec.damage[type].
    // Fire one mega and one standard dart at the same part of two fresh
    // F01s and compare the health the system took off.
    const hitHealth = async (type: DartTypeName): Promise<number> => {
      const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
      world.createCollider(RAPIER.ColliderDesc.cuboid(40, 0.5, 40).setTranslation(0, -0.5, 0));
      const pb = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
      const ignore = world.createCollider(
        RAPIER.ColliderDesc.capsule(0.5, 0.3).setTranslation(0, 0, 200), pb,
      );
      const scene = new THREE.Scene();
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
      // Straight at the body's front face from close in, so it always hits.
      const body = f.parts.get("body")!;
      const p = body.voxelToWorld(new THREE.Vector3(
        body.spec.size[0] / 2, body.spec.size[1] / 2, body.spec.size[2] + 0.4,
      ));
      darts.fire(p, new THREE.Vector3(0, 0, -1), type);
      for (let i = 0; i < 60 && f.health === before; i++) {
        darts.update(DT);
        foamers.update(DT, eye);
        world.step();
      }
      return before - f.health;
    };
    const mega = await hitHealth("mega");
    const standard = await hitHealth("standard");
    expect(standard).toBeGreaterThan(0);
    expect(mega).toBeGreaterThan(standard);
    // The table itself: mega starts about 3 times standard.
    expect(foamerData.test.damage.mega).toBeGreaterThan(foamerData.test.damage.standard * 2.5);
  });
});

function fakeMesher(): Mesher {
  const colors = linearColorTable();
  return { mesh: (padded) => Promise.resolve(greedyMesh(padded, colors)) };
}

describe("GAME-09d: B06 The Standard", () => {
  const S = resolveSpec("B06");

  it("3. B06 reads its spec: name, model, auto mode, mega darts, 60/120", () => {
    expect(S.name).toBe("The Standard");
    expect(S.model).toBe("/models/blasters/B06.glb");
    expect(S.mode).toBe("auto");
    expect(S.dartType).toBe("mega");
    expect(S.dartsPerShot).toBe(1);
    expect(S.magSize).toBe(60);
    expect(S.reserveMax).toBe(120);
    expect(S.reserveStart).toBe(60);
    expect(S.reloadTime).toBe(2.4);
    expect(S.muzzles).toEqual(["muzzle_1"]);
    expect(S.spinUp).toBeGreaterThan(0);
    expect(S.recoil.climbDegPerShot).toBeGreaterThan(0);
  });

  it("4. B06 fires full-auto at its interval, one mega dart per shot", () => {
    const { b, darts } = make("B06");
    expect(b.mag).toBe(60);
    expect(b.reserve).toBe(60);
    // Spin up first: no darts before spinUp seconds of held trigger.
    let t = 0;
    while (t < S.spinUp - DT / 2) { darts.now = t; b.update(DT, HOLD, AIM); t += DT; }
    expect(darts.count).toBe(0);
    for (let i = 0; i < Math.round(2 / DT); i++) { darts.now = t; b.update(DT, HOLD, AIM); t += DT; }
    expect(darts.types.every((x) => x === "mega")).toBe(true);
    expect(b.wheelSpeed).toBe(1);
    // The steady rate: the gap between two late shots is the interval.
    const gaps: number[] = [];
    for (let i = 1; i < darts.times.length; i++)
      gaps.push(darts.times[i] - darts.times[i - 1]);
    const late = gaps.slice(gaps.length - 5);
    for (const g of late) expect(Math.abs(g - S.fireInterval)).toBeLessThan(DT * 1.5);
  });

  it("5. the rate mod fires faster", () => {
    const { b, darts } = make("B06", ["rate"]);
    expect(b.spec.fireInterval).toBe(0.12);
    let t = 0;
    while (t < S.spinUp + DT) { darts.now = t; b.update(DT, HOLD, AIM); t += DT; }
    for (let i = 0; i < Math.round(2 / DT); i++) { darts.now = t; b.update(DT, HOLD, AIM); t += DT; }
    const gaps: number[] = [];
    for (let i = 1; i < darts.times.length; i++)
      gaps.push(darts.times[i] - darts.times[i - 1]);
    for (const g of gaps.slice(gaps.length - 5))
      expect(Math.abs(g - 0.12)).toBeLessThan(DT * 1.5);
    // Faster than the base blaster's interval.
    expect(0.12).toBeLessThan(S.fireInterval);
  });

  it("6. B06 is in the loadout order after B03", async () => {
    const blastersJson = await import("../../data/blasters.json");
    expect(blastersJson.order).toEqual(["B01", "B04", "B03", "B06"]);
  });
});
