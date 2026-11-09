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
import { Blaster, resolveSpec, type BlasterControls } from "../../src/weapons/blaster";
import blastersJson from "../../data/blasters.json";
import dartTuning from "../../data/darts.json";

// PT-03 stage 2: the slug punches through, per CONTENT-PLAN 4. The B01 slug
// mod is its own dart type (b01slug, pierce 1) because the B02 heavy shares
// the plain slug, which does not pierce. The scene test follows the GAME-09e
// precedent: the dart meets the first Foamer and carries on to the part of
// the one behind it, whatever piece that lands on.

const DT = 1 / 60;
const AIM = new THREE.Vector3(0, 0, -1);
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
}
function fakeMesher(): Mesher {
  const colors = linearColorTable();
  return { mesh: (padded) => Promise.resolve(greedyMesh(padded, colors)) };
}
function arena() {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.createCollider(RAPIER.ColliderDesc.cuboid(40, 0.5, 40).setTranslation(0, -0.5, 0));
  const pb = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  const ignore = world.createCollider(
    RAPIER.ColliderDesc.capsule(0.5, 0.3).setTranslation(0, 0, 200), pb,
  );
  const darts = new DartSystem(new THREE.Scene(), world, RAPIER, ignore);
  const debris = new DebrisSystem(RAPIER, world);
  const targets: VoxelTarget[] = [];
  const foamers = new FoamerSystem(RAPIER, world, fakeMesher(), debris, darts, targets);
  new DartImpacts(darts, debris, targets);
  return { world, darts, foamers };
}
async function settle(
  sys: { foamers: FoamerSystem; world: RAPIER.World; darts: DartSystem },
  eye: THREE.Vector3,
) {
  for (const f of sys.foamers.list) {
    for (const part of f.parts.values()) {
      for (;;) {
        part.mesh.update();
        if (!part.mesh.busy) break;
        await new Promise((x) => setTimeout(x, 0));
      }
    }
  }
  for (let i = 0; i < 5; i++) {
    sys.darts.update(DT);
    sys.foamers.update(DT, eye);
    sys.world.step();
  }
}
function run(
  sys: { darts: DartSystem; world: RAPIER.World; foamers: FoamerSystem },
  eye: THREE.Vector3,
  steps: number,
  stop: () => boolean,
) {
  for (let i = 0; i < steps; i++) {
    sys.darts.update(DT);
    sys.foamers.update(DT, eye);
    sys.world.step();
    if (stop()) return;
  }
}
const TAP: BlasterControls = { fireHeld: true, firePressed: true, reloadPressed: false };

describe("PT-03 stage 2: the slug punches through", () => {
  it("1. the B01 slug fires b01slug (pierce 1); the B02 heavy keeps the plain slug (pierce 0)", () => {
    const mods = (blastersJson as {
      B01: { mods: { slug: { dartType: string } } };
      B02: { mods: { heavy: { dartType: string } } };
    })!;
    expect(mods.B01.mods.slug.dartType).toBe("b01slug");
    expect(mods.B02.mods.heavy.dartType).toBe("slug");
    expect(dartTuning.types.b01slug.pierce).toBe(1);
    expect(dartTuning.types.slug.pierce).toBe(0);
  });
  it("2. a b01slug dart meets the first Foamer and then the one behind it, and no further", async () => {
    const r = arena();
    const eye = new THREE.Vector3(0, 1.6, 30);
    const first = r.foamers.spawn(new THREE.Vector3(0, 0, -4), eye, "F01")!;
    const back = r.foamers.spawn(new THREE.Vector3(0, 0, -5.75), eye, "F01")!;
    const third = r.foamers.spawn(new THREE.Vector3(0, 0, -7.25), eye, "F01")!;
    // Keep the whole line up for the run, so the pass-through is measured
    // against live bodies, not ragdolls folding into the dart's path: the
    // head cannot break and the rigs are padded well past the slug's 6.
    for (const f of [first, back, third]) {
      f.parts.get("head")!.hp = 99;
      f.health = 30;
    }
    await settle(r, eye);
    // Every body of each Foamer, keyed to its owner, so a hit counts by
    // Foamer whichever part it lands on.
    const ownerOf = new Map<number, 0 | 1 | 2>();
    [first, back, third].forEach((f, idx) => {
      ownerOf.set(f.root.handle, idx as 0 | 1 | 2);
      for (const p of f.parts.values()) ownerOf.set(p.body.handle, idx as 0 | 1 | 2);
    });
    const hits: number[] = [];
    const prev = r.darts.onHit;
    r.darts.onHit = (hit) => {
      const handle = hit.collider.parent()?.handle;
      if (handle !== undefined && ownerOf.has(handle)) hits.push(ownerOf.get(handle)!);
      prev(hit);
    };
    const b = new Blaster(
      resolveSpec("B01", ["slug"]), r.darts, () => new THREE.Vector3(0, 1.1, -1), lcg(5),
    );
    expect(b.spec.dartType).toBe("b01slug");
    b.mag = 1;
    b.update(DT, TAP, AIM);
    run(r, eye, 60 * 3, () => r.darts.stats().flying === 0);
    // Met the first, then carried on to the one right behind it.
    expect(hits.indexOf(0), "met the first Foamer").toBeGreaterThanOrEqual(0);
    expect(hits.indexOf(0), "first hit is on the first Foamer").toBeLessThan(hits.indexOf(1));
    expect(hits).toContain(1);
    // Pierce is one: it does not reach the third.
    expect(hits).not.toContain(2);
  });
});
