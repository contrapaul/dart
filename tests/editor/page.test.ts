import { describe, expect, it } from "vitest";
import EDITOR_HTML from "../../editor.html?raw";

// ED-02: the editor page's panels are plain DOM, and the code finds them by
// id. A typo in one of them would throw on the first frame, which the smoke
// check only catches with a browser; this catches it in the suite.
describe("ED-02 the editor page", () => {
  it.each([
    "view", "editor-ui", "topbar", "levelName", "counts", "status",
    "outliner", "outlinerList", "inspector", "palette", "dialogs",
    "newBtn", "openBtn", "undoBtn", "redoBtn", "exportBtn", "importBtn",
    "importFile", "playBtn",
  ])("has #%s", (id) => {
    expect(EDITOR_HTML).toContain(`id="${id}"`);
  });

  it("loads the editor's module and keeps every font and style local", () => {
    expect(EDITOR_HTML).toContain('src="/src/editor/main.ts"');
    expect(EDITOR_HTML).toContain('href="/src/editor/editor.css"');
    expect(EDITOR_HTML).not.toMatch(/https?:\/\//);
  });
});
