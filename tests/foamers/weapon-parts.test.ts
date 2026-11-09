import { beforeAll, describe, expect, it } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { linearColorTable } from "../../src/voxel/materials";
import { greedyMesh } from "../../src/voxel/mesher";
import type { Mesher } from "../../src/voxel/pieces";
import { DebrisSystem } from "../../src/voxel/debris";
import { DartSystem } from "../../src/weapons/darts";
import { DartImpacts, type VoxelTarget } from "../../src/weapons/impacts";
import { FoamerSystem, specFor } from "../../src/foamers/foamers";
import type { Foamer } from "../../src/foamers/foamer";
import type { DartTypeName } from "../../src/weapons/darts";

// PT-07 (Paul, 2026-11-09): a hit on a weapon part wears that part only,
// never the Foamer's health, and the Seawall's shield turns darts from the
// front but wears down and breaks off after enough damage.

function fakeMesher(): Mesher {
  const colors = linearColorTable();
  return { mesh: (padded) => Promise.resolve(greedyMesh(padded, colors)) };
}

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
  return { world, darts, foamers };
}

type Rig = ReturnType<typeof rig>;

/**
 * One dart on one part through the system's own hit path. The dart comes
 * from the front (`fromFront`): the Seawall faces +z in these tests, so a
 * dart travelling -z meets its front and the arc armour covers it.
 */
function dartOnPart(
  r: Rig, f: Foamer, id: string, type: DartTypeName, fromFront: boolean,
): void {
  const part = f.parts.get(id)!;
  const probe = r.world.createCollider(
    RAPIER.ColliderDesc.cuboid(0.1, 0.1, 0.1).setTranslation(0.2, 0.2, 0.2),
    part.body,
  );
  const size = part.spec.size;
  r.darts.onHit({
    point: part.voxelToWorld(new THREE.Vector3(size[0] / 2, size[1] / 2, size[2] - 0.5)),
    normal: new THREE.Vector3(0, 0, fromFront ? 1 : -1),
    direction: new THREE.Vector3(0, 0, fromFront ? -1 : 1),
    speed: 25,
    type,
    collider: probe,
    material: null,
    shot: null,
  });
}

/** Fire front darts at a part until it is gone; return how many it took. */
function dartsToBreak(r: Rig, f: Foamer, id: string, limit: number): number {
  let n = 0;
  while (f.parts.has(id) && n < limit) {
    dartOnPart(r, f, id, "standard", true);
    n++;
  }
  return n;
}

const PLAYER = new THREE.Vector3(0, 1.6, 6);

beforeAll(async () => {
  await RAPIER.init();
});

describe("PT-07: weapons do not count toward health", () => {
  it("the weapon kind takes no share of a hit off the Foamer's health", () => {
    const kinds = specFor("F01").partDamage.kinds;
    expect(kinds.weapon.total).toBe(0);
    expect(kinds.weapon.hit, "it still wears its own part").toBe(1);
    expect(kinds.weapon.hpShare, "it still has its own health").toBeGreaterThan(0);
  });

  it("an F01 with its club shot off still has full health", () => {
    const r = rig();
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 0), PLAYER, "F01")!;
    const club = f.parts.get("club")!;
    expect(club.spec.kind).toBe("weapon");
    const before = f.health;
    const n = dartsToBreak(r, f, "club", 40);
    expect(n, "it took darts to lose the club").toBeGreaterThan(0);
    expect(f.parts.has("club"), "the club broke off").toBe(false);
    expect(f.health, "none of it came off the health").toBe(before);
    expect(f.health).toBe(f.maxHealth);
  });

  it("a club taking more damage than the F01's health does not kill it", () => {
    const r = rig();
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 0), PLAYER, "F01")!;
    expect(specFor("F01").damage.precisionHeavy, "more than the F01's health")
      .toBeGreaterThan(f.maxHealth);
    dartOnPart(r, f, "club", "precisionHeavy", false);
    expect(f.health, "the whole hit went into the club").toBe(f.maxHealth);
    expect(f.state, "the F01 is not dying").not.toBe("down");
    expect(f.parts.has("club"), "the club is gone").toBe(false);
  });

  it("an F07 with its sword shot off still has full health and punches", () => {
    const r = rig();
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 0), PLAYER, "F07")!;
    const sword = f.parts.get("sword")!;
    expect(sword.spec.kind).toBe("weapon");
    const n = dartsToBreak(r, f, "sword", 60);
    expect(n).toBeGreaterThan(0);
    expect(f.parts.has("sword")).toBe(false);
    expect(f.health, "the sword's damage never came off the health").toBe(f.maxHealth);
    // With the sword gone it fights with the fists: chooseAttack still
    // answers, so it is not left with no attack at all.
    expect(f.attack() === undefined).toBe(false);
  });
});
