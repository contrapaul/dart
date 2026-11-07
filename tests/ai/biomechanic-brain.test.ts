import { beforeAll, describe, expect, it } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { linearColorTable } from "../../src/voxel/materials";
import { greedyMesh } from "../../src/voxel/mesher";
import type { Mesher } from "../../src/voxel/pieces";
import { DebrisSystem } from "../../src/voxel/debris";
import { DartSystem } from "../../src/weapons/darts";
import { DartImpacts, type VoxelTarget } from "../../src/weapons/impacts";
import { FoamerSystem, specFor } from "../../src/foamers/foamers";
import { Director } from "../../src/ai/director";
import { NavGrid } from "../../src/ai/nav-grid";

// GAME-10l stage 1: the Biomechanic fights on the Roamer's brain
// (decideF02, no new brain) and keeps about 10 m, further out than the
// melee line it heals. Its distances come from its spec.

const DT = 1 / 60;
const HALF = 20;
const SPEC = specFor("F13");

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

describe("the Biomechanic's brain (GAME-10l stage 1)", () => {
  beforeAll(async () => {
    await RAPIER.init();
  });

  it("is the keep-distance brain, on the Biomechanic's own distances", () => {
    expect(SPEC.preferredDistanceMetres, "its ring is 10 m").toBe(10);
    expect(SPEC.retreatDistanceMetres).toBe(5);
    expect(SPEC.attacks.find((a) => a.token)?.token === "ranged", "it bids on the ranged pool").toBe(true);
    const r = rig();
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 0), undefined, "F13")!;
    expect(f.agent, "it has a brain").not.toBeNull();
    expect(f.agentInput!.preferredDistance, "holds about 10 m").toBe(10);
    expect(f.agentInput!.retreatDistance).toBe(5);
  });

  it("keeps its ring, further out than the melee line", () => {
    const r = rig();
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 0), undefined, "F13")!;
    const player = new THREE.Vector3(0, 3, 18);
    for (let i = 0; i < 60 * 20; i++) tick(r, player);
    const d = Math.hypot(player.x - f.centre.x, player.z - f.centre.z);
    expect(d, "no closer than the retreat distance").toBeGreaterThanOrEqual(SPEC.retreatDistanceMetres - 0.5);
    expect(["hold", "approach"], `brain settled (${f.agent!.state})`).toContain(f.agent!.state);
  });
});
