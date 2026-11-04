import * as THREE from "three";
import type RAPIER from "@dimforge/rapier3d-compat";
import { SOLID_QUERY_GROUPS, type Rapier } from "../physics/world";
import type { Input } from "../core/input";
import tuning from "../../data/player.json";

// First person movement on Rapier's kinematic character controller.
// Hybrid movement (PLAN.md 3.1): sprint, dash and mantle, no double jump.
// Tuning lives in data/player.json.

export const P = { ...tuning };

// AUD-01: the movement events the sound hooks care about. "land" is one
// touchdown after being airborne, firing with the velocity at that instant
// (vel is reused by the controller; do not retain it: at landing, vel.y
// is the fall speed, which is zeroed right after the event). "dash-ready"
// is once, when the dash cooldown expires.
export type PlayerMoveKind = "jump" | "dash" | "mantle" | "land" | "dash-ready";

const MANTLE_FILTER = 4 | 8; // QueryFilterFlags.EXCLUDE_DYNAMIC | EXCLUDE_SENSORS

export class PlayerController {
  yaw = 0;
  pitch = 0;
  grounded = false;
  readonly vel = new THREE.Vector3();
  /** AUD-01: called by the controller for each movement event, with the
   *  event kind and the velocity that step set, for the sound hooks.
   *  No-op by default. vel is reused by the controller; do not keep it.
   *  For footsteps the hook watches the public state (grounded, dash,
   *  vel, the data's strides), not an event: one grounded run while
   *  standing is every stride the player makes, and no steps come in the
   *  air, in a dash, or in a mantle. */
  onMove: (kind: PlayerMoveKind, vel: THREE.Vector3) => void = () => {};
  /** AUD-01: while a dash burst is running. */
  get dashing(): boolean { return this.dashLeft > 0; }
  /** AUD-01: while a mantle is running (the player is not grounded
   *  usefully then, and a mantle's fall is not a landing). */
  get mantling(): boolean { return this.mantle !== null; }

  /** GAME-04: while the shield is raised the walk is slower (speedScale,
   *  data/shield.json block.walkShare) and sprinting is not allowed. The
   *  shield sets both every fixed step; nothing else touches them. */
  speedScale = 1;
  allowSprint = true;
  /** GAME-10b: seconds left of a charge hit's stun. The body does not move
   *  (the look still works: yaw and pitch are set elsewhere), gravity and
   *  the floor still apply. Set by the game when a Darter runs into the
   *  player. */
  stunTime = 0;

  private body: RAPIER.RigidBody;
  readonly collider: RAPIER.Collider;
  private cc: RAPIER.KinematicCharacterController;
  private shape: RAPIER.Capsule;
  private halfHeight = P.height / 2;
  // Capsule centre now and at the previous step, for render interpolation.
  private pos = new THREE.Vector3();
  private prev = new THREE.Vector3();

  private coyote = 0;
  private jumpBuffer = 0;
  private dashLeft = 0;
  private dashCooldown = 0;
  private dashDir = new THREE.Vector3();
  private mantle: { from: THREE.Vector3; to: THREE.Vector3; t: number } | null = null;

  private forward = new THREE.Vector3();
  private right = new THREE.Vector3();
  private wish = new THREE.Vector3();

  constructor(private rapier: Rapier, private world: RAPIER.World, feet: THREE.Vector3) {
    this.pos.copy(feet).setY(feet.y + this.halfHeight);
    this.prev.copy(this.pos);
    this.body = world.createRigidBody(
      rapier.RigidBodyDesc.kinematicPositionBased().setTranslation(this.pos.x, this.pos.y, this.pos.z),
    );
    this.shape = new rapier.Capsule(this.halfHeight - P.radius, P.radius);
    this.collider = world.createCollider(
      rapier.ColliderDesc.capsule(this.halfHeight - P.radius, P.radius),
      this.body,
    );
    this.cc = world.createCharacterController(0.02);
    this.cc.enableAutostep(P.stepHeight, 0.2, false);
    this.cc.enableSnapToGround(0.3);
    this.cc.setMaxSlopeClimbAngle(THREE.MathUtils.degToRad(P.maxSlopeDeg));
    this.cc.setMinSlopeSlideAngle(THREE.MathUtils.degToRad(P.maxSlopeDeg));
    this.cc.setApplyImpulsesToDynamicBodies(true);
  }

  get feet() {
    return this.pos.y - this.halfHeight;
  }

  teleport(feet: THREE.Vector3) {
    this.pos.copy(feet).setY(feet.y + this.halfHeight);
    this.prev.copy(this.pos);
    this.vel.set(0, 0, 0);
    this.mantle = null;
    this.body.setTranslation(this.pos, true);
  }

  /** One fixed step. Call before world.step(). */
  update(dt: number, input: Input) {
    this.prev.copy(this.pos);
    const wasGrounded = this.grounded;
    this.forward.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    this.right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const m = input.move();
    this.wish.set(0, 0, 0).addScaledVector(this.forward, m.y).addScaledVector(this.right, m.x);
    // GAME-10b: stunned by a Darter's charge: no stepping, no jump, no dash.
    // The camera still turns, so the player can see what hit them.
    if (this.stunTime > 0) {
      this.stunTime = Math.max(0, this.stunTime - dt);
      this.wish.set(0, 0, 0);
      this.dashLeft = 0;
      this.jumpBuffer = 0;
    }

    this.coyote = this.grounded ? P.coyoteTime : Math.max(0, this.coyote - dt);
    this.jumpBuffer = input.wasPressed("jump") ? P.jumpBuffer : Math.max(0, this.jumpBuffer - dt);
    const dashCd = this.dashCooldown;
    this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    if (dashCd > 0 && this.dashCooldown === 0) this.onMove("dash-ready", this.vel);

    if (this.mantle) return this.stepMantle(dt);

    // Dash: a short burst along the move direction (or straight ahead).
    if (input.wasPressed("dash") && this.dashCooldown === 0) {
      this.dashDir.copy(this.wish.lengthSq() > 0.01 ? this.wish : this.forward).normalize();
      this.dashLeft = P.dashTime;
      this.dashCooldown = P.dashCooldown;
      this.onMove("dash", this.vel);
    }

    if (this.dashLeft > 0) {
      this.dashLeft -= dt;
      this.vel.set(this.dashDir.x * P.dashSpeed, 0, this.dashDir.z * P.dashSpeed);
      if (this.dashLeft <= 0) this.vel.setLength(P.sprintSpeed);
    } else {
      const speed = input.isDown("sprint") && this.allowSprint
        ? P.sprintSpeed : P.walkSpeed * this.speedScale;
      const accel = (this.grounded ? P.groundAccel : P.airAccel) * dt;
      // Move horizontal velocity toward the wished velocity.
      const dx = this.wish.x * speed - this.vel.x;
      const dz = this.wish.z * speed - this.vel.z;
      const d = Math.hypot(dx, dz);
      const k = d > accel ? accel / d : 1;
      this.vel.x += dx * k;
      this.vel.z += dz * k;

      if (this.jumpBuffer > 0 && this.coyote > 0) {
        this.vel.y = P.jumpSpeed;
        this.jumpBuffer = 0;
        this.coyote = 0;
        this.onMove("jump", this.vel);
      }
      this.vel.y = Math.max(this.vel.y - P.gravity * dt, -P.maxFallSpeed);
    }

    if (m.y > 0.5 && !this.grounded && this.tryMantle()) return this.stepMantle(dt);

    // On the ground, ask for no downward move: snap-to-ground keeps the
    // capsule on the floor. Pressing into the floor every step made Rapier
    // now and then stop the whole move against it after a millimetre or
    // two, which set the speed to zero: the hitch Paul felt while moving.
    const down = this.grounded && this.vel.y <= 0 ? 0 : this.vel.y * dt;
    const desired = { x: this.vel.x * dt, y: down, z: this.vel.z * dt };
    this.cc.computeColliderMovement(this.collider, desired, undefined, SOLID_QUERY_GROUPS);
    const moved = this.cc.computedMovement();
    this.grounded = this.cc.computedGrounded();
    this.pos.x += moved.x;
    this.pos.y += moved.y;
    this.pos.z += moved.z;
    this.body.setNextKinematicTranslation(this.pos);

    // Walls take horizontal speed away; floors and ceilings stop vertical
    // speed. A landing is read here: grounded now, not at the start of this
    // step, and the fall speed not yet zeroed.
    this.vel.x = moved.x / dt;
    this.vel.z = moved.z / dt;
    if (this.grounded && !wasGrounded && this.vel.y < 0) {
      this.onMove("land", this.vel);
    }
    if ((this.grounded && this.vel.y < 0) || (this.vel.y > 0 && moved.y < desired.y * 0.5)) {
      this.vel.y = 0;
    }
    // A mantle ends on the ledge with no step and no landing sound; the
    // mantle itself already rang its own event in tryMantle.
  }

  /** GAME-05: one step of the shield's charge: the body is driven along
   *  dir at speed through the controller's own collision (walls stop it
   *  there), with the usual gravity and landing rules. Returns the
   *  horizontal distance actually reached. The charge does not leave a
   *  velocity: the next plain step starts from rest. */
  chargeStep(dt: number, dir: THREE.Vector3, speed: number): number {
    this.prev.copy(this.pos);
    this.vel.set(dir.x * speed, 0, dir.z * speed);
    this.vel.y = Math.max(this.vel.y - P.gravity * dt, -P.maxFallSpeed);
    const down = this.grounded && this.vel.y <= 0 ? 0 : this.vel.y * dt;
    const desired = { x: this.vel.x * dt, y: down, z: this.vel.z * dt };
    this.cc.computeColliderMovement(this.collider, desired, undefined, SOLID_QUERY_GROUPS);
    const moved = this.cc.computedMovement();
    this.grounded = this.cc.computedGrounded();
    this.pos.x += moved.x;
    this.pos.y += moved.y;
    this.pos.z += moved.z;
    this.body.setNextKinematicTranslation(this.pos);
    if (this.grounded && this.vel.y < 0) this.vel.y = 0;
    this.vel.set(0, 0, 0);
    return Math.hypot(moved.x, moved.z);
  }

  /** Eye position between the last two steps; alpha is 0 to 1. */
  eye(alpha: number, out: THREE.Vector3) {
    return out
      .lerpVectors(this.prev, this.pos, alpha)
      .setY(THREE.MathUtils.lerp(this.prev.y, this.pos.y, alpha) - this.halfHeight + P.eyeHeight);
  }

  // A ledge counts if a wall is in front at chest height, its top is within
  // reach of the feet, and the capsule fits on top.
  private tryMantle() {
    const { rapier, world } = this;
    const chest = this.feet + 1.0;
    const wallHit = world.castRay(
      new rapier.Ray({ x: this.pos.x, y: chest, z: this.pos.z }, this.forward),
      P.radius + 0.4, true, MANTLE_FILTER, undefined, this.collider,
    );
    if (!wallHit) return false;

    const reach = P.radius + 0.25 + wallHit.timeOfImpact;
    const probeTop = this.feet + P.mantleMaxHeight + 0.05;
    const x = this.pos.x + this.forward.x * reach;
    const z = this.pos.z + this.forward.z * reach;
    const topHit = world.castRay(
      new rapier.Ray({ x, y: probeTop, z }, { x: 0, y: -1, z: 0 }),
      P.mantleMaxHeight, true, MANTLE_FILTER, undefined, this.collider,
    );
    if (!topHit || topHit.timeOfImpact < 0.01) return false;
    const top = probeTop - topHit.timeOfImpact;
    if (top - this.feet < P.stepHeight) return false;

    const to = new THREE.Vector3(x, top + this.halfHeight + 0.05, z);
    const blocked = world.intersectionWithShape(
      to, { x: 0, y: 0, z: 0, w: 1 }, this.shape, MANTLE_FILTER, undefined, this.collider,
    );
    if (blocked) return false;

    this.mantle = { from: this.pos.clone(), to, t: 0 };
    this.dashLeft = 0;
    this.onMove("mantle", this.vel);
    return true;
  }

  // Rise first, then move over the edge.
  private stepMantle(dt: number) {
    const mt = this.mantle!;
    mt.t = Math.min(1, mt.t + dt / P.mantleTime);
    const up = Math.min(1, mt.t / 0.6);
    const over = Math.max(0, (mt.t - 0.6) / 0.4);
    this.pos.set(
      THREE.MathUtils.lerp(mt.from.x, mt.to.x, over),
      THREE.MathUtils.lerp(mt.from.y, mt.to.y, 1 - (1 - up) * (1 - up)),
      THREE.MathUtils.lerp(mt.from.z, mt.to.z, over),
    );
    this.body.setNextKinematicTranslation(this.pos);
    if (mt.t >= 1) {
      this.mantle = null;
      this.vel.copy(this.forward).multiplyScalar(P.walkSpeed * 0.6);
      this.grounded = true;
    }
  }
}
