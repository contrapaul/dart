import { describe, expect, it } from "vitest";
import { PlayerHealth } from "../../src/player/health";

const GRACE = 0.5; // data/player.json health.hitGrace
const MAX = 100; // data/player.json health.max

describe("PlayerHealth (UI-01 stage 1)", () => {
  it("starts full, at the data's max", () => {
    const h = new PlayerHealth();
    expect(h.max).toBe(MAX);
    expect(h.hp).toBe(MAX);
    expect(h.dead).toBe(false);
  });

  it("damage lowers hp by the amount", () => {
    const h = new PlayerHealth();
    expect(h.damage(12)).toBe(12);
    expect(h.hp).toBe(MAX - 12);
  });

  it("a second hit inside the grace is ignored, one after it lands", () => {
    const h = new PlayerHealth();
    expect(h.damage(10)).toBe(10);
    h.update(GRACE - 0.05);
    expect(h.damage(10)).toBe(0);
    expect(h.hp).toBe(MAX - 10);
    h.update(0.1); // past the grace
    expect(h.damage(10)).toBe(10);
    expect(h.hp).toBe(MAX - 20);
  });

  it("hp never goes below 0 or above max", () => {
    const h = new PlayerHealth();
    expect(h.damage(500)).toBe(MAX);
    expect(h.hp).toBe(0);
    h.reset();
    expect(h.heal(50)).toBe(0);
    expect(h.hp).toBe(MAX);
    h.damage(20);
    expect(h.heal(1000)).toBe(20);
    expect(h.hp).toBe(MAX);
  });

  it("dead is true at 0 hp, and no further damage is taken", () => {
    const h = new PlayerHealth();
    h.damage(MAX);
    expect(h.dead).toBe(true);
    expect(h.damage(5)).toBe(0);
    expect(h.hp).toBe(0);
  });

  it("the damage-taken multiplier scales incoming damage", () => {
    const h = new PlayerHealth();
    h.damageTaken = 2;
    expect(h.damage(12)).toBe(24);
    expect(h.hp).toBe(MAX - 24);
    h.damageTaken = 0.5;
    h.reset();
    expect(h.damage(12)).toBe(6);
    expect(h.hp).toBe(MAX - 6);
  });

  it("the multiplier cannot push hp below 0", () => {
    const h = new PlayerHealth();
    h.damageTaken = 3;
    h.damage(40); // 120 raw, against 100 hp
    expect(h.hp).toBe(0);
    expect(h.dead).toBe(true);
  });

  it("reset restores full health and the grace is over", () => {
    const h = new PlayerHealth();
    h.damage(30);
    h.reset();
    expect(h.hp).toBe(MAX);
    expect(h.damage(1)).toBe(1);
  });
});
