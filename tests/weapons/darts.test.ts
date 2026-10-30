import { beforeAll, describe, expect, it } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { DartSystem } from "../../src/weapons/darts";
import tuning from "../../data/darts.json";

const DT = 1 / 60;

// The compat build runs in Node with a plain Scene and a real Rapier world.
// No renderer is needed; the instance matrices are just layouts.

/** Scene, world and a DartSystem that ignores one body-attached collider. */
function make(rapier: typeof RAPIER) {
  const scene = new THREE.Scene();
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const body = world.createRigidBody(rapier.RigidBodyDesc.fixed());
  const ignore = world.createCollider(rapier.ColliderDesc.capsule(0.5, 0.3), body);
  return { scene, world, system: new DartSystem(scene, world, rapier, ignore) };
}

/** A fixed cuboid wall, wide and tall, front face at z = -5. */
function addWall(world: RAPIER.World, halfDepth = 0.5, z = -5 - halfDepth) {
  world.createCollider(RAPIER.ColliderDesc.cuboid(20, 12, halfDepth).setTranslation(0, 4, z));
}

function addFloor(world: RAPIER.World) {
  world.createCollider(RAPIER.ColliderDesc.cuboid(40, 0.5, 40).setTranslation(0, -0.5, 0));
}

/** World position of instance 0 of a given type's InstancedMesh. */
function firstDartPos(system: DartSystem, type: "suction" | "standard") {
  const mesh = (system as unknown as { meshes: Record<string, THREE.InstancedMesh> }).meshes[type];
  const m = new THREE.Matrix4();
  mesh.getMatrixAt(0, m);
  const p = new THREE.Vector3();
  m.decompose(p, new THREE.Quaternion(), new THREE.Vector3());
  return p;
}

beforeAll(async () => {
  await RAPIER.init();
});

describe("DartSystem", () => {
  it("1. a standard dart fired horizontally at 38 m/s drops under 0.15 m over 10 m", () => {
    const { world, system } = make(RAPIER);
    world.step(); // wake the world so queries are ready before the first cast
    const start = new THREE.Vector3(0, 2, 0);
    system.fire(start, new THREE.Vector3(0, 0, -1), "standard");
    let z10: THREE.Vector3 | null = null;
    for (let i = 0; i < 120 && !z10; i++) {
      system.update(DT);
      world.step();
      system.syncRender();
      const p = firstDartPos(system, "standard");
      if (p.z <= start.z - 10) z10 = p;
    }
    expect(z10, "dart travelled past the 10 m mark").not.toBeNull();
    expect(z10!.y).toBeGreaterThanOrEqual(start.y - 0.15);
  });

  it("2. a dart fired at a wall 5 m away calls onHit exactly once, with the hit point on the face and the normal facing back", () => {
    const { world, system } = make(RAPIER);
    addWall(world);
    world.step();
    const hits: { point: THREE.Vector3; normal: THREE.Vector3 }[] = [];
    system.onHit = (h) => hits.push({ point: h.point.clone(), normal: h.normal.clone() });
    system.fire(new THREE.Vector3(0, 2, 0), new THREE.Vector3(0, 0, -1), "standard");
    for (let i = 0; i < 120; i++) {
      system.update(DT);
      world.step();
      if (hits.length > 0) break;
    }
    expect(hits.length).toBe(1);
    expect(Math.abs(hits[0].point.z - -5)).toBeLessThan(0.02);
    expect(hits[0].normal.z).toBeGreaterThan(0.9);
    const backToward = new THREE.Vector3(0, 2, 6).sub(hits[0].point).normalize();
    expect(hits[0].normal.dot(backToward)).toBeGreaterThan(0.7);
  });

  it("3. a suction dart stuck to the wall does not move over 60 more steps", () => {
    const { world, system } = make(RAPIER);
    addWall(world);
    world.step();
    system.fire(new THREE.Vector3(0, 2, 0), new THREE.Vector3(0, 0, -1), "suction");
    for (let i = 0; i < 120 && system.stats().stuck < 1; i++) {
      system.update(DT);
      world.step();
    }
    expect(system.stats().stuck).toBe(1);
    system.syncRender();
    const p0 = firstDartPos(system, "suction");
    for (let i = 0; i < 60; i++) {
      system.update(DT);
      world.step();
      system.syncRender();
      expect(firstDartPos(system, "suction").distanceTo(p0)).toBeLessThan(1e-6);
    }
  });

  it("4. a suction dart stuck to a dynamic box follows the box through setTranslation and setRotation", () => {
    const { world, system } = make(RAPIER);
    // The box is off to the side: the make() ignore capsule sits at the origin
    // and the contact solver would shove a box resting on top of it.
    const box = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(3, 1, 0));
    world.createCollider(RAPIER.ColliderDesc.cuboid(0.5, 0.5, 2), box);
    world.step();
    system.fire(new THREE.Vector3(3, 1, 3), new THREE.Vector3(0, 0, -1), "suction");
    for (let i = 0; i < 120 && system.stats().stuck < 1; i++) {
      system.update(DT);
      world.step();
    }
    expect(system.stats().stuck).toBe(1);
    // A dynamic box falls under the test world's gravity. Hold it in place by
    // zeroing its velocity and re-asserting its position before each step; the
    // residual integration error is under 2 mm per step, inside the tolerance.
    const hold = () => {
      const t = box.translation();
      box.setLinvel({ x: 0, y: 0, z: 0 }, false);
      box.setTranslation({ x: t.x, y: t.y, z: t.z }, false);
    };
    hold();
    system.update(DT);
    world.step();
    system.syncRender();
    const dartA = firstDartPos(system, "suction");
    const boxA = box.translation();
    const offset = new THREE.Vector3(dartA.x - boxA.x, dartA.y - boxA.y, dartA.z - boxA.z);

    // Translation: the dart must move by exactly the box's displacement.
    hold();
    const d = new THREE.Vector3(2, 0, 0);
    box.setTranslation({ x: boxA.x + d.x, y: boxA.y, z: boxA.z }, true);
    system.update(DT);
    world.step();
    system.syncRender();
    expect(firstDartPos(system, "suction").distanceTo(dartA.clone().add(d))).toBeLessThan(0.02);

    // Rotation: a 90-degree turn about the box's Y axis pivots the dart
    // around the box centre.
    hold();
    const r = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
    box.setRotation(r, true);
    system.update(DT);
    world.step();
    system.syncRender();
    const expected = offset.clone().applyQuaternion(r).add(box.translation());
    expect(firstDartPos(system, "suction").distanceTo(expected)).toBeLessThan(0.02);
  });

  it("5. firing maxStuck + 10 suction darts at the wall leaves exactly maxStuck stuck", () => {
    const { world, system } = make(RAPIER);
    addWall(world);
    world.step();
    const n = tuning.maxStuck + 10;
    for (let i = 0; i < n; i++) system.fire(new THREE.Vector3(0, 2, 0), new THREE.Vector3(0, 0, -1), "suction");
    for (let i = 0; i < 300 && system.stats().flying > 0; i++) {
      system.update(DT);
      world.step();
    }
    expect(system.stats().stuck).toBe(tuning.maxStuck);
    expect(system.stats().flying).toBe(0);
  });

  it("6. a standard dart fired down at a floor ends up resting", () => {
    const { world, system } = make(RAPIER);
    addFloor(world);
    world.step();
    system.fire(new THREE.Vector3(0, 3, 0), new THREE.Vector3(0, -1, 0), "standard");
    for (let i = 0; i < 600 && system.stats().resting < 1; i++) {
      system.update(DT);
      world.step();
    }
    expect(system.stats().resting).toBe(1);
    system.syncRender();
    const p = firstDartPos(system, "standard");
    expect(p.y).toBeGreaterThanOrEqual(0);
    expect(p.y).toBeLessThan(0.1);
  });

  it("7. the ignore collider is never hit: firing from inside the player capsule reaches the wall", () => {
    const { world, system: _unused } = make(RAPIER);
    addWall(world);
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, 2, 0));
    const capsule = world.createCollider(RAPIER.ColliderDesc.capsule(0.5, 0.5), body);
    const system = new DartSystem(new THREE.Scene(), world, RAPIER, capsule);
    world.step();
    const hits: RAPIER.Collider[] = [];
    system.onHit = (h) => hits.push(h.collider);
    system.fire(new THREE.Vector3(0, 2, 0), new THREE.Vector3(0, 0, -1), "standard");
    for (let i = 0; i < 120; i++) {
      system.update(DT);
      world.step();
      if (hits.length > 0) break;
    }
    expect(hits.length).toBe(1);
    expect(hits[0]).not.toBe(capsule);
    const t = hits[0].translation();
    expect(t.z).toBeLessThan(-4); // the wall face is at z = -5, the capsule at z = 0
  });
  it("8. a dart stuck to an already rotated body keeps pointing along its flight", () => {
    const { world, system } = make(RAPIER);
    const turn = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.4, 0.8, 0.3));
    const box = world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(3, 1, 0).setRotation(turn),
    );
    world.createCollider(RAPIER.ColliderDesc.cuboid(1, 1, 1), box);
    world.step();
    system.fire(new THREE.Vector3(3, 1, 4), new THREE.Vector3(0, 0, -1), "suction");
    for (let i = 0; i < 120 && system.stats().stuck < 1; i++) {
      system.update(DT);
      world.step();
    }
    expect(system.stats().stuck).toBe(1);
    system.update(DT);
    system.syncRender();
    const mesh = (system as unknown as { meshes: Record<string, THREE.InstancedMesh> }).meshes.suction;
    const m = new THREE.Matrix4();
    mesh.getMatrixAt(0, m);
    const q = new THREE.Quaternion();
    m.decompose(new THREE.Vector3(), q, new THREE.Vector3());
    const axis = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
    expect(axis.distanceTo(new THREE.Vector3(0, 0, -1))).toBeLessThan(0.01);
  });
});
