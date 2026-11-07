# ART-04 notes: B05 Shrike

## Round 1 (Claude Opus 5.5, 2026-11-07)

Built from `design/blasters/B05.md` (approved by Paul 2026-11-07 with
his changes: deep red, a rectangular scope) with `build.py`, run as:

    "$HOME/Library/Application Support/Steam/steamapps/common/Blender/Blender.app/Contents/MacOS/Blender" \
      --background --python art/blasters/B05/build.py

Helpers are B01's (grip, trigger, guard). Changed after looking at the
renders:
- the stock was about 18 cm tall against the brief's 14 and made the grip
  look small; its lower edge is trimmed;
- the bolt's ball knob was a UV sphere, and the export put its triangles
  in a different order on every build; it is now a heavily bevelled short
  cylinder (a rounded puck), and three builds are byte-identical.

Checks: `art/blasters/check_glb.py` passes: 6,908 triangles, 385,880
bytes, 7 materials, nodes `body`, `bolt`, `trigger`, `mag`,
`muzzle_1`. 98.9 cm long and 24 cm tall (brief: 92 and 22, the pad and
bumper add length). SHA-256 `a90ea48c0041731244994019f7addf02d7bfa03ec91eb5ec97e91d15bb82db2c`.

Not done: the bolt's lift-and-slide animation and the zoom (ART-05 and the
gameplay card), and the precision dart (gameplay). Paul approved the look on 2026-11-07.
