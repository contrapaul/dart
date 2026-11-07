# ART-04 notes: B07 Collateral

## Round 1 (Claude Opus 5.5, 2026-11-07)

Built from `design/blasters/B07.md` with `build.py`, on Paul's word to
proceed and his colours (navy blue with red accents); the brief itself is
waiting for his approval with the model. Run as:

    "$HOME/Library/Application Support/Steam/steamapps/common/Blender/Blender.app/Contents/MacOS/Blender" \
      --background --python art/blasters/B07/build.py

Helpers are B01's (grip, trigger, guard). A wide navy launch tube with two
red bands and an orange bumper; a tube magazine under it with a slot on
the right showing five yellow warheads (`mag`); a charcoal pump sleeve
with red ribs around its front (`pump`); a ladder sight with red rungs; a
short stock. Changed by eye: the stock was a slab as tall as the receiver
and is now slimmer, its underside sloping to the pad.

Checks: `art/blasters/check_glb.py` passes: 11,728 triangles, 523,704
bytes, 6 materials, nodes `body`, `pump`, `trigger`, `mag`,
`muzzle_1`. 79.4 cm long and 24 cm tall (brief: 72 and 22). Two builds
byte-identical, SHA-256 `5856c35456cb138d7d69cbeb50cfe4ae50731d6ea9dc39c602528e234fcd477b`.

Not done: gameplay (the launcher round, its arc, remote detonation, the
cluster), animations, and Paul's approval of the brief and the look.
