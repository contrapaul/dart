import campaignJson from "../../data/campaign.json";
import blastersJson from "../../data/blasters.json";
import meleeJson from "../../data/melee.json";
import playerJson from "../../data/player.json";

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
  /** MEL-01: the hand weapons a new campaign owns (none) and the one each
   *  level gives, by the same rule as the blasters. */
  startMelee: string[];
  foundMelee: Record<string, string>;
}

const DATA = campaignJson as CampaignData;

// MEL-01: the hand weapons the melee can be set to, by id, from the same
// data the melee itself reads (`weapons` there is one entry per weapon).
const MELEE = meleeJson as unknown as { weapons: Record<string, unknown> };
const MELEE_IDS = new Set(Object.keys(MELEE.weapons));

// LVL-05 stage 2: the carried ammo comes from the blasters' own sizes, and
// the health from the player's own maximum, so the numbers stay in data/.
interface BlasterStats {
  magSize: number;
  reserveStart: number;
  reserveMax: number;
  reserveInfinite?: boolean;
}
const BLASTERS = blastersJson as unknown as Record<string, Partial<BlasterStats>>;
const HEALTH_MAX = (playerJson as unknown as { health: { max: number } }).health.max;

function stats(id: string): BlasterStats {
  const raw = BLASTERS[id] ?? {};
  return {
    magSize: raw.magSize ?? 0,
    reserveStart: raw.reserveStart ?? 0,
    reserveMax: raw.reserveMax ?? raw.reserveStart ?? 0,
    reserveInfinite: raw.reserveInfinite ?? false,
  };
}

/** The levels in play order. Act 1 only: 1-1 is just the Pit for now. */
export const CAMPAIGN_ORDER: readonly string[] = DATA.order;

/** The blasters a new campaign starts with (the B02 Musketeer alone). */
export const CAMPAIGN_START: readonly string[] = DATA.startBlasters;

/** Paul's plan: the level that gives each blaster, Act 2 and 3 included. */
export const CAMPAIGN_FOUND: Readonly<Record<string, string>> = DATA.found;

/** MEL-01: the hand weapons a new campaign starts with (none: the melee
 *  key is the bash until the sword is found). */
export const CAMPAIGN_START_MELEE: readonly string[] = DATA.startMelee;

/** MEL-01: the level that gives each hand weapon (the M01 sword in 2-1). */
export const CAMPAIGN_FOUND_MELEE: Readonly<Record<string, string>> = DATA.foundMelee;

/** MEL-01: every hand weapon id the melee knows (`weapons` in
 *  data/melee.json). A save or a level naming anything else is refused. */
export const MELEE_IDS_KNOWN: ReadonlySet<string> = MELEE_IDS;

/** MEL-01: the hand weapons owned when `levelId` begins in a fresh
 *  campaign: the start set plus every one the levels before it give. The
 *  blaster rule (`ownedAt`), for the hand weapons. */
export function ownedMeleeAt(levelId: string): string[] {
  const owned = [...DATA.startMelee];
  if (levelIndex(levelId) < 0) return owned;
  for (const id of DATA.order) {
    if (id === levelId) break;
    const m = DATA.foundMelee[id];
    if (m && !owned.includes(m)) owned.push(m);
  }
  return owned;
}

/** MEL-01: the hand weapon a level gives, or null for a level that gives
 *  none. */
export function foundMeleeAt(levelId: string): string | null {
  return DATA.foundMelee[levelId] ?? null;
}

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

/** The first level of the campaign: a new game's level. */
export function firstLevel(): string {
  return DATA.order[0]!;
}

/** The arena page's URL for one level in campaign play. */
export function campaignUrl(levelId: string): string {
  return "/arena.html?level=" + encodeURIComponent(levelId) + "&campaign";
}

// --- The save (LVL-05 stage 2) -----------------------------------------

/** One blaster's ammo in the save: its magazine and its reserve. */
export interface CarriedBlaster {
  id: string;
  mag: number;
  reserve: number;
}

/** The whole carried state: the level to play, the blasters and their ammo,
 *  and the player's health. The campaign's own version number lets a save
 *  from an older shape be ignored instead of half-read. */
export interface CampaignState {
  version: number;
  level: string;
  blasters: CarriedBlaster[];
  health: number;
  /** MEL-01: the hand weapons owned. A version 1 save has none here: it
   *  loads with an empty list, so an Act 1 save from before the sword keeps
   *  its level, blasters and health. */
  melee: string[];
}

export const SAVE_KEY = "dart.save.v1";
/** MEL-01: 2 adds the owned hand weapons to the save. */
export const SAVE_VERSION = 2;
/** The version before the hand weapons: still read, with none owned. */
export const SAVE_VERSION_LEGACY = 1;

/** Just the two methods the save needs, so the tests can hand in a fake
 *  storage (and Node, which has no localStorage, still loads this module). */
interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function store(): StorageLike | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage ?? null;
  } catch {
    return null; // storage blocked: the game plays without a save
  }
}

/** A blaster with a full magazine and its starting reserve. */
export function filledBlaster(id: string): CarriedBlaster {
  const s = stats(id);
  return { id, mag: s.magSize, reserve: s.reserveStart };
}

/** A new game: the first level, the start set at full ammo, full health,
 *  and the hand weapons the campaign starts with (none). */
export function newGame(): CampaignState {
  return {
    version: SAVE_VERSION,
    level: firstLevel(),
    blasters: DATA.startBlasters.map(filledBlaster),
    health: HEALTH_MAX,
    melee: [...DATA.startMelee],
  };
}

/** The state a level begins with. The save's own state when it names this
 *  level (so a restart, or a Continue, begins with what the player carried
 *  in); otherwise a fresh campaign state for the level, with the blasters
 *  the order gives by its start and full ammo. */
export function entryState(levelId: string, save: CampaignState | null): CampaignState {
  if (save && save.version === SAVE_VERSION && save.level === levelId) return save;
  return {
    version: SAVE_VERSION,
    level: levelId,
    blasters: ownedAt(levelId).map(filledBlaster),
    health: HEALTH_MAX,
    melee: ownedMeleeAt(levelId),
  };
}

/** The state the next level begins with, after `levelId` was finished with
 *  this ammo and health. After the last level of the order there is no next
 *  one: the state keeps the level it was, so a Continue replays it. */
export function carryTo(
  levelId: string,
  blasters: readonly CarriedBlaster[],
  health: number,
  melee: readonly string[] = ownedMeleeAt(nextLevel(levelId) ?? levelId),
): CampaignState {
  const next = nextLevel(levelId);
  return {
    version: SAVE_VERSION,
    level: next ?? levelId,
    blasters: blasters.map((b) => ({ id: b.id, mag: b.mag, reserve: b.reserve })),
    health: next ? healthInto(levelId, next, health) : health,
    // MEL-01: a hand weapon found stays found; one the level ended with is
    // owned by the next level (the player carried it out).
    melee: [...melee],
  };
}

/** Paul, 2026-11-13: health carries from level to level within an act, and
 *  is full again when the next level starts a new act (1-x to 2-x, 2-x to
 *  3-x). The act is the level id's first part ("2" in "2-1"). */
export function healthInto(fromLevel: string, toLevel: string, health: number): number {
  const act = (id: string) => id.split("-")[0];
  return act(fromLevel) === act(toLevel) ? health : HEALTH_MAX;
}

/** The saved campaign state, or null when there is none, it is broken, or
 *  it was written by an older version: null always means a new game. */
export function readSave(): CampaignState | null {
  const s = store();
  if (!s) return null;
  let raw: string | null = null;
  try {
    raw = s.getItem(SAVE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  return validState(parsed);
}

function validState(v: unknown): CampaignState | null {
  if (typeof v !== "object" || v === null) return null;
  const o = v as Record<string, unknown>;
  // MEL-01: a version 1 save is read as it is, with no hand weapon owned,
  // so a player's Act 1 progress is not thrown away by the sword's arrival.
  const legacy = o.version === SAVE_VERSION_LEGACY;
  if (o.version !== SAVE_VERSION && !legacy) return null;
  if (typeof o.level !== "string" || levelIndex(o.level) < 0) return null;
  if (typeof o.health !== "number" || !Number.isFinite(o.health) || o.health <= 0) return null;
  if (!Array.isArray(o.blasters)) return null;
  const blasters: CarriedBlaster[] = [];
  for (const item of o.blasters) {
    if (typeof item !== "object" || item === null) return null;
    const b = item as Record<string, unknown>;
    if (typeof b.id !== "string" || !(b.id in BLASTERS)) return null;
    if (!Number.isFinite(b.mag) || !Number.isFinite(b.reserve)) return null;
    blasters.push({ id: b.id, mag: Number(b.mag), reserve: Number(b.reserve) });
  }
  if (blasters.length === 0) return null;
  return {
    version: SAVE_VERSION,
    level: o.level,
    blasters,
    health: o.health,
    melee: legacy ? [] : meleeIds(o.melee),
  };
}

/** MEL-01: the save's hand weapons: only ids the melee knows, once each.
 *  A save without the list (a damaged one) owns none, which is what a
 *  campaign that has not found the sword owns anyway. */
function meleeIds(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const ids: string[] = [];
  for (const id of v) {
    if (typeof id === "string" && MELEE_IDS.has(id) && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

/** Write the campaign state. Returns false when storage refused (blocked or
 *  full); the game keeps playing either way. */
export function writeSave(state: CampaignState): boolean {
  const s = store();
  if (!s) return false;
  try {
    s.setItem(SAVE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

/** Forget the save: New game starts from the first level again. */
export function clearSave(): void {
  const s = store();
  if (!s) return;
  try {
    s.removeItem(SAVE_KEY);
  } catch {
    // Blocked storage: there was nothing to forget.
  }
}

/** The live side of the carry: what a level's state is captured from and
 *  restored to. The page passes its own loadout and health through this
 *  shape; the tests pass plain objects, so the carry rule is tested without
 *  a browser. */
export interface LiveBlaster {
  id: string;
  mag: number;
  reserve: number;
  /** Break action only: which barrels hold a shell. The restore keeps it
   *  in step with the magazine, so the HUD's pips and the next press
   *  agree. */
  loaded?: boolean[];
}

export interface LiveCarry {
  /** The owned blasters, in the loadout's order. */
  blasters: LiveBlaster[];
  health: { hp: number };
  /** MEL-01: the hand weapons owned now, and the way to put a state's own
   *  set back (the melee's owned set, exactly as `setOwned` is the
   *  loadout's). Left out (the blaster-only tests), hand weapons are not
   *  carried or restored. */
  melee?: readonly string[];
  setOwnedMelee?(ids: readonly string[]): void;
  /** The loadout's owned set, when the caller has one: a restart makes it
   *  exactly the state's blasters again, so a blaster found during a level
   *  the player then died in is not owned by the retry until it is found
   *  again. Left out, ownership is not touched. */
  setOwned?(ids: readonly string[]): void;
}

/** The state to carry on with: the level just finished and what the player
 *  had left when the exit was reached. The level it names is the next one
 *  (or the same one after the order's end, see carryTo). */
export function captureState(levelId: string, live: LiveCarry): CampaignState {
  return carryTo(
    levelId,
    live.blasters.map((b) => ({ id: b.id, mag: b.mag, reserve: b.reserve })),
    live.health.hp,
    live.melee ?? ownedMeleeAt(nextLevel(levelId) ?? levelId),
  );
}

/** Put a state back on the live blasters and health: the level start and
 *  every restart inside the level go through here, so a retry begins with
 *  what the player carried in, not with a fresh loadout. Blasters the state
 *  does not name are left alone (an unowned one has nothing to restore),
 *  and the health never comes back at 0 or above its own maximum. */
export function applyState(state: CampaignState, live: LiveCarry): void {
  live.setOwned?.(state.blasters.map((b) => b.id));
  // MEL-01: a restart goes back to the hand weapons the level began with,
  // so a sword found during an attempt that ended in a death is found
  // again, the same rule the blasters follow.
  live.setOwnedMelee?.(state.melee);
  const byId = new Map(state.blasters.map((b) => [b.id, b]));
  for (const b of live.blasters) {
    const saved = byId.get(b.id);
    if (!saved) continue;
    b.mag = saved.mag;
    b.reserve = saved.reserve;
    if (b.loaded) {
      for (let i = 0; i < b.loaded.length; i++) b.loaded[i] = i < saved.mag;
    }
  }
  live.health.hp = Math.min(HEALTH_MAX, Math.max(1, state.health));
}

/** The end screen's clock: whole seconds as m:ss, counting up. */
export function formatTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m + ":" + String(s).padStart(2, "0");
}
