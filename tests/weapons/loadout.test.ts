import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { Blaster, resolveSpec } from "../../src/weapons/blaster";
import type { BlasterControls, DartFiring } from "../../src/weapons/blaster";
import type { DartTypeName } from "../../src/weapons/darts";
import { Loadout } from "../../src/weapons/loadout";

// Test 14 for GAME-09: switching. The loadout's blasters are built with
// fake viewmodels (no GLTFLoader), one per blaster, each with fixed muzzle
// points in different places so a shot's origin says which blaster fired.
// A fake dart system records every fire (origin, direction, type).
const DT = 1 / 60;
const AIM = new THREE.Vector3(0, 0, -1);

class FakeDarts implements DartFiring {
  readonly origins: THREE.Vector3[] = [];
  readonly dirs: THREE.Vector3[] = [];
  readonly types: DartTypeName[] = [];
  fire(o: THREE.Vector3, d: THREE.Vector3, t: DartTypeName): void {
    this.origins.push(o.clone());
    this.dirs.push(d.clone());
    this.types.push(t);
  }
  get n(): number { return this.dirs.length; }
}

/** The parts of the real Viewmodel the Loadout drives; the test fakes them
 *  with fixed camera-space muzzle points. */
class FakeVM {
  visible = false;
  readonly muzzlePts: THREE.Vector3[];
  constructor(pts: [number, number, number][]) {
    this.muzzlePts = pts.map((p) => new THREE.Vector3(...p));
  }
  setVisible(on: boolean): void { this.visible = on; }
  setMods(_s: string[], _h: string[]): void {}
  muzzleCameraPoint(i: number, out: THREE.Vector3): THREE.Vector3 {
    return out.copy(this.muzzlePts[i]);
  }
  onShot = (_m: number): void => {};
}

function make(): { lo: Loadout; darts: FakeDarts; vms: FakeVM[] } {
  const darts = new FakeDarts();
  // Each blaster's muzzles sit in a different corner so a fired dart's
  // origin identifies its blaster.
  const vms = [
    new FakeVM([[0.9, 0, -1], [0.9, 0.1, -1], [0.9, -0.1, -1]]),
    new FakeVM([[0.7, 0.5, -1]]),
    new FakeVM([[-0.7, 0, -1], [-0.7, 0.1, -1]]),
  ];
  const out = new THREE.Vector3();
  const parts = ["B01", "B04", "B03"].map((id, i) => ({
    id,
    blaster: new Blaster(resolveSpec(id), darts, () => vms[i].muzzleCameraPoint(0, out)),
    viewmodel: vms[i],
  }));
  const lo = new Loadout(parts, darts, 0.35);
  return { lo, darts, vms };
}

const HOLD: BlasterControls = { fireHeld: true, firePressed: true, reloadPressed: false };
const NO: BlasterControls = { fireHeld: false, firePressed: false, reloadPressed: false };

describe("GAME-09 test 14: switching", () => {
  it("no shot fires while a switch is running; each blaster keeps its own ammo; viewmodels swap at the halfway", () => {
    const { lo, darts, vms } = make();
    const b01 = lo.blasters[0];
    const b04 = lo.blasters[1];
    const b03 = lo.blasters[2];
    const s1 = resolveSpec("B01");

    // One B01 pump shot, out of its own muzzle.
    lo.update(DT, HOLD, AIM);
    expect(darts.n).toBe(s1.dartsPerShot);
    expect(b01.mag).toBe(s1.magSize - 1);
    expect(darts.origins[0].clone()).toStrictEqual(vms[0].muzzlePts[0]);

    // B04 to a distinct count, B03 emptied, so any later movement is visible.
    b04.mag = 20;
    b04.reserve = 90;
    b03.loaded[0] = false;
    b03.loaded[1] = false;

    lo.select(1);
    expect(lo.switching).toBe(true);
    const half = Math.ceil((lo.switchTime / 2) / DT);
    for (let i = 0; i < half - 1; i++) lo.update(DT, HOLD, AIM);
    expect(darts.n).toBe(s1.dartsPerShot); // the held trigger did not fire
    expect(lo.activeIndex).toBe(0);
    expect(vms[0].visible).toBe(true);
    expect(vms[1].visible).toBe(false);
    lo.update(DT, HOLD, AIM);
    expect(lo.activeIndex).toBe(1);
    expect(vms[0].visible).toBe(false);
    expect(vms[1].visible).toBe(true);
    const total = Math.ceil(lo.switchTime / DT);
    for (let i = 0; i < total - half; i++) lo.update(DT, HOLD, AIM);
    expect(lo.switching).toBe(false);
    expect(darts.n).toBe(s1.dartsPerShot);

    // B04 now spins up and fires from its own muzzle. The stored fireClock
    // means the first dart may come up to a full fireInterval later.
    let guard = 0;
    while (b04.wheelSpeed < 1 && darts.n === s1.dartsPerShot && guard++ < 200)
      lo.update(DT, HOLD, AIM);
    expect(darts.n).toBeGreaterThan(s1.dartsPerShot);
    expect(darts.origins[s1.dartsPerShot].clone()).toStrictEqual(vms[1].muzzlePts[0]);

    // Switch to B03: its state is untouched, B01's and B04's are untouched.
    lo.select(2);
    guard = 0;
    while (lo.switching && guard++ < 200) lo.update(DT, NO, AIM);
    expect(lo.activeIndex).toBe(2);
    expect(b03.loaded).toEqual([false, false]);
    expect(b03.reserve).toBe(resolveSpec("B03").reserveStart);
    expect(b01.mag).toBe(s1.magSize - 1);
    expect(vms[1].visible).toBe(false);
    expect(vms[2].visible).toBe(true);
    const holes = darts.n - s1.dartsPerShot;
    expect(b04.mag).toBe(20 - holes);
  });

  it("a second request mid-switch is ignored, and next and prev walk the order", () => {
    const { lo, darts } = make();
    lo.select(1);
    lo.update(DT, NO, AIM); // inside the switch
    lo.select(2); // ignored, one switch at a time
    let guard = 0;
    while (lo.switching && guard++ < 200) lo.update(DT, NO, AIM);
    expect(lo.activeIndex).toBe(1);
    expect(darts.n).toBe(0);
    lo.next();
    guard = 0;
    while (lo.switching && guard++ < 200) lo.update(DT, NO, AIM);
    expect(lo.activeIndex).toBe(2);
    lo.prev();
    guard = 0;
    while (lo.switching && guard++ < 200) lo.update(DT, NO, AIM);
    expect(lo.activeIndex).toBe(1);
  });
});

// LVL-05 stage 1: the owned set. The loadout still builds every blaster
// (nothing loads mid-level), but a campaign names the ones the player has
// found; the rest cannot be selected and next and prev skip them.
describe("LVL-05: owned blasters", () => {
  const owned = (ids?: string[]) => {
    const darts = new FakeDarts();
    const vms = ["B01", "B04", "B03"].map(() => new FakeVM([[0, 0, -1]]));
    const out = new THREE.Vector3();
    const parts = ["B01", "B04", "B03"].map((id, i) => ({
      id,
      blaster: new Blaster(resolveSpec(id), darts, () => vms[i]!.muzzleCameraPoint(0, out)),
      viewmodel: vms[i]!,
    }));
    return { lo: new Loadout(parts, darts, 0.35, ids), darts, vms };
  };

  it("owns every blaster by default, the first one active", () => {
    const { lo } = owned();
    for (const id of ["B01", "B04", "B03"]) expect(lo.owns(id), id).toBe(true);
    expect(lo.activeIndex).toBe(0);
  });

  it("the first owned blaster is active, not the first built", () => {
    const { lo, vms } = owned(["B04"]);
    expect(lo.owns("B01")).toBe(false);
    expect(lo.owns("B04")).toBe(true);
    expect(lo.activeIndex).toBe(1);
    expect(lo.activeId()).toBe("B04");
    expect(vms[0]!.visible).toBe(false);
    expect(vms[1]!.visible).toBe(true);
  });

  it("select does nothing for an unowned blaster, next and prev skip them", () => {
    const { lo } = owned(["B01", "B03"]);
    lo.select(1); // B04 is not owned
    expect(lo.switching).toBe(false);
    expect(lo.activeIndex).toBe(0);
    lo.next(); // B04 skipped, B03 next
    let guard = 0;
    while (lo.switching && guard++ < 200) lo.update(DT, NO, AIM);
    expect(lo.activeIndex).toBe(2);
    lo.next(); // wraps to B01
    guard = 0;
    while (lo.switching && guard++ < 200) lo.update(DT, NO, AIM);
    expect(lo.activeIndex).toBe(0);
    lo.prev(); // the other way: B03, then B01
    guard = 0;
    while (lo.switching && guard++ < 200) lo.update(DT, NO, AIM);
    expect(lo.activeIndex).toBe(2);
    lo.prev();
    guard = 0;
    while (lo.switching && guard++ < 200) lo.update(DT, NO, AIM);
    expect(lo.activeIndex).toBe(0);
  });

  it("own() lets a found blaster be selected, and with one owned nothing switches", () => {
    const { lo } = owned(["B01"]);
    lo.own("B04");
    expect(lo.owns("B04")).toBe(true);
    lo.select(1);
    let guard = 0;
    while (lo.switching && guard++ < 200) lo.update(DT, NO, AIM);
    expect(lo.activeIndex).toBe(1);
    // A one-blaster loadout's next and prev stay put.
    const one = owned(["B03"]).lo;
    one.next();
    one.prev();
    expect(one.switching).toBe(false);
    expect(one.activeId()).toBe("B03");
  });

  it("an owned set that names no built blaster falls back to the first", () => {
    const { lo } = owned(["B08"]);
    expect(lo.activeIndex).toBe(0);
    expect(lo.owns("B08")).toBe(false);
  });
});

// LVL-05 stage 2: a level's restart puts the entry state's owned set back.
// The blaster found during the attempt that was lost is not owned by the
// retry, and the active blaster comes back to an owned one at once.
describe("LVL-05: setOwned, the restart's owned set", () => {
  const owned = (ids?: string[]) => {
    const darts = new FakeDarts();
    const vms = ["B01", "B04", "B03"].map(() => new FakeVM([[0, 0, -1]]));
    const out = new THREE.Vector3();
    const parts = ["B01", "B04", "B03"].map((id, i) => ({
      id,
      blaster: new Blaster(resolveSpec(id), darts, () => vms[i]!.muzzleCameraPoint(0, out)),
      viewmodel: vms[i]!,
    }));
    return { lo: new Loadout(parts, darts, 0.35, ids), darts, vms };
  };

  it("makes the owned set exactly the ids, dropping one found this attempt", () => {
    const { lo } = owned(["B01"]);
    lo.own("B04");
    expect(lo.owns("B04")).toBe(true);
    lo.setOwned(["B01"]);
    expect(lo.owns("B04")).toBe(false);
    expect(lo.owns("B01")).toBe(true);
    expect(lo.activeId()).toBe("B01");
  });

  it("brings the active blaster back to an owned one, with no switch", () => {
    const { lo, vms } = owned(["B01", "B04"]);
    lo.select(1);
    let guard = 0;
    while (lo.switching && guard++ < 200) lo.update(DT, NO, AIM);
    expect(lo.activeId()).toBe("B04");
    lo.setOwned(["B01"]);
    expect(lo.activeId()).toBe("B01");
    expect(lo.switching).toBe(false);
    expect(vms[1]!.visible).toBe(false);
    expect(vms[0]!.visible).toBe(true);
  });

  it("keeps one blaster owned when the ids name nothing built", () => {
    const { lo } = owned(["B01", "B04"]);
    lo.setOwned(["B99"]);
    expect(lo.owns("B01") || lo.owns("B04") || lo.owns("B03")).toBe(true);
  });
});
