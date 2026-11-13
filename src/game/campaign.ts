import campaignJson from "../../data/campaign.json";

// LVL-05: the campaign's rules, pure and headless (no DOM, no THREE), so
// the arena page and the tests share one answer. The rules themselves are
// Paul's (PLAN.md section 14) and live in data/campaign.json: the level
// order, the blasters a new game starts with, and the blaster each level
// gives. Stage 2's save holds the same state (owned blasters, health, ammo).
//
// A level id here is the arena page's own `?level=` name ("1-1-pit"),
// because that is what the page and the order both name.

interface CampaignData {
  order: string[];
  startBlasters: string[];
  found: Record<string, string>;
}

const DATA = campaignJson as CampaignData;

/** The levels in play order. Act 1 only: 1-1 is just the Pit for now. */
export const CAMPAIGN_ORDER: readonly string[] = DATA.order;

/** The blasters a new campaign starts with (the B02 Musketeer alone). */
export const CAMPAIGN_START: readonly string[] = DATA.startBlasters;

/** Paul's plan: the level that gives each blaster, Act 2 and 3 included. */
export const CAMPAIGN_FOUND: Readonly<Record<string, string>> = DATA.found;

/** True when the page's search string asks for campaign play
 *  (`arena.html?level=1-2&campaign`). Without it the page is the test
 *  page it has always been: every blaster owned. */
export function campaignMode(search: string): boolean {
  return new URLSearchParams(search).has("campaign");
}

/** The level's place in the order, or -1 for a level that is not in it. */
export function levelIndex(levelId: string): number {
  return DATA.order.indexOf(levelId);
}

/** The blaster a level gives, or null for a level that gives none. */
export function foundAt(levelId: string): string | null {
  return DATA.found[levelId] ?? null;
}

/** The blasters owned when `levelId` begins in a fresh campaign: the
 *  start set plus every blaster the levels before it in the order give.
 *  A level that is not in the order owns the start set alone, because
 *  nothing proves it comes after anything. */
export function ownedAt(levelId: string): string[] {
  const owned = [...DATA.startBlasters];
  if (levelIndex(levelId) < 0) return owned;
  for (const id of DATA.order) {
    if (id === levelId) break;
    const b = DATA.found[id];
    if (b && !owned.includes(b)) owned.push(b);
  }
  return owned;
}

/** The level after `levelId` in the order, or null after the last one. */
export function nextLevel(levelId: string): string | null {
  const i = levelIndex(levelId);
  if (i < 0 || i + 1 >= DATA.order.length) return null;
  return DATA.order[i + 1]!;
}
