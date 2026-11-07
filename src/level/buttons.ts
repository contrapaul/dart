import * as THREE from "three";
import type RAPIER from "@dimforge/rapier3d-compat";
import type { Rapier } from "../physics/world";
import { material, materialId } from "../voxel/materials";
import type { Button } from "./format";
import tuning from "../../data/buttons.json";

// ENV-02 (E08): the toy button. Paul's look is a flat plate with a cylinder
// cap to press; the cap squashes into the plate and lights up when pressed,
// and one press does its action. The button is a wiring layer (the
// ENVIRONMENT card's words): the action is the verb the lock-in already
// uses, a door id set to open, so the page hands in a `setDoor` and nothing
// here knows what a door is.
//
// A button is pressed by a dart on its cap, a melee hit on it, or the player
// standing on a floor one. The cap is a fixed collider, so the dart's ray
// and the melee's line both find it themselves and report the collider they
// met; this module asks whether that collider is a cap. Foamers never press
// one: nothing here reads a Foamer.

const T = tuning as unknown as {
  plate: { size: [number, number, number]; material: string };
  cap: {
    diameter: number; height: number; material: string; litMaterial: string; pressDepth: number;
  };
  stepTolerance: number;
};

/** What a press did, for the page's sounds. */
export interface PressEvent {
  id: string;
  /** Where it was pressed, so the sound carries. */
  pos: THREE.Vector3;
  /** True on the first press only: a second one is a dead click. */
  opened: boolean;
}

/** The page's action for an opened door, filled in from the file. */
export type ButtonAction = (open: string) => void;

/** One button in the world, built by `buildLevel`; the page gives it its
 *  action when it makes the system. */
export interface ButtonHandle {
  readonly id: string;
  readonly spec: Button;
  /** The cap mesh: squashes and changes colour on the press. */
  readonly cap: THREE.Mesh;
  /** The cap's collider: what a dart or a melee line meets. */
  readonly collider: RAPIER.Collider;
  /** Cap centre at rest, world space. */
  readonly up: THREE.Vector3;
  pressed: boolean;
}

/** Adds one button's plate and cap to `group`, with a fixed collider on the
 *  cap. The plate has no collider: it is decoration, and a collider on it
 *  would take the dart meant for the cap. */
export function buildButton(
  spec: Button, group: THREE.Group, rapier: Rapier, world: RAPIER.World,
): ButtonHandle {
  const facing = new THREE.Vector3(spec.facing[0], spec.facing[1], spec.facing[2]).normalize();
  // The plate's thin axis is its own Y; turn it onto `facing`.
  const rot = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), facing);
  const [w, h, d] = T.plate.size;
  const plate = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color: colourOf(T.plate.material), roughness: 0.9 }),
  );
  plate.position.set(spec.pos[0], spec.pos[1], spec.pos[2]);
  plate.quaternion.copy(rot);
  plate.castShadow = plate.receiveShadow = true;
  group.add(plate);

  const r = T.cap.diameter / 2;
  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(r, r, T.cap.height, 20),
    new THREE.MeshStandardMaterial({ color: colourOf(T.cap.material), roughness: 0.7 }),
  );
  cap.quaternion.copy(rot);
  const up = facing.clone().multiplyScalar(h / 2 + T.cap.height / 2);
  cap.position.set(spec.pos[0], spec.pos[1], spec.pos[2]).add(up);
  cap.castShadow = cap.receiveShadow = true;
  group.add(cap);

  const collider = world.createCollider(
    rapier.ColliderDesc.cylinder(T.cap.height / 2, r)
      .setTranslation(cap.position.x, cap.position.y, cap.position.z)
      .setRotation({ x: rot.x, y: rot.y, z: rot.z, w: rot.w }),
  );
  return { id: spec.id, spec, cap, collider, up: cap.position.clone(), pressed: false };
}

/** The level's buttons, wired to one action. A level with no buttons gets an
 *  empty system, so the page is free to call it either way. */
export class ButtonSystem {
  private readonly lit: THREE.MeshStandardMaterial;
  /** Each cap's own unlit material, put back by `reset`. */
  private readonly dark = new Map<ButtonHandle, THREE.Material>();

  constructor(
    private readonly buttons: ButtonHandle[],
    private readonly action: ButtonAction,
  ) {
    this.lit = new THREE.MeshStandardMaterial({
      color: colourOf(T.cap.litMaterial), roughness: 0.5,
    });
    for (const b of buttons) this.dark.set(b, b.cap.material as THREE.Material);
  }

  /** Back to unpressed at rest: a retry re-locks the doors, so a button
   *  that stayed lit and dead would open nothing. */
  reset(): void {
    for (const b of this.buttons) {
      b.pressed = false;
      b.cap.scale.set(1, 1, 1);
      b.cap.position.copy(b.up);
      b.cap.material = this.darkOf(b);
    }
  }

  private darkOf(b: ButtonHandle): THREE.Material {
    return this.dark.get(b) ?? (b.cap.material as THREE.Material);
  }

  /** For the tests and the dev hook. */
  get count(): number {
    return this.buttons.length;
  }
  get ids(): string[] {
    return this.buttons.map((b) => b.id);
  }
  isPressed(id: string): boolean {
    return this.buttons.find((b) => b.id === id)?.pressed ?? false;
  }

  /** A dart, or a melee line: the collider that stopped it. Returns the
   *  press when that collider is a cap, null otherwise. */
  pressByCollider(collider: RAPIER.Collider, at?: THREE.Vector3): PressEvent | null {
    const b = this.buttons.find((x) => x.collider === collider);
    return b ? this.press(b, at) : null;
  }

  /** A melee swing inside reach of a cap and inside its arc. The swing's
   *  own line already proved it had a clear path, and a swing is one press,
   *  so this is a plain distance and angle test against the cap. */
  pressNear(eye: THREE.Vector3, forward: THREE.Vector3, reach: number, arcDeg: number): PressEvent | null {
    const cone = Math.cos((arcDeg / 2) * (Math.PI / 180));
    let best: ButtonHandle | null = null;
    let bestD = Infinity;
    for (const b of this.buttons) {
      const d = b.up.distanceTo(eye);
      if (d > reach || d >= bestD) continue;
      if (_n.copy(b.up).sub(eye).normalize().dot(forward) < cone) continue;
      best = b;
      bestD = d;
    }
    return best ? this.press(best, undefined) : null;
  }

  /** The player's feet against every floor button: standing within the cap's
   *  footprint, at or just above its top. A wall button is never stepped on. */
  step(feet: THREE.Vector3): PressEvent | null {
    for (const b of this.buttons) {
      if (b.spec.facing[1] < 0.5) continue;
      const top = b.up.y + T.cap.height / 2;
      if (feet.y < top - T.cap.height / 2 || feet.y > top + T.stepTolerance) continue;
      const dx = feet.x - b.up.x;
      const dz = feet.z - b.up.z;
      if (dx * dx + dz * dz > (T.cap.diameter / 2) ** 2) continue;
      return this.press(b, feet);
    }
    return null;
  }

  /** Squash, light, and the action on the first press only. A second press
   *  still reports (the page clicks), with `opened` false. */
  private press(b: ButtonHandle, at?: THREE.Vector3): PressEvent {
    const first = !b.pressed;
    b.pressed = true;
    b.cap.scale.set(1, 1 - T.cap.pressDepth / T.cap.height, 1);
    b.cap.position
      .copy(b.up)
      .addScaledVector(normalOf(b.spec), -T.cap.pressDepth / 2);
    b.cap.material = this.lit;
    if (first) this.action(b.spec.action.open);
    return { id: b.id, pos: at ? at.clone() : b.up.clone(), opened: first };
  }
}

const _n = new THREE.Vector3();
function normalOf(spec: Button): THREE.Vector3 {
  return _n.set(spec.facing[0], spec.facing[1], spec.facing[2]).normalize();
}

function colourOf(name: string): number {
  return material(materialId(name))?.color ?? 0xbdb5cf;
}
