import * as THREE from "three";
import type RAPIER from "@dimforge/rapier3d-compat";
import { CAPSULE_GROUPS, SIGHT_QUERY_GROUPS, type Rapier } from "../physics/world";
import { carveSphere } from "../voxel/carve";
import type { VoxelTarget } from "../weapons/impacts";
import type { DebrisSystem } from "../voxel/debris";
import type { FoamerSystem } from "../foamers/foamers";
import type { Foamer } from "../foamers/foamer";
import type { Shield } from "../player/shield";
import meleeJson from "../../data/melee.json";

// GAME-06: melee weapon 1 (M01) and its charges. The melee key, after the
// finisher had its look at the press: a charged three-hit combo, or a weak
// shield bash when the charges are gone. Every number is in data/melee.json
// under `weapons`, keyed by id, so weapons 2 and 3 are data plus small code
// later. The class owns the combo, the charges and the hit query; the page
// owns the key order (the finisher first), the sounds and the HUD.

const T = meleeJson as unknown as {
  active: string;
  charges: number;
  rechargeSeconds: number;
  comboWindow: number;
  swingTime: number;
  reach: number;
  arcDeg: number;
  maxTargets: number;
  carveRadius: number;
  debrisMax: number;
  bash: {
    damage: number; push: number; cooldown: number; reach: number; arcDeg: number;
    maxTargets: number; carveRadius: number; debrisMax: number; kick: number; kickTime: number;
  };
  weapons: Record<string, {
    name: string;
    hits: { damage: number; stagger?: boolean; knockback?: number }[];
  }>;
};

const EXCLUDE_SENSORS = 8; // QueryFilterFlags.EXCLUDE_SENSORS (as shield.ts)
const DEG = Math.PI / 180;

/** What one press did, for the page's sounds and HUD. */
export interface MeleeEvents {
  /** The combo hit that swung this step (0 is the first), -1 for a bash,
   *  null when the press did nothing. */
  swung: number | null;
  /** A press with no charge and the bash still on cooldown: the empty click. */
  empty: boolean;
  /** The Foamers this press hit (for the hit sound and the watch). */
  hits: Foamer[];
  /** Where a carve happened, for the carve sound. */
  carved: THREE.Vector3[];
  /** Charges a parry or the timer gave back this step. */
  refills: number;
}

// Scratches, one per call batch.
const _chest = new THREE.Vector3();
const _to = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _carve = new THREE.Vector3();

export class Melee {
  /** Charges left (full at level start and on retry). */
  charges = T.charges;
  /** The combo hit the next press swings (0 to hits-1). */
  comboStep = 0;
  /** Seconds left of the running swing (0 when none is). */
  swingLeft = 0;
  /** Seconds left of the bash's cooldown. */
  bashLeft = 0;
  private rechargeLeft = T.rechargeSeconds;
  private lastParries = 0;
  private lastPress = -1e9; // sim time of the last press (the combo window)
  private time = 0;
  private kickLeft = 0;
  private debrisThisSwing = 0;
  private readonly spec = T.weapons[T.active];
  private ray: RAPIER.Ray;

  constructor(
    rapier: Rapier,
    private world: RAPIER.World,
    private foamers: FoamerSystem,
    private debris: DebrisSystem,
    private targets: VoxelTarget[],
    private playerCollider: RAPIER.Collider,
  ) {
    this.ray = new rapier.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -1 });
  }

  get maxCharges(): number { return T.charges; }
  get swinging(): boolean { return this.swingLeft > 0; }
  get comboHits(): number { return this.spec.hits.length; }
  /** The bash's view kick in radians; the page adds it to the camera's
   *  climb like the shield's kicks. */
  get kick(): number {
    return this.kickLeft > 0 ? T.bash.kick * (this.kickLeft / T.bash.kickTime) : 0;
  }

  /** Full at level start and on retry (the page's restart hooks). */
  reset(): void {
    this.charges = T.charges;
    this.comboStep = 0;
    this.swingLeft = 0;
    this.bashLeft = 0;
    this.rechargeLeft = T.rechargeSeconds;
    this.lastParries = 0;
    this.lastPress = -1e9;
  }

  /** One fixed step: the timers. The parry refill reads the shield's own
   *  count, so the page just hands over the shield it already has. */
  update(dt: number, shield: Shield): MeleeEvents {
    const e = { swung: null, empty: false, hits: [], carved: [], refills: 0 } as MeleeEvents;
    this.time += dt;
    if (this.swingLeft > 0) this.swingLeft = Math.max(0, this.swingLeft - dt);
    if (this.bashLeft > 0) this.bashLeft = Math.max(0, this.bashLeft - dt);
    if (this.kickLeft > 0) this.kickLeft = Math.max(0, this.kickLeft - dt);
    if (shield.parries > this.lastParries) {
      let gained = shield.parries - this.lastParries;
      this.lastParries = shield.parries;
      while (gained-- > 0 && this.give()) e.refills++;
    }
    if (this.charges < T.charges) {
      this.rechargeLeft -= dt;
      if (this.rechargeLeft <= 0) {
        this.rechargeLeft = T.rechargeSeconds;
        if (this.give()) e.refills++;
      }
    } else {
      this.rechargeLeft = T.rechargeSeconds;
    }
    return e;
  }

  private give(): boolean {
    if (this.charges >= T.charges) return false;
    this.charges++;
    return true;
  }

  /** The melee press, after the page let the finisher look at it first.
   *  A charged press swings the combo's next hit and spends one charge; a
   *  press with no charge is the shield bash; a press with the bash on
   *  cooldown is the empty click (never nothing). No swing while the disc
   *  is raised or a shield charge runs (the card's rule with the shield;
   *  a swing with the disc thrown is fine). The finisher's own gate is the
   *  page's, and a running swing swallows nothing: the page calls this
   *  only when it wants the press spent. Returns what happened. */
  press(eye: THREE.Vector3, forward: THREE.Vector3, shield: Shield): MeleeEvents {
    const e = { swung: null, empty: false, hits: [], carved: [], refills: 0 } as MeleeEvents;
    if (this.swinging) return e;
    if (shield.state === "raised" || shield.charging) return e;
    this.debrisThisSwing = 0;
    if (this.charges <= 0) return this.bash(eye, forward, e);
    const hits = this.spec.hits;
    const within = this.time - this.lastPress <= T.comboWindow;
    const idx = within ? this.comboStep % hits.length : 0;
    this.lastPress = this.time;
    this.comboStep = (idx + 1) % hits.length;
    this.charges--;
    this.swingLeft = T.swingTime;
    const h = hits[idx];
    this.strike(eye, forward, T.reach, T.arcDeg, T.maxTargets, h.damage, e);
    if (h.stagger || h.knockback) {
      for (const f of e.hits) {
        if (f.state === "down") continue;
        if (h.stagger) this.foamers.startStagger(f, false, f.spec.stagger.time);
        if (h.knockback) this.push(eye, f, h.knockback);
      }
    }
    this.carveLine(eye, forward, T.reach, T.carveRadius, T.debrisMax, e);
    e.swung = idx;
    return e;
  }

  /** The press with no charge: weak damage, a small push, no stagger, a
   *  longer cooldown, and the view's short shove (the kick getter). */
  private bash(eye: THREE.Vector3, forward: THREE.Vector3, e: MeleeEvents): MeleeEvents {
    if (this.bashLeft > 0) {
      e.empty = true;
      return e;
    }
    this.bashLeft = T.bash.cooldown;
    this.kickLeft = T.bash.kickTime;
    this.lastPress = this.time;
    this.comboStep = 0;
    this.strike(eye, forward, T.bash.reach, T.bash.arcDeg, T.bash.maxTargets, T.bash.damage, e);
    for (const f of e.hits) {
      if (f.state === "down") continue;
      this.push(eye, f, T.bash.push);
    }
    this.carveLine(eye, forward, T.bash.reach, T.bash.carveRadius, T.bash.debrisMax, e);
    e.swung = -1;
    return e;
  }

  /** The Foamers the swing takes: in reach (to the chest), inside the
   *  arc, in sight of the eye, nearest first, at most maxTargets. */
  private strike(
    eye: THREE.Vector3, forward: THREE.Vector3,
    reach: number, arcDeg: number, maxTargets: number, damage: number,
    e: MeleeEvents,
  ): void {
    const cone = Math.cos((arcDeg / 2) * DEG);
    const picked: { f: Foamer; d2: number }[] = [];
    for (const f of this.foamers.list) {
      if (f.state === "down") continue;
      _chest.set(f.centre.x, f.centre.y + f.height * 0.5, f.centre.z);
      const d2 = _chest.distanceToSquared(eye);
      if (d2 > reach * reach) continue;
      _to.copy(_chest).sub(eye);
      const len = _to.length();
      if (len < 1e-6) continue;
      _to.divideScalar(len);
      if (_to.dot(forward) < cone) continue;
      if (!this.inSight(f, eye)) continue;
      picked.push({ f, d2 });
    }
    picked.sort((a, b) => a.d2 - b.d2);
    for (const p of picked.slice(0, maxTargets)) {
      // The non-dart hit: health and the finishable band, no part break
      // and no pop (a foam baton is a bounce, not a dart).
      this.foamers.parryDamage(p.f, damage);
      e.hits.push(p.f);
    }
  }

  /** Drive a Foamer along the line from the player through its own
   *  controller (a wall stops it), the shield charge's pattern. */
  private push(eye: THREE.Vector3, f: Foamer, metres: number): void {
    _dir.set(f.centre.x - eye.x, 0, f.centre.z - eye.z);
    const len = Math.hypot(_dir.x, _dir.z);
    if (len < 1e-6) return;
    _dir.x /= len;
    _dir.z /= len;
    let left = metres;
    for (let i = 0; i < 8; i++) {
      const moved = this.foamers.knockStep(f, _dir.x, _dir.z, left);
      if (moved <= 1e-4) break;
      left -= moved;
    }
  }

  /** A small foam sphere where the swing's line meets cover or a Foamer,
   *  through the carve path, capped as darts are. */
  private carveLine(
    eye: THREE.Vector3, forward: THREE.Vector3,
    reach: number, radius: number, cap: number, e: MeleeEvents,
  ): void {
    const room = cap - this.debrisThisSwing;
    if (room <= 0) return;
    this.ray.origin = { x: eye.x, y: eye.y, z: eye.z };
    this.ray.dir = { x: forward.x, y: forward.y, z: forward.z };
    const me = this.playerCollider;
    const hit = this.world.castRay(
      this.ray, reach, true, EXCLUDE_SENSORS, SIGHT_QUERY_GROUPS,
      undefined, undefined,
      (c) => c !== me && c.collisionGroups() !== CAPSULE_GROUPS,
    );
    if (!hit) return;
    const target = this.targets.find((t) => t.owns(hit.collider));
    if (!target) return;
    const vs = target.volume.voxelSize;
    const r = radius * (target.carveScale ?? 1);
    _carve.copy(eye).addScaledVector(forward, Math.max(0, hit.timeOfImpact - vs * 0.5));
    target.worldToVoxel(_carve);
    const removed = carveSphere(target.volume, _carve.x, _carve.y, _carve.z, r / vs);
    if (removed.length === 0) return;
    this.debrisThisSwing += Math.min(room, removed.length);
    _dir.copy(eye).addScaledVector(forward, hit.timeOfImpact);
    this.debris.spawn(removed.slice(0, room), _dir, vs, (v) => target.voxelToWorld(v));
    e.carved.push(_dir.clone());
  }

  /** The chest in sight of the eye: the shield lock's sight test, with the
   *  candidate's capsule and the player's own excluded. */
  private inSight(f: Foamer, from: THREE.Vector3): boolean {
    _to.copy(f.centre).setY(f.centre.y + f.height * 0.5).sub(from);
    const len = _to.length();
    if (len < 1e-6) return true;
    _to.divideScalar(len);
    this.ray.origin = { x: from.x, y: from.y, z: from.z };
    this.ray.dir = { x: _to.x, y: _to.y, z: _to.z };
    const a = f.capsule;
    const me = this.playerCollider;
    const hit = this.world.castRay(
      this.ray, len - 0.1, true, EXCLUDE_SENSORS, SIGHT_QUERY_GROUPS,
      undefined, undefined,
      (c) => c !== a && c !== me && c.collisionGroups() !== CAPSULE_GROUPS,
    );
    return !hit;
  }
}

/** The card's key order on melee, in one place the page and the tests
 *  share: the finisher sees the press first, and the weapon gets it only
 *  when finisherHas() says none can take it. Returns null when the
 *  finisher took it. */
export function meleePress(
  melee: Melee, eye: THREE.Vector3, forward: THREE.Vector3,
  shield: Shield, finisherHas: () => boolean,
): MeleeEvents | null {
  if (finisherHas()) return null;
  return melee.press(eye, forward, shield);
}
