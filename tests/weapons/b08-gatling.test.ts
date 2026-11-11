import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { Blaster, resolveSpec, type BlasterControls, type DartFiring } from "../../src/weapons/blaster";
import type { DartTypeName } from "../../src/weapons/darts";
import { Viewmodel } from "../../src/weapons/viewmodel";

// GAME-09g (B08 rebuild, Paul 2026-11-10): the gatling's barrel cluster
// node "barrels" spins on its own axis while an auto blaster fires, and
// the Twin mod's whole second cluster "barrels_2" spins on its own axis
// beside it. Like art-05b.test.ts, this runs on a tree of named nodes
// instead of loading a glb.

const DT = 1 / 60;
const AIM = new THREE.Vector3(0, 0, -1);
const MUZ = [new THREE.Vector3(0, 0.4, -0.5), new THREE.Vector3(-0.145, 0.4, -0.5)];
const TAP: BlasterControls = { fireHeld: true, firePressed: true, reloadPressed: false };
const HOLD: BlasterControls = { fireHeld: true, firePressed: false, reloadPressed: false };

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

function rig(id: string, mods: string[]) {
  const spec = { ...resolveSpec(id, mods), autoReload: false };
  const root = new THREE.Object3D();
  const nodes: Record<string, THREE.Object3D> = {};
  for (const nm of ["body", "barrels", "barrels_2", "mag", "trigger",
                    "flywheel_l", "flywheel_r"]) {
    const n = new THREE.Object3D();
    n.name = nm;
    nodes[nm] = n;
    root.add(n);
  }
  // A non-zero rest rotation: the spin must offset from rest, not reset it.
  nodes.barrels.rotation.set(0.3, 0.5, 0);
  for (const [i, nm] of ["muzzle_1", "muzzle_2"].entries()) {
    const m = new THREE.Object3D();
    m.name = nm;
    m.position.copy(MUZ[i]);
    root.add(m);
  }
  const vm = Viewmodel.fromObject(spec, root);
  const darts = new FakeDarts();
  const b = new Blaster(spec, darts as DartFiring, (i) => MUZ[i], lcg(3));
  b.onShot = (i) => vm.onShot(i);
  return { spec, vm, b, nodes };
}

/** Hold the trigger until the blaster is spun up and has fired n shots. */
function fireShots(g: { vm: Viewmodel; b: Blaster }, n: number): void {
  const before = g.b.shots;
  let sincePress = 99;
  let guard = 0;
  while (g.b.shots < before + n && guard++ < 20000) {
    const canPress = g.b.state === "ready" && sincePress >= 10;
    g.b.update(DT, canPress ? TAP : HOLD, AIM);
    g.vm.animate(DT, g.b, false);
    sincePress = canPress ? 0 : sincePress + 1;
  }
  expect(g.b.shots, "the shots went").toBe(before + n);
}

describe("B08 gatling: the barrel clusters spin while firing", () => {
  it("12. the barrels node turns on its own Y axis, offset from its rest", () => {
    const g = rig("B08", []);
    const restY = g.nodes.barrels.rotation.y; // 0.5, captured as rest
    fireShots(g, 20);
    expect(g.nodes.barrels.rotation.y).not.toBeCloseTo(restY, 3);
    // Still offset from the other axes' rest values.
    expect(g.nodes.barrels.rotation.x).toBeCloseTo(0.3, 5);
    expect(g.nodes.barrels.rotation.z).toBeCloseTo(0, 5);
  });

  it("13. the Twin mod's barrels_2 turns on its own axis too", () => {
    const g = rig("B08", ["twin"]);
    fireShots(g, 20);
    expect(g.nodes.barrels_2.rotation.y).not.toBeCloseTo(0, 3);
    expect(g.nodes.barrels.rotation.y).not.toBeCloseTo(0, 3);
  });

  it("14. the clusters stop turning once the trigger is released and spun down", () => {
    const g = rig("B08", ["twin"]);
    fireShots(g, 20);
    const NO: BlasterControls = { fireHeld: false, firePressed: false, reloadPressed: false };
    for (let i = 0; i < 240; i++) { g.b.update(DT, NO, AIM); g.vm.animate(DT, g.b, false); } // idle
    const b2 = g.b; // fully spun down (spinDown 1.2 s < 4 s of idling)
    expect(b2.wheelSpeed).toBe(0);
    const a = g.nodes.barrels.rotation.y;
    for (let i = 0; i < 30; i++) g.vm.animate(DT, g.b, false);
    expect(g.nodes.barrels.rotation.y).toBeCloseTo(a, 6);
  });
});
