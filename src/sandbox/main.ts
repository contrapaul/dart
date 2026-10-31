import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { createRenderer } from "../render/scene";
import { voxelFoamMaterial } from "../render/foam-material";
import { MesherPool } from "../voxel/mesher-pool";
import { VoxelVolume, chunkCoords, CHUNK_SIZE } from "../voxel/chunk";
import { buildPadded } from "../voxel/mesher";
import { buildPartVolume, rigHeight, solvePose, type RigMotion, type RigSpec } from "../foamers/rig";
import { rigMotion } from "../foamers/rig-motion";
import { material as voxelMaterial, materialId } from "../voxel/materials";
import { Burst } from "./burst";
import rigData from "../../data/foamer-rigs.json";

// Foamer sandbox (sandbox.html): every greybox rig from data/foamer-rigs.json
// meshed with the game's own voxel, smoothing and foam code, moving with its
// movement style. Lineup shows them side by side next to the player's
// height; Roam lets one walk a loop. For discussing shape and movement
// before limb damage (ENG-10).
//
// Damage preview (design/CONTENT-PLAN.md section 3.2): click a Foamer to
// shoot it. Wounds carve the foam and show its core colour, a limb that
// loses enough foam falls off, enough damage (or losing the head and an
// arm) makes it go down, and only a catastrophic killing hit pops it into
// chunks. This is a look-and-feel preview; the game's rules are ENG-10.

const RIGS = rigData.rigs as unknown as (RigSpec & { health: number })[];
const ROAM_RADIUS = 4;

/** The three test weapons: voxel carve radius, damage, and a blast pops. */
const WEAPONS = {
  dart: { radius: 2.2, damage: 1, blast: false },
  heavy: { radius: 4, damage: 5, blast: false },
  blast: { radius: 6, damage: 30, blast: true },
} as const;
type WeaponId = keyof typeof WEAPONS;
/** A killing hit this big (fraction of max health) pops instead of downing. */
const CATASTROPHIC = 0.4;
/** A limb falls off when it has lost this much of its foam... */
const LIMB_BREAK = 0.4;
/** ...or when its own health runs out: this share of the Foamer's health. */
const PART_SHARE: Record<string, number> = { head: 0.3, arm: 0.2, leg: 0.25, weapon: 0.25, ability: 0.25, fin: 0.15, detail: 0.15 };
/** Damage multiplier by part kind: head double, limbs and gear half. */
const KIND_DAMAGE: Record<string, number> = { body: 1, head: 2 };
const CORE = materialId("foam-core");

const ease = (x: number) => x * x * (3 - 2 * x);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

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
const burst = new Burst(scene);
const _color = new THREE.Color();

/** A broken-off part and its children, falling as one piece. */
interface Loose {
  ids: string[];
  /** Each part's world matrix when it broke off. */
  base: Map<string, THREE.Matrix4>;
  centre: THREE.Vector3;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  rot: THREE.Quaternion;
  spin: THREE.Vector3;
  age: number;
}

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
  smooth = true;
  health: number;
  state: "alive" | "down" | "popped" | "gone" = "alive";
  /** Seconds since it went down or popped. */
  deadT = 0;
  private volumes = new Map<string, VoxelVolume>();
  private startCount = new Map<string, number>();
  private partHp = new Map<string, number>();
  private loose: Loose[] = [];
  private lost = new Set<string>();
  private lastMotion: RigMotion | null = null;
  private fizz: { at: THREE.Vector3; until: number }[] = [];
  private clock = 0;

  constructor(readonly rig: RigSpec & { health: number }, readonly timeOffset = 0) {
    this.health = rig.health;
    for (const p of rig.parts) {
      const v = new VoxelVolume(rig.voxelSize);
      buildPartVolume(v, p, rig.material);
      this.volumes.set(p.id, v);
      this.startCount.set(p.id, voxelCount(v));
      this.partHp.set(p.id, Math.max(2, Math.round(rig.health * (PART_SHARE[p.kind] ?? 1))));
      const g = new THREE.Group();
      g.matrixAutoUpdate = false;
      g.userData = { view: this, part: p.id };
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
    this.smooth = smooth;
    await Promise.all([...this.volumes.keys()].map((id) => this.meshPart(id)));
  }

  /** (Re)mesh one part after its voxels changed. */
  async meshPart(id: string) {
    const smooth = this.smooth;
    {
      const volume = this.volumes.get(id)!;
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

  /** Pose at time t (seconds of animation); dt drives the damage effects. */
  update(t: number, dt: number) {
    this.clock += dt;
    let ground = 0;
    if (this.state === "alive") {
      const f = rigMotion(this.rig, t + this.timeOffset);
      this.phase = f.phase;
      this.lastMotion = f.motion;
      solvePose(this.rig, this.feet, this.yaw, f.motion, this.pose);
      ground = f.ground;
    } else if (this.state === "down") {
      this.deadT += dt;
      this.poseDown();
    } else {
      this.deadT += dt;
    }
    const s = this.rig.voxelSize;
    for (const [id, g] of this.parts) if (!this.lost.has(id)) g.matrix.copy(this.pose.get(id)!).scale(_scale.set(s, s, s));
    this.updateLoose(dt);
    this.updateFizz(dt);
    return ground;
  }

  /** Is this part one this view still holds (not broken off)? */
  attached(id: string) {
    return !this.lost.has(id);
  }

  /** A hit on one part at a voxel position in that part's box. */
  hit(id: string, at: THREE.Vector3, weapon: WeaponId) {
    if (this.state !== "alive") return;
    const w = WEAPONS[weapon];
    const part = this.rig.parts.find((p) => p.id === id)!;
    this.carve(id, at, w.radius);
    const damage = w.damage * (KIND_DAMAGE[part.kind] ?? 0.5);
    this.health -= damage;
    this.partHp.set(id, this.partHp.get(id)! - w.damage);
    // Foam fizzes out of the wound for a moment.
    this.fizz.push({ at: at.clone().multiplyScalar(this.rig.voxelSize).applyMatrix4(this.pose.get(id)!), until: this.clock + 0.6 });
    if (this.health <= 0) {
      if (w.blast && damage >= this.rig.health * CATASTROPHIC) this.pop(at.clone().multiplyScalar(this.rig.voxelSize).applyMatrix4(this.pose.get(id)!));
      else this.goDown();
      return;
    }
    if (part.kind !== "body" && (this.partHp.get(id)! <= 0 || voxelCount(this.volumes.get(id)!) < this.startCount.get(id)! * (1 - LIMB_BREAK)))
      this.breakOff(id);
    // The head and an arm gone: it goes down whatever its health.
    const gone = (kind: string) => this.rig.parts.some((p) => p.kind === kind && this.lost.has(p.id));
    if (gone("head") && gone("arm")) this.goDown();
  }

  /** Remove foam in a ball and paint the foam around it in the core colour. */
  private carve(id: string, c: THREE.Vector3, r: number) {
    const v = this.volumes.get(id)!;
    const size = this.rig.parts.find((p) => p.id === id)!.size;
    const R = r + 1;
    for (let z = Math.max(0, Math.floor(c.z - R)); z <= Math.min(size[2] - 1, Math.ceil(c.z + R)); z++)
      for (let y = Math.max(0, Math.floor(c.y - R)); y <= Math.min(size[1] - 1, Math.ceil(c.y + R)); y++)
        for (let x = Math.max(0, Math.floor(c.x - R)); x <= Math.min(size[0] - 1, Math.ceil(c.x + R)); x++) {
          const d2 = (x + 0.5 - c.x) ** 2 + (y + 0.5 - c.y) ** 2 + (z + 0.5 - c.z) ** 2;
          if (d2 <= r * r) v.set(x, y, z, 0);
          else if (d2 <= R * R && v.get(x, y, z) !== 0) v.set(x, y, z, CORE);
        }
    void this.meshPart(id);
  }

  /** A part (and everything on it) breaks off and falls; both sides of the
   *  break show a foam stump. */
  breakOff(id: string) {
    const part = this.rig.parts.find((p) => p.id === id)!;
    if (part.parent === null || this.lost.has(id)) return;
    const parent = this.rig.parts.find((p) => p.id === part.parent)!;
    const stump = Math.min(5, Math.max(1.5, Math.min(part.size[0], part.size[2]) / 2));
    const joint = boxVoxel(parent.size, part.at ?? [0, 0, 0]);
    this.carve(parent.id, joint, stump * 0.5);
    this.carve(id, boxVoxel(part.size, part.pivot ?? [0, 1, 0]), 1);
    this.fizz.push({ at: joint.clone().multiplyScalar(this.rig.voxelSize).applyMatrix4(this.pose.get(parent.id)!), until: this.clock + 1.5 });
    // Collect the part and its children.
    const ids = [id];
    for (let i = 0; i < ids.length; i++) for (const p of this.rig.parts) if (p.parent === ids[i]) ids.push(p.id);
    const base = new Map<string, THREE.Matrix4>();
    const centre = new THREE.Vector3();
    for (const q of ids) {
      this.lost.add(q);
      base.set(q, this.parts.get(q)!.matrix.clone());
      const p = this.rig.parts.find((x) => x.id === q)!;
      centre.add(_v.set(p.size[0] / 2, p.size[1] / 2, p.size[2] / 2).applyMatrix4(this.parts.get(q)!.matrix));
    }
    centre.divideScalar(ids.length);
    const body = _v2.setFromMatrixPosition(this.pose.get(this.rig.parts[0].id)!);
    const out = centre.clone().sub(body).setY(0).normalize();
    this.loose.push({
      ids, base, centre,
      pos: new THREE.Vector3(),
      vel: out.multiplyScalar(1.5 + Math.random()).setY(2 + Math.random() * 1.5),
      rot: new THREE.Quaternion(),
      spin: new THREE.Vector3().randomDirection().multiplyScalar(5),
      age: 0,
    });
  }

  goDown() {
    if (this.state !== "alive") return;
    this.state = "down";
    this.deadT = 0;
    this.phase = "down";
  }

  /** Catastrophic: every attached part bursts into chunks, blown out from `from`. */
  pop(from: THREE.Vector3) {
    if (this.state === "popped" || this.state === "gone") return;
    this.state = "popped";
    this.deadT = 0;
    this.phase = "POP";
    const vs = this.rig.voxelSize;
    const C = 3; // chunk edge in voxels (15 cm)
    for (const p of this.rig.parts) {
      if (this.lost.has(p.id)) continue;
      const v = this.volumes.get(p.id)!;
      const m = this.pose.get(p.id)!;
      for (let z = 0; z < p.size[2]; z += C)
        for (let y = 0; y < p.size[1]; y += C)
          for (let x = 0; x < p.size[0]; x += C) {
            // The chunk's most common material; chunks from deep inside show the core.
            const counts = new Map<number, number>();
            let solid = 0;
            for (let k = 0; k < C; k++) for (let j = 0; j < C; j++) for (let i = 0; i < C; i++) {
              const id = v.get(x + i, y + j, z + k);
              if (id) { solid++; counts.set(id, (counts.get(id) ?? 0) + 1); }
            }
            if (solid < 6) continue;
            const mat = solid === C * C * C ? CORE : [...counts].sort((a, b) => b[1] - a[1])[0][0];
            const pos = new THREE.Vector3(x + C / 2, y + C / 2, z + C / 2).multiplyScalar(vs).applyMatrix4(m);
            const vel = pos.clone().sub(from).normalize().multiplyScalar(2 + Math.random() * 3);
            vel.y += 1.5 + Math.random() * 1.5;
            burst.add({ pos, vel, color: _color.setHex(voxelMaterial(mat)!.color).clone(), size: C * vs * 0.95, gravity: 9.8, life: 3.5 + Math.random() * 1.5 });
          }
      this.parts.get(p.id)!.visible = false;
    }
  }

  /** The downed pose: topple (forward on two legs, onto its side on four or
   *  none), limbs go limp, rest on the floor, fizz, then sink away. */
  private poseDown() {
    const k = ease(clamp01(this.deadT / 0.7));
    const bounce = this.deadT > 0.7 ? Math.max(0, Math.sin((this.deadT - 0.7) * 9) * Math.exp(-(this.deadT - 0.7) * 6)) * 0.08 : 0;
    const biped = this.rig.parts.some((p) => p.id === "legL");
    const from = this.lastMotion;
    const m: RigMotion = {
      y: 0,
      pitch: (from?.pitch ?? 0) * (1 - k) + (biped ? 1.35 : 0.15) * k,
      roll: (from?.roll ?? 0) * (1 - k) + (biped ? 0.15 : 1.25) * k,
      rot: new Map(),
      squash: 1,
    };
    for (const p of this.rig.parts) {
      const was = from?.rot.get(p.id) ?? [0, 0, 0];
      const side = p.id.endsWith("L") ? -1 : p.id.endsWith("R") ? 1 : 0;
      const limp: [number, number, number] =
        p.kind === "arm" ? [0.4, 0, side * 0.7]
        : p.kind === "leg" ? [-0.25, 0, side * 0.2]
        : p.kind === "head" ? [0.5, 0, 0.3]
        : [0, 0, 0];
      m.rot.set(p.id, [was[0] * (1 - k) + limp[0] * k, was[1] * (1 - k) + limp[1] * k, was[2] * (1 - k) + limp[2] * k]);
    }
    // Put the lowest attached point on the floor.
    solvePose(this.rig, this.feet, this.yaw, m, this.pose);
    let low = Infinity;
    for (const p of this.rig.parts) {
      if (this.lost.has(p.id)) continue;
      const mat = this.pose.get(p.id)!;
      for (const cx of [0.2, 0.8]) for (const cy of [0.2, 0.8]) for (const cz of [0.2, 0.8]) {
        _v.set(cx * p.size[0], cy * p.size[1], cz * p.size[2]).multiplyScalar(this.rig.voxelSize).applyMatrix4(mat);
        low = Math.min(low, _v.y);
      }
    }
    const sink = Math.max(0, this.deadT - 3.5) * 0.35;
    m.y = -low * k + bounce - sink;
    solvePose(this.rig, this.feet, this.yaw, m, this.pose);
    if (this.deadT > 0.5 && this.deadT < 3.5 && Math.random() < 0.5) {
      const p = this.rig.parts[Math.floor(Math.random() * this.rig.parts.length)];
      if (!this.lost.has(p.id)) this.fizz.push({ at: _v.set(Math.random() * p.size[0], Math.random() * p.size[1], Math.random() * p.size[2]).multiplyScalar(this.rig.voxelSize).applyMatrix4(this.pose.get(p.id)!).clone(), until: this.clock });
    }
    if (sink > this.height + 0.5) this.state = "gone";
  }

  private updateLoose(dt: number) {
    const s = this.rig.voxelSize;
    for (const l of this.loose) {
      l.age += dt;
      const settled = l.vel.lengthSq() < 0.01 && l.age > 1;
      if (!settled) {
        l.vel.y -= 9.8 * dt;
        l.pos.addScaledVector(l.vel, dt);
        l.rot.premultiply(_q.setFromEuler(_e.set(l.spin.x * dt, l.spin.y * dt, l.spin.z * dt)));
      }
      const sink = Math.max(0, l.age - 4) * 0.25;
      // Transform: rotate about the piece's centre, then move.
      _t.makeTranslation(l.centre.x + l.pos.x, l.centre.y + l.pos.y, l.centre.z + l.pos.z)
        .multiply(_r.makeRotationFromQuaternion(l.rot))
        .multiply(_m.makeTranslation(-l.centre.x, -l.centre.y, -l.centre.z));
      // Bounce off the floor using the lowest box corner.
      let low = Infinity;
      for (const id of l.ids) {
        const p = this.rig.parts.find((x) => x.id === id)!;
        const g = this.parts.get(id)!;
        g.matrix.copy(_t).multiply(l.base.get(id)!);
        for (const cx of [0.15, 0.85]) for (const cy of [0.15, 0.85]) for (const cz of [0.15, 0.85]) {
          _v.set(cx * p.size[0], cy * p.size[1], cz * p.size[2]).applyMatrix4(g.matrix);
          low = Math.min(low, _v.y);
        }
      }
      if (low < -sink && !settled) {
        l.pos.y += -sink - low;
        l.vel.y = Math.abs(l.vel.y) * 0.3;
        l.vel.x *= 0.6;
        l.vel.z *= 0.6;
        l.spin.multiplyScalar(0.5);
        if (Math.abs(l.vel.y) < 0.4) l.vel.set(0, 0, 0);
      } else if (settled) {
        l.pos.y -= 0.25 * dt * (l.age > 4 ? 1 : 0);
      }
      for (const id of l.ids) this.parts.get(id)!.visible = l.age < 7;
    }
    void s;
  }

  private updateFizz(dt: number) {
    this.fizz = this.fizz.filter((f) => {
      if (Math.random() < dt * 40)
        burst.add({
          pos: f.at.clone().add(_v.randomDirection().multiplyScalar(0.05)),
          vel: _v2.randomDirection().multiplyScalar(0.25).setY(0.3 + Math.random() * 0.3),
          color: _color.setHex(voxelMaterial(Math.random() < 0.5 ? CORE : materialId("foam-white"))!.color).clone(),
          size: 0.03 + Math.random() * 0.04,
          gravity: 0.5,
          life: 0.5 + Math.random() * 0.5,
        });
      return this.clock < f.until;
    });
  }

  dispose() {
    this.state = "gone";
    scene.remove(this.root);
    for (const g of this.parts.values())
      for (const m of g.children) (m as THREE.Mesh).geometry.dispose();
    this.label.remove();
    for (const l of this.partLabels.values()) l.remove();
  }
}

const _scale = new THREE.Vector3();
const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _t = new THREE.Matrix4();
const _r = new THREE.Matrix4();
const _m = new THREE.Matrix4();

function voxelCount(v: VoxelVolume) {
  let n = 0;
  for (const c of v.chunks.values()) n += c.count;
  return n;
}

/** A -1..1 box point as voxel coordinates. */
function boxVoxel(size: [number, number, number], at: [number, number, number]) {
  return new THREE.Vector3(((at[0] + 1) / 2) * size[0], ((at[1] + 1) / 2) * size[1], ((at[2] + 1) / 2) * size[2]);
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
let weapon: WeaponId = "dart";

function selectedRig() {
  return RIGS.find((r) => r.id === selected)!;
}

function build() {
  for (const v of views) v.dispose();
  views = [];
  burst.clear();
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
      <dt>Health</dt><dd><span class="hp"></span> of ${rig.health} (darts)</dd>
      <dt>Parts</dt><dd>${rig.parts.map((p) => `${p.id} (${p.shape})`).join(", ")}</dd>
    </dl>`;
  phaseEl = info.querySelector(".phase");
  hpEl = info.querySelector(".hp");
}
let hpEl: HTMLElement | null = null;

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
  burst.setSmooth(smooth);
  for (const v of views) void v.mesh(smooth);
};
for (const b of document.querySelectorAll<HTMLButtonElement>("#weapons button")) {
  b.onclick = () => {
    weapon = b.dataset.weapon as WeaponId;
    for (const o of document.querySelectorAll("#weapons button")) o.classList.toggle("on", o === b);
  };
}
function selectedView() {
  return views.find((v) => v.rig.id === selected && v.state === "alive");
}
document.querySelector<HTMLButtonElement>("#down")!.onclick = () => selectedView()?.goDown();
document.querySelector<HTMLButtonElement>("#pop")!.onclick = () => {
  const v = selectedView();
  if (v) v.pop(_v.copy(v.feet).setY(v.height * 0.3).add(_v2.set(0, 0, 0.6).applyAxisAngle(_v2.set(0, 1, 0), v.yaw)));
};
document.querySelector<HTMLButtonElement>("#respawn")!.onclick = () => build();
const labelBtn = document.querySelector<HTMLButtonElement>("#partLabels")!;
labelBtn.onclick = () => {
  showPartLabels = !showPartLabels;
  labelBtn.classList.toggle("on", showPartLabels);
};

// --- shooting ----------------------------------------------------------------

// A click (not a drag) on a Foamer shoots it with the chosen weapon.
const raycaster = new THREE.Raycaster();
const _ndc = new THREE.Vector2();
const _inv = new THREE.Matrix4();
let downAt: { x: number; y: number } | null = null;
canvas.addEventListener("pointerdown", (e) => (downAt = { x: e.clientX, y: e.clientY }));
canvas.addEventListener("pointerup", (e) => {
  if (!downAt || Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 5) return;
  _ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  raycaster.setFromCamera(_ndc, camera);
  const targets: THREE.Object3D[] = [];
  for (const v of views)
    if (v.state === "alive") for (const [id, g] of v.parts) if (v.attached(id)) targets.push(...g.children);
  const hit = raycaster.intersectObjects(targets, false)[0];
  if (!hit) return;
  const g = hit.object.parent!;
  const { view, part } = g.userData as { view: RigView; part: string };
  // Into the part's voxel coordinates, a little way into the surface.
  const at = hit.point.clone().addScaledVector(raycaster.ray.direction, 0.03).applyMatrix4(_inv.copy(g.matrixWorld).invert());
  view.hit(part, at, weapon);
});

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
      if (v.state !== "alive") return;
      const a = roamAngle - i * 0.18;
      const r = ROAM_RADIUS + (i % 2 ? 0.5 : -0.5) * Math.min(i, 1);
      v.feet.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      v.yaw = -a; // facing along the circle
    });
  }
  // Foamers that have gone come back after a moment.
  views.forEach((v, i) => {
    if ((v.state === "gone" || (v.state === "popped" && v.deadT > 5)) && v.deadT > 0) {
      const n = new RigView(v.rig, v.timeOffset);
      n.feet.copy(v.feet);
      n.yaw = v.yaw;
      v.dispose();
      views[i] = n;
      labelLayer.append(n.label);
      for (const l of n.partLabels.values()) labelLayer.append(l);
      void n.mesh(smooth);
    }
  });
  burst.update(dt);
  for (const v of views) {
    v.update(t, dt);
    place(v.label, _c.set(v.feet.x, v.height + (v.rig.hover ?? 0) + 0.25, v.feet.z), mode === "lineup");
    for (const [id, l] of v.partLabels) {
      const p = v.rig.parts.find((q) => q.id === id)!;
      _c.set(p.size[0] / 2, p.size[1] / 2, p.size[2] / 2).multiplyScalar(v.rig.voxelSize).applyMatrix4(v.pose.get(id)!);
      place(l, _c, showPartLabels && v.rig.id === selected);
    }
  }
  const sel = views.find((v) => v.rig.id === selected);
  if (phaseEl) phaseEl.textContent = sel ? sel.phase : "";
  if (hpEl) hpEl.textContent = sel ? String(Math.max(0, Math.round(sel.health * 10) / 10)) : "";
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

// Dev hook for reviews from the browser console.
if (import.meta.env.DEV) Object.assign(window, { __sandbox: { camera, controls, burst, get views() { return views; } } });
