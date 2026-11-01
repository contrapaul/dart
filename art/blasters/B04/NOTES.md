# ART-04 notes: B04

Start: 2026-11-01 20:25:06 CST (`date`).
End: 2026-11-01 20:47:08 CST (`date`).
Elapsed: about 22 minutes.

## Result

Built only from `design/blasters/B04.md`, with no reference images. The script
starts from an empty scene, builds the model, exports the GLB and renders the
four turnaround views plus the trigger and flywheel close-ups. All six PNGs
were inspected after every successful build.

Final export: 0.758 m long, 0.083 m wide and 0.283 m high including the
sights. Rail top to magazine bottom is 0.265 m. It has 16,628 triangles,
838,280 bytes and eight materials. The only image texture is the packed
128 x 128 grip normal map, 926 bytes. Both `art/blasters/check_glb.py` and
`art/blasters/B04/check.py` pass every rule. The shared checker was not
changed.

Two consecutive final exports were byte-identical, both with SHA-256
`bf873355e18a7c7b06b7e84c92a64504b0855f8ec355f635b181e0bd20e594f5`.

## Build and render rounds

There were six modelling rounds, followed by one unchanged reproducibility
build.

1. The first render caught the trigger blade pointing upward instead of
   hanging into the guard. The shared orange transparent material also made
   the right window too opaque for the wheels to read clearly.
2. Corrected the blade direction and removed the separate tinted window pane.
   Staggered the wheels and adjusted their close-up camera. The guard's rear
   wall still covered most of the blade, and the far wheel remained hidden.
3. Replaced the guard opening with B01's proven 4.5 by about 2.5 cm opening.
   The purple trigger then showed its concave front face and forward-curled
   tip. Moved the first-person camera back to contain the solid stock.
4. Increased the window height to keep the far wheel's top face below the
   frame from the elevated camera. It was still occluded.
5. Moved the far wheel and lowered the camera as a sight-line test. This still
   did not reveal it, so I stopped adjusting the camera and traced rays
   through the actual scene.
6. The ray trace showed that the original receiver slab still filled the
   housing and blocked the far wheel. Cut the wheel cavity and right window
   through the receiver as well as the outer housing. Restored the 4 cm
   non-overlapping wheel spacing and elevated camera. Both yellow wheels,
   purple hubs and rotated face markers are now clearly visible.

The unchanged seventh build produced the byte-identical export described
above, and all six renders were inspected again.

## Shape and material decisions

The model includes the rounded lime receiver and housing, charcoal ribbed
rail, purple notch and post sights, four long slots on each handguard side,
short barrel, orange bumper with three shallow grooves, solid stock with one
oval cut-out, rounded butt pad, smooth pistol grip, 30 degree forward-raked
foregrip, and curved translucent orange magazine with ten blue and orange
darts visible. There is no text, logo, decal or printed pattern.

The right window is a clear open aperture, 7.2 by 5 cm, rather than a separate
glass pane. This keeps both vertical-axle wheels readable and stays within the
eight-material budget. The opening is larger than the brief's approximate
6 by 4 cm so both 4 cm wheels fit the view. No other brief item was omitted.

Both hand-held grips use the generated tiling normal map on `Grip charcoal`.
Their explicit UVs are retained when the static meshes join into `body`.
Every other exported mesh has no UV layer. Colours are converted from sRGB to
linear values, all modifiers are applied, and the GLB is exported before the
45 degree wheel pose used only for the close-up.

## Motion signs for game code

Blender axes are X across, Y forward and Z up. After glTF export, local Y is
vertical and the muzzle points along negative Z.

- `trigger`: positive rotation about local X pulls the lower blade back toward
  the grip. At +15 degrees the checker measures its lowest point moving
  -0.00664 m in Blender Y. Its origin is the top pivot at
  (0, 0.013, 0.049) m in Blender coordinates.
- `flywheel_l`: positive rotation about local Y for firing. Its origin is its
  centre at (-0.006, 0.119, 0.090) m in Blender coordinates.
- `flywheel_r`: negative rotation about local Y for firing, opposite to the
  left wheel. Its origin is its centre at (0.018, 0.151, 0.090) m in Blender
  coordinates.
- `mag`: no rotation is required by the brief. For reload, translate down and
  forward: negative local Y and negative local Z in glTF coordinates. Its rest
  centre is (0, 0.150, -0.025) m in Blender coordinates.
- `muzzle_1`: static child of `body`, at the bumper's front centre. Darts leave
  along glTF negative Z.

All moving parts and `muzzle_1` are children of `body`, whose origin is the
trigger-hand grip. The flywheel close-up uses +45 degrees on the left wheel
and -45 degrees on the right wheel. The exported nodes remain at rest.

## Unverified

Paul's visual approval and Claude's review are still pending. In-game loading,
placement, recoil, spin-up and reload animation are outside ART-04.
