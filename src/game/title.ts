import { campaignUrl, clearSave, firstLevel, readSave } from "./campaign";

// LVL-05 stage 2: the title page's two ways into the campaign. New game
// forgets the save and starts the first level; Continue (only when a save
// exists) starts the level the save names. Both go through the arena page
// in campaign mode, so the carried state is what the level begins with.
// The test course below the buttons is untouched.

export function wireTitleMenu(root: ParentNode = document): void {
  const newGame = root.querySelector<HTMLButtonElement>("#newGame");
  const cont = root.querySelector<HTMLButtonElement>("#continueGame");
  const save = readSave();
  if (cont) cont.hidden = save === null;

  newGame?.addEventListener("click", () => {
    clearSave();
    location.href = campaignUrl(firstLevel());
  });
  cont?.addEventListener("click", () => {
    // Read again: another tab may have changed it since the page loaded.
    const now = readSave();
    location.href = campaignUrl(now ? now.level : firstLevel());
  });

  // ED-10a: the editor is the only way to make a level, and its own live
  // play starts in ED-10. Play a level is wired by src/game/my-levels.ts.
  const make = root.querySelector<HTMLButtonElement>("#makeLevel");
  make?.addEventListener("click", () => {
    location.href = "editor.html";
  });
}
