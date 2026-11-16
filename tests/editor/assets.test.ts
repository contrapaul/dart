import { describe, expect, it } from "vitest";
import {
  ASSET_LIMITS, asOneGroup, assetProblem, assetsFileName, assetsFileText, clipCount, fitImport, freeName,
  readAssetsFile, tidyName, type AssetBody,
} from "../../src/editor/assets";
import { pasteClip, pasteMove, type Clip } from "../../src/editor/clipboard";

// ED-23: saved assets. The store itself (IndexedDB), the picture and the
// panel are checked in the browser; these are the rules they follow.

function box(id: string, x: number): { id: string; pos: [number, number, number]; size: [number, number, number] } {
  return { id, pos: [x, 1, 0], size: [2, 2, 2] };
}

function clipOf(count: number): Clip {
  return { dart: "dart-clip", version: 1, entries: { prims: Array.from({ length: count }, (_, i) => box(`box-${i + 1}`, i * 3)) } };
}

const PICTURE = "data:image/jpeg;base64,AAAA";
const wall: AssetBody = { name: "wall", clip: clipOf(2), picture: PICTURE };

describe("ED-23 saved assets", () => {
  it("counts the things in a clip", () => {
    expect(clipCount(clipOf(3))).toBe(3);
    expect(clipCount({ dart: "dart-clip", version: 1, entries: {} })).toBe(0);
  });

  it("refuses an empty selection, one over the cap, and a full store", () => {
    expect(assetProblem(clipOf(0), 0)).toMatch(/nothing/);
    expect(assetProblem(clipOf(ASSET_LIMITS.maxThings + 1), 0)).toMatch(/over the cap/);
    expect(assetProblem(clipOf(1), ASSET_LIMITS.max)).toMatch(/is the cap/);
    expect(assetProblem(clipOf(ASSET_LIMITS.maxThings), ASSET_LIMITS.max - 1)).toBeNull();
  });

  it("tidies a name", () => {
    expect(tidyName("  my   wall ")).toBe("my wall");
    expect(tidyName("x".repeat(200)).length).toBe(60);
    expect(tidyName("   ")).toBe("");
  });

  it("finds a name that is not taken", () => {
    expect(freeName("wall", [])).toBe("wall");
    expect(freeName("wall", ["wall"])).toBe("wall 2");
    expect(freeName("wall", ["wall", "wall 2"])).toBe("wall 3");
  });

  it("puts a placed asset in one group, but not a single thing or a trigger", () => {
    const made = pasteClip(clipOf(2), { next: (p) => `${p}-new-${Math.random()}`, nextGroup: () => "g" }, null, 0.5);
    const trigger = { kind: "triggers" as const, entry: { id: "trigger-1" } };
    const grouped = asOneGroup([...made, trigger], "group-7");
    expect(grouped.slice(0, 2).every((m) => (m.entry as { group?: string }).group === "group-7")).toBe(true);
    expect((grouped[2]!.entry as { group?: string }).group).toBeUndefined();
    const one = asOneGroup(made.slice(0, 1), "group-7");
    expect((one[0]!.entry as { group?: string }).group).toBeUndefined();
  });

  it("names an export after the one asset, or assets for more", () => {
    expect(assetsFileName([{ ...wall, name: "My Wall!" }])).toBe("my-wall.dart-assets.json");
    expect(assetsFileName([{ ...wall, name: "??" }])).toBe("asset.dart-assets.json");
    expect(assetsFileName([wall, wall])).toBe("assets.dart-assets.json");
  });

  it("a file comes back as it left", () => {
    const back = readAssetsFile(assetsFileText([wall, { ...wall, name: "tower" }]));
    expect(back.error).toBeNull();
    expect(back.assets).toEqual([wall, { ...wall, name: "tower" }]);
  });

  it("the file does not carry the store's key or date", () => {
    const text = assetsFileText([{ ...wall, key: "asset-1", saved: 5 } as AssetBody]);
    expect(text).not.toMatch(/asset-1|saved/);
  });

  it.each([
    ["hello", /not JSON/],
    ["{\"dart\":\"dart-clip\",\"version\":1,\"entries\":{}}", /Not an assets file/],
    ["{\"dart\":\"dart-assets\",\"version\":2,\"assets\":[]}", /newer/],
    ["{\"dart\":\"dart-assets\",\"version\":1,\"assets\":[]}", /no assets/],
    ["{\"dart\":\"dart-assets\",\"version\":1,\"assets\":[{\"name\":\"x\",\"clip\":{}}]}", /Asset 1 in the file is broken/],
    ["{\"dart\":\"dart-assets\",\"version\":1,\"assets\":[null]}", /broken/],
  ])("refuses %s", (text, reason) => {
    const back = readAssetsFile(text);
    expect(back.assets).toEqual([]);
    expect(back.error).toMatch(reason);
  });

  it("refuses an asset over the cap of things", () => {
    const big = { ...wall, clip: clipOf(ASSET_LIMITS.maxThings + 1) };
    expect(readAssetsFile(assetsFileText([big])).error).toMatch(/over the cap/);
  });

  it("drops a picture that is not an image held in the file", () => {
    const remote = readAssetsFile(assetsFileText([{ ...wall, picture: "https://example.com/a.png" }]));
    expect(remote.assets[0]!.picture).toBe("");
    const svg = readAssetsFile(assetsFileText([{ ...wall, picture: "data:image/svg+xml;base64,AAAA" }]));
    expect(svg.assets[0]!.picture).toBe("");
    const huge = readAssetsFile(assetsFileText([{ ...wall, picture: PICTURE + "A".repeat(300_000) }]));
    expect(huge.assets[0]!.picture).toBe("");
  });

  it("gives an asset with no name one", () => {
    const text = assetsFileText([{ ...wall, name: "  " }]);
    expect(readAssetsFile(text).assets[0]!.name).toBe("asset");
  });

  it("an import never replaces an asset and stops at the cap", () => {
    const fit = fitImport([wall, wall], [wall]);
    expect(fit.assets.map((a) => a.name)).toEqual(["wall 2", "wall 3"]);
    expect(fit.left).toBe(0);
    const have = Array.from({ length: ASSET_LIMITS.max - 1 }, (_, i) => ({ ...wall, name: `a${i}` }));
    const full = fitImport([wall, { ...wall, name: "tower" }], have);
    expect(full.assets.map((a) => a.name)).toEqual(["wall"]);
    expect(full.left).toBe(1);
  });

  it("the ghost's move is the move the paste makes", () => {
    const clip = clipOf(2);
    const at: [number, number, number] = [10.2, 0, 4.9];
    const move = pasteMove(clip, at, 0.5);
    const made = pasteClip(clip, { next: (p) => `${p}-n`, nextGroup: () => "g" }, at, 0.5);
    expect(made[0]!.entry.pos).toEqual([0 + move[0], 1 + move[1], 0 + move[2]]);
    // Two 2 m boxes at x 0 and 3: the middle is 1.5, the foot is at y 0.
    expect(move).toEqual([8.5, 0, 5]);
  });
});
