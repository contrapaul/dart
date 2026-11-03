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
import { PlayerHealth } from "../player/health";
import { Shield } from "../player/shield";
import { DartSystem } from "../weapons/darts";
import { Loadout, modIds } from "../weapons/loadout";
import { updateAim } from "../weapons/aim";
import { DartImpacts, type VoxelTarget } from "../weapons/impacts";
import { FoamerSystem } from "../foamers/foamers";
import { ProjectileSystem } from "../foamers/projectiles";
import { makeLevelAI } from "../ai/level";
import { SettingsStore } from "../core/settings";
import type { PathPoints } from "../ai/nav-grid";
import { Hud } from "../ui/hud";
import { FrameLog, FrameGraph } from "../ui/frame-graph";
import { DebrisSystem } from "../voxel/debris";
import { MesherPool } from "../voxel/mesher-pool";
import { AudioEngine } from "../audio/audio";
import { GameSounds } from "../audio/game-sounds";
import rangeJson from "../../data/range.json";
import { damageOf } from "../game/attack";
import dartsJson from "../../data/darts.json";
import soundsJson from "../../data/sounds.json";
import renderJson from "../../data/render.json";
import foamerData from "../../data/foamers.json";

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
// UI-01 stage 1: health on the range too, with a God mode switch. The
// attack damage comes from data/foamers.json (attacks[].damage).
const health = new PlayerHealth();
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
// GAME-10a: the F02's foam balls (kinematic raycasts, no physics bodies).
const projectiles = new ProjectileSystem(rapier, world, debris, player.collider);
scene.add(projectiles.group);
foamers.projectiles = projectiles;
projectiles.onSound = (kind, at) => {
  if (!engine) return;
  if (kind === "burst") engine.play("FB-burst", { position: at });
};
// GAME-04 stage 1: the shield on the range too, so its panel and watch
// can drive it. Same class and data as the game pages; the wiring here is
// this page's own loop, not a copy of game logic.
const shield = new Shield(rapier, world, scene, camera, player, loadout, foamers, debris, voxelTargets);
camera.add(shield.group);
foamers.spawnCount = R.spawn.count;
foamers.spawnPoints = R.spawn.points.map((p) => [p[0], p[1], p[2]]);
// ENG-08 stage 3b: one director (its difficulty from the settings preset's
// director key) and one nav grid, baked over the range floor at load.
const store = new SettingsStore();
const levelAI = makeLevelAI(
  rapier, world, { minX: -half, maxX: half, minZ: -half, maxZ: half }, store.value.difficulty,
);
foamers.director = levelAI.director;
foamers.navGrid = levelAI.grid;
foamers.spawnState = "idle"; // range spawns start idle, so the sight test works
scene.add(foamers.group);
foamers.onBonk = (_f, attack) => {
  if (switches.godMode || paused) return;
  // GAME-04: an attack from the front arc behind the raised disc costs
  // only its data share; a blocked hit is not a hit, so no HUD flash.
  const blocked = shield.blocksAttackFrom(_f.centre);
  const lost = health.damage(damageOf(attack) * (blocked ? shield.damageShare : 1), attack);
  if (lost <= 0) return;
  if (blocked) {
    shield.noteBlocked();
    if (engine) engine.play("SH-block", { position: _f.centre });
    return;
  }
  hud.onHit();
};
// GAME-10a: a foam ball that reaches the player costs health like a bonk,
// the disc blocking its direction of travel (the point it came from).
const _fromBall = new THREE.Vector3();
projectiles.onHitPlayer = (b) => {
  if (switches.godMode || paused) return;
  const speed = Math.hypot(b.vel.x, b.vel.y, b.vel.z);
  _fromBall.set(
    b.pos.x - (b.vel.x / speed) * 0.5,
    b.pos.y - (b.vel.y / speed) * 0.5,
    b.pos.z - (b.vel.z / speed) * 0.5,
  );
  const blocked = shield.blocksAttackFrom(_fromBall);
  const lost = health.damage(damageOf("throw") * (blocked ? shield.damageShare : 1), "throw");
  if (lost <= 0) return;
  if (blocked) {
    shield.noteBlocked();
    if (engine) engine.play("SH-block", { position: b.pos });
    return;
  }
  if (engine) engine.play("FB-hit", { position: b.pos });
  hud.onHit();
};

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
  strafe: false, infiniteAmmo: false, godMode: false, nav: false,
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
    case "nav":
      // Built the first time it is switched on, from the grid's own cells.
      showNavGrid(on);
      break;
    case "godMode":
      if (on) {
        health.reset();
        hud.clearFlash();
      }
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
// GAME-10a: which type the spawn buttons and the keep-alive spawner make.
const typeRow = document.querySelector<HTMLDivElement>("#foamerType")!;
let foamerType = "F01";
for (const t of Object.keys(foamerData.types)) {
  const b = document.createElement("button");
  b.textContent = t;
  b.addEventListener("click", () => {
    foamerType = t;
    foamers.spawnType = t;
    typeRow.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
  });
  if (t === foamerType) b.classList.add("on");
  typeRow.appendChild(b);
}
// Spawn a Foamer at set metres ahead of the player, on the floor.
const _fwd = new THREE.Vector3();
const _fwdxz = new THREE.Vector3();
const _feet = new THREE.Vector3();
function spawnAhead(m: number) {
  camera.getWorldDirection(_fwd);
  player.eye(1, _fwdxz);
  _feet.set(_fwdxz.x + _fwd.x * m, 0, _fwdxz.z + _fwd.z * m);
  foamers.spawn(_feet, camera.position, foamerType);
}
for (const [id, m] of [["#spawn5", 5], ["#spawn10", 10], ["#spawn20", 20], ["#spawn30", 30]] as const)
  document.querySelector<HTMLButtonElement>(id)!.addEventListener("click", () => spawnAhead(m));
document.querySelector<HTMLButtonElement>("#clearFoamers")!.addEventListener("click", () =>
  foamers.clear());
// GAME-11: break the nearest living Foamer's left leg, to watch a fall.
document.querySelector<HTMLButtonElement>("#breakLeg")!.addEventListener("click", () =>
  foamers.breakLegForTest());

// The Nav grid overlay (ENG-08 stage 3b): one InstancedMesh of thin tiles on
// every walkable cell, built when the switch is first turned on, and one
// line per living Foamer showing the path it is following. Both are redrawn
// each step while the switch is on; nothing is built while it is off.
let navMesh: THREE.InstancedMesh | null = null;
const navPathLines = new THREE.Group();
scene.add(navPathLines);
const navCellGeo = new THREE.BoxGeometry(1, 1, 1);
const navCellMat = new THREE.MeshBasicMaterial({
  color: 0x7ef0c0, transparent: true, opacity: 0.22, depthWrite: false,
});
const _navM = new THREE.Matrix4();
const _navC = new THREE.Color();

function buildNavMesh() {
  const g = levelAI.grid;
  let n = 0;
  for (let i = 0; i < g.walkable.length; i++) if (g.walkable[i] === 1) n++;
  const mesh = new THREE.InstancedMesh(navCellGeo, navCellMat, Math.max(1, n));
  mesh.count = n;
  mesh.frustumCulled = false;
  let k = 0;
  for (let r = 0; r < g.rows; r++) {
    for (let c = 0; c < g.cols; c++) {
      const i = r * g.cols + c;
      if (g.walkable[i] !== 1) continue;
      const y = g.ground[i]!;
      _navM.makeScale(g.cell * 0.94, 0.02, g.cell * 0.94);
      _navM.setPosition(g.minX + (c + 0.5) * g.cell, y + 0.02, g.minZ + (r + 0.5) * g.cell);
      mesh.setMatrixAt(k, _navM);
      _navC.setHSL(0.42, 0.6, 0.4 + 0.25 * Math.min(1, Math.max(0, y / 4)));
      mesh.setColorAt(k, _navC);
      k++;
    }
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  return mesh;
}

/** The path line for one Foamer, as a BufferGeometry rewritten in place. */
interface NavLine {
  line: THREE.Line;
  pos: Float32Array;
}
const navLines = new Map<number, NavLine>();
const NAV_LINE_POINTS = 256;

function navLineFor(f: number): NavLine {
  let l = navLines.get(f);
  if (l) return l;
  const pos = new Float32Array(NAV_LINE_POINTS * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setDrawRange(0, 0);
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffd166 }));
  line.frustumCulled = false;
  navPathLines.add(line);
  l = { line, pos };
  navLines.set(f, l);
  return l;
}

function showNavGrid(on: boolean) {
  if (!on) {
    if (navMesh) navMesh.visible = false;
    navPathLines.visible = false;
    return;
  }
  // Rebuilt on every switch-on (cheap, and the grid may have re-baked): one
  // InstancedMesh, not one mesh per cell.
  if (!navMesh) {
    navMesh = buildNavMesh();
    scene.add(navMesh);
  } else {
    scene.remove(navMesh);
    navMesh.geometry.dispose();
    (navMesh.material as THREE.Material).dispose();
    navMesh = buildNavMesh();
    scene.add(navMesh);
  }
  navMesh.visible = true;
  navPathLines.visible = true;
}

/** Redraw every Foamer's path line, while the switch is on. */
function updateNavPaths() {
  if (!switches.nav) return;
  const seen = new Set<number>();
  foamers.list.forEach((f, i) => {
    seen.add(i);
    const l = navLineFor(i);
    const path: PathPoints | undefined = f.agent?.path;
    const n = path ? Math.min(path.count, NAV_LINE_POINTS) : 0;
    for (let k = 0; k < n; k++) {
      l.pos[k * 3] = path!.xs[k]!;
      l.pos[k * 3 + 1] = (levelAI.grid.groundAt(path!.xs[k]!, path!.zs[k]!) || 0) + 0.12;
      l.pos[k * 3 + 2] = path!.zs[k]!;
    }
    l.line.geometry.setDrawRange(0, n);
    (l.line.geometry.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
    l.line.geometry.computeBoundingSphere();
  });
  for (const [k, l] of navLines) {
    if (seen.has(k)) continue;
    l.line.removeFromParent();
    l.line.geometry.dispose();
    navLines.delete(k);
  }
}

// The director's token state, for the report (ENG-08 stage 3b).
function directorReport(): string {
  const st = levelAI.director.stats();
  return `melee ${st.melee.inUse}/${st.melee.cap} ranged ${st.ranged.inUse}/${st.ranged.cap} waiting ${st.waiting}`;
}

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
    director: directorReport(),
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
input.onLockChange = (locked) => setPaused(!locked);
// The first click or key starts the audio, inside that gesture (the pointer
// lock event is not a gesture, and Safari keeps a context made there silent).
window.addEventListener("pointerdown", startAudio, { capture: true });
window.addEventListener("keydown", startAudio, { capture: true });
document.querySelector<HTMLButtonElement>("#play")!.addEventListener("click", () => input.requestLock());
setPaused(true);
// QA watch (task QA-watch): range.html?watch starts unpaused without
// pointer lock, for the reviewer's automated browser, which cannot take
// it. The panel stays hidden, the HUD shows, and the sim steps as when
// playing. Absent ?watch this page behaves exactly as before.
const watch = new URLSearchParams(location.search).has("watch");
if (watch) setPaused(false);

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
      if (switches.foamers) {
        foamers.update(dt, player.eye(1, _eye));
        // GAME-10a: the foam balls fly on their own rays, no bodies.
        projectiles.update(dt);
        updateNavPaths();
      }
      // Switch: wheel down is next, up is prev; keys 1 to 3 select directly.
      for (let i = 0; i < WEAPON_KEYS.length; i++)
        if (input.wasPressed(WEAPON_KEYS[i])) loadout.select(i);
      if (input.wasPressed("weaponNext")) loadout.next();
      if (input.wasPressed("weaponPrev")) loadout.prev();
      // Muzzle from the active viewmodel, then aim through the world,
      // then the loadout's fixed step, then the darts.
      loadout.activeViewmodel.muzzleCameraPoint(0, _muzzleCam);
      updateAim(camera, world, player.collider, _muzzleCam, _muzzle, _aimDir);
      // GAME-04: the shield first, so it can take this step's fire press
      // as the throw before the blaster sees it (as on the game pages).
      shield.toggleMode = store.value.shieldMode;
      const se = shield.update(dt, {
        fireHeld: input.isDown("fire"),
        firePressed: input.wasPressed("fire"),
        shieldHeld: input.isDown("shield"),
        shieldPressed: input.wasPressed("shield"),
        reloadPressed: input.wasPressed("reload"),
      });
      if (engine) {
        if (se.raised) engine.play("SH-raise");
        if (se.thrown) engine.play("SH-throw", { position: shield.discPosition });
        for (const p of se.hits) engine.play("SH-ricochet", { position: p });
        if (se.caught) engine.play("SH-catch");
      }
      shield.onCarveAt = (p) => { if (engine) engine.play("DT-carve", { position: p }); };
      const canFire = !shield.blocksFire && !shield.usedFirePress;
      loadout.update(
        dt,
        {
          fireHeld: canFire && input.isDown("fire"),
          firePressed: canFire && input.wasPressed("fire"),
          reloadPressed: input.wasPressed("reload"),
        },
        _aimDir,
      );
      if (sounds) sounds.update(dt, {
        fireHeld: canFire && input.isDown("fire"),
        firePressed: canFire && input.wasPressed("fire"),
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
    const climb = loadout.active.climb + shield.kick;
    camera.rotation.set(player.pitch + climb, player.yaw, 0);
    // The active blaster's viewmodel animates once per render frame.
    loadout.render(dt, input.isDown("fire"));
    hud.setAmmo(loadout.active, loadout.active.state);
    hud.setHealth(health.hp, health.max);
    if (engine) engine.updateListener();
    renderer.render(scene, camera);
  },
  stats: pushStats,
});

// Dev-only hook for automated checks in the browser.
if (import.meta.env.DEV) Object.assign(window, { __range: { log, foamers, darts, loadout, player, camera, loop: loopCtl } });

// In watch mode only: window.dartRange, plain functions the reviewer calls
// from the console. They reuse the panel's own handlers (spawnAhead,
// breakLegForTest, setPaused, the player's pose), so the automation sees
// exactly what the buttons do.
if (watch) {
  const _moveTo = new THREE.Vector3();
  Object.assign(window, {
    dartRange: {
      spawn: (distanceMetres: number) => spawnAhead(distanceMetres),
      breakLeg: () => foamers.breakLegForTest() ?? null,
      look: (yawRadians: number, pitchRadians: number) => {
        player.yaw = yawRadians;
        player.pitch = THREE.MathUtils.clamp(pitchRadians, -1.5, 1.5);
      },
      moveTo: (x: number, z: number) => player.teleport(_moveTo.set(x, 0, z)),
      pause: (on: boolean) => setPaused(on),
      /** GAME-04: hold the disc up (or drop it), and throw it. */
      block: (on: boolean) => {
        shield.forcedHold = on;
      },
      throwShield: () => {
        shield.forcedHold = true;
        // Rise first (block.raiseTime), then the press is the throw.
        for (let i = 0; i < 30 && (shield.state !== "raised" || shield.raise < 1); i++)
          shield.update(1 / 60, {
            fireHeld: false, firePressed: false, shieldHeld: true, shieldPressed: false,
            reloadPressed: false,
          });
        const e = shield.update(1 / 60, {
          fireHeld: true, firePressed: true, shieldHeld: true, shieldPressed: false,
          reloadPressed: false,
        });
        return e.thrown;
      },
      shieldState: () => shield.state,
      state: () => ({
        foamers: foamers.list.map((f) => ({
          type: f.spec.rig,
          state: f.state,
          health: f.health,
          position: [f.centre.x, f.centre.y, f.centre.z].map((n) => Number(n.toFixed(3))) as [number, number, number],
          parts: [...f.parts.keys()],
        })),
        balls: projectiles.list.length,
      }),
    },
  });
}
