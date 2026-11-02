// Test range (ENG-11): a plain level with the frame-time graph, system
// switches and a test panel. Same structure as the game page without the
// voxel wall, the foam blocks, the thrown blocks and the melee debug blast.
// The frame and update steps must not allocate: every scratch vector lives
// at module scope, the stats hook reuses the loop's one records, and
// auto-strafe writes one reused object.
import * as THREE from "three";
import { createRenderer } from "../render/scene";
import { createPhysics } from "../physics/world";
import { startLoop, type FrameStats } from "../core/loop";
import { Input } from "../core/input";
import { PlayerController } from "../player/controller";
import { DartSystem } from "../weapons/darts";
import { Loadout, modIds } from "../weapons/loadout";
import { updateAim } from "../weapons/aim";
import { DartImpacts, type VoxelTarget } from "../weapons/impacts";
import { FoamerSystem } from "../foamers/foamers";
import { Hud } from "../ui/hud";
import { FrameLog, FrameGraph } from "../ui/frame-graph";
import { DebrisSystem } from "../voxel/debris";
import { MesherPool } from "../voxel/mesher-pool";
import { AudioEngine } from "../audio/audio";
import { GameSounds } from "../audio/game-sounds";
import rangeJson from "../../data/range.json";
import dartsJson from "../../data/darts.json";
import soundsJson from "../../data/sounds.json";
import renderJson from "../../data/render.json";

const R = (rangeJson as unknown as {
  range: {
    size: number;
    playerSpawn: [number, number, number];
    cover: [number, number, number, number, number, number][];
    spawn: { count: number; points: [number, number, number][] };
  };
  bench: { seconds: number; strafePeriod: number };
}).range;
const BENCH = (rangeJson as { bench: { seconds: number; strafePeriod: number } }).bench;
const SPAWN_POSE = new THREE.Vector3(...R.playerSpawn);

const canvas = document.querySelector<HTMLCanvasElement>("#view")!;
const overlay = document.querySelector<HTMLDivElement>("#overlay")!;
const hud = new Hud(document.querySelector<HTMLDivElement>("#hud")!);
const log = new FrameLog();
const graph = new FrameGraph(
  document.querySelector<HTMLCanvasElement>("#graphCanvas")!,
  document.querySelector<HTMLDivElement>("#graphbox")!,
  document.querySelector<HTMLElement>("#graphText")!,
  log,
);

const { renderer, scene, camera } = createRenderer(canvas);
camera.rotation.order = "YXZ";
scene.add(camera); // the blaster viewmodel is a child of the camera
const input = new Input(canvas);
const { rapier, world } = await createPhysics();
const mesherPool = new MesherPool();
const debris = new DebrisSystem(rapier, world);
scene.add(debris.mesh);

// The level: a flat floor, 4 m outer walls, the cover boxes from the data
// file and thin markers every 5 m down the long axis (no collider).
const FLOOR = 0x3d2f6b, WALL = 0x5a4890, COVER = 0x6b58a8, MARK = 0x7a68c0;
function addBox(
  x: number, y: number, z: number, w: number, h: number, d: number,
  color: number, collider = true,
) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, roughness: 0.9 }),
  );
  mesh.position.set(x, y, z);
  mesh.castShadow = mesh.receiveShadow = collider;
  scene.add(mesh);
  if (collider)
    world.createCollider(
      rapier.ColliderDesc.cuboid(w / 2, h / 2, d / 2).setTranslation(x, y, z),
    );
}
addBox(0, -0.5, 0, R.size, 1, R.size, FLOOR);
const half = R.size / 2;
addBox(0, 2, -half, R.size, 4, 1, WALL);
addBox(0, 2, half, R.size, 4, 1, WALL);
addBox(-half, 2, 0, 1, 4, R.size, WALL);
addBox(half, 2, 0, 1, 4, R.size, WALL);
for (const c of R.cover) addBox(c[0], c[1], c[2], c[3], c[4], c[5], COVER);
for (let m = 5; m <= 30; m += 5)
  addBox(0, 0.01, R.playerSpawn[2] - m, 0.5, 0.02, 2, MARK, false);

const player = new PlayerController(rapier, world, SPAWN_POSE);
const darts = new DartSystem(scene, world, rapier, player.collider);
// Sound (AUD-01 stage 2): the engine opens on the first click (the range Play
// button, or the canvas), and GameSounds gets it as its sink. The panel's
// Sound section is built when the engine arrives; the report's voice
// count reads the engine's pool.
let engine: AudioEngine | null = null;
let sounds: GameSounds | null = null;
let audioStarting = false;
function startAudio() {
  if (engine || audioStarting) return;
  audioStarting = true;
  AudioEngine.create(camera)
    .then((e) => {
      engine = e;
      sounds = new GameSounds(e, loadout, player, darts, impacts, foamers);
      buildSoundPanel();
    })
    .catch(() => { /* no Web Audio on this host: the range goes on silent */ })
    .finally(() => { audioStarting = false; });
}
// The loadout loads all three blasters and their GLTF viewmodels before the
// start overlay can resolve. The panel's blaster and mod rows drive this;
// the dart type buttons set the active blaster's dart type.
const loadout = await Loadout.load(camera, darts);
// Darts leave from the active muzzle's world point, pulled out of walls.
const _aimUnused = new THREE.Vector3();
Loadout.muzzleToWorld = (camPoint, out) => {
  updateAim(camera, world, player.collider, camPoint, out, _aimUnused);
  return out;
};
// Only the Foamers' parts are voxel targets on this page, and the system
// pushes each part in and out as Foamers spawn and go.
const voxelTargets: VoxelTarget[] = [];
// Dart hits on the Foamer parts carve craters and throw foam debris.
const impacts = new DartImpacts(darts, debris, voxelTargets);
const foamers = new FoamerSystem(rapier, world, mesherPool, debris, darts, voxelTargets);
foamers.spawnCount = R.spawn.count;
foamers.spawnPoints = R.spawn.points.map((p) => [p[0], p[1], p[2]]);
scene.add(foamers.group);
foamers.onBonk = () => {};

// Blaster and mod panel rows, built after the loadout resolves. The mod
// row is rebuilt whenever the active blaster changes or a mod is toggled.
const blasterRow = document.querySelector<HTMLDivElement>("#blasterSelect")!;
const modRow = document.querySelector<HTMLDivElement>("#modToggles")!;
function renderBlasterRow() {
  blasterRow.textContent = "";
  loadout.ids.forEach((id, i) => {
    const b = document.createElement("button");
    b.textContent = id;
    b.addEventListener("click", () => {
      loadout.select(i);
      renderBlasterRow();
      renderModRow();
    });
    if (i === loadout.activeIndex) b.classList.add("on");
    blasterRow.appendChild(b);
  });
}
function renderModRow() {
  modRow.textContent = "";
  const i = loadout.activeIndex;
  for (const mod of modIds(loadout.ids[i])) {
    const b = document.createElement("button");
    b.textContent = mod;
    const on = loadout.modsOf(i).includes(mod);
    if (on) b.classList.add("on");
    b.addEventListener("click", () => {
      loadout.setMod(i, mod, !on);
      applyInfiniteAmmoHooks();
      renderModRow();
    });
    modRow.appendChild(b);
  }
}
renderBlasterRow();
renderModRow();

// Switches, each listed in the report.
const switches = {
  foamers: true, shadows: true, pixelRatio: true, snap: true,
  strafe: false, infiniteAmmo: false,
};
// Infinite ammo refills the active blaster's magazine after every shot.
function applyInfiniteAmmoHooks() {
  for (const b of loadout.blasters) {
    b.onShot = (muzzleIndex: number) => {
      // Call the viewmodel's original hook first.
      loadout.viewmodels[loadout.blasters.indexOf(b)]
        .onShot(muzzleIndex);
      if (switches.infiniteAmmo) b.refill();
    };
  }
}
applyInfiniteAmmoHooks();
// Auto-strafe: a sideways walk that turns around every BENCH.strafePeriod
// seconds, written into one reused object the Input reads instead of the
// keys.
const strafeMove = { x: 1, y: 0 };
let strafeTimer = 0;
let strafeDir = 1;
function strafeStep(dt: number) {
  strafeTimer -= dt;
  if (strafeTimer <= 0) {
    strafeTimer += BENCH.strafePeriod;
    strafeDir = -strafeDir;
  }
  strafeMove.x = strafeDir;
}

let loopCtl: ReturnType<typeof startLoop>;
function setSwitch(name: keyof typeof switches, on: boolean) {
  if (switches[name] === on) return;
  switches[name] = on;
  document.querySelectorAll<HTMLButtonElement>(`button[data-switch="${name}"]`).forEach((b) =>
    b.classList.toggle("on", b.dataset.on === "1" ? on : !on));
  switch (name) {
    case "foamers":
      if (!on) foamers.clear(); // the spawner is off with it
      break;
    case "shadows":
      renderer.shadowMap.enabled = on;
      scene.traverse((o) => {
        if (o instanceof THREE.DirectionalLight) o.castShadow = on;
        else if (o instanceof THREE.Mesh) {
          const m = Array.isArray(o.material) ? o.material : [o.material];
          for (const mm of m) mm.needsUpdate = true;
        }
      });
      break;
    case "pixelRatio":
      renderer.setPixelRatio(on ? Math.min(window.devicePixelRatio, 2) : 1);
      renderer.setSize(window.innerWidth, window.innerHeight, false);
      break;
    case "snap":
      loopCtl.setSnap(on);
      break;
    case "strafe":
      input.moveOverride = on ? strafeMove : null;
      break;
    case "infiniteAmmo":
      break;
  }
}
document.querySelectorAll<HTMLButtonElement>("button[data-switch]").forEach((b) =>
  b.addEventListener("click", () =>
    setSwitch(b.dataset.switch! as keyof typeof switches, b.dataset.on === "1")));
for (const k of Object.keys(switches) as (keyof typeof switches)[])
  document.querySelectorAll<HTMLButtonElement>(`button[data-switch="${k}"]`).forEach((b) =>
    b.classList.toggle("on", b.dataset.on === "1" ? !!switches[k] : !switches[k]));

// One dart type button per entry in data/darts.json, for the active blaster.
const dartRow = document.querySelector<HTMLDivElement>("#dartTypes")!;
function renderDartRow() {
  dartRow.textContent = "";
  const activeType = loadout.active.dartType;
  for (const t of Object.keys((dartsJson as { types: object }).types)) {
    const b = document.createElement("button");
    b.textContent = t;
    b.addEventListener("click", () => {
      loadout.setDartType(loadout.activeIndex, t as typeof activeType);
      renderDartRow();
    });
    if (t === activeType) b.classList.add("on");
    dartRow.appendChild(b);
  }
}
renderDartRow();
// Keep alive: 0, 1, 4 or 10 steady.
const keepRow = document.querySelector<HTMLDivElement>("#keepAlive")!;
for (const k of [0, 1, 4, 10]) {
  const b = document.createElement("button");
  b.textContent = String(k);
  b.addEventListener("click", () => {
    foamers.spawnCount = k;
    keepRow.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
  });
  keepRow.appendChild(b);
}
// Spawn a Foamer at set metres ahead of the player, on the floor.
const _fwd = new THREE.Vector3();
const _fwdxz = new THREE.Vector3();
const _feet = new THREE.Vector3();
function spawnAhead(m: number) {
  camera.getWorldDirection(_fwd);
  player.eye(1, _fwdxz);
  _feet.set(_fwdxz.x + _fwd.x * m, 0, _fwdxz.z + _fwd.z * m);
  foamers.spawn(_feet, camera.position);
}
for (const [id, m] of [["#spawn5", 5], ["#spawn10", 10], ["#spawn20", 20], ["#spawn30", 30]] as const)
  document.querySelector<HTMLButtonElement>(id)!.addEventListener("click", () => spawnAhead(m));
document.querySelector<HTMLButtonElement>("#clearFoamers")!.addEventListener("click", () =>
  foamers.clear());

// Report and copy.
const reportEl = document.querySelector<HTMLPreElement>("#report")!;
function reportText(): string {
  const mods = loadout.modsOf(loadout.activeIndex);
  const extra: Record<string, string | number> = {
    foamers: switches.foamers ? "on" : "off",
    shadows: switches.shadows ? "on" : "off",
    pixelRatio: switches.pixelRatio ? "device" : "1",
    snap: switches.snap ? "on" : "off",
    autoStrafe: switches.strafe ? "on" : "off",
    infiniteAmmo: switches.infiniteAmmo ? "on" : "off",
    keepAlive: foamers.spawnCount,
    blaster: loadout.activeId(),
    dartType: loadout.active.dartType,
    voices: engine ? engine.playingCount : 0,
    mods: mods.length ? mods.join(",") : "none",
    userAgent: navigator.userAgent,
    devicePixelRatio: window.devicePixelRatio,
    screen: window.screen.width + "x" + window.screen.height,
  };
  return log.report(extra);
}
function showReport() { reportEl.textContent = reportText(); }
document.querySelector<HTMLButtonElement>("#reportBtn")!.addEventListener("click", showReport);
document.querySelector<HTMLButtonElement>("#copyBtn")!.addEventListener("click", () =>
  navigator.clipboard.writeText(reportText()).catch(() => {}));
document.querySelector<HTMLButtonElement>("#clearLog")!.addEventListener("click", () => {
  log.reset();
  reportEl.textContent = "";
});

// Pausing plays like the game page: Esc releases the lock and shows this
// panel, the Play button captures the mouse again.
let paused = true;
function setPaused(p: boolean) {
  paused = p;
  overlay.hidden = !p;
  hud.show(!p);
  if (engine) { if (p) engine.suspend(); else engine.resume(); }
  if (p && input.locked) document.exitPointerLock();
}
input.onLockChange = (locked) => {
  setPaused(!locked);
  if (locked) startAudio(); // the first lock comes from the click that shows the gesture
};
document.querySelector<HTMLButtonElement>("#play")!.addEventListener("click", () => input.requestLock());
setPaused(true);

// The Sound section of the panel (AUD-01): the master volume, a mute for
// this page only, and one row per sound ID with a Play button and a
// show of whether it has a recording and how many takes, or a skin.
const soundPanel = document.querySelector<HTMLDivElement>("#soundPanel")!;
function buildSoundPanel() {
  const e = engine!;
  const table = (soundsJson as { sounds: Record<string, { files: string[] }> }).sounds;
  soundPanel.innerHTML = "";
  const vol = document.createElement("label");
  vol.className = "ctl";
  vol.textContent = "Volume";
  const slider = document.createElement("input");
  slider.type = "range"; slider.min = "0"; slider.max = "1"; slider.step = "0.05";
  slider.value = String(Math.round(e.volume * 100) / 100);
  slider.addEventListener("input", () => { engine && (engine.volume = Number(slider.value)); });
  vol.appendChild(slider);
  soundPanel.appendChild(vol);
  const mute = document.createElement("label");
  mute.className = "ctl";
  const muteLbl = document.createTextNode("Mute");
  const mb = document.createElement("button");
  function syncMute() { mb.textContent = engine?.muted ? "on" : "off"; mb.classList.toggle("on", !!engine?.muted); }
  mb.addEventListener("click", () => { engine && (engine.muted = !engine.muted); syncMute(); });
  mute.appendChild(muteLbl); mute.appendChild(mb);
  soundPanel.appendChild(mute);
  const list = document.createElement("div");
  list.className = "soundList";
  for (const id of Object.keys(table)) {
    const takes = engine!.takeCount(id);
    const row = document.createElement("div");
    row.className = "soundRow";
    const sid = document.createElement("span");
    sid.className = "sid"; sid.textContent = id;
    const state = document.createElement("span");
    state.className = "sstate";
    state.textContent = takes ? `recording (${takes})` : "placeholder";
    const pb = document.createElement("button");
    pb.textContent = "Play";
    // The panel shows while paused, when the engine is suspended.
    pb.addEventListener("click", () => { e.resume(); e.play(id); });
    row.appendChild(sid); row.appendChild(state); row.appendChild(pb);
    list.appendChild(row);
  }
  soundPanel.appendChild(list);
}

// Benchmark: clear the log, run BENCH.seconds unpaused with auto-strafe on
// (it locks the mouse, as does the Play button), keep the other switches,
// then unlock so the panel shows and write the report.
document.querySelector<HTMLButtonElement>("#benchmark")!.addEventListener("click", () => {
  const wasStrafe = switches.strafe;
  if (!switches.strafe) setSwitch("strafe", true);
  log.reset();
  input.requestLock();
  setTimeout(() => {
    if (!wasStrafe) setSwitch("strafe", false);
    showReport();
    if (input.locked) document.exitPointerLock();
  }, BENCH.seconds * 1000 + 100);
});

// Backquote shows or hides the frame graph; a plain keydown listener like
// the game's KeyT, so it also works while paused.
window.addEventListener("keydown", (e) => {
  if (e.code === "Backquote" && !e.repeat) graph.toggle();
});

// Push every frame into the log. performance.memory is Chrome-only (Firefox
// has none), so the heap is NaN there and the graph skips its heap lines.
const MEM = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
function pushStats(s: FrameStats) {
  log.push(s, MEM ? MEM.usedJSHeapSize / 1048576 : NaN, paused);
  graph.draw(s.dt);
}

// Scratch vectors, all reused so the steps and render allocate nothing.
const _muzzleCam = new THREE.Vector3();
const _muzzle = new THREE.Vector3();
const _aimDir = new THREE.Vector3();
const _eye = new THREE.Vector3();
const eye = new THREE.Vector3();
const WEAPON_KEYS = ["weapon1", "weapon2", "weapon3"] as const;

const PAUSED_FRAME_MS = renderJson.pausedFrame * 1000;
let pausedClock = PAUSED_FRAME_MS;

loopCtl = startLoop({
  frame(dt) {
    input.poll();
    if (paused) return;
    if (switches.strafe) strafeStep(dt);
    const look = input.takeLook(dt);
    player.yaw -= look.yaw;
    player.pitch = THREE.MathUtils.clamp(player.pitch + look.pitch, -1.5, 1.5);
  },
  update(dt) {
    if (input.wasPressed("pause")) setPaused(!paused);
    if (!paused) {
      player.update(dt, input);
      if (switches.foamers) foamers.update(dt, player.eye(1, _eye));
      // Switch: wheel down is next, up is prev; keys 1 to 3 select directly.
      for (let i = 0; i < WEAPON_KEYS.length; i++)
        if (input.wasPressed(WEAPON_KEYS[i])) loadout.select(i);
      if (input.wasPressed("weaponNext")) loadout.next();
      if (input.wasPressed("weaponPrev")) loadout.prev();
      // Muzzle from the active viewmodel, then aim through the world,
      // then the loadout's fixed step, then the darts.
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
      darts.update(dt);
      if (player.feet < -20) player.teleport(SPAWN_POSE);
      world.step();
    }
    input.endStep();
  },
  render(dt, alpha) {
    // While paused only redraw a few frames a second (arriving meshes,
    // window resizes), like the game page.
    if (paused) {
      pausedClock += dt * 1000;
      if (pausedClock < PAUSED_FRAME_MS) return;
      pausedClock = 0;
    } else pausedClock = PAUSED_FRAME_MS;
    debris.syncRender(alpha);
    if (switches.foamers) foamers.syncRender(alpha);
    darts.syncRender(alpha);
    camera.position.copy(player.eye(paused ? 1 : alpha, eye));
    // The active blaster's recoil climb tilts the view up (the player's own
    // pitch is unchanged, so releasing the trigger brings the view back).
    const climb = loadout.active.climb;
    camera.rotation.set(player.pitch + climb, player.yaw, 0);
    // The active blaster's viewmodel animates once per render frame.
    loadout.render(dt, input.isDown("fire"));
    hud.setAmmo(loadout.active, loadout.active.state);
    if (engine) engine.updateListener();
    renderer.render(scene, camera);
  },
  stats: pushStats,
});

// Dev-only hook for automated checks in the browser.
if (import.meta.env.DEV) Object.assign(window, { __range: { log, foamers, darts, loadout, player, camera, loop: loopCtl } });
