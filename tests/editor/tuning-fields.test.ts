import { afterEach, describe, expect, it } from "vitest";
import { fieldsFor, committedValue } from "../../src/editor/tuning-fields";
import { setLocalTuningForTest, tuneFoamer } from "../../src/core/tuning";

afterEach(() => setLocalTuningForTest({ version: 1, foamers: {}, blasters: {} }));

describe("tuning fields", () => {
  it("lists the grouped fields for a type, all unchanged at first", () => {
    const fields = fieldsFor("F01");
    const groups = new Set(fields.map((f) => f.field.group));
    expect(groups).toEqual(new Set(["Movement", "Health", "Size", "Damage dealt", "Attack speed", "Damage taken"]));
    expect(fields.every((f) => !f.changed)).toBe(true);
    expect(fields.find((f) => f.field.id === "rig.voxelSize")!.value).toBeCloseTo(1, 5);
  });

  it("marks a field changed when the type is tuned, and reverts on reset", () => {
    tuneFoamer("F01", { rig: { speed: 4 } });
    const fields = fieldsFor("F01");
    expect(fields.find((f) => f.field.id === "rig.speed")!.value).toBe(4);
    expect(fields.find((f) => f.field.id === "rig.speed")!.changed).toBe(true);
    expect(fields.find((f) => f.field.id === "spec.attackRange")!.changed).toBe(false);
  });

  it("a placed Foamer's own tuning sits over the type's and marks own fields changed", () => {
    const own = { rig: { health: 42 } };
    const fields = fieldsFor("F01", own);
    const health = fields.find((f) => f.field.id === "rig.health")!;
    expect(health.value).toBe(42);
    expect(health.changed).toBe(true);
    // Committed value still shows the committed health.
    expect(committedValue(health.field, "F01")).toBe(6);
  });

  it("attacks come from the type, and a damage patch names only that attack, by id", () => {
    const attackFields = fieldsFor("F01").filter((f) => f.field.id.startsWith("attack."));
    expect(attackFields.map((f) => f.field.id)).toContain("attack.bonk.damage");
    const atk = attackFields.find((f) => f.field.id === "attack.bonk.damage")!;
    const patch = atk.field.patch(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { attacks: [{ id: "bonk", damage: 12, token: "melee", needs: [], windup: 0.6, strike: 0.2 }, { id: "headbutt", damage: 8, token: "melee", needs: [], windup: 0.9, strike: 0.2 }] } as never,
      {} as never, 20,
    );
    // The GPU1 review: a whole list froze a snapshot; the store now merges
    // lists of things with ids by id.
    expect(patch.spec!.attacks).toEqual([{ id: "bonk", damage: 20 }]);
  });

  it("size is a multiplier of the committed size, and writes the scaled voxelSize", () => {
    const fields = fieldsFor("F01");
    const size = fields.find((f) => f.field.id === "rig.voxelSize")!;
    expect(size.field.title).toBeTruthy();
    expect(size.value).toBeCloseTo(1, 5);
    tuneFoamer("F01", { rig: { voxelSize: 0.1 } });
    const tuned = fieldsFor("F01").find((f) => f.field.id === "rig.voxelSize")!;
    expect(tuned.value).toBeCloseTo(2, 5);
    expect(tuned.changed).toBe(true);
    // The patch writes the committed voxelSize times the multiplier.
    const patch = tuned.field.patch({} as never, {} as never, 3);
    expect(patch.rig!.voxelSize).toBeCloseTo(0.15, 5);
    // The committed value resets to 1 (normal).
    expect(committedValue(tuned.field, "F01")).toBeCloseTo(1, 5);
  });

  it("weakpoint fields appear only for types that declare a weakpoint", () => {
    expect(fieldsFor("F09").some((f) => f.field.id === "weakpoint.damage")).toBe(true);
    expect(fieldsFor("F01").some((f) => f.field.id === "weakpoint.damage")).toBe(false);
  });
});
