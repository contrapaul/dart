import { beforeAll, describe, expect, it } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import foamerData from "../../data/foamers.json";
import { linearColorTable } from "../../src/voxel/materials";
import { greedyMesh } from "../../src/voxel/mesher";
import type { Mesher } from "../../src/voxel/pieces";
import { DebrisSystem } from "../../src/voxel/debris";
import { DartSystem } from "../../src/weapons/darts";
import { DartImpacts, type VoxelTarget } from "../../src/weapons/impacts";
import { FoamerSystem, specFor } from "../../src/foamers/foamers";
import { ProjectileSystem } from "../../src/foamers/projectiles";
import { Director } from "../../src/ai/director";

// GAME-10e: the shield wall in the system, not just the brain. Slots are
// worked out by FoamerSystem (it can see the other Blockers) and fed to the
// brains, and the volley fires the type's shot count through the ranged
// token. Distances are the F04 spec's (data/foamers.json).

const DT = 1 / 60;
const F04 = foamerData.types.F04;
const SLOTS = F04.slots;
const VOLLEY = F04.attacks.find((a) => a.token === "ranged")!;

function fakeMesher(): Mesher {
  const colors = linearColorTable();
  return { mesh: (padded) => Promise.resolve(greedyMesh(padded, colors)) };
}

function rig() {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.createCollider(RAPIER.ColliderDesc.cuboid(60, 0.5, 60).setTranslation(0, -0.5, 0));
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  const ignore = world.createCollider(
    RAPIER.ColliderDesc.capsule(0.5, 0.3).setTranslation(0, 0, 200),
    body,
  );
  const playerCollider = world.createCollider(
    RAPIER.ColliderDesc.capsule(0.55, 0.35).setTranslation(0, 200, 0),
  );
  const darts = new DartSystem(new THREE.Scene(), world, RAPIER, ignore);
  const debris = new DebrisSystem(RAPIER, world);
  const targets: VoxelTarget[] = [];
  const foamers = new FoamerSystem(RAPIER, world, fakeMesher(), debris, darts, targets);
  new DartImpacts(darts, debris, targets);
  const projectiles = new ProjectileSystem(RAPIER, world, debris, playerCollider, foamers);
  foamers.projectiles = projectiles;
  foamers.director = new Director("fury");
  foamers.spawnState = "alert";
  return { world, foamers, projectiles, director: foamers.director };
}

/** A player standing still, far enough that the wall is not in contact. */
const PLAYER = new THREE.Vector3(0, 0, 0);

function step(r: ReturnType<typeof rig>, player = PLAYER, n = 1) {
  for (let i = 0; i < n; i++) {
    r.foamers.update(DT, player);
    r.projectiles.update(DT);
    r.world.step();
  }
}

beforeAll(async () => {
  await RAPIER.init();
});

describe("F04 wall: slots", () => {
  it("puts three Blockers on distinct slots in a line across the player", () => {
    const r = rig();
    const line = r.foamers.spawnLine(new THREE.Vector3(0, 0, 18), new THREE.Vector3(0, 0, 0));
    expect(line.length).toBe(3);
    step(r);
    const slots = line.map((f) => ({ x: f.agentInput!.slotX!, z: f.agentInput!.slotZ! }));
    // Three distinct spots, spacingMetres apart, centred on the hold line.
    const xs = slots.map((s) => s.x).sort((a, b) => a - b);
    expect(new Set(xs.map((x) => x.toFixed(3))).size).toBe(3);
    expect(xs[1]! - xs[0]!).toBeCloseTo(SLOTS.spacingMetres, 1);
    expect(xs[2]! - xs[1]!).toBeCloseTo(SLOTS.spacingMetres, 1);
    // The line is across x, at the hold distance from the player in z.
    for (const s of slots) expect(s.z).toBeCloseTo(SLOTS.holdMetres, 0);
    expect(Math.abs(slots[0]!.z - slots[2]!.z)).toBeLessThan(0.05);
  });

  it("keeps the slots put as the wall walks, so no two Blockers swap", () => {
    const r = rig();
    const line = r.foamers.spawnLine(new THREE.Vector3(0, 0, 18), new THREE.Vector3(0, 0, 0));
    step(r);
    const before = line.map((f) => `${f.agentInput!.slotX!.toFixed(2)},${f.agentInput!.slotZ!.toFixed(2)}`);
    const ids = line.map((f) => f.agent!.agentId);
    step(r, PLAYER, 40);
    const after = line.map((f) => `${f.agentInput!.slotX!.toFixed(2)},${f.agentInput!.slotZ!.toFixed(2)}`);
    // The slots follow the wall's centroid, which drifts a few centimetres
    // as the three walk in, so compare to a millimetre of that, not exactly.
    after.forEach((slot, i) => {
      const [bx, bz] = before[i]!.split(",").map(Number);
      const [ax, az] = slot.split(",").map(Number);
      expect(Math.abs(ax - bx)).toBeLessThan(0.02);
      expect(Math.abs(az - bz)).toBeLessThan(0.02);
    });
    expect(line.map((f) => f.agent!.agentId)).toEqual(ids);
  });

  it("gives a lone Blocker the middle slot of the line", () => {
    const r = rig();
    const one = r.foamers.spawn(new THREE.Vector3(0, 0, 18), new THREE.Vector3(0, 0, 0), "F04")!;
    step(r);
    // One in the line: the middle, so the offset is zero on both axes.
    expect(one.agentInput!.slotX!).toBeCloseTo(0, 1);
    expect(one.agentInput!.slotZ!).toBeCloseTo(SLOTS.holdMetres, 0);
  });

  it("walks to its slot and holds there with the token pool", () => {
    const r = rig();
    const one = r.foamers.spawn(new THREE.Vector3(0, 0, 18), new THREE.Vector3(0, 0, 0), "F04")!;
    step(r, PLAYER, 60 * 8);
    // On its slot it holds, or steps out of hold to fire and comes back:
    // a brain state or an attack state, either way it is on its slot.
    expect(["hold", "approach", "windup", "strike", "recover"]).toContain(one.state);
    const d = Math.hypot(one.centre.x - one.agentInput!.slotX!, one.centre.z - one.agentInput!.slotZ!);
    expect(d).toBeLessThan(1.5);
  });
});

describe("F04 wall: the volley", () => {
  it("fires the type's shot count through one ranged token", () => {
    const r = rig();
    r.foamers.spawn(new THREE.Vector3(0, 0, 18), new THREE.Vector3(0, 0, 0), "F04");
    const live = () => r.projectiles.list.length;
    let most = 0;
    // Long enough for the alert, the approach and a windup.
    for (let i = 0; i < 60 * 12; i++) {
      step(r);
      most = Math.max(most, live());
    }
    // A volley is the type's shot count at once, not one ball a time, and
    // the cap still holds.
    const shots = (VOLLEY as { shots: number }).shots;
    expect(shots).toBe(3);
    expect(most).toBeGreaterThanOrEqual(shots);
    expect(live()).toBeLessThanOrEqual(foamerData.test.ball.maxLive);
  });

  it("needs the ranged token: with the pool empty there are no balls", () => {
    const r = rig();
    r.director = new Director("story");
    r.foamers.director = r.director;
    // The one story ranged token goes to a phantom bidder that never
    // releases it, so the Blocker can never hold it and never fires.
    r.director.request(7, "ranged", 100);
    r.director.update(1);
    const block = r.foamers.spawn(new THREE.Vector3(0, 0, 18), new THREE.Vector3(0, 0, 0), "F04")!;
    expect(block.agent!.hasToken).toBe(false);
    step(r, PLAYER, 60 * 12);
    expect(block.agent!.hasToken).toBe(false);
    expect(r.projectiles.list.length).toBe(0);
  });
});

describe("F04 spec: reads its data, not a copy", () => {
  it("takes its distances from the type, and its own wall data", () => {
    // The spec is the JSON object itself: no copy, so tuning in data/ is
    // what the game runs (the type carries slots and line beyond the base
    // spec's shape).
    const spec = specFor("F04");
    expect(spec.throwRangeMetres).toBe(F04.throwRangeMetres);
    const wall = spec as unknown as typeof F04;
    expect(wall.slots).toBe(SLOTS);
    expect(wall.armour.shield!.arcDeg).toBe(120);
    expect(wall.stagger.shieldChargeTime).toBe(1.2);
  });
});
