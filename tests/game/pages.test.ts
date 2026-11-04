import { describe, expect, it } from "vitest";
import HUD_TS from "../../src/ui/hud.ts?raw";
import INDEX_HTML from "../../index.html?raw";
import ARENA_HTML from "../../arena.html?raw";

// Found merging GAME-05 and GAME-10a: GAME-07 added #finishprompt and
// #healflash to index.html only, and the shared HUD threw on the arena the
// first time a finisher was open. Every id the shared HUD looks up must be
// on both playable pages.
describe("the playable pages", () => {
  const ids = [...HUD_TS.matchAll(/querySelector<\w+>\("#([\w-]+)/g)].map((m) => m[1]!);
  it.each([["index.html", INDEX_HTML], ["arena.html", ARENA_HTML]])("%s has every element the HUD uses", (_page, html) => {
    expect(ids.length).toBeGreaterThan(3);
    for (const id of ids) expect(html, `#${id}`).toContain(`id="${id}"`);
  });
});
