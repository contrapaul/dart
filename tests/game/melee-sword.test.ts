import { beforeAll, describe, expect, it } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { Melee } from "../../src/game/melee";
import { MeleeView, buildSword } from "../../src/game/meleeView";
import { PickupSystem, type PickupMelee } from "../../src/pickups/pickups";
import { PlayerHealth } from "../../src/player/health";
import { FoamerSystem } from "../../src/foamers/foamers";
import { DartSystem } from "../../src/weapons/darts";
import { DebrisSystem } from "../../src/voxel/debris";
import type { VoxelTarget } from "../../src/weapons/impacts";
import { greedyMesh } from "../../src/voxel/mesher";
import { linearColorTable } from "../../src/voxel/materials";
import type { Foamer } from "../../src/foamers/foamer";
import { validateLevel } from "../../src/level/validate";
import type { Level } from "../../src/level/format";
import {
  CAMPAIGN_START_MELEE, ownedMeleeAt, foundMeleeAt, MELEE_IDS_KNOWN,
} from "../../src/game/campaign";
import type { Shield } from "../../src/player/shield";
import meleeJson from "../../data/melee.json";
import pitJson from "../../data/levels/1-1-pit.json";
import envThreeJson from "../../data/levels/env-03.json";
import pickupData from "../../data/pickups.json";
import playerJson from "../../data/player.json";

// MEL-01: M01 is a foam sword. Its look is code built from data/melee.json
// `look`, the campaign owns hand weapons the way it owns blasters, and a
// `melee` pickup gives one. The rig is the melee test's: a real world, a
// real capsule, real Foamers.

const T = meleeJson as unknown as typeof meleeJson & {
  look: {
    blade: { length: number; width: number; thickness: number };
    guard: { width: number; height: number };
    grip: { length: number };
    pommel: { length: number };
    dip: number;
  };
};
const DT = 1 / 60;
const EYE = playerJson.eyeHeight;
const DOWN = { state: "lowered", charging: false, parries: 0 } as unknown as Shield;

function fakeMesher() {
  const colors = linearColorTable();
  return { mesh: (padded: never) => Promise.resolve(greedyMesh(padded, colors)) };
}

function rig() {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.createCollider(RAPIER.ColliderDesc.cuboid(40, 0.5, 40).setTranslation(0, -0.5, 0));
  const pb = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  const ignore = world.createCollider(
    RAPIER.ColliderDesc.capsule(0.5, 0.3).setTranslation(0, 0, 200),
    pb,
  );
  const scene = new THREE.Scene();
  const darts = new DartSystem(scene, world, RAPIER, ignore);
  const debris = new DebrisSystem(RAPIER, world);
  const targets: VoxelTarget[] = [];
  const foamers = new FoamerSystem(RAPIER, world, fakeMesher(), debris, darts, targets);
  const playerCollider = world.createCollider(
    RAPIER.ColliderDesc.capsule(0.6, 0.3).setTranslation(0, 0.9, 0),
  );
  const melee = new Melee(RAPIER, world, foamers, debris, targets, playerCollider);
  world.step();
  return { world, foamers, melee };
}

const _eye = new THREE.Vector3();
const _fwd = new THREE.Vector3();
function swingAt(g: ReturnType<typeof rig>, f: Foamer) {
  _eye.set(0, EYE, 0);
  _fwd.set(f.centre.x, f.centre.y + f.height * 0.5 - EYE, f.centre.z).normalize();
  return g.melee.press(_eye, _fwd, DOWN);
}

function rest(g: ReturnType<typeof rig>) {
  for (let i = 0; i < Math.ceil((T.swingTime + 0.05) / DT); i++) g.melee.update(DT, DOWN);
}

beforeAll(async () => {
  await RAPIER.init();
});

describe("the campaign owns hand weapons (MEL-01)", () => {
  it("a new campaign owns none, and none are on offer in Act 1", () => {
    expect(CAMPAIGN_START_MELEE).toEqual([]);
    expect(ownedMeleeAt("1-1-pit")).toEqual([]);
    expect(ownedMeleeAt("1-4")).toEqual([]);
    // The first is found in 2-1, just before Arena 1.
    expect(foundMeleeAt("2-1")).toBe("M01");
    expect(foundMeleeAt("1-2")).toBeNull();
    expect([...MELEE_IDS_KNOWN]).toEqual(["M01"]);
  });

  it("a level outside the order owns the start set alone, the blaster rule", () => {
    // The order stops after 1-4, so 2-1's sword is not reached by walking it
    // (foundAt has the same shape for the blasters). When Act 2 joins the
    // order the sword joins the start set the same way a blaster does.
    expect(ownedMeleeAt("2-1")).toEqual([]);
    expect(ownedMeleeAt("2-2")).toEqual([]);
  });

  it("with no hand weapon the melee key bashes and spends no charge", () => {
    const g = rig();
    const f = g.foamers.spawn(new THREE.Vector3(0, 0, -1.0))!;
    g.melee.setArmed(false);
    expect(g.melee.armed).toBe(false);
    expect(g.melee.charges).toBe(0);
    const hp0 = f.health;
    const e = swingAt(g, f);
    expect(e.swung).toBe(-1); // the bash, the no-charge press
    expect(hp0 - f.health).toBeCloseTo(T.bash.damage, 5);
    expect(g.melee.charges).toBe(0);
  });

  it("a parry or the recharge timer cannot arm fists", () => {
    const g = rig();
    g.melee.setArmed(false);
    const parry = { state: "lowered", charging: false, parries: 3 } as unknown as Shield;
    for (let i = 0; i < 10; i++) {
      g.melee.update(DT, parry);
      expect(g.melee.charges).toBe(0);
    }
    for (let i = 0; i < Math.ceil((T.rechargeSeconds + 1) / DT); i++) {
      g.melee.update(DT, DOWN);
      expect(g.melee.charges).toBe(0);
    }
  });

  it("taking the sword up fills its charges, and the combo swings again", () => {
    const g = rig();
    const f = g.foamers.spawn(new THREE.Vector3(0, 0, -1.6))!;
    g.melee.setArmed(false);
    expect(swingAt(g, f).swung).toBe(-1);
    rest(g);
    g.melee.setArmed(true);
    expect(g.melee.charges).toBe(T.charges);
    expect(g.melee.weaponId).toBe("M01");
    expect(swingAt(g, f).swung).toBe(0);
    rest(g);
    expect(swingAt(g, f).swung).toBe(1);
    expect(g.melee.charges).toBe(T.charges - 2);
  });

  it("putting it away drops the swing and the charges", () => {
    const g = rig();
    const f = g.foamers.spawn(new THREE.Vector3(0, 0, -1.6))!;
    expect(swingAt(g, f).swung).toBe(0);
    expect(g.melee.swinging).toBe(true);
    g.melee.setArmed(false);
    expect(g.melee.swinging).toBe(false);
    expect(g.melee.comboStep).toBe(0);
    expect(g.melee.charges).toBe(0);
  });

  it("a restart fills an owned weapon and leaves fists empty", () => {
    const g = rig();
    g.melee.charges = 0;
    g.melee.reset();
    expect(g.melee.charges).toBe(T.charges);
    g.melee.setArmed(false);
    g.melee.reset();
    expect(g.melee.charges).toBe(0);
  });

  it("outside the campaign (the test page, the range) M01 is owned", () => {
    const g = rig();
    expect(g.melee.armed).toBe(true);
    expect(g.melee.weaponId).toBe("M01");
    expect(g.melee.charges).toBe(T.charges);
  });
});

describe("the melee pickup (MEL-01)", () => {
  class FakeMelee implements PickupMelee {
    readonly weaponId = "M01";
    armed = false;
    setArmed(on: boolean): void { this.armed = on; }
  }

  function pickups() {
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    world.createCollider(RAPIER.ColliderDesc.cuboid(40, 0.5, 40).setTranslation(0, -0.5, 0));
    const p = new PickupSystem(RAPIER, world, new THREE.Scene(), new PlayerHealth());
    const melee = new FakeMelee();
    p.melee = melee;
    const taken: string[] = [];
    p.onMelee = (id) => taken.push(id);
    return { p, melee, taken };
  }

  const M = pickupData.melee;
  const level = (list: unknown[]): Level => ({ meta: { id: "test" }, pickups: list } as unknown as Level);

  it("a level's melee entry spawns the sword", () => {
    const r = pickups();
    r.p.loadLevelBoxes(level([
      { id: "pick-m01", type: "melee", melee: "M01", pos: [0, M.foot, 0] },
    ]));
    expect(r.p.count("melee")).toBe(1);
    expect(r.p.list[0]!.meleeId).toBe("M01");
    // The look is the sword: more than one part, and blade coloured.
    expect(r.p.list[0]!.mesh.children.length).toBeGreaterThan(1);
  });

  it("walking within a metre takes it and arms the melee", () => {
    const r = pickups();
    r.p.loadLevelBoxes(level([
      { id: "pick-m01", type: "melee", melee: "M01", pos: [0, M.foot, 0] },
    ]));
    r.p.update(DT, new THREE.Vector3(1.5, 0, 0));
    expect(r.p.count("melee")).toBe(1);
    expect(r.melee.armed).toBe(false);
    for (let i = 0; i < 10 && r.p.count("melee") > 0; i++) {
      r.p.update(DT, new THREE.Vector3(0.4, 0, 0));
    }
    expect(r.p.count("melee")).toBe(0);
    expect(r.melee.armed).toBe(true);
    expect(r.taken).toEqual(["M01"]);
  });

  it("a hand weapon the melee does not hold stays on the floor", () => {
    const r = pickups();
    r.p.loadLevelBoxes(level([
      { id: "pick-m02", type: "melee", melee: "M01", pos: [0, M.foot, 0] },
    ]));
    // The melee only knows M01, so ask for one it cannot take.
    r.p.list[0]!.meleeId = "M02";
    for (let i = 0; i < 10; i++) r.p.update(DT, new THREE.Vector3(0.3, 0, 0));
    expect(r.p.count("melee")).toBe(1);
    expect(r.melee.armed).toBe(false);
    expect(r.taken).toEqual([]);
  });

  it("the real sword: no weapon bashes, the pickup arms it, then the combo", () => {
    // The whole path, with the real Melee and the real pickup system: a
    // player with no hand weapon swings a bash, walks over the sword, and
    // the next presses are the three-hit combo.
    const g = rig();
    const f = g.foamers.spawn(new THREE.Vector3(0, 0, -1.0))!;
    g.melee.setArmed(false);
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    world.createCollider(RAPIER.ColliderDesc.cuboid(40, 0.5, 40).setTranslation(0, -0.5, 0));
    const p = new PickupSystem(RAPIER, world, new THREE.Scene(), new PlayerHealth());
    p.melee = g.melee;
    p.loadLevelBoxes({
      meta: { id: "test" },
      pickups: [{ id: "pick-m01", type: "melee", melee: "M01", pos: [0, M.foot, 0] }],
    } as unknown as Level);
    expect(swingAt(g, f).swung).toBe(-1); // the bash
    rest(g);
    for (let i = 0; i < 10 && p.count("melee") > 0; i++) {
      p.update(DT, new THREE.Vector3(0.4, 0, 0));
    }
    expect(p.count("melee")).toBe(0);
    expect(swingAt(g, f).swung).toBe(0);
    rest(g);
    expect(swingAt(g, f).swung).toBe(1);
  });
});

describe("the validator takes the melee entry (MEL-01)", () => {
  const withPickups = (list: unknown[]): Level => {
    const lv = structuredClone(pitJson) as unknown as Level;
    lv.pickups = list as Level["pickups"];
    return lv;
  };

  it("accepts a melee entry naming M01", () => {
    const errors = validateLevel(withPickups([
      { id: "pick", type: "melee", melee: "M01", pos: [0, 0.22, 0] },
    ])).errors;
    expect(errors).toEqual([]);
  });

  it("rejects one naming a hand weapon that does not exist", () => {
    const errors = validateLevel(withPickups([
      { id: "pick", type: "melee", melee: "M09", pos: [0, 0.22, 0] },
    ])).errors;
    expect(errors.join(" ")).toMatch(/M09 is not a hand weapon/);
  });

  it("rejects one with no hand weapon at all", () => {
    const errors = validateLevel(withPickups([
      { id: "pick", type: "melee", pos: [0, 0.22, 0] },
    ])).errors;
    expect(errors.join(" ")).toMatch(/is not a hand weapon/);
  });
});

describe("the sword's look (MEL-01)", () => {
  it("is the foam sword the look data sizes: blade, guard, grip, pommel", () => {
    const sword = buildSword();
    // Five parts (guard, grip, pommel, blade, tip), none of them metal.
    expect(sword.children).toHaveLength(5);
    const boxes = sword.children.filter((o) => (o as THREE.Mesh).geometry instanceof THREE.BoxGeometry);
    expect(boxes.length).toBe(2);
    const blade = boxes.find((o) => o.position.y > 0)!;
    const geo = (blade as THREE.Mesh).geometry as THREE.BoxGeometry;
    expect(geo.parameters.height).toBeCloseTo(T.look.blade.length, 5);
    expect(geo.parameters.width).toBeCloseTo(T.look.blade.width, 5);
    expect(geo.parameters.depth).toBeCloseTo(T.look.blade.thickness, 5);
    const guard = boxes.find((o) => o.position.y === 0)!;
    expect(((guard as THREE.Mesh).geometry as THREE.BoxGeometry).parameters.width).toBeCloseTo(T.look.guard.width, 5);
    // The grip sits below the guard, the pommel below the grip.
    const grip = sword.children.find((o) => (o as THREE.Mesh).geometry instanceof THREE.CylinderGeometry)!;
    expect(grip.position.y).toBeLessThan(0);
    const pommel = sword.children.find((o) => (o as THREE.Mesh).geometry instanceof THREE.SphereGeometry)!;
    expect(pommel.position.y).toBeLessThan(grip.position.y);
    // Foam, not metal: nothing shines.
    sword.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
      if (m && m.isMeshStandardMaterial) {
        expect(m.metalness).toBe(0);
        expect(m.roughness).toBeGreaterThan(0.8);
      }
    });
  });

  it("the view holds it, swings through three strokes and dips the blaster", () => {
    const camera = new THREE.PerspectiveCamera();
    const view = new MeleeView(camera);
    // Part of the camera, out of sight until a swing.
    expect(camera.children).toContain(view.group);
    expect(view.group.visible).toBe(false);
    expect(view.dip).toBe(0);
    const seen: number[] = [];
    for (let hit = 0; hit < 3; hit++) {
      view.swing(hit);
      expect(view.group.visible).toBe(true);
      view.render(T.swingTime / 2);
      seen.push(view.dip);
      expect(view.dip).toBeLessThan(0); // the blaster is out of the way
      view.render(T.swingTime);
      expect(view.group.visible).toBe(false);
    }
    expect(seen).toHaveLength(3);
    // The dip is never deeper than the data says.
    view.swing(0);
    view.render(T.swingTime / 2);
    expect(view.dip).toBeGreaterThanOrEqual(-T.look.dip);
  });

  it("reset hides it", () => {
    const view = new MeleeView(new THREE.PerspectiveCamera());
    view.swing(1);
    view.reset();
    expect(view.group.visible).toBe(false);
    expect(view.dip).toBe(0);
  });
});

// MEL-01: level 2-1 is not built yet, so the sword's pickup lives in the
// mod station test room, near the player start, until Paul's level exists.
describe("env-03 carries a sword to try (MEL-01)", () => {
  it("places one, near the start and over the room's floor", () => {
    const lv = envThreeJson as unknown as Level;
    const mine = (lv.pickups ?? []).filter((p) => p.type === "melee");
    expect(mine).toHaveLength(1);
    expect(mine[0]!.melee).toBe("M01");
    const d = Math.hypot(
      mine[0]!.pos[0] - lv.playerStart.pos[0],
      mine[0]!.pos[2] - lv.playerStart.pos[2],
    );
    expect(d).toBeLessThan(6);
    expect(validateLevel(lv).errors).toEqual([]);
  });
});
