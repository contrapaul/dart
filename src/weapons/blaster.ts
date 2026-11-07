import * as THREE from "three";
import type { DartTypeName, DartShot, ShotChunk } from "./darts";
import blastersJson from "../../data/blasters.json";

// GAME-09: the resolved blaster spec, written once when the blaster and its
// active mods are chosen. The Blaster only reads it, so the per-step update
// stays allocation-free. Scalar fields are one source per value; a mod
// overrides a field, and a nested block such as `recoil` merges key by key.

export type BlasterMode = "pump" | "auto" | "break" | "semi" | "burst";
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
  /** GAME-09f: B07's drum: degrees the drum node turns per shot (one
   *  chamber), eased over the pump time by the viewmodel. */
  drumStepDeg?: number;
  breachOpenDeg?: number;
  latchDeg?: number;
  /** ART-05a: B02's slide: how far the slide node goes back along its
   *  local +Z on a shot, and the seconds it takes to come home. */
  slideTravel?: number;
  slideReturn?: number;
  /** ART-05a: B05's bolt: degrees the bolt node lifts about its local Z
   *  and how far it slides back along its local +Z across the priming.
   *  With boltTravel alone (no lift) the same node works as a cocking
   *  handle pulled during the reload (B06). */
  boltLiftDeg?: number;
  boltTravel?: number;
  /** ART-05b: reload tilt: degrees the whole viewmodel rolls about its
   *  forward axis at the middle of a reload, easing over and back. Positive
   *  is to the right as the player sees it (B02 rolls right, B04 left).
   *  A blaster without the field is untouched. */
  reloadRollDeg?: number;
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
  /** GAME-09c: burst mode: darts per press, the gap between them, and
   *  the wait after the last dart. Defaults cover a blaster without the
   *  mod (count 1, so it is just one dart and no gap is measured). */
  burstCount: number;
  burstGap: number;
  burstCooldown: number;
  spinUp: number;
  spinDown: number;
  /** GAME-09g: B08's movement slow: while the blaster is firing (the
   *  trigger held, the wheels up to speed) the player walks and sprints at
   *  this share of their speed. 1 for every other blaster. The page feeds
   *  it to the controller's fireMoveScale, a second scale that multiplies
   *  in beside the shield's own speedScale, not a replacement for it. */
  fireMoveShare: number;
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
  /** GAME-09d: B06's explosive mod: every nth shot explodes at its first
   *  hit through the shared ExplosionSystem. 0: no explosive shots. */
  explosiveEvery: number;
  /** GAME-09f mod 1 (B07 remote detonate): rounds stop where they first
   *  hit and stay live; a fire press while any are live detonates them
   *  all instead of firing. */
  remote: boolean;
  /** GAME-09f mod 2 (B07 cluster): the round's blast throws four small
   *  blasts around it (the shared explosion reads the data's cluster
   *  block). */
  cluster: boolean;
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
  /** GAME-09f: the live remote rounds waiting to be detonated, and the
   *  detonation of them all (B07's remote mod). The real DartSystem has
   *  both; a test fake may omit them (a blaster without the mod never
   *  calls them). */
  liveRounds?(): number;
  detonateLive?(): number;
}

// GAME-09b: shot ids, one counter for every blaster, so two blasters'
// shots never share an id inside the chunk window.
let shotSeq = 0;

// The raw shape of one entry in data/blasters.json before mods merge in.
interface RawMod {
  mode?: string;
  dartType?: string;
  dartsPerShot?: number;
  spreadDeg?: number;
  magSize?: number;
  /** GAME-09d: the rate mod (B06) overrides the auto interval. */
  fireInterval?: number;
  /** GAME-09g: B08's Control mod eases the firing movement slow. */
  fireMoveShare?: number;
  muzzles?: string[];
  bothBarrels?: boolean;
  burstCount?: number;
  burstGap?: number;
  burstCooldown?: number;
  recoil?: Partial<RecoilSpec>;
  /** ART-05b: a mod's own motion: keys here override the blaster's motion
   *  block key by key, the way `recoil` does (B02 heavy: a bigger kick and
   *  a slower slide return). */
  motion?: Partial<MotionSpec>;
  show?: string[];
  hide?: string[];
  chunk?: ShotChunk | null;
  /** GAME-09d: every nth shot of this mod explodes (the explosive mod). */
  explosiveEvery?: number;
  /** GAME-09f: B07's remote detonate and cluster mods. */
  remote?: boolean;
  cluster?: boolean;
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
  /** GAME-09g: the firing movement slow (B08), overridable by a mod
   *  (B08's Control mod eases it). */
  fireMoveShare?: number;
  bothBarrels?: boolean;
  recoil?: Partial<RecoilSpec>;
  muzzles: string[];
  viewmodel: ViewmodelSpec;
  motion: MotionSpec;
  chunk?: ShotChunk | null;
  /** GAME-09d: every nth shot explodes (B06's explosive mod). */
  explosiveEvery?: number;
  /** GAME-09f: B07's remote detonate and cluster mods. */
  remote?: boolean;
  cluster?: boolean;
  mods?: Record<string, RawMod>;
}

/** Merge a blaster's data with its active mods into a resolved spec. The
 *  mod's scalar fields overwrite the blaster's, its muzzles replace the
 *  list, its recoil and motion blocks merge key by key, and its show and
 *  hide node lists accumulate. */
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
    burstCount: 1,
    burstGap: 0,
    burstCooldown: 0,
    spinUp: raw.spinUp ?? 0,
    spinDown: raw.spinDown ?? 0,
    fireMoveShare: raw.fireMoveShare ?? 1,
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
    explosiveEvery: raw.explosiveEvery ?? 0,
    remote: raw.remote ?? false,
    cluster: raw.cluster ?? false,
  };
  for (const m of activeMods) {
    const mod = raw.mods?.[m];
    if (!mod) continue;
    if (mod.mode !== undefined) s.mode = mod.mode as BlasterMode;
    if (mod.dartType !== undefined) s.dartType = mod.dartType as DartTypeName;
    if (mod.dartsPerShot !== undefined) s.dartsPerShot = mod.dartsPerShot;
    if (mod.spreadDeg !== undefined) s.spreadDeg = mod.spreadDeg;
    if (mod.magSize !== undefined) s.magSize = mod.magSize;
    if (mod.fireInterval !== undefined) s.fireInterval = mod.fireInterval;
    if (mod.fireMoveShare !== undefined) s.fireMoveShare = mod.fireMoveShare;
    if (mod.burstCount !== undefined) s.burstCount = mod.burstCount;
    if (mod.burstGap !== undefined) s.burstGap = mod.burstGap;
    if (mod.burstCooldown !== undefined) s.burstCooldown = mod.burstCooldown;
    if (mod.muzzles !== undefined) s.muzzles = [...mod.muzzles];
    if (mod.bothBarrels !== undefined) s.bothBarrels = mod.bothBarrels;
    if (mod.recoil) s.recoil = { ...s.recoil, ...mod.recoil };
    if (mod.motion) s.motion = { ...s.motion, ...mod.motion };
    if (mod.chunk !== undefined) s.chunk = mod.chunk;
    if (mod.explosiveEvery !== undefined) s.explosiveEvery = mod.explosiveEvery;
    if (mod.remote !== undefined) s.remote = mod.remote;
    if (mod.cluster !== undefined) s.cluster = mod.cluster;
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
  /** GAME-09g: true while an auto blaster is actually shooting: the
   *  trigger held and the wheels up to speed (B08's movement slow reads
   *  this through the page). */
  firing = false;
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
  // GAME-09c: burst mode: the darts still to fire from the last press,
  // and the seconds since the last dart of a running burst.
  private burstLeft = 0;
  private burstGapT = 0;
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
    // A fresh burst blaster can burst at once: the cooldown is the gate,
    // not the shots' own interval.
    if (spec.mode === "burst") this.fireClock = spec.burstCooldown;
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
    // GAME-09d review: the clock stores at most one shot. Uncapped, it grew
    // through every idle step and a full-auto blaster then emptied its
    // magazine one dart per step after a pause.
    // (Review, after merging B06: a burst's cooldown runs on this clock too,
    // so the cap covers the longer of the two.)
    this.fireClock = Math.min(this.fireClock + dt, Math.max(s.fireInterval, s.burstCooldown) + dt);
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
      case "burst":
        this.updateBurst(controls, dt);
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
    // GAME-09f mod 1 (Paul): with the remote mod, a press while any
    // rounds are live detonates them all instead of firing; a press with
    // none live fires as usual. The detonation spends no round and works
    // the pump not at all: nothing left the drum.
    if (s.remote && this.darts.liveRounds && this.darts.liveRounds() > 0) {
      this.darts.detonateLive?.();
      return;
    }
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
    this.semiShot();
  }

  /** A semi dart: the shared bookkeeping behind one shot of one.
   *  Resets the fire clock so the next press is capped at one per
   *  interval (semi) or one burst per cooldown (burst). */
  private semiShot(): void {
    const s = this.spec;
    this.fireClock = 0;
    this.mag -= 1;
    this.shots += 1;
    this.beginShot();
    this.fireDart(0, s.spreadDeg);
  }

  /** GAME-09c: burst mode: one press fires burstCount darts burstGap
   *  apart, then waits burstCooldown. A running burst ignores further
   *  presses, and a magazine that runs out mid-burst ends it with what
   *  is left. The cooldown clock is fireClock, counted from the last
   *  dart. */
  private updateBurst(controls: BlasterControls, dt: number): void {
    const s = this.spec;
    if (this.burstLeft > 0) {
      if (this.mag === 0) {
        // Empty mid-burst: it ends with what was left.
        this.burstLeft = 0;
        if (s.autoReload && this.reserve > 0) this.startReload();
        return;
      }
      // A running burst fires on the gap clock and nothing else.
      this.burstGapT += dt;
      if (this.burstGapT < s.burstGap) return;
      this.burstGapT = 0;
      this.burstLeft -= 1;
      this.semiShot();
      // A burst that empties the magazine takes over at once: the reserve
      // never runs out, so a reload is always possible.
      if (this.mag === 0 && s.autoReload && this.reserve > 0) this.startReload();
      return;
    }
    if (!controls.firePressed) return;
    if (this.fireClock < s.burstCooldown) return;
    if (this.mag === 0) {
      if (s.autoReload && this.reserve > 0) this.startReload();
      return;
    }
    // The first dart fires at once; the rest follow on the gap clock and
    // the cooldown runs from that dart. A one dart burst starts a burst
    // with burstLeft at zero, so the gap clock never runs.
    this.burstLeft = Math.min(s.burstCount, this.mag) - 1;
    this.burstGapT = 0;
    this.semiShot();
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
    // GAME-09d: with the explosive mod, every nth shot's darts blast on
    // their first hit. Counted here, on the blaster, like the shot ids;
    // callers increment shots just before calling this.
    this.shot.explodes =
      this.spec.explosiveEvery > 0 && this.shots % this.spec.explosiveEvery === 0;
    this.shot.exploded = false;
    // GAME-09f: the launcher round explodes at its first hit, every shot
    // (explosiveEvery 1 on B07). With the remote mod it stops where it
    // hits instead, live until a press detonates it; with the cluster mod
    // its blast also throws four small ones around it.
    this.shot.liveRound = this.spec.remote && this.shot.explodes;
    this.shot.clustered = this.spec.cluster && this.shot.explodes;
  }

  // The aim for this step, set in update() so fireDart reads it.
  private _aimDir = new THREE.Vector3();

  /** B04: flywheel spin-up and spin-down, and the recoil growth while
   *  firing, recover when not. */
  private updateAuto(dt: number, fireHeld: boolean): void {
    const s = this.spec;
    const r = s.recoil;
    // GAME-09g: the firing flag for the movement slow: the trigger held
    // and the wheels up to speed. Cleared for every other mode in update.
    this.firing = fireHeld && this.wheelSpeed >= 1 && this.st === "ready";
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
    // GAME-09g: with B08's Twin mod the spec lists two muzzles and the
    // auto shot alternates them; a one-muzzle blaster always fires from 0.
    const n = s.muzzles.length;
    this.fireDart(this.nextMuzzle % n, s.spreadDeg + this.spreadNow);
    this.nextMuzzle = (this.nextMuzzle + 1) % n;
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
