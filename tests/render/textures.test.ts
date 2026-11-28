import { describe, expect, it } from "vitest";
import pitJson from "../fixtures/levels/1-1-pit.json";
import { validateLevel, textureImageSize } from "../../src/level/validate";
import type { Level, TextureAsset } from "../../src/level/format";

// R3-04: uploaded textures and the surfaces they can be worn on.

const pit = pitJson as unknown as Level;

/** A png data: URL whose header says `w` by `h`. The parser reads the
 *  header alone, so a synthetic one is enough. */
function syntheticPng(width: number, height: number): string {
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  bytes[8] = 0x00; bytes[9] = 0x00; bytes[10] = 0x00; bytes[11] = 0x0d;
  bytes.set([0x49, 0x48, 0x44, 0x52], 12);
  const put = (v: number, o: number) => { bytes[o] = (v >> 24) & 0xff; bytes[o + 1] = (v >> 16) & 0xff; bytes[o + 2] = (v >> 8) & 0xff; bytes[o + 3] = v & 0xff; };
  put(width, 16);
  put(height, 20);
  return `data:image/png;base64,${btoa(String.fromCharCode(...bytes))}`;
}

/** A jpg data: URL whose header says 32 by 16. */
function syntheticJpeg(): string {
  const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x10, 0x00, 0x20, 0x00]);
  return `data:image/jpeg;base64,${btoa(String.fromCharCode(...bytes))}`;
}

function texture(overrides: Partial<TextureAsset> = {}): TextureAsset {
  return {
    id: "tex-1",
    name: "test texture",
    image: syntheticPng(64, 32),
    scale: 1,
    ...overrides,
  };
}

function broken(edit: (level: Level) => void): Level {
  const level = structuredClone(pit);
  edit(level);
  return level;
}

function errorsOf(level: Level) {
  return validateLevel(level).errors;
}

describe("textureImageSize", () => {
  it("reads a png's header", () => {
    expect(textureImageSize(syntheticPng(64, 32))).toEqual({ width: 64, height: 32 });
  });
  it("reads a jpeg's header", () => {
    expect(textureImageSize(syntheticJpeg())).toEqual({ width: 32, height: 16 });
  });
  it("returns null for a non-image data: URL", () => {
    expect(textureImageSize("data:model/gltf-binary;base64,AAAA")).toBeNull();
    expect(textureImageSize("not a data url")).toBeNull();
  });
});

describe("texture caps", () => {
  it("accepts a valid texture", () => {
    const level = broken((l) => { l.textures = [texture()]; });
    expect(errorsOf(level)).toEqual([]);
  });

  it("flags too many textures", () => {
    const level = broken((l) => {
      l.textures = Array.from({ length: 17 }, (_, i) => texture({ id: `tex-${i}` }));
    });
    expect(errorsOf(level).join(" ")).toMatch(/17 textures, over the limit of 16/);
  });

  it("flags an over-size texture", () => {
    const level = broken((l) => { l.textures = [texture({ image: syntheticPng(1024, 10) })]; });
    expect(errorsOf(level).join(" ")).toMatch(/1024 x 10 px is over the 512 px a side limit/);
  });

  it("flags an over-bytes texture", () => {
    const level = broken((l) => { l.textures = [texture({ image: `data:image/png;base64,${"A".repeat(400_000)}` })]; });
    expect(errorsOf(level).join(" ")).toMatch(/over the \d+ KB limit/);
  });

  it("flags a missing name, a bad image and a bad scale", () => {
    const level = broken((l) => {
      l.textures = [texture({ name: "", image: "nope", scale: -1 })];
    });
    const errors = errorsOf(level);
    expect(errors.join(" ")).toMatch(/name must be a string/);
    expect(errors.join(" ")).toMatch(/image must be a data:image URL/);
    expect(errors.join(" ")).toMatch(/scale must be a positive number/);
  });

  it("flags a duplicate texture id", () => {
    const level = broken((l) => { l.textures = [texture(), texture()]; });
    expect(errorsOf(level).join(" ")).toMatch(/id missing or used twice/);
  });
});

describe("tex:<id> surfaces", () => {
  it("accepts a prim with a texture surface", () => {
    const level = broken((l) => {
      l.textures = [texture()];
      l.prims = [{ id: "box-1", shape: "box", pos: [0, 1, 0], size: [1, 1, 1], colour: "#ff7a1a", behaviour: "decor", surface: "tex:tex-1" }];
    });
    expect(errorsOf(level)).toEqual([]);
  });

  it("accepts a physics object and terrain layer with a texture surface", () => {
    const level = broken((l) => {
      l.textures = [texture()];
      l.physics = [{ id: "p-1", shape: "box", pos: [0, 1, 0], size: [1, 1, 1], colour: "#ff7a1a", mass: 1, damage: 0, surface: "tex:tex-1" }];
      l.terrain = {
        origin: [0, 0, 0], cell: 1, nx: 1, nz: 1,
        heights: [0, 0, 0, 0],
        layers: [{ surface: "tex:tex-1", colour: "#ff7a1a" }],
      };
    });
    expect(errorsOf(level)).toEqual([]);
  });

  it("refuses a tex:<id> that no texture names", () => {
    const level = broken((l) => {
      l.textures = [texture()];
      l.prims = [{ id: "box-1", shape: "box", pos: [0, 1, 0], size: [1, 1, 1], colour: "#ff7a1a", behaviour: "decor", surface: "tex:nope" }];
    });
    expect(errorsOf(level).join(" ")).toMatch(/unknown surface tex:nope/);
  });

  it("still refuses an unknown plain surface", () => {
    const level = broken((l) => {
      l.prims = [{ id: "box-1", shape: "box", pos: [0, 1, 0], size: [1, 1, 1], colour: "#ff7a1a", behaviour: "decor", surface: "nope" }];
    });
    expect(errorsOf(level).join(" ")).toMatch(/unknown surface nope/);
  });
});

describe("setLevelTextures", () => {
  it("joins the uploads to SURFACES and SURFACE_NAMES", async () => {
    const { setLevelTextures, SURFACES, SURFACE_NAMES, isSurface, textureNames } = await import("../../src/render/surfaces");
    setLevelTextures([texture({ id: "t1", name: "My tex", scale: 2 })]);
    expect(SURFACES["tex:t1"]).toEqual({ label: "My tex", scale: 2 });
    expect(SURFACE_NAMES).toContain("tex:t1");
    expect(SURFACE_NAMES[0]).not.toBe("tex:t1");
    expect(textureNames()).toEqual(["tex:t1"]);
    expect(isSurface("tex:t1")).toBe(true);
    expect(isSurface("tex:nope")).toBe(false);
    setLevelTextures([]);
    expect(SURFACES["tex:t1"]).toBeUndefined();
    expect(isSurface("tex:t1")).toBe(false);
  });

  it("keeps the built-ins in the name list", async () => {
    const { setLevelTextures, SURFACE_NAMES } = await import("../../src/render/surfaces");
    setLevelTextures([texture({ id: "t1" })]);
    expect(SURFACE_NAMES).toContain("brick");
    setLevelTextures([]);
  });
});

describe("textures-editor helpers", () => {
  it("textureIdFromName slugs and dedupes", async () => {
    const { textureIdFromName } = await import("../../src/editor/textures-editor");
    expect(textureIdFromName("My Rough Set")).toBe("my-rough-set");
    expect(textureIdFromName("My Rough Set", ["my-rough-set"])).toBe("my-rough-set-2");
    expect(textureIdFromName("***")).toBe("texture");
  });

  it("capScale keeps a side at or under the cap, scales small images to 1px floor", async () => {
    const { capScale } = await import("../../src/editor/textures-editor");
    expect(capScale(512, 256)).toEqual({ width: 512, height: 256 });
    expect(capScale(1024, 512)).toEqual({ width: 512, height: 256 });
    expect(capScale(1, 1)).toEqual({ width: 1, height: 1 });
  });

  it("textureFileProblem refuses other formats and over-bytes files", async () => {
    const { textureFileProblem } = await import("../../src/editor/textures-editor");
    expect(textureFileProblem("a.png", 1000)).toBeNull();
    expect(textureFileProblem("a.jpg", 1000)).toBeNull();
    expect(textureFileProblem("a.webp", 1000)).toMatch(/only png or jpg/);
    expect(textureFileProblem("a.png", 300_001)).toMatch(/over the 300 KB limit/);
  });
});
