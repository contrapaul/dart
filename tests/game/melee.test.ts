import { beforeAll, describe, expect, it } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { Melee, meleePress } from "../../src/game/melee";
import type { Shield } from "../../src/player/shield";
import { FoamerSystem } from "../../src/foamers/foamers";
import { DartSystem } from "../../src/weapons/darts";
import { DebrisSystem } from "../../src/voxel/debris";
import type { VoxelTarget } from "../../src/weapons/impacts";
import { VoxelVolume } from "../../src/voxel/chunk";
import { greedyMesh } from "../../src/voxel/mesher";
import { linearColorTable } from "../../src/voxel/materials";
import type { Foamer } from "../../src/foamers/foamer";
import meleeJson from "../../data/melee.json";
import playerJson from "../../data/player.json";

// GAME-06: melee weapon 1 and its charges. The rig is the throw test's:
// a real world with a floor, a real capsule for the player, real spawned
// Foamers, and voxel walls that serve as sight blockers and carve targets.
// Every number is from data/melee.json.

const T = meleeJson as unknown as typeof meleeJson & {
  bash: { damage: number; cooldown: number };
  weapons: Record<string, { hits: { damage: number; stagger?: boolean }[] }>;
};
const DT = 1 / 60;
const EYE = playerJson.eyeHeight;
const VS = 0.1;
const FOAM = 3;

function fakeMesher() {
  const colors = linearColorTable();
  return { mesh: (padded: never) => Promise.resolve(greedyMesh(padded, colors)) };
}

/** A 1 x 3 x 3 m voxel wall (a sight blocker; its cuboid collider is what
 *  the rays meet), as the throw test's. */
function makeWall(world: RAPIER.World, x: number, z: number) {
  const volume = new VoxelVolume(VS);
  volume.fillBox(0, 0, 0, 9, 29, 29, FOAM);
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  const collider = world.createCollider(
    RAPIER.ColliderDesc.cuboid(0.5, 1.5, 1.5).setTranslation(x, 1.5, z),
    body,
  );
  const target: VoxelTarget = {
    volume,
    owns: (c) => c === collider,
    worldToVoxel: (v) => v.set(v.x - (x - 0.5), v.y, v.z - (z - 1.5)).divideScalar(VS),
    voxelToWorld: (v) => v.multiplyScalar(VS).set(v.x + x - 0.5, v.y, v.z + z - 1.5),
  };
  return { target, collider };
}

/** The lowered, uncharged shield the page reports when nothing is up. */
const DOWN = { state: "lowered", charging: false, parries: 0 } as unknown as Shield;

function rig() {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.createCollider(RAPIER.ColliderDesc.cuboid(40, 0.5, 40).setTranslation(0, -0.5, 0));
  const pb = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  const ignore = world.createCollider(
    RAPIER.ColliderDesc.capsule(0.5, 0.3).setTranslation(0, 0, 200),
    pb,
  );
  const scene = new THREE.Scene();
  const darts = new DartSystem(scene, world, RAPIER, ignore);
  const debris = new DebrisSystem(RAPIER, world);
  const targets: VoxelTarget[] = [];
  const foamers = new FoamerSystem(RAPIER, world, fakeMesher(), debris, darts, targets);
  const playerCollider = world.createCollider(
    RAPIER.ColliderDesc.capsule(0.6, 0.3).setTranslation(0, 0.9, 0),
  );
  const melee = new Melee(RAPIER, world, foamers, debris, targets, playerCollider);
  world.step();
  return { world, foamers, melee, targets, playerCollider };
}

/** The eye and the view aimed at the Foamer's chest (a player aims). */
const _eye = new THREE.Vector3();
const _fwd = new THREE.Vector3();
function aimAt(f: Foamer, eye = _eye.set(0, EYE, 0)) {
  _fwd.set(f.centre.x - eye.x, f.centre.y + f.height * 0.5 - eye.y, f.centre.z - eye.z).normalize();
  return { eye, fwd: _fwd };
}

/** A press at the Foamer with the view on its chest. */
function swing(g: ReturnType<typeof rig>, f: Foamer, shield: Shield = DOWN) {
  const { eye, fwd } = aimAt(f);
  return g.melee.press(eye, fwd, shield);
}

beforeAll(async () => {
  await RAPIER.init();
});

/** Steps past the swing (with a frame of margin) so the next press is open. */
function rest(g: ReturnType<typeof rig>) {
  for (let i = 0; i < Math.ceil((T.swingTime + 0.05) / DT); i++) g.melee.update(DT, DOWN);
}

describe("GAME-06: the combo", () => {
  it("1. presses inside the combo window step through the hits, a late one restarts", () => {
    const g = rig();
    const f = g.foamers.spawn(new THREE.Vector3(0, 0, -1.6))!;
    expect(swing(g, f).swung).toBe(0);
    rest(g); // the swing runs out
    expect(swing(g, f).swung).toBe(1);
    rest(g);
    expect(swing(g, f).swung).toBe(2);
    // Still inside the window from the last press: it would be hit 4, but
    // the combo has three hits, so it wraps to the first.
    rest(g);
    g.melee.charges = T.charges; // (the test swung three charges away)
    expect(swing(g, f).swung).toBe(0);
    // A press after the window starts again at hit 1.
    g.melee.charges = T.charges;
    for (let i = 0; i < Math.ceil((T.comboWindow + 0.1) / DT); i++) g.melee.update(DT, DOWN);
    expect(swing(g, f).swung).toBe(0);
  });

  it("2. each charged hit spends one charge; hit 3 staggers and knocks back", () => {
    const g = rig();
    const f = g.foamers.spawn(new THREE.Vector3(0, 0, -1.6))!;
    const hp0 = f.health;
    const z0 = f.centre.z;
    expect(g.melee.charges).toBe(T.charges);
    swing(g, f);
    expect(g.melee.charges).toBe(T.charges - 1);
    rest(g);
    swing(g, f);
    expect(g.melee.charges).toBe(T.charges - 2);
    rest(g);
    swing(g, f);
    expect(g.melee.charges).toBe(T.charges - 3);
    // The data's three hits land their damage.
    const want = T.weapons.M01.hits.reduce((s, h) => s + h.damage, 0);
    expect(hp0 - f.health).toBeCloseTo(want, 5);
    // Hit 3 staggers (the short stagger) and knocks the Foamer back along
    // the line from the player (its own knockStep moved it).
    expect(f.state).toBe("stagger");
    expect(f.staggerLong).toBe(false);
    expect(f.centre.z).toBeLessThan(z0 - 0.5);
  });

  it("3. a hit takes only Foamers in reach, arc and sight, at most maxTargets", () => {
    const g = rig();
    const near = g.foamers.spawn(new THREE.Vector3(0, 0, -1.6))!;
    // Out of reach on the view.
    const far = g.foamers.spawn(new THREE.Vector3(0, 0, -(T.reach + 1)))!;
    // Far to the side of the 70 degree arc.
    const side = g.foamers.spawn(new THREE.Vector3(2.5, 0, -1.4))!;
    // Behind a sight wall, off to one side so the near one stays in sight.
    const wall = makeWall(g.world, 3, -0.9);
    g.targets.push(wall.target);
    const blocked = g.foamers.spawn(new THREE.Vector3(3, 0, -1.7))!;
    g.world.step();
    const e = swing(g, near);
    expect(e.hits).toContain(near);
    expect(e.hits).not.toContain(far);
    expect(e.hits).not.toContain(side);
    expect(e.hits).not.toContain(blocked);
    g.targets.length = 0;
    g.world.removeCollider(wall.collider, false);
    // Five in the arc: the cap picks the nearest maxTargets.
    const extra: Foamer[] = [near];
    for (let i = 1; i < 5; i++)
      extra.push(g.foamers.spawn(new THREE.Vector3(0.12 * i, 0, -1.5 - 0.05 * i))!);
    for (const f of extra) f.health = f.maxHealth; // so none goes down mid-test
    g.world.step();
    rest(g); // the first swing has to finish before the second press
    g.melee.charges = T.charges;
    const e2 = swing(g, near);
    expect(e2.hits.length).toBe(T.maxTargets);
    expect(e2.hits).toContain(near); // the nearest
  });

  it("4. the swing time gates the next press", () => {
    const g = rig();
    const f = g.foamers.spawn(new THREE.Vector3(0, 0, -1.6))!;
    expect(swing(g, f).swung).toBe(0);
    // A press during the swing does nothing.
    expect(swing(g, f).swung).toBe(null);
    const charges = g.melee.charges;
    rest(g);
    expect(swing(g, f).swung).toBe(1);
    expect(g.melee.charges).toBe(charges - 1);
  });
});

describe("GAME-06: the shield bash", () => {
  it("5. no charge gives a weak bash with no stagger, then a longer cooldown", () => {
    const g = rig();
    // Inside the bash's own (shorter) reach.
    const f = g.foamers.spawn(new THREE.Vector3(0, 0, -1.0))!;
    g.melee.charges = 0;
    const hp0 = f.health;
    const e = swing(g, f);
    expect(e.swung).toBe(-1); // the bash
    expect(hp0 - f.health).toBeCloseTo(T.bash.damage, 5);
    expect(f.state).not.toBe("stagger"); // never staggers
    // The longer cooldown: the next press is the empty click, not a bash.
    expect(swing(g, f).swung).toBe(null);
    expect(swing(g, f).empty).toBe(true);
    for (let i = 0; i < Math.ceil((T.bash.cooldown + 0.1) / DT); i++) g.melee.update(DT, DOWN);
    expect(swing(g, f).swung).toBe(-1);
    expect(g.melee.charges).toBe(0); // a bash never spends a charge
  });
});

describe("GAME-06: the charges", () => {
  it("6. a parry and the timer each refill one, never past the max", () => {
    const g = rig();
    const f = g.foamers.spawn(new THREE.Vector3(0, 0, -1.6))!;
    swing(g, f); // 3 to 2
    const parryShield = { state: "lowered", charging: false, parries: 1 } as unknown as Shield;
    const e = g.melee.update(DT, parryShield);
    expect(e.refills).toBe(1);
    expect(g.melee.charges).toBe(T.charges);
    // Full: a second parry refills nothing.
    const e2 = g.melee.update(DT, { ...parryShield, parries: 2 } as unknown as Shield);
    expect(e2.refills).toBe(0);
    // The timer: below full, one comes back every rechargeSeconds.
    g.melee.charges = 1;
    let refills = 0;
    for (let i = 0; i < Math.ceil(T.rechargeSeconds / DT) + 2; i++)
      refills += g.melee.update(DT, DOWN).refills;
    expect(refills).toBe(1);
    expect(g.melee.charges).toBe(2);
    // Full again and the clock waits at full.
    g.melee.charges = T.charges;
    for (let i = 0; i < Math.ceil((T.rechargeSeconds + 1) / DT); i++)
      expect(g.melee.update(DT, DOWN).refills).toBe(0);
    g.melee.charges = T.charges - 1;
    for (let i = 0; i < Math.ceil(T.rechargeSeconds / DT) + 2; i++) g.melee.update(DT, DOWN);
    expect(g.melee.charges).toBe(T.charges);
  });

  it("7. reset refills for the level start and the retry", () => {
    const g = rig();
    g.melee.charges = 0;
    g.melee.comboStep = 2;
    g.melee.reset();
    expect(g.melee.charges).toBe(T.charges);
    expect(g.melee.comboStep).toBe(0);
  });
});

describe("GAME-06: the rules with the shield and the finisher", () => {
  it("8. no swing with the disc raised or a charge running; a thrown disc is fine", () => {
    const g = rig();
    const f = g.foamers.spawn(new THREE.Vector3(0, 0, -1.6))!;
    const raised = { state: "raised", charging: false, parries: 0 } as unknown as Shield;
    expect(swing(g, f, raised).swung).toBe(null);
    const charging = { state: "raised", charging: true, parries: 0 } as unknown as Shield;
    expect(swing(g, f, charging).swung).toBe(null);
    const thrown = { state: "thrown", charging: false, parries: 0 } as unknown as Shield;
    expect(swing(g, f, thrown).swung).toBe(0);
    expect(g.melee.charges).toBe(T.charges - 1);
  });

  it("9. a finisher target still takes the melee press first", () => {
    const g = rig();
    const f = g.foamers.spawn(new THREE.Vector3(0, 0, -1.6))!;
    // The key order: when the finisher takes the press, the melee does not
    // see it at all (no charge spent, no combo step).
    const e = meleePress(g.melee, _eye.set(0, EYE, 0), _fwd.set(0, 0, -1), DOWN, () => true);
    expect(e).toBe(null);
    expect(g.melee.charges).toBe(T.charges);
    expect(g.melee.comboStep).toBe(0);
    // When none is finishable, the press reaches the weapon.
    const e2 = meleePress(g.melee, aimAt(f).eye, aimAt(f).fwd, DOWN, () => false);
    expect(e2?.swung).toBe(0);
    expect(g.melee.charges).toBe(T.charges - 1);
  });
});
