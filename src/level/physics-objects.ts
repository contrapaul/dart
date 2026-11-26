import * as THREE from "three";
import type RAPIER from "@dimforge/rapier3d-compat";
import { SIGHT_QUERY_GROUPS, type Rapier } from "../physics/world";
import { surfaceMaterial } from "../render/surfaces";
import { materialId } from "../voxel/materials";
import type { DebrisSystem } from "../voxel/debris";
import { foamMaterialFor } from "./prims";
import { dartDamageOf, type BlastProfileName } from "./breakables";
import type { DartHit } from "../weapons/darts";
import type { PhysicsObject } from "./format";
import tuning from "../../data/physics.json";
import explosionData from "../../data/explosion.json";
import destruction from "../../data/destruction.json";

// ED-33 (design/EDITOR-V2.md, Paul's item 13): the physics objects. Each is
// a Rapier dynamic body of its own size and mass, drawn with its colour and
// surface, that rests on the floor, sleeps when still, and takes an impulse
// from a dart or a blast. A physics object with hit points breaks the way an
// ED-06 breakable does: a dart, a blast or a swing takes them off, and at
// zero it bursts into foam chunks through the shared debris system (its ring
// is the hard cap). Restart puts every one back where the level left it.
//
// The tuning is data/physics.json. Two figures are read where they live:
// a dart's impulse is scaled by the damage that dart already deals a Foamer
// (data/foamers.json), so a heavier round shoves harder, and a blast's
// impulse falls over the profile's own rangeMetres (data/explosion.json).
//
// A body that hits the player or a Foamer calls the target's `hit` once per
// contact, with damage * (closing speed - damageSpeed). The page supplies
// the targets (it owns health and the Foamers); this file only needs where
// they are and how to hurt them, so it stays testable.

const T = tuning as unknown as {
  damageSpeed: number; bounce: number; friction: number; dartImpulse: number;
  blastImpulse: number; maxLive: number; sleepSeconds: number; sleepSpeed: number;
};
const B = destruction.breakables;
/** The damage a standard dart deals a Foamer: the impulse's scale, one copy. */
const STANDARD_DAMAGE = dartDamageOf("standard");

const DEG = Math.PI / 180;
const _v = new THREE.Vector3();
const _away = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

/** Something a falling physics object can hit: the player or a Foamer. The
 *  page builds the list each step, because Foamers come and go. */
export interface PhysicsTarget {
  /** Stable for the contact: "player", or a Foamer's key. */
  key: string;
  position: THREE.Vector3;
  /** Half size of the thing, in metres, for the touch test. */
  radius: number;
  /** Take the damage. Called at most once per contact. */
  hit: (amount: number, at: THREE.Vector3) => void;
}

/** The damage a closing object deals: nothing below the threshold, then the
 *  object's damage per metre a second past it. Pure, so the rule is read in
 *  one place. */
export function impactDamage(damage: number, closingSpeed: number): number {
  if (damage <= 0 || closingSpeed <= T.damageSpeed) return 0;
  return damage * (closingSpeed - T.damageSpeed);
}

/** One physics object and its live state. */
export interface PhysicsLive {
  readonly spec: PhysicsObject;
  readonly body: RAPIER.RigidBody;
  readonly collider: RAPIER.Collider;
  readonly mesh: THREE.Mesh;
  hp: number;
  readonly maxHp: number;
  alive: boolean;
  shown: boolean;
  /** Seconds it has rested; it sleeps at data/physics.json sleepSeconds. */
  still: number;
  /** The targets it has already hit while in contact, by key. */
  touched: Set<string>;
}

interface Body {
  home: { translation: THREE.Vector3; rotation: THREE.Quaternion };
}
type Tracked = PhysicsLive & Body;

/** The mesh geometry for a shape. A sphere's size[0] is its diameter, a
 *  cylinder's size[0] is its width and size[1] its height (src/level/format.ts). */
function geometryOf(spec: PhysicsObject): THREE.BufferGeometry {
  const [x, y, z] = spec.size;
  switch (spec.shape) {
    case "cylinder": return new THREE.CylinderGeometry(x / 2, x / 2, y, 20);
    case "sphere": return new THREE.SphereGeometry(x / 2, 20, 14);
    default: return new THREE.BoxGeometry(x, y, z);
  }
}

/** The collider description for a shape, with the object's mass set on it so
 *  the body's mass is exactly what the level asked for. */
function colliderOf(rapier: Rapier, spec: PhysicsObject): RAPIER.ColliderDesc {
  const [x, y, z] = spec.size;
  const desc = spec.shape === "cylinder" ? rapier.ColliderDesc.cylinder(y / 2, x / 2)
    : spec.shape === "sphere" ? rapier.ColliderDesc.ball(x / 2)
      : rapier.ColliderDesc.cuboid(x / 2, y / 2, z / 2);
  return desc
    .setMass(spec.mass)
    .setRestitution(spec.bounce ?? T.bounce)
    .setFriction(T.friction);
}

/** Where the player and the Foamers are, rebuilt each step by the page. */
export type TargetList = () => PhysicsTarget[];

export class PhysicsObjects {
  /** ED-06: the level's chunk burst, set by the page once the debris system
   *  exists. Without one a break still takes the object away, quietly. */
  debris: DebrisSystem | null = null;
  /** The things a moving object can hurt. Empty until the page sets it. */
  targets: TargetList = () => [];
  /** An object broke: the page sounds it and frees the darts stuck in it. */
  onBreak: (o: PhysicsLive, at: THREE.Vector3) => void = () => {};
  private readonly live: Tracked[] = [];
  private readonly byCollider = new Map<number, Tracked>();
  private readonly ray: RAPIER.Ray;

  constructor(
    rapier: Rapier,
    private world: RAPIER.World,
    parent: THREE.Object3D,
    specs: PhysicsObject[],
  ) {
    this.ray = new rapier.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -1 });
    for (const spec of specs) this.live.push(this.build(rapier, parent, spec));
  }

  private build(rapier: Rapier, parent: THREE.Object3D, spec: PhysicsObject): Tracked {
    const mesh = new THREE.Mesh(geometryOf(spec), surfaceMaterial(spec.surface, spec.colour));
    mesh.castShadow = mesh.receiveShadow = true;
    parent.add(mesh);

    const r = spec.rot ?? [0, 0, 0];
    const rotation = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(r[0] * DEG, r[1] * DEG, r[2] * DEG, "XYZ"),
    );
    const body = this.world.createRigidBody(rapier.RigidBodyDesc.dynamic()
      .setTranslation(spec.pos[0], spec.pos[1], spec.pos[2])
      .setRotation({ x: rotation.x, y: rotation.y, z: rotation.z, w: rotation.w }));
    const collider = this.world.createCollider(colliderOf(rapier, spec), body);
    const hp = spec.hitPoints ?? 0;
    const state: Tracked = {
      spec, body, collider, mesh,
      hp: spec.breakable ? hp : 0,
      maxHp: spec.breakable ? hp : 0,
      alive: true,
      shown: spec.hidden !== true,
      still: 0,
      touched: new Set(),
      home: { translation: new THREE.Vector3(...spec.pos), rotation },
    };
    this.byCollider.set(collider.handle, state);
    if (spec.hidden) this.setShownOf(state, false);
    else if (spec.asleep) body.sleep();
    return state;
  }

  /** Every object, broken or not, in file order. */
  get list(): readonly PhysicsLive[] { return this.live; }

  /** Hit points left, or undefined for an id that is not breakable here. */
  hpOf(id: string): number | undefined {
    const o = this.live.find((l) => l.spec.id === id);
    return o && o.maxHp > 0 ? o.hp : undefined;
  }

  /** The object a collider belongs to, or null. */
  owns(collider: RAPIER.Collider): PhysicsLive | null {
    return this.byCollider.get(collider.handle) ?? null;
  }

  /** A dart's hit: damage the object deals the dart's own damage, then shove
   *  it with an impulse along the dart's travel, at the point it struck. */
  onDartHit(hit: DartHit): void {
    const o = this.byCollider.get(hit.collider.handle);
    if (!o || !o.alive) return;
    if (o.spec.breakable) this.damage(o, dartDamageOf(hit.type));
    if (!o.alive) return;
    const scale = STANDARD_DAMAGE > 0 ? dartDamageOf(hit.type) / STANDARD_DAMAGE : 0;
    const strength = T.dartImpulse * scale;
    if (strength <= 0) return;
    o.body.applyImpulseAtPoint(
      { x: hit.direction.x * strength, y: hit.direction.y * strength, z: hit.direction.z * strength },
      { x: hit.point.x, y: hit.point.y, z: hit.point.z }, true,
    );
  }

  /** A blast: shove every object in reach away from its point, and take the
   *  profile's damage off a breakable one (its damageCentre at the centre,
   *  falling linearly to 0 at rangeMetres, the ED-06 rule). */
  blast(point: THREE.Vector3, profile: BlastProfileName = "dart"): void {
    const P = explosionData.profiles[profile];
    const reach = P.rangeMetres;
    for (const o of this.live) {
      if (!o.alive || !o.shown) continue;
      const d = this.centreOf(o).distanceTo(point);
      if (d > reach) continue;
      const fall = 1 - d / reach;
      if (o.spec.breakable) this.damage(o, P.damageCentre * fall);
      if (!o.alive) continue;
      _away.copy(this.centreOf(o)).sub(point);
      if (_away.lengthSq() < 1e-6) _away.copy(UP);
      _away.normalize().multiplyScalar(T.blastImpulse * fall);
      o.body.applyImpulse({ x: _away.x, y: _away.y, z: _away.z }, true);
    }
  }

  /** A swing: the first object the line from the eye meets within reach takes
   *  the swing's damage, the way an ED-06 breakable does. */
  swing(eye: THREE.Vector3, forward: THREE.Vector3, reach: number, damage: number,
    exclude?: RAPIER.Collider): void {
    this.ray.origin = { x: eye.x, y: eye.y, z: eye.z };
    this.ray.dir = { x: forward.x, y: forward.y, z: forward.z };
    const hit = this.world.castRay(this.ray, reach, true, undefined, SIGHT_QUERY_GROUPS, exclude);
    if (!hit) return;
    const o = this.byCollider.get(hit.collider.handle);
    if (!o || !o.alive) return;
    this.damage(o, damage);
  }

  /** A mid level move (ED-31's move trigger): shift an object and wake it. */
  moveBy(id: string, offset: THREE.Vector3): void {
    const o = this.live.find((l) => l.spec.id === id);
    if (!o) return;
    const t = o.body.translation();
    _v.set(t.x + offset.x, t.y + offset.y, t.z + offset.z);
    o.body.setTranslation({ x: _v.x, y: _v.y, z: _v.z }, true);
  }

  /** A move trigger's turn about Y: an angle in degrees, from where it is. */
  turnBy(id: string, degrees: number): void {
    const o = this.live.find((l) => l.spec.id === id);
    if (!o) return;
    const q = o.body.rotation();
    const turned = new THREE.Quaternion(q.x, q.y, q.z, q.w)
      .multiply(new THREE.Quaternion().setFromAxisAngle(UP, degrees * DEG));
    o.body.setRotation({ x: turned.x, y: turned.y, z: turned.z, w: turned.w }, true);
  }

  /** Show or hide an object: off, it is invisible and out of the simulation,
   *  so a hidden one waits where the level put it. */
  setShown(id: string, shown: boolean): void {
    const o = this.live.find((l) => l.spec.id === id);
    if (o) this.setShownOf(o, shown);
  }

  private setShownOf(o: Tracked, shown: boolean): void {
    o.shown = shown;
    o.mesh.visible = shown;
    o.body.setEnabled(shown);
    o.collider.setEnabled(shown);
  }

  /** Fixed step, after world.step(): copy each body to its mesh, sleep the
   *  ones that have rested, keep the awake cap, and let a fast object hurt
   *  what it touches. */
  update(dt: number): void {
    const targets = this.targets();
    for (const o of this.live) {
      if (!o.alive || !o.shown) continue;
      const t = o.body.translation();
      o.mesh.position.set(t.x, t.y, t.z);
      const r = o.body.rotation();
      o.mesh.quaternion.set(r.x, r.y, r.z, r.w);
    }
    this.rest(dt);
    this.hurt(targets);
    this.capAwake();
  }

  /** Puts every object back where the level put it, whole and asleep if it
   *  started asleep. A broken one comes back. */
  reset(): void {
    for (const o of this.live) {
      o.hp = o.maxHp;
      o.alive = true;
      o.still = 0;
      o.touched.clear();
      const home = o.home;
      o.body.setTranslation(home.translation, false);
      o.body.setRotation({ x: home.rotation.x, y: home.rotation.y, z: home.rotation.z, w: home.rotation.w }, false);
      o.body.setLinvel({ x: 0, y: 0, z: 0 }, false);
      o.body.setAngvel({ x: 0, y: 0, z: 0 }, false);
      this.setShownOf(o, o.spec.hidden !== true);
      if (o.spec.hidden !== true && o.spec.asleep) o.body.sleep();
      o.mesh.position.copy(home.translation);
      o.mesh.quaternion.copy(home.rotation);
    }
  }

  /** The awake bodies, for the cap and the page's debug hook. */
  get awake(): number {
    return this.live.filter((o) => o.alive && o.shown && !o.body.isSleeping()).length;
  }

  private centreOf(o: Tracked, out = _v): THREE.Vector3 {
    const t = o.body.translation();
    return out.set(t.x, t.y, t.z);
  }

  /** A body that has rested sleepSeconds goes to sleep; anything moving
   *  wipes the count. Rapier wakes one on the next touch by itself. */
  private rest(dt: number): void {
    for (const o of this.live) {
      if (!o.alive || !o.shown || o.body.isSleeping()) continue;
      const v = o.body.linvel();
      const spin = o.body.angvel();
      const slow = Math.hypot(v.x, v.y, v.z) <= T.sleepSpeed
        && Math.hypot(spin.x, spin.y, spin.z) <= T.sleepSpeed;
      o.still = slow ? o.still + dt : 0;
      if (o.still >= T.sleepSeconds) {
        o.body.sleep();
        o.still = 0;
      }
    }
  }

  /** The hard cap on awake bodies: the extras go to sleep until something
   *  wakes them. It keeps a pile of placed boxes from costing the frame. */
  private capAwake(): void {
    let awake = 0;
    for (const o of this.live) {
      if (!o.alive || !o.shown || o.body.isSleeping()) continue;
      awake++;
      if (awake > T.maxLive) o.body.sleep();
    }
  }

  /** Once per contact: a target touched by a fast object takes the damage,
   *  and keeps taking none until the two separate. */
  private hurt(targets: PhysicsTarget[]): void {
    for (const o of this.live) {
      if (!o.alive || !o.shown || o.spec.damage <= 0) continue;
      if (o.touched.size === 0 && targets.length === 0) continue;
      const centre = this.centreOf(o, new THREE.Vector3());
      const radius = Math.hypot(o.spec.size[0], o.spec.size[1], o.spec.size[2]) / 2;
      const v = o.body.linvel();
      for (const target of targets) {
        _away.copy(target.position).sub(centre);
        const d = _away.length();
        if (d > radius + target.radius) {
          o.touched.delete(target.key);
          continue;
        }
        if (o.touched.has(target.key) || d < 1e-6) continue;
        const closing = (_away.x * v.x + _away.y * v.y + _away.z * v.z) / d;
        const amount = impactDamage(o.spec.damage, closing);
        if (amount <= 0) continue;
        o.touched.add(target.key);
        target.hit(amount, centre);
      }
    }
  }

  private damage(o: Tracked, amount: number): void {
    if (!o.alive || !o.spec.breakable || o.maxHp <= 0) return;
    o.hp -= amount;
    if (o.hp > 0) return;
    o.hp = 0;
    o.alive = false;
    // Gone: out of the world and into foam chunks, the ED-06 burst rule.
    this.setShownOf(o, false);
    const [x, y, z] = o.spec.size;
    const count = THREE.MathUtils.clamp(
      Math.round(x * y * z * B.chunksPerCubicMetre), B.minChunks, B.maxChunks,
    );
    this.debris?.burst(o.mesh.position, count, B.chunkSize, materialId(foamMaterialFor(o.spec.colour)));
    this.onBreak(o, o.mesh.position);
  }
}
