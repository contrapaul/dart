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

// LVL-05 stage 2: the end screen's campaign parts and the title's buttons
// exist on the pages that need them. The arena's panel grows Next level and
// Main menu; the title menu grows New game and Continue (the test course
// page keeps its links and Settings).
describe("the campaign's pages (LVL-05)", () => {
  it.each([
    ["#completeName", ARENA_HTML],
    ["#completeTime", ARENA_HTML],
    ["#nextLevel", ARENA_HTML],
    ["#mainMenu", ARENA_HTML],
    ["#actEnd", ARENA_HTML],
    ["#playAgain", ARENA_HTML],
  ])("arena.html has %s", (id, html) => {
    expect(html).toContain(`id="${id.slice(1)}"`);
  });

  it.each([
    ["#newGame", INDEX_HTML],
    ["#continueGame", INDEX_HTML],
  ])("index.html has %s", (id, html) => {
    expect(html).toContain(`id="${id.slice(1)}"`);
  });

  it("every id the arena's extras ask for is on arena.html", async () => {
    const EXTRAS = (await import("../../src/arena/extras.ts?raw")).default as string;
    const ids = [...EXTRAS.matchAll(/querySelector<[^>]+>\("#([\w-]+)/g)].map((m) => m[1]!);
    expect(ids.length).toBeGreaterThan(2);
    for (const id of ids) expect(ARENA_HTML, `#${id}`).toContain(`id="${id}"`);
  });
});
