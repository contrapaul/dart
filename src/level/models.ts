import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type RAPIER from "@dimforge/rapier3d-compat";
import type { Rapier } from "../physics/world";
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

/** What a level page can do to a placed model that a trigger names. */
export interface ModelHandle {
  setShown(shown: boolean): void;
}

export interface BuiltModels {
  /** Every placed model by its id, so show and hide find it. */
  readonly handles: Map<string, ModelHandle>;
  /** Resolves when every asset has loaded and its mesh and colliders are
   *  in the world. A page need not wait: the level plays while it loads. */
  readonly ready: Promise<void>;
}

/** The triangles of a model in world coordinates, from every mesh inside it,
 *  for the mesh collider and the parity voxel test. */
export function modelTriangles(object: THREE.Object3D): { vertices: Float32Array; indices: Uint32Array } {
  object.updateMatrixWorld(true);
  const vertices: number[] = [];
  const indices: number[] = [];
  const v = new THREE.Vector3();
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    const geometry = mesh.geometry as THREE.BufferGeometry;
    const pos = geometry.getAttribute("position");
    if (!pos) return;
    const base = vertices.length / 3;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos as THREE.BufferAttribute, i).applyMatrix4(mesh.matrixWorld);
      vertices.push(v.x, v.y, v.z);
    }
    const index = geometry.getIndex();
    if (index) for (let i = 0; i < index.count; i++) indices.push(base + index.getX(i));
    else for (let i = 0; i < pos.count; i++) indices.push(base + i);
  });
  return { vertices: new Float32Array(vertices), indices: new Uint32Array(indices) };
}

/** At most this many points go into a hull collider. A dense model (a
 *  sculpted mesh) would make Rapier's hull build crawl; the sampled hull is
 *  at most a little inside the model, and the box collider is there for a
 *  model that needs its exact size. */
const HULL_POINTS = 2000;

/** The hull's points: the model's vertices in world space, sampled evenly
 *  when there are too many. */
export function hullPoints(object: THREE.Object3D): Float32Array {
  const { vertices } = modelTriangles(object);
  const count = vertices.length / 3;
  const step = Math.max(1, Math.ceil(count / HULL_POINTS));
  const out: number[] = [];
  for (let i = 0; i < count; i += step) out.push(vertices[i * 3]!, vertices[i * 3 + 1]!, vertices[i * 3 + 2]!);
  return new Float32Array(out);
}

/** A placed model's colliders, by its `collider` (hull when it says nothing).
 *  A solid model always gets at least one: a hull Rapier cannot build falls
 *  back to the model's world box, never to nothing to stand on. */
export function modelColliders(
  rapier: Rapier, object: THREE.Object3D, model: PlacedModel,
): RAPIER.ColliderDesc[] {
  if (model.behaviour !== "solid") return [];
  const kind = model.collider ?? "hull";
  if (kind === "mesh") {
    const { vertices, indices } = modelTriangles(object);
    if (vertices.length >= 9 && indices.length >= 3) {
      return [rapier.ColliderDesc.trimesh(vertices, indices)];
    }
  }
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const centre = box.getCenter(new THREE.Vector3());
  const fallback = () => rapier.ColliderDesc.cuboid(
    Math.max(0.01, size.x / 2), Math.max(0.01, size.y / 2), Math.max(0.01, size.z / 2),
  ).setTranslation(centre.x, centre.y, centre.z);
  if (kind === "box") return [fallback()];
  const hull = rapier.ColliderDesc.convexHull(hullPoints(object));
  return [hull ?? fallback()];
}

/** Builds every placed model into `group`, and the solid ones' colliders into
 *  `world`. The load is asynchronous (a GLB is parsed off the main path), so
 *  `ready` says when it is done; a hidden model starts off, mesh and
 *  colliders alike, for a trigger to show (ED-31's move registry is not in
 *  this tree yet, so the handles are the show/hide path). Breakables are
 *  built by src/level/model-voxels.ts, which owns the hit point and voxel
 *  kinds. */
export function buildModels(
  level: Level, rapier: Rapier, world: RAPIER.World, group: THREE.Group,
): BuiltModels {
  const handles = new Map<string, ModelHandle>();
  const jobs: Promise<void>[] = [];
  for (const model of level.models ?? []) {
    // Breakable models are not drawn as themselves: the hit point kind
    // builds its own mesh in model-voxels.ts, and the voxel kind is voxels.
    if (model.behaviour === "breakable") continue;
    const asset = assetOf(level, model.asset);
    if (!asset) continue;
    jobs.push(loadModelAsset(asset).then((scene) => {
      const object = modelObject(model, scene);
      object.visible = !model.hidden;
      group.add(object);
      const colliders = modelColliders(rapier, object, model).map((d) => world.createCollider(d));
      for (const c of colliders) if (model.hidden) c.setEnabled(false);
      // A handle only for a model that starts hidden, as a prim has: it is
      // the one a show or hide trigger reaches, and reset puts it back.
      if (!model.hidden) return;
      handles.set(model.id, {
        setShown(shown: boolean) {
          object.visible = shown;
          for (const c of colliders) c.setEnabled(shown);
        },
      });
    }).catch((e: unknown) => {
      // A model that will not load must not take the whole level down. The
      // editor refuses it on import; a hand edited file says so on the page.
      console.warn((e as Error)?.message ?? e);
    }));
  }
  return { handles, ready: Promise.all(jobs).then(() => undefined) };
}
