import * as THREE from "three";
import foamerData from "../../data/foamers.json";
import playerJson from "../../data/player.json";

// BUG-02: the watch's time to impact. The old parryNext estimate was the
// straight-line distance over the speed, but a Roamer's ball is a lob under
// gravity (projectiles.ts): the straight line says when the ball's flat
// speed would get it there, not when the arc does. This steps a copy of
// the ball's position and velocity forward with the same gravity and the
// same size of a step as ProjectileSystem.update (semi-implicit: the
// velocity changes first, then the step) and returns the first step at
// which the ball's own one-step ray would touch the player's capsule.
//
// The sweep match: each step is a segment from old to new position
// (one ray's length, the sim's own); the sim casts a ray along it against
// the capsule, so the flight is a hit when that segment comes within
// (capsule radius + ball radius) of the capsule's spine. Until then the
// two are the same test.

const BALL = foamerData.test.ball;
const P = playerJson as unknown as { height: number; radius: number; eyeHeight: number };

/** The ball's radius (data/foamers.json `ball.radius`). */
export const BALL_RADIUS = BALL.radius;
/** The ball's gravity (the data's; the sim's update uses it too). */
export const BALL_GRAVITY = BALL.gravity;
/** The capsule spine's half length from its centre (data/player.json). */
export const CAPSULE_SPINE_HALF = P.height / 2 - P.radius;
/** The capsule's radius (data/player.json). */
export const CAPSULE_RADIUS = P.radius;
/** How many metres the player's eye is above the capsule's centre. All
 *  the callers that know only the eye (the controller keeps its centre
 *  private) get the centre from this. */
export const EYE_ABOVE_CENTRE = P.eyeHeight - P.height / 2;

/** The capsule's centre from the player's eye, into out. */
export function playerCapsuleCentre(eye: THREE.Vector3, out: THREE.Vector3): THREE.Vector3 {
  return out.set(eye.x, eye.y - EYE_ABOVE_CENTRE, eye.z);
}

/** The seconds until the ball (its position and velocity) first comes
 *  within a hit of the player's capsule (its centre), stepped by `dt`
 *  with the data's ball gravity; or Infinity when no step within `maxSec`
 *  does. It touches neither ball nor body. */
export function timeToImpact(
  pos: THREE.Vector3,
  vel: THREE.Vector3,
  dt: number,
  capsuleCentre: THREE.Vector3,
  gravity = BALL_GRAVITY,
  ballRadius = BALL_RADIUS,
  maxSec = 5,
): number {
  const p = pos.clone();
  const v = vel.clone();
  // The spine's ends (the capsule's axis: the centre, by the spine's half
  // length, up and down).
  const b0x = capsuleCentre.x, b0y = capsuleCentre.y - CAPSULE_SPINE_HALF, b0z = capsuleCentre.z;
  const b1x = capsuleCentre.x, b1y = capsuleCentre.y + CAPSULE_SPINE_HALF, b1z = capsuleCentre.z;
  const reach = CAPSULE_RADIUS + ballRadius;
  const reach2 = reach * reach;
  let t = 0; // seconds, in the sim's own steps
  while (t < maxSec) {
    const ox = p.x, oy = p.y, oz = p.z;
    v.y -= gravity * dt;
    p.addScaledVector(v, dt);
    t += dt;
    if (segmentDistanceSq(ox, oy, oz, p.x, p.y, p.z, b0x, b0y, b0z, b1x, b1y, b1z) <= reach2)
      return t;
  }
  return Infinity;
}

/** The squared shortest distance between segment a0 a1 and segment b0 b1,
 *  no allocation (the flight runs per ball per step of the watch). */
function segmentDistanceSq(
  ax: number, ay: number, az: number, bx: number, by: number, bz: number,
  cx: number, cy: number, cz: number, dx: number, dy: number, dz: number,
): number {
  const d1x = bx - ax, d1y = by - ay, d1z = bz - az;
  const d2x = dx - cx, d2y = dy - cy, d2z = dz - cz;
  const rx = ax - cx, ry = ay - cy, rz = az - cz;
  const a = d1x * d1x + d1y * d1y + d1z * d1z;
  const e = d2x * d2x + d2y * d2y + d2z * d2z;
  const f = d2x * rx + d2y * ry + d2z * rz;
  const EPS = 1e-12;
  let s = 0, t = 0;
  if (a <= EPS && e <= EPS)
    return rx * rx + ry * ry + rz * rz;
  if (a <= EPS) {
    s = 0;
    t = Math.max(0, Math.min(1, f / e));
  } else {
    const c = d1x * rx + d1y * ry + d1z * rz;
    if (c <= 0) {
      s = 0;
      t = Math.max(0, Math.min(1, f / e));
    } else {
      s = c / a;
      if (e <= EPS) { t = 0; }
      else {
        const b = d1x * d2x + d1y * d2y + d1z * d2z;
        const denom = a * e - b * b;
        t = denom > EPS ? Math.max(0, Math.min(1, (b * f - c * e) / denom)) : 0;
        s = (c + b * t) / a;
        if (s < 0) { s = 0; t = Math.max(0, Math.min(1, f / e)); }
        else if (s > 1) { s = 1; t = Math.max(0, Math.min(1, (b + f) / e)); }
      }
    }
  }
  const px = ax + d1x * s, py = ay + d1y * s, pz = az + d1z * s;
  const qx = cx + d2x * t, qy = cy + d2y * t, qz = cz + d2z * t;
  const ex = px - qx, ey = py - qy, ez = pz - qz;
  return ex * ex + ey * ey + ez * ez;
}
