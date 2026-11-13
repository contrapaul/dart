import type { StoredLevel } from "./store";

// ED-09 stage 2: which level the editor opens with. `?open=<key>` names one
// (My levels' Edit button uses it); without it the editor opens the most
// recently saved level, and a browser with none gets a new one. Plain data,
// so the choice can be tested without a browser.

export interface OpenChoice {
  /** The stored level to open, or null for a new one. */
  key: string | null;
  /** The key `?open=` named that the store does not hold, or null. The page
   *  says so in the status line and opens the latest instead. */
  missing: string | null;
}

/** The key `?open=` names, or null when the page has no such parameter. */
export function openKey(search: string): string | null {
  const key = new URLSearchParams(search).get("open");
  return key ? key : null;
}

/** Which stored level to open: the one `?open=` names, else the newest, else
 *  none (a new level). `stored` is the store's list, newest first. */
export function openChoice(search: string, stored: StoredLevel[]): OpenChoice {
  const wanted = openKey(search);
  if (wanted) {
    if (stored.some((s) => s.key === wanted)) return { key: wanted, missing: null };
    return { key: stored[0]?.key ?? null, missing: wanted };
  }
  return { key: stored[0]?.key ?? null, missing: null };
}
