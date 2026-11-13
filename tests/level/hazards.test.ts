import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { Hazards } from "../../src/level/hazards";
import { HazardTickState, type HazardSpec } from "../../src/level/hazard-rules";
import { primMatrix } from "../../src/level/prim-geometry";
import type { Prim, PrimHazard } from "../../src/level/format";

function hazard(
  id: string,
  dps: number,
  opts: Partial<PrimHazard> = {},
  extra: Partial<Prim> = {},
): Prim {
  return {
    id,
    shape: "box",
    pos: [0, 0, 0],
    size: [2, 1, 2],
    colour: "#8cff3a",
    behaviour: "hazard",
    hazard: { dps, look: "toxic", ...opts },
    ...extra,
  };
}

const feet = new THREE.Vector3(0, 0, 0);
const group = new THREE.Group();

describe("hazard rules", () => {
  it("no hazard deals nothing and leaves slow at 1", () => {
    const tick = new HazardTickState();
    tick.step(1, []);
    expect(tick.damage).toBe(0);
    expect(tick.slow).toBe(1);
  });

  it("one second at dps 20 deals 20 in four ticks", () => {
    const tick = new HazardTickState();
    const spec: HazardSpec = { dps: 20, slow: 0.6 };
    for (let i = 0; i < 4; i++) {
      tick.step(0.25, [spec]);
      expect(tick.damage).toBe(5);
    }
  });

  it("overlapping hazards use the highest dps and the lowest slow", () => {
    const tick = new HazardTickState();
    tick.step(0.25, [
      { dps: 20, slow: 0.8 },
      { dps: 40, slow: 0.5 },
    ]);
    expect(tick.damage).toBe(10);
    expect(tick.slow).toBe(0.5);
  });

  it("leaving and returning does not reset the accumulator", () => {
    const tick = new HazardTickState();
    const spec: HazardSpec = { dps: 20, slow: 0.6 };
    tick.step(0.2, [spec]);
    expect(tick.damage).toBe(0);
    tick.step(0.4, []);
    expect(tick.damage).toBe(0);
    tick.step(0.05, [spec]);
    expect(tick.damage).toBe(5);
  });
});

describe("hazard system", () => {
  it("no hazard prims deal nothing and leave slow at 1", () => {
    const hazards = new Hazards([], group);
    const result = hazards.update(1, feet, []);
    expect(result.playerDamage).toBe(0);
    expect(result.slow).toBe(1);
    expect(result.foamerDamage.size).toBe(0);
    hazards.dispose();
  });

  it("inside for one second at dps 20 deals 20 in four ticks", () => {
    const hazards = new Hazards([hazard("lake", 20, { slow: 0.6 })], group);
    for (let i = 0; i < 4; i++) {
      expect(hazards.update(0.25, feet, []).playerDamage).toBe(5);
    }
    expect(hazards.update(1, feet, []).playerDamage).toBe(20);
    hazards.dispose();
  });

  it("two overlapping hazards take the highest dps and lowest slow", () => {
    const hazards = new Hazards(
      [
        hazard("a", 20, { slow: 0.8 }),
        hazard("b", 40, { slow: 0.5 }),
      ],
      group,
    );
    const result = hazards.update(0.25, feet, []);
    expect(result.playerDamage).toBe(10);
    expect(result.slow).toBe(0.5);
    hazards.dispose();
  });

  it("a hidden hazard does nothing until shown", () => {
    const hazards = new Hazards(
      [hazard("lake", 20, { slow: 0.6 }, { hidden: true })],
      group,
    );
    expect(hazards.update(0.25, feet, []).playerDamage).toBe(0);
    expect(hazards.update(0.25, feet, []).slow).toBe(1);
    hazards.setShown("lake", true);
    expect(hazards.update(0.25, feet, []).playerDamage).toBe(5);
    expect(hazards.update(0.25, feet, []).slow).toBe(0.6);
    hazards.dispose();
  });

  it("hurtsFoamers false skips Foamers but not the player", () => {
    const hazards = new Hazards(
      [hazard("lake", 20, { slow: 0.6, hurtsFoamers: false })],
      group,
    );
    const foamer = { id: "foamer", pos: feet.clone() };
    const result = hazards.update(0.25, feet, [foamer]);
    expect(result.playerDamage).toBe(5);
    expect(result.slow).toBe(0.6);
    expect(result.foamerDamage.get("foamer")).toBe(0);
    hazards.dispose();
  });

  it("a rotated lake catches a point in its corner", () => {
    const lake = hazard("lake", 20, { slow: 0.6 }, {
      size: [4, 2, 4],
      rot: [0, 45, 0],
    });
    const hazards = new Hazards([lake], group);
    const worldCorner = new THREE.Vector3(2, 0, 2).applyMatrix4(primMatrix(lake));
    const playerFeet = worldCorner.clone();
    playerFeet.y -= 0.3;
    const result = hazards.update(0.25, playerFeet, []);
    expect(result.playerDamage).toBe(5);
    expect(result.slow).toBe(0.6);
    hazards.dispose();
  });
});
