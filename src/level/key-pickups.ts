import * as THREE from "three";
import editorData from "../../data/editor.json";
import type { KeyColour, LevelDoor, Pickup } from "./format";
import { doorOpensFor, KeyRing } from "./keys";

// ED-07b: the level's keys in play (design/EDITOR.md section 3). A key
// pickup is a small code-built key in its colour that turns where the file
// puts it; walked within `collectRadius` it is held. A door locked to a
// colour opens when the player comes within `doorReach` of it holding that
// key. Keys are lost on a restart, like everything else the level gave.

const K = editorData.keys;

interface KeyItem {
  id: string;
  colour: KeyColour;
  pos: THREE.Vector3;
  mesh: THREE.Group;
  taken: boolean;
}

/** A plain key shape: a ring bow, a shaft and two teeth. */
function keyMesh(colour: string): THREE.Group {
  const m = new THREE.MeshStandardMaterial({ color: new THREE.Color(colour), roughness: 0.6, emissive: new THREE.Color(colour), emissiveIntensity: 0.25 });
  const s = K.size;
  const g = new THREE.Group();
  const bow = new THREE.Mesh(new THREE.TorusGeometry(s * 0.18, s * 0.06, 8, 16), m);
  bow.position.x = -s * 0.32;
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(s * 0.55, s * 0.08, s * 0.08), m);
  shaft.position.x = s * 0.12;
  const tooth1 = new THREE.Mesh(new THREE.BoxGeometry(s * 0.08, s * 0.16, s * 0.08), m);
  tooth1.position.set(s * 0.3, -s * 0.1, 0);
  const tooth2 = tooth1.clone();
  tooth2.position.x = s * 0.18;
  g.add(bow, shaft, tooth1, tooth2);
  return g;
}

export class KeyPickups {
  readonly ring = new KeyRing();
  readonly group = new THREE.Group();
  private readonly items: KeyItem[] = [];
  private time = 0;

  constructor(pickups: readonly Pickup[], private readonly doors: readonly LevelDoor[]) {
    for (const p of pickups) {
      if (p.type !== "key" || !p.key) continue;
      const mesh = keyMesh(K.colours[p.key]);
      mesh.position.set(p.pos[0], p.pos[1] + K.size * 0.6, p.pos[2]);
      this.group.add(mesh);
      this.items.push({ id: p.id, colour: p.key, pos: new THREE.Vector3(...p.pos), mesh, taken: false });
    }
  }

  /** The colours held, for the HUD. */
  held(): KeyColour[] {
    return this.ring.held();
  }

  /** One step: turn the keys, take the ones in reach. Returns the keys
   *  taken this step (the page fires "taken" and says so), and calls
   *  `open` for every locked key door the player has reached with its key. */
  update(dt: number, feet: THREE.Vector3, isLocked: (door: string) => boolean, open: (door: string) => void): KeyItem[] {
    this.time += dt;
    const taken: KeyItem[] = [];
    for (const it of this.items) {
      if (it.taken) continue;
      it.mesh.rotation.y = this.time * K.turnRate;
      const dx = feet.x - it.pos.x, dz = feet.z - it.pos.z;
      if (dx * dx + dz * dz <= K.collectRadius * K.collectRadius && Math.abs(feet.y - it.pos.y) < 2) {
        it.taken = true;
        it.mesh.visible = false;
        this.ring.add(it.colour);
        taken.push(it);
      }
    }
    for (const d of this.doors) {
      if (d.lock === "none" || d.lock === "trigger" || !isLocked(d.id)) continue;
      const dx = feet.x - d.pos[0], dz = feet.z - d.pos[2];
      if (dx * dx + dz * dz > K.doorReach * K.doorReach) continue;
      if (doorOpensFor(d, this.ring)) open(d.id);
    }
    return taken;
  }

  /** The key colour a locked door near the feet still needs, or null: the
   *  page says "needs the red key". */
  neededNear(feet: THREE.Vector3, isLocked: (door: string) => boolean): KeyColour | null {
    for (const d of this.doors) {
      if (d.lock === "none" || d.lock === "trigger" || !isLocked(d.id)) continue;
      const dx = feet.x - d.pos[0], dz = feet.z - d.pos[2];
      if (dx * dx + dz * dz <= K.doorReach * K.doorReach && !this.ring.has(d.lock)) return d.lock;
    }
    return null;
  }

  /** A restart: every key back on the floor, none held. */
  reset(): void {
    this.ring.clear();
    for (const it of this.items) {
      it.taken = false;
      it.mesh.visible = true;
    }
  }
}
