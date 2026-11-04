import { beforeAll, describe, expect, it } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import foamerData from "../../data/foamers.json";
import { linearColorTable } from "../../src/voxel/materials";
import { greedyMesh } from "../../src/voxel/mesher";
import type { Mesher } from "../../src/voxel/pieces";
import { DebrisSystem } from "../../src/voxel/debris";
import { DartSystem } from "../../src/weapons/darts";
import { DartImpacts, type VoxelTarget } from "../../src/weapons/impacts";
import { FoamerSystem } from "../../src/foamers/foamers";
import { Director } from "../../src/ai/director";
import { NavGrid } from "../../src/ai/nav-grid";

const DT = 1 / 60;
const CHARGE = foamerData.types.F05.charge;
const HALF = 20;

function fakeMesher(): Mesher {
  const colors = linearColorTable();
  return { mesh: (padded) => Promise.resolve(greedyMesh(padded, colors)) };
}

/** Floor, a wall to the north, the director, the nav grid and the Foamer
 *  system. The wall is at z = -6, so a Darter charging south to north from
 *  z = +6 with a player it cannot reach runs into it. */
function rig(wall = true) {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.createCollider(RAPIER.ColliderDesc.cuboid(40, 0.5, 40).setTranslation(0, -0.5, 0));
  if (wall) {
    const b = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    world.createCollider(RAPIER.ColliderDesc.cuboid(20, 2, 0.5).setTranslation(0, 2, -6), b);
  }
  const ignore = world.createCollider(
    RAPIER.ColliderDesc.capsule(0.5, 0.3).setTranslation(0, 0, 200),
    world.createRigidBody(RAPIER.RigidBodyDesc.fixed()),
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
  foamers.spawnState = "alert";
  world.step();
  grid.bake();
  const hits: number[] = [];
  foamers.onChargeHit = (_f, seconds) => hits.push(seconds);
  const walls: THREE.Vector3[] = [];
  foamers.onWallHit = (_f, point) => walls.push(point.clone());
  return { world, darts, foamers, director, grid, hits, walls };
}

function tick(r: ReturnType<typeof rig>, player: THREE.Vector3) {
  r.darts.update(DT);
  r.foamers.update(DT, player);
  r.world.step();
  r.darts.syncRender(1);
}

/** Run until `done` or the step budget runs out. */
function run(r: ReturnType<typeof rig>, player: THREE.Vector3, done: () => boolean, steps: number) {
  for (let i = 0; i < steps && !done(); i++) tick(r, player);
}

beforeAll(async () => {
  await RAPIER.init();
});

describe("the F05 charge (GAME-10b stage 2)", () => {
  it("1. telegraphs before every charge, for its full time", () => {
    const r = rig(false);
    const player = new THREE.Vector3(0, 1.6, 0);
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 10), player, "F05")!;
    expect(f.agent?.state).toBe("alert");
    let sawTelegraph = 0;
    let sawCharge = false;
    for (let i = 0; i < 60 * 20 && !sawCharge; i++) {
      tick(r, player);
      if (f.state === "telegraph") sawTelegraph += DT;
      if (f.state === "charge") sawCharge = true;
    }
    expect(sawTelegraph).toBeGreaterThanOrEqual(CHARGE.telegraphSeconds - DT * 1.5);
    expect(sawCharge, "then it ran").toBe(true);
  });

  it("2. the charge keeps the line it locked, even when the player moves", () => {
    const r = rig(false);
    const player = new THREE.Vector3(0, 1.6, 0);
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 9), player, "F05")!;
    run(r, player, () => f.state === "charge", 60 * 12);
    expect(f.state).toBe("charge");
    // Locked line: at the start it points from the Darter to the player.
    const dirX = f.chargeDirX;
    const dirZ = f.chargeDirZ;
    expect(Math.hypot(dirX, dirZ)).toBeCloseTo(1, 5);
    // The player steps aside well out of the line; the Darter must not steer.
    const side = new THREE.Vector3(6, 1.6, 4);
    const before = f.centre.clone();
    tick(r, side);
    tick(r, side);
    const movedX = f.centre.x - before.x;
    const movedZ = f.centre.z - before.z;
    const along = movedX * dirX + movedZ * dirZ;
    const across = Math.abs(movedX * dirZ - movedZ * dirX);
    expect(along, "it kept going").toBeGreaterThan(0);
    expect(across, "and did not turn").toBeLessThan(0.05);
  });

  it("3. a wall ends the charge, and it then stands in its wall stun with the back open", () => {
    const r = rig(true);
    // The player is close to the wall, so the Darter's line runs into it.
    const player = new THREE.Vector3(0, 1.6, -5.2);
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 8), player, "F05")!;
    run(r, player, () => f.state === "wallStun", 60 * 25);
    expect(f.state).toBe("wallStun");
    expect(r.walls.length, "the wall was reported").toBeGreaterThan(0);
    // How long it stands there: the wall stun's own time, to the step.
    let held = 0;
    while (f.state === "wallStun" && held < 5) {
      tick(r, player);
      held += DT;
    }
    expect(held).toBeGreaterThanOrEqual(CHARGE.wallStunSeconds - DT * 1.5);
    expect(f.state, "then it recovers").toBe("recover");
  });

  it("4. it hits the player once per charge and stuns it", () => {
    const r = rig(false);
    const player = new THREE.Vector3(0, 1.6, 0);
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 9), player, "F05")!;
    run(r, player, () => r.hits.length > 0, 60 * 12);
    expect(r.hits).toEqual([CHARGE.playerStunSeconds]);
    expect(f.chargeHit, "one hit marked").toBe(true);
    // And the same run does not hit again a step later.
    for (let i = 0; i < 10; i++) tick(r, player);
    expect(r.hits.length).toBe(1);
  });

  it("5. with both legs gone it never charges, only bites when the player is on it", () => {
    const r = rig(false);
    const player = new THREE.Vector3(0, 1.6, 0);
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 8), player, "F05")!;
    // Breaking a part outright: its hp to zero is the range button's path
    // (tests/foamers/fall.test.ts does the same).
    for (const id of ["legL", "legR"]) f.parts.get(id)!.hp = 0;
    for (let i = 0; i < 600 && f.parts.has("legR"); i++) tick(r, player);
    expect(f.parts.has("legR"), "both legs are off").toBe(false);
    let charged = false;
    for (let i = 0; i < 60 * 20; i++) {
      tick(r, player);
      if (f.state === "charge" || f.state === "telegraph") charged = true;
    }
    expect(charged, "no charge without legs").toBe(false);
    expect(f.prone || f.state === "crawl" || f.state === "windup" || f.state === "down").toBe(true);
  });

  it("6. an F01 and an F02 never enter the charge states", () => {
    const r = rig(false);
    const player = new THREE.Vector3(0, 1.6, 0);
    const fs = [
      r.foamers.spawn(new THREE.Vector3(0, 0, 9), player, "F01")!,
      r.foamers.spawn(new THREE.Vector3(0, 0, 11), player, "F02")!,
    ];
    const seen = new Set<string>();
    for (let i = 0; i < 60 * 10; i++) {
      tick(r, player);
      for (const f of fs) seen.add(f.state);
    }
    expect(seen.has("charge") || seen.has("telegraph") || seen.has("wallStun")).toBe(false);
  });
});
