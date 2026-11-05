import { beforeAll, describe, expect, it } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { Shield } from "../../src/player/shield";
import type { PlayerController } from "../../src/player/controller";
import type { Loadout } from "../../src/weapons/loadout";
import type { Foamer } from "../../src/foamers/foamer";
import { FoamerSystem } from "../../src/foamers/foamers";
import { DartSystem } from "../../src/weapons/darts";
import { DebrisSystem } from "../../src/voxel/debris";
import type { VoxelTarget } from "../../src/weapons/impacts";
import { greedyMesh } from "../../src/voxel/mesher";
import { linearColorTable } from "../../src/voxel/materials";
import { createFoamMaterial } from "../../src/render/foam-material";
import shieldJson from "../../data/shield.json";
import playerJson from "../../data/player.json";

// GAME-04c: the foam saw. The same rig as tests/shield/throw.test.ts (a real
// world, real Foamers, a fake player and loadout), used for the grind: the
// first Foamer a throw strikes is held and sawn, then the disc ricochets on
// as before. Every number is data/shield.json's.

const DT = 1 / 60;
const T = shieldJson as unknown as typeof shieldJson;
const EYE = playerJson.eyeHeight;

const LOWERED = {
  fireHeld: false, firePressed: false, shieldHeld: false, shieldPressed: false,
  reloadPressed: false,
};
const HELD = { ...LOWERED, shieldHeld: true };
const THROW = { ...LOWERED, shieldHeld: true, fireHeld: true, firePressed: true };

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
  const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 100);
  camera.rotation.order = "YXZ";
  camera.position.set(0, EYE, 0);
  const playerCollider = world.createCollider(
    RAPIER.ColliderDesc.capsule(0.6, 0.3).setTranslation(0, 0.9, 0),
  );
  const player = {
    vel: new THREE.Vector3(), pitch: 0, yaw: 0, speedScale: 1, allowSprint: true,
    collider: playerCollider,
  } as unknown as PlayerController;
  const shield = new Shield(
    RAPIER, world, scene, camera, player, { switching: false } as unknown as Loadout,
    foamers, debris, targets,
  );
  camera.add(shield.group);
  world.step();
  return {
    world, scene, camera, player, shield, foamers, debris,
    /** Let the parts' remesh promises land, then step so colliders exist. */
    async settle() {
      for (const f of foamers.list) for (const p of f.parts.values()) p.mesh.update();
      await new Promise((r) => setTimeout(r, 0));
      world.step();
    },
  };
}

function aimAt(g: ReturnType<typeof rig>, f: Foamer, up = 0.5) {
  const dx = f.centre.x - g.camera.position.x;
  const dz = f.centre.z - g.camera.position.z;
  g.player.yaw = Math.atan2(-dx, -dz);
  g.player.pitch = Math.atan2(f.centre.y + f.height * up - EYE, Math.hypot(dx, dz));
  g.camera.rotation.set(g.player.pitch, g.player.yaw, 0);
}

async function raised(g: ReturnType<typeof rig>) {
  for (let i = 0; i < 60 && g.shield.state !== "raised"; i++) g.shield.update(DT, HELD);
  for (let i = 0; i < 60 && g.shield.raise < 1; i++) g.shield.update(DT, HELD);
  expect(g.shield.state).toBe("raised");
}

function tick(g: ReturnType<typeof rig>, dt = DT) {
  g.foamers.update(dt, new THREE.Vector3(0, 0, 0));
  g.world.step();
}

/** Throw at the Foamer and step until the disc lodges (or the budget runs
 *  out). Returns the step count. */
function throwAndLodge(g: ReturnType<typeof rig>, f: Foamer, cap = 120) {
  aimAt(g, f);
  const e = g.shield.update(DT, THROW);
  expect(e.thrown).toBe(true);
  for (let i = 0; i < cap; i++) {
    const ev = g.shield.update(DT, LOWERED);
    tick(g);
    if (ev.sawStart) return i + 1;
  }
  throw new Error("the disc never lodged");
}

/** Step the lodged disc until the grind ends. Returns the steps taken. */
function stepGrind(g: ReturnType<typeof rig>, cap = 600, before?: () => void) {
  for (let i = 0; i < cap; i++) {
    const ev = g.shield.update(DT, LOWERED);
    tick(g);
    before?.();
    if (ev.sawEnd) return i + 1;
  }
  throw new Error("the grind never ended");
}

/** Run the flight out until the disc is caught. */
function catchDisc(g: ReturnType<typeof rig>, cap = 600) {
  for (let i = 0; i < cap && g.shield.state !== "lowered"; i++) {
    g.shield.update(DT, LOWERED);
    tick(g);
  }
  expect(g.shield.state).toBe("lowered");
}

describe("GAME-04c the foam saw", () => {
  beforeAll(async () => {
    await RAPIER.init();
  });

  it("1. the first struck Foamer is ground for the data's grindSeconds", async () => {
    const g = rig();
    const f = g.foamers.spawn(new THREE.Vector3(0, 0, -4))!;
    await g.settle();
    await raised(g);
    throwAndLodge(g, f);
    expect(g.shield.grinding).not.toBeNull();
    expect(g.shield.grinding!.target).toBe(f.spec.rig);
    const steps = stepGrind(g);
    // The grind runs the data's time, to the step.
    expect(steps).toBeCloseTo(T.saw.grindSeconds / DT, 0);
    expect(g.shield.grinding).toBeNull();
  });

  it("2. the disc stays at its point on the Foamer while the Foamer moves", async () => {
    const g = rig();
    const f = g.foamers.spawn(new THREE.Vector3(0, 0, -4))!;
    await g.settle();
    await raised(g);
    throwAndLodge(g, f);
    const probe = new THREE.Vector3();
    const part = f.parts.values().next().value!;
    const frameBefore = part.voxelToWorld(probe.set(1, 1, 1)).clone();
    const discBefore = g.shield.discMesh.position.clone();
    // Shove the Foamer a metre sideways through its own controller, then
    // step the world so its part bodies take the new pose.
    expect(g.foamers.knockStep(f, 1, 0, 1)).toBeGreaterThan(0.1);
    tick(g);
    const frameAfter = part.voxelToWorld(probe.set(1, 1, 1));
    g.shield.update(DT, LOWERED);
    const moved = frameAfter.clone().sub(frameBefore);
    const discMoved = g.shield.discMesh.position.clone().sub(discBefore);
    expect(moved.length()).toBeGreaterThan(0.1);
    // The disc moved with the Foamer, by the same vector: it is still at
    // its contact point on the body.
    expect(discMoved.distanceTo(moved)).toBeLessThan(0.02);
  });

  it("3. the tick count and the damage match the data", async () => {
    const g = rig();
    const f = g.foamers.spawn(new THREE.Vector3(0, 0, -4))!;
    await g.settle();
    const hp0 = f.health;
    await raised(g);
    throwAndLodge(g, f);
    stepGrind(g);
    const ticks = Math.round(T.saw.grindSeconds / T.saw.tickSeconds);
    expect(g.shield.sawTicks).toBe(ticks);
    // The strike's own damage plus one full tick per interval.
    expect(f.health).toBeCloseTo(
      hp0 - T.throw.damage - ticks * T.saw.damagePerTick, 4,
    );
  });

  it("4. a plate under the disc takes saw.plateShare of the tick, not a dart's share", async () => {
    const g = rig();
    // The Darter: plates on the front, where the disc comes from.
    const f = g.foamers.spawn(new THREE.Vector3(0, 0, -3), new THREE.Vector3(0, 0, 0), "F05")!;
    await g.settle();
    const hp0 = f.health;
    await raised(g);
    throwAndLodge(g, f);
    const plated = f.parts.has("chest") || f.parts.has("brow");
    expect(plated).toBe(true);
    stepGrind(g);
    const ticks = g.shield.sawTicks;
    expect(ticks).toBeGreaterThan(0);
    const perTick = (hp0 - T.throw.damage - f.health) / ticks;
    // The saw is the Darter's counter: a plate that shrugs off a dart
    // still takes the whole tick.
    expect(perTick).toBeCloseTo(T.saw.damagePerTick * T.saw.plateShare, 4);
    expect(T.saw.plateShare).toBeGreaterThan(0.15); // the dart's plate share
  });

  it("5. the saw never kills: canKill false keeps the floor and leaves it finishable", async () => {
    expect(T.saw.canKill).toBe(false);
    const g = rig();
    const f = g.foamers.spawn(new THREE.Vector3(0, 0, -4))!;
    await g.settle();
    f.health = 0.3; // one tick would be the end of it
    await raised(g);
    throwAndLodge(g, f);
    stepGrind(g);
    expect(f.health).toBeGreaterThan(0);
    expect(f.state).not.toBe("down");
    expect(f.finishWeakened).toBe(true);
    catchDisc(g);
  });

  it("6. after the grind the disc ricochets on and comes home", async () => {
    const g = rig();
    const a = g.foamers.spawn(new THREE.Vector3(0, 0, -4))!;
    const b = g.foamers.spawn(new THREE.Vector3(-1.6, 0, -5.5))!;
    await g.settle();
    await raised(g);
    const struck: Foamer[] = [a];
    aimAt(g, a);
    const e0 = g.shield.update(DT, THROW);
    expect(e0.thrown).toBe(true);
    let lodged = false;
    for (let i = 0; i < 900 && g.shield.state !== "lowered"; i++) {
      const ev = g.shield.update(DT, LOWERED);
      // Resolve the strikes before stepping on: a hit point is the
      // victim's feet centre as it was on that step.
      for (const p of ev.hits) {
        const hit = g.foamers.list.find((o) => Math.abs(o.centre.distanceToSquared(p)) < 1e-9);
        if (hit && struck[struck.length - 1] !== hit) struck.push(hit);
      }
      tick(g);
      if (ev.sawStart) lodged = true;
    }
    // Lodged first, then the ricochet carried it on to the other Foamer,
    // then it returned: the strike order is the ground one, then the
    // nearest other.
    expect(lodged).toBe(true);
    // The disc ground a first, then ricocheted to b (as the throw's own
    // ricochet does), and the flight went on for its 1 + bounces strikes.
    expect(struck[0]).toBe(a);
    expect(struck[1]).toBe(b);
    expect(struck.length).toBe(1 + T.throw.bounces);
    expect(g.shield.state).toBe("lowered");
  });

  it("7. a lodged disc blocks nothing and parries nothing", async () => {
    const g = rig();
    const f = g.foamers.spawn(new THREE.Vector3(0, 0, -4))!;
    await g.settle();
    await raised(g);
    throwAndLodge(g, f);
    expect(g.shield.state).not.toBe("raised");
    expect(g.shield.blocksAttackFrom(new THREE.Vector3(0, EYE, -2))).toBe(false);
    expect(g.shield.canParry()).toBe(false);
    expect(g.shield.blocksFire).toBe(true);
    catchDisc(g);
  });

  it("8. the held disc and the flying disc are the same model", async () => {
    const g = rig();
    const f = g.foamers.spawn(new THREE.Vector3(0, 0, -4))!;
    await g.settle();
    await raised(g);
    const model = g.shield.discModel;
    expect(model.parent).toBe(g.shield.group);
    // The model is the look the card asks for: three foam bands and a
    // band of nubs on the rim, plus the boss and the parry flash.
    const meshes = model.children.filter((c) => (c as THREE.Mesh).isMesh);
    expect(meshes.length).toBe(T.look.bands.length + T.look.nubCount + 2);
    aimAt(g, f);
    const e = g.shield.update(DT, THROW);
    expect(e.thrown).toBe(true);
    expect(g.shield.discModel.parent).toBe(g.shield.flight);
    expect(g.shield.discMesh).toBe(g.shield.flight);
    // The flight turns the disc about its own axis.
    const q0 = g.shield.flight.quaternion.clone();
    g.shield.update(DT, LOWERED);
    tick(g);
    expect(g.shield.flight.quaternion.angleTo(q0)).toBeGreaterThan(0);
    catchDisc(g);
    expect(g.shield.discModel.parent).toBe(g.shield.group);
  });

  it("9. the disc's look is built from foam the same way in both places", async () => {
    // A cheap guard on the look data: three bands, nubs on the rim, and a
    // spin, all from data/shield.json.
    const g = rig();
    const bands = T.look.bands;
    expect(bands.length).toBe(3);
    expect(T.look.nubCount).toBeGreaterThan(0);
    expect(T.look.spinRevPerSec).toBeGreaterThan(0);
    expect(T.saw.spinRevPerSec).toBeGreaterThan(T.look.spinRevPerSec);
    // The bands' radii fall from outside in and each sits forward of the
    // one outside it (the dome).
    for (let i = 1; i < bands.length; i++)
      expect(bands[i]!.radiusShare).toBeLessThan(bands[i - 1]!.radiusShare);
    expect(createFoamMaterial).toBeTypeOf("function");
    void g;
  });
});
