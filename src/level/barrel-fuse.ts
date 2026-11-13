import tuning from "../../data/barrel.json";

// ENV-05 (E15): the leaking foam barrel's rules, as plain maths with no
// world. Paul's ask: the Dartman's three standard darts in one cluster blow
// the barrel, so the first puncture starts a `fuseSeconds` fuse, the second
// halves the time that is left, and the third sets it off at once. Three
// punctures in one step are three punctures: nothing here waits for a step
// boundary, so the cluster's third dart goes straight to the blast.
//
// Every number is in data/barrel.json. This file never touches a mesh, a
// collider or the world's clock, so the rules are tested on their own.

export const FUSE_SECONDS: number = tuning.fuseSeconds;
/** How long a barrel waits when a blast reaches it (the ripple). */
export const CHAIN_DELAY: number = tuning.chainDelay;

/** What a hit does to a barrel. */
export type BarrelHit = "puncture" | "setOff";

/** One barrel's fuse: how many punctures it has taken, the simulation
 *  seconds left on it, and whether it has already gone off. */
export interface Fuse {
  punctures: number;
  remaining: number;
  setOff: boolean;
}

/** A fresh fuse: no punctures, nothing counting down. */
export function startFuse(): Fuse {
  return { punctures: 0, remaining: 0, setOff: false };
}

/** A hit's kind: a standard dart punctures, every other round (any other
 *  dart type, the ball) sets it off. The type comes from data, so the
 *  puncture round is Paul's to change without touching this file. */
export function classifyHit(type: string): BarrelHit {
  return type === tuning.punctureType ? "puncture" : "setOff";
}

/** A dart punctures the barrel. Returns true when this puncture is the one
 *  that sets it off, so the caller blasts at once and does not wait for a
 *  tick. The first starts the fuse, the second halves what is left, the
 *  third ends it. Once it has gone off nothing more happens. */
export function puncture(fuse: Fuse): boolean {
  if (fuse.setOff) return false;
  fuse.punctures++;
  if (fuse.punctures === 1) {
    fuse.remaining = FUSE_SECONDS;
    return false;
  }
  if (fuse.punctures === 2) {
    fuse.remaining = fuse.remaining / 2;
    return false;
  }
  fuse.remaining = 0;
  fuse.setOff = true;
  return true;
}

/** Advance a running fuse. True when the fuse ran out on this step, so the
 *  caller blasts once (never once per step while remaining sits at 0). */
export function advance(fuse: Fuse, dt: number): boolean {
  if (fuse.setOff || fuse.punctures === 0 || fuse.remaining <= 0) return false;
  fuse.remaining -= dt;
  if (fuse.remaining > 0) return false;
  fuse.remaining = 0;
  fuse.setOff = true;
  return true;
}

/** How much of the fuse is left, 1 at the first puncture down to 0. The
 *  spray reads it to speed up as the barrel runs down. */
export function shareLeft(fuse: Fuse): number {
  if (fuse.punctures === 0 || fuse.remaining <= 0) return 0;
  return Math.min(1, fuse.remaining / FUSE_SECONDS);
}

/** Whether a blast at a distance reaches a barrel: the blast's own reach
 *  plus the barrel's radius. The reach is the radius the explosion system
 *  reports for the profile, so a bigger round reaches further. */
export function blastReaches(
  distanceFromCentre: number, blastReach: number, barrelRadius: number,
): boolean {
  return distanceFromCentre <= blastReach + barrelRadius;
}
