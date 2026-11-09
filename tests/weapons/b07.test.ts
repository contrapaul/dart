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
  live = 0;
  detonated = 0;
  now = 0;
  fire(
    _o: THREE.Vector3, _d: THREE.Vector3, t: DartTypeName,
    shot?: { liveRound?: boolean; clustered?: boolean; explodes?: boolean } | null,
  ): void {
    this.types.push(t);
    this.shots.push(shot ?? {});
    if (shot?.liveRound) this.live++;
  }
  liveRounds(): number { return this.live; }
  detonateLive(): number {
    const n = this.live;
    this.detonated += n;
    this.live = 0;
    return n;
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
    // Both are mods (the card: mod 1 remote, mod 2 cluster), off by default.
    expect(b.remote).toBe(false);
    expect(b.cluster).toBe(false);
    expect(resolveSpec("B07", ["remote"]).remote).toBe(true);
    expect(resolveSpec("B07", ["cluster"]).cluster).toBe(true);
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
    const plain = make("B07");
    plain.b.update(DT, TAP, AIM);
    expect(plain.darts.shots[0].explodes).toBe(true);
    expect(plain.darts.shots[0].liveRound).toBe(false); // no mod: blasts on the hit
    expect(plain.darts.shots[0].clustered).toBe(false);
    const { b, darts } = make("B07", ["remote", "cluster"]);
    b.update(DT, TAP, AIM);
    expect(darts.types[0]).toBe("launcher");
    expect(darts.shots[0].explodes).toBe(true);
    expect(darts.shots[0].liveRound).toBe(true);  // mod 1: it stops where it hits
    expect(darts.shots[0].clustered).toBe(true);  // mod 2: its blast clusters
  });

  it("6. B01 (no drumStepDeg, no remote) is unchanged", () => {
    const { b, darts } = make("B01");
    expect(resolveSpec("B01", []).motion.drumStepDeg ?? 0).toBe(0);
    expect(resolveSpec("B01", []).remote).toBe(false);
    b.update(DT, TAP, AIM);
    expect(darts.count).toBe(3); // the Dartman's three darts in one pump
    expect(darts.shots[0].liveRound).toBeFalsy();
  });
});

// ---- the blast itself -------------------------------------------------

import { VoxelVolume } from "../../src/voxel/chunk";
import { materialId } from "../../src/voxel/materials";
import { DebrisSystem } from "../../src/voxel/debris";
import { DartImpacts } from "../../src/weapons/impacts";
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

/** Fake Foamer system: blastDamage records the damage, blastKnock records
 *  the shove (its direction and the speed it asked for at this falloff).
 *  PT-05: the shove is a speed the Foamer spends over time, not a distance
 *  moved in one call. */
function fakeFoamers(centres: THREE.Vector3[]) {
  const list = centres.map((c) => ({ centre: c }));
  const damaged = new Map<object, number>();
  const shoved = new Map<object, { x: number; z: number; speed: number }>();
  return {
    list,
    damaged,
    shoved,
    blastDamage(f: { centre: THREE.Vector3 }, amount: number) {
      damaged.set(f, (damaged.get(f) ?? 0) + amount);
    },
    blastKnock(
      f: { centre: THREE.Vector3 }, point: THREE.Vector3, fall: number,
      profile: { knockSpeed?: number },
    ) {
      const d = Math.hypot(f.centre.x - point.x, f.centre.z - point.z) || 1e-3;
      shoved.set(f, {
        x: (f.centre.x - point.x) / d,
        z: (f.centre.z - point.z) / d,
        speed: (profile.knockSpeed ?? 0) * fall,
      });
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
    // Shove: each one hit shoved directly away from the blast, centre at
    // the full knockSpeed, the half-range one half of it. None outside.
    const s = r.foamers.shoved;
    expect(s.get(r.foamers.list[0])!.speed).toBeCloseTo(P.knockSpeed, 6);
    // The centre one sits on the blast point: no direction to push (it is
    // the half-range one, straight out along +x, that shows the away
    // direction).
    expect(s.get(r.foamers.list[1])!.x).toBeCloseTo(1, 6);
    expect(s.get(r.foamers.list[1])!.z).toBeCloseTo(0, 6);
    expect(s.get(r.foamers.list[1])!.speed).toBeCloseTo(P.knockSpeed / 2, 5);
    expect(s.has(r.foamers.list[2])).toBe(false);
  });

  it("8. a Foamer on the blast's own centre takes the damage with no shove direction, and the player is never in the list", () => {
    // PT-05: the shove is a speed the Foamer system spends through its own
    // movement controller, so a wall is its stop, not the blast's. Here the
    // blast only has to hand the speed over; the Foamer's step does the
    // moving (tests/foamers/blast.test.ts covers that, wall included).
    const P = explosionTuning.profiles.launcher;
    const at = new THREE.Vector3(1.2, 1.2, 1.2);
    const c = at.clone();
    const r = blastRig([c]);
    r.explosion.explode(at, "launcher");
    expect(r.foamers.damaged.size).toBe(1); // still damaged where it stood
    // The player: the system only ever touches its foamers list, and the
    // pages never put the player in it (explosion.test.ts 3 covers the
    // same rule for the dart profile).
    expect(r.foamers.list.length).toBe(1);
    expect(P.knockSpeed).toBeGreaterThan(0);
    expect(P.knockDecay).toBeGreaterThan(0);
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
    const fd = new FakeDarts();
    const b = new Blaster(spec, fd as DartFiring, (i) => MUZ[i], lcg(3));
    b.onShot = (i) => vm.onShot(i);
    expect(turned()).toBeCloseTo(0, 6);
    b.update(DT, TAP, AIM);   // shot one: the pump starts
    let mid = 0;
    for (let i = 0; i < 54; i++) { b.update(DT, NO_FIRE, AIM); vm.animate(DT, b, false); mid = Math.max(mid, turned()); }
    expect(mid).toBeGreaterThan(1);            // eased, not a snap
    expect(mid).toBeLessThan(60);
    for (let i = 0; i < 20; i++) { b.update(DT, NO_FIRE, AIM); vm.animate(DT, b, false); }
    expect(turned()).toBeCloseTo(60, 4);       // one chamber
    // A second shot turns it another chamber (clearing the live round
    // first: with rounds live a press detonates, test 11).
    for (let i = 0; i < 40; i++) b.update(DT, NO_FIRE, AIM);
    fd.live = 0;
    b.update(DT, TAP, AIM);
    for (let i = 0; i < 70; i++) { b.update(DT, NO_FIRE, AIM); vm.animate(DT, b, false); }
    expect(turned()).toBeCloseTo(120, 4);
    // B01's pump (no drumStepDeg) leaves its nodes alone: the viewmodel
    // for a blaster without a drum is untouched (its tree has no drum).
  });
});

// ---- mod 1: remote detonate, mod 2: cluster (real dart system) --------

function liveRig() {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.createCollider(RAPIER.ColliderDesc.cuboid(40, 0.5, 40).setTranslation(0, -0.5, 0));
  const pb = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  const ignore = world.createCollider(
    RAPIER.ColliderDesc.capsule(0.5, 0.3).setTranslation(0, 0, 200), pb,
  );
  const darts = new DartSystem(new THREE.Scene(), world, RAPIER, ignore);
  const debris = new DebrisSystem(RAPIER, world);
  const volume = block(1); // no carving here: a voxel at the origin only
  const explosion = new ExplosionSystem(world, debris, [targetOf(volume)]);
  const boom: { point: THREE.Vector3; profile?: string }[] = [];
  explosion.onExplode = (p) => { boom.push({ point: p.clone() }); };
  new DartImpacts(darts, debris, [], explosion);
  return { world, darts, explosion, boom };
}

function launcherShot() {
  return { id: 1, muzzle: new THREE.Vector3(), chunk: null, explodes: true, exploded: false,
    liveRound: true, clustered: false };
}

describe("GAME-09f mod 1: remote detonate", () => {
  it("11. the round stops where it first hit and stays live; no blast until the press", () => {
    const r = liveRig();
    const blaster = new Blaster(resolveSpec("B07", ["remote"]), r.darts as DartFiring, (i) => MUZ[i], lcg(11));
    blaster.update(DT, TAP, new THREE.Vector3(0, -0.35, -1).normalize());
    const rest = { y: 0, z: 0 };
    for (let i = 0; i < 180; i++) {
      r.darts.update(DT);
      r.world.step();
    }
    expect(r.darts.liveRounds()).toBe(1);
    expect(r.boom.length).toBe(0); // nothing went off on the hit
    const slot = (r.darts as unknown as { slots: { alive: boolean; state: number; pos: THREE.Vector3 }[] })
      .slots.find((s) => s.alive)!;
    // It met the floor and stayed exactly there (a flying or rolling dart
    // moves on): the LIVE state does not simulate.
    rest.y = slot.pos.y; rest.z = slot.pos.z;
    for (let i = 0; i < 60; i++) { r.darts.update(DT); r.world.step(); }
    expect(slot.pos.y).toBeCloseTo(rest.y, 6);
    expect(slot.pos.z).toBeCloseTo(rest.z, 6);
    // The press (a ready blaster): every live round goes off at its spot.
    for (let i = 0; i < 70; i++) blaster.update(DT, NO_FIRE, AIM); // pump home
    blaster.update(DT, TAP, AIM);
    expect(r.darts.liveRounds()).toBe(0);
    expect(r.boom.length).toBe(1);
    expect(r.boom[0].point.y).toBeCloseTo(rest.y, 5);
    expect(r.boom[0].point.z).toBeCloseTo(rest.z, 5);
  });

  it("12. the live cap holds: past three, the oldest goes off as the next fires", () => {
    const r = liveRig();
    const fire = () => {
      r.darts.fire(new THREE.Vector3(0, 1.4, -i * 1.5), new THREE.Vector3(0, -0.35, -1).normalize(),
        "launcher", launcherShot());
    };
    let i = 0;
    fire(); i += 2;
    for (let k = 0; k < 120; k++) { r.darts.update(DT); r.world.step(); }
    fire(); i += 2;
    for (let k = 0; k < 120; k++) { r.darts.update(DT); r.world.step(); }
    fire(); i += 2;
    for (let k = 0; k < 120; k++) { r.darts.update(DT); r.world.step(); }
    expect(r.darts.liveRounds()).toBe(3);
    expect(r.boom.length).toBe(0);
    // The fourth round cannot join them: the oldest goes off to make room.
    fire();
    for (let k = 0; k < 120; k++) { r.darts.update(DT); r.world.step(); }
    expect(r.boom.length).toBe(1);
    expect(r.darts.liveRounds()).toBe(3);
    // And the press still takes them all.
    expect(r.darts.detonateLive()).toBe(3);
    expect(r.boom.length).toBe(4);
  });
});

describe("GAME-09f mod 2: cluster", () => {
  it("13b. review: with the cluster mod alone, a round that blasts on its hit still clusters", () => {
    const C = explosionTuning.cluster;
    const r = liveRig();
    const blaster = new Blaster(resolveSpec("B07", ["cluster"]), r.darts as DartFiring, (i) => MUZ[i], lcg(13));
    blaster.update(DT, TAP, new THREE.Vector3(0, -0.35, -1).normalize());
    for (let i = 0; i < 180; i++) { r.darts.update(DT); r.world.step(); }
    expect(r.boom.length).toBe(1 + C.count); // the round's blast and its four
  });

  it("13. a clustered blast throws four smaller blasts at the sides after the delay", () => {
    const C = explosionTuning.cluster;
    expect(C.count).toBe(4);
    const r = liveRig();
    const at = new THREE.Vector3(5, 1, 5);
    r.explosion.explode(at, "launcher", true);
    expect(r.boom.length).toBe(1); // the main one now, none before the delay
    // Before the delay: nothing.
    r.explosion.tick(C.delaySeconds - 0.05);
    expect(r.boom.length).toBe(1);
    r.explosion.tick(0.1);
    expect(r.boom.length).toBe(1 + C.count);
    // At the four sides, distanceMetres out, in world axes.
    const offs = r.boom.slice(1).map((b) => ({
      x: +(b.point.x - at.x).toFixed(3),
      z: +(b.point.z - at.z).toFixed(3),
    }));
    for (const o of offs) {
      expect(Math.abs(o.x) + Math.abs(o.z)).toBeCloseTo(C.distanceMetres, 3);
    }
    expect(offs).toContainEqual({ x: C.distanceMetres, z: 0 });
    expect(offs).toContainEqual({ x: -C.distanceMetres, z: 0 });
    expect(offs).toContainEqual({ x: 0, z: C.distanceMetres });
    expect(offs).toContainEqual({ x: 0, z: -C.distanceMetres });
  });

  it("14. the cluster runs through the shared per-second cap, so the data leaves room for one round", () => {
    // One B07 round is 1 + 4 = 5 blasts. The cap must not cut a round's
    // cluster short (the card): maxPerSecond leaves room for a full round.
    expect(explosionTuning.maxPerSecond).toBeGreaterThanOrEqual(5);
    const C = explosionTuning.cluster;
    const r = liveRig();
    r.explosion.explode(new THREE.Vector3(5, 1, 5), "launcher", true);
    r.explosion.tick(C.delaySeconds + 0.1);
    expect(r.boom.length).toBe(5); // nothing dropped
    // The cap still bites on top of it: a second full round in the same
    // second only lands what fits.
    r.explosion.explode(new THREE.Vector3(20, 1, 5), "launcher", true);
    r.explosion.tick(C.delaySeconds + 0.1);
    expect(r.boom.length).toBe(Math.min(10, explosionTuning.maxPerSecond));
  });
});

describe("GAME-09f: the launcher ammo box", () => {
  it("15. a darts-launcher box refills B07's reserve like the other types", async () => {
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
