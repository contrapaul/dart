import * as THREE from "three";
import type RAPIER from "@dimforge/rapier3d-compat";
import { DEBRIS_GROUPS, RAGDOLL_GROUPS } from "../physics/world";
import type { Rapier } from "../physics/world";
import type { Mesher } from "../voxel/pieces";
import type { DebrisSystem } from "../voxel/debris";
import type { DartSystem, DartHit } from "../weapons/darts";
import type { VoxelTarget } from "../weapons/impacts";
import dartTuning from "../../data/darts.json";
import { materialId, EMPTY } from "../voxel/materials";
import { CHUNK_SIZE } from "../voxel/chunk";
import { Foamer, type GameRig } from "./foamer";
import type { FoamerPart } from "./foamer-part";
import foamerData from "../../data/foamers.json";
import rigData from "../../data/foamer-rigs.json";

// Spawning, per-part dart damage with foam-core wounds, breaking,
// handicaps, attacks, stagger, going down and popping for the test
// Foamer (rig F01). One shared Rapier character controller serves every
// Foamer: it is stateless between steps. ENG-10 stage 3.

const SPEC = foamerData.test;
const SPAWNER = foamerData.spawner;
/** Dart types whose damage can pop a Foamer (none of the starter types). */
const POP_TYPES: string[] = SPEC.catastrophic.popTypes;
// One source for rig shape, speed and health: data/foamer-rigs.json.
const RIG = (rigData.rigs as unknown as GameRig[]).find((r) => r.id === SPEC.rig)!;
const CORE = materialId("foam-core");

/** One fallen piece: a part and its children. One dynamic body carries one
 *  cuboid collider per part; each part's draw group is re-parented under
 *  the system group. Lies for a while, then sinks through the floor. */
interface BrokenPiece {
  body: RAPIER.RigidBody;
  /** Each part's draw group and the matrix that applies it under the body. */
  groups: { part: FoamerPart; local: THREE.Matrix4 }[];
  /** The Foamer this fell off; its movement capsule ignores it. */
  owner: Foamer;
  /** Body pose before the last step, for render interpolation. */
  prevT: THREE.Vector3;
  prevQ: THREE.Quaternion;
  /** Lowest and top corner of the piece, relative to the body origin. */
  bottomY: number;
  topY: number;
  age: number;
  sinking: boolean;
  /** Sink drop per second: from where it lies to fully below the floor in
   *  brokenParts.sinkTime, computed from its top corner when it starts. */
  sinkSpeed: number;
}

// Scratch, shared by the system; only written sequentially.
const _pm = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _v = new THREE.Vector3();
const _cv = new THREE.Vector3();
const _topP = new THREE.Vector3();
const _topQ = new THREE.Quaternion();
const _topV = new THREE.Vector3();
const _sc = new THREE.Vector3();
const _kbB = new THREE.Vector3(); // kill push: a part's centre
const _kbV = new THREE.Vector3(); // kill push: the shot's horizontal direction
const _one = new THREE.Vector3(1, 1, 1);
const _snd = new THREE.Vector3(); // onSound's part point (not reused per frame)
/** GAME-11: a prone Foamer turns at this share of its turn rate. */
const CRAWL_TURN = 0.5;

/** The Foamer one-shot events in the order the card names them (AUD-01 3b). */
export type FoamerSoundKind =
  | "spawn" | "wound" | "part-off" | "attack" | "fall" | "down" | "sink" | "pop";

/** One event to onSound, at the Foamer's or part's position. */
function sound(sys: FoamerSystem, kind: FoamerSoundKind, f: Foamer, point: THREE.Vector3) {
  sys.onSound(kind, f, point);
}
/** A part's body centre in world space, as _snd, for onSound. */
function partPoint(part: FoamerPart): THREE.Vector3 {
  const t = part.body.translation();
  return _snd.set(t.x, t.y, t.z);
}

/** A part and all its children (rig parent links), in break order. */
function partAndChildren(rig: GameRig, id: string): string[] {
  const out = [id];
  for (let i = 0; i < out.length; i++)
    for (const p of rig.parts) if (p.parent === out[i]!) out.push(p.id);
  return out;
}

export class FoamerSystem {
  /** Add to the scene once. Every Foamer's part groups live under it. */
  readonly group = new THREE.Group();
  readonly list: Foamer[] = [];
  /** Called once per bonk that connects, with the attack id. Player health
   *  does not exist yet. */
  onBonk: (foamer: Foamer, attack: string) => void = () => {};
  /** Called once per Foamer sound event, at the part's or the Foamer's own
   *  position (AUD-01 stage 3b). Foamer sounds are owned by GameSounds. */
  onSound: (kind: FoamerSoundKind, f: Foamer, point: THREE.Vector3) => void = () => {};
  readonly stats = { spawned: 0, popped: 0, hits: 0, bonks: 0 };
  /** Fallen pieces, oldest first. Capped at brokenParts.max. */
  readonly broken: BrokenPiece[] = [];
  /** Downed Foamers, in the order they went down (oldest first). */
  readonly downed: Foamer[] = [];
  /** System clock in seconds; stamps the damage window. */
  time = 0;
  /** How many Foamers the spawner keeps alive. Default is the data file's
   *  count; the range page sets its own (0 until the panel adds them). */
  spawnCount = SPAWNER.count;
  /** Where the spawner picks from, in feet metres. */
  spawnPoints: [number, number, number][] = SPAWNER.points.map((p) => [p[0], p[1], p[2]]);
  private dtPrev = 1 / 60;
  /** Caps on the ragdoll seed velocity (a walking stride is a few m/s at
   *  most; a near-instant kill would otherwise divide a near-zero dt over
   *  an identity prevPose and seed a garbage velocity). */
  static readonly VMAX = 4;
  static readonly WMAX = 16;

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
    // this subscription runs after it and counts per-part damage.
    const previous = darts.onHit;
    darts.onHit = (hit) => {
      previous(hit);
      this.handleHit(hit);
    };
    this.cc = world.createCharacterController(0.02);
    this.cc.enableAutostep(0.3, 0.2, false);
    this.cc.enableSnapToGround(0.3);
  }

  /** Spawn at a feet position. Returns null at the `max` cap. With
   *  `facing` (a world point), it starts turned toward that point. */
  spawn(feet: THREE.Vector3, facing?: THREE.Vector3): Foamer | null {
    if (this.list.length >= SPAWNER.max) return null;
    const f = new Foamer(this.rapier, this.world, this.mesher, SPEC, RIG, feet);
    if (facing) f.yaw = Math.atan2(facing.x - feet.x, facing.z - feet.z);
    f.setSystem(this);
    this.group.add(f.group);
    this.list.push(f);
    // Every part is a voxel target of its own, so darts carve the part
    // they actually hit.
    for (const part of f.parts.values()) this.targets.push(part);
    this.stats.spawned++;
    sound(this, "spawn", f, f.centre);
    return f;
  }

  /** Fixed step, before world.step(). `player` is the player's position. */
  update(dt: number, player: THREE.Vector3): void {
    this.time += dt;
    this.dtPrev = dt;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const f = this.list[i]!;
      // Downed Foamers keep stepping (lie, sink) but no longer walk.
      if (f.state === "down") {
        this.stepDown(f, dt);
      } else {
        this.stepFoamer(f, dt, player);
      }
      // The attached parts' meshes refresh here (wounds, stumps); the
      // broken pieces' meshes refresh in stepBroken.
      for (const part of f.parts.values()) part.mesh.update();
      // Wear, once per step: a part below its own health, or one that has
      // lost wearBreak of its starting voxels, breaks. The body never
      // breaks. A dart's hit that spends a part's hp is checked in
      // handleHit; this catches the slow wear.
      if (f.state !== "down") {
        for (const part of f.parts.values()) {
          if (part.spec.kind === "body") continue;
          if (part.hp <= 0 ||
              part.voxelCount <= part.startVoxels * (1 - SPEC.partDamage.wearBreak))
            this.breakPart(f, part);
        }
        if (!f.parts.has("head") && this.anyArmGone(f)) this.goDown(f);
      }
    }
    this.stepBroken(dt);
    this.enforceDownCap();
    // Spawner: keep spawnCount alive; a downed Foamer is gone for it
    // (it will not get up again), so it repspawns while still sinking.
    if (this.list.length - this.downed.length < this.spawnCount) {
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
    for (const p of this.broken) {
      const t = p.body.translation();
      const r = p.body.rotation();
      _p.lerpVectors(p.prevT, _v.set(t.x, t.y, t.z), alpha);
      _q.slerpQuaternions(p.prevQ, new THREE.Quaternion(r.x, r.y, r.z, r.w), alpha);
      _pm.compose(_p, _q, _one);
      for (const g of p.groups) g.part.group.matrix.copy(_pm).multiply(g.local);
    }
  }

  get live() {
    return this.list.length;
  }
  private stepFoamer(f: Foamer, dt: number, player: THREE.Vector3) {
    f.prevCentre.copy(f.centre);
    f.prevYaw = f.yaw;
    f.stateTime += dt;
    // Face the player (+z is forward, so the wanted yaw is atan2(dx, dz)),
    // at the turn rate with the no-head handicap. Not while staggering: a
    // stagger is stillness and wobble only. Not while falling either (the
    // card: no movement in the fall); prone, it turns at half the rate.
    if (f.state !== "stagger" && f.state !== "fall") {
      const dx = player.x - f.centre.x;
      const dz = player.z - f.centre.z;
      const wanted = Math.atan2(dx, dz);
      let dyaw = wanted - f.yaw;
      while (dyaw > Math.PI) dyaw -= 2 * Math.PI;
      while (dyaw < -Math.PI) dyaw += 2 * Math.PI;
      const tr = f.turnRate() * (f.prone ? CRAWL_TURN : 1);
      f.yaw += THREE.MathUtils.clamp(dyaw, -tr * dt, tr * dt);
    }

    const dist = Math.hypot(player.x - f.centre.x, player.z - f.centre.z);
    if (f.state === "stagger") {
      if (f.stateTime >= SPEC.stagger.time) {
        f.state = "approach";
        f.stateTime = 0;
      }
    } else if (f.state === "approach") {
      if (dist <= SPEC.attackRange) {
        f.state = "windup";
        f.stateTime = 0;
        f.setAttack(this.chooseAttack(f));
        sound(this, "attack", f, f.centre);
      }
    } else if (f.state === "windup") {
      const atk = f.attack();
      if (!atk) {
        // The attack broke away mid windup (a stagger cancelled it) or the
        // spec has none: back to approach, or to the crawl if it is prone.
        f.state = f.prone ? "crawl" : "approach";
        f.stateTime = 0;
      } else if (f.stateTime >= atk.windup) {
        const dy = Math.abs(player.y - f.centre.y);
        // GAME-11: a prone Foamer strikes from its head, ahead of the feet.
        const reach = f.prone ? this.headDist(f, player) : dist;
        if (reach <= SPEC.attackRange + 0.3 && dy < 2) f.bonk(atk.id);
        f.state = "strike";
        f.stateTime = 0;
      }
    } else if (f.state === "strike") {
      if (f.stateTime >= f.attack()!.strike) {
        f.state = "recover";
        f.stateTime = 0;
      }
    } else if (f.state === "fall") {
      const landed = f.fallBounced;
      if (f.stepFall(dt, SPEC.gravity)) {
        f.state = "crawl";
        f.stateTime = 0;
      }
      // One FX-topple per fall, at the body when it first hits (GAME-11).
      if (!landed && f.fallBounced) sound(this, "fall", f, f.centre);
    } else if (f.state === "crawl") {
      // GAME-11: prone, it pulls itself at the player and attacks from the
      // ground with what its arms allow (a Foamer with none headbutts).
      if (this.headDist(f, player) <= SPEC.attackRange) {
        f.state = "windup";
        f.stateTime = 0;
        f.setAttack(this.chooseAttack(f));
        sound(this, "attack", f, f.centre);
      }
    } else if (f.stateTime >= SPEC.recover) {
      // A prone Foamer goes back to the crawl, not to its feet.
      f.state = f.prone ? "crawl" : "approach";
      f.stateTime = 0;
    }

    // Gravity: vertical speed, reset by the ground. Without legs it never
    // falls: the floor fit below holds it on the ground. A crawl keeps
    // pulling itself along, so it is not grounded-limited like a walk.
    f.vy = Math.max(f.vy - SPEC.gravity * dt, -50);
    const crawling = f.state === "crawl";
    // Prone, it closes until its head (the part that reaches) is in range.
    const reach = crawling ? this.headDist(f, player) : dist;
    const moving = f.state === "approach" || crawling ? reach > SPEC.attackRange : false;
    this._wish.set(0, 0, 0);
    if (moving) {
      const speed = crawling ? f.crawlSpeed() : f.speed();
      this._wish.set(Math.sin(f.yaw), 0, Math.cos(f.yaw)).multiplyScalar(speed * dt);
    }
    let stepDist = 0;
    if (f.legs().length === 0) {
      // No legs: the body is pinned to the floor by the fit below, so the
      // capsule would be half buried and the controller fights it. A skid
      // is a plain ground move.
      f.centre.add(this._wish);
      f.vy = 0;
      stepDist = this._wish.length();
    } else {
      this._vel.set(this._wish.x, f.vy * dt, this._wish.z);
      // The capsule must not collide with the Foamer's own part bodies, nor
      // with the pieces it has just broken off and that are falling past it.
      this.own.clear();
      this.own.add(f.root.handle);
      for (const p of f.parts.values()) this.own.add(p.body.handle);
      for (const p of this.broken) if (p.owner === f) this.own.add(p.body.handle);
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
      stepDist = Math.hypot(moved.x, moved.y, moved.z);
    }
    if (stepDist > 1e-4) f.gait += stepDist * 4 / (2 * Math.PI);
    f.applyPose();
    f.poseParts(dt, moving);
  }

  private respawnSpawn(player: THREE.Vector3) {
    // The spawn point farthest from the player.
    let best = this.spawnPoints[0]!;
    let bestD = -1;
    for (const p of this.spawnPoints) {
      const d = (p[0] - player.x) ** 2 + (p[2] - player.z) ** 2;
      if (d > bestD) {
        bestD = d;
        best = p;
      }
    }
    this.spawn(new THREE.Vector3(best[0], best[1], best[2]));
  }

  /** GAME-11: horizontal distance from a prone Foamer's head (the part
   *  that reaches) to the player, not from its feet. */
  private headDist(f: Foamer, player: THREE.Vector3) {
    return Math.hypot(player.x - f.headPos.x, player.z - f.headPos.z);
  }

  /** The first spec attack whose needs are met (at least one of each id
   *  still attached; needs [] always). */
  private chooseAttack(f: Foamer): string {
    for (const a of SPEC.attacks) {
      if (a.needs.every((id) => f.parts.has(id))) return a.id;
    }
    return "headbutt";
  }

  /** Per-part damage for a dart hit. Chained after DartImpacts carved the
   *  volume: the collider's owner is the part that was carved. A dart that
   *  hits only the movement capsule does no damage (review note A: the
   *  capsule sits inside the body voxels; a graze through the gaps is no
   *  hit). */
  private handleHit(hit: DartHit) {
    let f: Foamer | undefined;
    let part: FoamerPart | undefined;
    for (const foamer of this.list) {
      if (hit.collider.parent()?.handle === foamer.root.handle) continue;
      for (const p of foamer.parts.values()) {
        if (p.owns(hit.collider)) {
          f = foamer;
          part = p;
          break;
        }
      }
      if (part) break;
      // NoSuchCollider evidence: some hits miss every part and the root.
    }
    if (!f || !part) return;
    // The dart sound (AUD-01) wants to tell a Foamer part from an ordinary
    // voxel wall, so the material name DartImpacts just wrote is swapped
    // for the "foamer" surface. This runs even below the damage speed, so
    // a soft graze still thumps like foam.
    hit.material = "foamer";
    if (hit.speed < SPEC.minDamageSpeed) return;
    const d = SPEC.damage[hit.type];
    const kind = SPEC.partDamage.kinds[part.spec.kind];
    // The card's Damage: P.hp -= d * hit; foamer.health -= d * hit * total.
    part.hp -= d * kind.hit;
    f.health -= d * kind.hit * kind.total;
    // Only dart types that can pop count toward a catastrophic hit.
    if (POP_TYPES.includes(hit.type)) f.addDamage(this.time, d * kind.hit * kind.total);
    this.stats.hits++;
    this.paintWound(part, hit);
    sound(this, "wound", f, partPoint(part));
    // Breaking: hp <= 0, or the carve took the part to wearBreak of its
    // starting voxels. The body never breaks; wear from slow chipping is
    // checked once per step in update.
    const worn = part.voxelCount <= part.startVoxels * (1 - SPEC.partDamage.wearBreak);
    if (f.health <= 0) {
      // The card: pop if the damage taken in the last catastrophic.window
      // seconds (the killing hit plus anything at the same moment) is at
      // least catastrophic.share of the max health, otherwise go down.
      // Only popTypes damage is in recentDamage.
      const cutoff = this.time - SPEC.catastrophic.window;
      let recent = 0;
      for (const r of f.recentDamage) if (r.time >= cutoff) recent += r.amount;
      if (recent >= SPEC.catastrophic.share * f.maxHealth) this.pop(f);
      else this.goDown(f, hit); // the killing hit pushes the ragdoll
      return;
    }
    if (part.spec.kind !== "body" && (part.hp <= 0 || worn)) this.breakPart(f, part);
    // The head and any arm part gone: it goes down whatever its health.
    if (f.state !== "down" && !f.parts.has("head") && this.anyArmGone(f)) this.goDown(f);
  }

  /** GAME-11 range only: break the left leg of the nearest living Foamer, so
   *  the reviewer can watch a fall on demand. Returns the Foamer it broke,
   *  or null when none is alive. */
  breakLegForTest(): Foamer | null {
    const f = this.list.find((x) => x.state !== "down" && x.parts.has("legL"));
    if (!f) return null;
    this.breakPart(f, f.parts.get("legL")!);
    return f;
  }

  /** Any part of kind arm that is not attached any more. */
  private anyArmGone(f: Foamer): boolean {
    return f.rig.parts.some((p) => p.kind === "arm" && !f.parts.has(p.id));
  }

  /** Go down (card "Go down"): it stops moving and attacking, its parts
   *  leave targets and lose their trimesh colliders (darts pass through),
   *  and the root capsule is removed. Then it becomes a ragdoll (ENG-12):
   *  every attached part is a dynamic body with a cuboid collider and a
   *  hinge to its parent, pushed by the killing hit. Stuck darts drop when
   *  its bodies are disposed. Counts as gone for the spawner. */
  private goDown(f: Foamer, hit?: DartHit) {
    if (f.state === "down") return;
    f.state = "down";
    f.stateTime = 0;
    sound(this, "down", f, f.centre);
    if (f.attack()) f.setAttack(null);
    this.world.removeCollider(f.capsule, false);
    for (const part of f.parts.values()) {
      const t = this.targets.indexOf(part);
      if (t >= 0) this.targets.splice(t, 1);
      part.mesh.dropColliders();
    }
    this.buildRagdoll(f, hit);
    this.downed.push(f);
  }

  /** ENG-12: turn a downed Foamer into a ragdoll. Every attached part is
   *  a dynamic body with the same cuboid collider broken pieces use (in
   *  RAGDOLL_GROUPS, at down.ragdoll.density) at the data's damping,
   *  starting with the velocity it had on its last step. Every part with
   *  a parent still attached gets a hinge (card step 4): revolute joint
   *  at the rig joint, anchor on the parent at `at`, pivot on the child
   *  at `pivot`, both in their bodies' local frames, axis the child's
   *  local x (the axis the rig's walk swings about), limits from
   *  down.ragdoll.limits (negative bends forward) measured from the angle
   *  the joint had when it went down, contacts off so the pair never
   *  grinds. The killing hit changes the whole ragdoll's speed along the
   *  dart's travel by down.ragdoll.killSpeed (m/s), applied as one
   *  impulse on the body part (not the small part that was hit) at the
   *  hit's height clamped inside the body's box, so a high hit tips it
   *  over away from the shooter. Runs once per death, so it allocates
   *  freely rather than reusing the per-step scratch. */
  private buildRagdoll(f: Foamer, hit?: DartHit) {
    const rag = SPEC.down.ragdoll;
    const vs = f.rig.voxelSize;
    const dt = Math.max(this.dtPrev, 1 / 240);
    for (const part of f.parts.values()) {
      const body = part.body;
      body.setBodyType(this.rapier.RigidBodyType.Dynamic, true);
      body.setLinearDamping(rag.linearDamping);
      body.setAngularDamping(rag.angularDamping);
      const p2 = new THREE.Vector3(), q2 = new THREE.Quaternion();
      part.pose.decompose(p2, q2, _sc);
      const pPrev = new THREE.Vector3(), qPrev = new THREE.Quaternion();
      part.prevPose.decompose(pPrev, qPrev, _sc);
      const sz = part.spec.size;
      const hx = sz[0] * vs / 2, hy = sz[1] * vs / 2, hz = sz[2] * vs / 2;
      this.world.createCollider(
        this.rapier.ColliderDesc.cuboid(
          Math.max(0.02, hx - 0.02),
          Math.max(0.02, hy - 0.02),
          Math.max(0.02, hz - 0.02),
        )
          .setTranslation(hx, hy, hz)
          .setDensity(rag.density)
          .setCollisionGroups(RAGDOLL_GROUPS),
        body,
      );
      // Velocity it had on its last step (pose change / dt), linear and
      // angular, scaled by keepStride: the stride feeds the fall without
      // deciding where it lands (F01 walks forward when it is shot). A
      // cap keeps a kill on a very early step (a fresh part's first pose
      // is written against the previous step's origin) from seeding a
      // garbage velocity: a real stride is a few m/s at most.
      const lvx0 = (p2.x - pPrev.x) / dt, lvY0 = (p2.y - pPrev.y) / dt, lvz0 = (p2.z - pPrev.z) / dt;
      const lm = Math.hypot(lvx0, lvY0, lvz0);
      const k = lm > FoamerSystem.VMAX ? FoamerSystem.VMAX / lm : 1;
      // The walk's horizontal momentum lingers, scaled by keepStride, so
      // the walk feeds the fall without overriding the shot (F01 walks
      // forward when it is shot). What dies at once: the vertical part
      // of it (a rising limb was being raised, it does not keep rising)
      // and every rotation (the last swing's wind-up must not start the
      // fall).
    body.setLinvel({ x: lvx0 * k * rag.keepStride, y: 0, z: lvz0 * k * rag.keepStride }, true);
      body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    }
    // One hinge per attached part with a parent. Rapier initialises a new
    // impulse joint at the current relative pose, so its free angle reads
    // zero right now: the limits are then measured from the pose the
    // Foamer had when it went down, as the card wants.
    const links = f.ragdoll;
    for (const child of f.parts.values()) {
      const spec = child.spec;
      if (spec.parent === null) continue;
      const parent = f.parts.get(spec.parent);
      if (!parent) continue; // a broken-off part leaves no hinge
      const at = spec.at ?? [0, 0, 0];
      const pv = spec.pivot ?? [0, 1, 0];
      const ps = parent.spec.size, cs = spec.size;
      const wJ = new THREE.Vector3(
        ((at[0] + 1) / 2) * ps[0] * vs,
        ((at[1] + 1) / 2) * ps[1] * vs,
        ((at[2] + 1) / 2) * ps[2] * vs,
      ).applyMatrix4(parent.pose);
      const wP = new THREE.Vector3(
        ((pv[0] + 1) / 2) * cs[0] * vs,
        ((pv[1] + 1) / 2) * cs[1] * vs,
        ((pv[2] + 1) / 2) * cs[2] * vs,
      ).applyMatrix4(child.pose);
      const tp = new THREE.Vector3(), qp = new THREE.Quaternion();
      parent.pose.decompose(tp, qp, _sc);
      const tc = new THREE.Vector3(), qc = new THREE.Quaternion();
      child.pose.decompose(tc, qc, _sc);
      const anchorP = wJ.clone().sub(tp).applyQuaternion(qp.clone().invert());
      const anchorC = wP.clone().sub(tc).applyQuaternion(qc.clone().invert());
      // The hinge axis: the child's local x (its walk swing); the same
      // world direction in the parent's frame, so both frames agree.
      const axisP = new THREE.Vector3(1, 0, 0).applyQuaternion(qp.clone().invert().multiply(qc));
      const j = this.world.createImpulseJoint(
        this.rapier.JointData.revoluteWithAxes(
          { x: anchorP.x, y: anchorP.y, z: anchorP.z },
          { x: anchorC.x, y: anchorC.y, z: anchorC.z },
          { x: axisP.x, y: axisP.y, z: axisP.z },
          { x: 1, y: 0, z: 0 },
        ),
        parent.body, child.body, true,
      );
      const lim = (rag.limits as Record<string, number[]>)[spec.kind] ?? [-0.5, 0.5];
      (j as unknown as { setLimits(min: number, max: number): void }).setLimits(lim[0], lim[1]);
      j.setContactsEnabled(false);
      // The neutral pose and axis at creation, so the joint angle can be
      // read as the twist about the axis since the kill (test 6).
      const neutralQ = qp.clone().invert().multiply(qc).normalize();
      const axisWorld = new THREE.Vector3(1, 0, 0).applyQuaternion(qc);
      links.push({
        joint: j,
        parent: parent.body,
        child: child.body,
        anchorLocal: anchorP,
        pivotLocal: anchorC,
        kind: spec.kind,
        neutralQ,
        neutralAxisWorld: axisWorld,
      });
    }
    // The kill push (card step 5, redesigned in review): the shot tips the
    // Foamer over about its feet, away from the shooter. Every part gains
    // killSpeed along the shot's horizontal direction, scaled by the
    // height of its centre over the top of the body, so the feet barely
    // move and the top moves most. A push on one part (the first design)
    // either spun that part alone or, scaled up, threw the whole body.
    if (hit) {
      _kbV.set(hit.direction.x, 0, hit.direction.z);
      if (_kbV.lengthSq() > 1e-6) {
        _kbV.normalize();
        const body = f.parts.get(f.rig.parts.find((p) => p.parent === null)!.id);
        const top = body ? this.topYOfPart(body) : 1;
        for (const part of f.parts.values()) {
          const c = part.voxelToWorld(_kbB.set(part.spec.size[0] / 2, part.spec.size[1] / 2, part.spec.size[2] / 2));
          const k = rag.killSpeed * THREE.MathUtils.clamp(c.y / top, 0, 1.2);
          const v = part.body.linvel();
          part.body.setLinvel({ x: v.x + _kbV.x * k, y: v.y, z: v.z + _kbV.z * k }, true);
        }
      }
    }

    for (const part of f.parts.values()) {
      const t = part.body.translation();
      const r = part.body.rotation();
      f.ragdollPrev.set(part.spec.id, {
        t: new THREE.Vector3(t.x, t.y, t.z),
        q: new THREE.Quaternion(r.x, r.y, r.z, r.w),
      });
    }
  }

  /** Collapse, lie, then sink (ENG-12): while lying, nothing moves the
   *  bodies but physics; the parts render between their last two steps.
   *  After down.lie (or immediately when the down.max cap demands): the
   *  joints come off, every body becomes kinematic with its colliders
   *  disabled (as broken pieces do for their sink), and it drops at
   *  down.sinkSpeed until its top is below the floor, then it is
   *  disposed. */
  private stepDown(f: Foamer, dt: number) {
    f.prevCentre.copy(f.centre);
    f.prevYaw = f.yaw;
    f.stateTime += dt;
    // Render interpolation: each part body remembers its pose at the
    // start of the step; the frame lerps to where physics leaves it.
    for (const part of f.parts.values()) {
      const t = part.body.translation();
      const r = part.body.rotation();
      const prev = f.ragdollPrev.get(part.spec.id);
      if (prev) {
        prev.t.set(t.x, t.y, t.z);
        prev.q.set(r.x, r.y, r.z, r.w);
      }
    }
    if (f.sinkingNow || f.stateTime >= SPEC.down.lie) {
      if (f.ragdoll.length > 0) this.lockRagdollForSink(f);
      if (f.sinkDepth < 0) f.sinkDepth = this.topYOf(f) + 0.05; // out of sight
      if (!f.sinkingNow) { f.sinkingNow = true; sound(this, "sink", f, f.centre); }
      const drop = SPEC.down.sinkSpeed * dt;
      for (const part of f.parts.values()) {
        const t = part.body.translation();
        part.body.setNextKinematicTranslation({ x: t.x, y: t.y - drop, z: t.z });
      }
      f.sinkDrop += drop;
    }
    // sinkDepth sits at -1 until the sink starts (a Foamer lies for
    // down.lie seconds before then): never dispose before it sank.
    if (f.sinkDepth >= 0 && f.sinkDrop >= f.sinkDepth) this.removeFoamer(f);
  }

  /** Past down.max not yet sinking, the oldest downed starts sinking at
   *  once, as broken pieces do when they sink: it locks now (the joints
   *  come off at the first sink step) and skips the lie. */
  private enforceDownCap() {
    for (const d of this.downed) {
      if (this.notSinkingCount() <= SPEC.down.max) break;
      if (d.sinkDrop > 0 || d.sinkingNow) continue;
      d.sinkingNow = true;
      sound(this, "sink", d, d.centre);
    }
  }

  private notSinkingCount(): number {
    let n = 0;
    for (const d of this.downed)
      if (d.sinkDrop === 0 && !d.sinkingNow) n++;
    return n;
  }

  /** Top of one part's box in world y, from its live body. */
  private topYOfPart(part: FoamerPart): number {
    const sz = part.spec.size;
    let top = -Infinity;
    for (const cx of [0, 1]) for (const cy of [0, 1]) for (const cz of [0, 1])
      top = Math.max(top, part.voxelToWorld(_topV.set(cx * sz[0], cy * sz[1], cz * sz[2])).y);
    return top;
  }

  /** Top of the Foamer's ragdoll in world y (its height as it lies for
   *  the lie), from every part body and its cuboid, so the sink knows how
   *  far to drop it. */
  private topYOf(f: Foamer): number {
    const vs = f.rig.voxelSize;
    let top = 0;
    for (const part of f.parts.values()) {
      const b = part.body;
      const t = b.translation();
      const r = b.rotation();
      _topP.set(t.x, t.y, t.z);
      _topQ.set(r.x, r.y, r.z, r.w);
      const sz = part.spec.size;
      const hx = Math.max(0.02, (sz[0] * vs) / 2 - 0.02) * 2;
      const hy = Math.max(0.02, (sz[1] * vs) / 2 - 0.02) * 2;
      const hz = Math.max(0.02, (sz[2] * vs) / 2 - 0.02) * 2;
      for (const cx of [0, 1]) for (const cy of [0, 1]) for (const cz of [0, 1]) {
        _topV.set(cx * hx, cy * hy, cz * hz).applyQuaternion(_topQ).add(_topP);
        top = Math.max(top, _topV.y);
      }
    }
    return top;
  }

  /** Take a done Foamer out of the world and the bookkeeping. The ragdoll
   *  joints come off, then its bodies, part meshes and voxel targets go.
   *  Its broken pieces are kept. Stuck darts drop as its bodies go away
   *  (darts.ts handles that). */
  private removeFoamer(f: Foamer) {
    this.lockRagdollForSink(f);
    const i = this.list.indexOf(f);
    if (i >= 0) this.list.splice(i, 1);
    const j = this.downed.indexOf(f);
    if (j >= 0) this.downed.splice(j, 1);
    for (const part of f.parts.values()) {
      const t = this.targets.indexOf(part);
      if (t >= 0) this.targets.splice(t, 1);
    }
    f.dispose(this.world);
  }

  /** Sink-lock the ragdoll (the first line stepDown's sink takes): remove
   *  the joints and make every body kinematic with its colliders
   *  disabled, as broken pieces do when they sink. */
  private lockRagdollForSink(f: Foamer) {
    for (const link of f.ragdoll) this.world.removeImpulseJoint(link.joint, false);
    f.ragdoll.length = 0;
    const handles: number[] = [];
    for (const part of f.parts.values()) {
      part.body.setBodyType(this.rapier.RigidBodyType.KinematicPositionBased, false);
      handles.push(part.body.handle);
    }
    this.world.forEachCollider((c) => {
      const parent = c.parent();
      if (parent && handles.includes(parent.handle)) c.setEnabled(false);
    });
  }

  /** Paint the wound: every solid voxel of the part within the dart's carve
   *  radius plus coreShell voxels of the hit becomes foam-core (the
   *  card's coreShell, as RigView.carve drew it). */
  private paintWound(part: FoamerPart, hit: DartHit) {
    const vs = part.volume.voxelSize;
    const scale = THREE.MathUtils.clamp(hit.speed / dartTuning.types[hit.type].speed, 0.3, 1);
    const r = (dartTuning.types[hit.type].carveRadius * scale) / vs + SPEC.wound.coreShell;
    // The carve centre, part-local metres, slightly inside the surface as
    // DartImpacts placed it.
    const c = _v.copy(hit.point).addScaledVector(hit.direction, vs * 0.5);
    part.worldToVoxel(c);
    const size = part.spec.size;
    const R = Math.ceil(r);
    const xi = Math.floor(c.x), yi = Math.floor(c.y), zi = Math.floor(c.z);
    for (let y = Math.max(0, yi - R); y <= Math.min(size[1] - 1, yi + R); y++)
      for (let z = Math.max(0, zi - R); z <= Math.min(size[2] - 1, zi + R); z++)
        for (let x = Math.max(0, xi - R); x <= Math.min(size[0] - 1, xi + R); x++) {
          const d2 = (x + 0.5 - c.x) ** 2 + (y + 0.5 - c.y) ** 2 + (z + 0.5 - c.z) ** 2;
          if (d2 > r * r || part.volume.get(x, y, z) === EMPTY) continue;
          part.volume.set(x, y, z, CORE);
        }
  }

  /** Paint solid voxels of a part within r (part-local metres) of c as
   *  foam-core. Used for the wounds and the break stumps. */
  private paintCore(part: FoamerPart, c: THREE.Vector3, r: number) {
    const vs = part.volume.voxelSize;
    const cv = _cv.copy(c).divideScalar(vs); // voxel coordinates
    const rv = r / vs;
    const size = part.spec.size;
    const R = Math.ceil(rv);
    const xi = Math.floor(cv.x), yi = Math.floor(cv.y), zi = Math.floor(cv.z);
    for (let y = Math.max(0, yi - R); y <= Math.min(size[1] - 1, yi + R); y++)
      for (let z = Math.max(0, zi - R); z <= Math.min(size[2] - 1, zi + R); z++)
        for (let x = Math.max(0, xi - R); x <= Math.min(size[0] - 1, xi + R); x++) {
          const d2 = (x + 0.5 - cv.x) ** 2 + (y + 0.5 - cv.y) ** 2 + (z + 0.5 - cv.z) ** 2;
          if (d2 > rv * rv || part.volume.get(x, y, z) === EMPTY) continue;
          part.volume.set(x, y, z, CORE);
        }
  }

  /** Stumps at both sides of a break: a foam-core carve of radius
   *  stumpRadius on the parent at the joint, and the broken part's own
   *  pivot end foam-core (as RigView.breakOff drew it). */
  private paintStumps(f: Foamer, part: FoamerPart) {
    const vs = part.volume.voxelSize;
    const r = SPEC.wound.stumpRadius;
    const parent = part.spec.parent ? f.parts.get(part.spec.parent) : undefined;
    if (parent) {
      const at = part.spec.at ?? [0, 0, 0];
      this.paintCore(parent, _v.set(
        ((at[0] + 1) / 2) * parent.spec.size[0] * vs,
        ((at[1] + 1) / 2) * parent.spec.size[1] * vs,
        ((at[2] + 1) / 2) * parent.spec.size[2] * vs,
      ), r);
    }
    const pv = part.spec.pivot ?? [0, 1, 0];
    this.paintCore(part, _v.set(
      ((pv[0] + 1) / 2) * part.spec.size[0] * vs,
      ((pv[1] + 1) / 2) * part.spec.size[1] * vs,
      ((pv[2] + 1) / 2) * part.spec.size[2] * vs,
    ), r);
  }

  /** Break a part (and everything parented under it). It leaves targets and
   *  the Foamer's parts, the stump is painted, one dynamic piece falls, and
   *  the Foamer staggers. A stagger during a windup cancels the attack. */
  private breakPart(f: Foamer, part: FoamerPart) {
    // A dart can hit a part that is already fallen, and a pose can move it
    // under another: ignore the part while the system is handling it.
    if (!f.parts.has(part.spec.id) || part.spec.kind === "body") return;
    const rig = f.rig;
    // Children that already broke off earlier are not in parts any more.
    const ids = partAndChildren(rig, part.spec.id).filter((id) => f.parts.has(id));
    this.paintStumps(f, part);
    // One dynamic body for the assembly, at the part's last pose.
    const st2 = new THREE.Vector3();
    const q2 = new THREE.Quaternion();
    part.pose.decompose(st2, q2, _sc);
    part.prevPose.decompose(_p, _q, _sc);
    sound(this, "part-off", f, partPoint(part));
    // The part's last pose change over a step (the fling), plus 1.5 m/s
    // outward from the Foamer and up.
    const out2 = _v.set(st2.x - f.centre.x, 0, st2.z - f.centre.z);
    if (out2.lengthSq() < 1e-6) out2.set(0, 0, 1);
    out2.normalize();
    const body = this.world.createRigidBody(
      this.rapier.RigidBodyDesc.dynamic()
        .setTranslation(st2.x, st2.y, st2.z)
        .setRotation({ x: q2.x, y: q2.y, z: q2.z, w: q2.w })
        .setAngularDamping(0.8)
        .setLinearDamping(0.2),
    );
    body.setLinvel({
      x: (st2.x - _p.x) / this.dtPrev + out2.x * 1.5,
      y: (st2.y - _p.y) / this.dtPrev + 1.5,
      z: (st2.z - _p.z) / this.dtPrev + out2.z * 1.5,
    }, true);
    // One cuboid collider per part: its voxel bounds, inset 0.02 m, at the
    // part's density. Debris group: world only. A severed leg still overlaps
    // the body voxels it was joined to, and from GAME-11 the body keeps
    // pivoting over the fall while the piece is in the air, so contacting
    // the Foamer's own kinematic parts punts the piece instead of flinging
    // it. The other Foamers keep their capsules on the world group too, so
    // nothing that matters is lost.
    const groups: BrokenPiece["groups"] = [];
    const vs = rig.voxelSize;
    let bottom = Infinity, top = -Infinity;
    for (const id of ids) {
      const p = f.parts.get(id)!;
      // Local pose under the dynamic body: the part's world pose minus the
      // body's origin and rotation.
      const invB = new THREE.Matrix4().compose(st2, q2, _one).invert();
      const local = new THREE.Matrix4().copy(p.pose).premultiply(invB);
      groups.push({ part: p, local });
      const sz = p.spec.size;
      const cc0 = _sc.set(sz[0] * vs / 2, sz[1] * vs / 2, sz[2] * vs / 2).applyMatrix4(local);
      this.world.createCollider(
        this.rapier.ColliderDesc.cuboid(
          Math.max(0.02, sz[0] * vs / 2 - 0.02),
          Math.max(0.02, sz[1] * vs / 2 - 0.02),
          Math.max(0.02, sz[2] * vs / 2 - 0.02),
        ).setTranslation(cc0.x, cc0.y, cc0.z).setDensity(SPEC.brokenParts.density)
          .setCollisionGroups(DEBRIS_GROUPS),
        body,
      );
      // The fallen part is still drawn as its own group, but it is moved by
      // the piece body, not the kinematic one. The mesh stays (the stump
      // paint and later remeshes are drawn); only the colliders go, so the
      // piece never collides with the Foamer or itself.
      p.mesh.dropColliders();
      this.group.add(p.group);
      f.parts.delete(id);
      const t = this.targets.indexOf(p);
      if (t >= 0) this.targets.splice(t, 1);
      for (const cx of [0, 1]) for (const cy of [0, 1]) for (const cz of [0, 1]) {
        _v.set(cx * sz[0] * vs, cy * sz[1] * vs, cz * sz[2] * vs).applyMatrix4(local);
        bottom = Math.min(bottom, _v.y);
        top = Math.max(top, _v.y);
      }
    }
    // Cap at brokenParts.max, the oldest disposed first (its stuck darts
    // drop as its bodies go away).
    while (this.broken.length >= SPEC.brokenParts.max) this.removeBroken(0);
    this.broken.push({
      body, groups,
      owner: f,
      prevT: new THREE.Vector3(st2.x, st2.y, st2.z),
      prevQ: new THREE.Quaternion(q2.x, q2.y, q2.z, q2.w),
      bottomY: bottom, topY: top,
      age: 0, sinking: false, sinkSpeed: 0,
    });
    // GAME-11: down to too few legs, a living Foamer falls over instead of
    // staggering. It does not fall twice, and a downed one is not here.
    if (part.spec.kind === "leg" && !f.prone &&
        f.legs().length < SPEC.handicaps.fallBelowLegs)
      this.startFall(f, part.spec.id);
    else if (!f.prone) {
      // Stagger; a stagger during a windup cancels the attack. A prone
      // Foamer cannot stagger, it only loses the attack (GAME-11).
      f.state = "stagger";
      f.stateTime = 0;
    }
    if (f.attack()) f.setAttack(null);
  }

  /** GAME-11: start the fall after the leg with this id broke. The roll goes
   *  toward the side of the lost leg (a left leg rolls it onto its left), it
   *  starts tipped fall.startTilt, and the upright capsule becomes the lying
   *  one so the controller moves the prone shape. */
  private startFall(f: Foamer, lostLeg: string) {
    f.state = "fall";
    f.prone = true;
    f.stateTime = 0;
    f.fallA = -1; // stepFall sets startTilt on its first step
    f.fallW = 0;
    f.fallBounced = false;
    f.fallSettle = 0;
    // The sign the removed 0.15 rad per missing leg used: a lost left leg
    // rolls the body toward that side, a negative roll.
    f.fallSide = lostLeg.endsWith("L") ? -1 : 1;
    f.setCapsuleLying(this.world);
  }

  /** Fall the pieces: each lies for brokenParts.lifetime, then sinks
   *  through the floor (collisions off: the body is fixed and its
   *  colliders are disabled) at the speed that takes it fully below the
   *  floor in brokenParts.sinkTime, and is disposed. The part meshes are
   *  refreshed each step, so the stump paint arrives. */
  private stepBroken(dt: number) {
    for (let i = this.broken.length - 1; i >= 0; i--) {
      const p = this.broken[i]!;
      const t = p.body.translation();
      const r = p.body.rotation();
      p.prevT.set(t.x, t.y, t.z);
      p.prevQ.set(r.x, r.y, r.z, r.w);
      for (const g of p.groups) g.part.mesh.update();
      if (p.sinking) {
        if (p.sinkSpeed <= 0) p.sinkSpeed = Math.max(p.topY, 0.2) / SPEC.brokenParts.sinkTime;
        p.body.setTranslation({ x: t.x, y: t.y - p.sinkSpeed * dt, z: t.z }, false);
        if (t.y + p.topY <= 0) this.removeBroken(i);
        continue;
      }
      p.age += dt;
      if (p.age < SPEC.brokenParts.lifetime) continue;
      p.sinking = true;
      // Sink: a fixed body with disabled colliders collides with nothing.
      p.body.setBodyType(this.rapier.RigidBodyType.Fixed, false);
      this.world.forEachCollider((c) => {
        if (c.parent()?.handle === p.body.handle) c.setEnabled(false);
      });
    }
  }

  private removeBroken(i: number) {
    const p = this.broken[i]!;
    for (const g of p.groups) {
      g.part.mesh.dispose();
      g.part.group.removeFromParent();
      this.world.removeRigidBody(g.part.body);
    }
    this.world.removeRigidBody(p.body);
    this.broken.splice(i, 1);
  }

  /** Take every live, downed and broken Foamer out of the scene: their
   *  bodies, colliders, part meshes and voxel targets go, and any dart
   *  stuck to one of them drops when its body is disposed (darts.ts). The
   *  spawner count is not touched, so it respawns if it wants to. */
  clear(): void {
    for (let i = this.downed.length - 1; i >= 0; i--) this.removeFoamer(this.downed[i]!);
    for (let i = this.list.length - 1; i >= 0; i--) this.removeFoamer(this.list[i]!);
    for (let i = this.broken.length - 1; i >= 0; i--) this.removeBroken(i);
  }

  /** The model bursts into foam debris per part and leaves the world. */
  private pop(f: Foamer) {
    sound(this, "pop", f, f.centre);
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
