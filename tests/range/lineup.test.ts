import { beforeAll, describe, expect, it } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { greedyMesh } from "../../src/voxel/mesher";
import { linearColorTable } from "../../src/voxel/materials";
import type { Mesher } from "../../src/voxel/pieces";
import { DartSystem } from "../../src/weapons/darts";
import { createLineup, createRangeSystems, respawnLineup } from "../../src/range/setup";
import foamerData from "../../data/foamers.json";
import rangeJson from "../../data/range.json";

// PT-01 stage 2: one of every Foamer type in a line across the range, held
// so it stands still: no brain, no walk, no attack, no projectile, no heal,
// no hover. It still takes damage, loses parts, goes down, pops and dissolves.

const DT = 1 / 60;
const TYPES = Object.keys(foamerData.types);
const LINEUP = (rangeJson as { range: { lineup: { distanceMetres: number; spacingMetres: number } } })
  .range.lineup;
const SPAWN = new THREE.Vector3(
  ...(rangeJson as unknown as { range: { playerSpawn: [number, number, number] } }).range.playerSpawn,
);

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
  const sys = createRangeSystems(RAPIER, world, darts, fakeMesher(), ignore);
  world.step();
  return { world, darts, ...sys };
}

async function settle(r: ReturnType<typeof rig>) {
  for (let i = 0; i < 60; i++) {
    let busy = false;
    for (const f of r.foamers.list)
      for (const p of f.parts.values()) if (p.mesh.busy) busy = true;
    if (!busy) return;
    await new Promise((res) => setTimeout(res, 0));
  }
}

/** Step the world for `seconds`, the way the page does. */
function tick(r: ReturnType<typeof rig>, player: THREE.Vector3, seconds: number) {
  const n = Math.round(seconds / DT);
  for (let i = 0; i < n; i++) {
    r.darts.update(DT);
    r.foamers.update(DT, player);
    r.projectiles.update(DT);
    r.world.step();
  }
}

beforeAll(async () => {
  await RAPIER.init();
});

describe("PT-01 stage 2: the line of Foamers", () => {
  it("the lineup types come from the data file, not from code", () => {
    // The card: F01 to F13 today, read from the data.
    expect(TYPES.length).toBeGreaterThanOrEqual(13);
    expect(TYPES).toContain("F01");
    expect(TYPES).toContain("F13");
  });

  it("one of every type, in a line, facing the player, at the data's distances", async () => {
    const r = rig();
    const line = createLineup(r.foamers, SPAWN, TYPES, LINEUP.distanceMetres, LINEUP.spacingMetres);
    await settle(r);
    expect(line.length).toBe(TYPES.length);
    expect(line.map((e) => e.type)).toEqual(TYPES);
    const n = TYPES.length;
    line.forEach((e, i) => {
      const f = e.foamer;
      // Centred on the player's start, spacingMetres apart, one row.
      expect(f.centre.x).toBeCloseTo((i - (n - 1) / 2) * LINEUP.spacingMetres, 6);
      expect(f.centre.z).toBeCloseTo(SPAWN.z - LINEUP.distanceMetres, 6);
      // Facing the player: the yaw points from it back at the spawn.
      const dx = SPAWN.x - f.centre.x;
      const dz = SPAWN.z - f.centre.z;
      expect(f.yaw).toBeCloseTo(Math.atan2(dx, dz), 6);
    });
    // A row across the range, not a stack.
    expect(line[1]!.foamer.centre.x - line[0]!.foamer.centre.x)
      .toBeCloseTo(LINEUP.spacingMetres, 6);
  });

  it("a held Foamer does not move, attack or throw over 10 s beside the player", async () => {
    const r = rig();
    // Next to the player, where an unheld F02 would walk in and throw.
    const player = new THREE.Vector3(2.5, 1, SPAWN.z);
    // Two metres in front of the player: where an unheld F02 would walk in
    // and throw, and an unheld F10 would climb to its hover height.
    const line = createLineup(r.foamers, player, ["F01", "F02", "F10", "F13"], 2, 4);
    await settle(r);
    const before = line.map((e) => [e.foamer.centre.clone(), e.foamer.yaw]);
    tick(r, player, 10);
    expect(r.foamers.list.length).toBe(4);
    line.forEach((e, i) => {
      const f = e.foamer;
      expect(f.centre.distanceTo(before[i]![0] as THREE.Vector3)).toBe(0);
      expect(f.yaw).toBe(before[i]![1]);
      expect(f.state).not.toBe("windup");
      expect(f.state).not.toBe("strike");
      expect(f.attack()).toBeNull();
    });
    // No foam balls in the air, and nobody healed (F13 is in the line).
    expect(r.projectiles.list.length).toBe(0);
  });

  it("an unheld Foamer beside the player does move (the held flag is what stops it)", async () => {
    const r = rig();
    const player = new THREE.Vector3(2.5, 1, SPAWN.z);
    const f = r.foamers.spawn(new THREE.Vector3(2.5, 0, SPAWN.z - 6), player, "F01")!;
    await settle(r);
    const before = f.centre.clone();
    tick(r, player, 10);
    expect(f.centre.distanceTo(before)).toBeGreaterThan(0.5);
  });

  it("a held Foamer still takes damage, goes down and is counted (what Paul tests)", async () => {
    const r = rig();
    const player = new THREE.Vector3(0, 1, SPAWN.z);
    const line = createLineup(r.foamers, player, ["F01"], LINEUP.distanceMetres, 4);
    await settle(r);
    const f = line[0]!.foamer;
    const hp = f.health;
    // Three hits, each further apart than the pop rule's window
    // (data/foamers.json catastrophic.window: 0.1 s, share: 0.4 of max
    // health), so no step's damage counts as catastrophic and the killing
    // blow goes down rather than pops. This is the death Paul watches for.
    for (const share of [0.3, 0.3, 0.3]) {
      r.foamers.blastDamage(f, hp * share);
      tick(r, player, 0.2);
    }
    expect(f.health).toBeCloseTo(hp * 0.1, 6);
    expect(f.finishWeakened).toBe(true);
    r.foamers.blastDamage(f, hp * 0.2); // more than it has left: it goes down
    tick(r, player, 0.2);
    expect(f.state).toBe("down");
    expect(r.foamers.downed).toContain(f);
    // It went down where it stood: its feet point did not slide.
    expect(f.centre.x).toBeCloseTo(0, 6);
    expect(f.centre.z).toBeCloseTo(player.z - LINEUP.distanceMetres, 6);
  });

  it("Respawn puts the whole line back, fresh and at full health", async () => {
    const r = rig();
    const player = new THREE.Vector3(0, 1, SPAWN.z);
    const line = createLineup(r.foamers, player, TYPES, LINEUP.distanceMetres, LINEUP.spacingMetres);
    await settle(r);
    expect(line.length).toBe(TYPES.length);
    // Wound and kill some of them, and let the parts wear.
    for (const e of line) r.foamers.blastDamage(e.foamer, e.foamer.maxHealth * 0.3);
    r.foamers.blastDamage(line[0]!.foamer, line[0]!.foamer.maxHealth); // down or pop
    tick(r, player, 1);
    expect(r.foamers.list.length).toBeLessThan(TYPES.length);
    const fresh = respawnLineup(
      r.foamers, SPAWN, TYPES, LINEUP.distanceMetres, LINEUP.spacingMetres,
    );
    await settle(r);
    tick(r, player, 0.5);
    expect(fresh.length).toBe(TYPES.length);
    expect(fresh.map((e) => e.type)).toEqual(TYPES);
    for (const e of fresh) {
      expect(e.foamer.health).toBe(e.foamer.maxHealth);
      expect(e.foamer.state).toBe("idle");
      expect(e.foamer.finishWeakened).toBe(false);
      expect(r.foamers.held.has(e.foamer)).toBe(true);
      // Back in a row at the data's distances, facing the player.
      expect(e.foamer.centre.z).toBeCloseTo(SPAWN.z - LINEUP.distanceMetres, 6);
    }
    // Nothing left of the old line: no downed body still sinking, no part
    // still in the dart targets.
    expect(r.foamers.downed.length).toBe(0);
  });
});
