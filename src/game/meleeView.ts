import * as THREE from "three";
import meleeJson from "../../data/melee.json";

// GAME-06 / MEL-01: the placeholder look for melee weapon 1 (M01): a
// code-built foam sword (toy colours, no art files, no metal: every part is
// matte foam) that sweeps across the view for each combo hit: a low sweep
// right to left, one back across, then an overhead chop. The shield bash has
// no weapon; its shove is the camera kick in game.ts. The name and the look
// are [Paul]'s; this is a stand-in until he draws the sword.
//
// Every size, colour and the camera placement are in data/melee.json `look`.
// `buildSword` is exported because the melee pickup (a level's `melee`
// entry) shows the same model at world size, so the two can never drift.

const T = meleeJson as unknown as {
  swingTime: number;
  look: {
    position: [number, number, number];
    rest: { pitch: number; yaw: number; roll: number };
    pommel: { length: number; radius: number; color: string };
    grip: { length: number; radius: number; color: string };
    guard: { width: number; height: number; depth: number; color: string };
    blade: { length: number; width: number; thickness: number; tipRadius: number; color: string };
    dip: number;
  };
};

const DEG = Math.PI / 180;

/** The foam sword at world size: the grip's middle is the origin (where a
 *  hand holds it), the pommel below it, the blade up +Y, the flat of the
 *  blade facing +Z. Every part is data `look`: the pommel an ellipsoid of
 *  its length and radius, the grip a cylinder, the guard a bar across the
 *  top of the grip, the blade a flat box and the tip a half disc of the
 *  blade's own width and thickness, so no corner of it has an edge. */
export function buildSword(): THREE.Group {
  const L = T.look;
  const sword = new THREE.Group();
  // One matte material per colour: foam, so no shine (metalness stays 0).
  const foam = (color: string) => new THREE.MeshStandardMaterial({ color, roughness: 0.95 });
  const orange = foam(L.guard.color);
  const bladeMat = foam(L.blade.color);

  // Stacked up from the hand: the guard's centre is at the origin.
  const guard = new THREE.Mesh(
    new THREE.BoxGeometry(L.guard.width, L.guard.height, L.guard.depth), orange,
  );
  sword.add(guard);

  const grip = new THREE.Mesh(
    new THREE.CylinderGeometry(L.grip.radius, L.grip.radius, L.grip.length, 12),
    foam(L.grip.color),
  );
  grip.position.y = -L.guard.height / 2 - L.grip.length / 2;
  sword.add(grip);

  const pommel = new THREE.Mesh(new THREE.SphereGeometry(L.pommel.radius, 12, 8), orange);
  pommel.scale.y = L.pommel.length / (2 * L.pommel.radius);
  pommel.position.y = -L.guard.height / 2 - L.grip.length - L.pommel.length / 2;
  sword.add(pommel);

  const base = L.guard.height / 2;
  const blade = new THREE.Mesh(
    new THREE.BoxGeometry(L.blade.width, L.blade.length, L.blade.thickness), bladeMat,
  );
  blade.position.y = base + L.blade.length / 2;
  sword.add(blade);

  // A half cylinder: its flat face sits on the blade's end, its round side
  // carries the tip. Rotated so the curve runs across the blade's width and
  // the thickness is the blade's own.
  const tip = new THREE.Mesh(
    new THREE.CylinderGeometry(
      L.blade.tipRadius, L.blade.tipRadius, L.blade.thickness, 12, 1, false, Math.PI / 2, Math.PI,
    ),
    bladeMat,
  );
  tip.rotation.x = Math.PI / 2;
  tip.position.y = base + L.blade.length;
  sword.add(tip);

  sword.traverse((o) => { o.castShadow = true; });
  return sword;
}

/** The swing's path for one hit kind. Angles in degrees, about the camera's
 *  axes (the hand is the pivot): Z sweeps the blade across the view, X
 *  carries the tip away and back, and Y turns the flat of the blade for the
 *  whole stroke (a sword's silhouette barely moves when it spins about its
 *  own length). */
interface Stroke {
  axis: "x" | "z";
  from: number;
  to: number;
  yaw: number;
}

// The three strokes: low right to high left, back across, then overhead.
const STROKES: Stroke[] = [
  { axis: "z", from: -45, to: 65, yaw: 10 },
  { axis: "z", from: 65, to: -40, yaw: -10 },
  { axis: "x", from: 35, to: -75, yaw: -18 },
];

export class MeleeView {
  /** The hand: the rest placement and the sword's held attitude. Public so
   *  a test can watch it come and go. */
  readonly group = new THREE.Group();
  /** The stroke, about the hand, in the camera's axes. */
  private swingGroup = new THREE.Group();
  private stroke: Stroke | null = null;
  private t = 0;
  private swingTime: number;

  constructor(camera: THREE.PerspectiveCamera) {
    const L = T.look;
    this.swingTime = T.swingTime;
    this.group.position.set(L.position[0], L.position[1], L.position[2]);
    this.group.visible = false;
    const rest = new THREE.Group();
    rest.rotation.set(L.rest.pitch * DEG, L.rest.yaw * DEG, L.rest.roll * DEG);
    rest.add(buildSword());
    this.swingGroup.add(rest);
    this.group.add(this.swingGroup);
    camera.add(this.group);
  }

  /** Start the sweep for one combo hit (0 to 2). The page calls it from
   *  the melee block when a charged hit swings. */
  swing(hit: number): void {
    this.stroke = STROKES[hit % STROKES.length];
    this.t = 0;
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
    // Ease out: the sword leaves fast and lands slow.
    const u = 1 - (1 - p) * (1 - p);
    const a = (s.from + (s.to - s.from) * u) * DEG;
    this.swingGroup.rotation.set(
      s.axis === "x" ? a : 0,
      s.yaw * DEG,
      s.axis === "z" ? a : 0,
    );
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
