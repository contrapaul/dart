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
  /** A small JPEG data: URL of the level, or absent (older saves). */
  picture?: string;
}

/** How often the editor may re-take a saved level's picture, so typing
 *  does not redraw it per keystroke. */
export const PICTURE_EVERY = 10_000;

/** True when a picture may be taken now: never taken, or taken long ago. */
export function pictureDue(lastTaken: number | null, now: number): boolean {
  return lastTaken === null || now - lastTaken >= PICTURE_EVERY;
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

/** Saves a level under `key` (a new key when omitted) and returns the key.
 *  `picture` (a small data: URL) is kept when given; otherwise an earlier
 *  picture is kept, so a save without a retake does not drop the thumbnail. */
export async function putLevel(
  level: Level,
  key = `lvl-${Date.now().toString(36)}`,
  picture?: string,
): Promise<string> {
  const old = await getLevel(key).catch(() => undefined);
  const kept = picture ?? old?.picture;
  const stored: StoredLevel = kept ? { key, saved: Date.now(), level, picture: kept } : { key, saved: Date.now(), level };
  await run("readwrite", (s) => s.put(stored));
  return key;
}

export function deleteLevel(key: string): Promise<undefined> {
  return run("readwrite", (s) => s.delete(key) as IDBRequest<undefined>);
}
