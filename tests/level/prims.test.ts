import { beforeAll, describe, expect, it } from "vitest";
import RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { buildPrims } from "../../src/level/prims";
import { buildLevel } from "../../src/level/build";
import { createPhysics } from "../../src/physics/world";
import { greedyMesh, type MeshData } from "../../src/voxel/mesher";
import { linearColorTable } from "../../src/voxel/materials";
import type { Level, Prim } from "../../src/level/format";

// Node has no Web Workers; the greedy mesher runs inline.
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

const box = (over: Partial<Prim> = {}): Prim => ({
  id: "p1", shape: "box", pos: [0, 0, 0], size: [2, 2, 2],
  colour: "#ff8800", behaviour: "solid", ...over,
});

beforeAll(async () => {
  await RAPIER.init();
});

describe("buildPrims", () => {
  it("puts a box's collider where its mesh is, moved and rotated", async () => {
    const { rapier, world } = await createPhysics();
    const group = new THREE.Group();
    const prim = box({ pos: [3, 4, -5], rot: [0, 90, 0], size: [2, 6, 0.5] });
    buildPrims(level([prim]), rapier, world, group);
    expect(world.colliders.len()).toBe(1);
    const c = world.colliders.getAll()[0];
    const t = c.translation();
    expect(t.x).toBeCloseTo(3);
    expect(t.y).toBeCloseTo(4);
    expect(t.z).toBeCloseTo(-5);
    // A cuboid keeps the prim's half extents; the turn is in the rotation.
    expect(c.shape.type).toBe(RAPIER.ShapeType.Cuboid);
    const half = (c.shape as unknown as { halfExtents: { x: number; y: number; z: number } }).halfExtents;
    expect(half.x).toBeCloseTo(1);
    expect(half.y).toBeCloseTo(3);
    expect(half.z).toBeCloseTo(0.25);
    const q = c.rotation();
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(new THREE.Quaternion(q.x, q.y, q.z, q.w));
    expect(forward.x).toBeCloseTo(1, 5);
  });

  it("merges prims that share a colour into one mesh, and decor collides with nothing", async () => {
    const { rapier, world } = await createPhysics();
    const group = new THREE.Group();
    const prims = [
      box({ id: "a", colour: "#ff8800" }),
      box({ id: "b", colour: "#ff8800", pos: [3, 0, 0] }),
      box({ id: "c", colour: "#0088ff", pos: [6, 0, 0] }),
      box({ id: "d", colour: "#0088ff", pos: [9, 0, 0], behaviour: "decor" }),
    ];
    buildPrims(level(prims), rapier, world, group);
    const meshes = group.children.filter((o) => (o as THREE.Mesh).isMesh);
    expect(meshes.length).toBe(2);
    // The two solid boxes are the only colliders; decor draws only.
    expect(world.colliders.len()).toBe(3);
  });

  it("starts a hidden prim off and shows it with its collider", async () => {
    const { rapier, world } = await createPhysics();
    const group = new THREE.Group();
    const prims = [box({ id: "wall" }), box({ id: "blocker", hidden: true, pos: [0, 0, 6] })];
    const handles = buildPrims(level(prims), rapier, world, group);
    expect([...handles.keys()]).toEqual(["blocker"]);
    const blocker = group.children.find(
      (o) => (o as THREE.Mesh).isMesh && !(o as THREE.Mesh).visible,
    ) as THREE.Mesh;
    expect(blocker).toBeTruthy();
    const enabled = () => world.colliders.getAll().filter((c) => c.isEnabled());
    expect(enabled().length).toBe(1);
    handles.get("blocker")!.setShown(true);
    expect(blocker.visible).toBe(true);
    expect(enabled().length).toBe(2);
    handles.get("blocker")!.setShown(false);
    expect(blocker.visible).toBe(false);
    expect(enabled().length).toBe(1);
  });

  it("gives a ramp a hull collider and never a hazard one", async () => {
    const { rapier, world } = await createPhysics();
    const group = new THREE.Group();
    buildPrims(level([
      box({ id: "r", shape: "ramp" }),
      box({ id: "h", behaviour: "hazard", hazard: { dps: 2, look: "lava" } }),
    ]), rapier, world, group);
    const types = world.colliders.getAll().map((c) => c.shape.type);
    expect(types).toEqual([RAPIER.ShapeType.ConvexPolyhedron]);
    // Only the ramp drew.
    expect(group.children.length).toBe(1);
  });

  it("covers a level built from prims alone in the nav bounds", async () => {
    const { rapier, world } = await createPhysics();
    const built = buildLevel(level([
      box({ id: "floor", pos: [0, -0.5, 0], size: [10, 1, 10] }),
    ]), rapier, world, FAKE);
    expect(built.navBounds.minX).toBeCloseTo(-4.5);
    expect(built.navBounds.maxX).toBeCloseTo(4.5);
    expect(built.navBounds.maxZ).toBeCloseTo(4.5);
    expect(built.prims.size).toBe(0);
  });
  it("merges a box and a ramp of one colour into one drawn mesh (review)", async () => {
    const { rapier, world } = await createPhysics();
    const group = new THREE.Group();
    buildPrims(level([box(), box({ id: "r", shape: "ramp", pos: [4, 0, 0] })]), rapier, world, group);
    const meshes = group.children.filter((c) => c instanceof THREE.Mesh) as THREE.Mesh[];
    expect(meshes).toHaveLength(1);
    // A box is 12 triangles, a ramp 8: all 20 are drawn.
    expect(meshes[0]!.geometry.getAttribute("position").count).toBe((12 + 8) * 3);
  });
});
