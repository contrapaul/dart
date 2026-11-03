import * as THREE from "three";
import type RAPIER from "@dimforge/rapier3d-compat";
import type { Rapier } from "../physics/world";
import type { NavBounds } from "../ai/nav-grid";
import { VoxelVolume } from "../voxel/chunk";
import { VolumeMesh } from "../voxel/volume-mesh";
import type { Mesher } from "../voxel/pieces";
import { material, materialId } from "../voxel/materials";
import type { Door, DoorState, Level, ShellBox } from "./format";

// Turns a validated level into meshes, colliders and voxels. Shell boxes are
// fixed colliders like src/main.ts's addBox. Every piece volume goes into one
// VoxelVolume (PLAN.md 7.3: voxels are props and cover only, the shell is
// never destructible), with an indestructible row under a floor anchor so a
// piece that is cut loose still has something holding it down.
//
// The builder is the only level module that touches Three.js or Rapier, so
// the validator can stay plain data.

const VOXEL = 0.1;
const GREYBOX = 0x6f6788;

/** The voxel grid must start on a voxel boundary, or carving is ragged. */
function snap(v: number) {
  return Math.round(v / VOXEL) * VOXEL;
}

function colourOf(name: string) {
  return material(materialId(name))?.color ?? GREYBOX;
}

function boxMesh(w: number, h: number, d: number, color: number) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, roughness: 0.9 }),
  );
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
}

export interface DoorHandle {
  readonly id: string;
  readonly state: DoorState;
  setState(state: DoorState): void;
}

export interface BuiltLevel {
  /** Shell boxes and doors. Pieces are drawn by the voxel mesh. */
  readonly group: THREE.Group;
  readonly voxels: VoxelVolume;
  readonly voxelMesh: VolumeMesh;
  readonly doors: Map<string, DoorHandle>;
  /** The rectangle the nav grid should cover. */
  readonly navBounds: NavBounds;
}

/** Adds a box to the scene with a matching fixed collider. */
function addShell(
  group: THREE.Group, rapier: Rapier, world: RAPIER.World,
  pos: [number, number, number], size: [number, number, number], color: number,
  rot?: THREE.Quaternion,
) {
  const mesh = boxMesh(size[0], size[1], size[2], color);
  mesh.position.set(pos[0], pos[1], pos[2]);
  if (rot) mesh.quaternion.copy(rot);
  group.add(mesh);
  const q = mesh.quaternion;
  world.createCollider(
    rapier.ColliderDesc.cuboid(size[0] / 2, size[1] / 2, size[2] / 2)
      .setTranslation(pos[0], pos[1], pos[2])
      .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }),
  );
  return mesh;
}

/** A ramp's walkable face goes from the box's low edge to its high edge,
 *  rising `rise` metres along the box's local +z. Drawn and collided as one
 *  slab turned about X, which is exactly the face the player walks up. */
function addRamp(
  group: THREE.Group, rapier: Rapier, world: RAPIER.World, box: ShellBox,
) {
  const [x, y, z] = box.pos;
  const [w, h, d] = box.size;
  const yaw = THREE.MathUtils.degToRad(box.rotY ?? 0);
  const rise = box.rise ?? 0;
  const theta = Math.atan2(rise, d);
  // The walkable face starts at the box's low edge and ends `rise` above it.
  const length = Math.hypot(d, rise);
  const foot = y - h / 2;
  const rot = new THREE.Quaternion().setFromEuler(new THREE.Euler(-theta, yaw, 0, "YXZ"));
  // A slab of thickness h whose top face is that plane: the slab centre is
  // half a thickness below the face's midpoint along its own normal.
  const normal = new THREE.Vector3(0, Math.cos(theta), -Math.sin(theta)).applyQuaternion(
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw),
  );
  const mid = new THREE.Vector3(x, foot + rise / 2, z);
  mid.addScaledVector(normal, -h / 2);
  const mesh = boxMesh(w, h, length, colourOf(box.material));
  mesh.position.copy(mid);
  mesh.quaternion.copy(rot);
  group.add(mesh);
  const q = mesh.quaternion;
  world.createCollider(
    rapier.ColliderDesc.cuboid(w / 2, h / 2, length / 2)
      .setTranslation(mesh.position.x, mesh.position.y, mesh.position.z)
      .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }),
  );
}

/** Paints a piece's world-space volumes into the shared voxel volume. */
function fillPieces(level: Level, voxels: VoxelVolume, origin: THREE.Vector3) {
  const pieces = level.pieces ?? [];
  for (const piece of pieces) {
    let bottom = Infinity;
    for (const v of piece.volumes) bottom = Math.min(bottom, v.pos[1] - v.size[1] / 2);
    for (const v of piece.volumes) {
      const x0 = Math.round((v.pos[0] - v.size[0] / 2 - origin.x) / VOXEL);
      const x1 = Math.round((v.pos[0] + v.size[0] / 2 - origin.x) / VOXEL) - 1;
      const y0 = Math.round((v.pos[1] - v.size[1] / 2 - origin.y) / VOXEL);
      const y1 = Math.round((v.pos[1] + v.size[1] / 2 - origin.y) / VOXEL) - 1;
      const z0 = Math.round((v.pos[2] - v.size[2] / 2 - origin.z) / VOXEL);
      const z1 = Math.round((v.pos[2] + v.size[2] / 2 - origin.z) / VOXEL) - 1;
      voxels.fillBox(x0, y0, z0, x1, y1, z1, materialId(v.material));
    }
    if (piece.anchor === "floor") {
      // The lowest row is bedrock: it is the anchor the rest hangs from.
      for (const v of piece.volumes) {
        if (Math.abs(v.pos[1] - v.size[1] / 2 - bottom) > 1e-6) continue;
        const x0 = Math.round((v.pos[0] - v.size[0] / 2 - origin.x) / VOXEL);
        const x1 = Math.round((v.pos[0] + v.size[0] / 2 - origin.x) / VOXEL) - 1;
        const y = Math.round((bottom - origin.y) / VOXEL);
        const z0 = Math.round((v.pos[2] - v.size[2] / 2 - origin.z) / VOXEL);
        const z1 = Math.round((v.pos[2] + v.size[2] / 2 - origin.z) / VOXEL) - 1;
        voxels.fillBox(x0, y, z0, x1, y, z1, materialId("bedrock"));
      }
    }
  }
}

/** Bounds of everything the player can stand in: the shell, inset past its
 *  walls. The nav grid covers the whole level, corridors included. */
function navBoundsOf(level: Level): NavBounds {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const b of level.shell) {
    minX = Math.min(minX, b.pos[0] - b.size[0] / 2);
    maxX = Math.max(maxX, b.pos[0] + b.size[0] / 2);
    minZ = Math.min(minZ, b.pos[2] - b.size[2] / 2);
    maxZ = Math.max(maxZ, b.pos[2] + b.size[2] / 2);
  }
  // The walls are what make a cell unwalkable, so the bounds only need to
  // start just inside the outermost shell box.
  const inset = 0.5;
  return { minX: minX + inset, maxX: maxX - inset, minZ: minZ + inset, maxZ: maxZ - inset };
}

export function buildLevel(
  level: Level,
  rapier: Rapier,
  world: RAPIER.World,
  mesher: Mesher,
  scene?: THREE.Scene,
): BuiltLevel {
  const group = new THREE.Group();

  for (const box of level.shell) {
    if (box.shape === "ramp") addRamp(group, rapier, world, box);
    else addShell(group, rapier, world, box.pos, box.size, colourOf(box.material));
  }

  // One voxel volume for every piece, snapped to a shared grid origin.
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  for (const piece of level.pieces ?? []) {
    for (const v of piece.volumes) {
      minX = Math.min(minX, v.pos[0] - v.size[0] / 2);
      minY = Math.min(minY, v.pos[1] - v.size[1] / 2);
      minZ = Math.min(minZ, v.pos[2] - v.size[2] / 2);
    }
  }
  const hasPieces = Number.isFinite(minX);
  const origin = hasPieces
    ? new THREE.Vector3(snap(minX), snap(minY), snap(minZ))
    : new THREE.Vector3(0, 0, 0);
  const voxels = new VoxelVolume(VOXEL);
  fillPieces(level, voxels, origin);
  const voxelMesh = new VolumeMesh(voxels, mesher, rapier, world, origin);
  voxelMesh.update();
  group.add(voxelMesh.group);

  // Doors: a fixed box that hides and drops its collider when it opens.
  const doors = new Map<string, DoorHandle>();
  for (const door of level.arenas?.flatMap((a) => a.doors) ?? []) {
    const handle = makeDoor(door, group, rapier, world);
    doors.set(door.id, handle);
  }

  if (scene) scene.add(group);
  return { group, voxels, voxelMesh, doors, navBounds: navBoundsOf(level) };
}

function makeDoor(
  door: Door, group: THREE.Group, rapier: Rapier, world: RAPIER.World,
): DoorHandle {
  const mesh = boxMesh(door.size[0], door.size[1], door.size[2], 0xffd23f);
  mesh.position.set(door.pos[0], door.pos[1], door.pos[2]);
  group.add(mesh);
  const collider = world.createCollider(
    rapier.ColliderDesc.cuboid(door.size[0] / 2, door.size[1] / 2, door.size[2] / 2)
      .setTranslation(door.pos[0], door.pos[1], door.pos[2]),
  );
  let state = door.state;
  const apply = () => {
    const open = state === "open";
    mesh.visible = !open;
    collider.setEnabled(!open);
  };
  apply();
  return {
    id: door.id,
    get state() {
      return state;
    },
    setState(next: DoorState) {
      state = next;
      apply();
    },
  };
}
