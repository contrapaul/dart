import type { RigMotion, RigSpec } from "./rig";
import { bipedWalk, clamp01, ease, quadWalk, type MotionFrame } from "./rig-motion";

// Game-side motion helpers (ENG-10): the sandbox's styles run on a time
// loop, but the game drives a Foamer from its state, so these build the
// target motion for one state at once. The Foamer eases its own motion
// toward it each step, so states join without a joint ever jumping.

/** Reset a motion to a still pose, in place. */
export function restInto(out: RigMotion) {
  out.y = 0;
  out.pitch = 0;
  out.roll = 0;
  out.rot.clear();
  out.squash = 1;
}

function isQuad(rig: RigSpec) {
  return rig.parts.some((p) => p.id === "legFL");
}

/** Walk cycle for whatever legs the rig has left (two-leg or four-leg
 *  gait, as rig-motion does). gait: phase that advances with distance
 *  walked; amount 0..1 scales the stride (0 when standing). */
export function walkMotion(rig: RigSpec, gait: number, amount: number, out: RigMotion) {
  restInto(out);
  const f: MotionFrame = { motion: out, ground: 0, phase: "walk" };
  // rate 1, so the sin/cos phase is gait x PI: the caller advances gait
  // with distance walked (one full cycle per 2 pi of gait).
  if (isQuad(rig)) quadWalk(rig, f, gait, 0.6 * amount, 1);
  else bipedWalk(rig, f, gait, 0.35 * amount, 1, 0.2 * amount);
}

/** Attack wind-up, k 0..1: bonk raises the right arm (with its club, which
 *  is on the arm and follows) over the head; headbutt leans back. */
export function windupMotion(rig: RigSpec, attack: string, k: number, out: RigMotion) {
  restInto(out);
  const e = ease(clamp01(k));
  if (attack === "bonk") {
    if (rig.parts.some((p) => p.id === "armR")) out.rot.set("armR", [-2.4 * e, 0, 0]);
    out.pitch = -0.1 * e;
    out.y = 0.03 * e;
  } else if (attack === "headbutt") {
    out.pitch = -0.45 * e;
    out.y = -0.05 * e;
    if (rig.parts.some((p) => p.id === "head")) out.rot.set("head", [-0.25 * e, 0, 0]);
  }
}

/** The strike, k 0..1: the raised arm comes down fast; or lean forward. */
export function strikeMotion(rig: RigSpec, attack: string, k: number, out: RigMotion) {
  restInto(out);
  const e = ease(clamp01(k));
  if (attack === "bonk") {
    // Fast whip down through 0.7 of the strike, then back to rest.
    const up = -2.4; // where the windup left the arm, over the head
    const a = k < 0.7 ? up + 3.3 * (k / 0.7) ** 2 : 0.9 - 0.9 * ((k - 0.7) / 0.3);
    if (rig.parts.some((p) => p.id === "armR")) out.rot.set("armR", [a, 0, 0]);
    out.pitch = 0.2 * Math.sin(k * Math.PI);
  } else if (attack === "headbutt") {
    out.pitch = -0.45 + 0.85 * e;
    if (rig.parts.some((p) => p.id === "head")) out.rot.set("head", [-0.25 + 0.55 * e, 0, 0]);
  }
}

/** Stagger wobble about z. t: seconds since the stagger began. */
export function staggerMotion(t: number, out: RigMotion) {
  restInto(out);
  const env = Math.max(0, 1 - t / 0.5);
  out.roll = Math.sin(t * 22) * 0.14 * env;
  out.y = -Math.abs(Math.sin(t * 11)) * 0.02 * env;
}

/** Toppled pose, k 0..1 of the topple: forward for two-leg rigs, onto the
 *  side for others; arms, legs and head go limp. */
export function downMotion(rig: RigSpec, k: number, out: RigMotion) {
  const e = ease(clamp01(k));
  const biped = !isQuad(rig);
  out.y = 0;
  out.pitch = (biped ? 1.35 : 0.15) * e;
  out.roll = (biped ? 0.15 : 1.25) * e;
  out.rot.clear();
  out.squash = 1;
  for (const p of rig.parts) {
    const side = p.id.endsWith("L") ? -1 : p.id.endsWith("R") ? 1 : 0;
    const limp: [number, number, number] =
      p.kind === "arm" ? [0.4, 0, side * 0.7]
      : p.kind === "leg" ? [-0.25, 0, side * 0.2]
      : p.kind === "head" ? [0.5, 0, 0.3]
      : [0, 0, 0];
    out.rot.set(p.id, [limp[0] * e, limp[1] * e, limp[2] * e]);
  }
}
