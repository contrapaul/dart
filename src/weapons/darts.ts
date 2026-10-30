import * as THREE from "three";
import type RAPIER from "@dimforge/rapier3d-compat";
import type { Rapier } from "../physics/world";
import tuning from "../../data/darts.json";
import { buildDartGeometry } from "./dart-model";
import type { DartTypeSpec, DartTypeName } from "./dart-model";

export type { DartTypeName } from "./dart-model";

export interface DartHit {
  point: THREE.Vector3;       // world position of the hit
  normal: THREE.Vector3;      // surface normal at the hit
  direction: THREE.Vector3;   // unit flight direction at impact
  speed: number;              // m/s at impact
  type: DartTypeName;
  collider: RAPIER.Collider;  // what was hit
}

// Darts are not Rapier bodies. At full rate, up to 310 live darts mean 310
// thin ray casts per step, which is far cheaper than 310 rigid bodies. All
// vectors are allocated once at construction; nothing is allocated per shot
// or per step after that.

const TUNE = { ...tuning };
const FADE = 0.3;          // seconds a resting dart takes to shrink to zero
const REST_SPEED = 1.5;    // m/s: below this speed on the ground, a dart rests
const SINK = 0.3;          // tip depth into the surface, in dart lengths
const KILL_Y = -25;        // darts that fell off the course are freed
const EXCLUDE_SENSORS = 8; // QueryFilterFlags.EXCLUDE_SENSORS

const FLYING = 0;
const STUCK = 1;
const RESTING = 2;
const FADING = 3;

const AXIS_Z = new THREE.Vector3(0, 0, 1);
const UP = new THREE.Vector3(0, 1, 0);

const TYPE_NAMES: DartTypeName[] = ["standard", "suction"];

interface Slot {
  alive: boolean;
  state: number;
  type: DartTypeName;
  spec: DartTypeSpec;
  canStick: boolean;     // sucked-off darts bounce instead of re-sticking
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  quat: THREE.Quaternion;
  prevPos: THREE.Vector3;  // pose before the last step, for render interpolation
  prevQuat: THREE.Quaternion;
  scale: number;
  restT: number;         // seconds in flight, or resting, then fading
  order: number;         // allocation order, for oldest-first recycling
  body: RAPIER.RigidBody | null; // rigid body a stuck dart follows
  coll: RAPIER.Collider | null;  // collider a stuck dart is fixed to
  local: THREE.Vector3;          // stuck offset in body-local space
  lquat: THREE.Quaternion;         // stuck rotation in body-local space
  inst: number;                   // index in list[type]
}

export class DartSystem {
  /** Called once per hit. Other systems subscribe here later. */
  onHit: (hit: DartHit) => void = () => {};

  private world: RAPIER.World;
  private ignore: RAPIER.Collider;
  private capFly = TUNE.maxLive;
  private capStick = TUNE.maxStuck;
  private capRest = TUNE.maxResting;
  private life = TUNE.lifetime;

  private slots: Slot[] = [];
  private free: number[] = [];
  private list: Record<DartTypeName, number[]> = { standard: [], suction: [] };
  private count: Record<number, number> = { [FLYING]: 0, [STUCK]: 0, [RESTING]: 0, [FADING]: 0 };
  private meshes: Record<DartTypeName, THREE.InstancedMesh> =
    {} as Record<DartTypeName, THREE.InstancedMesh>;
  private seq = 0;

  // Scratch vectors. Written to, never replaced after construction.
  private _dn = new THREE.Vector3();
  private _hp = new THREE.Vector3();
  private _n3 = new THREE.Vector3();
  private _m = new THREE.Matrix4();
  private _s3 = new THREE.Vector3();
  private _rp = new THREE.Vector3();
  private _rq = new THREE.Quaternion();
  private _q = new THREE.Quaternion();
  private _qi = new THREE.Quaternion();
  private _po = { x: 0, y: 0, z: 0 };
  private _pd = { x: 0, y: 0, z: 0 };
  private _ray: RAPIER.Ray;

  constructor(scene: THREE.Scene, world: RAPIER.World, rapier: Rapier, ignore: RAPIER.Collider) {
    this.world = world;
    this.ignore = ignore;
    const n = TUNE.maxLive + TUNE.maxStuck + TUNE.maxResting;
    for (const type of TYPE_NAMES) {
      const geo = buildDartGeometry(TUNE.types[type]);
      const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 });
      const inst = new THREE.InstancedMesh(geo, mat, n);
      inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      inst.count = 0;
      inst.frustumCulled = false; // instances move; skip the tiny static bounds
      scene.add(inst);
      this.meshes[type] = inst;
    }
    for (let i = 0; i < n; i++) {
      this.slots.push({
        alive: false,
        state: FLYING,
        type: "standard",
        spec: TUNE.types.standard,
        canStick: true,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        quat: new THREE.Quaternion(),
        prevPos: new THREE.Vector3(),
        prevQuat: new THREE.Quaternion(),
        scale: 1,
        restT: 0,
        order: 0,
        body: null,
        coll: null,
        local: new THREE.Vector3(),
        lquat: new THREE.Quaternion(),
        inst: 0,
      });
      this.free.push(i);
    }
    this._ray = new rapier.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -1 });
  }

  fire(origin: THREE.Vector3, direction: THREE.Vector3, type: DartTypeName): void {
    const spec = TUNE.types[type];
    if (this.count[FLYING] >= this.capFly) this.killOldest(FLYING);
    const i = this.free.pop();
    if (i === undefined) return; // every slot busy; drop this shot
    const s = this.slots[i];
    s.alive = true;
    s.state = FLYING;
    s.type = type;
    s.spec = spec;
    s.canStick = true;
    s.pos.copy(origin);
    this._dn.copy(direction);
    if (this._dn.lengthSq() < 1e-9) this._dn.set(0, 0, -1);
    this._dn.normalize();
    s.vel.copy(this._dn).multiplyScalar(spec.speed);
    s.quat.setFromUnitVectors(AXIS_Z, this._dn);
    s.prevPos.copy(s.pos);
    s.prevQuat.copy(s.quat);
    s.scale = 1;
    s.restT = 0;
    s.order = this.seq++;
    s.body = null;
    s.coll = null;
    this.count[FLYING]++;
    s.inst = this.list[type].length;
    this.list[type].push(i);
  }

  /** Fixed step. Call before world.step(). */
  update(dt: number): void {
    for (let i = 0; i < this.slots.length; i++) {
      const s = this.slots[i];
      if (!s.alive) continue;
      s.prevPos.copy(s.pos);
      s.prevQuat.copy(s.quat);
      if (s.state === STUCK) {
        this.stepStuck(s);
        continue;
      }
      if (s.state === FLYING) {
        this.stepFlying(s, dt);
        continue;
      }
      // Resting and fading share an age countdown.
      s.restT += dt;
      if (s.state === RESTING && s.restT >= this.life) {
        s.state = FADING;
        s.restT = 0;
        this.count[RESTING]--;
        this.count[FADING]++;
      }
      if (s.state === FADING) {
        s.scale = Math.max(0, 1 - s.restT / FADE);
        if (s.scale <= 0) this.kill(i);
      }
    }
    // Trim to the caps. A batch of darts can land in the same step, so a
    // while loop, not a single kill.
    while (this.count[STUCK] > this.capStick) this.killOldest(STUCK);
    while (this.count[RESTING] > this.capRest) this.killOldest(RESTING);
  }

  /** Write instance matrices. Call once per render frame. alpha (0 to 1)
   *  places each dart between its last two steps, so darts move smoothly
   *  on displays faster than the 60 Hz step. */
  syncRender(alpha = 1): void {
    for (const type of TYPE_NAMES) {
      const mesh = this.meshes[type];
      const list = this.list[type];
      const count = list.length;
      mesh.count = count;
      for (let k = 0; k < count; k++) {
        const s = this.slots[list[k]];
        this._s3.setScalar(s.scale);
        this._rp.lerpVectors(s.prevPos, s.pos, alpha);
        this._rq.slerpQuaternions(s.prevQuat, s.quat, alpha);
        this._m.compose(this._rp, this._rq, this._s3);
        mesh.setMatrixAt(k, this._m);
      }
      if (count > 0) mesh.instanceMatrix.needsUpdate = true;
    }
  }

  /** For tests and debug: counts by state. */
  stats(): { flying: number; stuck: number; resting: number } {
    return {
      flying: this.count[FLYING],
      stuck: this.count[STUCK],
      resting: this.count[RESTING],
    };
  }

  // -- steps ------------------------------------------------------------

  private stepFlying(s: Slot, dt: number) {
    // A dart that never lands (wedged inside geometry) is freed after the
    // same lifetime as a resting one.
    s.restT += dt;
    if (s.restT >= this.life) return this.killSlot(s);
    s.vel.y -= 9.81 * s.spec.gravityScale * dt;
    const f = Math.max(0, 1 - s.spec.drag * dt);
    s.vel.x *= f;
    s.vel.y *= f;
    s.vel.z *= f;
    const speed = s.vel.length();
    if (speed < 1e-4) {
      if (s.pos.y < KILL_Y) this.killSlot(s);
      return;
    }
    this._dn.copy(s.vel).multiplyScalar(1 / speed);
    const maxDist = speed * dt;
    this._po.x = s.pos.x; this._po.y = s.pos.y; this._po.z = s.pos.z;
    this._pd.x = this._dn.x; this._pd.y = this._dn.y; this._pd.z = this._dn.z;
    this._ray.origin = this._po;
    this._ray.dir = this._pd;
    const hit = this.world.castRayAndGetNormal(
      this._ray, maxDist, true, EXCLUDE_SENSORS, undefined, this.ignore, undefined,
    );
    if (hit) {
      // timeOfImpact is a distance in metres along the unit ray, already
      // capped at maxDist by the engine, but the min keeps it in range.
      const t = Math.min(maxDist, hit.timeOfImpact);
      this._hp.copy(this._dn).multiplyScalar(t).add(s.pos);
      this._n3.set(hit.normal.x, hit.normal.y, hit.normal.z);
      // The body's parent is looked up before the hit callback: a dart can
      // pop the Foamer it hit (the system removes its body inside onHit),
      // and a collider without a live body must not be queried.
      const hitBody = hit.collider.parent();
      const hitDynamic = hitBody ? hitBody.isDynamic() : false;
      this.onHit({
        point: this._hp.clone(),
        normal: this._n3.clone(),
        direction: this._dn.clone(),
        speed,
        type: s.type,
        collider: hit.collider,
      });
      // Push dynamic bodies along the flight direction at the impact point.
      // The push never changes a body's speed by more than maxPushSpeed: a
      // foam chunk weighs a few grams, and the full impulse would fling it
      // at hundreds of m/s.
      if (hitBody && hitDynamic) {
        const k = Math.min(s.spec.impulse, hitBody.mass() * tuning.maxPushSpeed);
        hitBody.applyImpulseAtPoint(
          { x: this._dn.x * k, y: this._dn.y * k, z: this._dn.z * k },
          { x: this._hp.x, y: this._hp.y, z: this._hp.z },
          true,
        );
      }
      // A body removed inside onHit (a popped Foamer) has nothing left to
      // stick to: the dart bounces off where it was and, like a released
      // dart, does not stick again (not even to the foam chunks).
      const bodyGone = hitBody !== null && !this.world.getRigidBody(hitBody.handle);
      if (bodyGone) s.canStick = false;
      if (s.spec.sticks && s.canStick && !bodyGone) {
        this.stick(s, hit, hitBody);
        return;
      }
      // Reflect the velocity about the surface normal, scaled by restitution.
      const n = this._n3;
      const d = s.vel.x * n.x + s.vel.y * n.y + s.vel.z * n.z;
      s.vel.x -= 2 * d * n.x;
      s.vel.y -= 2 * d * n.y;
      s.vel.z -= 2 * d * n.z;
      s.vel.multiplyScalar(s.spec.restitution);
      // Step off the surface a touch so it does not re-hit the same face.
      s.pos.copy(this._hp).addScaledVector(n, 0.004);
      if (s.vel.length() < REST_SPEED && n.y > 0.7) {
        // Resting: lies flat on the surface along its flight heading and
        // stops being simulated.
        s.state = RESTING;
        s.pos.copy(this._hp).addScaledVector(UP, s.spec.radius);
        this._s3.set(this._dn.x, 0, this._dn.z);
        if (this._s3.lengthSq() < 1e-6) this._s3.set(0, 0, 1);
        s.quat.setFromUnitVectors(AXIS_Z, this._s3.normalize());
        s.vel.set(0, 0, 0);
        s.restT = 0;
        this.count[FLYING]--;
        this.count[RESTING]++;
      }
      return;
    }
    s.pos.addScaledVector(this._dn, maxDist);
    if (s.pos.y < KILL_Y) this.killSlot(s);
  }

  /**
   * Every stuck dart within `radius` metres of `centre` becomes a falling
   * non-sticking dart (the same path as the collider-removed case in
   * stepStuck). Returns how many were released.
   */
  releaseInSphere(centre: THREE.Vector3, radius: number): number {
    const r2 = radius * radius;
    let n = 0;
    for (const s of this.slots) {
      if (!s.alive || s.state !== STUCK) continue;
      if (s.pos.distanceToSquared(centre) <= r2) {
        s.state = FLYING;
        s.vel.set(0, 0, 0);
        s.body = null;
        s.coll = null;
        s.canStick = false;
        this.count[STUCK]--;
        this.count[FLYING]++;
        n++;
      }
    }
    return n;
  }

  // A stuck dart is glued to its body's local frame and rides along. When
  // the collider, or the whole body, is gone the dart falls as an unstuck
  // dart (rule 3).
  private stepStuck(s: Slot) {
    if (!s.body) return; // stuck to a fixed collider with no body: transform is static
    if (!this.world.getRigidBody(s.body.handle)) {
      // The body was removed from the world (the Foamer popped): the dart
      // falls, exactly like the collider-removed case below.
      s.state = FLYING;
      s.vel.set(0, 0, 0);
      s.body = null;
      s.coll = null;
      s.canStick = false;
      this.count[STUCK]--;
      this.count[FLYING]++;
      return;
    }
    if (s.coll && !this.world.getCollider(s.coll.handle)) {
      s.state = FLYING;
      s.vel.set(0, 0, 0);
      s.body = null;
      s.coll = null;
      s.canStick = false;
      this.count[STUCK]--;
      this.count[FLYING]++;
      return;
    }
    const p = s.body.translation();
    const r = s.body.rotation();
    this._q.set(r.x, r.y, r.z, r.w);
    s.pos.copy(s.local).applyQuaternion(this._q).add(p);
    s.quat.copy(s.lquat).premultiply(this._q);
  }

  private stick(s: Slot, hit: RAPIER.RayColliderIntersection, hitBody: RAPIER.RigidBody | null) {
    // The tip is sunk 0.3 * length into the surface, the dart points along
    // its flight direction (+Z is the tip of the geometry).
    s.pos.copy(this._hp).addScaledVector(this._n3, -SINK * s.spec.length);
    s.quat.setFromUnitVectors(AXIS_Z, this._dn);
    s.state = STUCK;
    this.count[FLYING]--;
    this.count[STUCK]++;
    const rb = hitBody;
    // A fixed collider is never replaced by a remesh while the dart rides
    // with it, so keep body and coll null: the dart stays stuck in place.
    // A kinematic body (a Foamer) is re-meshed as it is carved, which
    // replaces its chunk colliders, so keep the body but leave coll null:
    // the dart rides on the body's transform alone and survives the remesh.
    // The body is gone for good when the Foamer pops, and stepStuck drops
    // the dart then, exactly like the collider-removed case.
    if (rb && !rb.isFixed()) {
      const p = rb.translation();
      const r = rb.rotation();
      this._q.set(r.x, r.y, r.z, r.w);
      this._qi.copy(this._q).invert();
      s.local.copy(s.pos).sub(p).applyQuaternion(this._qi);
      s.lquat.copy(this._qi).multiply(s.quat);
      s.body = rb;
      s.coll = !rb.isKinematic() ? hit.collider : null;
    }
  }

  // -- pooling -----------------------------------------------------------

  // Oldest-first recycle: the stale dart in this state is freed when a cap is
  // reached. Called at most once per step and only then.
  private killOldest(state: number) {
    let best = -1;
    let bestOrd = Infinity;
    for (let i = 0; i < this.slots.length; i++) {
      const s = this.slots[i];
      if (s.alive && s.state === state && s.order < bestOrd) {
        bestOrd = s.order;
        best = i;
      }
    }
    if (best >= 0) this.kill(best);
  }

  private kill(i: number) {
    this.killSlot(this.slots[i]);
  }

  private killSlot(s: Slot) {
    if (!s.alive) return;
    const list = this.list[s.type];
    const last = list.length - 1;
    const other = list[last];
    list[s.inst] = other;
    this.slots[other].inst = s.inst;
    list.pop();
    this.count[s.state]--;
    s.alive = false;
    s.body = null;
    s.coll = null;
    this.free.push(this.slots.indexOf(s));
  }
}
