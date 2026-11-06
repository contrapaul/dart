import type RAPIER from "@dimforge/rapier3d-compat";
import type { Rapier } from "../physics/world";
import { SOLID_QUERY_GROUPS } from "../physics/world";
import aiData from "../../data/ai.json";

// Walkable grid (ENG-08 stage 2), baked from the physics world rather than
// recast-navigation: the level is destructible, carves cut cover loose every
// few seconds, and a navmesh would need re-baking around each change. A grid
// re-bakes a small rectangle instead (PLAN.md 4.3, decision in section 14).
// Everything here is plain numbers and typed arrays: no Three.js.

const NAV = aiData.nav;
/** Rays and shape casts skip sensors, and kinematic bodies (Foamers and the
 *  player: nobody steers around an agent that is steering). Pieces (dynamic)
 *  and the level (fixed) are found. */
const SKIP = 8 /* EXCLUDE_SENSORS */ | 2 /* EXCLUDE_KINEMATIC */;
/** The shape cast and rays stand the agent upright. */
const ZERO_ROT = { x: 0, y: 0, z: 0, w: 1 };

/** The rectangle of the level the grid covers (metres). */
export interface NavBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/** A point in the ground plane. */
export interface Point2 {
  x: number;
  z: number;
}

/** A path in a reusable buffer: waypoint i is (xs[i], zs[i]). Allocate one
 *  per agent and pass it back in; findPath writes into it and allocates
 *  nothing of its own. */
export interface PathPoints {
  xs: Float32Array;
  zs: Float32Array;
  count: number;
}

export function makePath(capacity = 256): PathPoints {
  return { xs: new Float32Array(capacity), zs: new Float32Array(capacity), count: 0 };
}

/** The eight neighbour offsets: four straight, then four diagonal. */
const DX = [1, -1, 0, 0, 1, 1, -1, -1];
const DZ = [0, 0, 1, -1, 1, -1, 1, -1];
const DIAG = [false, false, false, false, true, true, true, true];

export class NavGrid {
  readonly cell = NAV.cellMetres;
  readonly cols: number;
  readonly rows: number;
  readonly minX: number;
  readonly minZ: number;
  /** Ground height of layer 0 per cell (NaN where the bake found none).
   *  A cell can hold more than one walkable layer (BUG-01 round 2): the Pit's
   *  ring hangs over pit floor, and both are floor an agent stands on. Layer
   *  0 is the lowest, so a reader that ignores layers sees the pit floor. */
  readonly ground: Float32Array;
  /** 1 where an agent of the given size can stand on layer 0. */
  readonly walkable: Uint8Array;
  /** How many walkable layers the cell holds (0: none). */
  readonly layers: Uint8Array;
  /** Every layer's height, cell-major: cell * maxLayers + layer, lowest
   *  first. Only the first `layers[cell]` entries are written; the rest are
   *  -Infinity. */
  readonly layerY: Float32Array;
  /** Bumped by every bake and rebake: an agent re-paths when it changes. */
  version = 0;

  private readonly ray: RAPIER.Ray;
  private readonly shape: RAPIER.Shape;
  /** The solid-voxel test the bake checks per cell (BUG-03). Null: no
   *  pieces, so the bake is the shape cast alone, as before. */
  private solidAt: ((x: number, y: number, z: number) => boolean) | null = null;
  private readonly cosMaxSlope = Math.cos((NAV.maxSlopeDeg * Math.PI) / 180);
  private readonly rayLength = NAV.topMetres * 2;

  // A* scratch. The search stamps cells with `gen` so no buffer is cleared.
  private readonly g: Float32Array;
  private readonly parent: Int32Array;
  private readonly openStamp: Int32Array;
  private readonly doneStamp: Int32Array;
  private readonly heapCell: Int32Array;
  private readonly heapKey: Float32Array;
  private readonly heapPos: Int32Array;
  private readonly cells: Int32Array;
  private readonly px: Float32Array;
  private readonly py: Float32Array;
  private readonly pz: Float32Array;
  /** The surfaces one bake ray meets, reused so a bake allocates nothing:
   *  slots are allocated once and only their fields are written. */
  private readonly hits: { y: number; ny: number }[] = [];
  private hitCount = 0;
  /** The stand-able surfaces of the cell being baked, lowest first. */
  private readonly cand: number[] = [];
  /** The most layers one cell may hold (data/ai.json nav.maxLayers). Public
   *  because a reader indexing layerY needs the stride. */
  readonly maxLayers = NAV.maxLayers;
  /** The four straight neighbours' nodes of the cell A* is expanding (-1:
   *  none), so a diagonal's corner check reuses them. */
  private readonly straight = new Int32Array(4);
  private heapSize = 0;
  private gen = 0;

  constructor(
    rapier: Rapier,
    private readonly world: RAPIER.World,
    bounds: NavBounds,
  ) {
    this.minX = bounds.minX;
    this.minZ = bounds.minZ;
    this.cols = Math.max(1, Math.ceil((bounds.maxX - bounds.minX) / this.cell));
    this.rows = Math.max(1, Math.ceil((bounds.maxZ - bounds.minZ) / this.cell));
    const n = this.cols * this.rows;
    this.ground = new Float32Array(n).fill(NaN);
    this.walkable = new Uint8Array(n);
    this.layers = new Uint8Array(n);
    this.layerY = new Float32Array(n * this.maxLayers).fill(-Infinity);
    this.ray = new rapier.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 });
    const r = NAV.agentRadiusMetres;
    const h = NAV.agentHeightMetres;
    this.shape = new rapier.Capsule(h / 2 - r, r);
    // A* runs on nodes, not cells: node = cell * maxLayers + layer, so the
    // pit floor and the ring above it are separate places to walk (BUG-01
    // round 2). Everything indexed by node is sized for the worst case.
    const m = n * this.maxLayers;
    this.g = new Float32Array(m);
    this.parent = new Int32Array(m);
    this.openStamp = new Int32Array(m);
    this.doneStamp = new Int32Array(m);
    this.heapCell = new Int32Array(m);
    this.heapKey = new Float32Array(m);
    this.heapPos = new Int32Array(m).fill(-1);
    this.cells = new Int32Array(m);
    this.px = new Float32Array(m + 2);
    this.py = new Float32Array(m + 2);
    this.pz = new Float32Array(m + 2);
  }

  /** The cell of an A* node. */
  private nodeCell(node: number): number {
    return Math.floor(node / this.maxLayers);
  }

  /** The walkable node of `cell` a body with its feet at `y` can step to;
   *  -1 when the cell offers nothing that near (the cell is a wall, or its
   *  floors are a storey away). This is the step rule A* walks by.
   *
   *  A climb is capped at what the walk can autostep (BUG-01 round 2),
   *  `nav.stepAutostepMetres`, not the bake's maxStep. The Pit's south ramp
   *  rises half a metre per metre, so from the pit floor its east side is
   *  0.19 m tall at one cell and 0.44 m at the next: under maxStep (0.45)
   *  both were a legal step, and a Foamer sent up it walked into a side its
   *  controller could not climb and stood at the foot for ever. With the
   *  cap the tall crossing is refused and the path goes round to the foot.
   *  A drop keeps maxStep: stepping off costs nothing (snap to ground). */
  private nodeNear(cell: number, y: number): number {
    if (cell < 0) return -1;
    // Nearly every cell has one layer: no search for the nearest.
    const n = this.layers[cell]!;
    if (n === 0) return -1;
    if (n === 1) {
      const node = cell * this.maxLayers;
      const d = this.layerY[node]! - y;
      return d > NAV.stepAutostepMetres || d < -NAV.maxStepMetres ? -1 : node;
    }
    const k = this.layerAt(cell, y);
    if (k < 0 || k >= this.layers[cell]!) return -1;
    const node = cell * this.maxLayers + k;
    const d = this.layerY[node]! - y;
    // Up is what the walk can autostep; down is the bake's step (see above).
    if (d > NAV.stepAutostepMetres || d < -NAV.maxStepMetres) return -1;
    return node;
  }

  get maxX() {
    return this.minX + this.cols * this.cell;
  }
  get maxZ() {
    return this.minZ + this.rows * this.cell;
  }

  /** Bake every cell. */
  bake(): void {
    for (let i = 0; i < this.walkable.length; i++) this.bakeCell(i);
    this.version++;
  }

  /** Set the solid test (BUG-03). A cell whose bake ray puts the agent's
   *  body inside solid voxels gets no layers; a carve that empties the space
   *  passes the hook again on the carve's rebake. */
  setSolidAt(fn: ((x: number, y: number, z: number) => boolean) | null): void {
    this.solidAt = fn;
  }

  /** Bake the cells inside a world rectangle, plus one agent radius around it
   *  (a change just outside a cell is still seen from that cell's shape cast).
   *  The pages call this after a carve and when a falling piece rests. */
  rebake(minX: number, minZ: number, maxX: number, maxZ: number): void {
    const m = NAV.rebakeMarginMetres;
    const c0 = Math.max(0, Math.floor((minX - m - this.minX) / this.cell));
    const c1 = Math.min(this.cols - 1, Math.floor((maxX + m - this.minX) / this.cell));
    const r0 = Math.max(0, Math.floor((minZ - m - this.minZ) / this.cell));
    const r1 = Math.min(this.rows - 1, Math.floor((maxZ + m - this.minZ) / this.cell));
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) this.bakeCell(r * this.cols + c);
    }
    this.version++;
  }

  /** 1 if an agent can stand in the cell under (x, z), on the walkable layer
   *  nearest y (feet metres); without y, the lowest one. */
  walkableAt(x: number, z: number, y?: number): boolean {
    const i = this.cellAt(x, z);
    if (i < 0) return false;
    const k = this.layerAt(i, y);
    return k >= 0 && k < this.layers[i]!;
  }

  /** Whether an agent can stand at (x, z) with its feet at `feetY`: the
   *  cell is walkable, and its walkable floor is a step it can take
   *  (the stand's own rule up and down: an autostep up, a full step down).
   *  walkableAt and groundAt without a height would call a walkable top of
   *  the column a floor the agent would pass, and a walkable floor a storey
   *  below a stand when the surface is the agent is really on. */
  canStandAt(x: number, z: number, feetY: number): boolean {
    const i = this.cellAt(x, z);
    if (i < 0) return false;
    const k = this.layerAt(i, feetY);
    if (k < 0 || k >= this.layers[i]!) return false;
    const g = this.layerY[i * this.maxLayers + k]!;
    return g - feetY <= NAV.stepAutostepMetres && feetY - g <= NAV.maxStepMetres;
  }

  /** Ground height under (x, z), or NaN if the bake found none. With y, the
   *  height of the walkable layer nearest y (the feet of the agent asking);
   *  without it, the lowest, so a reader that does not care about layers
   *  keeps reading the pit floor under the ring. */
  groundAt(x: number, z: number, y?: number): number {
    const i = this.cellAt(x, z);
    if (i < 0) return NaN;
    if (y === undefined) return this.ground[i]!;
    const k = this.layerAt(i, y);
    return k < this.layers[i]! ? this.layerY[i * this.maxLayers + k]! : this.ground[i]!;
  }

  /** Index of the walkable layer of `cell` nearest y, or -1 when the cell has
   *  no layer (callers test < layers[cell]); with y undefined, 0, the lowest. */
  private layerAt(cell: number, y?: number): number {
    const n = this.layers[cell]!;
    if (n === 0) return -1;
    if (y === undefined || this.maxLayers === 1) return 0;
    const base = cell * this.maxLayers;
    let best = 0;
    let bestD = Math.abs(this.layerY[base]! - y);
    for (let k = 1; k < n; k++) {
      const d = Math.abs(this.layerY[base + k]! - y);
      if (d < bestD) {
        bestD = d;
        best = k;
      }
    }
    return best;
  }

  /**
   * A path from `from` to `to` into `out` (reusing its arrays), returning the
   * waypoint count; 0 means no path. A* on 8-connected cells with no corner
   * cutting and a step-up limit between neighbours, then string pulled to the
   * fewest waypoints. An unwalkable goal paths to the nearest walkable cell.
   *
   * `fromY` and `toY` are the feet heights the path starts and ends on, so a
   * level with two floors in one cell (the Pit's ring over pit floor) paths
   * on the agent's own layer; without them both ends take the lowest layer.
   */
  findPath(from: Point2, to: Point2, out: PathPoints, fromY?: number, toY?: number): number {
    out.count = 0;
    let start = this.cellAt(from.x, from.z);
    if (start < 0) return 0;
    const startY = fromY ?? this.ground[start]!;
    let startLayer = this.layerAt(start, fromY);
    // An agent pressed against a wall stands in a cell the bake calls
    // unwalkable (its own radius reaches the wall), and one standing under a
    // ledge is in a cell whose only walkable layer is above it. Path from the
    // nearest walkable layer instead, or it would stand still for ever: the
    // first waypoint back is the cell it is already standing beside.
    // The walk itself starts from a walkable point when the agent is pressed
    // into an unwalkable one, so a pulled shortcut is never measured from a
    // point inside a wall (BUG-01 round 2).
    let from2 = from;
    if (startLayer < 0 || Math.abs(this.layerY[start * this.maxLayers + startLayer]! - startY) > NAV.maxStepMetres) {
      const near = this.nearestWalkable(start, startY);
      if (near < 0) return 0;
      start = this.nodeCell(near);
      startLayer = near % this.maxLayers;
      from2 = this.cellCentre(start);
    }
    const goalCell = this.cellAt(to.x, to.z);
    if (goalCell < 0) return 0;
    const goalLayer = this.layerAt(goalCell, toY);
    const startNode = start * this.maxLayers + startLayer;
    const goalNode = goalLayer >= 0 ? goalCell * this.maxLayers + goalLayer : -1;
    if (goalNode >= 0) {
      // Straight line: the common case, and a single segment once pulled.
      if (this.lineClear(
        from2.x, from2.z, to.x, to.z, this.layerY[startNode]!, this.layerY[goalNode]!,
      )) {
        out.xs[0] = from2.x;
        out.zs[0] = from2.z;
        out.xs[1] = to.x;
        out.zs[1] = to.z;
        out.count = 2;
        return 2;
      }
      if (startNode === goalNode) {
        out.xs[0] = from2.x;
        out.zs[0] = from2.z;
        out.count = 1;
        return 1;
      }
      const n = this.astar(startNode, goalNode, -1);
      if (n > 0) return this.pull(from2, to, this.layerY[startNode]!, this.layerY[goalNode]!, n, out);
      // Unreachable (or no walkable cell at all): fall back to the reachable
      // cell closest to the goal.
    }
    // No goal node (the goal cell has no layer near the goal feet height):
    // search anywhere and stop closest to the goal cell.
    const n = this.astar(startNode, goalNode, goalCell);
    if (n === 0) return 0;
    // Stop at the end of the last cell the walk fell back to, at the height of
    // the node the search reached there.
    const last = this.cells[n - 1]!;
    return this.pull(
      from2, this.cellCentre(this.nodeCell(last)), this.layerY[startNode]!,
      this.layerY[last]!, n, out,
    );
  }

  // ---- bake -------------------------------------------------------------

  /** Bake one cell: find every surface the downward ray meets, then keep
   *  every one an agent of the given size fits on, up to maxLayers, lowest
   *  first.
   *
   *  One ray hit is not enough (BUG-01). The Pit's ring hangs 3 m over pit
   *  floor a player can walk on, and the first hit from above is the ring's
   *  top: baking only that put the floor under it 4 m up, so a Foamer sent at
   *  a player standing underneath walked off to the ramp and stood there. The
   *  fix is not "lowest wins" either (BUG-01 round 2): the ring is where the
   *  player enters the Pit, and a low-only cell sends Foamers under it. Both
   *  surfaces are floor, so a cell holds both layers and A* picks the one it
   *  walks to. A wall is not an overhang: the shape cast leaves it no room
   *  under the wall's top, so it is still not a separate layer. */
  private bakeCell(i: number) {
    const x = this.minX + ((i % this.cols) + 0.5) * this.cell;
    const z = this.minZ + (Math.floor(i / this.cols) + 0.5) * this.cell;
    const hits = this.hits;
    this.hitCount = 0;
    this.ray.origin = { x, y: NAV.topMetres, z };
    this.world.intersectionsWithRay(
      this.ray, this.rayLength, true,
      (hit) => {
        // Reuse a preallocated slot: a bake runs over every cell, and a
        // fresh object per hit per cell is garbage the frame does not need.
        const n = this.hitCount++;
        const slot = hits[n];
        const y = NAV.topMetres - hit.timeOfImpact;
        if (slot) {
          slot.y = y;
          slot.ny = hit.normal.y;
        } else {
          hits.push({ y, ny: hit.normal.y });
        }
        return true;
      },
      SKIP, SOLID_QUERY_GROUPS,
    );
    const base = i * this.maxLayers;
    this.layers[i] = 0;
    this.walkable[i] = 0;
    if (this.hitCount === 0) {
      this.ground[i] = NaN;
      return;
    }
    // The surfaces an agent could stand on, lowest first: a slope steeper than
    // maxSlope is not one (its normal tips away from up), but it is skipped
    // rather than ending the cell, because the floor under a steep face is
    // still floor. Rapier promises no order.
    const cand = this.cand;
    cand.length = 0;
    for (let h = 0; h < this.hitCount; h++) {
      const hit = hits[h]!;
      if (hit.ny >= this.cosMaxSlope) cand.push(hit.y);
    }
    cand.sort((a, b) => a - b);
    for (let k = 0; k < cand.length && this.layers[i]! < this.maxLayers; k++) {
      const y0 = cand[k]!;
      // Solid voxels: the level's pieces collide as trimeshes, so the shape
      // cast meets only their surfaces and a cell inside a block reads as
      // floor under it (BUG-03). Probe the agent's body over the surface
      // against the volume instead; a candidate the body presses into a
      // solid voxel is not a floor.
      if (this.solidAt) {
        const s = this.solidAt;
        const h = NAV.agentHeightMetres;
        const solid =
          s(x, y0 + h * 0.125, z) ||
          s(x, y0 + h * 0.45, z) ||
          s(x, y0 + h * 0.875, z);
        if (solid) continue;
      }
      // A surface swallowed by one within a step of it is not a floor of its
      // own: the floor under a 0.3 m step is the step's footprint, and the
      // agent stands on the step. An overhang is high above that (the Pit's
      // ring is 3 m up), so the floor under it stays a floor (BUG-01).
      const above = cand[k + 1];
      if (above !== undefined && above - y0 < NAV.maxStepMetres) continue;
      // The agent's shape with its feet raised by the step height, so a step
      // the character controller walks up (maxStep) does not read as a wall,
      // while the capsule's lower part still hits anything taller. Standing on
      // a slope inside maxSlope leaves the raised shape clear, because its
      // bottom is above the ground it stands on.
      // The epsilon keeps a step exactly maxStep tall clear of the shape:
      // touching counts as intersecting.
      const y = y0 + NAV.maxStepMetres + NAV.agentHeightMetres / 2 + 1e-3;
      let blocked = false;
      this.world.intersectionsWithShape(
        { x, y, z }, ZERO_ROT, this.shape,
        () => {
          blocked = true;
          return false;
        },
        SKIP, SOLID_QUERY_GROUPS,
      );
      if (blocked) continue;
      const n = this.layers[i]!;
      this.layerY[base + n] = y0;
      this.layers[i] = n + 1;
      if (n === 0) {
        this.ground[i] = y0;
        this.walkable[i] = 1;
      }
    }
    if (this.layers[i]! > 0) return;
    // Nothing the agent fits on down the ray: keep the highest up-facing
    // surface so the cell still reads a height (a wall's top), unwalkable.
    this.ground[i] = cand.length === 0 ? hits[0]!.y : cand[cand.length - 1]!;
  }
  // ---- grid helpers -----------------------------------------------------

  /** Index of the cell holding (x, z), or -1 outside the grid. */
  private cellAt(x: number, z: number): number {
    const c = Math.floor((x - this.minX) / this.cell);
    const r = Math.floor((z - this.minZ) / this.cell);
    if (c < 0 || c >= this.cols || r < 0 || r >= this.rows) return -1;
    return r * this.cols + c;
  }

  /** The walkable node nearest `cell` within a few cells of it, or -1.
   *  Nearest by cell centre distance, searched in rings so a wall beside the
   *  agent does not win over free floor a cell further out, and only nodes on
   *  the agent's own level (`nearGround`, +/- maxStep): a cell on top of the
   *  wall it is leaning against, or the ring over its head, is not a step it
   *  can take. */
  private nearestWalkable(cell: number, nearGround: number): number {
    if (cell < 0) return -1;
    const cx = cell % this.cols;
    const cz = Math.floor(cell / this.cols);
    for (let ring = 1; ring <= 4; ring++) {
      let best = -1;
      let bestD = Infinity;
      for (let r = cz - ring; r <= cz + ring; r++) {
        if (r < 0 || r >= this.rows) continue;
        for (let c = cx - ring; c <= cx + ring; c++) {
          if (c < 0 || c >= this.cols) continue;
          const i = r * this.cols + c;
          const node = this.nodeNear(i, nearGround);
          if (node < 0) continue;
          const d = (c - cx) ** 2 + (r - cz) ** 2;
          if (d < bestD) {
            bestD = d;
            best = node;
          }
        }
      }
      if (best >= 0) return best;
    }
    return -1;
  }

  /** Grid line of sight: every cell the segment crosses has a walkable layer
   *  within maxStep of the one the line walked to in the cell before, and the
   *  height never steps more than maxStep between samples. `fromY` is the
   *  height the line starts at; without it the lowest layer is taken in the
   *  first cell. With `toY` the line must also end within a step of it, so a
   *  straight walk along the pit floor cannot claim to arrive on the ring. */
  private lineClear(
    ax: number, az: number, bx: number, bz: number, fromY?: number, toY?: number,
  ): boolean {
    const dx = bx - ax;
    const dz = bz - az;
    const dist = Math.hypot(dx, dz);
    // Four samples per cell: at two, a short diagonal can slip between them
    // and cross a cell the walk cannot enter (BUG-01 round 2: the Pit's ramp
    // has one unwalkable cell at the foot of its side, and a leg crossed it
    // without ever sampling it, so the pull sent Foamers into the wall).
    const steps = Math.ceil(dist / (this.cell * 0.5));
    let h = fromY ?? NaN;
    for (let s = 0; s <= steps; s++) {
      const t = steps === 0 ? 0 : s / steps;
      const c = this.cellAt(ax + dx * t, az + dz * t);
      if (c < 0) return false;
      const node = h === h ? this.nodeNear(c, h) : c * this.maxLayers;
      if (node < 0 || node % this.maxLayers >= this.layers[c]!) return false;
      const y = this.layerY[node]!;
      // The same climb limit as a step between neighbours: a pull must not
      // shortcut up a ledge the walk cannot autostep (BUG-01 round 2).
      if (h === h && y - h > NAV.stepAutostepMetres) return false;
      h = y;
    }
    return toY === undefined || Math.abs(h - toY) <= NAV.maxStepMetres;
  }

  // ---- A* ---------------------------------------------------------------

  /**
   * Fill `this.cells` with a cell path from start and return its length, or 0
   * if nothing was reached. With `best >= 0` the search may end anywhere and
   * the path stops at the cell closest to `best`: the fallback for a goal that
   * is unwalkable or walled off, measured by `best` (a cell, whose layer the
   *  search does not care about). With `best < 0` it must reach `goal`.
   */
  private astar(start: number, goal: number, best: number): number {
    const gen = ++this.gen;
    // A search that ended early leaves cells in the heap; clear their
    // positions so the next search's heapSet does not trust a stale one.
    for (let i = 0; i < this.heapSize; i++) this.heapPos[this.heapCell[i]!] = -1;
    this.heapSize = 0;
    this.g[start] = 0;
    this.parent[start] = -1;
    this.openStamp[start] = gen;
    this.heapSet(
      start, goal >= 0 ? this.heuristic(start, goal) : this.heuristicCell(start, best),
    );
    let bestCell = start;
    let bestD = goal >= 0 ? this.heuristic(start, goal) : this.heuristicCell(start, best);
    const target = goal >= 0 ? this.nodeCell(goal) : best;
    const tx = target % this.cols;
    const tz = Math.floor(target / this.cols);
    const ty = goal >= 0 ? this.layerY[goal]! : 0;
    while (this.heapSize > 0) {
      if (best < 0 && this.heapKey[0]! >= Infinity) break;
      const cur = this.pop();
      if (this.doneStamp[cur] === gen) continue;
      this.doneStamp[cur] = gen;
      if (cur === goal) return this.trace(cur);
      if (best >= 0) {
        const d = goal >= 0 ? this.heuristic(cur, goal) : this.heuristicCell(cur, best);
        if (d < bestD) {
          bestD = d;
          bestCell = cur;
        }
      }
      const curCell = this.nodeCell(cur);
      const cx = curCell % this.cols;
      const cz = Math.floor(curCell / this.cols);
      const gc = this.g[cur]!;
      const cy = this.layerY[cur]!;
      for (let k = 0; k < 8; k++) {
        const nx = cx + DX[k]!;
        const nz = cz + DZ[k]!;
        const inside = nx >= 0 && nx < this.cols && nz >= 0 && nz < this.rows;
        const nb = inside ? this.nodeNear(nz * this.cols + nx, cy) : -1;
        if (k < 4) this.straight[k] = nb;
        if (!inside) continue;
        // nodeNear applies the step rule, so a node it returns is a legal
        // step from cur (no second check).
        if (nb < 0 || this.doneStamp[nb] === gen) continue;
        if (DIAG[k]) {
          // No corner cutting: both cells the diagonal squeezes past, at the
          // height the step lands on either side.
          // The straight neighbours came first (+x, -x, +z, -z): reuse them.
          if (this.straight[DX[k]! > 0 ? 0 : 1]! < 0) continue;
          if (this.straight[DZ[k]! > 0 ? 2 : 3]! < 0) continue;
        }
        const tentative = gc + (DIAG[k] ? this.cell * Math.SQRT2 : this.cell);
        if (this.openStamp[nb] === gen && tentative >= this.g[nb]!) continue;
        this.g[nb] = tentative;
        this.parent[nb] = cur;
        this.openStamp[nb] = gen;
        // The heuristic inline, against the target read once per search:
        // octile cells to the target, plus the height to a goal node.
        const hx = nx > tx ? nx - tx : tx - nx;
        const hz = nz > tz ? nz - tz : tz - nz;
        const lo = hx < hz ? hx : hz;
        let hcost = (lo * Math.SQRT2 + (hx + hz - 2 * lo)) * this.cell;
        if (goal >= 0) hcost += Math.abs(this.layerY[nb]! - ty);
        this.heapSet(nb, tentative + hcost);
      }
    }
    if (best < 0) return 0;
    return this.trace(bestCell);
  }

  /** The world centre of a cell. */
  private cellCentre(i: number): Point2 {
    return {
      x: this.minX + ((i % this.cols) + 0.5) * this.cell,
      z: this.minZ + (Math.floor(i / this.cols) + 0.5) * this.cell,
    };
  }

  /** Octile distance in metres between two nodes' cells, the 8-connected
   *  heuristic (never overestimates because diagonals cost what they do).
   *  Layers are a real cost too: a node a storey up is that storey further
   *  away, which keeps the search honest across the Pit's ring and floor. */
  private heuristic(a: number, b: number): number {
    return this.heuristicCell(a, this.nodeCell(b)) +
      Math.abs(this.layerY[a]! - this.layerY[b]!);
  }

  /** Octile distance in metres from a node to a cell, layer ignored: the
   *  distance part of the heuristic, and the whole of it when the search may
   *  end anywhere (a fallback goal cell has no layer to measure to). */
  private heuristicCell(node: number, cell: number): number {
    const a = this.nodeCell(node);
    const dx = Math.abs((a % this.cols) - (cell % this.cols));
    const dz = Math.abs(Math.floor(a / this.cols) - Math.floor(cell / this.cols));
    const lo = Math.min(dx, dz);
    return (lo * Math.SQRT2 + (Math.max(dx, dz) - lo)) * this.cell;
  }

  /** Walk the parent chain back into `this.cells` (start first). */
  private trace(goal: number): number {
    let n = 0;
    for (let c = goal; c >= 0; c = this.parent[c]!) this.cells[n++] = c;
    for (let i = 0, j = n - 1; i < j; i++, j--) {
      const t = this.cells[i]!;
      this.cells[i] = this.cells[j]!;
      this.cells[j] = t;
    }
    return n;
  }

  /** String pull a node path to the fewest waypoints, then write it to out.
   *  A pull shortcut has to clear the grid on the height of the node it
   *  starts from, so a straight line along the ring is not pulled through
   *  the pit floor under it. */
  private pull(
    from: Point2, to: Point2, fromY: number, toY: number, n: number, out: PathPoints,
  ): number {
    const px = this.px;
    const pz = this.pz;
    const py = this.py;
    for (let i = 0; i < n; i++) {
      const node = this.cells[i]!;
      const c = this.nodeCell(node);
      px[i] = this.minX + ((c % this.cols) + 0.5) * this.cell;
      pz[i] = this.minZ + (Math.floor(c / this.cols) + 0.5) * this.cell;
      py[i] = this.layerY[node]!;
    }
    // The agent goes to the exact points asked for, not the cell centres.
    px[0] = from.x;
    pz[0] = from.z;
    py[0] = fromY;
    px[n - 1] = to.x;
    pz[n - 1] = to.z;
    py[n - 1] = toY;
    const cap = out.xs.length;
    let count = 0;
    out.xs[count] = px[0]!;
    out.zs[count] = pz[0]!;
    count++;
    let i = 0;
    while (i < n - 1 && count < cap) {
      let j = i + 1;
      while (j + 1 < n &&
        this.lineClear(px[i]!, pz[i]!, px[j + 1]!, pz[j + 1]!, py[i]!, py[j + 1]!)) j++;
      out.xs[count] = px[j]!;
      out.zs[count] = pz[j]!;
      count++;
      i = j;
    }
    out.count = count;
    return count;
  }

  // ---- indexed binary heap on f scores --------------------------------
  // One entry per open cell (decrease-key, no duplicates), so the heap never
  // grows past one cell count however many relaxations A* makes.

  /** Add `cell` at `key`, or lower its key if it is already open. */
  private heapSet(cell: number, key: number) {
    const pos = this.heapPos[cell]!;
    if (pos >= 0) {
      if (key >= this.heapKey[pos]!) return;
      this.heapKey[pos] = key;
      this.siftUp(pos);
      this.siftDown(this.heapPos[cell]!);
      return;
    }
    let i = this.heapSize++;
    this.heapCell[i] = cell;
    this.heapKey[i] = key;
    this.heapPos[cell] = i;
    this.siftUp(i);
  }

  /** The lowest key cell, removed from the heap. */
  private pop(): number {
    const top = this.heapCell[0]!;
    this.heapPos[top] = -1;
    const last = --this.heapSize;
    if (last > 0) {
      const cell = this.heapCell[last]!;
      this.heapCell[0] = cell;
      this.heapKey[0] = this.heapKey[last]!;
      this.heapPos[cell] = 0;
      this.siftDown(0);
    }
    return top;
  }

  private siftUp(start: number) {
    const cell = this.heapCell[start]!;
    const key = this.heapKey[start]!;
    let i = start;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.heapKey[p]! <= key) break;
      this.heapCell[i] = this.heapCell[p]!;
      this.heapKey[i] = this.heapKey[p]!;
      this.heapPos[this.heapCell[i]!] = i;
      i = p;
    }
    this.heapCell[i] = cell;
    this.heapKey[i] = key;
    this.heapPos[cell] = i;
  }

  private siftDown(start: number) {
    const cell = this.heapCell[start]!;
    const key = this.heapKey[start]!;
    const n = this.heapSize;
    let i = start;
    for (;;) {
      let c = 2 * i + 1;
      if (c >= n) break;
      if (c + 1 < n && this.heapKey[c + 1]! < this.heapKey[c]!) c++;
      if (this.heapKey[c]! >= key) break;
      this.heapCell[i] = this.heapCell[c]!;
      this.heapKey[i] = this.heapKey[c]!;
      this.heapPos[this.heapCell[i]!] = i;
      i = c;
    }
    this.heapCell[i] = cell;
    this.heapKey[i] = key;
    this.heapPos[cell] = i;
  }
}
