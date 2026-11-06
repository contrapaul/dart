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
import { FoamerSystem, specFor } from "../../src/foamers/foamers";
import { Director } from "../../src/ai/director";
import { NavGrid } from "../../src/ai/nav-grid";

// GAME-10c stage 1: the F06 Floater's type data and its floating
// movement. It holds its hover height over the floor with no gravity, a
// lost fin lowers it and slows it, and no fins left puts it on the floor.

const DT = 1 / 60;
const HALF = 20;
const F06 = foamerData.types.F06 as unknown as Record<string, unknown>;
const FLOAT = F06.float as {
  hoverMetres: number; bobMetres: number; damagedHoverMetres: number;
  damagedSpeedShare: number; fins: string[];
};

function fakeMesher(): Mesher {
  const colors = linearColorTable();
  return { mesh: (padded) => Promise.resolve(greedyMesh(padded, colors)) };
}

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
  const grid = new NavGrid(RAPIER, world, { minX: -HALF, maxX: HALF, minZ: -HALF, maxZ: HALF });
  foamers.director = director;
  foamers.navGrid = grid;
  foamers.spawnState = "alert";
  world.step();
  grid.bake();
  return { world, darts, debris, foamers, director, grid };
}

function tick(r: ReturnType<typeof rig>, player: THREE.Vector3) {
  r.darts.update(DT);
  r.foamers.update(DT, player);
  r.world.step();
}

/** The Floater far from the player so it walks its path but slowly. */
const PLAYER = new THREE.Vector3(0, 0, 18); // inside the nav grid, 6 m beyond the hold ring

describe("the Floater (GAME-10c stage 1)", () => {
  beforeAll(async () => {
    await RAPIER.init();
  });

  it("1. F06 reads its own spec: rig, health, attacks, float numbers", () => {
    expect(FLOAT.hoverMetres).toBe(3);
    expect(FLOAT.damagedHoverMetres).toBe(1.2);
    expect(FLOAT.damagedSpeedShare).toBe(0.6);
    expect(FLOAT.fins).toEqual(["finL", "finR"]);
    const spec = specFor("F06");
    expect(spec.rig).toBe("F06");
    expect(spec.attacks.map((a) => a.id)).toEqual(["spit", "bigBlob"]);
    expect(spec.attacks[0]!.token).toBe("ranged");
    const r = rig();
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 0), undefined, "F06")!;
    expect(f).not.toBeNull();
    expect(f.spec).toBe(spec);
    expect(f.maxHealth).toBe(35);
    expect(f.agent, "it has a brain").not.toBeNull();
  });

  it("2. over the floor it stays at its hover height after 5 s of steps", () => {
    const r = rig();
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 0), undefined, "F06")!;
    // Dropped from well above: it settles to the hover, not the floor.
    f.centre.y = 8;
    for (let i = 0; i < 300; i++) tick(r, PLAYER);
    const g = r.grid.groundAt(f.centre.x, f.centre.z, f.centre.y);
    expect(g).toBeCloseTo(0, 2);
    expect(f.centre.y).toBeCloseTo(FLOAT.hoverMetres, 1);
    expect(f.vy, "no gravity pull").toBe(0);
  });

  it("3. one fin lost: lower hover and the damaged speed share", () => {
    const r = rig();
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 0), undefined, "F06")!;
    for (let i = 0; i < 60; i++) tick(r, PLAYER);
    const full = f.centre.y;
    f.parts.delete("finL"); // the harness drops the part directly
    for (let i = 0; i < 120; i++) tick(r, PLAYER);
    expect(full).toBeCloseTo(FLOAT.hoverMetres, 1);
    expect(f.centre.y).toBeCloseTo(FLOAT.damagedHoverMetres, 1);
    // Its speed: distance covered per second over the damaged share of the
    // rig speed, and clearly below the whole-fin rate.
    const before = f.centre.clone();
    for (let i = 0; i < 60; i++) tick(r, PLAYER);
    const perSec = before.distanceTo(f.centre);
    expect(perSec).toBeGreaterThan(0);
    expect(perSec).toBeLessThanOrEqual(
      1.2 * FLOAT.damagedSpeedShare * 1.5 + 0.1, // slack for the strafe
    );
  });

  it("4. both fins lost: it sits on the floor", () => {
    const r = rig();
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 0), undefined, "F06")!;
    f.parts.delete("finL");
    f.parts.delete("finR");
    for (let i = 0; i < 120; i++) tick(r, PLAYER);
    expect(f.centre.y).toBeCloseTo(0, 1);
  });

  it("5. a killed Floater goes down as the others do", async () => {
    const r = rig();
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 0), undefined, "F06")!;
    // The part colliders/voxel targets exist once their meshes are built
    // (the ragdoll tests' settleAll).
    for (const part of f.parts.values()) {
      part.mesh.update();
      await new Promise((res) => setTimeout(res, 0));
      r.world.step();
    }
    // One standard dart does 1 damage; 0.5 health left is one hit to death
    // (the ragdoll tests' kill helper's rule).
    tick(r, PLAYER);
    f.health = 0.5;
    const body = f.parts.get("body")!;
    const c = body.voxelToWorld(new THREE.Vector3(14, 13, 14));
    r.darts.fire(c.clone().setZ(c.z - 1), new THREE.Vector3(0, 0, 1), "standard");
    for (let i = 0; i < 90 && f.state !== "down"; i++) tick(r, PLAYER);
    expect(f.state, `went down (state was ${f.state})`).toBe("down");
  });
});
