import { describe, expect, it } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { linearColorTable } from "../../src/voxel/materials";
import { greedyMesh } from "../../src/voxel/mesher";
import type { Mesher } from "../../src/voxel/pieces";
import { DebrisSystem } from "../../src/voxel/debris";
import { DartSystem } from "../../src/weapons/darts";
import { DartImpacts, type VoxelTarget } from "../../src/weapons/impacts";
import { FoamerSystem, specFor } from "../../src/foamers/foamers";
import { armourOf, plateFaces } from "../../src/foamers/armour";

const DT = 1 / 60;

// GAME-10k stage 1: the Seawall's shield. Like the Blocker's (GAME-10e) it
// is arc armour on the shield parts, but it is complete: inside its arc a
// dart does no damage and carves nothing, and darts never break it. Darts
// from the side or the back hit as usual.

const SPEC = specFor("F11");

function fakeMesher(): Mesher {
  const colors = linearColorTable();
  return { mesh: (padded) => Promise.resolve(greedyMesh(padded, colors)) };
}

function rig() {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const debris = new DebrisSystem(RAPIER, world);
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  const ignore = world.createCollider(
    RAPIER.ColliderDesc.capsule(0.5, 0.3).setTranslation(0, 0, 200),
    body,
  );
  const darts = new DartSystem(new THREE.Scene(), world, RAPIER, ignore);
  const targets: VoxelTarget[] = [];
  const foamers = new FoamerSystem(RAPIER, world, fakeMesher(), debris, darts, targets);
  new DartImpacts(darts, debris, targets);
  return { world, darts, foamers };
}

async function settle(mesh: { update(): void; busy: boolean }, world: RAPIER.World) {
  while (true) {
    mesh.update();
    if (!mesh.busy) break;
    await new Promise((r) => setTimeout(r, 0));
  }
  world.step();
}

function tick(r: ReturnType<typeof rig>, player: THREE.Vector3) {
  r.darts.update(DT);
  r.foamers.update(DT, player);
  r.world.step();
  r.darts.syncRender(1);
}

describe("GAME-10k: the Seawall's spec", () => {
  it("reads its own spec: rig F11, health 60, the melee brain's one attack", async () => {
    await RAPIER.init();
    const r = rig();
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 1), "F11")!;
    expect(f.spec.rig).toBe("F11");
    expect(f.rig.health).toBe(60);
    expect(f.health).toBe(60);
    expect(f.spec.attacks.length).toBe(1);
    expect(f.spec.attacks[0]!.token).toBe("melee");
    expect(f.parts.has("shield")).toBe(true);
    expect(f.parts.has("shieldBoss")).toBe(true);
    expect(f.parts.has("maceHead")).toBe(true);
  });

  it("armours the shield and its boss across the front, turning darts wholly", () => {
    for (const id of ["shield", "shieldBoss"]) {
      const a = armourOf(SPEC, id);
      expect(a).not.toBeNull();
      expect(a!.damage).toBe(0);
      expect(a!.carve).toBe(0);
      expect(a!.arcDeg).toBe(120);
    }
    // The body and the mace are not armoured.
    expect(armourOf(SPEC, "body")).toBeNull();
    expect(armourOf(SPEC, "maceHead")).toBeNull();
    // Facing +z: straight ahead and 50 degrees off are covered, 80 degrees
    // off and straight behind are not.
    expect(plateFaces(SPEC, "shield", 0, 1, 0, 1, false)).toBe(true);
    const r = (50 * Math.PI) / 180;
    expect(plateFaces(SPEC, "shield", 0, 1, Math.sin(r), Math.cos(r), false)).toBe(true);
    const q = (80 * Math.PI) / 180;
    expect(plateFaces(SPEC, "shield", 0, 1, Math.sin(q), Math.cos(q), false)).toBe(false);
    expect(plateFaces(SPEC, "shield", 0, 1, 0, -1, false)).toBe(false);
  });
});

describe("GAME-10k: the shield against darts", () => {
  it("a dart inside the arc does no damage and carves nothing", async () => {
    const r = rig();
    const player = new THREE.Vector3(0, 1.6, 6);
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 1), "F11")!;
    const shield = f.parts.get("shield")!;
    await settle(shield.mesh, r.world);
    const voxelsBefore = shield.voxelCount;
    const healthBefore = f.health;
    const aim = shield.voxelToWorld(new THREE.Vector3(
      shield.spec.size[0] / 2, shield.spec.size[1] / 2, shield.spec.size[2] + 0.5));
    r.darts.fire(new THREE.Vector3(aim.x, aim.y, aim.z + 1), new THREE.Vector3(0, 0, -1), "standard");
    for (let i = 0; i < 120 && r.foamers.stats.hits === 0; i++) tick(r, player);
    expect(r.foamers.stats.hits).toBe(1);
    expect(f.health).toBe(healthBefore);
    expect(shield.voxelCount).toBe(voxelsBefore);
    expect(shield.carveScale).toBe(0);
  });

  it("a dart from behind hurts", async () => {
    const r = rig();
    const player = new THREE.Vector3(0, 1.6, 6);
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1), "F11")!;
    const body = f.parts.get("body")!;
    await settle(body.mesh, r.world);
    // The Foamer faces -z, so +z is behind it: the dart comes from there
    // and meets the back of the body (aim at its world centre).
    const c = body.voxelToWorld(new THREE.Vector3(
      body.spec.size[0] / 2, body.spec.size[1] / 2, body.spec.size[2] / 2));
    const before = f.health;
    r.darts.fire(new THREE.Vector3(c.x, c.y, c.z + 1), new THREE.Vector3(0, 0, -1), "standard");
    for (let i = 0; i < 120 && f.health === before; i++) tick(r, player);
    const kind = SPEC.partDamage.kinds[body.spec.kind as "body"];
    expect(before - f.health).toBeCloseTo(SPEC.damage.standard * kind.hit * kind.total, 5);
  });
});
