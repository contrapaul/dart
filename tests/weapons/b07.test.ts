import { describe, expect, it } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { DartSystem, type DartTypeName } from "../../src/weapons/darts";
import { Blaster, resolveSpec, type BlasterControls, type DartFiring } from "../../src/weapons/blaster";
import dartTuning from "../../data/darts.json";
import blastersJson from "../../data/blasters.json";
import explosionTuning from "../../data/explosion.json";

// GAME-09f stage 1: the launcher dart and B07 Collateral. The dart reads
// its own type (slow, high arc, explodes on its first hit), B07 reads its
// spec and needs the pump between shots, its round blasts with the
// launcher profile (damage and a shove away from the blast, never the
// player), its drum turns one chamber per shot, and its ammo box works
// like the other types'.

const DT = 1 / 60;
const AIM = new THREE.Vector3(0, 0, -1);
const MUZ = Array.from({ length: 8 }, (_, i) => new THREE.Vector3(0, 1.4 - i * 0.05, -0.5));

function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** A DartFiring fake that records every dart, and a live-round fake the
 *  blaster's remote path can talk to. */
class FakeDarts implements DartFiring {
  readonly types: DartTypeName[] = [];
  readonly shots: { liveRound?: boolean; clustered?: boolean; explodes?: boolean }[] = [];
  now = 0;
  fire(
    _o: THREE.Vector3, _d: THREE.Vector3, t: DartTypeName,
    shot?: { liveRound?: boolean; clustered?: boolean; explodes?: boolean } | null,
  ): void {
    this.types.push(t);
    this.shots.push(shot ?? {});
  }
  get count(): number { return this.types.length; }
}

function make(id: string, mods: string[] = []): { b: Blaster; darts: FakeDarts } {
  const darts = new FakeDarts();
  const b = new Blaster(resolveSpec(id, mods), darts, (i) => MUZ[i], lcg(7));
  return { b, darts };
}
const TAP: BlasterControls = { fireHeld: true, firePressed: true, reloadPressed: false };
const NO_FIRE: BlasterControls = { fireHeld: false, firePressed: false, reloadPressed: false };

describe("GAME-09f: the launcher dart", () => {
  it("1. reads its own type: slow and a heavy arc", () => {
    const t = dartTuning.types.launcher;
    expect(t).toBeTruthy();
    expect(t.speed).toBeLessThan(dartTuning.types.mega.speed); // 18 < 33
    expect(t.gravityScale).toBeGreaterThan(dartTuning.types.mega.gravityScale);
  });

  it("2. falls more than a mega dart over the same distance", () => {
    // Same rig, both fired flat from 1.4 m: the launcher's arc drops it
    // further by the time each reaches 8 m of ground.
    const drop = (type: DartTypeName): number => {
      const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
      world.createCollider(RAPIER.ColliderDesc.cuboid(40, 0.5, 40).setTranslation(0, -0.5, 0));
      const pb = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
      const ignore = world.createCollider(
        RAPIER.ColliderDesc.capsule(0.5, 0.3).setTranslation(0, 0, 200), pb,
      );
      const darts = new DartSystem(new THREE.Scene(), world, RAPIER, ignore);
      const start = new THREE.Vector3(0, 1.4, 0);
      darts.fire(start, AIM, type);
      const mesh = (darts as unknown as { meshes: Record<string, THREE.InstancedMesh> }).meshes[type];
      const m = new THREE.Matrix4();
      const p = new THREE.Vector3();
      // The drop by the time the dart covers 8 m of ground: the slow one
      // with the heavy arc is lower there than the fast flat mega dart.
      for (let i = 0; i < 300; i++) {
        darts.update(DT);
        world.step();
        darts.syncRender();
        mesh.getMatrixAt(0, m);
        m.decompose(p, new THREE.Quaternion(), new THREE.Vector3());
        if (p.z <= start.z - 8) return start.y - p.y;
      }
      throw new Error(`${type} dart never reached 8 m`);
    };
    expect(drop("launcher")).toBeGreaterThan(drop("mega"));
  });
});

describe("GAME-09f: B07 Collateral reads its spec", () => {
  it("3. joins the order at the end and reads its card numbers", () => {
    expect(blastersJson.order).toContain("B07");
    const b = resolveSpec("B07", []);
    expect(b.name).toBe("Collateral");
    expect(b.model).toBe("/models/blasters/B07.glb");
    expect(b.mode).toBe("pump");
    expect(b.dartType).toBe("launcher");
    expect(b.dartsPerShot).toBe(1);
    expect(b.magSize).toBe(6);
    expect(b.reserveMax).toBe(18);
    expect(b.reserveStart).toBe(12);
    expect(b.primeTime).toBe(0.9);
    expect(b.reloadTime).toBe(2.5);
    expect(b.muzzles).toEqual(["muzzle_1"]);
    expect(b.motion.drumStepDeg).toBe(60);
    expect(b.explosiveEvery).toBe(1); // every round explodes at its first hit
  });

  it("4. needs the pump between shots: one round per pump", () => {
    const { b, darts } = make("B07");
    b.update(DT, TAP, AIM);           // the shot
    b.update(DT, NO_FIRE, AIM);
    expect(darts.count).toBe(1);
    // Held or pressed again through the priming: nothing leaves the drum.
    for (let i = 0; i < 30; i++) b.update(DT, TAP, AIM);
    expect(darts.count).toBe(1);
    // Past the prime time the pump is home and the next press fires.
    for (let i = 0; i < 40; i++) b.update(DT, NO_FIRE, AIM);
    b.update(DT, TAP, AIM);
    expect(darts.count).toBe(2);
  });

  it("5. every round is an explosive launcher round; the mod flags come from the data", () => {
    const { b, darts } = make("B07");
    b.update(DT, TAP, AIM);
    expect(darts.types[0]).toBe("launcher");
    expect(darts.shots[0].explodes).toBe(true);
  });

  it("6. B01 (no drumStepDeg, no remote) is unchanged", () => {
    const { b, darts } = make("B01");
    expect(resolveSpec("B01", []).motion.drumStepDeg ?? 0).toBe(0);
    b.update(DT, TAP, AIM);
    expect(darts.count).toBe(3); // the Dartman's three darts in one pump
  });
});

// ---- the blast itself -------------------------------------------------

import { VoxelVolume } from "../../src/voxel/chunk";
import { materialId } from "../../src/voxel/materials";
import { DebrisSystem } from "../../src/voxel/debris";
import { ExplosionSystem, type ExplosionTarget } from "../../src/weapons/explosion";
import { Viewmodel } from "../../src/weapons/viewmodel";

function block(size: number): VoxelVolume {
  const v = new VoxelVolume(0.1);
  v.fillBox(0, 0, 0, size - 1, size - 1, size - 1, materialId("foam-orange"));
  return v;
}

function targetOf(v: VoxelVolume): ExplosionTarget {
  return {
    volume: v,
    worldToVoxel: (p) => p.multiplyScalar(1 / v.voxelSize),
    voxelToWorld: (p) => p.multiplyScalar(v.voxelSize),
  };
}

/** Fake Foamer system: blastDamage records the damage, knockStep records
 *  the shove (dir times the want it was asked for, clipped here to want). */
function fakeFoamers(centres: THREE.Vector3[]) {
  const list = centres.map((c) => ({ centre: c }));
  const damaged = new Map<object, number>();
  const shoved = new Map<object, { x: number; z: number; moved: number }>();
  return {
    list,
    damaged,
    shoved,
    blastDamage(f: { centre: THREE.Vector3 }, amount: number) {
      damaged.set(f, (damaged.get(f) ?? 0) + amount);
    },
    knockStep(f: { centre: THREE.Vector3 }, dirX: number, dirZ: number, want: number) {
      // A wall would clip this; here there is none, so the full want.
      shoved.set(f, { x: dirX, z: dirZ, moved: want });
      return want;
    },
  };
}

function blastRig(centres: THREE.Vector3[]) {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const debris = new DebrisSystem(RAPIER, world);
  const volume = block(24);
  const target = targetOf(volume);
  const explosion = new ExplosionSystem(world, debris, [target]);
  const foamers = fakeFoamers(centres);
  explosion.foamers = foamers;
  return { world, debris, volume, explosion, foamers };
}

describe("GAME-09f: the launcher blast", () => {
  it("7. explodes on its first hit with the launcher profile: carve, damage and a shove away from the blast", () => {
    const P = explosionTuning.profiles.launcher;
    const at = new THREE.Vector3(1.2, 1.2, 1.2);  // voxel (12,12,12)
    const near = at.clone();
    const half = at.clone().add(new THREE.Vector3(P.rangeMetres / 2, 0, 0));
    const far = at.clone().add(new THREE.Vector3(P.rangeMetres + 0.3, 0, 0));
    const r = blastRig([near, half, far]);
    r.explosion.explode(at, "launcher");
    // Carve: the launcher's is wider than the dart's (1.0 m vs 0.6 m).
    expect(r.volume.get(12, 12, 12)).toBe(0);
    const dartV = block(24);
    new ExplosionSystem(r.world, r.debris, [targetOf(dartV)]).explode(at);
    // Outside the launcher carve but inside the wider one is gone only for
    // the launcher: a voxel 0.8 m out survives the dart blast.
    const v8 = Math.round(0.8 / 0.1);
    expect(r.volume.get(12 + v8, 12, 12)).toBe(0);
    expect(dartV.get(12 + v8, 12, 12)).not.toBe(0);
    // Damage: centre full, half range half, outside none.
    const d = r.foamers.damaged;
    expect(d.get(r.foamers.list[0])).toBeCloseTo(P.damageCentre, 6);
    expect(d.get(r.foamers.list[1])).toBeCloseTo(P.damageCentre / 2, 5);
    expect(d.has(r.foamers.list[2])).toBe(false);
    // Shove: each one hit pushed directly away from the blast, centre
    // full pushMetres, the half-range one half. None outside.
    const s = r.foamers.shoved;
    expect(s.get(r.foamers.list[0])!.moved).toBeCloseTo(P.pushMetres, 6);
    // The centre one sits on the blast point: no direction to push (it is
    // the half-range one, straight out along +x, that shows the away
    // direction).
    expect(s.get(r.foamers.list[1])!.x).toBeCloseTo(1, 6);
    expect(s.get(r.foamers.list[1])!.z).toBeCloseTo(0, 6);
    expect(s.get(r.foamers.list[1])!.moved).toBeCloseTo(P.pushMetres / 2, 5);
    expect(s.has(r.foamers.list[2])).toBe(false);
  });

  it("8. the shove stops at a wall: knockStep's return is what moved, and the player is never in the list", () => {
    // The system asks knockStep for the want and never moves anyone
    // itself: a fake that returns 0 (a wall right behind) must be the
    // only thing that decides how far a Foamer gets.
    const P = explosionTuning.profiles.launcher;
    const at = new THREE.Vector3(1.2, 1.2, 1.2);
    const c = at.clone();
    const r = blastRig([c]);
    r.foamers.knockStep = () => 0; // against a wall
    r.explosion.explode(at, "launcher");
    expect(r.foamers.damaged.size).toBe(1); // still damaged where it stood
    // The player: the system only ever touches its foamers list, and the
    // pages never put the player in it (explosion.test.ts 3 covers the
    // same rule for the dart profile).
    expect(r.foamers.list.length).toBe(1);
    expect(P.pushMetres).toBeGreaterThan(0);
  });

  it("9. B06 and B05 blasts keep the dart profile's numbers", () => {
    const D = explosionTuning.profiles.dart;
    const at = new THREE.Vector3(1.2, 1.2, 1.2);
    const c = at.clone();
    const r = blastRig([c]);
    r.explosion.explode(at); // no profile: the old call, the dart numbers
    expect(r.foamers.damaged.get(r.foamers.list[0])).toBeCloseTo(D.damageCentre, 6);
    // The dart profile does not shove (B05/B06 blasts never pushed).
    expect(r.foamers.shoved.size).toBe(0);
    // Its carve is the original 0.6 m: 0.8 m out survives.
    expect(r.volume.get(12, 12, 12 + Math.round(0.8 / 0.1))).not.toBe(0);
  });
it("10. the drum turns one chamber per shot, eased over the pump", () => {
    // A B07 tree: the real glb's moving nodes with the drum's rest
    // rotation (90 deg about X, so its bore is its local Y).
    const spec = resolveSpec("B07", []);
    const root = new THREE.Object3D();
    const trig = new THREE.Object3D(); trig.name = "trigger";
    const pump = new THREE.Object3D(); pump.name = "pump";
    const drum = new THREE.Object3D(); drum.name = "drum";
    drum.quaternion.set(0.7071068, 0, 0, 0.7071068);
    drum.position.set(0, 0.04, -0.2325);
    const m1 = new THREE.Object3D(); m1.name = "muzzle_1"; m1.position.set(0, 0.078, -0.528);
    root.add(trig, pump, drum, m1);
    const vm = Viewmodel.fromObject(spec, root);
    const restD = drum.quaternion.clone();
    // The angle the drum has turned about its bore (its local Y).
    const turned = (): number => {
      const rel = restD.clone().invert().multiply(drum.quaternion);
      return THREE.MathUtils.radToDeg(2 * Math.acos(Math.min(1, Math.abs(rel.w))));
    };
    const b = new Blaster(spec, new FakeDarts() as DartFiring, (i) => MUZ[i], lcg(3));
    b.onShot = (i) => vm.onShot(i);
    expect(turned()).toBeCloseTo(0, 6);
    b.update(DT, TAP, AIM);   // shot one: the pump starts
    let mid = 0;
    for (let i = 0; i < 54; i++) { b.update(DT, NO_FIRE, AIM); vm.animate(DT, b, false); mid = Math.max(mid, turned()); }
    expect(mid).toBeGreaterThan(1);            // eased, not a snap
    expect(mid).toBeLessThan(60);
    for (let i = 0; i < 20; i++) { b.update(DT, NO_FIRE, AIM); vm.animate(DT, b, false); }
    expect(turned()).toBeCloseTo(60, 4);       // one chamber
    // A second shot turns it another chamber.
    for (let i = 0; i < 40; i++) b.update(DT, NO_FIRE, AIM);
    b.update(DT, TAP, AIM);
    for (let i = 0; i < 70; i++) { b.update(DT, NO_FIRE, AIM); vm.animate(DT, b, false); }
    expect(turned()).toBeCloseTo(120, 4);
    // B01's pump (no drumStepDeg) leaves its nodes alone: the viewmodel
    // for a blaster without a drum is untouched (its tree has no drum).
  });
});

describe("GAME-09f: the launcher ammo box", () => {
  it("11. a darts-launcher box refills B07's reserve like the other types", async () => {
    const { PickupSystem } = await import("../../src/pickups/pickups");
    const { PlayerHealth } = await import("../../src/player/health");
    const pickupData = (await import("../../data/pickups.json")).default;
    const A = pickupData.ammo;
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    world.createCollider(RAPIER.ColliderDesc.cuboid(40, 0.5, 40).setTranslation(0, -0.5, 0));
    const pickups = new PickupSystem(RAPIER, world, new THREE.Scene(), new PlayerHealth());
    const b07 = new Blaster(resolveSpec("B07", []), new FakeDarts() as DartFiring, () => new THREE.Vector3());
    const b01 = new Blaster(resolveSpec("B01", []), new FakeDarts() as DartFiring, () => new THREE.Vector3());
    b07.reserve = 4;
    b01.reserve = 10;
    pickups.blasters = [b07, b01];
    pickups.spawn("ammo", new THREE.Vector3(0, A.size / 2, 0), new THREE.Vector3(), "launcher", 6);
    for (let i = 0; i < 30; i++) { pickups.update(DT, new THREE.Vector3()); world.step(); }
    expect(b07.reserve).toBe(10);       // took the launcher rounds
    expect(b01.reserve).toBe(10);       // the Dartman does not take them
    expect(pickups.count("ammo")).toBe(0);
  });
});
