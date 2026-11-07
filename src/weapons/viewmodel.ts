import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { Blaster, BlasterSpec } from "./blaster";

const DEG = Math.PI / 180;
const TRIGGER_HOLD = 0.08;   // trigger kept down after a shot
const EJECT_TIME = 0.3;      // shell flight: up and back for this long
const EJECT_UP = 0.1;        // meters
const EJECT_BACK = 0.1;      // meters, local +Z is back

// A damped spring for the recoil kick: init at rest, one impulse the
// size of the kick, back to rest at rate `return` (no overshoot).
function springKick(dt: number, rate: number, kickMax: number,
                    that: { k: number; v: number; j: number }): void {
  // Simulate the spring once per call; the integrator is small-stepied
  // so dt is always tiny enough to stable.
  const dv = (-rate * rate * that.k - 2 * rate * that.v) * dt;
  that.v += dv;
  that.k += that.v * dt;
  if (that.k < 0) { that.k = 0; that.v = 0; }
  if (that.k > kickMax) { that.k = kickMax; that.v = 0; }
  void that.j;
}

/** ART-05a: progress p through the window [t0, t1], clamped to 0..1. */
function seg(p: number, t0: number, t1: number): number {
  return Math.max(0, Math.min(1, (p - t0) / (t1 - t0)));
}

export class Viewmodel {
  /** Added to under the camera. */
  readonly group = new THREE.Group();

  private spec: BlasterSpec;
  private root: THREE.Object3D | null = null;
  private baseHidden = new Set<string>();
  private nodeByName = new Map<string, THREE.Object3D>();
  // Rest frames: what applyMods left, captured once at the end of the
  // constructor/re-captured on setMods. Animation is offset from them,
  // so a part is where the model and mods placed it unless offset.
  private restP = new Map<string, [number, number, number]>();
  private restR = new Map<string, [number, number, number]>();
  private restQ = new Map<string, THREE.Quaternion>();
  private _q = new THREE.Quaternion();
  private _axisX = new THREE.Vector3(1, 0, 0);
  private _axisY = new THREE.Vector3(0, 1, 0);
  /** Break action: a fired barrel keeps its spent shell until the reload
   *  opens the breach and throws it out. */
  private spent = [false, false, false, false];
  onShot: (muzzleIndex: number) => void = () => {};
  private boundHook: (m: number) => void = (m) => this.hookShot(m);

  private _w = new THREE.Vector3();
  // ART-05a: B02's slide: seconds since the last shot, and the travel it
  // is easing back from (re-set by each shot, so a burst kicks again).
  private slideClock = 99;
  private _axisZ = new THREE.Vector3(0, 0, 1);
  // Nothing is allocated per frame: the per-frame state is all
  // members.
  private kick = 0;
  private kickVel = 0;
  private shotsThisFrame = 0;
  private trigA = 0;            // eased trigger rotation
  private trigClock = 99;       // seconds since last shot
  private wheelA = 0;           // cumulative flywheel angle
  // GAME-09f: B07's revolver drum: the angle it has turned, the angle it
  // is coming from, and the angle it is easing to (one chamber per shot).
  private drumA = 0;
  private drumFrom = 0;
  private drumTarget = 0;
  // ART-05b: B07's reload: the rounds this reload has to load and whether
  // animate is inside one, so the drum turns one chamber per round going
  // in and lands on a chamber at the end.
  private inReload = false;
  private reloadRounds = 0;
  private ejT = [-1, -1, -1, -1]; // 0..1 flight per barrel, -1 idle

  private constructor(spec: BlasterSpec, scene: THREE.Object3D) {
    this.spec = spec;
    this.root = scene;
    const v = spec.viewmodel;
    scene.position.fromArray(v.position);
    scene.rotation.set(
      THREE.MathUtils.degToRad(v.rotationDeg[0]),
      THREE.MathUtils.degToRad(v.rotationDeg[1]),
      THREE.MathUtils.degToRad(v.rotationDeg[2]),
    );
    scene.scale.setScalar(v.scale);

    scene.traverse((o) => {
      const nm = o.name ?? "";
      if (nm) {
        if (!this.nodeByName.has(nm)) this.nodeByName.set(nm, o);
        if (o.userData.hidden === true) {
          this.baseHidden.add(nm);
          o.visible = false;
        }
      }
    });

    this.group.add(scene);
    this.group.visible = false;
    // Wire the blaster's onShot to this viewmodel's hook by default;
    // Loadout and the tests may override it to add extra behavior.
    this.onShot = this.boundHook;
    this.applyMods(spec.show, spec.hide);
    this.captureRest();
  }

  /** Build from a ready-to-mount node tree, no GLTF load: the test
   *  path. The given tree gets the model placement on the root, the
   *  way load does. */
  static fromObject(spec: BlasterSpec, scene: THREE.Object3D): Viewmodel {
    return new Viewmodel(spec, scene);
  }

  /** Load the glb and build. Resolves when ready. */
  static async load(spec: BlasterSpec): Promise<Viewmodel> {
    const gltf = await new GLTFLoader().loadAsync(spec.model);
    return new Viewmodel(spec, gltf.scene);
  }

  /** Add under the camera. Call once. */
  attach(camera: THREE.Camera): void {
    camera.add(this.group);
  }

  /** Apply a mod's show and hide lists over the model's hidden
   *  defaults, then re-capture rest so the animation is offset from
   *  the mods state (turning a mod off brings parts back to the
   *  model's rest). */
  setMods(show: string[], hide: string[]): void {
    this.applyMods(show, hide);
    this.captureRest();
  }

  private captureRest(): void {
    this.restP.clear();
    this.restR.clear();
    this.restQ.clear();
    for (const [nm, o] of this.nodeByName) {
      this.restP.set(nm, [o.position.x, o.position.y, o.position.z]);
      this.restR.set(nm, [o.rotation.x, o.rotation.y, o.rotation.z]);
      this.restQ.set(nm, o.quaternion.clone());
    }
  }

  /** A named node, or null. */
  node(name: string): THREE.Object3D | null {
    return this.nodeByName.get(name) ?? null;
  }

  /** The i-th muzzle's camera-space point into out. The world position
   *  is read for the gun's root (the gun is a child of the camera);
   *  camera.worldToLocal turns it into camera space for aim.ts. */
  muzzleCameraPoint(i: number, out: THREE.Vector3): THREE.Vector3 {
    const n = this.nodeByName.get(this.spec.muzzles[i]) ?? this.root;
    if (!n) return out.set(0, 0, 0);
    n.getWorldPosition(this._w);
    const cam = this.group.parent;
    if (cam) cam.worldToLocal(this._w);
    return out.copy(this._w);
  }

  /** Show or hide the entire viewmodel. */
  setVisible(on: boolean): void {
    this.group.visible = on;
  }

  /** One shot for the viewmodel. Multiple darts from the same press
   *  (pump, break) net to a single kick plus a single shell eject
   *  from the first muzzle that fired. */
  hookShot(m: number): void {
    if (this.shotsThisFrame > 0) return;
    this.shotsThisFrame = 1;
    this.kickVel += this.spec.motion.kick * this.spec.motion.return;
    this.trigClock = 0;
    if (this.spec.mode === "break") this.spent[m] = true;
    // ART-05a: the slide snaps back on the shot and comes home on its own.
    if (this.spec.motion.slideTravel) this.slideClock = 0;
    // GAME-09f: a pump shot indexes the drum one chamber (drumStepDeg),
    // which animate eases across the priming that starts on this press.
    if (this.spec.mode === "pump" && this.spec.motion.drumStepDeg) {
      this.drumFrom = this.drumA;
      this.drumTarget += this.spec.motion.drumStepDeg * DEG;
    }
  }

  // Public test/render accessors (Loadout drives these each frame).
  /** Set the dip in local Y for the switch: how far the old blaster
   *  falls and how far the new one rises. Loadout.render calls this
   *  each frame for the active viewmodel during a switch (negative to
   *  go down for the falling one, positive to rise from that offset).
   *  The viewmodel's root also has its viewmodel placement added to
   *  its Y. */
  setDip(y: number): void {
    this.dip = y;
  }
  private dip = 0;

  /** Set the animated part transforms for this frame. Called once per
   *  render frame (not on the fixed step), from Loadout.render.
   *  Allocates nothing. */
  animate(dt: number, blaster: Blaster, fireHeld: boolean): void {
    if (!this.root) return;
    const sp = this.spec;
    const v = sp.viewmodel;
    const m = sp.motion;

    // Shot kick: spring at rate `return`, impulse at shot start.
    springKick(dt, m.return, m.kick, { k: this.kick, v: this.kickVel, j: 0 });
    this.kick = Math.max(0, Math.min(m.kick, this.kick));

    // Root: base placement + kick (+Z back) + tilt (up) + dip (switch).
    const tiltNorm = m.kick > 1e-9 ? this.kick / m.kick : 0;
    const tilt = this.kick > 0 ? (m.tiltDeg * DEG) * tiltNorm : 0;
    // ART-05b: reload tilt: the whole blaster rolls about its forward axis
    // over and back across the reload. Positive reloadRollDeg is to the
    // right as the player sees it, which is a negative rotation about the
    // local Z (the camera looks down -Z, so +Z roll takes the top left).
    const roll = blaster.state === "reloading" && m.reloadRollDeg
      ? (m.reloadRollDeg * DEG) * Math.sin(blaster.progress * Math.PI)
      : 0;
    this.root.position.set(
      v.position[0],
      v.position[1] + this.dip,
      v.position[2] + this.kick,
    );
    this.root.rotation.set(
      THREE.MathUtils.degToRad(v.rotationDeg[0]) + tilt,
      THREE.MathUtils.degToRad(v.rotationDeg[1]),
      THREE.MathUtils.degToRad(v.rotationDeg[2]) - roll,
    );

    // Trigger: held or for TRIGGER_HOLD after a shot, eased with a
    // first-order lag so it does not snap. Positive local X pulls the
    // trigger toward the grip (measured sign from all three NOTES).
    this.trigClock += dt;
    const want = (fireHeld || this.trigClock <= TRIGGER_HOLD)
      ? m.triggerDeg * DEG : 0;
    this.trigA += (want - this.trigA) * Math.min(1, dt / 0.04);
    const trig = this.nodeByName.get("trigger");
    if (trig) {
      // About the trigger's own X axis: its rest rotation is 180 degrees
      // about Z, so adding to the Euler X would turn it the other way.
      const q = this.restQ.get("trigger");
      if (q) trig.quaternion.copy(q).multiply(this._q.setFromAxisAngle(this._axisX, this.trigA));
    }

    if (sp.mode === "pump") {
      // Pump: all the way back and home again across priming. The pump
      // node has no rest rotation, so back (toward the grip) is local +Z.
      let off = 0;
      if (blaster.state === "priming") off = Math.sin(blaster.progress * Math.PI) * (m.pumpTravel ?? 0);
      const pn = this.nodeByName.get("pump");
      if (pn) {
        const r = this.restP.get("pump");
        if (r) pn.position.set(r[0], r[1], r[2] + off);
      }
      // GAME-09f: B07's drum turns one chamber per shot about its bore
      // axis (its local Y: the drum's rest rotation is 90 degrees about
      // X), eased across the priming time with the pump (B01 has no drum
      // node and no drumStepDeg, so it is untouched).
      if (m.drumStepDeg) {
        const step = m.drumStepDeg * DEG;
        if (blaster.state === "reloading") {
          // ART-05b: rounds go into the drum one at a time, the drum
          // turning one chamber for each, the turns spread evenly across
          // the reload. The angle is recorded on the first reloading frame
          // (the magazine is filled only at the end) and the reload always
          // ends on a chamber: rounds * one chamber.
          if (!this.inReload) {
            this.inReload = true;
            this.drumFrom = this.drumA;
            this.reloadRounds = Math.max(0, sp.magSize - blaster.mag);
          }
          // Each round has an equal slot of the reload: the drum turns its
          // chamber over the first half of the slot and sits on it for the
          // second half (review: on a chamber part way through).
          const x = this.reloadRounds * blaster.progress;
          const k = Math.floor(x);
          const f = Math.min(1, (x - k) * 2);
          this.drumA = this.drumFrom + (Math.min(k, this.reloadRounds) + (k < this.reloadRounds ? f : 0)) * step;
        } else {
          if (this.inReload) {
            // The reload just ended: land exactly on the chamber rather
            // than on the last frame's near miss.
            this.inReload = false;
            this.drumA = this.drumFrom + this.reloadRounds * step;
            this.drumTarget = this.drumA;
          } else if (blaster.state === "priming") {
            this.drumA = this.drumFrom + (this.drumTarget - this.drumFrom) * blaster.progress;
          } else {
            // Priming over (or the shot dropped): the drum finishes its
            // index, so it never sits between chambers.
            this.drumA = this.drumTarget;
          }
        }
        const dn = this.nodeByName.get("drum");
        if (dn) {
          const q = this.restQ.get("drum");
          if (q) dn.quaternion.copy(q).multiply(this._q.setFromAxisAngle(this._axisY, this.drumA));
        }
      }
      this.applyBolt(blaster);
      this.applyMagDrop(blaster, m.magDrop ?? 0);
    } else if (sp.mode === "auto") {
      // Wheels: spin at wheelSpeed * wheelSpin rev/sec, positive local
      // Y for the left wheel, negative for the right, accumulated so
      // they never snap mid-frame.
      const dA = blaster.wheelSpeed * (m.wheelSpin ?? 0) * Math.PI * 2 * dt;
      this.wheelA += dA;
      const wl = this.nodeByName.get("flywheel_l");
      if (wl) {
        const r = this.restR.get("flywheel_l");
        if (r) wl.rotation.set(r[0], r[1] + this.wheelA, r[2]);
      }
      const wr = this.nodeByName.get("flywheel_r");
      if (wr) {
        const r = this.restR.get("flywheel_r");
        if (r) wr.rotation.set(r[0], r[1] - this.wheelA, r[2]);
      }
      this.applyBolt(blaster);
      this.applyMagDrop(blaster, m.magDrop ?? 0);
    } else if (sp.mode === "semi" || sp.mode === "burst") {
      // GAME-09c: a sidearm: the magazine drops on the reload like the
      // pump's; there is no pump travel and no wheel. Burst looks the
      // same and just fires faster.
      this.applySlide(dt);
      this.applyMagDrop(blaster, m.magDrop ?? 0);
    } else {
      this.breakAction(dt, blaster);
    }
    this.shotsThisFrame = 0; // ensure we consume at most one per frame
  }

  /** ART-05a: B02's slide: snaps back slideTravel on a shot (hookShot
   *  zeroes the clock) and comes home within slideReturn seconds. A blaster
   *  without the field, or without a slide node, is untouched. */
  private applySlide(dt: number): void {
    const m = this.spec.motion;
    const n = this.nodeByName.get("slide");
    if (!n) return;
    const r = this.restP.get("slide");
    if (!r) return;
    const travel = m.slideTravel ?? 0;
    const back = m.slideReturn ?? 0;
    this.slideClock += dt;
    const off = travel > 0 && back > 0 && this.slideClock < back
      ? travel * (1 - this.slideClock / back)
      : 0;
    n.position.set(r[0], r[1], r[2] + off);
  }

  /** ART-05a: a bolt node driven by the blaster's own progress.
   *  B05 (mode pump): across the priming it lifts boltLiftDeg about its
   *  local Z over 0 to 0.2, goes back boltTravel over 0.2 to 0.5, comes
   *  forward over 0.5 to 0.8 and drops over 0.8 to 1.0.
   *  B06 (mode auto): the cocking handle goes back boltTravel over 0 to
   *  0.15 of the reload, holds, and is let go over 0.85 to 1.0. Bolt lift
   *  is left out of its data, so it only travels.
   *  Outside those states the node sits at rest. A blaster with no bolt
   *  node, or with neither field, is untouched. */
  private applyBolt(b: Blaster): void {
    const m = this.spec.motion;
    const n = this.nodeByName.get("bolt");
    if (!n) return;
    if (!m.boltTravel && !m.boltLiftDeg) return;
    const rp = this.restP.get("bolt");
    const rq = this.restQ.get("bolt");
    if (!rp || !rq) return;
    const cycling = this.spec.mode === "pump"
      ? b.state === "priming"
      : this.spec.mode === "auto" && b.state === "reloading";
    const p = cycling ? b.progress : 1;
    const off = (m.boltTravel ?? 0)
      * (this.spec.mode === "pump"
        ? seg(p, 0.2, 0.5) - seg(p, 0.5, 0.8)
        : seg(p, 0, 0.15) - seg(p, 0.85, 1.0));
    const lift = this.spec.mode === "pump"
      ? (m.boltLiftDeg ?? 0) * DEG * (seg(p, 0, 0.2) - seg(p, 0.8, 1.0))
      : 0;
    n.position.set(rp[0], rp[1], rp[2] + off);
    n.quaternion.copy(rq).multiply(this._q.setFromAxisAngle(this._axisZ, lift));
  }

  private applyMagDrop(b: Blaster, drop: number): void {
    const n = this.nodeByName.get("mag");
    if (!n) return;
    const r = this.restP.get("mag");
    if (!r) return;
    let off = 0;
    if (b.state === "reloading") {
      const p = b.progress;
      off = -Math.sin(p * Math.PI) * drop;
    }
    n.position.set(r[0], r[1] + off, r[2]);
  }

  private breakAction(dt: number, b: Blaster): void {
    const m = this.spec.motion;
    const p = b.reloadPhase; // 0..1, 1 when not reloading
    // Phase window helper: t is [t0,t1] eased 0 to 1.
    const ph = (t0: number, t1: number): number => {
      if (p < t0 || p >= 1) return 0;
      const x = (p - t0) / (t1 - t0);
      if (x <= 0) return 0;
      if (x >= 1) return 1;
      return x * x * (3 - 2 * x);
    };
    const latchOpen = ph(0.05, 0.25) * (m.latchDeg ?? 0) * DEG * (p < 1 ? 1 : 0);
    const openN = ph(0.15, 0.55) * Math.sin((p - 0.15) / 0.4 * Math.PI / 2);
    const closeN = p >= 1 ? 0 : ph(0.75, 1.0);
    let openNorm = openN - closeN * closeN;
    if (openNorm < 0) openNorm = 0;
    if (openNorm > 1) openNorm = 1;
    const open = (m.breachOpenDeg ?? 0) * DEG * openNorm;
    const bNode = this.nodeByName.get("breach");
    if (bNode) {
      const r = this.restR.get("breach");
      if (r) {
        // breachOpenDeg is negative (opens); we add so open > 0 means
        // opening. Use negative sign when adding.
        bNode.rotation.set(r[0] + open, r[1], r[2]);
      }
    }
    const lNode = this.nodeByName.get("latch");
    if (lNode) {
      const r = this.restR.get("latch");
      if (r) lNode.rotation.set(r[0], r[1] + latchOpen, r[2]);
    }
    // Shells: a loaded or spent barrel shows its shell. Once the breach
    // is well open, spent shells fly up and back and hide; new shells
    // show at rest when the reload loads them.
    for (let i = 0; i < this.spec.muzzles.length; i++) {
      const o = this.nodeByName.get(`shell_${i + 1}`);
      if (!o) continue;
      const loaded = b.loaded[i] ?? false;
      const r = this.restP.get(`shell_${i + 1}`);
      if (this.spent[i] && this.ejT[i] < 0 && b.state === "reloading" && p >= 0.35) {
        this.spent[i] = false;
        this.ejT[i] = 0;
      }
      if (this.ejT[i] >= 0) {
        this.ejT[i] += dt / EJECT_TIME;
        const t = Math.min(1, this.ejT[i]);
        if (r) o.position.set(r[0], r[1] + EJECT_UP * t, r[2] + EJECT_BACK * t);
        o.visible = true;
        if (this.ejT[i] >= 1) {
          this.ejT[i] = -1;
          o.visible = false;
          if (r) o.position.set(r[0], r[1], r[2]);
        }
      } else {
        o.visible = loaded || this.spent[i];
        if (loaded && r) o.position.set(r[0], r[1], r[2]);
      }
    }
  }

  private applyMods(show: string[], hide: string[]): void {
    const hideSet = new Set(hide);
    for (const [nm, o] of this.nodeByName) {
      o.visible = !this.baseHidden.has(nm) && !hideSet.has(nm);
    }
    for (const nm of show) {
      const o = this.nodeByName.get(nm);
      if (o) o.visible = true;
    }
  }

  // Wire into the blaster's onShot (called for each dart of a shot).
  get onShotTarget(): (m: number) => void {
    return (i: number) => this.hookShot(i);
  }
}
