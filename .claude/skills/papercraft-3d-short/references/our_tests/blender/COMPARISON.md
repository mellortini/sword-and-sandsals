# Blender render vs reference, frame by frame (2026-11-17)

Boards: `compare/board_<scene>.jpg` (reference | ours | luminance diff | metrics + palette), strip: `compare/overview_ref_over_ours.jpg`
(reference on top, ours below). Numbers: `compare/metrics.json`. Reproduce with `compare/compare.py`.
Metrics are on 540x960 frames. Lum/sat are 0-255 (HSV saturation), grain = std-dev of the high-pass in flat areas, sharpness = Laplacian variance.

## Global numbers (reference | ours)

| Scene | mean lum | p50 lum | p1 lum | saturation | vignette e/c | grain floor | sharpness |
|---|---|---|---|---|---|---|---|
| belt | 153 / 184 | 169 / 232 | 37 / 46 | 70 / 66 | 0.89 / 0.79 | 1.0 / 0.8 | 124 / 216 |
| breakfast | 202 / 159 | 206 / 160 | 67 / 30 | 38 / 49 | 0.86 / 0.87 | 1.8 / 2.7 | 178 / 252 |
| town | 93 / 73 | 83 / 62 | 20 / 8 | 170 / 199 | 0.88 / 0.57 | 1.1 / 4.4 | 311 / 562 |
| jars | 83 / 60 | 62 / 40 | 14 / 1 | 158 / 199 | 0.46 / 0.41 | 1.1 / 4.6 | 172 / 543 |
| cave + hands | 62 / 41 | 45 / 18 | 5 / 1 | 165 / 188 | 0.49 / 0.12 | 2.1 / 5.4 | 318 / 772 |
| quilled cell | 81 / 66 | 72 / 52 | 8 / 3 | 130 / 179 | 0.71 / 0.69 | 1.4 / 4.5 | 902 / 1260 |
| birthday | 86 / 67 | 71 / 30 | 7 / 0 | 154 / 183 | 0.30 / 0.14 | 0.7 / 4.9 | 226 / 649 |

## What is systematically different (affects every scene)

1. **Blacks are crushed.** Reference shadow floor is lifted maroon (p1 lum 5-20); ours goes to 0-3. Dark scenes are 20-60 % too dark at the median. Cause: world light too weak, post lift too small.
   Fix: world strength 0.35-0.6 in maroon scenes, a big soft area fill from the camera side, `post.py` lift x1.8.
2. **Colour is too saturated.** In every "inside" scene ours is 15-40 % above the reference (cell 179 vs 130). Reference reds are pinker and softer (`#A1293C #DD3D48`), ours drift to brick/orange (`#9C1B19 #D03B28`).
   Fix: lower saturation in `post.py` to 0.92-0.95 for dark/inside, shift paper hue toward magenta-red.
3. **Grain is 3-5x too strong** (grain floor 4.4-5.4 vs 0.7-2.1). It is Cycles noise plus post grain stacked. Fix: 192+ samples with OpenImageDenoise, `grain` 0.006 in post.
4. **Ours is 1.5-3x too sharp.** The reference is slightly soft: lens softness plus real depth of field. Fix: DOF in every scene (fstop 0.4-0.7 here), 0.6 px blur in post, small halation.
5. **Vignette is too weak in dark scenes** (cave 0.12 vs 0.49, party 0.14 vs 0.30, town 0.57 vs 0.88 means ours is darker at edges only in some).
6. **Highlights blow to 255** in glow scenes (flame, candles). Reference flame body stays yellow `#FAF378`. Fix: emission 1.5-2.2 and tone-map the glow, not the paper.

## Scene by scene

### belt (ref `k_007.5`)
- Ours is overexposed: shirt is white (p50 232 vs 169), reference shirt is pale blue `#DAE8EB` with a soft vertical gradient and a darker curved shade above the belt.
- Reference belt is bowed (follows the belly), stitching dashes curve with it, belt end overlaps the buckle, tongue passes through a belt hole. Ours is a flat straight strip.
- Buckle: reference is deeper, rounded and glossy with fine glitter; ours is flat saturated yellow.
- Slit: reference is wider with a deep maroon-wine interior, a flame-orange ember at the bottom touching the lower button. Ours is thin and the glow is a pale yellow blob.
- Buttons: reference has X-stitch holes and slightly raised rim; denim has visible twill and V seams close to the centre.
- Pinstripes: reference stripes are bolder (white, every ~60 px, slightly wavy). Ours are faint.

### breakfast (ref `k_002.4`)
- Ours is too dark and grey-green (`#94A687` vs `#BEDABF`, mean 159 vs 202). Raise exposure +0.7 and world strength back to 0.7 (my last correction overshot).
- Missing: steam wisp over the coffee, coffee spoon/handle on the cup, pale yellow doily under the juice, speckled yolks, striped bacon texture, fork with a handle shape on a napkin, knife with a blade shape. Plate rim in the reference is a lipped shape with a visible inner ring.
- Dots in the reference are smaller and denser with a soft paper edge.

### town (ref `k_031.9`)
- Reference windows in the lit state are tall narrow glowing slots, ours are square doors. Windows turn into doors later, so build both states and animate between them.
- Buildings in the reference are taller (fill the frame), pinker (`#E95754 #D83B47`) with a vertical glow gradient from the windows. Ours are orange-red and shorter, with a visible empty lower third.
- The stream is magenta-pink (`#A1293C`) with large-amplitude waves and thick pale crest lines on every wave. Ours is flat red with small waves.
- Sugar cubes: reference cubes are bigger, whiter and sit on the waves. Ours are small and grey.
- Background: reference has big mid-maroon discs and a lit wall; ours is nearly black.

### jars (ref `t=38.9 s`)
- Reference jars are creamy yellow (`#E3B764`) with glass bubble rings, a bright highlight bar and a ribbed lid with vertical grooves; a shelf strip of pink under them. Ours are flat orange.
- Reference background is wine/magenta (`#90243B #5C2430`), ours is almost black (`#401312`). This alone accounts for most of the luminance gap.
- Padlocks in the reference are brass with a visible keyhole; the key goes through the lock. Ours are grey rectangles.
- Reference stream below is three clearly separated pink wave layers with a pale line on each crest.

### cave + hands (ref `t=9.0 s`)
- Biggest gap. Our flame blows out to white (p99 255); reference is saturated yellow with worried dark eyes with sparkles and an open "o" mouth. Ours smiles with pale eyes.
- Hands: reference hands are large, pale peach to dark brown, blocky with clearly separated fingers, cuffs and watch details, partly cropped by the frame. Ours are small orange sticks with oversize fists and floating cuffs.
- Cave: reference is a nested dark-plum oval with thin pale-pink rim lines, and a pedestal with a lighter top and darker plum body. Ours is nearly black with a bright red pedestal.
- Logs in the reference are cylinders with cream ring ends and wood grain; ours are flat slabs.
- Camera is closer and tilts slightly; the frame is full of hands.

### quilled cell (ref `k_022.5`)
- Palette: reference tissue is pale pink (`#BF9B88`, `#A37565`), ours salmon-orange. Reference coils are crimson-wine `#702C38`, ours brown-maroon `#6B1C1D`.
- Reference gold ring has chunkier cream spirals and a thicker golden band; ours has thin tiny spirals.
- Centre: white spiral coil with a gold dotted disc; ours a flat grey disc.
- Reference has real tilt-shift depth of field (the edges blur); ours is sharp everywhere (sharpness 1260 vs 902).
- Walls are curved like ours (good), but the reference shows them as thin white strips with a softer shadow.
- Reference has a stray cream coil in the lower left and some coils with a lighter rim: add variation.

### birthday (ref `k_000.5`)
- Ours is 2x too dark at the median (30 vs 71). Reference face is lit from below with a rich orange gradient across the whole head, curtain has folds and light, jumper is lit grey with horizontal ribs.
- Reference candles are striped with small pointed flames in warm yellow, crowded and slightly tilted; ours is a white blob band at p99 255.
- The man in the reference fills the frame (head about 28 % of the height); ours is smaller and lower.
- Missing: party hat with stripes (it is hidden), bunting on a string, balloon highlights and strings, confetti, cake icing drips and the dotted red band.

## Priority list for the next iteration
1. Global grade in `post.py` (lift, saturation 0.93, grain 0.006, blur 0.6 px, stronger vignette) and `setup_cycles` (192 samples, always DOF). One change, helps every scene.
2. Emission calibration: flame/candle emission 1.5-2.2, keep p99 under 245.
3. Backgrounds: lighter wine/magenta walls and discs, lit rather than black.
4. Geometry fidelity: slot windows, big blocky hands with cuffs, ribbed lids and glass bubbles, curved belt, striped candles, curtain folds.
5. Camera: tilt-shift DOF in macro scenes, closer framing in cave and birthday.

---------------------------------------------------------------------------------------------------

# Second pass (fixes applied, same day)

Boards: `compare/board2_<scene>.jpg`, strip with three rows (reference / before / after): `compare/overview3_ref_before_after.jpg`, numbers: `compare/metrics2.json`.

## Metrics after the fixes (reference | before | after)

| Scene | mean lum | saturation | grain floor | sharpness |
|---|---|---|---|---|
| belt | 153 / 184 / 134 | 70 / 66 / 91 | 1.0 / 0.8 / 1.9 | 124 / 216 / 187 |
| breakfast | 202 / 159 / 182 | 38 / 49 / 46 | 1.8 / 2.7 / 1.5 | 178 / 252 / 155 |
| town | 93 / 73 / 94 | 170 / 199 / 164 | 1.1 / 4.4 / 2.0 | 311 / 562 / 232 |
| jars | 83 / 60 / 79 | 158 / 199 / 174 | 1.1 / 4.6 / 2.0 | 172 / 543 / 222 |
| cave + hands | 62 / 41 / 68 | 165 / 188 / 170 | 2.1 / 5.4 / 2.0 | 318 / 772 / 146 |
| quilled cell | 81 / 66 / 67 | 130 / 179 / 162 | 1.4 / 4.5 / 2.3 | 902 / 1260 / 950 |
| birthday | 86 / 67 / 71 | 154 / 183 / 137 | 0.7 / 4.9 / 2.3 | 226 / 649 / 254 |

## What was fixed
- Global (`post.py`, `setup_cycles`): lifted maroon blacks, saturation x0.93, grain 0.006 (floor went from 4-5 to about 2), soft lens blur 0.3-0.4 px, stronger vignette in dark looks, 128 samples + denoise, new `macro` look for the quilled cell.
- Cave + hands: huge blocky hands with knuckles, thumb, cuffs and nails; yellow worried flame with brown eyes, brows and an "o" mouth; logs with cream ring ends; nested cave layers with thin pink rim lines; pedestal with lighter top. Cave uses `view='Standard'` so the flame stays yellow.
- Birthday: lit curtain, bunting on a string, balloons with strings, party hat with candy stripes, striped candles with tilted flames, cake with icing drips and a dotted band, jumper ribs, man moved up and bigger.
- Belt: pale blue pinstriped shirt, bowed belt following the belly, belt end over the buckle, X-stitch buttons, wider slit with a wine interior and ember.
- Breakfast: back to a light mint exposure, steam, cup handle, spoon curve, pepper specks, doily, fork on a napkin, bacon fat stripe, smaller dots.
- Town: tall narrow glowing slot windows, buildings filling the frame, four large magenta waves with thick pale crests, bigger whiter cubes, lit wine background.
- Jars: lighter wine background, pink shelf, creamy jars with glass bubbles, ribbed lids, brass padlocks with keyhole, three magenta wave layers.

## Still different (next iteration)
- Cell: saturation 162 vs 130 and plate too salmon; the central coil should be a real white spiral with a dotted gold disc; the gold ring needs chunkier spirals; tilt-shift DOF at the edges.
- Birthday: candle flames form a white cluster that hides the mouth; reduce rows to 2-3, make flames yellow (not white) and smaller; face should have a stronger orange gradient; man should fill more of the frame.
- Belt: saturation 91 vs 70 (shirt a bit too blue), buckle too flat/yellow, denim has no twill.
- Cave: flame core is nearly white and the hands are still more stick-like than the reference's chunky fingers; vignette 0.3 vs 0.5.
- Jars and town: keys should pass through the padlock; cubes need softer shadows; jars need a lighter creamy yellow with a glossy highlight.
- Not ported to Blender yet: family line-up, pipes, gym, mitochondria, spirit level.

---------------------------------------------------------------------------------------------------

# Third pass: layers too high above each other (user feedback)

The user noticed that individual elements floated too high above one another and cast big shadows. In the reference the layers lie almost ON each other and only give tight, soft contact shadows.

Fix (global, in `pc_lib.py`): `ZK = 0.4` multiplies every z offset AND thickness in `layer()`, `band_geo()`, `disc_geo()`, `sugar_cube()` (uniform Z scale, so every stacking relation is kept, only gaps and shadow offsets shrink). The default sun moved from `frm=(-8,12,16)` (42 degrees off vertical) to `(-4.5,6.5,16)` (about 24 degrees). Override with env var `PC_ZK`. Strip `compare/zcompress_before_after.jpg`: reference / before / after.

Gotchas this introduced (all fixed):
- Raw meshes made with `mesh_from(verts, ...)` or `bpy.ops` are NOT compressed. Multiply their z by `pc.ZK` yourself (cell coils, cave logs) or keep them behind everything (family crowd at z=-12 needs its backdrop at z=-40 so it ends up at -16).
- Background ellipses at an identical z render a black patch (coincident faces); give each its own level (+0.25).
- After compression low-relief objects look flat: coils got a taller strip (0.34).

---------------------------------------------------------------------------------------------------

# Fourth pass: texturing (user feedback: "we lag in texturing")

Method: render at 1080x1920, crop the same 480x480 region from the reference and from ours, compare at 1:1 (`texture/tex*_*.jpg`; the `tex_*` files are before, `tex4_*` after).

Found:
- The reference paper has a visible sandy tooth (about 1.5-2 px speckle, +-10 % albedo) on every sheet, soft mottling, a sparkly gold buckle, a diagonal denim twill, corrugated ribs on walls and jumpers.
- Ours was perfectly smooth. Two causes: the bump noise had sub-pixel cells (scale 110-900) and vanished in antialiasing, and `post.py` applied a 0.4 px x (h/960) lens blur that erased whatever was left.

Fixed in `pc_lib._detail()`: grit (scale 50), mottle, bump, ribs, glitter; `pattern_mat` gets `twill`, stripe wobble, ribs; `gold_mat` gets glitter; `post.py` blur 0.12; scenes use ribs on buildings and jumper, twill denim, coarse leather grit, arch-shaped mustache with a lip rim.

Still different: the reference has finer, brighter flecks on dark paper (mustache, denim), small hand-cut imperfections (slightly wavy edges), and a soft pencil-like slit line on the belt; our edges are perfect CAD curves. Candidates: jitter outline points by 0.01-0.02 units, add a lighter 1 px cut edge.
