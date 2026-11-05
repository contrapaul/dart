import * as THREE from "three";
import meleeJson from "../../data/melee.json";

// GAME-06: the placeholder look for melee weapon 1 (M01): a code-built
// foam baton (toy colours, no art files) that sweeps across the view for
// each combo hit: left to right, right to left, then overhead. The shield
// bash has no baton; its shove is the camera kick in game.ts. The name
// and look are [Paul]'s; this is a stand-in until he draws it.

const T = meleeJson as unknown as {
  swingTime: number;
  look: {
    position: [number, number, number];
    handle: { length: number; radius: number; color: string };
    ball: { radius: number; color: string };
    dip: number;
  };
};

const DEG = Math.PI / 180;

/** The swing's path for one hit kind. Angles in degrees, in camera space. */
interface Stroke {
  /** Which axis the baton rotates about, X or Y. */
  axis: "x" | "y";
  from: number;
  to: number;
  roll: number; // spin about the baton's own length, degrees
}

// The three strokes: wrist right, wrist left, overhead.
const STROKES: Stroke[] = [
  { axis: "y", from: 55, to: -55, roll: 25 },
  { axis: "y", from: -55, to: 55, roll: -25 },
  { axis: "x", from: -75, to: 60, roll: 40 },
];

export class MeleeView {
  private group = new THREE.Group();
  private baton = new THREE.Group();
  private stroke: Stroke | null = null;
  private t = 0;
  private swingTime: number;

  constructor(camera: THREE.PerspectiveCamera) {
    const L = T.look;
    this.swingTime = T.swingTime;
    this.group.position.set(L.position[0], L.position[1], L.position[2]);
    this.group.visible = false;
    const handleMat = new THREE.MeshStandardMaterial({
      color: L.handle.color, roughness: 0.7,
    });
    const ballMat = new THREE.MeshStandardMaterial({
      color: L.ball.color, roughness: 0.9,
    });
    const handle = new THREE.Mesh(
      new THREE.CylinderGeometry(L.handle.radius, L.handle.radius * 1.15, L.handle.length, 10),
      handleMat,
    );
    handle.position.y = L.handle.length / 2;
    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(L.ball.radius, 12, 10),
      ballMat,
    );
    ball.position.y = L.handle.length + L.ball.radius * 0.6;
    this.baton.add(handle, ball);
    this.group.add(this.baton);
    camera.add(this.group);
  }

  /** Start the sweep for one combo hit (0 to 2). The page calls it from
   *  the melee block when a charged hit swings. */
  swing(hit: number): void {
    this.stroke = STROKES[hit % STROKES.length];
    this.t = 0;
    this.baton.visible = true;
    this.group.visible = true;
  }

  /** How far the blaster dips out of the way this render frame (local Y):
   *  the page applies it after loadout.render while the swing runs. */
  get dip(): number {
    if (!this.stroke) return 0;
    const p = Math.min(1, this.t / this.swingTime);
    return -T.look.dip * Math.sin(p * Math.PI);
  }

  /** Called once per render frame from the page's renderFrame. */
  render(dt: number): void {
    const s = this.stroke;
    if (!s) return;
    this.t += dt;
    const p = Math.min(1, this.t / this.swingTime);
    // Ease out: the baton leaves fast and lands slow.
    const u = 1 - (1 - p) * (1 - p);
    const a = (s.from + (s.to - s.from) * u) * DEG;
    // A slight bank to start with, plus the roll along the stroke, so the
    // baton turns over through the swing instead of staying flat.
    const bank = -0.5 - 0.25 * u + s.roll * u * DEG;
    if (s.axis === "y") {
      this.baton.rotation.set(0, a, bank);
    } else {
      this.baton.rotation.set(a, 0.2, bank);
    }
    if (p >= 1) {
      this.stroke = null;
      this.group.visible = false;
    }
  }

  /** Hide it now (a restart or a pause, like the page's other resets). */
  reset(): void {
    this.stroke = null;
    this.group.visible = false;
  }
}
