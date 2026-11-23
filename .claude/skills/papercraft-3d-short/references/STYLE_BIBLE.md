# Style bible: "papercraft body" explainer short

Measured from one 59.13 s reference (1080x1920, 30 fps, 1774 frames, H.264 8.1 Mbit/s, AAC 48 kHz stereo).
Analysis = 118 frames at 2 fps, 60 frames at 1 fps in 5 sheets, 21 full-res keyframes, 4 texture crops,
4 five-fps sequence sheets, per-frame stats (`data/per_frame_stats.csv`), k-means palettes, audio spectrum.
The reference is private study material: copy the LOOK and the CRAFT, never its script, characters or shots.

One-line summary: **a cut-paper / quilled-paper diorama shot like a macro-lens stop-motion film, lit by warm
practical light (candles, flames, glowing windows) against deep maroon darkness, with flat-faced deadpan paper
characters, and a tiny glowing flame character as the emotional hero.**

---------------------------------------------------------------------------------------------------

## 1. The core idea (what makes it look like this)

1. **Everything is paper.** Every object is a stack of thin coloured paper layers with real (tiny) thickness:
   cut-out shapes, rolled coils (quilling), corrugated cardboard, pinstripe/gingham/polka printed paper, felt-like
   matte cardstock. Nothing is glossy except the gold belt buckle and the glass of the jars.
2. **Real depth between layers.** Layers are separated by 1-3 % of their size in Z. Soft shadows fall from each layer
   onto the one below. This is the single biggest "papercraft" cue, more than any texture.
3. **Light comes from inside the story.** Candle flames, the flame character, lit windows, ember inside a shirt slit.
   The rest is a dim, cool-or-maroon fill. The picture is mostly dark with 1-2 hot spots that bloom.
4. **Macro camera.** Shallow depth of field, slow drifting dolly, top-down "microscope" shots, the camera dives through
   holes (a shirt gap, a gold magnifier ring) to enter the next world. Scale changes are the transitions.
5. **Deadpan acting.** Characters barely move. Half-lidded eyes, flat mouths, one raised brow, a blink. The comedy and
   emotion live in timing and framing, not in big animation.
6. **A metaphor for every process.** The body is a town / cell / factory built from paper:
   sugar = white paper cubes, insulin = keys, cells = locked jars with faces, muscle = quilled coils, mitochondria =
   oval pipe-works, metabolism = a flame on logs. Abstract thing -> cute physical paper object with a face.

---------------------------------------------------------------------------------------------------

## 2. Format and rhythm

| Item | Value |
|---|---|
| Frame | 1080x1920 vertical, 30 fps, 59.13 s |
| Real shot changes | about 20 (the pixel-diff detector reports 83, the extra ones are fast camera moves and flames) |
| Long holds | 3 - 8 s (quill macro 7.7 s, buildings 5.8 s, pipe schematic 4.4 s, belt 2.9 s) |
| Montage hits | 0.33 - 0.53 s each (breakfast x3 at 0.33 s, walking legs x3 at 0.47 s) |
| Cuts | hard cuts and match-cuts, no wipes, no whip pans, no glitch. Transition = dive / zoom through a hole |
| Black | only the very last frames. No fade-ins mid film |
| Text on screen | none (no captions in the film). No logos |
| Pace | fast montage opening (0-5 s), slow explainer middle (10-50 s), short payoff (52-59 s) |

Per-shot timeline with the camera, light and animation of each shot: `SHOT_LIST.md`.

Story skeleton (reusable): **Hook gag (birthday, blows candles) -> time passes montage -> the problem (belly,
belt, shirt gap) -> dive inside -> hero (flame) is judged (pointing hands) -> everyone has a flame (family line-up,
candles as metabolism) -> the measuring device gag (spirit level, caliper) -> zoom into the tissue (quilled cell)
-> the mechanism in a paper town (sugar cubes, keys, locked jars, pipes, mitochondria) -> the fix (exercise, one
quick gym gag) -> payoff (the flame is happy again, a tiny new friend arrives with a briefcase).**

---------------------------------------------------------------------------------------------------

## 3. Light

Measured per scene (luminance of a 0-255 frame, vignette = edge luminance / centre luminance).

| Scene | Key light | Fill / bg | Mean lum | p1 / p50 / p99 | Vignette |
|---|---|---|---|---|---|
| Birthday (0-2 s) | 60+ candle flames, warm orange from BELOW the face | near-black navy curtain `#0F1118` | 71 | 7 / 71 / 243 | 0.30 (strong) |
| Breakfast (2-3 s) | soft overhead, long soft shadow to lower right | pastel patterned paper | 205 | 67 / 205 / 247 | 0.86 |
| Belt macro (4.7-7.6 s) | soft studio top-left, ember glow inside the slit | pale blue shirt, navy denim | 169-214 | 37 / 169 / 245 | 0.76-0.89 |
| Flame cave (8-10 s) | flame is the only source, hands lit by it | maroon `#452F2E` | 52 | 38 / 190* / 254 | 0.56 |
| Crowd of candles (12-19 s) | each person lit by their own candle | dark violet `#282636` | 47-100 | 3 / 47 / 246 | 0.93 |
| Quill cell (22-31 s) | one directional key top-left, soft shadows to lower right | rose paper `#E2AE9D` | 72-94 | 8 / 72 / 196 | 0.71 |
| Red town (31-41 s) | windows glow from inside, dim top key | maroon `#5B262E` | 70-83 | 20 / 83 / 242 | 0.89 |
| Pipes / mitochondria (41-49 s) | low key, warm rim on the gold | `#2E1B20` | 45-47 | 12 / 47 / 203 | 0.81 |
| Gym gag (52-54 s) | flat bright wall light (the only "daylight" scene) | mint `#BCDCBE` | 180 | 54 / 180 / 243 | 0.89 |
| Flame finale (56-59 s) | flame + glowing door | plum `#2E1823` | 48 | 9 / 48 / 252 | 0.39 (strong) |

(*the 190 median of the flame frame is dominated by the pale cream fingers in that exact frame; the cave is dark.)

Rules distilled:
- **Practical warm light + dark surround.** Hot spot colour `#FFE45C -> #FFB000`, spill `#FF8A3D`, deep red spill into
  maroon. Spill is strong and local: faces and shirts glow in the candle colour (green sweater glows green,
  white shirt glows white, coral glows coral, purple glows pink).
- **Shadows are soft and tinted, never black.** Shadow colour is the layer colour darkened and pushed toward
  purple-maroon (`#361213`, `#2A1419`, `#10070E` at the very darkest). Pure black appears only in the end frames.
- **Highlights are creamy not white** (`#EEDBAF`, `#F8F5E3`) except flame cores and glowing windows.
- **Directional key from upper left, shadows fall lower right** in all daylight/top-down scenes. Shadow offset
  about 1.5-2.5 % of frame width, blur 6-14 px at 1080 wide, opacity 35-55 %.
- **Bloom** only on emissive things: flames, candle tips, lit windows, ember, the golden door. Glow radius
  ~3-6 % of frame, soft halo, no streaks. Core stays saturated yellow, halo goes orange.
- **Bokeh dots** as background in the crowd scene: thousands of tiny candles (6-18 px discs) in rows, defocused
  with soft disc bokeh, colour `#EDE0A8` on `#282636`.
- **Strong vignette only in two "dark" scenes** (birthday, finale). In bright scenes the vignette is under 15 %.

---------------------------------------------------------------------------------------------------

## 4. Colour

Overall grade: warm, slightly lifted blacks (maroon, never neutral black), saturated crimsons, desaturated pastel
for "normal world", crimson/maroon for "inside the body". Mean saturation per shot 37 - 200 (HSV, 0-255): the
inside-body scenes sit at 130-170, normal-world scenes at 40-90.

Palettes (k-means, 6 clusters, share of frame):

**Normal world (outside the body)** - pastel, flat, friendly
- Mint `#BEDABF` 44 %, `#A6C2A9` 28 %, cream `#EEEFE4` 22 %, bacon red `#BF534D`, cup brown `#53433B`, yolk `#ECB744`
- Shirt: `#DFECED` / `#CBDFE2` / `#A7B8C0` (white-blue pinstripe), denim `#373E53` / `#353E55`, leather `#B0754C`,
  brass `#F3DF4F`
- Gym wall: `#BCDCBE`, `#A2C3A4`, floor green `#638E6D`, shorts/top red `#CF5346`, skin `#EABA92`

**Inside the body** - maroon / crimson / cream / gold
- Backgrounds `#2E1B20`, `#4C252A`, `#5B262E`, `#54252D`, `#361213`
- Hot paper reds `#A1293C`, `#DD3D48`, `#E85E58`, `#96273C`, `#C23347`, `#C13246`
- Rose / flesh `#E2AE9D`, `#B06068`, `#A75B6A`, `#BE6F74`, `#C77B7C`
- Cream (windows, sugar, ribbon) `#EEDBAF`, `#E8D5BE`, `#E9D5BC`, `#BFBEBC` (sugar cubes grey-white)
- Gold (jars, pipes, bow) `#CB9F63`, `#CF9C5D`, `#D9B84A`, flame `#FAFB87` core, `#FFE45C` body
- Accent: violet molecule `#8A6FBF`, blue ring `#4A3F9A`, mint arrow `#7FD38A`

**Party / candle scene** - `#0F1118` background, skin `#D76C44` (lit from below), hair `#4E302B`, cake `#EEA659`,
flame `#FAF17C`, tablecloth red-white gingham.

Colour logic:
- One dominant hue per scene (maroon, mint, navy-violet, pale blue), plus one hot accent (flame yellow).
- Complementary punch: gold/yellow on maroon, red on mint, orange on navy.
- Characters keep the SAME palette across scenes (skin `#E9A07A`, brown mustache `#4A2B22`, cheeks `#E58A66`);
  only the light colour changes them.

---------------------------------------------------------------------------------------------------

## 5. Materials and textures (the "paper" vocabulary)

Every material is rough, non-metallic, with a micro-grain. Measured grain (std-dev of high-pass luminance in flat
areas, 0-255 scale): about 0.5 - 1.2 in clean scenes, 1.3 - 2.6 median across the frame. It is a fine,
photographic grain/paper-tooth, visible mostly on big flat areas (backgrounds, faces, buildings).

| Material | How it looks | How to build it (three.js) |
|---|---|---|
| Cardstock layer | flat colour + very fine speckle, crisp slightly lighter cut edge | `MeshStandardMaterial` roughness 0.95, metalness 0, noise bump map, extrude depth 0.4-1.2 % of height, bevel 0.15 % |
| Corrugated cardboard | fine ribs: horizontal 6-10 px pitch on jumpers/cardigans, vertical about 25 px pitch (with a slightly darker 1-2 px groove) on the red building walls | stripe texture as bump + a 6-8 % brightness modulation |
| Pinstripe shirt | pale blue with thin white vertical lines roughly every 60-70 px at 1080 (lines slightly wavy, perspective-free), a dashed stitch line at the placket | CanvasTexture |
| Denim | navy with fine diagonal twill and thin lighter seam lines (V-shaped fly stitching) | diagonal twill pattern + 1-2 px seams |
| Leather belt | tan `#B0754C`, dashed cream stitching 14 px dash / 10 px gap, punched holes with dark inner shadow, layered loop | stitching texture + dark hole discs |
| Gold buckle | the ONLY glossy object: saturated yellow, bevelled rounded rectangle, gradient reflection, tiny glitter speckle | `MeshStandardMaterial` metalness 0.9, roughness 0.35, `#F3DF4F`, env map or fake gradient |
| Quilled coil | strip of paper rolled in a flat spiral, 7-9 turns, visible edges of the strip, dark hole in the centre, slightly different height per coil | spiral ribbon geometry (see `templates/papercraft/quilling.ts`) |
| Printed paper | polka dots (mint), stripes (yellow), gingham (blue) on the breakfast table; confetti sprinkles | CanvasTexture, then lit like paper |
| Jars | translucent gold glass, glossy highlight stripe on the left, bubble rings inside, a cork-like ribbed lid and a metal padlock | `MeshPhysicalMaterial` transmission low, or flat gold with a painted highlight |
| Sugar cubes | matte off-white `#EAE6E0` slightly rounded cubes, soft shadow, rotated randomly | RoundedBox |
| Wavy "stream" | stacked crimson wave layers with a thin pale line on each wave crest, 3 layers | extruded wave shapes |
| Flame | flat paper-teardrop with an inner paler teardrop, glossy halo, emissive | custom shape + emissive + bloom |
| Wooden logs | tan-orange cylinders with cream ring ends and a faint wood-grain stripe | cylinder + canvas texture |
| Skin | flat peach paper, cheeks are separate layered circles, nose is a raised layer with shadow | stack of shapes |

Edge detail that sells paper: a 1 px lighter rim on every cut edge on the lit side, and a darker rim on the shadow side.

Fabric/skin shading is "two-tone paper": basically flat colour + soft ambient occlusion + cast shadow of the layer above,
with a gentle gradient from the light spill. No specular on paper.

---------------------------------------------------------------------------------------------------

## 6. Characters

Design language of the human characters:
- **Head** = a big rounded square (height about 1/3 of the whole figure), peach `#E9A07A`.
- **Hair** = a dark-brown cap shape stacked on top, thick, rounded, with a stepped fringe.
- **Eyes** = two big round recessed sockets (paper punched out), white sclera, small black pupil, heavy half-moon eyelid
  on top, thick rounded-rectangle brow above. Default expression: half-lidded, looking slightly up or sideways, bored.
- **Nose** = large rounded teardrop layer, clearly in front of the face (casts a shadow).
- **Mustache** = thick crescent, dark brown, in front of the mouth.
- **Cheeks** = two round blush discs, `#E58A66`, overlapping the face edge.
- **Mouth** = a tiny flat line or small oval (the "o" when blowing candles).
- **Torso** = wide, soft rectangle with rounded shoulders, clothing as printed/corrugated paper. Arms short, hands
  blocky fists/fingers built from 3-4 layered rounded blocks.
- **Women/children/elders**: same grammar. Grandma = white hair bun + round glasses, grandpa = white moustache + bow
  tie, baby = big bald head with one curl, small pink cheeks, "o" mouth.
- **Hands (pointing crowd)**: 8 hands at different skin tones (tan, light, dark, with red nails or watches), arranged
  radially around the flame, all index-pointing, each wiggling slightly.

Characters made of non-human things (the heroes):
- **Flame**: paper teardrop, inner pale teardrop, tiny shiny eyes (two orange-brown discs with white highlights), small
  mouth. Expressions: worried (small brows up), smiling (closed happy arcs), surprised (small "o"). Sits on a log pile
  on a little round paper pedestal.
- **Jars**: round golden jars with faces, blush circles, padlock on the lid; they smile after being unlocked.
- **Coil friend**: a quilled spiral with eyes, carrying a tiny briefcase.
- **Buildings**: red cylinders with a spiral top and rows of cream windows that turn into doors; windows glow when lit.

Eye/mouth rig (same as the user's existing Kiciński pipeline): eyes are separate poses (open, half, closed, happy arc,
look-left/right), mouth is 3-4 states. Do not morph. Swap layers.

---------------------------------------------------------------------------------------------------

## 7. Camera

- Always vertical 9:16. Mostly **straight-on, slightly telephoto** (feels like an orthographic-ish diorama), the
  perspective is gentle. Top-down for the cell and the breakfast table. Low-angle ground-level for the walking legs.
- **Drift depends on the hold type (measured, see `MOTION.md`)**: character/face holds are almost locked (2-5 px/s) with a 0.8-1.5 %/s push-in;
  macro world holds (cell, town, mito) pan 20-60 px/s, mostly vertical with content moving up; pipes about 120 px/s diagonal with a 4 % push-in.
- **Lateral tracking** across the family line-up: 5 s, ease-in/out, with motion blur and a soft focus change; it reveals
  the characters one by one (baby, girl, mom/dad, grandpa/grandma).
- **Dive transitions**: zoom into a small hole while defocusing heavily (the whole frame becomes big soft discs for
  about 0.4 s), then focus lands on the next scene. Seen: shirt slit -> flame cave (7.6-8.07 s), gold magnifier ring ->
  quill cell (19.8-22 s).
- **Depth of field is always on in macro**: tilt-shift look, sharp band across the middle, soft falloff at edges.
  In the crowd scene the background is heavily defocused and only the foreground characters are sharp.
- **Pull-back reveals**: from the hero candle out to the whole line-up (10.7-13 s), then to the tiny figures at the
  end of a long row (the scale gag).
- **Motion blur** on fast moves, none on holds.
- Reveal with a foreground object: a hand with a spirit level enters from top; shredded paper strips fly through
  frame in the macro scene and are blurred in the foreground.

---------------------------------------------------------------------------------------------------

## 8. Animation language

All motion is simple, physical and readable, in the spirit of stop-motion.

- **Tiny idles**: flames flicker broadband with the peak at 2-3.3 Hz (measured; not 6-10 Hz), pointing fingers bob at 1.25 Hz (peak about 10 px).
  Breathing and blink timing were NOT measured (0.5-1 % and every 2-4 s are guesses). Numbers: `MOTION.md`.
- **Stepped / on-twos feel in the paper bits**: coils and strips move with slightly snappy easing, like handled paper.
- **Anticipation + overshoot** for cause/effect: the shirt gap widens in three STEPS with plateaus (0 -> 7 -> 34 -> 72 px, measured), button shakes with small
  "tension lines" that appear and vanish (blue crescent strokes beside the button), belt tilts and the buckle tongue
  jiggles, then the ember flares behind the gap.
- **Secondary motion**: jar lids pop and fly with spin, keys fly in arcs, sugar cubes tumble down the wave stream and
  bounce, flame sparks rise.
- **Physics-lite dynamics**: sugar cubes use real gravity/rigid collisions on wavy ground; paper strips curl and
  flutter; shredded strips pile up.
- **Cause -> effect by light**: when something works (a key unlocks, a cell burns sugar), a warm light blooms in that spot
  (windows light, orange glow in the coil cell, steam wisps rise).
- **Montage gags** at 0.33-0.5 s per beat to show time passing (table cloth changes pattern, season changes behind
  walking legs: spring blossoms, autumn, snow).
- **Scale gag**: pull back to reveal the line goes on forever (thousands of tiny candle people).
- **Tension release gag**: a very long still hold on a deadpan face before the cut.

Full frame-level timings of the belt/slit, fingers/flame and jar/key sequences are in `SHOT_LIST.md` section "Beats".

---------------------------------------------------------------------------------------------------

## 9. Post-processing stack (what the final image has on top of the 3D)

1. Soft shadows with contact AO (SSAO/GTAO or baked blob under each layer).
2. Bloom on emissives (threshold ~0.85, strength 0.8-1.2, radius 0.5-0.7).
3. Depth of field (bokeh disc, focal plane on the subject, aperture small in macro).
4. Motion blur on fast camera moves only.
5. Colour grade: warm, lifted maroon blacks, gentle S-curve, saturation +10-15 % in reds, highlights cream.
6. Fine film grain + paper tooth: gaussian luminance noise sigma 1-2 / 255, slightly chroma-tinted, per frame.
7. Light vignette (0.85-0.9 centre/edge), strong (0.3-0.4) only in the dark scenes.
8. Delivered at H.264 8 Mbit/s (reference) - render yours at CRF 16.

---------------------------------------------------------------------------------------------------

## 10. Sound (measured, then adapted to the user's rules)

Measured reference: integrated loudness **-14.0 LUFS**, true peak **-0.9 dBFS**, loudness range **1.8 LU** (a very
even, loud master), near-mono (side/mid RMS 0.14), mean level -16.8 dBFS RMS. Energy is concentrated under 500 Hz
(sub/bass about -55 dB, low-mid -57, mid -74, presence -83 in spectrogram dB), with a very dense layer of short
transients: 130+ strong onsets in 48 s (about one every 0.35 s), dominant pulse about 0.32 s (about 188 BPM
as 8ths, or 94 BPM). No spoken narration was detected: the film is carried by foley and a low bed.

Interpretation: **every visual event has a tiny sound** (paper rustle, tick, pop, ember crackle, key clink, jar lid
"pop", sugar cube tap, flame whoosh), over a warm low drone/bass bed.

Adaptation for this user's rules (memory): the narrator (Qwen3-TTS VoiceClone via ComfyUI) must stay clearly audible
and the background quiet. So: keep the foley idea but mix it low and duck it under the voice; keep a soft low bed;
no loud hits. Aim -16 to -14 LUFS with the voice dominant.

---------------------------------------------------------------------------------------------------

## 11. Don'ts (things that break the look)

- No outlines / ink lines. This style has NO outlines; shapes are defined by paper edges and shadows.
- No glossy plastic look, no hard speculars (except gold buckle, glass jars).
- No pure black backgrounds mid-film, no pure white.
- No gradients across big flat shapes unless they are light spill. Paper is flat colour.
- No big character animation, no bouncing squash-and-stretch rubber. Paper does not stretch.
- No flat unlit screens: every scene has a clear light source and soft shadows between layers.
- No subtitles in the picture (the reference has none).
- No copied characters/shots from the reference. Same craft, new story.
