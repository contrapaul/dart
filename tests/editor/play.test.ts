import { describe, expect, it } from "vitest";
import { editorBackUrl, parseStart, playUrl, spawnFor, startParam } from "../../src/editor/play";

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
