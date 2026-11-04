import difficultyJson from "../../data/difficulty.json";

// Settings (UI-01 stage 2): one object for the whole game, loaded from and
// saved to localStorage under `dart.settings`. Storage may be blocked
// (private mode, disabled cookies), so every access is wrapped in
// try/catch: a blocked storage still plays with the defaults.
//
// The stored blob carries a `version`; a save from an older version is
// merged over the defaults, so new keys gain their defaults. The pages
// subscribe with onChange and apply sensitivity, invert, FOV, volume and
// damage taken live.

export interface DifficultyPreset {
  name: string;
  damageTaken: number;
  /** Multiplier on the shield's parry window (GAME-04 stage 2): a wider
   *  window on the easier presets. The pages read it off the active
   *  preset, as they read `director`. */
  parryWindow: number;
  /** Key ENG-08's director reads for this preset. */
  director: string;
}

export const DIFFICULTIES = difficultyJson as unknown as Record<string, DifficultyPreset>;

export interface Settings {
  difficulty: string; // a key of DIFFICULTIES, or "custom"
  /** Damage-taken multiplier, 0.25 to 2 (the slider's range). */
  damageTaken: number;
  mouseSensitivity: number;
  invertY: boolean;
  /** Field of view in degrees, 60 to 100. */
  fov: number;
  /** Master volume, 0 to 1. */
  volume: number;
  muted: boolean;
  reduceShake: boolean;
  reduceFlashes: boolean;
  reduceHeadBob: boolean;
  /** GAME-04: true raises the shield on one press and lowers it on the
   *  next, false holds the action to keep it up. */
  shieldMode: boolean;
}

export const STORAGE_KEY = "dart.settings";
export const SETTINGS_VERSION = 1;

export const DEFAULTS: Settings = {
  difficulty: "normal",
  damageTaken: 1,
  mouseSensitivity: 0.0022,
  invertY: false,
  fov: 75,
  volume: 1,
  muted: false,
  reduceShake: false,
  reduceFlashes: false,
  reduceHeadBob: false,
  shieldMode: false,
};

/** Defaults a fresh player gets; the values the sliders clamp to live in
 *  the settings panel, the ranges are in the card. */
export function defaults(): Settings {
  return { ...DEFAULTS };
}

export class SettingsStore {
  readonly value: Settings;
  private listeners: ((s: Settings) => void)[] = [];

  constructor() {
    this.value = this.load();
  }

  /** Read localStorage; any failure (blocked, absent, broken JSON, wrong
   *  shape) falls back to the defaults. */
  private load(): Settings {
    const base = defaults();
    let raw: string | null = null;
    try {
      raw = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      return base; // storage blocked: play with defaults
    }
    if (!raw) return base;
    try {
      const saved = JSON.parse(raw) as Partial<Settings>;
      if (typeof saved !== "object" || saved === null) return base;
      // Merge over the defaults: keys an older save lacks keep their default.
      const merged = { ...base };
      for (const key of Object.keys(base) as (keyof Settings)[]) {
        const v = saved[key];
        if (v !== undefined && typeof v === typeof base[key]) Object.assign(merged, { [key]: v });
      }
      if (!(merged.difficulty in DIFFICULTIES) && merged.difficulty !== "custom") {
        merged.difficulty = base.difficulty;
      }
      return merged;
    } catch {
      return base; // broken JSON: play with defaults
    }
  }

  save(): void {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...this.value, version: SETTINGS_VERSION }));
    } catch {
      // Blocked storage: the game keeps playing, the settings just do not
      // survive a reload.
    }
  }

  /** Subscribe to changes; called after every set. */
  onChange(fn: (s: Settings) => void): void {
    this.listeners.push(fn);
  }

  private notify(): void {
    this.save();
    for (const fn of this.listeners) fn(this.value);
  }

  set<K extends keyof Settings>(key: K, value: Settings[K]): void {
    if (this.value[key] === value) return;
    this.value[key] = value;
    // Damage taken is the only slider a preset covers: moving it by hand
    // makes the difficulty Custom.
    if (key === "damageTaken") this.value.difficulty = "custom";
    this.notify();
  }

  /** Pick Story, Normal, Hard or Foam Fury: applies the preset's values. */
  setDifficulty(key: string): void {
    const preset = DIFFICULTIES[key];
    if (!preset) return;
    this.value.difficulty = key;
    this.value.damageTaken = preset.damageTaken;
    this.notify();
  }
}
