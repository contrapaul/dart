// AUD-01 stage 3b: the Foamer sounds. Owned by GameSounds, which passes the
// FoamerSystem in. Everything is spatial at the part's or the Foamer's own
// position except PL-hurt (the player's own one).

import type * as THREE from "three";
import type { AudioSink } from "./sink";
import type { FoamerSystem, FoamerSoundKind } from "../foamers/foamers";
import type { Foamer } from "../foamers/foamer";

// FX-topple is heard at go-down; FX-fizz-out lands this much later.
const FIZZ_DELAY = 0.3;
// The fizz-out timers are a fixed-size array advanced in update, not
// setTimeout: one per Foamer that goes down, capped at FIZZ_CAP.
const FIZZ_CAP = 16;

interface Fizz {
  f: Foamer;
  t: number;
}

/**
 * The Foamer sounds. When the system is null (a page without Foamers), the
 * module is inert but the interface stays the same.
 */
export class FoamerSounds {
  private sink: AudioSink;
  private system: FoamerSystem | null;
  /** The queue of fizz-outs yet to land, oldest first. */
  private fizz: Fizz[] = [];
  /** The last foot-plant integer seen per living Foamer. */
  private plantSeen = new WeakMap<Foamer, number>();

  constructor(sink: AudioSink, system: FoamerSystem | null) {
    this.sink = sink;
    this.system = system;
    if (!system) return;
    system.onSound = (kind, f, point) => this.onSound(kind, f, point);
    // The bonk: wrap the page's own onBonk (the game tracks the player's
    // hit there) and, in between, play the two player-facing lines.
    const prev = system.onBonk;
    system.onBonk = (f, attack) => {
      // F01-bonk is spatial at the Foamer; PL-hurt is the player's own hit,
      // not spatial. The previous handler goes first, as before.
      prev(f, attack);
      this.sink.play("F01-bonk", { position: f.centre });
      this.sink.play("PL-hurt");
    };
  }

  /** One fixed step, after the Foamer system's own step. */
  update(dt: number): void {
    const sys = this.system;
    if (!sys) return;
    // A foot plants each time the integer part of gait rises. The first
    // sighting of a Foamer is only a seed: its foot is already down and the
    // gait is 0, so the first step heard is the first real plant.
    for (const f of sys.list) {
      if (f.state !== "approach") continue;
      const step = Math.floor(f.gait);
      const seen = this.plantSeen.get(f);
      if (seen !== undefined && step !== seen) {
        this.plantSeen.set(f, step);
        this.sink.play("FX-step-medium", { position: f.centre });
      } else if (seen === undefined) {
        this.plantSeen.set(f, step);
      }
    }
    for (let i = this.fizz.length - 1; i >= 0; i--) {
      const el = this.fizz[i]!;
      el.t -= dt;
      if (el.t <= 0) {
        this.fizz.splice(i, 1);
        this.sink.play("FX-fizz-out", { position: el.f.centre });
      }
    }
  }

  /** A Foamer event at the part's or Foamer's position. */
  private onSound(kind: FoamerSoundKind, f: Foamer, point: THREE.Vector3): void {
    const p = { position: point };
    switch (kind) {
      case "spawn":
        this.sink.play("FX-spawn", p);
        break;
      case "wound":
        this.sink.play("FX-wound", p);
        break;
      case "part-off":
        this.sink.play("FX-part-off", p);
        break;
      case "attack":
        this.sink.play("F01-swing", p);
        break;
      case "fall":
        // GAME-11: it toppled, but it is not down, so no fizz-out.
        this.sink.play("FX-topple", p);
        break;
      case "down":
        this.sink.play("FX-topple", p);
        if (this.fizz.length >= FIZZ_CAP) this.fizz.shift();
        this.fizz.push({ f, t: FIZZ_DELAY });
        break;
      case "sink":
        this.sink.play("FX-sink", p);
        break;
      case "pop":
        this.sink.play("FX-pop", p);
        this.sink.play("FX-chunk", p);
        break;
      case "stagger":
        this.sink.play("FX-stagger", p);
        break;
    }
  }
}
