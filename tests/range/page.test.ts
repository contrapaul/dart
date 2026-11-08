import { describe, expect, it } from "vitest";
import RANGE_TS from "../../src/range/main.ts?raw";
import RANGE_HTML from "../../range.html?raw";

// PT-01 stage 3: the range page grew a menu of its own and lost its default
// tools to range.html?bench. A missing id on this page throws at load, which
// is how the range's menu got broken in the first place, so check the two
// files agree, as tests/game/pages.test.ts does for the playable pages.

describe("PT-01 stage 3: the range page", () => {
  const ids = [...RANGE_TS.matchAll(/querySelector<\w+>\("#([\w-]+)"/g)].map((m) => m[1]!);

  it("main.ts looks up elements on the page (the check has something to check)", () => {
    expect(ids.length).toBeGreaterThan(10);
  });

  it("range.html has every element main.ts looks up", () => {
    for (const id of ids) expect(RANGE_HTML, `#${id}`).toContain(`id="${id}"`);
  });

  it("the menu the card asks for is on the default page, the old tools are not", () => {
    // The menu: the active blaster's name, its mod row, and Respawn.
    for (const id of ["menuBlaster", "menuMods", "menuRespawn", "play"]) {
      expect(RANGE_HTML, `#${id}`).toContain(`id="${id}"`);
    }
    // Everything else sits inside the bench block, hidden unless the page is
    // opened with ?bench.
    const bench = RANGE_HTML.slice(RANGE_HTML.indexOf('id="benchTools"'));
    expect(bench.length).toBeGreaterThan(100);
    for (const id of ["blasterSelect", "modToggles", "dartTypes", "foamerType", "spawn5",
      "keepAlive", "benchmark", "reportBtn", "soundPanel"]) {
      expect(bench, `#${id} belongs behind ?bench`).toContain(`id="${id}"`);
      expect(RANGE_HTML.slice(0, RANGE_HTML.indexOf('id="benchTools"')), `#${id} on the default page`)
        .not.toContain(`id="${id}"`);
    }
  });

  it("the time-to-kill panel and the labels both live in the hud", () => {
    const hud = RANGE_HTML.slice(RANGE_HTML.indexOf('id="hud"'), RANGE_HTML.indexOf('id="hitflash"'));
    expect(hud).toContain('id="ttk"');
    expect(hud).toContain('id="labels"');
  });
});
