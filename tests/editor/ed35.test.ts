import { describe, expect, it } from "vitest";
import * as THREE from "three";
import editorData from "../../data/editor.json";
import ed01 from "../fixtures/levels/ed-01.json";
import {
  assetIdFromName, base64Of, makeModel, modelAssetOf, modelFileProblem, removeUnusedAssets,
  unusedAssetIds,
} from "../../src/editor/models-editor";
import { validateLevel } from "../../src/level/validate";
import type { Level, ModelAsset, PlacedModel } from "../../src/level/format";

// ED-35: the editor's own part of model import: the asset's id and file
// checks, where a click seats a model, and the models a level no longer
// uses. The panels themselves need a browser; these do not.

const asset = (id: string, name = `${id}.glb`): ModelAsset => ({ id, name, data: "data:model/gltf-binary;base64,AA==" });

const model = (id: string, assetId: string, over: Partial<PlacedModel> = {}): PlacedModel => ({
  id, asset: assetId, pos: [0, 0, 0], behaviour: "solid", ...over,
});

describe("importing a model file", () => {
  it("takes an id from the file name, and numbers a repeat", () => {
    expect(assetIdFromName("My Rock.glb")).toBe("my-rock");
    expect(assetIdFromName("My Rock.glb", ["my-rock"])).toBe("my-rock-2");
    expect(assetIdFromName("weird name!!.glb", ["weird-name"])).toBe("weird-name-2");
    expect(assetIdFromName(".glb")).toBe("model");
  });

  it("refuses anything but a small GLB", () => {
    expect(modelFileProblem("rock.glb", 1000)).toBeNull();
    expect(modelFileProblem("rock.obj", 1000)).toMatch(/only .glb/);
    expect(modelFileProblem("rock.glb", editorData.models.maxAssetBytes + 1)).toMatch(/over the limit/);
  });

  it("makes a base64 data: URL asset", () => {
    const made = modelAssetOf("rock.glb", new Uint8Array([0x67, 0x6c, 0x54, 0x46]), ["rock"]);
    expect(made.id).toBe("rock-2");
    expect(made.name).toBe("rock.glb");
    expect(made.data).toBe("data:model/gltf-binary;base64,Z2xURg==");
    expect(base64Of(new Uint8Array([1, 2, 3]))).toBe("AQID");
  });
});

describe("placing a model", () => {
  it("sits its own bounds' bottom on the surface under the cursor", () => {
    const bounds = new THREE.Box3(new THREE.Vector3(-0.5, -1, -0.5), new THREE.Vector3(0.5, 1, 0.5));
    const entry = makeModel("model-1", "rock", bounds, new THREE.Vector3(1.26, 2, 3));
    // One metre below its origin, so the model's bottom is at the hit point.
    expect(entry.pos[1]).toBeCloseTo(3, 6);
    expect(entry.pos[0]).toBe(1.5);
    expect(entry.pos[2]).toBe(3);
    expect(entry.behaviour).toBe("solid");
  });
});

describe("the assets a level keeps", () => {
  it("lists the ones no placed model uses, and drops only those", () => {
    const level = {
      modelAssets: [asset("used"), asset("spare"), asset("spare2")],
      models: [model("m1", "used")],
    } as unknown as Level;
    expect(unusedAssetIds(level)).toEqual(["spare", "spare2"]);
    expect(removeUnusedAssets(level)!.modelAssets.map((a) => a.id)).toEqual(["used"]);
    expect(removeUnusedAssets({ modelAssets: [asset("used")], models: [model("m1", "used")] } as unknown as Level)).toBeNull();
  });

  it("the validator takes a level with assets and models", () => {
    const base = ed01 as unknown as Level;
    const ok = validateLevel({
      ...base,
      modelAssets: [asset("rock")],
      models: [
        model("model-1", "rock", { collider: "hull" }),
        model("model-2", "rock", { behaviour: "decor", pos: [1, 0, 0] }),
        model("model-3", "rock", { behaviour: "breakable", hitPoints: 20, voxel: true, pos: [2, 0, 0] }),
      ],
    });
    expect(ok.errors).toEqual([]);
  });

  it("and refuses a model whose asset is not in the file", () => {
    const base = ed01 as unknown as Level;
    const bad = validateLevel({
      ...base,
      modelAssets: [asset("rock")],
      models: [model("model-1", "tree")],
    });
    expect(bad.errors.some((e) => e.includes("unknown asset tree"))).toBe(true);
  });
});
