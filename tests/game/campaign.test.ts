import { describe, expect, it } from "vitest";
import {
  CAMPAIGN_FOUND, CAMPAIGN_ORDER, CAMPAIGN_START, campaignMode,
  foundAt, levelIndex, nextLevel, ownedAt,
} from "../../src/game/campaign";
import { ARENA_LEVELS } from "../../src/arena/levels";
import blastersJson from "../../data/blasters.json";

// LVL-05 stage 1: the campaign's rules, pure and headless. Paul's answers
// (PLAN.md section 14, 2026-11-13): the player starts with the B02 alone,
// and B01, B04, B03 and B05 are found in Act 1's levels in that order.
describe("the campaign rules (LVL-05)", () => {
  it("a new campaign owns the B02 Musketeer only", () => {
    expect(CAMPAIGN_START).toEqual(["B02"]);
    expect(ownedAt(CAMPAIGN_ORDER[0]!)).toEqual(["B02"]);
  });

  it("level 1-2 in a fresh campaign owns the B02 and the B01", () => {
    expect(ownedAt("1-2")).toEqual(["B02", "B01"]);
  });

  it("Act 1's blasters come in Paul's order", () => {
    expect(CAMPAIGN_ORDER).toEqual(["1-1-pit", "1-2", "1-3", "1-4"]);
    expect(foundAt("1-1-pit")).toBe("B01");
    expect(foundAt("1-2")).toBe("B04");
    expect(foundAt("1-3")).toBe("B03");
    expect(foundAt("1-4")).toBe("B05");
    // 1-3 begins with everything the two levels before it gave.
    expect(ownedAt("1-3")).toEqual(["B02", "B01", "B04"]);
    expect(ownedAt("1-4")).toEqual(["B02", "B01", "B04", "B03"]);
  });

  it("found covers all seven blasters, each once", () => {
    const ids = Object.values(CAMPAIGN_FOUND);
    expect(ids).toHaveLength(7);
    expect(new Set(ids).size).toBe(7);
    // Every one is a real blaster, and the B02 is the start set's, not a find.
    const order = (blastersJson as { order: string[] }).order;
    for (const id of ids) expect(order, id).toContain(id);
    expect(ids).not.toContain("B02");
    expect(new Set([...ids, ...CAMPAIGN_START]).size).toBe(order.length);
  });

  it("the order ends after 1-4", () => {
    expect(nextLevel("1-1-pit")).toBe("1-2");
    expect(nextLevel("1-2")).toBe("1-3");
    expect(nextLevel("1-3")).toBe("1-4");
    expect(nextLevel("1-4")).toBeNull();
    expect(nextLevel("no-such-level")).toBeNull();
    expect(levelIndex("1-3")).toBe(2);
    expect(levelIndex("no-such-level")).toBe(-1);
  });

  it("every level in the order is a level the arena page can play", () => {
    for (const id of CAMPAIGN_ORDER) expect(Object.keys(ARENA_LEVELS), id).toContain(id);
  });

  it("a level outside the order owns the start set alone", () => {
    expect(ownedAt("2-1")).toEqual(["B02"]);
  });

  it("campaign mode is the page's own switch", () => {
    expect(campaignMode("?level=1-2&campaign")).toBe(true);
    expect(campaignMode("?campaign")).toBe(true);
    expect(campaignMode("?level=1-2")).toBe(false);
    expect(campaignMode("")).toBe(false);
    expect(campaignMode("?level=1-2&campaignish=1")).toBe(false);
  });
});
