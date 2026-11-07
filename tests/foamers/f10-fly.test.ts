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
import type { Foamer } from "../../src/foamers/foamer";
import { Director } from "../../src/ai/director";
import { NavGrid } from "../../src/ai/nav-grid";
import { weakpointOf } from "../../src/foamers/pellet";

// GAME-10j stage 1: the F10 Turbo's type data and its jet flight. It holds
// its hover height over the floor like the F06 holds its float, one jet
// off lowers it and slows it, and both off put it on the floor walking.
// Each jet is a weak point.

const DT = 1 / 60;
const HALF = 20;
const F10 = foamerData.types.F10 as unknown as Record<string, unknown>;
const FLY = F10.fly as {
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

/** The Turbo far from the player so it walks its path but slowly. */
const PLAYER = new THREE.Vector3(0, 0, 18);

async function settleParts(r: ReturnType<typeof rig>, f: Foamer) {
  for (const part of f.parts.values()) {
    part.mesh.update();
    await new Promise((res) => setTimeout(res, 0));
    r.world.step();
  }
}

describe("the Turbo's flight (GAME-10j stage 1)", () => {
  beforeAll(async () => {
    await RAPIER.init();
  });

  it("1. F10 reads its own spec: rig, health, attacks, fly numbers", () => {
    expect(FLY.hoverMetres).toBe(4);
    expect(FLY.damagedHoverMetres).toBe(2);
    expect(FLY.damagedSpeedShare).toBe(0.6);
    expect(FLY.fins).toEqual(["jetL", "jetR"]);
    const spec = specFor("F10");
    expect(spec.rig).toBe("F10");
    expect(spec.preferredDistanceMetres).toBe(12);
    expect(spec.attacks.map((a) => a.id)).toEqual(["homingShot", "bonk"]);
    const r = rig();
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 0), undefined, "F10")!;
    expect(f).not.toBeNull();
    expect(f.spec).toBe(spec);
    expect(f.maxHealth).toBe(30);
    expect(f.agent, "it has a brain").not.toBeNull();
  });

  it("2. over the floor it stays at its hover height after 5 s of steps", () => {
    const r = rig();
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 0), undefined, "F10")!;
    // Dropped from well above: it settles to the hover, not the floor.
    f.centre.y = 8;
    for (let i = 0; i < 300; i++) tick(r, PLAYER);
    const g = r.grid.groundAt(f.centre.x, f.centre.z, f.centre.y);
    expect(g).toBeCloseTo(0, 2);
    expect(f.centre.y).toBeCloseTo(FLY.hoverMetres, 1);
    expect(f.vy, "no gravity pull").toBe(0);
  });

  it("3. one jet out: lower hover and the damaged speed share", () => {
    const r = rig();
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, -12), undefined, "F10")!;
    // Approaching from behind the grid's far edge: measurable speed at the
    // full jets, before the ring stops it.
    for (let i = 0; i < 12; i++) tick(r, PLAYER);
    const beforeFull = f.centre.clone();
    for (let i = 0; i < 60; i++) tick(r, PLAYER);
    const fullPerSec = beforeFull.distanceTo(f.centre);
    const full = f.centre.y;
    f.parts.delete("jetL"); // the harness drops the part directly
    for (let i = 0; i < 120; i++) tick(r, PLAYER);
    expect(full).toBeCloseTo(FLY.hoverMetres, 1);
    expect(f.centre.y).toBeCloseTo(FLY.damagedHoverMetres, 1);
    // Its speed: distance covered per second, clearly below the full-jet
    // rate, at the damaged share of the rig speed.
    const before = f.centre.clone();
    for (let i = 0; i < 60; i++) tick(r, PLAYER);
    const perSec = before.distanceTo(f.centre);
    expect(perSec, "still moving").toBeGreaterThan(0);
    expect(perSec, "slower than the full-jet rate")
      .toBeLessThanOrEqual(fullPerSec * FLY.damagedSpeedShare * 1.3 + 0.2);
  });

  it("4. both jets out: it drops to the floor and walks", () => {
    const r = rig();
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, -12), undefined, "F10")!;
    f.parts.delete("jetL");
    f.parts.delete("jetR");
    for (let i = 0; i < 120; i++) tick(r, PLAYER);
    // On the floor: a standing capsule settles its centre a capsule radius
    // under the floor level (the walkers' settle of the other tests).
    expect(f.centre.y, "on the floor").toBeLessThan(0.15);
    // It walks (its legs), not skids: it covers ground toward the player.
    const before = f.centre.clone();
    for (let i = 0; i < 60; i++) tick(r, PLAYER);
    expect(before.distanceTo(f.centre), "it is walking").toBeGreaterThan(0.1);
  });

  it("5. a jet takes the weak-point multiplier; the body does not", async () => {
    const r = rig();
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 0), undefined, "F10")!;
    const wp = weakpointOf(f.spec)!;
    expect(wp.parts).toEqual(["jetL", "jetR"]);
    expect(wp.damage).toBe(2);
    await settleParts(r, f);
    tick(r, PLAYER);
    const one = (id: string) => {
      const part = f.parts.get(id)!;
      const probe = r.world.createCollider(
        RAPIER.ColliderDesc.cuboid(0.1, 0.1, 0.1).setTranslation(0.2, 0.2, 0.2),
        part.body,
      );
      f.health = f.maxHealth;
      r.darts.onHit({
        point: part.voxelToWorld(new THREE.Vector3(10, 10, 10)),
        normal: new THREE.Vector3(-1, 0, 0),
        direction: new THREE.Vector3(1, 0, 0),
        speed: 25,
        type: "standard",
        collider: probe,
        material: null,
        shot: null,
      });
      r.world.removeCollider(probe, false);
      return f.maxHealth - f.health;
    };
    const onJet = one("jetL");
    const onBody = one("body");
    // One standard dart on the body: damage * hit * total, no multiplier.
    const bodyKind = f.spec.partDamage.kinds.body;
    expect(onBody).toBeCloseTo(f.spec.damage.standard * bodyKind.hit * bodyKind.total, 5);
    // The jet: the same, times the weak-point multiplier (the crawler's
    // gun test, the same shape of claim).
    const jetKind = f.spec.partDamage.kinds.ability;
    expect(onJet).toBeCloseTo(f.spec.damage.standard * jetKind.hit * jetKind.total * wp.damage, 5);
  });
});
