// The arena page (LVL-01 stage 3): plays data/levels/1-1-pit.json with the
// whole game around it (blasters, darts, carving, debris, falling pieces,
// Foamers on the level AI, health, HUD, pause menu, settings, sounds). The
// test course stays on index.html and is untouched; only the carve
// bookkeeping and the attack damage table moved to src/game/.
import * as THREE from "three";
import { createRenderer } from "../render/scene";
import { createPhysics } from "../physics/world";
import { startLoop } from "../core/loop";
import { Input, settings as lookSettings } from "../core/input";
import { SettingsStore, type Settings } from "../core/settings";
import { PlayerController } from "../player/controller";
import { PlayerHealth } from "../player/health";
import { DartSystem } from "../weapons/darts";
import { Loadout } from "../weapons/loadout";
import { updateAim } from "../weapons/aim";
import { DartImpacts, type VoxelTarget } from "../weapons/impacts";
import { FoamerSystem } from "../foamers/foamers";
import { makeLevelAI } from "../ai/level";
import { Hud } from "../ui/hud";
import { SettingsPanel } from "../ui/menus";
import { DebrisSystem } from "../voxel/debris";
import { MesherPool } from "../voxel/mesher-pool";
import { FallingPieces } from "../voxel/pieces";
import { AudioEngine } from "../audio/audio";
import { GameSounds } from "../audio/game-sounds";
import renderJson from "../../data/render.json";
import { buildLevel } from "../level/build";
import { validateLevel } from "../level/validate";
import { ArenaRunner, type ArenaContext } from "../level/arena";
import type { Level } from "../level/format";
import { carveBounds, FALL_LIMIT } from "../game/shared";
import { damageOf } from "../game/attack";
import { RiftVisuals } from "./rifts";
import levelJson from "../../data/levels/1-1-pit.json";

const LEVEL = levelJson as unknown as Level;
const PAUSED_FRAME = renderJson.pausedFrame;

const canvas = document.querySelector<HTMLCanvasElement>("#view")!;
const overlay = document.querySelector<HTMLDivElement>("#overlay")!;
const status = document.querySelector<HTMLParagraphElement>("#status")!;
const banner = document.querySelector<HTMLDivElement>("#banner")!;
const bannerText = document.querySelector<HTMLSpanElement>("#bannerText")!;

// A level with errors does not load: the page shows the list (BLOCKOUT 5).
const report = validateLevel(LEVEL);
if (report.errors.length) {
  status.textContent = "This level has errors: " + report.errors.join("; ");
} else {
  await run();
}

async function run() {
  // The Pit is 34 m across with a 26 m corridor: the test course's fog and
  // shadow box would hide its far end, so both are pushed out here only.
  const { renderer, scene, camera } = createRenderer(canvas, {
    fog: [40, 130],
    shadowRadius: 40,
    shadowMap: 2048,
  });
  camera.rotation.order = "YXZ";
  scene.add(camera); // the blaster viewmodel is a child of the camera
  const input = new Input(canvas);
  const hud = new Hud(document.querySelector<HTMLDivElement>("#hud")!);
  const { rapier, world } = await createPhysics();
  const mesherPool = new MesherPool();

  const built = buildLevel(LEVEL, rapier, world, mesherPool, scene);
  const voxels = built.voxels;
  const voxelMesh = built.voxelMesh;
  const debris = new DebrisSystem(rapier, world);
  scene.add(debris.mesh);
  const pieces = new FallingPieces(rapier, world, mesherPool, debris);
  scene.add(pieces.group);

  const arena = LEVEL.arenas![0]!;
  const rifts = new RiftVisuals(arena.rifts);
  scene.add(rifts.group);

  const start = new THREE.Vector3(...LEVEL.playerStart.pos);
  const player = new PlayerController(rapier, world, start);
  player.yaw = LEVEL.playerStart.yaw;
  const eye = new THREE.Vector3();
  const health = new PlayerHealth();
  const store = new SettingsStore();
  const darts = new DartSystem(scene, world, rapier, player.collider);
  const loadout = await Loadout.load(camera, darts);
  // Sound (AUD-01 stage 2): the engine opens on the first click, inside that
  // gesture; until then, or on a host with no Web Audio, the page is silent.
  let engine: AudioEngine | null = null;
  let sounds: GameSounds | null = null;
  let audioStarting = false;

  function applySettings(s: Settings): void {
    lookSettings.mouseSensitivity = s.mouseSensitivity;
    lookSettings.invertY = s.invertY;
    camera.fov = s.fov;
    camera.updateProjectionMatrix();
    health.damageTaken = s.damageTaken;
    hud.reduceFlashes = s.reduceFlashes;
    if (engine) {
      engine.volume = s.volume;
      engine.muted = s.muted;
    }
  }
  store.onChange(applySettings);
  applySettings(store.value);
  const _aimUnused = new THREE.Vector3();
  Loadout.muzzleToWorld = (camPoint, out) => {
    updateAim(camera, world, player.collider, camPoint, out, _aimUnused);
    return out;
  };

  // Voxels: the level's pieces are the destroyable targets. Darts carve them
  // and the nav grid re-bakes only the patch a carve changed.
  const voxelTargets: VoxelTarget[] = [voxelMesh];
  const impacts = new DartImpacts(darts, debris, voxelTargets);
  const levelAI = makeLevelAI(rapier, world, built.navBounds, store.value.difficulty);
  pieces.onBreak = (c, r) => darts.releaseInSphere(c, r);
  pieces.onRest = (c, r) => levelAI.pieceRested(c, r);
  impacts.onCarve = (target, removed) => {
    if (target !== voxelMesh) return;
    pieces.afterCarve(voxelMesh, removed);
    const box = carveBounds(voxelMesh, removed);
    if (box) levelAI.carveChanged(box[0], box[1], box[2], box[3]);
  };

  const foamers = new FoamerSystem(rapier, world, mesherPool, debris, darts, voxelTargets);
  foamers.director = levelAI.director;
  foamers.navGrid = levelAI.grid;
  foamers.spawnState = "alert"; // a rift spawn is already in the fight
  // The arena issues its own spawns at the rifts, so the old spawner stays
  // off on this page: the wave runner owns the count.
  foamers.spawnCount = 0;
  scene.add(foamers.group);

  // Scratch vectors for the aim math, allocated once.
  const _muzzleCam = new THREE.Vector3();
  const _muzzle = new THREE.Vector3();
  const _aimDir = new THREE.Vector3();
  const _playerPos = new THREE.Vector3();
  const _riftFeet = new THREE.Vector3();
  const _padPos = new THREE.Vector3();

  /** The player's feet as a vector: the controller exposes the height as a
   *  number, and the eye helper is the only way to read x and z. */
  function feetPos(out: THREE.Vector3): THREE.Vector3 {
    return player.eye(1, out).setY(player.feet);
  }
  const _riftFacing = new THREE.Vector3();

  let paused = true;
  let started = false;
  let poppedOut = false;
  const popped = document.querySelector<HTMLDivElement>("#popped")!;
  const complete = document.querySelector<HTMLDivElement>("#complete")!;

  // ---- the arena runner ----

  let bannerTimer = -1;
  function showBanner(text: string, seconds: number): void {
    bannerText.textContent = text;
    banner.hidden = false;
    bannerTimer = seconds;
  }

  const runner = new ArenaRunner(arena, {
    setDoor(id, state) {
      const door = built.doors.get(id);
      if (!door || door.state === state) return;
      door.setState(state);
      if (engine) engine.play("LV-door", { position: doorMeshPos(id) });
    },
    spawn(foamerId, rift) {
      // The Foamer ids in the file name the kind; this build has one kind, so
      // the id only has to exist (the validator checked it does).
      void foamerId;
      _riftFeet.set(rift.pos[0], rift.pos[1], rift.pos[2]);
      _riftFacing.copy(player.eye(1, _playerPos));
      const f = foamers.spawn(_riftFeet, _riftFacing);
      if (!f) return false;
      if (engine) engine.play("FX-spawn", { position: _riftFeet });
      return true;
    },
    onLocked() {
      showBanner("Clear the arena", 2.2);
      rifts.setAll("dim");
      if (engine) engine.play("LV-arena-lock");
    },
    onWaveStart(wave, index, count) {
      void wave; void count;
      showBanner("Wave " + (index + 1) + " of " + arena.waves.length, 1.8);
      rifts.setAll("open");
      if (engine) engine.play("LV-rift-open");
      if (engine) engine.play("LV-wave");
    },
    onCleared() {
      showBanner("Arena clear", 2.5);
      rifts.setAll("dim");
      if (engine) engine.play("LV-arena-clear");
    },
  });

  function doorMeshPos(id: string): THREE.Vector3 {
    const door = arena.doors.find((d) => d.id === id);
    return new THREE.Vector3(...(door ? door.pos : [0, 0, 0]));
  }

  const arenaCtx: ArenaContext = { playerPos: [0, 0, 0], aliveCount: 0 };

  /** Reaching the exit pad ends the level (BLOCKOUT 4: a lit pad behind the
   *  locked door). A box test is enough; the pad is flat. */
  function onExitPad(): boolean {
    const e = LEVEL.exit;
    const p = feetPos(_padPos);
    return Math.abs(p.x - e.pos[0]) <= e.size[0] / 2
      && Math.abs(p.y + 0.9 - e.pos[1]) <= e.size[1] / 2 + 1.2
      && Math.abs(p.z - e.pos[2]) <= e.size[2] / 2;
  }

  /** A player who pops restarts at the arena's entry, not the level start,
   *  with the arena reset to waiting and the Foamers cleared. The voxels stay
   *  as they are (the card's checkpoint rule). */
  const ENTRY = new THREE.Vector3(...(arena.checkpointPos ?? LEVEL.playerStart.pos));

  function respawnAtEntry(resetArena: boolean): void {
    health.reset();
    player.teleport(ENTRY);
    player.pitch = 0;
    foamers.clear();
    hud.clearFlash();
    if (resetArena) {
      runner.reset();
      rifts.setAll("dim");
    }
  }

  function popBurst(): void {
    hud.popFlash();
    if (engine) engine.play("FX-pop");
  }
  function playerPopped(): void {
    poppedOut = true;
    setPaused(true);
    popBurst();
    popped.hidden = false;
    status.textContent = "Press Try again.";
  }

  function showComplete(): void {
    complete.hidden = false;
    setPaused(true);
    if (engine) engine.play("LV-exit");
  }

  // ---- pause menu, settings, buttons ----

  const pauseMenu = document.querySelector<HTMLDivElement>("#pausemenu")!;
  const settingsBtn = document.querySelector<HTMLButtonElement>("#settingsBtn")!;
  const settingsPanel = new SettingsPanel(
    document.querySelector<HTMLDivElement>("#settings")!,
    store,
    () => {
      settingsPanel.close();
      pauseMenu.hidden = !(started && !poppedOut && complete.hidden);
      if (!pauseMenu.hidden) settingsBtn.focus();
    },
  );
  document.querySelector<HTMLButtonElement>("#resumeBtn")!.addEventListener("click", () => {
    settingsPanel.close();
    if (input.locked) setPaused(false);
    else input.requestLock();
  });
  settingsBtn.addEventListener("click", () => settingsPanel.open());
  document.querySelector<HTMLButtonElement>("#restartBtn")!.addEventListener("click", () => {
    restartLevel();
  });
  pauseMenu.addEventListener("pointerdown", (e) => {
    if (e.target === pauseMenu) {
      settingsPanel.close();
      if (input.locked) setPaused(false);
      else input.requestLock();
    }
  });
  document.querySelector<HTMLButtonElement>("#titleSettings")!.addEventListener("click", () => {
    pauseMenu.hidden = true;
    settingsPanel.open();
  });
  document.querySelector<HTMLButtonElement>("#tryAgain")!.addEventListener("click", () => {
    poppedOut = false;
    popped.hidden = true;
    respawnAtEntry(true);
    restartPlay();
  });
  document.querySelector<HTMLButtonElement>("#playAgain")!.addEventListener("click", () => {
    levelReset();
    restartPlay();
  });

  /** A full restart: the arena back to waiting and the player at the level
   *  start. Rebuilding the carved voxels is out of scope; the shell is
   *  never destructible, so the level still walks. */
  function restartLevel(): void {
    respawnAtEntry(true);
    player.teleport(start);
    player.yaw = LEVEL.playerStart.yaw;
    poppedOut = false;
    popped.hidden = true;
    restartPlay();
  }
  function levelReset(): void {
    complete.hidden = true;
    respawnAtEntry(true);
    player.teleport(start);
    player.yaw = LEVEL.playerStart.yaw;
  }
  function restartPlay(): void {
    settingsPanel.close();
    if (input.locked) setPaused(false);
    else input.requestLock();
  }

  const PAUSED_CLOCK_START = PAUSED_FRAME;
  let pausedClock = PAUSED_CLOCK_START;
  function setPaused(p: boolean): void {
    if (poppedOut && !p) return; // Try again clears the flag first
    if (!complete.hidden && !p) return; // Play again clears the panel first
    paused = p;
    // The level-complete panel stands in for the title overlay.
    overlay.hidden = !p || !complete.hidden;
    hud.show(!p);
    pauseMenu.hidden = !(p && !poppedOut && started && complete.hidden);
    document.querySelector<HTMLButtonElement>("#titleSettings")!.hidden = started;
    if (!p) settingsPanel.close();
    status.textContent = "Click to play. Esc to pause.";
    if (engine) { if (p) engine.suspend(); else engine.resume(); }
    if (p && input.locked) document.exitPointerLock();
  }
  input.onLockChange = (locked) => {
    if (locked) started = true;
    setPaused(!locked);
  };

  function startAudio(): void {
    if (engine || audioStarting) return;
    audioStarting = true;
    AudioEngine.create(camera)
      .then((e) => {
        engine = e;
        sounds = new GameSounds(e, loadout, player, darts, impacts, foamers);
        if (paused) e.suspend();
        applySettings(store.value);
      })
      .catch(() => { /* no Web Audio on this host: the page stays silent */ })
      .finally(() => { audioStarting = false; });
  }
  window.addEventListener("pointerdown", startAudio, { capture: true });
  window.addEventListener("keydown", startAudio, { capture: true });
  setPaused(true);

  // A bonk costs health from the data file; the console log stays.
  const logBonk = foamers.onBonk;
  foamers.onBonk = (f, attack) => {
    logBonk(f, attack);
    if (paused) return;
    const lost = health.damage(damageOf(attack), attack);
    if (lost <= 0) return;
    hud.onHit();
    if (health.dead) playerPopped();
  };

  // QA watch (the range's habit): arena.html?watch starts unpaused without
  // pointer lock, and window.dartArena drives the page for a hidden browser
  // pane with no animation frames.
  const watch = new URLSearchParams(location.search).has("watch");
  if (watch) setPaused(false);

  // ---- the loop ----

  const WEAPON_KEYS = ["weapon1", "weapon2", "weapon3"] as const;
  const step = 1 / 60;

  function fixedStep(dt: number): void {
    if (!paused) {
      health.update(dt);
      player.update(dt, input);
      foamers.update(dt, player.eye(1, _playerPos));
      // The arena runs after the Foamers so a cleared wave is seen the same
      // step its last Foamer goes down.
      const at = feetPos(_playerPos);
      arenaCtx.playerPos = [at.x, at.y, at.z];
      arenaCtx.aliveCount = foamers.live - foamers.downed.length;
      runner.update(dt, arenaCtx);
      for (let i = 0; i < loadout.ids.length; i++) {
        if (input.wasPressed(WEAPON_KEYS[i]!)) loadout.select(i);
      }
      if (input.wasPressed("weaponNext")) loadout.next();
      if (input.wasPressed("weaponPrev")) loadout.prev();
      loadout.activeViewmodel.muzzleCameraPoint(0, _muzzleCam);
      updateAim(camera, world, player.collider, _muzzleCam, _muzzle, _aimDir);
      loadout.update(
        dt,
        {
          fireHeld: input.isDown("fire"),
          firePressed: input.wasPressed("fire"),
          reloadPressed: input.wasPressed("reload"),
        },
        _aimDir,
      );
      if (sounds) sounds.update(dt, {
        fireHeld: input.isDown("fire"),
        firePressed: input.wasPressed("fire"),
        reloadPressed: input.wasPressed("reload"),
        sprintHeld: input.isDown("sprint"),
      });
      debris.update(dt);
      pieces.update(dt);
      darts.update(dt);
      world.step();
      if (player.feet < FALL_LIMIT) {
        player.teleport(start);
        foamers.clear();
        runner.reset();
        rifts.setAll("dim");
      }
      if (complete.hidden && !poppedOut && onExitPad()) showComplete();
      if (bannerTimer > 0) {
        bannerTimer -= dt;
        if (bannerTimer <= 0) banner.hidden = true;
      }
    }
    input.endStep();
  }

  function renderFrame(dt: number, alpha: number): void {
    if (paused) {
      pausedClock += dt;
      if (pausedClock < PAUSED_FRAME) return;
      pausedClock = 0;
    } else pausedClock = PAUSED_FRAME;
    debris.syncRender(alpha);
    pieces.syncRender(alpha);
    foamers.syncRender(alpha);
    rifts.update(dt);
    camera.position.copy(player.eye(paused ? 1 : alpha, eye));
    camera.rotation.set(player.pitch + loadout.active.climb, player.yaw, 0);
    loadout.render(dt, input.isDown("fire"));
    hud.setAmmo(loadout.active, loadout.active.state);
    hud.setHealth(health.hp, health.max);
    darts.syncRender(alpha);
    if (engine) engine.updateListener();
    renderer.render(scene, camera);
  }

  const loop = startLoop({
    frame(dt) {
      input.poll();
      voxelMesh.update();
      if (paused) return;
      const look = input.takeLook(dt);
      player.yaw -= look.yaw;
      player.pitch = THREE.MathUtils.clamp(player.pitch + look.pitch, -1.5, 1.5);
    },
    update(dt) {
      if (input.wasPressed("pause")) setPaused(!paused);
      if (input.wasPressed("mute")) store.set("muted", !store.value.muted);
      fixedStep(dt);
    },
    render: renderFrame,
  });

  // Dev-only hook for the automated checks in the browser pane.
  if (import.meta.env.DEV) Object.assign(window, {
    __arena: { camera, player, voxels, voxelMesh, debris, pieces, darts, loadout, impacts, foamers, health, runner, built, loop },
  });

  // In watch mode only: window.dartArena, plain functions for the reviewer.
  // step(n) runs n fixed steps by hand, for a pane with no animation frames.
  if (watch) {
    const _move = new THREE.Vector3();
    Object.assign(window, {
      dartArena: {
        state: () => ({
          phase: runner.state.phase,
          wave: runner.state.waveIndex + 1,
          cleared: runner.state.cleared,
          alive: foamers.live - foamers.downed.length,
          player: (() => {
            const p = feetPos(_playerPos);
            return [p.x, p.y, p.z].map((n) => Number(n.toFixed(3)));
          })(),
          doors: Object.fromEntries([...built.doors].map(([id, d]) => [id, d.state])),
          complete: !complete.hidden,
        }),
        moveTo: (x: number, y: number, z: number) => player.teleport(_move.set(x, y, z)),
        look: (yaw: number, pitch: number) => {
          player.yaw = yaw;
          player.pitch = THREE.MathUtils.clamp(pitch, -1.5, 1.5);
        },
        pause: (on: boolean) => setPaused(on),
        fire: () => {
          loadout.activeViewmodel.muzzleCameraPoint(0, _muzzleCam);
          updateAim(camera, world, player.collider, _muzzleCam, _muzzle, _aimDir);
          loadout.update(step, { fireHeld: false, firePressed: true, reloadPressed: false }, _aimDir);
          darts.update(step);
          world.step();
        },
        step: (n: number) => {
          for (let i = 0; i < n; i++) fixedStep(step);
          renderFrame(step, 1);
        },
      },
    });
  }

}
