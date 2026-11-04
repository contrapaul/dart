import * as THREE from "three";
import type RAPIER from "@dimforge/rapier3d-compat";
import type { Rapier } from "../physics/world";
import { FOAMER_GROUPS, CAPSULE_GROUPS } from "../physics/world";
import { materialId, linearColorTable } from "../voxel/materials";
import type { DebrisSystem } from "../voxel/debris";
import type { Foamer } from "./foamer";
import foamerData from "../../data/foamers.json";

// GAME-10a: the F02 Roamer's foam ball. A ball is kinematic (no physics
// body), stepped by raycasts like a dart: it flies from the thrower's ball
// hand at a slow speed on a light arc, hurts the player once, and bursts
// into a few foam chunks when it meets the world. A hard cap bounds the
// live count. The parry (GAME-10b) will find balls by their shared material.
// Tuning lives in data/foamers.json (`ball` on the base spec).
// The throw itself is reported by the Foamer system (its "throw" sound
// event); this system's sounds are the ball's own hits and bursts.

const BALL = foamerData.test.ball;

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
}

export type ProjectileSound = "burst";

export class ProjectileSystem {
  /** Live balls, oldest first. Capped at ball.maxLive. */
  readonly list: LiveBall[] = [];
  readonly group = new THREE.Group();
  /** Called when a ball bursts (anywhere, the player or the world), at the
   *  burst point. */
  onSound: (kind: ProjectileSound, at: THREE.Vector3) => void = () => {};
  /** Called once when a ball meets the player's capsule, with the ball.
   *  The game decides the damage and whether the shield took it. */
  onHitPlayer: (ball: LiveBall) => void = () => {};
  stats = { thrown: 0, burst: 0, hitPlayer: 0 };

  private _po = { x: 0, y: 0, z: 0 };
  private _pd = { x: 0, y: 0, z: 0 };
  private _ray: RAPIER.Ray;
  private _hit = new THREE.Vector3();
  private _dir = new THREE.Vector3();

  constructor(
    private rapier: Rapier,
    private world: RAPIER.World,
    private debris: DebrisSystem,
    /** The player's capsule: the one collider a ball reports as a hit. */
    private playerCollider: RAPIER.Collider,
  ) {
    this._ray = new this.rapier.Ray(this._po, this._pd);
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
    this.list.push({ pos: at.clone(), vel, age: 0, mesh, thrower: f });
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
        // Foamers are not blockers: a ball from the pack flies through the
        // pack (its own thrower's parts would otherwise stop it in the
        // hand), and the movement capsule sits inside the body voxels, as
        // for the darts (exact group match, so a floor is never excluded).
        (c) => {
          const g = c.collisionGroups();
          return g !== FOAMER_GROUPS && g !== CAPSULE_GROUPS;
        },
      );
      if (!hit) {
        b.pos.addScaledVector(b.vel, dt);
        b.mesh.position.copy(b.pos);
        continue;
      }
      const t = Math.min(maxDist, hit.timeOfImpact);
      b.pos.addScaledVector(b.vel, t);
      if (hit.collider === this.playerCollider) {
        this.stats.hitPlayer++;
        this.onHitPlayer(b);
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
