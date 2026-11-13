import { describe, expect, it } from "vitest";
import pitJson from "../../data/levels/1-1-pit.json";
import level12 from "../../data/levels/1-2.json";
import level13 from "../../data/levels/1-3.json";
import level14 from "../../data/levels/1-4.json";
import { validateLevel } from "../../src/level/validate";
import type { Arena, Level, Pickup } from "../../src/level/format";

// Rule numbers are design/levels/BLOCKOUT.md section 5.

const pit = pitJson as unknown as Level;

/** A deep copy of the Pit, so a test can break one thing. */
function broken(edit: (level: Level) => void): Level {
  const level = structuredClone(pit);
  edit(level);
  return level;
}

function errorsOf(level: Level) {
  return validateLevel(level).errors;
}

describe("the Pit file", () => {
  it("validates with no errors", () => {
    const result = validateLevel(pit);
    expect(result.errors).toEqual([]);
  });

  it("warns that the arena is near the voxel volume cap", () => {
    const result = validateLevel(pit);
    expect(result.warnings.join(" ")).toMatch(/5 voxel volumes/);
  });

  it("has the shape the arena page needs", () => {
    expect(pit.meta.id).toBe("1-1");
    expect(pit.arenas?.length).toBe(1);
    const arena = pit.arenas![0];
    expect(arena.waves.length).toBe(2);
    expect(arena.doors.map((d) => d.id)).toEqual(["pit-in", "pit-out"]);
    expect(pit.exit.size).toEqual([4, 4, 4]);
  });
});

describe("rule 1: voxel volume size", () => {
  it("catches a volume over 3.2 m", () => {
    const level = broken((l) => {
      l.pieces![0].volumes[0].size = [4, 3.2, 3.2];
    });
    expect(errorsOf(level).join(" ")).toMatch(/pit-block volume 0.*exceeds/);
  });

  it("allows exactly 3.2 m", () => {
    const level = broken((l) => {
      l.pieces![0].volumes[0].size = [3.2, 3.2, 3.2];
    });
    expect(errorsOf(level)).toEqual([]);
  });
});

describe("rule 2: every volume reaches the anchor", () => {
  it("catches a floating volume", () => {
    const level = broken((l) => {
      l.pieces![0].volumes.push({
        pos: [0, 20, 4], size: [1, 1, 1], material: "foam-orange",
      });
    });
    expect(errorsOf(level).join(" ")).toMatch(/no path to the anchor/);
  });
});

describe("rule 3: arena voxel budget", () => {
  it("fails at 7 volumes in the arena", () => {
    const level = broken((l) => {
      const piece = l.pieces![1];
      for (let i = 0; i < 3; i++) {
        piece.volumes.push({
          pos: [-9, 1.4 + (i + 1) * 2.8, 1], size: [1.6, 2.8, 1.6], material: "foam-orange",
        });
      }
    });
    expect(errorsOf(level).join(" ")).toMatch(/over the KIT cap of 6/);
  });
});

describe("rule 4: wave size", () => {
  it("fails over the Fury cap", () => {
    const level = broken((l) => {
      l.arenas![0].waves[1].spawns[0].count = 17;
    });
    expect(errorsOf(level).join(" ")).toMatch(/over the 16 Fury cap/);
  });

  it("warns between 12 and 16 alive", () => {
    const level = broken((l) => {
      l.arenas![0].waves[1].spawns[0].count = 13;
    });
    const result = validateLevel(level);
    expect(result.errors).toEqual([]);
    expect(result.warnings.join(" ")).toMatch(/over the Normal cap of 12/);
  });
});

describe("rule 5: rifts a wave names exist", () => {
  it("catches an undefined rift", () => {
    const level = broken((l) => {
      l.arenas![0].waves[0].rifts[0] = "pit-r9";
    });
    expect(errorsOf(level).join(" ")).toMatch(/rift pit-r9 is not defined/);
  });
});

describe("rule 6: unlockOnClear doors exist", () => {
  it("catches an undefined door", () => {
    const level = broken((l) => {
      l.arenas![0].unlockOnClear.push("pit-back");
    });
    expect(errorsOf(level).join(" ")).toMatch(/unknown door pit-back/);
  });
});

describe("rule 9: the player, exit and doors sit in the shell", () => {
  it("catches a player start inside a piece", () => {
    const level = broken((l) => {
      l.playerStart.pos = [0, 1.6, 4];
    });
    expect(errorsOf(level).join(" ")).toMatch(/playerStart: inside piece pit-block/);
  });

  it("catches a player start outside the shell", () => {
    const level = broken((l) => {
      l.playerStart.pos = [0, 4, -80];
    });
    expect(errorsOf(level).join(" ")).toMatch(/playerStart: outside the shell/);
  });

  it("catches an exit outside the shell", () => {
    const level = broken((l) => {
      l.exit.pos = [0, 40, 17];
    });
    expect(errorsOf(level).join(" ")).toMatch(/exit: outside the shell/);
  });

  it("catches a door inside a piece", () => {
    const level = broken((l) => {
      l.arenas![0].doors[0].pos = [0, 1.6, 4];
    });
    expect(errorsOf(level).join(" ")).toMatch(/door pit-in: inside piece pit-block/);
  });
});

describe("rule 10: shell boxes do not overlap", () => {
  it("catches two shell boxes sharing volume", () => {
    const level = broken((l) => {
      l.shell.push({
        id: "extra", shape: "box", pos: [0, 0.2, 0], size: [2, 1, 2], material: "greybox",
      });
    });
    expect(errorsOf(level).join(" ")).toMatch(/overlaps shell extra/);
  });
});

describe("rule 11: materials exist", () => {
  it("catches an unknown material on a shell box", () => {
    const level = broken((l) => {
      l.shell[0].material = "foam-chartreuse";
    });
    expect(errorsOf(level).join(" ")).toMatch(/unknown material foam-chartreuse/);
  });

  it("catches an unknown material on a piece volume", () => {
    const level = broken((l) => {
      l.pieces![0].volumes[0].material = "foam-chartreuse";
    });
    expect(errorsOf(level).join(" ")).toMatch(/pit-block volume 0: unknown material/);
  });
});

describe("rule 12: foamer IDs exist with health", () => {
  it("catches an unknown Foamer", () => {
    const level = broken((l) => {
      l.arenas![0].waves[0].spawns[0].foamer = "F99";
    });
    expect(errorsOf(level).join(" ")).toMatch(/unknown foamer F99/);
  });
});

describe("LVL-02a: a darts-* pickup names a real dart type", () => {
  it("accepts a real dart type (the Pit's darts-standard box)", () => {
    expect(errorsOf(pit)).toEqual([]);
  });

  it("rejects a pickup whose dart type is not in data/darts.json", () => {
    const level = broken((l) => {
      l.pickups!.push({ id: "x", type: "darts-bogus" as Pickup["type"], count: 4, pos: [0, 0, 0] });
    });
    expect(errorsOf(level).join(" ")).toMatch(/is not a dart type/);
  });
});

describe("LVL-02b: arenas in file order", () => {
  /** The Pit's arena copied with new ids and moved 60 m north. */
  function secondArena(id: string): Arena {
    const copy = structuredClone(pit.arenas![0]);
    copy.id = id;
    copy.trigger = { pos: [0, 2, 54], size: [20, 4, 6] };
    for (const door of copy.doors) {
      door.id = door.id.replace("pit-", "p2-");
      door.pos = [door.pos[0], door.pos[1], door.pos[2] + 60];
    }
    for (const rift of copy.rifts) {
      rift.id = rift.id.replace("pit-", "p2-");
      rift.pos = [rift.pos[0], rift.pos[1], rift.pos[2] + 60];
    }
    for (const wave of copy.waves) {
      wave.id = wave.id.replace("pit-", "p2-");
      wave.rifts = wave.rifts.map((r) => r.replace("pit-", "p2-"));
    }
    copy.unlockOnClear = copy.unlockOnClear.map((d) => d.replace("pit-", "p2-"));
    return copy;
  }

  it("accepts two arenas in a reachable order", () => {
    const level = broken((l) => {
      l.shell.push(
        { id: "t2-floor", shape: "box", pos: [0, -0.5, 60], size: [34, 1, 26], material: "greybox" },
        { id: "t2-wall-n", shape: "box", pos: [0, 6, 73.5], size: [34, 12, 1], material: "greybox" },
        { id: "t2-wall-e", shape: "box", pos: [17.5, 6, 60], size: [1, 12, 28], material: "greybox" },
        { id: "t2-wall-w", shape: "box", pos: [-17.5, 6, 60], size: [1, 12, 28], material: "greybox" },
      );
      l.arenas!.push(secondArena("pit-2"));
    });
    expect(errorsOf(level)).toEqual([]);
  });

  it("rejects a duplicated arena id", () => {
    const level = broken((l) => {
      l.arenas!.push(secondArena("pit"));
    });
    expect(errorsOf(level).join(" ")).toMatch(/arena id pit is used twice/);
  });

  it("rejects a trigger outside the shell", () => {
    const level = broken((l) => {
      l.arenas!.push(secondArena("pit-2")); // its trigger is at z 54, no shell there
    });
    expect(errorsOf(level).join(" ")).toMatch(/arena pit-2: trigger outside the shell/);
  });

  it("rejects a trigger inside an earlier arena's locked space", () => {
    const level = broken((l) => {
      const copy = secondArena("pit-2");
      copy.trigger = { pos: [0, 2, 7], size: [4, 4, 4] }; // inside the Pit
      l.arenas!.push(copy);
    });
    expect(errorsOf(level).join(" ")).toMatch(/trigger is inside arena pit, which locks first/);
  });
});

describe("structural errors", () => {
  it("refuses a level with no shell", () => {
    const level = broken((l) => {
      l.shell = [];
    });
    expect(errorsOf(level).join(" ")).toMatch(/the level needs shell boxes or prims/);
  });

  it("catches a zero or negative size", () => {
    const level = broken((l) => {
      l.pieces![1].volumes[0].size = [0, 2.8, 1.6];
    });
    expect(errorsOf(level).join(" ")).toMatch(/size must be positive/);
  });
});


// HP-01: a health pickup heals its own amount, so a file must give one.
describe("HP-01: a health pickup needs a positive amount", () => {
  const at = { pos: [0, 0.2, -10] as [number, number, number] };

  it("accepts a health pickup with a positive amount", () => {
    const level = broken((l) => {
      l.pickups!.push({ id: "hp", type: "health", amount: 25, ...at });
    });
    expect(errorsOf(level)).toEqual([]);
  });

  it("rejects a health pickup with no amount", () => {
    const level = broken((l) => {
      l.pickups!.push({ id: "hp", type: "health", ...at } as Pickup);
    });
    expect(errorsOf(level).join(" ")).toMatch(/hp: a health pickup needs a positive amount/);
  });

  it("rejects zero and negative amounts", () => {
    for (const amount of [0, -5]) {
      const level = broken((l) => {
        l.pickups!.push({ id: "hp", type: "health", amount, ...at });
      });
      expect(errorsOf(level).join(" ")).toMatch(/positive amount/);
    }
  });

  it("the campaign's three levels with packs validate with no errors", () => {
    for (const json of [level12, level13, level14]) {
      const level = json as unknown as Level;
      expect(validateLevel(level).errors, level.meta.id).toEqual([]);
      const packs = (level.pickups ?? []).filter((p) => p.type === "health");
      expect(packs.length, level.meta.id).toBeGreaterThanOrEqual(2);
      expect(packs.length, level.meta.id).toBeLessThanOrEqual(3);
      for (const p of packs) expect(p.amount).toBe(25);
    }
  });
});
