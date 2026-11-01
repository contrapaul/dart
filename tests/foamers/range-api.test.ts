import { beforeAll, describe, expect, it } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { greedyMesh } from "../../src/voxel/mesher";
import { linearColorTable } from "../../src/voxel/materials";
import type { Mesher } from "../../src/voxel/pieces";
import { DebrisSystem } from "../../src/voxel/debris";
import { DartSystem } from "../../src/weapons/darts";
import { DartImpacts, type VoxelTarget } from "../../src/weapons/impacts";
import { FoamerSystem } from "../../src/foamers/foamers";
import type { Foamer } from "../../src/foamers/foamer";
import foamerData from "../../data/foamers.json";

const DT = 1 / 60;
const SPAWNER = foamerData.spawner;

function fakeMesher(): Mesher {
  const colors = linearColorTable();
  return { mesh: (padded) => Promise.resolve(greedyMesh(padded, colors)) };
}

/** World, floor, darts (with an ignore collider 200 m away), the shared
 *  target list and the Foamer system, same shape as rig() in
 *  parts.test.ts. */
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

/** How many bodies the world holds, via the body set's iterator. */
function bodyCount(world: RAPIER.World): number {
  let n = 0;
  world.bodies.forEach(() => n++);
  return n;
}

beforeAll(async () => {
  await RAPIER.init();
});

describe("range page spawner controls (ENG-11)", () => {
  it("spawnCount 0: nothing spawns in 10 s; setting it to 2 brings two alive within respawnDelay * 2 + 1 s", async () => {
    const r = rig();
    const player = new THREE.Vector3(0, 1.6, 10);
    r.foamers.spawnCount = 0;
    for (let i = 0; i < Math.round(10 / DT); i++) tick(r, player);
    expect(r.foamers.list.length).toBe(0);
    expect(r.foamers.stats.spawned).toBe(0);

    r.foamers.spawnCount = 2;
    for (let i = 0; i < Math.round((SPAWNER.respawnDelay * 2 + 1) / DT); i++) tick(r, player);
    expect(r.foamers.list.length).toBe(2);
    expect(r.foamers.stats.spawned).toBe(2);
  });

  it("clear() removes every live, downed and broken Foamer: pieces, downed, targets, bodies", async () => {
    const r = rig();
    const player = new THREE.Vector3(0, 1.6, 10);
    const a = r.foamers.spawn(new THREE.Vector3(-6, 0, 0))!;
    const b = r.foamers.spawn(new THREE.Vector3(6, 0, 0))!;
    r.world.step();
    expect(r.foamers.list.length).toBe(2);
    expect(r.targets.length).toBeGreaterThan(0);
    const bodiesBefore = bodyCount(r.world);

    // a loses a part (it breaks off as a piece); b loses its head and an
    // arm and goes down.
    a.parts.get("foreArmL")!.hp = 0;
    tick(r, player);
    expect(r.foamers.broken.length).toBeGreaterThan(0);
    b.parts.get("head")!.hp = 0;
    b.parts.get("foreArmL")!.hp = 0;
    tick(r, player);
    expect(r.foamers.downed.length).toBe(1);
    expect(r.foamers.downed[0]!.state).toBe("down");
    const bodiesAfterDown = bodyCount(r.world);
    expect(bodiesAfterDown).toBeGreaterThan(bodiesBefore);

    r.foamers.clear();
    expect(r.foamers.list.length).toBe(0);
    expect(r.foamers.downed.length).toBe(0);
    expect(r.foamers.broken.length).toBe(0);
    expect(r.targets.length).toBe(0);
    // Everything both Foamers brought into the world is gone: only the
    // rig's own body (the ignore colliders' fixed body) remains, and the
    // system's scene group is empty again.
    expect(bodyCount(r.world)).toBe(1);
    expect(r.foamers.group.children.length).toBe(0);
  });

  it("spawnPoints replaced: new Foamers appear only at the new points", async () => {
    const r = rig();
    const player = new THREE.Vector3(0, 1.6, 10);
    r.foamers.spawnPoints = [[0, 0, 5]];
    r.foamers.spawnCount = 2;
    // Record each Foamer's position on the first tick it is alive, so the
    // check is of where it appeared, not where it has walked to.
    const seen = new Map<Foamer, { x: number; z: number }>();
    for (
      let i = 0;
      i < Math.round((SPAWNER.respawnDelay * 2 + 1) / DT) && r.foamers.list.length < 2;
      i++
    ) {
      const before = r.foamers.list.length;
      tick(r, player);
      for (let j = before; j < r.foamers.list.length; j++) {
        const f = r.foamers.list[j]!;
        seen.set(f, { x: f.centre.x, z: f.centre.z });
      }
    }
    expect(seen.size).toBe(2);
    for (const pos of seen.values()) {
      const d = Math.hypot(pos.x - 0, pos.z - 5);
      expect(d, "spawned at the custom point").toBeLessThan(0.5);
    }
  });
});
