import * as THREE from "three";
import type RAPIER from "@dimforge/rapier3d-compat";
import type { Rapier } from "../physics/world";
import { FOAMER_GROUPS, CAPSULE_GROUPS } from "../physics/world";
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
}

export type ProjectileSound = "burst" | "parryHit";

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

  constructor(
    private rapier: Rapier,
    private world: RAPIER.World,
    private debris: DebrisSystem,
    /** The player's capsule: the one collider a ball reports as a hit. */
    private playerCollider: RAPIER.Collider,
    private foamers: FoamerSystem,
  ) {
    this._ray = new this.rapier.Ray(this._po, this._pd);
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
   *  The cap drops the oldest ball when it is already full. */
  launch(f: Foamer, playerEye: THREE.Vector3): void {
    const hand = f.parts.get("ball");
    const at = this._hit;
    if (hand) {
      // The part's body centre, the point onSound uses for a part too.
      const t = hand.body.translation();
      at.set(t.x, t.y, t.z);
    } else at.copy(f.centre).setY(f.centre.y + f.height * 0.7);
    // Aim at the eye with just enough loft for the light arc to bring the
    // ball back to it: a flat shot at this speed over this distance would
    // dip a hand's width by the time it arrives.
    this._dir.copy(playerEye).sub(at);
    const flat = Math.hypot(this._dir.x, this._dir.z);
    if (flat < 1e-3) return; // thrown at its own position: skip the step
    const t = flat / BALL.speed;
    this._dir.normalize();
    const vy = (playerEye.y - at.y) / t + 0.5 * BALL.gravity * t;
    const vel = new THREE.Vector3(
      this._dir.x * BALL.speed,
      vy,
      this._dir.z * BALL.speed,
    );
    while (this.list.length >= BALL.maxLive) this.remove(this.list[0]!);
    const mesh = new THREE.Mesh(BALL_GEOMETRY, BALL_MATERIAL);
    mesh.scale.setScalar(BALL.radius);
    mesh.position.copy(at);
    this.group.add(mesh);
    this.list.push({ pos: at.clone(), vel, age: 0, mesh, thrower: f, bounced: false, flatSpeed: 0, steerLeft: 0 });
    this.stats.thrown++;
  }

  /** Fixed step: fly every ball, report hits. Balls have no bodies, so
   *  this needs no place in the physics order; call it once per step. */
  update(dt: number): void {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const b = this.list[i]!;
      b.age += dt;
      if (b.age >= BALL.lifetime) {
        this.burstAt(b.pos);
        this.remove(b);
        continue;
      }
      // GAME-04 stage 2: a bounced ball re-aims at the thrower's chest while its
      // steering time runs; then it flies straight.
      if (b.bounced && b.steerLeft > 0) {
        b.steerLeft = Math.max(0, b.steerLeft - dt);
        this.steerBounce(b);
      }
      b.vel.y -= BALL.gravity * dt;
      const speed = b.vel.length();
      const maxDist = speed * dt;
      this._po.x = b.pos.x;
      this._po.y = b.pos.y;
      this._po.z = b.pos.z;
      this._pd.x = b.vel.x / speed;
      this._pd.y = b.vel.y / speed;
      this._pd.z = b.vel.z / speed;
      const hit = this.world.castRay(
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
        (c) => {
          if (b.bounced && c === this.playerCollider) return false;
          const g = c.collisionGroups();
          if (g === CAPSULE_GROUPS) return false;
          return !b.bounced ? g !== FOAMER_GROUPS : true;
        },
      );
      if (!hit) {
        b.pos.addScaledVector(b.vel, dt);
        b.mesh.position.copy(b.pos);
        continue;
      }
      const t = Math.min(maxDist, hit.timeOfImpact);
      b.pos.addScaledVector(b.vel, t);
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
        this.burstAt(b.pos);
        this.remove(b);
      } else if (hit.collider === this.playerCollider) {
        this.stats.hitPlayer++;
        this.onHitPlayer(b);
        if (b.bounced) continue; // the game parried it: it flies back
        this.burstAt(b.pos);
        this.remove(b);
      } else {
        this.burstAt(b.pos);
        this.remove(b);
      }
    }
  }

  /** Remove every ball (the pages' clear button and tests). */
  clear(): void {
    while (this.list.length) this.remove(this.list[0]!);
  }

  private burstAt(at: THREE.Vector3): void {
    this.stats.burst++;
    this.onSound("burst", at);
    // A few chunks out of the burst point: the debris system owns their
    // physics and their fade.
    this.debris.burst(at, BALL.chunks, BALL.radius * 1.6, materialId("foam-pink"));
  }

  private remove(b: LiveBall): void {
    const i = this.list.indexOf(b);
    if (i >= 0) this.list.splice(i, 1);
    this.group.remove(b.mesh);
  }
}
