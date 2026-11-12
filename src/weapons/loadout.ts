import * as THREE from "three";
import {
  Blaster, resolveSpec,
  type BlasterControls, type DartFiring,
} from "./blaster";
import type { DartTypeName } from "./dart-model";
import { Viewmodel } from "./viewmodel";
import blastersJson from "../../data/blasters.json";

// The blaster ids in the order they appear in data/blasters.json. The
// switch time and each blaster's mod entry live in the same file; the
// page and the range panel read them from here rather than parsing the
// data twice.
const ORDER = (blastersJson as { order: string[] }).order;
const SWITCH_TIME = (blastersJson as { switchTime: number }).switchTime;

/** The mod ids a blaster can take, in data order. */
export function modIds(blasterId: string): string[] {
  const entry = (blastersJson as Record<string, { mods?: Record<string, unknown> }>)[blasterId];
  const m = entry?.mods;
  return m ? Object.keys(m) : [];
}

// What the Loadout calls on a viewmodel: show/hide, mod node lists, the
// camera point of a muzzle, and the per-shot hook. The page and the test
// both provide something that has this shape; the real Viewmodel does, so
// the type below is only exposed for the test to fake.
export interface LoadoutViewmodel {
  setVisible(on: boolean): void;
  setMods(show: string[], hide: string[]): void;
  muzzleCameraPoint(i: number, out: THREE.Vector3): THREE.Vector3;
  onShot: (muzzleIndex: number) => void;
}

// One blaster and its fire-facing viewmodel, pre-built by the caller. The
// blaster's muzzle is the viewmodel's muzzle camera point: the page feeds
// it to updateAim, which pulls it through the camera into the world (a
// muzzle stuck against a wall comes back clear). The dart system is
// shared; every blaster fires into it.
export interface LoadoutPart {
  id: string;
  blaster: Blaster;
  viewmodel: LoadoutViewmodel;
}

// The player's blaster set: one Blaster and one Viewmodel per blaster in
// data order, each with its own magazine and reserve. The active index
// moves with select/next/prev; while a switch is running nothing fires,
// the old viewmodel hides and the new one shows at the halfway point.
// update passes the step to the active Blaster and allocates nothing.
export class Loadout {
  readonly ids = ORDER;
  readonly blasters: Blaster[] = [];
  readonly viewmodels: LoadoutViewmodel[] = [];
  readonly switchTime: number;
  private darts: DartFiring;
  private mods: string[][] = [];
  private idx = 0;
  private switchTimer = -1;
  private switchFrom = 0;
  private switchTo = 0;

  /** The parts go in data order. The constructor takes already-built
   *  parts so the test can skip the GLTF load. */
  constructor(
    parts: LoadoutPart[],
    darts: DartFiring,
    switchTime: number,
  ) {
    this.darts = darts;
    this.switchTime = switchTime;
    for (const p of parts) {
      this.blasters.push(p.blaster);
      this.viewmodels.push(p.viewmodel);
      this.mods.push([]);
      // Every blaster reports its shots to its own viewmodel's hook.
      p.blaster.onShot = (n) => { p.viewmodel.onShot(n); };
    }
    // The first blaster is active; make its viewmodel visible.
    this.viewmodels[0].setVisible(true);
  }

  /** Load all three in data order, attach every viewmodel to the camera,
   *  and wire the blasters. The page awaits this before start. The dart
   *  system is shared across all three. */
  static async load(
    camera: THREE.Camera,
    darts: DartFiring,
    onLoaded?: (id: string, done: number, total: number) => void,
  ): Promise<Loadout> {
    const parts: LoadoutPart[] = [];
    for (const id of ORDER) {
      const spec = resolveSpec(id);
      const viewmodel = await Viewmodel.load(spec);
      viewmodel.attach(camera);
      const blaster = new Blaster(spec, darts, (i) =>
        Loadout.muzzleToWorld(viewmodel.muzzleCameraPoint(i, Loadout._scratch), Loadout._world));
      parts.push({ id, blaster, viewmodel });
      // PT-10: the boot report shows which model is being waited on.
      onLoaded?.(id, parts.length, ORDER.length);
    }
    return new Loadout(parts, darts, SWITCH_TIME);
  }

  private static _scratch = new THREE.Vector3();
  private static _world = new THREE.Vector3();
  /** Turns a muzzle's camera-space point into the world point a dart
   *  leaves from. The pages set it to run updateAim (which also pulls a
   *  muzzle inside a wall back out); the identity default suits tests. */
  static muzzleToWorld: (camPoint: THREE.Vector3, out: THREE.Vector3) => THREE.Vector3 =
    (camPoint, out) => out.copy(camPoint);

  get activeIndex(): number { return this.idx; }
  get active(): Blaster { return this.blasters[this.idx]; }
  get activeViewmodel(): LoadoutViewmodel { return this.viewmodels[this.idx]; }
  /** GAME-08: an extra dip on the active blaster, in local Y, added to
   *  the switch's own (the vacuum's lock sets it while it runs). */
  lowered = 0;
  get switching(): boolean { return this.switchTimer >= 0; }

  /** GAME-08: the foam vacuum's reward. The active blaster takes
   *  ceil(reserveMax * activeShare) darts, every other blaster in the
   *  loadout ceil(reserveMax * otherShare), each capped at its own
   *  reserveMax (the board's cap, as the ammo box's is). No pickups are
   *  spawned (CONTENT-PLAN D08). Returns the darts actually added. */
  refillReserves(activeShare: number, otherShare: number): number {
    let given = 0;
    for (let i = 0; i < this.blasters.length; i++) {
      const b = this.blasters[i];
      // GAME-09c: the B02's reserve never empties, so it is never topped up.
      if (b.spec.reserveInfinite) continue;
      const share = i === this.idx ? activeShare : otherShare;
      const want = Math.ceil(b.spec.reserveMax * share);
      const space = Math.max(0, b.spec.reserveMax - b.reserve);
      const take = Math.min(space, want);
      b.reserve += take;
      given += take;
    }
    return given;
  }

  select(i: number): void {
    if (this.switchTimer >= 0 || i === this.idx) return;
    if (i < 0 || i >= this.blasters.length) return;
    this.switchFrom = this.idx;
    this.switchTo = i;
    this.switchTimer = 0;
  }
  next(): void { this.select((this.idx + 1) % this.blasters.length); }
  prev(): void { this.select((this.idx - 1 + this.blasters.length) % this.blasters.length); }

  /** Turn a mod on or off on blaster i. Re-resolve the spec, rebuild that
   *  Blaster with a full magazine and the same reserve, and apply the
   *  viewmodel's show and hide lists. */
  setMod(i: number, mod: string, on: boolean): void {
    const list = this.mods[i];
    const k = list.indexOf(mod);
    if (on && k < 0) list.push(mod);
    if (!on && k >= 0) list.splice(k, 1);
    const spec = resolveSpec(this.ids[i], list);
    const old = this.blasters[i];
    const fresh = new Blaster(
      spec,
      this.darts,
      (j) => Loadout.muzzleToWorld(this.viewmodels[i].muzzleCameraPoint(j, Loadout._scratch), Loadout._world),
    );
    fresh.reserve = old.reserve; // same reserve as before the rebuild
    fresh.onShot = (n) => { this.viewmodels[i].onShot(n); };
    this.blasters[i] = fresh;
    this.viewmodels[i].setMods(spec.show, spec.hide);
  }

  /** The mods turned on for a blaster, in the order added. */
  modsOf(i: number): string[] { return this.mods[i]; }

  /** Set the dart type on a blaster (the range panel's dart buttons). */
  setDartType(i: number, t: DartTypeName): void {
    this.blasters[i].dartType = t;
  }
  dartType(i: number): DartTypeName { return this.blasters[i].dartType; }
  /** The mods that are on for the active blaster. */
  activeMods(): string[] { return this.mods[this.idx]; }

  /** The id of the active blaster. */
  activeId(): string { return this.ids[this.idx]; }

  /** Advance one step: the active blaster, or the running switch (the
   *  viewmodel swap happens at the halfway point). No shot fires while a
   *  switch is running. */
  update(dt: number, controls: BlasterControls, aimDir: THREE.Vector3): void {
    if (this.switchTimer >= 0) {
      this.switchTimer += dt;
      if (this.switchTimer >= this.switchTime / 2) {
        this.viewmodels[this.switchFrom].setVisible(false);
        this.idx = this.switchTo;
        this.viewmodels[this.idx].setVisible(true);
      }
      if (this.switchTimer >= this.switchTime) this.switchTimer = -1;
      return;
    }
    this.blasters[this.idx].update(dt, controls, aimDir);
  }

  /** Called once per render frame (from the loop's render hook): animate
   *  the active viewmodel and apply the switch dip. The dip moves the
   *  whole viewmodel group down out of view for the falling blaster and
   *  uses the Loadout's switch progress: the old blaster dips down over
   *  the first half of the switch, the new one rises in over the second
   *  half. Only the active viewmodel animates; the others sit at rest.
   *  The Loadout's render dep applies the dip to every viewmodel so the
   *  switch is visible from the moment it starts. */
  render(dt: number, fireHeld: boolean): void {
    const t = this.switchTimer >= 0 ? this.switchTimer / this.switchTime : -1;
    for (let i = 0; i < this.viewmodels.length; i++) {
      const vm = this.viewmodels[i];
      let dip = 0;
      if (t >= 0) {
        if (i === this.switchFrom) {
          // falling: 0 to -0.3 over the first half of the switch
          dip = -0.3 * Math.sin(Math.min(1, t / 0.5) * Math.PI / 2);
        } else if (i === this.switchTo) {
          // rising: starts at -0.3 and goes to 0 over the second half
          const u = Math.min(1, Math.max(0, (t - 0.5) / 0.5));
          dip = -0.3 * (1 - Math.sin(u * Math.PI / 2));
        }
      }
      // GAME-08: the vacuum's lock lowers the active blaster too.
      if (i === this.idx) dip += this.lowered;
      const withDip = vm as Partial<typeof vm> & { setDip?(y: number): void };
      if (withDip.setDip) withDip.setDip(dip);
      if (i === this.idx) {
        const withAnim = vm as typeof vm & { animate?(dt: number, b: Blaster, fh: boolean): void };
        if (withAnim.animate) withAnim.animate(dt, this.blasters[i], fireHeld);
      }
    }
  }
}
