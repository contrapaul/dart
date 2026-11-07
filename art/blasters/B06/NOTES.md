# ART-04 notes: B06 The Standard

## Round 2 (Claude Opus 5.5, 2026-11-07)

Paul's changes after Round 1: the magazine turned 90 degrees, so the house
shape faces forward and the side shows a plain block; opaque lime, no darts,
no black frames on its faces; the shroud rectangular for most of its length
(square collars, round vents, a short round section at the muzzle).

Checks: `art/blasters/check_glb.py` passes: 7,772 triangles (down from
12,852), 410,112 bytes, 6 materials. 96.6 cm long, 32 cm tall, 16 cm
across the magazine. Two builds byte-identical, SHA-256 `da86408d52227d03d72266fc01a749e39e6f583ed91def1e75c3511d56e5af8f`.
Waiting for Paul's look.

## Round 1 (Claude Opus 5.5, 2026-11-07)

Built from `design/blasters/B06.md` (approved by Paul 2026-11-07 with
his changes: teal like the reference, no bipod, a chunky house-shaped
magazine) with `build.py`, run as:

    "$HOME/Library/Application Support/Steam/steamapps/common/Blender/Blender.app/Contents/MacOS/Blender" \
      --background --python art/blasters/B06/build.py

Helpers are B01's (grip, trigger, guard). The magazine is a pentagon
side-on (square walls, a roof whose peak meets the receiver), see-through
lime with six charcoal mega darts inside. Changed after looking at the
renders: a thin charcoal cross on each magazine face read like a sight's
crosshair, so it is a raised rectangular frame; the brief says so too.

Checks: `art/blasters/check_glb.py` passes: 12,852 triangles, 579,436
bytes, 6 materials, nodes `body`, `bolt` (the cocking knob),
`trigger`, `mag`, `muzzle_1`. 96.6 cm long and 32 cm tall (brief: 84
and 30, the stock and bumper add length). Two builds byte-identical,
SHA-256 `18f69ec06f09e62230b5e5e41ff716a3e1f97e71b90dc6b9a0315a445d2efb58`.

Not done: the fire kick and reload animation (ART-05), the mega dart and
the explosive rounds (gameplay). Waiting for Paul's look.
