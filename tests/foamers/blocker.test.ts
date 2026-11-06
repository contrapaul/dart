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

// GAME-10e: the Blocker's shield. It is armour on the `shield` part that
// only covers the front arc, so a dart from the side or the back hurts as
// much as one on an unarmoured part, and a staggered Blocker has no cover
// at all.

const SPEC = specFor("F04");

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

/** The shield is on the left of the rig and sits ahead of the body. */
const SHIELD = "shield";

describe("GAME-10e: the Blocker's shield armour", () => {
  it("is armour on the shield part, front only", () => {
    const a = armourOf(SPEC, SHIELD);
    expect(a).not.toBeNull();
    expect(a!.damage).toBeLessThan(0.2);
    expect(a!.carve).toBeLessThan(0.5);
    expect(a!.arcDeg).toBe(120);
    // The body and the blaster are not armoured.
    expect(armourOf(SPEC, "body")).toBeNull();
    expect(armourOf(SPEC, "blaster")).toBeNull();
  });

  it("covers the front, and nothing at the sides or back", () => {
    // Facing +z. A dart from straight ahead comes from +z.
    expect(plateFaces(SPEC, SHIELD, 0, 1, 0, 1, false)).toBe(true);
    // 50 degrees off the front is inside a 120 degree arc.
    const r = (50 * Math.PI) / 180;
    expect(plateFaces(SPEC, SHIELD, 0, 1, Math.sin(r), Math.cos(r), false)).toBe(true);
    // 80 degrees off is outside it, and so is straight behind.
    const q = (80 * Math.PI) / 180;
    expect(plateFaces(SPEC, SHIELD, 0, 1, Math.sin(q), Math.cos(q), false)).toBe(false);
    expect(plateFaces(SPEC, SHIELD, 0, 1, 0, -1, false)).toBe(false);
  });

  it("follows the Blocker round as it turns", () => {
    // Facing +x: a dart from +x is covered, one from +z is not.
    expect(plateFaces(SPEC, SHIELD, 1, 0, 1, 0, false)).toBe(true);
    expect(plateFaces(SPEC, SHIELD, 1, 0, 0, 1, false)).toBe(false);
  });

  it("does not cover anything while the Blocker is staggered", () => {
    expect(plateFaces(SPEC, SHIELD, 0, 1, 0, 1, true)).toBe(false);
  });

  it("leaves an unarmoured part alone", () => {
    expect(plateFaces(SPEC, "body", 0, 1, 0, 1, false)).toBe(false);
  });

  it("spawns an F04 with the shield and the blaster", async () => {
    await RAPIER.init();
    const r = rig();
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 1), "F04")!;
    expect(f.spec.rig).toBe("F04");
    expect(f.parts.has(SHIELD)).toBe(true);
    expect(f.parts.has("blaster")).toBe(true);
    expect(f.rig.health).toBe(10);
    // The shield chips slowly, the body does not.
    expect(f.parts.get(SHIELD)!.carveScale).toBeCloseTo(0.3, 5);
    expect(f.parts.get("body")!.carveScale).toBe(1);
  });

  it("takes a fifth of a dart's damage on the shield front, full on the body", async () => {
    const r = rig();
    const player = new THREE.Vector3(0, 1.6, 6);
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 1), "F04")!;
    const shield = f.parts.get(SHIELD)!;
    await settle(shield.mesh, r.world);
    const aim = shield.voxelToWorld(new THREE.Vector3(
      shield.spec.size[0] / 2, shield.spec.size[1] / 2, shield.spec.size[2] + 0.5));
    const before = f.health;
    r.darts.fire(new THREE.Vector3(aim.x, aim.y, aim.z + 1), new THREE.Vector3(0, 0, -1), "standard");
    for (let i = 0; i < 120 && f.health === before; i++) tick(r, player);
    expect(r.foamers.stats.hits).toBe(1);
    const kind = SPEC.partDamage.kinds[shield.spec.kind as "ability"];
    expect(before - f.health).toBeCloseTo(SPEC.damage.standard * kind.hit * kind.total * 0.05, 5);

    // The body is not armoured, so the same dart there takes full damage.
    const body = f.parts.get("body")!;
    await settle(body.mesh, r.world);
    const bodyAim = body.voxelToWorld(new THREE.Vector3(
      body.spec.size[0] / 2, body.spec.size[1] / 2, body.spec.size[2] + 0.5));
    const mid = f.health;
    // From behind, so the dart cannot meet the shield first.
    r.darts.fire(new THREE.Vector3(bodyAim.x, bodyAim.y, bodyAim.z - 1), new THREE.Vector3(0, 0, 1), "standard");
    for (let i = 0; i < 120 && f.health === mid; i++) tick(r, player);
    const bodyKind = SPEC.partDamage.kinds[body.spec.kind as "body"];
    expect(mid - f.health).toBeCloseTo(SPEC.damage.standard * bodyKind.hit * bodyKind.total, 5);
  });
});
