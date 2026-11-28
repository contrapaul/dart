import type { Level } from "../../src/level/format";

// MENU-01: the old shipped levels, kept as test fixtures when they left the
// game (2026-11-29), keyed by file name as the arena page keyed them.
const FILES = import.meta.glob<{ default: unknown }>("./levels/*.json", { eager: true });

export const FIXTURE_LEVELS: Record<string, Level> = Object.fromEntries(
  Object.entries(FILES).map(([path, mod]) => [path.split("/").pop()!.replace(/\.json$/, ""), mod.default as Level]),
);
