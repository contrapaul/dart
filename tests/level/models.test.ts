import { beforeAll, describe, expect, it } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import {
  dataUrlBytes, loadModelAsset, modelBounds, modelObject, placedMatrix, tintModel,
} from "../../src/level/models";
import { buildLevel } from "../../src/level/build";
import { mainColour, modelVoxelVolumes } from "../../src/level/model-voxels";
import { createPhysics } from "../../src/physics/world";
import { greedyMesh, type MeshData } from "../../src/voxel/mesher";
import { linearColorTable } from "../../src/voxel/materials";
import type { Level, ModelAsset, PlacedModel } from "../../src/level/format";

// Node has no Web Workers; the greedy mesher runs inline.
const FAKE = {
  mesh(padded: Uint8Array): Promise<MeshData> {
    return Promise.resolve(greedyMesh(padded, linearColorTable()));
  },
};

/** A level whose only content is one model, for the game side. */
function levelWith(asset: ModelAsset, model: PlacedModel): Level {
  return {
    meta: { id: "t", name: "t", act: 1, targetSeconds: 60, accent: "#ffffff", setting: "t" },
    shell: [], prims: [], modelAssets: [asset], models: [model],
    playerStart: { pos: [0, 0, 0], yaw: 0 },
    exit: { pos: [0, 0, 0], size: [1, 1, 1] },
  } as unknown as Level;
}

/** Where a ray straight down at the model stops, or null for nothing hit. */
function topAt(world: RAPIER.World, rapier: typeof RAPIER, x = 0, z = 0): number | null {
  // A collider made after the world was built needs one step to be in the
  // broad phase before a ray finds it.
  world.step();
  const hit = world.castRay(new rapier.Ray({ x, y: 5, z }, { x: 0, y: -1, z: 0 }), 10, true);
  return hit ? 5 - hit.timeOfImpact : null;
}

// ED-35: the pure half of model import. Node has no FileReader, which the
// GLTFExporter uses for its binary output, so a tiny one is stood in: the
// loader and exporter are the real ones the browser runs.

class NodeFileReader {
  result: ArrayBuffer | null = null;
  onloadend: (() => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  readAsArrayBuffer(blob: Blob) {
    blob.arrayBuffer().then((b) => {
      this.result = b;
      this.onloadend?.();
    }, (e) => this.onerror?.(e));
  }
}

beforeAll(async () => {
  (globalThis as unknown as { FileReader: unknown }).FileReader = NodeFileReader;
  await RAPIER.init();
});

/** Base64 without Buffer: the tests run in Node but type check as browser code. */
function base64Of(bytes: Uint8Array): string {
  let text = "";
  for (const b of bytes) text += String.fromCharCode(b);
  return btoa(text);
}

/** A one metre cube at the origin, exported to a GLB data: URL. */
export async function cubeAsset(id = "cube", size = 1): Promise<ModelAsset> {
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(
    new THREE.BoxGeometry(size, size, size),
    new THREE.MeshStandardMaterial({ color: 0xff7a1a }),
  ));
  const glb = await new GLTFExporter().parseAsync(scene, { binary: true }) as ArrayBuffer;
  const base64 = base64Of(new Uint8Array(glb));
  return { id, name: "cube.glb", data: `data:model/gltf-binary;base64,${base64}` };
}

describe("a GLB model asset", () => {
  it("round trips through a data: URL", async () => {
    const asset = await cubeAsset();
    const scene = await loadModelAsset(asset);
    expect(scene.children.length).toBeGreaterThan(0);
    // The loader sees the same one metre cube the exporter wrote.
    const bounds = modelBounds(scene);
    expect(bounds.min.toArray()).toEqual([-0.5, -0.5, -0.5]);
    expect(bounds.max.toArray()).toEqual([0.5, 0.5, 0.5]);
  });

  it("reads the bytes back from the data: URL", async () => {
    const asset = await cubeAsset();
    const bytes = dataUrlBytes(asset.data);
    expect(new DataView(bytes).getUint32(0, true)).toBe(0x46546c67);
  });

  it("loads a second time from the cache", async () => {
    const asset = await cubeAsset("cache");
    const first = await loadModelAsset(asset);
    const second = await loadModelAsset(asset);
    expect(second).toBe(first);
  });

  it("refuses a GLB that needs Draco, with a plain message", async () => {
    const json = JSON.stringify({ asset: { version: "2.0" }, extensionsRequired: ["KHR_draco_mesh_compression"] });
    const text = new TextEncoder().encode(json);
    const buffer = new ArrayBuffer(20 + text.length);
    const view = new DataView(buffer);
    view.setUint32(0, 0x46546c67, true);
    view.setUint32(4, 2, true);
    view.setUint32(8, buffer.byteLength, true);
    view.setUint32(12, text.length, true);
    view.setUint32(16, 0x4e4f534a, true);
    new Uint8Array(buffer).set(text, 20);
    const base64 = base64Of(new Uint8Array(buffer));
    const asset: ModelAsset = { id: "draco", name: "draco.glb", data: `data:model/gltf-binary;base64,${base64}` };
    await expect(loadModelAsset(asset)).rejects.toThrow(/Draco compression is not supported/);
  });

  it("places a model at its position, turn and scale", async () => {
    const asset = await cubeAsset();
    const scene = await loadModelAsset(asset);
    const placed = modelObject({
      id: "m1", asset: asset.id, pos: [2, 1, -3], rot: [0, 90, 0], scale: [2, 1, 1], behaviour: "decor",
    }, scene);
    expect(placed.position.toArray()).toEqual([2, 1, -3]);
    // A quarter turn about Y takes the model's +x to -z.
    const corner = new THREE.Vector3(0.5, 0.5, 0).applyMatrix4(placedMatrix({
      id: "m1", asset: asset.id, pos: [2, 1, -3], rot: [0, 90, 0], scale: [2, 1, 1], behaviour: "decor",
    }));
    expect(corner.x).toBeCloseTo(2, 5);
    expect(corner.z).toBeCloseTo(-4, 5);
  });

  it("shares geometry between clones and tints the clone only", async () => {
    const asset = await cubeAsset();
    const scene = await loadModelAsset(asset);
    const a = modelObject({ id: "a", asset: asset.id, pos: [0, 0, 0], behaviour: "decor" }, scene);
    const b = modelObject({ id: "b", asset: asset.id, pos: [0, 0, 0], behaviour: "decor", tint: "#2ec4ff" }, scene);
    const meshA = a.children[0] as THREE.Mesh;
    const meshB = b.children[0] as THREE.Mesh;
    expect(meshA.geometry).toBe(meshB.geometry);
    expect((meshB.material as THREE.MeshStandardMaterial).color.getHexString()).toBe("2ec4ff");
    const plain = (meshA.material as THREE.MeshStandardMaterial).color.getHexString();
    expect(plain).not.toBe("2ec4ff");
    tintModel(a, "#ff4fa3");
    expect((meshA.material as THREE.MeshStandardMaterial).color.getHexString()).toBe("ff4fa3");
  });
});

describe("a placed model in the game", () => {
  const model = (over: Partial<PlacedModel> = {}): PlacedModel => ({
    id: "m1", asset: "cube", pos: [0, 0, 0], behaviour: "solid", ...over,
  });

  for (const collider of ["box", "hull", "mesh"] as const) {
    it(`the ${collider} collider sits on the model: a ray stops at its top`, async () => {
      const asset = await cubeAsset();
      const { rapier, world } = await createPhysics();
      const built = buildLevel(levelWith(asset, model({ collider })), rapier, world, FAKE);
      await built.models.ready;
      // The cube is one metre, centred on its position: its top is y = 0.5.
      expect(topAt(world, rapier)).toBeCloseTo(0.5, 1);
    });
  }

  it("a solid model with no collider named is a hull", async () => {
    const asset = await cubeAsset();
    const { rapier, world } = await createPhysics();
    const built = buildLevel(levelWith(asset, model()), rapier, world, FAKE);
    await built.models.ready;
    expect(topAt(world, rapier)).toBeCloseTo(0.5, 1);
  });

  it("decor is drawn and does not collide", async () => {
    const asset = await cubeAsset();
    const { rapier, world } = await createPhysics();
    const built = buildLevel(levelWith(asset, model({ behaviour: "decor" })), rapier, world, FAKE);
    await built.models.ready;
    expect(world.colliders.len()).toBe(0);
    expect(topAt(world, rapier)).toBeNull();
    expect(built.group.children.some((c) => c.type === "Group" && c.visible && c.children.length > 0)).toBe(true);
  });

  it("a hidden model is off until a trigger shows it", async () => {
    const asset = await cubeAsset();
    const { rapier, world } = await createPhysics();
    const built = buildLevel(levelWith(asset, model({ hidden: true })), rapier, world, FAKE);
    await built.models.ready;
    expect(topAt(world, rapier)).toBeNull();
    built.models.handles.get("m1")!.setShown(true);
    expect(topAt(world, rapier)).toBeCloseTo(0.5, 1);
    built.models.handles.get("m1")!.setShown(false);
    expect(topAt(world, rapier)).toBeNull();
  });

  it("the model is drawn at its position and scale", async () => {
    const asset = await cubeAsset();
    const { rapier, world } = await createPhysics();
    const built = buildLevel(
      levelWith(asset, model({ pos: [3, 2, 0], scale: [2, 2, 2] })), rapier, world, FAKE,
    );
    await built.models.ready;
    // A two metre cube on y = 2 reaches from 1 to 3.
    expect(topAt(world, rapier, 3)).toBeCloseTo(3, 1);
    expect(topAt(world, rapier, 0)).toBeNull();
  });
});

describe("voxel foam from a model", () => {
  it("fills a one metre cube with 1000 voxels at 0.1 m", async () => {
    const asset = await cubeAsset();
    const scene = await loadModelAsset(asset);
    const object = modelObject({ id: "m", asset: asset.id, pos: [0, 0, 0], behaviour: "breakable", voxel: true }, scene);
    const fill = modelVoxelVolumes(object, "foam-orange");
    expect(fill.capped).toBe(false);
    expect(fill.count).toBe(1000);
    // The greedy boxes tile the voxels exactly, never past 3.2 m a side.
    const voxels = fill.volumes.reduce((n, v) => n + (v.size[0] * v.size[1] * v.size[2]) / 0.001, 0);
    expect(voxels).toBe(1000);
    for (const v of fill.volumes) {
      expect(Math.max(...v.size), `volume ${v.size}`).toBeLessThanOrEqual(3.2 + 1e-9);
      expect(v.material).toBe("foam-orange");
    }
  });

  it("counts a two metre cube as eight thousand", async () => {
    const asset = await cubeAsset("big", 2);
    const scene = await loadModelAsset(asset);
    const object = modelObject({ id: "m", asset: asset.id, pos: [0, 0, 0], behaviour: "breakable", voxel: true }, scene);
    expect(modelVoxelVolumes(object, "foam-orange").count).toBe(8000);
  });

  it("refuses a model over the voxel cap, so it can be hit points instead", async () => {
    const asset = await cubeAsset();
    const scene = await loadModelAsset(asset);
    const object = modelObject({ id: "m", asset: asset.id, pos: [0, 0, 0], behaviour: "breakable", voxel: true }, scene);
    const fill = modelVoxelVolumes(object, "foam-orange", 500);
    expect(fill.capped).toBe(true);
    expect(fill.volumes).toEqual([]);
  });

  it("fills nothing outside a model's bounds", async () => {
    const asset = await cubeAsset("small", 0.4);
    const scene = await loadModelAsset(asset);
    const object = modelObject({ id: "m", asset: asset.id, pos: [0, 0, 0], behaviour: "breakable", voxel: true }, scene);
    const fill = modelVoxelVolumes(object, "foam-orange");
    // 0.4 m spans four 0.1 m cells a side; their centres run from -0.15
    // to 0.15, and nothing outside the model is filled.
    expect(fill.count).toBe(64);
  });

  it("reads the model's main colour for its foam", async () => {
    const asset = await cubeAsset();
    const scene = await loadModelAsset(asset);
    expect(mainColour(scene)).toMatch(/^#[0-9a-f]{6}$/);
  });
});
