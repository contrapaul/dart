import { describe, expect, it } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { linearColorTable } from "../../src/voxel/materials";
import { greedyMesh } from "../../src/voxel/mesher";
import type { Mesher } from "../../src/voxel/pieces";
import { DebrisSystem } from "../../src/voxel/debris";
import { DartSystem } from "../../src/weapons/darts";
import { FoamerSystem } from "../../src/foamers/foamers";
import rigData from "../../data/foamer-rigs.json";

// A leg is a part of kind leg whose parent is not itself a leg (a thigh,
// not a shin), wherever it hangs: the F11 hangs its legs from a hips part,
// and it must not read legless (and walk at the no-legs speed) whole.

function fakeMesher(): Mesher {
  const colors = linearColorTable();
  return { mesh: (padded) => Promise.resolve(greedyMesh(padded, colors)) };
}

describe("legs(): every rig with legs starts with them", () => {
  it("each type with leg parts starts on its feet at full speed", async () => {
    await RAPIER.init();
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    const debris = new DebrisSystem(RAPIER, world);
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    const ignore = world.createCollider(RAPIER.ColliderDesc.ball(0.1).setTranslation(0, 0, 200), body);
    const darts = new DartSystem(new THREE.Scene(), world, RAPIER, ignore);
    const foamers = new FoamerSystem(RAPIER, world, fakeMesher(), debris, darts, []);
    const rigs = (rigData as { rigs: { id: string, parts: { kind?: string }[] }[] }).rigs;
    let x = 0;
    for (const r of rigs) {
      if (!r.parts.some((p) => p.kind === "leg")) continue;
      const f = foamers.spawn(new THREE.Vector3(x, 0, 0), new THREE.Vector3(0, 0, 1), r.id);
      x += 6;
      if (!f) continue;
      expect(f.legs().length, r.id).toBeGreaterThan(0);
      expect(f.legs(), r.id).toEqual(f.startLegs());
    }
  });
});
