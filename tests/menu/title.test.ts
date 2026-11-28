import { describe, expect, it } from "vitest";
import { NOT_READY, campaignSlot } from "../../src/menu/title";
import { newGame } from "../../src/game/campaign";
import CAMPAIGN from "../../data/campaign.json";

// MENU-01: the title menu's first slot is New game or Continue. Until the
// campaign is ready it is New game, greyed out; once ready, a save whose
// level ships is Continue and anything else is New game.
describe("the title menu's campaign slot (MENU-01)", () => {
  const ships = (id: string) => id === "1-2";
  const saveAt = (level: string) => ({ ...newGame(), level });

  it("is greyed-out New game while the campaign is not ready, save or not", () => {
    expect(campaignSlot(false, null, ships)).toEqual({ label: "New game", enabled: false, note: NOT_READY });
    expect(campaignSlot(false, saveAt("1-2"), ships)).toEqual({ label: "New game", enabled: false, note: NOT_READY });
  });

  it("is Continue for a save whose level ships, New game otherwise", () => {
    expect(campaignSlot(true, saveAt("1-2"), ships).label).toBe("Continue");
    expect(campaignSlot(true, saveAt("9-9"), ships)).toEqual({ label: "New game", enabled: true, note: null });
    expect(campaignSlot(true, null, ships)).toEqual({ label: "New game", enabled: true, note: null });
  });

  it("the committed campaign is not ready yet (Paul: New game waits for a full level)", () => {
    expect(CAMPAIGN.ready).toBe(false);
  });
});
