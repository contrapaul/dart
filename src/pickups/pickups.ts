import * as THREE from "three";
import type RAPIER from "@dimforge/rapier3d-compat";
import type { Rapier } from "../physics/world";
import { GROUP_DEBRIS, GROUP_WORLD, groups } from "../physics/world";
import pickupData from "../../data/pickups.json";
import type { PlayerHealth } from "../player/health";

// GAME-07: the generic pickup. A health blob is a small cream ball on a
// dynamic sphere collider: it hops out of a finisher, settles, bobs, and is
// collected by walking over it; closer, it drifts to the player. Ammo comes
// onto the same system on D08 as another kind in data/pickups.json. What a
// pick spends (health) sits in the PlayerHealth the system holds; the
// sound and the HUD flash hook on onCollected.

/** The collider group: the debris membership, so the player's character
 *  controller never trips on a blob (SOLID_QUERY_GROUPS skips debris and
 *  ragdolls); the world filter lets it hang off floors the same way debris
 *  does. */
export const PICKUP_GROUPS = groups(GROUP_DEBRIS, GROUP_WORLD);

export type PickupKind = Exclude<keyof typeof pickupData, "_note">;
type Kind = PickupKind;
interface Item {
  kind: Kind;
  mesh: THREE.Mesh;
  body: RAPIER.RigidBody;
  prevT: THREE.Vector3;
  /** Seconds since the blob was sprayed (the lifetime and the bob phase). */
  age: number;
  /** True once removed; syncRender skips it. */
  gone: boolean;
}

const _t = new THREE.Vector3();
const _v = new THREE.Vector3();

export class PickupSystem {
  /** One group for every blob, added to the scene once. */
  readonly group = new THREE.Group();
  /** Live blobs, oldest first (the cap trims oldest). */
  readonly list: Item[] = [];
  /** A pickup was collected this step, in world space: the sound and the
   *  HUD flash hook here; the game plays it by kind. */
  onCollected: (kind: Kind, pos: THREE.Vector3) => void = () => {};
  /** A lifetime dissolve this step, in world space. */
  onDissolved: (kind: Kind, pos: THREE.Vector3) => void = () => {};

  private health: PlayerHealth;
  private mats = {} as Record<Kind, THREE.Material>;
  private geo = new THREE.SphereGeometry(1, 16, 10);
  private radius = {} as Record<Kind, number>;

  constructor(
    private rapier: Rapier,
    private world: RAPIER.World,
    scene: THREE.Scene,
    health: PlayerHealth,
  ) {
    this.health = health;
    for (const kind of Object.keys(pickupData) as Kind[]) {
      const k = pickupData[kind]!;
      // A plain soft material, in the kind's colour: no shared foam patch,
      // no shader touches. Pores would be too fine at blob size anyway.
      this.mats[kind] = new THREE.MeshStandardMaterial({
        color: k.color, roughness: 1,
      });
      this.radius[kind] = k.radius;
    }
    scene.add(this.group);
  }

  /** One pickup of a kind at a world position with a launch velocity. At
   *  the cap the oldest trims first (the card: oldest first). */
  spawn(kind: Kind, pos: THREE.Vector3, vel: THREE.Vector3): Item {
    const k = pickupData[kind]!;
    while (this.list.length >= k.max) this.remove(0);
    const mesh = new THREE.Mesh(this.geo, this.mats[kind]);
    mesh.castShadow = true;
    mesh.scale.setScalar(k.radius);
    this.group.add(mesh);
    const body = this.world.createRigidBody(
      this.rapier.RigidBodyDesc.dynamic()
        .setTranslation(pos.x, pos.y, pos.z)
        .setLinvel(vel.x, vel.y, vel.z)
        .setLinearDamping(0.3)
        .setAngularDamping(2),
    );
    // The debris membership, so the player's character controller never
    // trips on a blob (SOLID_QUERY_GROUPS skips debris and ragdolls); the
    // world filter lets it rest on floors the same way debris does. Not a
    // sensor: sensors do not support a resting body and the blob would fall
    // through the floor.
    this.world.createCollider(
      this.rapier.ColliderDesc.ball(k.radius).setTranslation(0, k.radius, 0)
        .setCollisionGroups(PICKUP_GROUPS),
      body,
    );
    const item: Item = {
      kind, mesh, body, prevT: pos.clone(), age: 0, gone: false,
    };
    this.list.push(item);
    return item;
  }

  /** GAME-07: the finisher's health spray, a ring of count blobs. */
  sprayHealth(pos: THREE.Vector3) {
    const k = pickupData.health;
    for (let i = 0; i < k.count; i++) {
      const a = (i / k.count) * Math.PI * 2 + Math.random() * 0.8;
      const r = k.shift * (0.5 + 0.5 * Math.random());
      const sp = k.hopSpeed * (r / k.shift);
      this.spawn(
        "health",
        pos.clone().setY(pos.y + k.radius),
        new THREE.Vector3(Math.sin(a) * sp, k.hopSpeed, Math.cos(a) * sp),
      );
    }
  }

  /** A fixed step, before world.step(): age, the attract, and the collect.
   *  The collect reads the body's translation, so it is exactly where
   *  physics left the blob this step. */
  update(dt: number, playerFeet: THREE.Vector3) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const it = this.list[i]!;
      if (it.gone) continue;
      const k = pickupData[it.kind]!;
      it.age += dt;
      const t = it.body.translation();
      const dx = playerFeet.x - t.x;
      const dz = playerFeet.z - t.z;
      const d2 = dx * dx + dz * dz;
      if (it.age >= k.lifetime) {
        this.onDissolved(it.kind, _t.set(t.x, t.y, t.z));
        this.remove(i);
        continue;
      }
      if (d2 <= k.collectRadius * k.collectRadius) {
        // Walking over it: collect when there is health to give, otherwise
        // the blob stays on the floor (at full health the game has nothing
        // to spend, and the card says they stay).
        if (!this.health.dead && this.health.heal(k.amount) > 0) {
          this.onCollected(it.kind, _t.set(t.x, t.y, t.z));
          this.remove(i);
        }
        continue;
      }
      if (this.health.dead) continue;
      if (d2 <= k.attractRadius * k.attractRadius && d2 > 1e-6) {
        // Inside the attract radius it drifts to the player, horizontal
        // only: it keeps its own fall, so a blob on a ledge does not fly.
        const want = k.attractSpeed / Math.max(Math.sqrt(d2), 0.1);
        const v = it.body.linvel();
        it.body.setLinvel(_v.set(dx * want, v.y, dz * want), true);
      }
    }
  }

  /** A render frame: alpha of the way from the last step, with a bob on a
   *  settled blob. A blob is settled when it is slow (a hop is fast), so
   *  the bob starts the moment it lands and the bob phase is its own age,
   *  so sprayed blobs do not bob in unison. */
  syncRender(alpha: number) {
    for (const it of this.list) {
      if (it.gone) continue;
      const k = pickupData[it.kind]!;
      const t = it.body.translation();
      it.prevT.x += (t.x - it.prevT.x) * alpha;
      it.prevT.y += (t.y - it.prevT.y) * alpha;
      it.prevT.z += (t.z - it.prevT.z) * alpha;
      const v = it.body.linvel();
      const bob = Math.hypot(v.x, v.z) < k.settleSpeed
        ? (Math.sin(it.age * k.bobRate) * 0.5 + 0.5) * k.bobHeight
        : 0;
      it.mesh.position.set(it.prevT.x, it.prevT.y + k.radius + bob, it.prevT.z);
    }
  }

  /** How many are live of a kind (the watch state and the tests); "all"
   *  counts every kind. */
  count(kind: Kind | "all" = "all"): number {
    return this.list.reduce((n, it) => n + (!it.gone && (kind === "all" || it.kind === kind) ? 1 : 0), 0);
  }

  /** Take every blob out (a level restart): no sounds. */
  clear() {
    for (let i = this.list.length - 1; i >= 0; i--) this.removeItem(i);
  }

  /** Take a blob out of the scene and the world, at index i. */
  private remove(i: number) {
    this.removeItem(i);
  }
  private removeItem(i: number) {
    const it = this.list[i]!;
    if (it.gone) return;
    it.gone = true;
    this.group.remove(it.mesh);
    this.world.removeRigidBody(it.body);
    this.list.splice(i, 1);
  }
}
