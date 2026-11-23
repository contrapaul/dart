# B02 Musketeer: redesign brief (BENCH-01 alternative take)

An alternative redesign of the approved B02, not a re-do. Everything in
`design/blasters/B02.md` that is a decision, a rule or a constraint is kept.
What changes is the silhouette, the proportions and the details. Renders show
the result. This is a concept, not an approved design: Paul decides.

## Kept from the card

- Semi-auto sidearm (single-action, 6-dart magazine in the grip).
- Magazine in the grip that drops out on reload (1.0 s).
- Slide that kicks back on every shot (2.5 cm, 0.1 s return).
- Burst mod (3 darts, 0.07 s gap, 0.3 s cooldown) and heavy mod (slug, 0.45 s
  fire interval, bigger chunk and push).
- Yellow as the lead colour, toy-plastic look, no text or logo, no frame loop,
  no top rail, glowing parts absent (toys, not energy).
- Three-colour palette: yellow lead, charcoal furniture, purple accents; the
  orange safety bumper and see-through lime magazine with a blue dart hint.
- Plain round bumper (Paul, 2026-11-07: no flare).
- Grip normal map (not a sculpted texture, just a normal). Grip smooth.
- One muzzle, `muzzle_1`, on a plain round bumper.

## What changes, and why

1. **Silhouette.** The approved model is a sleek long-ish box: 20 cm of frame,
   thin slide, slim grip. Mine is built wider, shorter and squarer: the frame,
   slide and grip all read as one fat column, about 25 cm long with the
   magazine 20 cm tall. The reason: the original reads like a sci-fi compact
   pistol; the fat column reads better against a mid-range laptop and is a
   clearer "toy with a lump" shape. Narrow and sticky-out reads wrong at this
   scale.

2. **Frame and slide.** Wider (0.040 frame / 0.040 slide vs 0.036 / 0.033),
   taller (frame 0.045..0.085, slide 0.084..0.124), with a blunt nose and a
   flat top. The slide's nose is chamfered instead of sloped, and the grooves
   are four wide vertical vents, not five thin stripes (fewer gaps, reads
   cleaner under an outline). Rear sight stays a pair of purple ears; front
   sight is a wider block post.

3. **Grip and guard.** Short and broad (0.092 long, 0.037 wide, 0.048 deep,
   17-degree angle). The grip flares out to a wide base ring (mushroom cap),
   clearly visible above the magazine. The trigger guard is chunkier with a
   wider opening (0.025 wide, 4.5 cm across), and the trigger is a thicker
   paddle with a deep C curve.

4. **Magazine.** Longer and wider (0.088 x 0.032 x 0.026), sits in the grip
   tilted with it, lime-backed with three purple ribs around the shell and a
   wider purple base plate. The end shows further below the grip (2.0 cm)
   so the drop is visible in the first-person view.

5. **Orange bumper.** Slightly fatter and deeper (0.020 inner, 0.020 radius,
   2.2 cm long). Same shape as the approved take (plain round, no flare).

6. **Mods.** Heavy: a thicker barrel sleeve (y 0.148..0.182, outer 0.0155,
   inner 0.0125), hidden by default. Burst: three orange pips on the slide
   nose (height 0.004, r 0.002), hidden by default. Both mods are shown as
   `mod_*` nodes hidden by default, same pattern as the approved build.

## Alternatives left behind, on purpose

- No flared bumper (Paul's call, 2026-11-07): kept.
- No top rail: kept. No frame loop: kept. No logo or text: kept.
- Grip texture: normal map only, not sculpted: kept.
- The mag stays flush and flat, no flare.
- Silhouette change is the biggest difference: everything else is a second
  read of the same parts.

## Three-colour budget (D05)

Yellow leads (~70%), charcoal furniture (~20%), purple accents (~10%). Lime
is the see-through mag, orange is the bumper and the burst pips. No colour is
added beyond the existing palette.
