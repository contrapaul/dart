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
import type { Foamer } from "../../src/foamers/foamer";
import { PlayerHealth } from "../../src/player/health";
import { PickupSystem } from "../../src/pickups/pickups";
import { Vacuum } from "../../src/game/vacuum";
import vacuumData from "../../data/vacuum.json";

const DT = 1 / 60;
const HV = vacuumData.vacuum;

function fakeMesher(): Mesher {
  const colors = linearColorTable();
  return { mesh: (padded) => Promise.resolve(greedyMesh(padded, colors)) };
}

/** The fake sink: every play and loop the vacuum fires (its sounds go
 *  through the same AudioSink the rest of the tests fake). */
class FakeSink {
  played: string[] = [];
  loops = 0;
  play(id: string): void {
    this.played.push(id);
  }
  loop(_id: string) {
    this.loops++;
    return { set: () => {}, setPosition: () => {}, stop: () => {} };
  }
}

/** World, floor, darts, the Foamer system and the vacuum. The player's
 *  eyes walk in from +z looking -z, as the finisher's rig does. */
function rig() {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.createCollider(RAPIER.ColliderDesc.cuboid(40, 0.5, 40).setTranslation(0, -0.5, 0));
  const scene = new THREE.Scene();
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  const ignore = world.createCollider(
    RAPIER.ColliderDesc.capsule(0.5, 0.3).setTranslation(0, 0, 200), body,
  );
  const darts = new DartSystem(scene, world, RAPIER, ignore);
  const debris = new DebrisSystem(RAPIER, world);
  const targets: VoxelTarget[] = [];
  const foamers = new FoamerSystem(RAPIER, world, fakeMesher(), debris, darts, targets);
  new DartImpacts(darts, debris, targets);
  new PickupSystem(RAPIER, world, scene, new PlayerHealth());
  const sink = new FakeSink();
  const vacuum = new Vacuum(foamers, sink);
  world.step();
  return { world, darts, targets, foamers, sink, vacuum };
}

// The view looks down -z.
const fwd = new THREE.Vector3(0, 0, -1);

/** The eye on the view, d out of the chest (reach is measured eye to
 *  chest, the card's). */
function chestEye(f: Foamer, d: number): THREE.Vector3 {
  return new THREE.Vector3(f.centre.x, f.centre.y + f.height * 0.6, f.centre.z + d);
}

/** Put a Foamer in the finishable stagger: the flag and the stagger the
 *  crossing hit starts. The hit's own path is owned by the finisher's
 *  test (GAME-07); this is the state the vacuum's gate reads. */
function weaken(r: ReturnType<typeof rig>, f: Foamer) {
  f.finishWeakened = true;
  f.state = "stagger";
  f.stateTime = 0;
  f.staggerLong = true;
  f.staggerTime = f.spec.finisher.weakenStaggerTime;
  r.foamers.update(DT, f.centre.clone().add(new THREE.Vector3(0, 0, 5)));
}

beforeAll(async () => {
  await RAPIER.init();
});

describe("GAME-08: the vacuum's target and its charge", () => {
  it("1. reach and cone gate the attempt, and a type without an entry never targets", () => {
    const r = rig();
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 0))!; // F01, allowed
    const out = new THREE.Vector3();
    f.state = "stagger";
    f.finishWeakened = true;
    // On the view, in reach: a target.
    expect(r.vacuum.attempt(f, chestEye(f, 2), fwd, out)).toBe(true);
    // Three-plus out of the chest: past the vacuum's reach of 3 (the
    // finisher's 2.5 fails closer still, so the number is its own).
    expect(r.vacuum.attempt(f, chestEye(f, 3.5), fwd, out)).toBe(false);
    // In reach, but the view looks sideways: off the cone.
    expect(r.vacuum.attempt(f, chestEye(f, 2), new THREE.Vector3(1, 0, 0), out)).toBe(false);
    // The stale gate: not weakened (the finishable band) is no target.
    f.finishWeakened = false;
    expect(r.vacuum.attempt(f, chestEye(f, 2), fwd, out)).toBe(false);
    // And not staggering is no target, either.
    f.finishWeakened = true;
    f.state = "approach";
    expect(r.vacuum.attempt(f, chestEye(f, 2), fwd, out)).toBe(false);
    // A type with no entry in the data is never a target (the heavies
    // come later, with their upgrades): the gate is on the rig id. A
    // stub stands in, since an unknown id falls back to the base spec
    // (which is F01) in the merged one.
    const stub = (rigId: string) =>
      ({ state: "stagger", finishWeakened: true, centre: f.centre,
         height: f.height, spec: { rig: rigId } }) as unknown as Foamer;
    f.state = "stagger";
    expect(r.vacuum.attempt(stub("F06"), chestEye(f, 2), fwd, out)).toBe(false);
    // The three the data allows, each by its own entry.
    expect(r.vacuum.attempt(stub("F05"), chestEye(f, 2), fwd, out)).toBe(true);
    expect(r.vacuum.attempt(stub("F02"), chestEye(f, 2), fwd, out)).toBe(true);
    expect(r.vacuum.attempt(stub("F01"), chestEye(f, 2), fwd, out)).toBe(true);
    // hasTarget is the same gate over every living one.
    expect(r.vacuum.hasTarget(chestEye(f, 2), fwd)).toBe(f);
    f.state = "approach";
    expect(r.vacuum.hasTarget(chestEye(f, 2), fwd)).toBeNull();
  });

  it("2. a weakened Foamer in its stagger offers itself to the vacuum", () => {
    const r = rig();
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 9))!;
    weaken(r, f);
    // In reach and on the view from the eye: a target.
    expect(r.vacuum.hasTarget(chestEye(f, 2.5), fwd)).toBe(f);
  });

  it("3. the charge: one spend, a refill in rechargeSeconds, VC-ready once, a reset", () => {
    const r = rig();
    expect(r.vacuum.ready).toBe(true);
    expect(r.vacuum.chargeFrac).toBe(1);
    // A spend takes the one charge (the pip empties and fills back).
    r.vacuum.spend();
    expect(r.vacuum.ready).toBe(false);
    expect(r.vacuum.chargeFrac).toBe(0);
    // One step, a little of the way back to full.
    r.vacuum.stepCharge(DT);
    expect(r.vacuum.ready).toBe(false);
    expect(r.vacuum.chargeFrac).toBeCloseTo(DT / HV.rechargeSeconds, 5);
    // It fills in rechargeSeconds of steps (a generous margin absorbs
    // the float wobble of the dt), and a little past is still full.
    for (let i = 0; i < Math.ceil(HV.rechargeSeconds / DT) + 2; i++)
      r.vacuum.stepCharge(DT);
    expect(r.vacuum.ready).toBe(true);
    expect(r.vacuum.chargeFrac).toBe(1);
    expect(r.sink.played).toEqual(["VC-ready"]);
    // A step at full stays quiet (the ready is once per top-up).
    r.vacuum.stepCharge(DT);
    expect(r.sink.played.length).toBe(1);
    // A reset (level start or retry) is full, whatever it was on.
    r.vacuum.spend();
    r.vacuum.reset();
    expect(r.vacuum.ready).toBe(true);
    expect(r.vacuum.chargeFrac).toBe(1);
  });
});
