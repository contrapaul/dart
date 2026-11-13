import * as THREE from "three";
import type RAPIER from "@dimforge/rapier3d-compat";
import type { Rapier } from "../physics/world";
import type { NavBounds } from "../ai/nav-grid";
import { VoxelVolume } from "../voxel/chunk";
import { VolumeMesh } from "../voxel/volume-mesh";
import type { Mesher } from "../voxel/pieces";
import { material, materialId } from "../voxel/materials";
import { Crates, type CrateBox } from "../voxel/crates";
import { buildButton, type ButtonHandle } from "./buttons";
import { buildPress, type PressHandle } from "./presses";
import { buildPrims, foamMaterialFor, type PrimHandle } from "./prims";
import { isVoxelBreakable } from "./validate";
import { Breakables } from "./breakables";
import type {
  Anchor, Door, DoorState, Level, LevelDoor, Piece, PieceVolume, Prim, ShellBox, Vec3,
} from "./format";

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
/** ED-06 (design/EDITOR.md section 7): no voxel piece volume may be longer
 *  than this along an axis, so a big breakable becomes several. */
const MAX_VOLUME = 3.2;

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
  /** ENV-01: the level's crates, counted once the volume is filled. */
  readonly crates: Crates;
  /** ENV-02: the level's buttons, in file order. The page wires their
   *  action; a level with none gives an empty list. */
  readonly buttons: ButtonHandle[];
  /** ENV-04: the level's crushing toy presses, in file order. The page
   *  owns their timer and the crush (src/arena/extras.ts); a level with
   *  none gives an empty list. */
  readonly presses: PressHandle[];
  /** ED-01: a handle for every prim that starts hidden, keyed by prim id,
   *  so a trigger can show it. */
  readonly prims: Map<string, PrimHandle>;
  /** ED-06: the prims that break by hit points (every breakable prim that
   *  is not voxel foam, a hidden one included). The page wires the darts,
   *  blasts and swings to it, gives it the debris system, and resets it. */
  readonly breakables: Breakables;
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

/** The voxel coordinates of a volume's bounds: inclusive index low and high
 *  per axis, in the shared volume's grid. */
function voxelBounds(v: PieceVolume, origin: THREE.Vector3): [[number, number, number], [number, number, number]] {
  const lo: [number, number, number] = [0, 0, 0];
  const hi: [number, number, number] = [0, 0, 0];
  for (let a = 0; a < 3; a++) {
    const c = origin.getComponent(a);
    lo[a] = Math.round((v.pos[a] - v.size[a] / 2 - c) / VOXEL);
    hi[a] = Math.round((v.pos[a] + v.size[a] / 2 - c) / VOXEL) - 1;
  }
  return [lo, hi];
}

/** Paint one layer of a volume (all voxels with `layer` on `axis`) bedrock. */
function bedLayer(
  voxels: VoxelVolume, v: PieceVolume, origin: THREE.Vector3,
  axis: 0 | 1 | 2, layer: number,
) {
  const [lo, hi] = voxelBounds(v, origin);
  const a: [number, number, number] = [lo[0], lo[1], lo[2]];
  const b: [number, number, number] = [hi[0], hi[1], hi[2]];
  a[axis] = layer;
  b[axis] = layer;
  voxels.fillBox(a[0], a[1], a[2], b[0], b[1], b[2], materialId("bedrock"));
}

/** ED-06: the volumes a voxel breakable prim becomes: its size box cut into
 *  blocks of at most 3.2 m per axis, centred on the prim. A turn of 90 or
 *  270 degrees about an axis swaps the two sizes it turns through, because
 *  the blocks are axis aligned. */
export function voxelPrimVolumes(prim: Prim): PieceVolume[] {
  const size: Vec3 = [prim.size[0], prim.size[1], prim.size[2]];
  // A turn about X swaps y and z, about Y swaps x and z, about Z x and y.
  const pairs: [number, number][] = [[1, 2], [0, 2], [0, 1]];
  const rot = prim.rot ?? [0, 0, 0];
  for (let axis = 0; axis < 3; axis++) {
    if (Math.abs(Math.round(rot[axis] / 90)) % 2 === 0) continue;
    const [a, b] = pairs[axis];
    const t = size[a];
    size[a] = size[b];
    size[b] = t;
  }
  const material = foamMaterialFor(prim.colour);
  const counts = size.map((s) => Math.max(1, Math.ceil(s / MAX_VOLUME - 1e-9)));
  const step: Vec3 = [size[0] / counts[0], size[1] / counts[1], size[2] / counts[2]];
  const out: PieceVolume[] = [];
  for (let i = 0; i < counts[0]; i++) {
    for (let j = 0; j < counts[1]; j++) {
      for (let k = 0; k < counts[2]; k++) {
        out.push({
          pos: [
            prim.pos[0] - size[0] / 2 + step[0] * (i + 0.5),
            prim.pos[1] - size[1] / 2 + step[1] * (j + 0.5),
            prim.pos[2] - size[2] / 2 + step[2] * (k + 0.5),
          ],
          size: [step[0], step[1], step[2]],
          material,
        });
      }
    }
  }
  return out;
}

/** ED-06: a voxel breakable's anchor: "floor" when its bottom touches a
 *  solid prim or a shell box top within 0.05 m, else "none". */
function breakableAnchor(level: Level, prim: Prim): Anchor {
  const bottom = prim.pos[1] - prim.size[1] / 2;
  const restsOn = (b: { pos: Vec3; size: Vec3 }) =>
    Math.abs(bottom - (b.pos[1] + b.size[1] / 2)) <= 0.05 &&
    Math.abs(b.pos[0] - prim.pos[0]) < (b.size[0] + prim.size[0]) / 2 &&
    Math.abs(b.pos[2] - prim.pos[2]) < (b.size[2] + prim.size[2]) / 2;
  for (const box of level.shell) if (restsOn(box)) return "floor";
  for (const other of level.prims ?? []) {
    if (other === prim || other.behaviour !== "solid") continue;
    if (restsOn(other)) return "floor";
  }
  return "none";
}

/** ED-06: the voxel breakable prims as pieces. A hidden one is left out: it
 *  has no voxels yet, so breakables.ts breaks it by hit points instead. */
export function voxelPrimPieces(level: Level): Piece[] {
  const out: Piece[] = [];
  for (const prim of level.prims ?? []) {
    if (!isVoxelBreakable(prim) || prim.hidden) continue;
    out.push({
      id: prim.id,
      kind: "cover",
      volumes: voxelPrimVolumes(prim),
      anchor: breakableAnchor(level, prim),
    });
  }
  return out;
}

/** Paints the pieces' world-space volumes into the shared voxel volume. */
function fillPieces(
  level: Level, pieces: Piece[], voxels: VoxelVolume, origin: THREE.Vector3, crates: CrateBox[],
) {
  for (const piece of pieces) {
    let bottom = Infinity;
    for (const v of piece.volumes) bottom = Math.min(bottom, v.pos[1] - v.size[1] / 2);
    for (const v of piece.volumes) {
      // ENV-01: a tagged volume is part of a crate. Its voxel box is taken
      // here, from the same rounding the fill uses, so the crate's bounds
      // and its filled voxels cannot disagree.
      const tag = v.crate;
      const [lo, hi] = voxelBounds(v, origin);
      voxels.fillBox(lo[0], lo[1], lo[2], hi[0], hi[1], hi[2], materialId(v.material));
      if (tag) crates.push({ id: tag, min: lo, max: hi });
    }
    // The anchor row or layer is bedrock: the indestructible voxels the rest
    // of the piece hangs from, which is what findIslands looks for.
    let top = -Infinity;
    for (const v of piece.volumes) top = Math.max(top, v.pos[1] + v.size[1] / 2);
    if (piece.anchor === "floor" || piece.anchor === "ceiling") {
      // The lowest row for a floor anchor, the highest for a ceiling one.
      const at = piece.anchor === "floor" ? bottom : top;
      const layer = Math.round((at - origin.y) / VOXEL) + (piece.anchor === "floor" ? 0 : -1);
      for (const v of piece.volumes) {
        const edge = piece.anchor === "floor" ? v.pos[1] - v.size[1] / 2 : v.pos[1] + v.size[1] / 2;
        if (Math.abs(edge - at) > 1e-6) continue;
        bedLayer(voxels, v, origin, 1, layer);
      }
    }
    if (piece.anchor === "wall") {
      // Wall anchor: the voxels the wall is built into become bedrock, the
      // indestructible voxels findIslands holds the rest of the piece by. A
      // voxel's cell counts as built in when it meets an axis-aligned shell
      // box on all three axes (a ramp or a turned box is not a grid of
      // voxels, so it is never a wall).
      const bed = materialId("bedrock");
      for (const box of level.shell) {
        if (box.shape === "ramp" || (box.rotY ?? 0) !== 0) continue;
        for (const v of piece.volumes) {
          const [lo, hi] = voxelBounds(v, origin);
          // The cell's own extent on axis `a` is origin + [i, i+1]*VOXEL: it
          // meets the box when its top is past the box's low side and its
          // bottom is short of the box's high side, flush contact included.
          const a: [number, number, number] = [0, 0, 0];
          const b: [number, number, number] = [0, 0, 0];
          let any = true;
          for (let ax = 0; ax < 3; ax++) {
            const c = origin.getComponent(ax);
            const t0 = (box.pos[ax] - box.size[ax] / 2 - c) / VOXEL;
            const t1 = (box.pos[ax] + box.size[ax] / 2 - c) / VOXEL;
            a[ax] = Math.max(lo[ax], Math.ceil(t0 - 1 - 1e-6));
            b[ax] = Math.min(hi[ax], Math.floor(t1 + 1e-6));
            if (a[ax] > b[ax]) any = false;
          }
          if (any) voxels.fillBox(a[0], a[1], a[2], b[0], b[1], b[2], bed);
        }
      }
    }
  }
}

/** Bounds of everything the player can stand in: the shell, inset past its
 *  walls. The nav grid covers the whole level, corridors included. */
function navBoundsOf(level: Level): NavBounds {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  // ED-01: a level may be built from prims alone, so the solid ones count
  // for the bounds as well as the shell.
  const boxes = [
    ...level.shell,
    ...(level.prims ?? []).filter((p) => p.behaviour === "solid" || p.behaviour === "breakable"),
  ];
  for (const b of boxes) {
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

  // ED-01: the editor's prims, merged per colour where they never hide.
  const prims = buildPrims(level, rapier, world, group);
  // ED-06: the ones that break by hit points get a mesh and colliders of
  // their own, and a handle if they start hidden.
  const breakables = new Breakables(level, rapier, world, group);
  for (const [id, handle] of breakables.handles) prims.set(id, handle);

  // ED-06: the voxel breakable prims join the pieces, so one fill and one
  // volume serve both.
  const pieces = [...(level.pieces ?? []), ...voxelPrimPieces(level)];

  // One voxel volume for every piece, snapped to a shared grid origin.
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  for (const piece of pieces) {
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
  const crateBoxes: CrateBox[] = [];
  fillPieces(level, pieces, voxels, origin, crateBoxes);
  const voxelMesh = new VolumeMesh(voxels, mesher, rapier, world, origin);
  voxelMesh.update();
  group.add(voxelMesh.group);

  // Doors: a fixed box that hides and drops its collider when it opens.
  // ED-01: the level's own doors (outside any arena) are built the same
  // way, with lock "none" open and every other lock shut until something
  // opens it.
  const doors = new Map<string, DoorHandle>();
  for (const door of level.arenas?.flatMap((a) => a.doors) ?? []) {
    const handle = makeDoor(door, group, rapier, world);
    doors.set(door.id, handle);
  }
  for (const door of level.doors ?? []) {
    const handle = makeLevelDoor(door, group, rapier, world);
    doors.set(door.id, handle);
  }

  // ENV-02: buttons. Their caps are fixed colliders here, so the darts and
  // the melee meet them like any shell box.
  const buttons = (level.buttons ?? []).map(
    (b) => buildButton(b, group, rapier, world),
  );

  // ENV-04: the crushing toy presses. The heads are kinematic bodies: the
  // page's timer moves them, and the collider with them is what keeps
  // nothing standing inside the head while it is down.
  const presses = (level.presses ?? []).map(
    (p) => buildPress(p, group, rapier, world),
  );

  if (scene) scene.add(group);
  return {
    group, voxels, voxelMesh, doors, buttons, presses, prims, breakables,
    crates: new Crates(voxels, crateBoxes),
    navBounds: navBoundsOf(level),
  };
}

/** A door's box, its collider and the state that hides it. Both the
 *  arena's doors and the editor's (ED-01) go through here, so they look
 *  and slide the same. */
function doorOf(
  id: string, size: [number, number, number], pos: [number, number, number],
  colour: number, rotY: number, state: DoorState,
  group: THREE.Group, rapier: Rapier, world: RAPIER.World,
): DoorHandle {
  const mesh = boxMesh(size[0], size[1], size[2], colour);
  mesh.position.set(pos[0], pos[1], pos[2]);
  const turn = THREE.MathUtils.degToRad(rotY);
  mesh.rotation.y = turn;
  group.add(mesh);
  const q = mesh.quaternion;
  const collider = world.createCollider(
    rapier.ColliderDesc.cuboid(size[0] / 2, size[1] / 2, size[2] / 2)
      .setTranslation(pos[0], pos[1], pos[2])
      .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }),
  );
  let current = state;
  const apply = () => {
    const open = current === "open";
    mesh.visible = !open;
    collider.setEnabled(!open);
  };
  apply();
  return {
    id,
    get state() {
      return current;
    },
    setState(next: DoorState) {
      current = next;
      apply();
    },
  };
}

function makeDoor(
  door: Door, group: THREE.Group, rapier: Rapier, world: RAPIER.World,
): DoorHandle {
  return doorOf(door.id, door.size, door.pos, 0xffd23f, 0, door.state, group, rapier, world);
}

/** ED-01: a door the editor placed. `lock: "none"` starts open; a trigger
 *  or key lock starts shut, which is what makes it a blocker. */
function makeLevelDoor(
  door: LevelDoor, group: THREE.Group, rapier: Rapier, world: RAPIER.World,
): DoorHandle {
  const colour = door.colour ? new THREE.Color(door.colour).getHex() : 0xffd23f;
  const state: DoorState = door.lock === "none" ? "open" : "locked";
  return doorOf(door.id, door.size, door.pos, colour, door.rotY ?? 0, state, group, rapier, world);
}
