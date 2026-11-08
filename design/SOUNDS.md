# DART sound list

Every sound the game needs, for Paul to record or source. 2026-11-02.

**Slice** marks what the vertical slice (P1, due 2026-11-29) needs: B01,
B03, B04, the F01, F02 and F05 Foamers, the player, the shield and the
basics. Everything else can come later. **Takes** is how many different
versions to record, so repeated sounds do not sound identical.

**Suggested source**:
- **Blaster**: record your own foam blasters (PLAN.md 8.3).
- **Foley**: record everyday things (ideas given).
- **Library**: source it.
- **Code**: can be made in Web Audio if you would rather not record it.
  You only need to record these if you want something better.

Names in [brackets] are yours to choose (Foamers, the shield, melee weapons
and the tool are unnamed so far).

## 1. How to deliver

- **Recordings:** WAV, 48 kHz, 24 bit, mono. Microphone 20 to 30 cm away,
  quiet room, no music or voices. One second of silence before and after.
  Record a few more takes than the list asks for; I pick the best.
- **Where:** put raw files in `audio-raw/` in the repo folder. It is
  gitignored, so raw recordings never go public. I edit, layer and loop
  them, and only the finished files go into `public/audio/`.
- **File names:** the sound's ID plus a take number, for example
  `B01-fire-03.wav`. A whole session in one long file is fine too; then
  say out loud which sound is next.
- **Sourced sounds:** CC0 is best. CC BY is fine (credited in
  `assets/MANIFEST.md`). No "non-commercial", "no derivatives" or
  "personal use" licences, because the repo is public and the files are
  redistributed. Keep the page link and licence name for each one.
- **No trademarks:** nothing with a brand jingle or a recognisable sound
  from another game.

## 2. Blasters

### 2.1 Shared by every blaster

| ID | Sound | Slice | Takes | Suggested source |
|---|---|---|---|---|
| BX-draw | Blaster raised into view after a switch (plastic rattle, grip slap) | Yes | 3 | Blaster: shake and grab one |
| BX-holster | Blaster lowered | Yes | 2 | Blaster |
| BX-dry | Trigger pulled with an empty magazine (dry click) | Yes | 3 | Blaster: per blaster if they sound different |
| BX-mod-on | Mod attached on the range or at a station (snap, click) | Yes | 2 | Foley: click a plastic part on |
| BX-mod-off | Mod removed | Yes | 2 | Foley |
| BX-pickup | Picking up a new blaster (bigger than ammo) | Yes | 2 | Foley plus a short sting (Code) |

### 2.2 B01 The Dartman (pump, 3 darts a shot)

| ID | Sound | Slice | Takes | Suggested source |
|---|---|---|---|---|
| B01-fire | Shot: spring release, air puff, three darts leaving | Yes | 6 | Blaster |
| B01-pump-back | Pump pulled back | Yes | 4 | Blaster |
| B01-pump-fwd | Pump pushed home (the satisfying clack) | Yes | 4 | Blaster |
| B01-mag-out | Magazine out | Yes | 3 | Blaster |
| B01-mag-in | Magazine in, click | Yes | 3 | Blaster |
| B01-slug-fire | Slug mod shot: heavier, deeper thump | Yes | 4 | Blaster: fire with a heavy dart, or layer |
| B01-double-fire | Double pump mod shot: six darts, bigger | Later | 4 | Blaster: layered from B01-fire |

### 2.3 B02 Musketeer (semi-auto sidearm, never empty)

| ID | Sound | Slice | Takes | Suggested source |
|---|---|---|---|---|
| B02-fire | Light, quick shot | Later | 6 | Blaster |
| B02-slide | Slide or prime after each shot, if it has one | Later | 4 | Blaster |
| B02-mag-out | Magazine out | Later | 3 | Blaster |
| B02-mag-in | Magazine in | Later | 3 | Blaster |
| B02-burst | Burst mod: three quick shots as one sound | Later | 3 | Blaster: layered |
| B02-fire-heavy | Heavy rounds mod: slow, big thud | Later | 4 | Blaster |
| B02-reload | Magazine in, the never empty reserve | Later | 3 | Blaster |

### 2.4 B03 Leviathan (break-action double barrel)

| ID | Sound | Slice | Takes | Suggested source |
|---|---|---|---|---|
| B03-fire | One barrel: a big spread of darts, deep boom | Yes | 6 | Blaster |
| B03-fire-both | Both barrels at once (mod 1) | Yes | 4 | Blaster: layered |
| B03-latch | Latch turned to open | Yes | 3 | Blaster or Foley: a heavy switch |
| B03-break-open | Barrels drop open | Yes | 3 | Blaster or Foley: a hinge |
| B03-eject | Spent shells thrown out | Yes | 3 | Foley: two plastic tubes flicked out |
| B03-shell-drop | A shell hitting the floor | Yes | 4 | Foley: drop a plastic tube |
| B03-load | Shells pushed in | Yes | 4 | Foley |
| B03-close | Barrels snapped shut | Yes | 4 | Blaster or Foley |
| B03-quad-fire | Quad barrel mod shot | Later | 4 | Blaster: layered |

### 2.5 B04 Shredder (flywheel full-auto)

| ID | Sound | Slice | Takes | Suggested source |
|---|---|---|---|---|
| B04-rev-up | Flywheels spinning up (rising whine) | Yes | 3 | Blaster: rev it |
| B04-rev-loop | Flywheels at full speed, steady (I loop it) | Yes | 2 long (5 s) | Blaster |
| B04-rev-down | Flywheels spinning down | Yes | 3 | Blaster |
| B04-fire | One dart through the wheels (played on each shot over the loop) | Yes | 8 | Blaster: single shots |
| B04-burst | A full-auto burst, for reference | Yes | 3 | Blaster: hold the trigger |
| B04-mag-out | Magazine out | Yes | 3 | Blaster |
| B04-mag-in | Magazine in | Yes | 3 | Blaster |
| B04-bounce | Bounce mod: dart ricochets to another target (a springy zip) | Later | 4 | Code or Foley |

### 2.6 B05 Shrike (precision, zoom)

| ID | Sound | Slice | Takes | Suggested source |
|---|---|---|---|---|
| B05-fire | Strong spring shot, sharp | Later | 6 | Blaster: a spring blaster |
| B05-bolt-back | Bolt or prime back | Later | 3 | Blaster |
| B05-bolt-fwd | Bolt or prime forward | Later | 3 | Blaster |
| B05-zoom-in | Scope zoom in | Later | 2 | Foley: a lens twist or click |
| B05-zoom-out | Scope zoom out | Later | 2 | Foley |
| B05-mag-out | Magazine out | Later | 3 | Blaster |
| B05-mag-in | Magazine in | Later | 3 | Blaster |
| B05-whistle | Precision dart in flight (whistler) | Later | 3 | Blaster: a whistler dart, or Code |
| B05-pierce | Heavy round passing through a Foamer | Later | 4 | Foley: a punch through foam |
| B05-bolt | Bolt worked between shots (played once on the bolt cycle; the game's merged id for bolt-back and bolt-fwd) | Later | 3 | Blaster |
| B05-reload | Magazine out and in (the game's merged id for mag-out and mag-in, played twice on the reload cues) | Later | 3 | Blaster |

GAME-09e wired four of these into the game: `B05-fire`, `B05-whistle`,
`B05-bolt` and `B05-reload`. The last two are one id each for what the
recording pass may split in two; record the six sounds above separately
and the data can go back to them. `B05-whistle` is a placeholder with no
wiring yet (game-sounds.ts has no per-dart loop, as with B06-spin).

### 2.7 B06 The Standard (heavy full-auto, mega darts)

| ID | Sound | Slice | Takes | Suggested source |
|---|---|---|---|---|
| B06-rev-up | Motor spin-up, deeper than B04 | Later | 3 | Blaster |
| B06-rev-loop | Motor at speed (loop) | Later | 2 long | Blaster |
| B06-rev-down | Spin-down | Later | 3 | Blaster |
| B06-spin | Motor at speed, deeper than B04 (GAME-09d placeholder id) | Later | 2 long | Blaster |
| B06-fire | One mega dart, heavy | Later | 8 | Blaster: mega darts |
| B06-belt | Drum or belt feeding (loop under fire) | Later | 2 long | Foley: a ratchet |
| B06-reload | Drum or box out and in | Later | 3 each | Blaster |
| B06-bipod | Bipod down, bipod up | Later | 2 each | Foley |

### 2.8 B07 Collateral (launcher)

| ID | Sound | Slice | Takes | Suggested source |
|---|---|---|---|---|
| B07-fire | Launch: big air thump | Later | 5 | Blaster: a mega dart blaster, layered |
| B07-pump | Pump back and forward | Later | 3 each | Blaster |
| B07-reload | GAME-09f: a round pushed into the drum (placeholder synth) | Later | 3 | Foley |
| B07-detonate | GAME-09f: the remote detonate press (placeholder synth) | Later | 2 | Foley: a clicker |
| B07-load | A round pushed in | Later | 3 | Foley |
| B07-flight | Round in flight (loop) | Later | 2 | Code or Foley: a whoosh |
| B07-detonate-click | Remote detonate mod: the button | Later | 2 | Foley: a clicker |

### 2.9 B08 Firehose (gatling, foam balls)

| ID | Sound | Slice | Takes | Suggested source |
|---|---|---|---|---|
| B08-spin-up | Barrels spinning up | Later | 3 | Blaster or Foley: a hand drill with a rattle |
| B08-spin-loop | Barrels at speed (loop) | Later | 2 long | Blaster or Foley |
| B08-spin-down | Spin-down | Later | 3 | Blaster or Foley |
| B08-fire | One foam ball shot (played fast over the loop) | Later | 8 | Blaster: a ball blaster |
| B08-reload | Hopper or drum refill (balls pouring) | Later | 3 | Foley: pour foam balls into a box |

## 3. Darts, impacts and explosions

| ID | Sound | Slice | Takes | Suggested source |
|---|---|---|---|---|
| DT-whiz | Dart flying past close to the player | Yes | 4 | Foley: flick a dart past the mic |
| DT-hit-foamer | Dart hitting a Foamer (soft thwap) | Yes | 6 | Foley: dart into a foam block |
| DT-hit-hard | Dart hitting concrete or brick (tick and bounce) | Yes | 6 | Foley: dart at a wall |
| DT-hit-wood | Dart hitting wood | Yes | 4 | Foley |
| DT-hit-cardboard | Dart hitting cardboard | Yes | 4 | Foley: dart at a box |
| DT-hit-plastic | Dart hitting plastic | Yes | 4 | Foley |
| DT-carve | Surface crumbling where a dart carves it | Yes | 6 | Foley: crumble styrofoam or dry sponge |
| DT-floor | Spent dart landing and rolling on the floor | Yes | 6 | Foley: drop darts |
| DT-stick | Suction dart sticking (thwop) | Later | 4 | Foley: a suction dart on glass |
| DT-slug-hit | Slug hit: heavy thud | Yes | 4 | Foley: a heavy foam hit |
| DT-mega-hit | Mega dart hit | Later | 4 | Foley |
| DT-ball-hit | Foam ball hitting and bouncing | Later | 6 | Foley: foam balls at a wall |
| EX-small | Small explosion (B05 explosive round, B06 every 5th dart): a foam pop with a puff | Later | 4 | Code plus Foley: pop a balloon full of foam bits |
| EX-big | Big blast (B07): deep foam boom | Later | 4 | Library plus Foley layer |
| EX-cluster | Cluster bomblets, four small pops | Later | 3 | Layered from EX-small |
| EX-debris | Voxel chunks raining down after a blast | Later | 4 | Foley: crumbled foam dropped on a board |
| FX-explode | The shared explosion (GAME-09d): a foam pop with a puff | Later | 4 | Code plus Foley: pop a balloon full of foam bits |

## 4. Foamers

Foamers are foam and toothless. Their voices (if they have any) should be
grumbly, squeaky or bubbly, never screams or pain. **Do they have voices at
all?** That is your call; the vocal rows below are marked "Optional".

### 4.1 Shared by every Foamer

| ID | Sound | Slice | Takes | Suggested source |
|---|---|---|---|---|
| FX-step-small | Footstep, small Foamer (squishy) | Yes | 6 | Foley: squeeze a wet sponge |
| FX-step-medium | Footstep, person sized | Yes | 6 | Foley: a foam block on the floor |
| FX-step-heavy | Footstep, big Foamer (deep squish thud) | Yes | 6 | Foley: a big cushion dropped |
| FX-wound | Fizz of foam bubbles from a wound | Yes | 6 | Foley: shaving foam, or a fizzing tablet |
| FX-part-off | A part breaking off (rip of foam) | Yes | 6 | Foley: tear a foam sponge |
| FX-part-land | The broken part bouncing on the floor | Yes | 6 | Foley: drop foam pieces |
| FX-stagger | Staggered, finisher ready (wobbly jelly sound) | Yes | 3 | Foley or Code |
| FX-topple | Going down, body hitting the floor | Yes | 4 | Foley: drop a cushion |
| FX-fizz-out | Downed Foamer fizzing away (loop, about 3 s) | Yes | 3 | Foley: fizzing tablet in water |
| FX-sink | Sinking into the floor (soft slurp) | Yes | 3 | Foley |
| FX-pop | Catastrophic pop into chunks (the big satisfying one) | Yes | 6 | Foley: balloon pop layered with foam tearing |
| FX-chunk | Pop chunks bouncing | Yes | 6 | Foley: foam bits thrown on a floor |
| FX-crawl | Crawling after losing a leg (drag loop) | Later | 2 | Foley: drag a foam block |
| FX-spawn | Foamer coming out of a Foam rift | Yes | 4 | Foley plus Code |
| FX-alert | Spots the player (Optional vocal) | Yes | 4 | Your voice through a filter, or Code |

### 4.2 Per Foamer

Optional vocals are a short grunt or squeak per type, a few takes each, if
Foamers have voices.

The slice Foamers, one row per sound:

| ID | Sound | Slice | Takes | Suggested source |
|---|---|---|---|---|
| F01-swing | F01 (fodder grunt): club swing, a whoosh | Yes | 4 | Foley: swing a pool noodle |
| F01-bonk | F01: club hitting the player | Yes | 4 | Foley: pool noodle on a cushion |
| F02-windup | F02 (lanky ball thrower): the wind-up, held before the throw | Yes | 4 | Foley or Code: a rising creak |
| F02-throw | F02: the ball leaving the hand | Yes | 4 | Foley | 
| FB-hit | F02: foam ball hitting the player | Yes | 4 | Foley: foam ball on a cushion |
| FB-burst | F02: foam ball breaking up on the world | Yes | 4 | Foley: tear a sponge |
| F05-snort | F05 (charging bull): charge wind-up | Yes | 3 | Foley: your voice for the snort |
| F05-run-loop | F05: charge run (loop) | Yes | 2 | Foley: fast thumps on a cushion |
| F05-impact | F05: charge hitting a wall or the player | Yes | 4 | Foley: drop a heavy cushion |
| F05-stun | F05: stunned after hitting a wall | Yes | 2 | Foley or Code |
| F03-yip | F03 (small fast biter): the yip that wakes a pack | Yes | 3 | Foley or Code |
| F03-nibble | F03: the nibble | Yes | 3 | Foley: a quick snap of foam |
| F03-scurry | F03: skittering steps (repeated patter) | Yes | 4 | Foley: light quick taps |
| F04-alert | F04 (shield trooper): the shield lifts and the blaster comes up before a volley | Yes | 3 | Foley: a plastic clack, then a soft spring |
| F04-volley | F04: three foam balls over the shield, one shot | Yes | 3 | Foley: a toy blaster puff, three quick shots |
| F04-shieldhit | F04: a dart thudding into the shield plate | Yes | 4 | Foley: a dart on a foam board |
| F04-shieldbreak | F04: the shield plate coming away | Yes | 3 | Foley: a foam plate tearing off velcro |

The other Foamers (IDs given when each is built):

| ID | Foamer | Sounds | Slice | Suggested source |
|---|---|---|---|---|
| F06 | Floater | GAME-10c placeholder IDs: F06-hum (float loop), F06-spit (jaw, fan or big blob), F06-blobBounce (a small blob off a wall) | Later | Foley plus Code |
| F06-hum | Floater: the float hum under it while its fins hold it up (loop) | Yes | 2 | Foley plus Code |
| F06-spit | Floater: the jaw snapping shut to spit a fan of blobs or the big one | Yes | 3 | Foley: a wet toy squeeze |
| F06-blobBounce | Floater: a small blob off a wall, a short foam tick | Yes | 4 | Foley: a foam ball off wood |
| F07 | Gorilla brawler | Leap, slam, shockwave ring travelling | Later | Foley: drop something heavy on foam |
| F07-crouch | GAME-10f placeholder ID: the Brawler folds before its leap (the telegraph) | Yes | 3 | Foley: a foam cushion compressing, with a creak |
| F07-punch | GAME-10f placeholder ID: the Brawler's left-fist punch (with the sword gone) | Yes | 3 | Foley: a heavy whoosh into a foam board |
| F07-swing | GAME-10i placeholder ID: the Brawler's sword swing, a broad whoosh off the foam blade | Yes | 3 | Foley: a soft saw through the air, a light crop off a foam mat |
| F07-sword-break | GAME-10i placeholder ID: the Brawler's foam sword chipping away, over the generic part-thump | Yes | 2 | Foley: a bright foam snap, with falling crumbs |
| F07-land | GAME-10f placeholder ID: the Brawler lands and the shockwave starts | Yes | 3 | Foley: drop something heavy on foam |
| F08 | Huge tank | Heavy steps, launcher volley, foam wall of balls | Later | Blaster plus Foley |
| F09 | Spider turret | Leg clicks (loop), turret spin, pellet stream (loop) | Later | Foley plus Blaster |
| F09-spinup | GAME-10g placeholder ID: the Crawler's barrels spin up before the stream (the telegraph) | Yes | 2 | Foley: a ratchet winding, rising |
| F09-pellet | GAME-10g placeholder ID: one pellet leaving the barrels (cheap; the cap is what bounds a storm) | Yes | 6 | Blaster: a pellet dry-firing, thinned |
| F09-step | GAME-10g placeholder ID: the Crawler's heavy foot plant | Yes | 4 | Foley: boot on a foam mat, with a click |
| F08-windup | GAME-10h placeholder ID: the Trawler lifts both launchers before the wall (the telegraph) | Yes | 2 | Foley: a heavy wind, with a rising clunk |
| F08-wall | GAME-10h placeholder ID: one wall of foam balls leaving the launchers (one sound per wall, not per ball) | Yes | 3 | Blaster: a wide low thump, with a hiss of foam |
| F08-step | GAME-10h placeholder ID: the Trawler's heavy foot plant (the heaviest: health 80, speed 0.9) | Yes | 4 | Foley: a big boot, low and slow |
| F10-jet | GAME-10j placeholder ID: the Turbo's jet hiss under it while its jets hold it up (loop; stop when the last jet breaks) | Yes | 2 | Foley: a roll of light air hisses, with a small muddy whistle in it |
| F10-shot | GAME-10j placeholder ID: the homing ball leaving the wrist launcher (one per shot, the cap restricts side-by-side ones) | Yes | 4 | Blaster: a soft "pffft" on drylatch, with a small rising ring |
| F10-fall | GAME-10j placeholder ID: the Turbo dropping to the floor when the last jet breaks (one, when the jet hiss stops) | Yes | 2 | Foley: a soft heavy flop of foam on the floor |
| F10 | Flyer with jets | GAME-10j placeholder IDs: F10-jet (jet loop), F10-shot (homing shot), F10-fall (the drop to the floor) | Later | Foley plus Code |
| F11-swing | GAME-10k placeholder ID: the Seawall's mace swing (the overhead and the sweep) | Yes | 3 | Foley plus Blaster: a heavy wooden whoosh, deeper than the Roamer's club |
| F11-windup | GAME-10k placeholder ID: the Seawall's finisher: the slow high wind-up the player must hear to time the parry | Yes | 2 | Foley: a long low rising creak |
| F11-shield-break | GAME-10k placeholder ID: the Seawall's tower shield breaking off after its parries | Yes | 2 | Foley: a hard crack, a board falling apart |
| F11 | Armoured knight | Heavy armoured steps, mace swings, overhead slam, sweep, the slow parry wind-up (must be easy to hear), shield hits | Later | Foley |
| F12-crouch | GAME-10m stage 4 placeholder ID: the Ambusher folds before its pounce (the telegraph), the card's low hiss | Yes | 2 | Foley: air through a foam tube, going down |
| F12-pounce | GAME-10m stage 4 placeholder ID: the Ambusher's pounce leaving the crouch (the launch; the landing is a hit through the ordinary path) | Yes | 3 | Foley: a spring board releasing, with a whoosh |
| F12-burst | GAME-10m stage 4 placeholder ID: the Ambusher bursting out of its foam growth (played by the ambush page where it comes out) | Yes | 3 | Foley: a foam block popping apart, crumbs after |
| F12 | Ambusher in foam growths | Rustle in a growth, pounce, landing | Later | Foley |
| F13-heal | GAME-10l stage 3 placeholder ID: the Biomechanic's wand while it streams an ally a mend (loop, only while the stream draws; stop the moment the chain hides) | Yes | 2 | Foley: a spray bottle held open, bright and airy, with a soft core-froth in it |
| F13-spray | GAME-10l stage 3 placeholder ID: the short damaging spray at the player, one puff as the run starts (the run then pours the small hits quietly) | Yes | 2 | Foley: a hard pressurized "tssss" |
| F13-tank-break | GAME-10l stage 3 placeholder ID: the tank breaking off, the end of the healing and the spray (over the part-thump) | Yes | 2 | Foley: a pressurized can popping apart |
| F13 | Medic | GAME-10l stage 3 placeholder IDs: F13-heal (stream loop), F13-spray, F13-tank-break; healing sparkle on another Foamer | Later | Foley: spray bottle |
| BOSS 1 to 3 | Bosses | Written when you design them | Later | |

## 5. Player

### 5.1 Movement and health

| ID | Sound | Slice | Takes | Suggested source |
|---|---|---|---|---|
| PL-step-hard | Footstep on concrete or brick | Yes | 8 | Foley: trainers on concrete |
| PL-step-wood | Footstep on wood | Yes | 8 | Foley |
| PL-step-foam | Footstep on foam growth | Later | 8 | Foley: walk on a foam mat |
| PL-jump | Jump push-off | Yes | 4 | Foley |
| PL-land-soft | Small landing | Yes | 4 | Foley |
| PL-land-hard | Landing from high up | Yes | 4 | Foley |
| PL-dash | Dash (quick whoosh) | Yes | 4 | Foley: swing a towel, or Code |
| PL-dash-ready | Dash charge back | Yes | 2 | Code |
| PL-mantle | Grabbing a ledge and climbing up | Yes | 4 | Foley: hands slap a table edge |
| PL-hurt | Player hit by a Foamer attack (foam thump, not pain) | Yes | 6 | Foley |
| PL-armour-hit | Hit while armour soaks it | Yes | 4 | Foley: hit a padded jacket |
| PL-low-health | Low health warning | Yes | 1 loop | Code |
| PL-death | Player out | Yes | 2 | Foley plus Code |
| PL-respawn | Back at a checkpoint | Yes | 2 | Code |

### 5.2 Shield, melee, finishers, tool

| ID | Sound | Slice | Takes | Suggested source |
|---|---|---|---|---|
| SH-raise | [Shield] raised | Yes | 3 | Foley: a plastic disc |
| SH-block | Attack blocked | Yes | 6 | Foley: hit the disc with foam |
| SH-parry | Parry (the "boing") | Yes | 4 | Foley: a spring or ruler twang, or Code |
| SH-parry-hit | Parried ball hits the thrower | Yes | 3 | Foley: a solid foam ball thud |
| SH-parry-return | Parried shot flying back | Yes | 3 | Code |
| SH-throw | Shield thrown (frisbee whoosh) | Yes | 4 | Foley: throw a frisbee |
| SH-ricochet | Thrown shield bouncing off a Foamer | Yes | 6 | Foley |
| SH-catch | Shield caught back on the arm | Yes | 3 | Foley |
| SH-saw | Foam saw: the disc grinding a Foamer (a loop, pitched by the spin) | Yes | 3 | Foley: a foam block on a spinning toy |
| SH-sawEnd | Foam saw: the grind ends and the disc tears free | Yes | 3 | Foley: a soft tearing pop |
| SH-lock | Shield charge: a target is locked | Yes | 3 | Code: a short rising blip |
| SH-charge | Shield charge rush (the whoosh) | Yes | 3 | Foley: a sharp exhale past the ear |
| SH-charge-hit | Shield charge impact (the thud into the Foamer) | Yes | 3 | Foley: a heavy cushion drop |
| ML1-swing, ML1-hit | [Melee 1], fast and light: swing, hit | Later | 6 each | Foley: a pool noodle |
| ML2-swing, ML2-hit | [Melee 2], slow and big: swing, hit | Later | 4 each | Foley |
| ML3-charge, ML3-slam | [Melee 3]: charging, the slam | Later | 3 each | Foley |
| ML-empty | Melee out of charges | Later | 2 | Code |
| ML-swing | GAME-06 placeholder: the baton's sweep | Now (synth) | 0 | Synth in data/sounds.json |
| ML-hit | GAME-06 placeholder: the baton's contact | Now (synth) | 0 | Synth in data/sounds.json |
| ML-bash | GAME-06 placeholder: the shield bash | Now (synth) | 0 | Synth in data/sounds.json |
| ML-charge | GAME-06 placeholder: a parry or timer refills a charge | Now (synth) | 0 | Synth in data/sounds.json |
| FN-finisher | Finisher: squeeze, wring out, pop | Later | 3 per finisher | Foley: wring a wet sponge |
| VC-start | [Vacuum] switching on | Later | 2 | Foley: a hand vacuum |
| VC-suck | Sucking loop | Later | 2 long | Foley |
| VC-done | Pulling the Foamer in, darts spat out | Later | 3 | Foley plus a dart rattle |
| VC-empty | Tool not ready | Later | 2 | Code |
| VC-ready | Charge full, ready to use again | Later | 2 | Code |

### 5.3 Pickups

| ID | Sound | Slice | Takes | Suggested source |
|---|---|---|---|---|
| PU-health | Health [Fizz] picked up | Yes | 3 | Foley plus Code |
| PU-armour | Armour [Padding] picked up | Yes | 3 | Foley: pat a cushion |
| PU-ammo | Darts picked up (rattle) | Yes | 4 | Foley: shake a box of darts |
| PU-token | Upgrade token found | Later | 2 | Code |
| PU-toy | Collectible toy found | Later | 2 | Code plus Foley: a squeaky toy |

## 6. Levels and world

| ID | Sound | Slice | Takes | Suggested source |
|---|---|---|---|---|
| LV-arena-lock | Arena seals (doors slam, a sting) | Yes | 2 | Foley plus Code |
| LV-rift-open | Foam rift opening for a wave | Yes | 3 | Foley plus Code |
| LV-wave | Next wave starting | Yes | 2 | Code |
| LV-arena-clear | Arena cleared, doors open | Yes | 2 | Code plus Foley |
| LV-door | Door opening and closing | Yes | 2 each | Foley |
| ENV-station-grant | A mod station grants its mod (a rising two-note blip) | Later | 2 | Code |
| ENV-station-spent | A used station, use key pressed (a low dry buzz) | Later | 2 | Code |
| LV-switch | Switch or button | Yes | 3 | Foley |
| ENV-button-press | Toy button pressed, cap squashes and lights | ENV-02 | 3 | Code: a click over a short rising tone |
| ENV-button-dead | Toy button pressed again, nothing happens | ENV-02 | 2 | Code: a flat dull click |
| ENV-press-windup | The crushing press telegraphs: the head shakes and its light comes on | ENV-04 | 2 | Code: a rising electric whine over a low rattle |
| ENV-press-slam | The press lands: the head hits the pad | ENV-04 | 3 | Code: a heavy thud, a low boom under a fast decaying hit |
| LV-key | Key picked up | Later | 2 | Code |
| LV-secret | Secret found | Later | 1 | Code |
| LV-wall-break | Wall blasted through to a secret | Later | 3 | Foley: crumble a big polystyrene sheet |
| LV-growth-break | Foam growth destroyed | Later | 4 | Foley |
| LV-station | Upgrade station used | Later | 2 | Code |
| LV-checkpoint | Checkpoint reached | Yes | 1 | Code |
| LV-exit | Level exit | Yes | 1 | Code |
| AMB-level | Ambience loop per setting (room tone, distant hum) | Yes | 1 per setting, 30 s | Foley: a quiet building |
| AMB-foam | Foam dimension ambience (bubbling, fizzing) | Later | 30 s | Foley |

## 7. Menus and HUD

| ID | Sound | Slice | Takes | Suggested source |
|---|---|---|---|---|
| UI-move | Moving between menu items | Yes | 1 | Code |
| UI-select | Select | Yes | 1 | Code |
| UI-back | Back | Yes | 1 | Code |
| UI-pause | Pause and resume | Yes | 1 each | Code |
| UI-buy | Upgrade bought | Later | 1 | Code |
| UI-no | Cannot afford, not allowed | Later | 1 | Code |
| HUD-hitmark | Hit confirm tick (optional) | Yes | 1 | Code |
| HUD-kill | Pop confirm (optional) | Yes | 1 | Code |
| HUD-low-ammo | Low ammo click | Yes | 1 | Code |

## 8. Music

Direction: pop-punk, metal lite (PLAN.md 7.7). Each track is two layers
that play in sync: a calm exploration layer and a combat layer that comes
in when an arena locks. Same tempo and key for both layers; stems as
separate WAV files.

| ID | Track | Slice |
|---|---|---|
| MU-menu | Title and menu | Yes |
| MU-act1 | Act 1: exploration and combat layers | Yes |
| MU-act2 | Act 2: exploration and combat layers | Later |
| MU-act3 | Act 3: exploration and combat layers | Later |
| MU-boss1 to 3 | One per boss | Later |
| MU-clear | Short sting when an arena clears | Yes |
| MU-credits | End credits | Later |

## 9. Voice

None planned. If there is a narrator or a player voice later, it goes here
(PLAN.md 8.3, [Paul]).
