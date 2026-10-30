import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { CHUNK_SIZE } from "../../src/voxel/chunk";
import { createFoamMaterial, patchFoamShader, voxelFoamMaterial } from "../../src/render/foam-material";
import renderJson from "../../data/render.json";

const F = renderJson.foam;
type FakeShader = { uniforms: Record<string, { value: number }>; vertexShader: string; fragmentShader: string };
function fakeShader(): FakeShader {
  return {
    uniforms: {},
    vertexShader: THREE.ShaderLib.standard.vertexShader,
    fragmentShader: THREE.ShaderLib.standard.fragmentShader,
  };
}

describe("patchFoamShader", () => {
  const ref = THREE.ShaderLib.standard;

  it("patches the stock standard shader without losing any include", () => {
    const out = patchFoamShader(ref.vertexShader, ref.fragmentShader);
    expect(out.vertexShader).toContain("vFoamPos");
    expect(out.fragmentShader).toContain("vFoamPos");
    expect(out.fragmentShader).toContain("uPoreDepth");
    expect(out.fragmentShader).toContain("totalEmissiveRadiance +=");
    for (const include of new Set(ref.fragmentShader.match(/^#include <.*>$/gm) ?? [])) {
      expect(out.fragmentShader).toContain(include);
    }
    for (const include of new Set(ref.vertexShader.match(/^#include <.*>$/gm) ?? [])) {
      expect(out.vertexShader).toContain(include);
    }
  });

  it("throws naming the anchor when one is missing", () => {
    const broken = ref.fragmentShader.replace("#include <emissivemap_fragment>", "");
    expect(() => patchFoamShader(ref.vertexShader, broken)).toThrowError(
      /emissivemap_fragment/,
    );
  });
});

describe("createFoamMaterial", () => {
  it("adds the nine uniforms with data values and caches as foam", () => {
    const m = createFoamMaterial({ cellsPerUnit: 3, wrapCells: 0, color: 0xff0000 });
    expect(m).toBeInstanceOf(THREE.MeshStandardMaterial);
    expect(m.roughness).toBeCloseTo(F.roughness);
    expect(m.color.getHexString()).toBe("ff0000");
    expect(m.customProgramCacheKey()).toBe("foam");
    const shader = fakeShader();
    m.onBeforeCompile!(shader as never, {} as never);
    for (const [name, value] of Object.entries({
      uCellsPerUnit: 3,
      uWrapCells: 0,
      uPoreCoverage: F.poreCoverage,
      uPoreDepth: F.poreDepth,
      uTint: F.tintVariation,
      uRoughVar: F.roughnessVariation,
      uGlow: F.glow,
      uRim: F.rim,
      uRimPower: F.rimPower,
    })) {
      expect(shader.uniforms[name]?.value, name).toBeCloseTo(value);
    }
  });
});

describe("voxelFoamMaterial", () => {
  it("is created once and wraps across chunk seams", () => {
    const a = voxelFoamMaterial();
    const b = voxelFoamMaterial();
    expect(a).toBe(b);
    expect(a.vertexColors).toBe(true);
    const shader = fakeShader();
    a.onBeforeCompile!(shader as never, {} as never);
    expect(shader.uniforms.uWrapCells?.value).toBe(96);
    expect(CHUNK_SIZE * F.poreCellsPerVoxel).toBe(96);
  });
});
