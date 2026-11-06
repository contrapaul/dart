import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import pitJson from "../../data/levels/1-1-pit.json";
import { buildLevel } from "../../src/level/build";
import { makeLevelAI } from "../../src/ai/level";
import { createPhysics } from "../../src/physics/world";
import { greedyMesh, type MeshData } from "../../src/voxel/mesher";
import { linearColorTable } from "../../src/voxel/materials";
import type { Level } from "../../src/level/format";
import { DebrisSystem } from "../../src/voxel/debris";
import { DartSystem } from "../../src/weapons/darts";
import { DartImpacts, type VoxelTarget } from "../../src/weapons/impacts";
import { FoamerSystem } from "../../src/foamers/foamers";

// BUG-01: the Pit as the arena page builds it, with Foamers on it. The two
// stall tests (under the ring, and against the ramp's side) both need the
// real level file, so both use this rig.

export const DT = 1 / 60;

const pit = pitJson as unknown as Level;

const FAKE = {
  mesh(padded: Uint8Array): Promise<MeshData> {
    return Promise.resolve(greedyMesh(padded, linearColorTable()));
  },
};

export async function makePitRig(difficulty = "normal") {
  const { rapier, world } = await createPhysics();
  const built = buildLevel(pit, rapier, world, FAKE);
  const ai = makeLevelAI(rapier, world, built.navBounds, difficulty);
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  // A dart stopper far outside the level, as both pages make one.
  const ignore = world.createCollider(
    RAPIER.ColliderDesc.capsule(0.5, 0.3).setTranslation(0, 0, 200), body);
  const darts = new DartSystem(new THREE.Scene(), world, RAPIER, ignore);
  const debris = new DebrisSystem(RAPIER, world);
  const targets: VoxelTarget[] = [];
  const foamers = new FoamerSystem(RAPIER, world, FAKE, debris, darts, targets);
  new DartImpacts(darts, debris, targets);
  foamers.director = ai.director;
  foamers.navGrid = ai.grid;
  return { rapier, world, grid: ai.grid, darts, debris, foamers };
}

export type PitRig = Awaited<ReturnType<typeof makePitRig>>;

/** One frame of the game, in the order the arena page runs it. */
export function tick(r: PitRig, player: THREE.Vector3): void {
  r.darts.update(DT);
  r.foamers.update(DT, player);
  r.world.step();
  r.darts.syncRender();
}
