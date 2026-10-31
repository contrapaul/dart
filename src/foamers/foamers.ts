import * as THREE from "three";
import type RAPIER from "@dimforge/rapier3d-compat";
import type { Rapier } from "../physics/world";
import type { Mesher } from "../voxel/pieces";
import type { DebrisSystem } from "../voxel/debris";
import type { DartSystem, DartHit } from "../weapons/darts";
import type { VoxelTarget } from "../weapons/impacts";
import { CHUNK_SIZE } from "../voxel/chunk";
import { Foamer, type GameRig } from "./foamer";
import foamerData from "../../data/foamers.json";
import rigData from "../../data/foamer-rigs.json";

// Spawning, dart damage and popping for the test Foamer (rig F01). One
// shared Rapier character controller serves every Foamer: it is stateless
// between steps. Stage 1 of ENG-10: damage is still whole-Foamer; part
// damage, breaking, handicaps and going down come in later stages.

const SPEC = foamerData.test;
const SPAWNER = foamerData.spawner;
// One source for rig shape, speed and health: data/foamer-rigs.json.
const RIG = (rigData.rigs as unknown as GameRig[]).find((r) => r.id === SPEC.rig)!;

export class FoamerSystem {
  /** Add to the scene once. Every Foamer's part groups live under it. */
  readonly group = new THREE.Group();
  readonly list: Foamer[] = [];
  /** Called once per bonk that connects. Player health does not exist yet. */
  onBonk: (foamer: Foamer) => void = () => {};
  readonly stats = { spawned: 0, popped: 0, hits: 0, bonks: 0 };

  private cc: RAPIER.KinematicCharacterController;
  private targets: VoxelTarget[];
  private own = new Set<number>(); // root and part bodies for the stepped Foamer
  private respawn = SPAWNER.respawnDelay; // start full, so the first Foamer appears straight away
  private _wish = new THREE.Vector3();
  private _vel = new THREE.Vector3();

  constructor(
    private rapier: Rapier,
    private world: RAPIER.World,
    private mesher: Mesher,
    private debris: DebrisSystem,
    darts: DartSystem,
    targets: VoxelTarget[],
  ) {
    this.targets = targets;
    // Darts carve Foamers through DartImpacts (the parts are in `targets`);
    // here we only count damage and pop at zero health.
    const previous = darts.onHit;
    darts.onHit = (hit) => {
      previous(hit);
      this.handleHit(hit);
    };
    this.cc = world.createCharacterController(0.02);
    this.cc.enableAutostep(0.3, 0.2, false);
    this.cc.enableSnapToGround(0.3);
  }

  /** Spawn at a feet position. Returns null at the `max` cap. */
  spawn(feet: THREE.Vector3): Foamer | null {
    if (this.list.length >= SPAWNER.max) return null;
    const f = new Foamer(this.rapier, this.world, this.mesher, SPEC, RIG, feet);
    f.setSystem(this);
    this.group.add(f.group);
    this.list.push(f);
    // Every part is a voxel target of its own, so darts carve the part
    // they actually hit.
    for (const part of f.parts.values()) this.targets.push(part);
    this.stats.spawned++;
    return f;
  }

  /** Fixed step, before world.step(). `player` is the player's position;
   *  only x and z are used for steering. */
  update(dt: number, player: THREE.Vector3): void {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const f = this.list[i]!;
      this.stepFoamer(f, dt, player);
      for (const part of f.parts.values()) part.mesh.update();
    }
    // Spawner: keep spawner.count alive.
    if (this.list.length < SPAWNER.count) {
      this.respawn += dt;
      if (this.respawn >= SPAWNER.respawnDelay) {
        this.respawn = 0;
        this.respawnSpawn(player);
      }
    } else {
      this.respawn = 0;
    }
  }

  /** Render frame: copy transforms to the part groups, alpha (0 to 1) of
   *  the way between the last two steps. */
  syncRender(alpha = 1): void {
    for (const f of this.list) f.syncRender(alpha);
  }

  get live() {
    return this.list.length;
  }

  private stepFoamer(f: Foamer, dt: number, player: THREE.Vector3) {
    f.prevCentre.copy(f.centre);
    f.prevYaw = f.yaw;
    f.stateTime += dt;
    // Face the player (+z is forward, so the wanted yaw is atan2(dx, dz)).
    const dx = player.x - f.centre.x;
    const dz = player.z - f.centre.z;
    const wanted = Math.atan2(dx, dz);
    let dyaw = wanted - f.yaw;
    while (dyaw > Math.PI) dyaw -= 2 * Math.PI;
    while (dyaw < -Math.PI) dyaw += 2 * Math.PI;
    f.yaw += THREE.MathUtils.clamp(dyaw, -SPEC.turnRate * dt, SPEC.turnRate * dt);

    const dist = Math.hypot(dx, dz);
    const attack = SPEC.attacks[0]!;
    if (f.state === "approach") {
      if (dist <= SPEC.attackRange) {
        f.state = "windup";
        f.stateTime = 0;
      }
    } else if (f.state === "windup") {
      if (f.stateTime >= attack.windup) {
        const dy = Math.abs(player.y - f.centre.y);
        if (dist <= SPEC.attackRange + 0.3 && dy < 2) {
          f.bonk();
        }
        f.state = "strike";
        f.stateTime = 0;
      }
    } else if (f.state === "strike") {
      if (f.stateTime >= attack.strike) {
        f.state = "recover";
        f.stateTime = 0;
      }
    } else if (f.stateTime >= SPEC.recover) {
      f.state = "approach";
      f.stateTime = 0;
    }

    // Gravity: vertical speed, reset by the ground.
    f.vy = Math.max(f.vy - SPEC.gravity * dt, -50);
    const moving = f.state === "approach" && dist > SPEC.attackRange;
    const speed = f.speed();
    this._wish.set(0, 0, 0);
    if (moving) {
      this._wish.set(Math.sin(f.yaw), 0, Math.cos(f.yaw)).multiplyScalar(speed * dt);
    }
    this._vel.set(this._wish.x, f.vy * dt, this._wish.z);
    // The capsule must not collide with the Foamer's own part bodies.
    this.own.clear();
    this.own.add(f.root.handle);
    for (const p of f.parts.values()) this.own.add(p.body.handle);
    this.cc.computeColliderMovement(
      f.capsule, this._vel,
      undefined, undefined,
      (c) => !this.own.has(c.parent()?.handle ?? -1),
    );
    const moved = this.cc.computedMovement();
    if (this.cc.computedGrounded()) f.vy = 0;
    f.centre.x += moved.x;
    f.centre.y += moved.y;
    f.centre.z += moved.z;
    if (moving && Math.hypot(moved.x, moved.y, moved.z) > 1e-4) f.gait += Math.hypot(moved.x, moved.y, moved.z) * 4 / (2 * Math.PI);
    f.applyPose();
    f.poseParts(dt, moving);
  }

  private respawnSpawn(player: THREE.Vector3) {
    // The spawn point farthest from the player.
    let best = SPAWNER.points[0]!;
    let bestD = -1;
    for (const p of SPAWNER.points) {
      const d = (p[0] - player.x) ** 2 + (p[2] - player.z) ** 2;
      if (d > bestD) {
        bestD = d;
        best = p;
      }
    }
    this.spawn(new THREE.Vector3(best[0], best[1], best[2]));
  }

  private handleHit(hit: DartHit) {
    if (hit.speed < SPEC.minDamageSpeed) return;
    // The part that owns the collider (darts carving it), or the root
    // capsule (which takes whole-Foamer damage as before until stage 2
    // makes all damage per part).
    let f: Foamer | undefined;
    for (const foamer of this.list) {
      if ([...foamer.parts.values()].some((p) => p.owns(hit.collider)) ||
          hit.collider.parent()?.handle === foamer.root.handle) {
        f = foamer;
        break;
      }
    }
    if (!f) return;
    f.health -= SPEC.damage[hit.type];
    this.stats.hits++;
    if (f.health <= 0) this.pop(f);
  }

  /** The model bursts into foam debris per part and leaves the world. */
  private pop(f: Foamer) {
    for (const part of f.parts.values()) {
      // Every remaining voxel, in the part volume's own (non-rotated) space.
      const voxels: { x: number; y: number; z: number; material: number }[] = [];
      for (const chunk of part.volume.chunks.values()) {
        for (let y = 0; y < CHUNK_SIZE; y++)
          for (let z = 0; z < CHUNK_SIZE; z++)
            for (let x = 0; x < CHUNK_SIZE; x++) {
              const m = chunk.get(x, y, z);
              if (m !== 0) voxels.push({ x, y, z, material: m });
            }
      }
      if (voxels.length === 0) continue;
      const size = part.spec.size;
      const centre = { x: size[0] / 2, y: size[1] / 2, z: size[2] / 2 };
      const slice = Math.ceil(voxels.length / SPEC.popBursts);
      const vs = f.rig.voxelSize;
      for (let i = 0; i < SPEC.popBursts; i++) {
        const burst = voxels.slice(i * slice, (i + 1) * slice);
        if (burst.length === 0) continue;
        this.debris.spawn(burst, new THREE.Vector3(centre.x, centre.y, centre.z),
          vs * SPEC.popChunkScale, (v) => part.voxelToWorld(v));
      }
    }
    const i = this.list.indexOf(f);
    if (i >= 0) this.list.splice(i, 1);
    for (const part of f.parts.values()) {
      const t = this.targets.indexOf(part);
      if (t >= 0) this.targets.splice(t, 1);
    }
    f.dispose(this.world);
    this.stats.popped++;
  }
}
