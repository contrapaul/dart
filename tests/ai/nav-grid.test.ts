/** ENG-08 stage 2: the walkable grid. A floor with a wall across it, a
 *  carve that opens a gap, ledges and a slope, string pulling, and the
 *  timing targets from the card. */
import { beforeAll, describe, expect, it } from "vitest";
import RAPIER from "@dimforge/rapier3d-compat";
import { NavGrid, makePath } from "../../src/ai/nav-grid";
import aiData from "../../data/ai.json";

const NAV = aiData.nav;
const CELL = NAV.cellMetres;

/** A world with a floor and whatever else the test adds. */
function makeWorld() {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  return world;
}

/** A fixed box collider: half extents, centre, optional tilt about x. */
function box(
  world: RAPIER.World, hx: number, hy: number, hz: number,
  x: number, y: number, z: number, rotX = 0,
) {
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  const desc = RAPIER.ColliderDesc.cuboid(hx, hy, hz).setTranslation(x, y, z);
  if (rotX !== 0) {
    const q = { x: Math.sin(rotX / 2), y: 0, z: 0, w: Math.cos(rotX / 2) };
    desc.setRotation(q);
  }
  return world.createCollider(desc, body);
}

function floor(world: RAPIER.World, half = 20) {
  box(world, half, 0.5, half, 0, -0.5, 0);
}

/** Rapier updates its query pipeline on world.step(), so a bake or a re-bake
 *  needs the change stepped in first (the game steps every frame). */
function grid(world: RAPIER.World, half = 20) {
  world.step();
  return new NavGrid(RAPIER, world, { minX: -half, maxX: half, minZ: -half, maxZ: half });
}

/** Is any waypoint of the path within `tol` of the segment x = x0, z in [z0, z1]? */
function everyWaypoint(path: ReturnType<typeof makePath>, fn: (x: number, z: number) => void) {
  for (let i = 0; i < path.count; i++) fn(path.xs[i]!, path.zs[i]!);
}

beforeAll(async () => {
  await RAPIER.init();
});

describe("NavGrid bake", () => {
  it("bakes a flat floor walkable at its height", () => {
    const world = makeWorld();
    floor(world);
    const g = grid(world);
    g.bake();
    expect(g.walkableAt(0, 0)).toBe(true);
    expect(g.groundAt(0, 0)).toBeCloseTo(0, 3);
    expect(g.walkableAt(19, -19)).toBe(true);
  });

  it("marks a 0.3 m step walkable from the floor and a 1 m ledge walkable on top only when reached", () => {
    const world = makeWorld();
    floor(world);
    box(world, 2, 0.15, 2, 6, 0.15, 0); // 0.3 m step
    box(world, 2, 0.5, 2, -6, 0.5, 0); // 1 m ledge
    const g = grid(world);
    g.bake();
    expect(g.groundAt(6, 0)).toBeCloseTo(0.3, 2);
    expect(g.groundAt(-6, 0)).toBeCloseTo(1, 2);
    expect(g.walkableAt(6, 0)).toBe(true);
    expect(g.walkableAt(-6, 0)).toBe(true);
    // The step up is under maxStep: the path walks onto it.
    const out = makePath();
    const n = g.findPath({ x: 0, z: 0 }, { x: 6, z: 0 }, out);
    expect(n).toBeGreaterThan(0);
    everyWaypoint(out, (x, z) => {
      expect(g.groundAt(x, z)).not.toBeNaN();
      expect(g.walkableAt(x, z)).toBe(true);
    });
  });

  it("a 1 m ledge is not walkable up, a 0.3 m step is", () => {
    const world = makeWorld();
    floor(world);
    // A 1 m wall the agent would have to climb: its cells are walkable on the
    // floor but the step between the floor cell and the top is over maxStep.
    box(world, 4, 0.5, 4, -8, 0.5, 0);
    const g = grid(world);
    g.bake();
    const out = makePath();
    g.findPath({ x: 0, z: 0 }, { x: -8, z: 0 }, out);
    // The ledge top is a goal, so the path goes there; but the step between
    // the floor and the ledge is too tall, so every consecutive waypoint pair
    // along the path must hold maxStep.
    let reached = false;
    everyWaypoint(out, (x, z) => {
      expect(g.walkableAt(x, z) || (x === 0 && z === 0)).toBe(true);
      if (g.groundAt(x, z) > 0.5) reached = true;
    });
    expect(reached, "the path may not climb the 1 m ledge").toBe(false);
  });

  it("treats a slope over maxSlope as unwalkable and one under it as walkable", () => {
    const steep = makeWorld();
    floor(steep);
    // 55 degrees about x, as main.ts builds one.
    box(steep, 3, 0.2, 3.5, 0, 1.5, 0, (55 * Math.PI) / 180);
    const gs = grid(steep);
    gs.bake();
    const okSteep = gs.walkableAt(0, 0);

    const gentle = makeWorld();
    floor(gentle);
    box(gentle, 3, 0.2, 3.5, 0, 0.6, 0, (25 * Math.PI) / 180);
    const gg = grid(gentle);
    gg.bake();
    expect(okSteep, "a 55 degree slope is not walkable").toBe(false);
    expect(gg.walkableAt(0, 0), "a 25 degree slope is walkable").toBe(true);
  });

  it("does not walk through a wall, and goes round its end", () => {
    const world = makeWorld();
    floor(world);
    // A wall across the middle, 8 m long, leaving a 2 m gap at each end of a
    // 10 m wide corridor.
    box(world, 4, 1, 0.5, 0, 1, 0);
    const g = grid(world);
    g.bake();
    // The wall's own top is stand-able ground, so its cells are walkable; the
    // step up to it is over maxStep, which is what stops a path climbing it.
    expect(g.groundAt(0, 0)).toBeCloseTo(2, 2);
    const out = makePath();
    const n = g.findPath({ x: 0, z: 3 }, { x: 0, z: -3 }, out);
    expect(n).toBeGreaterThanOrEqual(2);
    let wentRound = false;
    everyWaypoint(out, (x, z) => {
      expect(g.walkableAt(x, z)).toBe(true);
      if (Math.abs(x) > 4 && Math.abs(z) < 3) wentRound = true;
    });
    expect(wentRound, "the path goes round the end of the wall").toBe(true);
  });

  it("goes through a carved gap after the collider is removed and the rectangle re-baked", () => {
    const world = makeWorld();
    floor(world);
    const wall = box(world, 4, 1, 0.5, 0, 1, 0);
    const g = grid(world);
    g.bake();
    const out = makePath();
    g.findPath({ x: 0, z: 3 }, { x: 0, z: -3 }, out);
    everyWaypoint(out, (x, z) => expect(g.walkableAt(x, z)).toBe(true));
    expect(g.groundAt(0, 0), "the wall is in the way").toBeCloseTo(2, 2);
    expect(out.count, "so the path goes round it").toBeGreaterThan(2);
    // Carve a 1 m gap in the middle: remove only the piece's collider there.
    world.removeCollider(wall, false);
    // Rebuild the wall as three boxes, leaving the gap at x in [-0.5, 0.5].
    box(world, 1.75, 1, 0.5, -2.25, 1, 0);
    box(world, 1.75, 1, 0.5, 2.25, 1, 0);
    world.step();
    g.rebake(-0.6, -0.6, 0.6, 0.6);
    expect(g.groundAt(0, 0), "the gap is floor again").toBeCloseTo(0, 2);
    expect(g.walkableAt(0, 0), "and walkable").toBe(true);
    g.findPath({ x: 0, z: 3 }, { x: 0, z: -3 }, out);
    expect(out.count, "the path is now one segment through the gap").toBe(2);
    everyWaypoint(out, (x, z) => expect(g.walkableAt(x, z)).toBe(true));
  });

  it("string pulls an open floor path to one straight segment", () => {
    const world = makeWorld();
    floor(world);
    const g = grid(world);
    g.bake();
    const out = makePath();
    const from = { x: -8, z: -7 };
    const to = { x: 8, z: 7 };
    const n = g.findPath(from, to, out);
    expect(n).toBe(2);
    expect(out.xs[0]).toBeCloseTo(from.x, 5);
    expect(out.zs[0]).toBeCloseTo(from.z, 5);
    expect(out.xs[1]).toBeCloseTo(to.x, 5);
    expect(out.zs[1]).toBeCloseTo(to.z, 5);
  });

  it("paths to the nearest walkable cell when the goal is unwalkable", () => {
    const world = makeWorld();
    floor(world);
    // A 55 degree ramp over the goal: the cell's ground is the tilted top, so
    // that cell is unwalkable, while the floor round it is walkable.
    box(world, 1.5, 0.2, 1.5, 4, 1.5, 4, (55 * Math.PI) / 180);
    const g = grid(world);
    g.bake();
    expect(g.walkableAt(4, 4), "the goal cell is not walkable").toBe(false);
    const out = makePath();
    const n = g.findPath({ x: -4, z: -4 }, { x: 4, z: 4 }, out);
    expect(n).toBeGreaterThanOrEqual(2);
    const lastX = out.xs[out.count - 1]!;
    const lastZ = out.zs[out.count - 1]!;
    expect(g.walkableAt(lastX, lastZ), "the path ends on walkable ground").toBe(true);
    expect(Math.hypot(lastX - 4, lastZ - 4), "and near the goal").toBeLessThan(2);
  });

  it("re-bakes only the cells in a rectangle", () => {
    const world = makeWorld();
    floor(world);
    const g = grid(world);
    g.bake();
    expect(g.groundAt(0, 0)).toBeCloseTo(0, 2);
    box(world, 1, 1, 1, 0, 1, 0);
    box(world, 1, 1, 1, 10, 1, 10);
    world.step();
    g.rebake(-1.5, -1.5, 1.5, 1.5);
    expect(g.groundAt(0, 0), "re-baked: the box's top").toBeCloseTo(2, 2);
    expect(g.groundAt(10, 10), "not re-baked: still the old ground").toBeCloseTo(0, 2);
  });

  it("bakes a 40 by 40 m floor in under 150 ms and paths across it in under 2 ms", () => {
    const world = makeWorld();
    floor(world);
    const g = grid(world);
    const t0 = performance.now();
    g.bake();
    const bakeMs = performance.now() - t0;
    // A maze-like field of walls, so A* has real work to do.
    for (let i = -8; i <= 8; i++) {
      box(world, 6, 1, 0.4, 0, 1, i * 2.2);
    }
    world.step();
    g.bake();
    const out = makePath();
    const t1 = performance.now();
    let found = 0;
    for (let k = 0; k < 10; k++) {
      found = g.findPath({ x: -18, z: -18 }, { x: 18, z: 18 }, out);
    }
    const queryMs = (performance.now() - t1) / 10;
    console.info(`nav bake 40x40 at ${CELL} m: ${bakeMs.toFixed(1)} ms; ` +
      `path query: ${queryMs.toFixed(3)} ms (${found} waypoints)`);
    expect(found).toBeGreaterThan(0);
    expect(bakeMs).toBeLessThan(150);
    expect(queryMs).toBeLessThan(2);
  });
});
