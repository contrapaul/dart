import tuning from "../../data/player.json";

// Player health (UI-01 stage 1). Pure: no DOM, no THREE, no clock. The
// page advances `update(dt)` on the fixed step; the grace window after a
// hit ignores further hits so a crowd cannot drain the bar in one second.
// Tuning lives in data/player.json (health.max, health.hitGrace). The
// damage-taken multiplier is set by the difficulty preset in stage 2; it
// stays 1 until then.

const HEALTH = (tuning as unknown as {
  health: { max: number; hitGrace: number };
}).health;

export class PlayerHealth {
  readonly max: number = HEALTH.max;
  /** Damage-taken multiplier from the difficulty (stage 2 sets it). */
  damageTaken = 1;
  hp = this.max;
  /** Seconds left of the post-hit grace; 0 when not invulnerable. */
  private grace = 0;

  /** True at 0 hp. */
  get dead(): boolean {
    return this.hp <= 0;
  }

  /** Advance the grace timer; call once per fixed step. */
  update(dt: number): void {
    if (this.grace > 0) this.grace = Math.max(0, this.grace - dt);
  }

  /** Take a hit. Returns the hp actually lost, 0 while in the grace.
   *  `_from` is the attack id, for the page's flash and sound hooks. */
  damage(amount: number, _from?: string): number {
    if (this.grace > 0 || this.dead) return 0;
    const lost = Math.min(this.hp, Math.max(0, amount * this.damageTaken));
    this.hp -= lost;
    this.grace = HEALTH.hitGrace;
    return lost;
  }

  /** Recover hp, never above max. Returns the hp actually gained. */
  heal(amount: number): number {
    const gained = Math.min(this.max - this.hp, Math.max(0, amount));
    this.hp += gained;
    return gained;
  }

  /** Back to full, grace cleared: the Try again respawn. */
  reset(): void {
    this.hp = this.max;
    this.grace = 0;
  }
}
