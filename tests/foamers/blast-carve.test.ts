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
import { ExplosionSystem } from "../../src/weapons/explosion";
import explosionTuning from "../../data/explosion.json";

// PT-05 stage 2: a blast carves the Foamer's parts, and a blast kill uses
// the PT-03 impact rule (chunk in the band, pop above it, obliteration far
// above it), with the blast's centre damage as the shot and near 1.

const DT = 1 / 60;
const P = explosionTuning.profiles.launcher;

function fakeMesher(): Mesher {
  const colors = linearColorTable();
  return { mesh: (padded) => Promise.resolve(greedyMesh(padded, colors)) };
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
  const explosion = new ExplosionSystem(world, debris, targets);
  explosion.foamers = foamers;
  world.step();
  return { world, darts, debris, foamers, targets, explosion };
}

const eye = new THREE.Vector3(0, 1.6, 30);

function tick(r: ReturnType<typeof rig>, dt = DT) {
  r.darts.update(dt);
  r.foamers.update(dt, eye);
  r.world.step();
}

async function spawn(r: ReturnType<typeof rig>, type: string) {
  const f = r.foamers.spawn(new THREE.Vector3(0, 0, 0), eye, type)!;
  for (const part of f.parts.values()) {
    while (part.mesh.busy) {
      part.mesh.update();
      await new Promise((res) => setTimeout(res, 0));
    }
  }
  r.world.step();
  return f;
}

function voxels(f: { parts: Map<string, { voxelCount: number }> }): number {
  let n = 0;
  for (const p of f.parts.values()) n += p.voxelCount;
  return n;
}

beforeAll(async () => {
  await RAPIER.init();
});

describe("PT-05 stage 2: blasts carve Foamers and obliterate them", () => {
  it("1. a launcher round 1 m from an F01 obliterates it", async () => {
    const r = rig();
    const f = await spawn(r, "F01");
    expect(voxels(f)).toBeGreaterThan(0);
    r.explosion.explode(new THREE.Vector3(1.0, 0.9, 0), "launcher");
    tick(r);
    expect(r.foamers.list).not.toContain(f);
    expect(r.foamers.stats.popped).toBe(1);
    // The numbers that make it obliteration, not a plain pop.
    expect(explosionTuning.obliterateAt).toBeLessThanOrEqual(P.damageCentre);
  });

  it("2. a launcher round 2.5 m from an F05 chunks it on the near side", async () => {
    const r = rig();
    const f = await spawn(r, "F05");
    // Weakened so the edge-of-range damage still kills: the kill is then
    // judged in the chunk band, and the hole is the near side the sphere
    // reaches.
    f.health = 2;
    const before = voxels(f);
    r.explosion.explode(new THREE.Vector3(2.5, 0.9, 0), "launcher");
    expect(r.foamers.stats.chunks).toBe(1);
    expect(voxels(f)).toBeLessThan(before);
    expect(f.state).toBe("down");
    expect(r.foamers.stats.popped).toBe(0);
  });

  it("3. a surviving F07 loses voxels where the blast reaches it", async () => {
    const r = rig();
    const f = await spawn(r, "F07");
    f.health = 1000;
    const before = voxels(f);
    r.explosion.explode(new THREE.Vector3(-1.4, 0.9, 0), "launcher");
    tick(r);
    expect(f.state).not.toBe("down");
    expect(f.health).toBeLessThan(1000);
    expect(voxels(f)).toBeLessThan(before);
  });
});
