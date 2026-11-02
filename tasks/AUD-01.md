# AUD-01: the sound system, with placeholder sounds

Written 2026-11-02. Paul is recording the sounds in `design/SOUNDS.md`.
This card builds everything they plug into, so a recording goes in by
dropping a file and adding its name to the data. Until then every sound is
a placeholder made in code, so the game has sound from the start.

```
ID:          AUD-01
Title:       Web Audio mixer, sound bank from data, placeholder synth,
             spatial one-shots and loops, game event hooks, range panel
Owner:       Pi (Qwen 3.8-27b)
Reviewer:    Claude Opus 5.5
Depends on:  GAME-09 (done)
Branch:      aud-01, in its own worktree (see "Setup")
```

Editing Paul's recordings into finished files is a separate task
(AUD-01b, Claude and Paul). Do not wait for recordings.

## Read first

1. `CLAUDE.md` (every rule applies to you)
2. `design/SOUNDS.md`: the IDs. **Every sound in the data uses its ID
   from that list, spelled exactly.** Do not invent new IDs.
3. `src/weapons/blaster.ts` (`state`, `progress`, `wheelSpeed`, `mag`,
   `reserve`, `onShot`: once per dart, so three times for one B01 shot),
   `src/weapons/loadout.ts` (switching, `setMod`),
   `src/weapons/darts.ts` (`onHit`, `DartHit`, resting darts),
   `src/weapons/impacts.ts` (`onCarve`, voxel targets and materials),
   `src/foamers/foamers.ts` (`handleHit`, `breakPart`, `goDown`, `pop`,
   `onBonk`, spawning, sinking), `src/foamers/rig-motion.ts` (walk cycles),
   `src/player/controller.ts` (jump, landing, dash, mantle)
4. `src/main.ts` and `src/range/main.ts` (start-up, the "Click to play"
   overlay, the render step, the range panel and report)

## How to work (important)

Keep each reply's thinking short and act through tools. Never write more
than about 100 lines in one tool call; write each new file in several
parts. After each file, run `npx tsc --noEmit` and the tests. Build in
the three stages below and commit after each one.

## Setup

```bash
cd /Users/paul/Documents/GitHub/dart
git worktree add ../dart-aud-01 -b aud-01
cd ../dart-aud-01
npm install
```

Dev server: `npm run dev -- --port 5178`, range at
`http://localhost:5178/range`.

## Design

Four parts, each in `src/audio/`:

- **`synth.ts`**: pure functions that render a placeholder into a
  `Float32Array` (48 kHz mono) from a recipe in the data. No Web Audio
  here, so it runs in the tests.
- **`voices.ts`**: `VoicePool`, pure logic that decides whether a sound
  may start and which playing voice to steal. No Web Audio.
- **`audio.ts`**: `AudioEngine`, the only file that touches Web Audio.
  Implements the `AudioSink` interface below.
- **`game-sounds.ts`**: `GameSounds`, connects the game to an
  `AudioSink`. Tests pass a fake sink that records calls.

```ts
export interface PlayOptions {
  position?: THREE.Vector3;  // world position; omitted = not spatial (the player's own sounds)
  volume?: number;           // multiplies the sound's data volume, default 1
  rate?: number;             // playback rate, default 1 (jitter is added on top)
}
export interface LoopHandle {
  set(volume: number, rate: number): void;
  setPosition(p: THREE.Vector3): void;
  stop(): void;
}
export interface AudioSink {
  play(id: string, opts?: PlayOptions): void;
  loop(id: string, opts?: PlayOptions): LoopHandle;
}
```

Unknown IDs: `play` and `loop` warn once per ID in the console and do
nothing (never throw).

### Data: `data/sounds.json`

```json
{
  "_note": "AUD-01. Sound IDs are the IDs in design/SOUNDS.md. files: finished recordings in public/audio/, one per take; empty means the synth placeholder plays. volume 0 to 1. jitter: random playback rate change, plus or minus. maxVoices: copies of this sound playing at once; a new one steals the oldest. refDistance and maxDistance in metres for spatial sounds.",
  "buses": { "master": 0.8, "sfx": 1, "music": 0.7, "voice": 1 },
  "maxVoices": 32,
  "refDistance": 2,
  "maxDistance": 40,
  "sounds": {
    "B01-fire": { "files": [], "volume": 0.9, "jitter": 0.04, "maxVoices": 3, "synth": { } }
  },
  "blasterCues": {
    "B01": [
      { "state": "priming",   "at": 0.05, "sound": "B01-pump-back" },
      { "state": "priming",   "at": 0.55, "sound": "B01-pump-fwd" },
      { "state": "reloading", "at": 0.1,  "sound": "B01-mag-out" },
      { "state": "reloading", "at": 0.7,  "sound": "B01-mag-in" }
    ]
  },
  "surfaces": { "foamer": "DT-hit-foamer", "wood": "DT-hit-wood", "cardboard": "DT-hit-cardboard", "plastic": "DT-hit-plastic", "default": "DT-hit-hard" },
  "player": { "strideWalk": 1.6, "strideSprint": 2.2, "hardLandSpeed": 7 }
}
```

**Which sounds get entries now:** every ID that a hook below plays, and
nothing else. Write a placeholder recipe for each. Fill the cue lists for
B01, B03 and B04 with times that match what the viewmodel shows (read
`viewmodel.ts`: B01's pump is back at progress 0.5 and home at 1; B03's
latch turns at 0.05 to 0.25 and the shells eject at 0.35; find when its
shells show and the breach closes). Cue times are data; the reviewer tunes
them by ear.

### Placeholders (`synth.ts`)

A recipe is one of these, or `{ "layers": [recipe, ...] }` mixed together:

- `{ "noise": { "dur", "attack", "decay", "lowpass", "highpass", "lowpassEnd"? } }`:
  white noise through one-pole filters, the low-pass cutoff sliding to
  `lowpassEnd` if given. Thumps, puffs, crumbles, fizzes, whooshes.
- `{ "tone": { "dur", "f0", "f1", "wave": "sine"|"square"|"triangle", "attack", "decay" } }`:
  a pitch sweep from `f0` to `f1` Hz. Boings, pops, whines, UI blips.
- `{ "click": { "dur", "freq" } }`: a very short tick. Clicks, clacks.
- `{ "crackle": { "dur", "rate", "decay" } }`: random short clicks at
  `rate` per second. Carving, chunks, debris.

Every recipe also takes `"gain"` (default 1) and `"seed"` (default 1).
Rendering is deterministic: the same recipe and seed give the same
samples (use a small seeded random, not `Math.random`). Peak at most 1;
a 2 ms fade in and out so nothing clicks at the ends. Loops (`B04-rev-loop`,
`AMB-level`) must loop without a click (fade the loop's ends together).
Make the placeholders distinct enough to tell apart and not unpleasant:
quiet ambience, short sharp clicks for mechanisms, a soft thump for dart
hits, a bubbly fizz for wounds, a bright pop for pops.

### Voices (`voices.ts`)

`VoicePool(maxTotal)`: `start(id, maxForId, now)` returns a voice number
and, if it had to steal, the voice to stop. Rules: if `id` already has
`maxForId` playing, steal the oldest of that id; else if all `maxTotal`
are busy, steal the oldest one-shot overall (loops are never stolen);
`end(voice)` frees one. No allocation per call (fixed arrays).

### Engine (`audio.ts`)

- One `AudioContext`, created in the "Click to play" click handler on
  both pages (browsers block sound before a click). Bus gains:
  master, with sfx, music and voice under it, from `buses`.
- At start-up, render every sound's placeholder into an `AudioBuffer`
  and, for sounds with `files`, fetch and decode each file from
  `/audio/<file>` (same origin only). A file that fails to load logs a
  warning and the placeholder plays.
- `play`: picks a take at random, but never the same take twice in a row
  when there are two or more. Rate is `rate` times `1 + random(-jitter,
  jitter)`. Spatial sounds go through a `PannerNode` (`equalpower`,
  `inverse` distance model, `refDistance`, `maxDistance` from the data)
  at `position`; the listener follows the camera every render frame.
- Suspend the context when the game pauses (pointer lock lost) and resume
  when it resumes.
- Nothing is allocated per frame in the listener update. One-shots may
  create their source and panner nodes (Web Audio requires that) but
  reuse vectors.

## Hooks (`game-sounds.ts`)

`GameSounds` is built with the sink, the loadout, the dart system, the
impacts, the Foamer system and the player, and has
`update(dt, controls)` called once per render frame. Prefer watching
public state (state changes, counters, positions) from `update`. Where a
module must say something happened, add **one** callback field to it in
the style of `onShot` and `onBonk` (a field with a no-op default), and
chain any existing callback as `impacts.ts` does with `darts.onHit`. List
every field you add in HANDOFF.

**Blasters (the active one):**
- A shot: `Bxx-fire` once per shot, not once per dart (B01's three darts
  in one step are one shot). Not spatial.
- Cues: when `progress` crosses a cue's `at` in its state, play it. Each
  cue plays once per priming or reload.
- `BX-dry`: fire pressed with an empty magazine and nothing to reload.
- Switching: `BX-holster` when a switch starts, `BX-draw` when the new
  blaster starts rising.
- `BX-mod-on`, `BX-mod-off` when `setMod` changes something.
- B04: one `B04-rev-loop` loop, created once; every frame set its volume
  to `wheelSpeed` and its rate to `0.6 + 0.4 * wheelSpeed`. It is silent
  (volume 0) when the wheels are still, and stops when B04 is switched
  away.

**Darts:**
- A hit: the surface sound at the hit point, chosen by `surfaces`: a
  Foamer part is `foamer`; a voxel target uses its material's name if
  that name has an entry; anything else (the course boxes, the floor)
  is `default`. Volume scales with speed at impact (full at 30 m/s and
  above).
- A slug hit plays `DT-slug-hit` instead.
- A carve: `DT-carve` at the hit point.
- A dart coming to rest on the floor: `DT-floor` at its position (cap
  with `maxVoices`; 150 darts must not make 150 sounds).

**Foamers (all spatial, at the part or Foamer):**
- `FX-spawn` when one spawns.
- Footsteps: `FX-step-medium` at each foot plant of the walk cycle (the
  bottom of each leg's swing in `bipedWalk`; `quadWalk` the same per
  leg). Not while down.
- `FX-wound` on every dart hit that damages it.
- `FX-part-off` when a part breaks.
- `F01-swing` when an attack starts, `F01-bonk` and `PL-hurt` when it
  lands on the player (`onBonk`).
- `FX-topple` when it goes down, `FX-fizz-out` 0.3 s later, `FX-sink`
  when it starts sinking.
- `FX-pop` and `FX-chunk` when it pops.

**Player (not spatial):**
- Footsteps: `PL-step-hard` every `strideWalk` metres travelled on the
  ground (`strideSprint` when sprinting). None in the air, while dashing
  or mantling.
- `PL-jump`, `PL-dash`, `PL-mantle` when they start; `PL-dash-ready` when
  the dash cooldown ends.
- Landing: `PL-land-hard` if the downward speed at landing is at least
  `hardLandSpeed`, else `PL-land-soft`.

**Level:** `AMB-level` loops from the first click, not spatial, quiet.

## Range page

A **Sound** section in the panel:

- A master volume slider and a mute toggle (this page only, not saved).
- A list of every sound ID with a Play button, and for each one whether
  it plays a **recording** (with the take count) or the **placeholder**.
  This is how Paul hears his recordings in place.
- The report line gains the number of voices playing.

On the main page, `M` toggles mute (add `mute` to `data/input.json`).

## Stages

1. **Data and pure parts:** `data/sounds.json` with the slice IDs and
   recipes, `synth.ts`, `voices.ts`, tests 1 to 4. Commit
   `AUD-01 stage 1: sound data, placeholder synth, voice pool`.
2. **Engine, blasters and player:** `audio.ts`, `game-sounds.ts` with the
   blaster, player and level hooks, both pages, the range panel, tests 5,
   6, 9 and 10. Commit `AUD-01 stage 2: engine, blaster and player sounds`.
3. **Darts and Foamers:** the dart and Foamer hooks and the callback
   fields they need, tests 7 and 8, HANDOFF and PLAN. Commit
   `AUD-01 stage 3: dart and Foamer sounds`.

## Tests (`tests/audio/`)

Use a fake `AudioSink` that records `play` and `loop` calls with their
IDs and options.

1. **Synth:** every recipe in the data renders; the length is `dur` times
   48000 (the longest layer for `layers`); peak at most 1 and above 0.05
   (not silent); the first and last samples are within 0.01 of zero; the
   same recipe twice gives identical samples.
2. **Data:** every sound has `files` (possibly empty) and a `synth`
   recipe; every ID used by a cue, `surfaces` or `game-sounds.ts` exists
   in `sounds`; **every key in `sounds` appears as an ID in
   `design/SOUNDS.md`** (read the file in the test and collect the IDs
   from the first column of its tables).
3. **Voices:** with `maxForId` 2, a third start of the same id steals the
   first; with `maxTotal` 4 full of one-shots, a new id steals the oldest;
   loops are never stolen; `end` frees a voice.
4. **Takes:** with three takes, 100 picks never repeat the previous take;
   with one take, it is always take 0.
5. **B01:** one shot plays `B01-fire` once (not three times), then across
   the priming `B01-pump-back` then `B01-pump-fwd`, once each, in that
   order. A reload plays `B01-mag-out` then `B01-mag-in`.
6. **B03:** firing both barrels plays `B03-fire` twice; the reload plays
   its cues once each in time order.
7. **Dart surfaces:** a hit on a Foamer part plays `DT-hit-foamer`, on a
   wood voxel target `DT-hit-wood`, on a plain collider `DT-hit-hard`; a
   slug hit plays `DT-slug-hit`. Hits are at the hit point.
8. **Foamers:** a standard-dart kill of an F01 plays `FX-wound` for each
   hit and `FX-topple` once; a broken leg plays `FX-part-off` once; a pop
   plays `FX-pop` once; a walking F01 plays footsteps at about two per
   walk cycle (within one over 3 s).
9. **Player:** moving 16 m on the ground at walking speed plays
   `PL-step-hard` 10 times (plus or minus 1); none while airborne; a jump
   plays `PL-jump`; a landing at 8 m/s plays `PL-land-hard` and one at
   3 m/s `PL-land-soft`.
10. **B04 loop:** one loop is created however long fire is held; its
    volume follows `wheelSpeed` and is 0 a moment after the wheels stop.

## Done when

- [ ] `npm test` passes (all old tests unchanged, 10 new).
- [ ] `npx tsc --noEmit` and `npm run build` pass.
- [ ] No em or en dashes anywhere you wrote (check with
      `perl -CSD -ne 'print "$ARGV:$.\n" if /\x{2014}|\x{2013}/' $(git ls-files | grep -vE '\.(png|glb|webp|jpg)$')`).
- [ ] A dated `HANDOFF.md` log entry at the top of the Log (`date +%F`):
      what was built, every callback field added to an existing module,
      decisions and why, what is unverified. Do not delete or rewrite
      other entries. Set the AUD-01 row in `PLAN.md` to "Pi (review)".
- [ ] Committed on `aud-01` in the three stages, each message ending with
      `Co-Authored-By: Qwen3.8-27B via Pi <noreply@local>`. **Do not
      merge and do not push.**

Skip the browser check: the reviewer listens on the range and tunes the
cue times, volumes and recipes by ear.

## Known limits (do not build in this task)

- No music (none exists yet) and no settings menu (UI-01); the buses are
  ready for both.
- Only the sounds the current game can trigger. The shield, melee, the
  vacuum tool, pickups, arenas, other Foamers and blasters B02 and B05 to
  B08 get their hooks with their own tasks, using the IDs already in
  `design/SOUNDS.md`.
- No dart whiz yet (no Foamer shoots darts at the player).
- No reverb or occlusion.

## If something is unclear

Stop and write the question at the top of your HANDOFF entry rather than
guessing. Do not change the public API of existing modules beyond the
callback fields this card allows.
