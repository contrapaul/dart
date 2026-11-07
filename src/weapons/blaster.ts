import * as THREE from "three";
import type { DartTypeName, DartShot, ShotChunk } from "./darts";
import blastersJson from "../../data/blasters.json";

// GAME-09: the resolved blaster spec, written once when the blaster and its
// active mods are chosen. The Blaster only reads it, so the per-step update
// stays allocation-free. Scalar fields are one source per value; a mod
// overrides a field, and a nested block such as `recoil` merges key by key.

export type BlasterMode = "pump" | "auto" | "break" | "semi";
export type BlasterState = "ready" | "priming" | "reloading";

export interface RecoilSpec {
  spreadPerShot: number;
  spreadMax: number;
  climbDegPerShot: number;
  climbDegMax: number;
  recover: number;
}

export interface ViewmodelSpec {
  position: [number, number, number];
  rotationDeg: [number, number, number];
  scale: number;
}

export interface MotionSpec {
  kick: number;
  tiltDeg: number;
  return: number;
  triggerDeg: number;
  pumpTravel?: number;
  magDrop?: number;
  wheelSpin?: number;
  breachOpenDeg?: number;
  latchDeg?: number;
}

export interface BlasterSpec {
  name: string;
  model: string;
  mode: BlasterMode;
  dartType: DartTypeName;
  dartsPerShot: number;
  spreadDeg: number;
  magSize: number;
  reserveMax: number;
  reserveStart: number;
  /** GAME-09c: the reserve never runs out: reloads always fill the
   *  magazine, and ammo boxes and the vacuum's refill skip it. */
  reserveInfinite: boolean;
  reloadTime: number;
  primeTime: number;
  fireInterval: number;
  spinUp: number;
  spinDown: number;
  autoReload: boolean;
  recoil: RecoilSpec;
  bothBarrels: boolean;
  muzzles: string[];
  show: string[];
  hide: string[];
  viewmodel: ViewmodelSpec;
  motion: MotionSpec;
  /** GAME-09b: null for a blaster and mod that cannot chunk. */
  chunk: ShotChunk | null;
}

export interface BlasterControls {
  fireHeld: boolean;
  firePressed: boolean;
  reloadPressed: boolean;
}

// What the blaster can do with a dart system, kept as a small interface so a
// test can pass a recording fake in place of the real DartSystem.
export interface DartFiring {
  fire(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    type: DartTypeName,
    shot?: DartShot | null,
  ): void;
}

// GAME-09b: shot ids, one counter for every blaster, so two blasters'
// shots never share an id inside the chunk window.
let shotSeq = 0;

// The raw shape of one entry in data/blasters.json before mods merge in.
interface RawMod {
  dartType?: string;
  dartsPerShot?: number;
  spreadDeg?: number;
  magSize?: number;
  muzzles?: string[];
  bothBarrels?: boolean;
  recoil?: Partial<RecoilSpec>;
  show?: string[];
  hide?: string[];
  chunk?: ShotChunk | null;
  _note?: string;
}

interface RawBlaster {
  name: string;
  model: string;
  mode: string;
  dartType: string;
  dartsPerShot: number;
  spreadDeg: number;
  magSize: number;
  reserveMax: number;
  reserveStart: number;
  reserveInfinite?: boolean;
  reloadTime: number;
  autoReload: boolean;
  primeTime?: number;
  fireInterval?: number;
  spinUp?: number;
  spinDown?: number;
  bothBarrels?: boolean;
  recoil?: Partial<RecoilSpec>;
  muzzles: string[];
  viewmodel: ViewmodelSpec;
  motion: MotionSpec;
  chunk?: ShotChunk | null;
  mods?: Record<string, RawMod>;
}

/** Merge a blaster's data with its active mods into a resolved spec. The
 *  mod's scalar fields overwrite the blaster's, its muzzles replace the
 *  list, its recoil block merges key by key, and its show and hide node
 *  lists accumulate. */
export function resolveSpec(blasterId: string, activeMods: string[] = []): BlasterSpec {
  const raw = (blastersJson as unknown as Record<string, RawBlaster>)[blasterId];
  const s: BlasterSpec = {
    name: raw.name,
    model: raw.model,
    mode: raw.mode as BlasterMode,
    dartType: raw.dartType as DartTypeName,
    dartsPerShot: raw.dartsPerShot,
    spreadDeg: raw.spreadDeg,
    magSize: raw.magSize,
    reserveMax: raw.reserveMax,
    reserveStart: raw.reserveStart,
    reserveInfinite: raw.reserveInfinite ?? false,
    reloadTime: raw.reloadTime,
    primeTime: raw.primeTime ?? 0,
    fireInterval: raw.fireInterval ?? 0,
    spinUp: raw.spinUp ?? 0,
    spinDown: raw.spinDown ?? 0,
    autoReload: raw.autoReload,
    recoil: {
      spreadPerShot: 0, spreadMax: 0, climbDegPerShot: 0, climbDegMax: 0, recover: 0,
      ...(raw.recoil ?? {}),
    },
    bothBarrels: raw.bothBarrels ?? false,
    muzzles: [...raw.muzzles],
    show: [],
    hide: [],
    viewmodel: raw.viewmodel,
    motion: raw.motion,
    chunk: raw.chunk ?? null,
  };
  for (const m of activeMods) {
    const mod = raw.mods?.[m];
    if (!mod) continue;
    if (mod.dartType !== undefined) s.dartType = mod.dartType as DartTypeName;
    if (mod.dartsPerShot !== undefined) s.dartsPerShot = mod.dartsPerShot;
    if (mod.spreadDeg !== undefined) s.spreadDeg = mod.spreadDeg;
    if (mod.magSize !== undefined) s.magSize = mod.magSize;
    if (mod.muzzles !== undefined) s.muzzles = [...mod.muzzles];
    if (mod.bothBarrels !== undefined) s.bothBarrels = mod.bothBarrels;
    if (mod.recoil) s.recoil = { ...s.recoil, ...mod.recoil };
    if (mod.chunk !== undefined) s.chunk = mod.chunk;
    for (const n of mod.show ?? []) if (!s.show.includes(n)) s.show.push(n);
    for (const n of mod.hide ?? []) if (!s.hide.includes(n)) s.hide.push(n);
  }
  return s;
}

// Shared scratch, allocated once: the update steps allocate nothing.
const _UP = new THREE.Vector3(0, 1, 0);
const _X = new THREE.Vector3(1, 0, 0);
const _u = new THREE.Vector3();
const _right = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _side = new THREE.Vector3();
const _dir = new THREE.Vector3();

/** Write a random unit vector inside a cone of `deg` degrees around `dir`
 *  into out. cos is uniform between cos(deg) and 1, the cone's disc. */
function coneDir(out: THREE.Vector3, dir: THREE.Vector3, deg: number, rng: () => number): void {
  if (deg <= 0) { out.copy(dir); return; }
  const c = Math.cos(THREE.MathUtils.degToRad(deg));
  const u = c + (1 - c) * rng();
  const a = Math.sqrt(Math.max(0, 1 - u * u));
  const t = rng() * Math.PI * 2;
  _u.set(a * Math.cos(t), a * Math.sin(t), u);
  const up = Math.abs(dir.y) < 0.99 ? _UP : _X;
  _fwd.copy(dir);
  _right.crossVectors(up, _fwd).normalize();
  _side.crossVectors(_fwd, _right);
  out.copy(_right)
    .multiplyScalar(_u.x)
    .addScaledVector(_side, _u.y)
    .addScaledVector(_fwd, _u.z);
}

/** Tilt `dir` up by `deg` degrees into out (aim climbs above the view). */
function tiltUp(out: THREE.Vector3, dir: THREE.Vector3, deg: number): void {
  if (deg <= 0) { out.copy(dir); return; }
  const up = Math.abs(dir.y) < 0.99 ? _UP : _X;
  // Right of `dir`: cross(dir, up). Out = dir*cos + right×dir*sin lifts a
  // forward vector toward up.
  _right.crossVectors(dir, up).normalize();
  _side.crossVectors(_right, dir);
  const a = THREE.MathUtils.degToRad(deg);
  out.copy(dir)
    .multiplyScalar(Math.cos(a))
    .addScaledVector(_side, Math.sin(a))
    .normalize();
}

export class Blaster {
  readonly spec: BlasterSpec;
  dartType: DartTypeName;
  mag: number;
  reserve: number;
  /** Shots fired so far, one per magazine round spent (AUD-01: the fire
   *  sound counts these, so a refill in onShot cannot hide a shot). */
  shots = 0;
  /** Auto recoil: added spread over the base, degrees. 0 for pump and break. */
  spreadNow = 0;
  /** Auto recoil: aim climb, degrees. 0 for pump and break. */
  climbDegNow = 0;
  /** B04: flywheel speed, 0 to 1. 0 for the other modes. */
  wheelSpeed = 0;
  /** B03: which barrels hold a shell, in muzzle order. Empty for other modes. */
  readonly loaded: boolean[];
  /** Called once per dart that leaves a muzzle, with the muzzle index,
   *  for the viewmodel. */
  onShot: (muzzleIndex: number) => void = () => {};

  private st: BlasterState = "ready";
  private t = 0;
  private darts: DartFiring;
  private muzzle: (i: number) => THREE.Vector3;
  private rng: () => number;
  private nextMuzzle = 0;   // pump: round-robin across the active muzzles
  private nextBarrel = 0;   // break: barrel to try next on a press
  // Seconds since the last shot (auto, break). Starts at the interval in
  // the constructor so the very first press can fire.
  private fireClock = 0;
  // GAME-09b: the shot id and muzzle a shot's darts carry. One per trigger
  // pull: every dart that leaves for one press shares the id, so the hit
  // can add up what the shot did.
  private readonly shot: DartShot = { id: 0, muzzle: new THREE.Vector3(), chunk: null };
  // Auto recoil recover: the values captured on release, eased to 0 over
  // `recover` seconds.
  private recoving = false;
  private recovT = 0;
  private recovSpread = 0;
  private recovClimb = 0;

  constructor(
    spec: BlasterSpec,
    darts: DartFiring,
    muzzle: (i: number) => THREE.Vector3,
    rng?: () => number,
  ) {
    this.spec = spec;
    this.darts = darts;
    this.muzzle = muzzle;
    this.rng = rng ?? Math.random;
    this.dartType = spec.dartType;
    this.mag = spec.magSize;
    this.reserve = spec.reserveStart;
    this.fireClock = spec.fireInterval;
    this.loaded = new Array(spec.muzzles.length).fill(false);
    if (spec.mode === "break") {
      for (let i = 0; i < spec.muzzles.length && i < spec.magSize; i++) this.loaded[i] = true;
    }
  }

  get state(): BlasterState {
    return this.st;
  }

  /** Auto recoil, aim climb in radians (the page adds it to the camera
   *  pitch it draws). 0 for pump and break. */
  get climb(): number {
    return THREE.MathUtils.degToRad(this.climbDegNow);
  }

  /** 0 to 1 progress through the current priming or reload; 1 when ready. */
  get progress(): number {
    if (this.st === "ready") return 1;
    const dur = this.st === "priming" ? this.spec.primeTime : this.spec.reloadTime;
    return Math.min(1, this.t / dur);
  }

  /** B03: reload phase 0 to 1; 1 when not reloading. Used by the animation. */
  get reloadPhase(): number {
    return this.st === "reloading" ? this.progress : 1;
  }

  /** Advance the auto recoil toward its target. aims is the base spread in
   *  degrees plus this; the climb is the aim pitch tilt. */
  update(dt: number, controls: BlasterControls, aimDir: THREE.Vector3): void {
    const s = this.spec;
    // Aim for this step: the base direction plus the auto climb (B04 only).
    if (s.mode === "auto" && this.climbDegNow > 0)
      tiltUp(this._aimDir, aimDir, this.climbDegNow);
    else this._aimDir.copy(aimDir);
    // Auto recoil spins down while the trigger is not held.
    if (s.mode === "auto") this.updateAuto(dt, controls.fireHeld);
    // Count down the ready timers before any state work.
    if (this.st !== "ready") {
      this.t += dt;
      const dur = this.st === "priming" ? s.primeTime : s.reloadTime;
      if (this.t >= dur) {
        if (this.st === "reloading") this.finishReload();
        this.st = "ready";
        this.t = 0;
        if (this.magEmpty() && s.autoReload && this.reserve > 0) this.startReload();
      }
      return;
    }
    this.fireClock += dt;
    if (controls.reloadPressed && this.mag < s.magSize && this.reserve > 0) {
      this.startReload();
      return;
    }
    switch (s.mode) {
      case "pump":
        this.updatePump(controls);
        break;
      case "auto":
        if (controls.fireHeld) this.updateAutoFire();
        break;
      case "break":
        this.updateBreak(controls);
        break;
      case "semi":
        this.updateSemi(controls);
        break;
    }
  }

  /** Fill the magazine (or every barrel) without touching the reserve:
   *  the range's infinite ammo switch. */
  refill(): void {
    this.mag = this.spec.magSize;
    this.loaded.fill(true);
  }

  private magEmpty(): boolean {
    return this.spec.mode === "break"
      ? !this.loaded.some(Boolean)
      : this.mag === 0;
  }

  private startReload(): void {
    if (this.st !== "ready" || this.reserve <= 0) return;
    // Full means: every barrel loaded (break) or the magazine at magSize.
    const full = this.spec.mode === "break"
      ? this.loaded.every(Boolean)
      : this.mag >= this.spec.magSize;
    if (full) return;
    this.st = "reloading";
    this.t = 0;
  }

  private finishReload(): void {
    const s = this.spec;
    if (s.mode === "break") {
      // Only the empty barrels take a shell.
      let take = Math.min(s.magSize - this.mag, this.reserve);
      this.reserve -= take;
      for (let i = 0; i < this.loaded.length && take > 0; i++) {
        if (this.loaded[i]) continue;
        this.loaded[i] = true;
        this.mag += 1;
        take -= 1;
      }
    } else {
      // GAME-09c: an infinite reserve never empties: the magazine takes
      // the full count and the reserve stays full.
      if (s.reserveInfinite) {
        this.mag = s.magSize;
        return;
      }
      const take = Math.min(s.magSize - this.mag, this.reserve);
      this.mag += take;
      this.reserve -= take;
    }
  }

  private updatePump(controls: BlasterControls): void {
    const s = this.spec;
    if (!controls.firePressed) return;
    if (this.mag > 0) {
      this.mag -= 1;
      this.shots += 1;
      const n = s.muzzles.length;
      const start = this.nextMuzzle;
      this.beginShot();
      for (let k = 0; k < s.dartsPerShot; k++) this.fireDart((start + k) % n, s.spreadDeg);
      this.nextMuzzle = (start + s.dartsPerShot) % n;
      this.st = "priming";
      this.t = 0;
    } else if (s.autoReload && this.reserve > 0) {
      this.startReload();
    }
  }

  /** GAME-09c: semi-auto: one dart per trigger press, no pump and no
   *  hold-to-fire; presses faster than fireInterval are capped; an empty
   *  magazine with autoReload starts a reload. */
  private updateSemi(controls: BlasterControls): void {
    const s = this.spec;
    if (!controls.firePressed) return;
    if (this.fireClock < s.fireInterval) return;
    if (this.mag === 0) {
      if (s.autoReload && this.reserve > 0) this.startReload();
      return;
    }
    this.fireClock = 0;
    this.mag -= 1;
    this.shots += 1;
    this.beginShot();
    this.fireDart(0, s.spreadDeg);
  }

  /** Fire one dart from muzzle index `i` with a cone of `spreadDeg` around
   *  the current aim; the aim already includes the auto climb for B04. */
  private fireDart(i: number, spreadDeg: number): void {
    coneDir(_dir, this._aimDir, spreadDeg, this.rng);
    const o = this.muzzle(i);
    this.shot.muzzle.copy(o);
    this.darts.fire(o, _dir, this.dartType, this.shot);
    this.onShot(i);
  }

  /** GAME-09b: start a shot: one id per trigger pull (a B03 press fires one
   *  or both barrels as one shot). Its darts carry the id, the muzzle they
   *  leave and the blaster's chunk block. */
  private beginShot(): void {
    this.shot.id = ++shotSeq;
    this.shot.chunk = this.spec.chunk;
  }

  // The aim for this step, set in update() so fireDart reads it.
  private _aimDir = new THREE.Vector3();

  /** B04: flywheel spin-up and spin-down, and the recoil growth while
   *  firing, recover when not. */
  private updateAuto(dt: number, fireHeld: boolean): void {
    const s = this.spec;
    const r = s.recoil;
    if (fireHeld) {
      this.wheelSpeed = Math.min(1, this.wheelSpeed + dt / Math.max(s.spinUp, 1e-6));
      this.recoving = false;
    } else {
      this.wheelSpeed = Math.max(0, this.wheelSpeed - dt / Math.max(s.spinDown, 1e-6));
      if (!this.recoving && (this.spreadNow > 0 || this.climbDegNow > 0)) {
        this.recoving = true;
        this.recovT = 0;
        this.recovSpread = this.spreadNow;
        this.recovClimb = this.climbDegNow;
      }
      if (this.recoving) {
        this.recovT += dt;
        const k = 1 - this.recovT / Math.max(r.recover, 1e-6);
        if (k <= 1e-9) {
          this.recoving = false;
          this.spreadNow = 0;
          this.climbDegNow = 0;
        } else {
          this.spreadNow = this.recovSpread * k;
          this.climbDegNow = this.recovClimb * k;
        }
      }
    }
  }

  private updateAutoFire(): void {
    const s = this.spec;
    const r = s.recoil;
    if (this.wheelSpeed < 1) return;
    if (this.fireClock < s.fireInterval) return;
    if (this.mag === 0) {
      if (s.autoReload && this.reserve > 0) this.startReload();
      return;
    }
    // Subtract the interval, not zero, so the shot rate stays exactly one
    // per fireInterval in the long run without drifting out of phase.
    this.fireClock -= s.fireInterval;
    this.mag -= 1;
    this.shots += 1;
    this.beginShot();
    this.spreadNow = Math.min(r.spreadMax, this.spreadNow + r.spreadPerShot);
    this.climbDegNow = Math.min(r.climbDegMax, this.climbDegNow + r.climbDegPerShot);
    this.fireDart(0, s.spreadDeg + this.spreadNow);
  }

  /** B03: one press fires the next loaded barrel (all of them with
   *  bothBarrels), at least fireInterval apart; empty starts a reload. */
  private updateBreak(controls: BlasterControls): void {
    const s = this.spec;
    if (!controls.firePressed) return;
    if (this.fireClock < s.fireInterval) return;
    const n = this.loaded.length;
    if (!this.loaded.some(Boolean)) {
      if (s.autoReload && this.reserve > 0) this.startReload();
      return;
    }
    this.fireClock -= s.fireInterval;
    this.beginShot();
    const fire = (i: number) => {
      for (let k = 0; k < s.dartsPerShot; k++) this.fireDart(i, s.spreadDeg);
      this.loaded[i] = false;
      this.mag -= 1; // mag counts the loaded shells
      this.shots += 1;
    };
    if (s.bothBarrels) {
      for (let i = 0; i < n; i++) if (this.loaded[i]) fire(i);
      this.nextBarrel = 0;
    } else {
      // The next loaded barrel at or after nextBarrel, wrapping around. Keep
      // nextBarrel on the last fired barrel (not past it) so that when that
      // barrel is the only one left, the next press retries and it fires,
      // instead of the raw difference tripping the interval guard.
      let i = this.nextBarrel % n;
      for (let k = 0; k < n && !this.loaded[i]; k++) i = (i + 1) % n;
      fire(i);
      this.nextBarrel = i;
    }
  }
}
