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
const SPEC = specFor("F05");

function fakeMesher(): Mesher {
  const colors = linearColorTable();
  return { mesh: (padded) => Promise.resolve(greedyMesh(padded, colors)) };
}

async function settle(mesh: { update(): void }, world: RAPIER.World) {
  mesh.update();
  await new Promise((r) => setTimeout(r, 0));
  world.step();
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

describe("F05 Darter data and armour (GAME-10b stage 1)", () => {
  beforeAll(async () => {
    await RAPIER.init();
  });

  it("1. spawns with the F05 rig, 30 health and the plate parts", () => {
    const r = rig();
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 0), undefined, "F05")!;
    expect(f).not.toBeNull();
    expect(f.spec.rig).toBe("F05");
    expect(f.maxHealth).toBe(30);
    expect(f.health).toBe(30);
    for (const id of ["body", "chest", "brow", "weakpoint", "legL", "legR"]) {
      expect(f.parts.has(id), id).toBe(true);
    }
    expect(SPEC.attacks.map((a) => a.id)).toContain("charge");
  });

  it("2. a dart on the chest plate does 15% of a body hit's damage", async () => {
    const r = rig();
    const player = new THREE.Vector3(0, 1.6, 5);
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 0), undefined, "F05")!;
    const body = f.parts.get("body")!;
    await settle(body.mesh, r.world);
    const bodyAim = body.voxelToWorld(new THREE.Vector3(
      body.spec.size[0] / 2, body.spec.size[1] / 2, body.spec.size[2] + 0.5));
    r.darts.fire(new THREE.Vector3(bodyAim.x, bodyAim.y, bodyAim.z + 5), new THREE.Vector3(0, 0, -1), "standard");
    for (let i = 0; i < 120 && r.foamers.stats.hits === 0; i++) tick(r, player);
    expect(r.foamers.stats.hits).toBe(1);
    // The rig's body part is kind "head" (it carries the face).
    const bodyKind = SPEC.partDamage.kinds[body.spec.kind as "head"];
    const bodyShare = f.maxHealth - f.health;
    expect(bodyShare).toBeCloseTo(SPEC.damage.standard * bodyKind.hit * bodyKind.total, 5);

    const chest = f.parts.get("chest")!;
    await settle(chest.mesh, r.world);
    const chestAim = chest.voxelToWorld(new THREE.Vector3(
      chest.spec.size[0] / 2, chest.spec.size[1] / 2, chest.spec.size[2] + 0.5));
    const before = f.health;
    r.darts.fire(new THREE.Vector3(chestAim.x, chestAim.y, chestAim.z + 1), new THREE.Vector3(0, 0, -1), "standard");
    for (let i = 0; i < 120 && f.health === before; i++) tick(r, player);
    const plate = SPEC.partDamage.kinds.ability;
    expect(before - f.health).toBeCloseTo(SPEC.damage.standard * plate.hit * plate.total * 0.15, 5);
  });

  it("3. the orange back weakpoint takes 2.5 times a body hit", async () => {
    const r = rig();
    const player = new THREE.Vector3(0, 1.6, 5);
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 0), undefined, "F05")!;
    const weak = f.parts.get("weakpoint")!;
    await settle(weak.mesh, r.world);
    const aim = weak.voxelToWorld(new THREE.Vector3(
      weak.spec.size[0] / 2, weak.spec.size[1] / 2, weak.spec.size[2] + 0.5));
    const before = f.health;
    r.darts.fire(new THREE.Vector3(aim.x, aim.y, aim.z + 1), new THREE.Vector3(0, 0, -1), "standard");
    for (let i = 0; i < 120 && f.health === before; i++) tick(r, player);
    const back = SPEC.partDamage.kinds.ability;
    expect(before - f.health).toBeGreaterThan(SPEC.damage.standard * back.hit * back.total);
    expect(before - f.health).toBeCloseTo(SPEC.damage.standard * back.hit * back.total * 2.5, 5);
  });

  it("4. a plate chips slowly: the same dart carves fewer plate voxels than body", async () => {
    const r = rig();
    const player = new THREE.Vector3(0, 1.6, 5);
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 0), undefined, "F05")!;
    const carveOf = async (id: string) => {
      const p = f.parts.get(id)!;
      await settle(p.mesh, r.world);
      const before = p.voxelCount;
      const aim = p.voxelToWorld(new THREE.Vector3(
        p.spec.size[0] / 2, p.spec.size[1] / 2, p.spec.size[2] + 0.5));
      r.darts.fire(new THREE.Vector3(aim.x, aim.y, aim.z + 1), new THREE.Vector3(0, 0, -1), "standard");
      for (let i = 0; i < 120 && p.voxelCount === before; i++) tick(r, player);
      return before - p.voxelCount;
    };
    const body = await carveOf("body");
    const chest = await carveOf("chest");
    expect(body).toBeGreaterThan(0);
    expect(chest).toBeLessThan(body);
  });

  it("5. F01 and F02 are untouched by the armour table", async () => {
    const r = rig();
    const player = new THREE.Vector3(0, 1.6, 5);
    for (const type of ["F01", "F02"]) {
      const f = r.foamers.spawn(new THREE.Vector3(0, 0, 0), undefined, type)!;
      const head = f.parts.get("head")!;
      await settle(head.mesh, r.world);
      const before = f.health;
      const aim = head.voxelToWorld(new THREE.Vector3(
        head.spec.size[0] / 2, head.spec.size[1] / 2, head.spec.size[2] + 0.5));
      r.darts.fire(new THREE.Vector3(aim.x, aim.y, aim.z + 1), new THREE.Vector3(0, 0, -1), "standard");
      for (let i = 0; i < 120 && f.health === before; i++) tick(r, player);
      const kind = f.spec.partDamage.kinds.head;
      expect(before - f.health).toBeCloseTo(f.spec.damage.standard * kind.hit * kind.total, 5);
    }
  });
});
