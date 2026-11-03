import { beforeAll, describe, expect, it } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { PickupSystem } from "../../src/pickups/pickups";
import { PlayerHealth } from "../../src/player/health";
import pickupData from "../../data/pickups.json";

const DT = 1 / 60;
const H = pickupData.health;

beforeAll(async () => {
  await RAPIER.init();
});

function rig() {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.createCollider(RAPIER.ColliderDesc.cuboid(40, 0.5, 40).setTranslation(0, -0.5, 0));
  const health = new PlayerHealth();
  const pickups = new PickupSystem(RAPIER, world, new THREE.Scene(), health);
  return { world, health, pickups };
}

/** One fixed step: the system's update, then the world settles the blob. */
function tick(r: ReturnType<typeof rig>, feet: THREE.Vector3, dt = DT) {
  r.pickups.update(dt, feet);
  r.world.step();
}

const FAR = new THREE.Vector3(10, 0, 10);

describe("PickupSystem (GAME-07, the health blob)", () => {
  it("sprays H.count blobs that hop out from the finisher's point", () => {
    const r = rig();
    r.pickups.sprayHealth(new THREE.Vector3(0, 0, 0));
    expect(r.pickups.count("health")).toBe(H.count);
    tick(r, FAR);
    // The spray raises every blob (hopSpeed out of the ground) and sends it
    // flat-ranged of the point it came out of.
    for (const it of r.pickups.list) {
      const v = it.body.linvel();
      expect(Math.hypot(v.x, v.z)).toBeGreaterThan(0);
    }
    // They settle on the floor again, standing still: the hop is bouncy, so
    // give the damping time to stop the roll (ten ticks x six seconds).
    for (let i = 0; i < 480; i++) tick(r, FAR);
    for (const it of r.pickups.list) {
      const v = it.body.linvel();
      expect(Math.hypot(v.x, v.z)).toBeLessThan(H.settleSpeed);
      expect(it.body.translation().y).toBeGreaterThanOrEqual(-0.01);
      expect(it.body.translation().y).toBeLessThan(H.radius + 0.3);
    }
  });

  it("walking over a blob heals, never past the player's max", () => {
    const r = rig();
    r.health.hp = 95; // above the blob's amount
    r.pickups.spawn("health", new THREE.Vector3(0, H.radius, 0), new THREE.Vector3());
    const feet = new THREE.Vector3(0, 0, 0);
    tick(r, feet);
    expect(r.health.hp).toBe(r.health.max); // capped at 100, not 105
    expect(r.pickups.count("health")).toBe(0); // and the blob is gone
  });

  it("at full health the blob is left to stand, and it does not heal past it", () => {
    const r = rig();
    r.health.hp = r.health.max;
    r.pickups.spawn("health", new THREE.Vector3(0, H.radius, 0), new THREE.Vector3());
    const feet = new THREE.Vector3(0, 0, 0);
    for (let i = 0; i < 60; i++) tick(r, feet);
    expect(r.health.hp).toBe(r.health.max);
    expect(r.pickups.count("health")).toBe(1); // stayed, was not consumed
    const t = r.pickups.list[0]!.body.translation();
    // The spend failed every step, so the blob is still in place.
    expect(Math.hypot(t.x, t.z)).toBeLessThan(H.collectRadius);
  });

  it("a dead player never collects", () => {
    const r = rig();
    r.health.hp = 0;
    r.pickups.spawn("health", new THREE.Vector3(0, H.radius, 0), new THREE.Vector3());
    const feet = new THREE.Vector3(0, 0, 0);
    for (let i = 0; i < 60; i++) tick(r, feet);
    expect(r.health.hp).toBe(0);
    expect(r.pickups.count("health")).toBe(1);
  });

  it("lifetime expires a blob out of play, and the cap trims the oldest first", () => {
    const r = rig();
    const life = pickupData.health.lifetime;
    const max = pickupData.health.max;
    pickupData.health.lifetime = 0.2;
    pickupData.health.max = 4;
    try {
      const dissolved: number[] = [];
      r.pickups.onDissolved = () => dissolved.push(1);
      r.pickups.spawn("health", new THREE.Vector3(0, H.radius, 0), new THREE.Vector3());
      const steps = Math.ceil(0.2 / DT) + 2;
      for (let i = 0; i < steps; i++) tick(r, FAR);
      expect(r.pickups.count("health")).toBe(0);
      expect(dissolved).toHaveLength(1);

      const first = [
        r.pickups.spawn("health", new THREE.Vector3(0, H.radius, 0), new THREE.Vector3()),
        r.pickups.spawn("health", new THREE.Vector3(0.4, H.radius, 0), new THREE.Vector3()),
        r.pickups.spawn("health", new THREE.Vector3(0.8, H.radius, 0), new THREE.Vector3()),
        r.pickups.spawn("health", new THREE.Vector3(1.2, H.radius, 0), new THREE.Vector3()),
      ];
      expect(r.pickups.count("health")).toBe(4);
      const latest = r.pickups.spawn("health", new THREE.Vector3(1.6, H.radius, 0), new THREE.Vector3());
      expect(r.pickups.count("health")).toBe(4); // the cap held
      const handles = r.pickups.list.map((it) => it.body.handle);
      expect(handles).not.toContain(first[0]!.body.handle); // the oldest went
      expect(handles).toContain(latest.body.handle); // the newest stays
    } finally {
      pickupData.health.lifetime = life;
      pickupData.health.max = max;
    }
  });

  it("inside attractRadius (and not full health) a blob drifts to the player and is collected", () => {
    const r = rig();
    r.health.hp = 50;
    // Lateral at attractRadius / 2: inside the pull, outside the collect.
    r.pickups.spawn("health", new THREE.Vector3(H.attractRadius / 2, H.radius, 0), new THREE.Vector3());
    const feet = new THREE.Vector3(0, 0, 0);
    expect(r.health.hp).toBe(50);
    let steps = 0;
    while (r.pickups.count("health") > 0 && steps < 240) {
      tick(r, feet);
      steps++;
    }
    expect(steps).toBeGreaterThan(0); // it moved, it did not just sit there
    expect(steps).toBeLessThan(240); // and it arrived in a second or two, not never
    expect(r.health.hp).toBe(60);
    expect(r.pickups.count("health")).toBe(0);
  });
});
