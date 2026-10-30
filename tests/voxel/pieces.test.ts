import { beforeAll, describe, expect, it, beforeEach } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { VoxelVolume } from "../../src/voxel/chunk";
import { materialId, EMPTY, linearColorTable } from "../../src/voxel/materials";
import { greedyMesh } from "../../src/voxel/mesher";
import { FallingPieces, type PieceSource } from "../../src/voxel/pieces";
import { DebrisSystem } from "../../src/voxel/debris";
import tuning from "../../data/destruction.json";

// Node has no Web Workers; run the greedy mesher inline on the main thread.
const FAKE = {
  mesh(padded: Uint8Array) {
    return Promise.resolve(greedyMesh(padded, linearColorTable()));
  },
};
const V = 0.1;
const dt = 1 / 60;
const mul = (v: THREE.Vector3) => v.multiplyScalar(V);

// A source with a mutable `busy` flag.
function makeSource(volume: VoxelVolume) {
  let busy = false;
  return {
    source: {
      volume,
      voxelToWorld: mul,
      get busy() {
        return busy;
      },
    } as PieceSource,
    setBusy: (b: boolean) => (busy = b),
  };
}

// A 4 x 20 x 4 pillar at x 7..10, y 0..19, z 17..20 with a bedrock bottom
// row, sitting at the origin (the floor's top surface is at y = 0).
function makePillarVolume() {
  const volume = new VoxelVolume(V);
  volume.fillBox(7, 0, 17, 10, 19, 20, materialId("foam-orange"));
  volume.fillBox(7, 0, 17, 10, 0, 20, materialId("bedrock"));
  return volume;
}

// Empties one whole layer of the pillar and returns the removed voxels.
function removeLayer(source: PieceSource, y: number) {
  const removed = [];
  for (let x = 7; x <= 10; x++)
    for (let z = 17; z <= 20; z++) {
      source.volume.set(x, y, z, EMPTY);
      removed.push({ x, y, z, material: materialId("foam-orange") });
    }
  return removed;
}

function step(world: RAPIER.World, pieces: FallingPieces, n: number) {
  for (let i = 0; i < n; i++) {
    pieces.update(dt);
    world.step();
  }
}

describe("FallingPieces", () => {
  let world: RAPIER.World;
  let pieces: FallingPieces;
  let debris: DebrisSystem;
  let source: PieceSource;
  let setBusy: (b: boolean) => void;

  beforeAll(async () => {
    await RAPIER.init();
  });

  beforeEach(() => {
    world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    // A fixed floor under the pillar, top surface at y = 0.
    const floor = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(1, 0.5, 1).setTranslation(0.9, -0.5, 1.9),
      floor,
    );
    debris = new DebrisSystem(RAPIER, world);
    pieces = new FallingPieces(RAPIER, world, FAKE as any, debris);
    ({ source, setBusy } = makeSource(makePillarVolume()));
  });

  it("6: a cut-off tier falls and lands on the floor", async () => {
    const removed = removeLayer(source, 10);
    expect(pieces.afterCarve(source, removed)).toBe(1);
    expect(pieces.live).toBe(1);
    // The carved layer and the island above it are out of the source
    // volume (they are the piece now); the part under the cut remains.
    expect(source.volume.get(8, 10, 18)).toBe(EMPTY);
    expect(source.volume.get(8, 11, 18)).toBe(EMPTY);
    expect(source.volume.get(8, 9, 18)).not.toBe(EMPTY);
    await new Promise((r) => setTimeout(r, 0));
    step(world, pieces, 240);
    const dyn = world.bodies.getAll().filter((b) => !b.isFixed());
    expect(dyn).toHaveLength(1);
    const t = dyn[0]!.translation();
    // The tier top started near 2.0 m; it fell, and it settled on the floor.
    // (Its origin rests within colliderInset of the floor's top surface.)
    expect(t.y).toBeLessThan(2.0 - 0.5);
    expect(t.y).toBeGreaterThanOrEqual(-0.05);
  });

  it("7: a piece is held while the source remeshes, then released", async () => {
    setBusy(true);
    const removed = removeLayer(source, 10);
    pieces.afterCarve(source, removed);
    await new Promise((r) => setTimeout(r, 0));
    // Under maxHoldTime: still kinematic and it has not moved. The island
    // min is voxel (7, 11, 17), so the body sits at world (0.7, 1.1, 1.7).
    step(world, pieces, 10);
    const held = world.bodies.getAll().find((b) => b.isKinematic())!;
    const t = held.translation();
    expect(Math.abs(t.x - 7 * V)).toBeLessThan(0.001);
    expect(Math.abs(t.y - 11 * V)).toBeLessThan(0.001);
    expect(Math.abs(t.z - 17 * V)).toBeLessThan(0.001);
    expect(world.bodies.getAll().filter((b) => b.isDynamic())).toHaveLength(0);
    // Leave busy: within 5 more steps the piece is dynamic.
    setBusy(false);
    step(world, pieces, 5);
    expect(world.bodies.getAll().filter((b) => b.isDynamic())).toHaveLength(1);
  });

  it("7b: a held piece is released when maxHoldTime is reached", async () => {
    setBusy(true);
    const removed = removeLayer(source, 10);
    pieces.afterCarve(source, removed);
    await new Promise((r) => setTimeout(r, 0));
    step(world, pieces, 5);
    expect(world.bodies.getAll().filter((b) => b.isDynamic())).toHaveLength(0);
    step(world, pieces, Math.ceil(tuning.islands.maxHoldTime * 60) + 10);
    expect(world.bodies.getAll().filter((b) => b.isDynamic())).toHaveLength(1);
  });

  it("8: tiny islands go to debris; over the cap pieces fade out", async () => {
    // (a) A 3-voxel island is under minPieceVoxels: it becomes debris.
    const small = new VoxelVolume(V);
    small.fillBox(0, 0, 0, 2, 0, 0, materialId("foam-orange"));
    const smallRemoved = [];
    for (const x of [1, 2]) {
      small.set(x, 0, 0, EMPTY);
      smallRemoved.push({ x, y: 0, z: 0, material: materialId("foam-orange") });
    }
    const smallSource = makeSource(small).source;
    const before = debris.live;
    expect(pieces.afterCarve(smallSource, smallRemoved)).toBe(1);
    expect(pieces.live).toBe(0);
    expect(debris.live).toBe(before + 1);
    expect(pieces.stats.toDebris).toBe(1);

    // (b) 19 free 12-voxel tiles: maxPieces + 3, so 3 must start fading.
    const big = new VoxelVolume(V);
    for (let i = 0; i < 19; i++) {
      const ox = 8 * i;
      big.fillBox(ox, 0, 0, ox + 2, 0, 1, materialId("bedrock"));
      big.fillBox(ox, 1, 0, ox + 2, 1, 1, materialId("foam-orange")); // carved row
      big.fillBox(ox, 2, 0, ox + 2, 3, 1, materialId("foam-orange")); // 12-voxel piece
    }
    const bigRemoved = [];
    for (let i = 0; i < 19; i++)
      for (let x = 8 * i; x <= 8 * i + 2; x++)
        for (let z = 0; z <= 1; z++) {
          big.set(x, 1, z, EMPTY);
          bigRemoved.push({ x, y: 1, z, material: materialId("foam-orange") });
        }
    const bigSource = makeSource(big).source;
    const n = tuning.islands.maxPieces + 3;
    expect(bigRemoved.length).toBe(19 * 6);
    expect(pieces.afterCarve(bigSource, bigRemoved)).toBe(n);
    expect(pieces.live).toBe(n);
    await new Promise((r) => setTimeout(r, 0));
    // Step past fadeTime; the oldest 3 pieces have finished fading out.
    step(world, pieces, Math.ceil(tuning.islands.fadeTime * 60) + 2);
    expect(pieces.live).toBe(tuning.islands.maxPieces);
  });
});
