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

const DT = 1 / 60;

function fakeMesher(): Mesher {
  const colors = linearColorTable();
  return { mesh: (padded) => Promise.resolve(greedyMesh(padded, colors)) };
}

async function settle(mesh: { update(): void; busy: boolean }, world: RAPIER.World) {
  while (true) {
    mesh.update();
    if (!mesh.busy) break;
    await new Promise((r) => setTimeout(r, 0));
  }
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
  r.darts.syncRender();
}

describe("SPAWN-01: a teleporting Foamer", () => {
  beforeAll(async () => {
    await RAPIER.init();
  });

  it("does not move, attack or take dart damage while the arrival runs, then does", async () => {
    const r = rig();
    const player = new THREE.Vector3(0, 1.6, 3);
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 0), player, "F01", false, true)!;
    expect(f.spawnLeft).toBeGreaterThan(0);
    const body = f.parts.get("body")!;
    await settle(body.mesh, r.world);

    // Freeze the player in front of the Foamer: it must not attack.
    let elapsed = 0;
    let moves = 0;
    let attackStates = 0;
    const startX = f.centre.x, startZ = f.centre.z;
    while (f.spawnLeft > 0 && elapsed < 5) {
      tick(r, player);
      elapsed += DT;
      if (Math.abs(f.centre.x - startX) > 1e-4 || Math.abs(f.centre.z - startZ) > 1e-4) moves++;
      if (f.state === "windup" || f.state === "strike") attackStates++;
      // Fire a dart straight at it: it must not be hit while it arrives.
      const aim = body.voxelToWorld(new THREE.Vector3(0, 0, 0));
      const from = new THREE.Vector3(aim.x, aim.y, aim.z + 5);
      r.darts.fire(from, new THREE.Vector3(0, 0, -1), "standard");
    }
    await new Promise((res) => setTimeout(res, 0));
    expect(moves).toBe(0);
    expect(attackStates).toBe(0);
    expect(r.foamers.stats.hits).toBe(0);
    expect(f.health).toBe(f.maxHealth);
    expect(f.spawnLeft).toBe(0);

    // Now it behaves as a normal Foamer: it moves toward the player.
    const before = new THREE.Vector3(f.centre.x, f.centre.y, f.centre.z);
    for (let i = 0; i < 90; i++) tick(r, player);
    const dist = Math.hypot(player.x - f.centre.x, player.z - f.centre.z);
    expect(dist).toBeLessThan(Math.hypot(player.x - before.x, player.z - before.z));
    for (const p of f.parts.values()) await settle(p.mesh, r.world);
  });

  it("grows from small to exactly 1", async () => {
    const r = rig();
    const player = new THREE.Vector3(0, 1.6, 3);
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 0), player, "F01", false, true)!;
    const body = f.parts.get("body")!;
    await settle(body.mesh, r.world);
    const scaleOf = () => {
      const s = new THREE.Vector3();
      body.pose.decompose(new THREE.Vector3(), new THREE.Quaternion(), s);
      return s.x;
    };
    expect(scaleOf()).toBeGreaterThan(0);
    expect(scaleOf()).toBeLessThan(1);
    let seenOvershoot = false;
    for (let i = 0; i < 300 && f.spawnLeft > 0; i++) {
      tick(r, player);
      if (scaleOf() > 1) seenOvershoot = true;
    }
    expect(seenOvershoot).toBe(true);
    expect(scaleOf()).toBeCloseTo(1, 5);
  });

  it("lets a normal Foamer stay instant", async () => {
    const r = rig();
    const player = new THREE.Vector3(0, 1.6, 3);
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 0), player, "F01")!;
    expect(f.spawnLeft).toBe(0);
    expect(r.foamers.spawnFx.live).toBe(0);
    const body = f.parts.get("body")!;
    await settle(body.mesh, r.world);
    tick(r, player);
    const s = new THREE.Vector3();
    body.pose.decompose(new THREE.Vector3(), new THREE.Quaternion(), s);
    expect(s.x).toBeCloseTo(1, 5);
    // It behaves exactly as before: it approaches the player.
    const before = new THREE.Vector3(f.centre.x, f.centre.y, f.centre.z);
    for (let i = 0; i < 90; i++) tick(r, player);
    expect(Math.hypot(player.x - f.centre.x, player.z - f.centre.z))
      .toBeLessThan(Math.hypot(player.x - before.x, player.z - before.z));
  });

  it("clears the effect when the Foamers are cleared", async () => {
    const r = rig();
    const player = new THREE.Vector3(0, 1.6, 3);
    r.foamers.spawn(new THREE.Vector3(0, 0, 0), player, "F01", false, true);
    expect(r.foamers.spawnFx.group.parent).toBe(r.foamers.group);
    tick(r, player);
    r.foamers.clear();
    expect(r.foamers.list.length).toBe(0);
    expect(r.foamers.spawnFx.live).toBe(0);
    // The effect group is out of the scene and back on the next teleport.
    expect(r.foamers.spawnFx.group.parent).toBeNull();
    const f2 = r.foamers.spawn(new THREE.Vector3(0, 0, 0), player, "F01", false, true)!;
    expect(f2.spawnLeft).toBeGreaterThan(0);
    expect(r.foamers.spawnFx.group.parent).toBe(r.foamers.group);
  });
});
