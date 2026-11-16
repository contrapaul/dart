import * as THREE from "three";

// The cone a jet of foam cubes leaves in: shared by the leaking barrel
// (ENV-05) and the spurt out of a hit Foamer (FX-spurt). Plain maths with a
// caller's seeded PRNG, never Math.random, and nothing allocated per call.

const _side = new THREE.Vector3();
const _up = new THREE.Vector3();

/** Write into `out` a unit direction inside the cone of half angle
 *  `coneRad` around the unit `axis`, uniform in the solid angle. Takes two
 *  numbers from `rng`. `out` must not be `axis`. Returns `out`. */
export function coneDirection(
  out: THREE.Vector3, axis: THREE.Vector3, coneRad: number, rng: () => number,
): THREE.Vector3 {
  const cosA = 1 - rng() * (1 - Math.cos(coneRad));
  const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
  const az = rng() * Math.PI * 2;
  _side.set(0, 1, 0);
  if (Math.abs(axis.y) > 0.9) _side.set(1, 0, 0);
  _side.crossVectors(axis, _side).normalize();
  _up.crossVectors(axis, _side).normalize();
  return out.copy(axis).multiplyScalar(cosA)
    .addScaledVector(_side, sinA * Math.cos(az))
    .addScaledVector(_up, sinA * Math.sin(az));
}
