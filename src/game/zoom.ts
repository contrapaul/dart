import blasters from "../../data/blasters.json";

// GAME-09e: the zoom. A blaster whose data carries a `zoom` block (B05
// Shrike for now) can be aimed down its sight: while the `zoom` action is
// held, the field of view eases to a share of the player's own setting and
// the look sensitivity eases with it, so the same mouse movement turns the
// view less. Letting go eases back. Switching blaster or starting a reload
// drops the zoom, and the key must be pressed again to get it back.
//
// The numbers are the blaster's own in data/blasters.json. The class owns
// nothing but the factor: the game writes it into the camera and the look
// settings each frame (src/game/game.ts).

/** A blaster's zoom block in data/blasters.json. */
export interface ZoomSpec {
  /** The zoomed field of view as a share of the player's own setting. */
  fovShare: number;
  /** Seconds to ease from one end of the range to the other. */
  easeTime: number;
}

/** The zoom of a blaster id, or null when its data has no zoom block. */
export function zoomSpecOf(blasterId: string): ZoomSpec | null {
  const entry = (blasters as unknown as Record<string, { zoom?: ZoomSpec }>)[blasterId];
  const z = entry?.zoom;
  return z ? { fovShare: z.fovShare, easeTime: z.easeTime } : null;
}

export class Zoom {
  /** The player's own field of view and mouse sensitivity (the settings). */
  baseFov = 70;
  baseSensitivity = 0.0022;
  /** 1 when not zoomed, the blaster's fovShare at full zoom. */
  factor = 1;

  private spec: ZoomSpec | null = null;
  /** The last zoom block seen, for the ease back after a switch to a
   *  blaster that cannot zoom. */
  private lastSpec: ZoomSpec | null = null;
  private id: string | null = null;
  /** Set when a switch or a reload drops the zoom: the key must be let go
   *  and pressed again before the zoom comes back. */
  private awaitingRelease = false;
  /** The `zoom` action as the last update saw it held. */
  private lastHeld = false;

  /** Called whenever the active blaster changes (and on a reload) with the
   *  new blaster's id. A blaster with no zoom block simply cannot zoom. */
  setBlaster(id: string | null): void {
    if (id === this.id) return;
    this.id = id;
    this.spec = id ? zoomSpecOf(id) : null;
    if (this.spec) this.lastSpec = this.spec;
    this.cancel();
  }

  /** Drop the zoom now (a switch, or a reload starting): the view snaps
   *  back. If the key is held at that moment it must be let go and pressed
   *  again before the zoom comes back. */
  cancel(): void {
    this.factor = 1;
    if (this.lastHeld) this.awaitingRelease = true;
  }

  /** One render frame: ease toward zoomed or not, with the `zoom` action
   *  held and a blaster that can zoom. Returns true while fully zoomed. */
  update(dt: number, held: boolean): boolean {
    const wants = held && this.spec !== null && !this.awaitingRelease;
    this.lastHeld = held;
    if (!held) this.awaitingRelease = false;
    const spec = this.spec;
    const target = wants ? spec!.fovShare : 1;
    // The whole travel is from 1 to fovShare, over easeTime seconds. The
    // last zoom block seen eases the view back after a switch away.
    const ease = spec ?? this.lastSpec;
    const rate = ease ? (1 - ease.fovShare) / ease.easeTime : 5;
    const step = rate * dt;
    if (this.factor > target) this.factor = Math.max(target, this.factor - step);
    else if (this.factor < target) this.factor = Math.min(target, this.factor + step);
    return wants && this.factor <= target + 1e-9;
  }

  /** The camera's field of view: the player's own, narrowed while zoomed. */
  get fov(): number {
    return this.baseFov * this.factor;
  }

  /** The look sensitivity: scaled the same way, so a zoomed aim is finer. */
  get sensitivity(): number {
    return this.baseSensitivity * this.factor;
  }
}
