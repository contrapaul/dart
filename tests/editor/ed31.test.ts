import { describe, expect, it } from "vitest";
import ed01 from "../fixtures/levels/ed-01.json";
import { validateLevel } from "../../src/level/validate";
import { makeButton, buttonOnChoices } from "../../src/editor/buttons-editor";
import { DO_KINDS, fieldIds, emptyDo, applyLink } from "../../src/editor/trigger-parts";
import type { Button, Level, Trigger } from "../../src/level/format";

// ED-31: editor buttons and the move action's editor side. The game side
// (the mover itself, a moved prim's own mesh, a button riding on its thing)
// is tested in tests/level/movers.test.ts.

const base = ed01 as unknown as Level;

const button = (over: Partial<Button> = {}): Button => ({
  id: "button-1", pos: [0, 1, 0], facing: [0, 1, 0], ...over,
});

describe("ED-31 buttons in a level", () => {
  it("the validator takes an editor button with no action", () => {
    const result = validateLevel({ ...base, buttons: [button()] });
    expect(result.errors).toEqual([]);
  });

  it("the validator takes any unit facing, not an axis only", () => {
    const diagonal = Math.SQRT1_2;
    const slant = validateLevel({
      ...base, buttons: [button({ facing: [0, diagonal, diagonal] })],
    });
    expect(slant.errors).toEqual([]);
    const notUnit = validateLevel({ ...base, buttons: [button({ facing: [0, 1, 1] })] });
    expect(notUnit.errors.some((e) => e.includes("unit vector"))).toBe(true);
  });

  it("the validator takes a move that names a button", () => {
    const trigger: Trigger = {
      id: "move-it", when: { kind: "start" },
      do: [{ kind: "move", ids: ["button-1"], by: [0, 1, 0], seconds: 1 }],
    };
    expect(validateLevel({ ...base, buttons: [button()], triggers: [trigger] }).errors).toEqual([]);
    const unknown = validateLevel({
      ...base, buttons: [button()],
      triggers: [{ ...trigger, do: [{ kind: "move", ids: ["nope"], by: [0, 1, 0], seconds: 1 }] }],
    });
    expect(unknown.errors.some((e) => e.includes("move names nope, which is unknown or cannot move"))).toBe(true);
  });

  it("the validator refuses a move on a breakable prim, which cannot move yet (lead, at merge)", () => {
    const wall = { id: "wall-1", shape: "box" as const, pos: [0, 1, -4] as [number, number, number], size: [2, 2, 1] as [number, number, number], colour: "#ff7a1a", behaviour: "breakable" as const };
    const trigger: Trigger = { id: "move-it", when: { kind: "start" }, do: [{ kind: "move", ids: ["wall-1"], by: [0, 1, 0], seconds: 1 }] };
    const report = validateLevel({ ...base, prims: [...(base.prims ?? []), wall], triggers: [trigger] });
    expect(report.errors.some((e) => e.includes("move names wall-1"))).toBe(true);
  });

  it("a button placed on a face keeps the point and the unit normal", () => {
    const made = makeButton("button-2", [2, 1.5, -3], [0, 0, 2], "box-1");
    expect(made.pos).toEqual([2, 1.5, -3]);
    expect(made.facing).toEqual([0, 0, 1]);
    expect(made.on).toBe("box-1");
    expect(makeButton("button-3", [0, 0, 0], [0, 1, 0]).on).toBeUndefined();
  });

  it("what a button may be mounted on names the level's own things", () => {
    const level = {
      ...base,
      prims: [{ id: "box-1", shape: "box", pos: [0, 0, 0], size: [1, 1, 1], colour: "#ffffff", behaviour: "solid" }],
    } as unknown as Level;
    const values = buttonOnChoices(level).map((c) => c.value);
    expect(values[0]).toBe("");
    expect(values).toContain("box-1");
  });

  it("the do picker offers move, and a pressed when lists the buttons", () => {
    expect(DO_KINDS.some((k) => k.kind === "move")).toBe(true);
    expect(emptyDo("move")).toEqual({ kind: "move", ids: [], by: [0, 2, 0], seconds: 1 });
    const level = { ...base, buttons: [button()] } as unknown as Level;
    expect(fieldIds(level, { kind: "pressed" })).toEqual(["button-1"]);
    // A click in the view links a button into a move row.
    const trigger: Trigger = { id: "t", when: { kind: "start" }, do: [emptyDo("move")] };
    const linked = applyLink(trigger, "do:0", "box-1", "prims");
    expect(linked?.do[0]).toEqual({ kind: "move", ids: ["box-1"], by: [0, 2, 0], seconds: 1 });
  });
});

describe("ED-31 a button that needs the use key", () => {
  it("is pressed by the use key, and not by a dart or a second hold", async () => {
    const RAPIER = (await import("@dimforge/rapier3d-compat")).default;
    await RAPIER.init();
    const { createPhysics } = await import("../../src/physics/world");
    const { buildButton, ButtonSystem } = await import("../../src/level/buttons");
    const THREE = await import("three");
    const { rapier, world } = await createPhysics();
    const group = new THREE.Group();
    // A wall button facing +z, its cap at z = -5 + 0.1.
    const handle = buildButton(
      { id: "b", pos: [0, 1.5, -5], facing: [0, 0, 1], use: true }, group, rapier, world,
    );
    const system = new ButtonSystem([handle], () => {});
    const eye = new THREE.Vector3(0, 1.5, -4.4);
    const forward = new THREE.Vector3(0, 0, -1);
    // A dart or a swing leaves it alone.
    expect(system.pressByCollider(handle.collider)).toBeNull();
    expect(system.pressNear(eye, forward, 2, 120)).toBeNull();
    // The use key presses it once: a held key is not one press a step.
    expect(system.pressWithUse(eye, forward, 2, 120)?.opened).toBe(true);
    expect(system.isPressed("b")).toBe(true);
    expect(system.pressWithUse(eye, forward, 2, 120)).toBeNull();
  });
});
