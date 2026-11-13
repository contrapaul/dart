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

/** LVL-05: what a blaster pickup needs of the Loadout (the class itself
 *  fits; the test passes a small stand-in). Keeping it to this shape is
 *  what lets the pickup stay out of the weapons module's imports. */
export interface PickupLoadout {
  ids: readonly string[];
  owns(id: string): boolean;
  own(id: string): void;
  select(i: number): void;
  /** The Blaster at i (its spec, magazine and reserve are what a pickup
   *  fills). */
  readonly blasters: readonly Blaster[];
}

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
const BLASTER = pickupData.blaster;
interface Item {
  kind: Kind;
  mesh: THREE.Object3D;
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
  /** LVL-05, blaster only: the blaster id the level gives here. */
  blasterId?: string;
  /** LVL-05, blaster only: its own little turn, so two pedestals differ. */
  turn: number;
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
  /** LVL-05: the loadout a blaster pickup adds to (the owned set, the
   *  switch and the ammo). Set by the page the same way; without one a
   *  blaster pickup cannot be taken, so a test may leave it out. */
  loadout: PickupLoadout | null = null;
  /** LVL-05: a blaster pickup was taken this step, with its id. */
  onBlaster: (id: string, pos: THREE.Vector3) => void = () => {};
  /** LVL-05: the models the pickups show, by blaster id. The page fills it
   *  from the loadout's viewmodels after they load, so a pickup is the
   *  blaster's own model and nothing is fetched for it. A blaster without
   *  one shows nothing (a level test catches the empty spot). */
  readonly blasterModels = new Map<string, THREE.Object3D>();

  constructor(
    private rapier: Rapier,
    private world: RAPIER.World,
    scene: THREE.Scene,
    health: PlayerHealth,
  ) {
    this.health = health;
    for (const kind of Object.keys(pickupData) as Kind[]) {
      // A plain soft material, in the kind's colour: no shared foam patch,
      // no shader touches. Pores would be too fine at blob size anyway.
      // A blaster pickup draws the blaster's own model, so it has none.
      if (kind !== "blaster") {
        const kk = kind === "ammo" ? AMMO : HEALTH;
        this.mats[kind] = new THREE.MeshStandardMaterial({
          color: kk.color, roughness: 1,
        });
      }
      this.radius[kind] = kind === "ammo" ? AMMO.size
        : kind === "blaster" ? BLASTER.foot : HEALTH.radius;
    }
    scene.add(this.group);
  }

  /** The collider and mesh foot for a kind: the health kind is a ball that
   *  hangs at its centre, the ammo box sits on its bottom face. Both are
   *  the kind's scale (the box's edge, the blob's radius). LVL-05: a blaster
   *  pickup's foot is its own `blaster.foot`, the height its model rests at. */
  private baseOf(kind: Kind): number {
    return kind === "ammo" ? this.radius[kind] / 2 : this.radius[kind];
  }

  /** One pickup of a kind at a world position with a launch velocity. At
   *  the cap the oldest trims first (the card: oldest first). */
  spawn(
    kind: Kind, pos: THREE.Vector3, vel: THREE.Vector3,
    dartType?: DartTypeName, dartCount?: number, blasterId?: string,
  ): Item {
    const k = kind === "ammo" ? AMMO : kind === "blaster" ? BLASTER : HEALTH;
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
    // A blaster pickup is a holder for the blaster's own model (its parts
    // cast their own shadows); the other kinds are one scaled mesh.
    const mesh = kind === "blaster"
      ? this.makeModel(blasterId)
      : new THREE.Mesh(kind === "ammo" ? this.boxGeo : this.geo, this.mats[kind]);
    if (kind !== "blaster") {
      mesh.castShadow = true;
      mesh.scale.setScalar(scale);
    }
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
    // through the floor. The ammo box and the blaster pickup start without
    // angular velocity, so neither tumbles when it settles.
    if (kind === "ammo" || kind === "blaster") body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.world.createCollider(
      this.rapier.ColliderDesc.ball(foot).setTranslation(0, foot, 0)
        .setCollisionGroups(PICKUP_GROUPS),
      body,
    );
    const item: Item = {
      kind, mesh, body, prevT: pos.clone(), age: 0, gone: false,
      dartType, dartCount, blasterId,
      spin: kind === "ammo" ? Math.random() * Math.PI * 2 : 0,
      turn: kind === "blaster" ? Math.random() * Math.PI * 2 : 0,
    };
    this.list.push(item);
    return item;
  }

  /** LVL-05: the pickup a blaster pickup shows: a copy of that blaster's
   *  own model (the page hands the models over from the loadout, so
   *  nothing is fetched here), under a small group that turns and bobs.
   *  The copy is put back to the identity transform: the loadout's root
   *  carries the view placement, and the pickup wants the model at world
   *  size. Without a model the group is empty and the pickup is invisible
   *  at that spot, which a level test would catch. */
  private makeModel(blasterId: string | undefined): THREE.Object3D {
    const holder = new THREE.Group();
    const model = blasterId ? this.blasterModels.get(blasterId) : undefined;
    if (model) {
      const copy = model.clone(true);
      copy.position.set(0, 0, 0);
      copy.rotation.set(0, 0, 0);
      copy.scale.set(1, 1, 1);
      // Shadows on, so the pickup casts where it rests like the ammo box
      // does. The parts the viewmodel hides stay hidden.
      copy.traverse((o) => { o.castShadow = true; });
      holder.add(copy);
    }
    return holder;
  }

  /** LVL-02a: a level file's placed ammo boxes (its pickups of a darts-*
   *  type). The dart type is the type field after the dash, and the count
   *  is the file's. The dart type must be a real one in data/darts.json,
   *  or the box is skipped (the validator rejects such a file).
   *  LVL-05: a blaster pickup (type blaster) is placed the same way. */
  loadLevelBoxes(level: Level): void {
    for (const p of level.pickups ?? []) {
      const t = p.type;
      if (t === "blaster") {
        const id = p.blaster;
        if (!id) continue; // the validator rejects such a file
        this.spawn("blaster", new THREE.Vector3(...p.pos), new THREE.Vector3(0, 0, 0), undefined, undefined, id);
        continue;
      }
      if (!t.startsWith("darts-")) continue;
      const dartType = t.slice("darts-".length) as DartTypeName;
      if (!(dartType in (dartsData as { types: Record<string, unknown> }).types)) continue;
      this.spawn("ammo", new THREE.Vector3(...p.pos), new THREE.Vector3(0, 0, 0), dartType, p.count ?? 0);
    }
  }

  /** LVL-05: a blaster pickup's take. The blaster is owned, selected (a
   *  fresh pickup switches to it), and filled: a full magazine and its
   *  reserveStart. In test mode, where every blaster is owned already,
   *  this only tops the ammo up. Returns false when the loadout does not
   *  know the blaster (the pickup stays put). */
  private takeBlaster(it: Item): boolean {
    const lo = this.loadout;
    if (!lo || !it.blasterId) return false;
    const i = lo.ids.indexOf(it.blasterId);
    if (i < 0) return false;
    const b = lo.blasters[i];
    if (!b) return false;
    const had = lo.owns(it.blasterId);
    lo.own(it.blasterId);
    // A blaster found is switched to; one already in hand (the test page
    // owns them all) only tops the ammo up, as the card says.
    if (!had) lo.select(i);
    b.refill();
    b.reserve = had ? Math.max(b.reserve, b.spec.reserveStart) : b.spec.reserveStart;
    this.onBlaster(it.blasterId, _t.set(it.body.translation().x, it.body.translation().y, it.body.translation().z));
    return true;
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
      if (it.kind === "blaster") {
        // LVL-05: taken by the ammo box's rule, walking within 1 m of it.
        if (d2 <= BLASTER.collectRadius * BLASTER.collectRadius && !this.health.dead) {
          if (this.takeBlaster(it)) {
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
      // GAME-09c: the B02's reserve never empties, so the box never gives it.
      if (b.spec.reserveInfinite) continue;
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
      const k = it.kind === "ammo" ? AMMO : it.kind === "blaster" ? BLASTER : HEALTH;
      const t = it.body.translation();
      it.prevT.x += (t.x - it.prevT.x) * alpha;
      it.prevT.y += (t.y - it.prevT.y) * alpha;
      it.prevT.z += (t.z - it.prevT.z) * alpha;
      const v = it.body.linvel();
      const settled = it.kind === "ammo" || it.kind === "blaster"
        || Math.hypot(v.x, v.z) < HEALTH.settleSpeed;
      const bob = settled ? (Math.sin(it.age * k.bobRate) * 0.5 + 0.5) * k.bobHeight : 0;
      it.mesh.position.set(
        it.prevT.x,
        it.prevT.y + this.baseOf(it.kind) + bob,
        it.prevT.z,
      );
      if (it.kind === "ammo") it.mesh.rotation.y = it.spin + it.age * AMMO.turnRate;
      if (it.kind === "blaster") it.mesh.rotation.y = it.turn + it.age * BLASTER.turnRate;
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
