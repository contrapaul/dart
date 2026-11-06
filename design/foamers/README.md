# Foamer turnarounds

ART-03 and GAME-10d design sheets for the roster Foamers. The source of truth is
`data/foamer-rigs.json`; these PNGs are generated assets, not separately edited
artwork.

| Foamer | Silhouette and palette |
| --- | --- |
| F01 Slowmer | Round lime body and head, purple limbs, orange right-hand club. Light foam shag over the body, rounded head nubs, big round cream eyes and a separate toothless grin. |
| F02 Roamer | Lean orange body, purple limbs, lime back satchel and an orange foam ball held at shoulder height. Angry cream eyes, a separate ink grin and a raised throwing forearm. |
| F05 Darter | One large deep-purple body and head, two stout legs, curved lime brow and chest plates fitted to the body, and an orange back weak point. Small eyes and a large toothless gape. |
| F03 Swarmer | Low purple dog body on four deep-purple legs, a lime ridge of rounded spines along the back, and an orange toothless gape under angry cream eyes. Small, fast, reads as a pack member. |
| F07 Brawler | Broad purple gorilla-stance body with a tiny head sunk in the shoulders, orange shoulder, knee and back pads, and huge lime fists with knuckle nubs ([Paul]: the look column says a foam sword, the greybox row says huge fists; the fists are kept, in the sword's colour). Angry cream eyes under a heavy brow. |
| F09 Crawler | Deep orange body on eight deep-purple voxel legs (four hips, front and back pairs), with a lime twin-barrel gun mounted on top. Angry cream eyes. The gun is its weak point and its trigger (GAME-10g). |
| F08 Trawler | Thick deep-lime body and head on two stout lime legs, a deep-purple ammo drum on the back and two deep-purple shoulder nubs (the "shields": the rig's only spike shape is a rounded nub, see HANDOFF), and two orange tube launchers under the arms. Angry cream eyes and a toothless grin. The launchers are its weak points and its wall of balls (GAME-10h). |

Each Foamer has four 512 x 512 views: `front`, `side`, `back` and
`three-quarter`. Each `sheet.png` places those views side by side at their
original size, with the Foamer name underneath.

Regenerate one rig from the repository root:

```sh
npx tsx tools/render-rig.ts F01
npx tsx tools/render-rig.ts F02
npx tsx tools/render-rig.ts F03
npx tsx tools/render-rig.ts F05
npx tsx tools/render-rig.ts F07
npx tsx tools/render-rig.ts F09
npx tsx tools/render-rig.ts F08
```

The renderer uses the real rig volumes and rest pose, material colours and
built-in Node zlib only. It adds no packages. Projected faces overlap slightly
and pixel centres are sampled explicitly, so adjacent voxel faces leave no
background cracks. A uniform face shade avoids false stripes from exposed
voxel rows.

`PartSpec.gapeScale` scales only the painted and hollowed gape, not the
collision box. `PartSpec.eyeScale` changes only eye paint. `PartSpec.shag`
adds light surface paint without changing occupied voxels; Slowmer uses it
for body shag while preserving its combat volume. `PartSpec.nubMaterial`
paints the nubs a second colour without adding voxels. `PartSpec.mouthMaterial`
paints a grin band or a gape's back wall, so a Swarmer's mouth reads orange.
