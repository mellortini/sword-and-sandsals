# F1 — test wyglądu (2026-11-23)

## Co powstało
| element | plik | jak odpalić |
|---|---|---|
| materiały z BlenderKit (9 darmowych skanów papieru/tektury, CC0 / royalty free) | `art_src/blenderkit/<nazwa>/` (+ `tex/` wypakowane mapy, `assets.json` licencje/autorzy, `tex_stats.json`) | pobrane anonimowo przez API BlenderKit (darmowe assety) |
| biblioteka sprite'ów | `blender/sprite_lib.py` | `tex_paper` (kolor × włókna washi/akwarela + ząbek cold-pressed + normal), `tex_board` (kraft, tektura, falista), `foil` (metal), `limb_pts`, `render_coll` (ortho render jednej części + pivot) |
| kukła gladiatora | `blender/gladiator.py` → `assets/chars/hero/parts/*.png`, `rig.json`, `assembly.png` | `D:/blender/blender.exe -b --python game/blender/gladiator.py -- D:/animacje/game/assets/chars/hero 48 all` (~15 s) |
| tło areny | `blender/arena.py` → `assets/bg/arena.png` | `D:/blender/blender.exe -b --python game/blender/arena.py -- D:/animacje/game/assets/bg/arena.png 1920 1080 128` (~12 s) |
| runtime | `src/rig/PaperRig.ts`, `src/main.ts` (Vite + PixiJS 8, WebGL) | `npx vite game --config game/vite.config.ts` → http://localhost:5180 (`?compare` = Cycles vs runtime, `?shot=nazwa` = zrzut 1920x1080 do `out/`) |

## Ustalenia techniczne
- Kukła = 17 kości, 17 rysowanych części (16 unikalnych sprite'ów + kopie „tylne” ciemniejsze), PPU 90 (master 2x), w grze 38 px/jednostkę (postać ~40 % wysokości ekranu).
- Cień papieru w grze: rozmyta sylwetka części rysowana tuż PRZED częścią, przesunięta wg kierunku słońca z rig.json.
  Pixi `multiply` dodawał alfę poza sylwetką → `patchShadowBlend` zmienia czynniki alfy na (ZERO, ONE): cień przyciemnia tylko papier już narysowany (jak canvas source-atop). Porównanie z Cycles (`?compare`) — praktycznie identycznie.
- Przeciwnik = te same sprite'y odbite (scale.x = -1); offset cienia odbijany, żeby światło dalej szło z lewej-góry. Wypalone oświetlenie w sprite'ach jest wtedy lustrzane (subtelne). Jeśli będzie przeszkadzać: render drugiego zestawu części z odbitą geometrią.
- 60 fps na desktopie (2 kukły → 2 RenderTexture na klatkę).

## Lekcje (nie powtarzać)
- Nakładające się warstwy na tej samej wysokości Z = czarne plamy (mięśnie piersiowe, widzowie w rzędzie). Każda nakładająca się warstwa musi mieć unikalne z (widzowie: + k·0.0035).
- `limb_pts`: górna czapka musi iść od lewej do prawej (odwrócona), inaczej obrys się krzyżuje i powstaje ciemny sierp.
- `extract.canvas({frame: ...})` w Pixi 8 zawieszał zrzut — bez `frame` działa.
- DOF w Cycles na dioramie areny prawie nic nie daje (głębia trybun mała wobec odległości kamery) — separację postaci od tłumu robić w grze (lekkie przyciemnienie/rozmycie warstwy tłumu) albo rozsunąć trybuny w Z.

## Otwarte do decyzji (po Twojej ocenie)
- styl twarzy / proporcje (głowa 1.12×), kolory skóry, hełm z grzebieniem
- separacja tłumu od walczących (przyciemnić/rozmyć tłum?)
- czy przeciwnik ma mieć osobny render (prawdziwe światło z lewej) zamiast lustra
