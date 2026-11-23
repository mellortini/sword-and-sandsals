# DIVE - the "fly through a hole" transition (exact description, measured on the reference)

The reference has two dives. Both: **the camera flies forward into a small opening, the foreground is thrown out of focus, the next scene appears
small and blurred in the middle and grows/sharpens.** No wipe, no cross-dissolve in the original (our stitch uses a 3-frame dissolve as a seam hider).
Frame sheets of the original: `frames/dive_slit.jpg` (7.3-8.5 s, every 2 frames), `frames/dive_ring.jpg` (19.2-22.6 s, every 5 frames).

## A. Slit -> cave (7.5 -> ~8.45 s, 30 fps)
Implemented in Blender: `blender/animate.py` clips `dive` (part A) + `cave` (part B), stitched by `scripts/finish_clips.py` into `dive_full.mp4`.

| t (s) | what the viewer sees |
|---|---|
| 7.30-7.50 | belt shot hold, slit open, a small warm glow far inside |
| 7.50-7.70 | the slit **rips open into a wide pointed leaf** (about 2.6x wider, a little shorter); inside, a soft ORANGE ROUND glow = the cave flame seen far away (NOT a flat yellow patch) and concentric dark-red ring edges. Camera tilts up: belt and buckle slide DOWN the frame by about 13 % of its height (buckle stays about the same size). |
| 7.65-7.80 | **rack focus**: focus jumps from the shirt to the interior. Shirt, buttons, belt, buckle turn into soft pale/brown/yellow shapes; the rings and the tiny flame stay sharp. |
| 7.77-7.97 | **rush**: the camera flies through the leaf. Zoom is squeezed into the last ~0.1 s of the window (t10 0.47 s, t50 0.57 s, t90 0.60 s of a 0.65 s window, peak image speed about 3000 px/s = ease-in). The leaf edge leaves the frame, only huge blurred red rings remain, flame small and sharp in the centre. A strip of blurred yellow (buckle) is the last foreground leftover at the bottom edge. |
| 7.97-8.10 | all red blur: rings (dark red, magenta, plum) slide outward past the camera; the wall is deep magenta/crimson. |
| 8.10-8.40 | focus settles: the cave hole rim (thin dark outline + pale-pink rim line) becomes crisp, the flame grows (x2-2.5 from the first sharp frame), face visible. The cave opens ZOOMED OUT and pushes in with ease-out. |
| 8.43 | first pointing hand enters from the right; hands stagger in (0.05 s each). |

### How it is built in Blender (all Cycles, headless)
1. **Part A = the belt scene with a FAR interior** (`animate.py clip_dive`, 12 frames, 7.5-7.9 s). Hide the old backdrop/ember. Build 3 ring layers (annulus, maroon `#5a1424 / #7e1c30 / #a02a40`
   + pale-pink rim lines) at z = -5, -10, -16, a crimson wall at z = -24, and a small teardrop flame (emissive `G('#ffc400',1.25)` + inner `#ffee70`) at z = -23.
   `far_layer()` scales every layer by `(D0 - z*ZK)/D0` so it APPEARS the stated size although it is far. This gives REAL depth for DOF (with the 85 mm lens, defocus depends on real distance; layers 1 unit apart do not blur).
   Point light `inner` at (0, 3, -2.2), 220 W warm.
2. Slit shape `slit_fn(w, hh)` (ellipse): half-width 0.63 -> 1.7 over 7.5-7.7 (smoothstep) -> 4.5 over 7.7-7.9; half-height 2.5 -> 2.0 -> 3.5 (leaf, then it fills the frame).
3. Camera: tilt up + push `pre = smoothstep((t-7.5)/0.27)`: `D = D0/(1+0.25*pre)`, `y = y0 + 2.5*pre`. Rush from 7.77: `e = ease_in((t-7.77)/0.13, 2)`, D -> 2.2, y -> 2.8.
4. DOF (`camera.data.dof`): `focus_distance` = D (shirt) until 7.65, then -> D+17 (interior) by 7.80. `aperture_fstop` 40 (sharp) until 7.6, then falls to 0.12 by about 7.72 (0.12-0.3 is needed: with the 85 mm lens in metre units blur is tiny until the aperture is huge). Set `camera.data.clip_end = 400`.
5. **Part B = the cave clip** (`clip_cave`, starts 7.9 s): `S.cave(True, far=1.5)` (rings scaled by far, hands on the axes, reference framing), extra magenta wall layer `#b83460` at z = -3.8 (140 x 240) so the zoomed-out start shows a wall around the hole,
   door glow hidden, camera `z = 0.32 + 0.68*ease_out((t-7.9)/0.55, 3)` (camera distance divided by z), DOF `fstop = 0.3 + 22*ease_out((t-7.9)/0.55, 2)`, focus = camera z - 1.2. Hands are hidden until they slide in (from 8.4 s).
6. Post: part A look `day`, part B look `dark` (`post.py`, grain seed = frame number). Stitch: the last 3 frames of A cross-dissolve into cave frame 0 (the original has no dissolve; this hides the scale jump).
   Result: `references/our_tests/animation/dive_full.mp4` (87 frames, 7.5-10.4 s) and sheets `cmp_dive_full.jpg`, `cmp_dive_full2.jpg` (reference on top, ours below).

Run:
```
blender -b --python animate.py -- __lib__ <out>/dive 540 960 64 dive      # part A, 12 frames
blender -b --python animate.py -- __lib__ <out>/cave 540 960 64 cave      # part B + hold, 75 frames
python scripts/finish_clips.py                                            # post + encode + stitch (edit ROOT inside)
```

### Known differences (honest)
- Our interior rings are flatter and darker than the reference red/magenta swirl; the dissolve shows a faint double flame (different scales). The original has no seam.
- Our cave opening is darker and less magenta; the reference rim line is crisper. The flame face change (happy -> surprised -> worried) is not animated.
- Hand tips in the original stop at the ring edge; ours reach closer to the flame.
- A single combined scene (cave really behind the shirt, camera flying through both) would remove the seam, but the cave must then be lit separately from the shirt (world light leaks into the cave through the open front). Not done.

## B. Gold magnifier ring -> quilled cell (19.7 -> 22.4 s)
Documented from the frames, NOT implemented.

| t (s) | what the viewer sees |
|---|---|
| 19.2-20.4 | family scene hold: man with a spirit level on his belly, candle glowing; the level exits up at 20.4-20.5 |
| 20.5-20.9 | a big **gold magnifier ring** slides in from the right at belly level (the lens shows a dark maroon field of quilled coils, a white curved reflection streak top-left, a brown handle below) |
| 20.9-21.4 | the camera **pushes into the lens**: the ring grows until its rim crosses the frame edges (about x3); inside, the coils are already sharp (the lens content is the next scene) |
| 21.4-21.8 | the rim leaves the frame; only the maroon coil field with the glass glare remains; coils scale up (macro) |
| 21.8-22.2 | the camera keeps zooming and DOF goes macro; coils morph into the cell scene (pink cytoplasm, cream spiral nucleus) |
| 22.2-22.5 | settled in the cell (quilled organelles, gold-beaded membrane at the edge), top-down |

Numbers: total zoom about x5 over 2.4 s, ease-in (t50 at 2.17 of 2.6 s, t90 at 2.33 s), peak image speed about 7000 px/s (low confidence: content changes during the dive and log-polar zoom is unreliable).
Recipe to implement: family backdrop scene; magnifier = torus (gold material) + a transparent disc carrying the coil field; ring slides in from the side (ease-out 0.4 s); then the camera pushes toward the lens centre with ease-in;
when the rim leaves the frame swap to the cell scene (`S.cell`) at matching scale (3-4 frame blurred dissolve) and ease the camera out to the cell hold.

## Generic recipe for ANY new dive (the option to offer in a new video)
1. Pick an opening the story justifies (slit, keyhole, jar mouth, lens, window). Foreground = scene A, interior = scene B.
2. Build B small and FAR behind the opening (real depth, perspective-compensated), or render B as a separate clip that starts zoomed out and defocused.
3. Choreography: widen the opening (0.2 s) -> rack focus to B (0.15 s) -> rush with ease-in, zoom squeezed into the last 0.1-0.15 s -> B blurred, then focus settles with ease-out (0.5 s). Total 0.9-1.0 s.
4. Light: B has its own warm practical (the flame); A's light must not leak into it. Post look changes from A (`day`) to B (`dark`) across the seam.
5. Sound: quiet, no whoosh louder than the narrator (the user's rule).
