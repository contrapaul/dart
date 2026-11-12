import { describe, expect, it } from "vitest";
import { placeListener } from "../../src/audio/audio";

// Paul, 2026-11-12: in Firefox the range took no mouse or keys once
// unpaused. Firefox's AudioListener has no positionX/forwardX/upX
// AudioParams; the engine set `.value` on them every frame, which threw and
// stopped the game loop.

describe("placing the audio listener", () => {
  it("uses the AudioParams where the browser has them (Chrome, Edge)", () => {
    const param = () => ({ value: 0 });
    const l = {
      positionX: param(), positionY: param(), positionZ: param(),
      forwardX: param(), forwardY: param(), forwardZ: param(),
      upX: param(), upY: param(), upZ: param(),
      setPosition: () => { throw new Error("not used"); },
      setOrientation: () => { throw new Error("not used"); },
    };
    placeListener(l as unknown as AudioListener, { x: 1, y: 2, z: 3 }, { x: 0, y: 0, z: -1 });
    expect([l.positionX.value, l.positionY.value, l.positionZ.value]).toEqual([1, 2, 3]);
    expect(l.forwardZ.value).toBe(-1);
    expect(l.upY.value).toBe(1);
  });

  it("falls back to setPosition and setOrientation where it has none (Firefox)", () => {
    const calls: string[] = [];
    const l = {
      setPosition: (x: number, y: number, z: number) => calls.push(`pos ${x},${y},${z}`),
      setOrientation: (fx: number, fy: number, fz: number, ux: number, uy: number, uz: number) =>
        calls.push(`ori ${fx},${fy},${fz},${ux},${uy},${uz}`),
    };
    expect(() => placeListener(l as unknown as AudioListener, { x: 1, y: 2, z: 3 }, { x: 0, y: 0, z: -1 }))
      .not.toThrow();
    expect(calls).toEqual(["pos 1,2,3", "ori 0,0,-1,0,1,0"]);
  });
});
