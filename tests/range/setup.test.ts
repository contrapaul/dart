import { beforeAll, describe, expect, it } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { greedyMesh } from "../../src/voxel/mesher";
import { linearColorTable } from "../../src/voxel/materials";
import type { Mesher } from "../../src/voxel/pieces";
import { DartSystem } from "../../src/weapons/darts";
import { DebrisSystem } from "../../src/voxel/debris";
import { FoamerSystem } from "../../src/foamers/foamers";
import { DartImpacts } from "../../src/weapons/impacts";
import { createRangeSystems, fillReserves } from "../../src/range/setup";
import { Loadout } from "../../src/weapons/loadout";
import { Blaster, resolveSpec } from "../../src/weapons/blaster";
import type { DartTypeName } from "../../src/weapons/darts";

// PT-01 stage 1: the range builds an ExplosionSystem and hands it to
// DartImpacts the way the game pages do, so a launcher round (B07), B05's
// explosive mod and B06's every fifth shot actually explode on the range.
// Before this the page made `new DartImpacts(darts, debris, voxelTargets)`
// with no explosion, so every one of those landed as a plain dart.

const DT = 1 / 60;

function fakeMesher(): Mesher {
  const colors = linearColorTable();
  return { mesh: (padded) => Promise.resolve(greedyMesh(padded, colors)) };
}

/** The range's own systems over a floor, built by the shared factory. */
function rig() {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.createCollider(RAPIER.ColliderDesc.cuboid(40, 0.5, 40).setTranslation(0, -0.5, 0));
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  const ignore = world.createCollider(
    RAPIER.ColliderDesc.capsule(0.5, 0.3).setTranslation(0, 0, 200),
    body,
  );
  const darts = new DartSystem(new THREE.Scene(), world, RAPIER, ignore);
  const sys = createRangeSystems(RAPIER, world, darts, fakeMesher(), ignore);
  world.step();
  return { world, darts, ...sys };
}

function tick(r: ReturnType<typeof rig>, player: THREE.Vector3, n = 1) {
  for (let i = 0; i < n; i++) {
    r.darts.update(DT);
    r.foamers.update(DT, player);
    r.world.step();
  }
}

beforeAll(async () => {
  await RAPIER.init();
});

describe("PT-01 stage 1: the range explodes", () => {
  it("the factory wires the explosion into the impacts and the Foamer system", () => {
    const r = rig();
    expect(r.impacts).toBeTruthy();
    expect(r.explosion.foamers).toBe(r.foamers);
    // DartImpacts chains the dart system's update onto the cap clock.
    const before = r.explosion.time;
    r.darts.update(DT);
    expect(r.explosion.time).toBeGreaterThan(before);
  });

  it("a launcher round hitting the floor near a Foamer damages it (it did not before)", async () => {
    const r = rig();
    const player = new THREE.Vector3(0, 1, 8);
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 0), player, "F01");
    expect(f).not.toBeNull();
    // Raised so one round cannot kill it: a Foamer that dies inside a blast
    // trips a separate crash (knockStep poses a body the ragdoll already
    // made dynamic, src/weapons/explosion.ts:165 -> src/foamers/foamer.ts:447,
    // reproducible without this card's code; reported in HANDOFF).
    f!.health = 400;
    const healthBefore = f!.health;
    // B07's round: the launcher type, exploding on its first hit. Fired low
    // and downward it meets the floor about 1 m in front of the Foamer, so
    // any damage the blast does is the explosion's, not a dart's.
    r.darts.fire(
      new THREE.Vector3(0, 1.0, 3),
      new THREE.Vector3(0, -0.5, -1).normalize(),
      "launcher",
      { id: 1, muzzle: new THREE.Vector3(0, 1.0, 3), chunk: null, explodes: true },
    );
    tick(r, player, 120);
    expect(r.explosion.stats.blasts).toBe(1);
    expect(r.explosion.stats.damage).toBe(1);
    expect(f!.state).not.toBe("down");
    expect(f!.health).toBeLessThan(healthBefore);
  });

  it("the same round with no explosion system leaves the Foamer whole (the old range)", async () => {
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    world.createCollider(RAPIER.ColliderDesc.cuboid(40, 0.5, 40).setTranslation(0, -0.5, 0));
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    const ignore = world.createCollider(
      RAPIER.ColliderDesc.capsule(0.5, 0.3).setTranslation(0, 0, 200),
      body,
    );
    const darts = new DartSystem(new THREE.Scene(), world, RAPIER, ignore);
    const debris = new DebrisSystem(RAPIER, world);
    const foamers = new FoamerSystem(RAPIER, world, fakeMesher(), debris, darts, []);
    new DartImpacts(darts, debris, []); // no explosion: what the old page built
    world.step();
    const player = new THREE.Vector3(0, 1, 8);
    const f = foamers.spawn(new THREE.Vector3(0, 0, 0), player, "F01");
    for (let i = 0; i < 40; i++) {
      let busy = false;
      for (const p of f!.parts.values()) if (p.mesh.busy) busy = true;
      if (!busy) break;
      await new Promise((res) => setTimeout(res, 0));
    }
    const healthBefore = f!.health;
    darts.fire(
      new THREE.Vector3(0, 1.0, 3),
      new THREE.Vector3(0, -0.5, -1).normalize(),
      "launcher",
      { id: 1, muzzle: new THREE.Vector3(0, 1.0, 3), chunk: null, explodes: true },
    );
    for (let i = 0; i < 120; i++) {
      darts.update(DT);
      foamers.update(DT, player);
      world.step();
    }
    expect(f!.health).toBe(healthBefore);
  });
});

// A fake viewmodel and a fake dart system, as in tests/weapons/loadout.test.ts.
class FakeVM {
  visible = false;
  setVisible(on: boolean): void { this.visible = on; }
  setMods(_s: string[], _h: string[]): void {}
  muzzleCameraPoint(_i: number, out: THREE.Vector3): THREE.Vector3 {
    return out.set(0, 0, -1);
  }
  onShot = (_m: number): void => {};
}
class FakeDarts {
  readonly types: DartTypeName[] = [];
  fire(_o: THREE.Vector3, _d: THREE.Vector3, t: DartTypeName): void {
    this.types.push(t);
  }
}

function loadoutOf(ids: string[]): { lo: Loadout; darts: FakeDarts } {
  const darts = new FakeDarts();
  const lo = new Loadout(
    ids.map((id) => ({
      id,
      blaster: new Blaster(resolveSpec(id), darts as never, () => new THREE.Vector3(0, 0, -1)),
      viewmodel: new FakeVM(),
    })),
    darts as never,
    0.35,
  );
  return { lo, darts };
}

describe("PT-01 stage 1: the reserve never runs out", () => {
  it("fillReserves tops the reserve back and leaves the magazine alone", () => {
    const { lo } = loadoutOf(["B01", "B04", "B03", "B06", "B02", "B05", "B07", "B08"]);
    expect(lo.ids).toEqual(["B01", "B04", "B03", "B06", "B02", "B05", "B07", "B08"]);
    const b = lo.blasters[0];
    b.reserve = 3;
    const mag = b.mag;
    fillReserves(lo);
    expect(b.reserve).toBe(b.spec.reserveMax);
    expect(b.mag).toBe(mag);
  });

  it("a magazine still empties and a reload still takes time even with full reserves", () => {
    const { lo } = loadoutOf(["B01"]);
    const b = lo.blasters[0];
    const HOLD = { fireHeld: true, firePressed: true, reloadPressed: false };
    const NONE = { fireHeld: false, firePressed: false, reloadPressed: false };
    // Fire the whole magazine dry.
    for (let i = 0; i < 600 && b.mag > 0; i++) lo.update(DT, HOLD, new THREE.Vector3(0, 0, -1));
    expect(b.mag).toBe(0);
    fillReserves(lo);
    expect(b.reserve).toBe(b.spec.reserveMax);
    // The auto reload runs: the magazine comes back only after its time.
    const reloadSeconds = b.spec.reloadTime;
    let t = 0;
    while (b.mag === 0 && t < 10) {
      lo.update(DT, NONE, new THREE.Vector3(0, 0, -1));
      fillReserves(lo);
      t += DT;
    }
    expect(b.mag).toBeGreaterThan(0);
    expect(t).toBeGreaterThan(reloadSeconds * 0.5);
    expect(t).toBeLessThan(reloadSeconds * 2);
  });
});
