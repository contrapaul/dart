# B03 build notes

## Session

- Modelled by Kimi via Pi on 2026-11-01, task ART-04.
- Start: 2026-11-01 20:25:06 CST.
- End: 2026-11-01 21:25:11 CST.
- Source: `design/blasters/B03.md` only. No reference images were opened.
- Blender: 5.2.3 LTS, background factory startup.
- Eight visual build rounds, plus reproducibility builds. Every render was inspected after every successful build.

## Files

- `build.py`: deterministic model builder, GLB exporter and render generator.
- `check.py`: B03-specific contract, dimensions, origins, parenting and motion checks.
- `public/models/blasters/B03.glb`: exported game asset, path from the repository root.
- `renders/`: four turnaround views, trigger close-up, and two open-action views.

Build and check:

```sh
"$HOME/Library/Application Support/Steam/steamapps/common/Blender/Blender.app/Contents/MacOS/Blender" --background --factory-startup --python art/blasters/B03/build.py
"$HOME/Library/Application Support/Steam/steamapps/common/Blender/Blender.app/Contents/MacOS/Blender" --background --factory-startup --python art/blasters/check_glb.py -- public/models/blasters/B03.glb
"$HOME/Library/Application Support/Steam/steamapps/common/Blender/Blender.app/Contents/MacOS/Blender" --background --factory-startup --python art/blasters/B03/check.py -- public/models/blasters/B03.glb
```

## Final asset

- True size: 0.800 m long, 0.1895 m high, 0.074 m across the barrel group.
- 16,520 triangles, 7 materials, 650,208 bytes.
- One embedded 128 x 128 grip normal texture, 926 bytes. UVs exist only on meshes using the grip material.
- SHA-256: `059ac1fb117a3dacb09c45e3a6820e54d82a7f08adaf0e19e4cb0d34f2a09d9a`.
- Two consecutive final exports were byte-identical.
- `art/blasters/check_glb.py`: PASS.
- `art/blasters/B03/check.py`: PASS.
- The shared checker was not changed. All its general rules were valid for B03.

## What changed after looking at renders

1. The first side and three-quarter views exposed a missing receiver. Two chamber cutters overlapped through its middle web. Reduced their radial clearance from 1.2 mm to 0.8 mm so the boolean channels left the receiver intact. The first open cameras also faced the muzzles, hiding the shell bases, so both open views now look from the rear side of the action.
2. The receiver, guard, panels and chambers then read correctly. The closed eye view still showed shell darts above the action. Added a purple standing breech face behind the chamber mouths.
3. The first standing breech was too low from the elevated eye view. Raised its top and moved it flush to the chamber mouths. The open pose still cleared it.
4. A few dart pixels remained at the outer side of one shell. Widened the standing breech from 50 mm to 68 mm to span both chamber mouths. Closed shells are now occluded, while both open views show all eight darts in each shell.
5. The open side and open three-quarter views confirmed the hinge read, clear action, visible shells, turned latch, and the barrels, muzzles, shells and fore-end moving together. The trigger close-up confirmed a concave forward finger face at the back of a fully open guard.
6. Independent review found that the hidden lower barrel row shared the normal fore-end's space. Split the normal fore-end into a `breach` child named `fore-end`, added lower receiver channels, and gave `mod_quad` its own lower fore-end. Temporary quad renders confirmed clear closed and 40 degree open poses.
7. The newly separate grip meshes exposed an exporter copy of the same material. Canonicalisation now merges identical materials. The first restored fore-end UV render also showed that the rib normal map was too strong.
8. Reduced grip normal strength to 0.18. The final fore-end and wrist have subtle texture, not modelled ribs.

## Reproducibility fix

The first two exports had identical JSON and vertex buffers, but the receiver's boolean-generated triangle index order changed between Blender runs. `canonicalise_glb()` rotates each triangle without changing winding so its lowest vertex index comes first, then sorts the triangles. It also merges identical exporter material copies and normalises their UV index. These steps change neither the rendered geometry nor UV coordinates. Two consecutive final builds were byte-identical.

## Game code: local rotation signs

The GLB uses +Y up and muzzles along -Z. These are local rotations on the named nodes, not world rotations.

- `trigger`: positive local X pulls the lower end back toward the wrist. The checker measured a 6.64 mm Blender Y reduction at +15 degrees. Zero is rest.
- `breach`: negative local X opens the action and drops the muzzles. Use -40 degrees for the open pose. Positive local X closes it. At -40 degrees the muzzle drops 239.89 mm and the shell rear rises 30.09 mm in Blender coordinates.
- `latch`: positive glTF local Y turns the lever to the blaster's right. This is positive local Z in the Blender build script. Use +30 degrees for the open pose. The checker measured a 25.94 mm rightward movement of the lever end.
- `shell_1` to `shell_4`: no rest rotation. Translate these locally for ejection. Shells 1 and 2 are direct children of `breach`; shells 3 and 4 are children of `mod_quad`.
- `fore-end`: visible by default and parented to `breach`. Hide this node when enabling the quad upgrade.
- `mod_quad`: hidden by default, parented to `breach`, and carries the second barrel row, its own lower fore-end, muzzles 3 and 4, and shells 3 and 4. Show this node and its children only when `fore-end` is hidden.

The exported hierarchy was checked explicitly: `breach` has only `fore-end`, `muzzle_1`, `muzzle_2`, `shell_1`, `shell_2` and `mod_quad` as its intended direct children. Both fore-end variants therefore follow the barrels during the break-action motion.

## Brief coverage and remaining verification

No approved brief item was omitted. There are no modelled ribs, text, logos, trademarks or external assets. The grip and wrist are smooth; grip ribs exist only in their small tiling normal map.

The normal model and the optional quad configuration were both inspected in closed and 40 degree open poses. Still unverified: Paul's visual approval and loading or animating the model in the game. Collision clearance was not tested through a full in-game animation.

## Round 2

- Start: 2026-11-01 21:58:02 CST.
- End: 2026-11-01 22:06:00 CST.
- Joined both fore-ends into the undersides of their barrel rows with 5 mm of designed overlap. They remain separate `fore-end` and `mod_quad` nodes under `breach`, and the quad swap is unchanged.
- Kept the two 3.4 cm barrels on 3.6 cm centres, for a 7.0 cm wide pair. Increased their radial resolution and overlapped the flat top rib so the pair, rib and bead read cleanly in side and three-quarter views.
- Rebuilt the shoulder stock as a rounded loft with a gently sloping comb and generous cross-section rounding. The 4.5 cm deep, 3.5 cm wide rounded wrist and its texture are unchanged. The rounded rubber butt pad remains.
- Removed the vertical breech plate. Blind rounded chamber recesses now seat the barrel chambers inside the action while hiding closed shells. The hinge is a 12 mm diameter short pin with small flush round ends.
- Extended the guard rear into the wrist and retained its overlap into the action underside. The trigger shape, pivot and pull direction are unchanged.
- Added B04-style BVH surface gap checks before static joining and before the moving assemblies are completed. Measured gaps: guard to wrist 0.000 mm, guard to action 0.000 mm, fore-end to barrels 0.000 mm, quad fore-end to lower barrels 0.000 mm. The build fails above 0.5 mm.
- Inspected all seven renders after each of two builds. The closed shell occlusion is clean, and the -40 degree open pose clears the action with no visible passing through.
- Final asset: 0.800 m long, 0.1895 m high and 0.074 m across the barrel group; 19,372 triangles, 7 materials and 733,808 bytes.
- SHA-256: `510942e298f0b7ff86fe6ac1139d75e662b5397e1dceb9b43d2c5e698662b434`. Two consecutive exports were byte-identical.
- `art/blasters/check_glb.py`: PASS. `art/blasters/B03/check.py`: PASS. The shared checker and B03 checker were not changed.
- Still unverified: Paul's visual approval of round 2 and loading or animating the model in the game.
