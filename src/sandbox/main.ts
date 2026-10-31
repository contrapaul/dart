import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { createRenderer } from "../render/scene";
import { voxelFoamMaterial } from "../render/foam-material";
import { MesherPool } from "../voxel/mesher-pool";
import { VoxelVolume, chunkCoords, CHUNK_SIZE } from "../voxel/chunk";
import { buildPadded } from "../voxel/mesher";
import { buildPartVolume, rigHeight, solvePose, type RigSpec } from "../foamers/rig";
import { rigMotion } from "../foamers/rig-motion";
import rigData from "../../data/foamer-rigs.json";

// Foamer sandbox (sandbox.html): every greybox rig from data/foamer-rigs.json
// meshed with the game's own voxel, smoothing and foam code, moving with its
// movement style. Lineup shows them side by side next to the player's
// height; Roam lets one walk a loop. For discussing shape and movement
// before limb damage (ENG-10).

const RIGS = rigData.rigs as unknown as RigSpec[];
const ROAM_RADIUS = 4;

const canvas = document.querySelector<HTMLCanvasElement>("#view")!;
const { renderer, scene, camera } = createRenderer(canvas);
scene.fog = new THREE.Fog(0x1b1430, 30, 80);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.target.set(0, 0.8, 0);
camera.position.set(0, 3, 9);

// Floor with a 1 m grid, and the player for scale.
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(80, 80).rotateX(-Math.PI / 2),
  new THREE.MeshStandardMaterial({ color: 0x3a2f5c, roughness: 1 }),
);
floor.receiveShadow = true;
scene.add(floor);
const grid = new THREE.GridHelper(80, 80, 0x6b5a9e, 0x4a3d78);
grid.position.y = 0.002;
scene.add(grid);
const player = new THREE.Mesh(
  new THREE.CapsuleGeometry(0.3, 1.2, 6, 16).translate(0, 0.9, 0),
  new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.18, depthWrite: false }),
);
scene.add(player);

const pool = new MesherPool();
const material = voxelFoamMaterial();
const labelLayer = document.querySelector<HTMLDivElement>("#labels")!;

/** One rig in the scene: a group per part, meshed in the worker pool. */
class RigView {
  readonly root = new THREE.Group();
  readonly parts = new Map<string, THREE.Group>();
  readonly pose = new Map<string, THREE.Matrix4>();
  readonly height: number;
  readonly width: number;
  readonly label = document.createElement("span");
  readonly partLabels = new Map<string, HTMLSpanElement>();
  feet = new THREE.Vector3();
  yaw = 0;
  phase = "";
  private volumes = new Map<string, VoxelVolume>();

  constructor(readonly rig: RigSpec, readonly timeOffset = 0) {
    for (const p of rig.parts) {
      const v = new VoxelVolume(rig.voxelSize);
      buildPartVolume(v, p, rig.material);
      this.volumes.set(p.id, v);
      const g = new THREE.Group();
      g.matrixAutoUpdate = false;
      this.parts.set(p.id, g);
      this.root.add(g);
      const l = document.createElement("span");
      l.textContent = p.id;
      this.partLabels.set(p.id, l);
    }
    this.height = rigHeight(rig) - (rig.hover ?? 0);
    this.width = Math.max(...rig.parts.map((p) => p.size[0])) * rig.voxelSize * 1.6;
    this.label.className = "rig";
    this.label.textContent = rig.label;
    scene.add(this.root);
  }

  /** (Re)mesh every part, smooth or as blocks. */
  async mesh(smooth: boolean) {
    for (const [id, volume] of this.volumes) {
      const g = this.parts.get(id)!;
      const jobs = [...volume.chunks].map(async ([key, chunk]) => {
        const [cx, cy, cz] = chunkCoords(key);
        const data = await pool.mesh(buildPadded(volume, cx, cy, cz, chunk), smooth);
        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.BufferAttribute(data.positions, 3));
        geo.setAttribute("normal", new THREE.BufferAttribute(data.normals, 3));
        geo.setAttribute("color", new THREE.BufferAttribute(data.colors, 3));
        geo.setIndex(new THREE.BufferAttribute(data.indices, 1));
        const m = new THREE.Mesh(geo, material);
        m.position.set(cx * CHUNK_SIZE, cy * CHUNK_SIZE, cz * CHUNK_SIZE);
        m.castShadow = m.receiveShadow = true;
        return m;
      });
      const meshes = await Promise.all(jobs);
      for (const old of [...g.children]) {
        (old as THREE.Mesh).geometry.dispose();
        g.remove(old);
      }
      for (const m of meshes) g.add(m);
    }
  }

  /** Pose at time t (seconds of animation). */
  update(t: number) {
    const f = rigMotion(this.rig, t + this.timeOffset);
    this.phase = f.phase;
    solvePose(this.rig, this.feet, this.yaw, f.motion, this.pose);
    const s = this.rig.voxelSize;
    for (const [id, g] of this.parts) g.matrix.copy(this.pose.get(id)!).scale(new THREE.Vector3(s, s, s));
    return f.ground;
  }

  dispose() {
    scene.remove(this.root);
    for (const g of this.parts.values())
      for (const m of g.children) (m as THREE.Mesh).geometry.dispose();
    this.label.remove();
    for (const l of this.partLabels.values()) l.remove();
  }
}

// --- state -----------------------------------------------------------------

let mode: "lineup" | "roam" = "lineup";
let selected = RIGS[0].id;
let smooth = true;
let playing = true;
let speed = 1;
let showPartLabels = false;
let views: RigView[] = [];
let t = 0;
let roamAngle = 0;

function selectedRig() {
  return RIGS.find((r) => r.id === selected)!;
}

function build() {
  for (const v of views) v.dispose();
  views = [];
  if (mode === "lineup") {
    // Side by side, facing the camera, the player at the left end.
    let x = 0;
    for (const rig of RIGS) {
      const v = new RigView(rig);
      x += v.width / 2;
      v.feet.set(x, 0, 0);
      x += v.width / 2 + 0.6;
      views.push(v);
    }
    const shift = x / 2;
    for (const v of views) v.feet.x -= shift;
    player.position.set(-shift - 1, 0, 0);
  } else {
    const rig = selectedRig();
    for (let i = 0; i < (rig.pack ?? 1); i++) views.push(new RigView(rig, i * 0.37));
    player.position.set(0, 0, 0);
  }
  for (const v of views) {
    labelLayer.append(v.label);
    for (const l of v.partLabels.values()) labelLayer.append(l);
    void v.mesh(smooth);
  }
  focus();
}

function focus() {
  if (mode === "lineup") {
    // Frame the selected rig from the front, a little above.
    const v = views.find((w) => w.rig.id === selected);
    if (!v) return;
    const h = v.height + (v.rig.hover ?? 0);
    controls.target.set(v.feet.x, Math.max(0.5, h / 2), 0);
    const d = Math.max(2.5, h * 2.2);
    camera.position.set(v.feet.x + d * 0.35, h * 0.6 + 0.6, d);
  } else {
    controls.target.set(0, 0.8, 0);
    camera.position.set(0, 6, 10);
  }
}

// --- panel -----------------------------------------------------------------

const roster = document.querySelector<HTMLUListElement>("#roster")!;
const info = document.querySelector<HTMLElement>("#info")!;

function renderRoster() {
  roster.innerHTML = "";
  for (const rig of RIGS) {
    const li = document.createElement("li");
    li.className = rig.id === selected ? "on" : "";
    li.innerHTML = `<span>${rig.label}</span><span class="tier">${rig.tier}</span>`;
    li.onclick = () => {
      selected = rig.id;
      history.replaceState(null, "", `#${rig.id}`);
      renderRoster();
      renderInfo();
      if (mode === "roam") build();
      else focus();
    };
    roster.append(li);
  }
}

let phaseEl: HTMLElement | null = null;
function renderInfo() {
  const rig = selectedRig();
  const v = views.find((w) => w.rig.id === rig.id);
  const height = v ? v.height : rigHeight(rig) - (rig.hover ?? 0);
  info.innerHTML = `
    <h2>${rig.label} <span class="tier">${rig.tier}</span></h2>
    <p>${rig.behaviour}</p>
    <dl>
      <dt>Movement</dt><dd>${rig.movement}, now: <span class="phase"></span></dd>
      <dt>Speed</dt><dd>${rig.speed} m/s${rig.pack ? `, packs of ${rig.pack}` : ""}</dd>
      <dt>Height</dt><dd>${height.toFixed(2)} m${rig.hover ? `, floats ${rig.hover} m up` : ""}</dd>
      <dt>Parts</dt><dd>${rig.parts.map((p) => `${p.id} (${p.shape})`).join(", ")}</dd>
    </dl>`;
  phaseEl = info.querySelector(".phase");
}

for (const b of document.querySelectorAll<HTMLButtonElement>("#modes button")) {
  b.onclick = () => {
    mode = b.dataset.mode as typeof mode;
    for (const o of document.querySelectorAll("#modes button")) o.classList.toggle("on", o === b);
    build();
    renderInfo();
  };
}
const speedIn = document.querySelector<HTMLInputElement>("#speed")!;
const speedOut = document.querySelector<HTMLSpanElement>("#speedOut")!;
speedIn.oninput = () => {
  speed = Number(speedIn.value);
  speedOut.textContent = `${speed.toFixed(2)}x`;
};
const playBtn = document.querySelector<HTMLButtonElement>("#play")!;
playBtn.onclick = () => {
  playing = !playing;
  playBtn.textContent = playing ? "Pause" : "Play";
};
const smoothBtn = document.querySelector<HTMLButtonElement>("#smooth")!;
smoothBtn.onclick = () => {
  smooth = !smooth;
  smoothBtn.textContent = smooth ? "Smooth" : "Blocks";
  for (const v of views) void v.mesh(smooth);
};
const labelBtn = document.querySelector<HTMLButtonElement>("#partLabels")!;
labelBtn.onclick = () => {
  showPartLabels = !showPartLabels;
  labelBtn.classList.toggle("on", showPartLabels);
};

// --- loop ------------------------------------------------------------------

const _p = new THREE.Vector3();
function place(el: HTMLElement, world: THREE.Vector3, show: boolean) {
  _p.copy(world).project(camera);
  const visible = show && _p.z < 1 && Math.abs(_p.x) < 1.1 && Math.abs(_p.y) < 1.1;
  el.style.display = visible ? "" : "none";
  if (!visible) return;
  el.style.left = `${((_p.x + 1) / 2) * innerWidth}px`;
  el.style.top = `${((1 - _p.y) / 2) * innerHeight}px`;
}

const _c = new THREE.Vector3();
let last = performance.now();
function frame(now: number) {
  const dt = Math.min(0.1, (now - last) / 1000) * (playing ? speed : 0);
  last = now;
  t += dt;
  if (mode === "roam") {
    // The leader walks a circle around the player at its own pace; the pack
    // follows a little behind.
    const lead = views[0];
    const ground = lead ? rigMotion(lead.rig, t).ground : 0;
    roamAngle += (ground * (lead?.rig.speed ?? 0) * dt) / ROAM_RADIUS;
    views.forEach((v, i) => {
      const a = roamAngle - i * 0.18;
      const r = ROAM_RADIUS + (i % 2 ? 0.5 : -0.5) * Math.min(i, 1);
      v.feet.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      v.yaw = -a; // facing along the circle
    });
  }
  for (const v of views) {
    v.update(t);
    place(v.label, _c.set(v.feet.x, v.height + (v.rig.hover ?? 0) + 0.25, v.feet.z), mode === "lineup");
    for (const [id, l] of v.partLabels) {
      const p = v.rig.parts.find((q) => q.id === id)!;
      _c.set(p.size[0] / 2, p.size[1] / 2, p.size[2] / 2).multiplyScalar(v.rig.voxelSize).applyMatrix4(v.pose.get(id)!);
      place(l, _c, showPartLabels && v.rig.id === selected);
    }
  }
  const sel = views.find((v) => v.rig.id === selected);
  if (phaseEl) phaseEl.textContent = sel ? sel.phase : "";
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

const fromHash = location.hash.slice(1);
if (RIGS.some((r) => r.id === fromHash)) selected = fromHash;
renderRoster();
build();
renderInfo();
requestAnimationFrame(frame);
