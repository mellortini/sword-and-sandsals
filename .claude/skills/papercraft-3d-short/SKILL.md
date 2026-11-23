---
name: papercraft-3d-short
description: [VIDEO STYLE · Blender Cycles] Make a ~45-70 s vertical (1080x1920) science/body-explainer short in the "papercraft diorama" style - cut-paper and quilled-paper layers with real depth and soft shadows, macro camera with shallow depth of field, warm practical light (candles, a glowing flame hero with a face) against deep maroon darkness, deadpan flat-faced paper characters, dive-through-a-hole transitions, no outlines, no captions - rendered with Blender Cycles (primary) or three.js inside Remotion (fallback). Measured from a 59 s reference (birthday man -> belly slit -> flame judged by pointing hands -> family of candles -> quilled cell -> red paper town, sugar-cube and key/jar metaphors). Use when the user wants a video "in this papercraft style", "like the flame / metabolism video", "paper cut / quilling / diorama style", "w stylu papierowym / papercraft", or says "use the papercraft skill".
---

# Papercraft 3D short (Blender Cycles primary, three.js fallback)

> **Kopia w repo gry.** To ten sam skill, którym Mateusz ustalił papierowy wygląd gry (materiał papieru z „ząbkiem”,
> ściśnięte warstwy `ZK = 0.65`, słońce z lewej góry, Cycles + OptiX). Gra korzysta z jego biblioteki przez
> `blender/vendor/pc_lib.py` (to samo co `blender/pc_lib.py` tutaj) — zmieniaj tam, nie tutaj.
> Ścieżki poniżej są względne do katalogu repo; `D:/blender/blender.exe` zamień na swoją ścieżkę Blendera 5.3.
> **Nie ma tu** `references/frames|sheets|crops|our_tests` (klatki z cudzego filmu referencyjnego i nasze testowe
> rendery, 31 MB) — prawa autorskie i rozmiar. Notatki z pomiarów (`references/*.md`, `references/data/`) są.
> Codex: ten plik nie ładuje się sam — przeczytaj go przed zadaniem `area:art`, gdy chodzi o wygląd papieru.

**Use Blender Cycles for the final look.** The user compared both: the three.js stills looked flat and "not similar"; the same scenes
in Cycles (global illumination, soft light bounced between paper layers, subsurface in thin paper, real depth of field) are much closer.
`blender/` has the working pipeline (headless, about 4-10 s per 540x960 frame on the RTX 4070 SUPER with OptiX).
The three.js templates in `templates/` stay as a fast-preview / fallback path only.

## Blender quick start (headless, no MCP needed)
```bash
# one scene -> PNG (scenes: belt breakfast breakfast_stripes breakfast_gingham cave cave_hands town jars party family pipes mito mito_ribbon gym)
D:/blender/blender.exe -b --python .claude/skills/papercraft-3d-short/blender/scenes.py -- belt out.png 1080 1920 128
D:/blender/blender.exe -b --python .claude/skills/papercraft-3d-short/blender/cell.py -- cell.png 1080 1920 128   # quilled cell
python -I .claude/skills/papercraft-3d-short/blender/post.py out.png out_pp.png --look inside --seed 0          # bloom + grade + vignette + grain
```
- `blender/pc_lib.py`: `paper_mat` (principled + paper-tooth bump + subsurface), `pattern_mat` (pinstripe/gingham/polka/check/hstripes, procedural),
  `glow_mat`, `gold_mat`, `layer(outline, mat, h, z, holes=)` (cut-paper layer via a Curve, so holes work), shape helpers (`rrect`, `ellipse_pts`, `blob_pts`,
  `teardrop_pts`, `wave_pts`, `xf`), `band_geo` (walls / quilling strips), `spiral_pts`, `sugar_cube`, `sun` (placed FROM upper left), `point`, `camera` (85 mm, DOF), `setup_cycles` (OptiX).
- `blender/scenes.py`: belt, breakfast x3, flame cave with 8 pointing hands, red town, jars + keys, birthday. `blender/cell.py`: quilled cell macro. Copy a scene and edit it for new shots.
- `blender/post.py`: Cycles has no bloom/grain in headless mode, so do it per frame in numpy/OpenCV (`--look dark|inside|day`, `--seed` = frame number).
- Stills compared with the reference: `references/our_tests/blender/side_by_side_ref_vs_blender.jpg` (reference left, Blender right).

### Texture rules (measured on 1080x1920 crops of the reference; user said texturing lagged)
- The reference paper has a clearly visible **sandy tooth** on every sheet (faces, mustache, leather, jumper), about 1.5-2 px speckle at +-10 % albedo, plus soft mottling and sparse glitter on the gold buckle.
- `pc_lib._detail()` adds this to every material: `grit` (speckle), `mottle` (blotches), `bump`, `rib`/`rib_freq` (corrugated cardboard ribs), `glitter`. Defaults: grit 0.8, mottle 0.2, noise scale 50.
- **The speckle cell must be 1.5-2 px.** Noise scale 110-900 was sub-pixel and vanished in antialiasing (the old materials looked flat). Scale 50 is for 1080 px wide at camera distance ~30; if you render another size or distance, scale it with (pixels per unit)/100.
- **Do not blur in post.** A lens blur of 0.4 px x (h/960) erased the grit; `post.py` now uses 0.12.
- `pattern_mat` kinds: pinstripe, hstripes, gingham, polka, check, **twill** (diagonal denim). Stripes wobble a little (printed paper). Use `rib=0.5, rib_freq=3.0, rib_axis='x'` for building walls and `rib_axis='y', rib_freq=9` for jumpers.
- Gold (`gold_mat`) is the only glossy material: sparse glitter, sandy tooth, a little emission (no HDRI).
- Compare textures with zoomed crops, not whole frames: `compare/tex*_*.jpg` show reference | ours at 1:1.

### Blender lessons (do not repeat)
- **Layers lie almost ON each other.** `pc_lib.ZK = 0.65` (1.0 = floaty, 0.4 = too glued; the user picked the middle) compresses every z offset and thickness in `layer()`/`band_geo()`/`disc_geo()`/`sugar_cube()`; the sun is `frm=(-6,9,16)` (between overhead and the old 42 degree angle).
  Otherwise shadows are long and the pieces look like they float (user feedback). Raw meshes (`mesh_from` with your own verts, `bpy.ops` primitives) are not compressed: multiply their z by `pc.ZK`.
  Never put two layers at the same z (black patch of coincident faces): give each background shape its own level.
- Layers must not overlap in Z: a layer's bottom must be at or above the top of what it sits on, otherwise coincident faces render black (the plate went black).
  Facial features and details go on top of the parent layer's TOP (`z = base + h*scale`), not inside it. Scaling a layer scales h but not your hand-typed z.
- Sun: place it FROM a position (`pc.sun(..., frm=(-8,12,16))`). Rotating the sun by hand put the light below the scene.
- Pastel scenes: `view='Standard'` (AgX greys out mint and pale blue); glow/dark scenes: AgX. Keep exposure around -0.5..0 and flame emission 3-4, or flames burn to cream.
- Without an HDRI, metal renders dark: `gold_mat` uses metalness 0.6 + a little emission.
- Place the camera at distance 26-34 with an 85 mm lens (frame about 11 x 19.6 units at 26); far backgrounds should sit near the subject (z -1) or their shadows become huge.
- Render big only at the end: 540x960 at 80-96 samples is enough for look checks.

## Old three.js pipeline (fallback)

Style source: one 59.13 s reference short, broken into frames and measured (see `references/`).
That video is private study material. Copy the LOOK and the CRAFT, never its script, characters or shots.
Story, characters and voice are always our own. Never name the reference in a voice-over or description.

Read in this order:
1. `references/STYLE_BIBLE.md` - the style: light, colour, materials, characters, camera, animation, post, sound, don'ts.
2. `references/SHOT_LIST.md` - the 19-shot rhythm of the reference with timings and frame-level beats.
3. `references/frames/*.jpg` (21 keyframes, 540x960), `references/sheets/` (1 fps sheets, 5 fps sequences), `references/crops/`
   (macro texture crops). Open the ones that match the scene you are building and compare your stills against them.
4. `templates/papercraft/*.ts` - working three.js building blocks. `templates/sandbox/` - a Remotion test composition.
5. `references/our_tests/` - stills rendered from these templates (what the starter code already reaches).

## User rules that apply (from memory)
- Language: narration and any text in English only; talk to the user in Polish.
- Narrator: Qwen3-TTS VoiceClone through the user's ComfyUI with the workflow from Pictures. Never edge-tts.
- Quiet sound design: no loud effects, the narrator stays clearly audible. The reference has dense foley at -14 LUFS
  and no speech; keep the idea (a tiny sound per visual event) but mix it low and duck it under the voice.
- No captions or labels in the picture (the reference has none either).
- Save after every step. Final export vertical, CRF 16.

## Pipeline
1. **Topic -> metaphor.** Pick a process people cannot see (body, cell, electricity, money, climate...). Turn every part
   into a physical paper object with a face or a motion: sugar = white cubes, insulin = keys, cell = locked jar,
   muscle = quilled coils, energy = a flame on logs, pipes = schematic with gold beads. One metaphor per hold.
2. **Script** (~3.5 words/s, 45-70 s) using the skeleton in STYLE_BIBLE section 2: hook gag, time-passing montage, the
   problem, dive inside, hero doubted, everyone has one, measuring gag, zoom into tissue, mechanism in a paper town,
   fix, payoff with the hero happy. Never describe what the viewer already sees. Facts first, with sources, then jokes.
3. **Voice** via ComfyUI (see memory), then word timings `words.json`. Every visual reaction lands 0-3 frames before its word.
4. **Shot plan** (`story.ts` in `src/videos/<name>/`): per shot id, a/b frames, scene builder, camera keys, light look
   (`dark` / `inside` / `day`), DOF on/off. Use the rhythm of SHOT_LIST: montage hits 0.33-0.5 s, holds 3-8 s, dive 0.5 s.
5. **Build the world** with `templates/papercraft/`:
   - `paper.ts`: `paperMat`, `glowMat`, `goldMat`, `layer`, `ring`, `put`, shapes, `paperLights`, `practical`, `PAL`.
   - `quilling.ts`: `coilGeometry`, `coilField` (instanced coils), `shred` (curly paper strips).
   - `characters.ts`: `makeFlame` (+`flicker`, `setFlameMood`), `makeLogs`, `makeMan` (+`setEyes`, `setMouth`).
   - `world.ts`: `patternMat` (pinstripe/gingham/polka/stripes/stitch/denim/curtain), `band`, `wave`, `sugarCube`, `makeButton`, `makeJar`, `makeKey`, `makeBuilding`, `addPointingHands`, and scene builders `WORLD.belt|breakfast|breakfast_stripes|breakfast_gingham|family|town|jars|pipes`.
   - `characters.ts` also has `makeHand`, `makeFigure` (full body + candle + coloured glow) and `ManOpts` (mustache, hair, glasses, bun, side hair, bald).
   - `post.ts`: `makeRenderer`, `dioramaCamera`, `makeComposer` with `LOOKS.dark|inside|day` (bloom, DOF, grade, grain, vignette).
6. **Animation** (measured values in `references/MOTION.md`, working code in `blender/animate.py`): flame flicker broadband 2-3.3 Hz, fingers bob 1.25 Hz,
   slit opens in 3 steps, light blooms when something works. Camera: character holds almost locked (2-5 px/s) + 1 %/s push-in; macro holds pan 20-60 px/s;
   dives (see `references/DIVE.md`; working Blender clips `dive` + `cave`): widen the opening, rack focus to the interior, rush with ease-in (zoom squeezed into the last 0.1-0.2 s), then focus settles with ease-out. Cube fall, blinks, tension strokes, flame face changes are NOT measured; the dive seam and the cave interior look are approximate (see DIVE.md 'Known differences'); the magnifier -> cell dive is documented but not implemented.
7. **Look checks**: render stills (command below), put them next to the reference frames of the same scene type, fix, repeat.
   The checklist below is what to compare.
8. **Sound**: event table -> tiny foley per event (paper rustle, tick, key clink, lid pop, ember crackle, flame whoosh) over a low
   warm bed; duck under the voice; -16 to -14 LUFS with the voice on top.
9. **Final render**: `npx remotion render <entry> <Comp> out/<name>.mp4 --codec h264 --crf 16 --gl=angle` (the project already
   sets angle and concurrency 4). Mux the mix with `-map 0:v:0 -map 1:a:0`. QA every frame for black/white/frozen frames.

## Quick start: render a test still
```bash
mkdir -p ref_style/test && cp -r .claude/skills/papercraft-3d-short/templates/papercraft ref_style/test/papercraft
cp .claude/skills/papercraft-3d-short/templates/sandbox/*.tsx ref_style/test/
cd /d/animacje   # the folder that has node_modules with three + remotion (three 0.170)
npx remotion still ref_style/test/index.tsx PaperTest out/cell.png --props='{"scene":"cell","dof":true}' --gl=angle --frame=10 --image-format=png
# scene = cell | cave | cave_hands | party | belt | breakfast | breakfast_stripes | breakfast_gingham | family | town | jars | pipes
```
An entry under any child folder of the project resolves `three` and `remotion` from the parent `node_modules`.

## Look checklist (compare every still with the reference frame of the same kind)
- [ ] Layers visibly separated in Z with soft shadows; no flat unlit shapes.
- [ ] No outlines/ink lines anywhere. Shapes read through paper edges and shadows.
- [ ] Dark surround (`#2e1b20`-ish, never pure black mid-film) with 1-2 hot spots that bloom softly.
- [ ] Flame body stays YELLOW (`#ffe45c`), core pale, halo orange. If it goes white, lower emissive (<= 1.0) / bloom.
- [ ] Faces are flat paper layers: half-lidded deadpan eyes, big nose layer, thick mustache, round cheeks.
- [ ] Paper grain visible on large flats (grain sigma about 3/255), shadows tinted maroon not black.
- [ ] Macro scenes have shallow DOF: soft edges, sharp band in the middle; foreground strips blurred.
- [ ] Camera drifts on every hold; transitions are dives/zooms through a hole or match cuts, not wipes.
- [ ] Palette: one dominant hue per scene + flame yellow accent; normal-world scenes pastel, inside-body scenes maroon/crimson/cream/gold.

## Lessons from the test renders (so you do not repeat them)
- three r155+ lights are physical: lux on a surface = intensity / distance^2. A point light of 260 at 5.5 units washed the
  whole frame to white. Use intensity 10-30 for practicals at 5-7 units; the flame light is `FLAME_LIGHT = 26`.
- Use `VSMShadowMap` with `shadow.radius` 6-7 and `blurSamples` 16 for soft penumbra. `PCFSoftShadowMap` ignores the radius
  and gives hard paper shadows.
- Nested cave/frame layers must be RINGS (`ring(outer, inner)`), not solids, or the nearer layer hides everything behind it.
  Put heroes (flame, logs) in front of the last solid layer in Z.
- ACES tone mapping + bloom turns emissive 1.5+ into white. Keep emissive at 0.95-1.25 for flames, 1.25 for candles.
- Instanced quilling coils: 300-4000 instances render fine. Use a spiral band polygon (`coilGeometry`) not a texture, it is
  what makes the macro shot read as real quilling. Increase `strip` for the tight central coil (0.12 at radius 1.9).
- The pinwheel dividing walls in the reference are curved; ours are straight. Use arc-shaped extrusions if you need the exact look.
- Face colour sells the light: the birthday face works with a strong orange point light in FRONT of it (70 at z 7) plus a
  weaker one at the cake, and a very low cool fill.

## Status of the templates vs the reference (see `references/our_tests/`)
Rendered and compared with the reference frames: belt + shirt slit, breakfast (3 cloth variants), family line-up with candle bokeh,
red town with sugar cubes, jars + keys, pipe schematic, flame cave with 8 pointing hands, quilled cell with curved pinwheel walls, birthday.
Belt, breakfast, town and jars are close to the reference; cell, cave and party reach the mood but not the finish. Still missing or weak:
- Cave: reference rim lines are thin and pale pink; ours are thicker red. Pedestal should have a lighter top.
- Cell: reference coils are lighter/more varied, centre is a white coil with a gold dotted disc; the red/blue ring "holes" need dark interiors.
- Party: reference candles are striped with pointed flames; head fringe and pinstripe shirt are missing.
- Family: figures are blocky (no arms/shoulder shaping), baby and girl are not built yet (use `makeFigure({bald:true, sit:true})`).
- Not built at all: gym squat gag, mitochondria oval with gold bow, spirit level with hand, caliper, walking legs with seasons, magnifier ring, spiral-coil friend with briefcase, hand pulling strips.
- Town: the lower third is empty flat red; compose buildings lower or add the stream layers there.
Budget one iteration of "render, compare, fix" per scene type before animating.

## Gotchas found while building (do not repeat)
- A trailing `// comment` on the same line as `g.add(l);` silently removed the candle lights (family scene went black). Keep comments on their own line.
- Lights inside a scaled group: positions scale, intensities do not. At scale 0.32 a candle light of 9 gives about 2 lux on the torso.
- `ExtrudeGeometry` UVs are in world units, so texture `repeat` is `1 / tileSize` (`patternMat(kind, c1, c2, tile)` does this).
- Tiling dots must be drawn at +-N offsets or they are cut at the tile edge.
- No environment map means metals render black. `goldMat` uses metalness 0.25 plus a little emission.
- Frame everything with the camera at z 55-65 (not 47) when a scene is wider than one object: 47 crops jars, pipes and the town.

## Analyse a NEW reference video the same way
```bash
python -I .claude/skills/papercraft-3d-short/scripts/analyze_reference.py "<video.mp4>" "<out_dir>"
```
(needs ffmpeg + `pip install numpy pillow opencv-python-headless scipy matplotlib`). It writes 2 fps frames, keyframes at the
cuts, contact sheets, per-frame stats (cuts, camera drift, colour), per-keyframe k-means palette / vignette / grain, and audio
loudness + band energy + onsets + spectrogram. Then read the sheets with the image reader and write a new STYLE_BIBLE.

## Files
| Path | What |
|---|---|
| `references/DIVE.md` | the DIVE transition option: exact timeline of both reference dives (slit -> cave, magnifier -> cell), Blender recipe, generic recipe |
| `references/MOTION.md` + `data/motion*.json` | measured motion: drift per hold, dives, slit steps, flicker, hand bob, light timeline |
| `references/our_tests/animation/` | our belt/dive/cave clips (mp4), ref-vs-ours strips, our_motion.json (verification) |
| `scripts/finish_clips.py` | post every frame, encode mp4, measure slit/flame/hand with the reference's functions |
| `blender/animate.py` | frame-by-frame animation clips (belt, dive, cave): `blender -b --python animate.py -- __lib__ <out> W H samples <clip>` |
| `scripts/measure_motion*.py` | motion measurement on any reference video |
| `references/STYLE_BIBLE.md` | the measured style (light, colour, materials, characters, camera, animation, post, sound, don'ts) |
| `references/SHOT_LIST.md` | shot-by-shot rhythm and frame-level beats (belt slit, flame and fingers, keys and jars, birthday) |
| `references/frames/` | 21 keyframes 540x960 named `k_<seconds>.jpg` |
| `references/sheets/` | overview, five 1 fps sheets, four 5 fps sequences, spectrogram |
| `references/crops/` | 2x macro crops: face grain, belt/buckle, quilled coils, corrugated building |
| `references/data/per_frame_stats.csv` | 1774 rows: lum, sat, RGB, contrast, histogram distance, drift, pixel diff |
| `references/our_tests/` | 11 stills rendered from our templates + `side_by_side_ref_vs_ours.jpg` (9 pairs: reference left, ours right) |
| `templates/papercraft/` | paper.ts, quilling.ts, characters.ts, world.ts, post.ts |
| `blender/` | PRIMARY: Cycles scene library (pc_lib.py, scenes.py, cell.py, post.py) |
| `templates/sandbox/` | Remotion test composition (`Sandbox.tsx`, `index.tsx`) |
| `scripts/analyze_reference.py` | reference-video analysis tool |
