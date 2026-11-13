import { beforeAll, describe, expect, it } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { DebrisSystem } from "../../src/voxel/debris";
import { ExplosionSystem } from "../../src/weapons/explosion";
import { Barrels } from "../../src/level/barrels";
import { FUSE_SECONDS } from "../../src/level/barrel-fuse";
import type { DartHit } from "../../src/weapons/darts";
import barrel from "../../data/barrel.json";
import destruction from "../../data/destruction.json";
import explosionJson from "../../data/explosion.json";

// ENV-05 (E15): the barrel system. A standard dart punctures and the leak
// sprays; the spray never outruns its own rate and stops with the barrel;
// the barrel profile blasts once, big.

const DT = 1 / 60;

interface Rig {
  world: RAPIER.World;
  debris: DebrisSystem;
  explosion: ExplosionSystem;
  barrels: Barrels;
  blastCalls: { point: THREE.Vector3; radius: number }[];
  goneCalls: { centre: THREE.Vector3; radius: number }[];
}

function rig(places: [number, number, number][] = [[0, 0, 0]]): Rig {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const debris = new DebrisSystem(RAPIER, world);
  const explosion = new ExplosionSystem(world, debris, []);
  const scene = new THREE.Scene();
  const barrels = new Barrels(
    RAPIER, world, scene, debris, explosion, places.map((pos) => ({ pos })),
  );
  const blastCalls: { point: THREE.Vector3; radius: number }[] = [];
  explosion.onExplode = (point, radius) => {
    blastCalls.push({ point: point.clone(), radius });
    barrels.onBlast(point, radius);
  };
  const goneCalls: { centre: THREE.Vector3; radius: number }[] = [];
  barrels.onGone = (centre, radius) => goneCalls.push({ centre: centre.clone(), radius });
  return { world, debris, explosion, barrels, blastCalls, goneCalls };
}

/** A hit on a barrel's own collider, at a point on its side. */
function hitOn(collider: RAPIER.Collider, type: string, normal = new THREE.Vector3(1, 0, 0)): DartHit {
  return {
    point: new THREE.Vector3(0.3, 0.45, 0),
    normal: normal.clone(),
    direction: new THREE.Vector3(-1, 0, 0),
    speed: 40,
    type: type as DartHit["type"],
    collider,
    material: null,
    shot: null,
    foamerKey: null,
  };
}

/** The barrels' own colliders, in placement order: a blast leaves debris
 *  pieces in the world too, so only the cylinders count as barrels. */
function colliders(world: RAPIER.World): RAPIER.Collider[] {
  const out: RAPIER.Collider[] = [];
  world.forEachCollider((c) => {
    if (c.shape.type === RAPIER.ShapeType.Cylinder) out.push(c);
  });
  return out;
}

let rapierReady = false;
beforeAll(async () => {
  await RAPIER.init();
  rapierReady = true;
});

describe("ENV-05 the barrel system", () => {
  it("builds one solid barrel per placement, and darts meet it", () => {
    expect(rapierReady).toBe(true);
    const r = rig([[2, 0, -3], [-4, 0, 6]]);
    expect(r.barrels.centres.length).toBe(2);
    const centre = r.barrels.centres[0]!;
    expect(centre.x).toBeCloseTo(2, 6);
    expect(centre.z).toBeCloseTo(-3, 6);
    // The cylinder stands on the floor: its centre is half its height up.
    expect(centre.y).toBeCloseTo(barrel.look.heightMetres / 2, 6);
    expect(colliders(r.world).length).toBe(2);
    // Rapier's query pipeline sees a collider one step after it is added.
    r.world.step();
    // A ray from the side at barrel height meets one of them.
    const hit = r.world.castRay(
      new RAPIER.Ray({ x: 6, y: 0.45, z: -3 }, { x: -1, y: 0, z: 0 }), 10, true,
    );
    expect(hit).not.toBeNull();
  });

  it("a standard dart punctures without setting it off, and starts the leak", () => {
    const r = rig();
    const c = colliders(r.world)[0]!;
    r.barrels.hit(hitOn(c, "standard"));
    expect(r.barrels.stats.punctures).toBe(1);
    expect(r.barrels.stats.setOff).toBe(0);
    expect(r.blastCalls.length).toBe(0);
    // A second of spray throws cubes, all through the debris ring.
    for (let i = 0; i < 60; i++) r.barrels.update(DT);
    expect(r.barrels.stats.cubes).toBeGreaterThan(0);
    expect(r.debris.live).toBeLessThanOrEqual(destruction.debris.max);
    expect(r.blastCalls.length).toBe(0);
  });

  it("the spray never adds more cubes in a step than its rate allows", () => {
    const r = rig();
    const c = colliders(r.world)[0]!;
    // Three punctures: the first two leaks stay open, and the third would
    // set it off, so use two and check the shared rate for one step.
    r.barrels.hit(hitOn(c, "standard"));
    r.barrels.hit(hitOn(c, "standard", new THREE.Vector3(0, 0, 1)));
    const before = r.barrels.stats.cubes;
    r.barrels.update(DT);
    const oneStep = r.barrels.stats.cubes - before;
    const rate = barrel.spray.cubesPerSecond * 2;
    // Two leaks, each its own counter, so at most ceil each, plus the
    // fractional carry of the first step: under rate * dt + 2.
    expect(oneStep).toBeLessThanOrEqual(rate * DT + 2);
    // And over a second, no more than the two leaks' rate can throw.
    for (let i = 0; i < 59; i++) r.barrels.update(DT);
    const overSecond = r.barrels.stats.cubes - before;
    expect(overSecond).toBeLessThanOrEqual(rate + 2);
  });

  it("the spray stops the step the barrel goes", () => {
    const r = rig();
    const c = colliders(r.world)[0]!;
    r.barrels.hit(hitOn(c, "standard"));
    for (let i = 0; i < 30; i++) r.barrels.update(DT);
    expect(r.barrels.stats.cubes).toBeGreaterThan(0);
    // A second round takes it out; from then on no more cubes are added.
    r.barrels.hit(hitOn(c, "mega"));
    const stopped = r.barrels.stats.cubes;
    for (let i = 0; i < 120; i++) r.barrels.update(DT);
    expect(r.barrels.stats.cubes).toBe(stopped);
  });

  it("a barrel with no leak throws nothing", () => {
    const r = rig();
    for (let i = 0; i < 60; i++) r.barrels.update(DT);
    expect(r.barrels.stats.cubes).toBe(0);
    expect(r.debris.live).toBe(0);
  });

  it("a mega dart sets it off at once: one blast, in the barrel profile", () => {
    const r = rig();
    const c = colliders(r.world)[0]!;
    r.barrels.hit(hitOn(c, "mega"));
    expect(r.blastCalls.length).toBe(1);
    expect(r.blastCalls[0]!.radius).toBeCloseTo(explosionJson.profiles.barrel.fxRadius, 6);
    expect(r.blastCalls[0]!.point.y).toBeGreaterThan(0);
    expect(r.barrels.stats.setOff).toBe(1);
    // The barrel is gone: no centre, and its collider is gone with it.
    expect(r.barrels.centres.length).toBe(0);
    expect(colliders(r.world).length).toBe(0);
    // Nothing more happens to it.
    r.barrels.hit(hitOn(c, "standard"));
    for (let i = 0; i < 300; i++) r.barrels.update(DT);
    expect(r.blastCalls.length).toBe(1);
    expect(r.barrels.stats.cubes).toBe(0);
  });

  it("a ball and a precision dart set it off at once too", () => {
    for (const type of ["ball", "precision"]) {
      const r = rig();
      r.barrels.hit(hitOn(colliders(r.world)[0]!, type));
      expect(r.blastCalls.length).toBe(1);
      expect(r.barrels.centres.length).toBe(0);
    }
  });

  it("three standard darts in one step set it off at once", () => {
    const r = rig();
    const c = colliders(r.world)[0]!;
    for (let i = 0; i < 3; i++) r.barrels.hit(hitOn(c, "standard"));
    expect(r.blastCalls.length).toBe(1);
    expect(r.barrels.centres.length).toBe(0);
  });

  it("the fuse runs out on its own at the data's seconds", () => {
    const r = rig();
    r.barrels.hit(hitOn(colliders(r.world)[0]!, "standard"));
    let steps = 0;
    const max = Math.round(FUSE_SECONDS / DT) + 5;
    while (r.blastCalls.length === 0 && steps < max) {
      r.barrels.update(DT);
      steps++;
    }
    expect(r.blastCalls.length).toBe(1);
    expect(steps).toBeGreaterThanOrEqual(Math.round(FUSE_SECONDS / DT));
    // Exactly once, however many steps follow.
    for (let i = 0; i < 120; i++) r.barrels.update(DT);
    expect(r.blastCalls.length).toBe(1);
  });

  it("a blast reaching a barrel sets it off after the chain delay", () => {
    const r = rig();
    // A blast from the explosion system, not from a dart.
    r.explosion.explode(new THREE.Vector3(0.8, 0.45, 0), "dart");
    expect(r.barrels.centres.length).toBe(1);
    r.barrels.update(DT);
    // Still standing a step after the blast: the chain waits.
    expect(r.barrels.centres.length).toBe(1);
    r.barrels.update(barrel.chainDelay + 0.01);
    expect(r.barrels.centres.length).toBe(0);
    // The blast was the dart's own plus the barrel's one, never two more.
    expect(r.blastCalls.length).toBe(2);
    expect(r.blastCalls[1]!.radius).toBeCloseTo(explosionJson.profiles.barrel.fxRadius, 6);
  });

  it("a blast out of reach leaves the barrel alone", () => {
    const r = rig();
    r.explosion.explode(new THREE.Vector3(20, 0.45, 0), "dart");
    for (let i = 0; i < 120; i++) r.barrels.update(DT);
    expect(r.barrels.centres.length).toBe(1);
    expect(r.blastCalls.length).toBe(1);
  });

  it("a row of barrels ripples: the first blast chains into the next", () => {
    // 3 m apart: inside one blast's 3.9 m chain reach (3.6 + 0.3), so the
    // first blast takes the second, and only the second's blast takes the
    // third. A step per link is what makes the row ripple.
    const r = rig([[0, 0, 0], [3, 0, 0], [6, 0, 0]]);
    const first = colliders(r.world)[0]!;
    r.barrels.hit(hitOn(first, "mega"));
    expect(r.blastCalls.length).toBe(1);
    expect(r.barrels.centres.length).toBe(2);
    // Each chain takes the delay, so the ripple is not one step.
    r.barrels.update(barrel.chainDelay + 0.01);
    expect(r.barrels.centres.length).toBe(1);
    r.barrels.update(barrel.chainDelay + 0.01);
    expect(r.barrels.centres.length).toBe(0);
    expect(r.blastCalls.length).toBe(3);
  });

  it("says where a barrel went, so a page can free the darts in it", () => {
    const r = rig();
    r.barrels.hit(hitOn(colliders(r.world)[0]!, "mega"));
    expect(r.goneCalls.length).toBe(1);
    const g = r.goneCalls[0]!;
    expect(g.centre.y).toBeCloseTo(barrel.look.heightMetres / 2, 6);
    expect(g.radius).toBeGreaterThan(barrel.look.diameterMetres / 2);
  });

  it("acts on its own collider only: a hit on something else does nothing", () => {
    const r = rig();
    const other = r.world.createCollider(
      RAPIER.ColliderDesc.cuboid(1, 1, 1).setTranslation(0, 6, 0),
    );
    r.barrels.hit(hitOn(other, "standard"));
    expect(r.barrels.stats.punctures).toBe(0);
    expect(r.barrels.stats.setOff).toBe(0);
    expect(r.blastCalls.length).toBe(0);
  });

  it("reset puts the barrels back fresh", () => {
    const r = rig([[0, 0, 0], [2, 0, 0]]);
    const c = colliders(r.world)[0]!;
    r.barrels.hit(hitOn(c, "mega"));
    expect(r.barrels.centres.length).toBe(1);
    expect(colliders(r.world).length).toBe(1);
    r.barrels.reset();
    expect(r.barrels.centres.length).toBe(2);
    expect(colliders(r.world).length).toBe(2);
    // A reset barrel is fresh: one puncture, no blast.
    const before = r.blastCalls.length;
    r.barrels.hit(hitOn(colliders(r.world)[0]!, "standard"));
    expect(r.blastCalls.length).toBe(before);
  });
});
