import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { Blaster, resolveSpec, type BlasterControls, type DartFiring } from "../../src/weapons/blaster";
import type { DartTypeName } from "../../src/weapons/darts";
import { Viewmodel } from "../../src/weapons/viewmodel";
import blastersJson from "../../data/blasters.json";

// ART-05a: the three viewmodel motions the approved models have waiting
// for them: B02's slide snaps back on each shot, B05's bolt is worked
// across the priming (lift, back, forward, down), B06's cocking handle is
// pulled during the reload. Like b07.test.ts test 10, each runs on a tree
// of named nodes instead of loading a glb.

const DT = 1 / 60;
const AIM = new THREE.Vector3(0, 0, -1);
const MUZ = Array.from({ length: 8 }, (_, i) => new THREE.Vector3(0, 1.4 - i * 0.05, -0.5));
const TAP: BlasterControls = { fireHeld: true, firePressed: true, reloadPressed: false };
const NO_FIRE: BlasterControls = { fireHeld: false, firePressed: false, reloadPressed: false };
const RELOAD: BlasterControls = { fireHeld: false, firePressed: false, reloadPressed: true };

function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

class FakeDarts implements DartFiring {
  readonly types: DartTypeName[] = [];
  fire(_o: THREE.Vector3, _d: THREE.Vector3, t: DartTypeName): void {
    this.types.push(t);
  }
  get count(): number { return this.types.length; }
}

/** A tree with the named nodes this card animates, at plausible rest
 *  positions, plus a muzzle. Positions are read from restP, rotations
 *  from restQ, like the real glb (none of the three nodes has a rest
 *  rotation). */
function rig(names: string[]): { root: THREE.Object3D; nodes: Record<string, THREE.Object3D> } {
  const root = new THREE.Object3D();
  const nodes: Record<string, THREE.Object3D> = {};
  for (const nm of names) {
    const n = new THREE.Object3D();
    n.name = nm;
    n.position.set(0.05, 0.03, -0.2);
    nodes[nm] = n;
    root.add(n);
  }
  const m1 = new THREE.Object3D();
  m1.name = "muzzle_1";
  m1.position.set(0, 0.078, -0.528);
  root.add(m1);
  return { root, nodes };
}

function rig2(id: string, names: string[]) {
  const spec = resolveSpec(id, []);
  const { root, nodes } = rig(names);
  const vm = Viewmodel.fromObject(spec, root);
  const darts = new FakeDarts();
  const b = new Blaster(spec, darts as DartFiring, (i) => MUZ[i], lcg(3));
  b.onShot = (i) => vm.onShot(i);
  return { spec, vm, b, nodes };
}

/** The node's offset from its rest position, as a plain vector. */
function offsetFromRest(n: THREE.Object3D, r: [number, number, number]): THREE.Vector3 {
  return new THREE.Vector3(n.position.x - r[0], n.position.y - r[1], n.position.z - r[2]);
}

describe("ART-05a: the B02 slide", () => {
  const data = (blastersJson as unknown as Record<string, { motion: Record<string, number> }>)["B02"];
  const TRAVEL = data.motion.slideTravel;
  const RETURN = data.motion.slideReturn;

  it("1. snaps back about slideTravel just after a shot, at rest after slideReturn", () => {
    const { vm, b, nodes } = rig2("B02", ["slide"]);
    const slide = nodes["slide"];
    const rest: [number, number, number] = [slide.position.x, slide.position.y, slide.position.z];
    expect(offsetFromRest(slide, rest).length()).toBeCloseTo(0, 6);
    b.update(DT, TAP, AIM);
    vm.animate(DT, b, true);
    // Just after the shot: back by about the full travel along local +Z.
    expect(slide.position.z - rest[2]).toBeGreaterThan(TRAVEL * 0.8);
    expect(slide.position.x).toBeCloseTo(rest[0], 6);
    expect(slide.position.y).toBeCloseTo(rest[1], 6);
    // A fraction of the way back partway through the return.
    let prev = slide.position.z - rest[2];
    for (let i = 0; i < 3; i++) {
      b.update(DT, NO_FIRE, AIM);
      vm.animate(DT, b, false);
      const off = slide.position.z - rest[2];
      expect(off).toBeLessThan(prev);
      expect(off).toBeGreaterThan(0);
      prev = off;
    }
    // Home within slideReturn.
    const frames = Math.ceil(RETURN / DT) + 2;
    for (let i = 0; i < frames; i++) {
      b.update(DT, NO_FIRE, AIM);
      vm.animate(DT, b, false);
    }
    expect(slide.position.z).toBeCloseTo(rest[2], 6);
  });

  it("2. each dart of a burst kicks it again", () => {
    const spec = resolveSpec("B02", ["burst"]);
    const { root, nodes } = rig(["slide"]);
    const vm = Viewmodel.fromObject(spec, root);
    const slide = nodes["slide"];
    const rest: [number, number, number] = [slide.position.x, slide.position.y, slide.position.z];
    const b = new Blaster(spec, new FakeDarts() as DartFiring, (i) => MUZ[i], lcg(3));
    b.onShot = (i) => vm.onShot(i);
    // One press: three darts burstGap apart. The slide must be re-kicked
    // after it has partly come home, not just once.
    b.update(DT, TAP, AIM);
    vm.animate(DT, b, true);
    let dipped = false;
    let rekicked = false;
    for (let i = 0; i < 60; i++) {
      b.update(DT, NO_FIRE, AIM);
      vm.animate(DT, b, false);
      const off = slide.position.z - rest[2];
      if (!dipped && off < TRAVEL * 0.5) dipped = true;
      if (dipped && off > TRAVEL * 0.8) rekicked = true;
    }
    expect(dipped, "the slide came part way home between darts").toBe(true);
    expect(rekicked, "a later dart of the burst kicked it again").toBe(true);
  });

  it("3. a blaster with no slide node or no field is untouched", () => {
    // B02's own tree without a slide node: nothing to move, no crash.
    const a = rig2("B02", ["trigger"]);
    a.b.update(DT, TAP, AIM);
    a.vm.animate(DT, a.b, true);
    for (let i = 0; i < 10; i++) a.vm.animate(DT, a.b, false);
    expect(a.nodes["trigger"].position.z).toBeCloseTo(-0.2, 6);
    // B01 (no slideTravel in its data): given a slide node it never moves
    // it, even while its own pump works.
    const b = rig2("B01", ["pump", "slide"]);
    const slide = b.nodes["slide"];
    const restZ = slide.position.z;
    let pumpMoved = false;
    for (let i = 0; i < 40; i++) {
      b.b.update(DT, TAP, AIM);
      b.vm.animate(DT, b.b, true);
      if (b.nodes["pump"].position.z !== -0.2) pumpMoved = true;
      expect(slide.position.z).toBe(restZ);
    }
    expect(pumpMoved, "the pump itself still travels").toBe(true);
  });
});

describe("ART-05a: the B05 bolt", () => {
  const data = (blastersJson as unknown as Record<string, { motion: Record<string, number> }>)["B05"];
  const TRAVEL = data.motion.boltTravel;
  const LIFT = data.motion.boltLiftDeg;

  /** Degrees the bolt has turned from rest about its local Z. */
  const lifted = (n: THREE.Object3D, restQ: THREE.Quaternion): number => {
    const rel = restQ.clone().invert().multiply(n.quaternion);
    return THREE.MathUtils.radToDeg(2 * Math.acos(Math.min(1, Math.abs(rel.w))));
  };

  it("4. is lifted at progress 0.1, back by boltTravel at 0.5, at rest after priming", () => {
    const { vm, b, nodes } = rig2("B05", ["bolt"]);
    const bolt = nodes["bolt"];
    const restQ = bolt.quaternion.clone();
    const rest: [number, number, number] = [bolt.position.x, bolt.position.y, bolt.position.z];
    expect(lifted(bolt, restQ)).toBeCloseTo(0, 6);
    expect(offsetFromRest(bolt, rest).length()).toBeCloseTo(0, 6);
    b.update(DT, TAP, AIM); // the shot: priming starts (primeTime 0.9)
    expect(b.state).toBe("priming");
    // Drive animate at the blaster's own progress samples rather than
    // stepping the blaster: the phases are defined on progress.
    const at = (p: number) => {
      Object.defineProperty(b, "progress", { get: () => p, configurable: true });
      vm.animate(DT, b, false);
    };
    // progress 0.1: lifting (the lift runs across 0 to 0.2), not yet back.
    at(0.1);
    expect(lifted(bolt, restQ)).toBeGreaterThan(LIFT * 0.4);
    expect(bolt.position.z - rest[2]).toBeCloseTo(0, 6);
    // progress 0.2: fully lifted, still not back.
    at(0.2);
    expect(lifted(bolt, restQ)).toBeCloseTo(LIFT, 4);
    expect(bolt.position.z - rest[2]).toBeCloseTo(0, 6);
    // progress 0.5: still lifted, fully back.
    at(0.5);
    expect(lifted(bolt, restQ)).toBeGreaterThan(LIFT * 0.9);
    expect(bolt.position.z - rest[2]).toBeCloseTo(TRAVEL, 6);
    // progress 0.65: coming forward, still lifted.
    at(0.65);
    expect(bolt.position.z - rest[2]).toBeGreaterThan(0);
    expect(bolt.position.z - rest[2]).toBeLessThan(TRAVEL);
    expect(lifted(bolt, restQ)).toBeGreaterThan(LIFT * 0.9);
    // progress 0.9: down part way, forward.
    at(0.9);
    expect(lifted(bolt, restQ)).toBeLessThan(LIFT * 0.6);
    expect(bolt.position.z - rest[2]).toBeCloseTo(0, 6);
    // Not priming: at rest.
    Object.defineProperty(b, "progress", { get: () => 1, configurable: true });
    vm.animate(DT, b, false);
    expect(bolt.position.z).toBeCloseTo(rest[2], 6);
    expect(lifted(bolt, restQ)).toBeCloseTo(0, 6);
  });

  it("5. runs the whole cycle across a real priming and sits at rest outside it", () => {
    const { vm, b, nodes } = rig2("B05", ["bolt"]);
    const bolt = nodes["bolt"];
    const restQ = bolt.quaternion.clone();
    const rest: [number, number, number] = [bolt.position.x, bolt.position.y, bolt.position.z];
    const maxBack = { z: 0 };
    const maxLift = { d: 0 };
    b.update(DT, TAP, AIM);
    while (b.state === "priming") {
      b.update(DT, NO_FIRE, AIM);
      vm.animate(DT, b, false);
      maxBack.z = Math.max(maxBack.z, bolt.position.z - rest[2]);
      maxLift.d = Math.max(maxLift.d, lifted(bolt, restQ));
    }
    expect(maxLift.d).toBeGreaterThan(LIFT * 0.9);
    expect(maxBack.z).toBeGreaterThan(TRAVEL * 0.9);
    // Idle frames: back at rest and staying there.
    for (let i = 0; i < 30; i++) vm.animate(DT, b, false);
    expect(bolt.position.z).toBeCloseTo(rest[2], 6);
    expect(lifted(bolt, restQ)).toBeCloseTo(0, 6);
  });

  it("6. sits at rest through a reload and cycles on the priming after it", () => {
    // The card: the same bolt cycle plays at the end of a reload if the
    // blaster primes then. B05's reload itself does not prime (blaster.ts
    // goes back to ready), so the check is: the bolt never moves during
    // the reload, and the next priming works it as usual.
    // autoReload off (test only): otherwise the empty magazine reloads on
    // its own before this test gets to press the key.
    const spec = { ...resolveSpec("B05", []), autoReload: false };
    const { root, nodes } = rig(["bolt", "mag"]);
    const vm = Viewmodel.fromObject(spec, root);
    const bolt = nodes["bolt"];
    const restQ = bolt.quaternion.clone();
    const rest: [number, number, number] = [bolt.position.x, bolt.position.y, bolt.position.z];
    const b = new Blaster(spec, new FakeDarts() as DartFiring, (i) => MUZ[i], lcg(3));
    b.onShot = (i) => vm.onShot(i);
    // One shot to make the magazine short, then reload on the press.
    b.update(DT, TAP, AIM);
    while (b.state !== "ready") {
      b.update(DT, NO_FIRE, AIM);
      vm.animate(DT, b, false);
    }
    b.update(DT, RELOAD, AIM);
    expect(b.state).toBe("reloading");
    let movedDuringReload = false;
    const st = (): string => b.state;
    while (st() === "reloading") {
      b.update(DT, NO_FIRE, AIM);
      vm.animate(DT, b, false);
      if (bolt.position.z !== rest[2] || lifted(bolt, restQ) > 1e-6) movedDuringReload = true;
    }
    expect(movedDuringReload, "the bolt is a priming motion, not a reload one").toBe(false);
    // The next press primes, and the bolt works the full cycle.
    let maxBack = 0;
    let maxLift = 0;
    b.update(DT, TAP, AIM);
    while (st() === "priming") {
      b.update(DT, NO_FIRE, AIM);
      vm.animate(DT, b, false);
      maxBack = Math.max(maxBack, bolt.position.z - rest[2]);
      maxLift = Math.max(maxLift, lifted(bolt, restQ));
    }
    expect(maxBack).toBeGreaterThan(TRAVEL * 0.9);
    expect(maxLift).toBeGreaterThan(LIFT * 0.9);
    for (let i = 0; i < 10; i++) vm.animate(DT, b, false);
    expect(bolt.position.z).toBeCloseTo(rest[2], 6);
    expect(lifted(bolt, restQ)).toBeCloseTo(0, 6);
  });
});

describe("ART-05a: the B06 cocking handle", () => {
  const data = (blastersJson as unknown as Record<string, { motion: Record<string, number> }>)["B06"];
  const TRAVEL = data.motion.boltTravel;

  it("7. is back during a reload and at rest after it", () => {
    const { vm, b, nodes } = rig2("B06", ["bolt", "mag"]);
    const bolt = nodes["bolt"];
    const restQ = bolt.quaternion.clone();
    const rest: [number, number, number] = [bolt.position.x, bolt.position.y, bolt.position.z];
    expect(offsetFromRest(bolt, rest).length()).toBeCloseTo(0, 6);
    const at = (p: number) => {
      Object.defineProperty(b, "state", { get: () => "reloading", configurable: true });
      Object.defineProperty(b, "progress", { get: () => p, configurable: true });
      vm.animate(DT, b, false);
    };
    // Pulled: back over 0 to 0.15.
    at(0.05);
    expect(bolt.position.z - rest[2]).toBeGreaterThan(0);
    expect(bolt.position.z - rest[2]).toBeLessThan(TRAVEL);
    at(0.15);
    expect(bolt.position.z - rest[2]).toBeCloseTo(TRAVEL, 6);
    // Held through the magazine swap.
    at(0.5);
    expect(bolt.position.z - rest[2]).toBeCloseTo(TRAVEL, 6);
    at(0.85);
    expect(bolt.position.z - rest[2]).toBeCloseTo(TRAVEL, 6);
    // Let go over 0.85 to 1.0.
    at(0.95);
    expect(bolt.position.z - rest[2]).toBeGreaterThan(0);
    expect(bolt.position.z - rest[2]).toBeLessThan(TRAVEL);
    // Outside the reload: at rest, and not rotated.
    Object.defineProperty(b, "state", { get: () => "ready", configurable: true });
    Object.defineProperty(b, "progress", { get: () => 1, configurable: true });
    vm.animate(DT, b, false);
    expect(bolt.position.z).toBeCloseTo(rest[2], 6);
    expect(bolt.quaternion.angleTo(restQ)).toBeLessThan(1e-9);
  });

  it("8. a real reload pulls it and lets it go, and firing never moves it", () => {
    const { vm, b, nodes } = rig2("B06", ["bolt", "mag"]);
    const bolt = nodes["bolt"];
    const rest: [number, number, number] = [bolt.position.x, bolt.position.y, bolt.position.z];
    // Fire for a while first: full auto must not touch the handle.
    for (let i = 0; i < 120; i++) {
      b.update(DT, TAP, AIM);
      vm.animate(DT, b, true);
      expect(bolt.position.z).toBeCloseTo(rest[2], 6);
    }
    let maxBack = 0;
    for (let i = 0; i < 400; i++) {
      b.update(DT, RELOAD, AIM);
      vm.animate(DT, b, false);
      if (b.state === "reloading") maxBack = Math.max(maxBack, bolt.position.z - rest[2]);
    }
    expect(maxBack).toBeGreaterThan(TRAVEL * 0.9);
    for (let i = 0; i < 10; i++) vm.animate(DT, b, false);
    expect(bolt.position.z).toBeCloseTo(rest[2], 6);
  });
});

describe("ART-05a: nothing else changed", () => {
  it("9. B01's pump and B07's drum still animate, and their nodes are the only movers", () => {
    // B01: the pump goes back and home across the priming as before.
    const a = rig2("B01", ["pump"]);
    const pump = a.nodes["pump"];
    const restPump = pump.position.z;
    const travel = (blastersJson as unknown as Record<string, { motion: Record<string, number> }>)["B01"].motion.pumpTravel;
    let maxPump = 0;
    a.b.update(DT, TAP, AIM);
    while (a.b.state === "priming") {
      a.b.update(DT, NO_FIRE, AIM);
      a.vm.animate(DT, a.b, false);
      maxPump = Math.max(maxPump, pump.position.z - restPump);
    }
    expect(maxPump).toBeGreaterThan(travel * 0.9);
    a.vm.animate(DT, a.b, false);
    expect(pump.position.z).toBeCloseTo(restPump, 6);

    // B07: the drum still turns one chamber per shot.
    const spec = resolveSpec("B07", []);
    const { root, nodes } = rig(["pump", "drum"]);
    const drum = nodes["drum"];
    drum.quaternion.set(0.7071068, 0, 0, 0.7071068);
    const restD = drum.quaternion.clone();
    const vm = Viewmodel.fromObject(spec, root);
    const b = new Blaster(spec, new FakeDarts() as DartFiring, (i) => MUZ[i], lcg(3));
    b.onShot = (i) => vm.onShot(i);
    const turned = (): number => {
      const rel = restD.clone().invert().multiply(drum.quaternion);
      return THREE.MathUtils.radToDeg(2 * Math.acos(Math.min(1, Math.abs(rel.w))));
    };
    b.update(DT, TAP, AIM);
    for (let i = 0; i < 74; i++) {
      b.update(DT, NO_FIRE, AIM);
      vm.animate(DT, b, false);
    }
    expect(turned()).toBeCloseTo(60, 4);
  });

  it("10. the other blasters' motion blocks gained no ART-05a fields", () => {
    const j = blastersJson as unknown as Record<string, { motion: Record<string, number | undefined> }>;
    const keys = ["slideTravel", "slideReturn", "boltTravel", "boltLiftDeg"];
    for (const id of ["B01", "B03", "B04", "B07"]) {
      for (const k of keys) expect(j[id].motion[k], `${id}.${k}`).toBeUndefined();
    }
    for (const id of ["B05", "B06"]) {
      expect(j[id].motion.boltTravel, `${id}: the moving node is bolt`).toBeTypeOf("number");
    }
    expect(j["B02"].motion.boltTravel).toBeUndefined();
    expect(j["B02"].motion.slideTravel).toBeTypeOf("number");
    expect(j["B02"].motion.slideReturn).toBeTypeOf("number");
    expect(j["B05"].motion.boltLiftDeg).toBeTypeOf("number");
    // B06 has no lift: its handle is pulled, not rotated.
    expect(j["B06"].motion.boltLiftDeg).toBeUndefined();
  });
});
