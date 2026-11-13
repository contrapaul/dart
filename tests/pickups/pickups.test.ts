import { beforeAll, describe, expect, it } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { PickupSystem } from "../../src/pickups/pickups";
import { PlayerHealth } from "../../src/player/health";
import pickupData from "../../data/pickups.json";
import { Blaster, resolveSpec } from "../../src/weapons/blaster";
import type { DartFiring } from "../../src/weapons/blaster";
import type { DartTypeName } from "../../src/weapons/dart-model";
import pitJson from "../../data/levels/1-1-pit.json";
import ringJson from "../../data/levels/1-4-ring.json";
import type { Level } from "../../src/level/format";

const DT = 1 / 60;
const H = pickupData.health;
const A = pickupData.ammo;

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

// A fake dart system: enough for the Blaster's constructor; the tests never
//  update it, so it keeps nothing.
class NullDarts implements DartFiring {
  readonly origins: THREE.Vector3[] = [];
  readonly dirs: THREE.Vector3[] = [];
  readonly types: DartTypeName[] = [];
  fire(o: THREE.Vector3, d: THREE.Vector3, t: DartTypeName): void {
    this.origins.push(o);
    this.dirs.push(d.clone());
    this.types.push(t);
  }
  get n(): number { return this.dirs.length; }
}

/** The blaster B01 (standard darts) with a given reserve and dart type. */
function blaster(reserve: number, dartType: DartTypeName = "standard"): Blaster {
  const b = new Blaster(resolveSpec("B01"), new NullDarts(), () => new THREE.Vector3());
  b.dartType = dartType;
  b.reserve = reserve;
  return b;
}

/** The rig including the blasters an ammo box refills. */
function ammoRig(blist: Blaster[]) {
  const r = rig();
  r.pickups.blasters = blist;
  return r;
}

describe("PickupSystem (LVL-02a, the ammo box)", () => {
  const BOX = new THREE.Vector3(0, A.size / 2, 0);

  it("walks in and adds its count to the reserve of every blaster that takes that type", () => {
    const a = blaster(10, "standard");
    const r = ammoRig([a]);
    let onC = 0;
    r.pickups.onCollected = () => { onC++; };
    r.pickups.spawn("ammo", BOX, new THREE.Vector3(), "standard", 24);
    tick(r, new THREE.Vector3(0, 0, 0));
    expect(a.reserve).toBe(10 + 24);
    expect(r.pickups.count("ammo")).toBe(0);
    expect(onC).toBe(1);
  });

  it("never takes the reserve past reserveMax: any overage is not in the box", () => {
    // B01's reserve_max is 40; 30 in the room, the box has 24 -> take only 10.
    const a = blaster(30, "standard");
    const r = ammoRig([a]);
    r.pickups.spawn("ammo", BOX, new THREE.Vector3(), "standard", 24);
    tick(r, new THREE.Vector3(0, 0, 0));
    expect(a.reserve).toBe(a.spec.reserveMax);
    expect(r.pickups.count("ammo")).toBe(0); // the darts stayed fully in
  });

  it("only takes blasters of the box's dart type", () => {
    const std = blaster(10, "standard");
    const slg = blaster(10, "slug");
    const r = ammoRig([std, slg]);
    r.pickups.spawn("ammo", BOX, new THREE.Vector3(), "standard", 24);
    tick(r, new THREE.Vector3(0, 0, 0));
    expect(std.reserve).toBe(34);
    expect(slg.reserve).toBe(10); // the slug blaster does not take standard darts
    expect(r.pickups.count("ammo")).toBe(0);
  });

  it("stays put at a high reserve, it doesn't scavenge dart space if no blaster has room", () => {
    const a = blaster(40, "standard"); // full
    const r = ammoRig([a]);
    r.pickups.spawn("ammo", BOX, new THREE.Vector3(), "standard", 24);
    for (let i = 0; i < 30; i++) tick(r, new THREE.Vector3(0, 0, 0));
    expect(a.reserve).toBe(40);
    expect(r.pickups.count("ammo")).toBe(1); // it stays put, not consumed
  });

  it("a dead player can never pick up the box", () => {
    const a = blaster(10, "standard");
    const r = ammoRig([a]);
    r.health.hp = 0;
    r.pickups.spawn("ammo", BOX, new THREE.Vector3(), "standard", 24);
    for (let i = 0; i < 30; i++) tick(r, new THREE.Vector3(0, 0, 0));
    expect(a.reserve).toBe(10);
    expect(r.pickups.count("ammo")).toBe(1);
  });
});

// LVL-02a: the level loader places the file's ammo boxes.
describe("PickupSystem.loadLevelBoxes (LVL-02a)", () => {
  const pit = pitJson as unknown as Level;
  const ring = ringJson as unknown as Level;

  it("spawns every darts-* entry of the Pit file as an ammo box", () => {
    const r = rig();
    r.pickups.loadLevelBoxes(pit);
    expect(r.pickups.count("ammo")).toBe(2); // pit-ammo and pit-ammo-far
    // LVL-05: the Pit also places its blaster pickup (the B01).
    expect(r.pickups.count("blaster")).toBe(1);
    for (const it of r.pickups.list.filter((p) => p.kind === "ammo")) {
      expect(it.dartType).toBe("standard");
      expect(it.dartCount).toBe(20);
    }
  });

  it("spawns the Ring's two boxes, one by each pillar", () => {
    const r = rig();
    r.pickups.loadLevelBoxes(ring);
    expect(r.pickups.count("ammo")).toBe(2);
    const xs = r.pickups.list.map((it) => Math.round(it.body.translation().x)).sort((a, b) => a - b);
    // The pillars stand at x -11 and x 11 (data/levels/1-4-ring.json).
    expect(xs).toEqual([-11, 11]);
  });

  it("a restart (clear, then loadLevelBoxes) brings the boxes back", () => {
    const r = rig();
    const one = blaster(10, "standard");
    r.pickups.blasters = [one];
    r.pickups.loadLevelBoxes(pit);
    // Walk over one of the boxes until a blaster takes it.
    const t = r.pickups.list[0]!.body.translation();
    for (let i = 0; i < 240 && r.pickups.count("ammo") > 1; i++) {
      r.pickups.update(DT, new THREE.Vector3(t.x, 0, t.z));
      r.world.step();
    }
    expect(r.pickups.count("ammo")).toBe(1);
    expect(one.reserve).toBeGreaterThan(10);
    // Try again / Play again: the arena clears everything, then the file's
    // boxes are placed again.
    r.pickups.clear();
    r.pickups.loadLevelBoxes(pit);
    expect(r.pickups.count("ammo")).toBe(2);
  });
});

// LVL-02a review (Claude): the cap is per kind, and a box fills every
// blaster of its dart type with its full count (the card's rule).
describe("PickupSystem (LVL-02a review)", () => {
  it("a health spray at its cap never removes a placed ammo box", () => {
    const r = rig();
    r.pickups.loadLevelBoxes(pitJson as unknown as Level);
    expect(r.pickups.count("ammo")).toBe(2);
    // Far more blobs than the health cap: the oldest blobs go, not the boxes.
    for (let i = 0; i < H.max + 6; i++) {
      r.pickups.spawn("health", new THREE.Vector3(0, 1, 0), new THREE.Vector3());
    }
    expect(r.pickups.count("ammo")).toBe(2);
    expect(r.pickups.count("health")).toBe(H.max);
  });

  it("adds its full count to every blaster that takes its dart type", () => {
    const a = blaster(10, "standard");
    const b = blaster(10, "standard");
    const r = ammoRig([a, b]);
    r.pickups.spawn("ammo", new THREE.Vector3(0, A.size / 2, 0), new THREE.Vector3(), "standard", 4);
    tick(r, new THREE.Vector3(0, 0, 0));
    expect(a.reserve).toBe(14);
    expect(b.reserve).toBe(14);
    expect(r.pickups.count("ammo")).toBe(0);
  });
});
