import * as THREE from "three";
import type { Ambush, Piece } from "./format";
import type { VoxelVolume } from "../voxel/chunk";
import type { VolumeMesh } from "../voxel/volume-mesh";
import type { RemovedVoxel } from "../voxel/carve";
import { carveSphere } from "../voxel/carve";
import { EMPTY } from "../voxel/materials";
import type { FoamerSystem } from "../foamers/foamers";
import { specFor } from "../foamers/foamers";
import { ambushOf } from "../foamers/ambush";
import type { Foamer } from "../foamers/foamer";

// GAME-10m stage 3: the ambush from a growth. A level lists `ambushes`:
// { id, foamer, growth }, where growth names a piece of kind "growth".
// While hidden the Foamer is truly inert: it is never built until it
// wakes (no drawing, no colliders, no brain, no damage to take, and
// nothing in the FoamerSystem's lists, so the wave and level counters
// cannot see it at all). Waking builds it at the growth's centre through
// the ordinary spawn, carves the growth open around it, and starts a
// pounce at the player on the spot (the stage 2 crouch and leap path,
// the cooldown ignored).
//
// The wake tests run in step(): the player's feet inside wakeMetres of
// the growth's box (every step), or the growth holding fewer solid
// voxels than it was counted with when the level was built (the card's
// "the growth loses any voxels", from any distance, walked at the type's
// recheckSeconds cadence). Counting a growth's voxels is a walk of its
// own box only, and it stops once it has woken.
// The burst's own carve goes back out through onCarveReport so the page
// drops the islands and re-bakes the nav grid over it, as it does for a
// dart carve.

export interface AmbushGrowth {
  /** World-space box of the piece's volumes (the wake test and the burst
   *  centre come from this). */
  min: THREE.Vector3;
  max: THREE.Vector3;
  /** Its solid voxel count as of the last look (the wake test compares
   *  against it; countVoxels sets it after the level has filled). */
  voxels: number;
  /** What it held when the level was built (a restart retakes both: the
   *  voxels stay carved, so the new count is the level's own). */
  filled: number;
}

interface HiddenAmbush {
  spec: Ambush;
  growth: AmbushGrowth;
  /** The type's ambush numbers (validator: only types that carry them). */
  wakeMetres: number;
  burstRadiusMetres: number;
  recheckSeconds: number;
  /** Seconds since this growth's voxels were last walked. */
  sinceRecheck: number;
  woken: boolean;
}

/** What a step woke, for the page's sounds. */
export interface AmbushWake {
  id: string;
  /** Where it burst out (world): the burst sound's position. */
  at: THREE.Vector3;
}

export class AmbushSystem {
  /** The woken Foamers this page owns, so a restart can take them out. */
  private woken: Foamer[] = [];
  /** Scratch for the eye point the woken Foamer faces and pounces at. */
  private eye = new THREE.Vector3();

  constructor(
    private readonly hidden: HiddenAmbush[],
    private readonly foamers: FoamerSystem,
    private readonly voxels: VoxelVolume,
    private readonly voxelMesh: VolumeMesh,
    private readonly player: { eye(alpha: number, out: THREE.Vector3): THREE.Vector3 },
  ) {}

  get count(): number {
    return this.hidden.length;
  }
  get ids(): string[] {
    return this.hidden.map((a) => a.spec.id);
  }
  /** True while this ambush has not woken. */
  isHidden(id: string): boolean {
    const a = this.hidden.find((h) => h.spec.id === id);
    return a ? !a.woken : false;
  }

  /** Count every hidden growth's solid voxels: the page calls it once
   *  the level's volumes are filled (buildLevel fills them as it builds). */
  countVoxels(): void {
    for (const a of this.hidden) {
      a.growth.voxels = countBox(this.voxels, this.voxelMesh, a.growth);
      a.growth.filled = a.growth.voxels;
      a.sinceRecheck = 0;
    }
  }

  /** Every hidden Foamer back in its growth and the woken ones taken
   *  out. The page calls it on a restart; its foamers.clear() has
   *  already removed any woken one from the lists, so this is the tidy
   *  half (the pressed list, and the hidden flags for the next try). */
  reset(): void {
    for (const f of this.woken) {
      if (this.foamers.list.includes(f)) this.foamers.suck(f);
    }
    this.woken.length = 0;
    for (const a of this.hidden) a.woken = false;
  }

  /** One fixed step with the player's feet: the two wake tests. The
   *  distance test runs every step; walking the growth's voxels is the
   *  expensive half, so it runs at the type's cadence, except when the
   *  count already sits below the level's (a dart carve, or a hole from
   *  a wake blocked at the Foamer cap: then the loss is proved and the
   *  next step wakes it without a walk). */
  step(dt: number, playerFeet: THREE.Vector3): AmbushWake[] {
    const woke: AmbushWake[] = [];
    for (const a of this.hidden) {
      if (a.woken) continue;
      const near = distanceToBox(playerFeet, a.growth) <= a.wakeMetres;
      const loss = a.growth.voxels < a.growth.filled;
      a.sinceRecheck += dt;
      if (!near && !loss && a.sinceRecheck < a.recheckSeconds) continue;
      a.sinceRecheck = 0;
      const n = countBox(this.voxels, this.voxelMesh, a.growth);
      if (near || loss || n < a.growth.voxels) {
        const w = this.wake(a);
        if (w) woke.push(w);
      } else {
        a.growth.voxels = n;
      }
    }
    return woke;
  }

  /** The page wires this to its carve path (islands, the grid rebake). */
  onCarveReport: (removed: RemovedVoxel[]) => void = () => {};

  /** The burst. Returns null (and stays hidden) while the FoamerSystem
   *  is at its cap: the hole is carved on the attempt, so the next step
   *  takes the lost-voxels path and tries again. */
  private wake(a: HiddenAmbush): AmbushWake | null {
    const c = new THREE.Vector3(
      (a.growth.min.x + a.growth.max.x) / 2,
      (a.growth.min.y + a.growth.max.y) / 2,
      (a.growth.min.z + a.growth.max.z) / 2,
    );
    // The hole first: a Foamer born inside uncarved voxels would be
    // pushed out of them as they remesh. An empty carve reports nothing.
    const v = this.voxelMesh.worldToVoxel(c.clone());
    const removed = carveSphere(
      this.voxels, v.x, v.y, v.z, a.burstRadiusMetres / this.voxels.voxelSize,
    );
    if (removed.length > 0) {
      a.growth.voxels -= removed.length;
      this.onCarveReport(removed);
    }
    const eye = this.player.eye(1, this.eye);
    // Feet on the growth's floor (its min side), not in the hole's air.
    const f = this.foamers.spawn(
      new THREE.Vector3(c.x, Math.max(a.growth.min.y, c.y - a.burstRadiusMetres), c.z),
      eye, a.spec.foamer,
    );
    if (!f) return null;
    a.woken = true;
    this.woken.push(f);
    // The pounce at once, the cooldown ignored: it folds into the crouch
    // and aims where the player stands (the stage 2 path runs the crouch
    // and the flight from here; the crouch is the tell seen as it comes
    // out). spawnState is "alert" on the arena page, so it starts fighting.
    f.leapCooldown = 0;
    f.pounced = false;
    f.pounceX = eye.x;
    f.pounceZ = eye.z;
    f.state = "crouch";
    f.stateTime = 0;
    f.yaw = Math.atan2(f.pounceX - c.x, f.pounceZ - c.z);
    return { id: a.spec.id, at: c };
  }
}

/** Builds the system from a level file. A level with no ambushes gets an
 *  empty system (the ENV-01 rule: built here, so a level without any
 *  plays exactly as before). */
export function buildAmbushes(
  level: { ambushes?: Ambush[]; pieces?: Piece[] },
  foamers: FoamerSystem,
  voxels: VoxelVolume,
  voxelMesh: VolumeMesh,
  player: { eye(alpha: number, out: THREE.Vector3): THREE.Vector3 },
): AmbushSystem {
  const byId = new Map((level.pieces ?? []).map((p) => [p.id, p]));
  const hidden: HiddenAmbush[] = [];
  for (const a of level.ambushes ?? []) {
    const piece = byId.get(a.growth);
    // The validator rejects a missing growth, a non-growth piece and a
    // type without the ambush block; a level that reached here anyway
    // builds no ambush for it rather than throw.
    if (!piece || piece.kind !== "growth") continue;
    const ambush = ambushOf(specFor(a.foamer));
    if (!ambush) continue;
    hidden.push({
      spec: a,
      growth: growthBox(piece),
      wakeMetres: ambush.wakeMetres,
      burstRadiusMetres: ambush.burstRadiusMetres,
      recheckSeconds: ambush.recheckSeconds,
      sinceRecheck: 0,
      woken: false,
    });
  }
  return new AmbushSystem(hidden, foamers, voxels, voxelMesh, player);
}

/** The world box a piece's volumes cover. */
function growthBox(piece: Piece): AmbushGrowth {
  const min = new THREE.Vector3(Infinity, Infinity, Infinity);
  const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
  for (const v of piece.volumes) {
    for (let a = 0; a < 3; a++) {
      min.setComponent(a, Math.min(min.getComponent(a), v.pos[a] - v.size[a] / 2));
      max.setComponent(a, Math.max(max.getComponent(a), v.pos[a] + v.size[a] / 2));
    }
  }
  return { min, max, voxels: 0, filled: 0 };
}

/** The voxels of the growth that are still solid. */
function countBox(volume: VoxelVolume, mesh: VolumeMesh, g: AmbushGrowth): number {
  const lo = mesh.worldToVoxel(g.min.clone());
  const hi = mesh.worldToVoxel(g.max.clone());
  let n = 0;
  for (let x = Math.floor(lo.x); x < Math.ceil(hi.x); x++)
    for (let y = Math.floor(lo.y); y < Math.ceil(hi.y); y++)
      for (let z = Math.floor(lo.z); z < Math.ceil(hi.z); z++)
        if (volume.get(x, y, z) !== EMPTY) n++;
  return n;
}

/** Distance from a point to a box, 0 inside it. */
function distanceToBox(p: THREE.Vector3, g: AmbushGrowth): number {
  const dx = Math.max(g.min.x - p.x, 0, p.x - g.max.x);
  const dy = Math.max(g.min.y - p.y, 0, p.y - g.max.y);
  const dz = Math.max(g.min.z - p.z, 0, p.z - g.max.z);
  return Math.hypot(dx, dy, dz);
}
