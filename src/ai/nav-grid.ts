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
  /** Ground height per cell (NaN where the bake found none). */
  readonly ground: Float32Array;
  /** 1 where an agent of the given size can stand. */
  readonly walkable: Uint8Array;
  /** Bumped by every bake and rebake: an agent re-paths when it changes. */
  version = 0;

  private readonly ray: RAPIER.Ray;
  private readonly shape: RAPIER.Shape;
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
  private readonly pz: Float32Array;
  /** The surfaces one bake ray meets, reused so a bake allocates nothing. */
  private readonly hits: { y: number; ny: number }[] = [];
  /** The stand-able surfaces of the cell being baked, lowest first. */
  private readonly cand: number[] = [];
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
    this.ray = new rapier.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 });
    const r = NAV.agentRadiusMetres;
    const h = NAV.agentHeightMetres;
    this.shape = new rapier.Capsule(h / 2 - r, r);
    this.g = new Float32Array(n);
    this.parent = new Int32Array(n);
    this.openStamp = new Int32Array(n);
    this.doneStamp = new Int32Array(n);
    this.heapCell = new Int32Array(n);
    this.heapKey = new Float32Array(n);
    this.heapPos = new Int32Array(n).fill(-1);
    this.cells = new Int32Array(n);
    this.px = new Float32Array(n + 2);
    this.pz = new Float32Array(n + 2);
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

  /** 1 if an agent can stand in the cell under (x, z). */
  walkableAt(x: number, z: number): boolean {
    const i = this.cellAt(x, z);
    return i >= 0 && this.walkable[i] === 1;
  }

  /** Ground height under (x, z), or NaN if the bake found none. */
  groundAt(x: number, z: number): number {
    const i = this.cellAt(x, z);
    return i < 0 ? NaN : this.ground[i]!;
  }

  /**
   * A path from `from` to `to` into `out` (reusing its arrays), returning the
   * waypoint count; 0 means no path. A* on 8-connected cells with no corner
   * cutting and a step-up limit between neighbours, then string pulled to the
   * fewest waypoints. An unwalkable goal paths to the nearest walkable cell.
   */
  findPath(from: Point2, to: Point2, out: PathPoints): number {
    out.count = 0;
    let start = this.cellAt(from.x, from.z);
    if (start < 0) return 0;
    // An agent pressed against a wall stands in a cell the bake calls
    // unwalkable (its own radius reaches the wall). Path from the nearest
    // walkable cell instead, or it would stand still for ever: the first
    // waypoint back is the cell it is already standing beside.
    if (this.walkable[start] !== 1) {
      const near = this.nearestWalkable(start, this.ground[start]!);
      if (near < 0) return 0;
      start = near;
    }
    const goalCell = this.cellAt(to.x, to.z);
    if (goalCell < 0) return 0;
    if (this.walkable[goalCell] === 1) {
      // Straight line: the common case, and a single segment once pulled.
      if (this.lineClear(from.x, from.z, to.x, to.z)) {
        out.xs[0] = from.x;
        out.zs[0] = from.z;
        out.xs[1] = to.x;
        out.zs[1] = to.z;
        out.count = 2;
        return 2;
      }
      if (start === goalCell) {
        out.xs[0] = from.x;
        out.zs[0] = from.z;
        out.count = 1;
        return 1;
      }
      const n = this.astar(start, goalCell, -1);
      if (n > 0) return this.pull(from, to, n, out);
      // Unreachable (or no walkable cell at all): fall back to the reachable
      // cell closest to the goal.
    }
    const n = this.astar(start, goalCell, this.cellAt(to.x, to.z));
    if (n === 0) return 0;
    const last = this.cells[n - 1]!;
    return this.pull(from, this.cellCentre(last), n, out);
  }

  // ---- bake -------------------------------------------------------------

  /** Bake one cell: find every surface the downward ray meets, then take the
   *  lowest one an agent of the given size fits on as the cell's ground.
   *
   *  One ray hit is not enough (BUG-01). The Pit's ring hangs 3 m over pit
   *  floor a player can walk on, and the first hit from above is the ring's
   *  top: the floor under it baked 4 m up, so a Foamer sent at a player
   *  standing underneath walked off to the ramp and stood there. Taking the
   *  lowest surface an agent fits on puts the cell at the player's floor. A
   *  wall is not an overhang: the floor beside and under it leaves the shape
   *  no room, so those cells still bake as the wall's top, as before. */
  private bakeCell(i: number) {
    const x = this.minX + ((i % this.cols) + 0.5) * this.cell;
    const z = this.minZ + (Math.floor(i / this.cols) + 0.5) * this.cell;
    const hits = this.hits;
    hits.length = 0;
    this.ray.origin = { x, y: NAV.topMetres, z };
    this.world.intersectionsWithRay(
      this.ray, this.rayLength, true,
      (hit) => {
        hits.push({ y: NAV.topMetres - hit.timeOfImpact, ny: hit.normal.y });
        return true;
      },
      SKIP, SOLID_QUERY_GROUPS,
    );
    if (hits.length === 0) {
      this.ground[i] = NaN;
      this.walkable[i] = 0;
      return;
    }
    // The surfaces an agent could stand on, lowest first: a slope steeper than
    // maxSlope is not one (its normal tips away from up), but it is skipped
    // rather than ending the cell, because the floor under a steep face is
    // still floor. Rapier promises no order.
    const cand = this.cand;
    cand.length = 0;
    for (const h of hits) if (h.ny >= this.cosMaxSlope) cand.push(h.y);
    cand.sort((a, b) => a - b);
    for (let k = 0; k < cand.length; k++) {
      const y0 = cand[k]!;
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
      const y = y0 + NAV.maxStepMetres + NAV.agentHeightMetres / 2;
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
      this.ground[i] = y0;
      this.walkable[i] = 1;
      return;
    }
    // Nothing the agent fits on down the ray: keep the highest up-facing
    // surface so the cell still reads a height (a wall's top), unwalkable.
    this.ground[i] = cand.length === 0 ? hits[0]!.y : cand[cand.length - 1]!;
    this.walkable[i] = 0;
  }
  // ---- grid helpers -----------------------------------------------------

  /** Index of the cell holding (x, z), or -1 outside the grid. */
  private cellAt(x: number, z: number): number {
    const c = Math.floor((x - this.minX) / this.cell);
    const r = Math.floor((z - this.minZ) / this.cell);
    if (c < 0 || c >= this.cols || r < 0 || r >= this.rows) return -1;
    return r * this.cols + c;
  }

  /** The walkable cell nearest `cell` within a few cells of it, or -1.
   *  Nearest by cell centre distance, searched in rings so a wall beside the
   *  agent does not win over free floor a cell further out, and only cells on
   *  the agent's own level (`nearGround`, +/- maxStep): a cell on top of the
   *  wall it is leaning against is not a step it can take. */
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
          if (this.walkable[i] !== 1) continue;
          if (Math.abs(this.ground[i]! - nearGround) > NAV.maxStepMetres) continue;
          const d = (c - cx) ** 2 + (r - cz) ** 2;
          if (d < bestD) {
            bestD = d;
            best = i;
          }
        }
      }
      if (best >= 0) return best;
    }
    return -1;
  }

  /** Whether a step between two cells is walkable: both stand-able, and a
   *  ground change no taller than maxStep. */
  private stepOk(a: number, b: number): boolean {
    if (this.walkable[b] !== 1) return false;
    const d = this.ground[b]! - this.ground[a]!;
    return d <= NAV.maxStepMetres && d >= -NAV.maxStepMetres;
  }

  /** Grid line of sight: every cell the segment crosses is walkable, and the
   *  ground never steps more than maxStep between samples. */
  private lineClear(ax: number, az: number, bx: number, bz: number): boolean {
    const dx = bx - ax;
    const dz = bz - az;
    const dist = Math.hypot(dx, dz);
    const steps = Math.ceil(dist / (this.cell * 0.5));
    let prev = -1;
    for (let s = 0; s <= steps; s++) {
      const t = steps === 0 ? 0 : s / steps;
      const c = this.cellAt(ax + dx * t, az + dz * t);
      if (c < 0 || this.walkable[c] !== 1) return false;
      if (prev >= 0 && Math.abs(this.ground[c]! - this.ground[prev]!) > NAV.maxStepMetres) {
        return false;
      }
      prev = c;
    }
    return true;
  }

  // ---- A* ---------------------------------------------------------------

  /**
   * Fill `this.cells` with a cell path from start and return its length, or 0
   * if nothing was reached. With `best >= 0` the search may end anywhere and
   * the path stops at the cell closest to `best`: the fallback for a goal that
   * is unwalkable or walled off. With `best < 0` it must reach `goal` exactly.
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
    this.heapSet(start, this.heuristic(start, goal));
    let bestCell = start;
    let bestD = this.heuristic(start, goal);
    while (this.heapSize > 0) {
      if (best < 0 && this.heapKey[0]! >= Infinity) break;
      const cur = this.pop();
      if (this.doneStamp[cur] === gen) continue;
      this.doneStamp[cur] = gen;
      if (cur === goal) return this.trace(cur);
      if (best >= 0) {
        const d = this.heuristic(cur, best);
        if (d < bestD) {
          bestD = d;
          bestCell = cur;
        }
      }
      const cx = cur % this.cols;
      const cz = Math.floor(cur / this.cols);
      const gc = this.g[cur]!;
      for (let k = 0; k < 8; k++) {
        const nx = cx + DX[k]!;
        const nz = cz + DZ[k]!;
        if (nx < 0 || nx >= this.cols || nz < 0 || nz >= this.rows) continue;
        const nb = nz * this.cols + nx;
        if (this.doneStamp[nb] === gen || !this.stepOk(cur, nb)) continue;
        if (DIAG[k]) {
          // No corner cutting: both cells the diagonal squeezes past.
          if (!this.stepOk(cur, cz * this.cols + nx)) continue;
          if (!this.stepOk(cur, nz * this.cols + cx)) continue;
        }
        const tentative = gc + (DIAG[k] ? this.cell * Math.SQRT2 : this.cell);
        if (this.openStamp[nb] === gen && tentative >= this.g[nb]!) continue;
        this.g[nb] = tentative;
        this.parent[nb] = cur;
        this.openStamp[nb] = gen;
        this.heapSet(nb, tentative + this.heuristic(nb, goal));
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

  /** Octile distance in metres, the 8-connected heuristic (never overestimates
   *  because diagonals cost what they do). */
  private heuristic(a: number, b: number): number {
    const dx = Math.abs((a % this.cols) - (b % this.cols));
    const dz = Math.abs(Math.floor(a / this.cols) - Math.floor(b / this.cols));
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

  /** String pull the cell path to the fewest waypoints, then write it to out. */
  private pull(from: Point2, to: Point2, n: number, out: PathPoints): number {
    const px = this.px;
    const pz = this.pz;
    for (let i = 0; i < n; i++) {
      const c = this.cells[i]!;
      px[i] = this.minX + ((c % this.cols) + 0.5) * this.cell;
      pz[i] = this.minZ + (Math.floor(c / this.cols) + 0.5) * this.cell;
    }
    // The agent goes to the exact points asked for, not the cell centres.
    px[0] = from.x;
    pz[0] = from.z;
    px[n - 1] = to.x;
    pz[n - 1] = to.z;
    const cap = out.xs.length;
    let count = 0;
    out.xs[count] = px[0]!;
    out.zs[count] = pz[0]!;
    count++;
    let i = 0;
    while (i < n - 1 && count < cap) {
      let j = i + 1;
      while (j + 1 < n && this.lineClear(px[i]!, pz[i]!, px[j + 1]!, pz[j + 1]!)) j++;
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
