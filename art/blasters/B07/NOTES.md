# ART-04 notes: B07 Collateral

## Round 3 (Claude Opus 5.5, 2026-11-07)

Paul's changes: reduce the barrel, remove the stock, push the drum down,
and follow the reference photo's silhouette more closely. The body now
ends in a rounded block just behind the grip, with a small rear loop on
top; a top strap runs over the drum to a post at the barrel's front with
the ladder sight on it; the drum hangs below the body, its top chamber in
line with a slim barrel (5.2 cm across, was 8); the pump handle sits near
the front. Colours, warheads and bumper as before.

Checks: `art/blasters/check_glb.py` passes: 10,624 triangles, 502,828
bytes, 6 materials, nodes `body`, `drum`, `pump`, `trigger`, `muzzle_1`.
63.3 cm long, 23 cm tall. Two builds byte-identical, SHA-256 `eb60e4f35f58b2e39163d13d018b28f7a857099f1ee6d5c2cb89c5e3cc0d2c12`.
Paul approved the look on 2026-11-07.

## Round 2 (Claude Opus 5.5, 2026-11-07)

Paul's changes after Round 1: a large cylinder drum and a handle on the
pump. The tube magazine and pump sleeve are gone; a navy drum with red
rims and a charcoal hub sits between the receiver and the launch tube,
its top chamber in line with the bore and six warheads in its front face
(node `drum`); a vertical pump handle with red ribs slides on a rod under
the launch tube (node `pump`, its origin at its bounds centre for the
contract check). The card's drum holds 6, reserve 18.

Checks: `art/blasters/check_glb.py` passes: 11,164 triangles, 523,556
bytes, 6 materials, nodes `body`, `drum`, `pump`, `trigger`, `muzzle_1`.
Two builds byte-identical, SHA-256
`33d498769649b38051fec59c0360fb6cfd970e75d69f62b1810ddfe7bcf7d128`.
Superseded by Round 3.

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
