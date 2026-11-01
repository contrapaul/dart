# ART-00 notes

Start: 2026-11-01 18:31:21 CST (`date`).
End: 2026-11-01 18:47:37 CST (`date`).
Elapsed: about 16 minutes.

## Result

Built only from `design/blasters/B01.md`, with no reference images. The script
starts from an empty scene, builds the model, exports the GLB and renders all
four views. There were three build and render rounds, and all four PNGs were
inspected after every round.

Final export: 0.620 m long, 0.254 m high and 0.055 m wide; 15,318 triangles;
757,696 bytes; six materials; no image textures. `check_glb.py` passes every
rule. The magazine uses glTF alpha blend with alpha 0.45. The double pump mod
has `hidden: true` in its glTF extras and is absent from the default renders.

## Changes after looking at the renders

1. Round one was overexposed, the top and first-person views were framed too
   closely, the trigger node had a capital letter, and the model had 24,978
   triangles. Reduced tube, bevel and dart segments to reach 15,318 triangles,
   fixed the node name, rotated the top camera and moved the eye camera.
2. Round two passed every contract rule and showed all required parts, but the
   colours were still pale and the eye view needed a better aim. Adjusted the
   eye camera target and prepared a colour and lighting correction.
3. Round three converted the hex colours from sRGB to linear values and lowered
   the softbox power. The final side, three-quarter, top and first-person views
   show the intended flat toy-plastic colours and translucent magazine.

The final views show all seven originality points: three triangular barrels,
pump forend, skeletal stock, round vents, ring sight, a plain two-rib side panel
and the brief's colours. There is no text, logo, decal or pattern.

## Unverified and omitted

No brief item was omitted. Claude's review and Paul's visual approval are still
pending. In-game loading, placement and animation are outside ART-00.

## Round 2

Start: 2026-11-01 18:59:09 CST (`date`).
End: 2026-11-01 19:12:25 CST (`date`).
Elapsed: about 13 minutes.

Three refinement build and render rounds replaced the separate pump fins with
one charcoal wraparound forend with six boolean-cut grooves, lengthened the
barrels by 3 cm, added wider orange collars and a tapered shroud nose, and made
the trigger guard a solid moulded loop. The receiver gained a raised top, a
stepped and angled lower front, and a chamfered stock joint. The stock bars are
now 1.8 cm thick and the butt pad is larger and more rounded. The first-person
camera moved back and down to show the whole front half low on the right.

All four renders were inspected after each refinement round. The final views
show one grooved grip rather than a comb, a visible open guard and trigger, the
shaped receiver and nose, and all three longer barrels. The required nodes,
origins, muzzles, hidden double mod, colours and originality features remain.
The final export is 0.650 m long, 0.062 m wide and 0.266 m high, with 17,372
triangles, 741,444 bytes and six materials. `check_glb.py` passes every rule.

For reproducibility, two baseline exports had identical JSON but 11 differing
bytes in generated VEC2 UV coordinates. The flat-colour model does not use UVs,
so the script removes UV layers before export. Two consecutive final exports
were byte-identical, both with SHA-256
`39fffb24a40bf78427c2e5b7b3e4658aec7e63df264792cdff20aa75103f4da1`.
Paul's approval of the revised shapes is still pending.

## Round 3

Start: 2026-11-01 19:24:31 CST (`date`).
End: 2026-11-01 19:30:19 CST (`date`).
Elapsed: about 6 minutes.

Replaced the wire hook with a yellow flat trigger blade, 3 cm tall, 1.2 cm
deep at the top finger face and 0.8 cm thick. Its rear finger face curves
concave toward the grip. The `trigger` origin remains on the top pivot at
(0, 0.026, 0.047) m. Enlarged the guard opening so the blade is surrounded
by visible space. The existing lighting shows it clearly, so no fill light
was added.

For game code, a positive rotation of `trigger` about its local X axis pulls
it toward the grip. The node's local X points to the model's left. The new
checker rotates the imported node by +15 degrees and measures its lowest
point moving 0.00787 m toward the grip, along Blender -Y.

Moved the magazine and its receiver seating forward by 0.047 m. The `mag`
origin is now (0, 0.115, 0.005) m, still at its rest centre. The guard front
is at Y 0.040 m and the magazine back at Y 0.085 m, giving a clear 0.045 m
gap. The magazine remains seated in the receiver and clear of the pump.

All four renders were inspected after each of two builds. The side view
shows the blade and open guard clearly, and the side and three-quarter views
show the requested magazine gap. The top and first-person views retain the
same framing and all other shapes and colours are unchanged. The export is
0.650 m long, 0.062 m wide and 0.266 m high, with 17,264 triangles, 746,432
bytes and six materials. `check_glb.py` passes every rule, including the new
trigger pull-direction rule. Two consecutive exports were byte-identical,
both with SHA-256
`d4da3a16ca2baca7756fed78aa113485fdaccf7f79be448e1f39e65d55d8a489`.
Paul's visual approval and in-game animation remain unverified.
