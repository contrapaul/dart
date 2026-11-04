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

/** Prone crawl (GAME-11): the body lies at proneTilt (proneMotion's job) and
 *  pulls itself along with its arms, which reach forward in turn, while the
 *  leg it has left drags. gait advances with distance crawled, as the walk's
 *  does. It adds to out, so it lays over the prone base pose. The small body
 *  bob is in pitch, not y: poseParts fits the prone body to the floor and
 *  would undo a y bob. */
export function crawlMotion(rig: RigSpec, gait: number, out: RigMotion) {
  const s = Math.sin(gait * Math.PI);
  const c = Math.cos(gait * Math.PI);
  const reach = 0.5;
  // The arms take turns: one reaches forward as the other pushes back, so
  // the reach is at rest when they pass each other.
  if (rig.parts.some((p) => p.id === "armL")) out.rot.set("armL", [-1.4 + reach * s, 0, 0]);
  if (rig.parts.some((p) => p.id === "armR")) out.rot.set("armR", [-1.4 - reach * s, 0, 0]);
  if (rig.parts.some((p) => p.id === "foreArmL")) out.rot.set("foreArmL", [-0.6 + reach * 0.5 * s, 0, 0]);
  if (rig.parts.some((p) => p.id === "foreArmR")) out.rot.set("foreArmR", [-0.6 - reach * 0.5 * s, 0, 0]);
  // The leg left drags behind, a little out of phase with the arms.
  for (const id of ["legL", "legR"])
    if (rig.parts.some((p) => p.id === id)) out.rot.set(id, [-0.5 + 0.12 * c, 0, 0]);
  out.pitch += 0.05 * s; // the body rocks with the pull
}

/** Stagger wobble about z. t: seconds since the stagger began; dur the
 *  whole stagger, so a long, finishable one keeps wobbling instead of
 *  fading after half a second. */
export function staggerMotion(t: number, dur: number, out: RigMotion) {
  restInto(out);
  const env = Math.max(0, 1 - t / dur);
  out.roll = Math.sin(t * 22) * 0.14 * env;
  out.y = -Math.abs(Math.sin(t * 11)) * 0.02 * env;
}

/** GAME-07 finisher, k 0..1: the squeezed-toy. The body squashes down,
 *  stretches back up, and pops loose at the end (the pop is the system's
 *  job, at k 1). A little wobble keeps it toyish rather than flat. */
export function finishMotion(k: number, out: RigMotion) {
  k = clamp01(k);
  restInto(out);
  // Down over the first half, up and a stretch over the second.
  out.squash = k < 0.5
    ? 1 - 0.45 * ease(k / 0.5)
    : 0.55 + 0.85 * ease((k - 0.5) / 0.5);
  out.roll = 0.1 * Math.sin(k * 3 * Math.PI);
  out.pitch = 0.08 * Math.sin(k * 2 * Math.PI);
}

/** GAME-10b: the charger's scrape, k 0..1 through the telegraph. The body
 *  drops and pitches forward (the Darter has no separate head to lower),
 *  with a short scrape shake so the player reads the window. */
export function scrapeMotion(rig: RigSpec, k: number, out: RigMotion) {
  restInto(out);
  const e = ease(clamp01(k));
  out.pitch = 0.22 * e;
  out.y = -0.05 * e;
  out.roll = Math.sin(k * 40) * 0.02 * e; // the scrape itself
  for (const id of ["legL", "legR"])
    if (rig.parts.some((p) => p.id === id)) out.rot.set(id, [0.25 * e, 0, 0]);
}

/** GAME-10b: the charge run, phase in gait units. A deep forward lean and a
 *  fast two-beat gallop; the stride is shorter than it looks because the
 *  system moves the body, not the legs. */
export function chargeMotion(rig: RigSpec, phase: number, out: RigMotion) {
  restInto(out);
  const s = Math.sin(phase * Math.PI);
  out.pitch = 0.3;
  out.y = 0.04 * Math.abs(s);
  for (const id of ["legL", "legR"])
    if (rig.parts.some((p) => p.id === id)) out.rot.set(id, [(id.endsWith("L") ? 1 : -1) * 0.5 * s, 0, 0]);
}
