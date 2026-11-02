// AUD-01 stage 2: the interface between the game and the audio engine.
// The tests import it with a fake, so nothing in it touches Web Audio or
// the page. src/main.ts and src/range/main.ts hand GameSounds the real
// AudioEngine (audio.ts), which implements this.

import * as THREE from "three";

/** Options for one play or loop call. World position and rate travel with
 *  the call; the data's volume is the base. */
export interface PlayOptions {
  position?: THREE.Vector3; // world position; absent = not spatial (the player's own sounds)
  volume?: number;           // multiplies the data volume, default 1
  rate?: number;             // playback rate, default 1 (jitter is added on top)
}

/** Handle on a sound the engine keeps playing. The hook owns it: set
 *  volume and rate every frame, setPosition when its source moves, stop
 *  when it is done. */
export interface LoopHandle {
  set(volume: number, rate: number): void;
  setPosition(p: THREE.Vector3): void;
  stop(): void;
}

/** Everything GameSounds does to the sound world, and the only thing the
 *  tests fake. play fires a one-shot (the voice pool steals from it when
 *  too many copies are going), loop starts a repeating sound that runs
 *  until stopped. An unknown ID warns once and does nothing. */
export interface AudioSink {
  play(id: string, opts?: PlayOptions): void;
  loop(id: string, opts?: PlayOptions): LoopHandle;
}
