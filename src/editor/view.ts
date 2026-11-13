import * as THREE from "three";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import hazardData from "../../data/hazards.json";
import type { Level, Prim, Sky, Vec3 } from "../level/format";
import { primGeometry, primMatrix } from "../level/prim-geometry";
import { material, materialId } from "../voxel/materials";
import { GRID, ROTATE_STEP } from "./doc";

// ED-02 stage 2: everything the editor draws and the camera that flies over
// it. The page (src/editor/main.ts) owns the document and the panels; this
// module owns the Three.js scene, the prim meshes, the grid, the sky and the
// transform handles, and turns a click into a world point.

export type TransformMode = "translate" | "rotate" | "scale";

interface Look {
  color: string;
  opacity: number;
  glow: number;
}

const HAZARD_LOOKS = (hazardData as { looks: Record<string, Look> }).looks;
const DEG = Math.PI / 180;

/** A gradient or image sky as a big sphere round the camera. A gradient of
 *  three stops is the parent page's default (data/editor.json `sky`); an
 *  image is a 2:1 panorama stored as a data: URL in the level. */
function skyMesh(sky: Sky | undefined): THREE.Mesh {
  const geo = new THREE.SphereGeometry(400, 32, 16);
  if (sky?.kind === "image") {
    const tex = new THREE.TextureLoader().load(sky.image);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, depthWrite: false }));
    return mesh;
  }
  // Three horizontal stops, blended by height: top, horizon (equator) and
  // bottom. No image, no fetch, so it is the default for every new level.
  const stops = sky?.kind === "gradient"
    ? sky
    : { top: "#3a6ff0", horizon: "#bfe3ff", bottom: "#3a3550" };
  const top = new THREE.Color(stops.top);
  const horizon = new THREE.Color(stops.horizon);
  const bottom = new THREE.Color(stops.bottom);
  const pos = geo.getAttribute("position");
  const colours = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const h = pos.getY(i) / 400;
    if (h >= 0) c.copy(horizon).lerp(top, Math.min(1, h));
    else c.copy(horizon).lerp(bottom, Math.min(1, -h));
    colours[i * 3] = c.r;
    colours[i * 3 + 1] = c.g;
    colours[i * 3 + 2] = c.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colours, 3));
  return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, depthWrite: false }));
}

/** The floor grid: lines every `grid` metres, a brighter line every ten. */
function gridLines(size: number, grid: number): THREE.LineSegments {
  const half = size / 2;
  const points: number[] = [];
  for (let v = -half; v <= half + 1e-6; v += grid) {
    points.push(-half, 0, v, half, 0, v, v, 0, -half, v, 0, half);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
  return new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0x3a3550 }));
}

/** A voxel material's colour by name, or the greybox colour. */
function materialColour(name: string | undefined): number {
  try {
    return material(materialId(name ?? ""))?.color ?? 0x6f6788;
  } catch {
    return 0x6f6788;
  }
}

/** The shell boxes and destructible pieces, drawn read only (the editor
 *  does not edit them here: ED-04 and ED-06 do). Pieces are voxel foam in
 *  the game, drawn here as their volumes in their material's colour. */
function shellMesh(level: Level): THREE.Group {
  const group = new THREE.Group();
  for (const box of level.shell) {
    const geo = new THREE.BoxGeometry(...box.size);
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: materialColour(box.material), roughness: 0.9 }));
    mesh.position.set(...box.pos);
    if (box.rotY) mesh.rotation.y = box.rotY * DEG;
    if (box.shape === "ramp") {
      // A ramp's slab is turned about x; drawn as the box it fills, which
      // is close enough for a read only view of the shell.
      mesh.rotation.x = -Math.atan2(box.rise ?? 0, box.size[2]);
    }
    group.add(mesh);
  }
  for (const piece of level.pieces ?? []) {
    const colour = materialColour(piece.volumes[0]?.material);
    for (const v of piece.volumes) {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(...v.size),
        new THREE.MeshStandardMaterial({ color: colour, roughness: 0.9, transparent: piece.hidden === true, opacity: piece.hidden ? 0.3 : 1 }),
      );
      mesh.position.set(...v.pos);
      group.add(mesh);
    }
  }
  return group;
}

/** The material a prim is drawn with: its colour, a hazard's look, or a
 *  ghost for one that starts hidden. */
function primMaterial(prim: Prim): THREE.Material {
  const hidden = prim.hidden === true;
  if (prim.behaviour === "hazard") {
    const look = HAZARD_LOOKS[prim.hazard?.look ?? "toxic"] ?? HAZARD_LOOKS.toxic!;
    return new THREE.MeshStandardMaterial({
      color: look.color,
      transparent: true,
      opacity: look.opacity,
      emissive: new THREE.Color(look.color),
      emissiveIntensity: look.glow,
      depthWrite: false,
    });
  }
  return new THREE.MeshStandardMaterial({
    color: prim.colour,
    roughness: 0.85,
    transparent: hidden,
    opacity: hidden ? 0.3 : 1,
  });
}

export class EditorView {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: TransformControls;
  /** The group every prim mesh lives in, for the raycast. */
  private prims = new THREE.Group();
  private shell = new THREE.Group();
  private sky: THREE.Mesh | null = null;
  private grid: THREE.LineSegments;
  private outlineBox = new THREE.Box3();
  private outline: THREE.Box3Helper;
  /** id -> the mesh drawn for it, for selection and the transform handles. */
  private meshes = new Map<string, THREE.Mesh>();
  /** The proxy the handles move; its position, rotation and scale are read
   *  back into the prims when the drag ends. */
  private proxy = new THREE.Object3D();
  private raycaster = new THREE.Raycaster();
  private keys = new Set<string>();
  private looking = false;
  private clock = new THREE.Clock();
  private shownLevel: Level | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = false;

    this.scene = new THREE.Scene();
    this.scene.fog = null;
    this.camera = new THREE.PerspectiveCamera(70, 1, 0.05, 500);
    this.camera.position.set(18, 14, 18);
    this.camera.lookAt(0, 0, 0);

    this.scene.add(new THREE.HemisphereLight(0xfff0e0, 0x3a2a60, 1.2));
    const sun = new THREE.DirectionalLight(0xffffff, 2);
    sun.position.set(6, 12, 4);
    this.scene.add(sun);

    this.grid = gridLines(128, GRID);
    this.scene.add(this.grid);
    this.scene.add(this.shell);
    this.scene.add(this.prims);
    this.outline = new THREE.Box3Helper(this.outlineBox, 0xffd23f);
    this.outline.visible = false;
    this.scene.add(this.outline);

    this.proxy.add(new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial({ visible: false }),
    ));
    this.scene.add(this.proxy);

    this.controls = new TransformControls(this.camera, canvas);
    this.controls.setTranslationSnap(GRID);
    this.controls.setRotationSnap(ROTATE_STEP * DEG);
    this.controls.setScaleSnap(GRID);
    this.controls.enabled = false;
    this.scene.add(this.controls.getHelper());

    this.resize();
    window.addEventListener("resize", () => this.resize());
    this.renderer.setAnimationLoop(() => this.tick());
  }

  private resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** Draws the level as it is now: shell, sky, every prim. Called on every
   *  document change, so it rebuilds rather than patches. */
  show(level: Level) {
    this.shownLevel = level;
    for (const child of [...this.shell.children]) {
      this.shell.remove(child);
      disposeTree(child);
    }
    this.shell.add(shellMesh(level));

    if (this.sky) {
      this.scene.remove(this.sky);
      disposeTree(this.sky);
    }
    this.sky = skyMesh(level.sky);
    this.scene.add(this.sky);

    this.refreshPrims(level);
  }

  /** Rebuilds only the prim meshes (a change to one prim does not rebuild
   *  the shell or the sky). */
  refreshPrims(level: Level) {
    this.shownLevel = level;
    for (const child of [...this.prims.children]) {
      this.prims.remove(child);
      disposeTree(child);
    }
    this.meshes.clear();
    for (const prim of level.prims ?? []) {
      this.addPrim(prim);
    }
  }

  private addPrim(prim: Prim) {
    const geo = primGeometry(prim);
    const mesh = new THREE.Mesh(geo, primMaterial(prim));
    mesh.matrixAutoUpdate = false;
    mesh.matrix.copy(primMatrix(prim));
    mesh.userData.id = prim.id;
    this.prims.add(mesh);
    this.meshes.set(prim.id, mesh);
  }

  /** Draws the selection outline and puts the handles on the last prim
   *  picked, which is the one they edit. */
  select(ids: string[], mode: TransformMode) {
    const meshes = ids.map((id) => this.meshes.get(id)).filter((m): m is THREE.Mesh => !!m);
    if (!meshes.length) {
      this.outline.visible = false;
      this.controls.enabled = false;
      this.controls.detach();
      return;
    }
    this.outlineBox.makeEmpty();
    for (const m of meshes) this.outlineBox.expandByObject(m);
    this.outline.box = this.outlineBox;
    this.outline.visible = true;
    // The proxy sits on the last selected prim: its position and rotation,
    // and a scale equal to the prim's size, so the scale handles change
    // `size` and the mesh is never squashed.
    const last = meshes[meshes.length - 1]!;
    const prim = (this.shownLevel?.prims ?? []).find((p) => p.id === last.userData.id);
    this.proxy.position.copy(last.position);
    this.proxy.quaternion.copy(last.quaternion);
    const size: Vec3 = prim ? prim.size : [1, 1, 1];
    this.proxy.scale.set(size[0], size[1], size[2]);
    this.controls.setMode(mode);
    this.controls.attach(this.proxy);
    this.controls.enabled = true;
  }

  /** Sets the transform mode and moves the handles if something is selected. */
  setMode(mode: TransformMode) {
    this.controls.setMode(mode);
  }

  get mode(): TransformMode {
    return this.controls.mode as TransformMode;
  }

  /** Grid snap on or off (G). */
  setSnap(on: boolean) {
    this.controls.setTranslationSnap(on ? GRID : null);
    this.controls.setRotationSnap(on ? ROTATE_STEP * DEG : null);
    this.controls.setScaleSnap(on ? GRID : null);
  }

  /** The proxy's position, rotation in degrees and scale, for the page to
   *  turn into a prim change when a drag ends. */
  proxyState(): { pos: Vec3; rot: Vec3; scale: Vec3 } {
    const e = new THREE.Euler().setFromQuaternion(this.proxy.quaternion, "XYZ");
    return {
      pos: [this.proxy.position.x, this.proxy.position.y, this.proxy.position.z],
      rot: [e.x / DEG, e.y / DEG, e.z / DEG],
      scale: [this.proxy.scale.x, this.proxy.scale.y, this.proxy.scale.z],
    };
  }

  /** Moves the camera to look at the selected prims from a distance that
   *  fits them (F). */
  frame(ids: string[]) {
    const box = new THREE.Box3();
    for (const id of ids) {
      const mesh = this.meshes.get(id);
      if (mesh) box.expandByObject(mesh);
    }
    if (box.isEmpty()) return;
    const centre = box.getCenter(new THREE.Vector3());
    const radius = Math.max(1, box.getSize(new THREE.Vector3()).length() / 2);
    const dir = new THREE.Vector3(0.6, 0.5, 0.6).normalize();
    this.camera.position.copy(centre).addScaledVector(dir, radius * 2.6);
    this.camera.lookAt(centre);
  }

  /** Where a click on the canvas lands on the world: the first prim or the
   *  shell under the cursor, else the grid plane at y = 0. */
  pick(ndcX: number, ndcY: number): { point: THREE.Vector3; normal: THREE.Vector3; id: string | null } | null {
    this.raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera);
    const targets: THREE.Object3D[] = [...this.prims.children, ...this.shell.children];
    const hits = this.raycaster.intersectObjects(targets, false);
    const hit = hits.find((h) => this.meshes.get(h.object.userData.id as string)?.visible !== false);
    if (hit) {
      const normal = hit.face
        ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld)
        : new THREE.Vector3(0, 1, 0);
      return { point: hit.point.clone(), normal, id: (hit.object.userData.id as string) ?? null };
    }
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const point = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(plane, point)) return null;
    return { point, normal: new THREE.Vector3(0, 1, 0), id: null };
  }

  /** True while a prim's mesh is shown (the outliner's eye state). */
  isHidden(id: string): boolean {
    return this.meshes.get(id)?.visible === false;
  }

  /** Hides a prim's mesh while editing (the outliner's eye, not saved). */
  setVisible(id: string, visible: boolean) {
    const mesh = this.meshes.get(id);
    if (mesh) mesh.visible = visible;
  }

  /** True while the handles are being dragged, so clicks do not reselect. */
  get dragging(): boolean {
    return this.controls.dragging;
  }

  get isLooking(): boolean {
    return this.looking;
  }

  setLooking(on: boolean) {
    this.looking = on;
  }

  /** The keys down for the fly camera (WASD, Q/E, Shift). */
  keyDown(code: string) {
    this.keys.add(code);
  }

  keyUp(code: string) {
    this.keys.delete(code);
  }

  clearKeys() {
    this.keys.clear();
  }

  private tick() {
    const dt = Math.min(0.05, this.clock.getDelta());
    if (this.looking) {
      const speed = (this.keys.has("ShiftLeft") || this.keys.has("ShiftRight") ? 26 : 9) * dt;
      const forward = new THREE.Vector3();
      this.camera.getWorldDirection(forward);
      const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
      const move = new THREE.Vector3();
      if (this.keys.has("KeyW")) move.add(forward);
      if (this.keys.has("KeyS")) move.sub(forward);
      if (this.keys.has("KeyD")) move.add(right);
      if (this.keys.has("KeyA")) move.sub(right);
      if (this.keys.has("KeyE")) move.y += 1;
      if (this.keys.has("KeyQ")) move.y -= 1;
      if (move.lengthSq() > 0) this.camera.position.addScaledVector(move.normalize(), speed);
    }
    if (this.sky) this.sky.position.copy(this.camera.position);
    this.grid.position.set(
      Math.round(this.camera.position.x / GRID) * GRID, 0,
      Math.round(this.camera.position.z / GRID) * GRID,
    );
    this.renderer.render(this.scene, this.camera);
  }
}

function disposeTree(node: THREE.Object3D) {
  node.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(material)) material.forEach((m) => m.dispose());
    else material?.dispose();
  });
}
