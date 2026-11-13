import type { Trigger, TriggerDo, TriggerWhen } from "../level/format";

// ED-08 stage 2: what a trigger says in one line, for the outliner's Logic
// group ("enter zone-1: show 2, spawn 3 F01"). Pure text, so a test can read
// it without a DOM. Nothing here is fetched: the rig names come from the
// level data the editor already bundles.

/** The when, in a few words: "enter zone-1", "killed all wave-1", ... */
export function whenText(w: TriggerWhen | undefined): string {
  if (!w) return "no when";
  switch (w.kind) {
    case "start": return "start";
    case "enter": return `enter ${w.zone}`;
    case "killed": {
      const ids = w.ids ?? [];
      const all = `${ids.length === 1 ? "" : "all "}${ids.join(", ")}`;
      return w.count === undefined ? `killed ${all}` : `killed ${w.count} of ${ids.join(", ")}`;
    }
    case "pressed": return `pressed ${w.button}`;
    case "taken": return `taken ${w.pickup}`;
    case "after": return `after ${w.trigger} ${w.seconds}s`;
    default: return "unknown when";
  }
}

/** One do row, in a few words. The count of names is enough for a list; the
 *  inspector shows which. */
export function doText(d: TriggerDo): string {
  switch (d.kind) {
    case "spawn": return `spawn ${d.count} ${d.foamer}`;
    case "wake": return `wake ${(d.ids ?? []).join(", ")}`;
    case "show": return `show ${(d.ids ?? []).length}`;
    case "hide": return `hide ${(d.ids ?? []).length}`;
    case "open": return `open ${d.door}`;
    case "close": return `close ${d.door}`;
    case "message": return "message";
    case "checkpoint": return "checkpoint";
    default: return "unknown do";
  }
}

/** The whole trigger in one line: the when, then its do rows. */
export function triggerSummary(t: Trigger): string {
  const rows = (t.do ?? []).map(doText).join(", ");
  const repeat = t.repeat === true ? " (repeats)" : "";
  return `${whenText(t.when)}: ${rows || "nothing"}${repeat}`;
}
