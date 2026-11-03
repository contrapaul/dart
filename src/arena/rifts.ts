import * as THREE from "three";
import type { Rift } from "../level/format";

// A rift is a foam seam in the floor: a flat glowing patch that is dim
// while the arena is waiting and bright when it opens to let a wave out
// (README 4: the way on should be the brightest thing in the room).

export type RiftState = "dim" | "open";

const DIM_COLOUR = 0x3b2f6a;
const OPEN_COLOUR = 0xffe9a8;

export class RiftVisuals {
  readonly group = new THREE.Group();
  private meshes = new Map<string, THREE.Mesh>();
  private materials = new Map<string, THREE.MeshBasicMaterial>();
  private states = new Map<string, RiftState>();
  private pulse = 0;

  constructor(rifts: Rift[]) {
    for (const rift of rifts) {
      const mat = new THREE.MeshBasicMaterial({
        color: DIM_COLOUR,
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      // A low, wide slab lying on the floor, so it reads as a seam.
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.2), mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(rift.pos[0], rift.pos[1] + 0.02, rift.pos[2]);
      mesh.renderOrder = 2;
      this.group.add(mesh);
      this.meshes.set(rift.id, mesh);
      this.materials.set(rift.id, mat);
      this.states.set(rift.id, "dim");
    }
  }

  setState(id: string, state: RiftState): void {
    if (this.states.get(id) === state) return;
    this.states.set(id, state);
    this.apply(id);
  }

  setAll(state: RiftState): void {
    for (const id of this.states.keys()) this.setState(id, state);
  }

  private apply(id: string): void {
    const state = this.states.get(id);
    const mat = this.materials.get(id);
    if (!mat) return;
    if (state === "open") {
      mat.color.setHex(OPEN_COLOUR);
      mat.opacity = 0.95;
    } else {
      mat.color.setHex(DIM_COLOUR);
      mat.opacity = 0.5;
    }
  }

  /** Render frame: a slow swell on the open rifts, so they read as alive
   *  without costing anything per step. */
  update(dt: number): void {
    this.pulse += dt;
    const open = 0.75 + Math.sin(this.pulse * 3) * 0.25;
    for (const [id, mat] of this.materials) {
      if (this.states.get(id) !== "open") continue;
      mat.opacity = open;
    }
  }
}
