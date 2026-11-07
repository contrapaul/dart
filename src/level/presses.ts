import * as THREE from "three";
import type RAPIER from "@dimforge/rapier3d-compat";
import type { Rapier } from "../physics/world";
import { material, materialId } from "../voxel/materials";
import type { Foamer } from "../foamers/foamer";
import type { PlayerHealth } from "../player/health";
import type { Press } from "./format";
import tuning from "../../data/press.json";

// ENV-04 (E14): the crushing toy press. A chunky toy stamp over a floor pad,
// on four guide posts, that rests up, telegraphs (it shakes and its light
// comes on, the page plays the windup sound), slams fast, holds, then rises,
// all on a timer. Every number is in data/press.json.
//
// The crush is a footprint test at the end of the slam, not physics
// contact: the pad's box, up to the head's lowest point. The player inside
// is sent to the page's handler, which takes the damage through the
// player's own health (the page wires `health.damage`, so the difficulty
// and the grace ride along); the raised shield never blocks it. A Foamer
// inside is popped the same way a catastrophic hit does, through the
// page's pop chain. The test runs once per slam end, so one slam damages
// once, not every step the head is down.
//
// The head's collider is kinematic and moves with the head, so darts and
// rays meet it as a solid the way they meet any other solid in the room.
// The crush itself is not this collider: it is the footprint test at the
// end of the slam.

const T = tuning as unknown as {
  cycle: { up: number; telegraph: number; slam: number; down: number; rise: number };
  damage: number;
  reach: number;
  head: { thickness: number; material: string; faceMaterial: string };
  pad: { thickness: number; material: string };
  posts: { width: number; material: string };
  shake: { amplitude: number; rate: number };
};

export const CYCLE = T.cycle;
/** The light's emissive material, shared by every press it handles: the
 *  light turns to this while it is on and back to its own dark on the rest. */
export const LIT_LIGHT = new THREE.MeshStandardMaterial({
  color: material(materialId(T.head.faceMaterial))?.color ?? 0xffffff,
  emissive: 0xd4ff7a,
  emissiveIntensity: 0.9,
  roughness: 0.5,
});
/** One whole press from rest to the next rest. */
export const CYCLE_TOTAL =
  CYCLE.up + CYCLE.telegraph + CYCLE.slam + CYCLE.down + CYCLE.rise;
/** How far past the pad box a body may be and still count as in it: the
 *  head's collider overhangs the pad by that much, and the footprint
 *  matches the collider, not the small pad slab. */
export const PRESS_REACH = T.reach;

export type PressPhase = "up" | "telegraph" | "slam" | "down" | "rise";

export interface PressHandle {
  readonly id: string;
  readonly spec: Press;
  /** The pad's top, the ground the head rests `height` above. */
  readonly padTop: number;
  /** The head's muttered point this step, for the page's exercise. */
  headLow: number;
  phase: PressPhase;
  /** The head's group, moved by the system every step. */
  readonly head: THREE.Group;
  /** The head's kinematic body; a collider the size of the head rides on
   *  it, so nothing stands in the head while it is down. */
  readonly body: RAPIER.RigidBody;
  /** The light's own regular argument. */
  readonly light: THREE.Mesh;
  readonly dark: THREE.MeshStandardMaterial;
  lit: boolean;
  /** This press's own beat, seconds into the press. */
  t: number;
}

/** The player's side of a crush, filled by the page: its feet and a handler
 *  for the damage the system takes. */
export interface PressPlayer {
  feet: THREE.Vector3;
  crush: (amount: number) => void;
}

/** The arena page's press player: the crush lands through the player's own
 *  health exactly the way a Foamer's hit does (`health.damage`, so the
 *  difficulty multiplier and the grace ride along), and the raised shield
 *  never blocks it: a disc in front cannot stop a head from the top. If the
 *  crush downs the player, the page pops it the usual way. */
export class HealthPressPlayer implements PressPlayer {
  readonly feet = new THREE.Vector3();
  constructor(
    private readonly health: PlayerHealth,
    private readonly ui: { paused: boolean; poppedOut: boolean; pop(): void },
    private readonly hud: { onHit(): void },
    private readonly audio: { play(id: string): void },
  ) {}

  crush(amount: number): void {
    if (this.ui.paused || this.ui.poppedOut) return;
    const lost = this.health.damage(amount, "press");
    if (lost <= 0) return;
    this.hud.onHit();
    this.audio.play("PL-hurt");
    if (this.health.dead) this.ui.pop();
  }
}

/** What a step did, for the page's sounds. */
export interface PressStepResult {
  /** The presses whose telegraph just began (page: the windup sound there). */
  windups: { id: string; pos: THREE.Vector3 }[];
  /** The presses whose slam just ended (page: the slam sound there). */
  slams: { id: string; pos: THREE.Vector3 }[];
}

export class PressSystem {
  constructor(private readonly presses: PressHandle[]) {}

  /** The handles themselves, in file order. */
  get list(): readonly PressHandle[] {
    return this.presses;
  }
  get count(): number {
    return this.presses.length;
  }
  get ids(): string[] {
    return this.presses.map((p) => p.spec.id);
  }
  phaseOf(id: string): PressPhase | null {
    return this.presses.find((p) => p.spec.id === id)?.phase ?? null;
  }

  /** Every head back to rest at its own beat and the lights out. A
   *  restart (Try again, Play again, a fall out of the world) must not
   *  leave a head on the floor. */
  reset(): void {
    for (const p of this.presses) {
      p.t = ((p.spec.phase % CYCLE_TOTAL) + CYCLE_TOTAL) % CYCLE_TOTAL;
      p.phase = "up";
      p.lit = false;
      p.light.material = p.dark;
      setPose(p);
    }
  }

  /** Step every press on the fixed step. `foamers` is the page's board and
   *  out chain: a Foamer inside the footprint is popped, not just brought
   *  up, the same way a fatal hit does. */
  step(
    dt: number,
    player: PressPlayer | null,
    foamers: { list: Foamer[]; pop: (f: Foamer) => void },
  ): PressStepResult {
    const res: PressStepResult = { windups: [], slams: [] };
    for (const p of this.presses) this.stepOne(p, dt, player, foamers, res);
    return res;
  }

  private stepOne(
    p: PressHandle, dt: number,
    player: PressPlayer | null,
    foamers: { list: Foamer[]; pop: (f: Foamer) => void },
    res: PressStepResult,
  ) {
    const prev = p.t;
    p.t = (p.t + dt) % CYCLE_TOTAL;
    p.phase = phaseAt(p.t);

    // The beats: the telegraph starts at CYCLE.up, the slam ends at the
    // end of CYCLE.slam. Both are positions on this press's own beat, so
    // two presses off beat never slam the same step.
    if (crossed(prev, p.t, CYCLE.up)) {
      res.windups.push({ id: p.spec.id, pos: new THREE.Vector3(...p.spec.pos) });
    }
    const slammed = crossed(prev, p.t, CYCLE.up + CYCLE.telegraph + CYCLE.slam);

    const headY = headAt(p, p.t);
    const shakeX = p.phase === "telegraph" ? shakeOf(p.t) : 0;
    const shakeZ = p.phase === "telegraph" ? shakeOf(p.t) * 0.6 : 0;
    p.head.position.set(p.spec.pos[0] + shakeX, headY, p.spec.pos[2] + shakeZ);
    p.body.setTranslation({ x: p.spec.pos[0], y: headY, z: p.spec.pos[2] }, true);
    p.headLow = headY - T.head.thickness / 2;

    // The light reads "danger": on with the telegraph, still on while the
    // head is down, out with the rise.
    const lit = p.phase !== "up" && p.phase !== "rise";
    if (lit !== p.lit) {
      p.lit = lit;
      p.light.material = lit ? LIT_LIGHT : p.dark;
    }

    if (!slammed) return;
    res.slams.push({ id: p.spec.id, pos: new THREE.Vector3(...p.spec.pos) });
    this.crush(p, player, foamers);
  }

  /** The end-of-slam test. The body's feet are inside the pad's box (x and
   *  z out by PRESS_REACH) and under the head's low point: it is in. The
   *  test runs on the slam end only, not every step of the down, so the
   *  swing is once, not a held press. */
  private crush(
    p: PressHandle,
    player: PressPlayer | null,
    foamers: { list: Foamer[]; pop: (f: Foamer) => void },
  ) {
    const inFootprint = (x: number, z: number, feetY: number) =>
      Math.abs(x - p.spec.pos[0]) <= p.spec.size[0] / 2 + PRESS_REACH
      && Math.abs(z - p.spec.pos[2]) <= p.spec.size[1] / 2 + PRESS_REACH
      && feetY < p.headLow;

    if (player && inFootprint(player.feet.x, player.feet.z, player.feet.y)) {
      player.crush(T.damage);
    }
    for (const f of [...foamers.list]) {
      if (f.state === "down" || f.state === "finish") continue;
      if (inFootprint(f.centre.x, f.centre.z, f.centre.y)) foamers.pop(f);
    }
  }
}

/** Builds one press into the level's group: the pad slab, the four guide
 *  posts, and the head with its soft face and light, on a kinematic body
 *  with a collider the size of the head. */
export function buildPress(
  spec: Press, group: THREE.Group, rapier: Rapier, world: RAPIER.World,
): PressHandle {
  const [px, py, pz] = spec.pos;
  const [sx, sz] = spec.size;
  const padTop = py + T.pad.thickness / 2;

  const pad = new THREE.Mesh(
    new THREE.BoxGeometry(sx, T.pad.thickness, sz),
    new THREE.MeshStandardMaterial({ color: colourOf(T.pad.material), roughness: 0.95 }),
  );
  pad.position.set(px, py, pz);
  pad.castShadow = pad.receiveShadow = true;
  group.add(pad);

  // The two guide posts, one on each long side of the head, its ends clear
  // of the head so both read. They rise to the block's bottom at rest, so
  // the head sits on the line of the posts, not inside them.
  const postMat = new THREE.MeshStandardMaterial({
    color: colourOf(T.posts.material), roughness: 0.8,
  });
  const postTop = padTop + spec.height; // the block's bottom at rest
  for (const qz of [-1, 1]) {
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(sx - 0.4, postTop - padTop, T.posts.width),
      postMat,
    );
    post.position.set(px, padTop + (postTop - padTop) / 2, qz * (sz - 0.4) / 2);
    post.castShadow = post.receiveShadow = true;
    group.add(post);
  }

  // The head: a chunky block, a soft rounded face on its underside (a
  // capsule the length of the block, the way the melee's ball reads as
  // toy), and a light on the near end. The face pokes just under the
  // block as a cushion, but the collider is the block, so headLow, the
  // low point of the collider itself, is the footprint.
  const head = new THREE.Group();
  const block = new THREE.Mesh(
    new THREE.BoxGeometry(sx - 0.1, T.head.thickness, sz - 0.1),
    new THREE.MeshStandardMaterial({ color: colourOf(T.head.material), roughness: 0.75 }),
  );
  block.castShadow = block.receiveShadow = true;
  head.add(block);
  const face = new THREE.Mesh(
    new THREE.CapsuleGeometry(T.head.thickness * 0.35, sx - 0.9, 4, 12),
    new THREE.MeshStandardMaterial({ color: colourOf(T.head.faceMaterial), roughness: 0.9 }),
  );
  face.rotation.z = Math.PI / 2;
  face.position.y = -T.head.thickness / 2;
  head.add(face);
  const dark = new THREE.MeshStandardMaterial({
    color: colourOf(T.head.faceMaterial), roughness: 0.5,
  });
  const light = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.05), dark);
  light.position.set(0, 0, (sz - 0.1) / 2 + 0.005);
  head.add(light);
  group.add(head);

  const restY = restHeadY(spec);
  const body = world.createRigidBody(
    rapier.RigidBodyDesc.kinematicPositionBased().setTranslation(px, restY, pz),
  );
  world.createCollider(
    rapier.ColliderDesc.cuboid(sx, T.head.thickness / 2, sz).setTranslation(px, restY, pz),
    body,
  );

  const handle: PressHandle = {
    id: spec.id,
    spec,
    padTop,
    headLow: restY - T.head.thickness / 2,
    phase: "up",
    head,
    body,
    light,
    dark,
    lit: false,
    t: 0,
  };
  handle.t = ((spec.phase % CYCLE_TOTAL) + CYCLE_TOTAL) % CYCLE_TOTAL;
  handle.phase = phaseAt(handle.t);
  setPose(handle);
  // A level may name a press into the cycle: the phase and the light are
  // then right from the first frame, not from the rest.
  const lit = handle.phase !== "up" && handle.phase !== "rise";
  handle.lit = lit;
  handle.light.material = lit ? LIT_LIGHT : handle.dark;
  return handle;
}

/** The head centre at rest: the face is the spec's height above the pad
 *  top. */
export function restHeadY(spec: Press): number {
  return spec.pos[1] + T.pad.thickness / 2 + spec.height + T.head.thickness / 2;
}

function setPose(p: PressHandle): void {
  p.head.position.set(p.spec.pos[0], headAt(p, p.t), p.spec.pos[2]);
  p.body.setTranslation(
    { x: p.spec.pos[0], y: headAt(p, p.t), z: p.spec.pos[2] }, true,
  );
  p.headLow = headAt(p, p.t) - T.head.thickness / 2;
}

/** The press at position `t` on the press: up (at rest), telegraph (still
 *  up, the pager handles this), slam (the face down to the pad top), down
 *  (the hold), rise (back up). */
function headAt(p: PressHandle, t: number): number {
  const rest = restHeadY(p.spec);
  const down = p.padTop + T.head.thickness / 2 + 0.02; // a 2 cm air gap above the pad top
  if (t < CYCLE.up) return rest;
  let u = t - CYCLE.up;
  if (u < CYCLE.telegraph) return rest;
  u -= CYCLE.telegraph;
  if (u < CYCLE.slam) return rest + (down - rest) * (u / CYCLE.slam);
  u -= CYCLE.slam;
  if (u < CYCLE.down) return down;
  u -= CYCLE.down;
  if (u < CYCLE.rise) return down + (rest - down) * (u / CYCLE.rise);
  return rest;
}

function phaseAt(t: number): PressPhase {
  if (t < CYCLE.up) return "up";
  if (t < CYCLE.up + CYCLE.telegraph) return "telegraph";
  if (t < CYCLE.up + CYCLE.telegraph + CYCLE.slam) return "slam";
  if (t < CYCLE.up + CYCLE.telegraph + CYCLE.slam + CYCLE.down) return "down";
  return "rise";
}

/** The telegraph's wobble: a small fast wiggle, zero at either end of
 *  the telegraph so the head never jumps. */
function shakeOf(t: number): number {
  const u = t - CYCLE.up;
  if (u <= 0 || u >= CYCLE.telegraph) return 0;
  const span = Math.sin((Math.PI * u) / CYCLE.telegraph);
  return T.shake.amplitude * span * Math.sin(2 * Math.PI * T.shake.rate * u);
}

/** Did the beat travel from `prev` to `now` (both on a wrap) pass `m`? */
function crossed(prev: number, now: number, m: number): boolean {
  const d = (x: number) => (x - m + CYCLE_TOTAL) % CYCLE_TOTAL;
  return d(now) < d(prev);
}

function colourOf(name: string): number {
  return material(materialId(name))?.color ?? 0xbdb5cf;
}
