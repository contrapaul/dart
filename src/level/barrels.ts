import * as THREE from "three";
import type RAPIER from "@dimforge/rapier3d-compat";
import type { Rapier } from "../physics/world";
import { material, materialId } from "../voxel/materials";
import type { DebrisSystem } from "../voxel/debris";
import type { DartHit } from "../weapons/darts";
import type { ExplosionSystem } from "../weapons/explosion";
import { makeRng } from "../audio/synth";
import {
  advance, blastReaches, CHAIN_DELAY, classifyHit, puncture, shareLeft, startFuse,
  type Fuse,
} from "./barrel-fuse";
import tuning from "../../data/barrel.json";

// ENV-05 (E15): the leaking foam barrel. A short toy barrel that takes
// punctures: a standard dart starts a fuse and opens a leak that jets foam
// cubes along the hit's normal, a second dart halves what is left, a third
// sets it off. Every other round, and any blast that reaches it, sets it off
// too (a blast after `chainDelay`, so a row of barrels ripples).
//
// It is built for explosive terrain later (FX-01), so the rules live in
// barrel-fuse.ts with no world in them, and everything here is a thin
// system: one mesh group and one solid collider per barrel, the spray
// through the shared DebrisSystem (its ring is the hard cap), and the blast
// through the shared ExplosionSystem with the `barrel` profile.
//
// The spray's directions and speeds come from a seeded PRNG, never
// Math.random: the same shot on the same barrel sprays the same way.

const T = tuning;

/** One barrel's placement from a level or a page: its foot on the floor. */
export interface BarrelPlacement {
  pos: [number, number, number];
}

interface Leak {
  point: THREE.Vector3;
  dir: THREE.Vector3;
  /** This leak's own cube counter, so its rate is exact, not rounded. */
  acc: number;
  rng: () => number;
}

interface Barrel {
  index: number;
  centre: THREE.Vector3;
  radius: number;
  group: THREE.Group;
  body: RAPIER.RigidBody;
  collider: RAPIER.Collider;
  fuse: Fuse;
  leaks: Leak[];
  /** Seconds until a blast that reached it goes off, or null. */
  chain: number | null;
  gone: boolean;
}

export class Barrels {
  readonly stats = { punctures: 0, setOff: 0, cubes: 0 };
  /** Called as a barrel leaves the world, with its centre and its own
   *  radius. A page hangs its darts loose here: a dart stuck in a fixed
   *  collider rides nothing, so it would hang where the barrel was. */
  onGone: (centre: THREE.Vector3, radius: number) => void = () => {};
  private list: Barrel[] = [];
  private group = new THREE.Group();
  private readonly bodyMaterial: THREE.MeshStandardMaterial;
  private readonly bandMaterial: THREE.MeshStandardMaterial;
  private readonly lidMaterial: THREE.MeshStandardMaterial;
  private readonly sprayMaterial = materialId(T.spray.material);
  private readonly coneRad = (T.spray.coneDegrees * Math.PI) / 180;
  private readonly _dir = new THREE.Vector3();
  private readonly _side = new THREE.Vector3();
  private readonly _up = new THREE.Vector3();
  private readonly _vel = new THREE.Vector3();

  constructor(
    private rapier: Rapier,
    private world: RAPIER.World,
    scene: THREE.Scene,
    private debris: DebrisSystem,
    private explosion: ExplosionSystem,
    private placements: BarrelPlacement[],
  ) {
    const colour = (name: string) => material(materialId(name))?.color ?? 0xffffff;
    this.bodyMaterial = new THREE.MeshStandardMaterial({
      color: colour(T.look.bodyMaterial), roughness: 0.85,
    });
    this.bandMaterial = new THREE.MeshStandardMaterial({
      color: colour(T.look.bandMaterial), roughness: 0.85,
    });
    this.lidMaterial = new THREE.MeshStandardMaterial({
      color: colour(T.look.lidMaterial), roughness: 0.85,
    });
    scene.add(this.group);
    this.build();
  }

  /** Every live barrel's centre, for the page's report and its tests. */
  get centres(): readonly THREE.Vector3[] {
    return this.list.filter((b) => !b.gone).map((b) => b.centre);
  }

  /** A dart hit. The collider names the barrel; a standard dart punctures,
   *  every other round sets it off. */
  hit(hit: DartHit): void {
    const b = this.byCollider(hit.collider);
    if (!b || b.gone) return;
    if (classifyHit(hit.type) === "setOff") {
      this.setOff(b);
      return;
    }
    // One leak per puncture, at the hit point, jetting out along its normal.
    // maxLeaks is the last guard: the third puncture is already the blast.
    if (b.leaks.length < T.maxLeaks) {
      this._dir.copy(hit.normal).normalize();
      b.leaks.push({
        point: hit.point.clone(),
        dir: this._dir.clone(),
        acc: 0,
        // Its own seeded stream, so leaks do not share one sequence.
        rng: makeRng(1013 + b.index * 7919 + b.leaks.length * 131),
      });
    }
    this.stats.punctures++;
    if (puncture(b.fuse)) this.setOff(b);
  }

  /** A blast ran at this point (the page chains this onto the explosion's
   *  onExplode). A barrel the blast reaches goes off a chainDelay later. */
  onBlast(point: THREE.Vector3, reach: number): void {
    for (const b of this.list) {
      if (b.gone || b.chain !== null) continue;
      if (!blastReaches(b.centre.distanceTo(point), reach, b.radius)) continue;
      // A barrel already on a fuse goes off on the chain, not twice: the
      // chain wins because the blast is the faster end (the card's ripple).
      b.chain = CHAIN_DELAY;
    }
  }

  /** Fixed step: run the chains, age the fuses, spray the leaks. */
  update(dt: number): void {
    // Chains are aged from the state at the start of the step, so a blast
    // that arrives in this step waits its own delay rather than going off
    // at once (`this.list` is walked in placement order, and a setOff adds
    // new chain timers while it walks).
    const chained = this.list.filter((b) => !b.gone && b.chain !== null);
    for (const b of this.list) {
      if (b.gone) continue;
      // A barrel waiting on a chain keeps leaking: the leak runs until it
      // goes off, whichever way it goes.
      if (b.chain === null && advance(b.fuse, dt)) {
        this.setOff(b);
        continue;
      }
      if (b.leaks.length > 0) this.spray(b, dt);
    }
    for (const b of chained) {
      if (b.gone || b.chain === null) continue;
      b.chain -= dt;
      if (b.chain <= 0) this.setOff(b);
    }
  }

  /** Take every barrel out and put the placements back (the page's T). */
  reset(): void {
    for (const b of this.list) this.remove(b);
    this.list = [];
    this.build();
  }

  /** One leak's cubes for this step: an exact rate, aimed in the cone. */
  private spray(b: Barrel, dt: number): void {
    const S = T.spray;
    // The jet quickens as the fuse runs down, so the player can read it.
    const share = shareLeft(b.fuse);
    const speed = S.speedEnd + (S.speedStart - S.speedEnd) * share;
    const size = S.cubeSizeMetres;
    for (const leak of b.leaks) {
      leak.acc += S.cubesPerSecond * dt;
      const count = Math.floor(leak.acc);
      leak.acc -= count;
      for (let i = 0; i < count; i++) {
        // A direction inside the cone around the hit normal: uniform in the
        // solid angle, built from the seeded stream.
        const cosA = 1 - leak.rng() * (1 - Math.cos(this.coneRad));
        const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
        const az = leak.rng() * Math.PI * 2;
        this._side.set(0, 1, 0);
        if (Math.abs(leak.dir.y) > 0.9) this._side.set(1, 0, 0);
        this._side.crossVectors(leak.dir, this._side).normalize();
        this._up.crossVectors(leak.dir, this._side).normalize();
        this._dir.copy(leak.dir).multiplyScalar(cosA)
          .addScaledVector(this._side, sinA * Math.cos(az))
          .addScaledVector(this._up, sinA * Math.sin(az));
        this._vel.copy(this._dir).multiplyScalar(speed);
        // Out of the surface by the cube's half, so it does not start inside
        // the barrel's own collider.
        this._dir.multiplyScalar(size * 0.5).add(leak.point);
        this.debris.sprayCube(this._dir, this._vel, size, this.sprayMaterial);
        this.stats.cubes++;
      }
    }
  }

  private setOff(b: Barrel): void {
    if (b.gone) return;
    this.stats.setOff++;
    b.fuse.setOff = true;
    const centre = b.centre.clone();
    this.remove(b);
    this.onGone(centre, b.radius + 0.5);
    // One blast in the barrel profile, then the barrel is gone. The chain
    // needs no recursion guard: the barrel has left its own list first.
    this.explosion.explode(centre, "barrel");
  }

  private byCollider(collider: RAPIER.Collider): Barrel | undefined {
    for (const b of this.list) if (b.collider.handle === collider.handle) return b;
    return undefined;
  }

  private build(): void {
    const L = T.look;
    const radius = L.diameterMetres / 2;
    const height = L.heightMetres;
    const bodyGeo = new THREE.CylinderGeometry(radius, radius, height, 20);
    const bandGeo = new THREE.CylinderGeometry(radius * 1.02, radius * 1.02, L.bandHeightMetres, 20);
    const lidGeo = new THREE.CylinderGeometry(radius * 0.94, radius * 0.94, L.lidHeightMetres, 20);
    for (const p of this.placements) {
      const index = this.list.length;
      const centre = new THREE.Vector3(
        p.pos[0], p.pos[1] + height / 2, p.pos[2],
      );
      const group = new THREE.Group();
      // The group sits at the barrel's centre, so the body is at its local
      // origin, the band a little above the middle and the lid on top.
      const body = new THREE.Mesh(bodyGeo, this.bodyMaterial);
      const band = new THREE.Mesh(bandGeo, this.bandMaterial);
      band.position.y = height * 0.18;
      const lid = new THREE.Mesh(lidGeo, this.lidMaterial);
      lid.position.y = height / 2 + L.lidHeightMetres * 0.5;
      body.castShadow = body.receiveShadow = true;
      band.castShadow = lid.castShadow = true;
      group.add(body, band, lid);
      group.position.copy(centre);
      this.group.add(group);
      // A solid barrel: darts meet it and the player cannot walk through it.
      const rb = this.world.createRigidBody(
        this.rapier.RigidBodyDesc.fixed().setTranslation(centre.x, centre.y, centre.z),
      );
      const collider = this.world.createCollider(
        this.rapier.ColliderDesc.cylinder(height / 2, radius), rb,
      );
      this.list.push({
        index, centre, radius, group, body: rb, collider,
        fuse: startFuse(), leaks: [], chain: null, gone: false,
      });
    }
  }

  private remove(b: Barrel): void {
    b.gone = true;
    b.group.removeFromParent();
    if (b.body.isValid()) this.world.removeRigidBody(b.body);
  }
}
