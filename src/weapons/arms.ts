import * as THREE from "three";
import armsJson from "../../data/arms.json";

// ARM-01: the player's arms, so a blaster is held and not floating. A
// code-built placeholder like the MEL-01 sword: a mitten glove, a cuff and
// a sleeve, every size and colour in data/arms.json `look`. The look is
// [Paul]'s; this stands in until he draws it.

type V3 = [number, number, number];

export const ARMS = armsJson as unknown as {
  look: {
    colors: { glove: string; cuff: string; sleeve: string };
    palm: V3;
    thumb: { radius: number; length: number };
    cuff: { radius: number; length: number };
    wristRadius: number;
    elbowRadius: number;
  };
  trigger: { at: V3 };
  elbow: { right: V3; left: V3 };
  sword: { elbow: V3 };
};

const UP = new THREE.Vector3(0, 1, 0);

// Built once and shared by every arm: nine arms would otherwise carry
// nine copies of the same four shapes.
let kit: {
  palm: THREE.BufferGeometry; thumb: THREE.BufferGeometry;
  cuff: THREE.BufferGeometry; sleeve: THREE.BufferGeometry;
  glove: THREE.Material; cuffMat: THREE.Material; sleeveMat: THREE.Material;
} | null = null;

function parts(): NonNullable<typeof kit> {
  if (kit) return kit;
  const L = ARMS.look;
  const matte = (color: string) => new THREE.MeshStandardMaterial({ color, roughness: 0.9 });
  // Each shape runs along the arm's own +Z (toward the elbow).
  const along = (g: THREE.BufferGeometry) => g.rotateX(Math.PI / 2);
  kit = {
    palm: new THREE.SphereGeometry(0.5, 16, 12),
    thumb: along(new THREE.CapsuleGeometry(L.thumb.radius, L.thumb.length, 4, 8)),
    cuff: along(new THREE.CylinderGeometry(L.cuff.radius, L.cuff.radius, L.cuff.length, 16)),
    // One metre long from z 0 (the wrist) to z 1 (the elbow): update
    // scales it to the distance.
    sleeve: along(new THREE.CylinderGeometry(L.elbowRadius, L.wristRadius, 1, 16)).translate(0, 0, 0.5),
    glove: matte(L.colors.glove),
    cuffMat: matte(L.colors.cuff),
    sleeveMat: matte(L.colors.sleeve),
  };
  return kit;
}

/** One gloved hand and its sleeve. The group's origin is the fist's
 *  centre and its +Z runs to the elbow. Add `group` to the space the
 *  elbow point is given in, call hold once, then update each frame the
 *  held thing may have moved. Allocates nothing per frame. */
export class Arm {
  readonly group = new THREE.Group();
  private sleeve: THREE.Mesh;
  private sleeveStart: number;
  private anchor: THREE.Object3D | null = null;
  private elbow = new THREE.Vector3();
  private _p = new THREE.Vector3();
  private _x = new THREE.Vector3();
  private _y = new THREE.Vector3();
  private _z = new THREE.Vector3();
  private _m = new THREE.Matrix4();

  /** side: 1 is the right hand, -1 the left (the thumb is on the inner
   *  side). */
  constructor(side: 1 | -1) {
    const L = ARMS.look;
    const k = parts();
    const palm = new THREE.Mesh(k.palm, k.glove);
    palm.scale.set(L.palm[0], L.palm[1], L.palm[2]);
    const thumb = new THREE.Mesh(k.thumb, k.glove);
    thumb.position.set(-side * L.palm[0] * 0.42, L.palm[1] * 0.22, -L.palm[2] * 0.15);
    const cuff = new THREE.Mesh(k.cuff, k.cuffMat);
    cuff.position.z = L.palm[2] * 0.45 + L.cuff.length / 2;
    this.sleeveStart = L.palm[2] * 0.45 + L.cuff.length * 0.5;
    this.sleeve = new THREE.Mesh(k.sleeve, k.sleeveMat);
    this.sleeve.position.z = this.sleeveStart;
    this.group.add(palm, thumb, cuff, this.sleeve);
  }

  /** Hold `anchor` (any node: its world position is the grip point), with
   *  the sleeve running to `elbow`, a point in the space of the group's
   *  parent. */
  hold(anchor: THREE.Object3D, elbow: readonly number[]): void {
    this.anchor = anchor;
    this.elbow.set(elbow[0]!, elbow[1]!, elbow[2]!);
    this.update();
  }

  /** Put the fist on the anchor and point the sleeve at the elbow. */
  update(): void {
    const space = this.group.parent;
    if (!space || !this.anchor) return;
    this.anchor.getWorldPosition(this._p);
    space.updateWorldMatrix(true, false);
    space.worldToLocal(this._p);
    this.group.position.copy(this._p);
    const len = this._z.copy(this.elbow).sub(this._p).length();
    if (len < 1e-6) return;
    this._z.divideScalar(len);
    this._x.crossVectors(UP, this._z).normalize();
    this._y.crossVectors(this._z, this._x);
    this.group.quaternion.setFromRotationMatrix(this._m.makeBasis(this._x, this._y, this._z));
    this.sleeve.scale.z = Math.max(0.01, len - this.sleeveStart);
  }
}
