// The arena page (LVL-01 stage 3): plays data/levels/1-1-pit.json with the
// whole game around it. The game (renderer, blasters, darts, carving,
// debris, falling pieces, Foamers on the level AI, health, HUD, pause menu,
// settings, sounds, the loop) is shared with the test course in src/game/
// (ENG-13); this page is its level file, the arena's own extras in
// src/arena/extras.ts, and nothing else.
import { validateLevel } from "../level/validate";
import type { Level } from "../level/format";
import { createGame } from "../game/game";
import { arenaExtras, buildArena, type ArenaBuilt } from "./extras";
import levelJson from "../../data/levels/1-1-pit.json";

const LEVEL = levelJson as unknown as Level;
const status = document.querySelector<HTMLParagraphElement>("#status")!;

// A level with errors does not load: the page shows the list (BLOCKOUT 5).
const report = validateLevel(LEVEL);
if (report.errors.length) {
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

    configure(g) {
      const extras = arenaExtras(g);
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
