// The arena page (LVL-01 stage 3): plays a level file (the Pit by default,
// or `?level=` another, GAME-10b) with the whole game around it. The game (renderer, blasters, darts, carving,
// debris, falling pieces, Foamers on the level AI, health, HUD, pause menu,
// settings, sounds, the loop) is shared with the test course in src/game/
// (ENG-13); this page is its level file, the arena's own extras in
// src/arena/extras.ts, and nothing else.
// First import on purpose: a boot that fails says so on the overlay.
import "../core/boot-errors";
import { validateLevel } from "../level/validate";
import { createGame } from "../game/game";
import { arenaExtras, buildArena, type ArenaBuilt } from "./extras";
import { chosenLevel } from "./levels";
import { campaignMode, entryState, readSave, type CampaignState } from "../game/campaign";

// GAME-10b: `?level=1-4-ring` plays the Ring; the Pit stays the default.
const chosen = chosenLevel();
const LEVEL = chosen.level;
const status = document.querySelector<HTMLParagraphElement>("#status")!;
// LVL-05: `&campaign` plays the level in the campaign, so the loadout owns
// only what the campaign gives by the level's start. Without it the page is
// the test page it has always been: every blaster owned.
const campaign = campaignMode(location.search);
// LVL-05 stage 2: the state the level begins with. A save that names this
// level is what the player carried in; anything else (no save, someone
// jumping straight to a level, a broken or old save) begins the level from
// the order's own start set. The loadout is told the owned ids from it, and
// the arena writes it to the save as the level starts.
const entry: CampaignState | null = campaign ? entryState(chosen.name, readSave()) : null;
const startBlasters = entry ? entry.blasters.map((b) => b.id) : undefined;

// A level with errors does not load: the page shows the list (BLOCKOUT 5).
const report = validateLevel(LEVEL);
if (chosen.unknownLevel) {
  status.textContent = `No level called ${chosen.unknownLevel}: playing the Pit.`;
  await run();
} else if (report.errors.length) {
  status.textContent = "This level has errors: " + report.errors.join("; ");
} else {
  await run();
}

async function run() {
  let runner: ReturnType<typeof arenaExtras>["runner"] | undefined;
  const game = await createGame<ArenaBuilt>({
    // The Pit is 34 m across with a 26 m corridor: the test course's fog and
    // shadow box would hide its far end, so both are pushed out here only.
    scene: { fog: [40, 130], shadowRadius: 40, shadowMap: 2048 },

    build: buildArena,

    // LVL-05: the campaign's start set (undefined on the test page).
    startBlasters,

    configure(g) {
      const extras = arenaExtras(g, { campaign, entry });
      runner = extras.runner;
      return extras.hooks;
    },
  });

  // Dev-only hook for the automated checks in the browser pane.
  if (import.meta.env.DEV) Object.assign(window, {
    __arena: {
      camera: game.camera, player: game.player, voxels: game.voxels,
      voxelMesh: game.voxelMesh, debris: game.debris, pieces: game.pieces,
      darts: game.darts, loadout: game.loadout, impacts: game.impacts,
      foamers: game.foamers, health: game.health, loop: game.loop,
      runner, built: game.built.level,
    },
  });
}
