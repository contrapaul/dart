import * as THREE from "three";
import type { BlasterSpec } from "./blaster";
import { Blaster } from "./blaster";

// A toy-looking pump blaster built from boxes and cylinders, original shapes
// only. About 0.45 m long, the muzzle is at -Z. It is a child of the camera
// and drawn in the bottom-right of the view. Recoil moves it back and tilts
// it up by about 4 degrees, then springs back exponentially. The pump grip
// slides back and forward once per priming; during a reload the model dips
// down and returns. All scratch is allocated once at construction.

const RECOIL_TILT_RAD = THREE.MathUtils.degToRad(4);
const BASE = new THREE.Vector3(0.2, -0.22, -0.35);
const BASE_TILT = -THREE.MathUtils.degToRad(4); // rest, slightly below centre
const PUMP_TRAVEL = -0.06;   // metres the pump slides back on priming
const RELOAD_DIP = 0.06;     // metres the model dips down on reload

function mat(color: string): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.1 });
}

export class BlasterModel {
  /** The group; add it to nothing, it is added to the camera here. */
  readonly group = new THREE.Group();
  private root = new THREE.Group();
  private pump = new THREE.Group();
  private ret = 0;   // exponential return rate, 1/s
  private tz = 0;  // metres back
  private tilt = 0;  // radians up
  private specRecoilKick: number;

  constructor(spec: BlasterSpec, camera: THREE.Camera) {
    this.ret = spec.recoilReturn;
    this.specRecoilKick = spec.recoilKick;
    const body = mat(spec.bodyColor);
    const accent = mat(spec.accentColor);
    const trim = mat(spec.trimColor);

    // Main body: a box from the grip to under the barrel.
    const bodyBox = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.09, 0.34), body);
    bodyBox.position.set(0, -0.02, 0.02);
    this.root.add(bodyBox);
    // Barrel on top of the body.
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.42, 14), accent);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.02, -0.02);
    this.root.add(barrel);
    // Muzzle rim, trim.
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.031, 0.031, 0.03, 14), trim);
    rim.rotation.x = Math.PI / 2;
    rim.position.set(0, 0.02, -0.23);
    this.root.add(rim);
    // Pump grip under the barrel, in a sliding group.
    const pumpBox = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.05, 0.14), accent);
    pumpBox.position.set(0, -0.035, -0.03);
    this.pump.add(pumpBox);
    this.root.add(this.pump);
    // Trigger grip: a short angled cylinder under the body rear, accent.
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.026, 0.11, 12), accent);
    grip.position.set(0, -0.09, 0.14);
    grip.rotation.x = THREE.MathUtils.degToRad(18);
    this.root.add(grip);
    // Magazine tube under the body front, accent.
    const mag = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.09, 12), accent);
    mag.rotation.x = Math.PI / 2;
    mag.position.set(0, -0.075, 0.01);
    this.root.add(mag);
    // Sight: two trim posts and a bar, rear to middle.
    const postGeo = new THREE.BoxGeometry(0.006, 0.03, 0.006);
    const postA = new THREE.Mesh(postGeo, trim);
    postA.position.set(0, 0.05, 0.12);
    const postB = new THREE.Mesh(postGeo, trim);
    postB.position.set(0, 0.05, -0.02);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.006, 0.15), trim);
    bar.position.set(0, 0.065, 0.05);
    this.root.add(postA, postB, bar);
    // Forend cap, trim, at the front of the pump sleeve.
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.02, 14), trim);
    cap.rotation.x = Math.PI / 2;
    cap.position.set(0, -0.02, 0.11);
    this.root.add(cap);

    this.root.position.copy(BASE);
    this.root.rotation.x = BASE_TILT;
    this.group.add(this.root);
    camera.add(this.group);
  }

  /** Start a recoil: move back by the spec's kick and tilt up about 4 degrees. */
  kick(): void {
    this.tz = Math.min(this.tz + this.specRecoilKick, 0.12);
    this.tilt = Math.min(this.tilt + RECOIL_TILT_RAD, RECOIL_TILT_RAD * 1.5);
  }

  /** Render frame: spring the recoil, slide the pump, dip on reload. */
  update(dt: number, blaster: Blaster): void {
    const f = Math.exp(-this.ret * dt);
    this.tz *= f;
    this.tilt *= f;
    if (this.tz < 1e-4) this.tz = 0;
    if (this.tilt < 1e-4) this.tilt = 0;

    // Pump: back and forward once per priming.
    const pumpTravel =
      blaster.state === "priming" ? PUMP_TRAVEL * Math.sin(Math.PI * blaster.progress) : 0;
    this.pump.position.z = pumpTravel;
    // Reload dip: down and back.
    const dip = blaster.state === "reloading" ? RELOAD_DIP * Math.sin(Math.PI * blaster.progress) : 0;

    this.root.position.set(BASE.x, BASE.y - dip, BASE.z + this.tz);
    this.root.rotation.x = BASE_TILT + this.tilt;
  }
}
