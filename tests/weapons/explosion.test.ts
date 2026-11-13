import { describe, expect, it } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { VoxelVolume } from "../../src/voxel/chunk";
import { materialId } from "../../src/voxel/materials";
import { DebrisSystem } from "../../src/voxel/debris";
import { DartSystem, type DartTypeName, type DartShot } from "../../src/weapons/darts";
import { DartImpacts } from "../../src/weapons/impacts";
import { ExplosionSystem, type ExplosionTarget } from "../../src/weapons/explosion";
import { DEBRIS_GROUPS } from "../../src/physics/world";
import { Blaster, resolveSpec, type BlasterControls, type DartFiring } from "../../src/weapons/blaster";
import { PlayerHealth } from "../../src/player/health";
import tuning from "../../data/explosion.json";
import destruction from "../../data/destruction.json";

// GAME-09d stage 2: the shared explosion, and B06's explosive mod (every
// 5th mega dart blasts where it first hits). The explosion carves through
// the carve path, damages with a falloff through the non-dart path, never
// touches the player, bursts foam chunks, and obeys its per-second cap.

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

function block(size: number, name = "foam-orange"): VoxelVolume {
  const v = new VoxelVolume(0.1);
  v.fillBox(0, 0, 0, size - 1, size - 1, size - 1, materialId(name));
  return v;
}

/** A volume at the world origin with identity transforms, as a target. */
function targetOf(v: VoxelVolume): ExplosionTarget {
  return {
    volume: v,
    worldToVoxel: (p) => p.multiplyScalar(1 / v.voxelSize),
    voxelToWorld: (p) => p.multiplyScalar(v.voxelSize),
  };
}

interface Blast {
  point: THREE.Vector3;
  carved: number;
  damaged: Map<object, number>;
}

/** A fake Foamer system: list entries are plain { centre } objects the
 *  system hands back to blastDamage, so the test sees who was hit. */
function fakeFoamers(centres: THREE.Vector3[]) {
  const list = centres.map((c) => ({ centre: c }));
  const damaged = new Map<object, number>();
  return {
    list,
    blastDamage(f: { centre: THREE.Vector3 }, amount: number) {
      damaged.set(f, (damaged.get(f) ?? 0) + amount);
    },
    damaged,
  };
}

function rig(centres: THREE.Vector3[] = []) {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const debris = new DebrisSystem(RAPIER, world);
  const volume = block(20);
  const target = targetOf(volume);
  const explosion = new ExplosionSystem(world, debris, [target]);
  const foamers = centres.length ? fakeFoamers(centres) : null;
  if (foamers) explosion.foamers = foamers;
  const blasts: Blast[] = [];
  let carved = 0;
  explosion.onCarve = (_t, removed) => { carved += removed.length; };
  explosion.onExplode = (p) => {
    blasts.push({ point: p.clone(), carved, damaged: foamers ? foamers.damaged : new Map() });
  };
  return { world, debris, volume, target, explosion, blasts, carvedAt: () => carved };
}

describe("GAME-09d: the shared explosion", () => {
  it("1. a blast carves a sphere from the volume through the carve path", () => {
    const r = rig();
    r.explosion.explode(new THREE.Vector3(1.0, 1.0, 1.0)); // voxel (10,10,10)
    expect(r.volume.get(10, 10, 10)).toBe(0);
    // Outside the carve (carveRadius 0.6 m = 6 voxels): still there.
    expect(r.volume.get(10, 10, 17)).not.toBe(0);
    // The carve was reported on the carve hook (the pages drop islands here).
    expect(r.blasts.length).toBe(1);
    expect(r.carvedAt()).toBeGreaterThan(90);
  });

  it("2. damage falls off: the centre takes more than the edge, none outside", () => {
    const c = new THREE.Vector3(5, 1, 1);
    const r = rig([
      new THREE.Vector3(5, 1, 1), // dead centre: damageCentre
      new THREE.Vector3(5 + tuning.profiles.dart.rangeMetres / 2, 1, 1), // half range: half
      new THREE.Vector3(5 + tuning.profiles.dart.rangeMetres + 0.2, 1, 1), // outside: none
    ]);
    r.explosion.explode(c);
    const hits = [...r.blasts[0].damaged.values()];
    expect(hits.length).toBe(2); // the outside Foamer was not asked at all
    const [centre, half] = hits;
    expect(centre).toBeCloseTo(tuning.profiles.dart.damageCentre, 6);
    expect(half).toBeGreaterThan(0);
    expect(half).toBeLessThan(centre / 1.5);
    expect(r.explosion.stats.damage).toBe(2);
  });

  it("3. a blast never damages the player", () => {
    // The system only damages via its foamers hook (which has no player in
    // it) and only pushes debris-group bodies. A player capsule, a
    // player-health object and a crate body all sit in the blast and stay
    // untouched.
    const r = rig();
    const pb = r.world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    const pc = r.world.createCollider(
      RAPIER.ColliderDesc.capsule(0.5, 0.3).setTranslation(1, 1, 1), pb,
    );
    r.explosion.ignore(pc);
    const crateBody = r.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic().setTranslation(1.2, 1, 1),
    );
    // A crate body: a normal (world group) collider, not a debris body.
    r.world.createCollider(RAPIER.ColliderDesc.cuboid(0.1, 0.1, 0.1), crateBody);
    const crateBefore = crateBody.linvel();
    const health = new PlayerHealth();
    const hpBefore = health.hp;
    r.explosion.explode(new THREE.Vector3(1, 1, 1));
    expect(health.hp).toBe(hpBefore);
    const after = crateBody.linvel();
    expect(after.x).toBeCloseTo(crateBefore.x, 6);
    expect(after.y).toBeCloseTo(crateBefore.y, 6);
    expect(after.z).toBeCloseTo(crateBefore.z, 6);
  });

  it("4. the cap holds: more than the cap per second does nothing", () => {
    const r = rig();
    const before = r.volume.get(10, 10, 10);
    expect(before).not.toBe(0);
    for (let i = 0; i < tuning.maxPerSecond + 4; i++)
      r.explosion.explode(new THREE.Vector3(1, 1, 1));
    expect(r.explosion.stats.blasts).toBe(tuning.maxPerSecond);
    expect(r.explosion.stats.dropped).toBe(4);
    expect(r.blasts.length).toBe(tuning.maxPerSecond);
    // A second later the budget is fresh again.
    r.explosion.tick(1.0);
    r.explosion.explode(new THREE.Vector3(1, 1, 1));
    expect(r.explosion.stats.blasts).toBe(tuning.maxPerSecond + 1);
  });

  it("5. a blast bursts foam chunks, under the debris cap", () => {
    const r = rig();
    r.explosion.explode(new THREE.Vector3(1, 1, 1));
    // The burst put chunks in the ring (the ring itself is the cap).
    expect(r.debris.live).toBeGreaterThan(0);
    expect(r.debris.live).toBeLessThanOrEqual(destruction.debris.max);
  });

  it("6. a blast pushes loose debris outward", () => {
    const r = rig();
    // A loose foam chunk as the debris system makes one: dynamic, debris
    // collision group, at rest near the point.
    const size = 0.09;
    const body = r.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic().setTranslation(1.05, 1.0, 1.0),
    );
    r.world.createCollider(
      RAPIER.ColliderDesc.cuboid(size, size, size).setCollisionGroups(DEBRIS_GROUPS),
      body,
    );
    body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    r.explosion.explode(new THREE.Vector3(1, 1, 1));
    const v = body.linvel();
    const outward = Math.hypot(v.x, v.y, v.z);
    expect(outward).toBeGreaterThan(0.1);
    expect(v.x).toBeGreaterThan(0); // pushed away from the point
  });
});

describe("GAME-09d: B06's explosive mod", () => {
  const HOLD: BlasterControls = { fireHeld: true, firePressed: true, reloadPressed: false };

  class FakeDarts implements DartFiring {
    readonly shots: DartShot[] = [];
    fire(_o: THREE.Vector3, _d: THREE.Vector3, _t: DartTypeName, shot?: DartShot): void {
      // A copy at fire time: the blaster reuses one shot object.
      this.shots.push({ ...shot!, muzzle: shot!.muzzle.clone() });
    }
    get count(): number {
      return this.shots.length;
    }
  }

  function autoShots(n: number, mods: string[] = ["explosive"]): DartShot[] {
    const darts = new FakeDarts();
    const spec = resolveSpec("B06", mods);
    const b = new Blaster(spec, darts, (i) => MUZ[i], lcg(3));
    let t = 0;
    while (darts.count < n) { b.update(DT, HOLD, AIM); t += DT; }
    return darts.shots.slice(0, n);
  }

  it("7. with the mod, the 5th, 10th and 15th shot explode and no others", () => {
    const shots = autoShots(16);
    for (let i = 0; i < 16; i++) {
      const nth = i + 1;
      expect(shots[i].explodes, `shot ${nth}`).toBe(nth % 5 === 0);
    }
  });

  it("8. without the mod, no shot explodes", () => {
    const shots = autoShots(8, []);
    expect(shots.every((s) => !s.explodes)).toBe(true);
  });

  it("9. an explosive dart blasts once, on its first hit, whatever it hits", async () => {
    // The real path: DartSystem + DartImpacts wired to the explosion. Fire
    // one tagged dart at a foam floor; the blast runs once at the hit
    // point, and the dart's bounce afterwards never blasts again.
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(40, 0.5, 40).setTranslation(0, -0.5, 0),
    );
    const pb = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    const ignore = world.createCollider(
      RAPIER.ColliderDesc.capsule(0.5, 0.3).setTranslation(0, 0, 200), pb,
    );
    const scene = new THREE.Scene();
    const darts = new DartSystem(scene, world, RAPIER, ignore);
    const debris = new DebrisSystem(RAPIER, world);
    const volume = block(20);
    const target = targetOf(volume);
    const explosion = new ExplosionSystem(world, debris, [target]);
    const dartsImpacts = new DartImpacts(darts, debris, [], explosion);
    expect(dartsImpacts).toBeTruthy();
    const points: THREE.Vector3[] = [];
    let carved = 0;
    explosion.onCarve = (_t, removed) => { carved += removed.length; };
    explosion.onExplode = (p) => points.push(p.clone());
    const shot = { id: 1, muzzle: new THREE.Vector3(0, 1.4, -0.5), chunk: null, explodes: true };
    darts.fire(new THREE.Vector3(1, 1, 1), new THREE.Vector3(0, -1, -0.2), "mega", shot);
    for (let i = 0; i < 120; i++) {
      darts.update(DT);
      world.step();
    }
    expect(points.length).toBe(1);
    expect(points[0].y).toBeLessThan(0.6); // the hit point, near the floor
    // The carve ran at the hit: the blast carved the volume's bottom row.
    expect(carved).toBeGreaterThan(0);
  });

  it("ED-06: onBlast names the profile of every blast, a cluster's too", () => {
    const r = rig();
    const seen: { profile: string; y: number }[] = [];
    r.explosion.onBlast = (p, profile) => seen.push({ profile, y: p.y });
    r.explosion.explode(new THREE.Vector3(1, 1, 1), "launcher");
    expect(seen).toEqual([{ profile: "launcher", y: 1 }]);
    // A clustered blast's four follow-ups run through the same hook, so a
    // page that takes blasts off its breakables never misses one.
    seen.length = 0;
    r.explosion.explode(new THREE.Vector3(1, 1, 1), "dart", true);
    expect(seen).toEqual([{ profile: "dart", y: 1 }]);
    r.explosion.tick(tuning.cluster.delaySeconds);
    expect(seen.length).toBe(5);
    expect(seen.slice(1).every((s) => s.profile === tuning.cluster.profile)).toBe(true);
    // The per-second cap still drops blasts before the hook runs.
    seen.length = 0;
    for (let i = 0; i < tuning.maxPerSecond + 5; i++) {
      r.explosion.explode(new THREE.Vector3(1, 1, 1), "dart");
    }
    expect(seen.length).toBeLessThanOrEqual(tuning.maxPerSecond);
  });
});
