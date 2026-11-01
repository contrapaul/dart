import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { BlasterSpec } from "./blaster";

// The player's blaster in the view. The glTF is loaded once with
// GLTFLoader (bundled by Vite, on our own host) and attached to the
// camera. The root node gets the model's placement from
// spec.viewmodel, which later animation runs also transform, so the
// placement lives on the root. Model hidden nodes (userData.hidden
// from the glTF extras) start hidden; mods show or hide nodes by
// name on top. Muzzle world positions are read through the root in
// camera space. Per-frame code allocates nothing.

export class Viewmodel {
  /** Added to the camera. */
  readonly group = new THREE.Group();

  private spec: BlasterSpec;
  private root: THREE.Object3D;
  private baseHidden = new Set<string>();
  private nodeByName = new Map<string, THREE.Object3D>();

  private _w = new THREE.Vector3();

  private constructor(spec: BlasterSpec, scene: THREE.Group) {
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

    // Defaults and names, one pass.
    scene.traverse((o) => {
      const name = o.name ?? "";
      if (name) {
        this.nodeByName.set(name, o); // first node with a name wins
        if (o.userData.hidden === true) {
          this.baseHidden.add(name);
          o.visible = false;
        }
      }
    });

    this.group.add(scene);
    this.group.visible = false;
    this.applyMods(spec.show, spec.hide);
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

  /** Apply mod show/hide lists on top of the model's hidden defaults. */
  setMods(show: string[], hide: string[]): void {
    this.applyMods(show, hide);
  }

  /** The node named, or null. */
  node(name: string): THREE.Object3D | null {
    return this.nodeByName.get(name) ?? null;
  }

  /** Camera-space position of muzzle i into out. */
  muzzleCameraPoint(i: number, out: THREE.Vector3): THREE.Vector3 {
    const n = this.nodeByName.get(this.spec.muzzles[i]) ?? this.root;
    n.getWorldPosition(this._w);
    const cam = this.group.parent;
    if (cam) {
      cam.worldToLocal(this._w);
    }
    return out.copy(this._w);
  }

  /** Show or hide the whole viewmodel. */
  setVisible(on: boolean): void {
    this.group.visible = on;
  }

  private applyMods(show: string[], hide: string[]): void {
    const hideSet = new Set(hide);
    for (const name of this.nodeByName.keys()) {
      if (hideSet.has(name)) this.nodeByName.get(name)!.visible = false;
    }
    for (const name of show) {
      const o = this.nodeByName.get(name);
      if (o) o.visible = true;
    }
  }
}
