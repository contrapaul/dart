import * as THREE from "three";
import type { PlayerController } from "../player/controller";
import type { Foamer } from "../foamers/foamer";
import type { FoamerSystem } from "../foamers/foamers";
import type { PickupSystem } from "../pickups/pickups";
import foamerData from "../../data/foamers.json";

const F = foamerData.test.finisher;

// Scratches, the finisher owns one per call batch.
const _chest = new THREE.Vector3();
const _drop = new THREE.Vector3();

/** GAME-07: the finisher. While active the player is held in place and
 *  the view turns onto the Foamer; on the way down the Foamer squashes
 *  and stretches and then pops, and the pop sprays health pickups at its
 *  feet. The Foamer itself waits on its "finish" state throughout. */
export class Finisher {
  active = false;

  private target: Foamer | null = null;
  private t = 0;
  // The view turn.
  private startYaw = 0;
  private startPitch = 0;
  private endYaw = 0;
  private endPitch = 0;

  constructor(
    private foamers: FoamerSystem,
    private pickups: PickupSystem,
  ) {}

  /** The reach is measured to the chest. The cone is measured to the point
   *  of the Foamer's upright line (feet to top) at the height the view
   *  passes it, so looking at its head or its knees up close counts, not
   *  only its chest (GAME-07 review: at 1.5 m the head is 18 degrees off
   *  the chest). out must not be eye or forward. */
  attempt(f: Foamer, eye: THREE.Vector3, forward: THREE.Vector3, out: THREE.Vector3) {
    const d = out.set(f.centre.x, f.centre.y + f.height * 0.6, f.centre.z).distanceTo(eye);
    if (d > F.reach) return false;
    const flat = Math.hypot(f.centre.x - eye.x, f.centre.z - eye.z);
    const along = Math.hypot(forward.x, forward.z);
    const viewY = along > 1e-6 ? eye.y + (forward.y / along) * flat : eye.y;
    out.y = THREE.MathUtils.clamp(viewY, f.centre.y, f.centre.y + f.height);
    out.sub(eye).normalize();
    return out.dot(forward) >= F.coneCos;
  }

  /** Begin: the player is held, and the view turns onto the Foamer. eye
   *  is the player's current eye position (the controller's is private). */
  start(f: Foamer, player: PlayerController, eye: THREE.Vector3) {
    this.target = f;
    this.t = 0;
    this.active = true;
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
  }

  /** One step. The player's view is set here; player.update is not called
   *  while this runs. Returns the finished Foamer on the step it pops. */
  update(dt: number, player: PlayerController): Foamer | null {
    const f = this.target;
    if (!f) return null;
    // Something else ended it first (a dart burst popped it, or it went
    // down): stand down. Popping it again would free bodies that are gone.
    if (f.state !== "finish" || !this.foamers.list.includes(f)) {
      this.active = false;
      this.target = null;
      return null;
    }
    this.t += dt;
    const k = Math.min(1, this.t / F.turnTime);
    const ease = k * k * (3 - 2 * k);
    player.yaw = this.startYaw + (this.endYaw - this.startYaw) * ease;
    player.pitch = this.startPitch + (this.endPitch - this.startPitch) * ease;
    if (this.t < F.total) return null;
    this.active = false;
    this.target = null;
    this.foamers.pop(f);
    this.pickups.sprayHealth(_drop.set(f.centre.x, f.centre.y + 0.3, f.centre.z));
    return f;
  }

  /** Is there a one in reach and in the view the finisher can act on? */
  has(eye: THREE.Vector3, forward: THREE.Vector3) {
    for (const f of this.foamers.list)
      // GAME-09b: a dying Foamer is not finishable: its kill is held for
      // the rest of the shot and settles on the next step.
      if (f.state === "stagger" && !f.dyingHit && this.attempt(f, eye, forward, _chest)) return true;
    return false;
  }
}
