import type * as THREE from "three";
import { AudioEngine } from "../audio/audio";
import { GameSounds } from "../audio/game-sounds";
import type { LoopHandle, PlayOptions } from "../audio/sink";
import type { Loadout } from "../weapons/loadout";
import type { PlayerController } from "../player/controller";
import type { DartSystem } from "../weapons/darts";
import type { DartImpacts } from "../weapons/impacts";
import type { FoamerSystem } from "../foamers/foamers";

// Sound for both game pages (AUD-01 stage 2, moved to src/game/ by ENG-13).
// The engine opens on the first click or key, inside that gesture: the
// browser keeps sound off before it, and the pointer lock event comes later
// and is not a gesture. Until the engine arrives, or on a host that has no
// Web Audio, the game carries on silent.

export interface GameAudioDeps {
  camera: THREE.Camera;
  loadout: Loadout;
  player: PlayerController;
  darts: DartSystem;
  impacts: DartImpacts;
  foamers: FoamerSystem;
  /** The pause state when the engine arrives: a paused game starts muted. */
  paused(): boolean;
  /** Once the engine is up, to apply the stored volume and mute. */
  onReady(): void;
}

export interface GameAudio {
  readonly engine: AudioEngine | null;
  readonly sounds: GameSounds | null;
  start(): void;
  /** Volume and mute from the settings store, live. */
  applyVolume(volume: number, muted: boolean): void;
  setPaused(p: boolean): void;
  /** One one-shot, or nothing while the engine is still loading. */
  play(id: string, opts?: PlayOptions): void;
  /** A loop that runs until its handle is stopped, or a handle that does
   *  nothing while the engine is still loading (GAME-04c's foam saw). */
  loop(id: string, opts?: PlayOptions): LoopHandle;
}

/** The loop handle before the engine is up: safe to set and stop. */
const NO_LOOP: LoopHandle = { set() {}, setPosition() {}, stop() {} };

export function createAudio(deps: GameAudioDeps): GameAudio {
  let engine: AudioEngine | null = null;
  let sounds: GameSounds | null = null;
  let starting = false;

  function start(): void {
    if (engine || starting) return;
    starting = true;
    AudioEngine.create(deps.camera)
      .then((e) => {
        engine = e;
        sounds = new GameSounds(e, deps.loadout, deps.player, deps.darts, deps.impacts, deps.foamers);
        if (deps.paused()) e.suspend();
        deps.onReady(); // volume and mute from storage
      })
      .catch(() => { /* no Web Audio on this host: the game stays silent */ })
      .finally(() => { starting = false; });
  }

  return {
    get engine() {
      return engine;
    },
    get sounds() {
      return sounds;
    },
    start,
    applyVolume(volume, muted) {
      if (!engine) return;
      engine.volume = volume;
      engine.muted = muted;
    },
    setPaused(p) {
      if (!engine) return;
      if (p) engine.suspend();
      else engine.resume();
    },
    play(id, opts) {
      if (engine) engine.play(id, opts);
    },
    loop(id, opts) {
      return engine ? engine.loop(id, opts) : NO_LOOP;
    },
  };
}
