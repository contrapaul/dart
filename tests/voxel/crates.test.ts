import { beforeAll, describe, expect, it } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import envJson from "../../data/levels/env-01.json";
import { buildLevel } from "../../src/level/build";
import { validateLevel } from "../../src/level/validate";
import { createPhysics } from "../../src/physics/world";
import { carveSphere } from "../../src/voxel/carve";
import { EMPTY, materialId, linearColorTable } from "../../src/voxel/materials";
import { greedyMesh, type MeshData } from "../../src/voxel/mesher";
import { findIslands } from "../../src/voxel/islands";
import { Crates, burstCrate } from "../../src/voxel/crates";
import { Melee } from "../../src/game/melee";
import { FoamerSystem } from "../../src/foamers/foamers";
import { DartSystem } from "../../src/weapons/darts";
import type { VoxelTarget } from "../../src/weapons/impacts";
import type { Shield } from "../../src/player/shield";
import playerJson from "../../data/player.json";
import { VoxelVolume } from "../../src/voxel/chunk";
import { DebrisSystem } from "../../src/voxel/debris";
import tuning from "../../data/destruction.json";
import type { Level } from "../../src/level/format";

// ENV-01 stage 3: a crate breaks whole when worn. In play a dart cuts a
// crater, never a full ring, so before this rule a bottom crate could be
// chewed through forever and the crate above never fell (HANDOFF, the
// ENV-01 review). A crate is the set of piece volumes tagged with one
// `crate` id; once it has lost `crate.breakShare` of its voxels the rest
// goes at once and the island search runs on all of it.

const level = envJson as unknown as Level;
const SHARE = tuning.crate.breakShare;
const FAKE = {
  mesh(padded: Uint8Array): Promise<MeshData> {
    return Promise.resolve(greedyMesh(padded, linearColorTable()));
  },
};

beforeAll(async () => {
  await RAPIER.init();
});

async function built() {
  const { rapier, world } = await createPhysics();
  const b = buildLevel(level, rapier, world, FAKE);
  await new Promise((r) => setTimeout(r, 0));
  world.step();
  return b;
}

/** Every crate in the level file, by id, from its tagged volumes. */
function crateIds() {
  const ids = new Set<string>();
  for (const p of level.pieces ?? [])
    for (const v of p.volumes) if (v.crate) ids.add(v.crate);
  return [...ids].sort();
}

/** A crate's world bounds, from the volumes tagged with its id. */
function bounds(id: string) {
  const own = (level.pieces ?? []).flatMap((p) => p.volumes).filter((v) => v.crate === id);
  const lo = [0, 1, 2].map((i) => Math.min(...own.map((v) => v.pos[i]! - v.size[i]! / 2)));
  const hi = [0, 1, 2].map((i) => Math.max(...own.map((v) => v.pos[i]! + v.size[i]! / 2)));
  return { lo, hi };
}

/** A world point in the level volume's voxel coordinates. */
function grid(b: Awaited<ReturnType<typeof built>>, x: number, y: number, z: number) {
  const o = b.voxelMesh.group.position;
  const s = b.voxels.voxelSize;
  return [Math.floor((x - o.x) / s), Math.floor((y - o.y) / s), Math.floor((z - o.z) / s)] as const;
}

describe("ENV-01 stage 3: a crate breaks whole when worn", () => {
  it("1: tags every crate in the room and never a plinth", () => {
    // stack-a holds three crates, stack-b two, so the room has five.
    expect(crateIds()).toEqual([
      "cr-a-l", "cr-a-r", "cr-a-top", "cr-b-bottom", "cr-b-top",
    ]);
    // The plinth volumes are wood and carry no tag: a crate never includes
    // the bedrock row under it.
    const plinths = (level.pieces ?? []).flatMap((p) =>
      p.volumes.filter((v) => v.material === "wood"),
    );
    expect(plinths.length).toBe(3);
    for (const v of plinths) expect(v.crate).toBeUndefined();
    expect(validateLevel(level).errors).toEqual([]);
  });

  it("2: counts a crate's voxels, not its box", async () => {
    const b = await built();
    // Eighteen volumes a crate, but a crate is hollow: only the six 0.1 m
    // panels and the twelve frame bars carry voxels.
    expect(b.crates.count).toBe(5);
    for (const id of crateIds()) {
      const n = b.crates.remaining(id);
      expect(n).toBeGreaterThan(0);
      expect(n).toBeLessThan(216);
    }
  });

  it("3: a crate under the share stays, one past it is gone entirely", async () => {
    const b = await built();
    const start = b.crates.remaining("cr-b-bottom");
    const [x, y, z] = grid(b, 2.5, 0.4, 1.0);
    // A small crater in the west panel: well under a quarter of the crate.
    const small = carveSphere(b.voxels, x, y, z, 2);
    const r1 = b.crates.take(small);
    expect(r1.breaks).toEqual([]);
    expect(b.crates.remaining("cr-b-bottom")).toBe(start - small.length);
    expect(b.crates.remaining("cr-b-bottom")).toBeGreaterThan(start * (1 - SHARE));

    // Now a big sphere over the same crate: over the share, so it goes whole.
    const big = carveSphere(b.voxels, x, y, z, 2.5);
    const cut = big.length;
    const r2 = b.crates.take(big);
    expect(r2.breaks.map((q) => q.id)).toEqual(["cr-b-bottom"]);
    expect(b.crates.remaining("cr-b-bottom")).toBe(0);
    // Gone entirely: not one destructible voxel of its own box is left.
    const { lo, hi } = bounds("cr-b-bottom");
    const [x0, y0, z0] = grid(b, lo[0]!, lo[1]!, lo[2]!);
    const [x1, y1, z1] = grid(b, hi[0]! - 1e-6, hi[1]! - 1e-6, hi[2]! - 1e-6);
    for (let vy = y0; vy <= y1; vy++)
      for (let vz = z0; vz <= z1; vz++)
        for (let vx = x0; vx <= x1; vx++) expect(b.voxels.get(vx, vy, vz)).toBe(EMPTY);
    // Whatever the carve did not take, the break did: the list handed to
    // the island search is the carve plus the crate's leftovers.
    const [brk] = r2.breaks;
    expect(r2.removed.length).toBe(cut + brk!.voxels.length);
    // It broke on the carve alone: 24 voxels in the first crater plus 136
    // here is past the quarter of 184.
    expect(brk!.voxels.length).toBe(184 - cut - 24);
  });

  it("4: the crate above a broken one becomes an island", async () => {
    const b = await built();
    const [x, y, z] = grid(b, 2.5, 0.4, 1.0);
    const res = b.crates.take(carveSphere(b.voxels, x, y, z, 3));
    expect(res.breaks.length).toBe(1);
    const islands = findIslands(b.voxels, res.removed, tuning.islands.maxSearchVoxels);
    expect(islands.length).toBe(1);
    const isle = islands[0]!;
    const o = b.voxelMesh.group.position;
    const s = b.voxels.voxelSize;
    // The island is the whole top crate, 0.7 to 1.3 m up.
    expect(o.y + isle.min[1] * s).toBeCloseTo(0.7, 6);
    expect(o.y + (isle.max[1] + 1) * s).toBeCloseTo(1.3, 6);
  });

  it("5: a volume with no crate tag is unchanged", () => {
    // The coat is untagged: a sphere through it removes only what it touches.
    const volume = new VoxelVolume(0.1);
    volume.fillBox(0, 0, 0, 3, 3, 3, materialId("foam-white"));
    const crates = new Crates(volume, []);
    expect(crates.count).toBe(0);
    const removed = carveSphere(volume, 2, 2, 2, 1);
    const res = crates.take(removed);
    expect(res.breaks).toEqual([]);
    expect(res.removed.length).toBe(removed.length);
    expect(volume.get(0, 0, 0)).not.toBe(EMPTY);
  });

  it("6: the tally is the voxels the volume holds, hollow inside included", () => {
    // A crate's box is hollow and its panels overlap the frame bars, so the
    // start figure must be what the volume holds, not the box's volume.
    const volume = new VoxelVolume(0.1);
    volume.fillBox(0, 0, 0, 5, 5, 5, materialId("cardboard"));
    for (let y = 2; y <= 3; y++)
      for (let z = 2; z <= 3; z++)
        for (let x = 2; x <= 3; x++) volume.set(x, y, z, EMPTY);
    const crates = new Crates(volume, [{ id: "t", min: [0, 0, 0], max: [5, 5, 5] }]);
    expect(crates.remaining("t")).toBe(216 - 8);
  });

  it("7: a break's debris stays inside the debris caps", () => {
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    const debris = new DebrisSystem(RAPIER, world);
    const voxels = [];
    for (let y = 0; y <= 5; y++)
      for (let z = 0; z <= 5; z++)
        for (let x = 0; x <= 5; x++)
          voxels.push({ x, y, z, material: materialId("cardboard") });
    burstCrate(debris, voxels, 0.1, (v: THREE.Vector3) => v.clone().multiplyScalar(0.1));
    expect(debris.live).toBeGreaterThan(0);
    expect(debris.live).toBeLessThanOrEqual(tuning.debris.max);
    expect(debris.live).toBeLessThanOrEqual(tuning.debris.perCarveMax);
  });

  it("8: a melee carve counts against a crate the same way", () => {
    // A tagged 0.4 m crate in the baton's reach. The swing casts a ray at
    // the cover and carves a crater where it lands; that carve reports the
    // volume it came from, which is what the page hands to `Crates.take`.
    // One swing is far under a crate's quarter, so it is tallied and stays.
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    world.createCollider(RAPIER.ColliderDesc.cuboid(20, 0.5, 20).setTranslation(0, -0.5, 0));
    const min = new THREE.Vector3(-0.2, 1.4, -1.4);
    const volume = new VoxelVolume(0.1);
    volume.fillBox(0, 0, 0, 3, 3, 3, materialId("cardboard"));
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    const collider = world.createCollider(
      RAPIER.ColliderDesc.cuboid(0.2, 0.2, 0.2).setTranslation(0, 1.6, -1.2),
      body,
    );
    const target: VoxelTarget = {
      volume,
      owns: (c) => c === collider,
      worldToVoxel: (v) => v.sub(min).divideScalar(0.1),
      voxelToWorld: (v) => v.multiplyScalar(0.1).add(min),
    };
    const targets: VoxelTarget[] = [target];
    const ignore = world.createCollider(
      RAPIER.ColliderDesc.cuboid(0.1, 0.1, 0.1).setTranslation(0, 0, 50),
    );
    const darts = new DartSystem(new THREE.Scene(), world, RAPIER, ignore);
    const debris = new DebrisSystem(RAPIER, world);
    const foamers = new FoamerSystem(RAPIER, world, FAKE, debris, darts, targets);
    const player = world.createCollider(
      RAPIER.ColliderDesc.capsule(0.6, 0.3).setTranslation(0, 0.9, 0),
    );
    const melee = new Melee(RAPIER, world, foamers, debris, targets, player);
    const crates = new Crates(volume, [{ id: "m", min: [0, 0, 0], max: [3, 3, 3] }]);
    expect(crates.remaining("m")).toBe(64);
    // A collider made this step is not in the broad phase until the world
    // steps, so the swing's ray would miss it.
    world.step();

    const down = { state: "lowered", charging: false, parries: 0 } as unknown as Shield;
    const e = melee.press(new THREE.Vector3(0, playerJson.eyeHeight, 0), new THREE.Vector3(0, 0, -1), down);
    expect(e.carves.length).toBe(1);
    const carve = e.carves[0]!;
    expect(carve.target).toBe(target);
    expect(carve.removed.length).toBeGreaterThan(0);
    const res = crates.take(carve.removed);
    expect(res.breaks).toEqual([]);
    expect(crates.remaining("m")).toBe(64 - carve.removed.length);
    // The voxel it cut really went, and the tally matches the volume.
    for (const v of carve.removed) expect(volume.get(v.x, v.y, v.z)).toBe(EMPTY);
  });
});
