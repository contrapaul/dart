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
import { Loadout } from "../../src/weapons/loadout";
import { Blaster, resolveSpec } from "../../src/weapons/blaster";
import type { BlasterSpec, DartFiring } from "../../src/weapons/blaster";
import type { PlayerController } from "../../src/player/controller";
import vacuumData from "../../data/vacuum.json";

const DT = 1 / 60;
const HV = vacuumData.vacuum;
const SPECS = [resolveSpec("B01"), resolveSpec("B04"), resolveSpec("B03")] as BlasterSpec[];

function fakeMesher(): Mesher {
  const colors = linearColorTable();
  return { mesh: (padded) => Promise.resolve(greedyMesh(padded, colors)) };
}

/** The fake sink: every play and loop the vacuum fires (its sounds go
 *  through the same AudioSink the rest of the tests fake). */
class FakeSink {
  played: string[] = [];
  loops = 0;
  loopsStopped = 0;
  play(id: string): void {
    this.played.push(id);
  }
  loop(_id: string) {
    this.loops++;
    return {
      set: () => {},
      setPosition: () => {},
      stop: () => { this.loopsStopped++; },
    };
  }
}

/** The fake dart fire the real Loadout's blasters share (nothing fires
 *  in the vacuum's tests): the same shape the loadout's own test fakes. */
class NoFire implements DartFiring {
  fire(): void {}
  get n(): number { return 0; }
}

/** The viewmodel face the Loadout drives (the loadout's test's FakeVM,
 *  shaved to the vacuum's needs: no shots, no shots, no muzzles). */
class NoVM {
  setVisible(): void {}
  setMods(): void {}
  muzzleCameraPoint(_i: number, out: THREE.Vector3): THREE.Vector3 { return out; }
  onShot = (): void => {};
  setDip(): void {}
}

/** The real blaster set, built the way the loadout's own test builds
 *  it: each Blaster on its shared no-fire darts, the reserves left at
 *  the data's reserveStart (B01 40/40, B04 105/175, B03 12/24). */
function makeLoadout(): Loadout {
  const darts = new NoFire();
  const ids = ["B01", "B04", "B03"];
  const parts = SPECS.map((spec, i) => ({
    id: ids[i]!,
    blaster: new Blaster(spec, darts, () => new THREE.Vector3()),
    viewmodel: new NoVM(),
  }));
  return new Loadout(parts, darts, 0.35);
}
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
  const pickups = new PickupSystem(RAPIER, world, scene, new PlayerHealth());
  const loadout = makeLoadout();
  const sink = new FakeSink();
  const vacuum = new Vacuum(foamers, loadout, debris, sink);
  const player = { yaw: 0, pitch: 0 } as unknown as PlayerController;
  world.step();
  return { world, darts, targets, foamers, pickups, loadout, sink, vacuum, player };
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

describe("GAME-08: the vacuum's lock and its reward", () => {
  it("4. the lock turns the view, pulls the Foamer in, and removes it with no pop", async () => {
    const r = rig();
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 0))!;
    f.finishWeakened = true;
    f.state = "stagger";
    const eye0 = chestEye(f, 2);
    r.player.yaw = 0.6; // the view starts off target
    expect(r.vacuum.press(eye0, fwd, r.player)).toBe("lock");
    expect(r.vacuum.active).toBe(true);
    expect(f.state).toBe("finish");
    expect(r.sink.played).toEqual(["VC-start"]);
    expect(r.sink.loops).toBe(1); // the suck's loop, started once
    // Step the game's way until the run ends; the view has landed on
    // the Foamer by the end, as the finisher's.
    let steps = 0;
    let taken: unknown = null;
    // The choke that the lock aims at: the suck moves the group (the
    // read of centre), so the view is compared to the choke as it was
    // when the lock began.
    const aim = new THREE.Vector3(f.centre.x, f.centre.y, f.centre.z);
    while (r.vacuum.active && steps++ < 300) {
      taken = r.vacuum.update(DT, r.player);
      r.foamers.update(DT, eye0);
      r.world.step();
    }
    expect(taken).toBe(f);
    expect(steps).toBeGreaterThanOrEqual(Math.ceil(HV.total / DT) - 1);
    expect(steps).toBeLessThanOrEqual(Math.ceil(HV.total / DT) + 1);
    const wantYaw = Math.atan2(-(aim.x - eye0.x), -(aim.z - eye0.z));
    expect(r.player.yaw).toBeCloseTo(wantYaw, 5);
    // Removed, but NOT popped: out of the list, the pop's chunks are
    // not there (the debris's live is unchanged by the run itself: the
    // capped puff is the only debris, and it is a little). The suck's
    // loop is stopped, and the done sound played.
    expect(r.foamers.list).not.toContain(f);
    expect(r.foamers.stats.popped).toBe(0);
    expect(r.sink.played).toContain("VC-done");
    expect(r.sink.loopsStopped).toBe(1);
    // The charge is spent: full again after rechargeSeconds, and its
    // VC-ready lands (a small margin absorbs the float wobble).
    expect(r.vacuum.ready).toBe(false);
    for (let i = 0; i < Math.ceil(HV.rechargeSeconds / DT) + 2; i++)
      r.vacuum.stepCharge(DT);
    expect(r.vacuum.ready).toBe(true);
    expect(r.sink.played).toContain("VC-ready");
  });

  it("5. the reward: reserves rise by the shares and stop at reserveMax", async () => {
    const r = rig();
    const [b01, b04, b03] = r.loadout.blasters; // active B01 (0), then B04, B03
    // B01 is full at start: its rise is capped by its reserveMax, so
    // pull one of the others back to see a full rise; B01's reserve
    // stays where the data puts it.
    b04.reserve = 70;
    b03.reserve = 6;
    const before = [b01.reserve, b04.reserve, b03.reserve];
    // Drop the target under the vacuum and run its lock; the reward
    // credits the type's shares on the way out.
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 0))!;
    f.finishWeakened = true;
    f.state = "stagger";
    const eye0 = chestEye(f, 2);
    expect(r.vacuum.press(eye0, fwd, r.player)).toBe("lock");
    while (r.vacuum.active) {
      r.vacuum.update(DT, r.player);
      r.foamers.update(DT, eye0);
      r.world.step();
    }
    // F01's shares (data/foamers.json): the active blaster takes its
    // 0.5, the others take their 0.25, each rounded up, each capped
    // at its own reserveMax.
    const shares = [0.5, 0.25, 0.25]; // in the loadout's B01, B04, B03 order
    for (let i = 0; i < 3; i++) {
      const b = r.loadout.blasters[i];
      const want = Math.min(
        b.spec.reserveMax - before[i],
        Math.ceil(b.spec.reserveMax * shares[i]!),
      );
      expect(b.reserve).toBe(before[i] + want);
      expect(b.reserve).toBeLessThanOrEqual(b.spec.reserveMax);
    }
    // B04: 70 up by ceil(0.25 * 175) = 44; B03: 6 up by ceil(0.25 * 24) = 6.
    expect(b04.reserve).toBe(70 + 44);
    expect(b03.reserve).toBe(6 + 6);
    // A second vacuum on a fresh charge credits again, still capped.
    expect(r.vacuum.ready).toBe(false); // the lock spent it
  });

  it("6. no charge: the empty sound, no lock, and a target with no entry is never a target", async () => {
    const r = rig();
    // The no charge: spend the one, and the press on an in-reach
    // weakened target only plays the empty sound (the game's use key
    // still consumes the press: press returns "empty", not null).
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 0))!;
    f.finishWeakened = true;
    f.state = "stagger";
    r.vacuum.spend();
    expect(r.vacuum.ready).toBe(false);
    expect(r.vacuum.press(chestEye(f, 2), fwd, r.player)).toBe("empty");
    expect(r.vacuum.active).toBe(false);
    expect(f.state).toBe("stagger"); // not locked
    expect(r.sink.played).toEqual(["VC-empty"]);
    expect(r.foamers.list).toContain(f);
    // And with no target at all (not staggering): press is null, the
    // page keeps its old use (the course's block throw reads the press
    // the game left unconsumed).
    f.state = "approach";
    expect(r.vacuum.press(chestEye(f, 2), fwd, r.player)).toBeNull();
    expect(r.vacuum.active).toBe(false);
    expect(r.sink.played).toEqual(["VC-empty"]); // no new sound
  });
});
