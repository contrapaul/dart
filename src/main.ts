// MENU-01 (2026-11-29): the title menu. It replaced the test course that
// used to boot behind the title; the game itself plays on the arena page.
import { SettingsStore } from "./core/settings";
import { SettingsPanel } from "./ui/menus";
import { wireCampaignSlot, wireMenuKeys } from "./menu/title";

const menu = document.querySelector<HTMLElement>("#mainMenuList")!;
const slot = document.querySelector<HTMLButtonElement>("#campaignSlot")!;
const settingsButton = document.querySelector<HTMLButtonElement>("#titleSettings")!;
const settingsRoot = document.querySelector<HTMLDivElement>("#settings")!;

wireCampaignSlot(slot);
wireMenuKeys(menu);

const panel = new SettingsPanel(settingsRoot, new SettingsStore(), () => {
  panel.close();
  settingsButton.focus();
});
settingsButton.addEventListener("click", () => panel.open());
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !settingsRoot.hidden) {
    panel.close();
    settingsButton.focus();
  }
});

// The first item that can be chosen has focus, so the keys work at once.
menu.querySelector<HTMLElement>(".menu-item:not(:disabled)")?.focus();
