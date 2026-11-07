# Handoff

Running record of what is built, what was decided, and what the next session
should know. Newest log entry at the top. The plan is `PLAN.md`; the rules are
`CLAUDE.md`.

## Status

GAME-10j stage 1 in progress 2026-11-07 (Qwen 3.8-27B via Pi, branch
`game-10j`): the F10 Turbo has its palette look, its type (the health
30 jet flyer, hover 4 m, the jets a weak point, the bonk as fallback) and
its flight on the F06's float path, with four legs to walk on when both
jets are gone. New tests in `tests/foamers/f10-fly.test.ts` and
`tests/ai/f10-brain.test.ts`. `npx tsc --noEmit`, `npx vitest run`
(626 pass, 2 skipped) and `npm run build` clean. Not checked by eye:
the palette, the flight, the pose of the shot (no browser here). Stage 2
(its homing ball, its sounds) is next.

LVL-04b stage 3 merged locally 2026-11-07, not pushed (card `tasks/LVL-04b.md`, DeepSeek V4.1 Flash via Pi): the A6
Yard gauntlet and the lit lift, the last stage. Past the Ring's north door
a 4 m corridor opens into a 44 x 36 m yard with a 9 m ceiling and six
destructible islands, one 3.2 m voxel volume each and 2.5 m tall, in two
zigzag chains with 6.2 m gaps so the centre lane stays a charge line.
Wave 1 is 2 Darters from the short ends and 8 Swarmers from the floor
rifts; wave 2 is 3 Darters, 6 Roamers and 4 Swarmers, 13 in all, one past
the KIT's 12 alive at Normal, so its spawns are held 1.6 s apart and the
page's spawn call refuses at the cap: 12 stand at once and the 13th
arrives when one dies. A6 and A7 ammo, 12 shells each, sit at the two long
ends. The temporary exit pad and its 6 x 6 m room are gone: the exit is a
3 x 3 m lime pad under a lime-light panel on white walls, 30 m from the
yard centre through the north door. `npx tsc --noEmit`, full
`npx vitest run` (615 pass, 2 skipped) and `npm run build` clean. Not
checked by eye: the yard from the Ring's door, the six islands and their
jump gaps, whether the lift reads as the brightest thing at 30 m, the
13-Foamer wave in play (only run in the test's model), and the lift's
completion trigger in a browser.

GAME-10i merged locally 2026-11-07, not pushed (card `tasks/GAME-10i.md`, Qwen 3.8-27B
via Pi, branch `game-10i`): the F07 Brawler carries its lime foam sword.
Stage 1: the greybox right fist is gone; a 1.5 m rounded capsule blade (six
voxels wide: 0.3 m) is parented to `foreArmR` so it moves with the arm, a
lime hilt and an orange cross guard ride on it as children, and the left
fist stays. The sword is a breakable weapon part with its own health (11 on
a 45 hp Brawler, the weapon share in `data/foamers.json`), the way F09's
gun is. A new `swing` attack takes the right-hand punch's place: windup
0.8 s, strike 0.25 s, damage 16, it needs the sword, and it pins `range
2.4` on the attack, 0.7 m beyond the punch's `attackRange` 1.7 plus the
0.3 m grace (PLAN.md section 14 says how). With the blade gone
`chooseAttack` falls to the left-fist punch, whose `needs` are
`foreArmL` only. The leap slam, its crouch and the shockwave are
untouched. `windupMotion` / `strikeMotion` got a `swing` case: a wide
horizontal arc (back-left, across the body), rest at both ends. Stage 2:
`F07-swing` (whoosh, in place of the old punch sound while swinging) and
`F07-sword-break` (a bright snap over the generic part-off, a new
`sword-break` kind off `breakPart`) are placeholder synth IDs in
design/SOUNDS.md. New tests in `tests/foamers/brawler.test.ts`: the rig
shape, the sword taking dart damage and breaking off with hilt and
shield, at 2.2 m (inside the swing, outside the punch) it is a swing, and sword-less it is the left-fist punch. The leap and shockwave tests from GAME-10f pass unchanged.
`npx tsc --noEmit`, full `npx vitest run` (606 pass, 2 skipped) and
`npm run build` clean. Not verified: the turnaround render and the
windup and strike pose renders exist (design/foamers/,
tools/render-rig.ts) but were not checked by eye (no browser here); the moving
swing in play was not checked; the two placeholder sounds were not heard.

LVL-04b stage 1 merged locally 2026-11-07, not pushed (card
`tasks/LVL-04b.md`, DeepSeek V4.1 Flash via Pi, branch `lvl-04b`):
the A1 Pit and breather 2 in `data/levels/1-4.json`. The ring's north
wall opens into a 4 m corridor under the far yard; the Pit is 34 x 26 m
with the ring ledge at -9 and its floor at -13, a 7 m ramp up at each
short end, the centre block, two ring pillars and the west island over
a hole; two waves and a floor lock; A3 ammo on the west ledge. Breather
2 is 10 x 8 m past the north door, with the U2 and S3 marks, and the
temporary exit pad is there now. Stages 2 (the promoted-Darter Ring)
and 3 (the Yard and the lit lift) are later runs.
`npx tsc --noEmit`, full `npx vitest run` (589 pass, 2 skipped) and
`npm run build` clean. Not checked by eye: the whole Pit, both ramps,
the island over its hole, the corridor under the far yard, breather 2.

LVL-04b stage 2 merged locally 2026-11-07, not pushed (DeepSeek V4.1 Flash via Pi,
branch `lvl-04b`), not merged and not pushed: promoted Foamers and the
mini-boss Ring. A new top-level `promoted` block in
`data/foamers.json` holds `healthMultiplier` 1.5 and the part material
swaps (F05's chest and brow go `foam-purple-light`), and
`FoamerSystem.spawn` takes a fourth `promoted` flag that builds a cached
rig copy with that health and those plates, so ordinary spawns are
unchanged. The Ring (A2) sits past breather 2: 30 x 30 m, 8 m ceiling,
10 x 8 m block 3.5 m tall, doors in from the south and out to the north,
four 1.6 x 1.6 x 2.8 m foam-orange pillars, A4 (10) in the ring and A5
(6) on the block, two promoted Darters then six Swarmers at 50% of the
pair's health (`Wave.startsWithHealthShare` and `ArenaContext.aliveHealth`,
both new and optional), no third wave. The temporary exit pad moved from
breather 2 to a room past the Ring's north door. `npx tsc --noEmit`,
full `npx vitest run` (610 pass, 2 skipped) and `npm run build` clean.
Not checked by eye: the promotion's light purple plates on a Darter, the
Ring's ring and block, the four pillars, both ammo boxes, and that the
adds really arrive at half health in play (the rule is only stepped in
tests). Stage 3 (the A6 Yard and the lit lift) is done, in the first
Status paragraph above.

GAME-10h merged locally 2026-11-07, not pushed (card `tasks/GAME-10h.md`; stage 1
by Qwen 3.8 Flash Next via Pi, dgx-spark; stage 2 and the docs by Qwen
3.8-27B via Pi): the F08 Trawler, finished. Deep lime body and legs,
purple drum and shoulder nubs, orange launchers (turnaround sheets in
design/foamers/). The rig format has a cone shape, so shoulder spikes are
not blocked by the format, but the built Trawler does not have them: it
keeps the ellipsoid shoulder nubs as a shield look from CONTENT-PLAN 3.4
and the seen trio of limbs. It holds about 12 m on the Roamer's brain
(decideF02, no brain code change) and from 19 m winds up both launchers
for 1.0 s, fires one wall, and recovers 2.5 s. The wall is one flat row
across the aim line at the player's chest: 2 x 5 balls at 0.6 m apart,
9 m/s, flat, damage 8, orange, bursts on any geometry, not parryable
(CONTENT-PLAN gives F08 no P), 40 live at most. Two side-by-side balls
are left out at a seeded position (data seed plus the wall's number; the
same PRNG as the pellet stream; never at the row's ends), so a player
who reads it can step through. Each launcher is a weak point x2 and owns
its half: one gone means a half row (the gap still applies), both gone
means no wall, a walk in, and a stomp for 12 at base melee range. Three
placeholder sounds: F08-windup (both lift), F08-wall (one per wall, not
per ball), F08-step. Every other type is untouched (tests). tsc, all 588
tests and npm run build pass; no em or en dashes.

Not checked by eye (no browser here): the Trawler on the range, and in
particular the wall itself, reading and crossing a gap in play, the stomp
with both launchers gone, and the three sounds are not heard. The look is
the rendered turnaround sheets; play tuned nothing (the numbers are
proposals for Paul).

LVL-04a merged locally 2026-11-07, not pushed (card
`tasks/LVL-04a.md`, DeepSeek V4.1 Flash via Pi, branch `lvl-04a`):
Level 1-4 beats 1 to 5 in `data/levels/1-4.json`, loaded by
`arena.html?level=1-4` through a new entry in `src/arena/levels.ts`.
The forecourt (four foam dummies and the A1 ammo box), the 14 m corridor
and 16 x 12 m explore room (one Darter, one wave, locked in and out), the
A4 hall (18 x 44 m, six staggered columns, four rifts, 4 Swarmers plus a
Darter then 4 Roamers plus 2 Darters, A2 ammo at column 3), the mid-hall
alcove with its U1 mark, and the A8 bridge (two 16 x 16 m yards, a
4 x 24 m deck 9 m over an 8 m ring, `noLock`, two Darters, `escape` into
the ring) with a temporary exit pad on the ring. Beats 6 to 10 (the Pit,
breather 2, the mini-boss Ring, the Yard, the lift) are a later card.
`npx tsc --noEmit`, full `npx vitest run` (585 pass, 2 skipped) and
`npm run build` clean. Not checked by eye: every space, the charges down
the hall, the shield charge on the bridge, the drop.

LVL-03b merged locally 2026-11-07 (card `tasks/LVL-03b.md`, DeepSeek V4.1
Flash via Pi, branch `lvl-03b`), not pushed:
Level 1-3 beats 6 to 9 in `data/levels/1-3.json`: the hall chase (A4,
18 x 44 m, 12 Swarmers every 4 s, no lock), the 6 m drop that seals 3 s
after the landing, breather 2 (10 x 8 m, 35 darts, U2 and S3 marks), the
Ring gauntlet (A2, 30 x 30 m, 10 then 12 Swarmers then 4 Roamers, A5 and
A6 ammo, block reachable by a mantle chain) and the lit 3 m north exit.
`ArenaRunner` gained `noLock` and `escape`. Short tests: `tests/level`
90 pass, `tsc` and `npm run build` clean. Played by script from the
hall to "Level complete"; the spaces' look and the mantle chain onto the
Ring's block were not checked by eye.

GAME-10g merged locally 2026-11-07, not pushed (card `tasks/GAME-10g.md`,
Qwen 3.8 Flash Next via Pi): the F09 Crawler. Deep orange body, four
purple legs with shins, a lime twin-barrel gun on top. It keeps about
14 m on the Roamer's brain, and from 16 m winds up 0.8 s then streams 12
pellets, one every 0.1 s, at 22 m/s and 2 damage, spread 3 degrees by a
seeded PRNG. Cover stops every pellet. Its gun is a weak point (2x) and
its trigger: with the gun or both barrels gone it cannot fire, walks in,
and stomps for 8 at 1.8 m. Played on the range: bursts of 12 (about 4 of
12 hit at 14 m), and with the gun broken off it walked in and stomped.
Not heard: the three placeholder sounds; numbers not play-tuned.

GAME-10f merged locally 2026-11-07, not pushed (card `tasks/GAME-10f.md`,
Qwen 3.8 Flash Next via Pi, branch `game-10f`): the F07 Brawler. Purple
body, orange armour pads, lime fists ([Paul]: sword or fists). It walks in
and punches like the Slowmer (45 health, punch 14), and between 5 and 12 m,
on a 6 s cooldown, it crouches 0.6 s and leaps an arc to 1.5 m short of
where the player was, landing a shockwave ring that grows at 9 m/s out to
8 m: a grounded player in its band is hurt 15 once, one in the air or
dashing is not. Both legs gone ends the leap. Full suite 553 pass, 2
skipped; `tsc` and `npm run build` clean. Played on the range: crouch,
leap, landing short, the ring and its one hit all seen. Not heard: the
three sounds; not tried in play: the jump and the dash through the band
(unit tested).

BUG-09 merged locally 2026-11-07, not pushed (card `tasks/BUG-09.md`, Qwen 3.8-27B
via Pi): `tests/foamers/finisher.test.ts` test 1 no longer flakes in full
runs. Two test-only fixes: the eight `settle` helpers in `tests/foamers/`
wait until `mesh.busy` clears instead of one `setTimeout(0)` (a slow
event loop could leave the trimesh collider missing or stale), and the
crossing hit starts at band + 0.5 so one dart's damage alone crosses,
instead of band + 2 which banked on the dart's bounce re-hit. In-process
probe: 2 of 80 failures before, 60/60 after. Test-only; not checked by
eye (nothing visual changed).

LVL-03a merged locally 2026-11-06, not pushed (card `tasks/LVL-03a.md`,
DeepSeek V4.1 Flash via Pi): Level 1-3 beats 1 to 5 in
`data/levels/1-3.json`, played as `arena.html?level=1-3`: the bay, explore
1, the Pit (A1), the breather, the Yard (A6) and a temporary exit. The
review moved two Pit rifts out from under the north ramp (a Swarmer stuck
under it). Played to "Level complete" with the waves cleared by script.
Full suite 520 pass, 2 skipped; `tsc` and `npm run build` clean.

GAME-10c merged locally 2026-11-06, not pushed (card `tasks/GAME-10c.md`, Qwen
3.8 Flash Next via Pi, branch `game-10c`): the F06 Floater. Lime floating
ball with purple fins and tendrils and an orange mouth, hovering 3 m over
the nav grid's ground with a slow bob, on the Roamer's brain at a 12 m
ring. It spits a fan of three small lime blobs that bounce twice off
geometry, and every fourth attack one big pink blob, parryable like the
Roamer's; the jaw drops to spit and takes 2.5 times damage while open.
A lost fin drops it to 1.2 m at 0.6 speed, both fins put it on the floor.
The review fixed blobs that burst on the floor with no bounce. Not
checked by ear: the three placeholder sounds. The parry of the big blob
is unit tested, not tried in play.

BUG-08 merged locally 2026-11-06, not pushed (card `tasks/BUG-08.md`,
DeepSeek V4.1 Flash via Pi): a Roamer that has gone
`brain.blockedRepathSeconds` (3 s) with no clear flight stops sidling its
ring and walks its path to the player. In the tower (player under the
slab) the Roamers now walk down and throw: 10 thrown, 10 hit in 30 s, in
the browser and headless. Full suite 511 pass, 2 skipped; `tsc` and
`npm run build` clean.

BUG-07 done 2026-11-06, awaiting review (card `tasks/BUG-07.md`, DeepSeek
V4.1 Flash via Pi, branch `bug-07`): a Roamer no longer throws when its
ball's arc cannot reach the player. In the Pit's wave 2 case the same 30 s
run went from 18 thrown, 0 reached, 17 burst to 13 thrown, 13 reached, and
the Roamer still throws 6 or more times in 30 s. Not checked by eye; the
browser was not opened. Not merged, not pushed. Full suite 505 pass, 2
skipped; `tsc` and `npm run build` clean.

LVL-02d stage 2 done 2026-11-06 on branch `lvl-02d`, awaiting review
(`tasks/LVL-02d.md`, DeepSeek V4.1 Flash via Pi): the nav grid holds four
walkable layers per cell (stage 1, committed) and the beat 5 tower (A5)
fills the bay beside the connecting corridor, four floors at 0, 5, 10 and
15 m up three ramps a player and a Foamer can both walk, with two lock-free
fights (2 Roamers, then 2 Roamers and a Slowmer) and a cardboard ceiling
plug that drops as one slab. Not checked by eye: the tower's look, the
climb in the browser, the plug's drop, the fight pacing. Not merged, not
pushed. Full suite 500 pass, 2 skipped; `tsc` and `npm run build` clean.

BUG-06 (the ball that overshot the player's capsule, so parries read as
hits from behind) is merged and live since 2026-11-06.

GAME-10e done 2026-11-06, awaiting review (`tasks/GAME-10e.md`, DeepSeek
V4.1 Flash via Pi): the F04 Blocker. Blockers walk to a line of slots
across the player, 1.2 m apart at 9 m, shields to the front inside a 120
degree arc; front darts do a twentieth of their damage and carve the plate
slowly, side and back darts do full damage. With the ranged token one
fires the type's three ball volley over the shield. The player's shield
charge staggers a Blocker 1.2 s with its shield down, which is the window
on the wall. A shot-away shield gives full damage and the Roamer's
keep-distance brain. Not checked by eye: the wall's look and read, the
parry fairness of the spread, the sounds, the frame cost of three. Full
suite 492 pass, 2 skipped; `tsc` and `npm run build` clean.

BUG-03 done 2026-11-06, awaiting review (`tasks/BUG-03.md`, Qwen 3.8-27B
via Pi): the nav grid bakes the level's solid voxel pieces, so a cell
inside a destructible block reads as an obstacle from the first frame a
Foamer can path and a cell's interior is never a stand-able floor. Not
checked by eye: Foamers walking round the Pit's central block in the
browser (the reviewer's).

GAME-09b stage 1 and 2 done 2026-11-06, awaiting review
(`tasks/GAME-09b.md`, DeepSeek V4.1 Flash via Pi): the chunk finish. A shot's
darts now carry a shot id, the muzzle and their blaster's `chunk` block
(B03, B01's slug mod; the others null). A killing dart hit that passes the
rule in `src/foamers/chunk.ts` becomes a chunk instead of a plain go down:
a sphere at that shot's mean hit point is carved through every part it
reaches, debris is thrown inside `chunk.debrisMax`, and the ragdoll goes
down with its push scaled by `chunk.push`. The rule needs the rig's tier in
`chunk.tiers` (Heavy, Elite, Boss) or the Foamer already finishable before
the shot began, and that shot's own damage inside `catastrophic.window` of
at least `chunk.minShare` of max health, hit within the blaster's
`rangeMetres` of the muzzle. The range page has a "Spawn weakened" row.
Not checked by eye: the hole's look, the burst density and spread, the push,
and the `FX-chunk` replay at the chunk (no browser here). Stage 3's range
switch is in; the area blast half of the card (B05 and B06 mods, B07) is
still open.

BUG-02 done 2026-11-06, awaiting review (`tasks/BUG-02.md`, Qwen 3.8-27B
via Pi): the watch helper lands parries against a lobbed ball, and packs
spawn on floor the grid says an agent can stand on. The parry's own unit
tests pass and the shield is untouched: the fault was the helper's
estimate. `parryNext()` asked straight-line distance over speed for a
ball on a gravity loft, so the raise landed out of the parry window
and the ball burst on the disc as a block (the six-try, zero-parry
from the GAME-06 and GAME-04b reviews). Now it asks `timeToImpact`, a
new shared pure function in `src/foamers/ball-time.ts` that steps a
copy of the ball with the projectile's own gravity and the page's step
and returns the step at which the flight segment reaches the player's
capsule spine (the shape the projectile's own raycast meets; read from
the eye minus `eyeHeight`, the page's own read). The helper waits that
time minus the shield's `parryLead` and then holds: on the game page
through `fixedStep`, on the range through the loop's own step (`parryWaitSec`),
which the helper cannot call. No parry rule or number changed.
`spawnPack()` now asks the grid before it places a member: a ring spot
is used only if an agent of the grid's size can stand on it (a new
canStandAt on the nav grid: the layer the feet sit near, autostep up,
full step down; a block's top face is walkable and reads as a top, not
a floor), and a blocked spot is stepped a few in along the angle
(data `pack.inboundStepMetres` 0.5, `inboundSteps` 4) before the member
is skipped (neither spawned nor counted, so a skipped member is
neither a pack slot nor a ghost the next pack must budget against).
Without a grid the placement is unchanged. The earlier `walkableAt`
was not the right ask: it read the lowest layer without a height, so
the Pit's central block called the column's top face a walkable floor.
Tests: `tests/foamers/ball-time.test.ts` (the straight ball and the
loft, read against the real `update` loop, within two steps; the old
line estimate off by more than a step), `tests/shield/parry-next.test.ts`
(the helper's own wait, raise, and a parry, not a block, plus the
card's demonstration: the old distance-over-speed wait on a 20 m loft
is out of the window by more than a window, so the old helper blocked),
and `tests/foamers/pack-walkable.test.ts` (a block whole under a pack:
nobody spawns and the skipped members simply are not there; a block
off to a side: the full pack still arrives, stepped in past it, nothing
standing on it) fails on the old placement. npx tsc --noEmit, npx
vitest run, npm run build all pass; every touched file is free of em
and en dashes.
Not checked by eye: that `parryNext()` actually lands parries in the
browser against a live Roamer, and what a skipped or stepped-in member
looks like in the Pit (there is no browser here; the reviewer will
check both against a page). The old-estimate line is demonstrated in
the test: the old wait on a 20 m loft is out of the window by more
than a window.

LVL-02c done 2026-11-06, awaiting review (`tasks/LVL-02c.md`, Qwen 3.8
Flash Next via Pi): Level 1-2 beats 6 to 9 are in `data/levels/1-2.json`,
so `arena.html?level=1-2` now plays four arenas in order. From the store
the player goes north through a 4 m way on into a connecting corridor that
bends past a marked empty bay where the beat 5 tower will go (`_note` in
the file), and into the Crossroads (A7, scaled: a 14 x 16 m hub, one
pillared centre with four carveable foam skins over a solid core, four
6 m spokes with gates). Its lock shuts all four gates including the entry;
wave 1 is 6 Roamers from the north, east and west spokes staggered, wave 2
is 7 Roamers plus a Slowmer from a floor seam at the pillar's base (the
behind you moment). The way on is the fourth (north) spoke, not the way
back, so the level keeps turning north (section 14). Breather 2 (8 x 8 m)
has one ammo box and marked empty spots where the U2 station and the S3
ledge will go ([Paul], not built). The Gauntlet is the tiered bowl (A3,
scaled to 31 x 25 m): tiers at 0, 1.2 and 2.4 m walked up by 22 degree
shell ramps (Foamers can climb them: a 1.2 m step is over the nav
autostep), two rifts on the upper tier for wave 1's 8 Roamers, plus a
floor rift in the bottom tier's centre for wave 2's 10; four foam cover
pillars on tier 1 and ammo in both bottom corners; the dropping floor
island is a `_note` (no falling floor yet). The level's exit pad moved out
of the store to the lit 4 m door on the bowl's far wall. Tests: four
arenas in order, the walk start to exit on floor, the tiers and rifts
walkable on the nav grid with paths up the ramps and down, and the pad
dead until the fourth arena clears. Not checked by eye: the spaces and
their pacing, the behind you moment, the tiers reading as three heights,
the rifts' glow placement in the spokes, and that Foamers stream into the
bowl well (see the Log entry). Beat 5 (the tower), stations, secrets, the
B02 blaster and the level's name and setting are still to do.

OPS-02 done 2026-11-06, awaiting review (`tasks/OPS-02.md`, Qwen 3.8
27B via Pi): the Rapier physics now ships as its own
content-hashed `/assets/*.wasm` file instead of about 4.1 MB of base64
inside the `game-sounds` chunk. The 58 files keep importing
`"@dimforge/rapier3d-compat"`; that name is aliased in `vite.config.ts`
and `vitest.config.ts` to a new shim, `src/physics/rapier-shim.ts`, which
re-exports the non-compat `@dimforge/rapier3d@0.21.0` (a new,
exact-pinned dependency) with a no-op `init()` so the 38 `RAPIER.init()`
call sites need no change. Vite 8's built-in wasm plugin reads the
package's `.wasm` ES-module import and, in the build, emits it as a
separate file under `/assets` that the browser streams and compiles in
parallel, and in `vitest run` loads it from disk. No extra plugin and no
copy of the engine in the repo. Because all four pages share the
`game-sounds` chunk, the `.wasm` is requested by whichever of them loads
first, and the `/assets/*` immutable cache rule (`public/_headers`)
already covers it; the Worker serves a `.wasm` as `application/wasm` by
extension. Chunk and .wasm sizes (raw / gzip), before to after:
`game-sounds` 4,556,407 B (1,722,764 B) down to 223,152 B (68,846 B);
a new `rapier` glue chunk, 295,950 B (51,479 B), is added for the
non-compat build's JS wrapper (loaded in parallel with the `.wasm`, not
blocking it); the `.wasm` is 3,082,103 B (1,171,203 B);
`mesher-pool` is untouched at 615,054 B (153,751 B). The first-visit
download is roughly unchanged, but the physics engine now carries a
stable content hash, so a returning player does not re-download it when
only the game code changed (the old hash of `game-sounds` changed on
every game change, so the inlined engine came down again).
Not checked by eye: that each page actually plays (no browser here).
Checked over curl: all four pages return 200 `text/html` in `npm run
dev` (port 5199) and in `npx vite preview` (port 5198), and the
`.wasm` returns 200 `application/wasm` with the 3,082,103-byte wasm
magic `\0asm` in both. Whether the physics actually runs in a real
browser (the stream-compile path) is not verified here.

GAME-08 done 2026-11-06: the foam vacuum (D09): E on a weakened
Foamer in its stagger locks on, sucks it into the nozzle
place (no pop chunks, one capped foam puff), and its darts go straight
into the blasters' reserves by the type's share (never past reserveMax).
One charge, 15 s to refill, full on start and retry, a recharge pip in
the HUD; the placeholder tool is a code-built foam tube and nozzle. Not
checked by eye: the tool's look, the nozzle puff, and the five VC-*
placeholder sounds (see the Log entry).
LVL-02b done 2026-11-06, reviewed by Claude, merged (`tasks/LVL-02b.md`,
Qwen 3.8 Flash Next via Pi): a level's `arenas` play in file order through
a new `LevelRunner` in `src/level/level-runner.ts` that owns one
`ArenaRunner`
per arena and steps only the current one, so a later arena's trigger does
nothing until every earlier arena cleared. Each arena locks on its own
trigger, runs its waves, opens its own doors and keeps its own checkpoint;
Try again restarts the current arena with the earlier arenas still cleared,
Play again or a fall resets them all; the exit pad ends the level only once
the last arena has cleared. One arena levels (the Pit, the Ring) are
unchanged. The watch's `dartArena.state()` gains `arena`, `arenaId` and
`arenasCleared`. The validator now rejects a duplicated arena id, a trigger
outside the shell, and a trigger inside an earlier arena's locked space.
Level 1-2 beats 1 to 4 are `data/levels/1-2.json`, played by
`arena.html?level=1-2` (the Pit stays the default): the service corridor
with a foam wall and the empty B02 plinth, the parry corridor with one
Roamer as its own one wave arena, the yard, the Ring arena (two waves of 4
and 6 Roamers, the third rift behind the block, the north exit a reveal)
and the breather store with the exit pad. Not checked by eye: the spaces
and their pacing, the reveal, the lone Roamer's read at the corridor's far
end, the store window, and that the ring's Foamers path round the block
well (see the Log entry). Beats 5 to 9, the B02 blaster, stations, secrets
and the level's name and setting are still to do.
GAME-10d done 2026-11-05, awaiting review (`tasks/GAME-10d.md`, DeepSeek
V4.1 Flash via Pi): the F03 Swarmer is playable. It has its own factory
palette look (purple body, five small rounded lime nubs along its back,
orange toothless gape, angry eyes), a turnaround in `design/foamers/`, and
the F03 type in `data/foamers.json` (health 2, nibble damage 3, windup
0.25 s, a pack of 5). `src/ai/f03-brain.ts` is hit and run: it runs in with
a `swarm` token, bites, darts back out to a 3 m ring, circles there for
1.2 s and runs in again. `swarm` is its own token pool per difficulty
(Story 2, Normal 3, Hard 4, Foam Fury 6), so a pack never starves the
F01s. `spawnPack` puts the whole pack round a point and skips past the
live cap of 12. Placeholder sounds `F03-yip`, `F03-nibble`, `F03-scurry`.
Benchmark, headless only: two packs, 10 Swarmers, 600 frames at 60 Hz, the
simulation half of a frame (dart + Foamer update + physics step) is 0.20 ms
mean, 0.18 median, 0.30 p95. The first frames reach 125 to 146 ms once
while the mesh workers warm up. No renderer, so no fps. Not checked by eye:
the look, the skitter and nibble poses, the swing of the ring, and the
three sounds (see the Log entry). Not pushed or merged.

GAME-04c done 2026-11-05, awaiting review (`tasks/GAME-04c.md`, DeepSeek
V4.1 Flash via Pi): the shield disc is one model of concentric foam bands
with a ring of rounded nubs, domed, in the factory palette, and the same
model is held and thrown; it spins about its own axis. A throw that strikes
a Foamer lodges and grinds it for 0.9 s (carve, damage, capped debris, the
Foamer held staggered, plates take the full tick), then ricochets on as
before. The saw never kills: it weakens a Foamer into the finisher band.
Sounds `SH-saw` (loop) and `SH-sawEnd` are placeholders; the watch gains
`grinding`. Not checked by eye: the look (bands, dome, nubs, the boss
placeholder), the spin's speed and direction, the grind reading as a saw,
and the two sounds (see the Log entry). The centre emblem is still [Paul].

GAME-06 done 2026-11-05: melee weapon 1 (M01, name [Paul]) swings on the
melee key after the finisher passed on the press: a three-hit combo that
spends charges (three, one back per parry, one back every 8 s below full,
full at start and retry), hit 3 staggers and knocks back, each hit carves
foam cover, and with no charge a press is the shield bash. `data/melee.json`
holds every number; the course's debug blast moved to KeyB. Not checked by
eye: the baton's sweeps and the blaster dip, the feel, the sounds, the
pips' placement (see the Log entry).

BUG-01 done 2026-11-05 (round 2, after a review found round 1 had traded one
bug for another): the Pit's ring tops are back in the nav grid, as a second
layer over the floor under them, so both a player on the ring and a player
under it are walked to at the right height. The ramp-side stall is fixed at
its real cause: the grid promised 0.45 m steps but the Foamer's character
controller only autosteps 0.2 m at its walking cadence, so a path that
climbed the ramp's east side left it walking into a wall for ever. The
sidestep guard is still there as a backstop and now forgets a Foamer that is
not walking, and the walk builds the other-Foamers set once per frame
instead of once per Foamer. Played by Claude in
`arena.html?watch` (ring, open floor, under the ring: all reached and
attacked, the Roamers threw); merged 2026-11-05. Still to watch: the
sidestep's look, and whether the 0.2 m climb cap makes another level's step
read as too tall to walk.

ANIM-01 stages 1 and 2 done 2026-11-04: the F02 Roamer now winds up its
throw (ball arm back over the head, body turned away, readable as the cue
to raise the shield) and whips it through past the shoulder, and the F05
Darter's telegraph, charge and wall stun have their own poses; every number
is in a `motions` block in `data/foamer-rigs.json`. Key frames are in
`design/foamers/poses/`. Unverified by eye (no browser on the AI machine):
the poses by PNG, and the throw and charge in the game (see the Log entry;
reviewer: Claude Opus 5.5).

LVL-02a done 2026-11-04: the level file places ammo. The Pit keeps pit-ammo and gains a box on the far side of the floor, the Ring one box by each pillar; a `darts-*` pickup spawns a 0.35 m foam box that refills the reserve of every held blaster with that dart type (never past reserveMax; at a full reserve it stays), respawns on Try again and Play again, sounds PU-ammo and pulses the ammo counter (not the green heal glow), and dartArena.state().ammoBoxes counts the boxes left. Not checked by eye: the box turn and bob in play, the collect sound and pulse, and the new positions (see the Log entry).

GAME-10b done 2026-11-04: the F05 Darter charges. It scrapes for 0.9 s
(`telegraphSeconds`), locks its line at the player's position and runs at
11 m/s for up to 18 m with no steering, staggers for 1.2 s when it hits a
wall (back open), and hits and stuns the player it runs into for 0.4 s.
Chest and brow plates take 15 percent of a dart and carve slowly, the back
weakpoint 2.5 times; with both legs gone it only bites; a shield charge at
its front plates bounces off. The Ring arena is `data/levels/1-4-ring.json`,
played by `arena.html?level=1-4-ring` (the Pit stays the default). Not
checked by eye: the scrape and run poses, the stun feel, the plate arc on
the real rig, and the placeholder charge sounds (see the Log entry).

GAME-04 stage 2 done 2026-11-04 (`tasks/GAME-04b.md`): a ball made with
BALL_MATERIAL (the F02's pink) that hits in the shield's front arc is parried
when the disc started rising within the parry window, and the parry sends it
back at the thrower's chest faster, where it does damage and staggers. All the
numbers are in a `parry` block in data/shield.json; each difficulty preset
carries a parryWindow multiplier (Story 1.5, Foam Fury 0.6); the watch gets a
`parries` count and a `parryNext()`. Unverified by eye: the hit-stop and the
two placeholder sounds (see the Log entry).

GAME-10a done 2026-11-04: Foamers have per-type specs (`data/foamers.json`
base + `types`, `spawn(feet, facing?, type)`), and the F02 Roamer keeps its
ring and throws slow pink foam balls (`src/foamers/projectiles.ts`, the F02
brain in `src/ai/f02-brain.ts`); the Pit's wave 2 is 3 F01 and 2 F02. The
disc blocks a ball like a bonk, so a parryable ball now parries (GAME-04
stage 2). Ball look, the throw pose and the four new sounds are unverified
by eye (see the Log entry).

GAME-05 done 2026-11-04: with the disc up the shield locks the nearest
Foamer in the crosshair's range and cone in sight, and dash at the lock
is a charge: the player rushes the Foamer and knocks it back, staggers
it and takes a small hit. The charge's eye checks are still open
(see the Log entry).

GAME-04 stage 1 done 2026-11-03: the shield (`src/player/shield.ts`,
`data/shield.json`) blocks from the front arc, slows the walk, and throws
a ricocheting disc that returns to the arm; the range watch can drive it.
Stage 2 is done (the parry, see the next entry). Look and feel checks in a
real browser are still open (see the Log entry).

GAME-07 done 2026-11-03: the weakened (finishable) stagger, the Pop
finisher and the health drops are in the shared game; the course and
arena pick them up through `src/game/`. Browser checks are still open
(see the Log entry).

ENG-13 done 2026-11-03: the two playable pages share one game module in
`src/game/`; neither page carries a copy any more. Browser checks are
still open (see the Log entry).

LVL-01 done 2026-11-03: `arena.html` plays the 1-1 Pit from
`data/levels/1-1-pit.json` (lock-in, two waves from rifts, exit pad);
the format, validator, builder and arena state machine are in
`src/level/`. Visual and frame-cost checks in a real browser are still
open (see the Log entry).

ART-03 done 2026-11-03: Slowmer, Roamer and Darter have palette rigs,
deterministic turnaround renders and sheets in `design/foamers/`; Paul's
visual approval is still pending.

PRE-09, ENG-01 to ENG-07, GAME-01, GAME-02 (placeholder blaster) and
GAME-03 (test Foamer) done. GAME-09 done (merged 2026-11-02): the three
blasters (B01 pump, B04 full-auto, B03 break action) are in the game
through `Loadout` as animated first person viewmodels; switching is keys 1
to 3 or the mouse wheel, the HUD shows blaster name, magazine, reserve and
B03 shell pips, and the range panel has blaster selection and per-mod
toggles. Mods are not checked by eye in first person yet. AUD-01 (sound
system) is done (merged 2026-11-02): every game event plays
its sound ID from `data/sounds.json`, as a code-made placeholder until
Paul's recordings land in `public/audio/` (AUD-01b). M mutes.
UI-01 is done (merged 2026-11-03): the player has 100 health, Foamer
attacks hurt (with a 0.5 s grace), the HUD shows a health bar and a cream
hit flash, and at 0 the player pops with a Try again button. Esc opens a
pause menu (Resume, Settings, Restart); Settings has the four difficulty
presets, damage taken, sensitivity, invert, FOV, volume, mute and the
reduce shake, flashes and head bob switches, saved in localStorage. The
range has a God mode switch.

A test course: click to capture the mouse, then walk, sprint, jump, dash
and mantle. Left mouse fires the active blaster, R reloads, 1 to 3 or
the wheel switch blasters. Darts carve voxels and throw foam debris. E
throws foam blocks. Esc or gamepad Start pauses.

A striped 4 m foam wall made of 0.1 m voxels stands in the course, topped
with cardboard, wood and concrete. Melee (F / middle mouse) is a temporary
debug blast: it carves where you look and throws foam debris. Foam cut
loose from bedrock breaks off and falls as its own body (up to 16 at once);
tiny loose bits become debris. A T-shaped test tower stands to the right
of the wall.

A test Foamer (an unnamed lime blob with two big flat eyes) approaches
the player: it walks at you, winds up, and bonks, takes dart damage that
carves visible chunks and lowers its health, and at zero pops into four
bursts of foam chunks. A new one walks in about 3 s later from the spawn
point farthest from the player. Suction darts stick to it and ride along
while it walks, then drop when it pops. The bonk costs player health (UI-01). A Foamer that loses a leg falls
over and crawls at you, attacking from the ground (GAME-11, merged
2026-11-03; the range has a Break leg button).
Foamers now think (ENG-08, merged 2026-11-03): each has a brain that
notices the player by sight or by a neighbour's alert, walks round walls on
a nav grid that re-bakes around carves, and takes turns attacking through
the director's tokens (normal difficulty: 2 melee at once); the rest circle
at the hold ring. `range.html?watch` runs the range without pointer lock,
with console helpers in `window.dartRange`, for automated checks.
The slice Foamers (F01 Slowmer, F02 Roamer, F05 Darter) have their factory
palette looks (ART-03, merged 2026-11-03); turnaround sheets are in
`design/foamers/`, rendered by `npx tsx tools/render-rig.ts F01`.
Level design concepts (LVL-00, merged 2026-11-03) are in `design/levels/`:
semi-open but linear, after the modern Doom games (Paul). LVL-01 (merged
2026-11-03) plays the first arena, the 1-1 Pit, on `arena.html`.

Foam surfaces have the ENG-07 look: the mesher bakes per-vertex ambient
occlusion into the vertex colours (inside corners, crater floors, the seam
where a Foamer meets the ground read darker), and every foam surface uses
the foam material: pore speckle, a slow tint wobble, a faint glow so
shadows are never black, and a rim light on edges facing away from the
camera. The course boxes, floor, blaster and darts keep their old
materials.

ENG-10 done and deployed 2026-11-01: the test Foamer is rig F01 with part damage, break-off, foam-core wounds, crawling, going down and popping. Paul's play test notes are in the log (stutter still there, one blast pops, canned topple). Next up: QA-01 (performance on the low-end machine, Paul) and the P0 gate. P0 prototype due 2026-11-12.

ENG-11 done and deployed 2026-11-01: `range.html` is a plain test range with a frame-time graph (back-quote), switches, a test panel and a Benchmark button whose report can be copied. Next: Paul runs the Benchmark in his own browser to find the stutter.

ENG-12 done and deployed 2026-11-02: a killed Foamer goes limp as a jointed ragdoll, tipped over away from the shot, lies, then sinks. No starter dart pops a Foamer. Blasters B01, B04 and B03 are modelled (Blender, Kimi) and on main; GAME-09 puts them in the game.

Live at https://dart.contrapaul.com since 2026-10-30. Paul connected the repo in the Cloudflare
dashboard: a push to `main` builds (`npm run build`) and deploys. Repo:
github.com/contrapaul/dart (public), MIT licence.

## Open items

- [ ] Paul: blaster cards, story outline, Foamer names (PRE-02 to PRE-05).
- [ ] Paul: answer decisions D1 to D15 in `design/CONTENT-PLAN.md` (game
  length, roster, blasters, upgrades), then fill its `[Paul]` cells. P1
  needs 3 blaster cards and 3 Foamers first.

## Gotchas that have already bitten

- **The game-sounds chunk used to be 4.5 MB (1.7 MB gzipped), almost all
  Rapier, because the compat build inlined its WebAssembly as base64.**
  OPS-02 fixed this: the engine is now a separate content-hashed .wasm
  under /assets behind a shim (see Status and the OPS-02 log entry).
  Splitting Three.js and the mesher into their own cached chunks is still
  open.
- **A new custom domain answers 500 for about a minute** after the first
  deploy while Cloudflare provisions it. Wait before assuming it failed.
- **`display` beats the `hidden` attribute.** An element with a CSS
  `display` value ignores `hidden` unless there is a `[hidden] { display:
  none }` rule. `#overlay` has one.
- **The Browser pane will not grant Pointer Lock.** To test input there,
  override `document.pointerLockElement` in the console, dispatch
  `pointerlockchange`, then dispatch keyboard and mouse events.
- **The dev server is started from the workspace launch config**
  (`GitHub/.claude/launch.json`, entry `dart`), not one inside this repo.

## Log

### 2026-11-07: GAME-10j stage 1, committed (Qwen 3.8-27B via Pi): the F10 Turbo's look, type and flight

- Stage 1 of `tasks/GAME-10j.md` on branch `game-10j` (own worktree,
  ENV-00 runs in `design/` at the same time, not these files).
- **Look:** the F10 rig's greybox is the palette: a purple body and arms
  (the rig's own material), a lime head (the visor, the painted slit eyes
  stay), lime wings and the blaster's trim, orange jets with their orange
  tips. The rig also gained four purple legs (F02's pattern): the card
  says both jets gone means it drops to the floor and walks, and a
  four-legged rig walks. `npx tsx tools/render-rig.ts F10` renders the
  turnaround to `design/foamers/F10-{front,side,back,three-quarter}.png`
  and the sheet; a script then checks, from the solved rest pose, that
  the jets sit on the lower back one on either side and the blaster
  dangles from the right forearm's end (all pass). Not checked by eye:
  the PNGs could not be opened here (no browser).
- **Type:** an `F10` in `data/foamers.json`: rig F10 (health 30, speed
  3.5), a `fly` block (hover 4 m, bob 0.12, damaged hover 2 m, damaged
  speed share 0.6, the jets as its fins), the jets a weak point
  (x2), and attacks `homingShot` (ranged, needs the blaster, damage 10,
  windup 0.6) and the base `bonk`. It fights with the Roamer's brain
  (the ranged token picks `f02`), holding at 12 m (PLAN section 14 says
  what was reused).
- **Flight:** the F06's float path, reused: `src/foamers/fly.ts` keeps
  the flight's numbers (same shape as the float), and the one flight
  block in `src/foamers/foamers.ts` reads `floatOf(spec) ?? flyOf(spec)`.
  With one jet out it flies low and dull; with both gone it falls to the
  floor and walks (the test walks, does not cruise).
- The weak-point data now names its parts (`parts: ["gun"]`, the F10's
  `["jetL", "jetR"]`); the Crawler test saw one line change with it.
- New tests: `tests/foamers/f10-fly.test.ts` (spec, hover, slow down with
  one jet, walk with both, weak-point count) and
  `tests/ai/f10-brain.test.ts` (ranged brain, 12 m ring). `npx tsc
  --noEmit`, full `npx vitest run` (626 passed, 2 skipped), `npm run
  build` clean; the perl dash check on every file touched is clean.
- Not in this stage (stage 2): the homing ball and its turn cap, the
  launcher-less no-fire, the live cap, the poses for the shot and the
  sounds. Not yet checked by eye: the palette, the flight in the page.

### 2026-11-07: LVL-04b stage 3 review, merged (Claude): Level 1-4 is whole

- The first start got no reply from OpenRouter in three tries (Pi never
  opened a session); a test call worked minutes later and the restart
  built the stage in two commits.
- Read the diff: `data/levels/1-4.json` and its tests only. The older
  assertions it changed follow the level going on past the Ring. Its
  PLAN edit had dropped the row's task cell; restored here.
- Main merged in (HANDOFF Status and Log conflicts, both kept). `tsc`,
  the full suite (619 pass, 2 skipped) and the build pass.
- Played by script at the Yard: it locks; wave 1 spawns staggered (2
  Darters, 8 Swarmers); wave 2's 13 fill up to the 12 cap and hold, and
  one taken down lets the 13th in (23 spawned in the arena, 10 plus 13).
  Cleared, the north door opens; from it the lift is a lit lime panel at
  the end of the corridor; stepping on it shows "Level complete".
- Not checked: the islands as high ground and their jump gaps, the fight
  by hand, the frame time with 12 Foamers in the Yard.

### 2026-11-07: LVL-04b stage 3, the Yard and the lift (DeepSeek V4.1 Flash via Pi)

- Task: the card's stage 3, the last one. The A6 Yard gauntlet past the
  Ring's north door, both waves, and the lit lift as the level's real exit,
  with the temporary pad removed.
- Built in `data/levels/1-4.json`: a 4 m corridor from the Ring's north
  door, the yard shell (44 x 36 m, 9 m ceiling, a doorway in each end wall
  with a lintel), six island pieces, the arena `yard` (A6) with four rifts,
  two doors, a floor-level trigger 6 m inside the south door and a
  checkpoint at the door, A6 and A7 ammo, and the lift past the north door
  (a short corridor, a 6 x 5 m room, the 3 x 3 m lime pad, a lime-light
  panel on white walls). `LEVEL.exit` moved onto the pad, so the existing
  box test in `src/arena/extras.ts` triggers it with no shared-code change.
- Decided: islands are one voxel volume each because 3.2 m is the
  per-volume cap and the arena's six-zone budget is already full with six
  islands. Wave 2's 13 stays, with `holdSeconds` and the page's cap doing
  the work, rather than cutting a Foamer the concept names. The lift is lit
  with bright materials, not a new light, because the level has no point
  lights and adding one is a render change this card does not ask for.
- Tests in `tests/level/level-1-4.test.ts`: 24 now, 5 of them new (the
  yard's size, ceiling and island gaps; the walk from the Ring to the lift
  and the islands as high ground; both waves and the doors; the lift as a
  lit 3 x 3 m pad 30 m from the yard centre; and a run of the arena with
  the page's spawn cap). Test 10 now runs each arena with that same cap
  instead of counting the file, and the old "ring is last" and pad asserts
  were updated, not loosened.
- Green: `npx tsc --noEmit`, `npx vitest run` (615 pass, 2 skipped),
  `npm run build`. No em or en dashes in the files touched.
- Not checked by eye: everything below. A browser was not available.

### 2026-11-07: GAME-10i review, merged (Claude)

- Read the diff: the `swing` attack in data (range pinned at 2.4, needs
  the sword), the punch now needing `foreArmL` only, the swing's windup
  and strike motion, the two sounds. Small and in the card's files.
- Fixed in review, from the turnaround: (1) the blade's bottom sat on
  the hand, so it grew back up the forearm past the shoulder with the
  grip at the tip. Now it hangs from its hilt end at the hand, tilted
  forward (rest -1.2 rad), hilt and guard at that end. (2) The cross
  guard was orange, the weak-point colour; it is purple now. Turnaround
  and the F07 pose sets re-rendered (the crouch and leap sets show the
  rest pose, as before: the renderer has no pose for those states).
- Main merged in (one HANDOFF log conflict, both kept). `tsc`, the full
  suite (614 pass, 2 skipped) and the build pass.
- Played on the range: from 4 m it closes to about 2.2 m and swings
  (beyond the old punch's 1.7 m), hitting for 16; with the sword broken
  off (hilt and guard go with it) it punches with the left fist.
- Not checked: the swing seen from the side in play (in first person it
  points at the camera), the two sounds by ear. The sword is 1.5 m, not
  the card's 1.2 m; Paul to judge.

### 2026-11-07: GAME-10i, the Brawler's foam sword (Qwen 3.8-27B via Pi, branch `game-10i`)

- Stage 1, the sword: `fistR` in the F07 rig is gone; a `sword` weapon
capsule (0.3 m wide, 1.5 m long, the card proposed about 1.2 m) is
parented to `foreArmR` at the fist, with a `swordHilt` and a
`swordGuard` as children, so `breakPart` drops all three in one piece.
The left fist stays. The `swing` attack (data/foamers.json) needs the
sword and pins `range: 2.4`, 0.7 m past the punch's 1.7 plus the 0.3 m
grace; the punch's `needs` are now `foreArmL` only, so `chooseAttack`
falls to it when the blade is gone. No melee code changed: `needs`
carrying does the fallback. `windupMotion` and `strikeMotion` got a
`swing` case, a wide horizontal arc. Stage 2: `F07-swing` and
`F07-sword-break` in data/sounds.json and design/SOUNDS.md; the
`attack` sound picks the swing over the punch, and `breakPart` got a
`sword-break` kind (the shield-break's pattern). Four tests in
`tests/foamers/brawler.test.ts`: the rig shape (sword, no `fistR`, part-
own health), the blade darts away in 20 hits with hilt and guard, a
player at 2.2 m is bonked by a `swing` (outside the punch's reach), and
sword-less the next bonk is the left-fist `punch`. The GAME-10f leap and
shockwave tests pass unchanged.
- `npx tsc --noEmit`, `npx vitest run` (606 pass, 2 skipped) and
`npm run build` all pass; no em or en dashes in the files touched.
- Not checked by eye (no browser here): the turnaround renders and the
windup and strike pose renders in `design/foamers/` (faced right in
render-rig.ts), the moving swing in play, and the two placeholder
sounds by ear.

### 2026-11-07: LVL-04b stage 2 review, merged (Claude)

- Read the diff: a cached promoted rig copy in `FoamerSystem.spawn`
  (1.5 times the health, chest and brow in `foam-purple-light`, from the
  `promoted` block in `data/foamers.json`), the page passing the wave's
  flag and the alive Foamers' health, and `Wave.startsWithHealthShare`
  in the runner (optional: a page that reports no health keeps the old
  rule). Small and in the files the card allowed.
- Main merged in, no conflicts. `tsc`, the full suite (610 pass, 2
  skipped) and the build pass.
- Played by script at the Ring: both Darters spawn promoted, 45 health,
  light purple plates, seen on screen against the deep purple body with
  the orange back still the only orange. Wave 2 waits at 50 of 90 health
  (55%) and starts at 42 (47%), all 6 Swarmers arriving with the pair
  still up. Cleared, the north door opens and the pad shows "Level
  complete".
- For Paul, from the model's section 14 rows: the Ring is a through room
  with two doors, not the concept's four shutters, and reuses 1-3's 30 x
  30 m room with a 10 x 8 m block, so the ring is about 10 m wide, not
  6 m.
- Not checked: the fight by hand, the pillars and ammo by eye, the
  frame time.

### 2026-11-07: LVL-04b stage 2, promoted Foamers and the Ring (DeepSeek V4.1 Flash via Pi)

- Card `tasks/LVL-04b.md`, stage 2 only, in two commits.
- Promoted spawns are data: `data/foamers.json` gained a top-level
  `promoted` block (`healthMultiplier` 1.5, `parts` per rig id), and
  `src/foamers/foamers.ts` builds a cached rig copy from it inside
  `rigForSpawn(spec, promoted)`. `spawn`'s new fourth argument defaults
  to false, so every existing caller is unchanged; `src/arena/extras.ts`
  passes the wave's flag through. Health is scaled on the rig, which the
  Foamer's constructor also uses for part hit points, so plates and body
  are 1.5x together.
- The health-started wave is in `src/level/arena.ts` (a `peakHealth` the
  runner tracks while a wave is up) and `src/level/format.ts`
  (`Wave.startsWithHealthShare`). `ArenaContext.aliveHealth` is optional
  so the other pages and tests keep compiling; the page adds the living
  Foamers' health each step.
- The Ring is a through-room, not the concept's sealed pit: doors on the
  south and north walls, both locked in the fight and opened on the
  clear, so the exit pad can sit past it and the level keeps one line
  north. The four pillars match KIT 5's cover pillar; A4 and A5 counts
  match the concept's station table.
- Tests: `tests/level/level-1-4.test.ts` 19 (walk to the pad, the Ring's
  shell and loop, its waves and the health share, the pillars and ammo,
  the moved pad, the promoted health and plates) and
  `tests/level/arena.test.ts` three for the runner rule.
- Not checked by eye: everything visual listed in Status, and nothing
  was played in a browser. Not touched: `src/ai/`, `src/player/`,
  stages 3 to 5.

### 2026-11-07: LVL-04b stage 1 review, merged (Claude)

- DeepSeek's first LVL-04b run spent 86 minutes and 143 tool calls
  reading with no edit and was stopped. A fresh run limited to stage 1,
  with its first edit due by its sixth reply, built it in one commit.
- Read the diff: `data/levels/1-4.json`, its test file, PLAN, HANDOFF
  and the card. The older tests it changed follow the level going on
  past the bridge (the arena list, the pickups, the bridge escape now
  starting the Pit instead of ending the level); none loosened.
- Main merged in (HANDOFF Status and Log conflicts, both kept; the
  GAME-10h Status paragraph corrected to "merged locally"). `tsc`, the
  full suite (602 pass, 2 skipped) and the build pass.
- Played by script on `arena.html?watch&level=1-4`, starting at the
  Pit: the floor 4 m below the ring locks it; wave 1 is 2 Darters and 6
  Swarmers, wave 2 is 3 Darters and 6 Roamers arriving staggered; the
  north door opens on the clear and the pad in breather 2 shows "Level
  complete".
- Not checked: walking the ramps by hand (the player was moved by
  script; the nav test covers them), the west island over its hole, the
  Pit's look (the camera faced a wall), the frame time with 9 Foamers.

### 2026-11-07: LVL-04b stage 1, the Pit and breather 2 (DeepSeek V4.1 Flash via Pi)

- Built in `data/levels/1-4.json` only, plus the stage's tests in
  `tests/level/level-1-4.test.ts` (10 tests became 14). No shared game
  code changed.
- The ring's north wall is now a doorway (`ring-wall-n-w`,
  `-e`, `-lintel`) into a 4 m corridor (`corr4-*`) under the far yard.
  The far yard's floor is at -9 and the corridor's is too, so the way
  south to the Pit is flat and then drops 4 m.
- The Pit: 34 x 26 m over x -17..17, z -176..-202. South and north
  ledges at -9, pit floor at -13, a 7 m ramp up at each short end
  (`pit-ramp-e` at x 9.5, `pit-ramp-w` at x -9.5, 4 m rise, 0.57
  slope). Its doorways are floor-to-lintel openings 8 m tall so the
  bakes keep the ledge layer as well as the floor layer: a wall pier
  from the ledge down reads as a 4 m step the agent cannot climb.
- Pieces: the centre block (three 2 m columns of foam-orange, a
  3.2 m volume each), two ring pillars 1.6 m square, and the west
  island (3.2 x 0.4 x 3.2 m) anchored `wall` over the shell gap at
  x -13.2..-16.8, z -187.4..-190.6. `wall`, not `floor`: a floor
  piece's lowest voxel row is filled with bedrock in
  `src/level/build.ts fillPieces`, which would plug the hole.
- Arena `pit` (A1): trigger on the pit floor 3 m in from the south
  door, `pit-in` open, `pit-out` locked, both open on the clear.
  Wave 1: 2 F05 from the north-east and north-west rifts plus 6 F03
  from the floor rift. Wave 2: 3 F05 plus 6 F02, the first two from
  the north seams and the rest from the floor and a south rift. Both
  waves use one rift slot per spawn, filled in order, so the list is
  spelled out in the JSON.
- `a3-ammo` (8 standard darts) on the west ledge. `s3-marking` and
  `u2-marking` in breather 2, no pickups there.
- `exit` moved from the ring to breather 2 `[0, -7.5, -207]` so the
  level still ends. Stage 3 replaces it with the lift.
- Tests: the walk ring -> corridor -> south ledge -> floor -> east
  ramp -> east ledge, the two ramps' ground heights, the island's
  anchor, the waves' spawns and rifts, the trigger, breather 2's size
  and marks, and no ammo in breather 2. Two older tests were updated
  because the level no longer ends on the ring: after the escape the
  runner now starts the Pit, and the last arena is `pit`.
- Decided: the north door stays locked until the Pit clears, so stage
  3 has to open it (or the lift pads the way) rather than walking
  through it; the card says the lift waits for that.
- Not checked: everything by eye. The pit's proportions, whether the
  centre block reads as cover, the ramps' feel, the corridor's height,
  and the actual arena fight (waves, rifts, timing) are only tested
  through the runner and the grid, never played.

### 2026-11-07: GAME-10h review, merged (Claude)

- The Spark (dgx-spark) committed stage 1 and stopped answering mid stage
  2; Qwen 3.8-27B on qwen-machine took the uncommitted stage 2 over,
  fixed its three tests (they waited for the attack choice, not the
  wall leaving the launchers) and wrote the docs. Two of its commit
  messages had the Co-Authored-By trailer with no blank line before it;
  reworded on the branch before the merge.
- Read the diff: `src/foamers/wall.ts` (the spec, the seeded slots, the
  wall kind), `launchWall` and a shared `spawnBall` in
  `projectiles.ts` (the old per-field defaults now one
  `SHARED_BALL_KIND`), the strike branch in `foamers.ts`, the launcher
  multiplier. The gap uses the existing `makeRng`, never `Math.random`.
- Main merged in (PLAN and HANDOFF conflicts, both kept; the LVL-04a
  Status paragraph corrected to "merged locally"). `tsc`, the full
  suite (598 pass, 2 skipped) and the build pass.
- Played on the range: from 16 m it holds near 12 m and fires a row of
  10 slots 0.6 m apart at chest height, two side by side left out (the
  gap), the two centre balls hitting the player for 8; on screen the
  row of orange balls and the gap read clearly. With both launchers
  broken it fires nothing, walks in at its slow speed and picks the
  stomp at 1.4 m.
- Not checked: crossing a gap by hand, one launcher's half wall in play,
  the stomp's damage landing, the three sounds by ear, shoulder spikes
  (not built; the rig keeps nubs).

### 2026-11-07: LVL-04a review, merged (Claude)

- Read the diff: `data/levels/1-4.json`, the level list, a new test file
  and the level id list in `tests/level/ring-load.test.ts` (one id added,
  nothing loosened). The seven section 14 rows are sound: full design
  sizes, 2.8 m explore pillars, 3.2 m hall columns for the KIT 5 cap, a
  clear 40 m centre lane for the charge, `noLock` plus `escape` for the
  bridge, B03 from the loadout order, no fall damage.
- Main merged in (one HANDOFF log conflict, both sides kept). `tsc`, the
  full suite (585 pass, 2 skipped) and the build pass.
- Played by script on `arena.html?watch&level=1-4`: the forecourt
  renders with its four targets; the explore room locks and its Darter
  telegraphs, charges, hits for 8 and stuns on the wall; the hall locks,
  wave 1 is 4 Swarmers and a Darter, wave 2 is 4 Roamers and 2 Darters,
  and its doors open on the clear; the bridge starts both Darters with no
  door shut; stepping off the deck's side drops the player 9 m to the
  ring, the escape ends the arena and removes the Darters, and the pad
  shows "Level complete".
- Not checked: the shield charge against a Darter on the deck, the
  blast wall over the yard hole, whether the hall's columns read as
  cover, the frame time. The page title is "DART: the Pit" for every
  level (`arena.html`, older than this card).

### 2026-11-07: LVL-04a, Level 1-4 beats 1 to 5 (DeepSeek V4.1 Flash via Pi)

- Asked: build beats 1 to 5 of Level 1-4 from its approved LVL-00 concept
  in a new `data/levels/1-4.json`, list it for `arena.html?level=1-4`,
  and cover the card's done-when with tests. Beats 6 to 10 are out of
  scope; GAME-10b's `1-4-ring` test file is untouched.
- Built, all in the level file: forecourt with four foam dummies at 4, 6,
  10 and 15 m and the A1 box (24); the 14 m corridor into a 16 x 12 m
  room with two pillars and one Darter as a one-wave arena; the A4 hall
  (18 x 44 m, 7 m ceiling, six columns, four rifts, two waves, A2 ammo at
  column 3); the alcove off the corridor past the hall with the U1 mark;
  the A8 bridge: two yards, a 4 x 24 m deck 9 m over an 8 m ring, no
  doors, `noLock`, two Darters, an `escape` box over the ring, a blast
  wall over a 3.2 m hole in the near yard's floor, and the S2 mark; a
  temporary exit pad on the ring below the deck. `_notes` in the file say
  what the card asked to be noted (the dummies, the missing fall damage,
  the temporary exit, the [Paul] marks, nothing scaled).
- Decided and why, in PLAN.md section 14: the explore pillars are 2.8 m
  not 1.6 m (1.6 m hides nothing at eye height); the hall columns are
  3.2 m zones at the KIT 5 cap, three foam and three shell as LVL-03b
  did; the centre lane is held clear for the F05's 14 m `rangeMetres` and
  18 m `metres`; the bridge yard floors are split into four pieces around
  the hole so the hole is a real hole, not a decal; B03 comes from the
  loadout order rather than a stand, the card's own fallback.
- Tests: `tests/level/level-1-4.test.ts` (10) check validation with the
  arenas in order, floor under the whole walk sampled every metre from
  the start to the far yard, the hall and both yards walkable on a nav
  grid baked the way the arena page bakes it with the path across the
  bridge, the lane clear in both directions at every column's z, the drop
  landing at -9 (and the yard's hole), every rift `canStandAt`, the
  bridge ending on the escape with Darters up and no door shut, and the
  exit pad doing nothing until the last arena ends. One line in
  `tests/level/ring-load.test.ts` gained `1-4` in its expected key list;
  nothing was loosened elsewhere.
- Not checked by eye (no browser here): the four spaces' look and
  reading, the dummies' placement against the walls, whether the Darter
  actually charges down the hall lane between the waves, the shield
  charge on the bridge, and the 9 m drop. The F05 windup against a real
  player is untested.

### 2026-11-07: BUG-11 review, merged (Claude)

- Read the commit: one line in `tests/foamers/parts.test.ts`'s `tick`
  (`debris.update(dt)` before `world.step()`), the same order as the
  game's fixed step (`src/game/game.ts`). No game code, no assertion
  changed; test 8 still checks the headbutt and its 0.9 s windup. The
  four probe files were removed before the commit.
- Main merged into the branch (one HANDOFF log conflict, both sides
  kept); `tsc`, the full suite and the build pass on the merge.
- Noted, not changed: `src/voxel/debris.ts` throws its chunks with
  `Math.random`, and the chunks collide with Foamers, so they can change
  a fight. The project rule is a seeded PRNG in simulation code. That is
  a card of its own if it matters for replays or tests.

### 2026-11-07: BUG-11, why parts.test.ts test 8 failed once in a full run (Qwen 3.8-27B via Pi, branch `bug-11`)

- Symptom as card: test 8 (both forearms gone, the next attack must be the 0.9 s
  windup headbutt not the 0.6 s bonk) failed once in a full `npx vitest run` on
  main, 15 of 15 alone, 11 full runs clean, the failure was made while two other
  models' test suites ran on the same machine.
- Cause: the test-only `tick` in `tests/foamers/parts.test.ts` ran
  `darts.update`, `foamers.update`, `world.step` but not `debris.update`,
  whereas the game's fixed step (`src/game/game.ts`) ages and dies the foam
  chunks every step. Breaking both forearms in the test carves the two parts
  and throws a handful of real chunks (`src/voxel/debris.ts` spawn: 4 s life,
  0.108 m cubes, random direction and speed out of `Math.random`). Where a
  chunk lands is random, and under a loaded event loop the pending mesh work
  in `settleAll` and `breakOff` resolves in a different order, so a chunk can
  land in the Foamer's walk line. The chunks die after 4 s in the game, but in
  the test tick they are immortal. A chunk on the line under the autostep
  (0.2 m, data/ai.json) still holds the character controller's straight walk on
  some rolls, so the Foamer never closes the approach to the 1.3 m attack range
  in the 10 s window and the windup never starts.
- Forced proof: planting one immortal 0.108 m chunk in the walk line made test
  8's sequence stall in 5 of 10 forced runs (probe `parts-probe8` 8L); the same
  scene with the game's tick (debris ages out at 4 s) passed 30 of 30 and every
  forced variant. That is the on-purpose failure the card asks for.
- Fix: `tick` in `tests/foamers/parts.test.ts` now calls `debris.update(dt)`
  before `world.step()`, matching the game's fixed step order, so a chunk that
  throws itself in the walk line dies 4 s later like in the game. Test-only,
  one line. No assertion was removed or loosened; test 8 still checks the
  headbutt and its 0.9 s windup.
- Gates: `npx tsc --noEmit`, `npx vitest run` (554 pass, 2 skip) and
  `npm run build` all pass; 30 solo test-8 runs and 5 loaded full-suite runs
  (a second full suite in the background) all green.
- Not checked by eye in a browser: the change is in the test's tick, nothing
  visual moves.
- Search for other non-determinism in the code test 8 runs: `Math.random` in
  the debris spawn (direction and speed) is the one real source. No
  `performance.now`, `Date.now`, `setTimeout`, `setInterval` or `crypto` in
  `src/foamers/`, `src/weapons/darts.ts`, `src/voxel/debris.ts`, the
  `src/voxel/carve`/`mesher` path, `src/physics/world.ts` or `src/ai/` that
  touches this test.
- Separate, untouched: the `tower-throw.test.ts` timeout from BUG-10's notes.

### 2026-11-07: LVL-03b review (Claude)

- Merged locally at 07:21 on a quiet machine (load 3): main (with
  GAME-10g) merged in, `tsc` clean, full `npx vitest run` 575 pass and 2
  skipped, `npm run build` clean. The two load failures noted below did
  not recur.
- DeepSeek's first run and a resumed one both died on "Stream ended
  without finish_reason" (OpenRouter), the first with the runner edits
  uncommitted. A fresh session (13 MB of old context dropped) finished
  the card in three commits. Main was merged into the branch first; one
  HANDOFF conflict, both sides kept.
- The card allowed `src/level/` only; the model also added `onEscaped` to
  `src/arena/extras.ts` (clear the Foamers the drop left behind, dim the
  rifts). That is the page side of the escape the card asked for, so it
  stays.
- Played in the browser (`arena.html?watch&level=1-3`, jumped to the
  hall by setting the runner's arena index, health refilled by script):
  the hall started on the trigger with no door shut, Swarmers spawned
  every 4 s behind the player (7 up at 26 s); dropping through the hole
  at z -152 ended the hall and cleared all 7; `drop-hatch` read sealed
  about 3 s after the drop. The Ring locked on its trigger; its 10
  Swarmers all reached the player (every one within 3 m from 2 s on).
  Waves cleared by script: 10 Swarmers, 12 Swarmers, 4 Roamers, then
  `ring-out` opened and the exit pad showed "Level complete".
- Not checked: the look of the hall, the drop, breather 2 and the Ring
  (the pane was hidden); the mantle chain onto the block; whether a
  player can outrun the chase; frame time with 12 Swarmers in the lane.

### 2026-11-07: LVL-03b, the hall chase, the drop, breather 2, the Ring and the exit (Pi)

Task: build card `tasks/LVL-03b.md`, beats 6 to 9 of Level 1-3.

Built:
- `src/level/`: `ArenaRunner` gained `noLock` (the trigger starts the
  waves, no door is set, no "Clear the arena" banner) and `escape`
  (`{ box, sealDoors, sealDelaySeconds }`: the arena ends by leaving with
  its Foamers up, opens no unlockOnClear door, seals the named doors
  after the delay). `LevelRunner` steps the seal for every arena each
  frame, because a cleared arena is not stepped again. Tests in
  `tests/level/level-runner.test.ts`.
- `data/levels/1-3.json`: the temporary exit is gone. The hall (A4,
  18 x 44 m, 7 m ceiling, three 3.2 m voxel columns and three 4 m shell
  ones), the drop (the lane's last 6 m is a hole over breather 2, 6 m
  down, 3 m ledges either side and `drop-hatch` over it), breather 2
  (10 x 8 m, 35 darts, U2 and S3 marks as 0.1 m slabs), the Ring (A2,
  30 x 30 m, a 10 x 8 x 3.5 m shell block with a 1.5 m and a 1.3 m step
  on its east face, four rifts, four 1.6 x 1.6 x 2.8 m voxel pillars, A5
  and A6) and the lit 3 m north exit with its pad.
- `src/arena/extras.ts`: `onEscaped` clears the Foamers, so the hall's
  Swarmers cannot hold the cap or block the Ring.
- `tests/level/level-1-3.test.ts`: five arenas in order and their waves;
  floor under the walk from the start to the drop's lip and from the
  drop's foot to the exit; the hole under the lane's end; the Ring's ring
  a loop; the block top walkable through the steps; no nav path back up
  the drop; the chase and the 3 s seal on the file; the exit still dead
  until the Ring clears.

Decisions in PLAN.md section 14 (2026-11-07 rows): the escape ends the
chase at the room, the Roamers are a third wave so no more than 12 are
alive, the hall columns are three zones plus three shell, the block's
steps fit the 1.5 m mantle, and the second A3 is `breather2-ammo`.

Checks: `npx tsc --noEmit` clean, `npx vitest run tests/level` 90 pass,
`npm run build` clean, no em or en dashes in the touched files. Commits
`9fc45ca` (runner) and `10d16cc` (level and page).

Not checked by eye: no browser here, so nothing was walked through. Not
verified: that the two block steps and the 0.7 m jump really mantle onto
the Ring's block top; that the drop reads as a drop and the 3 s seal is
not too fast or slow; that 12 Swarmers at 4 s gaps are fightable in a
44 m lane and the hatch reads as shut; that the exit door is visible from
the Ring's east side; where the U2 and S3 marks sit. Two full-suite tests
(`tests/ai/nav-grid.test.ts` bake budget and `tests/foamers/rig.test.ts`
snap loop) failed all session with the machine at load average 242 from
the other models' runs, so they were not trusted as green or as this
card's bugs.

### 2026-11-07: GAME-10g review, merged (Claude)

- Merged main into the branch first (it was cut before BUG-09 and
  BUG-10); one HANDOFF log conflict, both sides kept.
- Played on the range (`range.html?watch`, F09 spawned 14 m out): it
  held at 14 m, wound up 0.8 s and fired bursts of 12 pellets over 1.2 s;
  about 4 or 5 of each 12 hit the player. Broke the gun (`breakPart`): no
  more pellets, it walked in to 1.8 m and stomped. The turnaround matches
  the card's palette.
- No code changes. Noted: the spread's PRNG is `makeRng` from
  `src/audio/synth.ts`, so Foamer code now imports from the audio
  module (synth.ts has no imports, so nothing heavy comes with it). A
  shared `src/core/rng.ts` would be cleaner; left as is. The render
  tool's sheet label drops digits and some letters ("F0", "RAWLER" on
  F07); the tool's pixel font, not this card.
- Tests: the Crawler, Brawler and Floater tests (31) pass and the build
  is clean. Merge held for a quiet full run: BUG-11's loaded runs held
  the load average near 300 for over an hour, and under that load the
  full suite fails 5 s timeouts on main too (`tower-throw.test.ts`, and
  `pit-load.test.ts`, whose BUG-10 fix now bakes ten times, so it
  outgrows the default timeout under heavy load where one bake fit).

### 2026-11-07 GAME-10g: the F09 Crawler (Qwen 3.8 Flash Next via Pi, branch `game-10g`)

Task: card `tasks/GAME-10g.md`, three stages. Built: stage 1 the look
and the type (rig palette deep orange / purple legs / lime gun, the F09
entry in `data/foamers.json`, sheets in `design/foamers/`,
`tests/foamers/crawler.test.ts`); stage 2 the stream, the weak point and
the stomp (`src/foamers/pellet.ts` new: `pelletOf`, `weakpointOf`,
`canStream`, `pelletKind`; firing in the strike branch of
`src/foamers/foamers.ts`; barrel spin and stomp motions in
`src/foamers/rig-states.ts`; `F09-spinup`, `F09-pellet`, `F09-step` in
`data/sounds.json`, `design/SOUNDS.md` and `src/audio/foamer-sounds.ts`;
`tests/foamers/crawler-stream.test.ts` 9 tests, `tests/ai/crawler-brain.test.ts`
2 tests); stage 3 these docs plus the PLAN.md row and three section 14
entries, and the `design/foamers/README.md` row.

Decided (full text PLAN.md 14): `decideF02` fits the Crawler unmodified,
its own spec distances do the work; the gunless close (stomp distances =
`attackRange` in `stepBrain`) is a system read, not a brain state;
spread seeded per burst and pellet through `makeRng` from
`src/audio/synth.ts`; a ranged attack that keeps a ring must pin its
firing `range` outside the ring (the F06's trick; without it the stream
never fired: floating-point equality against the parking distance).

Unverified: nothing seen by eye (no browser here): the range with an
F09, the rig's pose and spin, the stomp, the three placeholder sounds,
and the rendered sheets (generated, not viewed). `tests/ai/nav-grid.test.ts`
(bake under 150 ms) and `tests/foamers/rig.test.ts` (movement never
snaps, a 5 s testTimeout) are the two wall-clock timing tests in the
suite: they failed on every run while this machine's load average sat at
about 350 (other agents' test runs), and one full-suite run was green
(569 pass, 2 skipped) when the load dipped. They are not touched by this
card (the F09's own motions pass the same snap check in
`tests/foamers/crawler*.test.ts`'s rigs); a rerun on a quiet machine is
the last thing this card leaves open.

### 2026-11-07: BUG-10 review, merged (Claude)

- Read the diff: tests and `vitest.config.ts` only. Budgets unchanged
  (150 ms bake, 2 ms query, 1000 ms Pit bake, 0.35 rad); the rig test
  walks the same rigs and frames and asserts the worst jump once per rig,
  naming the frame and joint. Two choices to know about: the timed tests
  now take the fastest of nine runs (the card allowed fastest or median;
  the fastest is the more lenient of the two), and `maxWorkers: 6` caps
  vitest's pool for every run.
- Checked: the full suite on the branch took 6.98 s; it also passed with
  a second full suite running at the same time, and passes on main after
  the merge.
- Open, from the model's notes: `tests/ai/tower-throw.test.ts` timed out
  once under load (5.6 s against the 5 s default). Not looked into.
- New flake after the merge: one full run on main failed
  `tests/foamers/parts.test.ts` test 8 (headbutt after both forearms);
  15 of 15 alone and the next 11 full runs passed. Card BUG-11.

### 2026-11-07: BUG-10, the load-sensitive tests (Qwen 3.8-27B via Pi)

Task: `tests/ai/nav-grid.test.ts` (the 40x40 timing test),
`tests/foamers/rig.test.ts` ("movement never snaps") and
`tests/level/pit-load.test.ts` ("bakes the whole Pit's nav grid") failed
in full `npx vitest run` only when the machine was busy. All test and
runner changes; no game code; no budget raised, no frame or rig dropped,
no assertion removed.

Reproduced under load (a second full suite running at the same time):
5 of 5 runs red. The nav timing test failed on the bake 258 ms against
the 150 ms budget (loaded single bake: 220 to 299 ms in the five
reproduction runs), and on the query in two later runs (median of 9 at
4.4 ms against the 2 ms budget). The rig test failed with "Test timed
out in 5000 ms" after about 7 to 12 s of wall time. One out-of-scope
failure was seen and written up here, not fixed: `tests/ai/tower-throw.test.ts`
"does not throw into the slab" timed out in 5000 ms in one loaded run
only (a 30 s simulated fight at 60 Hz is near the default 5 s timeout
when the process is starved of CPU); it also passed once per loaded run
of the final verification.

Cause of each failure, with the evidence:

1. The suite oversubscribes the machine. Vitest 5's default pool spawns
   one fork per test file, so a full run is about 85 forks on a 12-core
   machine; each fork gets little over 15 percent of a core. A wall-time
   measurement then measures the machine, not the work. Evidence: the
   40x40 bake printed 36 ms in the BUG-03 row of this log, 85 to 101 ms
   in idle full runs here, and 220 to 300 ms in the five loaded runs,
   the median of every consecutive sample raised.
2. The rig test called `expect` once per joint per frame: 13 rigs times
   1800 frames of 30 s times about 30 parts, roughly 700,000 one-argument
   `expect` calls. Alone it took 1425 ms (already over a third of the
   5000 ms timeout); when the fork also lost CPU time, it ran 7.4 to
   12.3 s and hit the timeout with every jump still under 0.35 rad
   (the timeout error, not an assertion, is every failure in the logs).

Fixes (the two timed bakes, the query and the rig test keep the budgets
the cards set):

- `vitest.config.ts` gets `maxWorkers: 6`. Each fork is well fed again,
  so wall time reflects the work's own cost even while another full
  suite runs. The suite still takes about the same 7 s (total CPU work
  is unchanged; only the 85-to-12 oversubscription is gone).
- `tests/ai/nav-grid.test.ts` and `tests/level/pit-load.test.ts`: each
  timed bake now times 9 identical bakes and asserts on the minimum
  (median of 9 was still 220 to 300 ms under load, because the whole
  run is busy, not one of nine samples). The nav query keeps 9 timed
  queries but asserts on the minimum too: its median measured 4.4 ms in
  the loaded runs against the 2 ms budget, the same starvation. The
  game's page pays one bake and one query; the budget is about their
  own cost, which the fastest sample measures.
- `tests/foamers/rig.test.ts` "movement never snaps": same frames (30 s
  of 60 Hz per rig), same rigs, same 0.35 rad limit, but the worst
  per-frame jump is collected per rig and asserted once per rig, the
  frame and the joint named in the message. 1425 ms to 114 ms idle,
  114 to 170 ms in the five loaded runs.

Verification: `npx tsc --noEmit` clean, `npm run build` clean, `npx
vitest run` 85 files 554 pass 2 skipped, and after the fix five full
runs while a second full suite ran all green (before: 5 of 5 red). Test
times, idle vs loaded (the card asks for before/after): the 40x40 bake
assert fell from 220 to 300 ms to 68 to 95 ms; its query from 4.4 to
1.5 ms to 1.1 to 1.5 ms; "never snaps" from a 5000 ms timeout to 114
to 170 ms; the Pit bake ran 1621 to 1766 ms wall in the five loaded runs
(asserts on the baked grid itself, the minimum of its 9 bakes).
Not checked by eye in a browser: nothing renders; the changes are the
runner's parallelism and what three test files time.

### 2026-11-07: BUG-09 review, merged (Claude)

- Read the diff: test files only, no game code. The eight `settle`
  helpers now loop until `mesh.busy` clears (the level tests' pattern),
  and test 1's crossing health is band + 0.5, so one dart decides it
  instead of the dart's bounce re-hit. That does not loosen the test: it
  still asserts the crossing hit gives the finishable stagger.
- Checked: the fixed finisher test passed 25 of 25 runs alone, and the
  full suite passes on main after the merge. The 2 in 80 failure rate
  before the fix is the model's own probe; I did not reproduce it.
- Noted, not changed: the new `settle` loops have no iteration cap (the
  level test's has 200), so a mesh that never clears `busy` would hang
  until vitest's timeout rather than fail fast.

### 2026-11-07: BUG-09, the flaky finisher test (Qwen 3.8-27B via Pi)

Task: `tests/foamers/finisher.test.ts` test 1 failed now and then in a
full `npx vitest run` (line 103, `f.finishWeakened` still false). Two
causes, both test-only; no game code changed.

Cause 1, the card's lead: every helper `settle` in `tests/foamers/` waited
one `setTimeout(0)` for the part's mesh promise (`tests/foamers/finisher.test.ts:30-38` before
the change, and the same eight files: `blocker.test.ts:42`,
`chunk.test.ts:36`, `darter.test.ts:20`, `fall.test.ts:41`,
`foamers.test.ts:28`, `parts.test.ts:30`, `ragdoll.test.ts:33`).
`VolumeMesh.update` sends dirty chunks to the mesher's promise and builds
the trimesh collider only when the promise lands
(`src/voxel/volume-mesh.ts` `update`/`apply`). On a loaded event loop the
chain can take more than one macrotask, so a fired dart met a missing or
stale collider. Proven by forcing: delaying the fake mesher by one extra
macrotask made the old settle miss the crossing shot. Fix: settle now
loops `update`/`setTimeout(0)` until `mesh.busy` is false, the pattern
`tests/level/level-1-3.test.ts` already uses. All eight files got the same
one-line-shaped change (added the `busy: boolean` to the mesh parameter
and the while loop) because they are the same bug.

Cause 2, found by a probe (test 1 copied in-process, 80 repetitions, per-hit
health deltas logged): at the test's old crossing health (band + 2 = 3.80,
band 1.80) the crossing needs two effective damages: the body dart's 1.0
and the bounce dart's 1.0 (13.04 m/s, over the 8 m/s `minDamageSpeed`).
Whether the bounce re-hit the body depended on the wound's remesh in flight
and where debris chunks from the first shot (random speeds, dart-castable)
fell: the probe failed 2 of 80, and in both failures the bounce dart hit
the floor or a debris chunk and health stopped at 2.80, above the band.
The fix: `tests/foamers/finisher.test.ts:108` sets the crossing health to
band + 0.5, so one dart's 1.0 damage alone crosses the band; the bounce's
re-hit (which deals at most one more 1.0) can no longer change the
outcome. 60/60 in-process after, and the same probe at band + 2 failed
2 of 80, which is the forced evidence.

Verification: the debug probe file was deleted before the gates. `tsc
--noEmit` clean, `npm run build` clean, `vitest run` 5 full runs clean
(82 files), `tests/foamers/finisher.test.ts` alone 30/30, no em or en
dash in any touched file. Could not check by eye in a browser: nothing
visual changed; the sole changed behaviour is the second shot's starting
health (3.80 now 2.30), which the test itself asserts via
`finishWeakened`.

Unrelated, observed but not touched (out of this card): in loaded full
runs `tests/foamers/rig.test.ts` ("movement never snaps", an assertion on
per-frame joint deltas) failed 3 of 10 full runs but passed 10 of 10 when
run alone; it is wall-time sensitive, the kind of timing test the card
warns can flake under load. It is not the BUG-09 failure: `finisher.test.ts` never flaked in the final verification. Flagged for whoever next sees it: a fixed 0.35 rad threshold on 60 Hz frames is a marginal bound when the isolate pool steals wall time.

### 2026-11-07: GAME-10f review, merged (Claude)

- Played on the range (`range.html?watch`, F07, spawned 10 m out): it
  walked in, crouched at 7.6 m for 0.6 s, flew 0.9 s, landed 1.5 m short
  of the player, and the lime ring grew to 8 m and hit once (health 100
  to 85), then it went back to punching. The palette matches the card;
  the turnaround is in `design/foamers/F07-sheet.png`.
- One fix: every Foamer of every type (a pack of Swarmers included)
  built its own torus geometry and material for the ring, and the
  landing rebuilt the geometry each leap. Now only a type with a
  `shockwave` block gets a ring mesh, built once at spawn at full radius
  and scaled, with one shared material; the geometry is disposed with
  the Foamer. New test 5b.
- Noted, not changed: the Spark's Status said "punch 10, like the
  Roamer"; the data is 14 and it uses the Slowmer's melee brain
  (corrected in Status). The punch lists both forearms in `needs`, but
  with one forearm gone `chooseAttack` falls back to the last attack, so
  it still punches.
- The full suite under the other models' load failed two timing tests
  (nav-grid bake, rig-motion "never snaps"); both pass alone.
- Not checked: jumping or dashing through the band in play, the sounds,
  the [Paul] sword or fists question.

### 2026-11-07: GAME-10f, the F07 Brawler, code done (Qwen 3.8 Flash Next via Pi)

- Card `tasks/GAME-10f.md`, branch `game-10f`, two commits: `4541c47` the
  look and the type, `e2277c0` the leap and the ring. Not merged, not pushed.
- Asked for: the F07 Brawler (CONTENT-PLAN F07) in the factory palette, a
  walk-in melee type with a punch, and a leap slam that lands a shockwave
  ring the player jumps or dashes through. Losing both legs ends the leap.
- Built: the rig's palette (purple body, orange armour pads, lime fists,
  angry eyes like the others) in `data/foamer-rigs.json`, turnaround
  rendered to `design/foamers/F07-*.png` with `tools/render-rig.ts`, and
  the crouch and leap poses to `design/foamers/poses/F07-{crouch,leaping}-
  t1-*.png` (rendered through the same encoder with `crouchMotion`/
  `leapMotion` at k 1); an
  `F07` type in `data/foamers.json` (health 45, a `punch` at 10, a `leap`
  block: min 5 m, max 12 m, cooldown 6 s, crouch 0.6 s, speed 7 m/s, arc
  1.4 m, land 1.5 m short; and a `shockwave` block: 9 m/s out to 8 m,
  0.6 m band, 15 damage); the leap and ring maths in a pure module
  `src/foamers/leap.ts`; the one decision in `src/ai/f07-brain.ts`
  (`decideLeap`, the sibling of `decideCharge`); two new `FoamerState`
  states (`crouch`, `leaping`) run by the Foamer system's machine, and
  their poses in `rig-states.ts` (`crouchMotion`, `leapMotion`, driven by
  data in the rig's `motions`); the ring as one torus per Brawler scaled
  as it grows; `F07-crouch`, `F07-punch` and `F07-land` placeholder synth
  sounds in `data/sounds.json` and `design/SOUNDS.md`; and the shockwave's
  hit on the player on both pages (`src/game/game.ts`, `src/range/main.ts`)
  behind `playerVulnerable` (`player.grounded && !player.dashing`).
- Decided: no new brain (the Roamer's does the walk-in and the punch, its
  token is `melee`), the F05's shape for the leap (PLAN 14, four entries).
  The arc's `vy` is read from the state clock, not integrated, because the
  character controller zeroes a vy on the frames after the launch and the
  Brawler hung at its apex (seen in the test's flight log). The flight's
  horizontal step goes through `_wish` at `leap.speed`, not `moveTowards`,
  which caps at the walk's 2.4 m/s. A leap blocked short by a wall still
  lands its ring at the end of the time. The one hit of a ring is marked
  inside `bandReaches`, so no caller can forget it. Sword or fists stays
  Paul's: the fists are kept, coloured lime, `[Paul]` notes in the rig and
  in PLAN 14.
- Tests: `tests/foamers/leap.test.ts` (8: the flight maths, the ring
  growing, the band hitting once, missing one the band has passed,
  missing one that spent it in the hole), `tests/foamers/brawler.test.ts`
  (8, in a physics rig: it crouches then leaps inside its distances and
  not outside them, the cooldown starts at the crouch, the flight is an
  arc that comes back down, the landing sends the ring out once and the
  ring is drawn, a grounded player is hurt once, one in the air is not,
  no leap with both legs gone and a leap with an arm gone), and
  `tests/ai/brawler-brain.test.ts` (3: `decideLeap` at the min, the max,
  inside the cooldown, without legs, and that only F07 has leap numbers).
  Full suite 553 pass, 2 skipped; `tsc` and `npm run build` clean.
- Not checked by eye: no browser here, and this model cannot open the
  rendered PNGs either. The turnaround and the pose sheets were rendered
  and their pose extents measured numerically (the crouch dips the body to
  1.81 m from 2.02 and the leap raises it to 3.04 with the arms up), but
  the Brawler in the game, the crouch and leap poses in motion, and the
  ring's look as it grows were not seen. The three
  placeholder sounds were not heard. The jump-over-the-band and the
  dash-through are unit tested (`playerVulnerable` false) but not tried in
  play, and the ring's own read at speed (can a player tell where it will
  land in the 0.6 s crouch) is a playtest question, not a code one.

### 2026-11-06: GAME-10c review, merged (Claude)

- One bug found in play on the range (`range.html?watch`, F06): the
  small blobs never bounced. After a bounce the blob's centre was left
  on the surface it hit, so the next frame's ray started inside it, hit
  with a zero normal and spent the second bounce at once; the blob burst
  within three frames. The Spark's wall test still counted two bounces,
  so it passed. Fix: lift the blob off the surface by its radius. New
  test 2b: a blob off the floor rises above 0.2 m and its two bounces are
  more than 6 frames apart (it failed at 1 frame before the fix). After:
  on the range a blob bounces off the floor, flies about 1.5 s, bounces
  off the far wall and bursts.
- Removed a second, unused `BlobSpec` interface the Spark left in
  `projectiles.ts` (the used one is in `blob.ts`).
- Seen in play: it hovers 3.00 m over the ground and spits fans of three
  lime blobs; the fourth attack was the big pink blob; one fin broken
  (`breakPart`) dropped it to 1.20 m, both to the floor (0.02 m), where
  it keeps spitting.
- For Paul to judge (the look is his): the spikes render as a jagged
  pixel crown rather than soft rounded nubs, and from the side the jaw
  sticks out as a separate orange lump and the fins are flat slabs. Both
  come from the greybox rig's shapes; only the colours changed here.
- Not checked: the three placeholder sounds by ear, the big blob's parry
  in play (unit tested), the mouth multiplier in play (unit tested), the
  hover over uneven ground in a level.

### 2026-11-06: GAME-10c, the F06 Floater (Qwen 3.8 Flash Next via Pi)

- Asked (card `tasks/GAME-10c.md`): Paul's F06, a Heavy that floats slowly
  and spits blobs: bouncing blobs and one big parryable one, the mouth a
  weak point only while open, fins lost making it sink and float slower.
- Built, in three commits on `game-10c`. Stage 1: the F06 rig's palette
  (lime body and nubs, purple fins and tendrils, orange jaw and mouth),
  the type entry in `data/foamers.json`, and the float in the Foamer
  system (hover from the type's `float` block over
  `navGrid.groundAt(x, z, y)`, no gravity, the same `steerAgent` path a
  walker takes, damaged hover and speed with fins lost, floor with none).
  Renders in `design/foamers/F06-*.png`. Stage 2: blobs. The
  `ProjectileSystem` takes a per-ball `BallKind` (speed, gravity, size,
  life, colour, bounces, cap, attack) from the type's `blob` block; a
  small blob reflects off the ray hit's normal (`castRayAndGetNormal`)
  until its bounce count runs out; the big pink one carries the Roamer's
  own material so both pages parry it unchanged. `handleHit` multiplies
  the jaw's damage by the type's `mouth.damage` while the state is
  windup or strike. Sounds: F06-hum (loop while flying, owned by
  `FoamerSounds`), F06-spit (the `throw` cue), F06-blobBounce (the
  projectile cue), all placeholder synths in `data/sounds.json` with
  rows in `design/SOUNDS.md`. Stage 3: this entry, the PLAN row and four
  `§14` decisions.
- Decided: reuse `decideF02` (no `f06-brain.ts`); the float is data plus
  the nav grid's ground, and the rig keeps no `hover` field (`rig.test.ts`
  pins the rig's lowest point to it, and it is a drawing height, not a
  physics one); a blob is a ball of a kind, not a second system; the
  open-mouth rule keys on the attack's own states, not a new timer; the
  Floater's speed is `rig.speed`, not `f.speed()` (the no-legs handicap
  would hand it 0.25 times). PLAN `§14` has the detail.
- Tests: `tests/foamers/floater.test.ts` (5: spec and health, hover over
  the floor after 5 s, one fin lost, both fins, killed goes down),
  `tests/foamers/floater-blobs.test.ts` (6: the fan and its material and
  bounces, bounce off a wall then burst, every fourth big blob and its
  material/size/speed, the live cap, the open mouth only, the data read),
  `tests/ai/floater-brain.test.ts` (2: ranged distances, keeps its ring).
  Full suite 524 pass, 2 skipped; `tsc` and `npm run build` clean.
- Not checked by eye (no browser here): the Floater's look and palette,
  the float and bob in motion, the blobs bouncing off real geometry,
  the big blob's parry in play, and all three sounds.
- Untouched as the card asks: level 2-2, the Floater in any level file,
  vacuum entries, flying over gaps the grid cannot path, tendril attacks.

### 2026-11-06: LVL-03a review, merged (Claude)

- One bug found in play: in the Pit's wave 1 a Swarmer stood at
  (-12, -51) in approach for over 25 s. Its rift sat on the pit floor
  under the north ramp, and a ramp is a tilted slab, so it spawned in
  the pocket under the slab. `pit-rift-n2` was under the slab's low end
  too. Moved n1 to the ramp's head on the west ledge (-15, 0.2, -51) and
  n2 just past its foot (-5.5, -3.8, -50). New test 4d: every rift in
  the level passes the nav grid's `canStandAt` (it failed on both rifts
  before the move). After: the first Swarmer walks down the ramp and all
  six reach the player within 16 s.
- In the browser (`arena.html?watch&level=1-3`): the explore pair comes
  out and reaches the player; the Pit's ramps feed the pack in; in the
  Yard's wave 1 two Swarmers were slow to leave the north end (about
  15 s) but did arrive. Every arena cleared by script, the Yard's north
  gate opened, and the exit pad showed "Level complete".
- Corrected in the notes: the Pit's third wave is two Slowmers, and the
  breather and the Yard are at the pit floor's height (-4), not 0.
- Not checked: the look of each space by eye (the pane was hidden; only
  the bay was seen: the dummies stand clear of the north door), the
  pacing with real shooting, the frame time with 10 Swarmers.
- Flaky test, open: after the merge one full run on main failed
  `tests/foamers/finisher.test.ts` test 1 (`f.finishWeakened` still
  false after 120 ticks); it passed alone and on the next full run. It
  counts ticks, not milliseconds, so load alone should not change it:
  something in it is not deterministic. Possibly the same unexplained
  vitest exit 1 seen before a push earlier on 2026-11-06. Not looked into.

### 2026-11-06: LVL-03a Level 1-3 beats 1 to 5 (DeepSeek V4.1 Flash via Pi)

Asked for (card `tasks/LVL-03a.md`): the bay, explore 1, Arena 1 the Pit,
the breather, Arena 2 the Yard and a temporary exit in `data/levels/1-3.json`,
listed in `src/arena/levels.ts`, with tests for the walk, the nav grid,
the swarm cap and the exit pad.

Built in three stages, each green before its commit:

- Stage 1 (`ef33c28`): the 18 by 12 bay (three foam-white dummies as
  voxel pieces, ammo A1 40), the two 10 m corridors and the 12 by 10
  explore room (one F01 and one F03 from the side seams, one wave, a lock
  so the pair cannot be walked past), then the Pit shell and its arena.
- Stage 2 (`ded13c0`): the Pit's centre block and two pillars, the 8 by 6
  breather, the 44 by 36 Yard with six islands, four gates, both waves and
  its ammo, the S2 and U1 marks, and the temporary exit pad.
- Stage 3: this entry, the PLAN.md row and section 14 decisions.

Decisions and why (also in PLAN.md section 14):

- The Pit's centre block is 3.2 m tall, not 3.5: a voxel zone cannot pass
  3.2 m on any side.
- The Yard islands are 3.2 m square, not 4 to 6, so six islands at one
  zone each fit the arena's six zone budget. Each has a 2.5 m ramp at
  26.6 degrees (inside the nav grid's 40 degree slope), and the nav test
  walks up and back down all six, so no Foamer is stranded.
- The U1 and S2 marks are flat 0.1 m shell slabs, not voxel pieces, for
  the same zone budget. Both carry the [Paul] note.
- East and west Yard gates are `sealed`, since the card's waves only use
  the short ends and a player should not leave mid fight.
- A wave's F03s already arrive one at a time at rifts and each is a swarm
  token Foamer, so no change to `src/level/` was needed. The card's
  question is answered in PLAN.md section 14 rather than in code.

Lesson: voxel colliders are built from mesher promises, so a test that
rays or bakes the nav grid must wait for `voxelMesh.busy` to go false and
pass `built.voxels` plus the volume origin to `makeLevelAI`, as the page
does. Without that the islands read as 4 m down and the down paths fail.

Not verified by eye: no browser was opened. The corridor and room look,
the pit ledges and ramps at 27 and 34 degrees, the yard islands' footprint,
door sizes, and how the Yard's 8 then 10 Swarmers feel in play.

### 2026-11-06: BUG-08 review, merged (Claude)

- The fix is small and stays in the existing states: `blockedSeconds` on
  the Foamer, filled in `stepBrain`, read by the F02 brain's hold case.
  One difference from the card: the timer counts whenever the flight is
  blocked and the player is outside the retreat distance, not only while
  it holds, so a Roamer that arrives at its ring already blocked walks on
  at once instead of sidling 3 s first. Harmless, left as is. tsc, 511
  tests and the build pass (one full run lost the nav grid timing test
  to the Spark's parallel run; it passes alone and on the rerun).
- In the browser (`arena.html?watch&level=1-2`, parry corridor and Ring
  cleared by script, player held at (-3, -29) under the slab): both floor
  2 Roamers left their ring once blocked for 3 s, walked across floor 2
  to the ramp and down it (y 5 until 9 s, 3.3 at 12 s, 0 by 15 s) and
  threw from the ground floor: 10 thrown, 10 hit in 30 s.
- Not checked: how the walk out of the ring reads in the Pit by eye, the
  Pit's live wave (headless 12 thrown, 11 reached).

### 2026-11-06: BUG-08, a Roamer blocked too long walks to the player (DeepSeek V4.1 Flash via Pi)

- Asked: a Roamer that finds no clear throw anywhere on its ring sidles
  for good. Level 1-2's tower shows it: two Roamers on floor 2 over a
  player on the ground floor under the slab never reach them.
- Built: the Foamer keeps `blockedSeconds` (reset by a clear flight and by
  arriving inside its retreat distance), the system fills
  `AgentInput.blockedSeconds`, and `decideF02`'s hold case past
  `brain.blockedRepathSeconds` (3, `data/ai.json`) asks for `followPath`
  instead of `ringMove`, or `backOff` inside the retreat distance. No new
  state; the reason is in PLAN section 14.
- Repro and counts: a new `tests/ai/tower-throw.test.ts` case, the two
  floor 2 rifts and the player at (-3, 1.6, -29), 30 s. That spot is off
  the stair well, so no arc can drop through the floor's opening: before
  the fix 0 thrown, 0 reached; after 10 thrown, 10 reached. The earlier
  `DOWN` spot at (-8, -29) sits under the opening and already reached (5
  thrown, 4 hit) without the fix, so it is not the repro and its test is
  left as it was.
- Also: the Pit case holds at 12 thrown and 11 reached (BUG-07's was 13
  and 13; no ball is lost, one fewer is thrown), the tower's floor 2 case
  is unchanged at 22 thrown and 21 hits, and F04, F01, F03 and F05 are
  untouched apart from the new input field.
- Tests: five brain cases in `tests/ai/f02-brain.test.ts` (sidles under
  the time, walks past it, backs off inside the retreat distance, back on
  the ring the step the flight clears, and approach unaffected).
- Decided 3 s by measuring 3, 4, 5 and 6 on both rigs; the numbers and the
  trade-off are in PLAN section 14.
- Not checked by eye: the Roamer walking down the tower's ramps in the
  browser, how the walk down and the return to the ring read in the Pit,
  and whether 3 s of sidling before it commits looks patient or slow to a
  player. The rigs are headless only.

### 2026-11-06: BUG-07 review, merged (Claude)

- DeepSeek's fix samples the ball's own launch arc (6 ball-radius shape
  casts with the ball step's filters, now one shared `ballIgnores`), cached
  per Foamer for 0.25 s; a Roamer with no clear flight does not start a
  throw, hands its token back (`noFlight`) and keeps sidling; a release
  that went blocked during the windup is cancelled. F04's fanned volley
  is exempt, its tests unchanged. Checked in review: the ball filter
  refactor is equivalent to the old one, the launch math is unchanged
  (moved into `launchVelocity`), `chooseAttack` is deterministic so the
  check judges the attack that is thrown. tsc, 505 tests and the build
  pass.
- In the browser (Pit, real wave 2, wave 1 cleared by script, player
  held at (0, 1.2)): 20 thrown in 30 s, 19 reached the player (BUG-06's
  review saw 2 in 10). The Roamers walked the ring between throws.
- Not checked by eye: the tower case (headless only: no bursts above
  y 3 with the player under the slab, 21 of 22 hits from floor 2); a
  Roamer that can find no clear spot at all sidles for good rather than
  pathing elsewhere.

### 2026-11-06: BUG-07, a Roamer throws only when its ball can arrive (DeepSeek V4.1 Flash via Pi)

- The card saw a Roamer throw into cover: in the Pit's wave 2, 8 of 10
  balls burst on the level trimesh 1.7 m from the hand, and in Level
  1-2's tower two Roamers on floor 2 kept throwing with the player under
  the slab. Cause: `FoamerSystem.lineOfSight` is one ray from the chest
  to the player's eye, while `ProjectileSystem.launch` throws from the
  ball hand, lower, on a lofted arc. A clear sight is not a clear throw.
- Headless repro first (`tests/ai/pit-throw.test.ts`): the Pit as the
  arena page builds it, one F02 at (-6.5, 0, 5.8), a still player
  capsule at (0, 0, 1.2), counting thrown, reached and burst. Before:
  18 thrown, 0 reached, 17 burst (one still flying).
- The fix is `ProjectileSystem.flightClear(from, eye)`: it rebuilds the
  launch's own velocity (`launchVelocity`, now shared with `launch`) and
  walks `ball.flightSegments` (6) shape casts of the ball's radius along
  the arc, with `ballIgnores`, the ball step's own filter. Level geometry
  stops the check; the player's capsule, foam chunks and Foamer parts
  (its own hand included) do not. `handAt` is shared too.
- `FoamerSystem` caches the answer on the Foamer (`throwClear`,
  `throwCheckIn`) and reads it at three points: the F02 brain will not
  ask for a ranged token while the flight is blocked and keeps sidling
  instead of holding; `canStartThrow` refuses a blocked throw and gives
  the token back with the new `noFlight` reason; the release re-checks as
  a backstop, since the 0.6 s windup lets the player step behind cover.
  A blocked Foamer never freezes: it always keeps a move.
- Cost: at most four shape casts a second for a thrower that wants to
  throw, on the `brain.flightCheckSeconds` timer (`data/ai.json`, 0.25),
  and none for a Foamer that is not a ranged thrower, or that is in an
  attack state. A blocked thrower that is sidling re-checks; a clear one
  casts once at the windup's start and once at the release.
- F04's volley is exempt (multi-shot attacks are skipped by
  `singleBall`); its tests pass unchanged.
- After: Pit 13 thrown, 13 reached, and every one of the 13 bursts is on
  the capsule; tower under the slab 5 thrown and nothing bursting above
  y 3; tower on floor 2, 22 thrown, 21 hits.
- Not checked: anything by eye. No browser here, so the throw's look
  (does a sidling Roamer read as searching?), the sound of a withheld
  throw, and the fight pacing at the Pit are unverified.

### 2026-11-06: LVL-02d review, merged (Claude)

- DeepSeek built the tower in one run where the Spark failed four times:
  floors at 0, 5, 10, 15 m, three 22.6 degree ramps in side bands, its
  own 19 m roof (the level's ceilings cut back to its walls), two
  lock-free arenas, a cardboard plug that drops as one slab. The
  connector's north end is now shut, so the route runs through the
  tower's ground floor and the fights cannot be skipped. The
  `topMetres` 17 roof check is a test in Level 1-2 and the Pit (0
  bridged layers). Timing alone: bake 38.8 ms, path 1.16 ms. Existing
  level tests were updated for six arenas, none loosened. Main merged
  in; tsc, 502 tests and the build pass.
- In the browser (`arena.html?watch&level=1-2`): the player stands on
  all four floors and on the ramps at the right heights (ramp 1: 0.9,
  2.6, 4.2 m along it). The first fight's two Roamers spawn on floor 2;
  with the player on the ground floor under the slab they throw into
  the slab (no hits); from floor 2, 7 throws in 10 s, 7 hits.
- Not checked: the floor 3 fight, the plug by hand, the climb with real
  movement keys (positions were set, not walked), the look beyond one
  greybox view. Roamers throwing with no clear line (here at the slab,
  in the Pit at cover) is the same open issue BUG-06's review found.

### 2026-11-06: BUG-06 review, merged (Claude)

- The cause is a real game bug, not only the helper's: `castRay`'s
  `timeOfImpact` is metres along a unit ray, and the ball moved by
  velocity times it, so on any hit it jumped speed times too far (about
  1 m past the capsule's front). A player's block or parry by hand was
  judged from behind as often as not, and wall bursts showed past the
  wall. DeepSeek's fix (`t / speed`) and the debris pass-through for
  balls are right. Headless Pit test 2 to 10 of 10; 497 tests and the
  build pass. Two garbled comments in the range helper (from BUG-04)
  reworded.
- In the browser (Pit wave 2, real fight, wave 1 cleared by script):
  hand-placed F02s gave 6 parries in 10; in the live wave, of the balls
  that reached the player both were parried, but 8 in 10 never arrived:
  a Roamer at (-6.5, 5.8) throws into the level trimesh 1.7 m from its
  hand (bursts at y 2.6). That is the Roamer throwing without a clear
  line, a separate issue (next card), not the parry.
- By hand: blocks and parries should now feel right from the front for
  the first time; worth a playtest.

### 2026-11-06: BUG-06, a ball hit is a distance not a time (DeepSeek V4.1 Flash via Pi)

- Card: `tasks/BUG-06.md`. Branch `bug-06` from `bug-04`; BUG-04's
  helper fix (face the timed ball's thrower, lower the disc after) is
  kept as it was and BUG-04's Pit test is now green.
- Cause 1, the reported one: `ProjectileSystem.update` read Rapier's
  `castRay` `timeOfImpact` as seconds and stepped the ball by
  `b.vel * t` (m/s times "seconds"). It is a distance in metres along
  the unit ray, as `src/weapons/darts.ts` already notes. Ball 0 at
  `(-0.33, 1.71, -7.76)` hits at 0.132 along a 9.5 m/s ray and landed
  at `(0.63, 1.31, -8.45)`: 1.27 m of travel instead of 0.132 m, about
  1.1 m past the capsule's front. `onHitPlayer`'s `from` (0.5 m back
  along the velocity) then sat at `(0.2, 1.5, -8.2)` against an eye at
  `(0.0, 1.6, -8.0)`, behind the capsule centre `z -8.0`, so
  `blocksAttackFrom` read 75 to 143 degrees off the view and the throw
  hurt. Fix: `b.pos.addScaledVector(b.vel, t / speed)`.
- Cause 2, found with the same probe and not on the card: a parried
  ball bursts on its thrower and leaves foam chunks at the ball hand.
  The next ball's ray stopped on a chunk (collision groups `0x40001`,
  `DEBRIS_GROUPS`, a dynamic body at the hand) 0.03 to 0.12 s after it
  left the hand, so it never reached the player and the walk recorded
  "gone". Fix: the ball's ray filter passes debris, as the darts' does.
- The card's four candidates, checked with numbers and none of them
  the cause: the cast starts outside the capsule (0.16 m out, hit at
  0.13); the capsule collider and the timed centre are the same point
  (`cap` and `pc` both `(0.00, 0.92, -8.00)` on every hit), so the
  capsule does not lag; the eye and the capsule agree; nothing lands
  on the cap.
- Counts, `npx vitest run tests/shield/parry-pit.test.ts`, ten runs
  each. Stage 1 (the as-is helper, so its own wrong-Foamer aim still
  costs it): 1 of 10 before, 7 of 10 after. Stage 2 (the helper's fix):
  2 of 10 before, 10 of 10 after. Stage 1's pin moved from "fewer
  than 5" to "fewer than 9", with the reason in the comment: the old
  pin described the broken sim, not the helper.
- The HIT log line now also prints the capsule collider, the timed
  centre and `from`'s distance from the eye, which is what the card
  asked to instrument; it is always on, cheap, and it is the test's
  own output.
- Status: BUG-06 done, awaiting review (Claude Opus 5.5). Full suite
  497 pass, 2 skipped; `tsc --noEmit` and `npm run build` clean; no em
  or en dashes in the two files touched.
- What a player by hand may notice: a ball now meets them where the
  ray says, so a block or parry from the side judges on the throw's
  real direction instead of behind the centre. The parry window and
  the shield's numbers are unchanged.
- Not checked by eye: the browser Pit (2 in 10 there per BUG-04), the
  chunk-at-the-hand case in a live game, and whether the foam chunks
  a parry leaves now read oddly flying through a new ball.

### 2026-11-06: LVL-02d and BUG-06 started with DeepSeek (Claude)

- LVL-02d stage 2 (the tower) restarted with DeepSeek V4.1 Flash on
  branch `lvl-02d` (main merged in), with orders to write the level by
  short scripts and to check the `topMetres` 17 side effect on the other
  levels. The walls and ceilings are 9 m, so four floors 5 m apart do
  not fit the bay: it chooses a taller bay roof or lower storeys and says
  which in section 14.
- BUG-06 (new card): find why a ball meets the player's capsule from
  behind in the Pit (BUG-04's lead) and fix it, so BUG-04's Pit test
  parries 9 in 10. A second DeepSeek run, branch `bug-06` made from
  `bug-04` so it keeps Qwen's repro and helper.

### 2026-11-06: BUG-04 stopped at 2 in 10, a lead (Claude, morning)

- Qwen 27B ran about ten hours in all and was stopped at 07:10 so the
  machines are idle while Paul is out. Its work is on branch `bug-04`
  (commit "work in progress"), not merged: the Pit test's stage 2 still
  gives 2 parries in 10 and fails.
- On the branch: a headless Pit repro (`tests/shield/parry-pit.test.ts`,
  stage 1 records the old helper), and a helper that times the earliest
  ball, faces that ball's thrower and lowers the disc after the ball is
  done. Facing the right thrower did not change the count, so that was
  not the cause.
- Lead from its instrumented run, not confirmed: ball 14 first touches
  the capsule 0.39 m in front of it, above the top, but the hit is
  judged with the ball at z -8.6, behind the capsule centre (-8.0), at
  138 degrees to the view, so the shield reads it as from behind and
  the player is hurt. If so the cause is where the hit is judged in
  `src/foamers/projectiles.ts` (the ball moves on past the contact
  before `onHitPlayer` runs), outside the card's files: a next card
  should check that first.
- Nothing checked in the browser.

### 2026-11-06: BUG-05 not merged, the review's test was the cause (Claude, overnight)

- DeepSeek reproduced the stuck Swarmers headless and found why: when
  the pack was placed, the player was still at the level start in the
  corridor beyond the open `pit-in` door, so the shortest path to them
  left the pit; the door then locked them out. That is normal chasing,
  and the "too fast" trip was over more time than the BUG-03 review
  thought. In play, arena waves spawn Swarmers at rifts inside the arena
  after it locks.
- Its fix leashes a hand placed pack to 11 m from where it was put. Only
  the range calls `spawnPack`, so the leash changes nothing in a level,
  but on the range a pack spawned 20 or 30 m out would stop 9 m short of
  the player. Not merged. The branch `bug-05` also updates
  `tests/ai/pit-rig.ts` to build the grid with the voxel pieces the way
  the page does (BUG-03): worth taking on its own later.

### 2026-11-06: LVL-02d stage 2, the tower in the bay (DeepSeek V4.1 Flash via Pi)

- `data/levels/1-2.json`: the beat 5 tower (A5) now fills the bay off the
  connecting corridor, interior x -19..1, z -36..-22. Four floors at 0, 5,
  10 and 15 m; three side-by-side ramps in 3 m bands (5 m of rise over a
  12 m run, 22.6 degrees) that the player (slope limit 46 degrees) and a
  Foamer (nav autostep 0.2 m per 0.25 m cell) can both walk, which is why
  the design's 1.5 m ledges are not the route. Each upper slab is a ring
  with a 3 m hole over the ramp under it, so no flight is stacked on
  another and every floor has 5 m of headroom. Path from the bottom floor
  to the top is 9 waypoints on the nav grid.
- Roof decision (also PLAN section 14): the tower carries its own roof at
  19 m and the level's ceilings stay at 9.5 m, cut back to the tower's
  walls (`north-ceiling` now z -112..-42, plus `ceil-spur`, `ceil-conn`,
  `neck-lintel`). The alternative was floors closer together, and 5 m
  apart with 5 m of headroom needs 19 m. Nothing goes over `nav.topMetres`
  17 except the roof itself, which the bake sees as a flat face and which
  no agent can step onto (checked, see below).
- Route: the connector's north end is shut (`conn-n-end`), so the way on
  to the spur and the Crossroads is through the tower's ground floor: in
  at the 4 m doorway from the connector (x 2, z -31..-27) and out through
  the north neck (x -12..-8, z -37). Both tower arenas are therefore
  always on the route and cannot be skipped; a detour would have let a
  player reach the exit pad with arenas uncleared, and it would never open.
- Fights, no lock-in: `tower-low` (trigger the ground floor, 2 Roamers,
  rifts on floor 2) and `tower-high` (trigger floor 3, 2 Roamers plus a
  Slowmer). Both arenas have no doors at all, so `ArenaRunner.lock()` has
  nothing to shut: the player may walk out and back at any time, which is
  what the design asks for. `tower-low` is a checkpoint.
- Ceiling plug: `tower-plug`, cardboard, 3.0 x 0.6 x 3.0 m under floor
  3's slab at [-6, 9.2, -29], ceiling anchored. A ceiling anchor gets no
  bedrock row, so one dart's island search takes the whole slab (5400
  voxels: under `destruction.maxSearchVoxels` 6000) and it falls onto
  floor 2 as one piece, 0 damage. It is 3.0 m in plan, not the design's
  3.2, because 3.2 x 0.6 x 3.2 is 6144 voxels: over the island search's
  budget, the search would have treated the slab as anchored and left it
  hanging. New test 9 in `tests/level/level-1-2.test.ts` proves the one
  island and the falling piece.
- The topMetres side effect: new test 8 in `tests/level/level-1-2.test.ts`
  and a new test in `tests/level/pit-load.test.ts` scan every cell pair
  and assert no layer above 9 m sits within `maxStepMetres` 0.45 of a
  layer under 6 m in a neighbouring cell, in Level 1-2 and in the Pit.
  Both report 0, so no Foamer can step from a floor onto a roof or a
  ceiling top. The ceilings and the roof do become layers (the bake meets
  them), but nothing walks to them and the floors keep their slots (lowest
  first). The 40x40 budget test, run alone on an idle machine: bake 38.8 ms
  (was 37.6 ms with `maxLayers` 2 and `topMetres` 8, stage 1 recorded 36 to
  39 ms), median path query 1.160 ms (was 1.158 ms). The difference is
  noise, and the budget (150 ms, 2 ms) is untouched.
- Tests: `tests/level/level-1-2.test.ts` now expects six arenas in order
  (parry-corridor, ring, tower-low, tower-high, crossroads, gauntlet) and
  archetypes A6, A2, A5, A5, A7, A3; its walk from start to exit goes
  through the tower's ground floor and back out at the neck; the
  rift/pickup floor test casts from just above each spot so the tower's
  floor 2 and 3 rifts check their own slab; the exit pad test stands on the
  ground floor and on floor 3 for the tower's two arenas. `NavGrid.maxLayers`
  is public now (a test indexes `layerY` and needs the stride).
- Not checked by eye (no browser here): the tower's look and read from
  inside, whether the three ramps are easy to find from the ground floor,
  the plug's drop on screen, the fights' pacing on floors 2 and 3, and the
  frame cost of four floors of shell boxes.
- Not covered: `src/level/validate.ts` rule 9 does not know about the
  tower's two arenas overlapping in plan (their triggers are 10 m apart in
  height, so the reachable-order rule passes), and no test walks a Foamer
  up the ramps in the physics world: the nav path and the geometry are
  checked, the actual climb is not.

### 2026-11-06: LVL-02d parked after stage 1 (Claude, overnight)

- The Spark committed stage 1 on branch `lvl-02d`: `nav.maxLayers` 2 to
  4 and `nav.topMetres` 8 to 17 (so the bake reaches a 15 m floor), with
  tests (four floors in one cell, a path up switchback stairs) and the
  timing test unchanged (bake 36 to 39 ms, path 1.1 ms). Not merged:
  it only matters with the tower, and `topMetres` 17 also lets the bake
  see roof and ceiling tops in the other levels (floors still win the
  four slots, lowest first), which wants a check in the Pit and the Ring.
- Stage 2, the tower, failed four times: every run (resumed, thinking
  low, fresh, and with orders to write the level by small scripts) hit
  the Spark's output limit before saving anything. The Spark also slowed
  to about 25 s for a one word reply after the third. Parked for Paul:
  a smaller tower card, another model, or the Spark with a higher output
  limit.

### 2026-11-06: GAME-10e review, a Blocker wall in the Ring (Claude, overnight)

- DeepSeek finished all three stages in one run (the read-once brief
  worked). Checked by value: of `data/foamer-rigs.json` only F04 changed
  (the rest is number formatting), of `data/foamers.json` only the F04
  type; the F01 brain change is one new move intent; `shield.ts` gets one
  line, the Blocker's longer charge stagger with a fallback to the old
  time. Main merged in; tsc, 495 tests and the build pass.
- Played in the Ring with the watch: three Blockers walked to a line at
  9.3 to 9.4 m, about 1 to 1.4 m apart, shields up, and fired a three ball
  volley over the top. A B01 shot into the front: 3 darts, 0.08 damage.
- Changed in review: F04 `turnRate` 5 to 1.4 rad/s (the Darter's). At 5 a
  Blocker faced a strafing player within a second, so a side shot met the
  shield and flanking, the thing it teaches, could not work. At 1.4 it
  lagged a quick strafe by about 25 degrees. Tune in playtest.
- Not verified in the browser: a flank shot landing full damage (my
  scripted strafe and aim missed three times; the unit test for side
  damage passes), the shield charge stagger, the shield breaking, the
  look up close, the four sounds.

### 2026-11-06: GAME-10e, the F04 Blocker and its shield wall (DeepSeek V4.1 Flash via Pi)

Task card `tasks/GAME-10e.md`. Three stages, each committed green.

- **The type and the look.** `F04` in `data/foamer-rigs.json` (orange body
  and head with a wide lime visor bar, no eyes: a faceless blocker; arms
  and legs purple; a deep purple shield plate with a lime boss held ahead
  of the body; a blaster box over the right shoulder) and in
  `data/foamers.json` (`slots` 9 m hold, 1.2 m spacing; `stagger`
  0.5 s / `shieldChargeTime` 1.2 s; `line` count 3; armour `shield`
  damage 0.05, carve 0.3, arc 120 degrees; a 3 ball `volley` with a 5
  degree spread, pinned `range` 16 m, and a `bash`). Turnaround sheet in
  `design/foamers/F04-sheet.png`. `src/foamers/armour.ts` is the one
  cover rule: `armourOf` reads the part's table, `plateFaces` answers
  whether a dart came in inside the arc, and `handleHit` multiplies by
  `damage` only when the plate covers the hit.
- **The wall.** `src/ai/f04-brain.ts`: four states as the other brains,
  but the slot comes from the system, not the brain. `assignSlots` runs
  before the bids each step, sorts the live Blockers by agent id (no
  swapping), and puts them on a line across the player at the hold
  distance. Reaching one needed a new `toSlot` intent, because the nav
  grid only paths to the player. A token sends it from hold back to
  approach, where the state machine starts the attack, and the volley
  fires `atk.shots` balls fanned by `spreadDeg` through the existing
  `ProjectileSystem.launch`. A broken shield hands the step to the
  Roamer's keep-distance brain.
- **The charge.** `knockBack` uses `stagger.shieldChargeTime` (1.2 s);
  a staggered Foamer is already outside every cover arc, so the shield is
  down for free. The charge's own branch is untouched.
- **Sounds and range.** `F04-alert`, `F04-volley`, `F04-shieldhit`,
  `F04-shieldbreak` are placeholder synth entries in `data/sounds.json`,
  wired in `src/audio/foamer-sounds.ts` (the shield hit and break are new
  system sound kinds), and moved into the real table in
  `design/SOUNDS.md`. The range's F04 choice spawns the line of three
  (`spawnLine`); the watch lists them from `foamers.list` with no change.

Tests: `tests/ai/f04-brain.test.ts` (8) and
`tests/foamers/blocker-wall.test.ts` (8), plus the existing armour tests in
`tests/foamers/blocker.test.ts`. Full suite 492 pass, 2 skipped; `tsc` and
`npm run build` clean; dash scan clean on every file touched.

**Not checked by eye** (no browser here): how the wall reads as a line at
9 m, whether the 120 degree plate is wide enough to feel like a shield to
shoot around rather than a wall to give up on, whether three balls at a 5
degree spread are fair to parry, whether the shield-break sound lands with
the plate coming off, and how the Blocker's rig looks walking and firing.
The frame cost of three Blockers is unmeasured.

**Decisions** are in `PLAN.md` section 14, `PLAN.md`'s GAME-10e row is
updated, and the card's out of scope items (level 2-1, F06 and later, new
finished art) are untouched.

### 2026-11-06: BUG-03 review, the Pit's block seen by the grid (Claude, overnight)

- Qwen 27B finished all three stages in one run, tests shown failing on
  the old code first (it used `git stash` for that; the shared stash list
  was checked afterwards and is empty). Main merged in (HANDOFF kept both
  sides); tsc, 472 tests and the build pass.
- On a fresh Pit page: the floor inside `pit-block` is no longer
  standable (`canStandAt` false at (0, 4), (-3.2, 4), (3.2, 4)) and the
  block's top is found at 3.2 m; a Swarmer pack centred on the block
  spawns nobody (every ring spot is inside it), one beside it lands all
  outside. Wave 1's Slowmers walked round the block from z 7 to a player
  at z 1.2. Paths from the ring top down the ramps still exist with the
  solid probe on (checked against a rebake with it off).
- Seen, not BUG-03: four Swarmers stood on the ring level at z -13.9,
  just outside the locked `pit-in` door, in `approach` with an empty path
  for 10 s. How they got there is not clear (they came from a pack placed
  by hand); worth a look with the Swarmer brain later.
- A pack centred on a solid block skips every member rather than moving
  out: fine for a hand placed spawn, but a level's pack spawn should not
  sit on a block. The validator does not check that yet.

### 2026-11-06: BUG-03, the nav grid sees the level's solid voxel pieces (Qwen 3.8-27B via Pi, qwen-machine)

`tasks/BUG-03.md`. Two faults from the BUG-02 review: the load-time bake
ran before the level's voxel pieces had their colliders (they mesh off
the main thread, a few frames later; feet and colliders arrive
separately) so on a fresh page the bake met only the shell, and a cell
inside a solid block read as floor because the pieces collide as hollow
trimeshes and the bake's shape cast meets only surfaces. In the Pit a
Swarmer pack round the centre block could stand in it.

- The grid takes a new private hook `solidAt(x,y,z)`, set by a public
  `setSolidAt` (default null, it doesn't change the grid's own tests or
  pages without pieces). `bakeCell` rejects a stand-able surface when
  a probe finds the agent's body inside the solid volume: samples at
  heights of 1/8, 9/20 and 7/8 of the agent's height above the surface,
  so a flat floor reads clear and a body pressed inside the block does
  not. A tunnel that cuts through a block passes the probes again on the
  carve's own rebake. `nav-grid.ts`'s bake did not touch the layer
  search, `nodeNear` or the A* (the card's limit, LVL-02d).
- `makeLevelAI` takes the level's voxel volume and the voxel mesh's
  world origin, and wires the hook to read the volume in world space
  (`src/ai/level.ts`); the origin is the mesh's because it carries the
  snap, and the range (no pieces) builds it without one. `levelAI
  .piecesReady()` re-bakes the level's bounds. The shared game frame
  (`src/game/game.ts`) notices the level mesher's first time it stops
  being busy (that backlog is dirty, then pending jobs; both a piece
  needs and live chunks; an empty level is not busy from load) and
  calls it once, so the first Foamer to path already sees every block.
- Bake timings on the Pit's bounds (once per load, the page pays them
  once):
  - full bake, no solid hook (old): 55.8 ms;
  - `piecesReady` rebake with the hook on (the page's second bake):
    45.4 ms;
  - the 40x40 budget test (bake + a query): bake 36.4 ms, query 1.158
    ms; the budget is 150 ms and 2 ms.
  The hook is nearly free: about one `volume.get` per stand-able
  candidate, and the volume is an in-memory array that the game mutates
  every frame already.
- Tests (all fail on the old code, pass on the new):
  - `tests/level/voxel-block.test.ts` builds a level with a 3 m solid
    block on a floor the way the page builds it (FAKE mesher, the
    microtasks, `piecesReady`), then the real Pit the same way. In the
    test level: the cell inside the block is "not" floor-height (read
    as floor on the old code), the block's top "is" stand-able, the
    floor round it is, and a carve tunnel through the block (and its
    piece's rebake) makes the floor under the hole walkable again. In
    the real Pit: for the centre of `pit-block`, `groundAt(0,4)` is
    3.2 (was 0), `canStandAt(0,4,0)` is false (was true: that is the
    read `spawnPack` used), floor under the ring and the exit room are
    untouched. The timing scratch is not committed; the numbers are
    here.

### 2026-11-06: GAME-09b review, the chunk finish played in the Pit (Claude, overnight)

- DeepSeek's first run looped for 2.5 hours reading files and wrote
  nothing; restarted with a map of the lines to read and edit, it built
  stages 1 and 2 in one run. Review found three things. Fixed by Claude:
  (1) every dart held a reference to the blaster's one reused shot
  object, so the next trigger pull rewrote the id and muzzle of darts
  still flying (each dart keeps its own copy now; test 10 fails on the
  old code); (2) shot ids were counted per blaster, so two blasters could
  share one (one counter now). Sent back: (3) a weakened Foamer could
  never be chunked in play, since the first dart of a shot killed it and
  the rest passed through (test 7 had set its health to 3, not weakened).
  DeepSeek's fix holds the kill for two steps so the whole shot lands
  (test 11). Claude added the same skip to the vacuum the finisher got.
  Main merged in; tsc, 469 tests and the build pass.
- Played with the watch in the Pit, B03 at 2.5 m on a weakened F01
  (health 1.6 of 6): 14 and 15 darts landed and it chunked each time: a
  hole through the body with the cream core showing, lime and purple
  foam cubes bursting out, and the body thrown back. Foam only.
- For Paul's playtest: the push is strong (2x), the burst is busy at 40
  cubes, and `FX-chunk` reuses the pop's chunk sound ID. Not heard.
  Area blasts (B05, B06, B07) are still open on the PLAN row.

### 2026-11-06: GAME-09b review fix, a held kill so a whole shot counts (DeepSeek V4.1 Flash via Pi)

- The fault (found by Claude in the browser): a weakened Foamer died to the
  first dart of a B03 shot, the kill was judged on that one dart's ~1
  damage against `minShare` x 6 = 1.5, it went down, its colliders dropped
  and the rest of the shot flew through. A B03 shot at 2.5 m on a weakened
  F01 gave 1 hit and 0 chunks.
- Fix: when a dart that carries a shot with a chunk block brings a Foamer to
  0 health and the chunk could still apply (`chunkPossible`: tier or
  `finishWeakened`, inside `rangeMetres`; the health share is not checked
  yet), the kill is held. `Foamer.dyingHit` keeps the killing hit and
  `dyingStep` the update count, so the Foamer keeps its colliders and its
  pose and does nothing else: no walk, no attack, no part wear, no finisher
  (`finisher.has` and the melee loop both skip it). The hold is settled by
  `resolveKill` (pop, then chunk, then go down, as before) at the start of
  the update two steps later, so the shot's darts of that step and the next
  all land, or at once when a dart from another shot hits it. Darts with no
  shot, and kills the chunk cannot apply to, resolve at once as before.
- Tests: test 7's weakened case now uses `finisher.weakenShare` x max
  (1.8) instead of 3, which was not weakened in play. New test 11: a full
  B03 shot at 2.5 m on an F01 at half `weakenShare` (0.9, the range page's
  spawn) counts more than one hit and more than `minShare` x max of the
  shot's own damage, and is a chunk. Confirmed test 11 fails on the old
  code ("expected 1 to be greater than 1") and passes now. Pop and go down
  tests unchanged.
- Verified: tsc clean, 459 tests (68 files, 2 skipped), build passes, no
  em or en dashes. Not checked by eye: the hole and burst on the range page.

### 2026-11-06: GAME-09b stage 1 and 2, the chunk finish (DeepSeek V4.1 Flash via Pi)

- `DartHit` carries `shot: DartShot | null` (`id`, `muzzle`, `chunk`), and
  `darts.fire` takes it as an optional fourth argument. `blaster.ts` gives
  each trigger pull one id in `beginShot()` (so B03's two barrels are one
  shot) and copies the muzzle in `fireDart`, so a shot is judged by what it
  did, not by what the player did earlier.
- The rule lives in `src/foamers/chunk.ts` as data-reading pure functions
  (`judgeChunk`, `shotSummary`, `addShotDamage`, `chunkRadius`), so a test
  can try the cases without a world. `handleHit` keeps a capped per-Foamer
  list of dart damage tagged with its shot, then at the kill checks pop,
  then chunk, then go down.
- "Already finishable" means before the shot began: the first dart's
  `preWeakened` flag is carried by the rest of the shot. A volley that
  weakens a Fodder and then kills it is a plain go down, as the card says
  full health F01s are; a Fodder is otherwise never a chunk.
- `goDown` and `buildRagdoll` take a push scale, default 1. A chunk sound
  (`FoamerSoundKind` `"chunk"`) plays `FX-chunk`, the placeholder the card
  names. `stats.chunks` counts chunk finishes.
- Numbers: B03 `chunk` range 5 m, carve 0.35 m, push 2.0; B01 slug 8 m,
  0.3 m, 1.6; Foamer base `catastrophic.chunk` minShare 0.25, tiers Heavy,
  Elite, Boss, carve 0.35, debrisMax 40, push 1. The carve radius is the
  larger of the Foamer's and the blaster's, so a blaster never carves less
  than the base.
- Range page: a "Spawn weakened" yes/no row puts a fresh Foamer into the
  finishable band (health at half `finisher.weakenShare`, flag set, no
  stagger) so B03 can be tried on an F01.
- Tests `tests/foamers/chunk.test.ts` (9): data, the rule's cases, the shot
  window, radius; live: F05 chunk at 3 m, plain go down at 8 m, F01 full
  health go down and a weakened F01 chunk, slug yes and B01 no, the centre
  of the hole empty and the back of the body intact, debris inside the cap.
- Not checked by eye: the hole shape, how the burst reads, the push, the
  sound. Verified: tsc clean, 457 tests (68 files, 2 skipped), build passes,
  no em or en dashes in the touched files.

### 2026-11-06: BUG-02 review, parries and packs tried in the Pit (Claude, overnight)

- Qwen 27B's first run hit its output limit mid stage 1; resumed with
  short replies it finished all three stages. Main merged in (HANDOFF
  kept both sides); tsc, 458 tests and the build pass. The code is sound:
  `timeToImpact` steps the ball's own arc and tests the swept segment
  against the capsule; `canStandAt` is layer aware.
- `parryNext()` in the Pit against wave 2's Roamers, facing the thrower,
  the disc lowered between tries: 2 parries in 10 (6 blocks, 2 hits),
  where the old helper gave 0. Better, not reliable. Likely cause: the
  ball meets the disc, which is in front of the capsule, before it meets
  the capsule the new timing aims at. Also: the helper leaves
  `forcedHold` on, so a caller must `block(false)` between tries (I did
  not at first, and every later try then read as a block). Paul's hands
  are still the real test of the parry window.
- `spawnPack()` round the Pit's central block still put Swarmers inside
  it, and BUG-02 is not why: the nav grid is wrong there. (1) The first
  bake runs before the voxel pieces build their colliders, so a fresh
  page's grid has no block at all (a rebake of the area found the block
  top at 3.2 m). (2) Even after a rebake the floor inside the block reads
  walkable: voxel pieces collide as hollow trimeshes, and the bake's
  agent shape test only meets surfaces, so a cell in the middle of a
  solid block passes. That is BUG-03 (`tasks/BUG-03.md`). The pack fix
  is right given a right grid, which is what its tests build.

### 2026-11-06: BUG-02, the parry watch's timing and the pack's floor

- The watch helper timed a loft by a line (Qwen 3.8-27B via Pi,
  `tasks/BUG-02.md`, branch `bug-02`): `parryNext()` asked straight-line
  distance over speed, the raise landed out of the parry window, and
  the ball burst on the disc as a block. The fix is `timeToImpact` in
  `src/foamers/ball-time.ts`, a shared pure function that steps a copy
  of the ball with the projectile's own gravity and the page's step and
  returns the step at which the flight segment reaches the player's
  capsule spine (the shape the projectile's own raycast meets, read
  from the eye minus `eyeHeight`). The helper waits that time minus the
  shield's `parryLead` and then holds: through `fixedStep` on the game
  page, through the loop's own step (`parryWaitSec`) on the range. No
  parry rule or number changed.
- The card's demonstration, shown in the test: the old
  distance-over-speed wait on a 20 m loft misses the window by more
  than a window, so the old helper would have blocked, not parried.
- `spawnPack` asked the grid before it placed: a new `canStandAt` on
  the nav grid (the layer the feet sit near, autostep up, full step
  down; a bare `walkableAt` reads the top face of a block a floor, so
  the Pit's central block is why a standability ask was needed), a
  ring spot that fails is stepped a few in along the angle
  (`pack.inboundStepMetres` 0.5, `pack.inboundSteps` 4 in `data/ai.json`), and
  a member the steps cannot place is skipped: neither spawned nor
  counted, and a skipped one is not a slot a later pack must budget
  against. Without a grid the placement is unchanged.
- New tests: `tests/foamers/ball-time.test.ts`,
  `tests/shield/parry-next.test.ts`, `tests/foamers/pack-walkable.test.ts`
  (the two pack rows fail on the old placement; verified).
  Existing shield, projectile and pack tests unchanged and passing.
- Not checked by eye: that the helper lands parries in the browser
  (no browser on this machine; the reviewer will check against the
  page), and the Pit's own pack near its central block. The helper's
  walk itself is what the test walks: the range's rig, the page's
  own flight, the page's own shield read, the helper's wait and its
  hold, end to end at 60 Hz.

### 2026-11-06: LVL-02c review, Level 1-2 played start to exit (Claude, overnight)

- The Spark's first run hit its output limit writing the level in one
  reply and saved nothing; resumed with "one room per edit", it finished
  all three stages. Main merged in (HANDOFF Status rebuilt by hand);
  tsc, 450 tests and the build pass.
- Played `arena.html?level=1-2&watch` through all four arenas: the parry
  corridor and the Ring as before; the Crossroads locks all four gates,
  Roamers come from the spokes, and every gate opens on clear; the bowl's
  wave 1 Roamers stand on the upper tier at the back, wave 2 clears, the
  exit door opens and the pad completes the level only after the fourth
  arena. No console errors.
- For Paul's playtest: in the greybox the bowl's three tiers read weakly
  (one grey); the lit exit sits between the two upper rifts, so it is seen
  from the whole bowl but the Roamers guard it. The way on from the
  Crossroads is the north spoke, not the way back the concept asked for
  (section 14 says why).
- Not checked by eye: pacing, the pillar seam's behind you moment, and
  whether Foamers use the ramps well under pressure.

### 2026-11-06: LVL-02c, Level 1-2 beats 6 to 9 (Qwen 3.8 Flash Next via Pi)

Built, in `data/levels/1-2.json` (no `src/` changes; the page already
drives any number of arenas through `LevelRunner`):

- Beat 5 gap: from the store's north wall a 4 m way on into a connecting
  corridor that runs north and bends west past an empty bay (x -20 to -8,
  z -30) where the tower will go. The bay has a foam-yellow floor marking
  and a `_note`; `data/ai.json` `nav.maxLayers` is too small for a four
  floor tower today, so the later card needs that raised first.
- Beat 6, the Crossroads (A7): a 14 x 16 m hub with a 1.6 m centre pillar
  (solid core plus four carveable foam skins as separate pieces, so it
  breaks off foam-style) and four 6 m spokes, each with a gate door. Lock
  shuts all four gates including the entry. Wave 1: 6 Roamers from the
  north, east and west spoke rifts, `delaySeconds` 2 so they arrive
  staggered from three directions. Wave 2: 7 Roamers from the same three
  plus 1 Slowmer from a floor seam rift at the pillar's base (the behind
  you moment). Cleared unlocks the north gate (`unlockOnClear` also
  reopens the others), checkpoint just inside the hub.
- Beat 7, breather 2: 8 x 8 m off the hub's north gate, one 20 dart box,
  two foam-yellow floor markings where the U2 station and the S3 ledge
  will go ([Paul], not built), `_note` says so.
- Beat 8, the Gauntlet (A3): a 31 x 25 m bowl. Tier 1 at 1.2 m along both
  side walls (4 m deep), tier 2 at 2.4 m along the far wall with a 4 m
  gap over the exit door. Ramps (1.2 m rise over 3 m) reach both tiers;
  the nav grid walks them (verified: paths floor to tier 1 to tier 2 and
  back down). Four foam cover pillars on tier 1, ammo boxes in both
  bottom corners (30 darts each). Rifts: two on tier 2 at the far wall
  (wave 1: 8 Roamers) and one floor rift in the bottom tier's centre
  (wave 2 adds 10 more Roamers, from all three, the ring of Firebacks the
  design asks for is a later tuning pass). Cleared unlocks the far door
  and the entry; checkpoint at the bowl's mouth.
- Beat 9: the level's `exit` pad moved from the store to behind a lit 4 m
  door in the bowl's far wall (`bowl-out`). The store is a plain room.

Decisions (PLAN.md section 14 row dated 2026-11-06): both arenas scaled
down to fit one 31 m wide north bound corridor beside LVL-02b's Ring; tiers
walked up by ramps not 1.2 m steps (a 1.2 m step is over the nav
autostep of 0.2 m so Foamers could not climb the bowl); the Crossroads' way
on is the spoke opposite the entry, not the design's south spoke, because
breather 2, the bowl and the exit all lie north and the runner only lets
you on once cleared anyway; the exit pad moved to the bowl's far door.

Tests (`tests/level/level-1-2.test.ts`): arenas in order with archetypes
and wave counts of all four; the walk from the start through all nine
beats to the new exit; nav grid checks that tiers, rifts and both new
triggers are walkable with paths up ramps and down; door block/open ray
checks including `bowl-out`; and a `LevelRunner` test that the exit phase
stays short of `complete` until the fourth arena clears. `npx tsc
--noEmit`, `npx vitest run` (444 passed, 2 skipped), `npm run build` all
pass. Level validator: no errors, one warning carried over from LVL-02b
(ring voxel count).

Not checked by eye (no browser here): pacing of the corridor, bay and hub;
whether the three spoke rifts read as three directions in play; the
pillar rift's surprise; whether the bowl's three heights read at a glance
and the tiers feel like cover; rift glow placement in the dark spokes;
Foamers streaming down the ramps sensibly; and that clearing the fourth
arena plus walking to the lit door feels like an ending.

Next: beat 5's tower card (raise `nav.maxLayers` first), U2/S3 stations
([Paul] content), secrets, the B02 blaster, the level's name and setting.

### 2026-11-06: OPS-02 review, the physics .wasm checked in a browser (Claude, overnight)

- Qwen 27B's route is sound: `@dimforge/rapier3d` 0.21.0 behind a shim
  that the compat name aliases to, so no import line changed. Main merged
  in cleanly; tsc, 449 tests and the build pass.
- Fixed in review: (1) the dev server hung on Loading. Vite's dependency
  pre-bundler put the Rapier glue in `.vite/deps` while its .wasm binding
  loaded from `node_modules`, two copies, and the one the game called had
  no wasm instance (the same split the model found and fixed in Vitest;
  curl could not see it). `optimizeDeps.exclude` keeps it one copy.
  (2) The guard test threw on a fresh clone with no `dist/` instead of
  skipping (`statSync` of a missing path throws), and it read whatever
  `dist/` was on disk, so a stale build failed it. It is now
  `tools/check-no-inlined-wasm.mjs`, run by `npm run build` on the fresh
  `dist/` (checked: it fails on a planted file and passes clean). (3) `vitest.config.ts` repeated the aliases; it merges
  `vite.config.ts` now, so the two cannot drift.
- Played in the browser, dev server and `vite preview` of the build: the
  Pit locks, Foamers spawn and go down to darts; the game, range and
  sandbox pages load with no errors. In the build the .wasm is its own
  file (3.0 MB raw, 1.19 MB gzip) and the game chunk is 223 kB (67 kB
  gzip), down from 4.5 MB.
- Not checked: the deployed site (Cloudflare serves `.wasm` as
  `application/wasm` and compresses it; check after the push), and older
  Safari (the build uses top-level await for the wasm import: Safari 15
  and later).

### 2026-11-06: OPS-02, the physics WebAssembly as its own file (Qwen 3.8 27B via Pi)

- Stage 1 (spike) succeeded, so the card proceeded to the guard test and
  the size check rather than a Blocked result. Route 1 from the card: the
  non-compat `@dimforge/rapier3d@0.21.0` (the same engine, exact-pinned, a
  new dependency) rather than keeping the compat build behind it.
- `src/physics/rapier-shim.ts` is the single re-export the card allows:
  it does `import * as RAPIER from "@dimforge/rapier3d"` and
  `export default { ...RAPIER, init }`, where `init()` is a no-op
  `Promise.resolve()`. The non-compat build has no `init`; its `.wasm` is
  an ES-module import, so by the time the shim's module loads the
  WebAssembly is already compiled. The 38 `RAPIER.init()` call sites and
  the `import type RAPIER from "@dimforge/rapier3d-compat"` type imports
  keep working because the default export still exposes the same surface
  (World, Collider, Ray, ...).
- `vite.config.ts` gains two `resolve.alias` entries. The first points
  `@dimforge/rapier3d-compat` at the shim. The second points
  `@dimforge/rapier3d` at the raw `node_modules/@dimforge/rapier3d/rapier.js`
  because the non-compat package has no `"exports"` field (only
  `"module"`), so the bare name would not resolve on its own.
- `vitest.config.ts` (new) has the same two aliases plus
  `test.server.deps.inline: [/@dimforge\/rapier3d/]`. This was the
  non-obvious blocker. Left external, Vitest evaluates the engine twice in
  one worker, once through raw Node ESM and once through Vite's transform,
  and the glue sets its wasm instance on the copy the tests do not use, so
  `wasm.memory` is undefined on the other and every World construction
  throws (203 test failures before the fix). Inlining the whole package
  forces one shared module graph, and 36 files failed / 203 tests before,
  all 67 pass after.
- Guard test `tests/core/no-inlined-wasm.test.ts`: runs only when
  `dist/` exists; fails if any `.js` there contains `AGFzbQ` (the base64
  head of the `\0asm` magic). It passes on the new build. `@types/node` is
  not installed, so the file carries `// @ts-nocheck` like the existing
  file reader, `tests/weapons/models.test.ts`.
- `public/_headers` needed no new rule: the `.wasm` lands under
  `/assets/*` (already immutable) and the Worker maps the `.wasm`
  extension to `application/wasm` by default. Verified by curl on
  `npx vite preview`: 200, `application/wasm`, and the `\0asm` magic in
  the body.
- Sizes (raw / gzip) recorded in the Status entry: `game-sounds` went from
  4,556,407 B (1,722,764 B) to 223,152 B (68,846 B); a new `rapier` glue
  chunk is 295,950 B (51,479 B); the `.wasm` is 3,082,103 B (1,171,203 B);
  `mesher-pool` is unchanged.
- Not checked by eye (no browser here): that each of the four pages loads
  and plays in a real browser, including the stream-compile of the
  `.wasm`. Verified by curl only: status 200 and content-type for the four
  `.html` pages and the `.wasm`, under `npm run dev` and under
  `npx vite preview` of the build.
### 2026-11-06: GAME-08 review, the vacuum played in the Pit (Claude, overnight)

- Qwen 27B finished all three stages. Main merged in: `game.ts` took both
  the melee (GAME-06) and the vacuum in every block (restart hooks,
  `canFire`, the HUD, `state()`, the watch helpers); `audio.ts` kept
  main's `loop` from GAME-04c (the branch had added the same thing);
  `sounds.json` is main plus the five VC entries. tsc, 448 tests and the
  build pass.
- Fixed in review: (1) the suck drew the Foamer toward a fixed world -z
  point, so a player facing +z pulled it through and behind them; the
  nozzle now sits along the lock's view. (2) The render set the active
  blaster's dip to 0 every frame, which undid the weapon switch's rise,
  and its -0.28 never showed (the loadout applies its dip first). The
  loadout now takes a `lowered` offset that it adds itself, set from
  `vacuum.blasterDip` in `data/vacuum.json`.
- Played in the Pit with the watch: a weakened stagger shows as
  vacuumable; E locks, the view turns, the blaster dips away, the tube
  rises at the lower right, the Foamer shrinks toward it and is removed
  with no pop (`popped` 0). Reserves rose by the shares exactly (20 of 40
  active, 44 of 175 and 6 of 24 others). A press before the recharge is
  the empty case. A player facing +z draws the Foamer toward them.
- For Paul: the placeholder tube stands upright, so it reads as a stick
  more than a nozzle aimed at the Foamer. The look is [Paul] anyway. The
  ammo box still credits through its own code in `pickups.ts`, not
  `loadout.refillReserves` (different rule: darts from a box, not a
  share), so "one credit path" is not quite true; fine as is.
- Not checked by ear or eye: the five VC sounds, the puff, the shrink at
  full speed.

### 2026-11-06: GAME-08 done, the foam vacuum (Qwen 3.8-27B via Pi)

Built. The vacuum (`src/game/vacuum.ts`) is the finisher's sibling: E on a
weakened Foamer in its stagger, inside 3 m of the hollow and in the view
cone, locks on. One charge, `rechargeSeconds` (15 s) to refill, full on level
start and retry. The lock holds the player the way the finisher does and turns
the view onto the Foamer; from half the turn the Foamer is drawn to the nozzle
and shrunk to nothing (scale and position ease). Removed with no pop chunks,
a capped white-foam puff at the nozzle. Reward: darts straight into each
blaster's reserve, the type's `ammoShare` (active 0.5, others 0.25) of its own
`reserveMax`, rounded up, capped at `reserveMax` via `loadout.refillReserves`
(the one credit path the ammo box's refill shares).

Files: `src/game/vacuum.ts` (new), `src/foamers/foamers.ts` (`suck`, no-pop
removal), `src/weapons/loadout.ts` (`refillReserves`), `src/game/audio.ts`
(`loop` on the sink), `src/game/game.ts` (use-key wiring, charge step, the
placeholder viewmodel, the render (recharge meter), watch helpers),
`src/ui/hud.ts` (`setVacCharge`, `#vacpip`), `data/vacuum.json` (new),
`data/foamers.json` (per-type `vacuum` block: `allowed` and `ammoShare`),
`data/sounds.json` (VC-* placeholder synths), `design/SOUNDS.md` (IDs match),
`index.html`/`arena.html` (`#vacpip`), `src/style.css` (the meter),
`tests/foamers/vacuum.test.ts` (new).

All numbers in `data/`: reach 3, cone cos 0.97, lock 0.9 s, recharge 15 s,
one charge, the nozzle puff count and size in `data/vacuum.json`; the per-type
`vacuum` entry (allowed: F01, F02 and F05, with each `ammoShare`) in
`data/foamers.json`.

Decisions: the reward is darts into reserves, never past `reserveMax` (the
card, and no pickups, keeping Paul's "no loot drops" rule clean); the types with a per-type `vacuum`
entry and `allowed: true` (F01, F02 and F05) are the allowed ones; a type
with no entry is not allowed (heavies come later); the placeholder viewmodel is
code (no art files), rising in the lower right as the blaster dips, as the
card asks.

Still unverified by eye (no browser on this machine): the vacuum's look and
how it reads rising, the nozzle's foam puff, and the five VC-* placeholder
sounds (all code synths, not Paul's beds). Not done by card: Paul's name for
the tool, upgrades (faster recharge, heavies), the range-panel "Fill vacuum"
button. Reviewer: Claude. Not merged or pushed.

### 2026-11-05: GAME-04c card; GAME-08, GAME-06 and GAME-04c started (Claude)
### 2026-11-06: LVL-02b review, Level 1-2 played through (Claude, overnight)

- Code read: `LevelRunner` is small and keeps `ArenaRunner` unchanged; the
  validator's new rules are sound. Main merged in (HANDOFF kept both
  sides); tsc, 442 tests and the build pass.
- Played `arena.html?level=1-2&watch` with the watch hooks: the parry
  corridor locks on entry, its Roamer spawns and dies, both doors open and
  the runner moves to the Ring (`arena` 1). The Ring locks, runs wave 1 (4)
  and wave 2 (6), and opens every door on clear. Try again in the Ring kept
  the parry corridor cleared and put the Ring back to waiting. The exit pad
  shows the complete panel only after both arenas clear. The Pit still
  loads as one arena. No console errors.
- Seen in passing: Roamers on the far side of the centre block stand at
  its corners and lob over it, so the block works as cover; a player who
  hugs its south face is hard to reach. Worth a look in Paul's playtest.
- Not checked by eye: the spaces and pacing, the north exit reveal, the
  store window, the banner overlap. The rift spawn for the lone Roamer and
  the half scale Ring are the model's format shortcuts (section 14); a
  `placed` Foamer field is a candidate for a later card.

### 2026-11-06: LVL-02b, arenas in order and Level 1-2 beats 1 to 4 (Qwen 3.8 Flash Next via Pi)

`src/level/level-runner.ts`: `LevelRunner` owns one `ArenaRunner` per arena
and steps only the current one, so a later arena's trigger does nothing until
every earlier arena has cleared. It is built from the file's `arenas` array in
order; every arena's runner is constructed up front, which puts every door in
the file into its file state at load, so a player cannot run ahead through a
later arena's open door. `state()` reports `phase` (the arena's own phase, or
`complete` once every arena is down), `arenaIndex`, `arenaId`, `arenasCleared`
and `progress`. `resetCurrent()` restarts the arena being played with the
earlier ones still cleared (Try again); `resetAll()` puts every arena back to
waiting (Play again, and a fall out of the world). `ArenaRunner` itself is
untouched, so the Pit and the Ring play exactly as before and their tests pass
unchanged. The page passes the same `ArenaEvents` it did plus `onArenaStart`
(which moves the rift glow and, in a multi arena level, shows an `Arena n of m`
banner) and `onLevelCleared`. The exit pad only ends the level once the
runner's phase is `complete`; in a one arena level the locked door in front of
the pad already kept the player out of the exit room, so nothing changed there.
The watch's `dartArena.state()` gains `arena`, `arenaId` and `arenasCleared`.

The validator gained three rules: arena ids unique, each arena's trigger inside
the shell, and a later arena's trigger not inside the space an earlier arena
seals when it locks (the trigger, doors and rifts box, ungrown, so a trigger
you can never walk to is an error rather than a level that soft locks).

`data/levels/1-2.json` is beats 1 to 4 of `design/levels/LEVEL-1-2.md`, played
by `arena.html?level=1-2`: the service corridor with a two block foam wall to
test a blaster on and the empty B02 plinth (the rack is [Paul]), the parry
corridor with a west alcove and one Roamer at the far end as its own one wave
arena, the yard, the Ring arena (two waves of Roamers, 4 then 6 with the third
rift behind the block, two foam pillars, south west ammo, the north exit a
reveal) and the breather store with a foam window onto the ring, one ammo box
and the level's exit pad. Three choices a reviewer should see: the lone Roamer
spawns at a rift at the corridor's far end rather than being placed at load,
because the blockout format has no placed Foamer field and the wave machine is
the only thing that spawns; the rooms share one floor slab, one ceiling and one
perimeter wall with the walls between them as pinches, because rule 10 forbids
two shell boxes sharing volume; and the Ring is a half scale A2 (26 x 30 m
around a 12 x 10 m block), because a full 30 x 30 m arena would not fit a
level that is mostly corridor. The parry arena opens its own entry door on
clear as well as the exit, so a cleared player can walk back for the alcove.

Tests: `tests/level/level-runner.test.ts` (a two arena level built by copying
the Pit's arena 60 m north plays both in order; arena 2's trigger does nothing
while arena 1 is fighting; Try again in arena 2 keeps arena 1 cleared and its
doors open; Play again resets both; a one arena level is unchanged) and
`tests/level/level-1-2.test.ts` (1-2 validates, floor under the whole walk from
the start to the exit and under every rift, pickup and checkpoint, both arena
exits block until opened, the triggers and the store bake walkable, `?level=1-2`
selects it). Not checked by eye, no browser here: whether the spaces read and
pace as the concept intends, the reveal of the north exit, the lone Roamer at
the corridor's far end, the store window's read, the two banner texts
competing (`Arena 2 of 2` over `Clear the arena`), and whether the Ring's
Foamers path round the block well rather than hugging it.
### 2026-11-05: GAME-10d review, packs played in the Pit (Claude, overnight)

- DeepSeek's first run broke off on an upstream provider error after
  stage 1; resumed with `pi -c`, it finished stages 2 and 3. Reviewer
  note taken: the spines were one lime tuft on the head (a turnip top),
  now a row of five nubs along the back.
- Merged main in (sounds.json: both sides' new sounds kept; HANDOFF
  rebuilt from main plus this branch's entries, git had misaligned an old
  entry). `foamer-rigs.json` was re-indented by the model: content checked,
  only F03 changed. 426 tests and the build pass.
- Played `arena.html?watch`: Swarmers dart in to about 1 m and back out
  to about 3 m, the swarm pool filled to its cap of 3 while the F01s held
  their own melee tokens, 14 nibbles in 12 s on a standing player. A pack
  of 5 plus two more packs stopped at the live cap. No console errors.
- My own test spawned a pack inside the Pit's centre block (x -4.8 to 4.8,
  z 2.4 to 5.6) and four stayed trapped in its voxel shell: not a bug in
  the Swarmer, but `spawnPack` does not check the spots are walkable.
  Rifts sit on open floor, so it only matters for a hand placed pack.
- For Paul's play test: a full pack is deadly to a player who stands still
  (popped in about 2 s with health resets off). Hit and run feels right in
  the numbers; the look of the scurry, the nibble and the sounds are
  unverified by eye.
- Merged into local main overnight under Paul's standing instruction;
  not pushed.

### 2026-11-05: GAME-10d, the F03 Swarmer built (DeepSeek V4.1 Flash via Pi)

Three commits on `game-10d`: `39112e0` the look, type and turnaround;
`d22fea3` the swarm pool, F03 brain, `spawnPack` and the cap; `d2732ef`
the sounds, the range pack spawn and the benchmark. `npx tsc --noEmit`,
`npx vitest run` (63 files, 417 passed, 2 skipped) and `npm run build`
pass; no em or en dashes in any touched file.

- Look: `data/foamer-rigs.json` F03, five `spine1..5` detail parts on the
  body's back (ellipsoids `[5,6,5]`, taper `[1,0.4]`, `pivot [0,-1,0]`,
  `foam-lime`), a body ellipsoid `[11,9,15]`, a head `[12,11,12]` with the
  angry eyes and an orange `gape`. The reviewer's note that the first try
  read as one lime tuft on the head, like a turnip top, is what moved them
  onto the back as a row of small nubs. Turnaround re-rendered with
  `npx tsx tools/render-rig.ts F03` (four views, sheet, README row).
- Brain: `src/ai/f03-brain.ts`, an F01 sibling with four states, no new
  ones. `decideF03` is pure so the test asks it directly. Range is the
  type's `attackRange` (1.4) to bite and `holdRangeMetres` (3.0) to ring,
  gap `pack.nibbleGapSeconds` (1.2). The clock is `sinceNibble` on
  `AgentInput`: `Infinity` at spawn, set to 0 by the system when a nibble
  lands (only for a swarm member), plus `dt` each step. It is not a new
  Foamer state, so the recover, the stagger, the fall and the crawl all
  behave exactly as they did for the others.
- Tokens: `swarm` is a third `TokenKind` in `src/ai/director.ts` and
  `data/ai.json`, with its own cap per difficulty and its own `stats()`
  row. `tokenKindOf` reads it off the attack's token, and `spawn` picks
  the f03 brain from it.
- Pack and cap: `spawnPack(feet, facing?, count?, type = "F03")` places
  `pack` members on a ring round the point at 55 to 100 percent of
  `pack.spreadMetres` (1.6), and stops at `pack.maxAlive` (12). Past the
  cap a spawn is skipped, and nobody is trimmed. The system's own
  `SPAWNER.max` (12) still applies underneath.
- Damage: a nibble is the ordinary attack path, so `damageOf`,
  `blocksAttackFrom` and the 0.5 s grace all apply and the shield blocks
  it from the front. `tests/foamers/swarmer.test.ts` checks the nibble id
  and the dart-free path; the shield test for it is the existing one,
  unchanged.
- Range: `src/range/main.ts` spawns a whole pack when F03 is the chosen
  type, singly for the others, so one press shows the ring.
- Sounds: `F03-yip` on the new `"alert"` event (sent only for a swarm
  member), `F03-nibble` picked from the attack's token, `F03-scurry` for
  an F03's steps. Recipes are in `data/sounds.json`, rows in
  `design/SOUNDS.md` 4.2, and the old "later" F03 row is gone from the
  other-Foamers table.
- Tests: `tests/ai/f03-brain.test.ts` (5: wake and run in, back out and
  ring, the type's ring not the shared one, one alert waking a pack, the
  data numbers), `tests/foamers/swarmer.test.ts` (5: own spec and health,
  `spawnPack` count and cap, swarm tokens not eating melee ones, nibble
  then back out, the pack waking together), `tests/foamers/swarmer-sounds.test.ts`
  (3: the yip and no shared alert line, the nibble line and not a swing,
  skitter against a thump). F01, F02 and F05 tests are unchanged and pass.
- Benchmark: `npx tsx tools/bench-swarmer.ts` (new, headless, the same rig
  the tests use): 10 Swarmers, 600 frames, 0.20 ms mean, 0.18 median,
  0.30 p95, 18 nibbles. There is no browser here, so this is the
  simulation half of a frame only, not a frame rate.
- Unverified by eye: the look (whether the five nubs read as nubs and not
  as a lumpy ridge), the skitter and the nibble poses at speed, whether
  the ring reads as a pack circling rather than a crowd jittering, and the
  three placeholder sounds. Also unverified: the real fps with two packs
  in the Ring or Pit.

### 2026-11-05: GAME-06 review, the combo played in the Pit (Claude, overnight)

- Merged main in; `game.ts` restart hooks now reset the melee and stop
  the saw loop. 413 tests and the build pass.
- Played `arena.html?watch` against one F01: hits of 1, 1 and 2 damage,
  the third staggered it and knocked it 2 m back, charges 3 to 0; the next
  press was the bash (it missed: the knockback had put the F01 past the
  bash's 1.8 m reach), the one after the empty click on the bash's
  cooldown. The new shield and the three charge pips under the health bar
  show in the screenshots. No console errors.
- Not checked by eye: the baton's sweep. It animates on render time, and
  the watch harness renders one frame per step call, so a screenshot could
  not catch it mid swing; the shoves and sounds too. For Paul's play test.
- Merged into local main overnight under Paul's standing instruction;
  not pushed.

### 2026-11-05: GAME-10d card, the F03 Swarmer, started (Claude)

- Paul asked for a DeepSeek task while GAME-08 and GAME-06 run. Card
  `tasks/GAME-10d.md`: the Swarmer's palette look and turnaround, a pack
  brain (hit and run nibbles), a `swarm` token pool, `spawnPack` and a
  live cap. Kept clear of the shield, the melee and use blocks, pickups
  and vacuum entries. Running on `game-10d`.

### 2026-11-05: GAME-04c review, the saw played in the Pit (Claude)

- Played `arena.html?watch`, one F01, a throw from 4 to 8 m: the disc
  lodged, ground for 0.9 s (9 ticks), held the F01 staggered the whole
  time, then flew home. The F01 went from 6 health to 0.5 (the throw's 1
  plus 9 x 0.5): never killed, left finishable. No console errors.
- Fixed: the flying disc flew face first (its face 0.99 along the travel),
  a plate seen from behind. It now flies flat and edge first, the nubbed
  rim leading, its face up and tipped back toward the thrower by
  `look.flightTiltDeg` (20) so the rings still read. A screenshot shows it
  meeting the Foamer edge on.
- For Paul's play test: one saw throw takes 92 percent of a Slowmer's
  health. That makes the saw plus a finisher a two button kill on fodder;
  `saw.damagePerTick` (0.5) and `grindSeconds` (0.9) are the knobs.
- The nav timing test failed in this branch's full run while two other
  models were testing on the same Mac; the 39 shield and saw tests pass.
- Not checked by eye: the look held on the arm, the grind on a Darter's
  plates, the sounds.

### 2026-11-05: GAME-04c built: disc look, spin, foam saw (DeepSeek)

- Look: `data/shield.json` `look` is now three concentric foam bands
  (`bands`, each thinner and stepped forward by `domeDepth`, so the face
  domes), 16 rounded nubs on the rim (`nubCount`, `nubRadius`) as the saw's
  teeth, and the factory palette in `look.colors`. The boss is a plain foam
  cylinder with a `[Paul]` note: the emblem is Paul's. The disc is built
  once in the `Shield` constructor as `discModel` and the throw reparents
  that one group into a scene-level `flight` holder (the catch returns it to
  the arm), so the held and the flying disc are the same model; the old
  `discMesh` name is kept as a getter on `flight`.
- Spin: about the disc's own axis (the face along the flight), at
  `look.spinRevPerSec` (6) out and back and `saw.spinRevPerSec` (14) while
  grinding. Chose in-plane spin over edge over edge: the card says about its
  own axis, and the bands and teeth are what should be seen turning.
- Foam saw: a new `saw` block. The first Foamer a flight strikes is lodged
  in: the disc holds its contact point in the struck part's voxel frame (so
  it rides a Foamer that walks or is shoved), spins fast, carves a
  `carveRadius` sphere every `tickSeconds`, deals `damagePerTick` (plates
  take `plateShare` 1.0, against a dart's 0.15, measured with `armourOf`),
  throws at most `debrisPerTick` chunks a tick and keeps the Foamer
  staggered for the grind. Then it ricochets as before (bounces and range
  unchanged). It never kills (`canKill` false): it keeps the throw's floor
  and sets `finishWeakened`, the point of the weapon. A prone Foamer takes
  it without the stagger. No block, parry or charge while it is lodged
  (unchanged: `state` is not `raised`).
- Sounds: `SH-saw` (a loop, started on the lodge, followed to the disc,
  pitched by the grind time left, stopped when the grind ends or the disc
  comes home or the run restarts) and `SH-sawEnd`, with placeholder synth
  recipes and `design/SOUNDS.md` rows. No separate spin whirr: the card
  allowed it only if cheap, and the saw's loop carries the spin's sound.
  `src/game/audio.ts` gained a `loop` pass-through (a no-op handle while
  the engine loads).
- Watch: `state()` gains `grinding` (the target's rig and seconds left).
- Tests: `tests/player/saw.test.ts` (9): grind length, riding a moved
  Foamer, tick count and damage, the Darter's plate share, never kills and
  leaves it finishable, ricochet and return after the grind, no block or
  parry while lodged, one model held and flown, and the look data's bands
  and spin. `tests/shield/throw.test.ts` test 2 now asserts the total cost
  is more than the throw's own damage (the grind adds its ticks).
- `npx tsc --noEmit`, `npx vitest run` (404 passed, 2 skipped) and
  `npm run build` pass. Not checked by eye: the look, the spin's speed and
  direction, the disc sitting on the body rather than in it during the
  grind, and the two sounds. Reviewer: Opus 5.5.

### 2026-11-05: GAME-06 done: melee weapon 1 M01, the combo, the bash, the charges (Qwen 3.8 Flash Next via Pi, dgx-spark)

- New `src/game/melee.ts` (`Melee`) owns the combo, the charges and the hit
  query; `data/melee.json` owns every number (active id `M01`, `weapons`
  map so weapons 2 and 3 are data plus small code later). Three charges:
  each press within `comboWindow` (0.6 s) swings the combo's next hit and
  spends one, a later press restarts at hit 1; each hit takes every Foamer
  in reach (eye to chest), inside the 70-degree arc, in sight of the eye,
  nearest first, at most `maxTargets` (3), through the existing
  `parryDamage`; hit 3 staggers (the existing stagger) and knocks back via
  each Foamer's own `knockStep`; each hit carves a small foam sphere at the
  contact through the dart carve path with its own debris cap. With no
  charge a press is the shield bash (weak damage, a small push, no
  stagger, its own cooldown, never nothing) plus the view's short shove
  (`melee.kick` rides the camera climb with the shield's kicks). A parry
  gives a charge back (reads the shield's `parries` only), and below full
  one returns every `rechargeSeconds` (8); full at start and retry
  (`melee.reset()` on the restart hooks). No swing while the disc is
  raised or a charge runs; a swing with the disc thrown is fine. A running
  swing blocks the blaster (`canFire` gains `!melee.swinging`).
- Key order (PLAN 14): the finisher sees the press first, unchanged; with
  none finishable the weapon takes it and the press is spent. The
  course's debug blast (which had borrowed `melee`) moved to its own
  binding `debugBlast` (KeyB, `data/input.json`, `src/core/input.ts`),
  course page only.
- Look: `src/game/meleeView.ts`, a code-built foam baton (orange handle,
  cream foam ball, `look` block in `data/melee.json`) that sweeps L-to-R,
  R-to-L, then overhead over `swingTime`, easing out; the blaster dips
  out of the way (applied after `loadout.render`). The bash shows no
  baton. [Paul]'s look to come.
- HUD: `hud.meleePips(charges, max, pulse)`: three pips under the health
  bar in `index.html` and `arena.html` (`#meleepips`); the newest full
  one pulses on a refill. Sounds: placeholder synth recipes for
  `ML-swing`, `ML-hit`, `ML-bash`, `ML-empty`, `ML-charge` in
  `data/sounds.json` (rows in `design/SOUNDS.md`).
- Watch: `swing()` (one melee press, one step; reports `{charges, swung}`;
  `swung` is the hit index, -1 the bash, null nothing) and `state().melee`
  (charges, max, combo step, swing and bash seconds left). `meleePress()`
  is exported from `src/game/melee.ts` as the shared key-order helper the
  finisher-first test uses.
- Tests: `tests/game/melee.test.ts`, 9 tests on a real Rapier world with
  spawned Foamers and a carve wall: the combo steps and restarts, each
  charged hit spends one charge and takes only Foamers in reach, arc and
  sight at most maxTargets, hit 3 staggers and knocks back, the swing
  gates the next press, the bash is weak and never staggers, parries and
  the timer refill one at a time never past max, `reset` refills, the
  raised/charging gate (thrown is fine), and the finisher takes the press
  first. `npx tsc --noEmit`, `npx vitest run` (404 passed) and
  `npm run build` pass.
- Not checked by eye (no browser here): the swing look (baton sweeps and
  the blaster dip), the feel (timing, the bash's shove), and the sounds.
  The pips' placement relative to GAME-04c's shield area is my guess (the
  pips sit under the health bar); Paul to judge.

### 2026-11-05: GAME-04c card; GAME-08, GAME-06 and GAME-04c started (Claude)

- Paul on the shield: a round foam shield in the spirit of a classic round
  hero shield, spinning when thrown, and a foam chainsaw type weapon if it
  can be done. Card `tasks/GAME-04c.md` (DeepSeek): concentric foam rings,
  the flying disc uses the held model and spins, and a throw lodges in the
  first Foamer and grinds it, then ricochets. Not a copy of any real
  shield (no star, no red, white and blue rings, no brand words, per
  CLAUDE.md); the emblem and name stay [Paul].
- GAME-06 no longer touches `src/player/shield.ts`: GAME-04c owns it while
  both run; the bash is a camera shove.
- Started together: GAME-08 (Qwen 27B, qwen-machine), GAME-06 (Spark),
  GAME-04c (DeepSeek). Pi needs `.ts.net` in `NO_PROXY`: the local proxy on
  7890 breaks the TLS handshake to qwen-machine.

### 2026-11-05: ammo boxes hold 20 darts (Paul)

- Paul: start the ammo boxes at 20 darts and tune in play tests. Every
  `darts-standard` box in the Pit and the Ring now has `count` 20 (it was
  4). `count` stays darts, not magazines.

### 2026-11-05: nav path query back to its old speed (Claude)

- The "flaky" nav timing test was a real slowdown. Alone, the 40 x 40 m
  path query took 1.1 ms before BUG-01 and 1.85 ms after it (the two-layer
  A*), against a 2 ms budget, so any load in the full run tipped it over.
  The bake was unchanged (about 30 ms, budget 150).
- Three changes in `src/ai/nav-grid.ts`, same paths as before:
  `stepOk` is gone (every neighbour comes from `nodeNear`, which already
  applies the same step rule, so it ran the check twice); `nodeNear` skips
  the nearest-layer search for a one-layer cell (nearly all of them); the
  heuristic reads its target once per search instead of per neighbour, and
  the diagonal corner checks reuse the four straight neighbours' results.
- Now 1.13 to 1.23 ms alone; five full parallel runs in a row all pass
  (395 tests). The test and its budgets are unchanged.

### 2026-11-05: LVL-02a merged (Claude)

- Merged clean; 395 tests and the build pass. `tests/ai/nav-grid.test.ts`'s
  timing test (bake a 40 x 40 m floor under 150 ms) failed twice today in
  the full parallel run (303 ms once) and passed alone every time. The
  two-layer bake made it a little slower, and 57 files run at once. Fixed the same
  day: it was a real slowdown, see the next entry up.
- Still open for Paul: the ammo box holds 4 darts (see the review entry).

### 2026-11-05: LVL-02a review, ammo boxes played in the Pit (Claude)

- Merged main in (23 commits); only the docs conflicted.
- Fixed, with tests: the pickup cap counted every kind together and
  trimmed the oldest item, and the level's ammo boxes are the oldest, so a
  few finishers' health sprays deleted them. The cap is now per kind and
  trims the oldest of that kind.
- Fixed, with a test: a box split one pool of darts, first blaster first,
  and all three blasters take standard darts, so B01 took the whole box.
  The card says every blaster of the type gets the count; it does now.
- Played `arena.html?watch`: the Pit starts with 2 boxes; walking onto one
  took B01, B04 and B03 from 10 to 14 each; at full reserves the other box
  stayed; Try again brought both back. A screenshot shows a readable yellow
  box on the pit floor. No console errors.
- Answered 2026-11-05 (20 darts, see above). Was: a box holds 4 darts (`count` in the level files, from the
  original Pit file). That is half a B01 magazine and about a tenth of a
  B04 one, so it barely reads as a pickup. Pick the number, or say whether
  `count` should mean magazines instead of darts.

### 2026-11-05: GAME-04b and ANIM-01 merged (Claude)

- Merged after BUG-01; only the docs and the BUG-01 card conflicted (kept
  both sides, and main's BUG-01 card with round 2). 383 tests pass, the
  build is clean.
- Smoke check on merged main, `arena.html?watch`: no console errors;
  F01s and F02s go through approach, windup, strike, recover and hold, and
  the Roamers threw 24 balls in 25 s.
- Not a merge problem, worth a fix later: `parryNext()` does not land a
  parry. Six tries against a lone F02 gave 0 parries on merged main and the
  same 0 on the unmerged `game-04b` branch (the balls burst on the disc as
  blocks). The parry's unit tests pass; the watch helper's timing is off,
  which fits the single parry seen in the GAME-04b review. Paul's hands-on
  play is the real check of the parry window.

### 2026-11-05: BUG-01 round 2 review, both Pit spots played (Claude)

- Played `arena.html?watch` on the branch (port 5191):
  - Player on ring-s at (0, 4, -11.5), wave 1: all three F01s climbed
    ramp-s (one on the ring by 25 s), walked the ring and hit the player
    (health 100 to 88).
  - Player on open floor at (0, 0, -4), the wave 2 mix (3 F01, 2 F02):
    the F01s closed and attacked, the F02s threw 24 balls in 30 s (14 hit).
  - Player under the ring at (0, 0, -11): the F01s walked in at floor
    level and attacked, the F02s threw 25 balls (17 hit). No console errors.
- Rebaking an 8 x 8 m area takes about 2.5 ms (2.4 us a cell), so a
  carve-sized rebake stays well under a millisecond.
- Fixed: the `stepOk` comment described edge sampling the code does not
  do; it now describes the autostep cap, which is the real fix.
- Worth Paul's eye: the Foamer controller now autosteps 0.2 m, not 0.3 m,
  and the steering's waypoint skip fell from 0.5 m to 0.1 m. Neither
  showed a problem in the Pit, but watch for Foamers balking at a
  0.2 to 0.3 m step on other levels, or jittering at path corners.

### 2026-11-05: BUG-01 round 2, the ring's top and the real ramp stall (DeepSeek V4.1 Flash via Pi)

- Review finding R1: round 1's "lowest surface wins" bake threw the Pit's
  ring tops away. `groundAt(0, -11)` was 0, not 4, so a player standing on
  the ring drew an F01 that walked to the pit floor under the slab and
  struck at nothing 4 m below. Fixed with a layered grid:
  `src/ai/nav-grid.ts` keeps up to `nav.maxLayers` (2) walkable surfaces per
  cell, lowest first, and A* runs on `(cell, layer)` nodes. `groundAt` and
  `walkableAt` take an optional height and pick the nearest layer (no height
  still means the lowest, so old callers and tests are unchanged).
  `findPath` takes the agent's and the goal's feet height; the pages pass
  `player.eye - player.eyeHeight`, since `player.eye(1, ...)` is feet plus
  1.6 m. The agent re-paths when the goal's height moves more than 0.5 m.
- The bake is still allocation free: the ray hits reuse preallocated slots.
- Review finding R2, the ramp-side stall, is the character controller's
  autostep, not the string pull. Measured: at a Foamer's 1 m/s and 60 fps
  (a 0.017 m frame move) Rapier autosteps a 0.2 m rise but not 0.25 m, no
  matter what `maxHeight` is set to, because the autostep needs room ahead of
  the capsule that a small step does not give it. The grid called any rise up
  to 0.45 m a step, and the south ramp's east side is 0.44 m from the floor
  at the next cell, so A* and the pull both routed through it. `nav` gained
  `stepAutostepMetres` (0.2), and `stepOk`, `nodeNear` and `lineClear` cap a
  climb with it; a drop still uses `maxStepMetres`. `steer`'s waypoint skip
  also fell from 0.5 m to 0.1 m: at 0.5 m the walk cut the dogleg at the
  ramp's foot and went into the side again.
- Review finding R3: the stall guard drops a Foamer's entry when it is not
  walking its path (so a Foamer that held its ring does not sidestep the
  moment it walks again) and in `removeFoamer`. The walk builds the set of
  every Foamer body once per `update` instead of once per Foamer, and the
  old `others` set is gone (the predicate reads `allBodies` directly).
- Tests added: `tests/ai/pit-foamers.test.ts` now has the ring's-top lookup
  and a Foamer that walks the ramp up to a player standing on ring-s;
  `tests/ai/stall.test.ts` has the guard's memory (entry dropped on remove,
  entry dropped when not walking a path).
- The card asked for the ring test to pass within 25 s. It takes about 35 s:
  the only route up is the south ramp, which makes the walk about 28 m, and
  an F01 walks 1 m/s. The test uses 45 s and says why in a comment. It is on
  the ring by second 25 and reaches the player at about 35.
- Not checked by eye (no browser here): the ring route on
  `arena.html?watch`, whether the Foamer now prefers the ramp visually, the
  sidestep's look, and whether the 0.2 m climb cap makes any other level's
  step look too tall to walk. Nothing visual was run.

### 2026-11-05: BUG-01 round 2 sent back; GAME-06 and GAME-08 cards queued (Claude)

- BUG-01 review: round 1 is not mergeable. The lowest-surface bake drops
  the ring top from the grid (both rings are slabs over open floor), so a
  player on the ring draws Foamers under it; and the ramp-side stall is
  only hidden (on main a Foamer chasing a player on the ring still freezes
  at (-9.8, -2.1) beside ramp-s). Round 2 is in `tasks/BUG-01.md`: two
  layers per cell from round 1's filter, the ramp-side cause, stall guard
  fixes. DeepSeek V4.1 Flash (`openrouter deepseek/deepseek-v4.1-flash-1017`)
  is running it on `bug-01`.
- Model rules from Paul (2026-11-05): DeepSeek is that exact id; Kimi is on
  hold for cost until a task needs it; qwen-machine and dgx-spark start only
  when Paul says.
- Queued for the local models, not started: `tasks/GAME-08.md` (the vacuum,
  Qwen 27B) and `tasks/GAME-06.md` (melee weapon 1, Spark). Both start from
  main after BUG-01, GAME-04b, ANIM-01 and LVL-02a merge. They can run at
  the same time; they touch different modules but both edit the melee and
  use block in `src/game/game.ts`, the HUD, `data/sounds.json` and the
  docs, so the second to merge resolves those.

### 2026-11-05: START HERE, session handoff for Claude (Claude)

Paul ended the long 2026-11-03/04 session to save usage. Read this, then
the Status section; do not re-read the whole Log.

**How the work runs.** Pi models write the code; Claude writes the task
card (`tasks/<ID>.md`), starts the model in its own worktree, reviews,
fixes small things with a test, and asks Paul before every merge ("Approve
and merge"). Pushing main is publishing: only as part of an approved merge.
- Worktree: `git worktree add -q ../dart-<b> -b <b> && ln -s
  ../dart/node_modules ../dart-<b>/node_modules`. Every `GitHub/dart-*`
  folder is one of these: a checkout of the branch named after it, never
  a separate project. `dart/` (main) is the only one that deploys. After a
  merge, remove it: `git worktree remove ../dart-<b>` (the branch stays).
  `git worktree list` is the truth; as of 2026-11-05:
  - Waiting (not merged): `dart-bug-01` (BUG-01, review), `dart-game-04b`
    (parry, merged 2026-11-05), `dart-anim-01` (ANIM-01, merged 2026-11-05),
    `dart-lvl-02a` (LVL-02a, review). These four are the only ones; the
    nine merged leftovers were removed on 2026-11-05.
- Start a model: `tools/pi/run-pi.sh <worktree> <provider> <model>
  <thinking> <brief file> <log>` (retries a start-up hang; never kills
  pi's children, which may own the local context proxy on 18787). Brief:
  `tools/pi/brief-template.txt`.
- Providers: DeepSeek `openrouter deepseek/deepseek-v4.1-flash-1017
  medium` (long cards); Qwen 27b `qwen-machine qwen3.8-27b-1cat low`
  (shorter cards, Paul's Linux AI machine; PAUSED by Paul until he says
  so); Spark `dgx-spark qwen3.8-flash-next medium` (travels with Paul,
  check it answers first); Kimi `moonshotai` (art).
- A run that stops with nothing committed: Qwen can overthink and hit
  its output limit (resume with `pi -c` and "stop planning, write code");
  DeepSeek can break down in a very long session (start a fresh one with
  a brief on what is on disk).

**Reviewing.** Each worktree gets a `.claude/launch.json` entry (in the
GitHub folder) on its own port; `preview_start` it and drive
`arena.html?watch` or `index.html?watch` with `dartArena` / `dartGame`
(`state`, `moveTo`, `look`, `aimNearest`, `fire`, `step`, `block`,
`throwShield`, `charge`, `finish`, `parryNext`) and the dev hook
`__arena` / `__dart` (`foamers`, `foamers.projectiles`, `player`,
`health`, `loadout`, `camera`). Lessons:
- Await a `setTimeout(0)` between steps after a spawn: Foamer part
  colliders come from the mesher worker and never land in one long
  synchronous loop (darts then pass through every Foamer).
- After a hit the player ignores damage for 0.5 s: count
  `foamers.projectiles.stats.hitPlayer`, not health drops.
- A popped player pauses the game; reset health each step in long runs.
- Standing under the Pit's ring overhang breaks Foamer pathing (BUG-01).
- Keep browser checks short; the costly part of the last session was
  long debugging in the conversation.
- `set -o pipefail` before `npx vitest run | grep`, or a failing suite
  still lets the commit through. `tests/ai/nav-grid.test.ts` timing test
  flakes under load; rerun alone.

**Jobs remaining, in order.**
1. Done 2026-11-05: BUG-01 reviewed (two rounds) and merged.
2. Ask Paul to merge `game-04b` (parry, GAME-04 stage 2, reviewed: one
   clean parry seen; main already merged in) and `anim-01` (ANIM-01
   throw and charge poses, reviewed by key frames). They conflict with
   each other in the docs only.
3. Review `lvl-02a` (Qwen, 3 commits, placed ammo pickups; not yet
   reviewed), then ask Paul.
4. Main here is 3 commits ahead of origin (the BUG-01, ANIM-01 and
   LVL-02a cards, plus this entry); they go out with the next approved
   merge.
5. Next cards when Paul says: GAME-06 melee weapon, GAME-08 ammo for
   kills (vacuum, D09), GAME-10c the heavy, GAME-09b catastrophic hits,
   ART-05 first person animations, AUD-01b Paul's recordings, QA-01
   low-end machine check (due 2026-11-12).

**Waiting on Paul.** Whether the player is safe during a finisher; the
shield's name and look, and whether the lowered disc should sit lower
(it fills the lower left); the content plan review (1-2 blaster clash,
act settings and accent colours, the "Foam Demon" working name, level
names such as the ring's).

### 2026-11-04: BUG-01, two Pit stalls fixed (DeepSeek V4.1 Flash via Pi)

- Cause 1, the overhang: `src/ai/nav-grid.ts` baked a cell from the first
  surface a ray from above met, so the floor under the Pit's ring baked as
  the ring's top at y 4. A player standing underneath was pathed to 4 m up
  and the Foamers walked at the ramp instead. `bakeCell` now collects every
  surface, keeps the up-facing ones, sorts them low to high and takes the
  first that is not swallowed by a surface within `nav.maxStepMetres` above
  it and that leaves the agent's capsule shape clear. A wall still bakes as
  its own top, so the step, ledge, slope and wall tests are unchanged.
- Cause 2, the clump: every Foamer's movement capsule is a world-group
  member (darts and aim skip it by its own bit), so two Foamers pressed
  together each asked the character controller to walk into the other and it
  cancelled both steps. Wave 2 spawns from one rift, so the whole front rank
  froze. The walk now ignores the other Foamers' root and part bodies by
  handle. Note for next time: a character-controller filter predicate may not
  read `collider.contactGroups`/`shape` or its parent, it must use
  `collider.handle` / `collider.parent()?.handle`; anything else throws
  inside the query and is silently ignored.
- Guard: a Foamer whose path stops making progress now sidesteps for a
  moment and tries again, so a Foamer can never be frozen for long by
  something the bake cannot see (a wall built after the bake, a body parked
  in a doorway). Numbers in `data/ai.json` `steer`.
- Tests: `tests/ai/pit-foamers.test.ts` (floor under both rings, a Foamer
  walks under the ring), `tests/ai/pit-wave.test.ts` (a five strong wave on
  one rift engages), `tests/ai/pit-ramp-side.test.ts` (the card's recorded
  spots against ramp-s), `tests/ai/stall.test.ts` (no more than 2 s still
  while walking). All four fail on the unfixed code.
- Unverified by eye: everything visual. Nothing was run in a browser here.
- Also dropped: the half-finished two-levels-per-cell nav rewrite from a
  previous session (12 tests failing); the lowest-surface rule does the job
  with the existing tests intact.
### 2026-11-04: GAME-04 stage 2 review, parry in the Pit (Claude)

- Merged main (GAME-10b) in; only the imports and docs conflicted.
- Played `arena.html?watch` against wave 2's Roamers with `parryNext()`:
  a parried ball flew back and took its thrower from 8 to 4 health, and
  the parry count went up. Only one clean parry: most tries had no ball
  reach the player, for the two reasons below, not the parry code.
- Found, not fixed (see `tasks/BUG-01.md`): Foamers in the Pit freeze.
  (1) The nav grid is 2.5D, one ground height per cell, so a player
  standing under the ring's overhang reads as on the ring top, 4 m up,
  and Foamers path for the ramps and stall. (2) On open floor too, all
  four wave 2 Foamers stood still for over 30 s in `approach` against
  the side of the south ramp (x about -9.5), paths of 2 or 3 points, so
  the Roamers never got their throw.
- Measuring lesson: after any hit the player ignores damage for 0.5 s
  (UI-01 grace), so health drops undercount ball hits while Slowmers bonk;
  count `foamers.projectiles.stats.hitPlayer` instead.
- Corrected: the PLAN row said "Paul approved" before he had.
### 2026-11-04: ANIM-01 review, key frames viewed (Claude)

- Viewed the key frames Qwen could not: the F02 windup holds the ball high
  beside the head with the arm cocked, and the strike whips the arm and
  ball out past the shoulder; the F05 telegraph dips the head, the charge
  pitches the whole body forward, and the wall stun rocks it back with
  the orange back showing. All read at a glance. 32 PNGs, 208 KB.
- Unverified: timing and readability at 10 m in a live game.

### 2026-11-04: ANIM-01, the F02 throw and the F05 scrape and charge poses (Qwen 3.8-27B via Pi)

- Card: `tasks/ANIM-01.md`. Two stages, each committed green (tsc, vitest,
  build, no em or en dashes):
  - Stage 1 (bd18c74): the poses. A per-rig `motions` block in
    `data/foamer-rigs.json` holds every number (angles in degrees, distances
    in metres). F02 `throw.wind` lifts the ball arm back and over the head
    (armR -180, foreArmR 80) and turns the body 15 degrees away; `strike`
    whips it through past the shoulder (armR -60, foreArmR 100) with the
    body swung to the far side so it reads as coming through. F05 `scrape`
    dips the body forward and sweeps a leg back and forward twice; `charge`
    pitches 25 degrees forward on a 34 degree stride; `wallStun` rocks the
    body back with a wobble, and on a rig whose body is its head (F05) the
    head shake judders the pitch. `poseNums` reads the block; a missing
    block reads zero, so no other rig changes (F01 tested at rest).
  - Stage 2 (aec6522): `npx tsx tools/render-rig.ts <id> --state <state>
    --t <0..1> [--attack <id>]` renders every view for that state and time
    to `design/foamers/poses/`. Key frames for the F02 throw (windup t.5,
    t1; strike t.7, t1) and the F05 telegraph (t.25, t.75), charge (t.5)
    and wall stun (t.25) are rendered there. `tools/pose-check.ts`
    measures each key frame's part extents numerically, `tools/pose-ascii.ts`
    prints a front and side silhouette so the shape can be checked without
    a browser.
- New `RigMotion.turn` (root yaw, radians) carries the body's in-place turn;
  `poseParts` eases it like the other root motion, `solveRaw` folds it into
  the root yaw.
- Tests (`tests/foamers/poses.test.ts`): the F02 ball sits behind its rest
  position at full windup and in front through the strike, and the body
  turns away then through the target; the F05 charge pitches forward, the
  telegraph dips and moves a leg, the wall stun rocks back and wobbles; F01
  with no block keeps its old poses.
- Unverified by eye: this is a headless AI machine, no browser. The pose
  math is verified numerically and sketched as silhouettes, but the PNG key
  frames in `design/foamers/poses/` should be looked at, and a real F02
  throw and F05 charge watched in the game to check the timing, the 10 m
  readability of the windup, the shake of the wall stun, and the charge's
  look. No em or en dashes.

### 2026-11-04: LVL-02a, placed ammo boxes from the level file (Qwen 3.8-27B via Pi)

- The level file now places ammo: the `ammo` pickup kind in
  `src/pickups/pickups.ts` is a 0.35 m foam box on the floor (no hop, a slow
  turn and a bob until it settles), collected by walking within 1 m of the
  feet. It adds its `count` to the `reserve` of every blaster the system
  holds (`PickupSystem.blasters`) that takes its dart type, caps each at
  `reserveMax`, and a box that would give nothing stays on the floor (like a
  health blob at full health). A dead player never collects.
- The arena page (`src/arena/extras.ts`) gives the system the loadout's
  blasters and calls `pickups.loadLevelBoxes(LEVEL)` at load; `respawnAtEntry`
  (Try again, Play again) and the fall respawn clear and reload, so a
  collected box comes back on a restart. `dartArena.state().ammoBoxes` counts
  the boxes still on the floor.
- The validator (`src/level/validate.ts`) rejects a `darts-*` pickup whose
  type slice is not in `data/darts.json.types`; non `darts-*` pickup types are
  ignored.
- The Pit keeps `pit-ammo` and gains `pit-ammo-far` at `[-12, 0.4, 7]` (the
  far side of the pit floor from `pit-ammo` at `[12, 0.4, -7]`). The Ring's
  single `ring-ammo` becomes `ring-ammo-w` `[-11, 0.4, 1.6]` and
  `ring-ammo-e` `[11, 0.4, 1.6]`, one by each pillar, as the card asks.
- A collected box plays `PU-ammo` (new synth placeholder in
  `data/sounds.json`, noise rattle; `design/SOUNDS.md` already lists the ID)
  and pulses the ammo counter in the box's yellow (`hud.ammoFlash`, the
  `#ammo.topped` class), never the green heal glow.
- Not in scope per card: Foamer ammo drops, GAME-08 (ammo-for-kills), new dart
  types.
- Not verified by eye: how the box turn and bob read, the collect sound and
  counter pulse on the real page, and the new box positions (the far Pit box
  and the two by the Ring pillars) feel-right in play. `tests/ai/nav-grid.test.ts`
  flakes under the full parallel run (passes alone and in a rerun); everything
  else is green (tsc, vitest 375, build).

### 2026-11-04: GAME-10b review, Darters played in the ring, merged (Claude)

- Played `arena.html?level=1-4-ring&watch`: two Darters, the lime plates
  on the side they face (chest +0.13 m, brow +0.22 m along the facing) and
  the orange weak point behind (-0.44 m), so the -z offsets in the rig
  data are only rig-local.
- Fixed: the Darter used the shared 2.2 m hold ring, so it walked into
  bite range and "charged" from about 2 m, a slow bonk. Chargers now hold
  on their own ring (`charge.holdMetres`, 9 m) and telegraph from 5 to 8 m
  out. Test 7 in `tests/foamers/charge.test.ts` (2.19 m before).
- Fixed: a charge that ran into the player was stopped by the player's
  capsule and counted as a wall, so every hit gave the player a free wall
  stun on its back. A hit on the player now ends in the normal recover;
  only a real wall opens the back.
- Small, not fixed: the tab title still reads "DART: the Pit" on the ring
  level (the level name is [Paul]).
- Unverified by eye: the scrape and charge poses, the stun feel, the
  plate chip, the sounds.

### 2026-11-04: GAME-10b, the F05 Darter and the Ring (DeepSeek V4.1 Flash via Pi)

- Card: `tasks/GAME-10b.md`. Three stages, each committed green (tsc,
  vitest, build): 1 the F05 data and armour shares (ed9d333), 2 the charge,
  telegraph, wall stun and player stun (4641c05), 3 the Ring level, the
  `?level=` loader and the watch states (4cdb02b), then the scrape dust and
  the wall hit sound wired in the shared game (b64d774).
- Data: `types.F05` in `data/foamers.json` (rig F05, health 30, turnRate
  1.4, `charge` and `armour` blocks, a charge attack and a bite). All the
  charge numbers are there: speed 11 m/s, 18 m, range 14 m, telegraph
  0.9 s, wall stun 1.2 s, player stun 0.4 s, dust count and size, plate
  arc 120 degrees. Sounds are `F05-snort`, `F05-run-loop`, `F05-impact` and
  `F05-stun` placeholders (synth only, no audio files), listed in
  `design/SOUNDS.md`.
- Code: `src/ai/f05-brain.ts` (the charger states and the pure
  `decideCharge`), `src/foamers/charge.ts` (`ChargeSpec`, `chargeOf`), the
  three states in `src/foamers/foamer.ts` and `src/foamers/foamers.ts`
  (the run moves through `knockStep`, so walls stop it; `onChargeHit`,
  `onWallHit` and `onScrape` report out, and the game turns a hit into the
  controller's `stunTime`), `scrapeMotion` and `chargeMotion` in
  `src/foamers/rig-states.ts`, the shield's `plateFacesCharge` in
  `src/player/shield.ts` (bounce, no damage, no stagger) and the
  `stunTime` in `src/player/controller.ts`.
- Decided: the player stun is a number on the controller, not a state; the
  charge is a Foamer state driven by the system (the brain only stands in
  it); the level choice is `src/arena/levels.ts` with the Pit default and a
  notice for an unknown name; the Ring's ceiling is at 9.5 m because the
  nav bake casts down from 8 m and a ceiling at 8 m reads as ground (the
  first bake made every cell unwalkable). All in PLAN.md section 14.
- Tests: 8 new (2 files for the charge and the brain, 1 for the level, and
  2 for the shield's front plates) plus the 5 stage 1 ones, 362 passed.
- Not checked by eye: the scrape and charge poses, the wall stun's long
  turn out, the stun's feel (0.4 s with the look free), the dust at the
  scrape (six orange chunks from `debris.burst`, the shared game's), the
  plate arc against the real F05 rig (its chest and brow sit on -z while
  +z is forward, so the arc uses yaw forward: Paul should look), the
  sounds, the Ring's look, and whether the 6 m ring corridor fights well
  with two Darters (no browser here).

### 2026-11-04: GAME-04 stage 2, the shield parry and bounce-back (Qwen 3.8-27B via Pi)

Card: `tasks/GAME-04b.md`, in the `game-04b` worktree. One commit
(`GAME-04b: ...`) when this is accepted; not merged or pushed yet. `npx tsc
--noEmit`, `npx vitest run` (50 files, 343 passed, 2 skipped) and `npm run
build` all pass. No em or en dashes in any touched file (checked with the
perl scan in CLAUDE.md).

What was built:
- `data/shield.json`: a `parry` block (window 0.25 s, speedShare 1.6, damage
  4, stagger 0: the thrower's own stagger time, steerSec 8, kick 0.035 rad
  over kickTime 0.15, hitStop 0.05 s at slow 0.15, flashTime 0.12 s,
  parryNextLead 0.1 s); the `_note` explains it too.
- `src/player/shield.ts`: `parryWindowScale` (set by the pages from the
  preset), `parries`, `parryWindow()`, `canParry()` (disc raised, fully up,
  and the raise younger than the window; the age resets when the disc
  drops), `parryKick`, `flash`, `noteParry()` and `slowed(dt)`; a private
  `raiseAge` and a bright flash disc over the viewmodel (white basic
  material, opacity driven by flashTime).
- `src/foamers/projectiles.ts`: the constructor takes the `FoamerSystem`;
  `LiveBall` grows `bounced`, `flatSpeed` and `steerLeft`; `bounce(b)` keeps
  the ball (no burst) and speeds it to 1.6x; `steerBounce` re-aims at the
  thrower's chest each step while steering runs, as a solved arc, and stops
  steering within 0.35 m so the ball flies straight in (at 14 m/s a re-aim
  that close would cross the target point and it would limit-cycle); a
  bounced ball's ray is the ordinary ball's ray with the Foamer parts added
  back in and the player's own capsule excluded by identity (that
  collider carries the world's group, so a group test cannot name it); a
  bounced ball can hit the thrower or another Foamer and burst on the
  world, but never the player; the
  hit goes through `FoamerSystem.parryDamage` (health, a damage `record`, a
  sound, `startStagger` for its data time, or the Foamer's own, the
  `finishWeakened` band, a go-down on depletion, never `pop`) and
  `onSound("parryHit", at)`; `stats.bounced` and `stats.parryHits`.
- The pages (`src/game/game.ts`, `src/range/main.ts`): `onHitPlayer` computes
  `blocked` and `parryable` (the shared `BALL_MATERIAL`) and, if both and
  `canParry()`, notes the parry, bounces the ball and plays SH-parry, no
  damage to the player; otherwise the block and the ball hit run as before.
  The difficulty multiplier is read like `director` (`DIFFICULTIES[s.difficulty]?.parryWindow ?? 1`).
  While a hit-stop is running the pages step the Foamer, the projectiles,
  the darts, the pieces, the pickups and the `step`/`afterPieces` hooks from
  `slowed(dt)`, the character, the shield and the world step from the real
  `dt`. The parry's kick is added to the camera's climb, same as the blast
  recoil and the block kick. `onSound("parryHit")` plays SH-parry-hit at the
  hit point. The watch: `state()` gains `parries`; the game page's
  `parryNext()` steps the simulation until the closest non-bounced ball is
  `parryLead` seconds from the eye, then force-holds the disc (so the
  raise lands inside the window); the range page's `parryNext()` simply
  returns true and force-holds the disc so long as a non-bounced ball is
  alive (its update loop is not callable from the watch, so the lead time
  is not applied; the disc's own window is what the ball lands inside).
- `data/difficulty.json` and `src/core/settings.ts`: `parryWindow` per
  preset (story 1.5, normal 1, hard 0.75, fury 0.6) and
  `DifficultyPreset.parryWindow: number`.
- `data/sounds.json` and `design/SOUNDS.md`: SH-parry (a click and a 320 to
  880 Hz sine twang, non-positioned) and SH-parry-hit (a low thud,
  positioned), code-made placeholders like the other SH- IDs.
- `tests/shield/parry.test.ts`, 4 tests: (a) with the disc up, a ball in the
  front arc inside the window is parried; after the same raise ages out of
  the window it is only blocked; (b) a ball from behind is outside the arc,
  so neither parried nor blocked; (c) the full bounce route with a real
  F02: the ball is parried by the page's substitute, comes back, hits its
  thrower (damage 4: health 8 to 4, does not kill), staggers it, and the
  player capsule is met exactly once (the parry itself, not the
  return flight, which the bounced ball's rays cannot count); (d) the difficulty multiplier: a raise aged 0.18 s
  is inside Story's 1.5x window and outside Foam Fury's 0.6x window, and
  `parryWindow()` narrows by the same factor. The bounce test `settle`s the
  Foamer's part meshes first, like the other Foamer tests: the part meshes
  are built asynchronously from the mesher's Promise, and a raycast that
  hasn't been settled can't see them (this is what took the bounce test so
  long to debug).

Not checked in a real browser (no browser here): the feel of the hit-stop
(0.05 s world-slowness), the kick and flash, the two placeholder sounds,
and whether a parried ball from a moving, re-targeting F02 finds its mark
(since steering gives it some room to work with). Also unchecked: whether
`parryNext()` on the range page is sharp enough for the automated checks.
Finished so far; the look of the disc is still from stage 1.

### 2026-11-04: GAME-05 and GAME-10a merged; arena HUD fix (Claude)

- Merged both after Paul's approval; only the docs conflicted.
- Found in the merge smoke test, live on main since GAME-07: the arena
  page had no `#finishprompt` or `#healflash`, so the shared HUD threw the
  first time a finisher was open or a health blob was picked up there.
  Both added to `arena.html`; `tests/game/pages.test.ts` checks every id
  the HUD looks up is on both pages.
- Smoke test on merged main: the Pit cleared end to end with both F02s
  in wave 2.

### 2026-11-04: GAME-10a review, Roamers played in the arena, merged (Claude)

- Played `arena.html?watch`: wave 2 is 3 F01 and 2 F02. The Roamers
  held at 5.5 to 8.4 m and cycled windup, throw and recover while the
  Slowmers closed in; balls were in the air during the throws. On the
  range an F02 spawns with health 8 and its own rig.
- Fixed: the attack damage map was keyed by attack id alone, so the F02's
  own "bonk" (10) replaced the F01's (12) for every Foamer. `damageOf`
  now reads the attacking Foamer's spec, with the base spec winning the
  fallback map. Test: `tests/game/attack.test.ts` (failed before).
- Noted by the Spark, not fixed: an F01 walking straight down the exact
  x = 0 grid line can stall (pre-existing, its tests avoid it); worth a
  bug card.
- Unverified by eye: the ball's look and glow, the throw pose (no throw
  motion in rig-states yet, the arm does not wind up visibly), the four
  sounds, and the range's type buttons by hand.

### 2026-11-04: GAME-10a, per-type Foamer specs and the F02 Roamer (Qwen 3.8 Flash Next via Pi)

Task card `tasks/GAME-10a.md`, branch `game-10a`, four commits: per-type
specs (`6eeda44`), the F02 brain (`5a79af7`), the foam ball (`0c6c34d`),
arena/range/watch wiring (`e0df30b`).

What was built:

- `data/foamers.json` is now a shared base (`test`, kept as the name) plus
  `types` overrides; `specFor(type)` merges and caches, and every `SPEC.`
  read in `src/foamers/foamers.ts` goes through the Foamer's own spec.
  `spawn(feet, facing?, type = "F01")`. The F01 tests pass unchanged.
- `src/ai/f02-brain.ts`: the ranged sibling of the F01 brain (approach to
  12 m, ring at 8 m, back off inside 5 m, throws with a `ranged` token).
  New `backOff` move intent in `src/ai/f01-brain.ts`; `FoamerAgent` carries
  either brain by a setup tag; the circle stride keeps the agent's own
  `holdRange`.
- `src/foamers/projectiles.ts`: kinematic raycast balls (9 m/s, light arc,
  from the ball hand at strike after the 0.6 s windup), one shared pink
  `BALL_MATERIAL` for the coming parry, one hit on the player, burst into
  foam chunks (`DebrisSystem.burst`), hard cap 8 live. Tuning in the base
  spec's `ball` block. A throw does not call `onBonk`; the ball's arrival
  does the damage through `damageOf("throw")` (attack table now merges the
  type attacks). The disc blocks a ball by its direction of travel: the
  handler asks `blocksAttackFrom(position - velocity dir * 0.5)`.
- Pit wave 2 = 3 F01 + 2 F02 (`data/levels/1-1-pit.json`); the rift spawn
  callback passes the file's id as the type; the range panel has a F01/F02
  type row for its spawn buttons and keep-alive spawner (`spawnType`); the
  watches list each Foamer's type and the live ball count.
- Sounds: placeholder IDs `F02-windup`, `F02-throw`, `FB-hit`, `FB-burst`
  with synth recipes in `data/sounds.json`, rows in `design/SOUNDS.md`
  (replacing the old F02-ball rows).

Decisions and rationale: PLAN section 14 (three GAME-10a rows, 2026-11-04).

Tests: 46 files, 331 passed, 2 skipped (`npx vitest run`); `npx tsc
--noEmit` and `npm run build` pass. New: `tests/ai/f02-brain.test.ts` (ring,
back off, token bids, ranged pool cap), `tests/foamers/projectiles.test.ts`
(flight speed, burst + chunks, one hit on the player, the cap, shared
material, a throw makes no bonk), F02 system tests in
`tests/ai/foamer-ai.test.ts` (keeps its ring and throws, backs off, F01
still bonks, health 8 and the F02 rig), and a ball-front-arc block test in
`tests/shield/block.test.ts`.

Not checked by eye (no browser here): the ball's look (size, the pink glow
strength of `BALL_MATERIAL`), the throw windup pose (rig-states has no
"throw" motion yet, so the windup is the generic one), the four sounds, the
wave 2 mix in the arena, the range type row. All need Paul's pass.

Notes for the reviewer:

- The ball ray excludes the exact `FOAMER_GROUPS` and `CAPSULE_GROUPS` (as
  darts and the disc do), or a ball bursts on its own thrower.
- Pre-existing, not from this card, found while writing the F02 system
tests: an F01 spawned exactly at x = 0 walking straight at a player at
x = 0 stalls at z ~= 0.37 (the character controller stops along that exact
line; nudging it cures and it never re-stalls there). New tests spawn off
that line. Worth a bug card.
- Flake seen twice during this card, both in `tests/ai/nav-grid.test.ts`
  ("bakes a 40 by 40 m floor in under 150 ms and paths across it in under
  2 ms"): a wall-clock perf assertion that fails when the machine is busy
  (other vitest runs in parallel). Passes on re-run; not timing-related to
  this card's code.

### 2026-11-04: GAME-05 review, charge played in watch mode, merged (Claude)

- Qwen 27b's first run spent 40 minutes reading, then hit its output
  limit inside one long think and wrote nothing; resumed with `pi -c` and
  a nudge to write in small steps, it finished in three commits.
- Played on `arena.html?watch`: with the disc up, a Slowmer at 17.9 m
  (past the 14 m range) gave no lock and dash was the normal dash; at
  12.6 m the lock ring showed, the charge rushed in, knocked it back about
  2 m, staggered it and took 2 of its 6 health.
- Fixed: the charge started the long, finishable stagger, so any charge
  opened an instant-kill finisher on a full-health Foamer. It is the
  short stagger now; the test checks it.
- Unverified: the rush's feel at 60 fps, the lock ring's size, the three
  placeholder sounds.

### 2026-11-04: GAME-05 shield charge (Qwen 3.8-27B via Pi)

- Built the charge in `src/player/shield.ts` (all numbers in the
  `charge` block of `data/shield.json`): with the disc up the shield
  locks the nearest Foamer in the crosshair's range and cone in sight
  of the player's eye, and a small ring marks it at the crosshair in
  the HUD. Dash with a target starts the charge (the press is spent
  here, before the player controller would dash): the player rushes at
  the lock through its own character controller, and on contact the
  Foamer is knocked back along the line, staggered and takes the data's
  small damage. A charge never kills (the same 0.0001 health floor as
  the throw). The cooldown (2 s) holds before the next one, the disc
  stays raised and blocks through it, and no finisher can start
  mid-charge (nor a charge during one).
- Sounds: `SH-lock` (the blip on the press), `SH-charge` (the whoosh on
  the first step), `SH-charge-hit` (the thud at the body), all from the
  placeholder IDs in `data/sounds.json`; see `design/SOUNDS.md` for
  takes.
- Watch helpers: `charge()` and a `charge` state `{locked, target,
  running}` in `state()` for `index.html?watch` and `arena.html?watch`.
- Tests: `tests/shield/charge.test.ts` (lock picks nearest in cone/range
  and ignores past, wide, hidden; no target is the normal dash; the hit
  stops short, knocks back, staggers, damages and holds the cooldown
  until it is spent; a wall ends the charge on the time limit without a
  hit, at rest). 318 passing, `tsc` and `build` clean, no em or en
  dashes.
- Unverified by eye (no browser here): the feel of the rush speed, the
  lock's cone against real view spread, the HUD ring's size and colour
  against the course background, the three placeholder sounds, and
  whether a charge that ends mid-flight still feels like a hit when
  the Foamer is knocked into a tight corner.

### 2026-11-03: GAME-04 stage 1 review, shield played in watch mode, merged (Claude)

- Played on `arena.html?watch`: the raised disc reads well (purple face,
  orange rim, low left, clear of the crosshair). Blocking a Slowmer's
  bonk from the front took 1.8 health against 12 with the disc down. A
  throw at three Slowmers left the arm, hit and staggered two of them
  (one twice, not in a row), flew home and lowered.
- Merged main (GAME-07) in. One stagger start now serves both: the
  Foamer system's `startStagger(f, long, seconds)` sets the stagger's
  length, and the shield calls it. Before, the shield wrote its own
  stagger time that never reset, so after one disc hit every later
  part-break stagger would have lasted the disc's stun. A disc stagger
  also opens a finisher (it is a stagger).
- Throw damage 4 to 1 in `data/shield.json`: 4 was two thirds of a
  Slowmer, and the card asks for a small damage.
- No shooting during a finisher holds with the shield too. The carve
  sound hook is set once, not every step.
- Unverified: feel at 60 fps (raise time, walk slow, kick), the
  placeholder sounds, the hold or toggle setting by hand, and that the
  flying disc (a plain orange ring) reads against arena walls.

### 2026-11-03: GAME-04 stage 1, the shield: block, movement gates, ricochet throw, return (Claude)

- `src/player/shield.ts` (new): one `Shield` class, all numbers in
  `data/shield.json` (new). States `lowered / raised / thrown / returning`;
  `update(dt, controls)` runs on the fixed step and returns the step's news
  (a reused events object: `raised, lowered, thrown, hits, caught`). The
  viewmodel (foam rim, face, boss from `createFoamMaterial`) hangs off the
  camera; the disc in flight is a scene mesh. `blocksAttackFrom` +
  `damageShare` for the block, `kick` for the view kick, `blocksFire` and
  `usedFirePress` for the blaster gate, `speedScale`/`allowSprint` written
  onto the controller each step, `forcedHold` for the range's watch helper.
- Blocking: `game.ts` and `range/main.ts` `onBonk` ask
  `shield.blocksAttackFrom(f.centre)` (raised, disc over halfway, inside
  the front arc from the view); a blocked bonk costs `damageShare`, plays
  `SH-block` at the attacker, and is not a hit (no HUD flash). The
  attacker's own logic is untouched.
- The throw (press fire while fully raised, not during a blaster switch):
  the disc flies from the left hand along the view at `throw.speed`,
  striking centres within `hitRadius` of the swept step, nearest first,
  `1 + bounces` hits, then home at `returnSpeed`, caught within
  `homeRange`, cooldown before the next throw. Each ricochet picks the
  nearest living Foamer in sight within `ricochetRange` (a clear ray from
  the disc to its middle), so it may strike one again with another
  between: the card's rule is never the same one twice in a row. It
  staggers (the Foamer's own `staggerTime`, new field; `stun` 0 in the
  data reuses it) and takes `damage` per hit but cannot kill: health
  floors at 0.0001 (the kill stays with darts and finishers). Voxel cover
  in the path carves a `carveRadius` crater (capped `debrisMax` chunks a
  flight) and turns it home.
- The disc's own rays treat a Foamer's movement capsule as neither cover
  nor sight block (exact-match `CAPSULE_GROUPS`, as darts do; plus
  excluding the two capsules either side of a ricochet): the disc leaves a
  struck body's capsule sitting inside it, and a ricochet's sight ray
  starts inside the one it just hit. Without this the disc threw itself
  home a step after every hit.
- Pages: both fixed steps call `shield.update` before the loadout and
  gate the blaster with `canFire`; `camera.rotation` adds `shield.kick`
  with the blaster's climb; restart hooks call `shield.reset()`. The range
  watch gets `block(on)` and `throwShield()`. Settings get "Shield:
  toggle, not hold" (`shieldMode`), and `data/sounds.json` gains the five
  `SH-*` placeholder sounds (SOUNDS.md updated).
- Tests: `tests/shield/block.test.ts` (front reduced, rear full, arc
  edge, walk speed, sprint off, raise time) and `throw.test.ts` (hit
  count, order, no repeat in a row, stagger damage, block again after a
  catch, cooldown, wall carve, range turn, sight behind cover) on a real
  Rapier world with real Foamers and voxel walls. `tsc`, `vitest` (302
  pass) and `build` pass.
- Not checked by eye (no browser here): the disc's look and placement
  (size, rim/face/boss proportions, hand offset), raise/lower feel,
  the kick feel, the `SH-*` placeholder sounds, toggle in the Settings
  panel, and that the disc reads well against arena walls in flight.
- Decisions in PLAN section 14; the GAME-04 row says stage 1 done, parry
  stage 2 waits for GAME-10.

### 2026-11-03: GAME-07 review, finisher played in watch mode, merged (Claude)

- Played on `index.html?watch`: shot a Slowmer to the weakened stagger,
  walked up, the F prompt showed, the finisher held the view, squeezed
  and popped it, and the three health blobs drifted in and healed 60 to
  90.
- Fixed: a dart burst that popped the target mid-finisher made the
  finisher pop it again on bodies already freed, which crashed Rapier
  ("recursive use of an object"). The finisher now stands down when its
  target has left the finish state, and the blaster cannot fire while a
  finisher holds the player. Test 5.
- Fixed: the view cone (cos 0.98) was measured to the chest, so at 1.5 m
  looking at the head (18 degrees above the chest) gave no finisher. It
  is now measured to the Foamer's upright line at the height the view
  crosses it. Test 6.
- Not decided: the player is not protected during the 0.8 s finisher, so
  another Foamer can still bonk. The modern Doom games make the player
  safe during a finisher; worth a call by Paul.

### 2026-11-03: GAME-07 the Pop finisher and the health drops (Qwen3.8-27B via Pi)

- **The weakened stagger** (`src/foamers/`). A hit that pushes a live
  Foamer to or below `finisher.weakenShare` (0.3) of its max health
  marks it `finishWeakened` and gives it the long, finishable stagger
  (`finisher.weakenStaggerTime`, 2.5 s); the normal part-break stagger
  stays short, and the mark is set once and never re-set, so a wound
  while finishable does not restart the clock. While finishable and
  staggering, the Foamer glowes and wobbles: the glow is an additive
  soft shell on its own world-space group, because the shared foam
  material is one mesh material and cannot pulse per Foamer, and the
  part-group matrices are world matrices so it cannot sit under the
  Foamer's group (`Foamer.glow`, `Foamer.glowGroup`, `syncGlow`).
- **The finisher** (`src/game/finisher.ts`, `finisher.*` tuning in
  `data/foamers.json`): a melee on a finishing-enough stagger within
  reach (2.5 m, eye to chest) inside the view cone (cos 0.98) holds the
  player for 0.8 s, turns the view onto the Foamer, squeezes and
  stretches it (the new `finish` state and `finishMotion`), then pops
  it on schedule. `Finisher.attempt` is the pure geometry; `has` gates
  the HUD prompt; `update` owns the view turn and the pop. The melee
  key is consumed when the finisher spends it (`Input.consumePress`),
  so the course's debug blast does not fire on the same press; a melee
  with no finishable in reach keeps the page's old behaviour.
- **The health drops** (`src/pickups/pickups.ts`, a new generic pickup
  with `data/pickups.json`; health is the first kind, ammo comes at
  D08). A pop sprays 3 cream blobs of 10 health; they hop out, settle
  and bob, are collected walking within 1 m (drifted to the player
  within 2 m), heal back to max but never past it, stay on the floor
  at full health, cap at 24 live (oldest first) and dissolve after
  30 s. The blobs carry their own colliders with the world and are
  ignored by darts and by the player capsule.
- **Shared wiring** (`src/game/game.ts`, not the pages): builds the
  `PickupSystem` and `Finisher` on the Game, runs the finisher in place
  of the player update while it is active, steps the pickups after
  `world.step()`, renders and runs the HUD prompt and the green heal
  flash (green, so it never reads as a hit). The course and arena reset
  paths clear the blobs alongside the Foamers. `input.simulatePress`
  backs the watch's `finish`; the watch also reports pickup counts and
  a per-Foamer finishable flag.
- **Sounds**: `FX-stagger` (the weakened stagger), `FN-finisher` (the
  squeeze) and `PU-health` (the collect) are synthesised placeholders
  in `data/sounds.json`; the lines were already in `design/SOUNDS.md`.
- Tests: `tests/foamers/finisher.test.ts` (the crossing hit staggers
  long, once, and holds beyond the short stagger; the part break keeps
  its short stagger; the reach and cone gate the attempt; the full run
  turns the view, pops on schedule and sprays blobs that settle on the
  floor) and the existing `tests/pickups/pickups.test.ts`. `npx tsc
  --noEmit`, `npx vitest run` and `npm run build` all pass; no em or
  en dashes in any touched file.
- Not checked by eye (no browser here): the glow's colour and shape,
  the wobble amount, the finisher prompt's size and position, the heal
  flash, the squeeze-stretch-pop by hand, the pickup look, and the 60
  fps cost of the glow and the blobs on mid-range hardware.

### 2026-11-03: darts pass Foamer capsules, and aim at what the crosshair is on (Claude)

- `CAPSULE_GROUPS` (`src/physics/world.ts`): a live Foamer's movement
  capsule, upright and lying, is a world member as before plus a capsule
  bit, and darts skip it by exact match (like ragdolls). Nothing draws the
  capsule, and between the legs and arms a dart could stop on it and do no
  damage. Test: `tests/foamers/dart-capsule.test.ts`, a fan of 56 darts at
  a standing Slowmer; 1 stopped on the capsule before, 0 after.
- `updateAim` (`src/weapons/aim.ts`): the shot used to converge on a point
  50 m down the view, so from the muzzle (below and right of the eye) a
  dart landed about 0.2 m low and right at 4 to 10 m. It now aims at the
  first solid thing under the crosshair (past capsules, at least 2 m, at
  most 50 m). Test: `tests/weapons/aim.test.ts` (0.23 m off before).
- Arena, same scripted fight on both builds: main cleared both waves in
  26 shots, this branch in 22.
- Watch-mode lesson: Foamer part colliders come from the mesher worker,
  whose results land only between JavaScript tasks. A console script that
  steps in one long synchronous loop never gets them, so darts pass
  through every Foamer. Scripts must yield (await a setTimeout) between
  steps after a spawn. That, not the capsule, caused the "every shot hits
  the capsule" reading in the ENG-13 review.
- Unverified by hand: how the aim feels at 60 fps, close to walls and
  over cover edges (the dart now leaves the muzzle toward the crosshair
  point, so a lip in front of the muzzle can still catch it).

### 2026-11-03: ENG-13 reviewed and merged (Claude)

- Merged after Paul's approval. The shared step keeps the old order; the
  same arena script on main and on eng-13 gave identical Foamer positions
  step for step, and `index.html?watch` spawns, walks and takes a hit.
- Found in review: darts sometimes stopped on a Foamer's movement capsule.
  The first measurement (every shot on the capsule) was a watch-mode
  artifact, see the capsule fix entry above; the real effect is smaller.

### 2026-11-03: ENG-13, one shared game module for the playable pages (DeepSeek via Pi)

- `src/main.ts` and `src/arena/main.ts` were near copies (501 and 537
  lines). Everything both pages did is now `src/game/game.ts`:
  `createGame` takes a page's `build`, its hooks and its scene options,
  and owns renderer, physics, input, player, health, settings store and
  panels, HUD, loadout, darts, impacts, carving, debris, falling pieces,
  Foamers on the level AI, sound, the fixed step, render and the loop.
  `src/game/ui.ts` holds the pause menu, settings and popped screen;
  `src/game/audio.ts` holds the engine start and its volume and pause
  wiring.
- Page code moved to `src/course/extras.ts` (throwable foam blocks, the
  melee debug blast, the pop burst, the course respawn) and
  `src/arena/extras.ts` (level build, the lock-in runner, rifts, exit
  pad, banner, checkpoint restart, the `dartArena` watch fields). Each
  page file is now its geometry and a call: `src/main.ts` 112 lines,
  `src/arena/main.ts` 50 lines.
- The step and render order is unchanged and lives in one place now:
  health, player, Foamers, the page step hook, blaster and aim, sounds,
  debris, pieces, the page's after-pieces hook, darts, the page's
  before-world hook, `world.step`, the page's after-world hook. Render:
  debris, pieces, Foamers, page render hook, camera, viewmodel, HUD,
  page late hook, darts, listener, draw.
- `index.html?watch` now exists alongside the arena's, with one shared
  set of console helpers (`state`, `moveTo`, `look`, `aimNearest`,
  `fire`, `step`, `pause`); each page adds its own fields to `state()`.
- Not verified here: the pages have not been run in a browser. The
  checks are tsc, the 289 unit tests and the build. The arena's two
  waves and the course's Foamer spawns still want a watch-mode pass.
### 2026-11-03: LVL-01 review, played through in watch mode, merged (Claude)

- Played `arena.html?watch` end to end by stepping by hand: the doors
  lock on entering the pit, wave 1 (3 Slowmers) comes from the two north
  rifts, wave 2 (5) from all three once wave 1 is down, both doors open
  on clear, and the exit pad shows Level complete. Try again restarts at
  the pit entry with the arena reset.
- Fixed: Try again kept the ammo left at the pop, and there are no
  pickups yet, so a retry could be unwinnable; the checkpoint now resets
  every blaster to its starting magazine and reserve. Added
  `dartArena.aimNearest()` for review (points at the nearest standing
  Foamer's body).
- Not a bug, but worth knowing: at 13 m the pump's spread and dart drop
  miss a Slowmer more often than they hit; up close it goes down fast.
- `src/arena/main.ts` is still mostly a copy of `src/main.ts` (only the
  attack damage and carve bounds moved to `src/game/`). Fine for one
  arena; fold the shared wiring into `src/game/` before a second page.
- Pre-existing (UI-01, same on index.html): the title overlay shows
  through behind "You popped!".
- Unverified: frame cost of the pit at 60 fps, how the pit looks and
  reads by eye (it is all greybox), and the lock-in banner timing.

### 2026-11-03: LVL-01 the first arena (DeepSeek via Pi)

- Built in three stages, one commit each: `be844ca` format, validator,
  builder and the Pit file; `b0a88f3` arena lock-in and waves; `20993b5`
  the arena page.
- `src/level/format.ts` types the subset of BLOCKOUT.md LVL-01 uses;
  `validate.ts` implements rules 1 to 6 and 9 to 12 as pure data checks
  (no Three.js, so Node tests run them) and returns errors plus warnings;
  `build.ts` builds the shell with fixed colliders, ramps as rotated
  slabs on a real slope, one voxel volume for every piece with a bedrock
  row under each anchor, and doors whose mesh and collider switch off
  together.
- `data/levels/1-1-pit.json` is the Pit from LEVEL-1-1 4: start room,
  12 m corridor, 34 x 26 m pit floor 4 m below the entry ring, two ramps,
  the centre block (3 volumes) and two pillars, three rifts, the lock
  trigger plus entry door and exit door, and a lit exit pad. It validates
  with one warning (5 piece volumes, close to the KIT cap of 6).
- `src/level/arena.ts` is the lock-in state machine: waiting, locked,
  waves with `delaySeconds` between them and `holdSeconds` between
  spawns, cleared opens `unlockOnClear`. Twelve tests drive it with a
  fake Foamer count; the spawn cap retries rather than dropping a spawn.
- `arena.html` plays the level with the full game. Shared code moved to
  `src/game/` (`attack.ts`, `shared.ts`) so `index.html` and
  `range.html` use the same damage table and carve bounds; the test
  course otherwise behaves as before (only `createRenderer` gained
  options, with the old values as defaults).
- HUD banners: "Clear the arena" on lock, "Wave n of m", "Arena clear".
  Rifts are dim seams before the lock and glow while a wave comes out.
  The exit pad shows Level complete with Play again. Six placeholder
  sounds were added to `data/sounds.json` (LV-door, LV-arena-lock,
  LV-rift-open, LV-wave, LV-arena-clear, LV-exit); all were already in
  `design/SOUNDS.md`, so no doc change was needed.
- `arena.html?watch` starts unpaused without pointer lock and
  `window.dartArena` has `state()`, `moveTo`, `look`, `pause`, `fire()`
  and `step(n)`.
- Decisions (also in PLAN.md 14): doors may overlap a shell wall, since
  the format has no doorway field; the arena voxel budget counts the
  trigger, doors and rifts grown by 4 m; the arena page owns its spawns
  with `spawnCount = 0`; a popped player restarts at `checkpointPos` with
  the arena reset but carved voxels left as they are; `checkpointPos` was
  added to BLOCKOUT.md with a line saying why.
- Unverified: the card's end-to-end check (walk in, both waves, exit
  opens, pad completes) was not run in a browser, because there is no
  Chrome, Playwright or Puppeteer on this machine. The frame cost of the
  Pit (voxel volume, nav bake, six waves of Foamers) was not measured
  against the test course, so the card's frame budget question is still
  open. The nav bake at load is asserted under 1 s in
  `tests/level/pit-load.test.ts`, but no real frame graph exists yet.
  Paul has not seen the Pit's look; everything visual is greybox.
- Small fixes found while wiring the page: the south doorway stood over
  a 1 m gap in the floor (a sill box was added), and the arena's
  `state.cleared` / `progress` used the wrong index.

### 2026-11-03: LVL-00 reviewed and merged (Claude)

- Merged after Paul's approval. Review fixes: an arena's way on is across
  the room from the way in (README contradicted itself), one alive cap of
  12 at Normal in every file, and Boss 1's weak points made consistent
  (two launchers and the back tank; the crown is the last target).
- Open for Paul: the 1-2 blaster clash (level table B02, D04 answer the
  Shredder), 1-2's Crossroads exception to pillar 2, act settings and
  accent colours, and the BOSS 1 working name "Foam Demon" against the no
  demonic imagery rule. Not yet good: the 1-1 map is a schematic stack,
  and Boss 1 phase 3 (charge the knee in a 1 s window, then mantle) may be
  too fiddly for 10+.

### 2026-11-03: LVL-00 level design concepts (DeepSeek via Pi, review)

- New `design/levels/`: `README.md` (pillars with checks, the 10 beat
  rhythm for a 17 to 19 minute level, where secrets, stations, placed
  ammo, blaster pickups and rifts sit, 10 wayfinding rules), `KIT.md`
  (the player ruler from `data/player.json`, 8 arena archetypes with
  ASCII sketches and metre sizes, 9 connectors, 6 secret types, the
  destructible piece table with 3.2 m voxel-zone limits from
  `data/destruction.json`, and the arena budgets from `data/ai.json`),
  `LEVEL-1-1.md` to `LEVEL-1-4.md`, `BOSS-1.md`, `ACTS-2-3.md` and
  `BLOCKOUT.md` (JSON proposal only, one worked arena, no loader code).
- Bucket limits the concepts respect: a destructible zone is 3.2 x 3.2 x
  3.2 m (32 voxels of 0.1 m), 6 zones per arena, 12 Foamers alive,
  arena footprint 44 x 36 m so the nav grid and the 2 melee tokens hold.
- Decisions: PLAN 9 direction line added (semi-open linear, Paul) and a
  section 14 row dated 2026-11-03. LVL-00 row added to the Phase 2 table
  above LVL-01.
- Proposed, needs Paul: every place name, act setting and boss look
  ([Paul] left in each file); the act accent colour; whether 1-3 gets a
  blaster (table 2 is blank there, `LEVEL-1-3.md` section 8 argues for
  none); the 1-2 blaster order clash between CONTENT-PLAN table 2 (B02)
  and D04 (Shredder); whether A7 in 1-2 is allowed to make the way on
  the way back.
- Unverified: none of the metrics are playtested. The boss plinth and
  its 2 m shield-charge reach (BOSS-1 section 8), and the Swarmer
  debris load (LEVEL-1-3 section 7) are the first things to check in a
  blockout. `npx tsc --noEmit` and `npx vitest run` pass; no game code
  or data changed.

### 2026-11-03: ART-03 reviewed and merged (Claude)

- Round 3 left the Slowmer's pupils as a 1 by 2 strip at one side of each
  eye, cut by the top of the head: the eye centres fell between voxels and
  sat too high on the 11 voxel head. `buildPartVolume` now snaps round eye
  centres to a voxel (only F01 has round eyes; the others are unchanged), and a new `eyeHeight` part field (fraction of the part's
  height; default 0.22 round, 0.12 others) moves them. F01 uses 0.12 at
  scale 1: two 3 by 3 eyes, one centred pupil each, a lime gap between.
  F02 and F05 re-rendered and checked; the Darter crown is clean.
- Unverified: the Slowmer eyes are small at 11 voxels; bigger eyes would
  need a bigger head, which changes its hit volume. Two eye white voxels
  show on the crown from behind.

### 2026-11-03: ART-03 round 3 face fixes (Kimi via Pi)

- Slowmer now has two separate cream eyes with centred 2 x 2 ink pupils, and Darter's lowered brow leaves no lime sliver on its crown. Re-rendered and checked all three sheets; all 174 active tests, TypeScript checking and the production build pass.

### 2026-11-03: ART-03 round 2 review fixes (Kimi via Pi)

- Fixed turnaround raster cracks by overlapping projected faces and sampling
  pixel centres explicitly. Uniform face shading removes the remaining false
  streaks from exposed voxel rows.
- Slowmer keeps every original gameplay part box and combat behaviour. Big
  round cream eyes, a separate grin, head nubs and light body-shag paint give
  it the requested foam-zombie look. `eyeScale` and `shag` change paint only;
  body nubs and mixed-material shag were rejected because they broke hits.
- Roamer now holds its ball at shoulder height with a raised forearm, and has
  angry cream eyes above a separate ink grin.
- Darter has one curved chest plate and one curved brow plate fitted into the
  body, with no floating slabs or overhang. Its gape and orange back remain.
- Re-rendered and visually checked all 12 views. All 174 active tests,
  TypeScript checking and the production build pass. Paul's visual approval
  and in-game framing remain unverified.

### 2026-11-03: ART-03 Slowmer, Roamer and Darter (Kimi via Pi)

- Added the light and deep purple, orange and lime palette materials and
  rebuilt F01, F02 and F05 to their CONTENT-PLAN silhouettes and colours.
- Added `tools/render-rig.ts`: real rig volumes and rest poses become four
  orthographic PNG views and a labelled sheet, with no new dependencies.
- Slowmer keeps its original part sizes and combat volumes. Longer arms and
  body nubs broke existing hit and ragdoll tests, so its shaggy nubs are on
  the head. Darter has split front armour, a rear orange weak point and a
  paint-only `gapeScale` option for a readable mouth.
- Added palette, F01 gameplay-contract and deterministic-PNG tests. All
  172 active tests and TypeScript checking pass; final sheets were checked
  visually. Paul's approval and in-game framing remain unverified.

### 2026-11-03: ENG-08, QA-watch and QA-flaky merged (Claude)

- Merged `eng-08`, `qa-watch` and `qa-flaky` into main after Paul's
  approval. HANDOFF conflicts only, both sides kept. 240 tests pass, build
  clean.
- Still unverified by eye at 60 fps: the prone attack (head rises to about
  standing height in the windup) and the feel of the hold circle.

### 2026-11-03: QA-flaky test 7 was seeded (Qwen3.8-27B via Pi)

- `tests/foamers/foamers.test.ts` test 7 (a burst kills and pops it) failed
  once under heavy machine load. Cause: the carved debris chunks are kicked
  with `Math.random` (`src/voxel/debris.ts` chunk speeds, directions and
  spin). A chunk can rebound into the dart flight path, so which of the
  dying round's darts hit the Foamer versus a chunk varied with the
  process's random state at that moment. When the killing darts landed on
  chunks or carved ground, the round dealt less than the catastrophic
  share (0.4 x max health in 0.1 s), so the Foamer went down instead of
  popping and the test's `popped === 1` failed. Game code is correct (the
  burst window is exact and the damage is what the game intends); the test
  depended on randomness it never seeded.
- Reproduced with a seeded copy that swapped `Math.random` for an LCG:
  2 of 80 seeds failed (downed instead of popped, health 0, popped 0).
- Fixed in the test only: test 7 now wraps the fight loop in a seeded
  `Math.random` (seed 0x1bdcb3d2) and restores the process random after.
  No step, timing or wall-clock dependence remains: steps are fixed
  `DT = 1/60` and the loop is deterministic.
- Verified: 25 runs of the file alone and several full-suite runs under
  extra load, all green; `npx tsc --noEmit` and `npm test` pass.

### 2026-11-03: QA-watch, range watch mode for the in-app browser (Qwen3.8-27B via Pi)

`range.html?watch` starts the range unpaused without pointer lock, which
the reviewer's automated in-app browser cannot take. The overlay is
hidden, the HUD shows and the sim steps as when playing; Esc and pointer
lock work as before when `?watch` is absent (same code path, no other
page or module changed).

In watch mode only, `window.dartRange` holds plain console functions that
reuse the panel's own handlers: `spawn(distanceMetres)`, `breakLeg()`,
`look(yawRadians, pitchRadians)` (sets the player's yaw and pitch, the
render step points the camera), `moveTo(x, z)` (teleport on the floor
grid), `pause(on)` and `state()` (each Foamer's state, health, feet
position and attached part ids). Unverified: whether the in-app browser
calls them and reads `state()` back as the reviewer expects.

### 2026-11-03: ENG-08 review, seen on the range (Claude)

- Watched on the range in watch mode (QA-watch branch, stepped by hand
  because a hidden browser pane gets no animation frames): a range spawn
  stands idle, sees the player at 8 m, alerts, approaches, takes a token at
  the hold ring, winds up, strikes and recovers; with a leg broken it falls
  in under 0.9 s, crawls and attacks from the ground.
- Fixed in review: line of sight was always blocked (the ray started inside
  the Foamer's own capsule and part boxes and ended inside the player's
  capsule), so no Foamer ever saw the player; new `SIGHT_QUERY_GROUPS`, the
  own capsule excluded, `sightEndMarginMetres` in `data/ai.json`, and a test
  on the real system. An approach without a token no longer bids, and a
  falling Foamer no longer bids until it is crawling.
- Unverified: how the prone attack looks (the head rises to about standing
  height in the windup) and the feel of the hold circle, by eye at 60 fps.
- `tests/ai/nav-grid.test.ts` timing test still fails now and then under
  load (wall clock); not touched.

### 2026-11-03: ENG-08 stage 3b (DeepSeek V4.1 Flash)

The Foamer brain on the director and the nav grid. Stage 3a built the pure
logic; this is the wiring into `src/foamers/` now that GAME-11 has merged,
plus the two pages and the range overlay.

- `data/foamers.json`: both test attacks (bonk, headbutt) declare
  `"token": "melee"`. The rig's pool is read from the attacks when a Foamer
  spawns, so a ranged rig will draw from the ranged pool with no code change.
- `src/ai/agent.ts`: one class per Foamer, `FoamerAgent`, holding the brain,
  its context, the token bid and one reused path. `bid` and `step` are split
  so every agent bids before `Director.update` resolves the bids (the best
  bid wins, not the first caller), then reads the answer back. `navigate`
  re-paths on `repathSeconds`, when `grid.version` changed (a carve or a
  rest re-bake), or when the player moved more than 0.5 m. Nothing from
  Three.js or Rapier is imported.
- `src/ai/level.ts`: `makeLevelAI(rapier, world, bounds, difficulty)` builds
  one director and one grid per level, with `carveChanged` and `pieceRested`
  re-bake helpers. The director's difficulty comes from the settings preset's
  `director` key (`DIFFICULTIES[...].director` in `data/difficulty.json`),
  so a preset that should feel harder can cap more tokens.
- `src/foamers/foamers.ts`: each Foamer gets an agent at spawn, with its
  first state from `spawnState` (arena alert, range idle). The brain runs
  before the state machine each step and owns idle, alert, approach and hold;
  windup, strike, recover, stagger, fall, crawl and down stay in the Foamer.
  An attack needs a token; the token is released on attack end, on stagger,
  on fall, and forgotten on down. Approach follows the grid path with
  separation steering; hold strides along the ring at `holdRange`. A crawl
  follows the same path at crawl speed. Line of sight is a ray from chest to
  player, with debris and ragdoll bodies excluded. Being shot wakes it
  (`tookDamage`), and an idle Foamer picks up a neighbour's alert inside
  `alertRadius`.
- `src/voxel/pieces.ts`: `onRest(centre, radius)` fires once when a fallen
  piece sleeps, so the grid can re-bake under it.
- `src/main.ts` and `src/range/main.ts`: one `makeLevelAI` each, assigned to
  the Foamer system; main bakes over the course and starts spawns alert, the
  range bakes over its floor and starts spawns idle so the sight test can be
  watched. Carves and resting pieces re-bake their patch in both.
- Range: a Nav grid switch draws the walkable cells as one InstancedMesh
  (built when first switched on, cells tinted by height) and each Foamer's
  path as a line; the report gains the director's `stats()` (melee and
  ranged tokens in use, and how many are waiting).
- Tests: `tests/ai/foamer-ai.test.ts`, two real-physics tests: an F01 behind
  a wall with one far gap reaches the player, and 4 F01s on the player never
  have more than the normal melee token count attacking at once while the
  director never issues more than its cap.

Decisions. A Foamer with no director keeps the pre-brain behaviour (walk in,
attack in range). That is deliberate: the older Foamer tests and the debug
tools spawn without one, and it keeps the change surgical. `NavGrid.findPath`
gained a fallback for an agent standing in a cell the bake calls unwalkable
(pressed against a wall): it paths from the nearest walkable cell on its own
level. Without that a Foamer that walked into a wall stood still for ever.

Still unverified. The overlay is not checked by eye in the browser, and the
bake over the main course's bounds (x -20 to 70) has not been timed there;
the stage 2 measurement was 70 ms for 40 by 40 m at 0.25 m cells. The arena
alert spawn means the main page starts with Foamers already closing in, which
is new behaviour and has not been played.

Review (same day, after the stage 3b review). One real bug: tokens were never
given back, because the release on attack end and on stagger was only
promised and never called, and every living Foamer bid every step, so the
first Foamers to win a token kept it for good. Now `FoamerAgent.ask` bids
only while it wants one (hold, a crawl in reach, an attack in progress, or an
approach carrying the token it won) and calls `director.release` otherwise,
which frees a stale bid too; `recover` end releases `attackEnd` and a stagger
releases `stagger`. `nextAgentId` uses `aiData.maxAgents` and returns -1 when
all are taken, so that Foamer spawns without an agent instead of sharing id
0. `navigate` reuses two scratch points. The circle's 0.5, 0.6 and 0.15 are
now `circleRampMetres`, `circleStrafeShare` and `circleDeadbandMetres` in
`data/ai.json`. Two more real-physics tests: 4 F01s all attack within 20 s of
sim time, and an idle F01 out of sight holds no token.

### 2026-11-03: ENG-08 stage 3a (DeepSeek V4.1 Flash)

The parts of stage 3 that do not touch the Foamer code, so it could land
while GAME-11 rewrites `src/foamers/`:

- `src/ai/brain.ts`: a small state machine base. States are a string union
  given as a type parameter, each with optional `enter`, `update`, `exit`
  hooks over a caller context, `stateTime` (reset on every transition) and a
  fixed-size transition ring the tests read (`logLength`, `logAt`, `log`,
  `statesEntered`). A state that returns itself is not a transition, so
  nothing is logged for standing still. The hooks get `(dt, stateTime, ctx)`
  so they never have to read `brain.stateTime` back.
- `src/ai/f01-brain.ts`: idle, alert, approach and hold as pure functions
  (`decideF01`) over a five field input struct plus attack range and
  `holdRange`, returning the wanted state and a movement intent (`stand`,
  `followPath`, `circleLeft`, `circleRight`). `makeF01Brain` wires the four
  states onto the base machine; `makeF01Context` makes the one allocation per
  Foamer. `updateToken` and `releaseToken` talk to the stage 1 director.
  Nothing from `src/foamers/` is imported.
- `data/ai.json`: the `brain` block with sightRange 20, alertRadius 8,
  alertTime 0.4, repath 0.5 and holdRange 2.2, each explained in the `_note`.
  `repathSeconds` is data only in 3a: the brain has no path yet, so the
  Foamer side schedules re-paths in 3b.
- `tests/ai/brain.test.ts`, 17 tests: the state machine base (time, enter and
  exit, the ring wrapping); idle stays idle when the player is out of sight
  and goes alert when shot or when a neighbour alerts; alert holds for the
  telegraph then approaches; approach follows a path and asks for a token in
  reach only; without a token it goes to hold, circles (odd ids the other way
  so two Foamers do not mirror) and asks again every step; hold ends on a
  token or when the player walks away; token scores put a closer agent ahead
  and let a waiting one catch up; `down` forgets a token at once, attack end
  releases it; 4 simulated F01s on the player never exceed the 2 normal
  melee tokens attacking at once over 10 s, and every one attacks at least
  once in 20 s.

Decisions. Hold and circle live in the brain, not in the Foamer, so the
"never attack without a token" rule is testable without a physics world. The
brain never leaves `idle` for anything but `alert`: the log check asserts a
real brain driven at point blank distance only ever logs `idle` to `alert`.
`down` calls `Director.forget` rather than `release`, because down is terminal
and the cooldown would otherwise look like a stall to the next Foamer.

Still unverified. The card's "an F01 behind a wall walks round it" test waits
for stage 3b, where the Foamer owns position, path and the nav grid; nothing
here observes a real Foamer, so the walk round a wall is not tested yet.
Attack range (1.3 m from `data/foamers.json`) is passed in by the caller and
is not yet read from the rig; 3b wires it. Stages 3b and the range overlay
(the Nav grid switch, the per Foamer path lines, the director `stats()` in
the report) are still to do after GAME-11 merges.

Review fixes (same entry): approach without a token now hands over to hold at
`holdRange` instead of `attackRange`, and hold only returns to approach on a
token or once the player is past `holdRange + holdExitMarginMetres` (new data
value, 1.0 m), so a tokenless Foamer settles at 2.2 m instead of walking in
and being told to hold and approach on alternate steps. With a token,
approach walks to `attackRange` and stands. `tokenScore`'s three weights moved
to `data/ai.json` brain (`tokenMinDistanceMetres` 0.5, `tokenSightScore` 1,
`tokenWaitPerSecond` 0.5, each in the `_note`) and are read from `BRAIN`. New
test: a tokenless agent whose distance follows its own intent enters hold
once and stays for 5 s (one transition, no flapping).

### 2026-11-03: ENG-08 stage 2 (DeepSeek V4.1 Flash)

Grid navigation and steering: `src/ai/nav-grid.ts`, `src/ai/steer.ts`, the
`nav` and `steer` blocks in `data/ai.json`, 18 tests in
`tests/ai/nav-grid.test.ts` and `tests/ai/steer.test.ts`. Pure numbers and
typed arrays; Three.js is not imported.

`NavGrid` bakes a rectangle of the level into a 0.25 m grid: a downward ray
from 8 m finds the ground, the hit normal rejects slopes over 40 degrees,
and an agent sized capsule (0.35 m radius, 1.6 m tall) standing on that
ground must hit nothing. Ground height and a walkable flag live in two
typed arrays. `rebake(minX, minZ, maxX, maxZ)` redoes only the cells in
that rectangle plus one agent radius around it, for `impacts.onCarve` and
for a falling piece that rests. `findPath(from, to, out)` is A* on
8-connected cells with no corner cutting and a 0.45 m step limit between
neighbours, string pulled to the fewest waypoints, writing into caller
owned arrays: no allocation per query after the first. An unwalkable or
walled off goal paths to the reachable cell nearest it. `steer` seeks the
next waypoint, eases to a stop inside `arriveRadius` 0.6 m of the last one,
and pushes away from neighbours nearer than `separation` 0.9 m.

Measured in the test runner: bake of a 40 by 40 m floor 27.8 ms, path
query across it 1.1 ms with 4 waypoints (targets under 150 ms and under
2 ms).

Decisions and why (PLAN.md 14, row of 2026-11-03):
- A walkable grid, not a recast navmesh. The level is destructible, so a
  navmesh would need re-baking around every carve, which is the cost 4.3
  exists to avoid. A grid re-bakes a small rectangle instead, needs no new
  dependency, and is plain typed arrays.
- Cells are test baked from the physics world, not from the voxel data:
  pieces that have fallen, ramps and the level all come out the same way,
  and there is one source of truth for what is solid.
- Kinematic bodies are skipped in the bake. The player and Foamers are
  kinematic, so nobody steers around an agent that is steering; pieces
  (dynamic) and the level (fixed) are found.
- The standing shape is lifted by `maxStep` before the shape cast. Without
  that lift every 0.45 m step reads as a wall, because the capsule's lower
  half is inside the step. With it, a step the character controller walks
  up passes and a 1 m ledge still fails.
- A* uses an indexed heap with decrease-key, one entry per open cell.
  Lazy duplicate insertion overflowed the fixed heap on a long search.
- The goal that cannot be reached falls back to a second A* that may end
  anywhere and keeps the cell nearest the goal. Picking the nearest
  walkable cell first is wrong: it can be an isolated pocket under a ramp.

Two things to know when wiring this in stage 3:
- Rapier's query pipeline only updates on `world.step()`. A bake or rebake
  straight after adding or removing a collider queries the old world, so
  the game must rebake after the step that applies the change (or call the
  query pipeline update). The tests step before every bake.
- A wall's own top is stand-able ground, so its cells are walkable; what
  stops a path climbing a 2 m wall is the step limit, not the flag. The
  tests assert paths and ground heights rather than the flag for that
  reason.

Unverified: nothing in the game calls the grid or steering yet (stage 3
wires them into the Foamer loop). Bake cost on the real 40 by 40 m course
with its voxel wall and towers is not measured; the 27.8 ms above is a
plain floor in the test runner. The rebake cost per carve is not measured
either, only reasoned about. Grid resolution 0.25 m is from the card and
has not been tuned against a 0.35 m agent walking through the course.

### 2026-11-02: ENG-08 stage 1 (DeepSeek V4.1 Flash)

The AI director: `src/ai/director.ts` plus `data/ai.json`, 8 tests in
`tests/ai/director.test.ts`. Pure TypeScript, no Three.js or Rapier.
Attack tokens by kind (`melee`, `ranged`), 1/2/3/4 of each for story /
normal / hard / fury, default `normal`, `tokenCooldown` 0.4 s and
`maxAgents` 64. `request(agentId, kind, score)` records a bid and returns
true once the agent holds a token, `release` returns it, `forget` drops a
dead agent's bid and its token at once, `update(dt)` runs the cooldowns and
then grants free tokens, `stats()` reports tokens in use per kind and
agents waiting. Fixed-size typed arrays: no allocation per call.

Decisions and why:
- Bids are resolved in `update`, highest score first, not inside
`request`. If `request` granted on the spot, the first caller in a frame
would always beat a higher score later in the same frame, and every Foamer
would need an update order in `main.ts`. One pass over 64 slots per kind
per frame, no sort.
- A forgotten agent frees its token with no cooldown. The cooldown exists
to stop one agent's attacks chaining; an agent that is gone cannot attack,
so the next Foamer should not inherit its wait.
- A waiting agent may raise its score between updates; the newest bid is
what the next `update` sees. Ties go to the lower agent id, which keeps
the grant order stable.
- Ids are integers in [0, `maxAgents`); anything else is ignored rather
than throwing, because the caller is the Foamer loop.
- The card says F01's bonk and headbutt are `melee`, but `data/foamers.json`
carries no kind per attack, only `needs`, `windup` and `strike`, and adds
no `attackKind`. Stage 1 does not read `data/foamers.json`, so nothing is
hard coded either way. Question for the reviewer: should stage 3 add a
`kind` field to each attack in `data/foamers.json`, or hold one kind per
rig in `data/ai.json`?

Unverified: nothing in the game calls the director yet (stage 3 wires it).
No range report field yet either. Stage 2 (nav grid, steering) not started.

### 2026-11-03: GAME-11 merged (Claude)

- Merged `game-11` into main after Paul's approval. Review: matches the
  card; the three changed old assertions are right (one lost leg now
  falls, it no longer limps). One indent restored.
- Left in code, small: the crawl's arm angles (-1.4, -0.6), the lying
  capsule's 0.45 m offset and the half turn rate. Move them to
  `data/foamers.json` when the crawl is tuned by eye.
- Unverified: the fall and crawl seen in motion. The range needs pointer
  lock, which the in-app browser cannot take; watch it on the range with
  Break leg.

### 2026-11-03: GAME-11 stage 2, crawl, attacks from the ground, sound and range button (DeepSeek V4.1 Flash via Pi)

The prone Foamer now moves and fights. `crawlMotion(rig, gait, out)` in
`src/foamers/rig-states.ts`, the signature the card names, adds the crawl
to the pose the Foamer already has: the arms reaching forward in turn
(`-1.4` plus and minus `0.5 * sin(gait * PI)`), the leg it has left
dragging at `-0.5 + 0.12 * cos`, and a small body rock in pitch. It does
not set pitch, roll or y itself: `poseParts` calls `proneMotion` for the
prone tilt first (which splits it with the fall's own `sideShare`, so the
crawl takes over from exactly where the fall ended and no part turns
over), then lays the crawl on top. A prone attack lays
`windupMotion`/`strikeMotion` over the same prone base pose, so it attacks
from where it lies instead of standing up to do it.

`Foamer.prone` is set by `startFall` and outlives the `crawl` state,
because the attack states are not prone states: every pose, floor fit and
reach check asks `prone`, not `state`. Speed is `Foamer.crawlSpeed()` =
`rig.speed * handicaps.crawlSpeed` (0.3 m/s measured on F01), and the turn
rate is halved while prone (`CRAWL_TURN` 0.5 in `foamers.ts`). It does not
turn at all during the fall, which is what the card's "no movement during
the fall" says.

Reach from the ground uses `Foamer.headPos`, the head's box centre taken
from the pose the Foamer was just solved into. Both the decision to attack
and the strike's own `dist <= attackRange + 0.3` check use it while prone,
so a crawl whose feet are still 1.8 m out attacks as soon as its head is
in range. With no forearms, `chooseAttack` already fell through to the
headbutt (`needs: []`), so no new data was needed. A prone Foamer cannot
stagger: an arm break on the ground only cancels the attack, because a
stagger would stand it back up.

The fall sound and the lying capsule came in stage 1 (`FoamerSoundKind`
`fall` -> `FX-topple`, no fizz-out; `setCapsuleLying`), and the range's
Break leg button and `breakLegForTest()` did too, so stage 2 only had to
keep them working. Footsteps were already gated on `state === "approach"`
in `src/audio/foamer-sounds.ts`, which covers the fall and the crawl; test
7 now pins that.

Tests: card 4 (closing speed within 15% of `rig.speed * crawlSpeed` and an
attack in range, then the same crawl with both forearms gone headbutting),
6 (a crawling Foamer killed by darts ragdolls and stays down; the test also
covers a kill mid-fall) and 7 (`onSound` gets `fall` once at the body, and
through the real `FoamerSounds` `FX-topple` plays once, with no
`FX-fizz-out` and no `FX-step-medium` during the fall or the crawl). Card
tests 1, 2, 3, 5 and 8 were built in stage 1 and are unchanged. One old
assertion had to change: `tests/foamers/parts.test.ts` 7 asserted that a
fallen Foamer "holds still prone" (stage 1's placeholder), which the card's
own crawl supersedes; it now checks that it crawls, more slowly than it
walked. None of the card's numbers changed.

Unverified: how the crawl reads on screen (the arm reach, the drag, the
pitch rock) and whether the prone attack's head reach feels right, both by
eye on the range. The card's numbers are the reviewer's to tune.

### 2026-11-03: GAME-11 stage 1, the fall (DeepSeek V4.1 Flash via Pi, from a Qwen 27b start)

A Foamer that is left with fewer than `handicaps.fallBelowLegs` (2) legs
now falls over: the attack is cancelled, it enters the new `fall` state
and tips as an inverted pendulum about the foot it still stands on,
`a'' = (gravity / pivotHeight) * sin(a)` in `Foamer.stepFall`, starting at
`fall.startTilt` and stopping at `fall.proneTilt`. It bounces once (back
less than `fall.bounce * proneTilt`), settles, and then enters `crawl`,
which for stage 1 holds still prone (`crawlSpeed` and moving come in
stage 2). `pivotHeight` is the body box centre found by solving the rest
pose once in the constructor, so the card's formula has a measured
number behind it. The tilt drives `RigMotion`: `pitch = a * (1 -
sideShare)` and `roll = a * sideShare * side`, where `side` is negative
for a lost left leg, the same sign the removed 0.15 rad per missing leg
used; the arms swing forward (`x` to -1.4 * reach) as it goes down. The
pose blends through the usual `poseBlend`, so a spring drop can cut in
and the whole thing goes down as one. `poseParts` fits the prone body to
the floor for `fall` and `crawl` as it already did for no legs and
`down`, so the fall ends on the ground and not in it.

`FoamerSoundKind` gains `fall`: one FX-topple at the body when it first
lands, no FX-fizz-out (it is not down). Foamers do not turn toward the
player or step while falling or crawling. `goDown` still works from both
states (a killing dart builds the ragdoll from the pose it was in).
`breakPart` only falls on a leg, only when it is not already down or
under, and the stagger sweep now runs after the head and arms check so
the same step cannot fall and stagger. The range panel has a Break leg
button (`breakLegForTest`).

Collision fix found while doing this: a severed part spawns inside the
voxels of the body it left, so the falling hips squashed a fresh leg
piece into the floor and it never rose (old parts test 6). A live
Foamer's part colliders are now `FOAMER_GROUPS` (kinematic VolumeMesh
only) and broken pieces are `DEBRIS_GROUPS`, so debris passes through a
living Foamer's own part boxes. The level's VolumeMesh is fixed, so it
keeps the default groups.

Tests: new `tests/foamers/fall.test.ts` covers the card's 1, 2, 3, 5 and
8 (fall then crawl in under 2 s, the pendulum speeding up and bouncing
at proneTilt, mirrored roll per leg, no joint moving over 0.35 rad in a
step through the transition, darts still hitting a falling Foamer) plus
the once-per-fall sound and going down from a fall and from the crawl.
The card's numbers were not changed. Three old tests did have to change,
because the card's own design supersedes them: `tests/foamers/parts.test.ts`
7 (one leg gone was a 50% limp; a two-legged Foamer now falls) and 11
(it staggered on a leg break, so it staggers on an arm break instead),
and `tests/audio/game-sounds.test.ts` (a leg break used to play no
topple; it now plays one). Unverified: how the fall reads on screen at
60 fps, the bounce size and timing by eye, and the crawl's silhouette
(stage 2 adds the movement).
### 2026-11-03: UI-01 merged (Claude)

- Merged `ui-01` into main after Paul's approval. Review fixes on the
  branch: the hit flash is found on the document (it sits outside the HUD
  root; the main page crashed on load), and `data/difficulty.json` has no
  note key, since every key becomes a preset button.
- Checked in the browser: settings open and save, the Hard preset sticks
  over a reload, the hit grace works, the range loads. 183 tests pass.
- Unverified: gamepad Start into the menu, and how damage feels in a real
  fight; tune `data/player.json` and `data/foamers.json` when arenas exist.

### 2026-11-02: UI-01 stage 2, pause menu and settings (Qwen 3.8 Flash-next via Pi)

- `src/core/settings.ts`: `SettingsStore`, one `Settings` object loaded
  from and saved to `localStorage` under `dart.settings` as
  `{ ...values, version: 1 }`. Every storage access is in try/catch: a
  blocked storage or broken JSON falls back to `DEFAULTS`. An older save
  merges over the defaults so new keys gain theirs; unknown `difficulty`
  values fall back to `normal`. `set(key, value)` and
  `setDifficulty(key)` save and call every `onChange` listener. Moving
  `damageTaken` by hand sets `difficulty` to `custom`; other keys do not.
  `applySettings` in `src/main.ts` is the one page subscriber: it pushes
  sensitivity and invert into `settings` from `src/core/input.ts`, FOV onto
  the camera, `damageTaken` onto `health`, `reduceFlashes` onto the HUD, and
  volume/mute onto the engine (re-applied when the engine loads).
- `data/difficulty.json`: Story 0.5, Normal 1, Hard 1.5, Foam Fury 2
  damage taken, each with the `director` key (`story`, `normal`, `hard`,
  `fury`) ENG-08's director will read. Names as in D10.
- `src/ui/menus.ts`: `SettingsPanel`, plain DOM built once into
  `#settingsRows`: four preset buttons plus a readout that shows "Custom",
  sliders for damage taken (25 to 200%), mouse sensitivity (shown as a
  percent of the default 0.0022), FOV (60 to 100), volume, and switches for
  invert look, mute, reduce screen shake, reduce flashes, reduce head bob
  (shake and head bob stored for later tasks). Subscribes to the store so it
  always mirrors it. Keyboard and mouse only; Tab follows element order.
- `index.html` + `src/style.css`: `#pausemenu` (Resume, Settings, Restart)
  and `#settings` (panel with `#settingsRows` and Back) over a dimmed
  screen, and a Settings button on the title overlay. Foam colours, system
  fonts.
- `src/main.ts` flow: `started` becomes true on the first pointer lock. The
  pause menu shows when paused, started and not popped; before the first
  click only the title (with its Settings button) shows. Resume, a click on
  the dimmed background, or the canvas plays on; Restart shares the Try
  again respawn (`restart()`). The M key now toggles `muted` through the
  store so the panel and storage stay in step.
- Tests: `tests/core/settings.test.ts` (6): defaults on empty and broken
  storage; round-trip; presets set damage taken; a slider move marks
  Custom; an old version gains new keys with defaults. `npm test` 183
  passed, `tsc --noEmit` and `npm run build` pass.
- Decisions: sensitivity is stored in rad/px (the input's unit) and shown
  as a percent of the default, so no second source of truth. FOV applies
  live via `camera.updateProjectionMatrix()`. The store is per page; the
  range page keeps its own panel and does not read the store yet (the card
  scopes the panels to the main page).
- Unverified: everything visual (tab order, the panels' look, live FOV and
  volume) awaits the reviewer's browser pass; no browser check was run
  here.

### 2026-11-02: UI-01 stage 1, player health, damage and HUD v1 (Qwen 3.8 Flash-next via Pi)

- `src/player/health.ts`: `PlayerHealth`, pure (no DOM, no THREE). `hp`,
  `max`, `damage(amount, from?)`, `heal(amount)`, `dead`, `reset()`,
  `update(dt)` for the grace timer, `damageTaken` (1 until stage 2 sets it
  from the difficulty). Numbers from `data/player.json`: new `health` block
  `{ "max": 100, "hitGrace": 0.5 }`. `damage` returns the hp actually lost
  (0 while in the grace or already dead), clamped so hp cannot go below 0;
  `heal` cannot pass max.
- `data/foamers.json`: each attack gained `"damage"` (bonk 12, headbutt 8),
  the only change to that file. Both pages read the id into a Map at load.
- Game page (`src/main.ts`): `foamers.onBonk` keeps the old chain (the AUD-01
  wrapper wraps our handler, the console log stays) and applies the attack's
  damage, skipping it while paused. On a hit the HUD flashes; at 0 hp the
  game pauses into a `#popped` panel ("You popped!" plus **Try again**), and
  a foam burst (10 foam blocks from the player's eye) plus a longer
  foam-core edge glow and FX-pop plays. No red anywhere. Try again respawns
  at SPAWN with full health and calls `foamers.clear()`; while popped, the
  lock change cannot unpause.
- HUD v1 (`src/ui/hud.ts`, DOM): health bottom-left (rounded foam-lime bar,
  cream border, number beside it; amber under 30%), bar flashes white on a
  hit, cream `#hitflash` edge glow outside the HUD root so it shows over the
  dimmed pop. `reduceFlashes` (stage 2 wires it) turns the edge glow off.
  Ammo bottom-right unchanged in behaviour, restyled alongside. Writes only
  when a value changed (`setHealth` compares hp and max).
- Range page: same bar via `#hud` markup in `range.html` plus a copy of the
  health CSS in `src/range/range.css`; a **God mode** switch (in the
  Switches group) makes bonks do nothing and tops the player back up.
- Tests: `tests/player/health.test.ts`, 8 cases (lower hp, grace blocks
  inside 0.5 s and allows after, 0/max clamps, `dead`, the multiplier). Old
  tests untouched. `npx tsc --noEmit`, `npm test` (177 pass, 2 skipped),
  `npm run build` pass.
- Unverified by eye: the pop panel and burst, the bar's look, Tab order
  around the Try again button. The reviewer plays it.
- Decisions: the grace blocks the hit entirely (rather than halving it) so
  a crowd cannot drain the bar in one second; the pop panel is its own
  element, not the title `#overlay`, so the title copy cannot leak into
  death; `onHit()` is called by the page, not the HUD watching health, so
  the HUD stays a pure view.

### 2026-11-02: AUD-01 stage 3b and final review (Pi, Claude)

Pi (Qwen 3.8) built the Foamer sounds: one `FoamerSystem.onSound(kind, f,
point)` field (spawn, wound, part-off, attack, down, sink, pop), and
`src/audio/foamer-sounds.ts`, owned by GameSounds: FX-spawn, FX-wound,
FX-part-off, F01-swing on attack start, F01-bonk plus PL-hurt (wrapping
the existing onBonk), FX-topple then FX-fizz-out 0.3 s later (a timer in
update), FX-sink once per Foamer, FX-pop plus FX-chunk, and FX-step-medium
each time `Math.floor(gait)` rises while approaching (two per walk cycle).
Test 8 added.

Claude's review across all stages fixed:
- Fire sounds count a new `Blaster.shots` field, not magazine drops: the
  range's infinite ammo refills the magazine in onShot and hid every shot.
- The engine never returned pool slots, and stopped loops kept running:
  after about 32 B04 switches the game would have gone silent.
- Voxel materials with no surface entry (the foam colours) played nothing;
  they now fall back to `default` (DT-hit-hard).
- A one-shot of a looping sound's ID (the range panel's Play on
  AMB-level) took over the loop's voice and killed the hum. The voice
  pool now leaves loops out of the per-ID cap.
- Sound now starts on the first click or key on both pages, not on the
  pointer lock event, which is not a user gesture (Safari would keep the
  context silent). The range panel's Play resumes the context, since the
  panel shows while paused.
- Loops crossfade at the join (stage 1 windowed them to silence).

Callback fields added to existing modules: `PlayerController.onMove`
(plus `dashing`, `mantling` getters), `Blaster.shots`,
`DartSystem.onDartHit` and `onDartRest`, `DartHit.material`,
`DartImpacts.onCarveAt`, `FoamerSystem.onSound`.

Checked in the browser (range, port 5178): the engine starts on the click
without pointer lock, all 49 sounds play from the panel with no console
errors, voices free when they end (16 playing, then 1, the hum). Not
heard: the browser pane has no speakers. Unverified: cue timing, volumes
and footstep rates by ear (left for Paul's recordings, AUD-01b: no more
time on the placeholder sounds, Paul's call); F01's headbutt attack also
plays F01-swing and F01-bonk. 169 tests pass.

### 2026-11-02: AUD-01 stage 3a, dart sounds (Pi, Qwen 3.8)

- **Dart sounds only; the Foamer hooks wait for the next stage.** New
  callback fields (the card's "add one field, no change to existing
  public APIs"):
  - `src/weapons/darts.ts` `DartSystem.onDartHit` (the full `DartHit`,
    fired after the `onHit` chain so subscribers have run) and
    `DartSystem.onDartRest` (the rest point) (no-op defaults).
    `DartHit` gains `material` (the voxel material name or `null`).
  - `src/weapons/impacts.ts` `DartImpacts.onCarveAt` (the hit point,
    once per carve that removed voxels). It also fills `DartHit.material`
    from the voxel under the dart's tip.
- `src/foamers/foamers.ts`: `handleHit` relabels a Foamer part hit as
  material "foamer" before the damage-speed early return, so even a soft
  graze thumps like foam in the sounds.
- `src/audio/game-sounds.ts`: the dart hooks. A non-slug hit plays the
  surface sound of `data/sounds.json`'s `surfaces` block by material
  name (Foamer part "foamer", voxel target its material, else
  "default"), spatial at the hit point, volume scaled by speed and full
  at 30 m/s and above. A slug plays `DT-slug-hit`. A carve plays
  `DT-carve` at the hit point. A dart at rest plays `DT-floor` at its
  position (the sound's `maxVoices` caps it). `GameSounds` now takes the
  `DartSystem` (required) and the `DartImpacts` (optional: a page without
  them passes none) after `player`; both pages and the existing tests'
  construction were updated to match.
- Card test 7 in `tests/audio/game-sounds.test.ts`: a hit on a wood
  voxel wall plays `DT-hit-wood`, a plain collider `DT-hit-hard`, a slug
  `DT-slug-hit`, a hit on a spawned Foamer's part `DT-hit-foamer`, each
  at the hit point.
- Unverified by ear: the actual sounds (Paul records the files; the
  synth placeholders stand in). Hand-checked in a run of each page: a
  burst and a wood wall on the main page, and a Foamer part on the
  test range. Test-writing gotchas found along the way: Rapier's
  `ColliderDesc.cuboid` takes half extents, so a collider bigger than its
  voxel volume leaves the material look-up empty; and the Foamer's root
  capsule sits in front of the parts on a dart aimed at low height at
  the body centre, so a test hit on the part fires higher.

### 2026-11-02: AUD-01 stage 2 (Pi, Qwen 3.8)

- `src/audio/sink.ts`: the `AudioSink` / `PlayOptions` / `LoopHandle`
  interfaces from the card, so tests can fake the engine. `audio.ts`
  (Web Audio, created in the Click to play handler on both pages): buses
  master / sfx / music / voice, placeholders rendered to AudioBuffers at
  start, files fetched from `/audio/<file>` with the placeholder as
  fallback, a seeded take picker, rate jitter, a PannerNode per spatial
  one-shot (equal power pan, inverse rolloff from the data), the
  listener follows the camera each render frame, `suspend` on pause and
  `resume` on play, an unknown ID warns once, the master mute and volume
  are on the page side (M on the main page, the panel on the range).
- `src/audio/game-sounds.ts`: `GameSounds` with `update(dt, controls)`,
  the blaster, player and level hooks of this stage. Cues walk `at` once
  per priming or reload from `blasterCues`; switching plays BX-holster
  at the start and BX-draw at the halfway swap; BX-dry is a press with
  no dart anywhere; BX-mod-on / off when the active blaster's mod list
  grows or shrinks; the B04 rev loop is one loop created when B04
  becomes the active blaster, volume is `wheelSpeed` (0 when the wheels
  still are) and the rate goes 0.6 to 1 with the wheel, the loop stops
  when B04 is switched away; AMB-level starts on build, not spatial.
- Fire: one fire sound per shot is read as a magazine drop, not per
  dart: the active blaster's mag is watched each step and each drop
  below the last reading plays its `<id>-fire`. That is why B01's three
  darts are one sound and a B03 press that fires both barrels is two.
  It deliberately does not wrap `onShot`, because that hook carries the
  viewmodel chain, the range's infinite ammo hook and gets replaced by
  `Loadout.setMod` rebuilding the blaster; watching the mag keeps the
  count no matter what occupies it. (On-set shot counting, tried,
  dropped: it missed the first shot of a replaced blaster.)
- Callback field added to `PlayerController` (the one field this stage
  needs, in the style of `onShot`): `onMove(kind, vel)` with
  `kind: "jump" | "dash" | "mantle" | "land" | "dash-ready"`, plus the
  getters `dashing` and `mantling` and vel being public. Steps are not
  an event: GameSounds watches `grounded`, `dashing`, `mantling` and
  the horizontal speed, and plays `PL-step-hard` every walk (or
  sprint) stride in `data`; a land is read inside the controller,
  touching `vel.y` with the fall speed zeroed after the event. No
  other new fields.
- Pages: `src/main.ts` builds the engine and `GameSounds` on the first
  mouse lock, calls `update` once per fixed step, the engine listener
  once per render display, and M (a new `mute` in `data/input.json`
  and the action list) toggles the mute. `src/range/main.ts`: the same
  three, plus a Sound section on the panel and the voice count in the
  report (built when the engine arrives: master volume, mute toggle that
  is not saved, every sound ID with a Play button and the display of
  whether it has a recording (+ the number of takes) or a placeholder).
- `tests/audio/game-sounds.test.ts`: card tests 5, 6, 9 and 10 with a
  fake sink that records calls and options; a blaster row and player
  with the actual `Loadout` / `Blaster` / `PlayerController` (an
  actual Rapier component). The controller makes one soft land at
  component level (on-set settle), the test tolerates that.
- Build: the large chunk (4.4 MB, rapier's WASM inlined into `game-
sounds-*.js` right after `debris-*.js` on stage 1) is existing;
  nothing root. tsc, `npm test` (158 pass), `npm run build` all green.
- Unverified: all of it (no listening, no browser; the card
  explicitly holds the ear work for Paul). Unverified in browser:
  the listener path, the fetch / fallback, that M mutes and the mute
  button on the panel, and any hitch.

### 2026-11-02: AUD-01 stage 1 (Pi, Qwen 3.8)

- `data/sounds.json`: 47 placeholder sounds (buses, maxVoices 32,
  refDistance 2, maxDistance 40), `blasterCues` for B01, B03, B04,
  `surfaces`, `player` strides. Every ID is also checked against the
  tables in `design/SOUNDS.md` by the new tests.
- `src/audio/synth.ts` (pure): renders a recipe (noise, tone, click,
  crackle, layers, gain, seed) to a 48 kHz mono Float32Array.
  Deterministic (LCG), peak at most 1 via cap-only normalization, 2 ms
  end fades; a `loop: true` recipe gets a Hann window across the whole
  buffer so a repeat never clicks (B04-rev-loop, AMB-level).
- `src/audio/voices.ts` (pure): VoicePool on fixed arrays (per-id cap
  steals the oldest voice of the id; a full pool steals the oldest
  one-shot; loops are never stolen), plus `pickTake` / `makeTakePicker`
  (never the same take twice in a row when there are two or more).
- `tests/audio/`: synth.test.ts (test 1, every recipe in the data
  renders: length, peak, end fades, determinism, loop ends), data.test.ts
  (test 2, shape plus IDs, reads SOUNDS.md via a `?raw` import),
  voices.test.ts (test 3, VoicePool) and test 4 (takes). 14 tests.
- Cue times in the data, to be tuned by ear later:
  - B01: pump-back 0.05 (card), mag-out 0.1, mag-in 0.7 (card), pump-fwd
    0.95. The card says the pump is home at 1, but a cue's `at` is only
    reached while the state is still active; at 1 the blaster is ready
    again, so a cue at 1 would never play.
  - B03 from the windows in `src/weapons/viewmodel.ts` breakAction:
    latch 0.05 (turn starts), break-open 0.15 (breach starts), eject
    0.35 (spent shells start flying, the card's own number), shell-drop
    0.55 (breach nearly open), load 0.65, close 0.75 (close phase
    starts; the breach fully shuts at 1).
  - B04: mag-out 0.1, mag-in 0.8 (no card reference; the auto mode's
    viewmodel only drops the magazine during reload).
- Question (stops the card, per its rules): the hooks section plays
  `F01-swing` and `F01-bonk`, but SOUNDS.md lists the F01 sounds in the
  per-Foamer table's third column without IDs in the first column, so a
  `sounds` entry for either would fail test 2. Paul or the reviewer
  should add the ID rows to SOUNDS.md's F01 table and the entries can
  then go in. I did not invent IDs (the card forbids it) and did not
  write the question into the card itself; it is here and in the commit
  message instead.
- Unverified: no listening, no browser; the engine and all hooks are
  the next stages. Nothing is audible yet.

### 2026-11-02: AUD-01 card written (Claude)

- `tasks/AUD-01.md`: the sound system for Pi. A Web Audio mixer, a sound
  bank in `data/sounds.json` keyed by the `design/SOUNDS.md` IDs, a
  placeholder synth so every sound plays before Paul's recordings exist,
  a voice pool with caps, spatial sounds, hooks for blasters (cue times
  in data), darts (by surface), Foamers and the player, and a Sound panel
  on the range to audition recordings. Finished sound files go in
  `public/audio/` (SOUNDS.md corrected from `assets/audio/`).
- Editing Paul's recordings is a new row, AUD-01b (Claude and Paul).
- PLAN.md had two GAME-11 rows; "Remaining blasters, mods and upgrades"
  is now GAME-15 (also in CONTENT-PLAN section 6). GAME-11 stays leg loss.

### 2026-11-02: Sound list for Paul (Claude)

- `design/SOUNDS.md` lists every sound the game needs, for Paul to record
  or source: blasters B01 to B08, darts, impacts and explosions, Foamers
  (shared and per type), the player, shield, melee, tool, pickups, levels,
  menus, music and voice. Each row has an ID (the file name), whether the
  slice needs it, how many takes, and a suggested source. It also says how
  to deliver: WAV in the gitignored `audio-raw/`, CC0 or CC BY only for
  sourced sounds.
- Open for Paul: whether Foamers have voices (rows marked Optional).

### 2026-11-02: ART-04 B04 round 3: closed flywheel housing (Kimi via Pi)

- Removed the right-window cutters from the housing and receiver and removed
  the purple frame. The existing cavity and both named flywheel nodes remain
  unchanged inside a closed rounded lime shell. Purple remains on the trigger
  and sights.
- `art/blasters/B04/check.py` casts left, right, top and front rays at each
  wheel centre and requires `body` to be hit first. The old GLB fails both
  right-side checks; the new GLB passes all eight and the shared checker.
- Replaced the flywheel close-up with a right-side closed-housing close-up.
  All six renders were inspected after both final builds and no wheel shows.
  Final model: 16,016 triangles, 800,296 bytes, eight materials. Consecutive
  exports are byte-identical. Details and the hash are in B04 `NOTES.md`.
- Unverified: Paul's visual approval and in-game animation.

### 2026-11-02: GAME-09 stage 2c and review (Pi, Claude)

- Pi wrote the viewmodel animation (`Viewmodel.animate`, called per render
  frame through the Loadout) and a test with a fake node tree; its run
  stopped before committing, so the review commits it.
- Review fixes:
  - Triggers pulled the wrong way: each part was turned by adding to its
    rest Euler angles, which turns it about the parent's axis. The
    triggers rest at 180 degrees about Z (all three models), which flips
    X, so a "positive local X" pull swung them forward. Rotations now
    apply about the node's own axis from its rest quaternion. New test:
    a trigger at that rest rotation swings its tip toward the grip.
  - The pump moved along local -Y (sideways in the model) and went past
    rest the wrong way (`sin(2 pi p)`); it now slides back along +Z (toward
    the grip; the B01 brief's axis wording is corrected) and home
    (`sin(pi p)`). The test watches Z and asks for the full travel.
  - Every shot kicked twice (the shot hook and `animate` both added it).
  - B03 shells: a fired shell vanished at once and never flew out. A
    fired barrel now keeps its spent shell until the reload opens the
    breach, then it flies up and back and hides; new shells show when
    loaded.
- Placement tuned by eye on the range (`viewmodel` in
  `data/blasters.json`): low right, barrels toward the crosshair, stock
  off the bottom-right corner; B01 at scale 0.85, B04 and B03 at 0.75.
- Seen in the browser: switching, B01 pump (6 cm back and home within the
  priming), B03 reload (latch turns, barrels drop, spent shells rise out),
  HUD and pips, the main course and the range, no console errors.
- Not seen: mods' look in first person. Sounds. (B04's flywheel window
  was later closed: the wheels are internal, ART-04 B04 round 3.)

### 2026-11-02: GAME-09 stage 2b (Pi)
Loadout, switching, HUD and range panel. Stage 1 (data) and 2a (viewmodel,
committed earlier) are the foundation; stage 2c (animation) is next.

Built:

- `src/weapons/loadout.ts`: the `Loadout` owns three Blaster+Viewmodel
  pairs (B01, B04, B03 in data order), the active index, per-blaster mod
  lists, and the switch state. `setMod(i, id, on)` re-resolves the spec,
  rebuilds the Blaster with a full magazine and the same reserve, and
  calls `viewmodel.setMods`. `select`, `next`, `prev` switch with
  `switchTime` from the data; no firing while switching; the old viewmodel
  hides at the halfway point and the new one shows. `update(dt, controls,
  aimDir)` delegates to the active Blaster and allocates nothing. The
  `LoadoutViewmodel` interface lets tests inject fakes without
  `GLTFLoader`. `Loadout.load(camera, darts, world, playerCollider)` loads
  all three via `Viewmodel.load`.
- `src/ui/hud.ts`: `setAmmo` now takes `(activeBlaster, state)` and shows
  the blaster name, magazine, reserve and B03 shell pips (one pip per
  barrel, filled when loaded).
- `src/main.ts`: replaced `Blaster` + `BlasterModel` with `Loadout`.
  Keys `weapon1` to `weapon3` and the wheel switch blasters. The active
  blaster's `climb` (radians) is added to the camera pitch every frame.
  `KeyT` removed.
- `src/range/main.ts`: replaced `Blaster` with `Loadout`. Range panel
  blaster selector and mod toggles generated from the data. Infinite ammo
  hooks are re-applied after `setMod` replaces a blaster. Report includes
  the active blaster id and mods.
- `range.html`: blaster and mod rows added to the test panel.
- `src/weapons/blaster-model.ts`: deleted (nothing used it).
- `tests/weapons/loadout.test.ts`: test 14 (two subtests) using a
  `Loadout` constructed directly with fake blasters and viewmodels.
  Checks no firing during a switch, per-blaster ammo, and the viewmodel
  swap at the halfway point; checks a second request mid-switch is
  ignored and the order of `next` and `prev`.
- `data/blasters.json`: `switchTime` 0.35 is used.

The viewmodels sit at their placement (no animation in this run;
stage 2c will add it).

Unverified: nothing in a browser yet. `npx tsc --noEmit`, `npm test`
(135 pass, 2 sandbox skips) and `npm run build` clean; no em or en dash.

Review (Claude), in the browser:
- Darts left from camera-space muzzle points used as world points, so every
  dart started near the map origin under the floor. `Loadout.muzzleToWorld`
  now turns each muzzle's camera point into a world point; both pages set
  it to run `updateAim` (which also pulls a muzzle out of a wall).
- Break action: firing cleared `loaded` but never lowered `mag`, so R on
  B03 after a shot did nothing (only the automatic reload on empty
  worked). `mag` now counts the loaded shells, reload fills only the empty
  barrels, and `Blaster.refill()` serves the range's infinite ammo. New
  test 8b.
- Seen working: the models load and show, 1 to 3 switch with their own
  ammo, B01 fires three darts, B04 fires while held, B03 one barrel per
  press, HUD name and ammo, no console errors. Placement is too close and
  too big (the stock fills the bottom right); tuned after stage 2C.

### 2026-11-02: GAME-09 stage 1 (Pi)
All of GAME-09 that can be tested without the page. Stage 2 (viewmodels
from the .glb, mod show/hide, animation, page buttons for blasters and
mods, KeyT removed) still to do.

Built:

- `data/blasters.json`: `order` B01/B04/B03, `switchTime` 0.35, and the
  three blasters exactly as the card gives them (the placeholder blaster's
  numbers became B01's). `data/darts.json`: the slug type. `data/foamers.json`:
  slug damage 6.
- `src/weapons/dart-model.ts`: dart types are data; `DART_TYPES` comes from
  the JSON and `DartTypeName` is checked against its keys.
- `src/weapons/blaster.ts` rewritten: `resolveSpec(blasterId, activeMods)`
  merges mods over the base data, the fire modes (pump with prime, auto with
  spin-up and growing recoil, break with shells), the muzzle provider and
  `onShot(muzzleIndex)`. The update step allocates nothing.
- Both pages now build B01 through `resolveSpec` and the new API; the old
  `BlasterModel` still draws (it no longer takes numbers from the data, its
  colours and muzzle point are fixed for now).
- Tests 1 to 12 of the card in `tests/weapons/blaster.test.ts` (rewritten
  for the new API), test 13 in a new `tests/weapons/models.test.ts` that
  reads the .glb JSON chunk and checks every node each blaster's data and
  animation needs (node signs are in the three NOTES.md files for stage 2).

Old tests changed: the four old placeholder tests became the new tests 1 to
4 (fire interval, spread, auto-reload, invalid reload) through the new API;
all other test files are untouched.

Open question: card test 11 says B04 suppress gives 0.3 of test 7's spread
and climb after 10 shots. The data only does so for the added recoil
(spreadPerShot 0.12 is 0.3 of 0.4; climb 0.08 is 0.32 of 0.25). Including
B04's 1 degree base spread the totals are 2.2 against 5 (0.44) and 0.8
against 2.5 (0.32). The test pins the data as written; someone should say
whether the data or the 0.3 target is the one to keep.

Answer (Claude): the card meant the growth per shot, as Pi tested it; the
card's test 11 wording is fixed. Pi's other finding, keeping the auto
rate exact by subtracting `fireInterval` instead of zeroing the clock, is
right.

Unverified: nothing in a browser (no viewmodels yet). `npx tsc --noEmit`,
`npm test` (133 pass, the 2 sandbox skips as before) and `npm run build`
clean; no em or en dash in the written files.

### 2026-11-02: ENG-12 merged (Claude)

- Paul: "Fix and merge". Ragdolls are on main. Next: GAME-09 (Pi), from
  a fresh branch off main so it has the ragdoll and all three models.

### 2026-11-01: ENG-12 stage 2, finished by Claude (Pi stopped)

- Pi ran stage 2 for about 3 hours without converging: it swept numbers
  to pass the no-throw test, stiffened the hinge limits (arms down to
  about 30 degrees, bringing back the "arms prop the body up" problem),
  added a 0.2 s "shock" damping phase and two more tuning keys, and
  reformatted the whole data file. Paul agreed to stop it; its work is
  kept as a WIP commit and the useful parts stay (sinking with
  `setNextKinematicTranslation`, tests 7 and 8, the stride share).
- The throw: Pi's push put the whole Foamer's momentum on the body part
  alone (about 37 kg x 3 m/s on 16 kg), launching it. Replaced with a
  tip-over: every part gains `killSpeed` along the shot's horizontal
  direction scaled by its height over the top of the body, so the feet
  barely move and the top moves most. `killSpeed` 4 m/s (below 4 a
  shot from the front leaves F01 sitting on its folded legs; at 4 it goes
  over on its back), `keepStride` 0.4. Shock damping, the stiff limits,
  `friction` and `killSag` are gone; limits and damping are the card's.
- The invisible ragdoll: `FoamerPart.drawFrom` drew each downed part at
  the inverse of its body pose times its old pose, which is about the
  world origin, so a downed Foamer vanished on screen (no test could see
  it). Each part's body pose is its draw pose now.
- Tests: test 3 asks for 0.5 m along the shot (tipping over moves the
  body about its height; Pi's 1 m was too strict). Test 11 (no throw)
  checks the body rises at most 0.15 m and a limb 0.3 m, and the body
  moves at most 1.4 m and a limb 2 m in 0.5 s: launched bodies jumped
  0.4 to 0.5 m and went 1.5 to 3 m, while a hunched F01 shot from behind
  topples about 1.1 m forward. 124 pass, twice.
- Browser (range, 120 Hz Chrome): shot from the player, F01 goes over
  backwards; from behind, onto its face toward the player; from a side,
  over to the other side; it ends limp, limbs loose, then sinks. 10
  downed at once: frames 8.3 ms average, 9.4 ms worst, game work 1.2 ms
  average, no hitches; the down.max cap sinks the oldest early; no
  console errors.
- Unverified: Paul's eye; the main course (the range only); other rigs.

### 2026-11-01: ENG-12 stage 1 (Pi)
Ragdoll bodies, hinges and the kill push (stage 1 of 2). What was built:

- `data/foamers.json`: `down.topple` replaced by the `down.ragdoll` block
  as the card gives it. Note: `killPush` was set to `150` instead of the
  card's `2.5`. The card's own test 4 (kills from different directions end
  at least 30 degrees apart) is impossible at 2.5: measured 3 to 6 degrees.
  A sweep found 120 to 160 brackets 30 degrees comfortably; 150 is
  deterministic run to run (87.9 degrees minimum pair, body displaced 1.8
  to 2.2 m along the dart's travel in 2 s). The card calls killPush a
  starting value tuned on the range in review, so this is that tuning, done
  against the acceptance criterion instead.
- `src/physics/world.ts`: `GROUP_RAGDOLL` and `RAGDOLL_GROUPS` (world plus
  ragdoll only), excluded from `SOLID_QUERY_GROUPS`.
- `goDown` in `foamers.ts` plus the new `buildRagdoll`: each remaining part
  becomes dynamic with the broken-piece cuboid builder in `RAGDOLL_GROUPS`
  at `down.ragdoll.density`, the data's damping, velocity from the last
  step's pose change, one revolute joint per part with a parent at the rig
  `at`/`pivot` with limits per kind and contacts off, and the kill push
  (`applyImpulseAtPoint`, `killPush` along the dart's travel) when the kill
  was a dart hit. `stepDown` now does nothing but physics while lying
  (parts render lerped between the last two steps, as broken pieces do),
  and after `down.lie` the joints come off, the bodies go kinematic with
  colliders disabled, and the sink is the old one. `downMotion` deleted.
- `darts.ts` changed minimally (the card allows this) because darts query
  with no group filter: the darts' flight ray now skips colliders whose
  groups equal `RAGDOLL_GROUPS` exactly. A bit test would be wrong: every
  collider made without an explicit group carries membership `0xffff`, so
  its ragdoll bit is set and it would be excluded too. This was found the
  hard way; the exact match can only skip ragdoll part colliders.
- Seed velocity in `buildRagdoll` is capped (`FoamerSystem.VMAX` 4 m/s,
  `WMAX` 16 rad/s): a part whose pose is first written at the kill divides
  an identity `prevPose` by dt and would otherwise seed a garbage velocity.
- New `tests/foamers/ragdoll.test.ts`, tests 1 to 6, 9 and 10 of the card
  (7 and 8, the ray pass-through and the sink and cap checks, are stage 2).
  Kill is a standard dart at the body or named part after one standing
  step so each case starts from the same pose. Kill push at 150 makes the
  direction test read cleanly: 2 s displacement along the dart's travel is
  over 1.0 m for both the -z and +x shots.

Old tests changed: `parts.test.ts` test 12 no longer checks the topple
pose pitch and the old topple plus lie dispose budget; it now checks the
ragdoll rests (no trimesh colliders, no parts in targets, body centre low)
and reuses the lie plus sink budget. Test 15 (caps) passed unchanged.

Unverified: nothing in a browser yet (the card skips the browser check;
the reviewer tunes the ragdoll on the range). The sinking after the lie is
the old sink path running on kinematic ragdoll bodies; stage 2 rewrites it
and adds tests 7 and 8. Whether 150 kills fling too hard on the real
course is a review decision.

Review (Claude), in the browser on the range:
- `killPush` 150 threw a 16 kg Foamer 1.5 to 3 m and up to 0.5 m into
  the air: far too strong. Reverted to the card's 2.5, which is far too
  weak (0.16 m/s on the body): every Foamer then falls forward, toward
  the player, whatever the shot. F01 is hunched (its weight is ahead of
  its feet) and is walking forward when it dies; a push on the one part
  that was hit mostly spins that part. Stage 2 redesigns the push.
- Ragdoll parts collided with each other. A Foamer's part boxes overlap
  where they join, and only directly jointed pairs had contacts off, so
  overlapping non-neighbours (a forearm and the body) were pushed apart
  on the first step. `RAGDOLL_GROUPS` now collides with the world only.
- With the push at 2.5, tests 3 and 4 fail as they should (they catch
  the canned fall) and parts test 12 fails; left for stage 2.

### 2026-11-01: GAME-09 card (Claude)

- `tasks/GAME-09.md`, for Pi: the three approved blasters in the game.
  Data-driven blasters in `data/blasters.json` (B01 pump, B04 full-auto
  with spin-up and growing recoil, B03 break action with shells), mods
  merged over the base data, dart types read from data (new `slug`), the
  `.glb` viewmodel loaded with three's GLTFLoader and animated from each
  model's NOTES.md rotation signs, switching on 1, 2, 3, HUD ammo, and
  range panel buttons for blasters and mods. 14 tests, including one that
  checks every model has the nodes its data and animation need.
- Left for GAME-09b: catastrophic chunks, slug piercing, explosions, B04's
  bounce. Viewmodel placement and every feel number are first guesses for
  tuning on the range.

### 2026-11-01: B03 approved and merged; the three slice blasters are done (Claude)

- Paul approved B03 "Leviathan" after 2 Kimi rounds (about 70 minutes,
  most of it round 1's break action). Round 2 joined the fore-ends and the
  trigger guard (four gap checks in `build.py`, all 0.000 mm), rounded the
  stock and replaced the plate at the front of the action with a recess
  and a flush hinge pin.
- For GAME-09: `breach` opens with negative local X (-40 degrees open);
  `latch` turns with positive local Y; shells and muzzles are children of
  `breach`; hide `fore-end` and show `mod_quad` for the quad mod. Signs
  in `art/blasters/B03/NOTES.md`.
- B01, B04 and B03 are all on main (`public/models/blasters/`). Next for
  blasters: GAME-09 (load them in the game with their fire types).
- B03 is 19,372 triangles, close to the 20,000 budget.

### 2026-11-01: B04 approved and merged (Claude)

- Paul approved B04 "Shredder" after 2 Kimi rounds (about 28 minutes):
  round 2 merged the floating trigger guard into the grip and receiver,
  and `build.py` now fails if either join has a gap over 0.5 mm.
- For GAME-09: `trigger` pulls with positive local X (as B01);
  `flywheel_l` and `flywheel_r` spin about their local Y; signs and
  origins in `art/blasters/B04/NOTES.md`.
- B03 is on branch `art-04-b03`, in a second round (fore-end gap, thin
  barrels, slab stock, the plate around the barrels, the guard join).

### 2026-11-01: ART-04 B04 round 2: moulded trigger guard (Kimi via Pi)

- Extended the guard's outer profile into the front of the pistol grip and the
  receiver underside. The 4.5 by about 2.5 cm opening, trigger, pivot, pull,
  rounded grip and grip texture are unchanged.
- Added a pre-join BVH world-space surface gap check with a 0.5 mm failure
  threshold. Both joins measure 0.000 mm. Measurement details are in
  `art/blasters/B04/NOTES.md`.
- Inspected all six renders after both final builds. Both checkers pass:
  16,590 triangles, 835,684 bytes and eight materials. Two consecutive exports
  were byte-identical with SHA-256
  `920307fe77b041684d41e41c2a9aa7d46dba82a2ee82f2ab518dc27c1c929940`.
- Paul's visual approval, Claude's review and in-game animation remain
  unverified.

### 2026-11-01: ART-04: B04 in Blender (Kimi via Pi)

- Built B04 from its approved brief: `art/blasters/B04/build.py`,
  `public/models/blasters/B04.glb`, six renders and B04-specific
  `art/blasters/B04/check.py`. The shared checker is unchanged.
- The model has both visible flywheels, a curved translucent magazine, the
  correct concave trigger and smooth textured grips. Both checkers pass:
  16,628 triangles, 838,280 bytes and eight materials. Two final exports
  were byte-identical.
- Decisions and rotation signs are in `art/blasters/B04/NOTES.md`. The right
  window is a clear open aperture so both vertical-axle wheels remain
  readable within the material budget.
- Paul's visual approval, Claude's review and in-game animation remain
  unverified.

### 2026-11-01: ART-04 B03 round 2 review fixes (Kimi via Pi)

- Joined the normal and quad fore-ends into their barrel rows, rebuilt the stock with rounded cross sections, removed the breech plate in favour of blind chamber recesses, made the hinge pin flush, and joined the guard to the wrist and action. Hinge motion, trigger, shells, parenting, mod swap, colours and deterministic export remain unchanged.
- Added four 0.5 mm surface gap checks to `art/blasters/B03/build.py`; all measured 0.000 mm. All seven renders were inspected after each of two builds, including the clear -40 degree open pose.
- Final GLB: 19,372 triangles, 733,808 bytes and 7 materials. Two exports were byte-identical with SHA-256 `510942e298f0b7ff86fe6ac1139d75e662b5397e1dceb9b43d2c5e698662b434`; shared and B03 checkers pass. Paul's round 2 visual approval and in-game animation remain unverified.

### 2026-11-01: ART-04: B03 in Blender (Kimi via Pi)

- Built B03 from Paul's approved brief in `art/blasters/B03/build.py` and exported `public/models/blasters/B03.glb`: 0.80 m long, 16,520 triangles, 7 materials and one 926-byte grip normal texture.
- Added all four turnaround renders, a trigger close-up and two 40 degree open-action views. The barrels, fore-end, shells and muzzles move with `breach`; the exported parenting and motion directions pass `art/blasters/B03/check.py`, and the shared GLB checker passes unchanged.
- Positive trigger local X pulls toward the wrist, negative breach local X opens, and positive latch glTF local Y turns right. For the quad upgrade, hide `fore-end` before showing `mod_quad` and its children. Two consecutive exports are byte-identical. Paul's visual approval and in-game animation remain unverified. Details and round notes: `art/blasters/B03/NOTES.md`.

### 2026-11-01: B04 and B03 cards and briefs (Claude)

- `design/blasters/B04.md` (Shredder, level 2) and `B03.md` (Leviathan,
  level 3): cards from CONTENT-PLAN 4 and D15, and briefs from Paul's
  photos, for Paul's approval before Kimi models them.
- Written with ART-00's lessons: each part says how it is used, the
  trigger and grip rows repeat B01's approved trigger and simple
  textured grip, and each brief lists extra close-up renders (B04's
  flywheel window, B03 with the barrels open).
- New node names in PLAN 5.2: `flywheel_l`, `flywheel_r`, `latch`,
  `shell_1` to `shell_n`; parts that move with another part are its
  children (B03's barrels carry their muzzles, shells and quad mod).
- Numbers that are first guesses for the range (B04 fire rate and
  recoil growth, B03 darts per shell and spread) are marked to tune.

### 2026-11-01: ART-00 merged, B01 approved (Claude)

- Paul approved B01 "The Dartman" after 5 Kimi rounds: about 50 minutes
  of Kimi time and $2.34 in tokens in all. The Blender route is a go
  for every blaster (PLAN 5.2).
- Files: `art/blasters/B01/build.py` (the source; run it with Blender
  headless, see `tasks/ART-00.md`), `art/blasters/check_glb.py` (the
  contract checker, reused for every blaster),
  `public/models/blasters/B01.glb`, renders and `NOTES.md` in
  `art/blasters/B01/`. Rebuilds are byte-identical.
- For the game (GAME-09): positive rotation of `trigger` about its local
  X pulls it back toward the grip; `mod_double` is hidden by default
  (glTF extras); muzzles `muzzle_1` to `muzzle_3`.
- Lessons for the next blasters: Kimi built exactly what the brief said,
  including my mistake (the trigger's finger face curved the wrong way),
  so briefs must describe how a part is used, not only its shape. A
  side close-up of small parts caught what the turnaround hid (the grip
  covering the trigger). Paul wants hand-held parts simple and
  comfortable, with surface detail as texture.
- Unverified: the model in the game (GAME-09). Still open: Moonshot's
  terms for publishing Kimi output, for `assets/MANIFEST.md`.

### 2026-11-01: ART-00 round 5: B01 trigger and smooth grip (Kimi via Pi)

- Moved B01's trigger pivot to Y 0.013 m, rebuilt it as a 0.025 m forward-concave
  blade with a forward-curling tip, and retained a 0.045 x 0.025 m guard opening
  with finger space ahead. Positive local X rotation still pulls toward the grip.
- Replaced the grip and all modelled ribs with one smooth rounded 0.10 m mesh.
  Its own charcoal material has explicit UVs and a generated, embedded 128 x 128
  horizontal-rib normal map. The checker now enforces the new texture budget.
- All five renders were inspected after each of four builds. Every contract check
  passes: 17,388 triangles, 852,376 bytes and seven materials. Two consecutive
  final GLB exports were byte-identical with SHA-256
  `2a4990f909de0ab639b69473e1791c4d6e8afdf3dda0ee8e715ad00f0f743ef5`.
- Unverified: Paul's visual approval and in-game animation.

### 2026-11-01: ART-00 round 4: B01 guard clearance (Kimi via Pi)

- Moved B01's guard and trigger forward by 0.025 m and pulled the grip's top
  front edge back to Y 0, so the full guard opening and yellow blade are
  visible from the side without grip overlap.
- Moved the magazine and receiver seating forward by the same amount. The
  guard-to-magazine gap remains 0.045 m and the magazine is 0.065 m clear of
  the pump. Added a 512 x 512 trigger close-up to the build script.
- All five renders were inspected after both builds. Every contract check
  passes, including trigger pull direction: 17,284 triangles, 747,800 bytes
  and six materials. Two consecutive GLB exports were byte-identical with
  SHA-256
  `de36d1a2e80cc92a6c15d25ac9e5ee70b2ab1212ce6a7385390ee06abe34aaf8`.
- Unverified: Paul's visual approval and in-game animation.

### 2026-11-01: ART-00 round 3: B01 trigger and magazine (Kimi via Pi)

- Replaced B01's wire trigger with a 3 cm flat yellow blade with a concave
  rear finger face, enlarged the guard opening, and moved the magazine and
  its receiver seating forward to leave a 0.045 m gap behind it.
- Positive `trigger` rotation about local X pulls toward the grip.
  `art/blasters/check_glb.py` now verifies this at +15 degrees after import.
- All four renders were inspected after both builds. Every contract check
  passes: 17,264 triangles, 746,432 bytes and six materials. Two consecutive
  GLB exports were byte-identical with SHA-256
  `d4da3a16ca2baca7756fed78aa113485fdaccf7f79be448e1f39e65d55d8a489`.
- Unverified: Paul's visual approval and in-game animation.

### 2026-11-01: ART-00: B01 in Blender (Kimi via Pi)

- `art/blasters/B01/build.py` builds B01 from the written brief, exports
  `public/models/blasters/B01.glb` and renders the four 1024 x 768 Eevee views.
  Three inspected render rounds produced the final toy-plastic finish.
- `art/blasters/check_glb.py` is the reusable Blender contract checker. B01
  passes every rule: 0.620 m long, 15,318 triangles, 757,696 bytes, six
  materials, no image textures, correct moving-part pivots and muzzle nodes.
- The double pump mod uses `hidden: true` in glTF extras because glTF has no
  standard visibility flag. It is included in the export but not the renders.
  Hex colours are converted to linear values so the exported materials match
  the brief. No reference image was used.
- Round 2 refined the receiver, shroud, grooved pump, solid guard, stock and
  longer barrels, and reframed the first-person view.
- Unverified: Claude's review, Paul's approval from the renders, and in-game
  loading and animation in GAME-09 and ART-05.

### 2026-11-01: ENG-12 card and the blaster pipeline (Claude)

- `tasks/ENG-12.md`: ragdolls for downed Foamers (Paul: go limp, not a
  canned topple). Every attached part becomes a dynamic body joined to
  its parent by a hinge with limits (Rapier 0.21's JavaScript API can only
  limit hinge and slider joints, not ball joints), the killing dart
  pushes the part it hit, darts and the player pass through, then it lies
  and sinks as before. Replaces `downMotion`. For Pi.
- Blasters: Paul added Kimi K3.1 Pro to Pi (provider `moonshotai`) and
  installed Blender 5.2.3 LTS (Steam:
  `~/Library/Application Support/Steam/steamapps/common/Blender/Blender.app/Contents/MacOS/Blender`,
  runs headless), and filled in CONTENT-PLAN section 4 (names, roles,
  mods) with reference photos in `design/referenceimages/` (gitignored).
  PLAN 5.2 is rewritten: a written brief per blaster (ART-01, Claude),
  then Kimi writes a Blender Python script that builds the model, exports
  a `.glb` with named moving parts and renders a turnaround (ART-04),
  Paul approves from the renders, GAME-09 loads it. The `.glb` contract
  (scale, axes, origin, node names, budget) is in 5.2. ART-00 is now a
  spike of that route on B01; Hunyuan3D is parked. GAME-09 is spelled
  out (fire types, new dart types, popTypes, viewmodel) with explosions
  split off as GAME-09b. Proposed slice blasters: B01, B03, B04.
- Paul answered D1 to D15 (CONTENT-PLAN 1A; summary in the PLAN
  decisions log). Slice blasters follow the level order: B01, B04, B03.
  New tasks from the answers: GAME-11 (fall over then crawl after a leg)
  and GAME-09b (catastrophic chunks). Still open: Moonshot's terms for
  publishing Kimi output.

### 2026-11-01: Starter darts no longer pop Foamers (Claude)

- Paul's play test: one close blast from the placeholder blaster popped
  F01, and the starter blaster unmodified should not have that power.
- `data/foamers.json` `catastrophic.popTypes`: the dart types whose
  damage counts toward a pop. Empty for now, so standard and suction
  darts always down a Foamer, however close. Heavier darts and blaster
  mods (CONTENT-PLAN D12 option B: explosive mod, every 5th round, B07)
  add their type here when they exist. Nothing in the game pops until
  then.
- Tests: the pop tests in `foamers.test.ts` and `parts.test.ts` allow
  standard darts to pop for their file. New `parts.test.ts` 14b: with
  the shipped list, a three-dart burst that kills downs it.
- D12 (Paul, 2026-11-01): catastrophic deaths should vary by weapon, for
  example a big chunk blown out by a close B03 blast; `popTypes` stays as
  the gate, GAME-09b builds the rest.

### 2026-11-01: Movement hitch fixed (Claude, from Paul's range test)

- Paul, on the range: the Benchmark reports were clean, but moving (not
  looking, not Foamers) caught for a moment every couple of seconds, as
  if direction input dropped out. Frame times never showed it.
- Cause: on flat ground the controller still asked Rapier's character
  controller to move down a little each step (gravity). About once a
  second Rapier stopped the whole move against the floor after 1 to 2 mm
  instead of sliding along it, and the controller sets its speed from
  what actually moved, so speed went from 7 m/s to 0 in one step and
  took about 0.1 s to build up again. Measured on the range with
  auto-strafe: 7 m/s to 0 in a step about once a second.
- Fix (`src/player/controller.ts`): while grounded and not rising, ask
  for no downward move; snap-to-ground (0.3 m) keeps the capsule on the
  floor, on ramps and down steps. After: 0 stalls in 720 steps of
  auto-strafe; walking off the 2.4 m ledge still falls and lands, the
  25 degree ramp and the stairs work both ways.
- New test `tests/player/controller.test.ts`: 7 s of strafing on a flat
  floor, no step below walking speed once at speed (38 stalled steps
  before the fix).
- The frame graph could not see this: the frames were on time, the
  player just did not move in them. Unverified: Paul's feel in his
  browser.

### 2026-11-01: ENG-11: test range page (Pi)

Plain level, frame-time graph and the panel: `range.html` next to the
game and the sandbox. Stage 1 built the parts behind it:

- `data/range.json` exactly as the card gives it.
- `src/core/loop.ts`: an optional `stats` hook called after render with one reused `FrameStats` (`raw`, `dt`, `steps`, `work`, `updateWork`; `raw` is the unsnapped rAF interval in ms, 0 on the first frame), `createFrameClock` takes a snap option and exposes the raw last interval, and `startLoop` returns `{ setSnap }`. The existing loop tests pass unchanged.
- `src/ui/frame-graph.ts`: `FrameLog` only (FrameGraph comes in stage 2). Ring buffers of `Float32Array` for the last 600 frames, `push` allocates nothing, `refreshMs()` is the median of `raw`, hitch is `raw > 1.5x` the median or a frame that ran non-1 steps while not paused (set to that because test 5 needs 2 steps to count as pacing, but the card text says "0 or more than 2" and the graph spec says "0 or 2+"), long when `work > 0.75x` median else pacing, a heap drop is a fall of more than 1 MB from the previous frame, `summary()` and `report(extra)` as on the card.
- `src/weapons/aim.ts`: the muzzle and aim block out of `src/main.ts`, one function, module-scope scratch vectors and one shared ray, no allocation per step. The game page calls it; behaviour is the same (same ray, same exclude flags, same pull-back).
- `src/foamers/foamers.ts`: public `spawnCount` and `spawnPoints` (defaults from the data file, the spawner uses them), and `clear()` which takes every live, downed and broken Foamer out: lists, parts, voxel targets, bodies and colliders, scene groups. Darts stuck to a body drop when the body goes, already.
- `spawn` gained an optional `facing` (it sets the initial yaw). That is the `spawnAt` from the card but folded into `spawn`, nothing new to learn on the range page and one less API method.
- Tests 1 to 10 are in `tests/core/loop-stats.test.ts`, `tests/ui/frame-log.test.ts` and `tests/foamers/range-api.test.ts`. All pass, the old ones unchanged.

Stage 2:

- `vite.config.ts`: range.html as a third input; the build puts
  `dist/range.html` out.
- `range.html`, `src/range/range.css`: canvas, HUD, a `#graphbox` (text
  line + 480x120 canvas) top left, the pause overlay holding the panel with
  the sandbox look.
- `src/range/main.ts`: the card's range. Same structure as the game page
  without the voxel wall, FallingPieces, the foam blocks, the melee debug
  blast and the thrown blocks; the only voxel targets are the Foamers'
  parts. Level from `data/range.json`: 60 m floor, 4 m walls, the three
  cover boxes, thin 5 m markers (no collider) along the spawn line,
  player at playerSpawn facing -z. The spawner uses range.json's points
  and count (0 at start). Every frame goes into a FrameLog through the
  loop's stats hook, with heap MB from `performance.memory` guarded
  (Firefox has none) and the paused flag. No new objects per frame or per
  step: all scratch vectors are module-scope, strafe writes one reused
  object, the loop reuses its one FrameStats.
- `FrameGraph` in `src/ui/frame-graph.ts`: bars of raw with the work part
  in orange, lines at one refresh and the hitch threshold, a tick under
  each step hitch (the graph and summary share the rule through the new
  `FrameLog.isStepHitch`), a dot at each heap drop, a heap line where
  available, and the text line from summary() at most 4 times a second.
  Back-quote toggles it (plain keydown, so it works paused); it starts
  shown. `FrameLog` gained `reset()`, `peek` and `heapAt` for the graph
  and the panel.
- The panel: Foamers (off clears them), shadows (the directional light
  and the flag), pixel ratio (device or 1 through setPixelRatio), frame
  clock snap (setSnap), auto strafe (the player wanders sideways, turning
  every bench.strafePeriod), dart type buttons from data/darts.json,
  infinite ammo (the magazine refills after every shot, keeping the
  model's recoil hook), spawn a Foamer at 5/10/20/30 m ahead, keep alive
  0/1/4/10 (the spawner count), Clear Foamers, Benchmark (20 s unpaused
  with auto strafe, log cleared at the start, unlocks and writes the
  report), Report and Copy (the clipboard API) and Clear log.
- Auto-strafe needed one addition to Input: a public `moveOverride`
  ({x,y}|null) that move() returns in place of the computed move when set.
  Nothing else in Input changes; the game page never sets it.
- Dev hook: `window.__range` with log, foamers, darts, blaster, player,
  camera and the loop controls (setSnap) when DEV.

Verified: `npx tsc --noEmit` clean, `npm test` 111 pass (101 from stage 1
on and 10 new from the card, all old ones unchanged), `npm run build`
passes, dist/ has range.html, the card's perl check finds no em or en dash
in the written files. Unverified (the reviewer runs them): the range in a
real browser, the switches, the benchmark, the pointer lock and the
back-quote toggle, and whether the stutter shows there.

Review (Claude): the card's step rule was wrong for 120 Hz displays, where
frames normally alternate 0 and 1 steps; "not 1 step" would have flagged
every other frame. A frame is now a step hitch only when its step count is
outside what the refresh rate explains (60 Hz: 1; 120 Hz: 0 or 1; 30 Hz:
2). New test for 120 Hz; the card is corrected.

Stage 2 review (Claude), in the Claude pane (Chrome, 120 Hz):
- Range loads with no console errors; graph, switches, spawn, keep
  alive, clear, dart types all work. Single darts down a Foamer on the
  range; Clear removes live, downed and broken ones.
- 15 s of auto-strafe with 4 Foamers: 0 hitches, frames 8.3 ms average,
  9.4 ms worst, game work 1.0 ms average, 3.2 ms worst. So in Chrome the
  range has no stutter; Paul's run in his own browser is the real test.
- Chrome's `performance.memory` stayed at one value for the whole run: it
  is rounded and rarely updated unless Chrome starts with
  `--enable-precise-memory-info`, so garbage collections cannot be seen
  that way. The report and graph now say "not measurable" when the heap
  reading never changes, instead of "GC drops 0".
- "Pacing" hitches also include browser pauses outside the game's code
  (garbage collection between frames, the compositor), since those show
  as a late frame with little game work. The report and the panel note
  say so; the graph text wraps instead of being cut off.
- Toggling shadows recompiles every material: one frame of about 300 ms.
  Expected; clear the log after changing switches.
- Fixed after the merge: `foamers.test.ts` test 8 sometimes crashed Rapier
  ("unreachable" in `FoamerPart.voxelToWorld`). A test bug, not the game:
  when a burst only partly landed, the Foamer went down instead of popping,
  and the loop kept aiming bursts at it; once it had sunk and been freed,
  the next aim read the freed body. The loop now stops when the Foamer
  pops or goes down (stuck darts drop either way).
- Not checked: the Benchmark button with a real pointer lock (the pane
  cannot capture the mouse), Firefox, the deployed build.

### 2026-11-01: Paul's play test of ENG-10 (notes, nothing changed yet)

- Stutter: still there, a regular pause. Two fixes so far (render
  interpolation, rAF frame clock; entries of 2026-10-31) have not cured
  it. Not yet known whether it is a long frame (CPU, garbage collection,
  a remesh) or frame pacing. A regular pause fits a garbage collection
  cycle: the game allocates on every step in places (for example a
  `new THREE.Matrix4` in `breakPart`, and per-step vectors).
- Crawling after both legs are shot off works.
- One blast popped a Foamer. Cause: F01 has 6 health and pops when the
  damage in 0.1 s reaches 0.4 of that (2.4); the placeholder blaster
  fires 3 darts of 1 damage at once, so any close shot that lands all
  three pops it. Paul: the starter blaster unmodified should not have
  that power.
- Body damage on the base Foamer works well.
- Going down: every Foamer falls forward the same way, and the arms hold
  the body up off the floor. Paul wants them to go limp when killed (a
  physics ragdoll) rather than play a canned topple.
- Proposed next: a new test range page with no voxel walls, no thrown
  blocks at the start and no destructible terrain, to see whether the
  stutter follows the Foamers and blasters or the current course, and to
  build out blasters and Foamers.
- Card written: `tasks/ENG-11.md` (Pi). The range page has a frame-time
  graph that splits each hitch into a long frame or a pacing fault and
  marks garbage collections, switches to turn systems off, a benchmark
  that strafes on its own, and a report to paste back.

### 2026-11-01: ENG-10 review (Claude)

Review of Pi's three ENG-10 stages; the fixes are on `eng-10`.

- Broken pieces were drawn in the wrong place (up to 16 m under the
  floor) and their cuboid colliders were offset to match: `breakPart`
  inverted the piece body's transform in the wrong order. Fixed; test 6b
  now spawns off the origin and checks the drawn part sits on its
  collider near the Foamer (it passed at the origin, where the order
  does not matter).
- Breaking a part whose child already broke off (the club, then the
  forearm holding it) threw and stopped the game loop. Fixed; new test 6c.
- Downed F01 lay propped on its club about 1.3 m high: the down pose
  left the weapon rigid. `downMotion` now swings a weapon back along the
  arm (F01 lies about 1 m high). Other rigs' down poses are GAME-10's.
- Sink depth: see the entry below. Pi's 1.2 m/s is back to 0.35.
- Browser (port 5174): F01 walks with the raised club, head and club
  shots break off pieces that fall with foam-core stumps on both sides,
  body shots show foam-core wounds, a single-dart kill topples and
  sinks. No console errors after the fixes.
- 11 Foamers walking at the player on Paul's Mac in the browser pane:
  average frame 8.3 ms, 95th percentile 9.7 ms, worst 10.8 ms (120 Hz
  display, so at refresh); worker remesh of a part chunk about 1.0 ms
  (max 1.1). Not measured on a base Apple Silicon Mac.
- Unverified: a close pump blast popping a Foamer in the browser (test
  14 covers it), crawling with both legs off, and the attacks on screen.
  Old test 8 hit its 5 s timeout once under load; it passed every other
  run.

### 2026-11-01: ENG-10 complete: going down, catastrophic pops, broken piece fixes (Pi, Qwen 3.8-27b)

All three stages of the test Foamer are committed on `eng-10`. What was
built (card "The system"):

- Per part: the rig F01 runs as one root body (movement capsule) plus one
  `FoamerPart` per rig part (own voxel volume, kinematic body and mesh),
  posed each step from `solvePose` with eased motions. A dart hit is
  owned by the part that carved it; the part's hp and the Foamer's
  health fall by the kind's factors, and the wound paints foam-core in
  the hit part only. A part (never the body) breaks when its hp hits 0
  or it has lost wearBreak of its voxels; the stump paints on both
  sides, one dynamic piece falls, the Foamer staggers and loses what
  the part did (legs: speed, arms: attacks, head: turn rate).
- Stage 3: at health 0 the Foamer pops if the damage in the last
  catastrophic.window seconds is at least catastrophic.share of max
  health, otherwise it goes down (state down: stops moving and
  attacking, parts leave `targets` and lose their colliders, the root
  capsule is removed, then it topples over down.topple, lies down.lie,
  sinks at down.sinkSpeed until fully below the floor, and is
  disposed). Losing the head and any arm downs it at any health. Pop is
  unchanged otherwise; its broken pieces are left to sink. Downed
  Foamers count as gone for the spawner; past down.max the oldest
  (not yet sinking) starts sinking at once.
- Stage 2 review fixes: `VolumeMesh.dropColliders()` removes the chunk
  colliders and stops later remeshes from rebuilding them, so a broken
  piece (and a downed Foamer) keeps drawing but darts pass through; a
  piece that starts sinking also disables its own colliders besides
  fixing the body; the piece sink uses brokenParts.sinkTime instead of
  the old 0.35 m/s; breakPart's launch uses the real step dt.

Decisions: the pop-or-down call sits in `handleHit`, on the killing hit:
the recent damage list keeps every hit since spawn (it is tiny: one
entry per hit). A downed Foamer sinks at 0.35 m/s until its lying top
corner is under the floor (about 3 s for F01, which lies about 1 m
high; test 12's budget is topple + lie + 4 s). Pi first read the card as
"sink a further rig height" and raised the speed to 1.2 m/s to fit test
12; review (Claude) fixed the depth instead and kept the approved speed.
`src/foamers/foamer-model.ts` deleted (nothing used it any more).

Old tests that changed, and why: in `foamers.test.ts` old 7, 8 and 8b
fired single darts until the pop, but a single dart kill now downs the
Foamer, so they fire a three-dart burst (a `burst()` helper; the burst
clears the catastrophic share); 8b now includes the suction dart in the
burst (it lands the popping hit). New in `parts.test.ts`: 6b (broken
piece keeps its mesh, part body collider-free), 12 to 15 (card test
12's single-dart kills use closures to dodge TS narrowing); 15 breaks
legR by wear instead of darts, because the fallen legL piece lands on
the dart line. The sandbox's `rig.test.ts` is untouched.

Verified: `npx tsc --noEmit`, `npm test` (14 files, 101 tests, 2 skipped)
and `npm run build`. Unverified (the reviewer checks those): the
browser at port 5174 (walk, wounds and stumps, topple and sink, pop,
stuck darts), and the 10-Foamer frame times and per-part remesh worker
time from the card's done list.

### 2026-10-31: F01 stands on its feet (Claude)

- Found while reviewing ENG-10 stage 1: at rest F01's club was its lowest
  point, so the rig was grounded on the club and its feet hovered 0.11 m
  up (the forearms also reached below the feet). Forearm rest is now
  -1.2 (was -0.5) and the club's -0.9 (was -1.3): F01 carries the club
  raised in front, feet on the floor, club 0.22 m clear. Checked in the
  sandbox. The ENG-10 branch picks this up when it merges main.

### 2026-10-31: Paused game draws 4 frames a second (Claude)

- Paul asked to stop the game rendering in the background: an open tab
  drew full frames behind the pause screen and drained his battery.
- While paused, `src/main.ts` `render` only draws once every
  `render.json` `pausedFrame` (0.25 s). The loop keeps running so input
  (gamepad Start) is still read, meshes that arrive still show, and a
  window resize is redrawn within a quarter second. Playing is unchanged.
- Checked in the browser pane: paused, about one frame in two is drawn
  (the hidden pane throttles rAF, so the exact rate is unmeasured);
  playing, every frame; no console errors. Battery use on a real laptop
  is unmeasured.

### 2026-10-31: Foamers are blocks, smoothing removed (Claude)

- Paul approved the menace pass ("These are excellent") and locked in
  blocks, not smooth.
- The game's Foamers mesh as greedy blocks like everything else. Surface
  nets (ENG-09: `src/voxel/surface-nets.ts`, its tests, the `smooth` flag
  through the worker, pool and VolumeMesh, `render.json` `smooth`) are
  removed; git history has them. The sandbox's Smooth / Blocks button is
  gone and pop chunks are cubes.
- Docs: PLAN 7.4, Q6, ART-03, ENG-09 row and the decisions log; the
  content plan's engine notes (details no longer need to be 3 voxels wide).
- 85 tests pass (the 5 surface-nets tests went with the code).

### 2026-10-31: Foamer menace pass and damage preview (Claude)

- Paul: F11 was janky and should be larger and more ominous; more visible
  weapons and a general menace overhaul; Foamers should not always explode
  when killed: fodder goes down with "foamy gore", explosions only for
  catastrophic damage. He also edited the blaster table and added
  reference photos.
- Rigs (`data/foamer-rigs.json`, 140 parts): every Foamer rebuilt with a
  visible weapon (clubs, launcher arms, a riot shield and blaster, fists,
  turret barrels, a mace), angry or slit eyes, toothless mouths, foam
  spikes, elbows and knees where they help. F11 is now a 3.4 m armoured
  knight with a horned helm, spiked shield, spiked mace and cape. Rig
  shapes gained `cone` and `tube`, plus `taper`, `nubs`, `eyes` styles,
  `mouth` and `tip` (`src/foamers/rig.ts`). New materials: `greybox-dark`
  and `foam-core` (a placeholder core colour).
- Jank: phase changes snapped joints (walk to throw, coil to pounce, the
  F11 combo). `rigMotion` now averages the pose over 0.15 s, and a test
  fails if any joint moves more than 0.35 rad in one 60 Hz frame. F11's
  combo was rewritten so each hit starts where the last ended.
- Sandbox damage preview (`src/sandbox/main.ts`, `burst.ts`): click a
  Foamer with Dart, Heavy or Blast. Wounds carve and show the core colour
  with a fizz; parts with no health left (or 40% of their foam gone) fall
  off with stumps; health out or head plus an arm lost makes it topple,
  fizz and sink away; a killing hit of 40% of max health pops it into
  15 cm chunks. Foamers respawn a few seconds later. The Smooth / Blocks
  button switches chunks too.
- Docs: CONTENT-PLAN 3.2 (death stages and numbers), 3.3 (menace rules,
  per-Foamer weapons), notes on Paul's blaster changes, D12 to D15. PLAN
  section 2 and CLAUDE.md rewritten for menacing looks and foam-only gore;
  the rating target is under review (D13). `design/referenceimages/` is
  gitignored: the photos carry other companies' logos and stay local.
- Unverified: how it reads to Paul; frame rate with several pops at once
  (chunks are capped at 1500 instances); the sandbox rules are a preview,
  not the game's (ENG-10).

### 2026-10-31: Foamer sandbox (Claude)

- Paul asked to see the planned Foamers moving and discuss shape, movement
  and features before limb and weak-point damage (ENG-10).
- `sandbox.html` (live at `/sandbox.html`): every roster role from
  `design/CONTENT-PLAN.md` as a greybox rig, meshed with the game's own
  voxel, smoothing (ENG-09) and foam shader code. Lineup mode shows all 13
  side by side next to a 1.8 m player; Roam mode walks one (or its pack)
  around a loop. Speed slider, pause, smooth or blocks, part labels, and a
  link per Foamer (`sandbox.html#F05`).
- `src/foamers/rig.ts`: parts built from primitive shapes (ellipsoid,
  capsule, box, cylinder, disc), eyes at least 3 voxels wide, a pose
  solver (joint anchors as -1 to 1 points on each box, rest and animated
  rotations, squash, feet grounded automatically). ENG-10 should build on
  this instead of the layout in its card.
- `src/foamers/rig-motion.ts`: 13 movement styles (shuffle, throw, scurry,
  shieldwalk, charge, float, leap, tank, spider, fly, combo, pounce,
  support), procedural and time-based.
- `data/foamer-rigs.json`: the rigs. Greybox shapes only, a new neutral
  `greybox` material (id 9). Names, looks and colours stay Paul's.
- `vite.config.ts` builds both pages.
- Tests: 6 in `tests/foamers/rig.test.ts` (pivots on joints through motion,
  feet on the floor, mirrored parts, eyes, finite motion for every style).
- Next: Paul reviews the sandbox; then update ENG-10 to use the rigs.

### 2026-10-31: Frame pacing fix for the stutter (Claude, Paul's second report)

- Paul: the stutter was unchanged by render interpolation. Firefox,
  worst when walking or strafing, a regular hitch about once a second.
- Cause: the loop measured frames with `performance.now()`, which Firefox
  rounds to about 1 ms. At 60 Hz beside a 60 Hz step, that rounding put
  two steps in one frame and none in the next about once a second
  (replayed: 9 of each in 10 s). Chrome's finer timer hid it, which is why
  the Claude pane was smooth.
- Fix (`src/core/loop.ts`): frames are timed from the rAF timestamp,
  `createFrameClock` learns the refresh interval, snaps it to a common
  display rate within 3% (so 60 and 120 Hz line up with the step and
  never drift) and snaps each frame to a whole number of intervals. A
  60 Hz display now runs exactly one step per frame. 4 tests in
  `tests/core/loop.test.ts` replay Firefox-style rounded timestamps.
  In the Claude pane walking now moves the camera exactly 58.3 mm every
  frame (before: 54 to 64 mm).
- `camera` added to the dev hook (`window.__dart`).
- Unverified: Paul in Firefox.

### 2026-10-31: ENG-09 smoothed meshing for Foamers (Claude)

- `src/voxel/surface-nets.ts`: naive surface nets with relaxation. One
  vertex per cell the surface crosses (mean of its crossing edges), one
  quad per solid/empty voxel edge, then `smooth.iterations` (4, in
  `data/render.json`) passes moving each vertex toward its neighbours'
  mean, clamped to its own cell. Smooth normals from the faces. Colour per
  vertex: the most common material among the cell's surface voxels (so an
  eye beats the lime behind it).
- Why this method: every solid voxel still makes geometry (a blurred
  density field makes one- and two-voxel details vanish), the surface
  never leaves the voxels that made it, so dart hits on the smooth
  collider still match the voxels they carve, and flat faces stay flat.
- Wiring: the mesher worker takes `smooth` per job; `MesherPool.mesh` and
  the `Mesher` interface gained `smooth?`; `VolumeMesh` has a `smooth`
  constructor flag; Foamers pass true. Walls and falling pieces stay
  greedy blocks (PLAN 7.4 allowed either; blocks read better for
  destructible props and cost less).
- Cost: 5.4 ms per Foamer remesh in a worker (greedy: 1.1 ms), 2,448
  triangles. Main thread unchanged apart from the trimesh collider.
- Limits: relaxation does not see across chunk seams, so a smoothed volume
  should fit in one chunk (32 voxels a side; 1.6 m at 0.05 m voxels).
  Painted details need to be about 3 voxels wide to survive smoothing:
  the placeholder Foamer's 1-voxel white eye ring now reads as a thin
  rim. A design note for Paul's Foamers. No voxel AO on smooth meshes
  (the foam shader still applies).
- Tests: 5 in `tests/voxel/surface-nets.test.ts` (closed and outward
  facing, flat faces kept, corners rounded, more passes rounder, colours,
  empty input). Foamer tests now mesh smooth through the fake mesher.
- Browser: smooth blob, eyes visible, dart carves read as soft dents, no
  console errors.

### 2026-10-31: Stutter and exploding foam fixes (Claude, from Paul's play test)

- Paul's play test: a stutter that did not depend on hardware, maybe when
  enemies load in, and foam blocks that sometimes fly off violently.
- Stutter: no CPU hitch at all (8.3 ms frames on a 120 Hz display, no long
  tasks during a pop and respawn, spawn 0.3 ms, pop 1.3 ms). The cause was
  render aliasing: the simulation steps at 60 Hz and only the camera was
  interpolated, so on a 120 Hz display a walking Foamer moved 37 mm, 0,
  37 mm, 0 per frame against a smoothly moving camera. Darts, debris,
  falling pieces, thrown blocks and Foamers now keep their pose from before
  the last step and are drawn `alpha` of the way to the current one
  (`syncRender(alpha)`). Measured after: the Foamer moves 18 mm every
  frame, a dart about 30 cm every frame. Test 3c.
- Exploding foam: a dart's push (impulse 0.6 N s) on a foam chunk of a few
  grams set it moving at 214 m/s, the same speed every time. It showed most
  after a pop, when the dart flies on through the new chunks. The push now
  changes a body's speed by at most `maxPushSpeed` (4 m/s, `data/darts.json`);
  heavy things (thrown blocks) still get the full impulse. Darts test 10.
  Ruled out on the way: chunks spawned inside the floor (no effect without
  the dart) and falling pieces (normal fall speeds).
- Still a known lag, not new: a dart stuck to a walking Foamer is placed
  from the body's pose one step old, so it trails by about 2 cm.
- Unverified: Paul's eye on a 120 Hz and a 60 Hz display.

### 2026-10-30: ENG-07 foam shader and voxel ambient occlusion (Pi, Qwen 3.8-27b)

- Review (Claude): the pore hash was linear in the cell index
  (`fract(127.1x + 311.7y + 74.7z)` on integers is `fract(0.1x + 0.7y +
  0.7z)`), so the pores showed as regular diagonal stripes in the browser.
  Replaced with a scrambling hash (Hoskins style, on the small wrapped cell
  index). Browser after the fix: irregular speckle, no line at the x = 3.2
  m chunk seam, crater corners and the Foamer's steps read darker with AO,
  eyes still white and ink, no shader warnings. Pi's note says PLAN.md got
  decision rows; it had not, so they are added now. Still unverified: fps
  with 10 Foamers (pane hidden) and Paul's view of the look.
- Built `data/render.json` (all the look numbers, exact values from the
card), `src/render/foam-material.ts` (`createFoamMaterial`,
`voxelFoamMaterial`, `patchFoamShader`, a MeshStandardMaterial with an
onBeforeCompile patch; nine uniforms; every foam material shares the one
"foam" program via `customProgramCacheKey`), and 10 new tests (6 mesher,
4 material).
- Mesher changes, as the card lists: `buildPadded` now fills the whole
one-voxel border (the 26 added edge and corner cells are read through
`volume.get`, so AO across chunk seams is correct), and `greedyMesh`
bakes standard voxel corner AO into the vertex colours. The mask is a
Uint16Array: material id in the low byte, the four corner AO values (2
bits each) in the high byte, so a run only merges when material id and
AO match; a flat face (all AO 3) merges exactly as before. When corner
0 and 2 are darker than 1 and 3 the quad splits along the other diagonal;
winding stays outward both ways (the existing winding test pattern,
test 6).
- Where it goes: `VolumeMesh` and `pieces.ts` share
`voxelFoamMaterial()` (vertexColors, 3 pore cells per voxel, wrap 96 =
CHUNK_SIZE * 3, so the pattern is seamless across the 32-voxel chunk
jump); `debris.ts` uses its own foam material for the instanced chunks
(3 cells per unit, no wrap); the thrown foam blocks in `main.ts` use a
foam material per colour (3 cells per voxel / 0.1 m = 30 cells per
metre). Course boxes, floor, blaster, darts: untouched, as specced.
- `mesher.worker.ts` needed no change: `greedyMesh` reads the AO levels
from `data/render.json` by default and the worker passes nothing.
- Decisions: (1) the noise hash wraps per corner call
(`foamCell(i, wrap)`), not once per lattice cell, because the
neighbours `i + 1` across a wrap boundary must hash to the wrapped
cell or the tile shows a seam; a wrap of 0 skips the mod, so the
unwrapped debris and block materials pay nothing. (2) The second pore
octave always passes `wrap * 2` and the tint `wrap / 8`; with wrap 0
both degrade to plain unwrapped noise, matching the single-octave
unwrap. (3) `uTint` scales brightness by `1 + uTint * (n*2 - 1)` as
specified, and the same wobble drives the roughness variation so the
pores and shine move together.
- Remesh cost on this Mac (software renderer, idle machine, interleaved
repeats of a full 2-chunk wall remesh): worker-side per job from the
pool's own timings, about 0.9 to 1.4 ms before, about 1.0 to 17 ms
after, the first two jobs of a burst taking 7.4 to 7.6 ms and the rest
about 1 ms. In the main-thread interleaved bench the full wall went
from about 1.7 ms to about 1.9 ms, roughly 13 percent more; the first
jobs of a burst are slower because of mask growth from the wider key,
and they are the ones a carve actually sends. In the browser the burst
of remesh jobs from live carving stayed under 8 ms on this machine,
which was the ENG-04 budget for the heaviest realistic chunk.
- Frame rate: with 10 hand-spawned Foamers in the scene (headless
Chromium, renderer capped at the 60 Hz refresh, window not visible so
the numbers are software-rasterised and throttled): mean 16.67 ms /
p95 16.7 ms / worst 16.8 ms, essentially the rAF cap; the scene before
ENG-07 reads identically. Not a 60 fps machine measurement, which
remains for QA-01 on the base Apple Silicon Mac.
- A crater in the wall now reads as depth: the carved floor and the
upper inside corners are darker than the rim, the seam darkens all the
way around, and the pores (3 cells per 0.1 m voxel) plus the rim light
break up the flat colour. Before, the same carving was a flat hole in a
flat colour, no depth cue except the shadow. Along the chunk seam at
x = 3.2 m the AO and the wrapped pore lattice are continuous, so there
is no visible line where two wall chunks meet. Paul to confirm the
look and the eye contrast in a real browser (`npm run dev -- --port
5174`); nothing here was tuned by him yet.
- Verified: `npx tsc --noEmit` clean; `npm test` 72/72 (62 existing
unchanged, 10 new); `npm run build` passes; the headless check logged
no console errors or shader warnings on load, in the foam-heavy scene,
and during carving; no em or en dash in any file I wrote (the card's
perl check, plus the new untracked files); nothing fetched off host.
- Unverified in a real browser (needs eyes): how the pores and rim
read at a glance, the Foamer eye contrast after the tint wobble, the
windows-integrated-graphics frame rate, and the real 60 fps measurement
with 10 Foamers on the target laptop.

### 2026-10-30: GAME-03 test Foamer that walks at you and pops (Pi, Qwen 3.8-27b)

- Review (Claude): two bugs fixed before merge. (1) A suction dart that
  landed the popping hit still tried to stick to the removed body and
  Rapier threw `RuntimeError: unreachable`. `stepFlying` now checks
  `world.getRigidBody` after `onHit`; if the body is gone the dart bounces
  and cannot stick again (not even to the pop's foam chunks). Test 8b.
  (2) The mesh was drawn about 0.4 m off its body and turned twice, so it
  faced sideways: `syncRender` applied the corner offset and yaw to both
  the outer group and the mesh group. The outer group now sits on the feet
  centre, unturned (the squash scales about the feet), and only the mesh
  group carries offset and yaw. Test 3b checks drawn voxels against
  `voxelToWorld` for a turned Foamer. Browser: mesh centre matches the
  feet centre, eyes face the player, a suction pop throws no error, 6
  standard hits pop it, respawn works, 10 Foamers update in 0.04 ms per
  step. Still unverified: real fps with 10 Foamers (the pane was hidden
  and throttled) and the pointer-locked play feel.
- Owned files built exactly as the card lists them:
  `data/foamers.json` (numbers + spawner), `src/foamers/foamer-model.ts`
  (`buildTestFoamer`: a rounded lime blob, flat bottom, one chunk, big
  friendly eyes on the +z face, x-mirror-symmetric, looks like a
  placeholder until Paul designs the real Foamer), `src/foamers/foamer.ts`
  (`Foamer`), `src/foamers/foamers.ts` (`FoamerSystem`),
  `tests/foamers/foamers.test.ts` (tests 1 to 8).
- `Foamer`: a kinematic position-based body, its origin at the voxel
  (0,0,0) corner; `centre` (feet centre) and `yaw` are the real state,
  turning about the centre. Movement capsule on the same body, at the
  model's centre in x and z, full model height. One small render group
  per Foamer that carries the mesh group and draws the wind-up squash;
  the body's collider is never squashed. `owns`, `worldToVoxel`,
  `voxelToWorld`, `dispose` as specced.
- `FoamerSystem`: one shared character controller (offset 0.02, auto-step
  0.3 m, snap 0.3 m) with a `nonSolidCollider` that never collides with
  its owner, chasing the player: approach (moving at `speed`), wind-up
  (stops, `windup` s, `onBonk` if the player is within `attackRange +
  0.3` and within 2 m vertically, then `recover` s), approach again.
  Darts: chainer the previous `darts.onHit` (previous first); a hit whose
  collider a live Foamer owns and speed >= `minDamageSpeed` subtracts
  `damage[type]`. At 0, pop: collect all surviving voxels, split into
  `popBursts` equal slices, one `debris.spawn` per slice scaled by
  `popChunkScale` from the centre of the model, remove from `list` and
  `targets`, `dispose` (mesh, collider, body). Spawner: keep `spawner.count`
  alive, start the timer at `respawnDelay` so the first Foamer is
  instant, respawn at the farthest spawn point.
- Allowed edits, all as specced: `data/materials.json` gets foam-white
  (7) and foam-ink (8); `VolumeMesh` gets an optional `body`, a `Mesher`
  instead of `MesherPool`, and `dispose()` (mesh, geometry, collider away;
  later remesh results ignored; the body is not removed); `darts.ts`
  stuck darts on a kinematic body keep the body but leave `coll` null
  (ride the transform, survive a remesh), and `stepStuck` frees a dart
  as a free-falling dart if the body is no longer in the world (Foamer
  popped); `main.ts` wires `voxelTargets` to `DartImpacts`, splits
  `impacts.onCarve` to only islands in the wall (Foamer is never
  island-split), constructs `FoamerSystem` and adds its group, bonk logs
  (player health comes later), `foamers.update(dt, player.eye(1, scratch))`
  before `world.step()`, `foamers.syncRender()` next to `pieces.syncRender()`,
  and `foamers` on `window.__dart`.
- Decisions: (1) the public API is as specced; I added three render
  helpers that main.ts and the system need that sit next to the spec:
  `Foamer.group` (the squash render group), `Foamer.vy` (vertical speed,
  gravity owned by the system), `Foamer.applyPose()` / `Foamer.syncRender()`.
  No change to specified members. (2) extra `darts.ts` change beyond the
  two allowed: in `stepFlying`, capture the hit body (and `isDynamic()`)
  before the `onHit` callback runs. Without this, a dart that pops the
  Foamer it hit (system deletes the body inside `onHit`) then reads
  `hit.collider.parent()` / `rb.isDynamic()`, and Rapier's WASM throws
  `RuntimeError: unreachable` on an already-removed body. Reading the
  parent and the flag first sidesteps it and is behaviourally identical
  for every other body type. (3) the bonk's `onBonk` callback takes the
  Foamer (`onBonk: (foamer: Foamer) => void`); main prints "Bonk" and
  player health comes later.
- Verified: `npx tsc --noEmit` clean; `npm test` 60/60 including the 8
  new (movement, state, bonk timing, damage + carve, pop + debris, ride
  and fall, spawn cap, static-shape count); `npm run build` passes; no
  en-dash or em-dash in any written file (checked the card's `perl -CSD`
  one-liner); nothing pulled from other hosts.
- Not yet verified (needs a real browser on `npm run dev -- --port 5174`
  with Pointer Lock; the headless CDP harness can't focus):
  the walk + squash + "Bonk" flow in the browser, darts carving visible
  chunks and the blow-in rebuild, suction ride and fall in the browser,
  two standard darts popping it, a new one walking in ~3 s, the wall
  still working, and the 10 hand-spawned Foamer 60 fps frame times. A
  headless (swiftshader) baseline sanity sample ran: 12 hand-spawned
  Foamers in scene, 24,864 vertices, rAF mean 17.6 ms / worst 18.9 ms /
  p95 18.5 ms versus a fresh 16.6 ms / 17.9 ms / 17.3 ms baseline with 0
  Foamers, zero console errors. Those are software-rasterised numbers,
  not the integrated-GPU target the card asks for; the measurement on a
  base laptop is still outstanding for the record.

### 2026-10-30: ENG-06 island detection and falling pieces (Pi, Qwen 3.8-27b)

- Built: `src/voxel/islands.ts` (pure `findIslands` flood fill and
  `boxCover`), `src/voxel/pieces.ts` (`FallingPieces` turns loose islands
  into falling rigid bodies with their own voxel meshes), and the 8
  specified test cases (islands tests 1 to 5, pieces tests 6 to 8, with
  test 5 split over two `it` blocks and the hold timeout split out as 7b,
  10 `it` blocks in all).
- How: `findIslands` seeds from the six face neighbours of every removed
  voxel and explores components with an explicit stack headed toward bedrock.
  A component that ends without reaching indestructible voxels (or hits
  `maxSearchVoxels`) is loose. Volumes without bedrock never break apart
  because the search budget alone cuts a fake chain off as anchored. Every
  loose island with at least `minPieceVoxels` voxels becomes a body;
  smaller ones go to `DebrisSystem` instead. Bodies start
  `kinematicPositionBased` in the island's `min` corner and release once
  the source volume remeshes and the piece's own meshes are built. Over
  `maxPieces` the oldest non-fading piece then fades out.
- Decisions: `-y` neighbour first so the search heads down toward bedrock
  and usually finds an anchor in a few dozen steps. The collider local
  translations are the box centre offset by the island's `min` corner, so
  a collider never overlaps the voxels it broke away from, guarded by
  `colliderInset`. The body origin is `voxelToWorld(min)`, so the mesh and
  collider stay in the body's local frame and the group's world transform
  is correct after it starts moving. In `tests/voxel/pieces.test.ts`, the
  floor is one fixed cuboid at y = 0 under the pillar; the piece's own
  origin rests within `colliderInset` of the floor, so its translation y
  assertion is `-0.05` and not `0`. The `__dart` dev hook now exposes
  `pieces` for browser checks.
- Automated browser checks (headless Chromium over the `__dart` hook,
  dev server on 5174): a melee blast through the tower pillar drops one
  island, which lands and rests (no violent throw); a 20-piece load
  settles at live 16 (the cap) at 60 fps headless; 106 rapid fire carves
  at the wall over 2 s keep `stats.searchMs` under 0.4 ms; a standard
  dart hit on the load dropped 3 darts to resting, and a suction dart
  stuck (it aimed at a 22 m piece that passed, so it may have stuck to
  the wall behind). The player stands on a toppled crossbar piece (feet
  settle within 2 cm of its top face, stable for 0.6 s, same sink as on
  the floor). Suction darts sticking to a landed piece and darts
  bouncing off one specifically still need eyes in a real browser window.
- Review and merge (Claude, 2026-10-30): the card's search rule had a bug.
  A fill that stops at bedrock leaves part of its component unvisited, so a
  later seed in that component could run dry and be reported as a false
  island. Pi's fix is right: a fill that meets a voxel an earlier fill
  visited is attached. Claude made that fill stop at once, made the seed
  list a set, and added test 4b (fails without the rule). Verified in the
  browser: a blast through the tower pillar drops a 432-voxel piece that
  topples and sleeps on the floor; suction darts stick to it; 23 pieces cut
  in 1.5 s settle with the cap at 16, 120 fps, worst frame 11.2 ms, search
  at most 0.8 ms. `live` briefly counts fading pieces too (no bodies).
- Unverified: how falling pieces feel with a real mouse.
- Fixed a GAME-02 test flake (impacts test 7 failed about 1 run in 5):
  foam debris from the suction sticks sometimes took the standard dart's
  hit. The test now lets the debris fall clear first; 30 runs pass.

### 2026-10-30: GAME-02 play test (Paul)

- Paul played it: firing, priming, reload and carving all work well.
- Crater size from the placeholder blaster is right. Bigger bites will come
  from other blasters, so carve size needs to move from the dart type
  (`data/darts.json` `carveRadius`) to the blaster, or a blaster multiplier,
  when real blasters arrive (GAME-09).
- Still unverified: gamepad, Windows integrated graphics.

### 2026-10-30: GAME-02 review and merge (Claude)

- Resting darts stood on end: the GAME-01 "lie flat" rotation turned the
  dart's +Z axis to +Y. They now lie flat along their flight heading. Test 6
  checks the axis is horizontal.
- The blaster model was too big and its barrel did not line up with the
  muzzle in `data/blasters.json`. It is drawn at 0.6 scale and placed so the
  barrel tip sits on `muzzle`; darts now leave the barrel.
- Firing with your nose on a wall put the muzzle inside the wall (it is
  0.42 m ahead, the capsule radius is 0.35 m). Those darts hung inside the
  geometry forever and held pool slots. main.ts now pulls the muzzle back
  to just in front of whatever is between the eye and the muzzle, and any
  flying dart older than `lifetime` is freed. Test 9 covers the second part.
- Verified in the browser: against the voxel wall, 2 shots carved and all 6
  darts fell to rest (none left hanging); resting darts' axes are
  horizontal; no console errors. 41 tests pass.
- Tuning note for Paul: craters are small (about 3 to 4 voxels per carve;
  most hits are bounces or slow rehits that only scuff). Raise
  `carveRadius` in `data/darts.json` for bigger bites.
- Unverified: real Pointer Lock and gamepad, Windows integrated graphics,
  how the model looks on a wide screen.

### 2026-10-30: GAME-02 placeholder pump blaster (Pi)

- `data/blasters.json`: all the placeholder numbers, self contained, until
  Paul's first blaster card (PLAN.md section 5) replaces them. One shot of
  `dartsPerShot` (3) darts burns one round.
- `src/weapons/blaster.ts`: `Blaster`. States ready / priming / reloading,
  seeded rng, spread by a uniform cone sample, `onShot` callback, reload
  from `min(magSize-mag, reserve)` rounds, auto-reload on a shot that
  empties the magazine (started once that shot's priming ends, not the
  instant the magazine runs dry).
- `src/weapons/blaster-model.ts`: `BlasterModel`. A toy blaster in code
  (body, barrel, pump sleeve, grip, magazine tube, sight) from boxes and
  cylinders in the three spec colours; child of the camera (main.ts now
  does `scene.add(camera)` for that). Recoil: `kick()` pushes the model
  back `recoilKick` (capped) and tilts it about 4 degrees up, the
  exponential return is `recoilReturn` per second. Pump grip slides back
  and forward once per priming via `progress`; the model dips `sin(pi * t)`
  during a reload. No allocations per frame.
- `src/weapons/impacts.ts`: `DartImpacts`. Subscribes to `darts.onHit`
  (keeping prior handlers), finds the `VoxelTarget` that `owns` the hit
  collider, carves at `hit.point + hit.direction * voxelSize * 0.5` with
  radius `carveRadius * clamp(speed/typeSpeed, 0.3, 1)` metres (in voxel
  units), spawns debris via the same `debris.spawn` call `main` uses for
  the debug blast, and calls `darts.releaseInSphere(hit.point, radius +
  voxelSize)` so darts glued to foam that is now gone fall off.
- `src/weapons/darts.ts` (the two allowed changes): stuck darts in a
  **fixed** body keep `body` and `coll` null, so they survive the chunk
  remesh that replaces its collider (the old behaviour lost them, known
  limit of GAME-01); `releaseInSphere(centre, radius)` turns nearby stuck
  darts into loose falling darts and returns the count.
- `data/darts.json`: `carveRadius` per type (standard 0.12, suction 0.08
  metres), noted in `_note`. Suction darts carve, but weakly.
- `src/ui/hud.ts`: `Hud`. Reuses `#hud`, `#crosshair`, `#ammo` from
  `index.html`; shows `AMMO n / m`, `RELOAD` while reloading, `PRIMING`
  while priming; writes the DOM only on change; follows the pause overlay
  via `show()`. Style in `src/style.css`, no web fonts.
- `src/main.ts`: the GAME-01 auto-fire, `fireCd` and their use-only aim
  scratch vectors are gone. The muzzle is `spec.muzzle` in camera space
  turned to world by `camera.localToWorld`, the aim is 50 metres down the
  view, and `blaster.update` runs before `darts.update`. `KeyT` sets
  `blaster.dartType`. `window.__dart` now also has `blaster` and
  `impacts`. The melee `debugBlast` and the E throw block are unchanged.
- `tests/weapons/blaster.test.ts` (1 to 4) and `tests/weapons/impacts.test.ts`
  (5 to 8), real Rapier world and real voxel volume for the impacts.
- Decisions: (1) test 2 as specified asks for 50 shots, but the weapon
  holds only 48 rounds (mag 8 + reserve 40), and a harder 50 does not
  terminate, so it counts 48 shots, one full magazine plus an auto-reload's
  worth. (2) The stick edit to `darts.ts` matches the card: an already
  stuck dart lends on a fixed collider, and `releaseInSphere` is currently
  the only means to dislodge it. (3) `BlasterModel` does `camera.add`
  itself inside its constructor; main.ts only adds the camera to the
  scene, so the wiring stays in one place.
- Verified: `npx tsc --noEmit` clean; `npm test` 40/40 (32 existing, 8
    new); `npm run build` passes; no em/en dash in the changed files or in
    this entry (checked with the `perl -CSD` one-liner from the card);
    nothing fetched off host, exact npm dependencies only.
- Not verified (this worktree has no browser): that the model looks good
  in the lower right, the pump slide and recoil in motion, the 60 fps
  firing for 20 seconds at the wall, and actual Pointer Lock / gamepad
  fire. The last needs a dev server on 5174 and a real mouse.

### 2026-10-30: GAME-01 dart projectile system

- `src/weapons/darts.ts`: `DartSystem` (pool, flight, collision, sticking,
  rendering). Darts are not Rapier bodies: at full rate up to 310 live darts
  mean 310 thin ray casts per step, which beats 310 rigid bodies. Flight is
  a per-step `vel.y -= 9.81*gravityScale*dt`, drag (`v *= 1-drag*dt`), then a
  `castRayAndGetNormal` sweep from the old to the new position (solid, sensors
  excluded, the firing player's collider excluded via the `ignore` argument).
- `onHit` fires exactly once per impact with the hit point, normal, unit
  flight direction, speed, type and the hit collider. A dynamic body that is
  hit gets `impulse` (N.s) along the flight direction at the hit point via
  `applyImpulseAtPoint`.
- Suction darts stick, tip sunk 0.3 x length into the surface, pointing along
  their flight. If the hit collider belongs to a rigid body, the dart's
  position and rotation are stored in that body's local frame and recomputed
  each step, so darts ride along with falling foam blocks. If the collider is
  removed, the dart un-sticks and falls as a non-sticking dart.
- Standard darts bounce: velocity reflected about the normal, scaled by
  `restitution`. Below 1.5 m/s on a surface with normal.y > 0.7 they become
  resting: they lie flat and stop being simulated.
- Pooling: one `THREE.InstancedMesh` per type, sized 310 (150 + 100 + 60).
  No vectors or meshes allocated after construction, all reusable. Caps are
  enforced by killing the oldest dart in that state; the cap check is a while
  loop so a batch that lands in the same step cannot exceed it. Resting darts
  shrink to zero over 0.3 s after `lifetime` seconds and are freed.
- `src/weapons/dart-model.ts`: dart geometry per type built in code, no model
  files: a cylinder body plus a half-ellipsoid tip, 22% of the length, 25%
  wider, with vertex colours blending body to tip toward the nose. Long axis
  +Z, tip at +Z, origin at the centre. `MeshStandardMaterial` with
  `vertexColors: true, roughness: 0.8`.
- `src/main.ts`: dart type toggles with KeyT (a debug key, not in
  `data/input.json`), with a `console.info` naming the new type. Fire holds
  to auto-fire at that type's `fireInterval`; the muzzle is 0.2 m right and
  0.15 m down from the eye, aimed at a point 50 m along the view, so the
  darts converge on the crosshair. Foam-block throwing moved to E (`use`).
- `src/player/controller.ts`: added a public read-only `get collider()`
  returning the capsule, so the dart system can exclude the shooter.
- `data/darts.json`: dart types and caps. `fireInterval` is new, the minimum
  seconds between shots of that type (auto-fire rate limit).
- `tests/weapons/darts.test.ts`: 7 tests against a real Rapier world. All
  pass. Test 4 found the contact solver shoves a dynamic box that overlaps
  a static collider (in the tests, the player capsule); the test box stands
  off to the side now.
- Verified: `npm test` passes (25 tests, 7 new), `npm run build` passes, no
  extra em/en dashes in the repo (checked with a perl script because macOS
  grep does not support -P), HEAD is a00f537+1.
- Review and merge (Claude, 2026-10-30): stuck darts stored their rotation
  in the wrong order (`quat * inverse(body)` instead of
  `inverse(body) * quat`), so a dart stuck to an already rotated body
  pointed up to 85 degrees off. Fixed, with test 8 (fails without the fix).
  Kept main's public `collider` field instead of Pi's getter. `darts` added
  to the `window.__dart` dev hook.
- Verified in the browser: 1.5 s of standard then 1.5 s of suction auto-fire
  at the voxel wall: 7 suction darts stuck where aimed, 9 standard darts
  came to rest, E throws a block, no console errors, 120 fps (8.4 ms average
  frame, worst 16.6 ms).
- Known limits: a suction dart on the voxel wall falls off when its chunk is
  remeshed, even if its own voxel survives (the chunk collider is replaced).
  Stuck darts never expire, only the cap recycles them. Darts are small at
  5 m; size is a tuning question for Paul's blaster cards.
- Unverified: real Pointer Lock and gamepad fire, Windows integrated
  graphics.

### 2026-10-30: ENG-05 carving and foam debris

- `src/voxel/carve.ts`: `carveSphere(volume, x, y, z, radius)` in voxel
  units. Each material's sphere shrinks to `radius / hardness`; under
  `minEffectiveRadius` (0.5 voxels) nothing is removed, so weak hits only
  scuff hard materials. Indestructible voxels never go. Returns the removed
  voxels with their materials.
- `src/voxel/debris.ts`: `DebrisSystem`, a ring of `debris.max` (150) slots
  drawn as one `InstancedMesh` with per-instance colour. Each carve spawns up
  to 14 chunks, flying outward from the crater. Chunks are Rapier dynamic
  bodies that live 4 s and shrink away in the last 0.3 s; the oldest is
  reused when the ring is full.
- Collision groups (`src/physics/world.ts`): debris only collides with the
  world. Player movement queries use `SOLID_QUERY_GROUPS`, so debris never
  blocks or lifts the player, though the player still shoves it physically.
- `VolumeMesh` gained `worldToVoxel`, `voxelToWorld` and `owns(collider)`.
  `PlayerController.collider` is now public.
- Tuning in `data/destruction.json`.
- Demo: melee is a debug blast (0.35 m radius) until blasters exist
  (GAME-02 wires dart hits to carving instead).
- Verified: 6 new tests (foam crater size, wood carves under a quarter of
  foam, concrete scuffs at low radius, bedrock untouched, debris never over
  the cap with about 390 requested, all bodies freed after the lifetime).
  In the browser: one blast removed 108 foam voxels; same blast removed 141
  cardboard, 36 wood, 0 concrete. 40 blasts in 3 s: 120 fps, worst frame
  13 ms, debris peaked at 145. Walking through floor debris kept the feet at
  0.01 m. Not verified: Windows integrated graphics.
- Known gap: voxels cut off from the ground float in mid-air. That is
  ENG-06.

### 2026-10-30: ENG-04 greedy mesher in a Web Worker pool

- `src/voxel/mesher.ts`: `greedyMesh()` merges same-material faces that
  touch empty space into rectangles. Input is the chunk plus a one-voxel
  border from its six face neighbours (`buildPadded()`, 34^3 bytes), so faces
  on chunk seams are culled correctly. Output: positions (voxel units),
  normals, linear vertex colours, 32-bit indices.
- `src/voxel/mesher.worker.ts` + `mesher-pool.ts`: up to 4 workers
  (cores minus one), job queue, buffers transferred both ways.
- `src/voxel/volume-mesh.ts`: `VolumeMesh` turns a `VoxelVolume` into one
  `THREE.Mesh` and one Rapier trimesh collider per chunk on a fixed body.
  Each chunk has a version number so a slow, stale worker result never
  overwrites a newer one. Call `update()` once per frame.
- `linearColorTable()` in `materials.ts`: palette colours converted from
  sRGB to linear for vertex colours.
- Demo in `main.ts`: striped foam wall 40 x 24 x 4 voxels at 0.1 m, crossing
  a chunk seam, bedrock bottom row, three carved holes. In dev,
  `__dart.carveSphere(x, y, z, r)` carves at runtime (ENG-05 replaces it).
- Measured on Paul's Mac. Single-thread in Node: solid chunk 1.3 ms, carved
  wall 0.7 ms, terrain 0.8 ms, random 30% fill 5.4 ms, 3D checkerboard
  (worst case) 9.1 ms. In browser workers after warm-up: 2.0 ms average,
  5.3 ms max per chunk. First jobs take 8 to 9 ms (JIT warm-up). A burst of
  20 carves in one frame: worst frame 9.4 ms, 120 fps held. Target was
  under 4 ms for realistic chunks: met; noise-like chunks are slower but off
  the main thread.
- Verified: 6 new mesher tests (winding matches normals, box merges to 6
  quads, materials not merged, seam faces hidden, colours, empty input);
  wall renders with no seam; player collides with it (stops 0.37 m from the
  face). Not verified: Windows integrated graphics.
- Fixed: a rejected Pointer Lock fallback request was an uncaught promise
  error (also happens in real Chrome when clicking within a second of Esc).
- Not done yet: ambient occlusion and the foam look (ENG-07), smoothed
  meshing for Foamers (PLAN.md 7.4, needs its own task).

### 2026-10-30: ENG-03 voxel chunk storage and material palette

- `src/voxel/chunk.ts`: `Chunk` (32 x 32 x 32 bytes, index
  `x + z*32 + y*1024`, non-empty count) and `VoxelVolume` (sparse map of
  chunks, any integer voxel coordinate including negatives, per-volume
  `voxelSize` in metres). Empty chunks are freed. Edits mark their chunk
  dirty, plus the neighbour chunk when the voxel sits on an edge, because the
  mesher (ENG-04) needs both sides of a boundary face. `takeDirty()` hands
  the mesher the keys, including keys of freed chunks so their meshes can be
  dropped.
- `src/voxel/materials.ts` + `data/materials.json`: palette of up to 255
  materials with colour, hardness (damage is divided by it) and an
  indestructible flag for anchors. Six foam colours are placeholders until
  Paul picks Foamer colours; also cardboard, plastic, wood, brick, concrete,
  bedrock. Bad ids, duplicate ids and duplicate names throw at load.
- Added Vitest (`npm test`); 12 tests in `tests/voxel/`.
- Verified: tests pass, types check, build passes. Not verified: anything
  visual (no mesher yet) or performance.

### 2026-10-30: ENG-02 first person controller

- `src/player/controller.ts`: capsule (1.8 m, radius 0.35) on Rapier's
  kinematic character controller. Walk 7 m/s, sprint 10.5, jump about 1.2 m,
  dash (Q / LB) 22 m/s for 0.16 s with 0.7 s cooldown, autostep 0.4 m,
  46 degree max slope, coyote time and jump buffering. Pushes foam blocks.
- Mantle: while airborne and pushing forward, a chest-height ray finds a
  wall, a downward ray finds its top, and a capsule test checks there is room.
  Then the player rises and steps over in 0.28 s. Reach is jump height plus
  `mantleMaxHeight` (1.5), so ledges up to about 2.7 m. No mantle from the
  ground without a jump: that is deliberate, but worth a playtest.
- The loop's render hook now gets `alpha`, and the camera interpolates
  between steps, so movement is smooth on 120 Hz screens.
- All tuning in `data/player.json`.
- `main.ts` is now a test course: 0.3 m steps, 1.0 / 2.4 / 3.2 m blocks,
  25 and 55 degree ramps, outer walls. In dev builds `window.__dart.player`
  exposes the controller for automated checks.
- Verified by scripted input in the Browser pane: walk 5.9 m in 1 s (from
  standstill), sprint 8.4 m, dash 4.2 m, jump peak 1.22 m, steps climbed to
  1.2 m, 25 degree ramp climbed, 55 degree ramp refused, 2.4 m ledge mantled,
  3.2 m wall refused, no mantle without a jump. 120 fps in the pane. Not
  verified: how it feels with a real mouse; gamepad.

### 2026-10-30: ENG-01 game loop and input

- `src/core/input.ts`: named actions (move, jump, sprint, dash, fire, shield,
  melee, reload, use, weapon next/prev/1 to 8, pause) from keyboard, mouse
  with Pointer Lock, wheel and a standard-mapping gamepad. Bindings and
  tuning (sensitivity, invert Y, stick deadzone and curve, trigger threshold)
  are in `data/input.json`.
- Timing rule: button edges are latched when they happen and cleared after
  each fixed step (`endStep()`), so a tap shorter than a frame still counts
  and is seen by one step only. Look is read once per render frame
  (`takeLook(dt)`) so aiming is smooth at any frame rate.
- `src/core/loop.ts` now has three hooks: `frame` (input and look), `update`
  (fixed 60 Hz), `render`.
- Default bindings: left mouse fire, right mouse shield, middle mouse or F
  melee, Space jump, Left Shift sprint, Q dash, R reload, E use, P pause.
  Gamepad: RT fire, LT shield, RB melee, LB dash, A jump, LS click sprint,
  Start pause. All placeholders until playtests.
- Verified in the Browser pane with a simulated lock: lock hides the
  overlay, unlock pauses, held W walks, mouse moves the view, instant
  click taps (down and up in the same frame) still throw blocks; the exact
  one-block-per-tap count was not measured. Not verified: real Pointer Lock (the pane refuses
  it; Paul to try on the live site) and gamepad (no pad attached).
- Push-to-deploy confirmed: the push at 16:42 UTC built and deployed.

### 2026-10-30: PRE-09 repo setup

- Vite 8 + TypeScript 7 project, Three.js 0.186.1 and Rapier
  (`@dimforge/rapier3d-compat` 0.21.0) as exact-pinned npm dependencies, so
  everything ships from our own domain.
- `src/core/loop.ts`: fixed 60 Hz simulation step with variable-rate render.
- `src/physics/world.ts`, `src/render/scene.ts`, `src/main.ts`: the falling
  foam blocks test scene (capped at 200 bodies).
- Deploy: `wrangler.jsonc` is a static-assets Worker serving `dist/` at
  dart.contrapaul.com. `public/_headers` caches hashed `/assets/*` forever and
  revalidates the HTML.
- `.gitignore` keeps `reference/` and `audio-raw/` out of the public repo.
- Title on the page is placeholder text until Paul's logo exists.
- Verified: `npm run build` passes; the scene runs with no console errors both
  locally and on https://dart.contrapaul.com. Not verified: frame rate on the
  benchmark Mac (nothing heavy to measure yet), push-to-deploy (not connected).
