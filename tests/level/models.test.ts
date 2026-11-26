import { beforeAll, describe, expect, it } from "vitest";
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import {
  dataUrlBytes, loadModelAsset, modelBounds, modelObject, placedMatrix, tintModel,
} from "../../src/level/models";
import type { ModelAsset } from "../../src/level/format";

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

beforeAll(() => {
  (globalThis as unknown as { FileReader: unknown }).FileReader = NodeFileReader;
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
