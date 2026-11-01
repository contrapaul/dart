// The muzzle and aim point the blaster shoots from, shared by the game page
// and the test range page (ENG-11). The same math the game page ran inline
// in its update step; both pages reuse it through one set of scratch
// vectors and one ray, so a step allocates nothing.
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { SOLID_QUERY_GROUPS } from "../physics/world";

const EXCLUDE_SENSORS = 8;

/** One shared ray, re-aimed per call. */
const ray = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -1 });
/** Scratch: offset of the muzzle from the camera, unit after the pull back. */
const _toMuzzle = new THREE.Vector3();
/** Scratch: the camera's forward at this moment. */
const _dir = new THREE.Vector3();
/** Scratch: the aim point 50 m down the view. */
const _aim = new THREE.Vector3();

/**
 * Where a blaster shoots from and where it aims.
 *
 * The muzzle starts at camera-local [mx, my, mz] (the spec's muzzle). Up
 * against a wall it sits inside the geometry, so it is ray-cast back to
 * just in front of the surface: a dart starting inside a solid would never
 * leave the cannon. The aim is 50 m down the view, and the shot direction
 * is from the muzzle to that point.
 *
 * Pass your own vectors for the results; they are filled in place, nothing
 * is allocated.
 */
export function updateAim(
  camera: THREE.Camera,
  world: RAPIER.World,
  playerCollider: RAPIER.Collider,
  muzzleCam: THREE.Vector3,
  muzzle: THREE.Vector3,
  aimDir: THREE.Vector3,
): void {
  camera.updateMatrixWorld();
  muzzle.copy(muzzleCam);
  camera.localToWorld(muzzle);
  _toMuzzle.subVectors(muzzle, camera.position);
  const muzzleDist = _toMuzzle.length();
  ray.origin = camera.position;
  ray.dir = _toMuzzle.divideScalar(Math.max(muzzleDist, 1e-9));
  const blocked = world.castRay(
    ray, muzzleDist, true, EXCLUDE_SENSORS, SOLID_QUERY_GROUPS, playerCollider,
  );
  if (blocked)
    muzzle.copy(camera.position).addScaledVector(_toMuzzle, Math.max(0, blocked.timeOfImpact - 0.02));
  camera.getWorldDirection(_dir);
  _aim.copy(camera.position).addScaledVector(_dir, 50);
  aimDir.subVectors(_aim, muzzle).normalize();
}
