import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { surfaceMaterial } from "../render/surfaces";
import type { Level, ModelAsset, PlacedModel, Vec3 } from "./format";

// ED-35: imported GLB models. A model asset is a GLB kept inside the level
// file as a data: URL, so nothing is fetched (design/EDITOR-V2.md: GLB only,
// 3 MB a model, 12 MB a level). This module loads it once per asset id and
// hands out clones that share the geometry and materials.
//
// Draco and KTX2 need a decoder the game does not bundle, so a GLB that
// requires either is refused with a plain message rather than half loaded.

const DEG = Math.PI / 180;

/** The bytes behind a data: URL. A base64 GLB is what the editor writes; a
 *  plain percent-encoded one is read too, so a hand made file still opens. */
export function dataUrlBytes(data: string): ArrayBuffer {
  const comma = data.indexOf(",");
  if (comma < 0 || !data.startsWith("data:")) throw new Error("model data is not a data: URL");
  const head = data.slice(0, comma);
  const body = data.slice(comma + 1);
  const bytes = head.endsWith(";base64")
    ? Uint8Array.from(atob(body), (c) => c.charCodeAt(0))
    : new TextEncoder().encode(decodeURIComponent(body));
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

/** The name of the extension a GLB cannot load without, or null. Reads the
 *  GLB's JSON chunk, which is the first chunk of the file. */
function unsupportedExtension(buffer: ArrayBuffer): string | null {
  if (buffer.byteLength < 20) return null;
  const view = new DataView(buffer);
  // "glTF", little endian. Not a GLB: leave it to the loader to refuse.
  if (view.getUint32(0, true) !== 0x46546c67) return null;
  const jsonLength = view.getUint32(12, true);
  if (20 + jsonLength > buffer.byteLength) return null;
  const json = new TextDecoder().decode(new Uint8Array(buffer, 20, jsonLength));
  if (json.includes("KHR_draco_mesh_compression")) return "Draco compression";
  if (json.includes("KHR_texture_basisu")) return "KTX2 textures";
  return null;
}

interface Cached {
  data: string;
  scene: Promise<THREE.Group>;
}

const cache = new Map<string, Cached>();

function loadScene(asset: ModelAsset): Promise<THREE.Group> {
  const buffer = dataUrlBytes(asset.data);
  const needs = unsupportedExtension(buffer);
  if (needs) {
    return Promise.reject(new Error(`${asset.name}: ${needs} is not supported. Export the model without it.`));
  }
  return new GLTFLoader().parseAsync(buffer, "").then((gltf) => {
    const scene = gltf.scene;
    scene.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = mesh.receiveShadow = true;
    });
    return scene;
  }, (e: unknown) => {
    throw new Error(`${asset.name}: not a GLB the loader can read (${(e as Error)?.message ?? e})`);
  });
}

/** The asset's scene, loaded once and kept. A second call with the same id
 *  and the same bytes gives the same scene; new bytes for an id reload it,
 *  so an edited file does not show the old model. */
export function loadModelAsset(asset: ModelAsset): Promise<THREE.Group> {
  const hit = cache.get(asset.id);
  if (hit && hit.data === asset.data) return hit.scene;
  const scene = loadScene(asset);
  cache.set(asset.id, { data: asset.data, scene });
  // A failed load is not cached: a fixed file with the same id must load.
  scene.catch(() => {
    if (cache.get(asset.id)?.scene === scene) cache.delete(asset.id);
  });
  return scene;
}

/** The scene of one asset in a level, or undefined for an id the file does
 *  not have (the validator rejects that, so a built level never sees it). */
export function assetOf(level: Level, id: string): ModelAsset | undefined {
  return (level.modelAssets ?? []).find((a) => a.id === id);
}

/** The model's own bounds, before it is placed: the box round its geometry
 *  in the scene's coordinates. A fresh box each call, so a caller may keep
 *  and change it. */
export function modelBounds(scene: THREE.Object3D): THREE.Box3 {
  scene.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(scene);
}

/** A placed model's local to world matrix: its position, its turn in
 *  degrees about XYZ, then its scale on each axis. Scale is applied last,
 *  so a scale of 2 is twice the model and not twice its turn. */
export function placedMatrix(model: PlacedModel, out = new THREE.Matrix4()): THREE.Matrix4 {
  const r = model.rot ?? [0, 0, 0];
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(r[0] * DEG, r[1] * DEG, r[2] * DEG, "XYZ"));
  const s = model.scale ?? [1, 1, 1];
  return out.compose(new THREE.Vector3(...model.pos), q, new THREE.Vector3(s[0], s[1], s[2]));
}

export function placedScale(model: PlacedModel): Vec3 {
  return model.scale ?? [1, 1, 1];
}

/** A copy of a loaded scene: new objects, the same geometry and materials,
 *  so a model placed fifty times costs one set of buffers. */
export function cloneModel(scene: THREE.Object3D): THREE.Group {
  const copy = scene.clone(true);
  copy.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = mesh.receiveShadow = true;
  });
  return copy as THREE.Group;
}

/** Replaces every material in a model with one plain material in a colour,
 *  the way a prim's tint works. Geometry is untouched. */
export function tintModel(object: THREE.Object3D, tint: string): void {
  const material = surfaceMaterial("plain", tint);
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.material = material;
  });
}

/** The placed model as an object in the scene: its clone at pos, rot and
 *  scale, tinted when the file gives a tint. */
export function modelObject(model: PlacedModel, scene: THREE.Object3D): THREE.Group {
  const group = cloneModel(scene);
  placedMatrix(model).decompose(group.position, group.quaternion, group.scale);
  if (model.tint) tintModel(group, model.tint);
  return group;
}
