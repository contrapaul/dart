import * as THREE from "three";
import type RAPIER from "@dimforge/rapier3d-compat";
import type { Rapier } from "../physics/world";
import type { Mesher } from "../voxel/pieces";
import type { DebrisSystem } from "../voxel/debris";
import type { DartSystem, DartHit } from "../weapons/darts";
import type { VoxelTarget } from "../weapons/impacts";
import { CHUNK_SIZE } from "../voxel/chunk";
import { Foamer } from "./foamer";
import foamerData from "../../data/foamers.json";

// Spawning, dart damage, popping and the simple spawner for the test
// Foamer. One shared Rapier character controller serves every Foamer: it
// is stateless between steps.

const SPEC = foamerData.test;
const SPAWNER = foamerData.spawner;

export class FoamerSystem {
  /** Add to the scene once. Every Foamer's mesh group lives under it. */
  readonly group = new THREE.Group();
  readonly list: Foamer[] = [];
  /** Called once per bonk that connects. Player health does not exist yet. */
  onBonk: (foamer: Foamer) => void = () => {};
  readonly stats = { spawned: 0, popped: 0, hits: 0, bonks: 0 };

  private cc: RAPIER.KinematicCharacterController;
  private targets: VoxelTarget[];
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
    // Darts carve Foamers through DartImpacts (they are in `targets`);
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
    const f = new Foamer(this.rapier, this.world, this.mesher, SPEC, feet);
    this.group.add(f.group);
    this.list.push(f);
    this.targets.push(f);
    this.stats.spawned++;
    return f;
  }

  /** Fixed step, before world.step(). `player` is the player's position;
   *  only x and z are used for steering. */
  update(dt: number, player: THREE.Vector3): void {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const f = this.list[i]!;
      this.stepFoamer(f, dt, player);
      f.mesh.update();
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

  /** Render frame: copy transforms to the mesh groups. */
  syncRender(): void {
    for (const f of this.list) {
      if (f.state === "windup") {
        // Squash the mesh a little about the feet: the bonk telegraph.
        f.squashY = 1 - 0.12 * Math.sin(Math.PI * (f.stateTime / SPEC.windup));
      } else {
        f.squashY = 1;
      }
      f.syncRender();
    }
  }

  get live() {
    return this.list.length;
  }

  private stepFoamer(f: Foamer, dt: number, player: THREE.Vector3) {
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
    if (f.state === "approach") {
      if (dist <= SPEC.attackRange) {
        f.state = "windup";
        f.stateTime = 0;
      }
    } else if (f.state === "windup") {
      if (f.stateTime >= SPEC.windup) {
        const dy = Math.abs(player.y - f.centre.y);
        if (dist <= SPEC.attackRange + 0.3 && dy < 2) {
          this.onBonk(f);
          this.stats.bonks++;
        }
        f.state = "recover";
        f.stateTime = 0;
      }
    } else if (f.stateTime >= SPEC.recover) {
      f.state = "approach";
      f.stateTime = 0;
    }

    // Gravity: vertical speed, reset by the ground.
    f.vy = Math.max(f.vy - SPEC.gravity * dt, -50);
    this._wish.set(0, 0, 0);
    if (f.state === "approach" && dist > SPEC.attackRange) {
      this._wish.set(
        Math.sin(f.yaw), 0, Math.cos(f.yaw),
      ).multiplyScalar(SPEC.speed * dt);
    }
    this._vel.set(this._wish.x, f.vy * dt, this._wish.z);
    this.cc.computeColliderMovement(
      f.capsule, this._vel,
      undefined, undefined,
      (c) => c.parent()?.handle !== f.body.handle,
    );
    const moved = this.cc.computedMovement();
    if (this.cc.computedGrounded()) f.vy = 0;
    f.centre.x += moved.x;
    f.centre.y += moved.y;
    f.centre.z += moved.z;
    f.applyPose();
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
    const f = this.list.find((foamer) => foamer.owns(hit.collider));
    if (!f) return;
    f.health -= SPEC.damage[hit.type];
    this.stats.hits++;
    if (f.health <= 0) this.pop(f);
  }

  /** The model breaks into popBursts of foam and leaves the world. */
  private pop(f: Foamer) {
    // Every remaining voxel, in the volume's own (non-rotated) space.
    const voxels: { x: number; y: number; z: number; material: number }[] = [];
    for (const chunk of f.volume.chunks.values()) {
      for (let y = 0; y < CHUNK_SIZE; y++)
        for (let z = 0; z < CHUNK_SIZE; z++)
          for (let x = 0; x < CHUNK_SIZE; x++) {
            const m = chunk.get(x, y, z);
            if (m !== 0) voxels.push({ x, y, z, material: m });
          }
    }
    // Equal slices, so each burst is one debris.spawn call.
    const size = SPEC.size as [number, number, number];
    const centre = { x: size[0] / 2, y: size[1] / 2, z: size[2] / 2 };
    const slice = Math.ceil(voxels.length / SPEC.popBursts);
    for (let i = 0; i < SPEC.popBursts; i++) {
      const part = voxels.slice(i * slice, (i + 1) * slice);
      if (part.length === 0) continue;
      this.debris.spawn(part, new THREE.Vector3(centre.x, centre.y, centre.z),
        SPEC.voxelSize * SPEC.popChunkScale, (v) => f.voxelToWorld(v));
    }
    const i = this.list.indexOf(f);
    if (i >= 0) this.list.splice(i, 1);
    const t = this.targets.indexOf(f);
    if (t >= 0) this.targets.splice(t, 1);
    f.dispose(this.world);
    this.stats.popped++;
  }
}
