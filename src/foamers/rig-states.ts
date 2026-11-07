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

/** ANIM-01: the pose the state holds, degrees for angles and metres for
 *  distances, read from the rig's `motions` block in data/foamer-rigs.json
 *  (`motions.<state>.<phase>`). A missing block reads empty, so a rig that
 *  never got the block (F01, and every other pre-ANIM-01 rig) stays on its
 *  old hard-coded pose. */
function poseNums(rig: RigSpec, state: string, phase?: string): Record<string, number> {
  const tree = (rig.motions ?? {}) as Record<string, Record<string, unknown>>;
  const block = (phase ? tree[state]?.[phase] : tree[state]) as Record<string, unknown> | undefined;
  if (!block) return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(block)) if (typeof v === "number") out[k] = v;
  return out;
}

const DEG = Math.PI / 180;

/** Attack wind-up, k 0..1: bonk raises the right arm (with its club, which
 *  is on the arm and follows) over the head; headbutt leans back; throw
 *  (ANIM-01) brings the ball arm back and over so the ball sits behind the
 *  head, the cue to raise the shield. */
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
  } else if (attack === "spit" || attack === "bigBlob") {
    // GAME-10c: the jaw drops to spit (the Floater has no arms).
    if (rig.parts.some((p) => p.id === "jaw")) out.rot.set("jaw", [1.0 * e, 0, 0]);
    out.pitch = -0.08 * e;
  } else if (attack === "stream") {
    // GAME-10g: the barrels spin up (they pivot about y) and the body
    // braces as the turret comes to bear. The spin is one whole turn over
    // the windup: a tube looks the same at 0 and 2pi, so the pose is
    // continuous when the strike takes over (no snap at the transition).
    const e2 = Math.min(1, k / 0.6);
    const spin = Math.PI * 2 * e2 * e2;
    if (rig.parts.some((p) => p.id === "barrelL")) out.rot.set("barrelL", [0, spin, 0]);
    if (rig.parts.some((p) => p.id === "barrelR")) out.rot.set("barrelR", [0, -spin, 0]);
    out.pitch = -0.06 * e;
  } else if (attack === "stomp") {
    // GAME-10g: it rears with the gun down over the target.
    out.pitch = 0.25 * e;
    out.y = 0.06 * e;
    if (rig.parts.some((p) => p.id === "gun")) out.rot.set("gun", [0.5 * e, 0, 0]);
  } else if (attack === "throw") {
    // ANIM-01: the loaded ball, from the rig's motions block. Zero when a
    // rig has no block, so the pose never snaps: it just does not wind.
    const w = poseNums(rig, "throw", "wind");
    if (rig.parts.some((p) => p.id === "armR")) out.rot.set("armR", [(w["armR"] ?? 0) * DEG * e, 0, 0]);
    if (rig.parts.some((p) => p.id === "foreArmR")) out.rot.set("foreArmR", [(w["foreArmR"] ?? 0) * DEG * e, 0, 0]);
    if (rig.parts.some((p) => p.id === "head")) out.rot.set("head", [(w["headX"] ?? 0) * DEG * e, (w["headYaw"] ?? 0) * DEG * e, 0]);
    out.roll = (w["roll"] ?? 0) * DEG * e; // drop the throwing shoulder
    out.pitch = (w["pitch"] ?? 0) * DEG * e;
    out.turn = (w["turn"] ?? 0) * DEG * e; // the body turns a little away
    out.y = 0.03 * e;
  } else if (attack === "swing") {
    // GAME-10i: the Brawler draws the sword back (the arm swings it out to
    // the right), the body turning with it, so it ends at the strike's
    // start pose, no snap at the handover.
    if (rig.parts.some((p) => p.id === "armR")) out.rot.set("armR", [0.2 * e, 0, 1.4 * e]);
    out.turn = 0.25 * e;
    out.pitch = 0.1 * e;
  }
}

/** The strike, k 0..1: the raised arm comes down fast; or lean forward;
 *  the throw (ANIM-01) whips the loaded ball forward past the shoulder and
 *  the body through, the ball leaving the hand around the 70% mark. */
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
  } else if (attack === "spit" || attack === "bigBlob") {
    // GAME-10c: the jaw comes back up after the spit.
    if (rig.parts.some((p) => p.id === "jaw")) out.rot.set("jaw", [1.0 * (1 - e), 0, 0]);
    out.pitch = -0.08 * (1 - e);
  } else if (attack === "throw") {
    const w = poseNums(rig, "throw", "wind");
    const s = poseNums(rig, "throw", "strike");
    // The whip: from the loaded pose the arm carries to overhand fast for
    // the first 70%, then the hand settles into the follow. The strike
    // starts exactly where the windup left it, so no snap at the edge. A
    // rig without a block never winds, so it does no whip either.
    const wp = k < 0.7 ? (k / 0.7) ** 2 : 1;
    if (rig.parts.some((p) => p.id === "armR"))
      out.rot.set("armR", [((w["armR"] ?? 0) + ((s["armR"] ?? 0) - (w["armR"] ?? 0)) * wp) * DEG, 0, 0]);
    if (rig.parts.some((p) => p.id === "foreArmR"))
      out.rot.set("foreArmR", [((w["foreArmR"] ?? 0) + ((s["foreArmR"] ?? 0) - (w["foreArmR"] ?? 0)) * wp) * DEG, 0, 0]);
    if (rig.parts.some((p) => p.id === "head")) out.rot.set("head", [((w["headX"] ?? 0) + ((s["headX"] ?? 0) - (w["headX"] ?? 0)) * wp) * DEG, 0, 0]);
    out.roll = ((w["roll"] ?? 0) * (1 - wp)) * DEG;
    out.pitch = (s["pitch"] ?? 0) * DEG * Math.sin(k * Math.PI) + ((w["pitch"] ?? 0) * (1 - wp)) * DEG;
    out.turn = ((w["turn"] ?? 0) + ((s["turn"] ?? 0) - (w["turn"] ?? 0)) * wp) * DEG; // turns through the throw
    out.y = 0.03 * Math.sin(k * Math.PI);
  } else if (attack === "swing") {
    // GAME-10i: the wide horizontal strike: the drawn-back arm swings
    // across the body, side to side, fast for the first 70%, then the
    // follow-through settles to rest, so the recover starts clean.
    const u = k < 0.7 ? (k / 0.7) ** 1.6 : 1;
    const back = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
    if (rig.parts.some((p) => p.id === "armR"))
      out.rot.set("armR", [(0.2 - 0.5 * u) * back, 0, (1.4 - 2.7 * u) * back]);
    out.turn = (0.25 - 0.45 * u) * back;
    out.pitch = (0.1 - 0.25 * u) * back;
  }
}

/** The float (GAME-10c): a slow bob and sway with flapping fins and
 *  trailing tendrils, the pose the sandbox's float style makes, driven
 *  from stateTime and gait instead of a loop clock. It adds to out. */
export function floatMotion(rig: RigSpec, t: number, gait: number, out: RigMotion, bob: number) {
  restInto(out);
  out.y = Math.sin(t * 1.6) * bob;
  out.pitch = Math.sin(t * 0.8) * 0.06;
  out.roll = Math.sin(t * 1.1) * 0.05;
  const ids = new Set(rig.parts.map((p) => p.id));
  const flap = Math.sin(gait * 5) * 0.5;
  if (ids.has("finL")) out.rot.set("finL", [0, 0, flap]);
  if (ids.has("finR")) out.rot.set("finR", [0, 0, -flap]);
  // Tendrils trail and sway, each a little out of step.
  for (const [i, id] of ["tendrilL", "tendrilR", "tendrilM"].entries())
    if (ids.has(id)) out.rot.set(id, [0.25 + Math.sin(t * 2.2 + i * 2) * 0.25, 0, Math.sin(t * 1.7 + i) * 0.2]);
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

/** ANIM-01: the Darter's telegraph, k 0..1. The head and body dip forward
 *  and one leg scrapes back and forward twice over the window (replaces
 *  GAME-10b's placeholder scrape; the whole cycle number means k 1 has no
 *  leg that has moved, so the next pick-up will not jump). A rig without a
 *  scrape block stays at rest, so no other rig reads one by mistake. */
export function scrapeMotion(rig: RigSpec, k: number, out: RigMotion) {
  restInto(out);
  const m = poseNums(rig, "scrape");
  const e = ease(clamp01(k));
  out.pitch = (m["pitch"] ?? 0) * DEG * e;
  out.y = -(m["dip"] ?? 0) * e;
  const s = Math.sin(k * Math.PI * 2 * (m["cycles"] ?? 0));
  out.roll = s * (m["rollShake"] ?? 0) * DEG * e; // the scrape's rumble in the body
  if (rig.parts.some((p) => p.id === "legL")) out.rot.set("legL", [(m["leg"] ?? 0) * DEG * s * e, 0, 0]);
  if (rig.parts.some((p) => p.id === "legR")) out.rot.set("legR", [-(m["stand"] ?? 0) * DEG * e, 0, 0]);
}

/** ANIM-01: the charge run, phase in steps (same unit the walk's gait
 *  uses, but a faster pattern: an in-cycle two-beat sprint). The ground
 *  itself does the moving, the pose only sells it (replaces GAME-10b's).
 *  A rig without a charge block stays at rest. */
export function chargeMotion(rig: RigSpec, phase: number, out: RigMotion) {
  restInto(out);
  const m = poseNums(rig, "charge");
  const s = Math.sin(phase * Math.PI);
  out.pitch = (m["pitch"] ?? 0) * DEG;
  out.y = (m["bob"] ?? 0) * Math.abs(s);
  const stride = (m["stride"] ?? 0) * DEG;
  for (const id of ["legL", "legR"])
    if (rig.parts.some((p) => p.id === id)) out.rot.set(id, [(id.endsWith("L") ? 1 : -1) * stride * s, 0, 0]);
}

/** GAME-10f: the Brawler's crouch, k 0..1 of the crouch (the leap's
 *  telegraph). It folds: body down, arms back, head low, knees bent. A rig
 *  with no crouch block stays at rest (only the Brawler has one). */
export function crouchMotion(rig: RigSpec, k: number, out: RigMotion) {
  restInto(out);
  const m = poseNums(rig, "crouch");
  const e = ease(clamp01(k));
  out.pitch = (m["pitch"] ?? 0) * DEG * e;
  out.y = -(m["dip"] ?? 0) * e;
  if (rig.parts.some((p) => p.id === "armL")) out.rot.set("armL", [(m["armBack"] ?? 0) * DEG * e, 0, 0]);
  if (rig.parts.some((p) => p.id === "armR")) out.rot.set("armR", [(m["armBack"] ?? 0) * DEG * e, 0, 0]);
  if (rig.parts.some((p) => p.id === "foreArmL")) out.rot.set("foreArmL", [(m["foreArm"] ?? 0) * DEG * e, 0, 0]);
  if (rig.parts.some((p) => p.id === "foreArmR")) out.rot.set("foreArmR", [(m["foreArm"] ?? 0) * DEG * e, 0, 0]);
  if (rig.parts.some((p) => p.id === "legL")) out.rot.set("legL", [-(m["knees"] ?? 0) * DEG * e, 0, 0]);
  if (rig.parts.some((p) => p.id === "legR")) out.rot.set("legR", [-(m["knees"] ?? 0) * DEG * e, 0, 0]);
  if (rig.parts.some((p) => p.id === "head")) out.rot.set("head", [(m["headLow"] ?? 0) * DEG * e, 0, 0]);
}

/** GAME-10f: the Brawler in the air, k 0..1 of the flight. Arms up and
 *  wide to come down on them, legs tucked under. A rig with no leap block
 *  stays at rest. */
export function leapMotion(rig: RigSpec, k: number, out: RigMotion) {
  restInto(out);
  const m = poseNums(rig, "leap");
  const up = ease(clamp01(k * 2)); // the pose is set by the launch, held down
  out.pitch = (m["pitch"] ?? 0) * DEG * up;
  out.y = (m["lift"] ?? 0) * up; // the whole body hangs a little tall in the air
  if (rig.parts.some((p) => p.id === "armL")) out.rot.set("armL", [-(m["armUp"] ?? 0) * DEG * up, 0, (m["armOut"] ?? 0) * DEG * up]);
  if (rig.parts.some((p) => p.id === "armR")) out.rot.set("armR", [-(m["armUp"] ?? 0) * DEG * up, 0, -(m["armOut"] ?? 0) * DEG * up]);
  if (rig.parts.some((p) => p.id === "foreArmL")) out.rot.set("foreArmL", [-(m["foreArm"] ?? 0) * DEG * up, 0, 0]);
  if (rig.parts.some((p) => p.id === "foreArmR")) out.rot.set("foreArmR", [-(m["foreArm"] ?? 0) * DEG * up, 0, 0]);
  if (rig.parts.some((p) => p.id === "legL")) out.rot.set("legL", [(m["tuck"] ?? 0) * DEG * up, 0, 0]);
  if (rig.parts.some((p) => p.id === "legR")) out.rot.set("legR", [(m["tuck"] ?? 0) * DEG * up, 0, 0]);
  if (rig.parts.some((p) => p.id === "head")) out.rot.set("head", [(m["headBack"] ?? 0) * DEG * up, 0, 0]);
}

/** ANIM-01: the wall stun, t seconds since the hit, dur the whole stun.
 *  The body rocks back with a wobble in roll; on a rig whose body is its
 *  head (F05) the head shake is a fast pitch judder, on one with a head
 *  part it rides it, so the open back reads. A rig without a block stays
 *  at rest (the wall stun state itself is Darter-only). */
export function wallStunMotion(rig: RigSpec, t: number, dur: number, out: RigMotion) {
  restInto(out);
  const m = poseNums(rig, "wallStun");
  const env = Math.max(0, 1 - t / dur);
  const f = m["freq"] ?? 24;
  const shake = m["headShake"] ?? 0;
  out.pitch = -(m["pitchBack"] ?? 0) * DEG * env;
  out.roll = Math.sin(t * f * 0.5) * (m["wobble"] ?? 0) * DEG * env;
  if (rig.parts.some((p) => p.id === "head") && shake)
    out.rot.set("head", [Math.sin(t * (f + 3) + 1) * shake * DEG * env, 0, 0]);
  else if (!rig.parts.some((p) => p.id === "head") && shake)
    out.pitch += Math.sin(t * f) * shake * DEG * env; // F05's body is its head
}
