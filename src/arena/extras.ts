import * as THREE from "three";
import blastersData from "../../data/blasters.json";
import { buildLevel, type BuiltLevel } from "../level/build";
import type { ArenaContext } from "../level/arena";
import { LevelRunner, type LevelEvents } from "../level/level-runner";
import { FALL_LIMIT, carveBounds } from "../game/shared";
import type { BuildInput, BuiltGame, Game, GameHooks } from "../game/game";
import { RiftVisuals } from "./rifts";
import { Stations, useHeldForStations } from "./stations";
import { chosenLevel } from "./levels";
import {
  applyState, campaignUrl, captureState, formatTime, nextLevel, writeSave,
  type CampaignState, type LiveCarry,
} from "../game/campaign";
import { ButtonSystem, type PressEvent } from "../level/buttons";
import {
  HealthPressPlayer, PressSystem,
} from "../level/presses";
import { buildAmbushes } from "../level/ambush";

// What only an arena does (ENG-13, LVL-01 stage 3): the lock-in runner, the
// rifts, the exit pad, the banner and the checkpoint restart. The rest of
// the game, the level build included, is shared in src/game/.

// GAME-10b: the same `?level=` choice as the page (src/arena/levels.ts).
const CHOSEN = chosenLevel();
const LEVEL = CHOSEN.level;
/** The level's id in the campaign order: the `?level=` name, not meta.id. */
const LEVEL_NAME = CHOSEN.name;

/** LVL-05 stage 2: campaign play on this page. `entry` is the state the
 *  level begins with (the save's own, or a fresh one for this level); it is
 *  what a restart inside the level goes back to. */
export interface CampaignOptions {
  campaign: boolean;
  entry: CampaignState | null;
}
const TEST_PAGE: CampaignOptions = { campaign: false, entry: null };

/** The arena's build: the shared pieces plus the built level its doors live
 *  in. */
export interface ArenaBuilt extends BuiltGame {
  level: BuiltLevel;
}

/** Builds the level file's geometry in the shared game's build hook. */
export function buildArena({ rapier, world, scene, mesherPool }: BuildInput): ArenaBuilt {
  const level = buildLevel(LEVEL, rapier, world, mesherPool, scene);
  return {
    voxels: level.voxels,
    voxelMesh: level.voxelMesh,
    // ENV-01 review: the game counts carves against the level's crates
    // only if the page hands them over.
    crates: level.crates,
    navBounds: level.navBounds,
    spawn: new THREE.Vector3(...LEVEL.playerStart.pos),
    yaw: LEVEL.playerStart.yaw,
    level,
  };
}

export interface ArenaExtras {
  hooks: Partial<GameHooks<ArenaBuilt>>;
  /** For the dev hook and the browser checks. */
  runner: LevelRunner;
}

export function arenaExtras(
  g: Game<ArenaBuilt>,
  campaign: CampaignOptions = TEST_PAGE,
): ArenaExtras {
  const { audio, foamers, hud, health, player, loadout, built, scene, pickups, camera, melee } = g;
  // g.ui, not a destructured copy: the UI controller is built after this
  // hook returns (src/game/game.ts). ENV-03: rapier and world come here too,
  // for the mod stations; input, finisher and vacuum are read from g in the
  // step hook, where the tools own the use key first.
  const { level } = built;

  // LVL-02a: the level file's ammo boxes: they refill the loadout's
  // blasters in place, and they respawn on every restart (respawnAtEntry)
  // so a collected box comes back.
  pickups.blasters = loadout.blasters;
  pickups.loadLevelBoxes(LEVEL);

  // LVL-05 stage 2: the carried state, read from the live game and put back
  // on it. The campaign's own blasters and health go through it; the test
  // page never does.
  // Only the blasters the player owns: carrying every blaster in the
  // loadout would hand the campaign all eight after its first level.
  // A restore asks for every blaster (`everyBlaster`), because the state
  // itself decides the owned set and it is applied after this list is
  // built: filtering here would restore only the blasters owned a moment
  // before the restore, leaving a carried blaster's ammo at its full start.
  // The mag and the reserve are accessors onto the real blaster: a plain
  // copy would be written by applyState and thrown away, leaving the game's
  // ammo at its full start while the health (a real object) came back right.
  const live = (everyBlaster = false): LiveCarry => ({
    blasters: loadout.blasters
      .map((b, i) => ({
        id: loadout.ids[i]!,
        get mag() { return b.mag; },
        set mag(v: number) { b.mag = v; },
        get reserve() { return b.reserve; },
        set reserve(v: number) { b.reserve = v; },
        loaded: b.loaded,
      }))
      .filter((b) => everyBlaster || loadout.owns(b.id)),
    health,
    setOwned: (ids) => loadout.setOwned(ids),
    // MEL-01: the hand weapons a campaign owns. A state naming none means
    // the sword was not found yet, so the key is the bash and the view stays
    // away. The test page never reaches here (it never applies a state) and
    // keeps its melee armed.
    melee: melee.armed ? [melee.weaponId] : [],
    setOwnedMelee: (ids) => melee.setArmed(ids.includes(melee.weaponId)),
  });
  if (campaign.campaign && campaign.entry) {
    // The level starts with what the player carried in (a Continue, or a
    // level after one that was finished), and that is the state a restart
    // comes back to. It is written now as well as at the exit: a player who
    // leaves mid-level has a save that names this level, so Continue starts
    // it over from here rather than from the level before.
    applyState(campaign.entry, live(true));
    writeSave(campaign.entry);
  }

  const banner = document.querySelector<HTMLDivElement>("#banner")!;
  const bannerText = document.querySelector<HTMLSpanElement>("#bannerText")!;
  const complete = document.querySelector<HTMLDivElement>("#complete")!;
  // LVL-05 stage 2: the end screen's campaign parts. On the test page they
  // stay hidden and Play again is the panel, as before.
  const completeName = document.querySelector<HTMLParagraphElement>("#completeName");
  const completeTime = document.querySelector<HTMLParagraphElement>("#completeTime");
  const completeNext = document.querySelector<HTMLButtonElement>("#nextLevel");
  const completeMenu = document.querySelector<HTMLButtonElement>("#mainMenu");
  const completeEnd = document.querySelector<HTMLParagraphElement>("#actEnd");
  const completePlayAgain = document.querySelector<HTMLButtonElement>("#playAgain");
  /** The next level in the order, or null after the last one. */
  const nextId = campaign.campaign ? nextLevel(LEVEL_NAME) : null;
  // Seconds on the level's clock: counts while the level is being played,
  // stops on the end screen and on a full restart, and starts fresh with
  // the level's own entry state.
  let levelTime = 0;
  let timing = campaign.campaign;


  // LVL-02b: a level's arenas play in file order. One RiftVisuals per arena
  // (so two arenas may reuse a rift id), and only the current arena's seams
  // ever glow.
  const arenas = LEVEL.arenas ?? [];
  const riftSets = arenas.map((arena) => new RiftVisuals(arena.rifts));
  for (const set of riftSets) scene.add(set.group);
  let currentSet = riftSets[0];

  /** Dim every arena's rifts, then put the current arena's into `state`. */
  function setRifts(state: "dim" | "open"): void {
    for (const set of riftSets) set.setAll("dim");
    currentSet?.setAll(state);
  }

  const start = new THREE.Vector3(...LEVEL.playerStart.pos);
  const _playerPos = new THREE.Vector3();
  const _riftFeet = new THREE.Vector3();
  const _riftFacing = new THREE.Vector3();
  const _padPos = new THREE.Vector3();
  const _aimDir = new THREE.Vector3();
  const _ambushFeet = new THREE.Vector3();
  let swingsSeen = 0;

  /** The player's feet as a vector: the controller exposes the height as
   *  a number, and the eye helper is the only way to read x and z. */
  function feetPos(out: THREE.Vector3): THREE.Vector3 {
    return player.eye(1, out).setY(player.feet);
  }

  let bannerTimer = -1;
  function showBanner(text: string, seconds: number): void {
    bannerText.textContent = text;
    banner.hidden = false;
    bannerTimer = seconds;
  }

  const events: LevelEvents = {
    setDoor(id, state) {
      const door = level.doors.get(id);
      if (!door || door.state === state) return;
      door.setState(state);
      audio.play("LV-door", { position: doorMeshPos(id) });
    },
    spawn(foamerId, rift, promoted) {
      // GAME-10a: the id in the file is the type (the validator checked it
      // exists in the rigs, and every rig id has a spec entry).
      // LVL-04b: a promoted spawn gets the mini-boss health and plates.
      _riftFeet.set(rift.pos[0], rift.pos[1], rift.pos[2]);
      _riftFacing.copy(player.eye(1, _playerPos));
      const f = foamers.spawn(_riftFeet, _riftFacing, foamerId, promoted);
      if (!f) return false;
      audio.play("FX-spawn", { position: _riftFeet });
      return true;
    },
    onLocked() {
      showBanner("Clear the arena", 2.2);
      setRifts("dim");
      audio.play("LV-arena-lock");
    },
    onWaveStart(wave, index, count) {
      void wave; void count;
      const total = runner.currentArena?.waves.length ?? 1;
      showBanner("Wave " + (index + 1) + " of " + total, 1.8);
      setRifts("open");
      audio.play("LV-rift-open");
      audio.play("LV-wave");
    },
    onCleared() {
      showBanner("Arena clear", 2.5);
      setRifts("dim");
      audio.play("LV-arena-clear");
    },
    onEscaped() {
      // LVL-03b: the hall's drop ends the chase. The Swarmers up there
      // cannot follow, so they are taken off the board here rather than left
      // to block anything later. No banner: the Rings's own arena start
      // follows, and this is not a clear.
      foamers.clear();
      setRifts("dim");
    },
    onArenaStart(arena, index) {
      void arena;
      // The arenas after this one keep their file door states (every runner
      // was built at construction), so only the visuals move here.
      currentSet = riftSets[index];
      setRifts("dim");
      if (arenas.length > 1) showBanner("Arena " + (index + 1) + " of " + arenas.length, 2.2);
    },
    onLevelCleared() {
      setRifts("dim");
    },
  };

  const runner = new LevelRunner(arenas, events);

  // ENV-04: the level's crushes, built by the page in buildLevel and kept
  // here with the buttons and the stations. Their swims run every step on
  // their own timer (phase in the file off the others); a level without
  // any builds an empty system, so a level without presses plays as
  // before (the ENV-01 rule: built here, so the page runs them and not
  // only the unit tests). `pressPlayer` is the page's own example, through
  // the page's own health and the usual go-down (ENV-04's `HealthPressPlayer`).
  // Review: g.ui is built after this hook returns (see the top of this
  // function), so the press reads it when a crush lands, never here: handed
  // over now it was null and the first crush threw.
  const pressUi = {
    get paused() { return g.ui.paused; },
    get poppedOut() { return g.ui.poppedOut; },
    pop: () => g.ui.pop(),
  };
  const pressPlayer = new HealthPressPlayer(health, pressUi, hud, audio);
  const presses = new PressSystem(level.presses);

  // GAME-10m: the ambushes. A level's hidden F12s live here, not in the
  // FoamerSystem's lists (that is what makes them inert: nothing to draw,
  // collide with, path or damage, and the wave and level counters, which
  // read foamers.live and the alive list, cannot see them). Waking builds
  // one through the ordinary spawn, carves the growth open around it and
  // starts the pounce at once. The counts of the growths' voxels are
  // taken now, after buildLevel filled the volume: a growth holding fewer
  // than its count is a growth losing voxels, and wakes its ambusher.
  // The burst's carve goes to the page's own island and grid path.
  const ambushes = buildAmbushes(LEVEL, foamers, level.voxels, level.voxelMesh, player);
  ambushes.countVoxels();
  ambushes.onCarveReport = (removed) => {
    // What game.ts's carve report does for a dart carve, for the burst's
    // own hole (a growth has no crates, so crates.take is not needed).
    g.pieces.afterCarve(level.voxelMesh, removed);
    const box = carveBounds(level.voxelMesh, removed);
    if (box) g.levelAI.carveChanged(box[0], box[1], box[2], box[3]);
  };

  // ENV-02: the level's buttons, wired to the door verb above. The press
  // runs the action through `events.setDoor`, so a button opens a door the
  // same way the lock-in does, sound and all.
  const buttons = new ButtonSystem(level.buttons, (open) => events.setDoor(open, "open"), g.world);
  function playPress(e: PressEvent | null): void {
    if (!e) return;
    audio.play(e.opened ? "ENV-button-press" : "ENV-button-dead", { position: e.pos });
  }
  // The dart's own hit chain ends with this: a cap that stopped the dart is
  // a press. `impacts` and the Foamers wrap `onHit` in front of it, so this
  // runs after them and does not disturb them.
  const dartOnHit = g.darts.onHit;
  g.darts.onHit = (hit) => {
    dartOnHit(hit);
    playPress(buttons.pressByCollider(hit.collider, hit.point));
  };

  // ENV-03: the mod stations (E13). A level with none builds an empty set
  // and the page never reads the use key for them, so a level without
  // stations plays as before (the ENV-01 lesson: built here, in the same
  // place the crates are handed to the game, so they reach the arena
  // page and not only the unit tests). A grant is claimed (setMod on and
  // on in the data), so it stays for the run, as the shield does; the
  // restart's respawnAtEntry below resets the spent flags.
  const stations = new Stations(g.rapier, g.world, scene, LEVEL.stations ?? []);
  const blasterName = (id: string) =>
    (blastersData as Record<string, { name?: string }>)[id]?.name ?? id;
  stations.onGranted = (it) => {
    showBanner(it.mod + " taken: " + blasterName(it.blaster), 2.2);
    audio.play("ENV-station-grant", { position: it.point });
  };
  stations.onNeedBlaster = (it) => {
    showBanner(blasterName(it.blaster) + " required", 2.2);
    audio.play("ENV-station-spent", { position: it.point });
  };
  stations.onSpent = (it) => audio.play("ENV-station-spent", { position: it.point });

  const _stationEye = new THREE.Vector3();
  const _stationFwd = new THREE.Vector3();

  function doorMeshPos(id: string): THREE.Vector3 {
    const door = arenas.flatMap((a) => a.doors).find((d) => d.id === id);
    return new THREE.Vector3(...(door ? door.pos : [0, 0, 0]));
  }

  const arenaCtx: ArenaContext = { playerPos: [0, 0, 0], aliveCount: 0, aliveHealth: 0 };

  /** Reaching the exit pad ends the level (BLOCKOUT 4: a lit pad behind
   *  the locked door). A box test is enough; the pad is flat. */
  function onExitPad(): boolean {
    const e = LEVEL.exit;
    const p = feetPos(_padPos);
    return Math.abs(p.x - e.pos[0]) <= e.size[0] / 2
      && Math.abs(p.y + 0.9 - e.pos[1]) <= e.size[1] / 2 + 1.2
      && Math.abs(p.z - e.pos[2]) <= e.size[2] / 2;
  }

  /** A player who pops restarts at the current arena's entry, not the level
   *  start, with that arena back to waiting and the Foamers cleared. The
   *  earlier arenas stay cleared (the card's checkpoint rule). The voxels
   *  stay as they are. */
  function entryPos(): THREE.Vector3 {
    const arena = runner.currentArena;
    return new THREE.Vector3(...(arena?.checkpointPos ?? LEVEL.playerStart.pos));
  }

  /** `all` is a full level restart (Play again, a fall out of the world);
   *  otherwise only the current arena goes back to waiting. */
  function respawnAtEntry(all: boolean): void {
    health.reset();
    // LVL-05 stage 2: a restart goes back to the state the level began with,
    // not to a fresh loadout. The campaign's entry state is that answer; the
    // test page keeps the old full refill below.
    const entry = campaign.campaign ? campaign.entry : null;
    player.teleport(entryPos());
    player.pitch = 0;
    foamers.clear();
    pickups.clear();
    pickups.loadLevelBoxes(LEVEL); // LVL-02a: the file boxes come back
    stations.reset(); // ENV-03: the stations grant again on a restart
    presses.reset(); // ENV-04: the heads are back up on their own timers
    // GAME-10m: the woken ambusher goes with the other Foamers and the
    // hidden ones go back to their growths. The carved voxels stay as
    // they are (the rule of every restart here), so the growth counts are
    // retaken: a growth already opened hides its F12 in the hole rather
    // than wake it on the spot for a loss it took before the restart.
    ambushes.reset();
    hud.clearFlash();
    if (entry) {
      applyState(entry, live(true));
    } else {
      // Back to the ammo the player had at the start: there are no pickups
      // yet, so a retry with what was left could not win the arena.
      for (const b of loadout.blasters) {
        b.refill();
        b.reserve = b.spec.reserveStart;
      }
    }
    if (all) {
      runner.resetAll();
    } else {
      runner.resetCurrent();
    }
    // ENV-02: the doors are back to the file's states, so the buttons are
    // back to unpressed, lit again and able to open them.
    buttons.reset();
    setRifts("dim");
  }

  function showComplete(): void {
    complete.hidden = false;
    timing = false;
    audio.play("LV-exit");
    if (campaign.campaign) {
      // LVL-05 stage 2: the campaign's own panel: the level's name, the
      // time, and Next level or the act's end instead of Play again. The
      // carried state is written now, so a Continue reads the finish.
      if (completeName) {
        completeName.textContent = LEVEL.meta.name;
        completeName.hidden = false;
      }
      if (completeTime) {
        completeTime.textContent = "Time " + formatTime(levelTime);
        completeTime.hidden = false;
      }
      if (completeMenu) completeMenu.hidden = false;
      if (completeNext) completeNext.hidden = nextId === null;
      if (completeEnd) completeEnd.hidden = nextId !== null;
      if (completePlayAgain) completePlayAgain.hidden = true;
      // After the last level of the order there is no next one to carry
      // into, so the save goes back to the level's entry state: Continue
      // replays the last level from where it began, not from a finished
      // run at whatever health was left.
      const state = nextId === null && campaign.entry
        ? campaign.entry
        : captureState(LEVEL_NAME, live());
      writeSave(state);
    }
    g.ui.setPaused(true);
  }

  /** LVL-05 stage 2: the end screen's two ways on, from the buttons and the
   *  keys. Next level starts the next one with what the player carried;
   *  Main menu goes to the title, where Continue picks the save up. */
  function goNext(): void {
    if (nextId === null) return;
    location.href = campaignUrl(nextId);
  }
  function goMenu(): void {
    location.href = "/";
  }

  /** A full restart: every arena back to waiting and the player at the level
   *  start. Rebuilding the carved voxels is out of scope; the shell is never
   *  destructible, so the level still walks. */
  function restartLevel(): void {
    respawnAtEntry(true);
    player.teleport(start);
    player.yaw = LEVEL.playerStart.yaw;
    if (campaign.campaign) levelTime = 0; // a full restart restarts the clock
  }
  function levelReset(): void {
    complete.hidden = true;
    respawnAtEntry(true);
    player.teleport(start);
    player.yaw = LEVEL.playerStart.yaw;
    timing = campaign.campaign;
    levelTime = 0;
  }

  // The end screen's buttons (only the campaign's panel shows them).
  completeNext?.addEventListener("click", goNext);
  completeMenu?.addEventListener("click", goMenu);
  // Enter is Next level, Esc is Main menu, and only while the panel is up
  // (the game's own Esc pauses). Captured before the input's own listener
  // gets the key, so a pause does not open behind the panel.
  window.addEventListener("keydown", (e) => {
    if (complete.hidden || !campaign.campaign) return;
    if (e.code === "Enter" && !e.repeat) {
      e.preventDefault();
      e.stopPropagation();
      goNext();
    } else if (e.code === "Escape" && !e.repeat) {
      e.preventDefault();
      e.stopPropagation();
      goMenu();
    }
  }, true);

  // The arena issues its own spawns at the rifts, so the old spawner stays
  // off on this page: the wave runner owns the count.
  foamers.spawnCount = 0;

  const hooks: Partial<GameHooks<ArenaBuilt>> = {
    step(dt: number) {
      // LVL-05 stage 2: the end screen's clock, while the level is played.
      if (timing) levelTime += dt;
      // The arena runs after the Foamers so a cleared wave is seen the same
      // step its last Foamer goes down.
      const at = feetPos(_playerPos);
      arenaCtx.playerPos = [at.x, at.y, at.z];
      arenaCtx.aliveCount = foamers.live - foamers.downed.length;
      // LVL-04b: the Ring's second wave arrives at half the pair's health, so
      // the runner is told what is left, downed ones excluded: theirs is spent.
      let aliveHealth = 0;
      for (const f of foamers.list) if (f.state !== "down") aliveHealth += Math.max(0, f.health);
      arenaCtx.aliveHealth = aliveHealth;
      runner.update(dt, arenaCtx);
      // GAME-10m: the wake tests (the player's feet within wakeMetres of
      // a growth, or the growth holding fewer voxels than it was counted
      // with). F12-burst plays where it came out; the woken Foamer's own
      // crouch hiss rides onSound, as the pounce's does.
      for (const w of ambushes.step(dt, feetPos(_ambushFeet))) {
        audio.play("F12-burst", { position: w.at });
      }
      // ENV-04: the crushing toy presses, each on its own timer at every
      // fixed step, so a pause keeps them stopped with the rest. The crush
      // lands through the player's own path (pressPlayer: health.damage,
      // with the grace and the difficulty, and the shield that never blocks
      // it because a head is coming from above), and a Foamer under the head
      // pops the same way a fatal one would through the same pop chain as
      // the finisher (FX-pop and the bar). ENV-press-windup plays at
      // telegraph start, ENV-press-slam at every slam's end.
      pressPlayer.feet.copy(at);
      const pressRes = presses.step(dt, pressPlayer, {
        list: foamers.list,
        pop: (f) => {
          foamers.pop(f);
          hud.popFlash();
          audio.play("FX-pop");
        },
      });
      for (const w of pressRes.windups) audio.play("ENV-press-windup", { position: w.pos });
      for (const s of pressRes.slams) audio.play("ENV-press-slam", { position: s.pos });
      // ENV-02: a swing presses a button within its own reach and arc, and
      // a step presses a floor one. The melee counts its presses, so a held
      // key does not press a button every step: only a new swing asks.
      if (melee.presses !== swingsSeen) {
        swingsSeen = melee.presses;
        const eye = player.eye(1, _playerPos);
        const fwd = camera.getWorldDirection(_aimDir);
        playPress(buttons.pressNear(eye, fwd, melee.reach, melee.arcDeg, player.collider));
      }
      playPress(buttons.step(at));

      // ENV-03: the stations take the use key only when no one else does
      // (useHeldForStations: the finisher's press, the vacuum's target, or
      // a tool mid-use takes the key first, so a tool with a target keeps
      // it); a level without stations pays nothing for the call.
      const eye = g.player.eye(1, _stationEye);
      const fwd = g.camera.getWorldDirection(_stationFwd);
      const held = useHeldForStations(
        { finisher: g.finisher, vacuum: g.vacuum, useHeld: g.input.isDown("use") }, eye, fwd);
      stations.update(dt, eye, fwd, held, loadout);
    },
    afterWorld(dt: number) {
      if (player.feet < FALL_LIMIT) {
        player.teleport(start);
        foamers.clear();
        pickups.clear();
        pickups.loadLevelBoxes(LEVEL);
        runner.resetAll();
        setRifts("dim");
      }
      // LVL-02b: the pad only ends the level once every arena has cleared.
      // In a one arena level the door in front of it already kept the player
      // out until the arena was clear.
      if (complete.hidden && !g.ui.poppedOut && runner.state.phase === "complete" && onExitPad()) {
        showComplete();
      }
      if (bannerTimer > 0) {
        bannerTimer -= dt;
        if (bannerTimer <= 0) banner.hidden = true;
      }
    },
    render(dt: number) {
      for (const set of riftSets) set.update(dt);
    },
    stationPrompt(eye, fwd) {
      return stations.prompt(eye, fwd)?.mod ?? null;
    },
    popEffect() {
      hud.popFlash();
      audio.play("FX-pop");
    },
    completeOpen: () => complete.hidden === false,
    overlayAllowed: () => complete.hidden === true,
    onRestart: restartLevel,
    onTryAgain: () => respawnAtEntry(false),
    onPlayAgain: levelReset,
    watchName: "dartArena",
    // The arena's own fields in dartArena.state(), next to the shared ones:
    // the arena being played, its wave, the doors and the complete panel.
    watchState: () => ({
      // LVL-05 stage 2: the carried state the page plays with, and the
      // end screen's clock. `owned` and `ammo` are the same reading the
      // save is written from, so a check can see the carry arrive.
      campaign: campaign.campaign,
      carried: {
        level: LEVEL_NAME, health: health.hp, seconds: levelTime,
        owned: loadout.ids.filter((id) => loadout.owns(id)),
        ammo: Object.fromEntries(loadout.blasters
          .map((b, i) => [loadout.ids[i]!, { mag: b.mag, reserve: b.reserve }])
          .filter(([id]) => loadout.owns(id as string))),
      },
      nextId,
      phase: runner.state.phase,
      // LVL-02b: which arena of the level is being played.
      arena: runner.state.arenaIndex,
      arenaId: runner.state.arenaId,
      arenasCleared: runner.state.arenasCleared,
      wave: runner.state.arena.waveIndex + 1,
      cleared: runner.state.arena.cleared,
      alive: foamers.live - foamers.downed.length,
      doors: Object.fromEntries([...level.doors].map(([id, d]) => [id, d.state])),
      complete: complete.hidden === false,
      // LVL-02a: the ammo boxes are still on the floor.
      ammoBoxes: pickups.count("ammo"),
      // ENV-02: which buttons have been pressed.
      buttons: Object.fromEntries(buttons.ids.map((id) => [id, buttons.isPressed(id)])),
      // ENV-04: which phase each crush is in.
      presses: Object.fromEntries(presses.ids.map((id) => [id, presses.phaseOf(id)])),
      // GAME-10m: which ambushers are still hidden.
      ambushes: Object.fromEntries(ambushes.ids.map((id) => [id, ambushes.isHidden(id)])),
    }),
  };

  return { hooks, runner };
}
