import { beforeAll, describe, expect, it } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { linearColorTable } from "../../src/voxel/materials";
import { greedyMesh } from "../../src/voxel/mesher";
import type { Mesher } from "../../src/voxel/pieces";
import { DebrisSystem } from "../../src/voxel/debris";
import { DartSystem } from "../../src/weapons/darts";
import { DartImpacts, type VoxelTarget } from "../../src/weapons/impacts";
import { FoamerSystem } from "../../src/foamers/foamers";
import type { GameRig } from "../../src/foamers/foamer";
import rigData from "../../data/foamer-rigs.json";

const DT = 1 / 60;
const RIG = (rigData.rigs as unknown as GameRig[]).find((r) => r.id === "F01")!;

function fakeMesher(): Mesher {
  const colors = linearColorTable();
  return { mesh: (padded) => Promise.resolve(greedyMesh(padded, colors)) };
}

/** Let pending remesh promises resolve, then step once more so the
 *  colliders built from them exist in the world. */
async function settle(mesh: { update(): void }, world: RAPIER.World) {
  mesh.update();
  await new Promise((r) => setTimeout(r, 0));
  world.step();
}

/** World, floor, debris, darts (ignore collider 200 m away), impacts, the
 *  Foamer system and the shared target list. */
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

function tick(r: ReturnType<typeof rig>, player: THREE.Vector3, dt = DT) {
  r.darts.update(dt);
  r.foamers.update(dt, player);
  r.world.step();
}

beforeAll(async () => {
  await RAPIER.init();
});

describe("Foamer parts (ENG-10, rig F01)", () => {
  it("1. spawn: the root plus one body per F01 part exist, every part is a target, and each part owns only its own colliders", async () => {
    const r = rig();
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 0))!;
    r.world.step();
    // One body per part, plus the root, all alive in the world.
    expect(f.parts.size).toBe(RIG.parts.length);
    for (const p of RIG.parts) {
      const part = f.parts.get(p.id)!;
      expect(part, p.id).toBeDefined();
      expect(r.world.getRigidBody(part.body.handle), p.id).not.toBeNull();
      expect(r.targets, `targets contain ${p.id}`).toContain(part);
    }
    expect(r.world.getRigidBody(f.root.handle)).not.toBeNull();
    // Every collider on the parts' bodies belongs to that part, and each
    // part body has at least one collider after the body part has meshed.
    await settle(f.parts.get("body")!.mesh, r.world);
    const ids = new Set<number>();
    for (const p of f.parts.values()) ids.add(p.body.handle);
    let owned = 0;
    r.world.forEachCollider((c) => {
      const parent = c.parent();
      if (!parent || !ids.has(parent.handle)) return;
      const owner = [...f.parts.values()].find((p) => p.owns(c));
      expect(owner, "exactly one part owns the collider").toBeDefined();
      expect(owner!.body.handle).toBe(parent.handle);
      owned++;
    });
    expect(owned).toBeGreaterThan(0);
  });

  it("2. at rest, each part's pivot sits on its parent's joint within 1 mm, and the legs are near the floor", () => {
    const r = rig();
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 0))!;
    r.world.step(); // apply the spawn-time in-place poses
    for (const p of RIG.parts) {
      if (p.parent === null) continue;
      const part = f.parts.get(p.id)!;
      const parent = f.parts.get(p.parent)!;
      const vp = new THREE.Vector3(
        ((p.pivot ?? [0, 1, 0])[0] + 1) / 2 * p.size[0],
        ((p.pivot ?? [0, 1, 0])[1] + 1) / 2 * p.size[1],
        ((p.pivot ?? [0, 1, 0])[2] + 1) / 2 * p.size[2],
      );
      const pAt = (p.at ?? [0, 0, 0]) as [number, number, number];
      const vj = new THREE.Vector3(
        (pAt[0] + 1) / 2 * (RIG.parts.find((q) => q.id === p.parent)!.size[0]),
        (pAt[1] + 1) / 2 * (RIG.parts.find((q) => q.id === p.parent)!.size[1]),
        (pAt[2] + 1) / 2 * (RIG.parts.find((q) => q.id === p.parent)!.size[2]),
      );
      const pivot = part.voxelToWorld(vp.clone());
      const joint = parent.voxelToWorld(vj.clone());
      expect(pivot.distanceTo(joint), `${p.id} pivot at joint`).toBeLessThan(0.001);
    }
    // The lowest *filled* voxel of the legs: on the floor (card test 2).
    let low = Infinity;
    for (const id of ["legL", "legR"]) {
      const leg = f.parts.get(id)!;
      const [sx, sy, sz] = leg.spec.size;
      const chunk = leg.volume.chunks.values().next().value!;
      for (let x = 0; x < sx; x++)
        for (let y = 0; y < sy; y++)
          for (let z = 0; z < sz; z++) {
            if (!chunk.get(x, y, z)) continue;
            low = Math.min(low, leg.voxelToWorld(new THREE.Vector3(x, y, z)).y);
          }
    }
    expect(Math.abs(low)).toBeLessThan(0.05);
  });

  it("3. walking for 2 s, no part rotates more than 0.35 rad in one step", () => {
    const r = rig();
    const player = new THREE.Vector3(0, 1.6, 10);
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 0))!;
    r.world.step();
    const qd = new THREE.Quaternion();
    const maxDelta = { value: 0 };
    for (let i = 0; i < 120; i++) {
      const before = new Map<string, THREE.Quaternion>();
      for (const part of f.parts.values()) {
        const rot = part.body.rotation();
        before.set(part.spec.id, new THREE.Quaternion(rot.x, rot.y, rot.z, rot.w));
      }
      tick(r, player);
      f.parts.forEach((part, id) => {
        const rot = part.body.rotation();
        qd.set(rot.x, rot.y, rot.z, rot.w);
        const angle = 2 * Math.acos(Math.min(1, Math.abs(qd.dot(before.get(id)!))));
        maxDelta.value = Math.max(maxDelta.value, angle);
      });
    }
    expect(f.centre.z).toBeGreaterThan(1); // it keeps walking
    expect(maxDelta.value).toBeLessThan(0.35);
  });
});
