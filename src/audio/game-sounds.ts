// AUD-01 stage 2: connects the game to an AudioSink. update(dt, controls)
// runs once per fixed step, after loadout.update and player.update. This
// stage owns the blaster, player and level hooks; the dart and Foamer
// hooks come in stage 3.
//
// How it listens. Nothing in here is tuned by hand: every sound id comes
// from data/sounds.json (the blasterCues table) and every threshold from
// its "player" block (strideWalk, strideSprint, hardLandSpeed).
// - Fire: counts Blaster.shots on the active blaster, one sound per shot:
//   B01's three dart pump is one shot (one sound), a B03 press that fires
//   both barrels (the both mod) is two. A per-step difference in the
//   count, not a per-dart hook, so nothing moves if the range page or a
//   mod rebuild replaces the blaster's onShot.
// - Cues: the active blaster's cue list for its state, sorted by at, is
//   walked as progress crosses each cue's at, once per priming or reload.
// - Switching: BX-holster when a switch starts, BX-draw when the new
//   blaster comes in (the halfway swap of the loadout).
// - Dry fire: BX-dry when the trigger is pressed with an empty blaster
//   and nothing to reload (a blaster with reserve auto-reloads instead).
// - Mods: BX-mod-on and BX-mod-off when the active blaster's mod list
//   grows or shrinks.
// - B04: one B04-rev-loop while it is the active blaster; the volume is
//   wheelSpeed (silent when the wheels are still), the rate 0.6 to 1 with
//   the wheel. The loop stops when B04 is switched away.
// - Player: PlayerController.onMove (one callback field, in the style of
//   onShot): jump, dash, mantle, dash-ready and land. Steps are watched
//   instead: as long as the player is grounded and not dashing, the run
//   goes on the stride accumulator, one PL-step-hard every walk (or
//   sprint) stride in the data. No steps in the air, in a dash, or
//   mantling (the player is not grounded then). The accumulator resets
//   on a jump, dash, mantle or landing.
// - Level: the AMB-level loop starts when GameSounds is built (the first
//   click on both pages), is not spatial and runs until the page unloads.

import type { Blaster, BlasterControls } from "../weapons/blaster";
import type { Loadout } from "../weapons/loadout";
import type { PlayerController, PlayerMoveKind } from "../player/controller";
import type * as THREE from "three";
import type { DartSystem, DartHit } from "../weapons/darts";
import type { DartImpacts } from "../weapons/impacts";
import type { FoamerSystem } from "../foamers/foamers";
import soundsJson from "../../data/sounds.json";
import type { AudioSink, LoopHandle } from "./sink";
import { FoamerSounds } from "./foamer-sounds";

// A dart's hit plays its surface sound at full volume at this speed and up,
// scaled by speed below it (the card's dart hooks: full at 30 m/s and up).
const FULL_HIT_SPEED = 30;

interface Cue { state: string; at: number; sound: string }
interface SoundsData {
  blasterCues: Record<string, Cue[]>;
  surfaces: Record<string, string>;
  player: { strideWalk: number; strideSprint: number; hardLandSpeed: number };
}

// The controls update() reads. The pages build it from the same input the
// blaster used, adding sprint for the footsteps.
export interface GameSoundsControls extends BlasterControls {
  sprintHeld: boolean;
}

export class GameSounds {
  private sink: AudioSink;
  private loadout: Loadout;
  private player: PlayerController;
  private impacts: DartImpacts | null;
  private foamers: FoamerSounds | null;
  // The dart-hit sound id per surface name, built once from the data's
  // "surfaces" block: a Foamer part is "foamer", a voxel target falls
  // through to its material's name, everything else "default".
  private surfaceId = new Map<string, string>();
  private data: SoundsData;
  // The DART hooks (stage 3a, in the style of Blaster.onShot): a surface
  // sound per dart hit (the slug type swaps in DT-slug-hit), DT-carve when
  // a hit removed voxel material, DT-floor when a dart comes to rest.
  // Surfaces come from the data's "surfaces" block; the dart-hit sound id
  // of a material is looked up by name (falling back to "default").
  // Cue lists sorted by at, so they play in time order however the data
  // is written.
  private cueLists = new Map<string, Cue[]>();
  // Cue state, per blaster object, so that a priming interrupted by a
  // switch resumes its walk (cues already heard on this priming are not
  // replayed) instead of restarting it.
  private cueWalk = new WeakMap<Blaster, { state: string; idx: number }>();
  // The last active index, for the switch sounds; -1 before the first
  // update so the blaster the game starts with is drawn silently. And the
  // switch flag of the last step, so BX-holster fires once per switch start.
  private lastIdx = -1;
  private wasSwitching = false;
  // The last-seen shot count of each blaster, per blaster object. A step
  // where the active blaster's count rises by k plays k fire sounds.
  // Reading the count instead of the onShot hook means the range page and
  // Loadout.setMod may replace that hook freely and never lose a shot.
  private lastShots = new WeakMap<Blaster, number>();
  // The B04 rev loop.
  private rev: LoopHandle | null = null;
  // The active blaster's mods, as a comma string, for the mod sounds.
  private lastMods = "";
  // The stride accumulator for footsteps and the sprint flag this step.
  private paceAcc = 0;
  private sprint = false;


  constructor(
    sink: AudioSink,
    loadout: Loadout,
    player: PlayerController,
    darts: DartSystem,
    impacts?: DartImpacts,
    foamers?: FoamerSystem,
  ) {
    this.sink = sink;
    this.loadout = loadout;
    this.player = player;
    this.impacts = impacts ?? null;
    this.foamers = new FoamerSounds(sink, foamers ?? null);
    this.data = soundsJson as unknown as SoundsData;
    // The dart-hit sound id per surface name, from the data's surfaces block.
    for (const [surface, id] of Object.entries(this.data.surfaces)) {
      this.surfaceId.set(surface, id);
    }
    // Dart hooks: DartSystem.onDartHit fires after the onHit chain, so
    // DartImpacts has labelled the hit's material by the time this runs.
    // DT-carve comes from the impacts' onCarveAt, the same step.
    darts.onDartHit = (hit) => this.onDartHit(hit);
    darts.onDartRest = (e) => this.playFloor(e.point);
    // GAME-09f: B07's remote rounds going off: a click for the press (the
    // boom is FX-explode, played by the explosion's own hook). Chained so
    // whatever wired onDetonate first still hears it.
    const prevDetonate = darts.onDetonate;
    darts.onDetonate = (point, type, clustered) => {
      prevDetonate(point, type, clustered);
      this.sink.play("B07-detonate", { position: point });
    };
    if (this.impacts) this.impacts.onCarveAt = (p) => this.playCarve(p);
    for (const [id, cues] of Object.entries(this.data.blasterCues)) {
      this.cueLists.set(id, [...cues].sort((a, b) => a.at - b.at));
    }
    player.onMove = (kind, vel) => this.onPlayerMove(kind, vel);
    // The blaster the game starts with is in hand from the beginning
    // (no draw sound for it), so its mod list and its magazine reading are
    // seeded here rather than replayed on the very first fixed step.
    this.lastIdx = loadout.activeIndex;
    this.lastMods = loadout.modsOf(loadout.activeIndex).join(",");
    this.lastShots.set(loadout.active, loadout.active.shots);
    // The level loop, from the first click: quiet, not spatial.
    this.sink.loop("AMB-level");
  }

  /** One fixed step, after loadout.update and player.update. */
  update(dt: number, controls: GameSoundsControls): void {
    this.sprint = controls.sprintHeld;
    this.watchBlaster(controls);
    this.watchSteps(dt);
    this.foamers?.update(dt);
  }

  // ---- blasters ----

  /** The active blaster: the switch sounds, the shot wrap, the cues, the
   *  dry fire, the B04 rev loop and the mod sounds. */
  private watchBlaster(controls: GameSoundsControls): void {
    const lo = this.loadout;
    const idx = lo.activeIndex;
    const b = lo.active;
    // A switch just started: the old blaster is holstered. Fires once per
    // switch (the flag goes high at the start and stays high to the end).
    if (!this.wasSwitching && lo.switching) this.sink.play("BX-holster");
    this.wasSwitching = lo.switching;
    if (idx !== this.lastIdx) {
      // The halfway swap: the new blaster rises in. The initial blaster
      // (lastIdx still -1) is in hand from the start, no draw for it.
      if (this.lastIdx >= 0) this.sink.play("BX-draw");
      this.lastIdx = idx;
      this.lastMods = lo.modsOf(idx).join(",");
      this.stopRev();
      return; // the new blaster has not moved this step
    }
    if (lo.switching) return; // mid-switch: the active blaster sits still
    this.watchFire(b);
    this.walkCues(b);
    const empty = b.spec.mode === "break" ? !b.loaded.some(Boolean) : b.mag === 0;
    if (controls.firePressed && empty && b.reserve <= 0) this.sink.play("BX-dry");
    if (lo.activeId() === "B04") {
      if (!this.rev) this.rev = this.sink.loop("B04-rev-loop");
      this.rev.set(b.wheelSpeed, 0.6 + 0.4 * b.wheelSpeed);
    } else {
      this.stopRev();
    }
    const mods = lo.modsOf(idx).join(",");
    if (mods !== this.lastMods) {
      this.sink.play(mods.length >= this.lastMods.length ? "BX-mod-on" : "BX-mod-off");
      this.lastMods = mods;
    }
  }

  /** One fire sound per shot of the active blaster: B01's three dart
   *  pump is one shot (one sound), a B03 press that fires both barrels is
   *  two. Counted from Blaster.shots rather than the magazine, because the
   *  range's infinite ammo refills the magazine in the same step. */
  private watchFire(b: Blaster): void {
    const before = this.lastShots.get(b) ?? b.shots;
    this.lastShots.set(b, b.shots);
    for (let k = before; k < b.shots; k++)
      this.sink.play(this.loadout.activeId() + "-fire");
  }

  /** The active blaster's cue list for its state, walked as progress
   *  crosses the cues. Each cue plays once, only in the state it is
   *  listed for; a ready blaster resets the walk. Per-blaster state: a
   *  mid-priming switch resumes where it left off. */
  private walkCues(b: Blaster): void {
    let w = this.cueWalk.get(b);
    if (!w) { w = { state: "", idx: 0 }; this.cueWalk.set(b, w); }
    if (b.state === "ready") { w.state = "ready"; w.idx = 0; return; }
    if (w.state !== b.state) { w.state = b.state; w.idx = 0; }
    const list = this.cueLists.get(this.loadout.activeId()) ?? [];
    const p = b.progress;
    while (w.idx < list.length && p >= list[w.idx].at) {
      if (list[w.idx].state === b.state) this.sink.play(list[w.idx].sound);
      w.idx += 1;
    }
  }

  /** The B04 rev loop: a soft stop (volume to zero) when B04 is not the
   *  active blaster, so the fade out is not a click. */
  private stopRev(): void {
    if (!this.rev) return;
    this.rev.set(0, 1);
    this.rev.stop();
    this.rev = null;
  }

  // ---- darts (stage 3a) ----

  /** A dart hit something (DartSystem.onDartHit, fired after the onHit
   *  chain, so DartImpacts has already labelled the hit's material and
   *  the Foamer system a part "foamer"). Slugs play DT-slug-hit; the
   *  rest play the surface sound of what was hit (a Foamer part is
   *  "foamer", a voxel target its material's name when one is listed,
   *  anything else "default"), spatial at the hit point, full volume at
   *  FULL_HIT_SPEED m/s and above. */
  private onDartHit(hit: DartHit): void {
    if (hit.type === "slug") {
      this.sink.play("DT-slug-hit", { position: hit.point });
      return;
    }
    // A material with no entry of its own (the foam colours) is "default".
    const id = this.surfaceId.get(hit.material ?? "default") ?? this.surfaceId.get("default");
    if (!id) return;
    this.sink.play(id, {
      position: hit.point,
      volume: Math.min(1, hit.speed / FULL_HIT_SPEED),
    });
  }

  /** A dart carve removed voxel material (DartImpacts.onCarveAt; a hit
   *  that only scuffed a surface does not fire it): DT-carve at the hit
   *  point. */
  private playCarve(point: THREE.Vector3): void {
    this.sink.play("DT-carve", { position: point });
  }

  /** A dart came to rest on the floor (DartSystem.onDartRest): DT-floor
   *  at its position. The sound's voice cap keeps a floor full of darts
   *  from playing one sound each. */
  private playFloor(point: THREE.Vector3): void {
    this.sink.play("DT-floor", { position: point });
  }

  // ---- the player ----

  /** Feet: one grounded run at the stride the player is at. A jump,
   *  dash, mantle or landing starts a new run, and the air does too. */
  private watchSteps(dt: number): void {
    const p = this.player;
    if (!p.grounded || p.dashing || p.mantling) {
      this.paceAcc = 0;
      return;
    }
    this.paceAcc += Math.hypot(p.vel.x, p.vel.z) * dt;
    const stride = this.sprint ? this.data.player.strideSprint : this.data.player.strideWalk;
    while (this.paceAcc >= stride) {
      this.paceAcc -= stride;
      this.sink.play("PL-step-hard");
    }
  }

  /** PlayerController.onMove: the one callback field this task adds to
   *  the module. vel is the controller's own vector, read and let go. */
  private onPlayerMove(kind: PlayerMoveKind, vel: { x: number; y: number; z: number }): void {
    const d = this.data.player;
    switch (kind) {
      case "jump":
        this.sink.play("PL-jump");
        this.paceAcc = 0;
        break;
      case "dash":
        this.sink.play("PL-dash");
        this.paceAcc = 0;
        break;
      case "dash-ready":
        this.sink.play("PL-dash-ready");
        break;
      case "mantle":
        this.sink.play("PL-mantle");
        this.paceAcc = 0;
        break;
      case "land":
        // vel.y is the downward speed of the fall, called before it is
        // zeroed: a landing at or over the data's speed is hard.
        this.sink.play(-vel.y >= d.hardLandSpeed ? "PL-land-hard" : "PL-land-soft");
        this.paceAcc = 0;
        break;
    }
  }
}
