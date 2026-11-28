import { EDITOR } from "./doc";

// R3-08: saved arena formulas. A formula is a reusable fight recipe: the
// waves, lockDoors and unlockOnClear. Zone, spawn points, blockers and doors
// are level specific and are not carried. Like saved assets, a formula is
// editor data: it lives in this browser (IndexedDB, its own database) and
// moves between machines as a file. The panel is the dialog's Formula row,
// built in src/editor/main.ts.

/** The caps (data/editor.json `arenaFormulas`): how many formulas this
 *  browser keeps. */
export const FORMULA_LIMITS: { max: number } = EDITOR.arenaFormulas;

/** The longest name kept. */
export const NAME_LENGTH = 60;
/** The longest wave list a formula may carry. */
export const MAX_WAVES = 20;

/** One wave as a formula carries it. `promoted` and `holdSeconds` arrive as
 *  optional fields, like the trigger spawn action takes them. */
export interface ArenaFormulaWave {
  foamer: string;
  count: number;
  promoted?: boolean;
  holdSeconds?: number;
  delaySeconds?: number;
}

export interface ArenaFormula {
  name: string;
  waves: ArenaFormulaWave[];
  /** Close the picked doors when the fight starts. */
  lockDoors: boolean;
  /** Open the picked doors when the fight is won. */
  unlockOnClear: boolean;
}

export interface FormulasFile {
  dart: "dart-arena-formulas";
  version: 1;
  formulas: ArenaFormula[];
}

/** A name as it is stored: trimmed, single spaced, not too long. Empty stays empty. */
export function tidyFormulaName(name: string): string {
  return name.trim().replace(/\s+/g, " ").slice(0, NAME_LENGTH);
}

/** `name`, or `name 2`, `name 3` and so on when it is taken, so an import
 *  never replaces a formula. */
export function freeFormulaName(name: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  if (!used.has(name)) return name;
  let n = 2;
  while (used.has(`${name} ${n}`)) n += 1;
  return `${name} ${n}`;
}

function readWave(raw: unknown): ArenaFormulaWave | null {
  if (!raw || typeof raw !== "object") return null;
  const w = raw as Record<string, unknown>;
  if (typeof w.foamer !== "string" || !w.foamer.trim()) return null;
  const count = Number(w.count);
  if (!Number.isFinite(count) || count < 1) return null;
  const wave: ArenaFormulaWave = { foamer: w.foamer.trim(), count: Math.round(count) };
  if (typeof w.promoted === "boolean") wave.promoted = w.promoted;
  if (w.holdSeconds !== undefined) {
    const hold = Number(w.holdSeconds);
    if (!Number.isFinite(hold) || hold < 0) return null;
    wave.holdSeconds = hold;
  }
  if (w.delaySeconds !== undefined) {
    const delay = Number(w.delaySeconds);
    if (!Number.isFinite(delay) || delay < 0) return null;
    wave.delaySeconds = delay;
  }
  return wave;
}

/** Why a formula cannot be saved, or null when it can. `have` is how many
 *  formulas are stored already. */
export function formulaProblem(name: string, waves: ArenaFormulaWave[], have: number): string | null {
  if (!tidyFormulaName(name)) return "Not saved: give the formula a name first.";
  if (!waves.length) return "Not saved: a formula needs at least one wave.";
  if (waves.length > MAX_WAVES) return `Not saved: ${waves.length} waves is over the cap of ${MAX_WAVES}.`;
  if (waves.some((w) => !w.foamer || !(w.count >= 1))) return "Not saved: every wave needs a Foamer and a count of one or more.";
  if (have >= FORMULA_LIMITS.max) return `Not saved: ${have} formulas is the cap. Delete one first.`;
  return null;
}

export function formulasFileText(formulas: ArenaFormula[]): string {
  const file: FormulasFile = {
    dart: "dart-arena-formulas",
    version: 1,
    formulas: formulas.map((f) => ({
      name: f.name,
      waves: f.waves.map((w) => ({ ...w })),
      lockDoors: f.lockDoors,
      unlockOnClear: f.unlockOnClear,
    })),
  };
  return JSON.stringify(file, null, 2);
}

/** A file name for an export: the one formula's name, or "formulas" for more. */
export function formulasFileName(formulas: ArenaFormula[]): string {
  const slug = formulas.length === 1
    ? formulas[0]!.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
    : "formulas";
  return `${slug || "formula"}.dart-arena-formulas.json`;
}

/** Reads an imported file's text. A file that is not ours, a newer version
 *  or a broken formula is refused whole, with the reason. */
export function readFormulasFile(text: string): { formulas: ArenaFormula[]; error: string | null } {
  const no = (error: string) => ({ formulas: [], error });
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return no("Not a formulas file: it is not JSON.");
  }
  const file = data as Partial<FormulasFile> | null;
  if (!file || typeof file !== "object" || file.dart !== "dart-arena-formulas") return no("Not a formulas file.");
  if (file.version !== 1) return no("This formulas file is from a newer editor.");
  if (!Array.isArray(file.formulas) || !file.formulas.length) return no("This formulas file holds no formulas.");
  if (file.formulas.length > FORMULA_LIMITS.max) return no(`This formulas file holds ${file.formulas.length} formulas, over the cap of ${FORMULA_LIMITS.max}.`);
  const formulas: ArenaFormula[] = [];
  for (const [i, raw] of file.formulas.entries()) {
    const name = tidyFormulaName(typeof (raw as { name?: unknown } | null)?.name === "string" ? (raw as { name: string }).name : "");
    if (!name) return no(`Formula ${i + 1} in the file has no name.`);
    const waves = (raw as { waves?: unknown })?.waves;
    if (!Array.isArray(waves) || !waves.length) return no(`Formula ${i + 1} in the file has no waves.`);
    if (waves.length > MAX_WAVES) return no(`Formula ${i + 1} in the file is over the wave cap.`);
    const read = waves.map(readWave);
    if (read.some((w) => w === null)) return no(`Formula ${i + 1} in the file has a broken wave.`);
    const f: ArenaFormula = {
      name,
      waves: read as ArenaFormulaWave[],
      lockDoors: Boolean((raw as { lockDoors?: unknown }).lockDoors),
      // Omitted means true, as in the dialog and buildArena (review, GPU0).
      unlockOnClear: (raw as { unlockOnClear?: unknown }).unlockOnClear !== false,
    };
    formulas.push(f);
  }
  return { formulas, error: null };
}

/** The imported formulas ready to store beside the ones already here: each
 *  with a name that is not taken, and no more than the cap has room for.
 *  `left` is how many did not fit. */
export function fitImport(incoming: ArenaFormula[], have: ArenaFormula[]): { formulas: ArenaFormula[]; left: number } {
  const room = Math.max(0, FORMULA_LIMITS.max - have.length);
  const names = have.map((f) => f.name);
  const formulas = incoming.slice(0, room).map((f) => {
    const name = freeFormulaName(f.name, names);
    names.push(name);
    return { ...f, name };
  });
  return { formulas, left: incoming.length - formulas.length };
}

// The store. A database of its own, so adding it changes nothing about the
// levels' database that the game also opens.

const DB = "dart.arena-formulas";
const STORE = "formulas";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "name" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, work: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = work(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

/** The stored formulas, name order. */
export function listFormulas(): Promise<ArenaFormula[]> {
  return run("readonly", (s) => s.getAll() as IDBRequest<ArenaFormula[]>)
    .then((all) => all.sort((a, b) => a.name.localeCompare(b.name)));
}

/** Stores a formula, replacing the one of the same name. Returns the stored
 *  formula. */
export async function putFormula(formula: ArenaFormula): Promise<ArenaFormula> {
  const stored: ArenaFormula = {
    name: tidyFormulaName(formula.name),
    waves: formula.waves.map((w) => ({ ...w })),
    lockDoors: formula.lockDoors,
    unlockOnClear: formula.unlockOnClear,
  };
  await run("readwrite", (s) => s.put(stored));
  return stored;
}

export function deleteFormula(name: string): Promise<undefined> {
  return run("readwrite", (s) => s.delete(name) as IDBRequest<undefined>);
}
