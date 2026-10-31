import type { RigMotion, RigSpec } from "./rig";

// Movement styles for Foamer rigs: procedural animation from time alone, so
// it costs nothing and is easy to tune. Each style returns the pose for a
// moment and how fast the Foamer is moving over the ground then (as a
// multiple of the rig's speed: 0 while winding up, 4 during a charge).
// Parts are found by id: legL/legR (two legs), legFL/legFR/legBL/legBR
// (four), shinL/shinR and shinFL... (knees), armL/armR, finL/finR,
// jetL/jetR, tendril*, jaw, tail, head. Rest rotations in the rig data set
// the stance (how a weapon is held); styles add movement on top.

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
  // Knees bend while the leg swings forward.
  const c = Math.cos(ph);
  if (has(rig, "shinL")) f.motion.rot.set("shinL", [Math.max(0, -c) * stride * 1.4, 0, 0]);
  if (has(rig, "shinR")) f.motion.rot.set("shinR", [Math.max(0, c) * stride * 1.4, 0, 0]);
  f.motion.y += Math.abs(Math.cos(ph)) * 0.03;
  f.motion.roll += s * 0.04;
}

/** Four-leg gait: diagonal pairs move together. */
function quadWalk(rig: RigSpec, f: MotionFrame, t: number, stride: number, rate: number) {
  const s = Math.sin(t * rate * Math.PI);
  const c = Math.cos(t * rate * Math.PI);
  for (const [id, sign] of [["legFL", 1], ["legBR", 1], ["legFR", -1], ["legBL", -1]] as const) {
    if (has(rig, id)) f.motion.rot.set(id, [s * stride * sign, 0, 0]);
    // Lift the foot (bend the knee) on the forward swing.
    const shin = id.replace("leg", "shin");
    if (has(rig, shin)) f.motion.rot.set(shin, [Math.max(0, -c * sign) * stride * 0.8, 0, 0]);
  }
  f.motion.y += Math.abs(s) * 0.015;
}

const styles: Record<string, Style> = {
  /** A plain walk. */
  walk(rig, t) {
    const f = frame("walk", 1);
    bipedWalk(rig, f, t, 0.5, rig.speed * 1.3);
    return f;
  },

  /** Slow, wide waddle, then an overhead bonk with the right arm. 3.4 s loop. */
  shuffle(rig, t) {
    const c = t % 3.4;
    if (c < 2.4) {
      const f = frame("shuffle", 1);
      bipedWalk(rig, f, t, 0.35, 1.4, 0.15);
      f.motion.roll = Math.sin(t * 1.4 * Math.PI) * 0.12;
      return f;
    }
    const f = frame("bonk", 0);
    const k = (c - 2.4) / 1.0;
    // Raise it high and slow, bring it down fast.
    const a =
      k < 0.5 ? -2.6 * ease(k / 0.5)
      : k < 0.75 ? -2.6 + 2.9 * ease((k - 0.5) / 0.25)
      : 0.3 * (1 - ease((k - 0.75) / 0.25));
    f.motion.rot.set("armR", [a, 0, 0]);
    f.motion.pitch = k < 0.5 ? -0.08 * ease(k / 0.5) : -0.08 + 0.08 * ease(clamp01((k - 0.5) / 0.1)) + 0.18 * Math.sin(clamp01((k - 0.5) / 0.5) * Math.PI);
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

  /** Slow walk behind a held shield, firing a volley over it every 1.6 s. */
  shieldwalk(rig, t) {
    const f = frame("advance", 1);
    bipedWalk(rig, f, t, 0.3, rig.speed * 1.2, 0);
    const kick = Math.max(0, 1 - (t % 1.6) / 0.2);
    f.motion.rot.set("armR", [-0.25 * kick + Math.sin(t * 3) * 0.04, 0, 0]);
    if (kick > 0) f.phase = "volley";
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
      f.motion.rot.set("head", [0.35 * k, Math.sin(t * 9) * 0.1 * k, 0]); // head down, horns first
      return f;
    }
    if (c < 3.4) {
      const f = frame("CHARGE", 4);
      quadWalk(rig, f, t, 0.7, 8);
      f.motion.pitch = 0.2;
      f.motion.rot.set("head", [0.35, 0, 0]);
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
    // Tendrils trail and sway, each a little out of step.
    for (const [i, id] of ["tendrilL", "tendrilR", "tendrilM"].entries())
      if (has(rig, id)) f.motion.rot.set(id, [0.25 + Math.sin(t * 2.2 + i * 2) * 0.25, 0, Math.sin(t * 1.7 + i) * 0.2]);
    // Every 3 s the jaw drops and it spits.
    const open = Math.sin(clamp01(((t % 3) - 2) / 1) * Math.PI);
    if (has(rig, "jaw")) f.motion.rot.set("jaw", [0.7 * open, 0, 0]);
    if (open > 0.2) f.phase = "spit (mouth open)";
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
    for (const [id, s] of [["wingL", 1], ["wingR", -1]] as const)
      if (has(rig, id)) f.motion.rot.set(id, [0, 0, s * Math.sin(t * 3) * 0.12]);
    // Left arm swept back, right arm aims its launcher ahead.
    if (has(rig, "armL")) f.motion.rot.set("armL", [0.6, 0, 0]);
    if (has(rig, "armR")) f.motion.rot.set("armR", [-1.3 - f.motion.pitch, 0, 0]);
    if (has(rig, "foreArmR")) f.motion.rot.set("foreArmR", [-0.2, 0, 0]);
    return f;
  },

  /** Heavy walk behind the shield, then a three-hit mace combo: an overhead
   *  slam, a sweep across, and a slow wind-up to a finisher you can parry.
   *  Every phase starts where the last one ended, so nothing snaps.
   *  5.6 s loop. */
  combo(rig, t) {
    const c = t % 5.6;
    if (c < 2.4) {
      const f = frame("walk", 1);
      bipedWalk(rig, f, t, 0.35, rig.speed * 0.9, 0.1);
      f.motion.roll = Math.sin(t * rig.speed * 0.9 * Math.PI) * 0.06;
      f.motion.rot.set("cape", [Math.abs(Math.sin(t * rig.speed * 0.9 * Math.PI)) * 0.12, 0, 0]);
      return f;
    }
    const f = frame("combo", 0.25);
    // How far into the fighting stance: in over 0.3 s, out over the last 0.4 s.
    const ready = ease(clamp01((c - 2.4) / 0.3)) * (1 - ease(clamp01((c - 5.2) / 0.4)));
    let arm: [number, number, number] = [-0.9 * ready, 0, 0];
    let fore = 0;
    if (c < 3.2) {
      // 1: raise the mace high, slam it down in front.
      const k = (c - 2.4) / 0.8;
      const up = k < 0.55 ? ease(k / 0.55) : 1 - ease(clamp01((k - 0.55) / 0.15));
      arm = [arm[0] - 1.9 * up, 0, 0];
      fore = 0.5 * up;
      f.motion.pitch = -0.06 * up + (k > 0.55 ? 0.12 * Math.sin(clamp01((k - 0.55) / 0.45) * Math.PI) : 0);
      f.phase = "combo 1: slam";
    } else if (c < 4.0) {
      // 2: swing out to the right, then sweep across the front.
      const k = (c - 3.2) / 0.8;
      const w = k < 0.45 ? ease(k / 0.45) : 1 - ease(clamp01((k - 0.45) / 0.25));
      arm = [-0.9 - 0.4 * w, 0, 1.3 * w];
      fore = 0.5 * w;
      f.motion.rot.set("body", [0, k < 0.45 ? 0.5 * ease(k / 0.45) : 0.5 - 1.0 * ease(clamp01((k - 0.45) / 0.25)), 0]);
      f.phase = "combo 2: sweep";
    } else {
      // 3: slow, high wind-up (the parry window), a full-body slam, recover.
      const k = (c - 4.0) / 1.6;
      f.ground = 0;
      if (k < 0.5) {
        const w = ease(k / 0.5);
        arm = [-0.9 - 2.2 * w, 0, 0.2 * w];
        fore = 0.6 * w;
        f.motion.rot.set("body", [0, -0.5 * (1 - w), 0]);
        f.motion.pitch = -0.15 * w;
        f.phase = "FINISHER: parry now";
      } else {
        const w = ease(clamp01((k - 0.5) / 0.1));
        arm = [(-3.1 + 2.2 * w) * (k < 0.75 ? 1 : ready), 0, 0.2 * (1 - w)];
        fore = 0.6 * (1 - w);
        f.motion.pitch = (-0.15 + 0.4 * w) * (1 - ease(clamp01((k - 0.6) / 0.4)));
        f.motion.squash = 1 - 0.08 * Math.sin(clamp01((k - 0.5) / 0.3) * Math.PI);
        f.phase = k < 0.75 ? "FINISHER: slam" : "recover";
      }
    }
    f.motion.rot.set("armR", arm);
    f.motion.rot.set("foreArmR", [fore, 0, 0]);
    // The shield dips a little while it swings.
    f.motion.rot.set("armL", [0.2 * ready, 0, 0]);
    return f;
  },

  /** Creeps low, coils, pounces. 3.8 s loop. */
  pounce(rig, t) {
    const c = t % 3.8;
    if (c < 2.5) {
      const f = frame("creep", 0.4);
      quadWalk(rig, f, t, 0.3, 2);
      f.motion.y = -0.05;
      if (has(rig, "tail")) f.motion.rot.set("tail", [0, Math.sin(t * 3) * 0.4, 0]);
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

/** Phase changes (walk to throw, coil to pounce) would snap a joint from
 *  one pose to the next in a frame. Averaging the pose over this window
 *  blends them instead, for every style, at the cost of a few more
 *  evaluations of a cheap function. */
const BLEND_WINDOW = 0.15;
const BLEND_SAMPLES = 6;

/** The pose and ground speed of a rig at time t (seconds). */
export function rigMotion(rig: RigSpec, t: number): MotionFrame {
  const style = styles[rig.movement];
  if (!style) throw new Error(`rig ${rig.id}: unknown movement ${rig.movement}`);
  const out = style(rig, t);
  const m = out.motion;
  for (let i = 1; i < BLEND_SAMPLES; i++) {
    const o = style(rig, Math.max(0, t - (i * BLEND_WINDOW) / (BLEND_SAMPLES - 1))).motion;
    m.y += o.y;
    m.pitch += o.pitch;
    m.roll += o.roll;
    m.squash += o.squash;
    for (const [id, r] of o.rot) {
      const a = m.rot.get(id);
      if (a) m.rot.set(id, [a[0] + r[0], a[1] + r[1], a[2] + r[2]]);
      else m.rot.set(id, [r[0], r[1], r[2]]);
    }
  }
  const n = BLEND_SAMPLES;
  m.y /= n;
  m.pitch /= n;
  m.roll /= n;
  m.squash /= n;
  for (const [id, r] of m.rot) m.rot.set(id, [r[0] / n, r[1] / n, r[2] / n]);
  return out;
}

