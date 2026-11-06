import * as THREE from "three";
import type { PlayerController } from "../player/controller";
import type { Foamer } from "../foamers/foamer";
import type { FoamerSystem } from "../foamers/foamers";
import type { Loadout } from "../weapons/loadout";
import type { DebrisSystem } from "../voxel/debris";
import { materialId } from "../voxel/materials";
import type { AudioSink, LoopHandle } from "../audio/sink";
import vacuumData from "../../data/vacuum.json";
import foamerData from "../../data/foamers.json";

const V = vacuumData.vacuum;

// GAME-08: the per-type vacuum entry in data/foamers.json (allowed and
// ammoShare). A type with no entry is not allowed: the heavies come
// later, with their upgrades.
export interface VacuumShare {
  allowed: boolean;
  ammoShare: { active: number; other: number };
}
const TYPES = foamerData.types as Record<string, { vacuum?: VacuumShare }>;
export function shareFor(type: string): VacuumShare | null {
  return TYPES[type]?.vacuum ?? null;
}

// Scratch, the vacuum owns it for its own calls.
const _chest = new THREE.Vector3();
const _nozzle = new THREE.Vector3();
const _scaleM = new THREE.Matrix4();
const _anchM = new THREE.Matrix4();
const _transM = new THREE.Matrix4();

/** GAME-08: the foam vacuum, the finisher's sibling (CONTENT-PLAN D09).
 *  The same target the finisher could take (weakened, in its stagger),
 *  from its own reach and cone (data/vacuum.json). One charge that
 *  recharges; the lock holds the player as the finisher's does, the view
 *  turns onto the Foamer, the Foamer is stretched toward the nozzle and
 *  shrunk to nothing (a scale and position ease on its group, no
 *  physics), then removed with the pop's chunks left out. The reward is
 *  the type's shares of the blasters' reserves, straight in (D08: no
 *  pickups are spawned). */
export class Vacuum {
  active = false;

  private target: Foamer | null = null;
  private t = 0;
  // The view turn, as the finisher's.
  private startYaw = 0;
  private startPitch = 0;
  private endYaw = 0;
  private endPitch = 0;
  // The charge, seconds to full (0 = full), and the ready's once flag.
  private recharge = 0;
  private readyFlag = false;
  // The lock's suck loop.
  private suck: LoopHandle | null = null;
  // The eye at the lock's start, for the nozzle (the test stand-in player
  // exposes no eye; the lock's own eye is enough for a run of under a
  // second).
  private eyeAt = new THREE.Vector3();

  constructor(
    private foamers: FoamerSystem,
    private loadout: Loadout,
    private debris: DebrisSystem,
    private audio: AudioSink,
  ) {}

  /** The charge, 0 to 1 (the HUD's one pip fills by this). */
  get chargeFrac(): number {
    return this.recharge <= 0 ? 1 : 1 - this.recharge / V.rechargeSeconds;
  }

  /** How long into the lock it is, seconds (the placeholder's rise
   *  eases on this). */
  get lockT(): number {
    return this.t;
  }

  /** Full and ready (the prompt, the press and the pip all read this). */
  get ready(): boolean {
    return this.recharge <= 0;
  }

  /** The charge is full at a level start and on a retry. */
  reset(): void {
    this.recharge = 0;
    this.readyFlag = false;
  }

  /** Recharge count-up, one fixed step. VC-ready when it lands, once per
   *  top-up (the flag arms again on the next spend). */
  stepCharge(dt: number) {
    if (this.recharge <= 0) return;
    this.recharge = Math.max(0, this.recharge - dt);
    if (this.recharge === 0 && !this.readyFlag) {
      this.readyFlag = true;
      this.audio.play("VC-ready");
    }
  }

  /** Spent a charge (the lock begins): full again in rechargeSeconds. */
  spend() {
    this.recharge = V.rechargeSeconds;
    this.readyFlag = false;
  }

  /** The press's decision, the card's three cases as one read: a target
   *  and a charge spend the press and begin the lock; a target without
   *  the charge plays the empty sound and still takes the press (the
   *  page's old use does not run behind the tool); with no target at all
   *  the page keeps its old use (the course's block throw). */
  press(eye: THREE.Vector3, forward: THREE.Vector3, player: PlayerController): "lock" | "empty" | null {
    const t = this.hasTarget(eye, forward);
    if (!t) return null;
    if (!this.ready) {
      this.audio.play("VC-empty", { position: t.centre });
      return "empty";
    }
    this.start(t, player, eye);
    return "lock";
  }

  /** The first target in reach and in the view, or null (the prompt's
   *  gate and state's flag). */
  hasTarget(eye: THREE.Vector3, forward: THREE.Vector3): Foamer | null {
    for (const f of this.foamers.list)
      if (this.attempt(f, eye, forward, _chest)) return f;
    return null;
  }

  /** The type is allowed (it has an entry with allowed true). */
  canVacuum(f: Foamer): boolean {
    const s = shareFor(f.spec.rig);
    return s != null && s.allowed;
  }

  /** The target's gate: the finisher's shape, the vacuum's numbers. The
   *  reach is measured eye to the chest; the cone measures the view onto
   *  the Foamer's upright line clamped to the body (GAME-07 review: at
   *  up-close the head reads as aimed even off the chest). out must not
   *  be eye or forward. A type without an entry is never a target. */
  attempt(f: Foamer, eye: THREE.Vector3, forward: THREE.Vector3, out: THREE.Vector3) {
    // GAME-09b review: a dying Foamer (its kill held for the rest of a
    // shot) is already decided, as the finisher skips it.
    if (f.state !== "stagger" || !f.finishWeakened || f.dyingHit) return false;
    if (!this.canVacuum(f)) return false;
    const d = out.set(f.centre.x, f.centre.y + f.height * 0.6, f.centre.z).distanceTo(eye);
    if (d > V.reach) return false;
    const flat = Math.hypot(f.centre.x - eye.x, f.centre.z - eye.z);
    const along = Math.hypot(forward.x, forward.z);
    const viewY = along > 1e-6 ? eye.y + (forward.y / along) * flat : eye.y;
    out.y = THREE.MathUtils.clamp(viewY, f.centre.y, f.centre.y + f.height);
    out.sub(eye).normalize();
    return out.dot(forward) >= V.coneCos;
  }

  /** Begin: the charge is spent and the Foamer waits on its "finish"
   *  state, as the finisher's does. eye is the player's current eye. */
  start(f: Foamer, player: PlayerController, eye: THREE.Vector3) {
    this.target = f;
    this.t = 0;
    this.active = true;
    this.spend();
    this.eyeAt.copy(eye);
    f.state = "finish";
    f.stateTime = 0;
    const dx = f.centre.x - eye.x;
    const dz = f.centre.z - eye.z;
    const dy = f.centre.y + f.height * 0.4 - eye.y;
    const flat = Math.hypot(dx, dz);
    this.startYaw = player.yaw;
    this.startPitch = player.pitch;
    this.endYaw = Math.atan2(-dx, -dz);
    this.endPitch = Math.atan2(dy, flat);
    this.audio.play("VC-start", { position: f.centre });
    this.suck = this.audio.loop("VC-suck", { position: f.centre });
  }

  /** One step. The player's view is set here; player.update is not called
   *  while it runs (the same hold the finisher gets). While it runs the
   *  charge recharges. Returns the taken Foamer on the step it is
   *  removed. */
  update(dt: number, player: PlayerController): Foamer | null {
    const f = this.target;
    if (!f) return null;
    // Something else ended it first (a dart burst, or it went down):
    // stand down. Removing it again would free bodies that are gone.
    if (f.state !== "finish" || !this.foamers.list.includes(f)) {
      this.standDown(f);
      return null;
    }
    this.t += dt;
    const k = Math.min(1, this.t / V.turnTime);
    const ease = k * k * (3 - 2 * k);
    player.yaw = this.startYaw + (this.endYaw - this.startYaw) * ease;
    player.pitch = this.startPitch + (this.endPitch - this.startPitch) * ease;
    // The suck: from halfway through the view turn, the Foamer is drawn
    // toward the nozzle (the eye, a little down, where the vacuum rose in
    // the lower right of the view) and shrunk to nothing: a scale and a
    // move on its group, no physics (its root capsule stops driving the
    // parts while the Foamer waits on its "finish" state, the same hold
    // the finisher gets).
    this.nozzleInto(_nozzle);
    const s = THREE.MathUtils.clamp((this.t - V.turnTime * 0.5) / (V.total - V.turnTime * 0.5), 0, 1);
    if (s > 0) this.suckPose(f, s * s, _nozzle);
    if (this.t < V.total) return null;
    // The run is over: the reward, the capped puff at the nozzle where
    // the Foamer dissolved, and the removal, without the pop's chunks
    // (the suck's loop stops with either end below).
    this.audio.play("VC-done", { position: _nozzle });
    this.reward(f);
    this.debris.burst(_nozzle, V.puffCount, V.puffSize, materialId("foam-white"));
    this.standDown(f);
    return f;
  }

  /** Spent its run (or stood down early): the view is free again and the
   *  Foamer is out. */
  private standDown(f: Foamer) {
    if (this.suck) { this.suck.stop(); this.suck = null; }
    this.active = false;
    this.target = null;
    if (this.foamers.list.includes(f)) this.foamers.suck(f);
  }

  /** The suck's pose on f.group, set not accumulated: a scale anchored
   *  on the feet, then the feet toward the nozzle by the pull. f.group
   *  is the parts' parent (their local matrices are world poses), so
   *  its matrix is the world transform they all ride on; at rest it is
   *  identity, and this is identity at zero pull. */
  private suckPose(f: Foamer, pull: number, nozzle: THREE.Vector3) {
    f.group.matrixAutoUpdate = false;
    const sh = 1 - pull * 0.95;
    _anchM.makeTranslation(f.centre.x, f.centre.y, f.centre.z);
    _scaleM.makeScale(sh, sh, sh);
    _transM.makeTranslation(-f.centre.x, -f.centre.y, -f.centre.z);
    f.group.matrix.multiplyMatrices(_anchM, _scaleM).multiply(_transM);
    // Then the feet toward the nozzle, a world-space add to the
    // translation column (the transform is a scale and a translate
    // only, so the column is the translation).
    f.group.matrix.elements[12] += (nozzle.x - f.centre.x) * pull * 0.9;
    f.group.matrix.elements[13] += (nozzle.y - f.centre.y) * pull * 0.9;
    f.group.matrix.elements[14] += (nozzle.z - f.centre.z) * pull * 0.9;
  }

  /** Half a metre ahead of the lock's eye along the view it turns to,
   *  and a little down: where the placeholder rises. (Review: a fixed
   *  world -z offset pulled the Foamer behind a player facing +z.) */
  private nozzleInto(out: THREE.Vector3): THREE.Vector3 {
    return out.set(
      this.eyeAt.x - Math.sin(this.endYaw) * 0.5,
      this.eyeAt.y - 0.25,
      this.eyeAt.z - Math.cos(this.endYaw) * 0.5,
    );
  }

  /** The type's shares: the active blaster its own share of its own
   *  reserveMax, every other in the loadout the other share of its own,
   *  each rounded up, each never past its own reserveMax (the board's
   *  one credit function, as the ammo box's is; D08: no pickups). */
  private reward(f: Foamer) {
    const s = shareFor(f.spec.rig);
    if (!s || !s.allowed) return;
    this.loadout.refillReserves(s.ammoShare.active, s.ammoShare.other);
  }
}
