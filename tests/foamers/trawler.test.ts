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

// GAME-10h: the F08 Trawler, the slow tank that fires walls of foam balls
// with a gap. Stage 1 is the look and the type: the palette in the rig, and
// a keep-distance ranged type on the F02 brain. Stage 2 adds the wall, the
// launcher weak points and the stomp.

const DT = 1 / 60;
const TYPE = foamerData.types.F08;

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

describe("the F08 Trawler type (GAME-10h stage 1)", () => {
  it("1. its data: rig, health, the keep-distance distances, its two attacks", () => {
    expect(TYPE.rig).toBe("F08");
    expect(TYPE.turnRate).toBeGreaterThan(0);
    expect(TYPE.throwRangeMetres).toBeGreaterThan(TYPE.preferredDistanceMetres);
    expect(TYPE.preferredDistanceMetres, "it keeps about 12 m").toBeCloseTo(12, 0);
    expect(TYPE.preferredDistanceMetres).toBeLessThan(TYPE.throwRangeMetres);
    expect(TYPE.throwRangeMetres, "it fires from up to 20 m").toBeLessThanOrEqual(20);
    expect(TYPE.retreatDistanceMetres).toBeLessThan(TYPE.preferredDistanceMetres);
    const wall = TYPE.attacks.find((a) => a.id === "wall")!;
    const stomp = TYPE.attacks.find((a) => a.id === "stomp")!;
    expect(wall.token).toBe("ranged");
    expect(stomp.token).toBe("melee");
    expect(stomp.damage).toBe(12);
  });

  it("2. its rig palette: deep lime body, purple shields, orange launchers", () => {
    expect(TYPE.attacks.length).toBe(2);
    const rig = (rigData.rigs as {
      id: string; health: number; movement: string; material: string;
      parts: { id: string; kind: string; material?: string; nubMaterial?: string }[];
    }[]).find((r) => r.id === "F08")!;
    expect(rig.health).toBe(80);
    expect(rig.movement).toBe("tank");
    expect(rig.material, "deep lime body and head").toBe("foam-lime-deep");
    expect(rig.parts.find((p) => p.id === "body")!.nubMaterial, "shoulder plates").toBe("foam-purple-deep");
    expect(rig.parts.find((p) => p.id === "drum")!.material, "the ammo drum").toBe("foam-purple-deep");
    for (const id of ["launcherL", "launcherR"])
      expect(rig.parts.find((p) => p.id === id)!.material, `${id} is orange`).toBe("foam-orange");
    for (const p of rig.parts) {
      if (p.kind === "leg") expect(p.material ?? rig.material, `${p.id} is lime`).toBe("foam-lime-deep");
    }
  });

  it("3. the range's type choice spawns it and it keeps its distance", () => {
    const r = rig();
    const player = new THREE.Vector3(0, 1.6, 0);
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 18), player, "F08")!;
    expect(f.spec.rig).toBe("F08");
    expect(f.maxHealth).toBe(80);
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
