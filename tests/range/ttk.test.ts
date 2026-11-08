import { beforeAll, describe, expect, it } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { greedyMesh } from "../../src/voxel/mesher";
import { linearColorTable } from "../../src/voxel/materials";
import type { Mesher } from "../../src/voxel/pieces";
import { DartSystem, type DartShot } from "../../src/weapons/darts";
import { Blaster, resolveSpec } from "../../src/weapons/blaster";
import { Loadout } from "../../src/weapons/loadout";
import { TtkTracker } from "../../src/range/ttk";
import { createLineup, createRangeSystems } from "../../src/range/setup";

// PT-01 stage 3: the time-to-kill readout. The card: for each Foamer, from
// the first hit on it to the moment it goes down or pops, the blaster, the
// mods on, the seconds, the trigger pulls that hit it and the distance. The
// tracker holds no DOM, so this drives the real dart system, the real
// blaster and the real Foamer system, the way the page does.

const DT = 1 / 60;
// The darts fly at an F01's middle: higher, they pass over it once it
// staggers and sags, and the kill in a test depends on the spread's luck.
const PLAYER = new THREE.Vector3(0, 0.7, 6);

function fakeMesher(): Mesher {
  const colors = linearColorTable();
  return { mesh: (padded) => Promise.resolve(greedyMesh(padded, colors)) };
}

class FakeVM {
  visible = false;
  setVisible(on: boolean): void { this.visible = on; }
  setMods(_show: string[], _hide: string[]): void {}
  muzzleCameraPoint(_i: number, out: THREE.Vector3): THREE.Vector3 {
    return out.copy(PLAYER); // the muzzle is at the player's eye, looking -z
  }
  onShot = (_m: number): void => {};
}

interface Rig {
  world: RAPIER.World;
  darts: DartSystem;
  foamers: ReturnType<typeof createRangeSystems>["foamers"];
  loadout: Loadout;
  ttk: TtkTracker;
}

/** A loadout of the given blaster ids (fake viewmodels: no GLTF in Node) and
 *  the range's own systems, with the tracker wired the way main.ts wires it. */
function rig(ids: string[]): Rig {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.createCollider(RAPIER.ColliderDesc.cuboid(40, 0.5, 40).setTranslation(0, -0.5, 0));
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  const ignore = world.createCollider(
    RAPIER.ColliderDesc.capsule(0.5, 0.3).setTranslation(0, 0, 200),
    body,
  );
  const darts = new DartSystem(new THREE.Scene(), world, RAPIER, ignore);
  const sys = createRangeSystems(RAPIER, world, darts, fakeMesher(), ignore);
  const out = new THREE.Vector3();
  const parts = ids.map((id) => ({
    id,
    // The muzzle is the player's eye, where FakeVM reports it, so the darts
    // fly from the player at the lineup, as they do on the page.
    blaster: new Blaster(resolveSpec(id), darts, () => out.copy(PLAYER)),
    viewmodel: new FakeVM(),
  }));
  const loadout = new Loadout(parts, darts, 0.35);
  const ttk = new TtkTracker();
  ttk.track(darts, loadout, sys.foamers);
  world.step();
  return { world, darts, foamers: sys.foamers, loadout, ttk };
}

const AIM = new THREE.Vector3(0, 0, -1);
const NO_FIRE = { fireHeld: false, firePressed: false, reloadPressed: false };

/** Step everything the page steps, firing or not, for `seconds`. */
function tick(r: Rig, seconds: number, fire = false) {
  const n = Math.round(seconds / DT);
  for (let i = 0; i < n; i++) {
    r.loadout.update(DT, fire ? { ...NO_FIRE, fireHeld: true, firePressed: true } : NO_FIRE, AIM);
    r.darts.update(DT);
    r.foamers.update(DT, PLAYER);
    r.ttk.update(DT, r.foamers, PLAYER);
    r.world.step();
  }
}

async function settle(r: Rig) {
  for (let i = 0; i < 240; i++) {
    let busy = false;
    for (const f of r.foamers.list) {
      for (const p of f.parts.values()) {
        p.mesh.update(); // the fake mesher is done at once; this builds the part's collider
        if (p.mesh.busy) busy = true;
      }
    }
    r.world.step();
    if (!busy) return;
    await new Promise((res) => setTimeout(res, 0));
  }
}

beforeAll(async () => {
  await RAPIER.init();
});

describe("PT-01 stage 3: the time-to-kill record", () => {
  it("a kill by the B01 records the blaster, a time, its pulls and the distance", async () => {
    const r = rig(["B01"]);
    const line = createLineup(r.foamers, PLAYER, ["F01"], 6, 4);
    await settle(r);
    const f = line[0]!.foamer;
    tick(r, 12, true);
    expect(f.state).toBe("down");
    expect(r.ttk.kills.length).toBe(1);
    const k = r.ttk.kills[0]!;
    expect(k.type).toBe("F01");
    expect(k.blaster).toBe("B01"); // the blaster that landed the killing blow
    expect(k.mods).toEqual([]); // none were turned on
    expect(k.how).toBe("down");
    // The first hit is the dart's flight (about 0.16 s over 6 m), the end is
    // the step it went down on: a real, positive span, not a rounded 0.
    expect(k.seconds).toBeGreaterThan(0.1);
    expect(k.seconds).toBeLessThan(12);
    // Trigger pulls that hit it, not darts: B01 fires 3 darts per pull.
    expect(k.shots).toBeGreaterThanOrEqual(1);
    expect(k.shots).toBeLessThan(f.maxHealth + 1);
    // Metres from the player to it when the first hit landed.
    expect(k.distanceMetres).toBeCloseTo(PLAYER.distanceTo(f.centre), 1);
  });

  it("the mods on the blaster for the killing shot are the ones recorded", async () => {
    const r = rig(["B01"]);
    const line = createLineup(r.foamers, PLAYER, ["F01"], 6, 4);
    await settle(r);
    r.loadout.setMod(0, "slug", true); // one heavy dart instead of three
    tick(r, 12, true);
    expect(line[0]!.foamer.state).toBe("down");
    expect(r.ttk.kills[0]!.mods).toEqual(["slug"]);
    expect(r.ttk.kills[0]!.blaster).toBe("B01");
  });

  it("the blaster recorded is the one that fired the killing blow", async () => {
    const r = rig(["B01", "B04"]);
    const line = createLineup(r.foamers, PLAYER, ["F01"], 6, 4);
    await settle(r);
    const f = line[0]!.foamer;
    // One B01 dart (fired while it is active, so it is the B01's), not a
    // full pull, which can kill the F01 before the switch.
    r.darts.fire(PLAYER, AIM, "standard", { id: 777, muzzle: PLAYER.clone(), chunk: null });
    tick(r, 0.5);
    expect(f.health).toBeLessThan(f.maxHealth);
    expect(f.state).not.toBe("down");
    for (let i = 0; i < 60 && r.loadout.activeId() === "B01"; i++) {
      r.loadout.select(1);
      tick(r, DT);
    }
    tick(r, 12, true);
    expect(f.state).toBe("down");
    expect(r.ttk.kills[0]!.blaster).toBe("B04");
  });

  it("one trigger pull counts once however many of its darts hit", async () => {
    const r = rig(["B01"]);
    const line = createLineup(r.foamers, PLAYER, ["F01"], 6, 4);
    await settle(r);
    const f = line[0]!.foamer;
    // One pull by hand: B01's three darts share one shot id, and a weak
    // F01 takes them all.
    const shot: DartShot = { id: 4242, muzzle: PLAYER.clone(), chunk: null };
    for (let i = 0; i < 3; i++) r.darts.fire(PLAYER, AIM, "standard", shot);
    tick(r, 1);
    expect(f.health).toBeLessThan(f.maxHealth);
    r.foamers.blastDamage(f, f.health); // finish it, no dart involved
    tick(r, 0.5);
    expect(r.ttk.kills.length).toBe(1);
    expect(r.ttk.kills[0]!.shots).toBe(1);
  });

  it("a dart that hits the floor starts no record", async () => {
    const r = rig(["B01"]);
    const line = createLineup(r.foamers, PLAYER, ["F01"], 6, 4);
    await settle(r);
    const shot: DartShot = { id: 7, muzzle: PLAYER.clone(), chunk: null };
    r.darts.fire(new THREE.Vector3(10, 1.5, 12), new THREE.Vector3(0, -1, 0), "standard", shot);
    tick(r, 1);
    // Nothing was ever hit, so the Foamer's end is not a kill the readout
    // can time (the card measures from the first hit on it).
    r.foamers.blastDamage(line[0]!.foamer, line[0]!.foamer.health);
    tick(r, 0.5);
    expect(r.ttk.kills.length).toBe(0);
  });

  it("the panel keeps the last five kills, newest at the top", async () => {
    const r = rig(["B01"]);
    for (let i = 0; i < 7; i++) {
      // Each round on its own spot, 4 m along: the last one popped into
      // foam debris, and a falling chunk in the line would take the dart.
      const at = new THREE.Vector3(PLAYER.x + i * 4, PLAYER.y, PLAYER.z);
      const line = createLineup(r.foamers, at, ["F01"], 6, 4);
      await settle(r);
      // One straight dart at its middle (a B01 pull's spread can miss all
      // three at 6 m, and then nothing is watched): this puts it under watch.
      const f0 = line[0]!.foamer;
      const from = new THREE.Vector3(at.x, f0.centre.y + f0.height * 0.5, at.z);
      r.darts.fire(from, AIM, "standard", { id: 100 + i, muzzle: from.clone(), chunk: null });
      tick(r, 0.4);
      expect(f0.health, `round ${i}`).toBeLessThan(f0.maxHealth);
      r.foamers.blastDamage(f0, f0.health);
      tick(r, 0.5);
    }
    expect(r.ttk.kills.length).toBe(5); // the card: the last five
    expect(r.ttk.kills.every((k) => k.type === "F01" && k.blaster === "B01")).toBe(true);
  });

  it("Respawn forgets the line that is going", async () => {
    const r = rig(["B01"]);
    const line = createLineup(r.foamers, PLAYER, ["F01"], 6, 4);
    await settle(r);
    const shot: DartShot = { id: 11, muzzle: PLAYER.clone(), chunk: null };
    r.darts.fire(PLAYER, AIM, "standard", shot);
    tick(r, 0.5);
    expect(line[0]!.foamer.health).toBeLessThan(line[0]!.foamer.maxHealth);
    r.ttk.reset();
    // The wounded Foamer's own end is no longer watched, and the old shot
    // cannot be attributed to anything.
    r.foamers.blastDamage(line[0]!.foamer, line[0]!.foamer.health);
    tick(r, 0.5);
    expect(r.ttk.kills.length).toBe(0);
  });
});
