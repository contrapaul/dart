import { describe, expect, it } from "vitest";
import { Zoom, zoomSpecOf } from "../../src/game/zoom";
import blasters from "../../data/blasters.json";

// GAME-09e stage 2: the zoom. While the `zoom` action is held with B05
// out, the field of view eases to the blaster's share of the player's own
// setting and the look sensitivity scales with it; letting go eases back.
// Switching blaster or starting a reload drops the zoom, and a blaster
// without a zoom block cannot zoom at all. The game reads these from the
// class each render frame (src/game/game.ts, frame()).

const DT = 1 / 60;

function run(z: Zoom, steps: number, held: boolean): void {
  for (let i = 0; i < steps; i++) z.update(DT, held);
}

describe("GAME-09e: the zoom", () => {
  it("1. only B05 has a zoom block, and its numbers are the card's start values", () => {
    const z = zoomSpecOf("B05");
    expect(z).toBeTruthy();
    expect(z!.fovShare).toBe(0.4);
    expect(z!.easeTime).toBe(0.12);
    for (const id of blasters.order) {
      if (id === "B05") continue;
      expect(zoomSpecOf(id), `${id} should not have a zoom`).toBeNull();
    }
  });

  it("2. held with B05 out, the field of view eases to the share and the sensitivity follows", () => {
    const z = new Zoom();
    z.baseFov = 80;
    z.baseSensitivity = 0.0022;
    z.setBlaster("B05");
    // Not yet eased: the player's own view.
    expect(z.fov).toBe(80);
    run(z, 1, true);
    expect(z.fov, "easing, not snapped").toBeLessThan(80);
    expect(z.fov).toBeGreaterThan(80 * 0.4);
    run(z, Math.ceil(0.12 / DT) + 1, true);
    expect(z.fov).toBeCloseTo(80 * 0.4, 6);
    expect(z.sensitivity).toBeCloseTo(0.0022 * 0.4, 12);
    // Letting go eases back to the player's own view.
    run(z, Math.ceil(0.12 / DT) + 1, false);
    expect(z.fov).toBeCloseTo(80, 6);
    expect(z.sensitivity).toBeCloseTo(0.0022, 12);
  });

  it("3. a held key does nothing with another blaster", () => {
    const z = new Zoom();
    z.baseFov = 80;
    for (const id of blasters.order) {
      if (id === "B05") continue;
      z.setBlaster(id);
      run(z, Math.ceil(0.5 / DT), true);
      expect(z.fov, `${id} zoomed`).toBe(80);
    }
  });

  it("4. switching blaster drops the zoom, and the key must be pressed again", () => {
    const z = new Zoom();
    z.baseFov = 80;
    z.setBlaster("B05");
    run(z, Math.ceil(0.12 / DT) + 1, true);
    expect(z.fov).toBeCloseTo(32, 6);
    // Switch to another blaster with the key still held: eases back to own.
    z.setBlaster("B01");
    expect(z.factor, "a switch drops the zoom").toBe(1);
    run(z, Math.ceil(0.3 / DT), true);
    expect(z.fov).toBeCloseTo(80, 6);
    // Switch back with the key still held: it does not come back on its own.
    z.setBlaster("B05");
    run(z, Math.ceil(0.3 / DT), true);
    expect(z.fov, "the key must be released and pressed again").toBeCloseTo(80, 6);
    // Release, press again: zoomed.
    run(z, 2, false);
    run(z, Math.ceil(0.12 / DT) + 1, true);
    expect(z.fov).toBeCloseTo(32, 6);
  });

  it("5. a reload drops the zoom", () => {
    const z = new Zoom();
    z.baseFov = 80;
    z.setBlaster("B05");
    run(z, Math.ceil(0.12 / DT) + 1, true);
    expect(z.fov).toBeCloseTo(32, 6);
    // The game calls cancel() when the active blaster enters reloading.
    z.cancel();
    expect(z.factor, "a reload drops the zoom").toBe(1);
    run(z, Math.ceil(0.3 / DT), true);
    expect(z.fov).toBeCloseTo(80, 6);
  });

  it("6. a settings change while zoomed keeps the share of the new value", () => {
    const z = new Zoom();
    z.baseFov = 80;
    z.setBlaster("B05");
    run(z, Math.ceil(0.12 / DT) + 1, true);
    expect(z.fov).toBeCloseTo(32, 6);
    // The player moves the field-of-view slider mid-zoom.
    z.baseFov = 90;
    expect(z.fov).toBeCloseTo(90 * 0.4, 6);
  });
});
