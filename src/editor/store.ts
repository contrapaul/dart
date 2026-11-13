import type { Level } from "../level/format";

// ED-00: the player's own levels, kept in this browser (IndexedDB), so the
// editor saves them and the game plays them with `arena.html?level=local:<key>`.
// Nothing leaves the browser: sharing is by exported file (design/EDITOR.md 5).

const DB = "dart.levels";
const STORE = "levels";

export interface StoredLevel {
  /** The store's key: made once when the level is first saved. */
  key: string;
  /** Milliseconds since 1970, for the My levels list. */
  saved: number;
  level: Level;
}

/** The `?level=` prefix for a stored level. */
export const LOCAL_PREFIX = "local:";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "key" });
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

export function listLevels(): Promise<StoredLevel[]> {
  return run("readonly", (s) => s.getAll() as IDBRequest<StoredLevel[]>)
    .then((all) => all.sort((a, b) => b.saved - a.saved));
}

export function getLevel(key: string): Promise<StoredLevel | undefined> {
  return run("readonly", (s) => s.get(key) as IDBRequest<StoredLevel | undefined>);
}

/** Saves a level under `key` (a new key when omitted) and returns the key. */
export async function putLevel(level: Level, key = `lvl-${Date.now().toString(36)}`): Promise<string> {
  await run("readwrite", (s) => s.put({ key, saved: Date.now(), level } satisfies StoredLevel));
  return key;
}

export function deleteLevel(key: string): Promise<undefined> {
  return run("readwrite", (s) => s.delete(key) as IDBRequest<undefined>);
}
