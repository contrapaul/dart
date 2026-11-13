import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { BlastFx } from "../../src/render/blast-fx";
import fxJson from "../../data/explosion.json";

const FX = fxJson.fx;

describe("BlastFx pool", () => {
  it("builds a fixed pool and allocates no new children or materials on spawn", () => {
    const scene = new THREE.Scene();
    const fx = new BlastFx(scene);
    const beforeChildren = fx.group.children.length;
    const beforeMaterials = new Set(
      fx.group.children.map((child) => (child as THREE.Mesh).material),
    );
    expect(beforeChildren).toBe(FX.maxLive * 2);
    expect(beforeMaterials.size).toBe(FX.maxLive * 2);

    const point = new THREE.Vector3();
    for (let i = 0; i < 50; i++) fx.spawn(point.set(i, 0, 0), 1 + i * 0.1);

    expect(fx.group.children.length).toBe(beforeChildren);
    expect(new Set(fx.group.children.map((c) => (c as THREE.Mesh).material)).size).toBe(
      beforeMaterials.size,
    );
  });

  it("never holds more than maxLive live blasts and reuses the oldest", () => {
    const scene = new THREE.Scene();
    const fx = new BlastFx(scene);
    const point = new THREE.Vector3();

    for (let i = 0; i < FX.maxLive; i++) fx.spawn(point.set(i, 0, 0), 1);
    expect(fx.live).toBe(FX.maxLive);

    fx.update(0.1);
    const firstFlash = fx.group.children[0] as THREE.Mesh;
    fx.spawn(point.set(99, 0, 0), 1);

    expect(fx.live).toBe(FX.maxLive);
    expect(firstFlash.position.x).toBe(99);

    fx.update(1);
    expect(fx.live).toBe(0);
    expect(fx.group.children.every((child) => !child.visible)).toBe(true);
  });
});
