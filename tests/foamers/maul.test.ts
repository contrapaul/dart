import { beforeAll, describe, expect, it } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import foamerData from "../../data/foamers.json";
import rigData from "../../data/foamer-rigs.json";
import { linearColorTable } from "../../src/voxel/materials";
import { greedyMesh } from "../../src/voxel/mesher";
import type { Mesher } from "../../src/voxel/pieces";
import { DebrisSystem } from "../../src/voxel/debris";
import { DartSystem } from "../../src/weapons/darts";
import { DartImpacts, type VoxelTarget } from "../../src/weapons/impacts";
import { FoamerSystem, specFor } from "../../src/foamers/foamers";
import { rigHeight, type RigSpec } from "../../src/foamers/rig";
import type { Foamer } from "../../src/foamers/foamer";

// GAME-10n: the F14 maul brawler. Stage 1 is the rig and the plain maul
// swing; the combo and the parryable smash arrive in stage 2.

const DT = 1 / 60;
const SPEC = specFor("F14");
const RIGS = rigData.rigs as unknown as (RigSpec & { health: number })[];
const RIG = RIGS.find((r) => r.id === "F14")!;

function fakeMesher(): Mesher {
  const colors = linearColorTable();
  return { mesh: (padded) => Promise.resolve(greedyMesh(padded, colors)) };
}

function rig() {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.createCollider(RAPIER.ColliderDesc.cuboid(40, 0.5, 40).setTranslation(0, -0.5, 0));
  const ignore = world.createCollider(
    RAPIER.ColliderDesc.capsule(0.5, 0.3).setTranslation(0, 0, 200),
    world.createRigidBody(RAPIER.RigidBodyDesc.fixed()),
  );
  const darts = new DartSystem(new THREE.Scene(), world, RAPIER, ignore);
  const debris = new DebrisSystem(RAPIER, world);
  const targets: VoxelTarget[] = [];
  const foamers = new FoamerSystem(RAPIER, world, fakeMesher(), debris, darts, targets);
  new DartImpacts(darts, debris, targets);
  world.step();
  const sounds: string[] = [];
  foamers.onSound = (kind) => sounds.push(kind);
  return { world, darts, foamers, sounds };
}

type Rig = ReturnType<typeof rig>;

function tick(r: Rig, player: THREE.Vector3) {
  r.darts.update(DT);
  r.foamers.update(DT, player);
  r.world.step();
}

function run(r: Rig, player: THREE.Vector3, done: () => boolean, steps: number) {
  for (let i = 0; i < steps && !done(); i++) tick(r, player);
}

function mauler(r: Rig, metres: number, player: THREE.Vector3): Foamer {
  const f = r.foamers.spawn(new THREE.Vector3(0, 0, player.z + metres), player, "F14")!;
  return f;
}

beforeAll(async () => {
  await RAPIER.init();
});

describe("the F14 maul brawler (GAME-10n stage 1)", () => {
  it("1. the data file holds the rig and the type", () => {
    expect(RIG.tier).toBe("Elite");
    expect(RIG.speed).toBe(1.3);
    expect(RIG.health).toBe(70);
    expect(RIG.movement).toBe("combo");
    expect(SPEC.rig).toBe("F14");
    expect(SPEC.turnRate).toBe(2);
    expect(SPEC.attackRange).toBe(2.2);
    expect(foamerData.types).toHaveProperty("F14");
  });

  it("2. it is wider than the F11 and about a head shorter than it", () => {
    const seawall = RIGS.find((r) => r.id === "F11")!;
    expect(rigHeight(RIG)).toBeGreaterThan(2.4);
    expect(rigHeight(RIG)).toBeLessThan(3.2);
    expect(rigHeight(RIG)).toBeLessThan(rigHeight(seawall));
    // Wider: the shoulders stand further out than the Seawall's.
    const span = (r: RigSpec) => {
      const left = r.parts.find((q) => q.id === "armL");
      const right = r.parts.find((q) => q.id === "armR");
      return (right?.at?.[0] ?? 0) - (left?.at?.[0] ?? 0);
    };
    expect(span(RIG)).toBeGreaterThan(span(seawall));
  });

  it("3. both legs carry the weak point and the feet are orange", () => {
    const wp = (SPEC as { weakpoint?: { parts: string[]; damage: number } }).weakpoint;
    expect(wp?.parts).toEqual(["legL", "legR"]);
    expect(wp?.damage).toBe(2);
    for (const id of ["legL", "legR", "footL", "footR"]) {
      const p = RIG.parts.find((q) => q.id === id)!;
      expect(p.material, id).toContain("foam-orange");
    }
  });

  it("4. it walks in and swings the maul in reach", () => {
    const r = rig();
    const player = new THREE.Vector3(0, 1.6, 0);
    const f = mauler(r, 6, player);
    run(r, player, () => f.state === "windup", 60 * 20);
    expect(f.state).toBe("windup");
    expect(f.attack()!.id).toBe("bonk");
    run(r, player, () => f.state === "recover", 60 * 3);
    expect(f.state).toBe("recover");
  });

  it("5. a dart on a leg costs it twice what the same dart costs an arm", () => {
    const r = rig();
    const player = new THREE.Vector3(0, 1.6, 0);
    const dart = (f: Foamer, id: string): number => {
      const part = f.parts.get(id)!;
      const probe = r.world.createCollider(
        RAPIER.ColliderDesc.cuboid(0.1, 0.1, 0.1).setTranslation(0.2, 0.2, 0.2),
        part.body,
      );
      const size = part.spec.size;
      const before = f.health;
      r.darts.onHit({
        point: part.voxelToWorld(new THREE.Vector3(size[0] / 2, size[1] / 2, size[2] - 0.5)),
        normal: new THREE.Vector3(0, 0, 1),
        direction: new THREE.Vector3(0, 0, -1),
        speed: 25,
        type: "standard",
        collider: probe,
        material: null,
        shot: null,
      });
      return before - f.health;
    };
    const onArm = dart(mauler(r, 6, player), "armL");
    const onLeg = dart(mauler(r, 6, player), "legL");
    expect(onArm).toBeGreaterThan(0);
    expect(onLeg).toBeCloseTo(onArm * 2, 6);
  });
});
