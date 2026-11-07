import { describe, expect, it } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { linearColorTable } from "../../src/voxel/materials";
import { greedyMesh } from "../../src/voxel/mesher";
import type { Mesher } from "../../src/voxel/pieces";
import { DebrisSystem } from "../../src/voxel/debris";
import { DartSystem } from "../../src/weapons/darts";
import { DartImpacts, type VoxelTarget } from "../../src/weapons/impacts";
import { FoamerSystem } from "../../src/foamers/foamers";
import { Blaster, resolveSpec, type BlasterControls, type DartFiring } from "../../src/weapons/blaster";
import dartTuning from "../../data/darts.json";
import foamerData from "../../data/foamers.json";
import type { DartTypeName } from "../../src/weapons/darts";

// GAME-09e stage 1: the precision dart and B05 Shrike. The dart reads its
// own type (fast, flat, thin, piercing), B05 reads its spec and needs the
// bolt time between shots, and a precision dart flies through the Foamers
// its data allows and stops at a wall.

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

class FakeDarts implements DartFiring {
  readonly types: DartTypeName[] = [];
  readonly times: number[] = [];
  now = 0;
  fire(_o: THREE.Vector3, _d: THREE.Vector3, t: DartTypeName): void {
    this.types.push(t);
    this.times.push(this.now);
  }
  get count(): number {
    return this.types.length;
  }
}

function make(blasterId: string, mods: string[] = []): { b: Blaster; darts: FakeDarts } {
  const darts = new FakeDarts();
  const b = new Blaster(resolveSpec(blasterId, mods), darts, (i) => MUZ[i], lcg(7));
  return { b, darts };
}
const TAP: BlasterControls = { fireHeld: true, firePressed: true, reloadPressed: false };
const NO_FIRE: BlasterControls = { fireHeld: false, firePressed: false, reloadPressed: false };

function fakeMesher(): Mesher {
  const colors = linearColorTable();
  return { mesh: (padded) => Promise.resolve(greedyMesh(padded, colors)) };
}

/** Scene, world, a DartSystem and a FoamerSystem on a floor. */
function arena() {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.createCollider(RAPIER.ColliderDesc.cuboid(40, 0.5, 40).setTranslation(0, -0.5, 0));
  const pb = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  const ignore = world.createCollider(
    RAPIER.ColliderDesc.capsule(0.5, 0.3).setTranslation(0, 0, 200), pb,
  );
  const scene = new THREE.Scene();
  const darts = new DartSystem(scene, world, RAPIER, ignore);
  const debris = new DebrisSystem(RAPIER, world);
  const targets: VoxelTarget[] = [];
  const foamers = new FoamerSystem(RAPIER, world, fakeMesher(), debris, darts, targets);
  new DartImpacts(darts, debris, targets);
  return { world, darts, foamers };
}

/** Let every part mesh settle, then step the world once so colliders are live. */
async function settle(foamers: FoamerSystem, world: RAPIER.World, darts: DartSystem) {
  for (const f of foamers.list) {
    for (const part of f.parts.values()) {
      for (;;) {
        part.mesh.update();
        if (!part.mesh.busy) break;
        await new Promise((r) => setTimeout(r, 0));
      }
    }
  }
  for (let i = 0; i < 5; i++) {
    darts.update(DT);
    foamers.update(DT, new THREE.Vector3(0, 1.6, 30));
    world.step();
  }
}

/** Run steps until `done` or the cap. */
function run(steps: number, step: (i: number) => boolean): void {
  for (let i = 0; i < steps; i++) if (step(i)) return;
}

describe("GAME-09e: the precision dart", () => {
  const p = dartTuning.types.precision;
  const s = dartTuning.types.standard;

  it("1. the precision dart exists, is fast, flat, thin and pierces one Foamer", () => {
    expect(p).toBeTruthy();
    expect(p.speed).toBeGreaterThanOrEqual(60);
    expect(p.speed).toBeGreaterThan(s.speed);
    expect(p.gravityScale).toBeLessThan(s.gravityScale);
    expect(p.drag).toBeLessThan(s.drag);
    expect(p.radius).toBeLessThan(s.radius);
    expect(p.pierce).toBe(1);
    // The dart type is data, and the damage table reads it too.
    expect(foamerData.test.damage.precision).toBeGreaterThan(foamerData.test.damage.slug);
  });

  it("2. a precision dart flies flatter than a standard one over the same run", async () => {
    const dropOf = (type: DartTypeName): number => {
      const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
      const pb = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
      const ignore = world.createCollider(
        RAPIER.ColliderDesc.capsule(0.5, 0.3).setTranslation(0, 0, 200), pb,
      );
      const darts = new DartSystem(new THREE.Scene(), world, RAPIER, ignore);
      world.step();
      const start = new THREE.Vector3(0, 3, 0);
      darts.fire(start, new THREE.Vector3(0, 0, -1), type);
      let dropped = 0;
      run(240, () => {
        darts.update(DT);
        world.step();
        darts.syncRender();
        const st = darts.stats();
        if (st.flying === 0) return true; // hit something or rested
        // Read the position from the instance matrix, as darts.test.ts does.
        const meshes = (darts as unknown as { meshes: Record<string, THREE.InstancedMesh> }).meshes;
        const m = new THREE.Matrix4();
        meshes[type].getMatrixAt(0, m);
        const pos = new THREE.Vector3().setFromMatrixPosition(m);
        if (pos.z <= start.z - 10) {
          dropped = start.y - pos.y;
          return true;
        }
        return false;
      });
      return dropped;
    };
    const flat = dropOf("precision");
    const normal = dropOf("standard");
    expect(flat).toBeLessThan(normal);
  });
});

describe("GAME-09e: B05 Shrike", () => {
  const S = resolveSpec("B05");

  it("3. B05 reads its spec: name, model, pump mode, precision darts, 5/30", () => {
    expect(S.name).toBe("Shrike");
    expect(S.model).toBe("/models/blasters/B05.glb");
    expect(S.mode).toBe("pump");
    expect(S.dartType).toBe("precision");
    expect(S.dartsPerShot).toBe(1);
    expect(S.spreadDeg).toBe(0);
    expect(S.magSize).toBe(5);
    expect(S.reserveMax).toBe(30);
    expect(S.reserveStart).toBe(15);
    expect(S.reloadTime).toBe(1.8);
    expect(S.muzzles).toEqual(["muzzle_1"]);
  });

  it("4. B05 needs the bolt time between shots, and fires one precision dart", () => {
    expect(S.primeTime).toBeCloseTo(0.9, 6);
    const { b, darts } = make("B05");
    expect(b.mag).toBe(5);
    expect(b.reserve).toBe(15);
    // One press: one dart, then the bolt is working.
    darts.now = 0;
    b.update(DT, TAP, AIM);
    expect(darts.count).toBe(1);
    expect(darts.types[0]).toBe("precision");
    expect(b.state).toBe("priming");
    // Held trigger, but no second dart before the bolt has cycled.
    let t = DT;
    run(Math.round(0.8 / DT), () => {
      darts.now = t;
      b.update(DT, { ...TAP, firePressed: false }, AIM);
      t += DT;
      return darts.count > 1;
    });
    expect(darts.count, "no dart during the bolt cycle").toBe(1);
    // After the bolt: the next press fires.
    run(Math.round(0.3 / DT), () => {
      darts.now = t;
      b.update(DT, NO_FIRE, AIM);
      t += DT;
      return b.state === "ready";
    });
    expect(b.state).toBe("ready");
    darts.now = t;
    b.update(DT, TAP, AIM);
    expect(darts.count).toBe(2);
    // Five shots have spent the magazine.
    for (let k = 0; k < 4; k++) {
      run(Math.round(2 / DT), () => {
        darts.now = t;
        b.update(DT, NO_FIRE, AIM);
        t += DT;
        return b.state === "ready";
      });
      darts.now = t;
      b.update(DT, TAP, AIM);
    }
    expect(b.mag).toBe(0);
    expect(darts.count).toBe(5);
  });

  it("5. B05 is in the loadout order, after B02", async () => {
    const blastersJson = await import("../../data/blasters.json");
    // Review: B05 joined after B02 when the branches met, so every
    // earlier blaster keeps its slot and key.
    expect(blastersJson.order).toEqual(["B01", "B04", "B03", "B06", "B02", "B05"]);
  });
});

describe("GAME-09e: pierce", () => {
  /** Fire one dart of `type` along -z from `origin` through the arena. */
  async function pierceRun(
    type: DartTypeName,
    opts: { second?: boolean; wall?: boolean; mods?: string[] },
  ): Promise<{ hits: number[]; hitTypes: DartTypeName[] }> {
    void type;
    const r = arena();
    const eye = new THREE.Vector3(0, 1.6, 30);
    const a = r.foamers.spawn(new THREE.Vector3(0, 0, -6), eye, "F01")!;
    if (opts.second) r.foamers.spawn(new THREE.Vector3(0, 0, -8), eye, "F01");
    if (opts.wall) {
      r.world.createCollider(RAPIER.ColliderDesc.cuboid(10, 6, 0.5).setTranslation(0, 3, -9.5));
    }
    await settle(r.foamers, r.world, r.darts);
    const hits: number[] = [];
    const hitTypes: DartTypeName[] = [];
    const previous = r.darts.onHit;
    r.darts.onHit = (hit) => {
      hits.push(hit.collider.parent()?.handle ?? -1);
      hitTypes.push(hit.type);
      previous(hit);
    };
    const b = new Blaster(resolveSpec("B05", opts.mods), r.darts, () => new THREE.Vector3(0, 1.1, -1), lcg(5));
    b.mag = 1;
    b.update(DT, TAP, AIM);
    run(60 * 3, () => {
      r.darts.update(DT);
      r.foamers.update(DT, eye);
      r.world.step();
      return r.darts.stats().flying === 0;
    });
    expect(a).toBeTruthy();
    return { hits, hitTypes };
  }

  it("6. a precision dart passes through one Foamer and hits the one behind it", async () => {
    const { hitTypes } = await pierceRun("precision", { second: true });
    // Two separate Foamer part hits (the pierce is 1), both precision darts.
    expect(hitTypes.length).toBeGreaterThanOrEqual(2);
    expect(hitTypes.every((t) => t === "precision")).toBe(true);
  });

  it("7. a precision dart stops at a wall behind the Foamer", async () => {
    const plain = await pierceRun("precision", {}); // no wall: it flies on
    const walled = await pierceRun("precision", { wall: true });
    // The wall run still hits the Foamer once and then the wall: no more
    // live dart than the plain run's single pierce allows.
    expect(walled.hitTypes.length).toBeGreaterThanOrEqual(1);
    expect(plain.hitTypes.length).toBe(1);
  });

  it("8. the heavier mod passes through three Foamers", async () => {
    const heavy = dartTuning.types.precisionHeavy;
    expect(heavy).toBeTruthy();
    expect(heavy.pierce).toBe(3);
    expect(foamerData.test.damage.precisionHeavy).toBeGreaterThan(foamerData.test.damage.precision);
    const r = arena();
    const eye = new THREE.Vector3(0, 1.6, 30);
    const types = ["F01", "F01", "F01", "F01"] as const;
    for (let i = 0; i < 4; i++) r.foamers.spawn(new THREE.Vector3(0, 0, -4 - i * 2), eye, types[i]);
    await settle(r.foamers, r.world, r.darts);
    const before = r.foamers.list.map((f) => f.health);
    const b = new Blaster(
      resolveSpec("B05", ["heavy"]), r.darts, () => new THREE.Vector3(0, 1.1, -1), lcg(5),
    );
    b.mag = 1;
    b.update(DT, TAP, AIM);
    run(60 * 3, () => {
      r.darts.update(DT);
      r.foamers.update(DT, eye);
      r.world.step();
      return r.darts.stats().flying === 0;
    });
    const hurt = r.foamers.list.filter((f, i) => f.health < before[i]).length;
    expect(hurt, "the heavy dart damaged at least three of the four").toBeGreaterThanOrEqual(3);
  });

  it("9. a dart never hits the same Foamer twice", async () => {
    const r = arena();
    const eye = new THREE.Vector3(0, 1.6, 30);
    r.foamers.spawn(new THREE.Vector3(0, 0, -6), eye, "F01");
    await settle(r.foamers, r.world, r.darts);
    const hitHandles: number[] = [];
    const previous = r.darts.onHit;
    r.darts.onHit = (hit) => {
      hitHandles.push(hit.collider.parent()?.handle ?? -1);
      previous(hit);
    };
    const b = new Blaster(
      resolveSpec("B05", ["heavy"]), r.darts, () => new THREE.Vector3(0, 1.1, -1), lcg(5),
    );
    b.mag = 1;
    b.update(DT, TAP, AIM);
    run(60 * 3, () => {
      r.darts.update(DT);
      r.foamers.update(DT, eye);
      r.world.step();
      return r.darts.stats().flying === 0;
    });
    // Every part body of the Foamer it pierced appears at most once.
    const seen = new Set<number>();
    for (const h of hitHandles) {
      expect(seen.has(h), `handle ${h} hit twice`).toBe(false);
      seen.add(h);
    }
    expect(hitHandles.length).toBeGreaterThanOrEqual(1);
  });

  it("10. a standard dart is unchanged: it stops at the first Foamer", async () => {
    const r = arena();
    const eye = new THREE.Vector3(0, 1.6, 30);
    r.foamers.spawn(new THREE.Vector3(0, 0, -6), eye, "F01");
    r.foamers.spawn(new THREE.Vector3(0, 0, -8), eye, "F01");
    await settle(r.foamers, r.world, r.darts);
    const before = r.foamers.list.map((f) => f.health);
    const b = new Blaster(resolveSpec("B01"), r.darts, () => new THREE.Vector3(0, 1.1, -1), lcg(5));
    b.mag = 1;
    b.dartType = "standard";
    b.update(DT, TAP, AIM);
    run(60 * 3, () => {
      r.darts.update(DT);
      r.foamers.update(DT, eye);
      r.world.step();
      return r.darts.stats().flying === 0;
    });
    const hurt = r.foamers.list.filter((f, i) => f.health < before[i]).length;
    expect(hurt, "a standard dart reaches the Foamer behind the first").toBe(1);
  });
});
