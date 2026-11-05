import * as THREE from "three";
import type { Foamer } from "../foamers/foamer";
import type { FoamerSystem } from "../foamers/foamers";
import type { AudioSink } from "../audio/sink";
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

/** GAME-08: the foam vacuum, the finisher's sibling (CONTENT-PLAN D09).
 *  The same target the finisher could take (weakened, in its stagger),
 *  from its own reach and cone (data/vacuum.json). One charge that
 *  recharges; the lock is the finisher's hold with its own reward. */
export class Vacuum {
  /** The charge, seconds to full (0 = full). The read is this; the HUD
   *  fills a pip by the share. */
  private recharge = 0;
  private readyFlag = false;

  constructor(
    private foamers: FoamerSystem,
    private audio: AudioSink,
  ) {}

  /** The charge, 0 to 1 (full at 1, the rest of the time filling). */
  get chargeFrac(): number {
    return this.recharge <= 0 ? 1 : 1 - this.recharge / V.rechargeSeconds;
  }

  /** Full and ready (the prompt, the pip and the press all read this). */
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

  /** Spent a charge (the lock begins): full again in rechargeSeconds, and
   *  the ready sound arms for this top-up. */
  spend() {
    this.recharge = V.rechargeSeconds;
    this.readyFlag = false;
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
    if (f.state !== "stagger" || !f.finishWeakened) return false;
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

  /** The first target in reach and in the view, or null. */
  hasTarget(eye: THREE.Vector3, forward: THREE.Vector3): Foamer | null {
    for (const f of this.foamers.list)
      if (this.attempt(f, eye, forward, _chest)) return f;
    return null;
  }
}
