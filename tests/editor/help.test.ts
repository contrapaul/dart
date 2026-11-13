import { describe, expect, it } from "vitest";
import { HELP } from "../../src/editor/help";

// ED-09 stage 4: the Help panel's words. Every section it promises is there,
// and the text keeps the rules the game pages keep.

const all = HELP.flatMap((s) => [s.title, ...s.rows.flat(), ...(s.text ?? [])]);

describe("ED-09 stage 4: the help panel", () => {
  it("covers the six things the card asks for", () => {
    const titles = HELP.map((s) => s.title);
    expect(titles).toEqual([
      "Keys", "Placing things", "How to make a blocker", "The Arena button",
      "Keys and doors", "Hazards and breakables", "Saving and sharing",
    ]);
  });

  it("names the play keys the editor has", () => {
    const keys = HELP[0]!.rows.map(([what]) => what);
    expect(keys).toContain("P");
    expect(keys).toContain("Shift+P");
  });

  it("has no em or en dashes and no remote host", () => {
    for (const line of all) {
      expect(line).not.toMatch(/[\u2014\u2013]/);
      expect(line).not.toMatch(/https?:\/\//);
    }
  });

  it("invents no story and uses no trademark", () => {
    const text = all.join(" ");
    for (const word of ["Nerf", "DOOM", "Foam dimension"]) {
      expect(text).not.toContain(word);
    }
  });
});
