import aiData from "../../data/ai.json";
import type { PathPoints } from "./nav-grid";

// Steering (ENG-08 stage 2): a pure function on plain numbers, so the tests
// and the brain can call it without a Rapier world. Seek the next waypoint,
// arrive at the last one, and separate from neighbours.

const S = aiData.steer;

/** An agent's position and how fast it may go this step (m/s). */
export interface Agent {
  x: number;
  z: number;
  speed: number;
}

/** A neighbour as steering sees it: a position and a radius to keep apart. */
export interface Neighbour {
  x: number;
  z: number;
}

/** A velocity in the ground plane (m/s), written by steer(). */
export interface Velocity {
  x: number;
  z: number;
}

/** Index of the first waypoint still ahead of (x, z), skipping the ones the
 *  agent has already reached. */
function nextWaypoint(x: number, z: number, path: PathPoints): number {
  for (let i = 1; i < path.count; i++) {
    const dx = path.xs[i]! - x;
    const dz = path.zs[i]! - z;
    if (dx * dx + dz * dz > 0.25) return i;
  }
  return path.count - 1;
}

/**
 * The velocity an agent wants this step: toward the next waypoint of `path`
 * (no path: stand still), easing to a stop inside `arriveRadius` of the last
 * waypoint, plus separation from every neighbour closer than
 * `separationMetres`. Writes into `out` and returns it; allocates nothing.
 */
export function steer(
  agent: Agent,
  path: PathPoints,
  neighbours: readonly Neighbour[],
  out: Velocity,
): Velocity {
  out.x = 0;
  out.z = 0;
  if (path.count > 0) {
    const i = nextWaypoint(agent.x, agent.z, path);
    const dx = path.xs[i]! - agent.x;
    const dz = path.zs[i]! - agent.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 1e-4) {
      let speed = agent.speed;
      const last = path.count - 1;
      const toEnd = Math.hypot(path.xs[last]! - agent.x, path.zs[last]! - agent.z);
      if (i === last && toEnd < S.arriveRadiusMetres) {
        speed *= Math.max(0, toEnd / S.arriveRadiusMetres);
      }
      out.x = (dx / dist) * speed;
      out.z = (dz / dist) * speed;
    }
  }
  // Separation: overlapping agents push apart, harder the deeper the overlap.
  let sx = 0;
  let sz = 0;
  for (const n of neighbours) {
    const dx = agent.x - n.x;
    const dz = agent.z - n.z;
    const d = Math.hypot(dx, dz);
    if (d >= S.separationMetres) continue;
    const overlap = S.separationMetres - d;
    if (d > 1e-4) {
      sx += (dx / d) * overlap;
      sz += (dz / d) * overlap;
    } else {
      // Exactly on top of each other: no direction to pick, so push along +x
      // so they at least never stay stacked.
      sx += overlap;
    }
  }
  out.x += sx * S.separationGain;
  out.z += sz * S.separationGain;
  return out;
}
