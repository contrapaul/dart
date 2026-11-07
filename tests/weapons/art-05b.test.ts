import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { Blaster, resolveSpec, type BlasterControls, type DartFiring } from "../../src/weapons/blaster";
import type { DartTypeName } from "../../src/weapons/darts";
import { Viewmodel } from "../../src/weapons/viewmodel";
import blastersJson from "../../data/blasters.json";

// ART-05b: the rest of the ART-05 motion briefs: B02 and B04 tilt over
// while they reload (opposite ways), B07's drum turns one chamber per
// round going into it, and a mod may carry its own motion block (B02
// heavy: a bigger kick, a slower slide return). Like art-05a.test.ts,
// each runs on a tree of named nodes instead of loading a glb.

const DT = 1 / 60;
const AIM = new THREE.Vector3(0, 0, -1);
const MUZ = Array.from({ length: 8 }, (_, i) => new THREE.Vector3(0, 1.4 - i * 0.05, -0.5));
const TAP: BlasterControls = { fireHeld: true, firePressed: true, reloadPressed: false };
const HOLD: BlasterControls = { fireHeld: true, firePressed: false, reloadPressed: false };
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

function rig2(id: string, names: string[], mods: string[] = []) {
  const spec = { ...resolveSpec(id, mods), autoReload: false };
  const { root, nodes } = rig(names);
  const vm = Viewmodel.fromObject(spec, root);
  const darts = new FakeDarts();
  const b = new Blaster(spec, darts as DartFiring, (i) => MUZ[i], lcg(3));
  b.onShot = (i) => vm.onShot(i);
  return { spec, vm, b, root, nodes };
}

/** Fire n shots: the trigger is held (an auto blaster's flywheels need
 *  it) and pressed again once the blaster is ready and past its own
 *  interval, waiting out any priming, then idles so the kick has died. */
function fireShots(g: { vm: Viewmodel; b: Blaster }, n: number, onFrame?: () => void): void {
  const before = g.b.shots;
  let sincePress = 99;
  let guard = 0;
  while (g.b.shots < before + n && guard++ < 20000) {
    const canPress = g.b.state === "ready" && sincePress >= 10;
    g.b.update(DT, canPress ? TAP : HOLD, AIM);
    g.vm.animate(DT, g.b, false);
    onFrame?.();
    sincePress = canPress ? 0 : sincePress + 1;
  }
  expect(g.b.shots, "the shots went").toBe(before + n);
  for (let i = 0; i < 60; i++) {
    g.b.update(DT, NO_FIRE, AIM);
    g.vm.animate(DT, g.b, false);
    onFrame?.();
  }
}

/** The root's rotation about its local Z in degrees (0 at the base
 *  placement, which has rotationDeg [.., .., 0] for every blaster). */
const rollDeg = (o: THREE.Object3D): number => THREE.MathUtils.radToDeg(o.rotation.z);

/** Degrees the node has turned from its rest quaternion, unwrapped: the
 *  drum turns several chambers in a row, and a plain angle between two
 *  quaternions folds every 360 degrees back to zero. deg() must be called
 *  every frame (a jump of a whole turn reads as no change at all). */
function drumTracker(n: THREE.Object3D, restQ: THREE.Quaternion) {
  let acc = 0;
  let prev = 0;
  const read = (): number => {
    const rel = restQ.clone().invert().multiply(n.quaternion);
    // A rotation about local Y: (0, sin(a/2), 0, cos(a/2)), so the angle
    // is twice what atan2 of these two components returns.
    const a = 2 * Math.atan2(rel.y, rel.w);
    let d = a - prev;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    acc += d;
    prev = a;
    return THREE.MathUtils.radToDeg(acc);
  };
  read();
  return { deg: read };
}

/** Empty `rounds` from the magazine and press reload (autoReload is off in
 *  these rigs, so nothing reloads on its own). */
function startReload(g: { spec: { magSize: number }; vm: Viewmodel; b: Blaster }, rounds: number): number {
  g.b.mag = g.spec.magSize - rounds;
  g.b.update(DT, RELOAD, AIM);
  expect(g.b.state).toBe("reloading");
  return rounds;
}

describe("ART-05b: the reload tilt", () => {
  const j = blastersJson as unknown as Record<string, { motion: Record<string, number | undefined> }>;

  it("1. B02 rolls right and B04 left at mid reload, opposite signs", () => {
    const a = rig2("B02", ["mag"]);
    startReload(a, 3);
    const b = rig2("B04", ["mag"]);
    startReload(b, 6);
    let maxA = 0;
    let maxB = 0;
    while (a.b.state === "reloading" || b.b.state === "reloading") {
      if (a.b.state === "reloading") {
        a.b.update(DT, NO_FIRE, AIM);
        a.vm.animate(DT, a.b, false);
        if (Math.abs(rollDeg(a.root)) > Math.abs(maxA)) maxA = rollDeg(a.root);
      }
      if (b.b.state === "reloading") {
        b.b.update(DT, NO_FIRE, AIM);
        b.vm.animate(DT, b.b, false);
        if (Math.abs(rollDeg(b.root)) > Math.abs(maxB)) maxB = rollDeg(b.root);
      }
    }
    // The data: B02 positive (right), B04 negative (left), both 8 to start.
    expect(j["B02"].motion.reloadRollDeg).toBe(8);
    expect(j["B04"].motion.reloadRollDeg).toBe(-8);
    // Opposite ways, near the data value at mid reload. Sign found by
    // test: positive reloadRollDeg is a negative rotation about the local
    // Z, which takes the top of the blaster to the player's right.
    expect(maxA).toBeLessThan(0);
    expect(maxB).toBeGreaterThan(0);
    expect(maxA).toBeCloseTo(-8, 0);
    expect(maxB).toBeCloseTo(8, 0);
  });

  it("2. both are back at rest after the reload and ease over and back", () => {
    const a = rig2("B02", ["mag"]);
    startReload(a, 3);
    const samples: number[] = [];
    while (a.b.state === "reloading") {
      a.b.update(DT, NO_FIRE, AIM);
      a.vm.animate(DT, a.b, false);
      samples.push(rollDeg(a.root));
    }
    for (let i = 0; i < 10; i++) a.vm.animate(DT, a.b, false);
    expect(rollDeg(a.root)).toBeCloseTo(0, 9);
    // Eases over and back: starts near zero, one turning point, ends near
    // zero, never the other way.
    expect(Math.abs(samples[0])).toBeLessThan(1);
    expect(samples.every((s) => s <= 0)).toBe(true);
    const mins = samples.filter((s, i) => i > 0 && i < samples.length - 1
      && s <= samples[i - 1] && s <= samples[i + 1]);
    expect(mins.length).toBe(1);
  });

  it("3. a blaster without the field never rolls on a reload", () => {
    for (const id of ["B01", "B03", "B05", "B06", "B07"]) {
      expect(j[id].motion.reloadRollDeg, id).toBeUndefined();
      const g = rig2(id, ["mag", "pump", "bolt", "breach", "latch"]);
      const baseZ = g.root.rotation.z;
      fireShots(g, id === "B03" ? 2 : 3);
      startReload(g, id === "B03" ? 2 : 3);      let rolled = false;
      while (g.b.state === "reloading") {
        g.b.update(DT, NO_FIRE, AIM);
        g.vm.animate(DT, g.b, false);
        if (g.root.rotation.z !== baseZ) rolled = true;
      }
      expect(rolled, `${id}: no reloadRollDeg, no roll`).toBe(false);
    }
  });
});

describe("ART-05b: B07's drum turning as it reloads", () => {
  const j = blastersJson as unknown as Record<string, { motion: Record<string, number> }>;
  const STEP = j["B07"].motion.drumStepDeg;
  const MAG = (blastersJson as unknown as Record<string, { magSize: number }>)["B07"].magSize;

  function drumRig() {
    const g = rig2("B07", ["pump", "drum", "mag"]);
    const drum = g.nodes["drum"];
    drum.quaternion.set(0.7071068, 0, 0, 0.7071068);
    return { ...g, drum, restQ: drum.quaternion.clone(), track: drumTracker(drum, drum.quaternion.clone()) };
  }

  it("4. turns one chamber per round loaded and ends on a chamber", () => {
    const g = drumRig();
    // Empty the drum with real shots: the per-shot index runs first.
    fireShots(g, MAG, () => g.track.deg());
    expect(g.b.mag).toBe(0);
    expect(g.track.deg()).toBeCloseTo(MAG * STEP, 3);
    const rounds = startReload(g, MAG);
    while (g.b.state === "reloading") {
      g.b.update(DT, NO_FIRE, AIM);
      g.vm.animate(DT, g.b, false);
      g.track.deg();
    }
    for (let i = 0; i < 5; i++) g.vm.animate(DT, g.b, false);
    // Total: one chamber per shot plus one chamber per round loaded.
    const total = g.track.deg();
    expect(total).toBeCloseTo((MAG + rounds) * STEP, 3);
    // Sitting on a chamber: the total is a whole number of steps.
    const steps = total / STEP;
    expect(Math.abs(steps - Math.round(steps))).toBeLessThan(1e-6);
  });

  it("5. part way through the reload it sits on a chamber too", () => {
    const g = drumRig();
    fireShots(g, MAG, () => g.track.deg());
    const rounds = startReload(g, MAG);
    // The rounds are spread evenly across the reload, so at the k-th
    // round boundary the drum is exactly k chambers past where it stood
    // when the reload began.
    const start = MAG * STEP;
    const perRound = g.spec.reloadTime / rounds;
    const framesPerRound = Math.round(perRound / DT);
    expect(framesPerRound, "a round takes several frames").toBeGreaterThan(3);
    let round = 0;
    let frame = 0;
    let worst = 0;
    while (g.b.state === "reloading") {
      g.b.update(DT, NO_FIRE, AIM);
      g.vm.animate(DT, g.b, false);
      g.track.deg();
      frame++;
      if (frame >= framesPerRound * (round + 1)) {
        round++;
        worst = Math.max(worst, Math.abs(g.track.deg() - (start + round * STEP)));
      }
    }
    expect(round, "several round boundaries were sampled").toBeGreaterThanOrEqual(3);
    // Within a fifth of a chamber of the chamber line at each boundary.
    expect(worst).toBeLessThan(STEP * 0.2);
  });

  it("6. the per-shot turn is unchanged and idle frames do not move it", () => {
    // One shot: one chamber, exactly as GAME-09f (the pump eases the
    // index across the priming).
    const a = drumRig();
    fireShots(a, 1, () => a.track.deg());
    expect(a.track.deg()).toBeCloseTo(STEP, 4);
    // Idle frames: the drum holds.
    const t0 = a.track.deg();
    for (let i = 0; i < 30; i++) {
      a.b.update(DT, NO_FIRE, AIM);
      a.vm.animate(DT, a.b, false);
      a.track.deg();
    }
    expect(a.track.deg()).toBe(t0);
  });
});

describe("ART-05b: a mod's own motion (B02 heavy)", () => {
  it("7. resolveSpec merges the heavy motion key by key", () => {
    const plain = resolveSpec("B02", []);
    const heavy = resolveSpec("B02", ["heavy"]);
    const j = blastersJson as unknown as Record<string, {
      motion: Record<string, number>;
      mods: Record<string, { motion?: Record<string, number> }>;
    }>;
    expect(j["B02"].mods["heavy"].motion).toEqual({ kick: 0.035, slideReturn: 0.18 });
    // The heavy keys come from the mod.
    expect(heavy.motion.kick).toBeCloseTo(0.035, 6);
    expect(heavy.motion.slideReturn).toBeCloseTo(0.18, 6);
    // The rest are the blaster's own.
    expect(heavy.motion.tiltDeg).toBe(plain.motion.tiltDeg);
    expect(heavy.motion.slideTravel).toBe(plain.motion.slideTravel);
    expect(heavy.motion.triggerDeg).toBe(plain.motion.triggerDeg);
    expect(heavy.motion.magDrop).toBe(plain.motion.magDrop);
    expect(heavy.motion.reloadRollDeg).toBe(plain.motion.reloadRollDeg);
    expect(heavy.motion.return).toBe(plain.motion.return);
    // Plain B02 does not read the heavy values, and the data object was
    // not mutated by the merge.
    expect(plain.motion.kick).toBeCloseTo(0.02, 6);
    expect(plain.motion.slideReturn).toBeCloseTo(0.1, 6);
    expect(j["B02"].motion.kick).toBeCloseTo(0.02, 6);
    expect(j["B02"].motion.slideReturn).toBeCloseTo(0.1, 6);
  });

  it("8. with heavy equipped the slide comes home slower (start 0.18)", () => {
    const plain = rig2("B02", ["slide", "mag"]);
    const heavy = rig2("B02", ["slide", "mag"], ["heavy"]);
    const slideP = plain.nodes["slide"];
    const slideH = heavy.nodes["slide"];
    const restP = slideP.position.z;
    const restH = slideH.position.z;
    // Fire one shot on each, then wait past plain's return (0.1 s): plain
    // is home, heavy is still on its way.
    plain.b.update(DT, TAP, AIM);
    plain.vm.animate(DT, plain.b, true);
    heavy.b.update(DT, TAP, AIM);
    heavy.vm.animate(DT, heavy.b, true);
    for (let i = 0; i < 9; i++) {
      plain.b.update(DT, NO_FIRE, AIM);
      plain.vm.animate(DT, plain.b, false);
      heavy.b.update(DT, NO_FIRE, AIM);
      heavy.vm.animate(DT, heavy.b, false);
    }
    expect(slideP.position.z - restP).toBeCloseTo(0, 6);
    expect(slideH.position.z - restH).toBeGreaterThan(0);
    // Heavy is home within its own slideReturn.
    for (let i = 0; i < Math.ceil(0.18 / DT) + 4; i++) {
      heavy.b.update(DT, NO_FIRE, AIM);
      heavy.vm.animate(DT, heavy.b, false);
    }
    expect(slideH.position.z).toBeCloseTo(restH, 6);
    // The bigger kick is a data change the viewmodel reads through
    // spec.motion.kick (test 7): the root spring itself is not observable
    // in a headless test (see HANDOFF), so it is not checked here.
    expect(heavy.spec.motion.kick).toBeGreaterThan(plain.spec.motion.kick);
  });
});
