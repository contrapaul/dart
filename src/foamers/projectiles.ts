import * as THREE from "three";
import type RAPIER from "@dimforge/rapier3d-compat";
import type { Rapier } from "../physics/world";
import { FOAMER_GROUPS, CAPSULE_GROUPS, DEBRIS_GROUPS } from "../physics/world";
import { materialId, linearColorTable } from "../voxel/materials";
import type { DebrisSystem } from "../voxel/debris";
import type { Foamer } from "./foamer";
import type { FoamerSystem } from "./foamers";
import foamerData from "../../data/foamers.json";
import shieldJson from "../../data/shield.json";

// GAME-10a: the F02 Roamer's foam ball. A ball is kinematic (no physics
// body), stepped by raycasts like a dart: it flies from the thrower's ball
// hand at a slow speed on a light arc, hurts the player once, and bursts
// into a few foam chunks when it meets the world. A hard cap bounds the
// live count. The parry (GAME-04 stage 2) will find balls by their shared material.
// Tuning lives in data/foamers.json (`ball` on the base spec).
// The throw itself is reported by the Foamer system (its "throw" sound
// event); this system's sounds are the ball's own hits and bursts.

const BALL = foamerData.test.ball;
/** GAME-04 stage 2: the bounce-back's numbers from the shield's data (the
 *  bouncing ball is the shield's, so its tuning sits with the shield's). */
const PARRY = shieldJson.parry as unknown as {
  speedShare: number;
  steerSec: number;
  damage: number;
  stagger: number;
};

/** The material every live ball is drawn with. The parry looks balls up by
 *  this exact object, so there is exactly one of it. */
export const BALL_MATERIAL = new THREE.MeshStandardMaterial({
  // The palette is linear (the voxel meshes read the same table).
  color: new THREE.Color().fromArray(linearColorTable(), materialId("foam-pink") * 3),
  roughness: 0.6,
  emissive: new THREE.Color(0x55102f),
  emissiveIntensity: 1,
});

const BALL_GEOMETRY = new THREE.SphereGeometry(1, 12, 9);

/** GAME-10c: the small blob's material. Deliberately not BALL_MATERIAL:
 *  the pages parry by material identity, and a small blob is not
 *  parryable. */
export const BLOB_MATERIAL = new THREE.MeshStandardMaterial({
  color: new THREE.Color().fromArray(linearColorTable(), materialId("foam-lime") * 3),
  roughness: 0.6,
});
/** GAME-10c: the share of its speed a small blob keeps off each bounce. */
const BLOB_RESTITUTION = 0.75;

export interface LiveBall {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  age: number;
  mesh: THREE.Mesh;
  /** The Foamer that threw it (for the report; may already be gone). */
  thrower: Foamer;
  /** GAME-04 stage 2: it was parried and is flying back at the thrower. */
  bounced: boolean;
  /** The bounce's horizontal speed, held while it steers. */
  flatSpeed: number;
  /** Seconds of steering left; 0 flies straight. */
  steerLeft: number;
  /** GAME-10c: the attack that made it, for the page's damage lookup
   *  (damageOf(attack, thrower.spec)). "throw" for a Roamer's ball. */
  attack: string;
  /** GAME-10c: bounces left off geometry for a Floater's small blob; 0 for
   *  every ball that bursts on the first touch. */
  bounceLeft: number;
  /** GAME-10c: this ball's own gravity (a blob's, not the shared ball's). */
  gravity: number;
  /** GAME-10c: chunks at the burst, this attack's number. */
  chunks: number;
  /** GAME-10c: the burst's material id (the small blob is lime foam). */
  material: number;
  /** GAME-10c: seconds it lives (a blob's own lifetime). */
  lifetime: number;
}

/** GAME-10c: what one launch makes. A Roamer's ball is the default (the
 *  shared pink material, the shared `ball` numbers, parryable by material
 *  identity); a Floater's blob brings its own speed, gravity, size, life,
 *  burst chunks, colour and bounce count. */
export interface BallKind {
  attack: string;
  speed: number;
  gravity: number;
  radius: number;
  lifetime: number;
  chunks: number;
  material: number;
  mesh: THREE.MeshStandardMaterial;
  bounces: number;
  maxLive: number;
}

export type ProjectileSound = "burst" | "parryHit" | "blobBounce";

/** The ball every ordinary throw launches: the shared `ball` numbers and the
 *  parryable pink material. GAME-10h: the one place launch's old per-field
 *  defaults live, so launch and the wall share one spawn path. */
const SHARED_BALL_KIND: BallKind = {
  attack: "throw", speed: BALL.speed, gravity: BALL.gravity, radius: BALL.radius,
  lifetime: BALL.lifetime, chunks: BALL.chunks, material: materialId("foam-pink"),
  mesh: BALL_MATERIAL, bounces: 0, maxLive: BALL.maxLive,
};

export class ProjectileSystem {
  /** Live balls, oldest first. Capped at ball.maxLive. */
  readonly list: LiveBall[] = [];
  readonly group = new THREE.Group();
  /** Called when a ball bursts (anywhere, the player or the world), at the
   *  burst point. */
  onSound: (kind: ProjectileSound, at: THREE.Vector3) => void = () => {};
  /** Called once when a ball meets the player's capsule, with the ball.
   *  The game decides the damage and whether the shield took it; if it
   *  parries the ball (GAME-04 stage 2, Shield.canParry plus the front arc) it
   *  keeps it alive and flies: the ball keeps going (parried), and the
   *  next step moves it back toward its thrower. */
  onHitPlayer: (ball: LiveBall) => void = () => {};
  stats = { thrown: 0, burst: 0, hitPlayer: 0, bounced: 0, parryHits: 0 };

  private _po = { x: 0, y: 0, z: 0 };
  private _pd = { x: 0, y: 0, z: 0 };
  private _ray: RAPIER.Ray;
  private _hit = new THREE.Vector3();
  private _dir = new THREE.Vector3();
  private readonly _aim = new THREE.Vector3();
  /** BUG-07: the flight check's ball shape and its two scratch vectors. */
  private readonly _ballShape: RAPIER.Ball;
  private readonly _fv = new THREE.Vector3();
  private _shapePos = { x: 0, y: 0, z: 0 };
  private _shapeVel = { x: 0, y: 0, z: 0 };

  constructor(
    private rapier: Rapier,
    private world: RAPIER.World,
    private debris: DebrisSystem,
    /** The player's capsule: the one collider a ball reports as a hit. */
    private playerCollider: RAPIER.Collider,
    private foamers: FoamerSystem,
  ) {
    this._ray = new this.rapier.Ray(this._po, this._pd);
    this._ballShape = new this.rapier.Ball(BALL.radius);
  }

  /** Where a ball leaves `f`: its ball hand's part centre (the point
   *  onSound uses for a part too), or a hand up its body when the part is
   *  gone. The launch and the flight check share this, so the two start at
   *  the same point. */
  handAt(f: Foamer, out: THREE.Vector3): THREE.Vector3 {
    const hand = f.parts.get("ball");
    if (!hand) return out.copy(f.centre).setY(f.centre.y + f.height * 0.7);
    const t = hand.body.translation();
    return out.set(t.x, t.y, t.z);
  }

  /** The velocity `launch` gives a ball thrown from `from` at `eye`, its
   *  light loft included. False when there is nothing to throw at (the two
   *  points coincide), which is also the launch's own guard. */
  private launchVelocity(
    from: THREE.Vector3, eye: THREE.Vector3, spreadDeg: number, out: THREE.Vector3,
    speed = BALL.speed, gravity = BALL.gravity,
  ): boolean {
    this._dir.copy(eye).sub(from);
    const flat = Math.hypot(this._dir.x, this._dir.z);
    if (flat < 1e-3) return false;
    const t = flat / speed;
    this._dir.normalize();
    if (spreadDeg !== 0) {
      const s = Math.sin((spreadDeg * Math.PI) / 180);
      const c = Math.cos((spreadDeg * Math.PI) / 180);
      const x = this._dir.x * c - this._dir.z * s;
      const z = this._dir.x * s + this._dir.z * c;
      this._dir.set(x, this._dir.y, z);
    }
    out.set(this._dir.x * speed,
      (eye.y - from.y) / t + 0.5 * gravity * t, this._dir.z * speed);
    return true;
  }

  /** BUG-07: can a ball thrown from `from` at `eye` reach it, or does it
   *  meet the world on the way? The Foamer's sight ray runs chest to eye,
   *  but the ball leaves the hand lower and on an arc, so a clear sight
   *  does not mean a clear throw. This samples the launch's own arc (its
   *  velocity and BALL.gravity) in `ball.flightSegments` shape casts of the
   *  ball's radius, with the filters the ball's own step uses: level
   *  geometry stops it, while capsules, debris and Foamer parts (its own
   *  hand included) do not. Not free, so callers keep it off the per-step
   *  path (see FoamerSystem). */
  flightClear(from: THREE.Vector3, eye: THREE.Vector3): boolean {
    if (!this.launchVelocity(from, eye, 0, this._fv)) return false;
    // The flight time launch() aimed with: the flat distance over the flat
    // speed (the loft is the vertical part and does not shorten it).
    const span = Math.hypot(eye.x - from.x, eye.z - from.z)
      / Math.max(1e-6, Math.hypot(this._fv.x, this._fv.z));
    const n = Math.max(1, Math.round(BALL.flightSegments));
    const step = span / n;
    let x = from.x, y = from.y, z = from.z;
    for (let i = 1; i <= n; i++) {
      const t = i * step;
      const nx = from.x + this._fv.x * t;
      const ny = from.y + this._fv.y * t - 0.5 * BALL.gravity * t * t;
      const nz = from.z + this._fv.z * t;
      this._shapePos.x = x;
      this._shapePos.y = y;
      this._shapePos.z = z;
      this._shapeVel.x = nx - x;
      this._shapeVel.y = ny - y;
      this._shapeVel.z = nz - z;
      const hit = this.world.castShape(
        this._shapePos, { x: 0, y: 0, z: 0, w: 1 }, this._shapeVel, this._ballShape,
        0, 1, true, 8 /* EXCLUDE_SENSORS */, undefined, undefined, undefined,
        (c) => c !== this.playerCollider && !this.ballIgnores(c, false),
      );
      if (hit) return false;
      x = nx;
      y = ny;
      z = nz;
    }
    return true;
  }

  /** Whether a ball ignores this collider, for the ball's own step and for
   *  the flight check, so the two agree on what is in the way. A ball from
   *  the pack flies through foam chunks (BUG-06: a parry bursts on the
   *  thrower and leaves chunks where the next ball is thrown from), other
   *  Foamers' movement capsules and every Foamer part, its own ball hand
   *  included. A bounced ball is the opposite on Foamers (every one stops
   *  it) and never on the player (a bounced ball cannot hurt the player).
   *  The player's capsule is named, not found by group: its groups are the
   *  world's. */
  private ballIgnores(c: RAPIER.Collider, bounced: boolean): boolean {
    if (c === this.playerCollider) return bounced;
    const g = c.collisionGroups();
    if (g === CAPSULE_GROUPS) return true;
    if (g === DEBRIS_GROUPS) return true;
    // A fresh ball passes every Foamer; a parried one is stopped by each.
    if (g === FOAMER_GROUPS) return !bounced;
    return false;
  }

  /** GAME-04 stage 2: the bounce-back. The game calls it for the ball about to
   *  meet the player when the raised shield meets it inside the window
   *  (the page checked blocksAttackFrom and Shield.canParry; this does
   *  not check the arc). The ball keeps going (not removed) and flies out
   *  at the new speed. */
  bounce(b: LiveBall): void {
    b.bounced = true;
    // Keep the current step's position, but turn the speed to the
    // bounce-back's and its arc to fly at the thrower's chest.
    b.flatSpeed = Math.hypot(b.vel.x, b.vel.z) * PARRY.speedShare;
    b.steerLeft = PARRY.steerSec;
    this.stats.bounced++;
    this.steerBounce(b);
  }

  /** One step of the bounce's steering: re-aim at the thrower's chest,
   *  solved flight to it (an arc), while its steering time runs. */
  private steerBounce(b: LiveBall): void {
    const f = b.thrower;
    if (f.state === "down") return; // it will fly straight from here
    this._aim.set(f.centre.x, f.centre.y + f.height * 0.6, f.centre.z).sub(b.pos);
    const flat = Math.hypot(this._aim.x, this._aim.z);
    if (flat < 0.35) return; // a step is this wide at the bounce speed; closs it and fly straight
    const t = flat / b.flatSpeed;
    b.vel.set(
      (this._aim.x / flat) * b.flatSpeed,
      (this._aim.y + 0.5 * BALL.gravity * t * t) / t,
      (this._aim.z / flat) * b.flatSpeed,
    );
  }

  /** Release a ball from the thrower's ball hand toward the player's eye.
   *  The cap drops the oldest ball when it is already full.
   *  GAME-10e: `spreadDeg` swings the aim to the right of the eye, so a
   *  caller can fire a volley and spread it.
   *  GAME-10c: `kind` makes a Floater's blob instead of a Roamer's ball
   *  (its own speed, gravity, size, life, colour and bounce count). */
  launch(f: Foamer, playerEye: THREE.Vector3, spreadDeg = 0, kind?: BallKind): void {
    const at = this.handAt(f, this._hit);
    // Aim at the eye with just enough loft for the light arc to bring the
    // ball back to it: a flat shot at this speed over this distance would
    // dip a hand's width by the time it arrives.
    const vel = new THREE.Vector3();
    if (!this.launchVelocity(at, playerEye, spreadDeg, vel, kind?.speed, kind?.gravity)) return; // thrown at its own position: skip the step
    this.spawnBall(at, vel, f, kind ?? SHARED_BALL_KIND);
  }

  /** GAME-10h: the Trawler's wall. One ball per slot index, the row across
   *  the aim line: slot i sits (i - (count-1)/2) x spacingMetres to the
   *  right of `from`, and every ball flies parallel to (dirX, dirZ) at the
   *  kind's speed, flat. Parallel, not converging on the player: that is
   *  what makes the gap a gap (a player who reads it steps into the missing
   *  run and nothing touches them). The cap drops the oldest as launch does. */
  launchWall(
    f: Foamer, from: THREE.Vector3, dirX: number, dirZ: number,
    slots: number[], count: number, spacingMetres: number, kind: BallKind,
  ): void {
    const d = Math.hypot(dirX, dirZ);
    if (d < 1e-6) return;
    const ux = dirX / d, uz = dirZ / d;
    // The row's lateral axis, 90 degrees from the aim in the floor plane.
    const rx = uz, rz = -ux;
    for (const i of slots) {
      const off = (i - (count - 1) / 2) * spacingMetres;
      const at = new THREE.Vector3(from.x + rx * off, from.y, from.z + rz * off);
      const vel = new THREE.Vector3(ux * kind.speed, 0, uz * kind.speed);
      this.spawnBall(at, vel, f, kind);
    }
  }

  /** The ball every launch path ends in: cap it, draw it, add it. */
  private spawnBall(at: THREE.Vector3, vel: THREE.Vector3, f: Foamer, kind: BallKind): void {
    while (this.list.length >= kind.maxLive) this.remove(this.list[0]!);
    const mesh = new THREE.Mesh(BALL_GEOMETRY, kind.mesh);
    mesh.scale.setScalar(kind.radius);
    mesh.position.copy(at);
    this.group.add(mesh);
    this.list.push({
      pos: at.clone(), vel, age: 0, mesh, thrower: f, bounced: false, flatSpeed: 0, steerLeft: 0,
      attack: kind.attack,
      bounceLeft: kind.bounces,
      gravity: kind.gravity,
      chunks: kind.chunks,
      material: kind.material,
      lifetime: kind.lifetime,
    });
    this.stats.thrown++;
  }

  /** Fixed step: fly every ball, report hits. Balls have no bodies, so
   *  this needs no place in the physics order; call it once per step. */
  update(dt: number): void {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const b = this.list[i]!;
      b.age += dt;
      if (b.age >= b.lifetime) {
        this.burstAt(b.pos, b.chunks, b.material);
        this.remove(b);
        continue;
      }
      // GAME-04 stage 2: a bounced ball re-aims at the thrower's chest while its
      // steering time runs; then it flies straight.
      if (b.bounced && b.steerLeft > 0) {
        b.steerLeft = Math.max(0, b.steerLeft - dt);
        this.steerBounce(b);
      }
      b.vel.y -= b.gravity * dt;
      const speed = b.vel.length();
      const maxDist = speed * dt;
      this._po.x = b.pos.x;
      this._po.y = b.pos.y;
      this._po.z = b.pos.z;
      this._pd.x = b.vel.x / speed;
      this._pd.y = b.vel.y / speed;
      this._pd.z = b.vel.z / speed;
      const hit = this.world.castRayAndGetNormal(
        this._ray,
        maxDist,
        true,
        8, // QueryFilterFlags.EXCLUDE_SENSORS, as the dart system's ray
        undefined,
        undefined,
        undefined,
        // A ball from the pack flies through the pack (its own thrower's
        // parts would otherwise stop it in the hand), and the movement
        // capsules sit inside the body voxels, as for the darts (their
        // own group; a floor is never excluded). A bounced ball is the
        // opposite: every Foamer stops it (the thrower, any other on the
        // way), the world bursts it, and the player's own capsule never
        // does (a bounced ball cannot hurt the player; the capsule is
        // named here, not by group, because its groups are the world's).
        (c) => !this.ballIgnores(c, b.bounced),
      );
      if (!hit) {
        b.pos.addScaledVector(b.vel, dt);
        b.mesh.position.copy(b.pos);
        continue;
      }
      // BUG-06: timeOfImpact is a distance in metres along the unit ray
      // (as the dart system's is), not seconds. Scaling the velocity by
      // it flew the ball a speed times too far, through the capsule's
      // front, so onHitPlayer judged the throw as coming from behind.
      const t = Math.min(maxDist, hit.timeOfImpact);
      b.pos.addScaledVector(b.vel, t / speed);
      if (!b.bounced && b.bounceLeft > 0 && hit.collider !== this.playerCollider) {
        // GAME-10c: a Floater's small blob off the wall. It bounces
        // `blob.bounces` times, losing speed each time, and bursts on the
        // last touch. The player is not a wall: a blob that meets them is
        // hit and bursts like any other ball (handled below).
        const n = hit.normal;
        const dot = b.vel.x * n.x + b.vel.y * n.y + b.vel.z * n.z;
        b.vel.set(b.vel.x - 2 * dot * n.x, b.vel.y - 2 * dot * n.y, b.vel.z - 2 * dot * n.z);
        b.vel.multiplyScalar(BLOB_RESTITUTION);
        // Off the surface by its radius (the mesh scale): left touching it,
        // the next ray starts inside and spends the next bounce at once.
        b.pos.addScaledVector(n as THREE.Vector3Like, b.mesh.scale.x);
        b.bounceLeft--;
        this.onSound("blobBounce", b.pos);
        b.mesh.position.copy(b.pos);
        continue;
      }
      if (b.bounced) {
        // GAME-04 stage 2: it meets a Foamer: damage and a short stagger (the
        // dart path's death rules, no pop, and no parry back), then the
        // usual burst. The thrower it came from counts too.
        let victim: Foamer | undefined;
        for (const f of this.foamers.list) {
          for (const p of f.parts.values()) {
            if (p.owns(hit.collider)) {
              victim = f;
              break;
            }
          }
          if (victim) break;
        }
        if (victim) {
          this.stats.parryHits++;
          this.onSound("parryHit", b.pos);
          this.foamers.parryDamage(victim, PARRY.damage);
          if (victim.state !== "stagger" && victim.state !== "down")
            this.foamers.startStagger(
              victim, false, PARRY.stagger > 0 ? PARRY.stagger : victim.spec.stagger.time,
            );
        }
        this.burstAt(b.pos, b.chunks, b.material);
        this.remove(b);
      } else if (hit.collider === this.playerCollider) {
        this.stats.hitPlayer++;
        this.onHitPlayer(b);
        if (b.bounced) continue; // the game parried it: it flies back
        this.burstAt(b.pos, b.chunks, b.material);
        this.remove(b);
      } else {
        this.burstAt(b.pos, b.chunks, b.material);
        this.remove(b);
      }
    }
  }

  /** Remove every ball (the pages' clear button and tests). */
  clear(): void {
    while (this.list.length) this.remove(this.list[0]!);
  }

  private burstAt(at: THREE.Vector3, chunks = BALL.chunks, material = materialId("foam-pink")): void {
    this.stats.burst++;
    this.onSound("burst", at);
    // A few chunks out of the burst point: the debris system owns their
    // physics and their fade.
    this.debris.burst(at, chunks, BALL.radius * 1.6, material);
  }

  private remove(b: LiveBall): void {
    const i = this.list.indexOf(b);
    if (i >= 0) this.list.splice(i, 1);
    this.group.remove(b.mesh);
  }
}
