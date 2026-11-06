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
import { FoamerSystem } from "../../src/foamers/foamers";
import { Director } from "../../src/ai/director";
import type { Foamer } from "../../src/foamers/foamer";

const DT = 1 / 60;
const LEAP = foamerData.types.F07.leap;
const WAVE = foamerData.types.F07.shockwave;

function fakeMesher(): Mesher {
  const colors = linearColorTable();
  return { mesh: (padded) => Promise.resolve(greedyMesh(padded, colors)) };
}

/** Floor, the director and the Foamer system. `vulnerable` is the page's
 *  playerVulnerable: false stands for a player in the air or dashing. */
function rig(vulnerable: () => boolean = () => true) {
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
  foamers.director = new Director("normal");
  world.step();
  const hits: THREE.Vector3[] = [];
  const sounds: string[] = [];
  foamers.playerVulnerable = vulnerable;
  foamers.onShockwaveHit = (_f, point) => hits.push(point.clone());
  foamers.onSound = (kind) => sounds.push(kind);
  return { world, darts, foamers, hits, sounds };
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

/** A Brawler `metres` from the player on the z line, facing it. */
function brawler(r: Rig, metres: number, player: THREE.Vector3): Foamer {
  const f = r.foamers.spawn(new THREE.Vector3(0, 0, player.z + metres), player, "F07")!;
  expect(f.spec.rig).toBe("F07");
  return f;
}

beforeAll(async () => {
  await RAPIER.init();
});

describe("the F07 leap slam (GAME-10f stage 2)", () => {
  it("1. it crouches, then leaps, inside its distances", () => {
    const r = rig();
    const player = new THREE.Vector3(0, 1.6, 0);
    const f = brawler(r, 8, player);
    let crouch = 0;
    run(r, player, () => f.state === "leaping", 60 * 20);
    // Back up and watch the crouch's length on the way to a leap.
    const g = brawler(r, 8, player);
    run(r, player, () => g.state === "crouch", 60 * 20);
    expect(g.state, "it crouched").toBe("crouch");
    while (g.state === "crouch") { tick(r, player); crouch += DT; }
    expect(crouch, "for its whole telegraph").toBeGreaterThanOrEqual(LEAP.crouchSeconds - DT * 1.5);
    expect(g.state, "then flew").toBe("leaping");
    expect(f.state === "leaping" || f.state === "recover", "the first one too").toBe(true);
  });

  it("2. it does not leap inside the minimum or beyond the maximum", () => {
    const player = new THREE.Vector3(0, 1.6, 0);
    const close = rig();
    const fc = brawler(close, LEAP.minMetres - 1, player);
    run(close, player, () => false, 60 * 6);
    expect(fc.state !== "crouch" && fc.state !== "leaping", "too close: it walks in").toBe(true);
    const far = rig();
    const ff = brawler(far, LEAP.maxMetres + 2, player);
    run(far, player, () => false, 60 * 6);
    expect(ff.state !== "crouch" && ff.state !== "leaping", "too far: it walks in").toBe(true);
  });

  it("3. it waits for the cooldown, and the crouch starts it", () => {
    const r = rig();
    const player = new THREE.Vector3(0, 1.6, 0);
    const f = brawler(r, 8, player);
    run(r, player, () => f.state === "leaping", 60 * 20);
    expect(f.state).toBe("leaping");
    // The cooldown was set at the start of the crouch, not at the landing.
    expect(f.leapCooldown).toBeGreaterThan(0);
    // Land it, then hold the player at the same distance: no second crouch
    // while the cooldown runs, and one after it.
    run(r, player, () => f.state === "recover", 60 * 5);
    const wait = f.leapCooldown;
    expect(wait, "the crouch started the cooldown").toBeGreaterThan(0);
    f.centre.set(0, 0, 8);
    let sawCrouch = false;
    for (let i = 0; i < Math.floor(60 * (wait - 0.2)); i++) {
      tick(r, player);
      if (f.state === "crouch") sawCrouch = true;
    }
    expect(sawCrouch, "not inside the cooldown").toBe(false);
    run(r, player, () => f.state === "crouch", 60 * 4);
    expect(f.state, "then it leaps again").toBe("crouch");
  });

  it("4. the flight is an arc: it leaves the ground and comes back down", () => {
    const r = rig();
    const player = new THREE.Vector3(0, 1.6, 0);
    const f = brawler(r, 8, player);
    run(r, player, () => f.state === "leaping", 60 * 20);
    const from = f.centre.y;
    expect(from, "it left from the floor").toBeCloseTo(0, 0);
    let high = 0;
    const landedAt: number[] = [];
    while (f.state === "leaping") {
      tick(r, player);
      high = Math.max(high, f.centre.y - from);
      landedAt.push(f.centre.z);
    }
    expect(high, "it rose").toBeGreaterThan(LEAP.arcMetres * 0.6);
    expect(f.centre.y, "and landed").toBeLessThan(0.3);
  });

  it("5. the landing sends the ring out, once, and the ring is drawn", () => {
    const r = rig();
    const player = new THREE.Vector3(0, 1.6, 0);
    const f = brawler(r, 8, player);
    run(r, player, () => f.wave.active, 60 * 20);
    expect(f.wave.active, "the ring started").toBe(true);
    expect(f.waveMesh.visible, "and is drawn").toBe(true);
    expect(r.sounds).toContain("land");
    expect(r.sounds).toContain("crouch");
    expect(f.waveMesh.position.x, "the ring sits where it landed").toBeCloseTo(f.wave.x, 5);
    expect(f.waveMesh.position.z).toBeCloseTo(f.wave.z, 5);
    const before = f.wave.radius;
    run(r, player, () => f.wave.radius >= WAVE.radius - 1e-3, 60 * 3);
    expect(f.wave.radius, "it grew").toBeGreaterThan(before);
    expect(r.foamers.list.length, "and nothing extra was spawned").toBe(1);
  });

  it("6. the band costs a grounded player once, and never twice", () => {
    const r = rig();
    const player = new THREE.Vector3(0, 1.6, 0);
    const f = brawler(r, 8, player);
    run(r, player, () => r.hits.length > 0 || f.wave.radius >= WAVE.radius - 1e-3, 60 * 25);
    expect(r.hits.length, "once").toBe(1);
    for (let i = 0; i < 60; i++) tick(r, player);
    expect(r.hits.length, "and that is the one hit of the ring").toBe(1);
  });

  it("7. a player in the air as the band passes is not hit", () => {
    // The player is 3 m from the landing point: the band reaches it, but it
    // is in the air (the page reports it not vulnerable) while it does.
    const r = rig(() => false);
    const player = new THREE.Vector3(0, 1.6, 0);
    const f = brawler(r, 8, player);
    run(r, player, () => f.wave.active, 60 * 25);
    expect(f.wave.active, "the ring landed").toBe(true);
    // Still not vulnerable while the ring grows out past 3 m.
    run(r, player, () => f.wave.radius >= 4, 60 * 3);
    expect(r.hits, "the band went under them").toEqual([]);
  });

  it("8. no leap with both legs gone; an arm does not stop it", () => {
    const r = rig();
    const player = new THREE.Vector3(0, 1.6, 0);
    const f = brawler(r, 8, player);
    f.parts.delete("legL");
    f.parts.delete("legR");
    run(r, player, () => false, 60 * 10);
    expect(f.legs().length).toBe(0);
    expect(f.state !== "crouch" && f.state !== "leaping", "it crawls instead").toBe(true);
    const g = brawler(r, 8, player);
    g.parts.delete("armL");
    run(r, player, () => g.state === "leaping", 60 * 20);
    expect(g.state, "one arm gone still leaps").toBe("leaping");
  });
});
