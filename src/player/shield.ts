import * as THREE from "three";
import type RAPIER from "@dimforge/rapier3d-compat";
import { CAPSULE_GROUPS, SIGHT_QUERY_GROUPS, type Rapier } from "../physics/world";
import type { PlayerController } from "./controller";
import type { Loadout } from "../weapons/loadout";
import type { FoamerSystem } from "../foamers/foamers";
import type { Foamer } from "../foamers/foamer";
import type { FoamerPart } from "../foamers/foamer-part";
import { armourOf } from "../foamers/armour";
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
// again. Every number lives in data/shield.json. The parry (stage 2)
// turns the thrower's pink foam balls back at them, and the charge
// is GAME-05. The look is a code-made placeholder in the factory
// palette; the name and final look are [Paul].

export type ShieldState = "lowered" | "raised" | "thrown" | "returning";

const T = shieldJson as unknown as {
  look: {
    diameter: number; rimThickness: number; domeDepth: number;
    bands: { radiusShare: number; thicknessShare: number; color: "rim" | "ring" | "inner" }[];
    nubCount: number; nubRadius: number;
    bossRadius: number; bossDepth: number; spinRevPerSec: number; flightTiltDeg: number;
    colors: { rim: string; ring: string; inner: string; nub: string; boss: string };
    lowered: { position: [number, number, number]; rotationDeg: [number, number, number] };
    raised: { position: [number, number, number]; rotationDeg: [number, number, number] };
    handOffset: [number, number, number];
  };
  /** GAME-04c: the foam saw (see the note in data/shield.json). */
  saw: {
    grindSeconds: number; tickSeconds: number; spinRevPerSec: number;
    carveRadius: number; damagePerTick: number; plateShare: number;
    debrisPerTick: number; canKill: boolean;
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
  /** GAME-04 stage 2: the parry. window is how soon after the disc starts
   *  rising a parryable ball may be turned (longer is a block, as now);
   *  speedShare is the bounced ball's speed up over the incoming one;
   *  damage and stagger (0: the Foamer's own stagger.time) are the hit's;
   *  steerSec steers the bounce at its target for this many flight
   *  seconds; kick the view kick in radians decaying over kickTime;
   *  hitStop the world's slow seconds; flashTime the disc's bright flash;
   *  parryNextLead the watch helper's hands-on lead time. */
  parry: {
    window: number; speedShare: number; damage: number; stagger: number;
    steerSec: number; kick: number; kickTime: number; hitStop: number;
    slow: number; flashTime: number; parryNextLead: number;
  };
  /** GAME-05: the charge. While the disc is raised the Foamer nearest the
   *  crosshair, within cone (degrees) and range and in sight of the player,
   *  is the locked target; a dash press starts the charge. speed m/s for at
   *  most time s through the player's own character controller; the player
   *  stops stopShort m short of the chest and a contact knocks the Foamer
   *  knockback metres along the charge, staggers it and costs it damage
   *  health. kick the view kick in radians decaying over kickTime; cooldown
   *  before the next charge. */
  charge: {
    range: number; coneDeg: number; speed: number; time: number; stopShort: number;
    knockback: number; damage: number; kick: number; kickTime: number; cooldown: number;
  };
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
  /** The charge announced on this step (first step of the charge). */
  chargeStart: boolean;
  /** The Foamer a hit landed on this step (null: no hit). */
  chargeVictim: Foamer | null;
  /** The charge ended on this step (for a page's own sounds, e.g. a
   *  failure sound later). */
  chargeEnd: boolean;
  /** GAME-10b: the charge met the Darter's plates and bounced off. */
  chargeBlocked: boolean;
  /** GAME-04c: the disc lodged in a Foamer this step and started grinding. */
  sawStart: boolean;
  /** GAME-04c: the grind ended this step (the page's SH-sawEnd). */
  sawEnd: boolean;
}

const DEG = Math.PI / 180;
const EXCLUDE_SENSORS = 8; // QueryFilterFlags.EXCLUDE_SENSORS (as darts.ts)

export class Shield {
  /** The viewmodel group: add it to the camera once. */
  readonly group = new THREE.Group();
  /** GAME-04c: the disc model. The same group is on the arm while it is
   *  held and in `flight` while it is out, so the held and the flying disc
   *  are one model. */
  readonly discModel: THREE.Group;
  /** The world holder of the flying disc: its position is the disc's and
   *  its rotation is the spin. Add it to the scene once; it is only
   *  visible while the disc is out. */
  readonly flight = new THREE.Group();
  /** The disc while it is out, in the world (the flight holder, for the
   *  tests and the page's sound). Kept as `discMesh` so nothing that read
   *  it changes. */
  get discMesh(): THREE.Object3D {
    return this.flight;
  }
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
  /** GAME-05: the charge impact's own kick, on its own table. The page
   *  adds it to the camera like the others. */
  get chargeKick(): number {
    return this.ckickLeft > 0 ? T.charge.kick * (this.ckickLeft / T.charge.kickTime) : 0;
  }
  /** GAME-05: the locked Foamer (null: the crosshair sees none, undefined:
   *  no view at all to lock through, e.g. a rig without a player stand). */
  lockedTarget: Foamer | null | undefined = undefined;
  /** The Foamer a running charge heads for (null: none running). */
  get chargeTarget(): Foamer | null {
    return this.chargeLeft > 0 ? this.chargeLock : null;
  }
  get charging(): boolean {
    return this.chargeLeft > 0;
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
  /** The bounce-back (GAME-04 stage 2): the difficulty preset's parry
   *  window multiplier (PLAN 10), read off the active preset by the page
   *  like `director`. 1 is the data's own window; `parryWindow()` has the
   *  effective one. */
  parryWindowScale = 1;
  /** Parries landed, the watch's line. */
  parries = 0;
  /** The effective window in seconds: a raise older than this only blocks
   *  (as now). */
  parryWindow(): number {
    return T.parry.window * this.parryWindowScale;
  }
  /** The watch helper's hands-on lead time (data). */
  get parryLead(): number {
    return T.parry.parryNextLead;
  }
  /** A ball that meets the player inside the front arc is parried when the
   *  raise is younger than the window: the page asks this after
   *  blocksAttackFrom has already passed. */
  canParry(): boolean {
    return this.state === "raised" && this.raise >= 0.5 && this.raiseAge <= this.parryWindow();
  }
  /** The parry's view kick, on its own table like chargeKick. */
  get parryKick(): number {
    return this.pkickLeft > 0 ? T.parry.kick * (this.pkickLeft / T.parry.kickTime) : 0;
  }
  /** The bright flash on the viewmodel disc: 1 at a parry, 0 after
   *  parry.flashTime. */
  get flash(): number {
    return this.flashLeft > 0 ? this.flashLeft / T.parry.flashTime : 0;
  }
  /** The parry feedback: the kick, the disc flash, the tiny hit-stop (the
   *  world steps slow for parry.hitStop seconds, at parry.slow of the
   *  normal rate) and the count. */
  noteParry(): void {
    this.pkickLeft = T.parry.kickTime;
    this.flashLeft = T.parry.flashTime;
    this.hitStopLeft = T.parry.hitStop;
    this.parries++;
  }
  /** This step's dt for the simulators: at parry.slow of it while the
   *  hit-stop runs (it counts down on the true dt, so the world stays
   *  slow for exactly parry.hitStop seconds). */
  slowed(dt: number): number {
    if (this.hitStopLeft <= 0) return dt;
    this.hitStopLeft = Math.max(0, this.hitStopLeft - dt);
    return dt * T.parry.slow;
  }  /** Where the disc is while out (for a spatial sound). */
  get discPosition(): THREE.Vector3 {
    return this.disc;
  }
  /** Called after a carve of voxel cover by the flying disc, with the hit
   *  point: the page plays the carve sound (the DartImpacts one never
   *  hears a shield hit). */
  onCarveAt: (point: THREE.Vector3) => void = () => {};

  private kickLeft = 0;
  /** GAME-04 stage 2: the parry: the raise's age (seconds since the state
   *  turned raised; a drop restarts it), the kick and the flash. */
  private raiseAge = 0;
  private pkickLeft = 0;
  private flashLeft = 0;
  /** The viewmodel's flash disc and its own material (the page never
   *  touches them). */
  private readonly faceMat: THREE.MeshBasicMaterial;
  private readonly flashMesh: THREE.Mesh;
  /** Seconds of the pre-slow left until a parry's hit-stop; 0 when the
   *  world runs full speed. */
  hitStopLeft = 0;
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
  /** GAME-04c: the spin in revolutions a second (look.spinRevPerSec in
   *  flight, saw.spinRevPerSec while grinding). */
  private spin = T.look.spinRevPerSec;
  /** GAME-04c: the foam saw. Set when the disc lodges in a Foamer: the
   *  Foamer, the part under the disc, the point the disc holds (in that
   *  part's voxel coordinates, so it rides the Foamer as it moves), the
   *  seconds of grind left and the seconds until the next tick. */
  private lodged = false;
  private sawTarget: Foamer | null = null;
  private sawPart: FoamerPart | null = null;
  private readonly sawPoint = new THREE.Vector3();
  private sawLeft = 0;
  private sawTick = 0;
  /** Ticks the last grind did (the tests count against the data). */
  sawTicks = 0;
  /** Whether a grind has already happened on this flight: only the first
   *  Foamer struck is ground. */
  private groundOnce = false;
  /** The spin's angle (radians) about the disc's own axis (its face
   *  normal, which points along the flight). */
  private spinAngle = 0;
  private readonly spinQ = new THREE.Quaternion();
  private readonly spinQ2 = new THREE.Quaternion();
  private readonly zAxis = new THREE.Vector3(0, 0, 1);
  private readonly spinTravel = new THREE.Vector3();
  private readonly spinFace = new THREE.Vector3();
  /** The watch's `grinding`: the target's type label and the seconds left
   *  in the grind. Null when the disc is not grinding. */
  get grinding(): { target: string; seconds: number } | null {
    if (!this.lodged || !this.sawTarget) return null;
    return { target: this.sawTarget.spec.rig, seconds: this.sawLeft };
  }
  private readonly events: ShieldEvents = {
    raised: false, lowered: false, thrown: false, hits: [], caught: false,
    chargeStart: false, chargeVictim: null, chargeEnd: false, chargeBlocked: false,
    sawStart: false, sawEnd: false,
  };
  private readonly forward = new THREE.Vector3();
  private readonly hand = new THREE.Vector3();
  private readonly eye = new THREE.Vector3();
  private readonly aim = new THREE.Vector3();
  private readonly to = new THREE.Vector3();
  private readonly scratch = new THREE.Vector3();
  private readonly quat = new THREE.Quaternion();
  private readonly ray: RAPIER.Ray;
  // GAME-05: the charge. How long it has left, the Foamer it heads for, its
  // line (horizontal) and the cooldown before the next one.
  private chargeLeft = 0;
  private chargeLock: Foamer | null = null;
  private readonly chargeDir = new THREE.Vector3();

  private chargeCd = 0;
  private ckickLeft = 0;
  /** true until the start step's update reports the charge's whoosh. */
  private chargeStartPend = false;
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
    // GAME-04c: the disc is one model, built here once and shown both on
    // the arm and in flight (the flight reparents this group to the scene).
    // Concentric foam bands, each a little thinner and a little further
    // forward than the one outside it, so the face domes.
    this.discModel = new THREE.Group();
    this.discModel.name = "shield-disc";
    const mat = (color: string) => createFoamMaterial({ cellsPerUnit: cells, wrapCells: 0, color });
    const n = L.bands.length;
    for (let i = 0; i < n; i++) {
      const b = L.bands[i]!;
      const r = (L.diameter / 2) * b.radiusShare;
      const th = L.rimThickness * b.thicknessShare;
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, th, 24), mat(L.colors[b.color]));
      m.rotation.x = Math.PI / 2;
      // The outermost band sets the back face; each one inside steps
      // forward by the dome share of its inward position.
      m.position.z = -L.rimThickness / 2 + th / 2 + (1 - b.radiusShare) * L.domeDepth;
      this.discModel.add(m);
    }
    // The saw's teeth: rounded foam nubs standing on the rim's edge.
    const nubGeo = new THREE.SphereGeometry(L.nubRadius, 8, 6);
    const nubMat = mat(L.colors.nub);
    const rimR = L.diameter / 2;
    for (let i = 0; i < L.nubCount; i++) {
      const a = (i / L.nubCount) * Math.PI * 2;
      const nub = new THREE.Mesh(nubGeo, nubMat);
      nub.position.set(Math.cos(a) * rimR, Math.sin(a) * rimR, 0);
      this.discModel.add(nub);
    }
    const boss = new THREE.Mesh(
      new THREE.CylinderGeometry(L.bossRadius, L.bossRadius, L.bossDepth, 16),
      new THREE.MeshStandardMaterial({ color: L.colors.boss, roughness: 0.6 }),
    );
    // [Paul] the centre emblem: this plain foam boss is a placeholder.
    boss.rotation.x = Math.PI / 2;
    const inner = L.bands[L.bands.length - 1]!;
    boss.position.z = -L.rimThickness / 2 + L.rimThickness * inner.thicknessShare
      + (1 - inner.radiusShare) * L.domeDepth + L.bossDepth / 2 - 0.01;
    this.discModel.add(boss);
    // The parry's flash: a plain emissive disc one size over the face,
    // hidden until a parry (the bloom's no-flash variant stays a flat
    // brightened plate, which is all the look needs here).
    this.faceMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
    });
    this.flashMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(L.diameter * 0.5, L.diameter * 0.5, 0.03, 24),
      this.faceMat,
    );
    this.flashMesh.rotation.x = Math.PI / 2;
    this.discModel.add(this.flashMesh);
    this.group.add(this.discModel);
    // While it flies the same group hangs off the scene at the disc's
    // world position, spun about its own axis; the throw reparents it.
    this.flight.visible = false;
    scene.add(this.flight);
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
    e.chargeStart = false; e.chargeVictim = null; e.chargeEnd = false; e.chargeBlocked = false;
    e.sawStart = false; e.sawEnd = false;
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
    if (this.chargeCd > 0) this.chargeCd = Math.max(0, this.chargeCd - dt);

    // GAME-05: a running charge owns the step: the player is driven at
    // the lock, the disc stays raised and keeps blocking as normal, the
    // lock freezes. The whoosh is reported on the start step (below).
    if (this.chargeLeft > 0) {
      this.stepCharge(dt, e);
      this.placeViewmodel(this.raise);
      if (this.chargeStartPend) {
        this.chargeStartPend = false;
        e.chargeStart = true;
      }
      return e;
    }

    // GAME-05: the lock. Refreshed while the disc is up (a running charge
    // freezes it, so the early return above is before this); a lowered
    // disc drops it.
    if (this.state === "raised") this.updateLock();
    else if (this.lockedTarget !== null) this.lockedTarget = null;

    if (this.state === "lowered" || this.state === "raised") {
      if (this.state === "lowered" && wantUp) {
        this.state = "raised";
        this.raiseAge = 0;
        e.raised = true;
      } else if (this.state === "raised" && !wantUp) {
        this.state = "lowered";
        this.toggleOn = false;
        e.lowered = true;
      }
      // The throw: a fire press while fully raised, never during a blaster
      // switch (that press belongs to the new blaster).
      if (this.state === "raised" && controls.firePressed
          && !this.loadout.switching && this.raise >= 1 && this.cooldown === 0) {
        this.startThrow();
        this.usedFire = true;
        e.thrown = true;
      }
    } else {
      this.stepDisc(dt, e);
    }

    // The parry's raise age and the parry's own kick and flash (the
    // charge's early return skips all three: while a charge runs the disc
    // is fixed in place).
    if (this.state === "raised") this.raiseAge += dt;
    if (this.pkickLeft > 0) this.pkickLeft = Math.max(0, this.pkickLeft - dt);
    if (this.flashLeft > 0) this.flashLeft = Math.max(0, this.flashLeft - dt);

    // The raise ease, then the disc pose and the view kick.
    const target = this.state === "raised" ? 1 : 0;
    const step = dt / T.block.raiseTime;
    if (target > this.raise) this.raise = Math.min(target, this.raise + step);
    else if (target < this.raise) this.raise = Math.max(target, this.raise - step);
    if (this.kickLeft > 0) this.kickLeft = Math.max(0, this.kickLeft - dt);
    if (this.ckickLeft > 0) this.ckickLeft = Math.max(0, this.ckickLeft - dt);
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
    this.chargeLeft = 0;
    this.chargeLock = null;
    this.chargeCd = 0;
    this.ckickLeft = 0;
    this.chargeStartPend = false;
    this.lockedTarget = null;
    this.raiseAge = 0;
    this.pkickLeft = 0;
    this.flashLeft = 0;
    this.hitStopLeft = 0;
    this.reparentDisc(false);
    this.lodged = false;
    this.sawTarget = null;
    this.sawPart = null;
    this.sawLeft = 0;
    this.sawTick = 0;
    this.sawTicks = 0;
    this.groundOnce = false;
    this.spin = T.look.spinRevPerSec;
    this.spinAngle = 0;
    this.placeViewmodel(0);
  }

  /** GAME-05: the shield's own dash. The page calls it on every dash
   *  press (before the player controller sees it): the disc is up and a
   *  target is locked, so the charge starts and returns true. The page
   *  consumes the dash then (the controller would start a normal dash
   *  with it). Returns false: an ordinary dash, no charge. */
  tryCharge(): boolean {
    if (this.chargeLeft > 0) return false; // a charge is already running
    if (this.state !== "raised" || this.raise < 1 || this.chargeCd > 0)
      return false;
    if (this.lockedTarget == null) return false;
    this.startCharge(this.lockedTarget);
    return true;
  }

  // ---- the throw ----

  private startThrow(): void {
    const T2 = T.throw;
    this.viewForward();
    this.handPoint(this.hand);
    this.disc.copy(this.hand);
    this.prevDisc.copy(this.hand);
    this.dir.copy(this.forward);
    this.reparentDisc(true);
    this.flight.position.copy(this.disc);
    this.state = "thrown";
    this.travelled = 0;
    this.hitsLeft = 1 + T2.bounces;
    this.lastHit = null;
    this.debrisThisFlight = 0;
    this.groundOnce = false;
    this.spin = T.look.spinRevPerSec;
    this.spinAngle = 0;
  }

  /** One step of the flying or returning disc. */
  private stepDisc(dt: number, e: ShieldEvents): void {
    const T2 = T.throw;
    // GAME-04c: a lodged disc grinds and does not travel: the disc stays
    // at its point on the Foamer, which may be walking.
    if (this.lodged) {
      this.stepSaw(dt, e);
      return;
    }
    const stepLen = (this.state === "thrown" ? T2.speed : T2.returnSpeed) * dt;
    this.prevDisc.copy(this.disc);
    this.travelled += stepLen;
    this.disc.addScaledVector(this.dir, stepLen);
    this.flight.position.copy(this.disc);
    this.spinFor(dt, this.dir);

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
      // GAME-04c: the foam saw. The first Foamer of a flight is ground
      // where the disc struck it; only then does the disc carry on to
      // the ricochet (or home).
      if (!this.groundOnce) {
        this.lodge(victim, e);
        return;
      }
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

  // ---- the foam saw (GAME-04c) ----

  /** The disc lodges at the point it struck this Foamer and starts to
   *  grind. The point is held in the struck part's voxel coordinates, so
   *  the disc rides the Foamer as it moves or turns. */
  private lodge(f: Foamer, e: ShieldEvents): void {
    const S = T.saw;
    // The part the disc reached: the one whose voxels are nearest the
    // disc, stepping in from the contact point a little as a dart does.
    const part = this.nearestPart(f);
    this.groundOnce = true;
    this.lodged = true;
    this.sawTarget = f;
    this.sawPart = part;
    this.sawPoint.set(0, 0, 0);
    if (part) {
      // The contact point, a little inside the surface as a dart's is.
      this.aim.copy(this.disc).addScaledVector(this.dir, part.volume.voxelSize * 0.5);
      part.worldToVoxel(this.aim);
      this.sawPoint.copy(this.aim);
    }
    this.sawWorldPoint(this.disc);
    this.flight.position.copy(this.disc);
    this.sawLeft = S.grindSeconds;
    this.sawTick = 0;
    this.sawTicks = 0;
    this.spin = S.spinRevPerSec;
    this.spinFor(0, this.dir);
    e.sawStart = true;
    // The grind holds it: the stagger the throw already gave it runs for
    // the whole grind, so it cannot attack out of the saw.
    if (!f.prone) this.foamers.startStagger(f, false, Math.max(f.spec.stagger.time, S.grindSeconds + 0.1));
  }

  /** One step of the grind: hold the disc at its point on the Foamer
   *  (which may have walked), spin fast, and tick damage, carve and
   *  debris every saw.tickSeconds. The grind ends on its time, on the
   *  Foamer going down or popping, or on the part under the disc
   *  breaking away; the ricochet then carries on as before. */
  private stepSaw(dt: number, e: ShieldEvents): void {
    const S = T.saw;
    const f = this.sawTarget;
    if (!f || f.state === "down" || !this.sawPart || !f.parts.has(this.sawPart.spec.id)) {
      this.endSaw(e);
      return;
    }
    // The disc rides the Foamer: its point is in the part's own frame.
    this.disc.copy(this.sawPart.voxelToWorld(this.aim.copy(this.sawPoint)));
    this.flight.position.copy(this.disc);
    this.spinFor(dt, this.dir);
    this.sawLeft -= dt;
    this.sawTick -= dt;
    while (this.sawTick <= 0 && this.sawLeft > 0) {
      this.sawTick += S.tickSeconds;
      this.sawTickOnce();
    }
    // Keep the Foamer held for as long as the disc is on it.
    if (!f.prone && f.state !== "stagger" && this.sawLeft > 0)
      this.foamers.startStagger(f, false, S.grindSeconds + 0.1);
    if (this.sawLeft <= 0) this.endSaw(e);
  }

  /** One tick of the grind: the part under the disc is carved, the Foamer
   *  takes the tick's damage (a plate takes saw.plateShare of it, against
   *  a dart's 0.15), and a little foam flies. The saw never kills: the
   *  throw's floor holds, and the Foamer is left finishable. */
  private sawTickOnce(): void {
    const S = T.saw;
    const f = this.sawTarget;
    const part = this.sawPart;
    if (!f || !part) return;
    this.sawTicks++;
    const vs = part.volume.voxelSize;
    // A plate under the disc takes the tick's plateShare; foam takes it
    // whole. This is the saw's counter to the Darter, whose plates take
    // 0.15 of a dart's hit: one flat tick, not the dart's kind shares.
    const share = armourOf(f.spec, part.spec.id) ? S.plateShare : 1;
    const dmg = S.damagePerTick * share;
    // The carve, into the part under the disc (capped like a throw).
    const room = S.debrisPerTick;
    const removed = carveSphere(
      part.volume, this.sawPoint.x, this.sawPoint.y, this.sawPoint.z, S.carveRadius / vs,
    );
    if (removed.length > 0 && room > 0) {
      this.debris.spawn(
        removed.slice(0, room), this.sawWorldPoint(this.scratch), vs,
        (v) => part.voxelToWorld(v),
      );
    }
    if (removed.length > 0) this.onCarveAt(this.disc);
    // The part under the disc wears, so its own break (or the wear check
    // in the Foamer's step) can take it off, and with it the disc.
    part.hp -= dmg;
    // Never a killing blow: the damage floor the throw uses.
    f.health -= dmg;
    if (!S.canKill && f.health <= 0) f.health = 0.0001;
    // GAME-07: crossing the finishable band opens the finisher, as the
    // dart's own damage does.
    if (
      !f.finishWeakened && f.health > 0
      && f.health <= f.spec.finisher.weakenShare * f.maxHealth
      && !f.prone && f.state !== "finish"
    ) {
      f.finishWeakened = true;
    }
  }

  /** The grind is over: the disc carries on with the throw's ricochet. */
  private endSaw(e: ShieldEvents): void {
    e.sawEnd = true;
    this.lodged = false;
    this.sawTarget = null;
    this.sawPart = null;
    this.sawLeft = 0;
    this.spin = T.look.spinRevPerSec;
    const next = this.hitsLeft > 0 ? this.nextTarget(this.lastHit!) : null;
    if (next) this.aimAt(this.scratchTo(next));
    else this.sendHome();
  }

  /** The part of this Foamer nearest the disc (the surface the disc
   *  reached). */
  private nearestPart(f: Foamer): FoamerPart | null {
    let best: FoamerPart | null = null;
    let best2 = Infinity;
    for (const p of f.parts.values()) {
      const c = this.scratch.copy(this.disc);
      p.worldToVoxel(c);
      const size = p.spec.size;
      const dx = Math.max(0, Math.max(-c.x, c.x - size[0]));
      const dy = Math.max(0, Math.max(-c.y, c.y - size[1]));
      const dz = Math.max(0, Math.max(-c.z, c.z - size[2]));
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 < best2) { best2 = d2; best = p; }
    }
    return best;
  }

  /** The world position of the disc's point on the Foamer (the part's own
   *  frame, or the disc's place when the part is gone), in out. */
  private sawWorldPoint(out: THREE.Vector3): THREE.Vector3 {
    if (!this.sawPart) return out;
    return this.sawPart.voxelToWorld(out.copy(this.sawPoint));
  }

  /** Spin the disc about its own axis. It flies flat and edge first, as a
   *  thrown shield does, so the nubbed rim leads and cuts (review: it flew
   *  face first, a plate seen from behind). The face (the model's -z)
   *  points up, tipped back toward the thrower by look.flightTiltDeg so
   *  the rings still read, and the disc turns in its own plane. */
  private spinFor(dt: number, along: THREE.Vector3): void {
    this.spinAngle += this.spin * Math.PI * 2 * dt;
    const t = this.spinTravel.copy(along);
    t.y = 0;
    if (t.lengthSq() < 1e-9) t.set(0, 0, -1);
    t.normalize();
    // Up, tipped back against the horizontal travel.
    const tilt = T.look.flightTiltDeg * DEG;
    const d = this.spinFace.set(0, Math.cos(tilt), 0).addScaledVector(t, -Math.sin(tilt));
    // The face along d, then turn about the face's own axis.
    this.spinQ.setFromUnitVectors(this.zAxis, d.negate());
    this.spinQ2.setFromAxisAngle(this.zAxis, this.spinAngle);
    this.flight.quaternion.copy(this.spinQ).multiply(this.spinQ2);
  }

  /** The disc stops where it is and turns for the arm. */
  private sendHome(): void {
    this.state = "returning";
    this.handPoint(this.hand);
    this.aimAt(this.hand);
  }

  /** GAME-04c: hand the one disc model to the flight holder (true) or
   *  back to the arm (false). */
  private reparentDisc(flying: boolean): void {
    this.flight.visible = flying;
    if (flying) this.flight.add(this.discModel);
    else {
      this.group.add(this.discModel);
      this.flight.rotation.set(0, 0, 0);
    }
  }

  private catchDisc(e: ShieldEvents): void {
    this.state = "lowered";
    this.reparentDisc(false);
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

  /** A clear straight line from the given origin to the Foamer's middle. The
   *  Foamer's own movement capsule is excluded (it is a world member, and
   *  the ray ends inside it, as in the Foamers' own line of sight). */
  private inSight(f: Foamer): boolean {
    return this.inSightFrom(f, this.disc);
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
    if (!f.prone)
      this.foamers.startStagger(f, false, T.throw.stun > 0 ? T.throw.stun : f.spec.stagger.time);
  }

  // ---- the charge (GAME-05) ----

  /** The locked target: the nearest live Foamer within the data's range
   *  and cone of the view, in sight of the player's eye. Refreshed by
   *  update() while the disc is up. */
  private updateLock(): void {
    const T2 = T.charge;
    this.viewForward();
    this.camera.getWorldPosition(this.eye);
    const cone = Math.cos((T2.coneDeg / 2) * DEG);
    let best: Foamer | null = null;
    let best2 = Infinity;
    for (const f of this.foamers.list) {
      if (f.state === "down") continue;
      const to = this.to.copy(f.centre).setY(f.centre.y + f.height * 0.5).sub(this.eye);
      const len = to.length();
      if (len > T2.range) continue;
      const dot = (to.x * this.forward.x + to.y * this.forward.y + to.z * this.forward.z) / len;
      if (dot < cone) continue;
      if (!this.inSightFrom(f, this.eye)) continue;
      if (!best || len * len < best2) { best = f; best2 = len * len; }
    }
    this.lockedTarget = best;
  }

  /** inSight with a choosable origin (the lock sights from the eye, the
   *  ricochet from the disc). The player's own capsule is either case's
   *  "me" exclusion. */
  private inSightFrom(f: Foamer, from: THREE.Vector3): boolean {
    this.to.copy(f.centre).setY(f.centre.y + f.height * 0.5).sub(from);
    const len = this.to.length();
    if (len < 1e-6) return true;
    this.to.divideScalar(len);
    this.ray.origin = { x: from.x, y: from.y, z: from.z };
    this.ray.dir = { x: this.to.x, y: this.to.y, z: this.to.z };
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

  private startCharge(f: Foamer): void {
    this.chargeLock = f;
    this.chargeLeft = T.charge.time;
    this.chargeStartPend = true; // the next update step reports it
    this.player.vel.set(0, 0, 0);
  }

  /** One step of the charge: the player is driven at the lock through the
   *  player's own character controller (walls stop that). The lock is set
   *  at the start and held until the charge ends: it ends on contact (the
   *  Foamer is knocked back, staggered, damaged), on a wall, on the
   *  data's time limit, or on the lock going down or popped elsewhere. */
  private stepCharge(dt: number, e: ShieldEvents): void {
    const T2 = T.charge;
    this.chargeLeft -= dt;
    // The card's time limit: the charge ends on its own, hit or no hit.
    if (this.chargeLeft <= 0) { this.endCharge(e); return; }
    const f = this.chargeLock;
    // The lock went away (down or popped elsewhere): the charge ends.
    if (!f || f.state === "down") { this.endCharge(e); return; }
    const step = this.player.chargeStep(dt, this.chargeDirFor(f), T2.speed);
    this.player.eye(1, this.eye);
    // A wall: the step moved almost nothing while the target is still far.
    if (step < T2.speed * dt * 0.1) {
      const to = this.to.copy(f.centre).setY(f.centre.y + f.height * 0.5).sub(this.eye);
      const d = Math.hypot(to.x, to.z);
      if (d > T2.stopShort) {
        this.endCharge(e);
        return;
      }
    }
    // Contact: within the data's stop distance of the chest.
    this.to.copy(f.centre).setY(f.centre.y + f.height * 0.5).sub(this.eye);
    const d = Math.hypot(this.to.x, this.to.z);
    if (d <= T2.stopShort) {
      if (this.plateFacesCharge(f)) {
        // GAME-10b: the Darter's front plates stop the charge. The player
        // bounces back, the Darter is not staggered or moved: its armour
        // does what it is for. A plate clang, then the normal cooldown.
        e.chargeBlocked = true;
        this.ckickLeft = T2.kickTime;
        this.player.chargeStep(dt, this.chargeDir.clone().negate(), T2.speed * 0.35);
        this.chargeCd = T2.cooldown;
        this.endCharge(e);
        return;
      }
      e.chargeVictim = f;
      this.ckickLeft = T2.kickTime;
      f.health -= T2.damage;
      if (f.health <= 0) f.health = 0.0001; // a charge does not kill
      this.knockBack(f);
      this.chargeCd = T2.cooldown;
      this.endCharge(e);
    }
  }
  /** GAME-10b: is the shield charge coming at the Darter's front plates?
   *  The plates face +z (the eyes and gape are painted on the +z face), and
   *  cover plateArcDeg about it. A charge from the side or the back misses
   *  them, so it staggers as usual. */
  private plateFacesCharge(f: Foamer): boolean {
    const charge = (f.spec as { charge?: { plateStopsShield?: boolean; plateArcDeg?: number } }).charge;
    if (!charge?.plateStopsShield) return false;
    // The Darter's forward, and the direction from it back to the player.
    const fx = Math.sin(f.yaw);
    const fz = Math.cos(f.yaw);
    const toPlayerX = -this.chargeDir.x;
    const toPlayerZ = -this.chargeDir.z;
    const cos = fx * toPlayerX + fz * toPlayerZ;
    return cos >= Math.cos(THREE.MathUtils.degToRad((charge.plateArcDeg ?? 120) / 2));
  }

  /** The charge's line: toward the lock's chest, horizontal. While the
   *  lock still has any legs the controller steers it for the charge. */
  private chargeDirFor(f: Foamer): THREE.Vector3 {
    this.player.eye(1, this.eye);
    let dx = f.centre.x - this.eye.x, dz = f.centre.z - this.eye.z;
    const len = Math.hypot(dx, dz);
    if (len < 1e-6) { dx = -Math.sin(f.yaw); dz = -Math.cos(f.yaw); }
    return this.chargeDir.set(dx, 0, dz).normalize();
  }

  /** The card's knockback: about the data's distance along the charge,
   *  through the Foamer's own character controller so it never goes
   *  through a wall, then the short stagger in its place (a long one would
   *  open a finisher on any Foamer, GAME-05 review). */
  private knockBack(f: Foamer): void {
    const T2 = T.charge;
    const dirX = this.chargeDir.x, dirZ = this.chargeDir.z;
    let left = T2.knockback;
    const per = Math.max(0.15, T2.knockback * 0.4);
    for (let i = 0; i < 8 && left > 1e-3; i++) {
      const want = Math.min(per, left);
      const moved = this.foamers.knockStep(f, dirX, dirZ, want);
      if (moved <= 1e-4) break; // a wall: the Foamer stops there
      left -= moved;
    }
    // The card's stagger: the existing stagger state, the data's own time.
    // GAME-10e: a Blocker's shield charge staggers it longer, so the player
    // gets a window on the wall it was hiding behind (data stagger.
    // shieldChargeTime). The shield itself is down while it is staggered.
    const st = f.spec.stagger as { time: number; shieldChargeTime?: number };
    this.foamers.startStagger(f, false, st.shieldChargeTime ?? st.time);
  }

  private endCharge(e: ShieldEvents): void {
    this.chargeLeft = 0;
    this.chargeLock = null;
    this.chargeStartPend = false;
    this.player.vel.set(0, 0, 0);
    e.chargeEnd = true;
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
    // A parry just hit: the flash plate, its opacity over flashTime (1 to
    // 0); otherwise hidden.
    const f = this.flashLeft > 0 ? this.flashLeft / T.parry.flashTime : 0;
    this.faceMat.opacity = f;
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
