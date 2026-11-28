import { describe, expect, it } from "vitest";
import { TEMPLATES, TEMPLATE_ERRORS } from "../../src/editor/arena-templates";
import { pasteClip } from "../../src/editor/clipboard";
import { LevelDoc } from "../../src/editor/doc";
import { validateLevel } from "../../src/level/validate";
import type { Level } from "../../src/level/format";

// R3-07: pre-built arena templates. Each one is an asset file holding a
// whole arena; a paste must place it and the level must pass the validator.

function minimal(): Level {
  return {
    meta: { id: "template-check", name: "[Paul]", act: 0, targetSeconds: 120, accent: "#ffd23a" },
    shell: [],
    prims: [],
    playerStart: { pos: [0, 0, 5], yaw: 0 },
    exit: { pos: [0, 0, -5], size: [2, 1, 2] },
  };
}

describe("R3-07 arena templates", () => {
  it("reads every file without errors", () => {
    expect(TEMPLATE_ERRORS).toEqual([]);
    expect(TEMPLATES.length).toBeGreaterThanOrEqual(4);
  });

  it("has a unique name per template", () => {
    const names = TEMPLATES.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it.each(TEMPLATES.map((t) => [t.name, t] as const))("%s: places and validates", (_name, template) => {
    const doc = new LevelDoc(minimal());
    const made = pasteClip(template.clip, {
      next: (p) => doc.nextId(p),
      nextGroup: (taken) => doc.nextGroup(taken),
    }, null, 0.5);
    doc.addMixed(made, `paste ${template.name}`);
    const result = validateLevel(doc.level);
    expect(result.errors).toEqual([]);
  });

  it("renames the ids a paste makes (triggers included)", () => {
    const doc = new LevelDoc(minimal());
    const template = TEMPLATES[0]!;
    doc.addMixed(pasteClip(template.clip, {
      next: (p) => doc.nextId(p),
      nextGroup: (taken) => doc.nextGroup(taken),
    }, null, 0.5), "paste");
    const ids = doc.level.prims!.map((p) => p.id);
    expect(ids.some((i) => i === "floor")).toBe(false);
    expect(new Set(ids).size).toBe(ids.length);
    for (const zone of doc.level.zones ?? []) {
      const triggers = (doc.level.triggers ?? []).filter((t) => t.when.kind === "enter");
      expect(triggers.some((t) => (t.when as { zone?: string }).zone === zone.id)).toBe(true);
    }
  });
});
