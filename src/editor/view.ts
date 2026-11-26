import * as THREE from "three";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import hazardData from "../../data/hazards.json";
import editorData from "../../data/editor.json";
import type { Level, Prim, Sky, Vec3 } from "../level/format";
import { primGeometry, primMatrix } from "../level/prim-geometry";
import { SURFACES, surfaceTexture, worldUVs } from "../render/surfaces";
import { material, materialId } from "../voxel/materials";
import { ENTRY_KINDS, GRID, ROTATE_STEP } from "./doc";
import { EditorCamera, openCameraSpot } from "./camera";
import { faceCentre, type Resizable } from "./resize";
import { EXIT_ID, START_ID, markerFor, type Marker } from "./markers";
import { buildLights, sceneLights, type BuiltLights } from "../level/lights";
import { isUpright, yawOf } from "./group-transform";

// ED-02 stage 2: everything the editor draws and the camera that flies over
// it. The page (src/editor/main.ts) owns the document and the panels; this
// module owns the Three.js scene, the prim meshes, the sky and the
// transform handles, and turns a click into a world point.

export type TransformMode = "translate" | "rotate" | "scale";

interface Look {
  color: string;
  opacity: number;
  glow: number;
}

const HAZARD_LOOKS = (hazardData as { looks: Record<string, Look> }).looks;
const DEG = Math.PI / 180;
/** ED-37: the axis a thing that stands upright turns about. */
const UP = new THREE.Vector3(0, 1, 0);

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
  const spec = prim.surface ? SURFACES[prim.surface] : undefined;
  const map = spec && prim.surface !== "plain" ? surfaceTexture(prim.surface!) : null;
  return new THREE.MeshStandardMaterial({
    color: prim.colour,
    roughness: 0.85,
    transparent: hidden,
    opacity: hidden ? 0.3 : 1,
    ...(map ? { map } : {}),
  });
}

/** ED-36: the geometry for a prim, with world-scaled UVs at the surface's
 *  scale, so the texture tiles like the game's. A plain prim builds exactly
 *  as before. */
export function primGeometryWithSurface(prim: Prim): THREE.BufferGeometry {
  let geo = primGeometry(prim);
  const spec = prim.surface ? SURFACES[prim.surface] : undefined;
  if (!spec || prim.surface === "plain") return geo;
  geo.deleteAttribute("uv");
  geo = worldUVs(geo, primMatrix(prim), spec.scale);
  return geo;
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
  private outlineBox = new THREE.Box3();
  private outline: THREE.Box3Helper;
  /** ED-08: one box round each thing a selected trigger names. */
  private linked = new THREE.Group();
  /** id -> the mesh drawn for it, for selection and the transform handles. */
  private meshes = new Map<string, THREE.Mesh>();
  /** ED-05: the group every placed thing's marker lives in, and what the
   *  handles read back from one (its position, rotation and size). */
  private markers = new THREE.Group();
  private markerData = new Map<string, Marker>();
  /** The proxy the handles move; its position, rotation and scale are read
   *  back into the prims when the drag ends. */
  private proxy = new THREE.Object3D();
  /** The selected meshes and markers, and where each one and the proxy were
   *  when a drag began, so they follow the drag live (`follow`). */
  private selectedObjects: THREE.Object3D[] = [];
  private followStart: {
    proxy: THREE.Object3D;
    /** ED-37: the middle of the selection's bounds, which a group turns and
     *  scales about. */
    pivot: THREE.Vector3;
    objects: { pos: THREE.Vector3; quat: THREE.Quaternion; scale: THREE.Vector3 }[];
  } | null = null;
  /** ED-37: true when the selection holds a thing that stands upright, so
   *  the rotate handle turns about Y only. */
  private yawOnly = false;
  /** The see-through copy of what the armed tool will place. */
  private ghost = new THREE.Group();
  /** ED-14: six handles, one on each face of the one selected box, shown in
   *  scale mode in place of the three.js scale handle. */
  private faces = new THREE.Group();
  private faceTarget: { id: string; size: Vec3 } | null = null;
  private raycaster = new THREE.Raycaster();
  /** The camera's mouse and fly controls (src/editor/camera.ts). */
  readonly nav: EditorCamera;
  private clock = new THREE.Clock();
  private shownLevel: Level | null = null;
  /** ED-08 stage 5: when on, prims that start hidden are not drawn at all, so
   *  the level can be looked at the way it begins. They stay in the level and
   *  reappear when it is turned off. */
  private skippingHidden = false;
  private shownShell: unknown = null;
  private shownSky: unknown = null;
  private shownPieces: unknown = null;
  /** ED-32: the real lights the level has, rebuilt with the markers. The
   *  editor has no shadows, so the preset passed is the low one. */
  private realLights: BuiltLights | null = null;

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

    this.scene.add(this.shell);
    this.scene.add(this.prims);
    this.scene.add(this.markers);
    this.outline = new THREE.Box3Helper(this.outlineBox, 0xffd23f);
    this.outline.visible = false;
    this.scene.add(this.outline);
    this.scene.add(this.linked);

    this.proxy.add(new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial({ visible: false }),
    ));
    this.scene.add(this.proxy);
    this.scene.add(this.ghost);
    const AXIS_COLOURS = [0xff5a5a, 0x7dff5a, 0x5a9bff];
    for (const axis of [0, 1, 2] as const) {
      for (const side of [1, -1] as const) {
        const handle = new THREE.Mesh(
          new THREE.BoxGeometry(1, 1, 1),
          new THREE.MeshBasicMaterial({ color: AXIS_COLOURS[axis], depthTest: false, transparent: true }),
        );
        handle.renderOrder = 10;
        handle.userData.face = { axis, side };
        this.faces.add(handle);
      }
    }
    this.faces.visible = false;
    this.scene.add(this.faces);

    this.controls = new TransformControls(this.camera, canvas);
    this.controls.setTranslationSnap(GRID);
    this.controls.setRotationSnap(ROTATE_STEP * DEG);
    this.controls.setScaleSnap(GRID);
    this.controls.setSize(editorData.camera.handleSize);
    this.controls.enabled = false;
    this.scene.add(this.controls.getHelper());
    // Review fix: the click that ends a handle drag must not reselect what
    // is under the cursor, and the browser's click comes after the drag
    // has already ended.
    this.controls.addEventListener("dragging-changed", (e) => {
      if (e.value) this.beginFollow();
      else this.dragEndedAt = performance.now();
    });
    // The selection moves with the handles while they are dragged, not only
    // when the drag ends.
    this.controls.addEventListener("objectChange", () => this.follow());

    this.nav = new EditorCamera(this.camera, canvas, (x, y) => this.pick(x, y)?.point ?? null);

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

  /** ED-30 item 3: ids that the pick passes through (a locked thing). The
   *  page hands the set over each redraw; the pick unions it with its own
   *  skip parameter. */
  private lockedSkip = new Set<string>();

  setLocked(ids: Set<string>) {
    this.lockedSkip = new Set(ids);
  }


  /** Draws the level as it is now. The shell and the sky are rebuilt only
   *  when they changed (the editor does not edit them yet, and a typed
   *  number should not rebuild the level), the prims on every change. */
  show(level: Level) {
    this.shownLevel = level;
    if (level.shell !== this.shownShell || (level.pieces ?? null) !== this.shownPieces) {
      this.shownShell = level.shell;
      this.shownPieces = level.pieces ?? null;
      for (const child of [...this.shell.children]) {
        this.shell.remove(child);
        disposeTree(child);
      }
      this.shell.add(shellMesh(level));
    }
    if (level.sky !== this.shownSky) {
      this.shownSky = level.sky;
      if (this.sky) {
        this.scene.remove(this.sky);
        disposeTree(this.sky);
      }
      this.sky = skyMesh(level.sky);
      this.scene.add(this.sky);
    }
    this.refreshPrims(level);
    this.refreshMarkers(level);
    this.refreshLights(level);
  }

  /** ED-32: draws the level's own lights and lighting, live, from the
   *  level as it is now. The scene's ambient and sun are reset to the
   *  editor's own defaults first, then the level's lighting replaces them. */
  private refreshLights(level: Level) {
    const { ambient, sun } = sceneLights(this.scene);
    if (ambient) {
      ambient.color.set("#fff0e0");
      ambient.intensity = 1.2;
    }
    if (sun) {
      sun.color.set("#ffffff");
      sun.intensity = 2;
      sun.position.set(6, 12, 4);
    }
    this.realLights?.dispose();
    this.realLights = buildLights(this.scene, level, {
      pixelRatioMax: 1, antialias: false, shadows: false,
      shadowMapMax: 512, debrisMax: 60, breakoffMaxPieces: 8,
    });
  }

  /** ED-05: rebuilds the markers for every kind of placed thing, the player
   *  start and the exit. They are cheap boxes and capsules, so they are
   *  rebuilt with the prims on every change, which keeps the view honest
   *  after an undo. */
  refreshMarkers(level: Level) {
    for (const child of [...this.markers.children]) {
      this.markers.remove(child);
      disposeTree(child);
    }
    this.markerData.clear();
    for (const kind of ENTRY_KINDS) {
      // A prim has its own mesh, and a trigger (ED-08) is logic with nothing
      // in the world to draw: neither gets a marker.
      if (kind === "prims" || kind === "triggers") continue;
      const list = (level[kind] ?? []) as { id: string }[];
      for (const entry of list) {
        this.addMarker(entry.id, markerFor(kind as Marker["kind"], entry as never));
      }
    }
    this.addMarker(START_ID, markerFor("start", level.playerStart));
    this.addMarker(EXIT_ID, markerFor("exit", level.exit));
  }

  private addMarker(id: string, marker: Marker) {
    marker.object.userData.id = id;
    marker.object.traverse((child) => { child.userData.id = id; });
    this.markers.add(marker.object);
    this.markerData.set(id, marker);
  }

  /** The marker data for an id, or null when it is not one the view draws. */
  markerOf(id: string): Marker | null {
    return this.markerData.get(id) ?? null;
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

  /** ED-36: rebuilds one prim's mesh (a paint changed its surface and colour). */
  refreshOne(prim: Prim) {
    const old = this.meshes.get(prim.id);
    if (old) {
      this.prims.remove(old);
      disposeTree(old);
      this.meshes.delete(prim.id);
    }
    this.addPrim(prim);
  }

  private addPrim(prim: Prim) {
    const geo = primGeometryWithSurface(prim);
    const mesh = new THREE.Mesh(geo, primMaterial(prim));
    // Review fix: position and rotation, not a fixed matrix. The handles
    // and the link outline read the mesh's own position, which a fixed
    // matrix left at the origin (the handles sat in the middle of the
    // floor and a drag started from there).
    primMatrix(prim).decompose(mesh.position, mesh.quaternion, mesh.scale);
    mesh.userData.id = prim.id;
    mesh.visible = !(this.skippingHidden && prim.hidden === true);
    this.prims.add(mesh);
    this.meshes.set(prim.id, mesh);
  }

  /** ED-08 stage 5: draws, or stops drawing, the prims that start hidden. Off
   *  is the default, when they are drawn see-through so a blocker can be seen
   *  and clicked while the fight it belongs to is being built. */
  setSkipHidden(on: boolean) {
    this.skippingHidden = on;
    for (const prim of this.shownLevel?.prims ?? []) {
      const mesh = this.meshes.get(prim.id);
      if (mesh && prim.hidden === true) mesh.visible = !on;
    }
  }

  get skipHidden(): boolean {
    return this.skippingHidden;
  }

  /** Draws the selection outline and puts the handles on the last prim
   *  picked, which is the one they edit. */
  select(ids: string[], mode: TransformMode) {
    const objects = ids.map((id) => this.meshes.get(id) ?? this.markerData.get(id)?.object)
      .filter((m): m is THREE.Object3D => !!m);
    this.selectedObjects = objects;
    this.followStart = null;
    if (!objects.length) {
      this.outline.visible = false;
      this.controls.enabled = false;
      this.controls.detach();
      return;
    }
    this.outlineBox.makeEmpty();
    for (const m of objects) this.outlineBox.expandByObject(m);
    this.outline.box = this.outlineBox;
    this.outline.visible = true;
    // The proxy sits on the last selected thing: its position and rotation,
    // and a scale equal to the thing's size, so the scale handles change
    // `size` and the mesh is never squashed. A marker without a size (a
    // Foamer, a pickup) keeps a unit scale, so its handles cannot resize it.
    const last = objects[objects.length - 1]!;
    const id = last.userData.id as string;
    const marker = this.markerData.get(id) ?? null;
    const prim = (this.shownLevel?.prims ?? []).find((p) => p.id === id);
    if (objects.length >= 2) {
      // ED-37: the handles of a group sit on the middle of its bounds, the
      // point it turns and scales about, and start unrotated: only the
      // drag's change of rotation is used.
      this.outlineBox.getCenter(this.proxy.position);
      this.proxy.quaternion.identity();
    } else {
      this.proxy.position.copy(last.position);
      this.proxy.quaternion.copy(last.quaternion);
    }
    const size: Vec3 = marker ? marker.size ?? [1, 1, 1] : prim ? prim.size : [1, 1, 1];
    this.proxy.scale.set(size[0], size[1], size[2]);
    const isStart = marker?.kind === "start";
    // ED-30 item 11: the player start turns by Y only (marquee turns are a
    // Foamer's), so in rotate mode the X and Z rings are hidden and only the
    // Y one is left.
    const rotateOnlyY = isStart && mode === "rotate";
    this.controls.setMode(marker && !marker.size && !isStart && objects.length === 1 ? "translate" : mode);
    if (rotateOnlyY) {
      this.controls.showX = false;
      this.controls.showZ = false;
      this.controls.showXY = false;
      this.controls.showXZ = false;
      this.controls.showYZ = false;
    } else {
      this.controls.showX = true;
      this.controls.showY = true;
      this.controls.showZ = true;
      this.controls.showXY = true;
      this.controls.showXZ = true;
      this.controls.showYZ = true;
    }
    // ED-30 item 3: a locked thing is drawn, but it is drawn without handles.
    this.controls.attach(this.proxy);
    const locked = this.lockedSkip.has(id);
    this.controls.enabled = !locked;
    if (locked) {
      this.controls.detach();
      this.controls.enabled = false;
    }
    // ED-14: one box in scale mode gets a handle on each face, which moves
    // that face alone. The three.js scale handle grows a box from its
    // centre, and stays for a selection of several things.
    const sized = marker ? marker.size : prim ? prim.size : null;
    // ED-37: a selection holding a Foamer, a door, a prop or the start turns
    // about Y only: those stand upright.
    this.yawOnly = ids.some((id) => isUpright(this.markerData.get(id)?.kind ?? ""));
    this.applyTurnAxes();
    this.faces.visible = false;
    this.faceTarget = null;
    if (mode === "scale" && objects.length === 1 && sized && !locked) {
      this.controls.detach();
      this.controls.enabled = false;
      this.faceTarget = { id, size: [sized[0], sized[1], sized[2]] };
      this.placeFaces({ pos: [last.position.x, last.position.y, last.position.z], size: sized, rot: this.proxyState().rot });
      this.faces.visible = true;
    }
  }

  /** ED-14: puts the six face handles on a box. */
  private placeFaces(box: Resizable) {
    for (const handle of this.faces.children) {
      const { axis, side } = handle.userData.face as { axis: 0 | 1 | 2; side: 1 | -1 };
      handle.position.set(...faceCentre(box, axis, side));
    }
  }

  /** ED-14: the face handle under the cursor, or null. */
  pickFace(ndcX: number, ndcY: number): { axis: 0 | 1 | 2; side: 1 | -1 } | null {
    if (!this.faces.visible) return null;
    this.scaleFaces();
    this.faces.updateMatrixWorld(true);
    this.raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera);
    const hit = this.raycaster.intersectObjects(this.faces.children, false)[0];
    return hit ? (hit.object.userData.face as { axis: 0 | 1 | 2; side: 1 | -1 }) : null;
  }

  /** ED-14: how far along a line in the world the cursor is: the point on
   *  the line (from `origin` along `dir`, a unit vector) nearest the ray
   *  under the cursor, in metres from `origin`. */
  axisTravel(ndcX: number, ndcY: number, origin: THREE.Vector3, dir: THREE.Vector3): number {
    this.raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera);
    const ray = this.raycaster.ray;
    const w = origin.clone().sub(ray.origin);
    const b = dir.dot(ray.direction);
    const d = dir.dot(w);
    const e = ray.direction.dot(w);
    const denom = 1 - b * b;
    // The cursor's ray runs along the line: there is no one nearest point.
    if (denom < 1e-6) return 0;
    return (b * e - d) / denom;
  }

  /** ED-14: shows a face drag as it goes, before it is written to the
   *  level: the box at its new place and size, with its handles. */
  previewResize(box: Resizable) {
    const target = this.faceTarget;
    if (!target) return;
    const mesh = this.meshes.get(target.id);
    const prim = (this.shownLevel?.prims ?? []).find((p) => p.id === target.id);
    if (mesh && prim) {
      mesh.geometry.dispose();
      mesh.geometry = primGeometry({ ...prim, size: box.size });
      mesh.position.set(...box.pos);
    } else {
      const object = this.markerData.get(target.id)?.object;
      if (object) {
        object.position.set(...box.pos);
        object.scale.set(box.size[0] / target.size[0], box.size[1] / target.size[1], box.size[2] / target.size[2]);
      }
    }
    this.placeFaces(box);
    this.outlineBox.makeEmpty();
    for (const o of this.selectedObjects) this.outlineBox.expandByObject(o);
  }

  /** ED-14: keeps the face handles the same size on the screen. */
  private scaleFaces() {
    for (const handle of this.faces.children) {
      const s = Math.max(0.05, handle.position.distanceTo(this.camera.position) * editorData.camera.faceHandleSize);
      handle.scale.setScalar(s);
    }
  }

  /** ED-08 stage 3: a box round each thing a selected trigger names, so what
   *  it acts on can be seen. A trigger is not in the world and has no box of
   *  its own, and these boxes carry no handles: they are for looking, not for
   *  dragging. Ids the view does not draw (a spawn action's tag) are skipped. */
  showLinked(ids: string[]) {
    for (const child of [...this.linked.children]) {
      this.linked.remove(child);
      disposeTree(child);
    }
    for (const id of new Set(ids)) {
      const object = this.meshes.get(id) ?? this.markerData.get(id)?.object;
      if (!object || object.visible === false) continue;
      const box = new THREE.Box3().expandByObject(object);
      this.linked.add(new THREE.Box3Helper(box, new THREE.Color(editorData.markers.linkedColour)));
    }
  }

  /** Sets the transform mode and moves the handles if something is selected. */
  setMode(mode: TransformMode) {
    this.controls.setMode(mode);
    this.applyTurnAxes();
  }

  /** ED-37: in rotate mode with a yaw only thing selected, only the Y ring
   *  is drawn, so a group cannot be tipped over. */
  private applyTurnAxes() {
    const lock = this.yawOnly && this.controls.mode === "rotate";
    this.controls.showX = !lock;
    this.controls.showZ = !lock;
    this.controls.showY = true;
  }

  get mode(): TransformMode {
    return this.controls.mode as TransformMode;
  }

  /** ED-30 item 12: degrees the rotate handle snaps to (0 = off for the
   *  handle, the grid and size snap are unaffected). G still turns every
   *  snap off and on. */
  private rotationSnapDeg = ROTATE_STEP;

  setRotationSnap(deg: number) {
    this.rotationSnapDeg = deg;
    this.applyRotationSnap();
  }

  private applyRotationSnap() {
    this.controls.setRotationSnap(this.snapOn && this.rotationSnapDeg > 0 ? this.rotationSnapDeg * DEG : null);
  }

  private snapOn = true;

  /** Grid snap on or off (G). */
  setSnap(on: boolean) {
    this.snapOn = on;
    this.controls.setTranslationSnap(on ? GRID : null);
    this.controls.setScaleSnap(on ? GRID : null);
    this.applyRotationSnap();
  }

  /** The proxy's position, rotation in degrees and scale, for the page to
   *  turn into a change when a drag ends. */
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
      const object = this.meshes.get(id) ?? this.markerData.get(id)?.object;
      if (object) box.expandByObject(object);
    }
    if (box.isEmpty()) return;
    const centre = box.getCenter(new THREE.Vector3());
    const radius = Math.max(1, box.getSize(new THREE.Vector3()).length() / 2);
    const dir = new THREE.Vector3(0.6, 0.5, 0.6).normalize();
    this.camera.position.copy(centre).addScaledVector(dir, radius * 2.6);
    this.camera.lookAt(centre);
  }

  /** ED-13: where every thing that can be selected is on the screen, in
   *  page pixels, for box select. Things that are not drawn (hidden with
   *  the eye, or starting hidden while those are off) and things behind the
   *  camera are left out. */
  screenPoints(): { id: string; x: number; y: number }[] {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const out: { id: string; x: number; y: number }[] = [];
    const v = new THREE.Vector3();
    const add = (id: string, object: THREE.Object3D) => {
      if (!object.visible) return;
      object.getWorldPosition(v).project(this.camera);
      if (v.z < -1 || v.z > 1) return;
      out.push({ id, x: rect.left + ((v.x + 1) / 2) * rect.width, y: rect.top + ((1 - v.y) / 2) * rect.height });
    };
    for (const [id, mesh] of this.meshes) add(id, mesh);
    for (const [id, marker] of this.markerData) add(id, marker.object);
    return out;
  }

  /** ED-12: puts the camera behind and above the player start, looking at
   *  it, when a level opens. If a wall or a roof is between the two, the
   *  camera comes in to just short of it, so it never opens inside or
   *  behind geometry. Call after `show`. */
  openOn(start: { pos: Vec3; yaw: number }) {
    const spot = openCameraSpot(start);
    const target = new THREE.Vector3(...spot.target);
    target.y += 1; // about chest height, not the feet on the floor
    const to = new THREE.Vector3(...spot.pos).sub(target);
    const far = to.length();
    const dir = to.clone().normalize();
    this.scene.updateMatrixWorld();
    this.raycaster.set(target, dir);
    this.raycaster.far = far;
    const hit = this.raycaster.intersectObjects([...this.prims.children, ...this.shell.children], false)
      .find((h) => h.object.visible);
    this.raycaster.far = Infinity;
    const distance = hit ? Math.max(1, hit.distance - 0.5) : far;
    this.camera.position.copy(target).addScaledVector(dir, distance);
    this.camera.lookAt(target);
  }

  /** ED-09: where the camera is, dropped to the floor under it, for Shift+P.
   *  The floor is the first prim or shell straight down from the camera, or
   *  the ground plane at y = 0 when there is nothing under it. The yaw is the
   *  camera's own, so the run begins facing the way the editor was looking. */
  cameraSpot(): { pos: Vec3; yaw: number } {
    const from = this.camera.position.clone();
    this.raycaster.set(from, new THREE.Vector3(0, -1, 0));
    const targets: THREE.Object3D[] = [...this.prims.children, ...this.shell.children];
    const hits = this.raycaster.intersectObjects(targets, false);
    const hit = hits.find((h) => this.meshes.get(h.object.userData.id as string)?.visible !== false);
    const y = hit ? hit.point.y : 0;
    const euler = new THREE.Euler().setFromQuaternion(this.camera.quaternion, "YXZ");
    return { pos: [from.x, y, from.z], yaw: euler.y };
  }

  /** Where a click on the canvas lands on the world: the first prim or the
   *  shell under the cursor, else the ground plane at y = 0. */
  pick(ndcX: number, ndcY: number, skip?: Set<string>): { point: THREE.Vector3; normal: THREE.Vector3; id: string | null } | null {
    // Meshes rebuilt by a change since the last frame have no world matrix
    // yet, so a pick before the next render would see them at the origin.
    this.scene.updateMatrixWorld();
    // The skip set is what a caller already passes (a selected thing, a
    // box select); locked ids are added to it so a locked thing passes
    // through a pick.
    const skipAll = new Set([...this.lockedSkip, ...(skip ?? [])]);
    this.raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera);
    const targets: THREE.Object3D[] = [...this.prims.children, ...this.shell.children];
    const hits = this.raycaster.intersectObjects(targets, false);
    const hit = hits.find((h) => {
      const id = h.object.userData.id as string | undefined;
      if (id && skipAll.has(id)) return false;
      return this.meshes.get(id ?? "")?.visible !== false;
    });
    // ED-05: a marker is picked in front of the level behind it. A marker is
    // a group or a mesh, so the walk is recursive; its root carries the id.
    // A caller passing a skip set means the markers are not in play at all
    // (a drag sliding over the selection), as before the locks.
    const markerHit = (skip && skip.size)
      ? undefined
      : this.raycaster.intersectObjects([...this.markers.children], true).find((h) => {
        for (let node: THREE.Object3D | null = h.object; node; node = node.parent) {
          if (node.parent === this.markers) {
            const id = node.userData.id as string | undefined;
            if (id && this.lockedSkip.has(id)) return false;
            return true;
          }
        }
        return false;
      });
    if (markerHit) {
      let node: THREE.Object3D | null = markerHit.object;
      while (node && node.parent !== this.markers) node = node.parent;
      const normal = markerHit.face
        ? markerHit.face.normal.clone().transformDirection(markerHit.object.matrixWorld)
        : new THREE.Vector3(0, 1, 0);
      return { point: markerHit.point.clone(), normal, id: (node?.userData.id as string) ?? null };
    }
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

  /** Notes where the selection and the proxy are, at the start of a drag of
   *  the handles or of the things themselves. */
  beginFollow() {
    const copy = new THREE.Object3D();
    copy.position.copy(this.proxy.position);
    copy.quaternion.copy(this.proxy.quaternion);
    copy.scale.copy(this.proxy.scale);
    const pivot = this.outlineBox.isEmpty() ? this.proxy.position.clone() : this.outlineBox.getCenter(new THREE.Vector3());
    this.followStart = {
      proxy: copy,
      pivot,
      objects: this.selectedObjects.map((o) => ({ pos: o.position.clone(), quat: o.quaternion.clone(), scale: o.scale.clone() })),
    };
  }

  /** Moves, turns or stretches the selected meshes by what the proxy has
   *  done since `beginFollow`. The document changes when the drag ends; this
   *  is only what is drawn meanwhile. */
  follow() {
    const start = this.followStart;
    if (!start) return;
    const move = this.proxy.position.clone().sub(start.proxy.position);
    const turn = this.proxy.quaternion.clone().multiply(start.proxy.quaternion.clone().invert());
    const ratio = new THREE.Vector3(
      this.proxy.scale.x / (start.proxy.scale.x || 1),
      this.proxy.scale.y / (start.proxy.scale.y || 1),
      this.proxy.scale.z / (start.proxy.scale.z || 1),
    );
    if (this.selectedObjects.length >= 2) {
      // ED-37: two or more things turn and scale as one object about the
      // middle of their bounds, and the scale is one number.
      const s = (ratio.x + ratio.y + ratio.z) / 3;
      this.selectedObjects.forEach((o, i) => {
        const from = start.objects[i]!;
        o.position.copy(from.pos).sub(start.pivot).multiplyScalar(s).applyQuaternion(turn).add(start.pivot).add(move);
        o.quaternion.copy(turn).multiply(from.quat);
        o.scale.copy(from.scale).multiplyScalar(s);
        // A thing that stands upright is drawn upright at every step: only
        // its yaw turns, as its document patch does when the drag ends.
        if (isUpright(this.markerData.get(o.userData.id as string)?.kind ?? "")) {
          o.quaternion.setFromAxisAngle(UP, yawOf(o.quaternion));
        }
      });
    } else {
      this.selectedObjects.forEach((o, i) => {
        const from = start.objects[i]!;
        o.position.copy(from.pos).add(move);
        o.quaternion.copy(turn).multiply(from.quat);
        o.scale.copy(from.scale).multiply(ratio);
      });
    }
    this.outlineBox.makeEmpty();
    for (const o of this.selectedObjects) this.outlineBox.expandByObject(o);
  }

  /** The box round the selection as drawn now. */
  selectionBox(): THREE.Box3 {
    return this.outlineBox.clone();
  }

  /** The handles' proxy position, for a drag of the things themselves. */
  get proxyPosition(): THREE.Vector3 {
    return this.proxy.position;
  }

  /** The proxy's rotation, for a drag worked out as one quaternion rather
   *  than three Euler angles. */
  proxyQuaternion(): THREE.Quaternion {
    return this.proxy.quaternion.clone();
  }

  /** Puts the proxy (and so the selection, through `follow`) at a point. */
  moveProxyTo(point: THREE.Vector3) {
    this.proxy.position.copy(point);
    this.follow();
  }

  /** True when the cursor is over one of the handles, so a press there is
   *  the handles' and not a drag of the thing or a pick. In move mode only
   *  an arrow counts: the centre and plane squares sit over the thing, and
   *  a drag of the thing itself does their job. */
  get overHandle(): boolean {
    const axis = this.controls.axis;
    if (!this.controls.enabled || axis === null) return false;
    return this.controls.mode !== "translate" || axis.length === 1;
  }

  /** Keeps the handles from taking a press the page is using for its own
   *  drag, then gives them back. */
  holdHandles(on: boolean) {
    this.controls.enabled = !on && this.controls.object !== undefined;
  }

  /** ED-37: the middle of an armed asset's own bounds, before it is moved,
   *  the point `[` and `]` turn it about and the point it is placed about. */
  private ghostCentre = new THREE.Vector3();
  /** Where the ghost is placed, or null while it is hidden. */
  private ghostMove: THREE.Vector3 | null = null;

  /** Shows a see-through copy of what the armed tool will place, or nothing. */
  setGhost(object: THREE.Object3D | null) {
    for (const child of [...this.ghost.children]) {
      this.ghost.remove(child);
      disposeTree(child);
    }
    this.ghost.position.set(0, 0, 0);
    this.ghost.quaternion.identity();
    this.ghostMove = null;
    this.ghost.visible = true;
    if (!object) return;
    object.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.material) return;
      const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of list) {
        m.transparent = true;
        m.opacity = Math.min(m.opacity, 0.45);
        m.depthWrite = false;
      }
    });
    this.ghost.add(object);
    this.ghostCentre.copy(new THREE.Box3().setFromObject(this.ghost).getCenter(new THREE.Vector3()));
  }

  /** ED-23: moves the ghost as a whole, or hides it (`null`). An asset's
   *  ghost is many things, so it is built once and moved, not rebuilt. */
  ghostAt(move: Vec3 | null) {
    this.ghost.visible = !!move;
    this.ghostMove = move ? new THREE.Vector3(move[0], move[1], move[2]) : null;
    this.placeGhost();
  }

  /** ED-37: turns the armed asset's ghost about the middle of its own bounds,
   *  so it is placed the way it is shown. */
  turnGhost(deg: number) {
    this.ghost.quaternion.setFromAxisAngle(UP, deg * DEG);
    this.placeGhost();
  }

  /** ED-37: the middle of the armed asset's bounds, which the page turns the
   *  placed things about. */
  ghostCentrePoint(): Vec3 {
    return [this.ghostCentre.x, this.ghostCentre.y, this.ghostCentre.z];
  }

  /** Puts the ghost where the cursor is with its turn applied about its own
   *  middle: P + move + R (p - P) for the whole ghost. */
  private placeGhost() {
    if (!this.ghostMove) return;
    const turned = this.ghostCentre.clone().applyQuaternion(this.ghost.quaternion);
    this.ghost.position.copy(this.ghostMove).add(this.ghostCentre).sub(turned);
  }

  /** ED-23: a small square picture of just these things, as a JPEG data:
   *  URL, or "" when none of them is drawn. It is drawn on the view's own
   *  canvas and the real view is drawn again at once, so nothing shows. */
  picture(ids: string[], pixels: number): string {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1b1430);
    scene.add(new THREE.HemisphereLight(0xfff0e0, 0x3a2a60, 1.2));
    const sun = new THREE.DirectionalLight(0xffffff, 2);
    sun.position.set(6, 12, 4);
    scene.add(sun);
    for (const id of ids) {
      const object = this.meshes.get(id) ?? this.markerData.get(id)?.object;
      if (!object) continue;
      // A copy shares the geometry and the materials, so there is nothing
      // of its own to dispose.
      const copy = object.clone();
      copy.visible = true;
      scene.add(copy);
    }
    if (scene.children.length <= 2) return "";
    const ball = new THREE.Box3().setFromObject(scene).getBoundingSphere(new THREE.Sphere());
    const canvas = this.renderer.domElement;
    const lens = 35;
    const camera = new THREE.PerspectiveCamera(lens, canvas.width / canvas.height, 0.05, 2000);
    // Fit the ball in the shorter side of the canvas, seen from a corner.
    const half = (lens / 2) * DEG;
    const narrow = Math.min(half, Math.atan(Math.tan(half) * camera.aspect));
    const back = Math.max(ball.radius, 0.25) / Math.sin(narrow);
    camera.position.copy(ball.center).add(new THREE.Vector3(1, 0.8, 1).normalize().multiplyScalar(back));
    camera.lookAt(ball.center);
    this.renderer.render(scene, camera);
    const out = document.createElement("canvas");
    out.width = pixels;
    out.height = pixels;
    const side = Math.min(canvas.width, canvas.height);
    out.getContext("2d")?.drawImage(
      canvas, (canvas.width - side) / 2, (canvas.height - side) / 2, side, side, 0, 0, pixels, pixels,
    );
    this.renderer.render(this.scene, this.camera);
    return out.toDataURL("image/jpeg", 0.8);
  }

  /** A mesh for a prim that is not in the level, for the ghost. */
  primObject(prim: Prim): THREE.Object3D {
    const mesh = new THREE.Mesh(primGeometryWithSurface(prim), primMaterial(prim));
    primMatrix(prim).decompose(mesh.position, mesh.quaternion, mesh.scale);
    return mesh;
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
    return this.controls.dragging || performance.now() - this.dragEndedAt < 250;
  }
  private dragEndedAt = -Infinity;

  get isLooking(): boolean {
    return this.nav.looking;
  }

  /** ED-11: false while a playtest covers the view, so the editor does not
   *  draw frames nobody sees under the running game. */
  running = true;

  private tick() {
    if (!this.running) {
      this.clock.getDelta();
      return;
    }
    this.nav.update(Math.min(0.05, this.clock.getDelta()));
    if (this.sky) this.sky.position.copy(this.camera.position);
    if (this.faces.visible) this.scaleFaces();
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
