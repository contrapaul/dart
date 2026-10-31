import type { RigMotion, RigSpec } from "./rig";

// Movement styles for Foamer rigs: procedural animation from time alone, so
// it costs nothing and is easy to tune. Each style returns the pose for a
// moment and how fast the Foamer is moving over the ground then (as a
// multiple of the rig's speed: 0 while winding up, 4 during a charge).
// Parts are found by id: legL/legR (two legs), legFL/legFR/legBL/legBR
// (four), armL/armR, finL/finR, jetL/jetR.

export interface MotionFrame {
  motion: RigMotion;
  /** Ground speed now, as a multiple of rig.speed. */
  ground: number;
  /** A short word for what it is doing, shown in the sandbox. */
  phase: string;
}

type Style = (rig: RigSpec, t: number) => MotionFrame;

const ease = (x: number) => x * x * (3 - 2 * x);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

function frame(phase: string, ground: number): MotionFrame {
  return { motion: { y: 0, pitch: 0, roll: 0, rot: new Map(), squash: 1 }, ground, phase };
}

function has(rig: RigSpec, id: string) {
  return rig.parts.some((p) => p.id === id);
}

/** Two-leg walk cycle into f. stride: leg swing (rad); rate: steps a second. */
function bipedWalk(rig: RigSpec, f: MotionFrame, t: number, stride: number, rate: number, armSwing = 0.35) {
  const ph = t * rate * Math.PI;
  const s = Math.sin(ph);
  if (has(rig, "legL")) f.motion.rot.set("legL", [s * stride, 0, 0]);
  if (has(rig, "legR")) f.motion.rot.set("legR", [-s * stride, 0, 0]);
  if (has(rig, "armL")) f.motion.rot.set("armL", [-s * armSwing, 0, 0]);
  if (has(rig, "armR")) f.motion.rot.set("armR", [s * armSwing, 0, 0]);
  f.motion.y += Math.abs(Math.cos(ph)) * 0.03;
  f.motion.roll += s * 0.04;
}

/** Four-leg gait: diagonal pairs move together. */
function quadWalk(rig: RigSpec, f: MotionFrame, t: number, stride: number, rate: number) {
  const s = Math.sin(t * rate * Math.PI);
  for (const [id, sign] of [["legFL", 1], ["legBR", 1], ["legFR", -1], ["legBL", -1]] as const)
    if (has(rig, id)) f.motion.rot.set(id, [s * stride * sign, 0, 0]);
  f.motion.y += Math.abs(s) * 0.015;
}

const styles: Record<string, Style> = {
  /** A plain walk. */
  walk(rig, t) {
    const f = frame("walk", 1);
    bipedWalk(rig, f, t, 0.5, rig.speed * 1.3);
    return f;
  },

  /** Slow, wide waddle with arms out front. */
  shuffle(rig, t) {
    const f = frame("shuffle", 1);
    bipedWalk(rig, f, t, 0.35, 1.4, 0.1);
    f.motion.roll = Math.sin(t * 1.4 * Math.PI) * 0.12;
    for (const id of ["armL", "armR"]) {
      const r = f.motion.rot.get(id) ?? [0, 0, 0];
      f.motion.rot.set(id, [r[0] - 1.2, 0, 0]);
    }
    return f;
  },

  /** Small and fast on four legs. */
  scurry(rig, t) {
    const f = frame("scurry", 1);
    quadWalk(rig, f, t, 0.6, 6);
    f.motion.pitch = Math.sin(t * 6 * Math.PI) * 0.04;
    return f;
  },

  /** Walk, stop, throw with the right arm, walk on. 3.2 s loop. */
  throw(rig, t) {
    const c = t % 3.2;
    if (c < 2.2) {
      const f = frame("walk", 1);
      bipedWalk(rig, f, t, 0.5, rig.speed * 1.1);
      return f;
    }
    const f = frame("throw", 0);
    const k = (c - 2.2) / 1.0;
    // Wind back over the head, then whip forward.
    const a = k < 0.6 ? -Math.PI * ease(k / 0.6) : -Math.PI + (Math.PI + 0.6) * ease((k - 0.6) / 0.4);
    f.motion.rot.set("armR", [a, 0, 0]);
    f.motion.pitch = k < 0.6 ? -0.1 * ease(k / 0.6) : 0.15 * Math.sin(((k - 0.6) / 0.4) * Math.PI);
    return f;
  },

  /** Slow walk behind a held shield. */
  shieldwalk(rig, t) {
    const f = frame("advance", 1);
    bipedWalk(rig, f, t, 0.3, rig.speed * 1.2, 0);
    f.motion.rot.set("armL", [-1.4, 0, 0]);
    f.motion.rot.set("armR", [-0.4 + Math.sin(t * 3) * 0.05, 0, 0]);
    return f;
  },

  /** Walk, dig in, dash in a straight line, skid. 4 s loop. */
  charge(rig, t) {
    const c = t % 4;
    if (c < 2) {
      const f = frame("walk", 1);
      quadWalk(rig, f, t, 0.35, 2.2);
      return f;
    }
    if (c < 2.6) {
      const f = frame("wind up", 0);
      const k = ease((c - 2) / 0.6);
      f.motion.pitch = -0.25 * k;
      f.motion.y = -0.06 * k;
      quadWalk(rig, f, t * 3, 0.15, 3); // pawing the ground
      return f;
    }
    if (c < 3.4) {
      const f = frame("CHARGE", 4);
      quadWalk(rig, f, t, 0.7, 8);
      f.motion.pitch = 0.2;
      return f;
    }
    const k = (c - 3.4) / 0.6;
    const f = frame("skid", 4 * (1 - ease(k)));
    f.motion.pitch = -0.2 * Math.sin(k * Math.PI);
    return f;
  },

  /** Bobbing float with flapping fins. */
  float(rig, t) {
    const f = frame("float", 1);
    f.motion.y = Math.sin(t * 1.6) * 0.12;
    f.motion.pitch = Math.sin(t * 0.8) * 0.06;
    f.motion.roll = Math.sin(t * 1.1) * 0.05;
    const flap = Math.sin(t * 5) * 0.5;
    if (has(rig, "finL")) f.motion.rot.set("finL", [0, 0, flap]);
    if (has(rig, "finR")) f.motion.rot.set("finR", [0, 0, -flap]);
    return f;
  },

  /** Walk, crouch, leap high, slam down. 3.6 s loop. */
  leap(rig, t) {
    const c = t % 3.6;
    if (c < 2) {
      const f = frame("walk", 1);
      bipedWalk(rig, f, t, 0.45, rig.speed * 1.1);
      return f;
    }
    if (c < 2.4) {
      const f = frame("crouch", 0);
      const k = ease((c - 2) / 0.4);
      f.motion.squash = 1 - 0.15 * k;
      f.motion.rot.set("armL", [-2.6 * k, 0, 0]);
      f.motion.rot.set("armR", [-2.6 * k, 0, 0]);
      f.motion.rot.set("legL", [-0.4 * k, 0, 0]);
      f.motion.rot.set("legR", [-0.4 * k, 0, 0]);
      return f;
    }
    if (c < 3.1) {
      const k = (c - 2.4) / 0.7;
      const f = frame("LEAP", 2.5);
      f.motion.y = 4 * 1.2 * k * (1 - k);
      f.motion.squash = 1 + 0.1 * Math.sin(k * Math.PI);
      f.motion.rot.set("armL", [-2.6, 0, 0]);
      f.motion.rot.set("armR", [-2.6, 0, 0]);
      f.motion.rot.set("legL", [0.3, 0, 0]);
      f.motion.rot.set("legR", [-0.3, 0, 0]);
      return f;
    }
    const k = (c - 3.1) / 0.5;
    const f = frame("SLAM", 0);
    f.motion.squash = 0.75 + 0.25 * ease(k);
    const arms = -2.6 + 2.6 * ease(clamp01(k * 3));
    f.motion.rot.set("armL", [arms, 0, 0]);
    f.motion.rot.set("armR", [arms, 0, 0]);
    return f;
  },

  /** Heavy, slow stomp; the arm launchers kick on a 2 s rhythm. */
  tank(rig, t) {
    const f = frame("stomp", 1);
    bipedWalk(rig, f, t, 0.3, rig.speed * 1.6, 0);
    f.motion.y = Math.abs(Math.cos(t * rig.speed * 1.6 * Math.PI)) * 0.06;
    f.motion.roll = Math.sin(t * rig.speed * 1.6 * Math.PI) * 0.08;
    const kick = Math.max(0, 1 - ((t % 2) / 0.25)) * 0.35;
    f.motion.rot.set("armL", [-1.5 - kick, 0, 0]);
    f.motion.rot.set("armR", [-1.5 - kick, 0, 0]);
    if (kick > 0) f.phase = "fire";
    return f;
  },

  /** Four splayed legs and a turret that sweeps side to side. */
  spider(rig, t) {
    const f = frame("walk", 1);
    quadWalk(rig, f, t, 0.4, 3);
    f.motion.rot.set("gun", [0, Math.sin(t * 0.9) * 0.7, 0]);
    return f;
  },

  /** Hovers on jets, leaning into its flight. */
  fly(rig, t) {
    const f = frame("fly", 1);
    f.motion.y = Math.sin(t * 2) * 0.1;
    f.motion.pitch = 0.25;
    f.motion.roll = Math.sin(t * 0.7) * 0.15;
    for (const id of ["jetL", "jetR"]) if (has(rig, id)) f.motion.rot.set(id, [Math.sin(t * 9) * 0.05, 0, 0]);
    for (const id of ["armL", "armR"]) if (has(rig, id)) f.motion.rot.set(id, [0.6, 0, 0]);
    return f;
  },

  /** Walk, then a three-hit combo with the right arm. 3.4 s loop. */
  combo(rig, t) {
    const c = t % 3.4;
    if (c < 2) {
      const f = frame("walk", 1);
      bipedWalk(rig, f, t, 0.4, rig.speed * 1.1, 0.2);
      f.motion.rot.set("armL", [-1.2, 0, 0]);
      return f;
    }
    const f = frame("combo", 0.3);
    const k = (c - 2) / 1.4;
    const hit = Math.floor(k * 3);
    const local = k * 3 - hit;
    f.motion.rot.set("armL", [-1.2, 0, 0]);
    f.motion.rot.set("armR", [-1.8 * Math.sin(local * Math.PI), (hit - 1) * 0.6, 0]);
    f.motion.pitch = 0.1 * Math.sin(local * Math.PI);
    if (hit >= 2) f.phase = "finisher (parry it)";
    return f;
  },

  /** Creeps low, coils, pounces. 3.8 s loop. */
  pounce(rig, t) {
    const c = t % 3.8;
    if (c < 2.5) {
      const f = frame("creep", 0.4);
      quadWalk(rig, f, t, 0.3, 2);
      f.motion.y = -0.05;
      return f;
    }
    if (c < 3) {
      const f = frame("coil", 0);
      f.motion.squash = 1 - 0.2 * ease((c - 2.5) / 0.5);
      f.motion.pitch = -0.15;
      return f;
    }
    if (c < 3.6) {
      const k = (c - 3) / 0.6;
      const f = frame("POUNCE", 4);
      f.motion.y = 4 * 0.6 * k * (1 - k);
      f.motion.pitch = 0.3 - 0.6 * k;
      for (const id of ["legFL", "legFR"]) f.motion.rot.set(id, [-0.9, 0, 0]);
      for (const id of ["legBL", "legBR"]) f.motion.rot.set(id, [0.9, 0, 0]);
      return f;
    }
    const f = frame("land", 0);
    f.motion.squash = 0.85 + 0.15 * ease((c - 3.6) / 0.2);
    return f;
  },

  /** Walks, then stops and raises both arms to send foam to its friends. */
  support(rig, t) {
    const c = t % 4;
    if (c < 2.8) {
      const f = frame("walk", 1);
      bipedWalk(rig, f, t, 0.45, rig.speed * 1.2);
      return f;
    }
    const f = frame("heal", 0);
    const k = Math.sin(((c - 2.8) / 1.2) * Math.PI);
    f.motion.rot.set("armL", [-2.8 * k, 0, -0.3 * k]);
    f.motion.rot.set("armR", [-2.8 * k, 0, 0.3 * k]);
    f.motion.y = 0.05 * k;
    return f;
  },
};

export const MOVEMENT_STYLES = Object.keys(styles);

/** The pose and ground speed of a rig at time t (seconds). */
export function rigMotion(rig: RigSpec, t: number): MotionFrame {
  const style = styles[rig.movement];
  if (!style) throw new Error(`rig ${rig.id}: unknown movement ${rig.movement}`);
  return style(rig, t);
}

