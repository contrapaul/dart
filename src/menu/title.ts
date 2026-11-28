import { CAMPAIGN_READY, campaignUrl, clearSave, firstLevel, readSave, type CampaignState } from "../game/campaign";
import { ARENA_LEVELS } from "../arena/levels";

// MENU-01: the title menu's first slot, New game or Continue (LVL-05 stage 2
// gave the title both buttons; the menu now has one slot for them). Until
// data/campaign.json says ready, the slot is New game, greyed out. Once it
// is ready, a save whose level ships is Continue, and anything else is New
// game, which forgets the save and starts the first level.

export interface CampaignSlot {
  label: "New game" | "Continue";
  enabled: boolean;
  /** The small line beside a greyed-out slot. */
  note: string | null;
}

export const NOT_READY = "Not ready yet";

export function campaignSlot(
  ready: boolean,
  save: CampaignState | null,
  ships: (level: string) => boolean,
): CampaignSlot {
  if (!ready) return { label: "New game", enabled: false, note: NOT_READY };
  if (save && ships(save.level)) return { label: "Continue", enabled: true, note: null };
  return { label: "New game", enabled: true, note: null };
}

/** Fills the slot's button and wires it. */
export function wireCampaignSlot(button: HTMLButtonElement): void {
  const slot = campaignSlot(CAMPAIGN_READY, readSave(), (id) => id in ARENA_LEVELS);
  button.disabled = !slot.enabled;
  button.textContent = slot.label;
  if (slot.note) {
    const note = document.createElement("small");
    note.textContent = slot.note;
    button.append(note);
  }
  button.addEventListener("click", () => {
    if (!slot.enabled) return;
    if (slot.label === "Continue") {
      // Read again: another tab may have changed it since the page loaded.
      const now = readSave();
      location.href = campaignUrl(now ? now.level : firstLevel());
    } else {
      clearSave();
      location.href = campaignUrl(firstLevel());
    }
  });
}

/** Up and Down (and W and S) move focus through the menu's enabled items,
 *  wrapping at the ends; Enter and Space are the buttons' own. With
 *  `hoverFocus`, pointing at an item focuses it, so one item is lit at a
 *  time. Call once per menu: the keys are read on the menu itself, so items
 *  added later are included. */
export function wireMenuKeys(menu: HTMLElement, hoverFocus = true): void {
  const items = () => [...menu.querySelectorAll<HTMLElement>(".menu-item")]
    .filter((el) => !(el as HTMLButtonElement).disabled);
  menu.addEventListener("keydown", (e) => {
    const step = e.key === "ArrowDown" || e.key === "s" ? 1 : e.key === "ArrowUp" || e.key === "w" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const list = items();
    const at = list.indexOf(document.activeElement as HTMLElement);
    const next = at < 0 ? (step > 0 ? 0 : list.length - 1) : (at + step + list.length) % list.length;
    list[next]?.focus();
  });
  if (hoverFocus) for (const el of items()) el.addEventListener("pointerenter", () => el.focus({ preventScroll: true }));
}
