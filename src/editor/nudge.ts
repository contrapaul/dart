import type { Vec3 } from "../level/format";

// The arrow keys nudge the selection (Paul, 2026-11-27). Up and Down move it
// away from and toward the camera, Left and Right across, PageUp and
// PageDown up and down. "Away" is the grid axis nearest the camera's
// horizontal heading, so a nudge always stays on the grid. No DOM here, so
// it is tested headless.

export const NUDGE_KEYS = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "PageUp", "PageDown"] as const;
export type NudgeKey = (typeof NUDGE_KEYS)[number];

export function isNudgeKey(code: string): code is NudgeKey {
  return (NUDGE_KEYS as readonly string[]).includes(code);
}

/** The world offset for one nudge, given the camera's forward direction on
 *  the ground (x, z: any length) and the step in metres. */
export function nudgeOffset(key: NudgeKey, forwardX: number, forwardZ: number, step: number): Vec3 {
  if (key === "PageUp") return [0, step, 0];
  if (key === "PageDown") return [0, -step, 0];
  // The grid axis nearest the heading; looking straight down, -z.
  const alongX = Math.abs(forwardX) > Math.abs(forwardZ);
  const f: [number, number] = alongX
    ? [Math.sign(forwardX), 0]
    : [0, forwardZ === 0 ? -1 : Math.sign(forwardZ)];
  // Right of forward, seen from above with +y up: (-fz, fx).
  const r: [number, number] = [-f[1], f[0]];
  const [dx, dz] = key === "ArrowUp" ? f : key === "ArrowDown" ? [-f[0], -f[1]] : key === "ArrowRight" ? r : [-r[0], -r[1]];
  return [dx * step + 0, 0, dz * step + 0];
}
