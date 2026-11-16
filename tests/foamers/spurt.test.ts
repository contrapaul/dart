import { beforeAll, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { linearColorTable, materialId } from "../../src/voxel/materials";
import { greedyMesh } from "../../src/voxel/mesher";
import type { Mesher } from "../../src/voxel/pieces";
import { DebrisSystem } from "../../src/voxel/debris";
import { coneDirection } from "../../src/voxel/spray";
import { DartSystem } from "../../src/weapons/darts";
import { DartImpacts, type VoxelTarget } from "../../src/weapons/impacts";
import { FoamerSystem, specFor } from "../../src/foamers/foamers";
import { spurtsFoam } from "../../src/foamers/spurt";
import type { Foamer } from "../../src/foamers/foamer";
import { makeRng } from "../../src/audio/synth";
import spurt from "../../data/spurt.json";
import destruction from "../../data/destruction.json";

// FX-spurt (Paul, 2026-11-16): a dart on a Foamer's own foam throws a quick
// spurt of foam-core cubes out of the hit point. A hit on armour, a shield
// or the Foamer's weapon throws none. The spurt has a hard cap of its own
// under the debris ring's.

const DT = 1 / 60;
const PLAYER = new THREE.Vector3(0, 1.6, 6);

function fakeMesher(): Mesher {
  const colors = linearColorTable();
  return { mesh: (padded) => Promise.resolve(greedyMesh(padded, colors)) };
}

interface Cube { at: THREE.Vector3; vel: THREE.Vector3; size: number; mat: number; life?: number }

function rig() {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.createCollider(RAPIER.ColliderDesc.cuboid(40, 0.5, 40).setTranslation(0, -0.5, 0));
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  const ignore = world.createCollider(
    RAPIER.ColliderDesc.capsule(0.5, 0.3).setTranslation(0, 0, 200),
    body,
  );
  const darts = new DartSystem(new THREE.Scene(), world, RAPIER, ignore);
  const debris = new DebrisSystem(RAPIER, world);
  const targets: VoxelTarget[] = [];
  const foamers = new FoamerSystem(RAPIER, world, fakeMesher(), debris, darts, targets);
  new DartImpacts(darts, debris, targets);
  // Every cube the spurt asks the debris ring for, copied as it is asked
  // (the system passes scratch vectors).
  const cubes: Cube[] = [];
  const real = debris.sprayCube.bind(debris);
  vi.spyOn(debris, "sprayCube").mockImplementation((at, vel, size, mat, life) => {
    cubes.push({ at: at.clone(), vel: vel.clone(), size, mat, life });
    real(at, vel, size, mat, life);
  });
  return { world, darts, debris, foamers, cubes };
}

type Rig = ReturnType<typeof rig>;

/** One dart on one part through the system's own hit path, on the part's
 *  +z face (or its -z face from behind). Returns the hit point. */
function dartOnPart(
  r: Rig, f: Foamer, id: string, fromFront = true, speed = 25,
): THREE.Vector3 {
  const part = f.parts.get(id)!;
  const probe = r.world.createCollider(
    RAPIER.ColliderDesc.cuboid(0.1, 0.1, 0.1).setTranslation(0.2, 0.2, 0.2),
    part.body,
  );
  const size = part.spec.size;
  const point = part.voxelToWorld(
    new THREE.Vector3(size[0] / 2, size[1] / 2, fromFront ? size[2] - 0.5 : 0.5),
  );
  r.darts.onHit({
    point: point.clone(),
    normal: new THREE.Vector3(0, 0, fromFront ? 1 : -1),
    direction: new THREE.Vector3(0, 0, fromFront ? -1 : 1),
    speed,
    type: "standard",
    collider: probe,
    material: null,
    shot: null,
  });
  return point;
}

function spawn(r: Rig, type: string): Foamer {
  return r.foamers.spawn(new THREE.Vector3(0, 0, 0), PLAYER, type)!;
}

function bodyId(f: Foamer): string {
  for (const p of f.parts.values()) if (p.spec.kind === "body") return p.spec.id;
  throw new Error("no body part");
}

beforeAll(async () => {
  await RAPIER.init();
});

describe("FX-spurt: a dart on a Foamer's own foam", () => {
  it("throws the data's count of foam-core cubes out of the hit point", () => {
    const r = rig();
    const f = spawn(r, "F08");
    const point = dartOnPart(r, f, bodyId(f));
    expect(r.cubes.length).toBe(spurt.count);
    const cos = Math.cos((spurt.coneDegrees * Math.PI) / 180);
    for (const c of r.cubes) {
      expect(c.at.distanceTo(point), "at the hit point").toBeLessThanOrEqual(spurt.cubeSizeMetres);
      const speed = c.vel.length();
      expect(speed).toBeGreaterThanOrEqual(spurt.speedMin - 1e-6);
      expect(speed).toBeLessThanOrEqual(spurt.speedMax + 1e-6);
      // Out along the hit normal (+z here), inside the cone.
      expect(c.vel.z / speed, "inside the cone around the normal").toBeGreaterThanOrEqual(cos - 1e-6);
      expect(c.size).toBe(spurt.cubeSizeMetres);
      expect(c.mat, "foam only: the core colour").toBe(materialId("foam-core"));
      expect(c.life).toBe(spurt.lifeSeconds);
    }
    expect(r.foamers.stats.spurtCubes).toBe(spurt.count);
  });

  it("spurts from a head, an arm and a leg too", () => {
    for (const kind of ["head", "arm", "leg"]) {
      const r = rig();
      const f = spawn(r, "F08");
      const part = [...f.parts.values()].find((p) => p.spec.kind === kind)!;
      dartOnPart(r, f, part.spec.id);
      expect(r.cubes.length, kind).toBe(spurt.count);
    }
  });

  it("a dart too slow to hurt throws none", () => {
    const r = rig();
    const f = spawn(r, "F08");
    dartOnPart(r, f, bodyId(f), true, specFor("F08").minDamageSpeed - 1);
    expect(r.cubes.length).toBe(0);
  });

  it("a hit on the Foamer's weapon throws none", () => {
    const cases: [string, string][] = [
      ["F01", "club"], ["F07", "sword"], ["F08", "launcherL"], ["F08", "launcherR"],
      ["F11", "maceHead"], ["F13", "wand"],
    ];
    for (const [type, id] of cases) {
      const r = rig();
      const f = spawn(r, type);
      expect(f.parts.has(id), `${type} has a ${id}`).toBe(true);
      dartOnPart(r, f, id);
      expect(r.cubes.length, `${type} ${id}`).toBe(0);
    }
  });

  it("a hit on a shield throws none, from the front or from behind", () => {
    for (const type of ["F04", "F11"]) {
      for (const fromFront of [true, false]) {
        const r = rig();
        const f = spawn(r, type);
        dartOnPart(r, f, "shield", fromFront);
        expect(r.cubes.length, `${type} shield, front ${fromFront}`).toBe(0);
      }
    }
  });

  it("a hit on an armour plate throws none", () => {
    for (const id of ["chest", "brow"]) {
      const r = rig();
      const f = spawn(r, "F05");
      dartOnPart(r, f, id);
      expect(r.cubes.length, `F05 ${id}`).toBe(0);
    }
  });

  it("the rule: body kinds and the listed soft parts, never a plate or a weapon", () => {
    const r = rig();
    const part = (type: string, id: string) => spawn(r, type).parts.get(id)!.spec;
    expect(spurtsFoam(specFor("F01"), part("F01", "body"))).toBe(true);
    expect(spurtsFoam(specFor("F05"), part("F05", "weakpoint")), "the soft spot").toBe(true);
    expect(spurtsFoam(specFor("F05"), part("F05", "chest"))).toBe(false);
    expect(spurtsFoam(specFor("F04"), part("F04", "shield"))).toBe(false);
    expect(spurtsFoam(specFor("F04"), part("F04", "boss")), "the shield's boss").toBe(false);
    expect(spurtsFoam(specFor("F11"), part("F11", "shieldBoss"))).toBe(false);
    expect(spurtsFoam(specFor("F11"), part("F11", "helm")), "worn armour").toBe(false);
    expect(spurtsFoam(specFor("F09"), part("F09", "gun")), "a turret is a weapon").toBe(false);
    expect(spurtsFoam(specFor("F01"), part("F01", "club"))).toBe(false);
  });

  it("the cap holds: never more live spurt cubes than maxLive", () => {
    const r = rig();
    const hits = Math.ceil(spurt.maxLive / spurt.count) + 4;
    const target = spawn(r, "F08");
    for (let i = 0; i < hits; i++) {
      target.health = target.maxHealth; // so it does not die under the test
      dartOnPart(r, target, bodyId(target));
    }
    expect(r.cubes.length, "the hits asked for more than the cap").toBe(spurt.maxLive);
    expect(r.debris.live).toBeLessThanOrEqual(destruction.debris.max);
    // Once those cubes have lived out their life there is room again.
    const steps = Math.ceil(spurt.lifeSeconds / DT) + 1;
    for (let i = 0; i < steps; i++) {
      r.foamers.update(DT, PLAYER);
      r.debris.update(DT);
    }
    target.health = target.maxHealth;
    dartOnPart(r, target, bodyId(target));
    expect(r.cubes.length).toBe(spurt.maxLive + spurt.count);
  });
});

describe("FX-spurt: the debris ring's own life per cube", () => {
  it("a cube with a short life leaves early; one without keeps the ring's lifetime", () => {
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    const debris = new DebrisSystem(RAPIER, world);
    const at = new THREE.Vector3(0, 1, 0);
    const vel = new THREE.Vector3(0, 1, 0);
    debris.sprayCube(at, vel, 0.05, 1, 0.5);
    debris.sprayCube(at, vel, 0.05, 1);
    expect(debris.live).toBe(2);
    for (let i = 0; i < 31; i++) debris.update(DT);
    expect(debris.live, "the short one is gone at 0.5 s").toBe(1);
    const rest = Math.ceil(destruction.debris.lifetime / DT);
    for (let i = 0; i < rest; i++) debris.update(DT);
    expect(debris.live).toBe(0);
  });
});

describe("the shared spray cone", () => {
  it("gives unit directions inside the cone, the same for the same seed", () => {
    const axis = new THREE.Vector3(0.3, 0.9, -0.2).normalize();
    const coneRad = (20 * Math.PI) / 180;
    const a = makeRng(7), b = makeRng(7);
    const out = new THREE.Vector3(), again = new THREE.Vector3();
    for (let i = 0; i < 200; i++) {
      coneDirection(out, axis, coneRad, a);
      expect(out.length()).toBeCloseTo(1, 6);
      expect(out.dot(axis)).toBeGreaterThanOrEqual(Math.cos(coneRad) - 1e-6);
      expect(coneDirection(again, axis, coneRad, b).equals(out)).toBe(true);
    }
  });

  it("works on a straight up axis", () => {
    const out = coneDirection(new THREE.Vector3(), new THREE.Vector3(0, 1, 0), 0.3, makeRng(3));
    expect(out.length()).toBeCloseTo(1, 6);
    expect(out.y).toBeGreaterThanOrEqual(Math.cos(0.3) - 1e-6);
  });
});
