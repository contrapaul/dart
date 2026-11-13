import { beforeAll, describe, expect, it } from "vitest";
import RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { buildLevel } from "../../src/level/build";
import { createPhysics } from "../../src/physics/world";
import { greedyMesh, type MeshData } from "../../src/voxel/mesher";
import { linearColorTable } from "../../src/voxel/materials";
import type { Level, LevelDoor } from "../../src/level/format";

const FAKE = {
  mesh(padded: Uint8Array): Promise<MeshData> {
    return Promise.resolve(greedyMesh(padded, linearColorTable()));
  },
};

function levelWith(doors: LevelDoor[]): Level {
  return {
    meta: { id: "t", name: "t", act: 1, targetSeconds: 60, accent: "#ffffff", setting: "t" },
    shell: [{ pos: [0, -0.5, 0], size: [10, 1, 10], material: "greybox-dark" }],
    doors,
    playerStart: { pos: [0, 0, 4], yaw: 0 },
    exit: { pos: [0, 0, -4], size: [2, 2, 2] },
  } as unknown as Level;
}

const door = (over: Partial<LevelDoor> = {}): LevelDoor => ({
  id: "d1", pos: [0, 1, 0], size: [2, 2, 0.3], lock: "none", ...over,
});

beforeAll(async () => {
  await RAPIER.init();
});

describe("buildLevel's own doors (ED-01)", () => {
  it("builds one collider per door, open or shut, and both are handles", async () => {
    const { rapier, world } = await createPhysics();
    const built = buildLevel(levelWith([
      door({ id: "open" }),
      door({ id: "shut", pos: [0, 1, -2], lock: "trigger" }),
      door({ id: "keyed", pos: [0, 1, 2], lock: "red", colour: "#ff0000" }),
    ]), rapier, world, FAKE);
    expect(world.colliders.len()).toBe(1 + 3);
    expect([...built.doors.keys()]).toEqual(["open", "shut", "keyed"]);
    expect(built.doors.get("open")!.state).toBe("open");
    expect(built.doors.get("shut")!.state).toBe("locked");
    expect(built.doors.get("keyed")!.state).toBe("locked");
    // An open door's collider is off; a shut one's is on.
    const enabled = world.colliders.getAll().filter((c) => c.isEnabled()).length;
    expect(enabled).toBe(1 + 2);
  });

  it("hides the mesh of an open one and shows a shut one at its size", async () => {
    const { rapier, world } = await createPhysics();
    const built = buildLevel(levelWith([
      door({ id: "open" }),
      door({ id: "shut", pos: [0, 1, -2], lock: "trigger", rotY: 90 }),
    ]), rapier, world, FAKE);
    const meshes = built.group.children.filter((o): o is THREE.Mesh => (o as THREE.Mesh).isMesh);
    const shut = meshes.find((m) => m.visible && m.position.z === -2)!;
    // rotY is degrees: a quarter turn about Y.
    expect(shut.rotation.y).toBeCloseTo(Math.PI / 2, 6);
    expect(shut.position.toArray()).toEqual([0, 1, -2]);
    const box = shut.geometry as THREE.BoxGeometry;
    expect(box.parameters.width).toBeCloseTo(2);
    expect(box.parameters.depth).toBeCloseTo(0.3);
  });

  it("opens and shuts through setState, the same as an arena door", async () => {
    const { rapier, world } = await createPhysics();
    const built = buildLevel(levelWith([door({ lock: "trigger" })]), rapier, world, FAKE);
    const handle = built.doors.get("d1")!;
    expect(world.colliders.getAll()[1]!.isEnabled()).toBe(true);
    handle.setState("open");
    expect(handle.state).toBe("open");
    expect(world.colliders.getAll()[1]!.isEnabled()).toBe(false);
    handle.setState("sealed");
    expect(world.colliders.getAll()[1]!.isEnabled()).toBe(true);
  });
});
