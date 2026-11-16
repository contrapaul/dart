import { EDITOR, type EntryKind, type IdEntry } from "./doc";
import { readClip, type Clip } from "./clipboard";

// ED-23: saved assets. An asset is a selection kept under a name with a
// small picture, to place again in any level. It is editor data, not level
// data: it lives in this browser (IndexedDB, in its own database so the
// levels' one is never touched) and moves between machines as a file. The
// panel is src/editor/asset-panel.ts; the page places an asset as a paste.

/** The caps (data/editor.json `assets`): how many assets the browser keeps,
 *  how many things one may hold, and the picture's side in pixels. */
export const ASSET_LIMITS: { max: number; maxThings: number; pictureSize: number } = EDITOR.assets;

/** The longest name, and the longest picture (a data: URL) kept. */
const NAME_LENGTH = 60;
const PICTURE_LENGTH = 200_000;

/** What an asset is made of, as a file carries it. */
export interface AssetBody {
  name: string;
  clip: Clip;
  /** A data: URL of a small picture, or "" for none. */
  picture: string;
}

export interface Asset extends AssetBody {
  /** The store's key: made once when the asset is saved. */
  key: string;
  /** Milliseconds since 1970, for the panel's order. */
  saved: number;
}

export interface AssetsFile {
  dart: "dart-assets";
  version: 1;
  assets: AssetBody[];
}

/** How many things a clip holds. */
export function clipCount(clip: Clip): number {
  return Object.values(clip.entries).reduce((n, list) => n + list.length, 0);
}

/** Why a selection cannot be saved as an asset, or null when it can.
 *  `have` is how many assets are stored already. */
export function assetProblem(clip: Clip, have: number): string | null {
  const count = clipCount(clip);
  if (!count) return "Not saved: nothing that can be copied is selected.";
  if (count > ASSET_LIMITS.maxThings) {
    return `Not saved: ${count} things is over the cap of ${ASSET_LIMITS.maxThings} for one asset.`;
  }
  if (have >= ASSET_LIMITS.max) return `Not saved: ${have} assets is the cap. Delete one first.`;
  return null;
}

/** A name as it is stored: trimmed and not too long. Empty stays empty. */
export function tidyName(name: string): string {
  return name.trim().replace(/\s+/g, " ").slice(0, NAME_LENGTH);
}

/** `name`, or `name 2`, `name 3` and so on when it is taken, so an import
 *  never replaces an asset. */
export function freeName(name: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  if (!used.has(name)) return name;
  let n = 2;
  while (used.has(`${name} ${n}`)) n += 1;
  return `${name} ${n}`;
}

/** Pasted entries put in one group, so a placed asset selects and moves as
 *  one. A trigger is never grouped, and a single thing needs no group. */
export function asOneGroup(
  made: { kind: EntryKind; entry: IdEntry }[], group: string,
): { kind: EntryKind; entry: IdEntry }[] {
  if (made.filter((m) => m.kind !== "triggers").length < 2) return made;
  return made.map((m) => (m.kind === "triggers" ? m : { kind: m.kind, entry: { ...m.entry, group } }));
}

export function assetsFileText(assets: AssetBody[]): string {
  const file: AssetsFile = {
    dart: "dart-assets",
    version: 1,
    assets: assets.map(({ name, clip, picture }) => ({ name, clip, picture })),
  };
  return JSON.stringify(file, null, 2);
}

/** A file name for an export: the asset's name for one, "assets" for more. */
export function assetsFileName(assets: AssetBody[]): string {
  const slug = assets.length === 1
    ? assets[0]!.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
    : "assets";
  return `${slug || "asset"}.dart-assets.json`;
}

/** Reads an imported file's text. A file that is not ours, a newer version
 *  or a broken asset is refused whole, with the reason. A picture that is
 *  not a small image held in the file itself is dropped, so nothing is ever
 *  fetched from another host. */
export function readAssetsFile(text: string): { assets: AssetBody[]; error: string | null } {
  const no = (error: string) => ({ assets: [], error });
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return no("Not an assets file: it is not JSON.");
  }
  const file = data as Partial<AssetsFile> | null;
  if (!file || typeof file !== "object" || file.dart !== "dart-assets") return no("Not an assets file.");
  if (file.version !== 1) return no("This assets file is from a newer editor.");
  if (!Array.isArray(file.assets) || !file.assets.length) return no("This assets file holds no assets.");
  const assets: AssetBody[] = [];
  for (const [i, raw] of file.assets.entries()) {
    const clip = raw && typeof raw === "object" ? readClip(JSON.stringify(raw.clip ?? null)) : null;
    if (!clip || !clipCount(clip)) return no(`Asset ${i + 1} in the file is broken.`);
    if (clipCount(clip) > ASSET_LIMITS.maxThings) {
      return no(`Asset ${i + 1} in the file is over the cap of ${ASSET_LIMITS.maxThings} things.`);
    }
    const picture = typeof raw.picture === "string" && /^data:image\/(png|jpeg);base64,/.test(raw.picture)
      && raw.picture.length <= PICTURE_LENGTH ? raw.picture : "";
    assets.push({ name: tidyName(typeof raw.name === "string" ? raw.name : "") || "asset", clip, picture });
  }
  return { assets, error: null };
}

/** The imported assets ready to store beside the ones already here: each
 *  with a name that is not taken, and no more than the cap has room for.
 *  `left` is how many did not fit. */
export function fitImport(incoming: AssetBody[], have: AssetBody[]): { assets: AssetBody[]; left: number } {
  const room = Math.max(0, ASSET_LIMITS.max - have.length);
  const names = have.map((a) => a.name);
  const assets = incoming.slice(0, room).map((a) => {
    const name = freeName(a.name, names);
    names.push(name);
    return { ...a, name };
  });
  return { assets, left: incoming.length - assets.length };
}

// The store. A database of its own, so adding it changes nothing about the
// levels' database that the game also opens.

const DB = "dart.assets";
const STORE = "assets";

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

/** The stored assets, newest first. */
export function listAssets(): Promise<Asset[]> {
  return run("readonly", (s) => s.getAll() as IDBRequest<Asset[]>)
    .then((all) => all.sort((a, b) => b.saved - a.saved));
}

let serial = 0;

/** Stores an asset. With `key` it replaces that one (a rename); without,
 *  it is a new one. */
export async function putAsset(body: AssetBody, key?: string, saved = Date.now()): Promise<Asset> {
  serial += 1;
  const asset: Asset = {
    key: key ?? `asset-${Date.now().toString(36)}-${serial}`, saved,
    name: body.name, clip: body.clip, picture: body.picture,
  };
  await run("readwrite", (s) => s.put(asset));
  return asset;
}

export function deleteAsset(key: string): Promise<undefined> {
  return run("readwrite", (s) => s.delete(key) as IDBRequest<undefined>);
}
