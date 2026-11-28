import committed from "../../data/tuning.json";

// R3 (Paul, 2026-11-28): one set of tuning numbers for every workspace. The
// game's numbers stay in data/foamers.json, data/foamer-rigs.json and
// data/blasters.json; this is a patch over them, in two layers:
//
//   1. data/tuning.json, committed: what the live game and every student
//      gets. Paul updates it by exporting his tuning and committing the file.
//   2. An override in this browser (localStorage "dart.tuning"): what Paul
//      is trying now. Every page on this site reads the same override, so a
//      number tuned in the editor is the number in the range, the arena and
//      play, until Reset clears it.
//
// A patch is merged deep over the resolved spec: objects merge, arrays and
// plain values replace. The merges themselves happen where the specs are
// resolved (`specFor` and `rigFor` in src/foamers/foamers.ts, `resolveSpec`
// in src/weapons/blaster.ts), which listen for changes here.

/** A patch for one Foamer type: its spec (data/foamers.json) and its rig
 *  (data/foamer-rigs.json: speed, health, voxelSize for its size). */
export interface FoamerTune {
  spec?: Record<string, unknown>;
  rig?: Record<string, unknown>;
}

export interface TuningFile {
  version: 1;
  foamers: Record<string, FoamerTune>;
  blasters: Record<string, Record<string, unknown>>;
}

const KEY = "dart.tuning";

function empty(): TuningFile {
  return { version: 1, foamers: {}, blasters: {} };
}

/** Objects merge key by key, arrays and plain values replace. Returns a new
 *  object; neither input is changed. */
export function deepMerge<T>(base: T, patch: unknown): T {
  if (patch === undefined) return base;
  if (!isRecord(base) || !isRecord(patch)) return patch as T;
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(patch)) out[k] = deepMerge(out[k], v);
  return out as T;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function readLocal(): TuningFile {
  try {
    const text = globalThis.localStorage?.getItem(KEY);
    if (!text) return empty();
    const data = JSON.parse(text) as Partial<TuningFile>;
    return { version: 1, foamers: data.foamers ?? {}, blasters: data.blasters ?? {} };
  } catch {
    return empty();
  }
}

function writeLocal(t: TuningFile) {
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(t));
  } catch {
    // A browser that refuses storage keeps the change for this page only.
  }
}

let local = readLocal();
let merged = deepMerge(committed as unknown as TuningFile, local);
const listeners = new Set<() => void>();

function changed() {
  merged = deepMerge(committed as unknown as TuningFile, local);
  for (const fn of listeners) fn();
}

// Another tab of this site (the range while the editor is open) changed it.
globalThis.addEventListener?.("storage", (e: StorageEvent) => {
  if (e.key !== KEY) return;
  local = readLocal();
  changed();
});

/** The tuning in force: the committed file with this browser's override. */
export function tuning(): TuningFile {
  return merged;
}

/** This browser's override alone (what Reset clears). */
export function localTuning(): TuningFile {
  return local;
}

/** Runs `fn` after any change, here or in another tab. Returns an off. */
export function onTuningChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Merges a patch into one Foamer type's override. */
export function tuneFoamer(type: string, patch: FoamerTune) {
  local = { ...local, foamers: { ...local.foamers, [type]: deepMerge(local.foamers[type] ?? {}, patch) } };
  writeLocal(local);
  changed();
}

/** Merges a patch into one blaster's override. */
export function tuneBlaster(id: string, patch: Record<string, unknown>) {
  local = { ...local, blasters: { ...local.blasters, [id]: deepMerge(local.blasters[id] ?? {}, patch) } };
  writeLocal(local);
  changed();
}

/** Clears the override: all of it, one Foamer type's, or one blaster's. The
 *  committed file is untouched. */
export function resetTuning(scope: { foamer?: string; blaster?: string } = {}) {
  if (scope.foamer) {
    const { [scope.foamer]: _gone, ...rest } = local.foamers;
    local = { ...local, foamers: rest };
  } else if (scope.blaster) {
    const { [scope.blaster]: _gone, ...rest } = local.blasters;
    local = { ...local, blasters: rest };
  } else local = empty();
  writeLocal(local);
  changed();
}

/** The tuning in force as a file to commit as data/tuning.json: what the
 *  live game, and every student, then gets. */
export function exportTuning(): string {
  return JSON.stringify({ ...merged, version: 1 }, null, 2) + "\n";
}

/** For tests: replaces the override as if read fresh. */
export function setLocalTuningForTest(t: TuningFile) {
  local = t;
  changed();
}
