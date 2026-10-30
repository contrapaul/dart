import * as THREE from "three";
import type RAPIER from "@dimforge/rapier3d-compat";
import type { Rapier } from "../physics/world";
import { CHUNK_SIZE, chunkCoords, type VoxelVolume } from "./chunk";
import { voxelFoamMaterial } from "../render/foam-material";
import { buildPadded, type MeshData } from "./mesher";
import type { Mesher } from "./pieces";

// Draws a VoxelVolume and gives it collision: one mesh and one trimesh
// collider per chunk, rebuilt in workers when chunks change.

const material = voxelFoamMaterial();

interface ChunkView {
  mesh: THREE.Mesh | null;
  collider: RAPIER.Collider | null;
  /** Bumped on every edit; results for older versions are dropped. */
  version: number;
}

export class VolumeMesh {
  readonly group = new THREE.Group();
  readonly body: RAPIER.RigidBody;
  private views = new Map<number, ChunkView>();
  /** True after dispose(); remesh results that arrive after that are ignored. */
  private dead = false;
  /** Remesh jobs sent but not yet back. Decrement when they resolve,
   *  whether or not the result is stale. */
  private pendingJobs = 0;

  /** True while the volume still has remesh work outstanding. */
  get busy() {
    return this.volume.dirtyCount > 0 || this.pendingJobs > 0;
  }

  constructor(
    readonly volume: VoxelVolume,
    private pool: Mesher,
    private rapier: Rapier,
    private world: RAPIER.World,
    origin: THREE.Vector3,
    body?: RAPIER.RigidBody,
    /** Surface nets instead of greedy blocks (Foamers, ENG-09). */
    private smooth = false,
  ) {
    this.group.position.copy(origin);
    if (body) {
      // A body of its own (kinematic Foamers): the colliders are built in
      // its frame, so it can move without remeshing.
      this.body = body;
      return;
    }
    this.body = world.createRigidBody(
      rapier.RigidBodyDesc.fixed().setTranslation(origin.x, origin.y, origin.z),
    );
  }

  /** World position to voxel coordinates (in place). The volume does not rotate. */
  worldToVoxel(v: THREE.Vector3) {
    return v.sub(this.group.position).divideScalar(this.volume.voxelSize);
  }

  /** Voxel coordinates to world position (in place). */
  voxelToWorld(v: THREE.Vector3) {
    return v.multiplyScalar(this.volume.voxelSize).add(this.group.position);
  }

  owns(collider: RAPIER.Collider) {
    return collider.parent()?.handle === this.body.handle;
  }

  /** Remove every chunk mesh (and its geometry) and collider.
   *  Remesh results that arrive afterwards are ignored. The body is not removed. */
  dispose() {
    this.dead = true;
    for (const view of this.views.values()) {
      if (view.mesh) {
        view.mesh.geometry.dispose();
        this.group.remove(view.mesh);
      }
      if (view.collider) this.world.removeCollider(view.collider, false);
    }
    this.views.clear();
  }

  /** Call once per frame: sends dirty chunks to the workers. */
  update() {
    if (this.dead) return;
    for (const key of this.volume.takeDirty()) {
      let view = this.views.get(key);
      if (!view) this.views.set(key, (view = { mesh: null, collider: null, version: 0 }));
      const version = ++view.version;
      const chunk = this.volume.chunks.get(key);
      if (!chunk) {
        this.apply(key, view, null);
        continue;
      }
      const [cx, cy, cz] = chunkCoords(key);
      this.pendingJobs++;
      this.pool.mesh(buildPadded(this.volume, cx, cy, cz, chunk), this.smooth).then((data) => {
        this.pendingJobs--;
        if (this.dead || view.version !== version) return;
        this.apply(key, view, data);
      });
    }
  }

  private apply(key: number, view: ChunkView, data: MeshData | null) {
    if (view.mesh) {
      view.mesh.geometry.dispose();
      this.group.remove(view.mesh);
      view.mesh = null;
    }
    if (view.collider) {
      this.world.removeCollider(view.collider, false);
      view.collider = null;
    }
    if (!data || data.indices.length === 0) {
      this.views.delete(key);
      return;
    }

    const size = this.volume.voxelSize;
    const [cx, cy, cz] = chunkCoords(key);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(data.positions, 3));
    geo.setAttribute("normal", new THREE.BufferAttribute(data.normals, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(data.colors, 3));
    geo.setIndex(new THREE.BufferAttribute(data.indices, 1));
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(cx * CHUNK_SIZE * size, cy * CHUNK_SIZE * size, cz * CHUNK_SIZE * size);
    mesh.scale.setScalar(size);
    mesh.castShadow = mesh.receiveShadow = true;
    this.group.add(mesh);
    view.mesh = mesh;

    // Collider vertices in the volume body's space (metres).
    const verts = new Float32Array(data.positions.length);
    for (let i = 0; i < verts.length; i += 3) {
      verts[i] = data.positions[i] * size + mesh.position.x;
      verts[i + 1] = data.positions[i + 1] * size + mesh.position.y;
      verts[i + 2] = data.positions[i + 2] * size + mesh.position.z;
    }
    view.collider = this.world.createCollider(this.rapier.ColliderDesc.trimesh(verts, data.indices), this.body);
  }
}
