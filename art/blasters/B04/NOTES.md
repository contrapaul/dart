# ART-04 notes: B04

## Round 3

Start: 2026-11-02 05:51:44 CST (`date`).
End: 2026-11-02 05:58:39 CST (`date`).
Elapsed: about 7 minutes.

Removed the housing and receiver right-window cutters and the purple window
frame. The enclosed wheel cavity remains, so both sides of the flywheel housing
are closed rounded lime bulges. The `flywheel_l` and `flywheel_r` nodes, origins,
materials and parenting are unchanged; they remain inside the shell for the game
to spin. The purple material still serves the trigger and sights.

`check.py` builds world-space BVH trees for `body` and each wheel. From 0.5 m
to the left, right, top and front of each wheel centre, it casts a ray toward
that centre. Each of the eight rays passes only if it hits `body` before the
wheel, or hits `body` without reaching the wheel. The Round 2 GLB failed both
right-side rays; all eight pass on the closed model.

The right-side closed-housing close-up replaces the flywheel close-up. All six
renders were inspected after each of two consecutive builds, and no wheel shows
through any gap. Both checkers pass: 16,016 triangles, 800,296 bytes, eight
materials and the same embedded 926-byte grip texture. The two exports were
byte-identical with SHA-256
`9bba7e20907d02326a80ac8a8c88cfa4b68d983b5d9f6f0331a462641d3de53f`.
An independent reviewer found no issues in the build and check changes.

Paul's visual approval and in-game animation remain unverified.

## Round 2

Start: 2026-11-01 20:55:34 CST (`date`).
End: 2026-11-01 21:01:21 CST (`date`).
Elapsed: about 6 minutes.

Extended only the guard's outer profile so its rear overlaps the front of the
pistol grip and its top overlaps the receiver underside at both ends of the
opening. The opening profile is unchanged at 4.5 cm long and about 2.5 cm tall.
The trigger, its pivot and pull, the rounded grip and its texture are unchanged.

`check_guard_joins` runs before the static meshes are joined. It builds BVH trees
from world-space mesh triangles. Intersecting triangles report a zero gap;
otherwise it measures the nearest vertex-to-surface distance in both directions.
It fails the build above 0.5 mm. Both guard-to-grip and guard-to-receiver measured
0.000 mm on both final builds.

All six renders were inspected after each successful build. The trigger close-up
shows no gap or seam at the grip, and the three-quarter view reads as one moulded
part. Both checkers pass: 16,590 triangles, 835,684 bytes, eight materials and
one embedded 926-byte grip texture. Two consecutive exports were byte-identical
with SHA-256
`920307fe77b041684d41e41c2a9aa7d46dba82a2ee82f2ab518dc27c1c929940`.
An independent reviewer found no issues in the Round 2 diff.

Paul's visual approval and in-game animation remain unverified.

Start: 2026-11-01 20:25:06 CST (`date`).
End: 2026-11-01 20:47:08 CST (`date`).
Elapsed: about 22 minutes.

## Result

Built only from `design/blasters/B04.md`, with no reference images. The script
starts from an empty scene, builds the model, exports the GLB and renders the
four turnaround views plus two close-ups. Round 2 used trigger and flywheel
close-ups; Round 3 replaced the latter with the closed-housing view. All six
PNGs were inspected after every successful build.

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
   non-overlapping wheel spacing and elevated camera. At the end of Round 2,
   both yellow wheels, purple hubs and rotated face markers were clearly visible.

The unchanged seventh build produced the byte-identical export described
above, and all six renders were inspected again.

## Shape and material decisions

The model includes the rounded lime receiver and housing, charcoal ribbed
rail, purple notch and post sights, four long slots on each handguard side,
short barrel, orange bumper with three shallow grooves, solid stock with one
oval cut-out, rounded butt pad, smooth pistol grip, 30 degree forward-raked
foregrip, and curved translucent orange magazine with ten blue and orange
darts visible. There is no text, logo, decal or printed pattern.

Round 2 used a clear open right aperture, 7.2 by 5 cm, rather than a separate
glass pane. Round 3 removed that opening and its frame to close the housing as
Paul directed. No other brief item was omitted.

Both hand-held grips use the generated tiling normal map on `Grip charcoal`.
Their explicit UVs are retained when the static meshes join into `body`.
Every other exported mesh has no UV layer. Colours are converted from sRGB to
linear values and all modifiers are applied. The wheels remain at rest in the
GLB and all Round 3 renders.

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
trigger-hand grip. All Round 3 renders and the exported nodes keep the wheels
at rest.

## Unverified

Paul's visual approval and Claude's review are still pending. In-game loading,
placement, recoil, spin-up and reload animation are outside ART-04.
