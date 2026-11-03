import { beforeAll, describe, expect, it } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import aiData from "../../data/ai.json";
import { linearColorTable } from "../../src/voxel/materials";
import { greedyMesh } from "../../src/voxel/mesher";
import { DebrisSystem } from "../../src/voxel/debris";
import { DartSystem } from "../../src/weapons/darts";
import { DartImpacts, type VoxelTarget } from "../../src/weapons/impacts";
import { FoamerSystem } from "../../src/foamers/foamers";
import { Director } from "../../src/ai/director";
import { NavGrid } from "../../src/ai/nav-grid";

const DT = 1 / 60;
const MELEE_CAP = aiData.difficulties.normal.melee;
const HALF = 12;

/** Node has no Worker: mesh synchronously, as the worker does. */
function fakeMesher() {
  const colors = linearColorTable();
  return { mesh: (padded: Uint8Array) => Promise.resolve(greedyMesh(padded, colors)) };
}

function addBox(
  world: RAPIER.World, hx: number, hy: number, hz: number, x: number, y: number, z: number,
) {
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  world.createCollider(RAPIER.ColliderDesc.cuboid(hx, hy, hz).setTranslation(x, y, z), body);
}

/** A walled arena: floor, the director, the nav grid and the Foamer system.
 *  Rapier's query pipeline updates on step(), so the pages step once before
 *  they bake; so does this. */
function rig() {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.createCollider(RAPIER.ColliderDesc.cuboid(40, 0.5, 40).setTranslation(0, -0.5, 0));
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  const ignore = world.createCollider(
    RAPIER.ColliderDesc.capsule(0.5, 0.3).setTranslation(0, 0, 200),
    body,
  );
  const darts = new DartSystem(new THREE.Scene(), world, RAPIER, ignore);
  const debris = new DebrisSystem(RAPIER, world);
  const targets: VoxelTarget[] = [];
  const foamers = new FoamerSystem(RAPIER, world, fakeMesher(), debris, darts, targets);
  new DartImpacts(darts, debris, targets);
  const director = new Director("normal");
  const grid = new NavGrid(RAPIER, world, {
    minX: -HALF, maxX: HALF, minZ: -HALF, maxZ: HALF,
  });
  foamers.director = director;
  foamers.navGrid = grid;
  world.step();
  grid.bake();
  return { world, darts, foamers, director, grid };
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

describe("an F01 on the nav grid (ENG-08 stage 3b)", () => {
  it("walks round a wall to reach the player", () => {
    const r = rig();
    // A wall across the room with its one gap to the east, at x in [6, 9]:
    // the straight line from the Foamer to the player is blocked.
    addBox(r.world, 9, 1, 0.25, -3, 1, 0);
    addBox(r.world, 1.5, 1, 0.25, 10.5, 1, 0);
    r.world.step();
    r.grid.rebake(-HALF, -1, HALF, 1);
    // The wall's own cells bake as its top (2 m up), which is over the step
    // limit from the floor, so no path crosses them; the gap is floor.
    expect(r.grid.groundAt(0, 0), "the wall top").toBeCloseTo(2, 1);
    expect(r.grid.groundAt(7, 0), "the gap is floor").toBeCloseTo(0, 1);

    const player = new THREE.Vector3(0, 1.6, 6);
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, -6))!;
    r.world.step();
    expect(f.agent, "it has a brain").not.toBeNull();
    let best = f.centre.distanceTo(player);
    let straightZ = f.centre.z;
    for (let i = 0; i < 60 * 30; i++) {
      tick(r, player);
      best = Math.min(best, f.centre.distanceTo(player));
      straightZ = Math.max(straightZ, f.centre.z);
      if (f.state === "windup" || f.state === "strike") break;
    }
    // It reached the player, so it went round the wall rather than into it.
    expect(best, "reached the player").toBeLessThan(2.4);
    expect(straightZ, "it got past the wall's line").toBeGreaterThan(0.5);
  });

  it("at most the normal melee token count of 4 F01s attacks at once", () => {
    const r = rig();
    const player = new THREE.Vector3(0, 1.6, 0);
    const fs = [0, 1, 2, 3].map((i) =>
      r.foamers.spawn(new THREE.Vector3(-1.2 + 0.8 * i, 0, -1.6))!,
    );
    for (const f of fs) expect(f.agent, "each has a brain").not.toBeNull();
    let most = 0;
    for (let i = 0; i < 60 * 6; i++) {
      tick(r, player);
      let n = 0;
      for (const f of fs) if (f.state === "windup" || f.state === "strike") n++;
      most = Math.max(most, n);
      expect(r.director.stats().melee.inUse, "tokens in use").toBeLessThanOrEqual(MELEE_CAP);
    }
    expect(most, "at most the cap attack at once").toBeLessThanOrEqual(MELEE_CAP);
    expect(most, "the cap is reached").toBe(MELEE_CAP);
    expect(r.foamers.stats.bonks, "somebody attacked").toBeGreaterThan(0);
  });

  it("gives the token back, so every one of 4 F01s attacks in 20 s", () => {
    // Two steps per frame, so 20 s of game time is 1200 steps, not 3600.
    const twoSteps = (r: ReturnType<typeof rig>, player: THREE.Vector3) => {
      tick(r, player);
      tick(r, player);
    };
    const r = rig();
    const player = new THREE.Vector3(0, 1.6, 0);
    const fs = [0, 1, 2, 3].map((i) =>
      r.foamers.spawn(new THREE.Vector3(-1.2 + 0.8 * i, 0, -1.6))!,
    );
    const attacked = fs.map(() => false);
    let most = 0;
    for (let i = 0; i < 600; i++) {
      twoSteps(r, player);
      let n = 0;
      for (let j = 0; j < fs.length; j++) {
        const f = fs[j]!;
        if (f.state === "windup" || f.state === "strike" || f.state === "recover") attacked[j] = true;
        if (f.state === "windup" || f.state === "strike") n++;
      }
      most = Math.max(most, n);
      expect(r.director.stats().melee.inUse, "tokens in use").toBeLessThanOrEqual(MELEE_CAP);
      expect(r.director.stats().ranged.inUse, "ranged tokens in use").toBe(0);
    }
    expect(attacked, "every one attacked").toEqual([true, true, true, true]);
    expect(most, "at most the cap attack at once").toBeLessThanOrEqual(MELEE_CAP);
  });

  it("does not hold a token while idle out of sight", () => {
    const r = rig();
    // Out of sight range, nobody else about: it stays idle.
    r.foamers.spawnState = "idle";
    const player = new THREE.Vector3(0, 1.6, -40);
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 9))!;
    expect(f.agent, "it has a brain").not.toBeNull();
    for (let i = 0; i < 60 * 3; i++) {
      tick(r, player);
      expect(f.state, "idle").toBe("idle");
      expect(f.agent!.hasToken, "no token while idle").toBe(false);
      expect(r.director.stats().melee.inUse, "tokens in use").toBe(0);
    }
  });
});
