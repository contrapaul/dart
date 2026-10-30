import * as THREE from "three";
import type { DartSystem, DartTypeName } from "./darts";

// The placeholder pump-action blaster. Ammo, priming, reload and spread are
// driven by data/blasters.json; the numbers are placeholders until Paul's
// first blaster card (PLAN.md section 5) replaces this spec.

export interface BlasterSpec {
  dartType: DartTypeName;
  dartsPerShot: number;
  spreadDeg: number;
  magSize: number;
  reserveMax: number;
  reserveStart: number;
  primeTime: number;
  reloadTime: number;
  autoReload: boolean;
  muzzle: [number, number, number];
  recoilKick: number;
  recoilReturn: number;
  bodyColor: string;
  accentColor: string;
  trimColor: string;
}

export type BlasterState = "ready" | "priming" | "reloading";
export interface BlasterControls {
  firePressed: boolean;
  reloadPressed: boolean;
}

const _UP = new THREE.Vector3(0, 1, 0);
const _X = new THREE.Vector3(1, 0, 0);
const _u = new THREE.Vector3();   // cone-space v
const _right = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _side = new THREE.Vector3();

/** Write a random unit vector inside a cone of `deg` degrees around `dir`
 *  into out. cos is uniform between cos(deg) and 1, which is uniform over
 *  the cone's disc. */
function coneDir(out: THREE.Vector3, dir: THREE.Vector3, deg: number, rng: () => number): void {
  const c = Math.cos(THREE.MathUtils.degToRad(deg));
  const u = c + (1 - c) * rng();
  const a = Math.sqrt(Math.max(0, 1 - u * u));
  const t = rng() * Math.PI * 2;
  _u.set(a * Math.cos(t), a * Math.sin(t), u);
  // Build a frame whose Z axis is dir, then pull the cone vector in.
  const up = Math.abs(dir.y) < 0.99 ? _UP : _X;
  _fwd.copy(dir);
  _right.crossVectors(up, _fwd).normalize();
  _side.crossVectors(_fwd, _right);
  out.copy(_right)
    .multiplyScalar(_u.x)
    .addScaledVector(_side, _u.y)
    .addScaledVector(_fwd, _u.z);
}

export class Blaster {
  dartType: DartTypeName;
  mag: number;
  reserve: number;
  /** Called once per shot (not per dart), for the model's recoil. */
  onShot: () => void = () => {};

  private st: BlasterState = "ready";
  private t = 0;
  private darts: DartSystem;
  private rng: () => number;
  private spec: BlasterSpec;
  private dir = new THREE.Vector3();

  constructor(spec: BlasterSpec, darts: DartSystem, rng?: () => number) {
    this.spec = spec;
    this.darts = darts;
    this.rng = rng ?? Math.random;
    this.dartType = spec.dartType;
    this.mag = spec.magSize;
    this.reserve = spec.reserveStart;
  }

  get state(): BlasterState {
    return this.st;
  }

  /** 0 to 1 progress through the current priming or reload; 1 when ready. */
  get progress(): number {
    if (this.st === "ready") return 1;
    const dur = this.st === "priming" ? this.spec.primeTime : this.spec.reloadTime;
    return Math.min(1, this.t / dur);
  }

  /** Fixed step. origin is the muzzle in world space; aimDir is the unit
   *  direction from the muzzle to the aim point. */
  update(dt: number, controls: BlasterControls, origin: THREE.Vector3, aimDir: THREE.Vector3): void {
    const s = this.spec;
    if (this.st !== "ready") {
      this.t += dt;
      const dur = this.st === "priming" ? s.primeTime : s.reloadTime;
      if (this.t >= dur) {
        if (this.st === "reloading") {
          const take = Math.min(s.magSize - this.mag, this.reserve);
          this.mag += take;
          this.reserve -= take;
        }
        this.st = "ready";
        this.t = 0;
        // Auto-reload a shot-empty magazine once its priming is over.
        if (this.mag === 0 && s.autoReload && this.reserve > 0) this.startReload();
      }
      return;
    }
    if (controls.reloadPressed && this.mag < s.magSize && this.reserve > 0) {
      this.startReload();
      return;
    }
    if (controls.firePressed) {
      if (this.mag > 0) {
        this.mag -= 1;
        for (let i = 0; i < s.dartsPerShot; i++) {
          coneDir(this.dir, aimDir, s.spreadDeg, this.rng);
          this.darts.fire(origin, this.dir, this.dartType);
        }
        this.onShot();
        this.st = "priming";
        this.t = 0;
      } else if (s.autoReload && this.reserve > 0) {
        this.startReload();
      }
    }
  }

  private startReload(): void {
    if (this.st === "ready" && this.mag < this.spec.magSize && this.reserve > 0) {
      this.st = "reloading";
      this.t = 0;
    }
  }
}
