import { describe, expect, it } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { VoxelVolume } from "../../src/voxel/chunk";
import { materialId } from "../../src/voxel/materials";
import { DebrisSystem } from "../../src/voxel/debris";
import { DartSystem, type DartTypeName, type DartShot } from "../../src/weapons/darts";
import { DartImpacts } from "../../src/weapons/impacts";
import { ExplosionSystem } from "../../src/weapons/explosion";
import { Blaster, resolveSpec, type BlasterControls, type DartFiring } from "../../src/weapons/blaster";
import tuning from "../../data/explosion.json";

// GAME-09e stage 2: B05's mods. Explosive rounds: every shot explodes at
// its first hit through the shared ExplosionSystem (explosiveEvery 1, the
// same path as B06's every-5th mod). Heavier rounds: the precisionHeavy
// dart pierces three Foamers (tests/weapons/b05.test.ts) and carries a
// little more damage and impulse (its damage in data/foamers.json).

const DT = 1 / 60;
const AIM = new THREE.Vector3(0, 0, -1);
const MUZ = [new THREE.Vector3(0, 1.4, -0.5)];

function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const HOLD: BlasterControls = { fireHeld: true, firePressed: true, reloadPressed: false };

class FakeDarts implements DartFiring {
  readonly shots: DartShot[] = [];
  fire(_o: THREE.Vector3, _d: THREE.Vector3, _t: DartTypeName, shot?: DartShot): void {
    this.shots.push({ ...shot!, muzzle: shot!.muzzle.clone() });
  }
  get count(): number {
    return this.shots.length;
  }
}

/** Fire n shots of B05 with the given mods through the blaster's state
 *  machine (the bolt time paces the shots). */
function shots(n: number, mods: string[]): DartShot[] {
  const darts = new FakeDarts();
  const b = new Blaster(resolveSpec("B05", mods), darts, (i) => MUZ[i], lcg(3));
  b.reserve = 99;
  let guard = 0;
  while (darts.count < n && guard++ < 60 * 60) b.update(DT, HOLD, AIM);
  return darts.shots.slice(0, n);
}

describe("GAME-09e: B05's mods", () => {
  it("1. explosive rounds: every shot explodes", () => {
    const s = shots(6, ["explosive"]);
    expect(s.length).toBe(6);
    expect(s.every((x) => x.explodes), "every shot tagged explodes").toBe(true);
  });

  it("2. without the mod, no shot explodes", () => {
    const s = shots(6, []);
    expect(s.every((x) => !x.explodes)).toBe(true);
  });

  it("3. an explosive precision dart blasts once at its first hit", () => {
    // The real path: DartSystem + DartImpacts wired to the shared system.
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    world.createCollider(RAPIER.ColliderDesc.cuboid(40, 0.5, 40).setTranslation(0, -0.5, 0));
    const pb = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    const ignore = world.createCollider(
      RAPIER.ColliderDesc.capsule(0.5, 0.3).setTranslation(0, 0, 200), pb,
    );
    const darts = new DartSystem(new THREE.Scene(), world, RAPIER, ignore);
    const debris = new DebrisSystem(RAPIER, world);
    const volume = new VoxelVolume(0.1);
    volume.fillBox(0, 0, 0, 19, 19, 19, materialId("foam-orange"));
    const target = {
      volume,
      worldToVoxel: (p: THREE.Vector3) => p.multiplyScalar(1 / volume.voxelSize),
      voxelToWorld: (p: THREE.Vector3) => p.multiplyScalar(volume.voxelSize),
    };
    const explosion = new ExplosionSystem(world, debris, [target]);
    new DartImpacts(darts, debris, [], explosion);
    const points: THREE.Vector3[] = [];
    explosion.onExplode = (p) => points.push(p.clone());
    const shot = { id: 1, muzzle: new THREE.Vector3(0, 1.4, -0.5), chunk: null, explodes: true };
    darts.fire(new THREE.Vector3(1, 1, 1), new THREE.Vector3(0, -1, -0.2), "precision", shot);
    for (let i = 0; i < 180; i++) {
      darts.update(DT);
      world.step();
    }
    expect(points.length).toBe(1);
    expect(points[0].y).toBeLessThan(0.8); // the hit point, near the floor
  });

  it("4. heavier rounds: pierce 3, more damage and impulse than the plain dart", async () => {
    const dartsJson = await import("../../data/darts.json");
    const foamersJson = await import("../../data/foamers.json");
    const plain = dartsJson.types.precision;
    const heavy = dartsJson.types.precisionHeavy;
    expect(heavy.pierce).toBe(3);
    expect(heavy.impulse).toBeGreaterThan(plain.impulse);
    // Its damage sits above the plain precision dart's in the table.
    const d = foamersJson.test.damage;
    expect(d.precisionHeavy).toBeGreaterThan(d.precision);
    // The blaster's mod selects the heavier dart type.
    expect(resolveSpec("B05", ["heavy"]).dartType).toBe("precisionHeavy");
    expect(resolveSpec("B05").dartType).toBe("precision");
  });

  it("5. the explosion's own cap still guards the every-shot mod", () => {
    // The mod tags every shot; the shared system's per-second cap is the
    // limit on blasts (data/explosion.json), unchanged by B05.
    expect(tuning.maxPerSecond).toBeGreaterThan(0);
  });
});
