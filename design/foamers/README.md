# Foamer turnarounds

ART-03 design sheets for the first three roster Foamers. The source of truth is
`data/foamer-rigs.json`; these PNGs are generated assets, not separately edited
artwork.

| Foamer | Silhouette and palette |
| --- | --- |
| F01 Slowmer | Round lime body and head, purple limbs, orange right-hand club. Rounded head nubs, round eyes and a wide toothless grin. |
| F02 Roamer | Lean orange body, purple limbs, lime back satchel and an orange foam ball. Angry eyes and a throwing stance. |
| F05 Darter | One large deep-purple body and head, two stout legs, lime brow, chest and belly armour, and an orange back weak point. Small angry eyes and a large toothless gape. |

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
built-in Node zlib only. It adds no packages. `PartSpec.gapeScale` scales only
the painted and hollowed gape, not the collision box; Darter uses it to keep
its mouth readable between the armour plates.
