import * as THREE from "three";
import type RAPIER from "@dimforge/rapier3d-compat";
import type { Rapier } from "../physics/world";
import type { Station } from "../level/format";
import { resolveSpec } from "../weapons/blaster";
import stationData from "../../data/station.json";

// ENV-03: the E13 mod station (design/levels/ENVIRONMENT.md). An arcade
// cabinet shape, styled like an early 1990s office computer (Paul's look in
// the card: a beige case, a dark screen with a glowing line, a slot and
// bars below, square edges, built from boxes). Each entry in a level file's
// `stations` grants one mod of its blaster once per run, when the player's
// head is inside reach of the cabinet's use point, the view is on it, and
// the use key stays held for `hold` seconds. The mod stays for the run, as
// the shield does: the page's restart resets the spent flags, the cabinets
// themselves stay where the level put them.
export type StationData = typeof stationData;

const SESSION = stationData.session;
const CAB = stationData.cabinet;

/** What the station needs of the loadout to grant a mod. The real
 *  Loadout has both; the test passes a stub for the not-carried case. */
export interface StationLoadout {
  readonly ids: string[];
  setMod(i: number, mod: string, on: boolean): void;
}

/** One placed station: its file entry, its spent flag and its look. */
export interface StationItem {
  readonly id: string;
  readonly blaster: string;
  readonly mod: string;
  /** The cabinet's use point in world space (its face, at SESSION height
   *  above the floor the level put it on). */
  readonly point: THREE.Vector3;
  readonly group: THREE.Group;
  spent: boolean;
}

/** The tools the page shares the use key with (the finisher's press and the
 *  vacuum's target, in the game's own step). Narrow enough to stub in the
 *  unit test. */
export interface UseTools {
  readonly finisher: { readonly active: boolean; has(eye: THREE.Vector3, fwd: THREE.Vector3): boolean };
  readonly vacuum: { readonly active: boolean; hasTarget(eye: THREE.Vector3, fwd: THREE.Vector3): unknown };
  useHeld: boolean;
}

/** The card's use-key rule: a finisher or a vacuum that has a target (or
 *  is mid-use itself) takes the key first, so behind one the stations
 *  receive the key as not held. A level page calls this in its step hook,
 *  then reads the hold on the page's input. */
export function useHeldForStations(tools: UseTools, eye: THREE.Vector3, fwd: THREE.Vector3): boolean {
  if (!tools.useHeld) return false;
  if (tools.finisher.active || tools.vacuum.active) return false;
  if (tools.finisher.has(eye, fwd)) return false;
  if (tools.vacuum.hasTarget(eye, fwd) != null) return false;
  return true;
}

/** The stand-in line on the screen. Every station gets its own texture, so
 *  spent and live screens are never shared. */
function makeScreenTexture(blaster: string, mod: string): THREE.CanvasTexture {
  // Headless (the unit tests run without a DOM): a blank stand-in with no
  // image; the real page always has a document and draws the real text.
  if (typeof document === "undefined") return new THREE.Texture() as unknown as THREE.CanvasTexture;
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = stationData.colors.screenFace;
  ctx.fillRect(0, 0, 256, 128);
  ctx.fillStyle = stationData.colors.accent;
  ctx.font = "bold 40px monospace";
  ctx.textAlign = "center";
  ctx.fillText(mod.toUpperCase(), 128, 56);
  ctx.font = "20px monospace";
  ctx.globalAlpha = 0.65;
  ctx.fillText(resolveSpec(blaster).name.toUpperCase(), 128, 96);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** The cabinet built from boxes. Local +z is the front (the group turns by
 *  facing + PI, the player's own convention where yaw 0 faces -z). The
 *  cabinet sits on the group's origin (the floor the level put it on). */
function makeCabinet(blaster: string, mod: string): { group: THREE.Group; screen: THREE.MeshStandardMaterial } {
  const group = new THREE.Group();
  const caseMat = new THREE.MeshStandardMaterial({ color: stationData.colors.case, roughness: 0.85 });
  const darkMat = new THREE.MeshStandardMaterial({ color: stationData.colors.bezel, roughness: 0.7 });
  const screen = new THREE.MeshStandardMaterial({
    color: stationData.colors.screenFace,
    emissive: new THREE.Color(0xffffff),
    emissiveMap: makeScreenTexture(blaster, mod),
    emissiveIntensity: 1,
    roughness: 0.6,
  });

  const add = (w: number, h: number, d: number, y: number, z: number, mat: THREE.Material) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(0, y, z);
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  };
  const front = CAB.depth / 2;
  add(CAB.width, CAB.height, CAB.depth, CAB.height / 2 + CAB.baseHeight, 0, caseMat);            // body
  add(CAB.width, CAB.baseHeight, CAB.depth, CAB.baseHeight / 2, 0, darkMat);                     // base strip
  add(CAB.width, CAB.topThickness, CAB.depth * 1.15, CAB.height + CAB.baseHeight + CAB.topThickness / 2, -front * 0.1, caseMat); // overhanging top
  add(CAB.bezel[0], CAB.bezel[1], CAB.bezel[2], CAB.bezelPos[1], front + CAB.bezelPos[2], darkMat);  // bezel
  add(CAB.screen[0], CAB.screen[1], CAB.screen[2], CAB.screenPos[1], front + CAB.screenPos[2], screen); // screen
  add(CAB.slot[0], CAB.slot[1], CAB.slot[2], CAB.slotPos[1], front + CAB.slotPos[2], darkMat);         // slot
  for (let i = 0; i < CAB.grilleCount; i++) {
    add(CAB.grille[0], CAB.grille[1], CAB.grille[2],
      CAB.grilleTopY - i * CAB.grilleSpacing, front + CAB.grille[2] / 2, darkMat); // grille bars, proud of the face
  }
  return { group, screen };
}

export class Stations {
  readonly items: StationItem[] = [];
  /** A mod was granted this step: the page plays the sound and says the word. */
  onGranted: (item: StationItem) => void = () => {};
  /** The hold finished but the player does not carry the blaster: the
   *  station says so (the page's banner) and grants nothing. Once per
   *  sitting (it does not say again until the player steps out and back
   *  in). */
  onNeedBlaster: (item: StationItem) => void = () => {};
  /** The use held on a spent station: nothing changes, the page plays the
   *  spent sound. Once per sitting (it does not buzz again until the
   *  player steps out of the gate and back in). */
  onSpent: (item: StationItem) => void = () => {};

  private screens = new Map<string, THREE.MeshStandardMaterial>();
  /** Seconds of accumulated hold per station, and whether its one-shot
   *  play already happened in this sitting. */
  private holds = new Map<string, number>();
  private nudged = new Map<string, boolean>();

  constructor(
    rapier: Rapier, world: RAPIER.World, scene: THREE.Scene,
    stations: Station[],
  ) {
    for (const s of stations) {
      const { group, screen } = makeCabinet(s.blaster, s.mod);
      group.position.set(s.pos[0], s.pos[1], s.pos[2]);
      group.rotation.y = s.facing + Math.PI;
      scene.add(group);
      // The use point on the cabinet's face, at the session height: the
      // local +z offset turned to world the way the group turns (the
      // player's conventions: yaw 0 faces -z).
      const fx = -Math.sin(s.facing), fz = -Math.cos(s.facing);
      // A fixed box keeps the player out of the cabinet.
      const q = group.quaternion;
      const h = CAB.height + CAB.baseHeight;
      world.createCollider(
        rapier.ColliderDesc.cuboid(CAB.width / 2, h / 2, CAB.depth / 2)
          .setTranslation(s.pos[0], s.pos[1] + h / 2, s.pos[2])
          .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }),
      );
      const item: StationItem = {
        id: s.id, blaster: s.blaster, mod: s.mod,
        point: new THREE.Vector3(
          s.pos[0] + fx * CAB.depth / 2,
          s.pos[1] + SESSION.usePointHeight,
          s.pos[2] + fz * CAB.depth / 2,
        ),
        group, spent: false,
      };
      this.items.push(item);
      this.screens.set(s.id, screen);
      this.holds.set(s.id, 0);
      this.nudged.set(s.id, false);
    }
  }

  /** The first live station the view passes (the use prompt's target;
   *  none for a level with no stations). */
  prompt(eye: THREE.Vector3, forward: THREE.Vector3): StationItem | null {
    for (const it of this.items)
      if (!it.spent && this.passes(eye, it.point, forward)) return it;
    return null;
  }

  /** One fixed step. `useHeld` is the use key as the page sees it: the
   *  page already based the call (a finisher or a vacuum that has a target
   *  takes the key first, so the page passes false behind them). The hold
   *  builds while the gate and the key agree and rests while they do not.
   *  At `hold` seconds the mod is granted once (or the not-carried and
   *  spent plays, the card's cases). */
  update(dt: number, eye: THREE.Vector3, forward: THREE.Vector3, useHeld: boolean, loadout: StationLoadout) {
    // A level without stations has nothing to step: the page pays the
    // call, the loop does not.
    if (this.items.length === 0) return;
    for (const it of this.items) {
      const held = useHeld && this.passes(eye, it.point, forward);
      if (!held) {
        if (this.holds.get(it.id) !== 0) this.holds.set(it.id, 0);
        this.nudged.set(it.id, false);
        continue;
      }
      const hold = (this.holds.get(it.id) ?? 0) + dt;
      if (hold < SESSION.hold) {
        this.holds.set(it.id, hold);
        continue;
      }
      this.holds.set(it.id, 0);
      if (it.spent) {
        if (!this.nudged.get(it.id)) {
          this.nudged.set(it.id, true);
          this.onSpent(it);
        }
        continue;
      }
      const idx = loadout.ids.indexOf(it.blaster);
      if (idx < 0) {
        if (!this.nudged.get(it.id)) {
          this.nudged.set(it.id, true);
          this.onNeedBlaster(it);
        }
        continue;
      }
      it.spent = true;
      // The one-shot is used up for this sitting: a continued hold does
      // not play the spent sound until the player has left the gate.
      this.nudged.set(it.id, true);
      this.screens.get(it.id)!.emissiveIntensity = stationData.spendScale;
      loadout.setMod(idx, it.mod, true);
      this.onGranted(it);
    }
  }

  /** The gate: the eye is inside `reach` of the use point, and the view
   *  (`forward`, the camera's world direction, as the finisher and the
   *  vacuum's gates read it) is inside the cone onto the point (the
   *  card's "facing it"). */
  private passes(eye: THREE.Vector3, point: THREE.Vector3, forward: THREE.Vector3): boolean {
    const dx = point.x - eye.x, dy = point.y - eye.y, dz = point.z - eye.z;
    const d = Math.hypot(dx, dy, dz);
    if (d > SESSION.reach) return false;
    const fl = Math.hypot(forward.x, forward.y, forward.z);
    if (fl < 1e-6) return false;
    if (d < 1e-6) return true;
    // The view onto the point: the normalised forward dotted with the
    // normalised delta, the finisher's and the vacuum's way of saying
    // "it is in my view".
    const fx = forward.x / fl, fy = forward.y / fl, fz = forward.z / fl;
    return (dx * fx + dy * fy + dz * fz) / d >= SESSION.coneCos;
  }

  /** Restart: a restart resets the station (the card), the screens light
   *  up and the holds rest. */
  reset(): void {
    for (const it of this.items) {
      it.spent = false;
      this.holds.set(it.id, 0);
      this.nudged.set(it.id, false);
      this.screens.get(it.id)!.emissiveIntensity = 1;
    }
  }
}
