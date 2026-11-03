import * as THREE from "three";
import type RAPIER from "@dimforge/rapier3d-compat";
import { CAPSULE_GROUPS, SIGHT_QUERY_GROUPS, type Rapier } from "../physics/world";
import type { PlayerController } from "./controller";
import type { Loadout } from "../weapons/loadout";
import type { FoamerSystem } from "../foamers/foamers";
import type { Foamer } from "../foamers/foamer";
import type { VoxelTarget } from "../weapons/impacts";
import type { DebrisSystem } from "../voxel/debris";
import { carveSphere } from "../voxel/carve";
import { createFoamMaterial } from "../render/foam-material";
import renderJson from "../../data/render.json";
import shieldJson from "../../data/shield.json";

// The shield (GAME-04 stage 1): a foam disc buckler on the left forearm.
// Hold `shield` to raise it: a Foamer attack from the front arc costs only
// part of its damage, the walk slows, there is no sprint, and the blaster
// cannot fire. Press fire while it is raised to throw the disc: it flies
// straight from the left hand, staggers the first Foamer it meets, then
// ricochets to the nearest other Foamer it can see within ricochetRange,
// up to bounces more times, and then flies back to the arm. A wall, or the
// range limit, sends it straight back. While it is out the player cannot
// block; after the catch a short cooldown passes before it can be thrown
// again. Every number lives in data/shield.json. Parry is stage 2 (waits
// for GAME-10) and the charge is GAME-05. The look is a code-made
// placeholder in the factory palette; the name and final look are [Paul].

export type ShieldState = "lowered" | "raised" | "thrown" | "returning";

const T = shieldJson as unknown as {
  look: {
    diameter: number; rimThickness: number; bossRadius: number; bossDepth: number;
    colors: { rim: string; face: string; boss: string };
    lowered: { position: [number, number, number]; rotationDeg: [number, number, number] };
    raised: { position: [number, number, number]; rotationDeg: [number, number, number] };
    handOffset: [number, number, number];
  };
  block: {
    raiseTime: number; frontArcDeg: number; damageShare: number;
    walkShare: number; kick: number; kickTime: number;
  };
  throw: {
    speed: number; hitRadius: number; damage: number; stun: number; bounces: number;
    ricochetRange: number; range: number; homeRange: number; returnSpeed: number;
    carveRadius: number; debrisMax: number;
  };
  cooldown: number;
};

/** What the pages hand update(): the same fire edges the blaster got, plus
 *  the shield action read the way the Shield setting says (hold: isDown,
 *  toggle: wasPressed; the page passes both and the shield picks). */
export interface ShieldControls {
  fireHeld: boolean;
  firePressed: boolean;
  shieldHeld: boolean;
  shieldPressed: boolean;
  reloadPressed: boolean;
}

/** One step's news, for the page's sounds and the watch helpers. Reused
 *  object: read it at call time. */
export interface ShieldEvents {
  raised: boolean;
  lowered: boolean;
  thrown: boolean;
  /** The world point of each Foamer the disc struck this step. */
  hits: THREE.Vector3[];
  caught: boolean;
}

const DEG = Math.PI / 180;
const EXCLUDE_SENSORS = 8; // QueryFilterFlags.EXCLUDE_SENSORS (as darts.ts)

export class Shield {
  /** The viewmodel group: add it to the camera once. */
  readonly group = new THREE.Group();
  /** The disc while it is out, in the world: add it to the scene once. */
  readonly discMesh: THREE.Mesh;
  state: ShieldState = "lowered";
  /** 0 lowered, 1 fully raised; the disc slides and tilts with it. */
  raise = 0;
  /** Settings: false holds the action to keep it up, true toggles. */
  toggleMode = false;
  /** The watch helper's hold, ORed with the input's shield action. */
  forcedHold = false;
  /** Radians of view pitch kick from a blocked hit; the page adds it to
   *  the camera pitch along with the blaster's climb. */
  get kick(): number {
    return this.kickLeft > 0 ? T.block.kick * (this.kickLeft / T.block.kickTime) : 0;
  }
  /** True while the blaster must not fire: the disc is raised, or it is
   *  out (an empty-handed arm). The page gates the blaster on this. */
  get blocksFire(): boolean {
    return this.state !== "lowered";
  }
  /** True when this step's fire press was the throw: the page must not
   *  hand that press to the blaster too. */
  get usedFirePress(): boolean {
    return this.usedFire;
  }
  /** Where the disc is while out (for a spatial sound). */
  get discPosition(): THREE.Vector3 {
    return this.disc;
  }
  /** Called after a carve of voxel cover by the flying disc, with the hit
   *  point: the page plays the carve sound (the DartImpacts one never
   *  hears a shield hit). */
  onCarveAt: (point: THREE.Vector3) => void = () => {};

  private kickLeft = 0;
  private cooldown = 0;
  private toggleOn = false;
  private usedFire = false;
  // The disc in flight: where it is, where it is going, and what it may
  // still hit.
  private readonly disc = new THREE.Vector3();
  private readonly prevDisc = new THREE.Vector3();
  private readonly dir = new THREE.Vector3();
  private travelled = 0;
  private hitsLeft = 0;
  private lastHit: Foamer | null = null;
  /** Foam chunks this flight has thrown so far (the data caps the flight). */
  private debrisThisFlight = 0;
  private readonly events: ShieldEvents = {
    raised: false, lowered: false, thrown: false, hits: [], caught: false,
  };
  private readonly forward = new THREE.Vector3();
  private readonly hand = new THREE.Vector3();
  private readonly eye = new THREE.Vector3();
  private readonly aim = new THREE.Vector3();
  private readonly to = new THREE.Vector3();
  private readonly scratch = new THREE.Vector3();
  private readonly quat = new THREE.Quaternion();
  private readonly ray: RAPIER.Ray;

  constructor(
    rapier: Rapier,
    private world: RAPIER.World,
    scene: THREE.Scene,
    private camera: THREE.Camera,
    private player: PlayerController,
    private loadout: Loadout,
    private foamers: FoamerSystem,
    private debris: DebrisSystem,
    /** The voxel volumes the flying disc carves (the page's DartImpacts
     *  target list: the level mesh and the live parts). */
    private targets: VoxelTarget[],
  ) {
    this.ray = new rapier.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -1 });
    const L = T.look;
    const cells = renderJson.foam.poreCellsPerVoxel / 0.1; // geometry is in metres
    const geo = new THREE.CylinderGeometry(L.diameter / 2, L.diameter / 2, L.rimThickness, 24);
    const rim = new THREE.Mesh(geo, createFoamMaterial({ cellsPerUnit: cells, wrapCells: 0, color: L.colors.rim }));
    const face = new THREE.Mesh(
      new THREE.CylinderGeometry(L.diameter * 0.43, L.diameter * 0.43, L.rimThickness * 1.3, 24),
      createFoamMaterial({ cellsPerUnit: cells, wrapCells: 0, color: L.colors.face }),
    );
    const boss = new THREE.Mesh(
      new THREE.CylinderGeometry(L.bossRadius, L.bossRadius, L.bossDepth, 16),
      new THREE.MeshStandardMaterial({ color: L.colors.boss, roughness: 0.6 }),
    );
    // A cylinder's axis is its own y; the disc faces along -z, so turn it.
    for (const m of [rim, face, boss]) m.rotation.x = Math.PI / 2;
    boss.position.z = -(L.rimThickness / 2 + L.bossDepth / 2 - 0.01);
    this.group.add(rim, face, boss);
    this.discMesh = new THREE.Mesh(geo, rim.material);
    this.discMesh.visible = false;
    scene.add(this.discMesh);
  }

  // ---- blocking ----

  /** Whether an attack landing now should be reduced: the disc is up (or
   *  most of the way up) and the attacker is inside the front arc, measured
   *  from where the player is looking. */
  blocksAttackFrom(from: THREE.Vector3): boolean {
    if (this.state !== "raised" || this.raise < 0.5) return false;
    this.viewForward();
    this.camera.getWorldPosition(this.eye);
    const fx = from.x - this.eye.x, fz = from.z - this.eye.z;
    const len = Math.hypot(fx, fz);
    if (len < 1e-6) return true; // directly above or below: covered
    const dot = (fx * this.forward.x + fz * this.forward.z) / len;
    return dot >= Math.cos((T.block.frontArcDeg / 2) * DEG);
  }

  /** The share of an attack's damage that still lands behind the disc. */
  get damageShare(): number {
    return T.block.damageShare;
  }
// PART 2 CONTINUES HERE

  // ---- the fixed step ----

  /** The page calls this once per fixed step, after player.update and
   *  before the blaster. Returns the step's news (a reused object). */
  update(dt: number, controls: ShieldControls): ShieldEvents {
    const e = this.events;
    e.raised = false; e.lowered = false; e.thrown = false;
    e.caught = false; e.hits.length = 0;
    this.usedFire = false;

    // The shield action as the setting wants it: hold, or one press to
    // raise and the next to lower. The watch helper's hold counts too.
    if (this.toggleMode) {
      if (controls.shieldPressed) this.toggleOn = !this.toggleOn;
    } else {
      this.toggleOn = false;
    }
    const wantUp = controls.shieldHeld || this.toggleOn || this.forcedHold;

    // Movement gates: slower walk and no sprint while the disc is up.
    const up = this.state === "raised";
    this.player.speedScale = up ? T.block.walkShare : 1;
    this.player.allowSprint = !up;

    if (this.cooldown > 0) this.cooldown = Math.max(0, this.cooldown - dt);

    if (this.state === "lowered" || this.state === "raised") {
      if (this.state === "lowered" && wantUp) {
        this.state = "raised";
        e.raised = true;
      } else if (this.state === "raised" && !wantUp) {
        this.state = "lowered";
        this.toggleOn = false;
        e.lowered = true;
      }
      // The throw: a fire press while fully raised, never during a blaster
      // switch (that press belongs to the new blaster).
      if (this.state === "raised" && controls.firePressed && !this.loadout.switching
          && this.raise >= 1 && this.cooldown === 0) {
        this.startThrow();
        this.usedFire = true;
        e.thrown = true;
      }
    } else {
      this.stepDisc(dt, e);
    }

    // The raise ease, then the disc pose and the view kick.
    const target = this.state === "raised" ? 1 : 0;
    const step = dt / T.block.raiseTime;
    if (target > this.raise) this.raise = Math.min(target, this.raise + step);
    else if (target < this.raise) this.raise = Math.max(target, this.raise - step);
    if (this.kickLeft > 0) this.kickLeft = Math.max(0, this.kickLeft - dt);
    this.placeViewmodel(this.raise);
    return e;
  }

  /** A blocked hit happened (the page saw blocksAttackFrom and cut the
   *  damage): the view kick. The events object's blocked flag is the
   *  page's to set, so a blocked hit plays its sound once. */
  noteBlocked(): void {
    this.kickLeft = T.block.kickTime;
  }

  /** Back to the arm at once (a restart or respawn). */
  reset(): void {
    this.state = "lowered";
    this.raise = 0;
    this.cooldown = 0;
    this.kickLeft = 0;
    this.toggleOn = false;
    this.lastHit = null;
    this.discMesh.visible = false;
    this.placeViewmodel(0);
  }

  // ---- the throw ----

  private startThrow(): void {
    const T2 = T.throw;
    this.viewForward();
    this.handPoint(this.hand);
    this.disc.copy(this.hand);
    this.prevDisc.copy(this.hand);
    this.dir.copy(this.forward);
    this.discMesh.visible = true;
    this.discMesh.position.copy(this.disc);
    this.state = "thrown";
    this.travelled = 0;
    this.hitsLeft = 1 + T2.bounces;
    this.lastHit = null;
    this.debrisThisFlight = 0;
  }

  /** One step of the flying or returning disc. */
  private stepDisc(dt: number, e: ShieldEvents): void {
    const T2 = T.throw;
    const stepLen = (this.state === "thrown" ? T2.speed : T2.returnSpeed) * dt;
    this.prevDisc.copy(this.disc);
    this.travelled += stepLen;
    this.disc.addScaledVector(this.dir, stepLen);
    this.discMesh.position.copy(this.disc);

    if (this.state === "returning") {
      this.handPoint(this.hand);
      if (this.disc.distanceTo(this.hand) <= T2.homeRange) this.catchDisc(e);
      return;
    }

    // A Foamer in the disc's path first (its parts are the hit surfaces).
    const victim = this.foamerInPath();
    if (victim) {
      this.stagger(victim);
      e.hits.push(victim.centre.clone());
      this.lastHit = victim;
      this.hitsLeft -= 1;
      const next = this.hitsLeft > 0 ? this.nextTarget(victim) : null;
      if (next) this.aimAt(this.scratchTo(next));
      else this.sendHome();
      return;
    }

    // Cover: a wall (or a voxel volume) within this step's length. A
    // Foamer's movement capsule is not cover (darts pass it too): the
    // disc has just left the body it struck, sitting inside that capsule.
    this.ray.origin = { x: this.prevDisc.x, y: this.prevDisc.y, z: this.prevDisc.z };
    this.ray.dir = { x: this.dir.x, y: this.dir.y, z: this.dir.z };
    const wall = this.world.castRay(
      this.ray, stepLen + 0.02, true, EXCLUDE_SENSORS, SIGHT_QUERY_GROUPS, this.player.collider,
      undefined,
      (c) => c.collisionGroups() !== CAPSULE_GROUPS,
    );
    if (wall) {
      const hit = wall.collider;
      const target = this.targets.find((t) => t.owns(hit));
      if (target) this.carve(target, this.disc);
      this.sendHome();
      return;
    }
    if (this.travelled >= T2.range) this.sendHome();
  }

  /** The disc stops where it is and turns for the arm. */
  private sendHome(): void {
    this.state = "returning";
    this.handPoint(this.hand);
    this.aimAt(this.hand);
  }

  private catchDisc(e: ShieldEvents): void {
    this.state = "lowered";
    this.discMesh.visible = false;
    this.cooldown = T.cooldown;
    this.lastHit = null;
    e.caught = true;
  }

  /** Point the disc's flight at a world point. */
  private aimAt(p: THREE.Vector3): void {
    this.dir.copy(p).sub(this.disc);
    const len = this.dir.length();
    if (len < 1e-6) this.viewForward(), this.dir.copy(this.forward);
    else this.dir.divideScalar(len);
  }

  private scratchTo(f: Foamer): THREE.Vector3 {
    return this.to.copy(f.centre).setY(f.centre.y + f.height * 0.5);
  }

  /** The nearest living Foamer, other than the one just hit, within the
   *  ricochet range and in sight of the disc. Null: it flies home. */
  private nextTarget(from: Foamer): Foamer | null {
    const T2 = T.throw;
    let best: Foamer | null = null;
    for (const f of this.foamers.list) {
      if (f.state === "down" || f === from || f === this.lastHit) continue;
      if (this.disc.distanceTo(f.centre) > T2.ricochetRange) continue;
      if (!this.inSight(f)) continue;
      if (!best || this.disc.distanceToSquared(f.centre) < this.disc.distanceToSquared(best.centre))
        best = f;
    }
    return best;
  }

  /** A clear straight line from the disc to the Foamer's middle. The
   *  Foamer's own movement capsule is excluded (it is a world member, and
   *  the ray ends inside it, as in the Foamers' own line of sight). */
  private inSight(f: Foamer): boolean {
    this.to.copy(f.centre).setY(f.centre.y + f.height * 0.5).sub(this.disc);
    const len = this.to.length();
    if (len < 1e-6) return true;
    this.to.divideScalar(len);
    this.ray.origin = { x: this.disc.x, y: this.disc.y, z: this.disc.z };
    this.ray.dir = { x: this.to.x, y: this.to.y, z: this.to.z };
    // The player's capsule is not cover either, and neither is a Foamer's
    // (the disc leaves one struck body's capsule inside it).
    const a = f.capsule;
    const b = this.lastHit ? this.lastHit.capsule : null;
    const me = this.player.collider;
    const hit = this.world.castRay(
      this.ray, len - 0.1, true, EXCLUDE_SENSORS, SIGHT_QUERY_GROUPS,
      undefined, undefined,
      (c) => c !== a && c !== b && c !== me && c.collisionGroups() !== CAPSULE_GROUPS,
    );
    return !hit;
  }

  /** The living Foamer whose body the disc reached this step: its centre
   *  within hitRadius of the swept segment. Nearest first. */
  private foamerInPath(): Foamer | null {
    const T2 = T.throw;
    const r = T2.hitRadius;
    let best: Foamer | null = null;
    let bestT = Infinity;
    for (const f of this.foamers.list) {
      if (f.state === "down" || f === this.lastHit) continue;
      const c = this.to.copy(f.centre).setY(f.centre.y + f.height * 0.5);
      const t = closestOnSegment(this.prevDisc, this.disc, c, this.aim);
      if (t < 0 || t > 1) continue;
      if (this.aim.distanceTo(c) > r) continue;
      if (t < bestT) { bestT = t; best = f; }
    }
    return best;
  }

  /** The card's stagger: the existing stagger state, for the data's own
   *  time (stun 0: the Foamer's own stagger.time), plus a little damage. */
  private stagger(f: Foamer): void {
    f.health -= T.throw.damage;
    if (f.health <= 0) f.health = 0.0001; // a stage 1 throw does not kill
    if (!f.prone) {
      f.state = "stagger";
      f.stateTime = 0;
      f.staggerTime = T.throw.stun > 0 ? T.throw.stun : f.spec.stagger.time;
      f.agent?.release("stagger");
      if (f.attack()) f.setAttack(null);
    }
  }

  /** A little foam where the disc hit voxel cover, capped per flight. */
  private carve(target: VoxelTarget, point: THREE.Vector3): void {
    const T2 = T.throw;
    const room = T2.debrisMax - this.debrisThisFlight;
    if (room <= 0) return;
    const vs = target.volume.voxelSize;
    this.aim.copy(point).addScaledVector(this.dir, vs * 0.5);
    target.worldToVoxel(this.aim);
    const removed = carveSphere(
      target.volume, this.aim.x, this.aim.y, this.aim.z, T2.carveRadius / vs,
    );
    if (removed.length === 0) return;
    this.debrisThisFlight += Math.min(room, removed.length);
    this.scratch.copy(point).addScaledVector(this.dir, vs * 0.5);
    this.debris.spawn(removed.slice(0, room), this.scratch, vs, (v) => target.voxelToWorld(v));
    this.onCarveAt(point);
  }

  // ---- pose helpers ----

  /** Where the disc sits on the arm at raise 0 to 1 (viewmodel space). */
  private placeViewmodel(raise: number): void {
    const L = T.look;
    const g = this.group;
    const a = THREE.MathUtils.clamp(raise, 0, 1);
    const lo = L.lowered, hi = L.raised;
    g.position.set(
      lo.position[0] + (hi.position[0] - lo.position[0]) * a,
      lo.position[1] + (hi.position[1] - lo.position[1]) * a,
      lo.position[2] + (hi.position[2] - lo.position[2]) * a,
    );
    g.rotation.set(
      (lo.rotationDeg[0] + (hi.rotationDeg[0] - lo.rotationDeg[0]) * a) * DEG,
      (lo.rotationDeg[1] + (hi.rotationDeg[1] - lo.rotationDeg[1]) * a) * DEG,
      (lo.rotationDeg[2] + (hi.rotationDeg[2] - lo.rotationDeg[2]) * a) * DEG,
    );
    g.visible = this.state !== "thrown" && this.state !== "returning";
  }

  /** The player's view direction (unit, xz and y from the pitch). */
  private viewForward(): void {
    const cp = Math.cos(this.player.pitch);
    this.forward.set(-Math.sin(this.player.yaw) * cp, Math.sin(this.player.pitch), -Math.cos(this.player.yaw) * cp);
  }

  /** The left hand's world position: the camera position plus the data's
   *  hand offset, turned with the view. */
  private handPoint(out: THREE.Vector3): void {
    const o = T.look.handOffset;
    this.camera.getWorldPosition(out);
    this.quat.setFromEuler(this.camera.rotation);
    out.add(this.scratch.set(o[0], o[1], o[2]).applyQuaternion(this.quat));
  }
}

/** The parameter t of the closest point on segment a-b to p (clamped to
 *  the segment: a target just beyond the disc's step still counts), and
 *  that point in out. */
function closestOnSegment(a: THREE.Vector3, b: THREE.Vector3, p: THREE.Vector3, out: THREE.Vector3): number {
  const abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z;
  const len2 = abx * abx + aby * aby + abz * abz;
  const t = len2 > 1e-12
    ? Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby + (p.z - a.z) * abz) / len2))
    : 0;
  out.set(a.x + abx * t, a.y + aby * t, a.z + abz * t);
  return t;
}
