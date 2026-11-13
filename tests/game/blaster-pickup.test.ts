import { beforeAll, describe, expect, it } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { PickupSystem, type PickupLoadout } from "../../src/pickups/pickups";
import { PlayerHealth } from "../../src/player/health";
import { Loadout } from "../../src/weapons/loadout";
import { ownedAt } from "../../src/game/campaign";
import { Blaster, resolveSpec } from "../../src/weapons/blaster";
import type { DartFiring } from "../../src/weapons/blaster";
import type { DartTypeName } from "../../src/weapons/dart-model";
import pickupData from "../../data/pickups.json";
import type { Level } from "../../src/level/format";

// LVL-05 stage 1: the blaster pickup. A level places one with a `blaster`
// id; walking within a metre takes it, owning it, switching to it, filling
// its magazine and giving it its reserveStart. Paul's rules (PLAN.md
// section 14): blasters are found in levels, B01 in 1-1.

const DT = 1 / 60;
const B = pickupData.blaster;

beforeAll(async () => {
  await RAPIER.init();
});

class NullDarts implements DartFiring {
  fire(_o: THREE.Vector3, _d: THREE.Vector3, _t: DartTypeName): void {}
}

/** A stand-in for the Loadout: three blasters, one of them owned. */
class FakeLoadout implements PickupLoadout {
  readonly ids = ["B01", "B02", "B04"];
  readonly blasters: Blaster[];
  owned = new Set<string>(["B02"]);
  active = 1;
  selected: number[] = [];
  constructor() {
    this.blasters = this.ids.map((id) =>
      new Blaster(resolveSpec(id), new NullDarts(), () => new THREE.Vector3()));
  }
  owns(id: string): boolean { return this.owned.has(id); }
  own(id: string): void { this.owned.add(id); }
  select(i: number): void {
    this.selected.push(i);
    if (this.owned.has(this.ids[i]!)) this.active = i;
  }
}

function rig() {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.createCollider(RAPIER.ColliderDesc.cuboid(40, 0.5, 40).setTranslation(0, -0.5, 0));
  const health = new PlayerHealth();
  const pickups = new PickupSystem(RAPIER, world, new THREE.Scene(), health);
  const loadout = new FakeLoadout();
  pickups.blasters = loadout.blasters;
  pickups.loadout = loadout;
  let taken = 0;
  pickups.onCollected = (kind) => { if (kind === "blaster") taken++; };
  return { pickups, loadout, taken: () => taken };
}

const level = (pickups: unknown[]): Level =>
  ({ meta: { id: "test" }, pickups } as unknown as Level);

describe("the blaster pickup (LVL-05)", () => {
  it("a level file's blaster entry spawns a blaster pickup", () => {
    const r = rig();
    r.pickups.loadLevelBoxes(level([
      { id: "pick-b01", type: "blaster", blaster: "B01", count: 0, pos: [0, B.foot, 0] },
    ]));
    expect(r.pickups.count("blaster")).toBe(1);
    expect(r.pickups.list[0]!.blasterId).toBe("B01");
    expect(r.pickups.count("ammo")).toBe(0);
  });

  it("is taken by walking within a metre, owning, selecting and filling it", () => {
    const r = rig();
    r.pickups.loadLevelBoxes(level([
      { id: "pick-b01", type: "blaster", blaster: "B01", count: 0, pos: [0, B.foot, 0] },
    ]));
    const b01 = r.loadout.blasters[0]!;
    b01.mag = 0;
    b01.reserve = 3;
    // Just outside the metre: nothing yet.
    r.pickups.update(DT, new THREE.Vector3(1.5, 0, 0));
    expect(r.pickups.count("blaster")).toBe(1);
    expect(r.loadout.owns("B01")).toBe(false);
    // Inside it: taken.
    for (let i = 0; i < 10 && r.pickups.count("blaster") > 0; i++) {
      r.pickups.update(DT, new THREE.Vector3(0.5, 0, 0));
    }
    expect(r.pickups.count("blaster")).toBe(0);
    expect(r.loadout.owns("B01")).toBe(true);
    expect(r.loadout.active).toBe(0); // switched to the found blaster
    expect(r.loadout.selected).toContain(0);
    expect(b01.mag).toBe(b01.spec.magSize);
    expect(b01.reserve).toBe(b01.spec.reserveStart);
    expect(r.taken()).toBe(1);
  });

  it("at 1.5 m it stays put", () => {
    const r = rig();
    r.pickups.loadLevelBoxes(level([
      { id: "pick-b01", type: "blaster", blaster: "B01", count: 0, pos: [0, B.foot, 0] },
    ]));
    for (let i = 0; i < 30; i++) r.pickups.update(DT, new THREE.Vector3(1.5, 0, 0));
    expect(r.pickups.count("blaster")).toBe(1);
    expect(r.loadout.owns("B01")).toBe(false);
    expect(r.taken()).toBe(0);
  });

  it("in test mode (everything owned) it is taken and only tops up ammo", () => {
    const r = rig();
    r.loadout.owned = new Set(r.loadout.ids);
    r.pickups.loadLevelBoxes(level([
      { id: "pick-b01", type: "blaster", blaster: "B01", count: 0, pos: [0, B.foot, 0] },
    ]));
    const b01 = r.loadout.blasters[0]!;
    b01.reserve = 4;
    for (let i = 0; i < 10 && r.pickups.count("blaster") > 0; i++) {
      r.pickups.update(DT, new THREE.Vector3(0.4, 0, 0));
    }
    expect(r.pickups.count("blaster")).toBe(0);
    expect(r.loadout.active).toBe(1); // no switch: it was already owned
    expect(r.loadout.selected).not.toContain(0);
    expect(b01.mag).toBe(b01.spec.magSize);
    expect(b01.reserve).toBe(b01.spec.reserveStart);
  });

  it("a pickup the loadout does not know stays on the floor", () => {
    const r = rig();
    r.pickups.loadLevelBoxes(level([
      { id: "pick-b08", type: "blaster", blaster: "B08", count: 0, pos: [0, B.foot, 0] },
    ]));
    for (let i = 0; i < 10; i++) r.pickups.update(DT, new THREE.Vector3(0.3, 0, 0));
    expect(r.pickups.count("blaster")).toBe(1);
    expect(r.taken()).toBe(0);
  });

  it("a stale blaster pickup keeps to its own cap, not the ammo box's", () => {
    const r = rig();
    for (let i = 0; i < B.max + 3; i++) {
      r.pickups.spawn("blaster", new THREE.Vector3(i * 3, B.foot, 0), new THREE.Vector3(), undefined, undefined, "B01");
    }
    expect(r.pickups.count("blaster")).toBe(B.max);
  });
});

describe("the blaster pickup's look (LVL-05)", () => {
  it("shows a copy of the blaster's own model, at the model's own size", () => {
    const r = rig();
    const model = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.9));
    body.position.set(0.2, -0.1, 0); // the viewmodel's placement
    model.add(body);
    r.pickups.blasterModels.set("B01", model);
    const it = r.pickups.spawn("blaster", new THREE.Vector3(0, 1, 0), new THREE.Vector3(), undefined, undefined, "B01");
    const copy = it.mesh.children[0]!;
    expect(copy).not.toBe(model); // a clone, so the viewmodel keeps its own
    expect(copy.scale.toArray()).toEqual([1, 1, 1]);
    expect(copy.rotation.toArray().slice(0, 3)).toEqual([0, 0, 0]);
    expect(copy.children).toHaveLength(1);
    // The source model is untouched.
    expect(model.children[0]!.position.x).toBe(0.2);
  });

  it("without a model it is an empty holder, not a crash", () => {
    const r = rig();
    const it = r.pickups.spawn("blaster", new THREE.Vector3(0, 1, 0), new THREE.Vector3(), undefined, undefined, "B08");
    expect(it.mesh.children).toHaveLength(0);
  });
});

// LVL-05: the whole stage 1 path in one place. A campaign loadout (the
// B02 alone, from the campaign rules) walks over the Pit's B01 pickup and
// comes away owning it, with it selected once the switch runs.
describe("a campaign pickup with the real Loadout (LVL-05)", () => {
  class VM {
    visible = false;
    setVisible(on: boolean): void { this.visible = on; }
    setMods(_s: string[], _h: string[]): void {}
    muzzleCameraPoint(_i: number, out: THREE.Vector3): THREE.Vector3 { return out.set(0, 0, -1); }
    onShot = (_m: number): void => {};
  }

  it("owns the B01 and switches to it", () => {
    const darts = new NullDarts();
    const ids = ["B01", "B04", "B06", "B05", "B03", "B02", "B07", "B08"];
    const vms = ids.map(() => new VM());
    const parts = ids.map((id, i) => ({
      id,
      blaster: new Blaster(resolveSpec(id), darts, () => new THREE.Vector3()),
      viewmodel: vms[i]!,
    }));
    const lo = new Loadout(parts, darts, 0.35, ownedAt("1-1-pit"));
    expect(lo.owns("B02")).toBe(true);
    expect(lo.owns("B01")).toBe(false);
    expect(lo.activeId()).toBe("B02");

    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    world.createCollider(RAPIER.ColliderDesc.cuboid(40, 0.5, 40).setTranslation(0, -0.5, 0));
    const pickups = new PickupSystem(RAPIER, world, new THREE.Scene(), new PlayerHealth());
    pickups.blasters = lo.blasters;
    pickups.loadout = lo;
    pickups.loadLevelBoxes(level([
      { id: "pick-b01", type: "blaster", blaster: "B01", pos: [0, B.foot, 0] },
    ]));
    for (let i = 0; i < 10 && pickups.count("blaster") > 0; i++) {
      pickups.update(DT, new THREE.Vector3(0.3, 0, 0));
    }
    expect(pickups.count("blaster")).toBe(0);
    expect(lo.owns("B01")).toBe(true);
    const no = { fireHeld: false, firePressed: false, reloadPressed: false };
    const aim = new THREE.Vector3(0, 0, -1);
    let guard = 0;
    while (lo.switching && guard++ < 200) lo.update(DT, no, aim);
    expect(lo.activeId()).toBe("B01");
    expect(vms[0]!.visible).toBe(true);
    expect(vms[5]!.visible).toBe(false);
    // The B01 comes with a full magazine and its reserveStart.
    expect(lo.active.mag).toBe(lo.active.spec.magSize);
    expect(lo.active.reserve).toBe(lo.active.spec.reserveStart);
  });
});
