import tuning from "../../data/hazards.json";

/** The hazard numbers a body is standing in. `look`, `dps`, `slow` and
 *  `hurtsFoamers` come from the level's PrimHazard; `look` is not needed. */
export interface HazardSpec {
  dps: number;
  slow?: number;
  hurtsFoamers?: boolean;
}

/**
 * One body's tick accumulator. Exposure grows only while the body is inside
 * a hazard; a tick drains the accumulator inside, so leaving and returning
 * does not reset to a free tick. Damage is the highest dps times the tick.
 */
export class HazardTickState {
  damage = 0;
  slow = 1;
  private exposure = 0;

  constructor(private readonly tickSeconds = tuning.defaults.tickSeconds) {}

  /** Writes this state; the caller reads damage and slow. */
  step(dt: number, inside: readonly HazardSpec[]): void {
    this.damage = 0;
    this.slow = 1;
    if (inside.length === 0) return;

    let dps = 0;
    let slow = 1;
    for (const hazard of inside) {
      if (hazard.dps > dps) dps = hazard.dps;
      const s = hazard.slow ?? 1;
      if (s < slow) slow = s;
    }
    // Review: a slowing hazard with no damage (deep goo) still slows.
    this.slow = slow;
    if (dps <= 0) return;

    this.exposure += dt;
    while (this.exposure >= this.tickSeconds) {
      this.exposure -= this.tickSeconds;
      this.damage += dps * this.tickSeconds;
    }
  }
}
