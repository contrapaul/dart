import * as THREE from "three";
import type RAPIER from "@dimforge/rapier3d-compat";
import type { Rapier } from "../physics/world";
import { GROUP_DEBRIS, GROUP_WORLD, groups } from "../physics/world";
import pickupData from "../../data/pickups.json";
import dartsData from "../../data/darts.json";
import type { PlayerHealth } from "../player/health";
import type { DartTypeName } from "../weapons/dart-model";
import type { Level } from "../level/format";
import type { Blaster } from "../weapons/blaster";

// GAME-07: the generic pickup. A health blob is a small cream ball on a
// dynamic sphere collider: it hops out of a finisher, settles, bobs, and is
// collected by walking over it; closer, it drifts to the player. An ammo box
// (LVL-02a, D08) is a small foam box that a level file places: it sits on
// the floor, turns slowly, and refills the reserve of every blaster that
// takes its dart type. What a pickup spends (health, ammo) sits in the
// PlayerHealth and the Loadout the system holds; the sound and the HUD flash
// hook on onCollected.

/** The collider group: the debris membership, so the player's character
 *  controller never trips on a blob (SOLID_QUERY_GROUPS skips debris and
 *  ragdolls); the world filter lets it hang off floors the same way debris
 *  does. */
export const PICKUP_GROUPS = groups(GROUP_DEBRIS, GROUP_WORLD);

export type PickupKind = Exclude<keyof typeof pickupData, "_note">;
type Kind = PickupKind;
const HEALTH = pickupData.health;
const AMMO = pickupData.ammo;
interface Item {
  kind: Kind;
  mesh: THREE.Mesh;
  body: RAPIER.RigidBody;
  prevT: THREE.Vector3;
  /** Seconds since the blob was sprayed (the lifetime and the bob phase). */
  age: number;
  /** True once removed; syncRender skips it. */
  gone: boolean;
  /** Ammo only: the dart type it refills and how many darts it holds. */
  dartType?: DartTypeName;
  dartCount?: number;
  /** Ammo only: starting facing, radians about Y (boxes do not turn in unison). */
  spin: number;
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
  private boxGeo = new THREE.BoxGeometry(1, 1, 1);
  private radius = {} as Record<Kind, number>;
  /** The blasters an ammo box refills (LVL-02a). The game sets it after the
   *  loadout is built; health does not need it, so a test may leave it out. */
  blasters: Blaster[] = [];

  constructor(
    private rapier: Rapier,
    private world: RAPIER.World,
    scene: THREE.Scene,
    health: PlayerHealth,
  ) {
    this.health = health;
    for (const kind of Object.keys(pickupData) as Kind[]) {
      const kk = kind === "ammo" ? AMMO : HEALTH;
      // A plain soft material, in the kind's colour: no shared foam patch,
      // no shader touches. Pores would be too fine at blob size anyway.
      this.mats[kind] = new THREE.MeshStandardMaterial({
        color: kk.color, roughness: 1,
      });
      this.radius[kind] = kind === "ammo" ? AMMO.size : HEALTH.radius;
    }
    scene.add(this.group);
  }

  /** The collider and mesh foot for a kind: the health kind is a ball that
   *  hangs at its centre, the ammo box sits on its bottom face. Both are
   *  the kind's scale (the box's edge, the blob's radius). */
  private baseOf(kind: Kind): number {
    return kind === "ammo" ? this.radius[kind] / 2 : this.radius[kind];
  }

  /** One pickup of a kind at a world position with a launch velocity. At
   *  the cap the oldest trims first (the card: oldest first). */
  spawn(kind: Kind, pos: THREE.Vector3, vel: THREE.Vector3, dartType?: DartTypeName, dartCount?: number): Item {
    const k = kind === "ammo" ? AMMO : HEALTH;
    // The collider bridges a bit of the space below the box, and below the
    // blob its full radius: the foot is where the collider hangs. The box
    // is a ball of half edge, the blob a ball of its radius.
    const foot = this.baseOf(kind);
    // The cap is per kind (LVL-02a review): a full health spray must trim the
    // oldest blob, never a placed ammo box that happens to be older.
    while (this.count(kind) >= k.max) {
      const oldest = this.list.findIndex((it) => !it.gone && it.kind === kind);
      if (oldest < 0) break;
      this.remove(oldest);
    }
    const scale = this.radius[kind];
    const mesh = new THREE.Mesh(kind === "ammo" ? this.boxGeo : this.geo, this.mats[kind]);
    mesh.castShadow = true;
    mesh.scale.setScalar(scale);
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
    // through the floor. The ammo box starts without angular velocity, so
    // it does not tumble when it settles.
    if (kind === "ammo") body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.world.createCollider(
      this.rapier.ColliderDesc.ball(foot).setTranslation(0, foot, 0)
        .setCollisionGroups(PICKUP_GROUPS),
      body,
    );
    const item: Item = {
      kind, mesh, body, prevT: pos.clone(), age: 0, gone: false,
      dartType, dartCount,
      spin: kind === "ammo" ? Math.random() * Math.PI * 2 : 0,
    };
    this.list.push(item);
    return item;
  }

  /** LVL-02a: a level file's placed ammo boxes (its pickups of a darts-*
   *  type). The dart type is the type field after the dash, and the count
   *  is the file's. The dart type must be a real one in data/darts.json,
   *  or the box is skipped (the validator rejects such a file). */
  loadLevelBoxes(level: Level): void {
    for (const p of level.pickups ?? []) {
      const t = p.type;
      if (!t.startsWith("darts-")) continue;
      const dartType = t.slice("darts-".length) as DartTypeName;
      if (!(dartType in (dartsData as { types: Record<string, unknown> }).types)) continue;
      this.spawn("ammo", new THREE.Vector3(...p.pos), new THREE.Vector3(0, 0, 0), dartType, p.count);
    }
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
   *  physics left the blob this step. The ammo box (LVL-02a) is static in
   *  spirit: it has no lifetime, no attract; it is collected inside its
   *  radius when it can give at least one dart, and it stays put at a full
   *  reserve. */
  update(dt: number, playerFeet: THREE.Vector3) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const it = this.list[i]!;
      if (it.gone) continue;
      it.age += dt; // every kind: the bob (and turn) phase; for blobs, the lifetime
      const t = it.body.translation();
      const dx = playerFeet.x - t.x;
      const dz = playerFeet.z - t.z;
      const d2 = dx * dx + dz * dz;
      if (it.kind === "ammo") {
        if (d2 <= AMMO.collectRadius * AMMO.collectRadius && !this.health.dead) {
          if (this.giveAmmo(it) > 0) {
            this.onCollected(it.kind, _t.set(t.x, t.y, t.z));
            this.remove(i);
          }
        }
        continue;
      }
      if (it.age >= HEALTH.lifetime) {
        this.onDissolved(it.kind, _t.set(t.x, t.y, t.z));
        this.remove(i);
        continue;
      }
      if (d2 <= HEALTH.collectRadius * HEALTH.collectRadius) {
        // Walking over it: collect when there is health to give, otherwise
        // the blob stays on the floor (at full health the game has nothing
        // to spend, and the card says they stay).
        if (!this.health.dead && this.health.heal(HEALTH.amount) > 0) {
          this.onCollected(it.kind, _t.set(t.x, t.y, t.z));
          this.remove(i);
        }
        continue;
      }
      if (this.health.dead) continue;
      if (d2 <= HEALTH.attractRadius * HEALTH.attractRadius && d2 > 1e-6) {
        // Inside the attract radius it drifts to the player, horizontal
        // only: it keeps its own fall, so a blob on a ledge does not fly.
        const want = HEALTH.attractSpeed / Math.max(Math.sqrt(d2), 0.1);
        const v = it.body.linvel();
        it.body.setLinvel(_v.set(dx * want, v.y, dz * want), true);
      }
    }
  }

  /** The darts an ammo box actually gave (0 when every matching blaster was
   *  already at reserveMax: the box stays put). Every blaster that takes the
   *  box's dart type gets the full count into its own reserve (the card's
   *  rule; LVL-02a review: it was one pool, first blaster first). Called
   *  from update while it is within collectRadius. */
  private giveAmmo(it: Item): number {
    let gave = 0;
    for (const b of this.blasters) {
      if (b.dartType !== it.dartType) continue;
      const space = Math.max(0, b.spec.reserveMax - b.reserve);
      const take = Math.min(space, it.dartCount ?? 0);
      b.reserve += take;
      gave += take;
    }
    return gave;
  }

  /** A render frame: alpha of the way from the last step, with a bob on a
   *  settled blob. A blob is settled when it is slow (a hop is fast), so
   *  the bob starts the moment it lands and the bob phase is its own age,
   *  so sprayed blobs do not bob in unison. The ammo box always "settled":
   *  its bob is its own time on the floor, and it turns slowly about Y. */
  syncRender(alpha: number) {
    for (const it of this.list) {
      if (it.gone) continue;
      const k = it.kind === "ammo" ? AMMO : HEALTH;
      const t = it.body.translation();
      it.prevT.x += (t.x - it.prevT.x) * alpha;
      it.prevT.y += (t.y - it.prevT.y) * alpha;
      it.prevT.z += (t.z - it.prevT.z) * alpha;
      const v = it.body.linvel();
      const settled = it.kind === "ammo" || Math.hypot(v.x, v.z) < HEALTH.settleSpeed;
      const bob = settled ? (Math.sin(it.age * k.bobRate) * 0.5 + 0.5) * k.bobHeight : 0;
      it.mesh.position.set(
        it.prevT.x,
        it.prevT.y + this.baseOf(it.kind) + bob,
        it.prevT.z,
      );
      if (it.kind === "ammo") it.mesh.rotation.y = it.spin + it.age * AMMO.turnRate;
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
