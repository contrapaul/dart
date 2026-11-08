import * as THREE from "three";
import type { Foamer } from "../foamers/foamer";
import type { FoamerSystem } from "../foamers/foamers";
import type { DartSystem, DartHit } from "../weapons/darts";
import type { Loadout } from "../weapons/loadout";

// PT-01 stage 3: the time-to-kill readout. For each Foamer: from the first
// hit on it to the moment it goes down or pops, the blaster, the mods on, the
// seconds, the shots fired at it and the distance. The last five kills go in
// a small corner panel, newest at the top.
//
// No DOM in the tracker itself, so a headless test drives it exactly as the
// page does; only LineupPanel touches the document.

export interface KillRecord {
  /** The Foamer's type id (F01 and so on). */
  type: string;
  /** The blaster that landed the killing blow's shot (B01 and so on). */
  blaster: string;
  /** The mods that blaster had on for that shot, in the order added. */
  mods: string[];
  /** Seconds from the first hit on it to its end. */
  seconds: number;
  /** Trigger pulls that hit it (its own shots, not darts: a B03 press is one). */
  shots: number;
  /** Metres from the player to it when the first hit landed. */
  distanceMetres: number;
  /** How it ended. */
  how: "down" | "pop";
}

/** One Foamer being watched, from its first hit to its end. */
interface Watched {
  foamer: Foamer;
  from: number;
  /** shot id -> one pull that hit it. A Set, so a shotgun's many darts from
   *  one pull count once (the card: trigger pulls that hit it). */
  shots: Set<number>;
  distance: number;
}

export class TtkTracker {
  /** The kills, newest first, at most `keep`. */
  readonly kills: KillRecord[] = [];
  private readonly keep = 5;
  private time = 0;
  /** Keyed by the Foamer itself: physics body handles are reused once a
   *  body is freed, so a handle could name the next Foamer (review fix). */
  private readonly watched = new Map<Foamer, Watched>();
  /** shot id -> what fired it. Filled by the darts.fire wrapper below. */
  private readonly fired = new Map<number, { blaster: string; mods: string[] }>();
  private readonly _player = new THREE.Vector3();

  /** Subscribe to the dart system. Wrapped `fire` notes which blaster and
   *  which mods fired each shot (only the active blaster ever fires); the
   *  onHit subscription runs last, after the Foamer system has set
   *  `foamerKey`, so a hit can be put against the right Foamer. */
  track(darts: DartSystem, loadout: Loadout, foamers: FoamerSystem): void {
    const fire = darts.fire.bind(darts);
    darts.fire = (origin, direction, type, shot) => {
      if (shot) this.fired.set(shot.id, {
        blaster: loadout.ids[loadout.activeIndex]!,
        mods: [...loadout.modsOf(loadout.activeIndex)],
      });
      return fire(origin, direction, type, shot);
    };
    const previous = darts.onHit;
    darts.onHit = (hit) => {
      previous(hit);
      this.onHit(hit, foamers);
    };
  }

  private onHit(hit: DartHit, foamers: FoamerSystem): void {
    const key = hit.foamerKey;
    if (key === undefined || key === null) return; // floor, wall, loose piece
    const f = foamers.list.find((x) => x.root.handle === key);
    if (!f) return;
    let w = this.watched.get(f);
    if (!w) {
      w = {
        foamer: f,
        from: this.time,
        shots: new Set(),
        distance: f.centre.distanceTo(this._player),
      };
      this.watched.set(f, w);
    }
    if (hit.shot) w.shots.add(hit.shot.id);
  }

  /** Once per fixed step, after the Foamers have stepped: the clock, the
   *  player position the next first hit measures from, and the check for any
   *  watched Foamer that has gone down or popped. */
  update(dt: number, foamers: FoamerSystem, player: THREE.Vector3): void {
    this.time += dt;
    this._player.copy(player);
    for (const [key, w] of [...this.watched]) {
      const f = w.foamer;
      const down = f.state === "down";
      const gone = !foamers.list.includes(f) && !down; // popped or removed
      if (!down && !gone) continue;
      this.record(w, down ? "down" : "pop");
      this.watched.delete(key);
    }
  }

  private record(w: Watched, how: "down" | "pop"): void {
    const last = [...w.shots].pop();
    const fired = last === undefined ? undefined : this.fired.get(last);
    this.kills.unshift({
      type: w.foamer.rig.id,
      blaster: fired?.blaster ?? "-",
      mods: fired?.mods ?? [],
      seconds: this.time - w.from,
      shots: w.shots.size,
      distanceMetres: w.distance,
      how,
    });
    if (this.kills.length > this.keep) this.kills.length = this.keep;
    this.onChange?.();
  }

  /** Respawn: forget the line that is going, and any shot still remembered. */
  reset(): void {
    this.watched.clear();
    this.fired.clear();
  }

  /** The panel re-renders itself through this (set by LineupPanel). */
  onChange: () => void = () => {};
}

/** One line per kill, newest at the top: `F01 Slowmer B07 +mod 3.2 s / 4
 *  pulls / 15 m`. Writes only when the text changes. */
export class TtkPanel {
  private last = "";

  constructor(private host: HTMLElement, private tracker: TtkTracker, private label: (t: string) => string) {
    tracker.onChange = () => this.render();
  }

  render(): void {
    const text = this.tracker.kills
      .map((k) => `${this.label(k.type) === k.type ? k.type : `${k.type} ${this.label(k.type)}`} ${k.blaster}`
        + `${k.mods.length ? " " + k.mods.join(",") : ""}`
        + ` ${k.seconds.toFixed(2)}s ${k.shots} pulls ${k.distanceMetres.toFixed(0)}m ${k.how}`)
      .join("\n");
    if (text === this.last) return;
    this.last = text;
    this.host.textContent = text;
  }
}
