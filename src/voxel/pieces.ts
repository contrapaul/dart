import * as THREE from "three";
import type RAPIER from "@dimforge/rapier3d-compat";
import type { Rapier } from "../physics/world";
import { CHUNK_SIZE, chunkCoords, VoxelVolume } from "./chunk";
import { EMPTY } from "./materials";
import { voxelFoamMaterial } from "../render/foam-material";
import { buildPadded, type MeshData } from "./mesher";
import { boxCover, findIslands, type Island } from "./islands";
import type { RemovedVoxel } from "./carve";
import type { DebrisSystem } from "./debris";
import tuning from "../../data/destruction.json";

// Falling pieces: islands that a carve cut loose from a voxel volume. Each
// becomes a fixed set of boxes (or one hull) on a rigid body, with its own
// greedy-meshed voxels. A new piece is held still and hidden until the
// source has remeshed, so it does not start inside its old colliders.

const T = tuning.islands;
// Same shared material settings as VolumeMesh's chunks.
const meshMaterial = voxelFoamMaterial();

/** The volume a carve happened in. A VolumeMesh matches this directly. */
export interface PieceSource {
  volume: VoxelVolume;
  voxelToWorld(v: THREE.Vector3): THREE.Vector3;
  /** True while the source still has remesh work outstanding. */
  readonly busy: boolean;
}

/** What FallingPieces needs from a MesherPool; tests pass a fake. */
export interface Mesher {
  mesh(padded: Uint8Array): Promise<MeshData>;
}

interface Piece {
  volume: VoxelVolume;
  body: RAPIER.RigidBody | null;
  group: THREE.Group;
  /** Bounds middle in the body's frame (metres). */
  localCentre: THREE.Vector3;
  /** Transform frozen when the body was removed for the fade. */
  lastT: THREE.Vector3;
  lastQ: THREE.Quaternion;
  /** Body pose before the last step, for render interpolation. */
  prevT: THREE.Vector3;
  prevQ: THREE.Quaternion;
  held: boolean;
  holdTime: number;
  fading: boolean;
  fade: number;
  /** Mesh jobs for this piece not yet come back. */
  meshJobs: number;
  source: PieceSource;
  disposed: boolean;
}

export class FallingPieces {
  /** Add to the scene once. Every piece's meshes live under it. */
  readonly group = new THREE.Group();
  /** Called once per island removed from a source, with a world-space
   *  bounding sphere (main uses it to drop darts stuck there). */
  onBreak: (centre: THREE.Vector3, radius: number) => void = () => {};
  readonly stats = { islands: 0, pieces: 0, toDebris: 0, searchMs: 0 };

  private list: Piece[] = [];
  private mid = new THREE.Vector3();
  private fadeOffset = new THREE.Vector3();
  private qNow = new THREE.Quaternion();

  constructor(
    private rapier: Rapier,
    private world: RAPIER.World,
    private mesher: Mesher,
    private debris: DebrisSystem,
  ) {}

  /** Pieces that exist, including fading ones. */
  get live() {
    return this.list.length;
  }

  /** Call after every carve. Returns how many islands broke off. */
  afterCarve(source: PieceSource, removed: RemovedVoxel[]): number {
    const t0 = performance.now();
    const islands = findIslands(source.volume, removed, T.maxSearchVoxels);
    this.stats.searchMs = performance.now() - t0;
    this.stats.islands += islands.length;
    const size = source.volume.voxelSize;
    for (const island of islands) {
      for (const p of island.voxels) source.volume.set(p.x, p.y, p.z, EMPTY);
      const mid = this.mid.set(
        (island.min[0] + island.max[0]) / 2,
        (island.min[1] + island.max[1]) / 2,
        (island.min[2] + island.max[2]) / 2,
      );
      const centre = source.voxelToWorld(mid.clone());
      const radius =
        0.5 *
        Math.hypot(
          (island.max[0] - island.min[0]) * size,
          (island.max[1] - island.min[1]) * size,
          (island.max[2] - island.min[2]) * size,
        ) +
        size;
      this.onBreak(centre, radius);
      if (island.voxels.length < T.minPieceVoxels) {
        this.debris.spawn(island.voxels, mid, size, (v) => source.voxelToWorld(v));
        this.stats.toDebris++;
        continue;
      }
      this.makePiece(source, island, size);
      this.stats.pieces++;
      const nonFading = this.list.filter((pc) => !pc.fading);
      if (nonFading.length > T.maxPieces) nonFading[0]!.fading = true;
    }
    return islands.length;
  }

  /** Fixed step: hold and release, fading, removal. */
  update(dt: number) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const pc = this.list[i]!;
      if (pc.disposed) continue;
      if (pc.fading) {
        if (pc.body) {
          this.world.removeRigidBody(pc.body);
          pc.body = null;
          pc.lastT.copy(pc.group.position);
          pc.lastQ.copy(pc.group.quaternion);
        }
        pc.fade += dt;
        if (pc.fade >= T.fadeTime) this.dispose(pc, i);
        continue;
      }
      if (pc.held) {
        pc.holdTime += dt;
        if ((pc.meshJobs === 0 && !pc.source.busy) || pc.holdTime >= T.maxHoldTime) {
          pc.held = false;
          pc.body!.setBodyType(this.rapier.RigidBodyType.Dynamic, true);
          pc.group.visible = true;
          this.keepPrev(pc);
        }
        continue;
      }
      if (!pc.body || pc.body.translation().y < -20) this.dispose(pc, i);
      else this.keepPrev(pc);
    }
  }

  /** The body's pose before this step, for render interpolation. */
  private keepPrev(pc: Piece) {
    const t = pc.body!.translation();
    const r = pc.body!.rotation();
    pc.prevT.set(t.x, t.y, t.z);
    pc.prevQ.set(r.x, r.y, r.z, r.w);
  }

  /** Render frame: copy body transforms to the piece meshes, alpha (0 to 1)
   *  of the way from the pose before the last step to the current. */
  syncRender(alpha = 1) {
    for (const pc of this.list) {
      if (pc.disposed) continue;
      if (pc.fading) {
        if (!pc.body) {
          // Shrink around the piece's centre, keeping the last transform.
          const s = Math.max(0, 1 - pc.fade / T.fadeTime);
          pc.group.scale.setScalar(s);
          this.fadeOffset
            .copy(pc.localCentre)
            .multiplyScalar(1 - s)
            .applyQuaternion(pc.lastQ);
          pc.group.position.copy(pc.lastT).add(this.fadeOffset);
          pc.group.quaternion.copy(pc.lastQ);
        }
        continue;
      }
      if (!pc.body || pc.held) continue;
      const t = pc.body.translation();
      const r = pc.body.rotation();
      pc.group.position.set(t.x, t.y, t.z).sub(pc.prevT).multiplyScalar(alpha).add(pc.prevT);
      pc.group.quaternion.copy(pc.prevQ).slerp(this.qNow.set(r.x, r.y, r.z, r.w), alpha);
    }
  }

  private makePiece(source: PieceSource, island: Island, size: number) {
    const volume = new VoxelVolume(size);
    for (const p of island.voxels)
      volume.set(p.x - island.min[0], p.y - island.min[1], p.z - island.min[2], p.material);
    const origin = source.voxelToWorld(
      new THREE.Vector3(island.min[0], island.min[1], island.min[2]),
    );
    const body = this.world.createRigidBody(
      this.rapier.RigidBodyDesc.kinematicPositionBased().setTranslation(origin.x, origin.y, origin.z),
    );
    this.addColliders(island, size, body);
    const piece: Piece = {
      volume,
      body,
      group: new THREE.Group(),
      localCentre: new THREE.Vector3(),
      lastT: new THREE.Vector3(),
      lastQ: new THREE.Quaternion(),
      prevT: origin.clone(),
      prevQ: new THREE.Quaternion(),
      held: true,
      holdTime: 0,
      fading: false,
      fade: 0,
      meshJobs: 0,
      source,
      disposed: false,
    };
    piece.localCentre.set(
      ((island.max[0] - island.min[0]) / 2) * size,
      ((island.max[1] - island.min[1]) / 2) * size,
      ((island.max[2] - island.min[2]) / 2) * size,
    );
    piece.group.position.copy(origin);
    piece.group.visible = false;
    this.buildMeshes(piece);
    this.group.add(piece.group);
    this.list.push(piece);
  }

  private addColliders(island: Island, size: number, body: RAPIER.RigidBody) {
    // Colliders live in the body's frame, whose origin is the island's min
    // corner. Shift the line to that local space, then cover it.
    const local = island.voxels.map((p) => ({
      x: p.x - island.min[0],
      y: p.y - island.min[1],
      z: p.z - island.min[2],
    }));
    const boxes = boxCover(local);
    const inset = T.colliderInset;
    const tune = (d: RAPIER.ColliderDesc) =>
      d.setDensity(T.density).setFriction(T.friction).setRestitution(T.restitution);
    if (boxes.length <= T.maxCollidersPerPiece) {
      for (const b of boxes) {
        const d = this.rapier.ColliderDesc.cuboid(
          ((b.x1 - b.x0 + 1) / 2 - inset) * size,
          ((b.y1 - b.y0 + 1) / 2 - inset) * size,
          ((b.z1 - b.z0 + 1) / 2 - inset) * size,
        ).setTranslation(
          ((b.x0 + b.x1 + 1) / 2) * size,
          ((b.y0 + b.y1 + 1) / 2) * size,
          ((b.z0 + b.z1 + 1) / 2) * size,
        );
        this.world.createCollider(tune(d), body);
      }
      return;
    }
    // More boxes than allowed: one convex hull of all the box corners.
    const pts: number[] = [];
    for (const b of boxes) {
      const x0 = (b.x0 + inset) * size, x1 = (b.x1 + 1 - inset) * size;
      const y0 = (b.y0 + inset) * size, y1 = (b.y1 + 1 - inset) * size;
      const z0 = (b.z0 + inset) * size, z1 = (b.z1 + 1 - inset) * size;
      for (const x of [x0, x1])
        for (const y of [y0, y1]) for (const z of [z0, z1]) pts.push(x, y, z);
    }
    let d = this.rapier.ColliderDesc.convexHull(new Float32Array(pts));
    if (!d) {
      d = this.rapier.ColliderDesc.cuboid(
        ((island.max[0] - island.min[0] + 1) / 2) * size,
        ((island.max[1] - island.min[1] + 1) / 2) * size,
        ((island.max[2] - island.min[2] + 1) / 2) * size,
      ).setTranslation(
        ((island.max[0] - island.min[0]) / 2) * size,
        ((island.max[1] - island.min[1]) / 2) * size,
        ((island.max[2] - island.min[2]) / 2) * size,
      );
    }
    this.world.createCollider(tune(d), body);
  }

  private buildMeshes(piece: Piece) {
    const size = piece.volume.voxelSize;
    for (const [key, chunk] of piece.volume.chunks) {
      const [cx, cy, cz] = chunkCoords(key);
      piece.meshJobs++;
      this.mesher.mesh(buildPadded(piece.volume, cx, cy, cz, chunk)).then((data) => {
        piece.meshJobs--;
        if (piece.disposed || data.indices.length === 0) return;
        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.BufferAttribute(data.positions, 3));
        geo.setAttribute("normal", new THREE.BufferAttribute(data.normals, 3));
        geo.setAttribute("color", new THREE.BufferAttribute(data.colors, 3));
        geo.setIndex(new THREE.BufferAttribute(data.indices, 1));
        const mesh = new THREE.Mesh(geo, meshMaterial);
        mesh.position.set(cx * CHUNK_SIZE * size, cy * CHUNK_SIZE * size, cz * CHUNK_SIZE * size);
        mesh.scale.setScalar(size);
        mesh.castShadow = mesh.receiveShadow = true;
        piece.group.add(mesh);
      });
    }
  }

  private dispose(pc: Piece, i: number) {
    if (pc.disposed) return;
    pc.disposed = true;
    if (pc.body) {
      this.world.removeRigidBody(pc.body);
      pc.body = null;
    }
    for (const child of [...pc.group.children]) {
      (child as THREE.Mesh).geometry?.dispose();
    }
    this.group.remove(pc.group);
    this.list.splice(i, 1);
  }
}
