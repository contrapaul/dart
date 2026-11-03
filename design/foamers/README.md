# Foamer turnarounds

ART-03 design sheets for the first three roster Foamers. The source of truth is
`data/foamer-rigs.json`; these PNGs are generated assets, not separately edited
artwork.

| Foamer | Silhouette and palette |
| --- | --- |
| F01 Slowmer | Round lime body and head, purple limbs, orange right-hand club. Light foam shag over the body, rounded head nubs, big round cream eyes and a separate toothless grin. |
| F02 Roamer | Lean orange body, purple limbs, lime back satchel and an orange foam ball held at shoulder height. Angry cream eyes, a separate ink grin and a raised throwing forearm. |
| F05 Darter | One large deep-purple body and head, two stout legs, curved lime brow and chest plates fitted to the body, and an orange back weak point. Small eyes and a large toothless gape. |

Each Foamer has four 512 x 512 views: `front`, `side`, `back` and
`three-quarter`. Each `sheet.png` places those views side by side at their
original size, with the Foamer name underneath.

Regenerate one rig from the repository root:

```sh
npx tsx tools/render-rig.ts F01
npx tsx tools/render-rig.ts F02
npx tsx tools/render-rig.ts F05
```

The renderer uses the real rig volumes and rest pose, material colours and
built-in Node zlib only. It adds no packages. Projected faces overlap slightly
and pixel centres are sampled explicitly, so adjacent voxel faces leave no
background cracks. A uniform face shade avoids false stripes from exposed
voxel rows.

`PartSpec.gapeScale` scales only the painted and hollowed gape, not the
collision box. `PartSpec.eyeScale` changes only eye paint. `PartSpec.shag`
adds light surface paint without changing occupied voxels; Slowmer uses it
for body shag while preserving its combat volume.
