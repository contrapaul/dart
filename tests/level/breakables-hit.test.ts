import { beforeAll, describe, expect, it } from "vitest";
import RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { buildLevel } from "../../src/level/build";
import { blastProfileFor, dartDamageOf } from "../../src/level/breakables";
import { createPhysics } from "../../src/physics/world";
import { DebrisSystem } from "../../src/voxel/debris";
import { greedyMesh, type MeshData } from "../../src/voxel/mesher";
import { linearColorTable } from "../../src/voxel/materials";
import explosionData from "../../data/explosion.json";
import destruction from "../../data/destruction.json";
import foamerData from "../../data/foamers.json";
import meleeData from "../../data/melee.json";
import type { Level, Prim } from "../../src/level/format";
import edOne from "../../data/levels/ed-01.json";

// Node has no Web Workers; the greedy mesher runs inline.
const edOneLevel = edOne as unknown as Level;
const FAKE = {
  mesh(padded: Uint8Array): Promise<MeshData> {
    return Promise.resolve(greedyMesh(padded, linearColorTable()));
  },
};

function level(prims: Prim[]): Level {
  return {
    meta: { id: "t", name: "t", act: 1, targetSeconds: 60, accent: "#ffffff", setting: "t" },
    shell: [],
    prims,
    playerStart: { pos: [0, 0, 0], yaw: 0 },
    exit: { pos: [0, 0, 0], size: [1, 1, 1] },
  } as unknown as Level;
}

/** A cylinder: never voxel foam, so always the hit point kind. */
const pillar = (over: Partial<Prim> = {}): Prim => ({
  id: "pillar", shape: "cylinder", pos: [0, 1.5, 0], size: [1.2, 3, 1.2],
  colour: "#8a5cff", behaviour: "breakable", hitPoints: 40, ...over,
});

/** A dart hit on a collider of the pillar, from -z toward +z. */
function dartHitAt(collider: RAPIER.Collider, z: number) {
  return {
    collider,
    point: new THREE.Vector3(0, 1.5, z),
    direction: new THREE.Vector3(0, 0, 1),
  };
}

beforeAll(async () => {
  await RAPIER.init();
});

async function make(prims: Prim[]) {
  const physics = await createPhysics();
  const built = buildLevel(level(prims), physics.rapier, physics.world, FAKE);
  // Rapier's broad phase fills on a step: the game steps every frame, and a
  // ray cast before the first one meets nothing.
  physics.world.step();
  return { ...built, world: physics.world, debris: new DebrisSystem(physics.rapier, physics.world) };
}

describe("a hit point breakable", () => {
  it("is its own mesh with colliders of its own", async () => {
    const b = await make([pillar()]);
    // One prim collider, whatever the hull needed; the level has no voxels.
    expect(b.world.colliders.len()).toBeGreaterThan(0);
    const meshes = b.group.children.filter((c) => (c as THREE.Mesh).isMesh);
    expect(meshes.length).toBe(1);
    expect(b.breakables.hpOf("pillar")).toBe(40);
  });

  it("loses the damage of a dart hit and is gone at 0", async () => {
    const b = await make([pillar()]);
    b.breakables.debris = b.debris;
    const state = b.breakables.list[0]!;
    const collider = b.world.colliders.getAll()[0]!;
    const damage = dartDamageOf("slug");
    expect(damage).toBe(6);

    b.breakables.dartHit(dartHitAt(collider, -0.6), damage);
    expect(b.breakables.hpOf("pillar")).toBe(34);
    expect(state.alive).toBe(true);

    // Fill it up to one dart short of gone: still there, collider on.
    b.breakables.dartHit(dartHitAt(collider, -0.6), 33);
    expect(b.breakables.hpOf("pillar")).toBe(1);
    expect(state.alive).toBe(true);
    expect(collider.isEnabled()).toBe(true);

    // The last one takes it away: no more hit points, hidden, no collision.
    let broke = 0;
    b.breakables.onBreak = () => broke++;
    b.breakables.dartHit(dartHitAt(collider, -0.6), 6);
    expect(b.breakables.hpOf("pillar")).toBe(0);
    expect(state.alive).toBe(false);
    expect(broke).toBe(1);
    // A hit on what is already gone does nothing (and cannot go below 0).
    b.breakables.dartHit(dartHitAt(collider, -0.6), 6);
    expect(b.breakables.hpOf("pillar")).toBe(0);
    expect(broke).toBe(1);
  });

  it("turns off its mesh and its collider when it breaks", async () => {
    const b = await make([pillar()]);
    b.breakables.debris = b.debris;
    const mesh = b.group.children.find((c) => (c as THREE.Mesh).isMesh) as THREE.Mesh;
    const collider = b.world.colliders.getAll()[0]!;
    b.breakables.dartHit(dartHitAt(collider, -0.6), 1000);
    expect(mesh.visible).toBe(false);
    expect(collider.isEnabled()).toBe(false);
  });

  it("bursts at most its cap of chunks", async () => {
    const b = await make([pillar()]);
    b.breakables.debris = b.debris;
    const cap = destruction.breakables.maxChunks;
    const volume = 1.2 * 3 * 1.2;
    // The burst count is the volume times the rate, inside the data's cap.
    const expected = Math.min(cap, Math.max(
      destruction.breakables.minChunks,
      Math.round(volume * destruction.breakables.chunksPerCubicMetre),
    ));
    const collider = b.world.colliders.getAll()[0]!;
    const bursts: { count: number }[] = [];
    const burst = b.debris.burst.bind(b.debris);
    b.debris.burst = (at, count, size, mat, share) => {
      bursts.push({ count });
      burst(at, count, size, mat, share);
    };
    b.breakables.dartHit(dartHitAt(collider, -0.6), 1000);
    expect(bursts).toEqual([{ count: expected }]);
    expect(expected).toBeLessThanOrEqual(cap);
    // And the debris system's own ring is the last cap: a big one never
    // leaves more than debris.max chunks alive.
    expect(b.debris.live).toBeLessThanOrEqual(destruction.debris.max);
  });

  it("comes back on a restart, hit points and all", async () => {
    const b = await make([pillar()]);
    b.breakables.debris = b.debris;
    const collider = b.world.colliders.getAll()[0]!;
    const mesh = b.group.children.find((c) => (c as THREE.Mesh).isMesh) as THREE.Mesh;
    b.breakables.dartHit(dartHitAt(collider, -0.6), 1000);
    expect(mesh.visible).toBe(false);
    b.breakables.reset();
    expect(b.breakables.hpOf("pillar")).toBe(40);
    expect(b.breakables.list[0]!.alive).toBe(true);
    expect(mesh.visible).toBe(true);
    expect(collider.isEnabled()).toBe(true);
  });

  it("keeps a hidden one hidden until setShown, and backs off with it", async () => {
    const b = await make([pillar({ id: "blocker", hidden: true, hitPoints: 12 })]);
    const mesh = b.group.children.find((c) => (c as THREE.Mesh).isMesh) as THREE.Mesh;
    expect(mesh.visible).toBe(false);
    const handle = b.prims.get("blocker");
    expect(handle).toBeDefined();
    handle!.setShown(true);
    expect(mesh.visible).toBe(true);
    expect(b.world.colliders.getAll()[0]!.isEnabled()).toBe(true);
    handle!.setShown(false);
    expect(mesh.visible).toBe(false);
    expect(b.world.colliders.getAll()[0]!.isEnabled()).toBe(false);
  });

  it("takes a blast with the profile's own falloff", async () => {
    const b = await make([pillar({ pos: [0, 1.5, 0], size: [1, 1, 1], hitPoints: 100 })]);
    const p = explosionData.profiles.launcher;
    // At the centre the whole damageCentre; the prim's box is 0.5 from it
    // on each axis, so the damage falls from there.
    b.breakables.blast(new THREE.Vector3(0, 1.5, 0), "launcher");
    expect(b.breakables.hpOf("pillar")).toBe(100 - p.damageCentre);
    // Beyond the range, nothing, even at the edge of the file's numbers.
    const far = b.breakables.list[0]!;
    const before = far.hp;
    b.breakables.blast(new THREE.Vector3(0, 1.5, p.rangeMetres + 10), "launcher");
    expect(far.hp).toBe(before);
  });

  it("takes a swing's damage, once, from the line the eye casts", async () => {
    const b = await make([pillar({ hitPoints: 5, size: [1.2, 3, 1.2] })]);
    const weapon = meleeData.weapons.M01;
    const swing = weapon.hits[0]!.damage;
    const eye = new THREE.Vector3(0, 1.5, -1.6);
    const fwd = new THREE.Vector3(0, 0, 1);
    b.breakables.swing(eye, fwd, meleeData.reach, swing);
    expect(b.breakables.hpOf("pillar")).toBe(5 - swing);
    // A swing aimed away meets nothing.
    b.breakables.list[0]!.hp = 5;
    b.breakables.swing(eye, new THREE.Vector3(0, 0, -1), meleeData.reach, swing);
    expect(b.breakables.hpOf("pillar")).toBe(5);
    // Out of reach, nothing either.
    b.breakables.swing(new THREE.Vector3(0, 1.5, -20), fwd, meleeData.reach, swing);
    expect(b.breakables.hpOf("pillar")).toBe(5);
  });

  it("names the blast profile the way the engine does", () => {
    // src/weapons/impacts.ts profileFor: the launcher round blasts in the
    // launcher profile, every other explosive dart in the dart profile.
    expect(blastProfileFor("launcher")).toBe(explosionData.profiles.launcher);
    for (const type of ["standard", "slug", "mega", "buck", "precision"]) {
      expect(blastProfileFor(type)).toBe(explosionData.profiles.dart);
    }
  });

  it("reads the damage it takes from data, never its own copy", () => {
    // Every dart type the blasters can fire has a damage figure, and the
    // breakable takes exactly it (the card's "the same damage numbers they
    // deal Foamers").
    const table = (foamerData as { test: { damage: Record<string, number> } }).test.damage;
    for (const type of Object.keys(table)) expect(dartDamageOf(type)).toBe(table[type]);
    expect(dartDamageOf("no-such-dart")).toBe(0);
  });

  it("builds the three ED-06 breakables of the test level", async () => {
    const physics = await createPhysics();
    const built = buildLevel(edOneLevel, physics.rapier, physics.world, FAKE);
    // The upright wall is voxel foam, so it is not here; the turned box and
    // the column are, with the file's own hit points.
    expect(built.breakables.list.map((b) => b.prim.id)).toEqual(["turned-block", "foam-column"]);
    expect(built.breakables.hpOf("turned-block")).toBe(60);
    expect(built.breakables.hpOf("foam-column")).toBe(40);
    // The voxel wall filled the volume: its 3 x 3 x 0.4 m is there.
    let count = 0;
    for (const chunk of built.voxels.chunks.values()) count += chunk.count;
    const VOXEL = built.voxels.voxelSize;
    expect(count).toBeGreaterThanOrEqual(Math.round((3 * 3 * 0.4) / VOXEL ** 3));
  });

  it("leaves an upright box to the voxel volume, and no mesh here", async () => {
    const b = await make([{
      id: "wall", shape: "box", pos: [0, 1.5, 0], size: [2, 3, 0.4],
      colour: "#b6ff3b", behaviour: "breakable",
    }]);
    expect(b.breakables.list.length).toBe(0);
    const meshes = b.group.children.filter((c) => (c as THREE.Mesh).isMesh);
    expect(meshes.length).toBe(0);
  });
});
