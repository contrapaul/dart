import { beforeAll, describe, expect, it } from "vitest";
import RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { createPhysics } from "../../src/physics/world";
import { PhysicsObjects, impactDamage } from "../../src/level/physics-objects";
import tuning from "../../data/physics.json";
import type { PhysicsObject } from "../../src/level/format";

// ED-33: the physics objects, headless. Rapier runs in Node (see
// tests/level/breakables-hit.test.ts): a floor collider is enough of a
// world for gravity, impulses, sleeping and breaking.

const T = tuning as unknown as {
  damageSpeed: number; dartImpulse: number; blastImpulse: number; maxLive: number;
};

beforeAll(async () => {
  await RAPIER.init();
});

const box = (over: Partial<PhysicsObject> = {}): PhysicsObject => ({
  id: "box", shape: "box", pos: [0, 3, 0], size: [1, 1, 1],
  colour: "#ff7a1a", mass: 5, damage: 0, ...over,
});

async function make(specs: PhysicsObject[]) {
  const physics = await createPhysics();
  const { rapier, world } = physics;
  // A 20 m square floor, its top at y = 0.
  world.createCollider(rapier.ColliderDesc.cuboid(10, 0.5, 10).setTranslation(0, -0.5, 0));
  const objects = new PhysicsObjects(rapier, world, new THREE.Group(), specs);
  return { rapier, world, objects };
}

/** Steps the world and the objects the way the page does. */
function run(env: { world: RAPIER.World; objects: PhysicsObjects }, steps: number, dt = 1 / 60) {
  for (let i = 0; i < steps; i++) {
    env.world.step();
    env.objects.update(dt);
  }
}

let hits = 0;
let dealt = 0;
const target = (position: THREE.Vector3, radius = 0.5) => ({
  key: "player",
  position,
  radius,
  hit: (amount: number) => { hits++; dealt = amount; },
});

describe("impactDamage", () => {
  it("is nothing under the threshold and the formula past it", () => {
    expect(impactDamage(2, T.damageSpeed)).toBe(0);
    expect(impactDamage(2, 1)).toBe(0);
    expect(impactDamage(2, T.damageSpeed + 3)).toBe(6);
    expect(impactDamage(0, 100)).toBe(0);
  });
});

describe("a physics object", () => {
  it("falls and comes to rest on the floor", async () => {
    const env = await make([box()]);
    run(env, 240);
    const o = env.objects.list[0]!;
    const t = o.body.translation();
    // A 1 m box's centre rests half a metre up, give or take the solver.
    expect(t.y).toBeGreaterThan(0.4);
    expect(t.y).toBeLessThan(0.6);
    expect(Math.abs(o.body.linvel().y)).toBeLessThan(0.1);
  });

  it("has the mass the level asked for, whatever its shape", async () => {
    const env = await make([
      box({ id: "b", mass: 5 }),
      box({ id: "c", shape: "cylinder", mass: 12, size: [0.6, 1.4, 0.6] }),
      box({ id: "s", shape: "sphere", mass: 3, size: [0.8, 0.8, 0.8] }),
    ]);
    const byId = new Map(env.objects.list.map((o) => [o.spec.id, o]));
    expect(byId.get("b")!.body.mass()).toBeCloseTo(5, 3);
    expect(byId.get("c")!.body.mass()).toBeCloseTo(12, 3);
    expect(byId.get("s")!.body.mass()).toBeCloseTo(3, 3);
  });

  it("is shoved by a dart, along the dart's travel", async () => {
    const env = await make([box({ pos: [0, 0.5, 0] })]);
    run(env, 10);
    const o = env.objects.list[0]!;
    expect(o.body.linvel().x).toBeCloseTo(0, 3);
    env.objects.onDartHit({
      collider: o.collider, point: new THREE.Vector3(-0.5, 0.5, 0), normal: new THREE.Vector3(1, 0, 0),
      direction: new THREE.Vector3(1, 0, 0), speed: 20, type: "standard", material: null, shot: null,
    });
    // A standard dart's impulse over the object's mass is the speed it takes.
    expect(o.body.linvel().x).toBeCloseTo(T.dartImpulse / 5, 2);
  });

  it("is shoved away from a blast, and harder at its centre", async () => {
    const env = await make([
      box({ id: "near", pos: [0, 0.5, 0] }),
      box({ id: "far", pos: [0, 0.5, 2] }),
    ]);
    run(env, 10);
    // One metre and three metres from a blast a metre before both.
    env.objects.blast(new THREE.Vector3(0, 0.5, -1), "dart");
    const near = env.objects.list[0]!;
    const far = env.objects.list[1]!;
    expect(near.body.linvel().z).toBeGreaterThan(far.body.linvel().z);
  });
});

describe("a physics object that hits a player", () => {
  it("deals the formula's damage once at speed", async () => {
    hits = 0; dealt = 0;
    const env = await make([box({ id: "fast", pos: [0, 0, 0.8], damage: 2 })]);
    env.objects.targets = () => [target(new THREE.Vector3(0, 0, 0))];
    const o = env.objects.list[0]!;
    o.body.setLinvel({ x: 0, y: 0, z: -10 }, true);
    env.objects.update(1 / 60);
    env.objects.update(1 / 60);
    env.objects.update(1 / 60);
    expect(hits).toBe(1);
    expect(dealt).toBeCloseTo(2 * (10 - T.damageSpeed), 1);
  });

  it("deals none below the threshold", async () => {
    hits = 0; dealt = 0;
    const env = await make([box({ id: "slow", pos: [0, 0, 0.8], damage: 2 })]);
    env.objects.targets = () => [target(new THREE.Vector3(0, 0, 0))];
    const o = env.objects.list[0]!;
    o.body.setLinvel({ x: 0, y: 0, z: -(T.damageSpeed - 1) }, true);
    env.objects.update(1 / 60);
    expect(hits).toBe(0);
  });
});

describe("a breakable physics object", () => {
  it("shatters into foam chunks at zero hit points", async () => {
    const env = await make([box({ id: "crate", pos: [0, 0.5, 0], breakable: true, hitPoints: 12 })]);
    let bursts = 0;
    env.objects.debris = { burst: () => { bursts++; } } as never;
    const o = env.objects.list[0]!;
    const hit = (type: string) => env.objects.onDartHit({
      collider: o.collider, point: new THREE.Vector3(-0.5, 0.5, 0), normal: new THREE.Vector3(1, 0, 0),
      direction: new THREE.Vector3(1, 0, 0), speed: 20, type: type as never,
      material: null, shot: null,
    });
    // A slug dart deals 6 a Foamer, so half of twelve.
    hit("slug");
    expect(env.objects.hpOf("crate")).toBeGreaterThan(0);
    expect(o.alive).toBe(true);
    // A buck dart deals 11: the twelve left go at the second hit.
    hit("buck");
    expect(env.objects.hpOf("crate")).toBe(0);
    expect(o.alive).toBe(false);
    expect(o.mesh.visible).toBe(false);
    expect(o.body.isEnabled()).toBe(false);
    expect(bursts).toBe(1);
  });
});

describe("restart and the awake cap", () => {
  it("puts every object back where the level put it", async () => {
    const env = await make([box({ id: "b", pos: [0, 3, 0], breakable: true, hitPoints: 5, asleep: true })]);
    const o = env.objects.list[0]!;
    o.body.setTranslation({ x: 4, y: 2, z: 1 }, true);
    env.objects.onDartHit({
      collider: o.collider, point: new THREE.Vector3(0, 3, 0), normal: new THREE.Vector3(0, 1, 0),
      direction: new THREE.Vector3(0, 1, 0), speed: 20, type: "buck", material: null, shot: null,
    });
    expect(o.alive).toBe(false);
    env.objects.reset();
    const t = o.body.translation();
    expect(t.x).toBeCloseTo(0, 5);
    expect(t.y).toBeCloseTo(3, 5);
    expect(env.objects.hpOf("b")).toBe(5);
    expect(o.alive).toBe(true);
    expect(o.body.isSleeping()).toBe(true);
  });

  it("holds the awake cap with more objects than it allows", async () => {
    const specs: PhysicsObject[] = [];
    for (let i = 0; i < T.maxLive + 5; i++) {
      specs.push(box({ id: `o${i}`, pos: [i * 2, 0.5, 0], asleep: false }));
    }
    const env = await make(specs);
    env.world.step();
    env.objects.update(1 / 60);
    expect(env.objects.awake).toBeLessThanOrEqual(T.maxLive);
  });
});
