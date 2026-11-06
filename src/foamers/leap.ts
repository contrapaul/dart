import type { FoamerSpec } from "./foamer";

// GAME-10f: the Brawler's leap slam and its shockwave ring. A type that
// leaps carries these numbers in its spec (data/foamers.json, `leap` and
// `shockwave`); every other type has none, so the Foamer system never
// enters the leap path for it.
//
// Pure module: no Three.js and no Rapier, so the arc and the ring can be
// tested without a renderer or a world. The Foamer side (src/foamers/
// foamers.ts) drives them from its state machine.

export interface LeapSpec {
  /** It leaps when the player is between these distances (metres). */
  minMetres: number;
  maxMetres: number;
  /** Seconds before it may leap again (from the start of the crouch). */
  cooldownSeconds: number;
  /** The crouch before the leap, seconds: the telegraph. */
  crouchSeconds: number;
  /** Metres per second along the ground during the flight. */
  speed: number;
  /** The apex of the arc over the ground it leaves, metres. */
  arcMetres: number;
  /** The landing point is this far short of where the player was, metres,
   *  so the leap itself does not land on them: the ring is the threat. */
  landShortMetres: number;
}

export interface ShockwaveSpec {
  /** Metres per second the ring grows outward. */
  speed: number;
  /** How far out the ring reaches, metres. */
  radius: number;
  /** The band's thickness, metres. A player the outer edge reaches inside
   *  this of the inner edge is hit; one the whole band has passed is not. */
  thickness: number;
  /** The drawn ring's tube radius, metres (the ring is a solid torus). */
  tubeMetres: number;
  /** Health it costs a grounded player the band passes over. */
  damage: number;
}

/** The leap numbers of a type, or null when it does not leap. */
export function leapOf(spec: FoamerSpec): LeapSpec | null {
  return (spec as { leap?: LeapSpec }).leap ?? null;
}

/** The shockwave numbers of a type, or null when it lands no ring. */
export function shockwaveOf(spec: FoamerSpec): ShockwaveSpec | null {
  return (spec as { shockwave?: ShockwaveSpec }).shockwave ?? null;
}

/** What one step tells the leap logic (the Foamer side fills it in). */
export interface LeapInput {
  /** Metres to the player, ground plane. */
  distance: number;
  /** Seconds until it may leap again (the crouch starts it). */
  cooldownLeft: number;
  /** It is on its feet: a legless Brawler crawls, it cannot leap. */
  onFeet: boolean;
}

/** May it start the crouch that leads to a leap? Only with the cooldown
 *  spent, on its feet, and with the player between the minimum (too close
 *  to be worth a leap) and the maximum (too far to reach). Like the
 *  charger's decideCharge, it is up to the caller to be in a state that may
 *  start one. */
export function decideLeap(input: LeapInput, spec: LeapSpec): boolean {
  if (!input.onFeet || input.cooldownLeft > 0) return false;
  return input.distance >= spec.minMetres && input.distance <= spec.maxMetres;
}

/** The point the leap lands at: the target pulled back along the way to it
 *  by landShortMetres, so it never lands on the player. */
export function landingPoint(
  fromX: number, fromZ: number, toX: number, toZ: number, landShortMetres: number,
): { x: number; z: number } {
  const dx = toX - fromX;
  const dz = toZ - fromZ;
  const d = Math.hypot(dx, dz);
  if (d < 1e-4) return { x: fromX, z: fromZ };
  const back = Math.min(landShortMetres, d);
  return { x: toX - (dx / d) * back, z: toZ - (dz / d) * back };
}

/** The flight: how long it lasts and the initial vertical speed, from the
 *  horizontal distance, the ground speed and the arc height, under the
 *  type's gravity. The arc is a plain parabola that leaves and lands on the
 *  ground it started from, so `vy` is what carries it up to arcMetres and
 *  back within the time. */
export function leapFlight(
  metres: number, speed: number, arcMetres: number, gravity: number,
): { seconds: number; vy: number } {
  if (speed <= 0 || gravity <= 0) return { seconds: 0, vy: 0 };
  // Time to rise arcMetres and fall back: t = 2*sqrt(2*arc/g), floored so a
  // very short hop still reads, and stretched if the distance needs it.
  const hop = 2 * Math.sqrt((2 * arcMetres) / gravity);
  const seconds = Math.max(hop, metres / speed);
  return { seconds, vy: gravity * seconds * 0.5 };
}

/** One shockwave ring: where it landed, how far it has grown, and whether
 *  the player has already been dealt with. One per Brawler, reused. */
export interface Shockwave {
  /** The spec this ring was started from, kept so the draw side can read
   *  tubeMetres without the Foamer. */
  spec: ShockwaveSpec | null;
  active: boolean;
  x: number;
  z: number;
  /** Seconds since it landed. */
  age: number;
  /** Metres the outer edge has reached. */
  radius: number;
  /** The ring's edge has gone past the player's distance and the band
   *  behind it too: no hit later. */
  passed: boolean;
  /** The band has already hit the player once. */
  hit: boolean;
}

export function makeShockwave(): Shockwave {
  return { spec: null, active: false, x: 0, z: 0, age: 0, radius: 0, passed: false, hit: false };
}

/** Start a ring at a landing point. */
export function startShockwave(w: Shockwave, spec: ShockwaveSpec, x: number, z: number): void {
  w.spec = spec;
  w.active = true;
  w.x = x;
  w.z = z;
  w.age = 0;
  w.radius = 0;
  w.passed = false;
  w.hit = false;
}

/** Grow a ring one step. Returns false once it has fully faded, so the
 *  caller can hide it. */
export function stepShockwave(w: Shockwave, dt: number, spec: ShockwaveSpec): boolean {
  if (!w.active) return false;
  w.age += dt;
  w.radius = Math.min(spec.radius, spec.speed * w.age);
  if (w.radius >= spec.radius - 1e-6) {
    w.active = false; // done: the band can no longer reach anyone
    return false;
  }
  return true;
}

/** May this ring's band still catch the player at distance `playerMetres`?
 *  A true answer means: hit them now (and mark `hit`), once. False when the
 *  whole band has gone past them (they were in the hole, or they jumped the
 *  band and are standing inside it afterwards), or they were already hit. */
export function bandReaches(w: Shockwave, playerMetres: number, spec: ShockwaveSpec): boolean {
  if (!w.active || w.hit) return false;
  if (w.radius >= playerMetres) {
    // The outer edge has arrived. Inside the band means the inner edge has
    // not gone past them yet; once it has, this stays false for good.
    if (playerMetres >= w.radius - spec.thickness) {
      w.hit = true; // one hit per ring, marked here so a caller cannot forget
      return true;
    }
    w.passed = true;
    return false;
  }
  return false;
}
