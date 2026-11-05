import { beforeAll, describe, expect, it } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { linearColorTable } from "../../src/voxel/materials";
import { greedyMesh } from "../../src/voxel/mesher";
import { DebrisSystem } from "../../src/voxel/debris";
import { DartSystem } from "../../src/weapons/darts";
import { DartImpacts, type VoxelTarget } from "../../src/weapons/impacts";
import { FoamerSystem } from "../../src/foamers/foamers";
import { Director } from "../../src/ai/director";
import { NavGrid } from "../../src/ai/nav-grid";

// BUG-01: a Foamer that walks but cannot make progress must sidestep instead
// of standing still. The card's rule is 1 to 2 s, and the data's
// stallWindowSeconds is 1.5, so no two second window of a walking Foamer may
// pass with it barely moving. The wall here is added after the bake, so the
// grid still thinks the straight line to the player is clear: the path leads
// into it and the character controller stops the Foamer dead, which is the
// stall the card recorded beside the south ramp.

const DT = 1 / 60;
const HALF = 12;

function fakeMesher() {
  const colors = linearColorTable();
  return { mesh: (padded: Uint8Array) => Promise.resolve(greedyMesh(padded, colors)) };
}

function rig() {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.createCollider(RAPIER.ColliderDesc.cuboid(40, 0.5, 40).setTranslation(0, -0.5, 0));
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  const ignore = world.createCollider(
    RAPIER.ColliderDesc.capsule(0.5, 0.3).setTranslation(0, 0, 200), body,
  );
  const darts = new DartSystem(new THREE.Scene(), world, RAPIER, ignore);
  const debris = new DebrisSystem(RAPIER, world);
  const targets: VoxelTarget[] = [];
  const foamers = new FoamerSystem(RAPIER, world, fakeMesher(), debris, darts, targets);
  new DartImpacts(darts, debris, targets);
  const director = new Director("normal");
  const grid = new NavGrid(RAPIER, world, { minX: -HALF, maxX: HALF, minZ: -HALF, maxZ: HALF });
  foamers.director = director;
  foamers.navGrid = grid;
  world.step();
  grid.bake();
  return { world, darts, foamers, grid };
}

function tick(r: ReturnType<typeof rig>, player: THREE.Vector3) {
  r.darts.update(DT);
  r.foamers.update(DT, player);
  r.world.step();
  r.darts.syncRender();
}

beforeAll(async () => {
  await RAPIER.init();
});

describe("a Foamer blocked by a wall the grid does not know about (BUG-01)", () => {
  it("sidesteps instead of standing still", () => {
    const r = rig();
    // The wall goes up after the bake, so the path still aims straight at
    // the player through it.
    const wall = r.world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    r.world.createCollider(
      RAPIER.ColliderDesc.cuboid(3, 1.5, 0.25).setTranslation(0, 1.5, 2.0), wall,
    );
    r.world.step();
    const player = new THREE.Vector3(0, 1.6, 6);
    const f = r.foamers.spawn(new THREE.Vector3(0, 0.2, 0), player, "F01")!;

    // The card's rule: a walking Foamer must never stand still more than
    // about two seconds. Track the longest run of frames in which it stayed
    // within a hand's width of one spot; that is what "stood still" means to
    // a player watching it. Only the first second is skipped, the alert turn
    // before it starts moving.
    let stillX = f.centre.x, stillZ = f.centre.z, stillFor = 0, worstStill = 0;
    let walked = 0;
    for (let i = 0; i < 60 * 12; i++) {
      tick(r, player);
      if (f.state === "approach") walked++;
      const d = Math.hypot(f.centre.x - stillX, f.centre.z - stillZ);
      if (d > 0.05) {
        stillX = f.centre.x;
        stillZ = f.centre.z;
        stillFor = 0;
      } else if (i > 60) {
        stillFor += DT;
        worstStill = Math.max(worstStill, stillFor);
      }
    }
    expect(walked, "it kept trying to walk").toBeGreaterThan(60 * 8);
    expect(worstStill, `longest standstill ${worstStill.toFixed(2)} s`).toBeLessThan(2);
  });
});

describe("the stall guard's memory (BUG-01 round 2)", () => {
  it("drops a walking Foamer's entry when the Foamer is removed", () => {
    const r = rig();
    const player = new THREE.Vector3(0, 1.6, 6);
    const f = r.foamers.spawn(new THREE.Vector3(0, 0.2, 0), player, "F01")!;
    const sys = r.foamers as unknown as {
      progress: Map<unknown, { x: number; z: number; t: number; side: number }>;
      removeFoamer(f: unknown): void;
    };
    for (let i = 0; i < 60 * 3; i++) tick(r, player);
    expect(sys.progress.has(f), "a walking Foamer has an entry").toBe(true);
    sys.removeFoamer(f);
    expect(sys.progress.has(f), "a removed Foamer leaves none").toBe(false);
    expect(sys.progress.size, "and nothing else is left behind").toBe(0);
  });

  it("starts a fresh window when a Foamer walks again", () => {
    const r = rig();
    const player = new THREE.Vector3(0, 1.6, 6);
    const f = r.foamers.spawn(new THREE.Vector3(0, 0.2, 0), player, "F01")!;
    const sys = r.foamers as unknown as {
      progress: Map<unknown, { x: number; z: number; t: number; side: number }>;
    };
    for (let i = 0; i < 60 * 3; i++) tick(r, player);
    expect(sys.progress.has(f), "it was walking").toBe(true);
    // A Foamer that holds its ring (not walking a path) forgets where it was,
    // so the first step after the hold is not read as a stall.
    for (let i = 0; i < 60 * 4 && f.state !== "hold"; i++) tick(r, player);
    expect(f.state, "it is holding its ring, not walking").toBe("hold");
    tick(r, player);
    expect(sys.progress.has(f), "a Foamer that stopped walking has no entry").toBe(false);
  });
});
