import { describe, expect, it } from "vitest";
import {
  FORMULA_LIMITS, MAX_WAVES, formulasFileName, formulasFileText, freeFormulaName,
  formulaProblem, fitImport, readFormulasFile, tidyFormulaName,
  type ArenaFormula, type ArenaFormulaWave,
} from "../../src/editor/arena-formulas";

// R3-08: saved arena formulas. The store itself (IndexedDB) is checked in
// the browser; these are the rules it follows.

const wave: ArenaFormulaWave = { foamer: "F01", count: 3 };
const formula: ArenaFormula = {
  name: "gap",
  waves: [wave, { foamer: "F12", count: 2, promoted: true, holdSeconds: 0.5, delaySeconds: 2 }],
  lockDoors: true,
  unlockOnClear: true,
};

describe("R3-08 saved arena formulas", () => {
  it("tidies a name", () => {
    expect(tidyFormulaName("  my   fight ")).toBe("my fight");
    expect(tidyFormulaName("x".repeat(200)).length).toBe(60);
    expect(tidyFormulaName("   ")).toBe("");
  });

  it("finds a name that is not taken", () => {
    expect(freeFormulaName("gap", [])).toBe("gap");
    expect(freeFormulaName("gap", ["gap"])).toBe("gap 2");
    expect(freeFormulaName("gap", ["gap", "gap 2"])).toBe("gap 3");
  });

  it("refuses a nameless, waveless, over-cap or full-store formula", () => {
    expect(formulaProblem("", [wave], 0)).toMatch(/name/);
    expect(formulaProblem("gap", [], 0)).toMatch(/wave/);
    expect(formulaProblem("gap", Array.from({ length: MAX_WAVES + 1 }, () => wave), 0)).toMatch(/over the cap/);
    expect(formulaProblem("gap", [{ foamer: "", count: 1 }], 0)).toMatch(/Foamer/);
    expect(formulaProblem("gap", [{ foamer: "F01", count: 0 }], 0)).toMatch(/Foamer/);
    expect(formulaProblem("gap", [wave], FORMULA_LIMITS.max)).toMatch(/is the cap/);
    expect(formulaProblem("gap", [wave], FORMULA_LIMITS.max - 1)).toBeNull();
  });

  it("writes and reads a file back", () => {
    const text = formulasFileText([formula]);
    const { formulas, error } = readFormulasFile(text);
    expect(error).toBeNull();
    expect(formulas).toEqual([formula]);
  });

  it("refuses a broken file", () => {
    expect(readFormulasFile("not json").error).toMatch(/not JSON/);
    expect(readFormulasFile(JSON.stringify({ dart: "dart-assets", version: 1, formulas: [] })).error).toMatch(/Not a formulas file/);
    expect(readFormulasFile(JSON.stringify({ dart: "dart-arena-formulas", version: 2, formulas: [formula] })).error).toMatch(/newer/);
    expect(readFormulasFile(JSON.stringify({ dart: "dart-arena-formulas", version: 1, formulas: [] })).error).toMatch(/no formulas/);
    const noName = { ...formula, name: "" };
    expect(readFormulasFile(JSON.stringify({ dart: "dart-arena-formulas", version: 1, formulas: [noName] })).error).toMatch(/no name/);
    const noWaves = { ...formula, waves: [] };
    expect(readFormulasFile(JSON.stringify({ dart: "dart-arena-formulas", version: 1, formulas: [noWaves] })).error).toMatch(/no waves/);
    const badWave = { ...formula, waves: [{ foamer: "", count: 2 }] };
    expect(readFormulasFile(JSON.stringify({ dart: "dart-arena-formulas", version: 1, formulas: [badWave] })).error).toMatch(/broken wave/);
    const badCount = { ...formula, waves: [{ foamer: "F01", count: 0 }] };
    expect(readFormulasFile(JSON.stringify({ dart: "dart-arena-formulas", version: 1, formulas: [badCount] })).error).toMatch(/broken wave/);
    const badNeg = { ...formula, waves: [{ foamer: "F01", count: 1, holdSeconds: -1 }] };
    expect(readFormulasFile(JSON.stringify({ dart: "dart-arena-formulas", version: 1, formulas: [badNeg] })).error).toMatch(/broken wave/);
  });

  it("refuses a file over the cap", () => {
    const many = Array.from({ length: FORMULA_LIMITS.max + 1 }, (_, i) => ({ ...formula, name: `f${i}` }));
    expect(readFormulasFile(JSON.stringify({ dart: "dart-arena-formulas", version: 1, formulas: many })).error).toMatch(/over the cap/);
  });

  it("names an export after the one formula, or formulas for more", () => {
    expect(formulasFileName([formula])).toBe("gap.dart-arena-formulas.json");
    expect(formulasFileName([{ ...formula, name: "??" }])).toBe("formula.dart-arena-formulas.json");
    expect(formulasFileName([formula, formula])).toBe("formulas.dart-arena-formulas.json");
  });

  it("fits an import under the cap, giving names that are not taken", () => {
    const have = [formula];
    const { formulas, left } = fitImport([{ ...formula, name: "gap" }, { name: "b", waves: [wave], lockDoors: false, unlockOnClear: false }], have);
    expect(left).toBe(0);
    expect(formulas.map((f) => f.name)).toEqual(["gap 2", "b"]);
    const full = Array.from({ length: FORMULA_LIMITS.max }, (_, i) => ({ ...formula, name: `f${i}` }));
    expect(fitImport([formula], full).left).toBe(1);
  });
});
