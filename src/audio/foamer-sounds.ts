// AUD-01 stage 3b: the Foamer sounds. Owned by GameSounds, which passes the
// FoamerSystem in. Everything is spatial at the part's or the Foamer's own
// position except PL-hurt (the player's own one).

import type * as THREE from "three";
import type { AudioSink } from "./sink";
import type { FoamerSystem, FoamerSoundKind } from "../foamers/foamers";
import type { Foamer } from "../foamers/foamer";
import { floatOf } from "../foamers/float";
import type { LoopHandle } from "./sink";

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
  /** GAME-10c: the float hum per flying Floater, stopped when it lands. */
  private hums = new Map<Foamer, LoopHandle>();

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
      if (f.state !== "approach" && f.state !== "charge") continue;
      const step = Math.floor(f.gait);
      const seen = this.plantSeen.get(f);
      if (seen !== undefined && step !== seen) {
        this.plantSeen.set(f, step);
        // GAME-10b: the Darter's run is the charge loop, not plain steps.
        // GAME-10d: a Swarmer skitters, a lighter and quicker patter.
        this.sink.play(
          f.state === "charge"
            ? "F05-run-loop"
            : f.spec.rig === "F03"
              ? "F03-scurry"
              : "FX-step-medium",
          { position: f.centre },
        );
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
    // GAME-10c: a Floater whose fins still hold it up hums; the hum stops
    // when the last fin goes or it goes down.
    for (const f of sys.list) {
      const fl = floatOf(f.spec);
      if (!fl) continue;
      const finsLeft = fl.fins.reduce((n, id) => n + (f.parts.has(id) ? 1 : 0), 0);
      const flying = finsLeft > 0 && f.state !== "fall" && f.state !== "down" && f.state !== "finish";
      const hum = this.hums.get(f);
      if (flying && !hum) this.hums.set(f, this.sink.loop("F06-hum", { position: f.centre }));
      else if (!flying && hum) {
        hum.stop();
        this.hums.delete(f);
      } else if (hum) hum.setPosition(f.centre);
    }
    for (const [f, hum] of this.hums) {
      if (!sys.list.includes(f)) {
        hum.stop();
        this.hums.delete(f);
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
      case "attack": {
        // A thrower's windup shows before the ball leaves the hand
        // (GAME-10a); a bonker's swing keeps its own whoosh. GAME-10d: a
        // Swarmer's is a nibble, a small high snap, not a club.
        // GAME-10e: a Blocker lifts the shield and brings the blaster up
        // over it, its own sound rather than the Roamer's windup.
        if (f.spec.rig === "F04") {
          this.sink.play("F04-alert", p);
          break;
        }
        const token = f.attack()?.token;
        if (f.spec.rig === "F07") {
          // GAME-10f: the Brawler's swing is a two-fist punch, its own sound.
          this.sink.play("F07-punch", p);
          break;
        }
        this.sink.play(
          token === "ranged" ? "F02-windup" : token === "swarm" ? "F03-nibble" : "F01-swing",
          p,
        );
        break;
      }
      case "throw":
        // GAME-10c: the Floater's jaw snaps shut to spit.
        this.sink.play(
          f.spec.rig === "F04" ? "F04-volley" : f.spec.rig === "F06" ? "F06-spit" : "F02-throw",
          p,
        );
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
      // GAME-09b: the burst out of a chunk finish's hole. The down's own
      // topple follows it from goDown.
      case "chunk":
        this.sink.play("FX-chunk", p);
        break;
      // GAME-10e, the Blocker's shield: a dart thudding into it, and the
      // shield coming away (design/SOUNDS.md).
      case "shield-hit":
        this.sink.play("F04-shieldhit", p);
        break;
      case "shield-break":
        this.sink.play("F04-shieldbreak", p);
        break;
      // GAME-10b, the Darter's charge: the scrape, the run starting, and
      // the wall or player it hits (placeholder IDs, design/SOUNDS.md 4.2).
      case "scrape":
        this.sink.play("F05-snort", p);
        break;
      case "charge":
        this.sink.play("F05-run-loop", p);
        break;
      case "impact":
        this.sink.play("F05-impact", p);
        break;
      // GAME-10d, the Swarmer: a pack waking yips as one (the system only
      // sends this for a swarm member, so no other Foamer picks it up).
      case "alert":
        this.sink.play("F03-yip", p);
        break;
      // GAME-10f, the Brawler: the fold before the leap and the landing
      // that sends the ring out (placeholder IDs, design/SOUNDS.md).
      case "crouch":
        this.sink.play("F07-crouch", p);
        break;
      case "land":
        this.sink.play("F07-land", p);
        break;
    }
  }
}
