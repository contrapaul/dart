import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { restMotion, solvePose, type RigSpec } from "../../src/foamers/rig";
import { windupMotion, strikeMotion, chargeMotion, scrapeMotion, wallStunMotion } from "../../src/foamers/rig-states";
import rigData from "../../data/foamer-rigs.json";

const RIGS = rigData.rigs as unknown as RigSpec[];
const F01 = RIGS.find((r) => r.id === "F01")!;
const F02 = RIGS.find((r) => r.id === "F02")!;
const F05 = RIGS.find((r) => r.id === "F05")!;
const _poses = new Map<string, THREE.Matrix4>();

/** The centre of a part in world space, posed at the origin, yaw 0 (facing +z). */
function centre(rig: RigSpec, id: string, motion: ReturnType<typeof restMotion>): number {
  solvePose(rig, new THREE.Vector3(), 0, motion, _poses);
  const p = rig.parts.find((q) => q.id === id)!;
  const v = new THREE.Vector3(p.size[0] / 2, p.size[1] / 2, p.size[2] / 2).multiplyScalar(rig.voxelSize);
  return v.applyMatrix4(_poses.get(id)!).z;
}

describe("ANIM-01: the F02 Roamer's throw", () => {
  it("the ball sits behind its rest position at the end of the windup", () => {
    const w = restMotion();
    windupMotion(F02, "throw", 1, w);
    expect(centre(F02, "ball", w)).toBeLessThan(centre(F02, "ball", restMotion()));
  });

  it("...and in front of it through the strike", () => {
    const s = restMotion();
    strikeMotion(F02, "throw", 1, s);
    expect(centre(F02, "ball", s)).toBeGreaterThan(centre(F02, "ball", restMotion()));
  });

  it("the windup turns the body away and the strike turns it through", () => {
    const w = restMotion();
    windupMotion(F02, "throw", 1, w);
    const s = restMotion();
    strikeMotion(F02, "throw", 1, s);
    expect(w.turn ?? 0).not.toBeCloseTo(0, 3);
    expect(s.turn ?? 0).toBeGreaterThan(0); // back through onto the target again
  });
});

describe("ANIM-01: the F05 Darter's poses", () => {
  it("the charge pitches the body forward", () => {
    const c = restMotion();
    chargeMotion(F05, 0.5, c);
    expect(c.pitch).toBeGreaterThan(0);
  });

  it("the telegraph dips the body forward and moves a leg", () => {
    const t = restMotion();
    scrapeMotion(F05, 0.25, t);
    expect(t.pitch).toBeGreaterThan(0);
    expect(Math.abs(t.rot.get("legL")?.[0] ?? 0)).toBeGreaterThan(0);
  });

  it("the wall stun rocks the body back and wobbles it", () => {
    const m = restMotion();
    wallStunMotion(F05, 0.3, 1.2, m);
    expect(m.pitch).toBeLessThan(0);
    expect(m.roll).not.toBeCloseTo(0, 3);
  });
});

describe("ANIM-01: every other rig is untouched", () => {
  it("F01 has no motions block, so its old poses stand", () => {
    const w = restMotion();
    windupMotion(F01, "bonk", 1, w);
    expect(w.rot.get("armR")?.[0]).toBeCloseTo(-2.4, 3);
    const c = restMotion();
    chargeMotion(F01, 0.5, c); // F01 never charges; the call must not throw
    expect(c.pitch).toBeCloseTo(0, 3);
  });
});
