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

const DT = 1 / 60;
const SPEC = specFor("F07");

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
  world.step();
  return { world, darts, debris, targets, foamers };
}

function tick(r: ReturnType<typeof rig>, player: THREE.Vector3) {
  r.darts.update(DT);
  r.foamers.update(DT, player);
  r.world.step();
  r.darts.syncRender(1);
}

describe("F07 Brawler data (GAME-10f stage 1)", () => {
  beforeAll(async () => {
    await RAPIER.init();
  });

  it("1. the type reads its own spec: rig F07, health 45, a punch", () => {
    expect(SPEC.rig).toBe("F07");
    expect(SPEC.attacks.map((a) => a.id)).toContain("punch");
    const punch = SPEC.attacks.find((a) => a.id === "punch")!;
    expect(punch.damage).toBe(14);
    expect(punch.token).toBe("melee");
  });

  it("2. spawns with the F07 rig's health and its fists and legs", () => {
    const r = rig();
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 0), undefined, "F07")!;
    expect(f).not.toBeNull();
    expect(f.spec.rig).toBe("F07");
    expect(f.maxHealth).toBe(45);
    for (const id of ["body", "head", "fistL", "fistR", "legL", "legR"]) {
      expect(f.parts.has(id), id).toBe(true);
    }
  });

  it("3. walks in like the F01 and punches in reach", () => {
    const r = rig();
    const player = new THREE.Vector3(0, 0, 10);
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 0), player, "F07")!;
    let bonked: string | null = null;
    r.foamers.onBonk = (_foamer, attack) => { bonked = attack; };
    let moved = 0;
    const start = f.centre.z;
    for (let i = 0; i < 60 * 20 && bonked === null; i++) {
      tick(r, player);
      moved = Math.max(moved, f.centre.z - start);
    }
    expect(moved).toBeGreaterThan(3); // it walked in from 10 m
    expect(bonked).toBe("punch");
  });

  it("4. the range's type choice spawns it (spawnType F07)", () => {
    const r = rig();
    r.foamers.spawnType = "F07";
    r.foamers.spawnCount = 1;
    const player = new THREE.Vector3(0, 0, 30); // far: the keep-alive one spawns
    for (let i = 0; i < 60 * 5; i++) tick(r, player);
    expect(r.foamers.list.some((f) => f.spec.rig === "F07")).toBe(true);
  });
});
