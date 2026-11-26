import * as THREE from "three";
import type RAPIER from "@dimforge/rapier3d-compat";
import editorData from "../../data/editor.json";
import explosionData from "../../data/explosion.json";
import tuning from "../../data/destruction.json";
import type { Rapier } from "../physics/world";
import { SIGHT_QUERY_GROUPS } from "../physics/world";
import { materialId } from "../voxel/materials";
import type { VoxelVolume } from "../voxel/chunk";
import type { VolumeMesh } from "../voxel/volume-mesh";
import type { DebrisSystem } from "../voxel/debris";
import { foamMaterialFor } from "./prims";
import {
  assetOf, loadModelAsset, modelColliders, modelObject, modelTriangles,
} from "./models";
import type { BlastProfileName } from "./breakables";
import type { Level, PieceVolume, PlacedModel, Vec3 } from "./format";

// ED-35: a model that breaks as voxel foam. Its inside is found by the
// standard parity test: a ray from the voxel centre along +X crosses the
// model's triangles an odd number of times when the centre is inside. The
// inside voxels become piece volumes of at most 3.2 m a side, the size a
// voxel piece may be (design/EDITOR.md section 7), so the model carves like
// a foam wall.
//
// Pure data: no Rapier and no page, so the parity test is tested headless.

/** design/EDITOR.md section 7: no voxel piece volume is longer than this. */
export const MAX_MODEL_VOLUME = 3.2;
export const MODEL_VOXEL = 0.1;

/** Whether a +X ray from `p` crosses one triangle of the mesh. Moller and
 *  Trumbore with the direction fixed at +X, which saves the cross products
 *  of the general form. */
function crossesX(
  vertices: Float32Array, a: number, b: number, c: number, px: number, py: number, pz: number,
): boolean {
  const e1x = vertices[b]! - vertices[a]!, e1y = vertices[b + 1]! - vertices[a + 1]!, e1z = vertices[b + 2]! - vertices[a + 2]!;
  const e2x = vertices[c]! - vertices[a]!, e2y = vertices[c + 1]! - vertices[a + 1]!, e2z = vertices[c + 2]! - vertices[a + 2]!;
  const det = e1z * e2y - e1y * e2z;
  if (Math.abs(det) < 1e-12) return false;
  const inv = 1 / det;
  const tx = px - vertices[a]!, ty = py - vertices[a + 1]!, tz = pz - vertices[a + 2]!;
  const u = (tz * e2y - ty * e2z) * inv;
  if (u < 0 || u > 1) return false;
  const qx = ty * e1z - tz * e1y;
  const qy = tz * e1x - tx * e1z;
  const qz = tx * e1y - ty * e1x;
  const v = qx * inv;
  if (v < 0 || u + v > 1) return false;
  const t = (e2x * qx + e2y * qy + e2z * qz) * inv;
  return t > 1e-6;
}

/** The parity test for one point: odd crossings is inside. The point is
 *  moved a hair off the axis planes, so a ray that grazes an edge does not
 *  count one triangle of the pair and miss the other. The two offsets
 *  differ so the ray never runs along a face's diagonal either. */
export function insideModel(vertices: Float32Array, indices: Uint32Array, p: THREE.Vector3): boolean {
  const px = p.x, py = p.y + 1e-5, pz = p.z + 2.7e-5;
  let crossings = 0;
  for (let i = 0; i < indices.length; i += 3) {
    if (crossesX(vertices, indices[i]! * 3, indices[i + 1]! * 3, indices[i + 2]! * 3, px, py, pz)) crossings++;
  }
  return (crossings & 1) === 1;
}

export interface ModelVoxels {
  /** Voxel centres inside the model. */
  count: number;
  /** The occupied voxels as boxes, each at most 3.2 m a side. */
  volumes: PieceVolume[];
  /** True when the model was over the cap: nothing was filled and the
   *  caller builds it by hit points instead. */
  capped: boolean;
}

/** The principal colour of a loaded model: the first mesh material's colour,
 *  so the foam a breakable model bursts into looks like the model. */
export function mainColour(object: THREE.Object3D): string {
  let found: string | null = null;
  object.traverse((child) => {
    if (found) return;
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    const colour = (material as THREE.MeshStandardMaterial | undefined)?.color;
    if (colour) found = `#${colour.getHexString()}`;
  });
  return found ?? "#f4ecdc";
}

/** The voxel cells a run spans, as a box centred on them. */
function boxOf(lo: Vec3, cells: Vec3, voxel: number, material: string): PieceVolume {
  const pos: Vec3 = [
    lo[0]! + (cells[0]! * voxel) / 2,
    lo[1]! + (cells[1]! * voxel) / 2,
    lo[2]! + (cells[2]! * voxel) / 2,
  ];
  return { pos, size: [cells[0]! * voxel, cells[1]! * voxel, cells[2]! * voxel], material };
}

/** Fills a loaded, placed model with voxel foam: every 0.1 m centre inside
 *  its world bounds that the parity test finds inside becomes foam, greedy
 *  merged into boxes of at most 3.2 m a side. Over `maxVoxels` inside, the
 *  model is refused (`capped`) and the caller uses hit points. */
export function modelVoxelVolumes(
  object: THREE.Object3D, material: string, maxVoxels = Infinity, voxel = MODEL_VOXEL,
): ModelVoxels {
  const { vertices, indices } = modelTriangles(object);
  const box = new THREE.Box3().setFromObject(object);
  if (box.isEmpty()) return { count: 0, volumes: [], capped: false };
  const lo: [number, number, number] = [0, 0, 0];
  const dim: [number, number, number] = [0, 0, 0];
  for (let a = 0; a < 3; a++) {
    // A voxel centre is at (k + 0.5) * voxel: the k range whose centre lies
    // inside the model's own bounds.
    lo[a] = Math.ceil((box.min.getComponent(a) - voxel / 2) / voxel - 1e-9);
    const hi = Math.floor((box.max.getComponent(a) - voxel / 2) / voxel + 1e-9);
    dim[a] = Math.max(0, hi - lo[a] + 1);
  }
  if (!dim[0] || !dim[1] || !dim[2]) return { count: 0, volumes: [], capped: false };

  const inside = new Set<number>();
  const at = (x: number, y: number, z: number) => (z * dim[1] + y) * dim[0] + x;
  const centre = new THREE.Vector3();
  for (let z = 0; z < dim[2]; z++) {
    for (let y = 0; y < dim[1]; y++) {
      for (let x = 0; x < dim[0]; x++) {
        centre.set(
          (lo[0] + x + 0.5) * voxel,
          (lo[1] + y + 0.5) * voxel,
          (lo[2] + z + 0.5) * voxel,
        );
        if (!insideModel(vertices, indices, centre)) continue;
        inside.add(at(x, y, z));
        if (inside.size > maxVoxels) return { count: inside.size, volumes: [], capped: true };
      }
    }
  }

  // Greedy merge: grow a run along x, then z, then y, never past 32 voxels
  // on an axis (3.2 m at 0.1 m) and never into a voxel already used.
  const used = new Set<number>();
  const volumes: PieceVolume[] = [];
  const limit = Math.max(1, Math.round(MAX_MODEL_VOLUME / voxel));
  for (let z = 0; z < dim[2]; z++) {
    for (let y = 0; y < dim[1]; y++) {
      for (let x = 0; x < dim[0]; x++) {
        const start = at(x, y, z);
        if (!inside.has(start) || used.has(start)) continue;
        let sx = 1, sy = 1, sz = 1;
        const free = (ax: number, ay: number, az: number) => {
          const cell = at(ax, ay, az);
          return inside.has(cell) && !used.has(cell);
        };
        while (sx < limit && x + sx < dim[0] && free(x + sx, y, z)) sx++;
        while (sz < limit && z + sz < dim[2] && (() => {
          for (let i = 0; i < sx; i++) if (!free(x + i, y, z + sz)) return false;
          return true;
        })()) sz++;
        while (sy < limit && y + sy < dim[1] && (() => {
          for (let k = 0; k < sz; k++) for (let i = 0; i < sx; i++) if (!free(x + i, y + sy, z + k)) return false;
          return true;
        })()) sy++;
        for (let k = 0; k < sz; k++) for (let j = 0; j < sy; j++) for (let i = 0; i < sx; i++) {
          used.add(at(x + i, y + j, z + k));
        }
        const low: Vec3 = [
          (lo[0] + x) * voxel,
          (lo[1] + y) * voxel,
          (lo[2] + z) * voxel,
        ];
        volumes.push(boxOf(low, [sx, sy, sz], voxel, material));
      }
    }
  }
  return { count: inside.size, volumes, capped: false };
}

/** One placed model that breaks by hit points, and what is left of it. */
export interface ModelBreakable {
  readonly model: PlacedModel;
  readonly centre: THREE.Vector3;
  readonly radius: number;
  hp: number;
  readonly maxHp: number;
  alive: boolean;
}

interface LiveModel extends ModelBreakable {
  object: THREE.Group;
  colliders: RAPIER.Collider[];
  shown: boolean;
}

const _hit = new THREE.Vector3();
const _box = new THREE.Box3();

/** ED-35: the breakable models, the way ED-06's Breakables are the breakable
 *  prims. The hit point kind is a mesh and colliders of its own; at zero it
 *  is removed and bursts into foam chunks in its tint or its main colour.
 *  The voxel kind is filled into the level's voxel volume instead and carves
 *  like a foam wall. A model over `models.maxVoxels` is built as hit points
 *  rather than as millions of voxels. */
export class ModelBreakables {
  /** A handle for a hidden breakable model, keyed by model id, put in the
   *  same map the drawn models use so a trigger's show and hide finds it. */
  readonly handles: Map<string, { setShown(shown: boolean): void }>;
  /** The level's chunk burst, set by the page once the debris system is
   *  there (buildLevel runs before it). */
  debris: DebrisSystem | null = null;
  onBreak: (b: ModelBreakable, at: THREE.Vector3) => void = () => {};
  onDamage: (b: ModelBreakable, amount: number, at: THREE.Vector3) => void = () => {};
  /** Resolves once every breakable model is in the level. */
  readonly ready: Promise<void>;
  private readonly live: LiveModel[] = [];
  private readonly byCollider = new Map<number, LiveModel>();
  private readonly ray: RAPIER.Ray;

  constructor(
    level: Level,
    rapier: Rapier,
    private world: RAPIER.World,
    group: THREE.Group,
    voxels: VoxelVolume,
    voxelMesh: VolumeMesh,
    origin: THREE.Vector3,
    handles: Map<string, { setShown(shown: boolean): void }>,
  ) {
    this.handles = handles;
    this.ray = new rapier.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -1 });
    const jobs: Promise<void>[] = [];
    for (const model of level.models ?? []) {
      if (model.behaviour !== "breakable") continue;
      const asset = assetOf(level, model.asset);
      if (!asset) continue;
      jobs.push(loadModelAsset(asset).then((scene) => {
        const object = modelObject(model, scene);
        const colour = model.tint ?? mainColour(object);
        if (model.voxel && !model.hidden) {
          const fill = modelVoxelVolumes(object, foamMaterialFor(colour), editorData.models.maxVoxels);
          if (!fill.capped) {
            for (const volume of fill.volumes) {
              const lo: [number, number, number] = [0, 0, 0];
              const hi: [number, number, number] = [0, 0, 0];
              for (let a = 0; a < 3; a++) {
                const centre = volume.pos[a]! - origin.getComponent(a);
                lo[a] = Math.round((centre - volume.size[a]! / 2) / MODEL_VOXEL);
                hi[a] = Math.round((centre + volume.size[a]! / 2) / MODEL_VOXEL) - 1;
              }
              voxels.fillBox(lo[0], lo[1], lo[2], hi[0], hi[1], hi[2], materialId(volume.material));
            }
            voxelMesh.update();
            return;
          }
          // Over the cap: the same model is a hit point breakable instead,
          // which is what the editor's Problems warning promised.
        }
        // A hit point breakable, a hidden voxel one included: it must be
        // drawn to be shown later, so it is built like the hit point kind.
        object.visible = !model.hidden;
        group.add(object);
        object.updateMatrixWorld(true);
        _box.setFromObject(object);
        const colliders = modelColliders(rapier, object, { ...model, behaviour: "solid" })
          .map((d) => world.createCollider(d));
        const hp = model.hitPoints ?? tuning.breakables.defaultHitPoints;
        const size = _box.getSize(new THREE.Vector3());
        const state: LiveModel = {
          model,
          centre: _box.getCenter(new THREE.Vector3()),
          radius: size.length() / 2,
          hp,
          maxHp: hp,
          alive: true,
          object,
          colliders,
          shown: true,
        };
        if (model.hidden) {
          this.setShown(state, false);
          this.handles.set(model.id, { setShown: (shown) => this.setShown(state, shown) });
        }
        this.live.push(state);
        for (const c of colliders) this.byCollider.set(c.handle, state);
      }).catch((e: unknown) => {
        console.warn((e as Error)?.message ?? e);
      }));
    }
    this.ready = Promise.all(jobs).then(() => undefined);
  }

  /** Hit points left, or undefined for an id that is not breakable here. */
  hpOf(id: string): number | undefined {
    return this.live.find((b) => b.model.id === id)?.hp;
  }

  get list(): readonly ModelBreakable[] { return this.live; }

  /** A dart's hit, for the damage that dart deals a Foamer. */
  dartHit(
    hit: { collider: RAPIER.Collider; point: THREE.Vector3; direction: THREE.Vector3 },
    amount: number,
  ): void {
    const b = this.byCollider.get(hit.collider.handle);
    if (!b || !b.alive) return;
    _hit.copy(hit.point).addScaledVector(hit.direction, -0.02);
    this.damage(b, amount, _hit);
  }

  /** A blast, in the profile's own falloff, measured to the model's middle:
   *  a little generous for a long model, never a miss. */
  blast(point: THREE.Vector3, profile: BlastProfileName = "dart"): void {
    const T = explosionData.profiles[profile];
    for (const b of this.live) {
      if (!b.alive || !b.shown) continue;
      const d = Math.max(0, point.distanceTo(b.centre) - b.radius);
      if (d > T.rangeMetres) continue;
      const amount = T.damageCentre * (1 - d / T.rangeMetres);
      if (amount > 0) this.damage(b, amount, point);
    }
  }

  /** A swing: the first breakable model the line from the eye meets within
   *  reach takes the swing's damage. */
  swing(
    eye: THREE.Vector3, forward: THREE.Vector3, reach: number, damage: number,
    exclude?: RAPIER.Collider,
  ): void {
    this.ray.origin = { x: eye.x, y: eye.y, z: eye.z };
    this.ray.dir = { x: forward.x, y: forward.y, z: forward.z };
    const hit = this.world.castRay(this.ray, reach, true, undefined, SIGHT_QUERY_GROUPS, exclude);
    if (!hit) return;
    const b = this.byCollider.get(hit.collider.handle);
    if (!b || !b.alive) return;
    _hit.copy(eye).addScaledVector(forward, hit.timeOfImpact);
    this.damage(b, damage, _hit);
  }

  /** A restart puts every breakable model back, hidden ones hidden again. */
  reset(): void {
    for (const b of this.live) {
      b.hp = b.maxHp;
      b.alive = true;
      this.setShown(b, !b.model.hidden);
    }
  }

  private damage(b: LiveModel, amount: number, at: THREE.Vector3): void {
    if (!b.alive) return;
    b.hp -= amount;
    if (b.hp > 0) {
      this.onDamage(b, amount, at);
      return;
    }
    b.hp = 0;
    b.alive = false;
    this.setShown(b, false);
    _box.setFromObject(b.object);
    const size = _box.getSize(new THREE.Vector3());
    const count = THREE.MathUtils.clamp(
      Math.round(size.x * size.y * size.z * tuning.breakables.chunksPerCubicMetre),
      tuning.breakables.minChunks, tuning.breakables.maxChunks,
    );
    const colour = b.model.tint ?? mainColour(b.object);
    this.debris?.burst(b.centre, count, tuning.breakables.chunkSize, materialId(foamMaterialFor(colour)));
    this.onBreak(b, b.centre);
  }

  private setShown(b: LiveModel, shown: boolean): void {
    b.shown = shown;
    b.object.visible = shown;
    for (const c of b.colliders) c.setEnabled(shown);
  }
}
