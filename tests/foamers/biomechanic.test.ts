import { beforeAll, describe, expect, it } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import rigData from "../../data/foamer-rigs.json";
import { linearColorTable, materialId } from "../../src/voxel/materials";
import { greedyMesh } from "../../src/voxel/mesher";
import type { Mesher } from "../../src/voxel/pieces";
import { DebrisSystem } from "../../src/voxel/debris";
import { VoxelVolume } from "../../src/voxel/chunk";
import { DartSystem } from "../../src/weapons/darts";
import { DartImpacts, type VoxelTarget } from "../../src/weapons/impacts";
import { FoamerSystem, specFor } from "../../src/foamers/foamers";
import type { Foamer } from "../../src/foamers/foamer";
import { Director } from "../../src/ai/director";
import { NavGrid } from "../../src/ai/nav-grid";
import { buildPartVolume, restMotion, solvePose, type PartSpec, type RigSpec } from "../../src/foamers/rig";
import { weakpointOf } from "../../src/foamers/pellet";

// GAME-10l stage 1: the F13 Biomechanic's look and type. The palette with a
// hood over the head, the tank on the back and the wand in the right hand,
// and the tank as the weak point. The healing stream and the spray are
// stages 2 and 3.

const DT = 1 / 60;
const HALF = 20;
const RIG = rigData.rigs.find((entry) => entry.id === "F13")! as unknown as RigSpec & { health: number };
const PLAYER = new THREE.Vector3(0, 0, 18);

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
  // A brain needs the director and, for its path, a grid (the F10's rig).
  const director = new Director("normal");
  const grid = new NavGrid(RAPIER, world, { minX: -HALF, maxX: HALF, minZ: -HALF, maxZ: HALF });
  foamers.director = director;
  foamers.navGrid = grid;
  foamers.spawnState = "alert";
  world.step();
  grid.bake();
  return { world, darts, foamers, director, grid };
}

function tick(r: ReturnType<typeof rig>, player: THREE.Vector3) {
  r.darts.update(DT);
  r.foamers.update(DT, player);
  r.world.step();
}

async function settleParts(r: ReturnType<typeof rig>, f: Foamer) {
  for (const part of f.parts.values()) {
    part.mesh.update();
    await new Promise((res) => setTimeout(res, 0));
    r.world.step();
  }
}

/** A part's voxels, built the way the game builds them. */
function volumeOf(part: PartSpec): VoxelVolume {
  const volume = new VoxelVolume(RIG.voxelSize);
  buildPartVolume(volume, part, RIG.material);
  return volume;
}

const partOf = (id: string) => RIG.parts.find((p) => p.id === id)!;

describe("the Biomechanic's look (GAME-10l stage 1)", () => {
  it("1. wears the CONTENT-PLAN 3.3 palette, with a hood over the head", () => {
    const colour = (id: string) => partOf(id).material ?? RIG.material;
    expect(colour("body")).toBe("foam-orange");
    expect(colour("armL")).toBe("foam-orange");
    expect(colour("foreArmR")).toBe("foam-orange");
    expect(colour("hood")).toBe("foam-purple");
    expect(colour("tank")).toBe("foam-lime");
    expect(colour("antenna")).toBe("foam-purple");
    expect(colour("wand")).toBe("foam-purple");
    // The wand's tip stays the core colour (the spray's foam).
    expect(partOf("wand").tip?.material).toBe("foam-core");
    // A hood is a detail on the head, so it moves with it.
    expect(partOf("hood").parent).toBe("head");
    expect(partOf("hood").shape).toBe("ellipsoid");
  });

  it("2. the hood covers the crown and leaves the eyes showing", () => {
    const head = partOf("head"), hood = partOf("hood");
    const headV = volumeOf(head), hoodV = volumeOf(hood);
    const pose = solvePose(RIG, new THREE.Vector3(), 0, restMotion(), new Map());
    // A head voxel in hood-space: the hood's own box coordinates.
    const toHood = (x: number, y: number, z: number) => new THREE.Vector3(x + 0.5, y + 0.5, z + 0.5)
      .multiplyScalar(RIG.voxelSize)
      .applyMatrix4(pose.get("head")!)
      .applyMatrix4(pose.get("hood")!.clone().invert())
      .divideScalar(RIG.voxelSize);
    const hoodAt = (x: number, y: number, z: number) => hoodV.get(Math.round(x), Math.round(y), Math.round(z)) !== 0;
    let crown = 0, under = 0;
    for (let y = Math.floor(head.size[1] / 2); y < head.size[1]; y++)
      for (let x = 0; x < head.size[0]; x++)
        for (let z = 0; z < head.size[2]; z++) {
          if (!headV.get(x, y, z) || headV.get(x, y + 1, z)) continue;
          crown++;
          const q = toHood(x, y, z);
          for (let hy = Math.round(q.y) + 1; hy < hood.size[1] + 3; hy++)
            if (hoodAt(q.x, hy, q.z)) { under++; break; }
        }
    expect(crown, "the head has a crown to cover").toBeGreaterThan(0);
    expect(under / crown, "the hood sits over the crown").toBeGreaterThanOrEqual(0.9);

    // The face shows under it: no eye voxel has hood in front of it.
    const white = materialId("foam-white"), ink = materialId("foam-ink");
    let eyes = 0, hidden = 0;
    for (let y = 0; y < head.size[1]; y++)
      for (let x = 0; x < head.size[0]; x++)
        for (let z = 0; z < head.size[2]; z++) {
          const m = headV.get(x, y, z);
          if (m !== white && m !== ink) continue;
          eyes++;
          const q = toHood(x, y, z);
          for (let hz = Math.round(q.z) + 1; hz < hood.size[2] + 3; hz++)
            if (hoodAt(q.x, q.y, hz)) { hidden++; break; }
        }
    expect(eyes).toBeGreaterThanOrEqual(6);
    expect(hidden, "the eyes are not behind the hood").toBe(0);
  });

  it("3. the tank is on its back and the wand hangs from the right hand", () => {
    const pose = solvePose(RIG, new THREE.Vector3(), 0, restMotion(), new Map());
    const box = (id: string) => {
      const p = partOf(id);
      const v: THREE.Vector3[] = [];
      for (const x of [0, 1]) for (const y of [0, 1]) for (const z of [0, 1])
        v.push(new THREE.Vector3(x * p.size[0], y * p.size[1], z * p.size[2])
          .multiplyScalar(RIG.voxelSize).applyMatrix4(pose.get(id)!));
      const lo = new THREE.Vector3(Math.min(...v.map((q) => q.x)), Math.min(...v.map((q) => q.y)), Math.min(...v.map((q) => q.z)));
      const hi = new THREE.Vector3(Math.max(...v.map((q) => q.x)), Math.max(...v.map((q) => q.y)), Math.max(...v.map((q) => q.z)));
      return { lo, hi, mid: lo.clone().add(hi).multiplyScalar(0.5) };
    };
    const body = box("body"), tank = box("tank");
    // Behind the body (its front is +z), not out to a side.
    expect(tank.mid.z).toBeLessThan(body.lo.z);
    expect(Math.abs(tank.mid.x - body.mid.x), "on the spine, not a hip").toBeLessThan(0.15);
    // On the back means it can be shot from behind and not from the front.
    expect(box("head").mid.z).toBeGreaterThan(tank.mid.z);

    const hand = box("foreArmR"), wand = box("wand");
    expect(partOf("wand").parent).toBe("foreArmR");
    expect(wand.mid.x, "in the right hand, +x").toBeGreaterThan(body.mid.x + 0.2);
    expect(wand.mid.y, "hanging below the forearm").toBeLessThan(hand.mid.y);

    // The last voxels of the tube are the foam-core tip.
    const wandV = volumeOf(partOf("wand"));
    const core = materialId("foam-core");
    for (let x = 0; x < partOf("wand").size[0]; x++)
      for (let z = 0; z < partOf("wand").size[2]; z++)
        for (let y = 0; y < 3; y++)
          if (wandV.get(x, y, z)) expect(wandV.get(x, y, z), `wand tip ${x},${y},${z}`).toBe(core);
  });
});

describe("the Biomechanic's type and tank (GAME-10l stage 1)", () => {
  beforeAll(async () => {
    await RAPIER.init();
  });

  it("4. F13 reads its own spec: rig, health, weak point, kept distance", () => {
    const spec = specFor("F13");
    expect(spec.rig).toBe("F13");
    expect(spec.preferredDistanceMetres, "it keeps about 10 m").toBe(10);
    expect(weakpointOf(spec)).toEqual({ _note: expect.any(String), parts: ["tank"], damage: 2 });
    // A ranged token, so the keep-distance brain (decideF02) is chosen.
    expect(spec.attacks.find((a) => a.token)?.token).toBe("ranged");
    const r = rig();
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 0), undefined, "F13")!;
    expect(f).not.toBeNull();
    expect(f.spec).toBe(spec);
    expect(f.maxHealth).toBe(25);
    expect(f.rig.speed).toBe(1.6);
    expect(f.agentInput!.preferredDistance).toBe(10);
  });

  it("5. the tank takes the weak-point multiplier; the body does not", async () => {
    const r = rig();
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 0), undefined, "F13")!;
    const wp = weakpointOf(f.spec)!;
    expect(wp.parts).toEqual(["tank"]);
    expect(wp.damage).toBe(2);
    await settleParts(r, f);
    tick(r, PLAYER);
    const one = (id: string) => {
      const part = f.parts.get(id)!;
      const probe = r.world.createCollider(
        RAPIER.ColliderDesc.cuboid(0.1, 0.1, 0.1).setTranslation(0.2, 0.2, 0.2),
        part.body,
      );
      f.health = f.maxHealth;
      r.darts.onHit({
        point: part.voxelToWorld(new THREE.Vector3(10, 10, 10)),
        normal: new THREE.Vector3(-1, 0, 0),
        direction: new THREE.Vector3(1, 0, 0),
        speed: 25,
        type: "standard",
        collider: probe,
        material: null,
        shot: null,
      });
      r.world.removeCollider(probe, false);
      return f.maxHealth - f.health;
    };
    const onBody = one("body");
    const onTank = one("tank");
    const bodyKind = f.spec.partDamage.kinds.body;
    expect(onBody).toBeCloseTo(f.spec.damage.standard * bodyKind.hit * bodyKind.total, 5);
    const tankKind = f.spec.partDamage.kinds.ability;
    expect(onTank).toBeCloseTo(f.spec.damage.standard * tankKind.hit * tankKind.total * wp.damage, 5);
  });
});
