# ART-04 notes: B08 Firehose

## Build 3 (DeepSeek via pi, 2026-11-10, the one that shipped)

Paul's restated brief on 2026-11-10: "no 'hopper' atop the barrel, this is
a side magazine fed blaster. The handle is over the body of the blaster.
The mod which adds a 2nd barrel adds the entire 6 barrel assembly, and both
would spin on individual axis when fired". Built from scratch in Blender
5.2.3 (Steam) by `build.py` in this folder; the approved design is written
up in `design/blasters/B08.md`.

What it is: six exposed barrels round a hub with a drive plate behind and a
retaining plate in front (so the ring shows turning; there is no shroud), a
yellow band near each muzzle and a plain orange bumper ring at the front; a
boxy body with a rounded motor block and five cooling ribs a side; a stick
magazine on the right, tilted back 8 degrees, with yellow feed lips,
follower ridges and a base plate; one carry handle over the body with
flared palm swells, the trigger and its guard under its front; the Twin mod
is a complete second six-barrel assembly on a saddle plate and a strut off
the body's left, with its own bumper, drive plate and retaining plate, and
it turns on its own axis.

Numbers: 7,622 triangles, 4 materials, 344 KB. True size 0.677 m long,
0.294 m tall. Origin at the handle's crossbar, where the hand holds it.
Colours white `#f2f2ee`, charcoal `#2b2b33`, foam yellow `#ffd23f`, bumper
orange `#ff7a1a`.

Checks: `check_glb.py` passes (triangle, material, size and node contract);
`audit.py` in this folder is the numeric geometry audit written for this
build, checking six barrel axes in a ring, nothing over the body top except
the handle, the handle centred over the body, the right-side magazine, the
twin a whole second cluster, both cluster sweeps clear of every static part
(0 verts inside either sweep disc, where the runner-up had 164), and both
muzzles on their axes.

Renders: `renders/side.png`, `three-quarter.png`, `top.png`,
`first-person.png`, `barrel-front.png`, `twin-mod.png`.

Seen in the game on 2026-11-12 in headless Chromium: drawn in hand on the
arena page, six barrels, side magazine, handle over the body, HUD reads
"Firehose AMMO 120 / 120". Not yet seen moving: the spin (a data value,
`wheelSpin` 60 rev/s), the reload, and the Twin mod in play.

## Rounds 1 and 2, replaced

- Round 1 (2026-11-08, the hopper-and-shroud brief): built to
  `design/blasters/B08.md` as it then read, a round ball hopper on top and a
  shrouded cluster with oval windows. Paul called it awful and restated the
  brief. That GLB (990 KB, 18,116 triangles) and its brief text are gone.
- Round 2 (2026-11-10, the runner-up): a second from-scratch build by
  qwen-machine/qwen3.8-27b-1cat via acp_delegate, 11,028 triangles. The
  audit found 164 of its static feed collar's verts inside the main
  cluster's sweep disc, so the barrels would clip it when spinning. Paul
  picked the pi build and deleted this one.
