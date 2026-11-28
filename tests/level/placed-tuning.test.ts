import { afterEach, beforeAll, describe, expect, it } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { linearColorTable } from "../../src/voxel/materials";
import { greedyMesh } from "../../src/voxel/mesher";
import type { Mesher } from "../../src/voxel/pieces";
import { DebrisSystem } from "../../src/voxel/debris";
import { DartSystem } from "../../src/weapons/darts";
import { FoamerSystem } from "../../src/foamers/foamers";
import { PlacedFoamers } from "../../src/level/placed";
import { ArenaRunner, type ArenaEvents } from "../../src/level/arena";
import { tuneFoamer, setLocalTuningForTest } from "../../src/core/tuning";
import type { Arena, PlacedFoamer } from "../../src/level/format";

// R3-15: a placed Foamer's own tuning reaches the spawn through
// src/level/placed.ts, and a type tuning through tuneFoamer reaches a
// wave spawn too.

const fakeMesher = (): Mesher => {
  const colors = linearColorTable();
  return { mesh: (padded) => Promise.resolve(greedyMesh(padded, colors)) };
};

let world: RAPIER.World;
let foamers: FoamerSystem;

beforeAll(async () => {
  await RAPIER.init();
});

function setupWorld() {
  world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const debris = new DebrisSystem(RAPIER, world);
  const ignore = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  const sensor = world.createCollider(RAPIER.ColliderDesc.ball(0.1).setTranslation(0, 0, 200), ignore);
  const darts = new DartSystem(new THREE.Scene(), world, RAPIER, sensor);
  foamers = new FoamerSystem(RAPIER, world, fakeMesher(), debris, darts, []);
  foamers.spawnCount = 0; // the waves own the count, not the keep-alive spawner
  return foamers;
}

afterEach(() => {
  setLocalTuningForTest({ version: 1, foamers: {}, blasters: {} });
  foamers.list.length = 0;
});

describe("placed Foamer tuning", () => {
  it("spawns a placed Foamer with its own health through PlacedFoamers", () => {
    const sys = setupWorld();
    const placed: PlacedFoamer[] = [
      { id: "a", foamer: "F01", pos: [0, 0, 0], yaw: 0, tuning: { rig: { health: 20 } } },
    ];
    const p = new PlacedFoamers(placed, sys);
    p.spawnAll();
    expect(sys.list.length).toBe(1);
    expect(sys.list[0]!.health).toBe(20);
    expect(sys.list[0]!.maxHealth).toBe(20);
  });

  it("spawns a wave with the type tuning through the arena runner", () => {
    const sys = setupWorld();
    tuneFoamer("F01", { rig: { health: 33 } });
    const rift = { id: "r", pos: [0, 0, 0] as [number, number, number], facing: [0, 1, 0] as [number, number, number] };
    const arena: Arena = {
      id: "a", archetype: "test",
      trigger: { pos: [0, 0, 0], size: [1, 1, 1] },
      doors: [],
      rifts: [rift],
      waves: [{ id: "w", rifts: ["r"], spawns: [{ foamer: "F01", count: 1 }], delaySeconds: 0 }],
      unlockOnClear: [],
    };
    const events: ArenaEvents = {
      setDoor() {},
      spawn(foamerId, r) {
        const feet = new THREE.Vector3(r.pos[0], r.pos[1], r.pos[2]);
        return sys.spawn(feet, undefined, foamerId) !== null;
      },
      onLocked() {}, onCleared() {}, onWaveStart() {},
    };
    const runner = new ArenaRunner(arena, events);
    const ctx = { playerPos: [0, 0, 0] as [number, number, number], aliveCount: 0 };
    for (let i = 0; i < 120 && sys.list.length === 0; i++) runner.update(1 / 60, ctx);
    expect(sys.list.length).toBe(1);
    expect(sys.list[0]!.health).toBe(33);
  });
});
