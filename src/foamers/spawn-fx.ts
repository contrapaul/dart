import * as THREE from "three";
import { SPAWN_IN, type SpawnInSpec } from "./spawn-in";

// SPAWN-01: the teleport's look at a Foamer's feet: a foam ring that opens
// on the floor, a rising column of foam and a puff of foam chunks. Foam
// only: no fire, no smoke, nothing demonic. Pooled, with a hard cap
// (`maxLive`). The spawn-fx card fills it in; the FoamerSystem owns one and
// calls `start` when a Foamer teleports in, `update` every step.

export class SpawnFx {
  /** Added to the scene by whoever owns the FoamerSystem's group. */
  readonly group = new THREE.Group();

  constructor(readonly spec: SpawnInSpec = SPAWN_IN) {}

  /** Starts an arrival at `feet`, for a Foamer `height` metres tall whose
   *  main colour is `colour` (0xrrggbb). Returns false at the cap. */
  start(feet: THREE.Vector3, height: number, colour: number): boolean {
    void feet;
    void height;
    void colour;
    return false;
  }

  /** Advances every arrival; finished ones go back to the pool, hidden. */
  update(dt: number): void {
    void dt;
  }

  /** Arrivals being drawn now. */
  get live(): number {
    return 0;
  }

  /** Hides every arrival (a restart). */
  clear(): void {}
}
