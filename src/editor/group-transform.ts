import * as THREE from "three";
import type { Vec3 } from "../level/format";
import type { EntryKind } from "./doc";

// ED-37: a selection of two or more things turns and scales as one object
// about the middle of its bounds, not each thing about its own centre. Pure
// maths: the page reads what is selected into these entries, gives the
// handles' turn and scale since the drag began, and writes the patches back.

const DEG = Math.PI / 180;
/** Changes smaller than this are not written, so a drag of one mode leaves
 *  the things' other fields alone. */
const TINY = 1e-4;

/** Where an upright thing's turn is kept: a prim and a physics object or a
 *  model use XYZ Euler degrees, a Foamer and the start use yaw radians, a
 *  door and a prop use degrees about Y. */
export type TurnKey = "rot" | "yaw" | "rotY";

/** One selected thing, as the group transform reads it. */
export interface GroupThing {
  id: string;
  kind: EntryKind | "start" | "exit";
  /** Its position at the start of the drag. */
  pos: Vec3;
  /** Its own rotation at the start of the drag, as x y z w. */
  quat: [number, number, number, number];
  /** True for a thing that stands upright: only its yaw turns, and any tilt
   *  the group's turn would give it is left out. */
  upright: boolean;
  /** The document field its turn is written to, or null for a thing that
   *  does not turn (the exit, a zone, a pickup). */
  turnKey: TurnKey | null;
  /** The document field its size is written to, or null when it has none. */
  sizeKey: "size" | "scale" | null;
  size: Vec3 | null;
}

/** One thing's change, ready for `doc.change`, `doc.setStart` or
 *  `doc.setExit`. */
export interface GroupPatch {
  id: string;
  kind: GroupThing["kind"];
  patch: Record<string, unknown>;
}

function round(n: number, places = 4): number {
  const f = 10 ** places;
  const made = Math.round(n * f) / f;
  // Undo the -0 a rounded-down tiny negative leaves, so patches compare clean.
  return made === 0 ? 0 : made;
}

function changed(a: Vec3, b: Vec3): boolean {
  return a.some((n, i) => Math.abs(n - b[i]!) > TINY);
}

/** ED-37: the kinds that stand upright, so a selection holding one turns
 *  about Y only and they take a yaw and no tilt. */
export function isUpright(kind: string): boolean {
  return kind === "foamers" || kind === "doors" || kind === "props" || kind === "start";
}

/** The yaw of a rotation, in radians, from 0 to 2 pi: the same formula the
 *  rigs and the doors use (format.ts: 0 faces -z). */
export function yawOf(q: THREE.Quaternion): number {
  const yaw = Math.atan2(2 * (q.w * q.y + q.x * q.z), 1 - 2 * (q.y * q.y + q.z * q.z));
  return ((yaw % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
}

/**
 * The patches that turn and scale `things` as one object: the pivot is the
 * centre of their bounds at the start of the drag, `R` the handles' rotation
 * since then, `s` their uniform scale, and `move` the handles' translation
 * (the turn and scale handles do not translate, a move does not turn).
 * Only what changed is written; things whose turn or size cannot change keep
 * theirs. The caller snaps and commits the patches.
 */
export function transformSelection(
  things: GroupThing[], pivot: Vec3, R: THREE.Quaternion, s: number, move: Vec3 = [0, 0, 0],
): GroupPatch[] {
  const centre = new THREE.Vector3(pivot[0], pivot[1], pivot[2]);
  const shift = new THREE.Vector3(move[0], move[1], move[2]);
  const turn = R.clone().normalize();
  const out: GroupPatch[] = [];
  for (const thing of things) {
    const patch: Record<string, unknown> = {};
    const from = new THREE.Vector3(thing.pos[0], thing.pos[1], thing.pos[2]);
    // The maths the card gives: P + move + s * R (p - P).
    const to = from.clone().sub(centre).multiplyScalar(s).applyQuaternion(turn).add(centre).add(shift);
    const pos: Vec3 = [round(to.x), round(to.y), round(to.z)];
    if (changed(pos, thing.pos)) patch.pos = pos;

    const own = new THREE.Quaternion(thing.quat[0], thing.quat[1], thing.quat[2], thing.quat[3]).normalize();
    const q = turn.clone().multiply(own).normalize();
    if (!thing.turnKey) {
      // A zone or the exit has no rotation to write.
    } else if (thing.upright) {
      // A Foamer, a door, a prop and the start stand upright: take the turn
      // about Y out of the composed rotation and leave the tilt alone.
      const yaw = yawOf(q);
      if (Math.abs(yaw - yawOf(own)) > TINY) {
        if (thing.turnKey === "rotY") patch.rotY = round(yaw / DEG);
        else patch.yaw = round(yaw, 6);
      }
    } else {
      const e = new THREE.Euler().setFromQuaternion(q, "XYZ");
      const rot: Vec3 = [round(e.x / DEG), round(e.y / DEG), round(e.z / DEG)];
      const before = new THREE.Euler().setFromQuaternion(own, "XYZ");
      const was: Vec3 = [round(before.x / DEG), round(before.y / DEG), round(before.z / DEG)];
      if (changed(rot, was)) patch[thing.turnKey] = rot;
    }

    if (thing.sizeKey && thing.size && Math.abs(s - 1) > TINY) {
      // A prim, a zone, a door and a physics object hold metres; a model
      // holds a multiplier, so its own scale is what `s` multiplies. A
      // group scale is one number (design/EDITOR-V2.md).
      const size = thing.size.map((n) => Math.max(TINY, round(n * s))) as Vec3;
      if (changed(size, thing.size)) patch[thing.sizeKey] = size;
    }
    if (Object.keys(patch).length) out.push({ id: thing.id, kind: thing.kind, patch });
  }
  return out;
}
