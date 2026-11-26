import * as THREE from "three";
import editorData from "../../data/editor.json";
import { GRID, PALETTE, snapValue } from "./doc";
import { loadModelAsset, modelBounds, modelObject, placedMatrix } from "../level/models";
import { modelVoxelVolumes } from "../level/model-voxels";
import { colourField } from "./inspector";
import type { Level, ModelAsset, PlacedModel, Vec3 } from "../level/format";

// ED-35: importing a GLB into the editor and the fields of a placed model.
// The asset is a data: URL inside the level file, so nothing is fetched and
// an exported level travels with its models. Pure parts (the id, the file
// checks, the ghost's placement, which assets are unused) are kept apart
// from the DOM so the tests can reach them headless.

export const MODEL_BEHAVIOURS = ["solid", "decor", "breakable"] as const;
export const MODEL_COLLIDERS = ["box", "hull", "mesh"] as const;

/** A number field, as the prim inspector has one, kept here so this module
 *  does not import the parts that import the markers (a cycle). */
function numberInput(value: number, step: number, commit: (n: number) => void): HTMLInputElement {
  const input = document.createElement("input");
  input.type = "number";
  input.step = String(step);
  input.value = String(Math.round(value * 1000) / 1000);
  input.addEventListener("change", () => {
    const n = Number(input.value);
    if (Number.isFinite(n)) commit(n);
  });
  return input;
}

/** A select of plain choices. */
function selectField(options: readonly string[], current: string, commit: (v: string) => void): HTMLSelectElement {
  const select = document.createElement("select");
  for (const value of options) select.append(new Option(value, value));
  select.value = current;
  select.addEventListener("change", () => commit(select.value));
  return select;
}

/** The asset id a file name takes: lower case words joined by hyphens, and a
 *  number on the end when that id is taken, so two models with the same
 *  name do not collide. */
export function assetIdFromName(name: string, taken: Iterable<string> = []): string {
  const used = new Set(taken);
  const stem = name.replace(/\.glb$/i, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const base = stem || "model";
  let id = base;
  for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
  return id;
}

/** Base64 of the bytes, in chunks so a three megabyte file does not blow the
 *  argument list of String.fromCharCode. */
export function base64Of(bytes: Uint8Array): string {
  let text = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    text += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(text);
}

/** Why a file cannot be imported, or null when it can. */
export function modelFileProblem(name: string, bytes: number): string | null {
  if (!/\.glb$/i.test(name)) return `${name}: only .glb models are imported.`;
  if (bytes > editorData.models.maxAssetBytes) {
    return `${name}: ${(bytes / 1e6).toFixed(1)} MB, over the limit of ${(editorData.models.maxAssetBytes / 1e6).toFixed(0)} MB a model.`;
  }
  return null;
}

/** A data: URL model asset from a file's name and bytes. The caller has
 *  already checked the name and size (modelFileProblem). */
export function modelAssetOf(
  name: string, bytes: Uint8Array, taken: Iterable<string> = [],
): ModelAsset {
  const id = assetIdFromName(name, taken);
  return { id, name, data: `data:model/gltf-binary;base64,${base64Of(bytes)}` };
}

/** The assets no placed model uses. "Remove unused models" drops these; a
 *  freshly imported one stays until the last copy is placed or the button is
 *  pressed, which is what the card asks for. */
export function unusedAssetIds(level: Level): string[] {
  const used = new Set((level.models ?? []).map((m) => m.asset));
  return (level.modelAssets ?? []).filter((a) => !used.has(a.id)).map((a) => a.id);
}

/** A new placed model sitting on the surface under the cursor: the model's
 *  own bounds' bottom at the hit point. Its x and z are the hit point, so a
 *  click on a wall leaves it standing on that wall's foot. */
export function makeModel(
  id: string, asset: string, bounds: THREE.Box3, point: THREE.Vector3, snap = true,
): PlacedModel {
  const bottom = bounds.min.y;
  const pos: Vec3 = [point.x, point.y - bottom, point.z];
  if (snap) pos[0] = snapValue(pos[0], GRID), pos[2] = snapValue(pos[2], GRID);
  return { id, asset, pos, behaviour: "solid" };
}

/** A copy of a model's meshes with their own geometry and materials: the
 *  view disposes a marker's or a ghost's resources when it rebuilds them,
 *  and the cached scene's buffers must outlive that. */
function ownResources(object: THREE.Object3D): THREE.Object3D {
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry = mesh.geometry.clone();
    const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const clone = list.map((m) => m.clone());
    mesh.material = Array.isArray(mesh.material) ? clone : clone[0]!;
    // A marker and a ghost are not lit models: they read from every side.
    for (const m of clone) if ("emissive" in m) (m as THREE.MeshStandardMaterial).emissive.set("#222222");
  });
  return object;
}

/** The model's marker: the model itself, loaded and drawn with its own
 *  geometry and materials copied, because the view disposes a marker's
 *  resources when it rebuilds and the cached scene must survive that. Until
 *  the asset loads the marker is a small see-through box where it will sit. */
export function modelMarker(level: Level, model: PlacedModel): THREE.Group {
  const group = new THREE.Group();
  placedMatrix(model).decompose(group.position, group.quaternion, group.scale);
  const placeholder = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 0.6, 0.6),
    new THREE.MeshStandardMaterial({
      color: "#ffd23a", transparent: true, opacity: 0.35, depthWrite: false,
    }),
  );
  placeholder.position.y = 0.3;
  group.add(placeholder);
  const asset = (level.modelAssets ?? []).find((a) => a.id === model.asset);
  if (!asset) return group;
  void loadModelAsset(asset).then((scene) => {
    group.remove(placeholder);
    placeholder.geometry.dispose();
    (placeholder.material as THREE.Material).dispose();
    const copy = ownResources(modelObject(model, scene));
    // The copy sits at the root's transform already; zero its own so the
    // marker's placement is not applied twice.
    copy.position.set(0, 0, 0);
    copy.quaternion.identity();
    copy.scale.set(1, 1, 1);
    group.add(copy);
  }).catch(() => {
    // The placeholder says where the model is; the Problems list says why
    // it did not load.
  });
  return group;
}

/** The cap on a voxel model's inside voxels, as a Problem's text, or null
 *  when it fits. Computing it loads the asset and counts, so it is asked on
 *  import and when the voxel tick or the scale changes, not every redraw. */
export async function voxelCapProblem(level: Level, model: PlacedModel): Promise<string | null> {
  if (model.behaviour !== "breakable" || !model.voxel) return null;
  const asset = (level.modelAssets ?? []).find((a) => a.id === model.asset);
  if (!asset) return null;
  const scene = await loadModelAsset(asset);
  const object = modelObject(model, scene);
  const fill = modelVoxelVolumes(object, "foam-white", editorData.models.maxVoxels);
  if (!fill.capped) return null;
  return `${model.id}: over ${editorData.models.maxVoxels} voxels inside, so it is built by hit points.`;
}

// The fields below are for the page; keeping them in this file leaves
// main.ts with one line per hook (design/EDITOR-V2.md's hook rule).

export interface ModelFieldsContext {
  change(patch: Record<string, unknown>, text: string): void;
  redraw(): void;
  /** A warning for the Problems list (the voxel cap). */
  warn(text: string | null): void;
}

/** The inspector of one placed model: its asset, position, turn, scale with
 *  a lock-proportions tick, behaviour, collider, hit points, voxel, tint and
 *  hidden. */
export function buildModelFields(
  host: HTMLElement, model: PlacedModel, level: Level, ctx: ModelFieldsContext,
) {
  const asset = (level.modelAssets ?? []).find((a) => a.id === model.asset);
  const assetLabel = document.createElement("label");
  assetLabel.textContent = "asset";
  const assetName = document.createElement("span");
  assetName.className = "hint";
  assetName.textContent = asset?.name ?? model.asset;
  assetLabel.append(assetName);
  host.append(assetLabel);

  const vector = (key: "pos" | "rot" | "scale", title: string, step: string) => {
    const label = document.createElement("label");
    label.textContent = title;
    const row = document.createElement("div");
    row.className = "row3";
    const values: Vec3 = key === "scale" ? (model.scale ?? [1, 1, 1]) : key === "rot" ? (model.rot ?? [0, 0, 0]) : model.pos;
    values.forEach((value, axis) => {
      const input = document.createElement("input");
      input.type = "number";
      input.step = step;
      input.value = String(value);
      input.addEventListener("change", () => {
        const n = Number(input.value);
        if (!Number.isFinite(n)) return;
        const next: Vec3 = [values[0], values[1], values[2]];
        next[axis] = n;
        if (key === "scale") {
          const lock = host.querySelector<HTMLInputElement>("#lockScale")?.checked;
          if (lock) {
            // Lock proportions: the ratio the changed axis took applies to
            // the other two, so the model keeps its shape.
            const from = values[axis] || 1;
            if (from > 0 && n > 0) for (let a = 0; a < 3; a++) next[a] = values[a]! * (n / from);
          }
          next.forEach((v, a) => { if (!(v > 0)) next[a] = 0.01; });
        }
        ctx.change({ [key]: next }, `${key} ${model.id}`);
        ctx.redraw();
        void voxelCapProblem(level, { ...model, [key]: next }).then(ctx.warn);
      });
      row.append(input);
    });
    label.append(row);
    host.append(label);
  };
  vector("pos", "position", "0.5");
  vector("rot", "rotation", "15");
  vector("scale", "scale", "0.1");

  const lockLabel = document.createElement("label");
  lockLabel.className = "tick";
  const lock = document.createElement("input");
  lock.type = "checkbox";
  lock.id = "lockScale";
  lockLabel.append(lock, document.createTextNode("lock proportions"));
  host.append(lockLabel);

  const behaviourLabel = document.createElement("label");
  behaviourLabel.textContent = "behaviour";
  behaviourLabel.append(selectField(MODEL_BEHAVIOURS, model.behaviour, (v) => {
    const patch: Partial<PlacedModel> = { behaviour: v as PlacedModel["behaviour"] };
    if (v === "breakable" && model.hitPoints === undefined && !model.voxel) patch.hitPoints = 10;
      ctx.change(patch as Record<string, unknown>, `behaviour ${model.id}`);
      ctx.redraw();
    },
  ));
  host.append(behaviourLabel);

  if (model.behaviour === "solid") {
    const colliderLabel = document.createElement("label");
    colliderLabel.textContent = "collider";
    colliderLabel.append(selectField(MODEL_COLLIDERS, model.collider ?? "hull", (v) => {
      ctx.change({ collider: v }, `collider ${model.id}`);
      ctx.redraw();
    }));
    host.append(colliderLabel);
  }

  if (model.behaviour === "breakable") {
    const hpLabel = document.createElement("label");
    hpLabel.textContent = "hit points";
    const hp = numberInput(model.hitPoints ?? 10, 1, (n) => {
      ctx.change({ hitPoints: n }, `hit points ${model.id}`);
    });
    hpLabel.append(hp);
    host.append(hpLabel);

    const voxelLabel = document.createElement("label");
    voxelLabel.className = "tick";
    const voxel = document.createElement("input");
    voxel.type = "checkbox";
    voxel.checked = model.voxel === true;
    voxel.addEventListener("change", () => {
      ctx.change({ voxel: voxel.checked }, `voxel ${model.id}`);
      void voxelCapProblem(level, { ...model, voxel: voxel.checked }).then((text) => {
        ctx.warn(text);
        ctx.redraw();
      });
    });
    voxelLabel.append(voxel, document.createTextNode("voxel foam"));
    host.append(voxelLabel);
  }

  const tintLabel = document.createElement("label");
  tintLabel.textContent = "tint";
  const tintRow = document.createElement("div");
  tintRow.className = "ticks";
  const none = document.createElement("button");
  none.type = "button";
  none.textContent = "none";
  none.classList.toggle("on", !model.tint);
  none.addEventListener("click", () => {
    ctx.change({ tint: undefined }, `tint ${model.id}`);
    ctx.redraw();
  });
  tintRow.append(none, colourField(model.tint ?? "#f4ecdc", PALETTE, (c) => {
    ctx.change({ tint: c }, `tint ${model.id}`);
    ctx.redraw();
  }));
  tintLabel.append(tintRow);
  host.append(tintLabel);

  const hiddenLabel = document.createElement("label");
  hiddenLabel.className = "tick";
  const hidden = document.createElement("input");
  hidden.type = "checkbox";
  hidden.checked = model.hidden === true;
  hidden.addEventListener("change", () => {
    ctx.change({ hidden: hidden.checked }, `hidden ${model.id}`);
  });
  hiddenLabel.append(hidden, document.createTextNode("starts hidden"));
  host.append(hiddenLabel);
}

/** The ghost of the model a click would place: a see-through copy that comes
 *  down on the surface under the cursor (its bounds' bottom at the point).
 *  Until the asset loads it is a small box at the point. */
export function modelGhost(level: Level, assetId: string, point: THREE.Vector3): THREE.Group {
  const group = new THREE.Group();
  // A small see-through box at the click until the model's own copy is ready,
  // so a first placement still shows where it will land.
  const placeholder = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 0.4, 0.4),
    new THREE.MeshStandardMaterial({ color: "#ffd23a", transparent: true, opacity: 0.4, depthWrite: false }),
  );
  placeholder.position.copy(point);
  group.add(placeholder);
  const asset = (level.modelAssets ?? []).find((a) => a.id === assetId);
  if (!asset) return group;
  void loadModelAsset(asset).then((scene) => {
    const entry = makeModel("ghost", assetId, modelBounds(scene), point);
    // The placed copy carries the click point in its own position, so the
    // group itself stays at the origin (the view resets it every move).
    const copy = ownResources(modelObject(entry, scene));
    group.clear();
    group.add(copy);
  }).catch(() => {});
  return group;
}

/** The placed model for a click, once its asset has loaded: undefined when
 *  the asset is not in the level (the validator refuses that, so the page
 *  only sees it for a file it refused). */
export async function modelAt(
  level: Level, id: string, assetId: string, point: THREE.Vector3,
): Promise<PlacedModel | undefined> {
  const asset = (level.modelAssets ?? []).find((a) => a.id === assetId);
  if (!asset) return undefined;
  const scene = await loadModelAsset(asset);
  return makeModel(id, assetId, modelBounds(scene), point);
}

/** The level fields that drop every asset no placed model uses, or null when
 *  there is nothing to drop. */
export function removeUnusedAssets(level: Level): { modelAssets: ModelAsset[] } | null {
  const unused = new Set(unusedAssetIds(level));
  if (!unused.size) return null;
  return { modelAssets: (level.modelAssets ?? []).filter((a) => !unused.has(a.id)) };
}
