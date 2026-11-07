import * as THREE from "three";
import { buildLevel, type BuiltLevel } from "../level/build";
import type { ArenaContext } from "../level/arena";
import { LevelRunner, type LevelEvents } from "../level/level-runner";
import { FALL_LIMIT } from "../game/shared";
import type { BuildInput, BuiltGame, Game, GameHooks } from "../game/game";
import { RiftVisuals } from "./rifts";
import { chosenLevel } from "./levels";
import { ButtonSystem, type PressEvent } from "../level/buttons";

// What only an arena does (ENG-13, LVL-01 stage 3): the lock-in runner, the
// rifts, the exit pad, the banner and the checkpoint restart. The rest of
// the game, the level build included, is shared in src/game/.

// GAME-10b: the same `?level=` choice as the page (src/arena/levels.ts).
const LEVEL = chosenLevel().level;

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

export function arenaExtras(g: Game<ArenaBuilt>): ArenaExtras {
  const { audio, foamers, hud, health, player, loadout, built, scene, pickups, camera, melee } = g;
  // g.ui, not a destructured copy: the UI controller is built after this
  // hook returns (src/game/game.ts).
  const { level } = built;

  // LVL-02a: the level file's ammo boxes: they refill the loadout's
  // blasters in place, and they respawn on every restart (respawnAtEntry)
  // so a collected box comes back.
  pickups.blasters = loadout.blasters;
  pickups.loadLevelBoxes(LEVEL);

  const banner = document.querySelector<HTMLDivElement>("#banner")!;
  const bannerText = document.querySelector<HTMLSpanElement>("#bannerText")!;
  const complete = document.querySelector<HTMLDivElement>("#complete")!;

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
    player.teleport(entryPos());
    player.pitch = 0;
    foamers.clear();
    pickups.clear();
    pickups.loadLevelBoxes(LEVEL); // LVL-02a: the file boxes come back
    hud.clearFlash();
    // Back to the ammo the player had at the start: there are no pickups
    // yet, so a retry with what was left could not win the arena.
    for (const b of loadout.blasters) {
      b.refill();
      b.reserve = b.spec.reserveStart;
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
    g.ui.setPaused(true);
    audio.play("LV-exit");
  }

  /** A full restart: every arena back to waiting and the player at the level
   *  start. Rebuilding the carved voxels is out of scope; the shell is never
   *  destructible, so the level still walks. */
  function restartLevel(): void {
    respawnAtEntry(true);
    player.teleport(start);
    player.yaw = LEVEL.playerStart.yaw;
  }
  function levelReset(): void {
    complete.hidden = true;
    respawnAtEntry(true);
    player.teleport(start);
    player.yaw = LEVEL.playerStart.yaw;
  }

  // The arena issues its own spawns at the rifts, so the old spawner stays
  // off on this page: the wave runner owns the count.
  foamers.spawnCount = 0;

  const hooks: Partial<GameHooks<ArenaBuilt>> = {
    step(dt: number) {
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
    }),
  };

  return { hooks, runner };
}
