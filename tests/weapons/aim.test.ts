import { beforeAll, describe, expect, it } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { updateAim } from "../../src/weapons/aim";

beforeAll(async () => {
  await RAPIER.init();
});

describe("updateAim", () => {
  // Found in the ENG-13 review: the shot converged on a point 50 m down the
  // view, so from a muzzle below and right of the eye a dart at a Slowmer
  // 6 to 10 m away arrived about 0.2 m low, between its legs.
  it("aims from the muzzle at what the crosshair is on, not 50 m out", () => {
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    // A wall whose face is 4.5 m in front of the eye.
    world.createCollider(RAPIER.ColliderDesc.cuboid(5, 5, 0.5).setTranslation(0, 1.6, -5));
    const player = world.createCollider(RAPIER.ColliderDesc.capsule(0.55, 0.35).setTranslation(0, 0.9, 0));
    world.step();
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(0, 1.6, 0);
    const muzzle = new THREE.Vector3();
    const dir = new THREE.Vector3();
    updateAim(camera, world, player, new THREE.Vector3(0.25, -0.2, -0.5), muzzle, dir);
    // Follow the shot to the wall's face (z = -4.5).
    const t = (-4.5 - muzzle.z) / dir.z;
    const at = muzzle.clone().addScaledVector(dir, t);
    expect(at.x).toBeCloseTo(0, 2);
    expect(at.y).toBeCloseTo(1.6, 2);
  });

  it("still aims 50 m out when the view is open", () => {
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    const player = world.createCollider(RAPIER.ColliderDesc.capsule(0.55, 0.35).setTranslation(0, 0.9, 0));
    world.step();
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(0, 1.6, 0);
    const muzzle = new THREE.Vector3();
    const dir = new THREE.Vector3();
    updateAim(camera, world, player, new THREE.Vector3(0.25, -0.2, -0.5), muzzle, dir);
    const t = (-50 - muzzle.z) / dir.z;
    const at = muzzle.clone().addScaledVector(dir, t);
    expect(at.x).toBeCloseTo(0, 2);
    expect(at.y).toBeCloseTo(1.6, 2);
  });
});
