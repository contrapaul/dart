import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { SpawnFx } from "../../src/foamers/spawn-fx";
import { SPAWN_IN } from "../../src/foamers/spawn-in";

const DT = 1 / 60;

function rig() {
  return new SpawnFx(SPAWN_IN);
}

function allChildren(fx: SpawnFx): number {
  let n = 0;
  fx.group.traverse(() => n++);
  return n;
}

describe("spawn-fx", () => {
  it("start shows an arrival and live counts it", () => {
    const fx = rig();
    const feet = new THREE.Vector3(1, 0, 2);
    expect(fx.live).toBe(0);
    expect(fx.start(feet, 1.8, 0x66ccff)).toBe(true);
    expect(fx.live).toBe(1);
    const visible = fx.group.children.filter((g) => g.visible);
    expect(visible.length).toBe(1);
  });

  it("the ring's radius grows then shrinks", () => {
    const fx = rig();
    fx.start(new THREE.Vector3(0, 0, 0), 1.8, 0xffffff);
    const ring = fx.group.children.find((g) => g.visible)!.children[0] as THREE.Mesh;
    const radii: number[] = [];
    let t = 0;
    const portalTime = SPAWN_IN.portalShare * SPAWN_IN.seconds;
    while (t + DT <= portalTime) {
      fx.update(DT);
      t += DT;
      radii.push(ring.scale.x);
    }
    for (let i = 1; i < radii.length; i++) {
      expect(radii[i]).toBeGreaterThan(radii[i - 1]);
    }
    const peak = Math.max(...radii);
    for (let i = 0; i < 10; i++) fx.update(DT);
    expect(ring.scale.x).toBeLessThan(peak);
    while (t < SPAWN_IN.seconds) {
      fx.update(DT);
      t += DT;
    }
    expect(fx.live).toBe(0);
  });

  it("after seconds everything is hidden and live is 0", () => {
    const fx = rig();
    fx.start(new THREE.Vector3(0, 0, 0), 1.8, 0xffffff);
    for (let i = 0; i < Math.ceil(SPAWN_IN.seconds / DT) + 2; i++) fx.update(DT);
    expect(fx.live).toBe(0);
    expect(fx.group.children.every((g) => !g.visible)).toBe(true);
  });

  it("the cap holds", () => {
    const fx = rig();
    for (let i = 0; i < SPAWN_IN.maxLive; i++) {
      expect(fx.start(new THREE.Vector3(i * 3, 0, 0), 1.8, 0xffffff)).toBe(true);
    }
    expect(fx.live).toBe(SPAWN_IN.maxLive);
    expect(fx.start(new THREE.Vector3(99, 0, 0), 1.8, 0xffffff)).toBe(false);
  });

  it("the same start gives the same chunk directions", () => {
    const fx = rig();
    const feet = new THREE.Vector3(1, 0, 1);
    fx.start(feet, 1.8, 0x66ccff);
    const arrival = fx.group.children.find((g) => g.visible) as THREE.Group;
    const dirs = arrival.children.slice(2).map((m) => (m as THREE.Mesh).position.clone());
    fx.update(DT * 5);
    const dirs1 = arrival.children.slice(2).map((m) => (m as THREE.Mesh).position.clone());
    fx.clear();
    fx.start(feet.clone(), 1.8, 0x66ccff);
    const arrival2 = fx.group.children.find((g) => g.visible) as THREE.Group;
    fx.update(DT * 5);
    const dirs2 = arrival2.children.slice(2).map((m) => (m as THREE.Mesh).position.clone());
    expect(dirs2.length).toBe(dirs1.length);
    for (let i = 0; i < dirs2.length; i++) {
      expect(dirs2[i].x).toBeCloseTo(dirs1[i].x, 5);
      expect(dirs2[i].y).toBeCloseTo(dirs1[i].y, 5);
      expect(dirs2[i].z).toBeCloseTo(dirs1[i].z, 5);
    }
    void dirs;
  });

  it("update makes no new objects (count the group's children before and after)", () => {
    const fx = rig();
    fx.start(new THREE.Vector3(0, 0, 0), 1.8, 0xffffff);
    const before = allChildren(fx);
    for (let i = 0; i < 10; i++) fx.update(DT);
    expect(allChildren(fx)).toBe(before);
  });
});
