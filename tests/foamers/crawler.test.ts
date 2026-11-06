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
import { FoamerSystem } from "../../src/foamers/foamers";
import { ProjectileSystem } from "../../src/foamers/projectiles";
import { Director } from "../../src/ai/director";

// GAME-10g: the F09 Crawler, the four-legged turret walker. Stage 1 is the
// look and the type: the palette in the rig, and a keep-distance ranged type
// on the F02 brain. Stage 2 adds the pellet stream, the gun weak point and
// the stomp.

const DT = 1 / 60;
const TYPE = foamerData.types.F09;

function fakeMesher(): Mesher {
  const colors = linearColorTable();
  return { mesh: (padded) => Promise.resolve(greedyMesh(padded, colors)) };
}

function rig() {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.createCollider(RAPIER.ColliderDesc.cuboid(40, 0.5, 40).setTranslation(0, -0.5, 0));
  const playerBody = world.createRigidBody(
    RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, 1, 200),
  );
  const playerCollider = world.createCollider(
    RAPIER.ColliderDesc.capsule(0.55, 0.35).setTranslation(0, 0, 0),
    playerBody,
  );
  const ignore = world.createCollider(
    RAPIER.ColliderDesc.capsule(0.5, 0.3).setTranslation(0, 0, 400),
    world.createRigidBody(RAPIER.RigidBodyDesc.fixed()),
  );
  const darts = new DartSystem(new THREE.Scene(), world, RAPIER, ignore);
  const debris = new DebrisSystem(RAPIER, world);
  const targets: VoxelTarget[] = [];
  const foamers = new FoamerSystem(RAPIER, world, fakeMesher(), debris, darts, targets);
  new DartImpacts(darts, debris, targets);
  const projectiles = new ProjectileSystem(RAPIER, world, debris, playerCollider, foamers);
  foamers.projectiles = projectiles;
  foamers.director = new Director("normal");
  world.step();
  return { world, darts, foamers, projectiles };
}

type Rig = ReturnType<typeof rig>;

function tick(r: Rig, player: THREE.Vector3) {
  r.darts.update(DT);
  r.foamers.update(DT, player);
  r.projectiles.update(DT);
  r.world.step();
}

beforeAll(async () => {
  await RAPIER.init();
});

describe("the F09 Crawler type (GAME-10g stage 1)", () => {
  it("1. its data: rig, health, the keep-distance distances, its two attacks", () => {
    expect(TYPE.rig).toBe("F09");
    expect(TYPE.turnRate).toBeGreaterThan(0);
    expect(TYPE.throwRangeMetres).toBeGreaterThan(TYPE.preferredDistanceMetres);
    expect(TYPE.preferredDistanceMetres).toBeGreaterThanOrEqual(12);
    expect(TYPE.preferredDistanceMetres).toBeLessThan(TYPE.throwRangeMetres);
    expect(TYPE.retreatDistanceMetres).toBeLessThan(TYPE.preferredDistanceMetres);
    const stream = TYPE.attacks.find((a) => a.id === "stream")!;
    const stomp = TYPE.attacks.find((a) => a.id === "stomp")!;
    expect(stream.token).toBe("ranged");
    expect(stream.damage, "a pellet hurts little").toBeLessThanOrEqual(3);
    expect(stomp.token).toBe("melee");
    expect(stomp.damage).toBe(8);
  });

  it("2. its rig palette: orange body, purple legs, lime gun", () => {
    expect(TYPE.attacks.length).toBe(2);
    const rig = (rigData.rigs as {
      id: string; health: number; movement: string; material: string;
      parts: { id: string; kind: string; material?: string }[];
    }[]).find((r) => r.id === "F09")!;
    expect(rig.health).toBe(40);
    expect(rig.movement).toBe("spider");
    expect(rig.material).toBe("foam-orange-deep");
    expect(rig.parts.find((p: { id: string }) => p.id === "gun")!.material).toBe("foam-lime");
    for (const p of rig.parts) {
      if (p.kind === "leg") expect(p.material, `${p.id} is purple`).toBe("foam-purple-deep");
    }
  });

  it("3. the range's type choice spawns it and it keeps its distance", () => {
    const r = rig();
    const player = new THREE.Vector3(0, 1.6, 0);
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 18), player, "F09")!;
    expect(f.spec.rig).toBe("F09");
    expect(f.maxHealth).toBe(40);
    for (let i = 0; i < 60 * 20; i++) tick(r, player);
    const d = Math.hypot(player.x - f.centre.x, player.z - f.centre.z);
    expect(d, "it stopped on its ring, not at bonking range").toBeGreaterThan(8);
    expect(d).toBeLessThan(TYPE.throwRangeMetres + 1);
  });

  it("4. every other type is untouched", () => {
    const r = rig();
    const player = new THREE.Vector3(0, 1.6, 0);
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 12), player, "F02")!;
    expect(f.spec.attacks[0].id).toBe("throw");
    const g = r.foamers.spawn(new THREE.Vector3(3, 0, 12), player, "F01")!;
    expect(g.spec.rig).toBe("F01");
  });
});
