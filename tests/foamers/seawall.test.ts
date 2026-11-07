import { describe, expect, it } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { linearColorTable } from "../../src/voxel/materials";
import { greedyMesh } from "../../src/voxel/mesher";
import type { Mesher } from "../../src/voxel/pieces";
import { DebrisSystem } from "../../src/voxel/debris";
import { DartSystem } from "../../src/weapons/darts";
import { DartImpacts, type VoxelTarget } from "../../src/weapons/impacts";
import { FoamerSystem, specFor } from "../../src/foamers/foamers";
import { armourOf, plateFaces } from "../../src/foamers/armour";

const DT = 1 / 60;

// GAME-10k stage 1: the Seawall's shield. Like the Blocker's (GAME-10e) it
// is arc armour on the shield parts, but it is complete: inside its arc a
// dart does no damage and carves nothing, and darts never break it. Darts
// from the side or the back hit as usual.

const SPEC = specFor("F11");

function fakeMesher(): Mesher {
  const colors = linearColorTable();
  return { mesh: (padded) => Promise.resolve(greedyMesh(padded, colors)) };
}

function rig() {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  // A floor: on its legs (since the legs() fix) the Seawall falls without one.
  world.createCollider(RAPIER.ColliderDesc.cuboid(40, 0.5, 40).setTranslation(0, -0.5, 0));
  const debris = new DebrisSystem(RAPIER, world);
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  const ignore = world.createCollider(
    RAPIER.ColliderDesc.capsule(0.5, 0.3).setTranslation(0, 0, 200),
    body,
  );
  const darts = new DartSystem(new THREE.Scene(), world, RAPIER, ignore);
  const targets: VoxelTarget[] = [];
  const foamers = new FoamerSystem(RAPIER, world, fakeMesher(), debris, darts, targets);
  new DartImpacts(darts, debris, targets);
  return { world, darts, foamers };
}

async function settle(mesh: { update(): void; busy: boolean }, world: RAPIER.World) {
  while (true) {
    mesh.update();
    if (!mesh.busy) break;
    await new Promise((r) => setTimeout(r, 0));
  }
  world.step();
}

function tick(r: ReturnType<typeof rig>, player: THREE.Vector3) {
  r.darts.update(DT);
  r.foamers.update(DT, player);
  r.world.step();
  r.darts.syncRender(1);
}

describe("GAME-10k: the Seawall's spec", () => {
  it("reads its own spec: rig F11, health 60, melee attacks", async () => {
    await RAPIER.init();
    const r = rig();
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 1), "F11")!;
    expect(f.spec.rig).toBe("F11");
    expect(f.rig.health).toBe(60);
    expect(f.health).toBe(60);
    expect(f.spec.attacks.every((a) => a.token === "melee")).toBe(true);
    expect(f.parts.has("shield")).toBe(true);
    expect(f.parts.has("shieldBoss")).toBe(true);
    expect(f.parts.has("maceHead")).toBe(true);
  });

  it("armours the shield and its boss across the front, turning darts wholly", () => {
    for (const id of ["shield", "shieldBoss"]) {
      const a = armourOf(SPEC, id);
      expect(a).not.toBeNull();
      expect(a!.damage).toBe(0);
      expect(a!.carve).toBe(0);
      expect(a!.arcDeg).toBe(120);
    }
    // The body and the mace are not armoured.
    expect(armourOf(SPEC, "body")).toBeNull();
    expect(armourOf(SPEC, "maceHead")).toBeNull();
    // Facing +z: straight ahead and 50 degrees off are covered, 80 degrees
    // off and straight behind are not.
    expect(plateFaces(SPEC, "shield", 0, 1, 0, 1, false)).toBe(true);
    const r = (50 * Math.PI) / 180;
    expect(plateFaces(SPEC, "shield", 0, 1, Math.sin(r), Math.cos(r), false)).toBe(true);
    const q = (80 * Math.PI) / 180;
    expect(plateFaces(SPEC, "shield", 0, 1, Math.sin(q), Math.cos(q), false)).toBe(false);
    expect(plateFaces(SPEC, "shield", 0, 1, 0, -1, false)).toBe(false);
  });
});

describe("GAME-10k: the shield against darts", () => {
  it("a dart inside the arc does no damage and carves nothing", async () => {
    const r = rig();
    const player = new THREE.Vector3(0, 1.6, 6);
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 1), "F11")!;
    const shield = f.parts.get("shield")!;
    await settle(shield.mesh, r.world);
    const voxelsBefore = shield.voxelCount;
    const healthBefore = f.health;
    const aim = shield.voxelToWorld(new THREE.Vector3(
      shield.spec.size[0] / 2, shield.spec.size[1] / 2, shield.spec.size[2] + 0.5));
    r.darts.fire(new THREE.Vector3(aim.x, aim.y, aim.z + 1), new THREE.Vector3(0, 0, -1), "standard");
    for (let i = 0; i < 120 && r.foamers.stats.hits === 0; i++) tick(r, player);
    expect(r.foamers.stats.hits).toBe(1);
    expect(f.health).toBe(healthBefore);
    expect(shield.voxelCount).toBe(voxelsBefore);
    expect(shield.carveScale).toBe(0);
  });

  it("a dart from behind hurts", async () => {
    const r = rig();
    const player = new THREE.Vector3(0, 1.6, 6);
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1), "F11")!;
    const body = f.parts.get("body")!;
    await settle(body.mesh, r.world);
    // The Foamer faces -z, so +z is behind it: the dart comes from there
    // and meets the back of the body (aim at its world centre).
    const c = body.voxelToWorld(new THREE.Vector3(
      body.spec.size[0] / 2, body.spec.size[1] / 2, body.spec.size[2] / 2));
    const before = f.health;
    r.darts.fire(new THREE.Vector3(c.x, c.y, c.z + 1), new THREE.Vector3(0, 0, -1), "standard");
    for (let i = 0; i < 120 && f.health === before; i++) tick(r, player);
    const kind = SPEC.partDamage.kinds[body.spec.kind as "body"];
    expect(before - f.health).toBeCloseTo(SPEC.damage.standard * kind.hit * kind.total, 5);
  });
});

// ---------------------------------------------------------------------------
// GAME-10k stage 2: the combo (overhead, sweep, finisher in order), the pink
// tell on the finisher's windup, and the melee parry that breaks the shield.

import { decideMeleeParry, comboOf, meleeParryOf } from "../../src/foamers/combo";
import { BALL_MATERIAL } from "../../src/foamers/projectiles";
import { voxelFoamMaterial } from "../../src/render/foam-material";

describe("GAME-10k: the combo", () => {
  it("the spec lists the three attacks and the combo order", () => {
    expect(SPEC.attacks.map((a) => a.id)).toEqual(["overhead", "sweep", "finisher"]);
    expect(comboOf(SPEC)?.attacks).toEqual(["overhead", "sweep", "finisher"]);
    expect(SPEC.attacks.map((a) => a.windup)).toEqual([0.7, 0.5, 1.2]);
    expect(SPEC.attacks.map((a) => a.damage)).toEqual([15, 12, 35]);
    expect(meleeParryOf(SPEC)).toEqual({ part: "shield", tellPart: "maceHead", staggerSeconds: 1.5, parriesToBreak: 2 });
  });

  it("it fights overhead, sweep, finisher in order, then loops", async () => {
    await RAPIER.init();
    const r = rig();
    const player = new THREE.Vector3(0, 1.6, 0);
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 1.4), player, "F11")!;
    for (const p of f.parts.values()) await settle(p.mesh, r.world);
    const bonks: string[] = [];
    r.foamers.onBonk = (_f, attack) => bonks.push(attack);
    for (let i = 0; i < 60 * 40 && bonks.length < 4; i++) tick(r, player);
    expect(bonks.slice(0, 4)).toEqual(["overhead", "sweep", "finisher", "overhead"]);
    expect(f.comboTurn).toBe(4);
  });

  it("the mace is pink only during the finisher's windup", async () => {
    await RAPIER.init();
    const r = rig();
    const player = new THREE.Vector3(0, 1.6, 0);
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 1.4), player, "F11")!;
    for (const p of f.parts.values()) await settle(p.mesh, r.world);
    const mace = f.parts.get("maceHead")!;
    const chunkMat = () => (mace.mesh.group.children[0] as THREE.Mesh).material as THREE.Material;
    let sawPink = false, sawPlainDuringWindup = false;
    for (let i = 0; i < 60 * 40 && !(sawPink && sawPlainDuringWindup); i++) {
      tick(r, player);
      if (f.state !== "windup") continue;
      if (f.attack()?.id === "finisher") {
        if (chunkMat() === BALL_MATERIAL) sawPink = true;
      } else if (chunkMat() === voxelFoamMaterial()) sawPlainDuringWindup = true;
    }
    expect(sawPink).toBe(true);
    expect(sawPlainDuringWindup).toBe(true);
    // Once the windup is over it is purple foam again.
    for (let i = 0; i < 600 && f.state !== "recover" && f.state !== "approach"; i++) tick(r, player);
    expect(chunkMat()).toBe(voxelFoamMaterial());
  });
});

describe("GAME-10k: the melee parry", () => {
  it("only a marked attack inside the window is a parry; the rest block or hit", () => {
    expect(decideMeleeParry(SPEC, "finisher", true, true)).toBe("parry");
    // Blocked but the window has passed: a block, as any attack is.
    expect(decideMeleeParry(SPEC, "finisher", true, false)).toBe("block");
    // An attack not marked parryable is never parried, even in the window.
    expect(decideMeleeParry(SPEC, "overhead", true, true)).toBe("block");
    expect(decideMeleeParry(SPEC, "sweep", true, true)).toBe("block");
    // Nothing met the disc: a clean hit.
    expect(decideMeleeParry(SPEC, "finisher", false, true)).toBe("hit");
    // A type with no parryable attacks never parries (the test type's bonk).
    const f01 = specFor("F01");
    expect(decideMeleeParry(f01, "bonk", true, true)).toBe("block");
  });

  it("a parry costs the player nothing, staggers the Seawall and counts; two break the shield, and then a front dart hurts", async () => {
    await RAPIER.init();
    const r = rig();
    const player = new THREE.Vector3(0, 1.6, 0);
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 1.4), player, "F11")!;
    for (const p of f.parts.values()) await settle(p.mesh, r.world);
    const healthBefore = f.health;
    // One parry: stagger, count, shield still on.
    r.foamers.parryAttack(f);
    expect(f.health).toBe(healthBefore);
    expect(f.state).toBe("stagger");
    expect(f.staggerDuration()).toBe(1.5);
    expect(f.parriesTaken).toBe(1);
    expect(f.parts.has("shield")).toBe(true);
    // Out of the stagger, a second parry: the shield breaks off as a piece.
    while (f.state === "stagger") tick(r, player);
    r.foamers.parryAttack(f);
    expect(f.parriesTaken).toBe(2);
    expect(f.parts.has("shield")).toBe(false);
    expect(f.parts.has("shieldBoss")).toBe(false);
    // The arc is gone: a dart straight at the helm from the front hurts.
    const helm = f.parts.get("helm") ?? f.parts.get("head")!;
    await settle(helm.mesh, r.world);
    const c = helm.voxelToWorld(new THREE.Vector3(
      helm.spec.size[0] / 2, helm.spec.size[1] / 2, helm.spec.size[2] / 2));
    const before = f.health;
    r.darts.fire(new THREE.Vector3(c.x, c.y, c.z + 1.5), new THREE.Vector3(0, 0, -1), "standard");
    for (let i = 0; i < 120 && f.health === before; i++) tick(r, player);
    expect(f.health).toBeLessThan(before);
  });
});

describe("GAME-10k review: a parry through the real strike", () => {
  it("a finisher parried inside its own strike leaves the Seawall staggering, then fighting again", async () => {
    // Review: the parry was tested by calling parryAttack directly. In play
    // the page parries inside onBonk, which the system calls in the middle
    // of the windup-to-strike step; the stagger it set was overwritten with
    // `strike` and no attack, and the Seawall froze there for good.
    await RAPIER.init();
    const r = rig();
    const player = new THREE.Vector3(0, 0, 2.2);
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 0), player, "F11")!;
    let parried = 0;
    r.foamers.onBonk = (sf, attack) => {
      if (attack === "finisher") {
        parried++;
        r.foamers.parryAttack(sf);
      }
    };
    const states: string[] = [];
    for (let i = 0; i < 60 * 25 && parried < 1; i++) tick(r, player);
    expect(parried, "the combo reached its finisher").toBe(1);
    for (let i = 0; i < 60 * 6; i++) {
      tick(r, player);
      if (states[states.length - 1] !== f.state) states.push(f.state);
    }
    expect(states[0], "the parry left it staggering").toBe("stagger");
    expect(states.length, "it came out of the stagger and fought on").toBeGreaterThan(2);
    expect(f.state === "strike" && f.attack() === null, "not frozen in a strike").toBe(false);
  });
});
