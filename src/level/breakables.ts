import * as THREE from "three";
import type RAPIER from "@dimforge/rapier3d-compat";
import type { Rapier } from "../physics/world";
import { SIGHT_QUERY_GROUPS } from "../physics/world";
import { collidersFor, foamMaterialFor, materialFor, type PrimHandle } from "./prims";
import { primGeometry, primMatrix } from "./prim-geometry";
import { isVoxelBreakable } from "./validate";
import { materialId } from "../voxel/materials";
import type { DebrisSystem } from "../voxel/debris";
import type { Level, Prim } from "./format";
import foamerData from "../../data/foamers.json";
import explosionData from "../../data/explosion.json";
import tuning from "../../data/destruction.json";

// ED-06 stage 2: the hit point breakables. A breakable prim that is not
// voxel foam (a shape other than a box, or a box turned off the 90 degree
// steps) is its own mesh with colliders of its own, the way ED-01 built a
// hidden prim. A dart, a blast or a swing takes hit points off it; at zero
// the mesh and colliders go off and it bursts into foam chunks through the
// debris system, whose ring is the cap. A restart puts it back.
//
// The damage numbers are not here: a dart's is the damage data/foamers.json
// gives that dart type against a Foamer, a blast's is its profile's
// damageCentre and rangeMetres, and a swing's is data/melee.json. This file
// only reads them, so there is one copy of each figure, in data/.
//
// A hidden voxel breakable has no voxels (stage 1 leaves it out of the
// level's volume), so it is built here as well, with the default hit points.

const B = tuning.breakables;

export type BlastProfileName = keyof typeof explosionData.profiles;
export type BlastProfileData = (typeof explosionData.profiles)[BlastProfileName];

/** The damage a dart type deals a Foamer, from the one place that has it. */
export function dartDamageOf(type: string): number {
  const table = foamerData.test.damage as Record<string, number>;
  return table[type] ?? 0;
}

/** The blast profile an explosive dart of this type blasts in. The engine
 *  picks it the same way (src/weapons/impacts.ts profileFor): the launcher
 *  round uses the launcher profile, every other explosive dart the dart
 *  profile. Named by type because onExplode is the game's own hook, out of
 *  a page's reach, while the dart system's onExplosiveHit is not. */
export function blastProfileFor(type: string): BlastProfileData {
  return type === "launcher" ? explosionData.profiles.launcher : explosionData.profiles.dart;
}

/** One breakable prim and what is left of it. */
export interface Breakable {
  readonly prim: Prim;
  readonly centre: THREE.Vector3;
  /** Half the box's diagonal: the sphere around it, for a loose dart. */
  readonly radius: number;
  hp: number;
  readonly maxHp: number;
  /** False once broken, so a step over the list skips it. */
  alive: boolean;
}

interface Live extends Breakable {
  mesh: THREE.Mesh;
  colliders: RAPIER.Collider[];
  shown: boolean;
}

const _m = new THREE.Matrix4();
const _local = new THREE.Vector3();
const _hit = new THREE.Vector3();

export class Breakables {
  /** A handle for a hidden breakable, keyed by prim id, so a trigger can
   *  show it (the map ED-01 kept for hidden prims). */
  readonly handles = new Map<string, PrimHandle>();
  /** ED-06: the level's chunk burst. The page sets it once the game's
   *  debris system exists (buildLevel runs before it). Without one a break
   *  still takes the prim away, quietly. */
  debris: DebrisSystem | null = null;
  /** A breakable lost its last hit point: the page sounds it and frees the
   *  darts stuck in it. */
  onBreak: (b: Breakable, at: THREE.Vector3) => void = () => {};
  /** A hit that did not break it, for a puff or a sound. */
  onDamage: (b: Breakable, amount: number, at: THREE.Vector3) => void = () => {};
  private readonly live: Live[] = [];
  private readonly byCollider = new Map<number, Live>();
  private readonly ray: RAPIER.Ray;

  constructor(
    level: Level,
    rapier: Rapier,
    private world: RAPIER.World,
    group: THREE.Group,
  ) {
    this.ray = new rapier.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -1 });
    for (const prim of level.prims ?? []) {
      if (prim.behaviour !== "breakable") continue;
      if (isVoxelBreakable(prim) && !prim.hidden) continue;

      const geometry = primGeometry(prim);
      geometry.applyMatrix4(primMatrix(prim));
      const mesh = new THREE.Mesh(geometry, materialFor(prim.colour));
      mesh.castShadow = mesh.receiveShadow = true;
      group.add(mesh);

      const colliders = collidersFor(rapier, prim).map((d) => world.createCollider(d));
      const hp = prim.hitPoints ?? B.defaultHitPoints;
      const state: Live = {
        prim,
        centre: new THREE.Vector3(...prim.pos),
        radius: Math.hypot(prim.size[0], prim.size[1], prim.size[2]) / 2,
        hp,
        maxHp: hp,
        alive: true,
        mesh,
        colliders,
        shown: true,
      };
      if (prim.hidden) {
        this.setShown(state, false);
        this.handles.set(prim.id, { setShown: (shown) => this.setShown(state, shown) });
      }
      this.live.push(state);
      for (const c of colliders) this.byCollider.set(c.handle, state);
    }
  }

  /** The breakable a collider belongs to, or null. */
  owns(collider: RAPIER.Collider): Breakable | null {
    return this.find(collider);
  }

  private find(collider: RAPIER.Collider): Live | null {
    return this.byCollider.get(collider.handle) ?? null;
  }

  /** Hit points left, or undefined for an id that is not breakable here.
   *  The tests and the page's debug hook read it. */
  hpOf(id: string): number | undefined {
    return this.live.find((b) => b.prim.id === id)?.hp;
  }

  /** Every breakable, broken or not, in file order. */
  get list(): readonly Breakable[] { return this.live; }

  /** A dart's hit, for the damage that dart deals a Foamer. */
  dartHit(
    hit: { collider: RAPIER.Collider; point: THREE.Vector3; direction: THREE.Vector3 },
    amount: number,
  ): void {
    const b = this.find(hit.collider);
    if (!b || !b.alive) return;
    // Back off the surface a little, so a puff sits on the face it hit.
    _hit.copy(hit.point).addScaledVector(hit.direction, -0.02);
    this.damage(b, amount, _hit);
  }

  /** A blast at a world point, in a profile: damageCentre at the centre,
   *  falling linearly to 0 at rangeMetres, the rule a Foamer takes
   *  (data/explosion.json). The distance is to the prim's own box, so a
   *  blast beside a wall of it counts as touching. */
  blast(point: THREE.Vector3, profile: BlastProfileName = "dart"): void {
    const T = explosionData.profiles[profile];
    for (const b of this.live) {
      if (!b.alive || !b.shown) continue;
      const d = this.distanceTo(b, point);
      if (d > T.rangeMetres) continue;
      const amount = T.damageCentre * (1 - d / T.rangeMetres);
      if (amount > 0) this.damage(b, amount, point);
    }
  }

  /** A swing: the first breakable the line from the eye meets within reach
   *  takes the swing's damage. `exclude` is the player's own collider, as
   *  the melee's carve line excludes it. */
  swing(
    eye: THREE.Vector3, forward: THREE.Vector3, reach: number, damage: number,
    exclude?: RAPIER.Collider,
  ): void {
    this.ray.origin = { x: eye.x, y: eye.y, z: eye.z };
    this.ray.dir = { x: forward.x, y: forward.y, z: forward.z };
    const hit = this.world.castRay(this.ray, reach, true, undefined, SIGHT_QUERY_GROUPS, exclude);
    if (!hit) return;
    const b = this.find(hit.collider);
    if (!b || !b.alive) return;
    _hit.copy(eye).addScaledVector(forward, hit.timeOfImpact);
    this.damage(b, damage, _hit);
  }

  /** A restart puts every breakable back: mesh, colliders and hit points.
   *  A hidden one goes back to hidden, the way it started. */
  reset(): void {
    for (const b of this.live) {
      b.hp = b.maxHp;
      b.alive = true;
      this.setShown(b, !b.prim.hidden);
    }
  }

  private damage(b: Live, amount: number, at: THREE.Vector3): void {
    if (!b.alive) return;
    b.hp -= amount;
    if (b.hp > 0) {
      this.onDamage(b, amount, at);
      return;
    }
    b.hp = 0;
    b.alive = false;
    // Gone: no mesh, no collision. What it was becomes chunks out of its
    // middle, the foam rule (never a pop into nothing). The debris ring is
    // the hard cap, as it is for every burst.
    this.setShown(b, false);
    const volume = b.prim.size[0] * b.prim.size[1] * b.prim.size[2];
    const count = THREE.MathUtils.clamp(
      Math.round(volume * B.chunksPerCubicMetre), B.minChunks, B.maxChunks,
    );
    this.debris?.burst(b.centre, count, B.chunkSize, materialId(foamMaterialFor(b.prim.colour)));
    this.onBreak(b, b.centre);
  }

  private setShown(b: Live, shown: boolean): void {
    b.shown = shown;
    b.mesh.visible = shown;
    for (const c of b.colliders) c.setEnabled(shown);
  }

  /** How far a world point is from the prim's own size box, in metres (0
   *  inside). A ramp or a wedge is measured by its size box: a little
   *  generous, never a miss. */
  private distanceTo(b: Live, point: THREE.Vector3): number {
    _m.copy(primMatrix(b.prim)).invert();
    _local.copy(point).applyMatrix4(_m);
    let d2 = 0;
    for (let i = 0; i < 3; i++) {
      const over = Math.abs(_local.getComponent(i)) - b.prim.size[i] / 2;
      if (over > 0) d2 += over * over;
    }
    return Math.sqrt(d2);
  }
}
