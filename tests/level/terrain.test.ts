import { beforeAll, describe, expect, it } from "vitest";
import RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { createPhysics } from "../../src/physics/world";
import {
  applyBrush, buildTerrain, falloff, flatTerrain, heightAt, layerForPaint, terrainGeometry, tidyTerrain, vertexCount,
} from "../../src/level/terrain";
import type { Terrain } from "../../src/level/format";
import { validateLevel } from "../../src/level/validate";
import { newLevel } from "../../src/editor/doc";

// ED-34: the terrain's heights, brushes, mesh and collider.

const LAYERS: Terrain["layers"] = [
  { surface: "grass", colour: "#b6ff3b" },
  { surface: "rock", colour: "#6f6788" },
];

/** A bumpy terrain whose heights are a known function, so the mesh, the
 *  collider and heightAt can all be checked against it. */
function bumpy(): Terrain {
  const t = flatTerrain([2, -3], 1, 12, 8, 1, LAYERS);
  const W = t.nx + 1;
  for (let j = 0; j <= t.nz; j++) for (let i = 0; i <= t.nx; i++) t.heights[j * W + i] = 0.3 * i + 0.1 * j * j;
  return t;
}

beforeAll(async () => { await RAPIER.init(); });

describe("ED-34 terrain", () => {
  it("1. a flat terrain covers the size asked, centred, with a height per vertex", () => {
    const t = flatTerrain([2, -3], 1, 12, 8, 1, LAYERS);
    expect([t.nx, t.nz]).toEqual([12, 8]);
    expect(t.origin).toEqual([-4, 1, -7]);
    expect(t.heights.length).toBe(vertexCount(t));
    expect(heightAt(t, 2, -3)).toBe(1);
    expect(heightAt(t, 100, 0)).toBeNull();
  });

  it("2. heightAt follows the two triangles per cell", () => {
    const t = bumpy();
    // On a vertex it is the vertex's own height.
    expect(heightAt(t, -4 + 3, -7 + 2)).toBeCloseTo(1 + 0.9 + 0.4);
    // The x slope is a plane, exact anywhere.
    expect(heightAt(t, -4 + 3.5, -7 + 0)).toBeCloseTo(1 + 1.05);
  });

  it("3. the Rapier collider sits where the mesh is drawn", async () => {
    const t = bumpy();
    const { rapier, world } = await createPhysics();
    const group = new THREE.Group();
    const { mesh } = buildTerrain(t, rapier, world, group);
    world.step();
    const raycaster = new THREE.Raycaster();
    mesh.updateMatrixWorld();
    for (const [x, z] of [[-3.2, -6.5], [0.4, -4.1], [5.7, 0.8], [7.9, 0.9], [-3.9, 0.95]] as const) {
      const ray = new rapier.Ray({ x, y: 50, z }, { x: 0, y: -1, z: 0 });
      const hit = world.castRay(ray, 100, true);
      expect(hit, `collider at ${x}, ${z}`).not.toBeNull();
      const colliderY = 50 - hit!.timeOfImpact;
      raycaster.set(new THREE.Vector3(x, 50, z), new THREE.Vector3(0, -1, 0));
      const meshY = raycaster.intersectObject(mesh)[0]?.point.y;
      expect(meshY, `mesh at ${x}, ${z}`).toBeDefined();
      // The x slope is a plane in both; the z term bends per cell, where the
      // collider and the mesh may split a cell along different diagonals.
      expect(colliderY).toBeCloseTo(meshY!, 1);
      expect(meshY!).toBeCloseTo(heightAt(t, x, z)!, 5);
    }
  });

  it("4. the mesh faces up and its colours follow the paint", () => {
    const t = bumpy();
    const geo = terrainGeometry(t);
    const n = geo.getAttribute("normal");
    for (let v = 0; v < n.count; v++) expect(n.getY(v)).toBeGreaterThan(0);
    const c = geo.getAttribute("color");
    const grass = new THREE.Color("#b6ff3b");
    expect(c.getX(0)).toBeCloseTo(grass.r);
  });

  it("5. raise lifts most at the centre and nothing past the radius", () => {
    const t = flatTerrain([0, 0], 0, 20, 20, 1, LAYERS);
    applyBrush(t, 0, 0, { mode: "raise", radius: 3, strength: 2 }, 0.5);
    expect(heightAt(t, 0, 0)).toBeCloseTo(1);
    expect(heightAt(t, 2, 0)!).toBeGreaterThan(0);
    expect(heightAt(t, 2, 0)!).toBeLessThan(1);
    expect(heightAt(t, 3, 0)).toBe(0);
    applyBrush(t, 0, 0, { mode: "lower", radius: 3, strength: 2 }, 0.5);
    expect(heightAt(t, 0, 0)).toBeCloseTo(0);
  });

  it("6. flatten pulls to the target, smooth evens a spike", () => {
    const t = flatTerrain([0, 0], 0, 10, 10, 1, LAYERS);
    applyBrush(t, 0, 0, { mode: "raise", radius: 2, strength: 4 }, 1);
    applyBrush(t, 0, 0, { mode: "flatten", radius: 2, strength: 1000, target: 0.5 }, 1);
    expect(heightAt(t, 0, 0)).toBeCloseTo(0.5);
    const s = flatTerrain([0, 0], 0, 10, 10, 1, LAYERS);
    s.heights[5 * 11 + 5] = 4;
    applyBrush(s, 0, 0, { mode: "smooth", radius: 1.5, strength: 1000 }, 1);
    expect(heightAt(s, 0, 0)).toBeCloseTo(0);
    expect(heightAt(s, 1, 0)).toBeCloseTo(1);
  });

  it("7. noise is repeatable for a seed", () => {
    const a = flatTerrain([0, 0], 0, 10, 10, 1, LAYERS);
    const b = flatTerrain([0, 0], 0, 10, 10, 1, LAYERS);
    applyBrush(a, 0, 0, { mode: "noise", radius: 4, strength: 1, seed: 7 }, 1);
    applyBrush(b, 0, 0, { mode: "noise", radius: 4, strength: 1, seed: 7 }, 1);
    expect(a.heights).toEqual(b.heights);
    expect(a.heights.some((h) => h !== 0)).toBe(true);
  });

  it("8. paint moves weight to a layer and keeps the sum at 255", () => {
    const t = flatTerrain([0, 0], 0, 10, 10, 1, LAYERS);
    applyBrush(t, 0, 0, { mode: "paint", radius: 2, strength: 2, layer: 1 }, 0.25);
    const tidy = tidyTerrain(t);
    const v = 5 * 11 + 5;
    expect(tidy.paint![v * 2 + 1]).toBe(128);
    for (let k = 0; k < vertexCount(t); k++) expect(tidy.paint![k * 2]! + tidy.paint![k * 2 + 1]!).toBe(255);
    expect(falloff(2, 2)).toBe(0);
  });

  it("9. the validator takes a level with terrain, and refuses a wrong count", () => {
    const level = newLevel();
    level.terrain = tidyTerrain(flatTerrain([0, 0], 0, 16, 16, 1, LAYERS));
    expect(validateLevel(level).errors).toEqual([]);
    level.terrain.heights.pop();
    expect(validateLevel(level).errors.some((e) => e.includes("heights must be"))).toBe(true);
  });
});

describe("ED-34 terrain and the Paint tool", () => {
  const FOUR: Terrain["layers"] = [
    { surface: "grass", colour: "#b6ff3b" },
    { surface: "rock", colour: "#6f6788" },
    { surface: "sand", colour: "#ffd23a" },
    { surface: "concrete", colour: "#f4ecdc" },
  ];

  it("paints into a layer that already wears the surface and colour", () => {
    const t = flatTerrain([0, 0], 0, 4, 4, 1, FOUR);
    expect(layerForPaint(t, "sand", "#ffd23a")).toEqual({ layers: t.layers, index: 2 });
    // No colour chosen: any layer with that surface.
    expect(layerForPaint(t, "rock", null).index).toBe(1);
  });

  it("a new look takes over the least painted layer", () => {
    const t = flatTerrain([0, 0], 0, 4, 4, 1, FOUR);
    applyBrush(t, 0, 0, { mode: "paint", radius: 3, strength: 5, layer: 1 }, 1);
    applyBrush(t, 0, 0, { mode: "paint", radius: 1, strength: 5, layer: 2 }, 1);
    const { layers, index } = layerForPaint(t, "brick", "#ff7a1a");
    expect(index).toBe(3);
    expect(layers[3]).toEqual({ surface: "brick", colour: "#ff7a1a" });
    expect(layers.slice(0, 3)).toEqual(FOUR.slice(0, 3));
  });
});

describe("ED-34 terrain surfaces in the mesh", () => {
  it("carries each layer's paint weight per vertex for the texture blend", () => {
    const t = flatTerrain([0, 0], 0, 4, 4, 1, LAYERS);
    applyBrush(t, 0, 0, { mode: "paint", radius: 3, strength: 1000, layer: 1 }, 1);
    const tidy = tidyTerrain(t);
    const w = terrainGeometry(tidy).getAttribute("aTerrainW");
    const centre = 2 * 5 + 2;
    expect(w.getX(centre)).toBeCloseTo(tidy.paint![centre * 2]! / 255);
    expect(w.getY(centre)).toBeCloseTo(tidy.paint![centre * 2 + 1]! / 255);
    expect(w.getZ(centre)).toBe(0);
    // No paint yet: all layer 1.
    const plain = terrainGeometry(flatTerrain([0, 0], 0, 4, 4, 1, LAYERS)).getAttribute("aTerrainW");
    expect([plain.getX(0), plain.getY(0)]).toEqual([1, 0]);
  });
});
