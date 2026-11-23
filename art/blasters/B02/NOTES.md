# ART-04 notes: B02 Musketeer

## Round 2: Inkling-2-Mini's redesign replaces the model (2026-11-23)

Paul chose the BENCH-01 redesign by Inkling-2-Mini (Q8_K_XL, DGX Spark) to
replace the round 1 model. `build.py` is now that script, with its paths
pointed at `public/models/blasters/B02.glb` and these renders; `DESIGN.md`
is its brief (what is kept from `design/blasters/B02.md`, what changes).
The bake-off copy stays in `benchmarks/inkling/B02/`.

Rebuilt here with Blender 5.2.3: the GLB is byte for byte the same as the
bake-off one. `check_glb.py`: every check passes, 5,128 triangles,
26.8 cm long, 21.1 cm tall, 4.8 cm wide, 7 materials, 254 KB.

Seen in the range (Claude Opus 5.5): held in the hand with the B02 framing,
fires, slide and reload run, no console errors. Not seen: the burst and
heavy mod geometry in play, and how the wider grip sits in the hand from
every angle. The round 1 model and script are in git history.

## Round 1 (Claude Opus 5.5, 2026-11-07)

Built from `design/blasters/B02.md` (approved by Paul 2026-11-07) with
`build.py`, run as:

    "$HOME/Library/Application Support/Steam/steamapps/common/Blender/Blender.app/Contents/MacOS/Blender" \
      --background --python art/blasters/B02/build.py

The helpers (materials, bevels, profiles, the rounded textured grip, the
trigger blade and the guard) are B01's, so the grip and trigger meet the
same comfort rules. Paul dropped the flared muzzle bumper during the
build: it is a plain round orange ring.

What was changed after the first render, by eye:
- the slide ended 2 cm short of the frame; both now end at the same front;
- too much bare barrel showed and the long bumper read like a silencer;
  the barrel stub is shorter and the bumper short and fat, a toy tip.

Departures from the brief, for Paul:
- The magazine shows below the grip (a see-through lime end and a purple
  base plate) instead of through a slot in the grip's side: a slot would
  cut into the textured grip. No darts are modelled inside it.
- 26.6 cm long and 20.4 cm tall, against the brief's 28 and 17: the
  magazine end adds the height.
- No `mod_heavy` geometry: whether heavy rounds show a thicker barrel
  sleeve is still Paul's open question.

Checks: `art/blasters/check_glb.py` passes every contract check: 4,420
triangles, 230,336 bytes, 7 materials, one embedded 926 byte grip
texture, nodes `body`, `slide`, `trigger`, `mag`, `muzzle_1`. Two
consecutive exports were byte-identical, SHA-256
`d45ecc3492b2f163e884aadc43b7c23548d3866bcc6491533ab2db60515d34c1`.

Not done yet: the slide's kick is not animated (the viewmodel animates
`trigger`, `pump` and `mag` by name; `slide` needs ART-05), and the game
still shows B01's model as GAME-09c's placeholder until that card merges
and points B02 at `B02.glb`. Paul approved the look on 2026-11-07.
