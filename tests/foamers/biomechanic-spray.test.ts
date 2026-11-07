import { beforeAll, describe, expect, it } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import foamerData from "../../data/foamers.json";
import playerData from "../../data/player.json";
import shieldData from "../../data/shield.json";
import { greedyMesh } from "../../src/voxel/mesher";
import type { Mesher } from "../../src/voxel/pieces";
import { DebrisSystem } from "../../src/voxel/debris";
import { linearColorTable } from "../../src/voxel/materials";
import { DartSystem } from "../../src/weapons/darts";
import { DartImpacts, type VoxelTarget } from "../../src/weapons/impacts";
import { PlayerHealth } from "../../src/player/health";
import { FoamerSystem, specFor } from "../../src/foamers/foamers";
import type { Foamer } from "../../src/foamers/foamer";
import { Director } from "../../src/ai/director";
import { NavGrid } from "../../src/ai/nav-grid";
import { damageOf } from "../../src/game/attack";
import { decideMeleeParry } from "../../src/foamers/combo";
import { canSpray, type SpraySpec } from "../../src/foamers/spray";
import { canHeal, healOf } from "../../src/foamers/heal";

// GAME-10l stage 3: the short damaging spray. With no ally to heal and the
// player close, the Biomechanic winds up and sprays, one hit at a time
// through the page's ordinary hit path. Each hit is the page's health
// damage at the shield's share (the raised shield takes it, the parry
// turns nothing), so the run of hits lands perSecond over the seconds.
// The wand is the nozzle and the tank the press: either missing is no
// spray, and with the tank gone the wand only bonks.

const DT = 1 / 60;
const HALF = 20;
const SHARE = (shieldData.block as { damageShare: number }).damageShare;
const GRACE = (playerData.health as { hitGrace: number }).hitGrace;
const SPRAY = (foamerData.types.F13 as unknown as { spray: SpraySpec }).spray;

function fakeMesher(): Mesher {
  const colors = linearColorTable();
  return { mesh: (padded) => Promise.resolve(greedyMesh(padded, colors)) };
}

/** The heal tests' rig, with the player near the Biomechanic (2 m, in the
 *  5 m spray range) and the page's hit path wired over the bonks, the way
 *  src/game/game.ts does it: the shield's block decision, the melee-parry
 *  decider, the player's health and its post-hit grace. */
function rig(player: THREE.Vector3, blocked: boolean) {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.createCollider(RAPIER.ColliderDesc.cuboid(40, 0.5, 40).setTranslation(0, -0.5, 0));
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  const ignore = world.createCollider(
    RAPIER.ColliderDesc.capsule(0.5, 0.3).setTranslation(0, 0, 400),
    body,
  );
  const darts = new DartSystem(new THREE.Scene(), world, RAPIER, ignore);
  const debris = new DebrisSystem(RAPIER, world);
  const targets: VoxelTarget[] = [];
  const foamers = new FoamerSystem(RAPIER, world, fakeMesher(), debris, darts, targets);
  new DartImpacts(darts, debris, targets);
  foamers.director = new Director("normal");
  const grid = new NavGrid(RAPIER, world, { minX: -HALF, maxX: HALF, minZ: -HALF, maxZ: HALF });
  foamers.navGrid = grid;
  foamers.spawnState = "alert";
  // No intro spawner adding Foamers the test did not plan for.
  foamers.spawnCount = 0;
  const health = new PlayerHealth();
  // The front arc always faces the Foamer, so "raised" is the "blocked"
  // flag; the parry window is offered the way the decider itself asks.
  const shield = {
    damageShare: SHARE,
    blocksAttackFrom: (_from: THREE.Vector3) => blocked,
    canParry: () => true,
  };
  foamers.onBonk = (f: Foamer, attack: string) => {
    const blockedNow = shield.blocksAttackFrom(f.centre);
    const decision = blockedNow
      ? decideMeleeParry(f.spec, attack, true, shield.canParry())
      : "hit";
    if (decision === "parry") return;
    const share = decision === "block" ? shield.damageShare : 1;
    health.damage(damageOf(attack, f.spec) * share, attack);
  };
  world.step();
  grid.bake();
  return { world, darts, foamers, health, player };
}

function tick(r: ReturnType<typeof rig>) {
  r.darts.update(DT);
  r.foamers.update(DT, r.player);
  r.health.update(DT);
  r.world.step();
}

function run(r: ReturnType<typeof rig>, seconds: number) {
  for (let i = 0; i < Math.round(seconds / DT); i++) tick(r);
}

/** A hurt ally the Biomechanic can see and reach (in its 7 m heal range). */
function ally(r: ReturnType<typeof rig>, health = 14): Foamer {
  const f = r.foamers.spawn(new THREE.Vector3(2, 0, 4), undefined, "F06")!;
  f.health = health;
  return f;
}

beforeAll(async () => {
  await RAPIER.init();
});

describe("the Biomechanic's spray (GAME-10l stage 3)", () => {
  it("16. the spray numbers are in the type, and it needs the wand and the tank", () => {
    const spec = specFor("F13");
    expect(healOf(spec), "it still has the heal block").not.toBeNull();
    expect(SPRAY).toEqual({
      _note: expect.any(String),
      range: 5, windup: 0.6, seconds: 1.2, perSecond: 6, tick: 0.6,
    });
    const atk = spec.attacks.find((a) => a.id === "spray")!;
    expect(atk.token, "a ranged attack (the brain's ring reads it)").toBe("ranged");
    expect(atk.windup).toBe(0.6);
    expect(atk.strike, "the run is the strike").toBe(1.2);
    expect(atk.needs, "the wand is the nozzle, the tank the press")
      .toEqual(expect.arrayContaining(["wand", "tank"]));
    // The run of round(seconds / tick) hits lands perSecond over the
    // seconds, and the tick clears the player's post-hit grace so none
    // is eaten.
    const hits = Math.round(SPRAY.seconds / SPRAY.tick);
    expect(atk.damage * hits).toBeCloseTo(SPRAY.perSecond * SPRAY.seconds, 5);
    expect(SPRAY.tick, "past the 0.5 s grace").toBeGreaterThan(GRACE);

    const r = rig(new THREE.Vector3(0, 0, 6), false);
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 4), undefined, "F13")!;
    expect(canSpray(spec, f), "whole: the wand and the tank are the nozzle and the press").toBe(true);
    const f2 = r.foamers.spawn(new THREE.Vector3(4, 0, 4), undefined, "F13")!;
    f2.parts.delete("wand");
    expect(canSpray(spec, f2), "no wand: no nozzle, no spray").toBe(false);
    const f3 = r.foamers.spawn(new THREE.Vector3(6, 0, 4), undefined, "F13")!;
    f3.parts.delete("tank");
    expect(canSpray(spec, f3), "no tank: no press, no spray").toBe(false);
    expect(canHeal(spec, f3), "no tank no heal either").toBe(false);
  });

  it("17. with nobody to heal and the player close it sprays, whole runs of perSecond", () => {
    const r = rig(new THREE.Vector3(0, 0, 6), false);
    r.foamers.spawn(new THREE.Vector3(0, 0, 4), undefined, "F13")!;
    const before = r.health.hp;
    run(r, 6);
    const lost = before - r.health.hp;
    expect(lost, "at least one full run").toBeGreaterThanOrEqual(SPRAY.perSecond * SPRAY.seconds - 0.01);
    // Every hit is a whole damage, so the loss is whole runs of the run's
    // cost (7.2), no partial round.
    const roundCost = SPRAY.perSecond * SPRAY.seconds;
    const runs = Math.round(lost / roundCost);
    expect(lost / roundCost, "a whole number of runs").toBeCloseTo(runs, 4);
    expect(runs).toBeGreaterThanOrEqual(1);
  });

  it("18b. review: stepping behind a wall mid-run stops the rest of the spray", () => {
    const r = rig(new THREE.Vector3(0, 0, 6), false);
    r.foamers.spawn(new THREE.Vector3(0, 0, 4), undefined, "F13")!;
    const before = r.health.hp;
    let i = 0;
    while (r.health.hp === before && i++ < 600) tick(r);
    expect(r.health.hp, "the first hit of a run landed").toBeLessThan(before);
    const afterFirst = r.health.hp;
    // A wall drops between them: the run's next hits are out of sight.
    r.world.createCollider(RAPIER.ColliderDesc.cuboid(6, 3, 0.1).setTranslation(0, 1.5, 5));
    run(r, SPRAY.seconds + 0.2);
    expect(r.health.hp, "nothing reaches the player behind the wall").toBe(afterFirst);
  });

  it("18. a raised shield takes the block share, and the spray is not parryable", () => {
    const spec = specFor("F13");
    expect(decideMeleeParry(spec, "spray", true, true), "the parry turns nothing").toBe("block");

    const r = rig(new THREE.Vector3(0, 0, 6), false);
    r.foamers.spawn(new THREE.Vector3(0, 0, 4), undefined, "F13")!;
    const openBefore = r.health.hp;
    run(r, 6);
    const open = openBefore - r.health.hp;
    expect(open, "the spray left hard").toBeGreaterThan(0);

    const rb = rig(new THREE.Vector3(0, 0, 6), true);
    rb.foamers.spawn(new THREE.Vector3(0, 0, 4), undefined, "F13")!;
    const blockedBefore = rb.health.hp;
    run(rb, 6);
    const share = blockedBefore - rb.health.hp;
    expect(share, "the shield ate hits").toBeGreaterThan(0);
    // Each hit landed at its share, so the same rig, the same window,
    // lost at the block's share of what was lost unprotected.
    expect(share).toBeCloseTo(open * SHARE, 1);
  });

  it("19. while it mends, the stream has the wand, and the player is not sprayed", () => {
    const r = rig(new THREE.Vector3(0, 0, 5.5), false);
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 4), undefined, "F13")!;
    const a = ally(r, 14);
    // The ally also fights for its own mind (and its bonks count in the
    // test's health), so the spray question reads only the Biomechanic's
    // bonks.
    const bonks: string[] = [];
    const log = r.foamers.onBonk;
    r.foamers.onBonk = (fo, attack) => { if (fo === f) bonks.push(attack); log(fo, attack); };
    run(r, 4);
    expect(a.health, "the mend goes on").toBeGreaterThan(14);
    expect(bonks.some((b) => b === "spray"), "no spray while mending").toBe(false);
  });

  it("20. tank gone: no spray, the wand closes in and bonks", () => {
    const r = rig(new THREE.Vector3(0, 0, 6), false);
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 4), undefined, "F13")!;
    f.parts.delete("tank");
    expect(canSpray(specFor("F13"), f)).toBe(false);
    const bonks: string[] = [];
    const log = r.foamers.onBonk;
    r.foamers.onBonk = (fo, attack) => { bonks.push(attack); log(fo, attack); };
    const before = r.health.hp;
    run(r, 8);
    expect(bonks, "someone ends up with a bonk").not.toHaveLength(0);
    expect(bonks.some((b) => b === "spray"), "no spray").toBe(false);
    expect(bonks.some((b) => b === "bonk"), "the wand bonks").toBe(true);
    expect(before - r.health.hp, "and it costs").toBeGreaterThan(0);
  });
});
