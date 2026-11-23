# MOTION - measured values (reference video, 59.13 s, 30 fps)

Measured with `scripts/measure_motion.py` (per shot) and `scripts/measure_motion2.py` (holds with transitions trimmed, dives, flame flicker,
slit steps, light timeline). Raw numbers: `data/motion.json`, `data/motion2.json`. Units: px of a 1080x1920 frame, seconds, Hz.
Method: cv2.phaseCorrelate (translation), log-polar phase correlation (zoom), FFT of high-passed signals. Sign: +vy = content moves DOWN the screen.
`blender/animate.py` already uses these constants (belt / dive / cave clips).

## 1. Camera on holds (steady drift, transitions trimmed) - NOT "40-60 px/s everywhere"
| hold | t (s) | drift px/s (vx, vy) | speed | push-in per s | note |
|---|---|---|---|---|---|
| birthday man | 0.1-0.5 | (0.3, -4.9) | 5 | x1.013 | character: almost still |
| belt / slit | 4.9-7.4 | content moves up ~36 px | - | **x1.29 total (buckle 378 -> 488 px wide), decelerating** | see section 1b: the x1.008/s figure was WRONG |
| flame + hands | 8.7-10.3 | (-0.9, -1.9) | 2 | x1.0145 | character: frozen frame + slow push-in |
| quill cell | 24.5-31.4 | (11.6, -57) | 58 | x0.99 | macro: steady pan, content moves up |
| red town | 32.2-36.8 | (-8.3, -31) | 32 | x0.993 | slow, last second faster |
| pipes | 41.8-45.2 | (88, -82) | 121 | x1.044 | diagonal move + push-in |
| mito | 46.4-48.8 | (0.9, -56) | 56 | x1.075 | |
| cell 2 | 49.3-52.0 | (0.3, -20) | 20 | x1.029 | |
| town 2 (scale gag) | 54.5-55.9 | (-1.6, 3.3) | 4 | x1.002 | still |
| finale flame | 56.5-58.9 | (-21, 0) | 21 | x1.008 | still then moves at the end (3 -> 85) |
Rules: **character/face holds are almost locked (2-5 px/s) with a 0.8-1.5 %/s push-in**; **macro world holds pan 20-60 px/s**, mostly
vertical, content moving up; pipes/mito add a 4-7 %/s push-in. Jitter (std of smoothed vy) 2-60 px/s: no handheld shake, just uneven speed.

### 1b. Correction found while verifying (belt shot)
Log-polar zoom is unreliable when content changes (the slit opens), so every `push-in per s` figure above is **low confidence**. Measuring the buckle width directly
(540 px frames, every 0.25 s from 4.9 s): 189, 199, 201, 207, 213, 219, 229, 236, 240, 242, 244 = **x1.29 in 2.5 s, fast in the middle, easing out**; the buckle also rises 18 px (540 px frame).
`animate.py` drives the camera from this series (`BUCKLE_W`, `set_cam_belt`). If a shot's zoom matters, measure a tracked object's size, not the global log-polar zoom.

## 2. Transitions and dives
- slit -> cave dive (7.5-8.15 s): total zoom x1.47 but the zoom is squeezed into the LAST 0.1 s (t10 0.47 s, t50 0.57 s, t90 0.60 s of the 0.65 s window) =
  **ease-in with a hard rush at the end**, peak image speed ~3150 px/s, heavy defocus (frame becomes big discs).
- ring -> cell dive (19.7-22.3 s): ease-in too (t50 at 2.17 of 2.6 s), total x5 (low confidence: content changes during the dive), peak ~7000 px/s.
- family pan (12.1-16.8 s): mean 1500 px/s, peak 4350 (low confidence: repetitive bokeh aliases phase correlation) - treat as a fast ease-in/out lateral track.
- keys/jars (37.5-41.2 s) 566 px/s mean, legs (3.2-4.7 s) 300 px/s: fast shots, 1-2 s each.

## 3. Slit opening (belt shot): STEPS, not pulses
Dark slit width at 1080 px, every 0.1 s from t = 4.9 s:
0, 0, 0, 0, 3, 7, 7.5, 7.7, 6.8, 6.9, 8, **20.5, 29, 33**, 35, 34, 34, 35, 36, **43, 58, 71**, 72, 71, 68, 67.
= opens ~3 px at 5.3 s, 7 px plateau (5.4-5.9 s), jump to ~34 px (6.0-6.2 s), plateau until 6.7 s, jump to ~72 px (6.8-7.1 s), hold.
Three jumps with plateaus between = tension, not a smooth wipe. Ember behind the slit brightens with width.

## 4. Flames (candles, hero flame)
- Flicker is **broadband, dominant 2-3.3 Hz** (area peak 3.3 Hz, tip peak 2.1-2.5 Hz), NOT a clean 6-10 Hz.
- Hero flame in the cave: area std 5 % of area, tip jumps std 38 px (range 284 px over 1.6 s, includes drift); in the finale area std 1.2 %, tip std 38 px, range 139 px.
- Recipe (animate.py): sum of sines 1.7 / 2.5 / 3.3 / 4.6 / 6.1 Hz with amps 0.6 / 1 / 1 / 0.6 / 0.35, unit std; height std 4 %, width std 2.5 %, light energy +-5 %.

## 5. Hands (flame judged by pointing hands)
Fingers bob at **1.25 Hz** (both axes), amplitude ~7 px std along the pointing axis (peak ~10 px at 1080). Hands slide in during 8.15-8.6 s
(staggered 0.05 s, ease-out cubic, landing without overshoot).

## 6. Light timeline of the birthday blow-out (global luminance 0-255, every 0.05 s from 0.3 s)
85, 85, 85, 85, 85, 83, 83, 77, 67, 52, 51, **35, 28**, 32, 32, 34, 33, 40, 40, 43, 56, 72, 72, 81, 88, 90, 90, 88, 89, 89
= lit until 0.55 s, dark 0.85-1.15 s (about a third of the brightness), relights in 4 steps by 1.5 s. (`animate.py: blowout_gain`).

## 7. Verification: our clips vs the reference (same measuring functions, `scripts/finish_clips.py`, clips in `references/our_tests/animation/`)
| quantity | reference | ours (final) |
|---|---|---|
| slit width every 0.1 s | 0,0,0,0,3,7,7.5,7.7,6.8,6.9,8,20.5,29,33,35,34,34,35,36,43,58,71,72,71,68,67 | 0,0,0,0,5,5,5,5,5,6,21,31,36,39,38,38,38,40,47,64,80,80,77,74,71,70 |
| flame tip flicker (std) | 38 px | 35 px |
| flame area flicker (std) | 5.0 % | 9.4 % (too much; the measuring mask also sees bloom) |
| flame dominant freq (area / tip) | 3.3 / 2.5 Hz | 3.3 / 3.3 Hz |
| hand-crop bob (std x / y) | 7.3 / 0.65 px, 1.25 Hz | 2.5 / 2.2 px, 1.8 Hz (not comparable: our hands are arranged differently) |
Slit: same 3 steps and plateaus, within 10-20 %. Calibration constant `SLIT_CAL` was needed (world width -> measured dark px depends on zoom and lens shape).

### Known gaps that animate.py does NOT fix (visible in `cmp_*.jpg`)
- **dive**: FIXED, see `DIVE.md` (leaf opening, rack focus to far interior rings, rush, cave opens zoomed out). Remaining: flatter rings, faint double flame at the seam.
- **cave**: partly FIXED (`S.cave(True, far=1.5)`: reference framing, rings fill the frame, hands on the axes and entering from 8.4 s, door glow hidden). Remaining: hand tips come closer to the flame than in the original; flame tip jitter 22 px vs 38 px while area flicker is 10 % vs 5 % (the original tip sways without changing the area, ours scales).
  The reference flame also CHANGES FACE (happy -> surprised -> worried) during the shot - expression animation is not implemented or measured.
- **belt**: the reference belt tilts and shifts frame to frame (stress), tension strokes appear only after ~5.5 s, the slit interior is dark red with a soft orange glow (ours: flat bright yellow ember), the reference shows three buttons at the start.
  Our shirt is now 17 x 24 so the zoomed-out start has no gray band.

## 8. NOT measured (honest list)
Sugar-cube fall/bounce, key and lid arcs, blinks, the blue "tension" strokes beside the button, belt tilt/buckle jiggle, fingers on other shots,
camera motion blur. Treat the old qualitative notes in STYLE_BIBLE §8 as guesses for these. Dive zoom and family pan numbers: low confidence.
