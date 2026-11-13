import { validateLevel } from "../level/validate";
import type { Level } from "../level/format";

// ED-05 stage 5: the Problems panel runs the game's own validator on every
// change (design/EDITOR.md section 4). A row that names an id selects that
// thing, so an error is one click from the fix.

export interface Problem {
  text: string;
  severity: "error" | "warning";
  /** The id the message names, or null when it names nothing selectable. */
  id: string | null;
}

/** The id a validator message names out of the ids it is given. The messages
 *  start with the thing and its id (`door door-3: ...`), so the first known
 *  id in the text is the one. Ids are tried longest first, since `key-1` is
 *  inside `key-12` too, and an id that runs on into a longer one is skipped. */
export function namedId(text: string, ids: string[]): string | null {
  const sorted = [...ids].sort((a, b) => b.length - a.length);
  for (const id of sorted) {
    const at = text.indexOf(id);
    if (at < 0) continue;
    const after = text[at + id.length];
    if (after !== undefined && /[0-9A-Za-z_-]/.test(after)) continue;
    return id;
  }
  return null;
}

/** Runs the validator and pairs every message with the id it names. `ids`
 *  are the document's own; the start and the exit are passed so a message
 *  about either selects it. */
export function problemsFor(
  level: Level, ids: string[], startId: string, exitId: string,
): Problem[] {
  const result = validateLevel(level);
  const name = (text: string): string | null => {
    if (/^(start|playerStart)\b/.test(text)) return startId;
    if (/^exit\b/.test(text)) return exitId;
    return namedId(text, ids);
  };
  return [
    ...result.errors.map((text): Problem => ({ text, severity: "error", id: name(text) })),
    ...result.warnings.map((text): Problem => ({ text, severity: "warning", id: name(text) })),
  ];
}

/** "Problems 2" or "Problems", for the top bar's button. */
export function problemsLabel(problems: Problem[]): string {
  const errors = problems.filter((p) => p.severity === "error").length;
  const warnings = problems.length - errors;
  if (!problems.length) return "Problems";
  if (!warnings) return `Problems ${errors}`;
  if (!errors) return `Problems (${warnings}w)`;
  return `Problems ${errors}+${warnings}w`;
}
