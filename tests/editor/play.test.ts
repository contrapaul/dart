import { describe, expect, it } from "vitest";
import { CLOSE_MESSAGE, acceptClose, editorBackUrl, isFramed, parseStart, playUrl, spawnFor, startParam } from "../../src/editor/play";

// ED-09 stage 1: the URLs between the editor and the arena page.

describe("ED-09 the play URL", () => {
  it("names the stored level and says it came from the editor", () => {
    const url = playUrl("lvl-abc");
    expect(url).toBe("arena.html?level=local%3Alvl-abc&from=editor");
    const params = new URLSearchParams(url.split("?")[1]);
    expect(params.get("level")).toBe("local:lvl-abc");
    expect(params.get("from")).toBe("editor");
    expect(params.get("start")).toBeNull();
  });

  it("carries the camera's spot when Shift+P was pressed", () => {
    const url = playUrl("lvl-abc", { pos: [1.23456, 0, -2], yaw: 1.5 });
    const params = new URLSearchParams(url.split("?")[1]);
    expect(params.get("start")).toBe("1.235,0,-2,1.5");
  });

  it("writes no minus zero", () => {
    expect(startParam({ pos: [-0.0001, 0, 0], yaw: -0.0001 })).toBe("0,0,0,0");
  });
});

describe("ED-09 the start parameter", () => {
  it("reads four numbers back", () => {
    expect(parseStart("?start=1,2,3,0.5")).toEqual({ pos: [1, 2, 3], yaw: 0.5 });
  });

  it("is null when there is none, or it is not four numbers", () => {
    expect(parseStart("")).toBeNull();
    expect(parseStart("?start=1,2,3")).toBeNull();
    expect(parseStart("?start=1,2,3,4,5")).toBeNull();
    expect(parseStart("?start=a,b,c,d")).toBeNull();
  });
});

describe("ED-09 the way back to the editor", () => {
  it("goes to the level the run came from", () => {
    expect(editorBackUrl("?level=local%3Alvl-abc&from=editor")).toBe("editor.html?open=lvl-abc");
  });

  it("is null for a run that did not come from the editor", () => {
    expect(editorBackUrl("?level=local%3Alvl-abc")).toBeNull();
    expect(editorBackUrl("?level=1-1-pit&from=editor")).toBeNull();
    expect(editorBackUrl("?from=editor")).toBeNull();
  });
});

describe("ED-09 the spawn the level starts from", () => {
  const levelStart = { pos: [0, 0, 5] as [number, number, number], yaw: 1.5 };

  it("uses the level's own start when nothing was asked for", () => {
    expect(spawnFor(levelStart, null)).toEqual({ pos: [0, 0, 5], yaw: 1.5 });
  });

  it("uses the ?level= run's start instead, once", () => {
    const from = { pos: [3, 1, 4] as [number, number, number], yaw: 0 };
    expect(spawnFor(levelStart, from)).toEqual({ pos: [3, 1, 4], yaw: 0 });
    expect(levelStart.pos).toEqual([0, 0, 5]);
    expect(from.pos).toEqual([3, 1, 4]);
  });
});

// ED-11: the run in a frame over the editor.
describe("ED-11 the framed play URL", () => {
  it("says it is framed, with and without a start", () => {
    const plain = new URLSearchParams(playUrl("lvl-abc", null, true).split("?")[1]);
    expect(plain.get("frame")).toBe("1");
    expect(plain.get("start")).toBeNull();
    const from = new URLSearchParams(playUrl("lvl-abc", { pos: [1, 0, 2], yaw: 0.5 }, true).split("?")[1]);
    expect(from.get("frame")).toBe("1");
    expect(from.get("start")).toBe("1,0,2,0.5");
    expect(from.get("level")).toBe("local:lvl-abc");
  });

  it("reads a page as framed only when the URL says so", () => {
    expect(isFramed("?level=local%3Alvl-abc&from=editor&frame=1")).toBe(true);
    expect(isFramed("?level=local%3Alvl-abc&from=editor")).toBe(false);
    expect(isFramed("")).toBe(false);
    expect(playUrl("lvl-abc")).not.toContain("frame");
  });
});

describe("ED-11 the close message", () => {
  const frame = {};
  const origin = "http://localhost:5173";

  it("is taken from the editor's own frame and origin", () => {
    expect(acceptClose({ data: CLOSE_MESSAGE, origin, source: frame }, origin, frame)).toBe(true);
  });

  it("is refused from another origin, another window, or with other words", () => {
    expect(acceptClose({ data: CLOSE_MESSAGE, origin: "http://elsewhere.test", source: frame }, origin, frame)).toBe(false);
    expect(acceptClose({ data: CLOSE_MESSAGE, origin, source: {} }, origin, frame)).toBe(false);
    expect(acceptClose({ data: "something else", origin, source: frame }, origin, frame)).toBe(false);
    expect(acceptClose({ data: CLOSE_MESSAGE, origin, source: null }, origin, null)).toBe(false);
  });
});
