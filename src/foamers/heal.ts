import * as THREE from "three";
import type { FoamerSpec } from "./foamer";
import type { Foamer } from "./foamer";
import { materialId, linearColorTable } from "../voxel/materials";

// GAME-10l stage 2: the Biomechanic's healing stream numbers. A type that
// heals carries them in its spec (data/foamers.json, `heal`); every other
// type has none. The pattern is pellet.ts and wall.ts: the numbers stay in
// data, the code only reads them.

export interface HealSpec {
  /** The range the ally must be inside, metres. */
  rangeMetres: number;
  /** Health given to the ally each second, at most its maximum. */
  perSecond: number;
  /** Seconds between looks for the most hurt ally. */
  pickSeconds: number;
  /** Hard cap on the blobs the stream is drawn with. */
  blobCap: number;
  /** Metres between two blobs of the chain. */
  blobSpacingMetres: number;
  /** How fast a blob reads as travelling from the wand to the ally, m/s. */
  blobDriftMetres: number;
  /** The radius of one blob, metres. */
  blobRadiusMetres: number;
}

/** The healing numbers of a type, or null when it does not heal. */
export function healOf(spec: FoamerSpec): HealSpec | null {
  return (spec as { heal?: HealSpec }).heal ?? null;
}

/** Whether this Foamer can still heal: the tank is the press and the wand
 *  the nozzle the stream is poured from. With the tank gone the healing
 *  stream is gone (the card; stage 3's spray too), and with the wand
 *  broken off there is no tip to pour from, so there is no healing either
 *  (a stream nobody can see is no stream). */
export function canHeal(spec: FoamerSpec, f: Foamer): boolean {
  return healOf(spec) !== null && f.parts.has("tank") && f.parts.has("wand");
}

/** The range it heals at: the antenna is the tank's aerial, so with it gone
 *  the range halves (the card). */
export function healRange(spec: FoamerSpec, f: Foamer): number {
  const heal = healOf(spec);
  if (!heal) return 0;
  return f.parts.has("antenna") ? heal.rangeMetres : heal.rangeMetres * 0.5;
}

/** The share of its health a Foamer has left, 0 to 1: what "the most hurt
 *  ally" is measured by, so a big Foamer with 30 of 50 is above a small one
 *  with 5 of 10. */
export function healthShare(f: Foamer): number {
  if (!(f.maxHealth > 0)) return 0;
  return Math.max(0, Math.min(1, f.health / f.maxHealth));
}

/** The stream's froth: foam-core, the wand's tip colour (not BALL_MATERIAL,
 *  so the pages do not read a blob as something to parry). One material for
 *  every stream, like the pellet's and the wall's. */
export const HEAL_MATERIAL = new THREE.MeshStandardMaterial({
  color: new THREE.Color().fromArray(linearColorTable(), materialId("foam-core") * 3),
  roughness: 0.5,
});

const BLOB_GEO = new THREE.SphereGeometry(1, 8, 6);

const _from = new THREE.Vector3();
const _to = new THREE.Vector3();
const _at = new THREE.Vector3();
const _tip = new THREE.Vector3();

/**
 * The chain of blobs the stream is drawn with: up to blobCap spheres along
 * the line from the wand tip to the healed ally's chest, parked invisible
 * while nothing is being healed. One instance per healing Foamer, created at
 * spawn; no allocation per step.
 */
export class HealStream {
  readonly group = new THREE.Group();
  private readonly blobs: THREE.Mesh[] = [];

  constructor(heal: HealSpec) {
    this.group.visible = false;
    for (let i = 0; i < Math.max(1, Math.floor(heal.blobCap)); i++) {
      const blob = new THREE.Mesh(BLOB_GEO, HEAL_MATERIAL);
      blob.visible = false;
      this.group.add(blob);
      this.blobs.push(blob);
    }
  }

  /** Draw the stream this step: from the wand tip to the ally's chest, the
   *  blobs spaced along it and drifting toward the ally, never more than
   *  the cap. phase (seconds) moves them; time is the system's clock, so
   *  the stream is deterministic. */
  draw(from: THREE.Vector3, to: THREE.Vector3, heal: HealSpec, phase: number): void {
    const spacing = Math.max(1e-3, heal.blobSpacingMetres);
    const driftSpeed = Math.max(0, heal.blobDriftMetres);
    _from.copy(from);
    _to.copy(to);
    const len = _from.distanceTo(_to);
    const shown = Math.min(this.blobs.length, Math.max(1, Math.ceil(len / spacing)));
    const drift = (phase * driftSpeed) % spacing;
    for (let i = 0; i < this.blobs.length; i++) {
      const blob = this.blobs[i]!;
      const on = i < shown;
      blob.visible = on;
      if (!on) continue;
      const t = Math.min(0.98, (i * spacing + drift) / Math.max(1e-3, len));
      _at.lerpVectors(_from, _to, t);
      blob.position.copy(_at);
      blob.scale.setScalar(heal.blobRadiusMetres);
    }
    this.group.visible = true;
  }

  /** Nothing is being healed: the stream is not drawn at all. */
  hide(): void {
    this.group.visible = false;
    for (const b of this.blobs) b.visible = false;
  }

  dispose(): void {
    this.group.removeFromParent();
    for (const b of this.blobs) b.removeFromParent();
    this.blobs.length = 0;
  }
}

/** The wand's foam-core tip in world space, or null when the wand is gone.
 *  The tip is the bottom part.tip.length voxels of the tube; read from the
 *  part's pose, which is this step's (the body's own translation lags a
 *  step behind until world.step). */
export function wandTipPoint(f: Foamer, out: THREE.Vector3 = _tip): THREE.Vector3 | null {
  const part = f.parts.get("wand");
  if (!part) return null;
  const spec = part.spec;
  const tip = spec.tip;
  if (!tip) return null;
  return out
    .set(spec.size[0] / 2, tip.length / 2, spec.size[2] / 2)
    .multiplyScalar(f.rig.voxelSize)
    .applyMatrix4(part.pose);
}
