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
